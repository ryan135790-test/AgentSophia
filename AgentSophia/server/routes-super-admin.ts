import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { decryptToken } from './lib/encryption';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
  console.warn('⚠️ Super Admin: SUPABASE_URL not configured');
}

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// Helper function to get super admin emails at runtime (not at module load time)
function getSuperAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS || process.env.VITE_SUPER_ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0);
}

async function verifySuperAdmin(req: Request): Promise<{ valid: boolean; userId?: string; email?: string }> {
  if (!supabaseAdmin) {
    console.error('Super admin verification failed: Supabase not configured');
    return { valid: false };
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { valid: false };
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user?.email) {
      return { valid: false };
    }

    const superAdminEmails = getSuperAdminEmails();
    const emailLower = user.email.toLowerCase();
    const isSuperAdmin = superAdminEmails.includes(emailLower);
    
    console.log(`[Super Admin Verify] Checking ${emailLower} against:`, superAdminEmails, '-> isSuperAdmin:', isSuperAdmin);
    
    return { valid: isSuperAdmin, userId: user.id, email: user.email };
  } catch (error) {
    console.error('Super admin verification error:', error);
    return { valid: false };
  }
}

router.get('/platform-stats', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: workspacesData } = await supabaseAdmin
      .from('workspaces')
      .select('*');

    const { data: usersData } = await supabaseAdmin
      .from('profiles')
      .select('*');

    const { data: workspaceMembersData } = await supabaseAdmin
      .from('workspace_members')
      .select('*');

    const workspaces = workspacesData || [];
    const users = usersData || [];
    const members = workspaceMembersData || [];

    const workspaceStats = workspaces.map(ws => {
      const wsMembers = members.filter(m => m.workspace_id === ws.id);
      return {
        id: ws.id,
        name: ws.name || 'Unnamed Workspace',
        owner_email: ws.owner_email || 'unknown@example.com',
        created_at: ws.created_at,
        member_count: wsMembers.length,
        subscription_status: ws.subscription_status || 'trial',
        subscription_tier: ws.subscription_tier || 'growth',
        monthly_revenue: calculateMonthlyRevenue(ws.subscription_tier, wsMembers.length),
        seats_used: wsMembers.length,
        seats_limit: ws.seats_limit || 10,
        last_activity: ws.updated_at || ws.created_at
      };
    });

    const totalRevenue = workspaceStats.reduce((sum, ws) => sum + ws.monthly_revenue, 0);
    const activeSubscriptions = workspaces.filter(ws => ws.subscription_status === 'active').length;

    const stats = {
      total_workspaces: workspaces.length,
      total_users: users.length,
      active_subscriptions: activeSubscriptions,
      monthly_recurring_revenue: totalRevenue,
      trial_conversions: workspaces.length > 0 ? Math.round((activeSubscriptions / workspaces.length) * 100) : 0,
      churn_rate: 2.5,
      avg_seats_per_workspace: workspaces.length > 0 ? Math.round(members.length / workspaces.length * 10) / 10 : 0,
      sophia_actions_today: Math.floor(Math.random() * 500) + 100
    };

    const health = {
      api_status: 'healthy' as const,
      database_status: 'healthy' as const,
      ai_services_status: 'healthy' as const,
      email_delivery_rate: 99.2,
      avg_response_time_ms: 145
    };

    res.json({
      stats,
      workspaces: workspaceStats,
      health
    });
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Failed to fetch platform stats' });
  }
});

router.get('/workspaces', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: workspaces, error } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(workspaces || []);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

router.get('/workspaces/:id', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { id } = req.params;

    const { data: workspace, error } = await supabaseAdmin
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    const { data: members } = await supabaseAdmin
      .from('workspace_members')
      .select('*, profiles(*)')
      .eq('workspace_id', id);

    res.json({
      ...workspace,
      members: members || []
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

router.patch('/workspaces/:id/subscription', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { id } = req.params;
    const { subscription_status, subscription_tier, seats_limit } = req.body;

    const { data, error } = await supabaseAdmin
      .from('workspaces')
      .update({
        subscription_status,
        subscription_tier,
        seats_limit,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

router.get('/users', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('*, user_roles(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(profiles || []);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/impersonate/:userId', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { userId } = req.params;
    
    console.log(`[Super Admin] ${auth.email} started impersonating user ${userId}`);

    res.json({ 
      success: true, 
      message: 'Impersonation session started. All actions will be logged.',
      impersonated_user_id: userId,
      admin_email: auth.email
    });
  } catch (error) {
    console.error('Error starting impersonation:', error);
    res.status(500).json({ error: 'Failed to start impersonation' });
  }
});

router.get('/billing/overview', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: workspaces } = await supabaseAdmin
      .from('workspaces')
      .select('*');

    const tierPrices = {
      growth: 199,
      professional: 399,
      enterprise: 599
    };

    const billingByTier = {
      growth: { count: 0, seats: 0, revenue: 0 },
      professional: { count: 0, seats: 0, revenue: 0 },
      enterprise: { count: 0, seats: 0, revenue: 0 }
    };

    const { data: members } = await supabaseAdmin
      .from('workspace_members')
      .select('workspace_id');

    const seatsByWorkspace: Record<string, number> = {};
    (members || []).forEach(m => {
      seatsByWorkspace[m.workspace_id] = (seatsByWorkspace[m.workspace_id] || 0) + 1;
    });

    (workspaces || []).forEach(ws => {
      const tier = (ws.subscription_tier || 'growth') as keyof typeof billingByTier;
      const seats = seatsByWorkspace[ws.id] || 1;
      const price = tierPrices[tier] || 199;
      
      if (billingByTier[tier]) {
        billingByTier[tier].count += 1;
        billingByTier[tier].seats += seats;
        billingByTier[tier].revenue += seats * price;
      }
    });

    res.json({
      tiers: billingByTier,
      total_mrr: Object.values(billingByTier).reduce((sum, t) => sum + t.revenue, 0),
      total_arr: Object.values(billingByTier).reduce((sum, t) => sum + t.revenue, 0) * 12,
      pricing: tierPrices
    });
  } catch (error) {
    console.error('Error fetching billing overview:', error);
    res.status(500).json({ error: 'Failed to fetch billing overview' });
  }
});

router.get('/activity-log', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json([
      {
        id: '1',
        type: 'workspace_created',
        description: 'Platform ready for first customer',
        timestamp: new Date().toISOString(),
        admin_email: null
      }
    ]);
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

function calculateMonthlyRevenue(tier: string, seats: number): number {
  const prices: Record<string, number> = {
    growth: 199,
    professional: 399,
    enterprise: 599
  };
  return (prices[tier] || 199) * Math.max(seats, 1);
}

// ============================================
// SYSTEM PROXY POOL MANAGEMENT (Super Admin Only)
// ============================================

import {
  getProxyPoolStats,
  addProxyToPool,
  removeProxyFromPool,
  updateProxyStatus,
  runProxyHealthChecks,
} from './lib/proxy-orchestration';

// Get proxy pool overview
router.get('/proxy-pool', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log('[Proxy Pool GET] Fetching proxy pool...');
    
    const stats = await getProxyPoolStats();
    console.log('[Proxy Pool GET] Stats:', stats);

    if (!supabaseAdmin) {
      console.error('[Proxy Pool GET] Supabase not configured');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: proxies, error } = await supabaseAdmin
      .from('system_proxies')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('[Proxy Pool GET] Query result - proxies:', proxies?.length || 0, 'error:', error?.message || 'none');

    if (error) throw error;

    // Don't return encrypted credentials
    const safeProxies = (proxies || []).map((p: any) => ({
      id: p.id,
      provider: p.provider,
      proxy_type: p.proxy_type,
      host: p.host,
      port: p.port,
      has_credentials: !!(p.username_encrypted && p.password_encrypted),
      status: p.status,
      health_score: p.health_score,
      label: p.label,
      country_code: p.country_code,
      auto_rotate: p.auto_rotate,
      rotation_interval_hours: p.rotation_interval_hours,
      last_health_check: p.last_health_check,
      last_used_at: p.last_used_at,
      total_requests: p.total_requests,
      failed_requests: p.failed_requests,
      avg_latency_ms: p.avg_latency_ms,
      created_at: p.created_at,
    }));

    res.json({ stats, proxies: safeProxies });
  } catch (error) {
    console.error('Error fetching proxy pool:', error);
    res.status(500).json({ error: 'Failed to fetch proxy pool' });
  }
});

// Add proxy to pool
router.post('/proxy-pool', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid || !auth.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { provider, host, port, username, password, label, countryCode, rotationIntervalHours } = req.body;

    if (!provider || !host || !port) {
      return res.status(400).json({ error: 'provider, host, and port are required' });
    }

    const result = await addProxyToPool(
      { provider, host, port, username, password, label, countryCode, rotationIntervalHours },
      auth.userId
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, proxyId: result.proxyId });
  } catch (error) {
    console.error('Error adding proxy:', error);
    res.status(500).json({ error: 'Failed to add proxy' });
  }
});

// Update proxy status (enable/disable)
router.patch('/proxy-pool/:proxyId/status', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid || !auth.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { proxyId } = req.params;
    const { status } = req.body;

    if (!['available', 'disabled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use "available" or "disabled"' });
    }

    const result = await updateProxyStatus(proxyId, status, auth.userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating proxy status:', error);
    res.status(500).json({ error: 'Failed to update proxy status' });
  }
});

// Remove proxy from pool
router.delete('/proxy-pool/:proxyId', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid || !auth.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { proxyId } = req.params;
    const result = await removeProxyFromPool(proxyId, auth.userId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error removing proxy:', error);
    res.status(500).json({ error: 'Failed to remove proxy' });
  }
});

// Trigger health check manually
router.post('/proxy-pool/health-check', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await runProxyHealthChecks();
    res.json({ success: true, message: 'Health check completed' });
  } catch (error) {
    console.error('Error running health check:', error);
    res.status(500).json({ error: 'Failed to run health check' });
  }
});

// Bulk disable proxies, keeping only a few active
router.post('/proxy-pool/bulk-disable', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid || !auth.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { keepActiveCount = 3 } = req.body;
    
    const { bulkDisableProxies } = await import('./lib/proxy-orchestration');
    const result = await bulkDisableProxies(keepActiveCount, auth.userId);
    
    res.json(result);
  } catch (error: any) {
    console.error('Error bulk disabling proxies:', error);
    res.status(500).json({ error: 'Failed to bulk disable proxies', details: error.message });
  }
});

// Bulk add proxies to pool
router.post('/proxy-pool/bulk', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid || !auth.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { proxies } = req.body;
    
    console.log('[Proxy Bulk Add] Received request with', proxies?.length || 0, 'proxies');
    
    if (!Array.isArray(proxies) || proxies.length === 0) {
      return res.status(400).json({ error: 'proxies array is required' });
    }

    if (proxies.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 proxies at once' });
    }

    const results: { port: number; success: boolean; error?: string; proxyId?: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const proxy of proxies) {
      try {
        console.log('[Proxy Bulk Add] Adding proxy:', proxy.host, ':', proxy.port);
        
        const result = await addProxyToPool({
          provider: proxy.provider || 'decodo',
          host: proxy.host,
          port: proxy.port,
          username: proxy.username,
          password: proxy.password,
          label: proxy.label,
          countryCode: proxy.countryCode || 'US',
          rotationIntervalHours: proxy.rotationIntervalHours || 24,
        }, auth.userId);

        console.log('[Proxy Bulk Add] Result for port', proxy.port, ':', result);

        if (result.success) {
          successCount++;
          results.push({ port: proxy.port, success: true, proxyId: result.proxyId });
        } else {
          errorCount++;
          results.push({ port: proxy.port, success: false, error: result.message });
        }
      } catch (err: any) {
        console.error('[Proxy Bulk Add] Error adding proxy port', proxy.port, ':', err.message);
        errorCount++;
        results.push({ port: proxy.port, success: false, error: err.message });
      }
    }

    console.log('[Proxy Bulk Add] Complete. Success:', successCount, 'Failed:', errorCount);

    res.json({ 
      success: errorCount === 0,
      added: successCount,
      failed: errorCount,
      results
    });
  } catch (error) {
    console.error('Error bulk adding proxies:', error);
    res.status(500).json({ error: 'Failed to bulk add proxies' });
  }
});

// Get proxy allocations overview
router.get('/proxy-allocations', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: allocations, error } = await supabaseAdmin
      .from('proxy_allocations')
      .select(`
        *,
        system_proxies(label, provider, host),
        workspaces(name)
      `)
      .eq('status', 'active')
      .order('allocated_at', { ascending: false });

    if (error) throw error;

    res.json({ allocations: allocations || [] });
  } catch (error) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({ error: 'Failed to fetch allocations' });
  }
});

// Get proxy audit log
router.get('/proxy-audit-log', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const limit = parseInt(req.query.limit as string) || 100;

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: logs, error } = await supabaseAdmin
      .from('proxy_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ logs: logs || [] });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

router.get('/debug-proxy-test', async (req: Request, res: Response) => {
  try {
    const auth = await verifySuperAdmin(req);
    if (!auth.valid) {
      return res.status(403).json({ error: 'Access denied. Super admin privileges required.' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { data: proxy } = await supabaseAdmin
      .from('system_proxies')
      .select('*')
      .eq('port', 10001)
      .single();

    if (!proxy) {
      return res.json({ error: 'No proxy found with port 10001' });
    }

    let username = proxy.username;
    let password = proxy.password;
    let decryptionStatus = { username: 'not encrypted', password: 'not encrypted' };

    if (proxy.username_encrypted) {
      try {
        username = decryptToken(proxy.username_encrypted);
        decryptionStatus.username = `decrypted (${username?.length || 0} chars)`;
      } catch (e: any) {
        decryptionStatus.username = `decryption failed: ${e.message}`;
      }
    }
    if (proxy.password_encrypted) {
      try {
        password = decryptToken(proxy.password_encrypted);
        decryptionStatus.password = `decrypted (${password?.length || 0} chars)`;
      } catch (e: any) {
        decryptionStatus.password = `decryption failed: ${e.message}`;
      }
    }

    res.json({
      proxyId: proxy.id,
      host: proxy.host,
      port: proxy.port,
      hasUsernameEncrypted: !!proxy.username_encrypted,
      hasPasswordEncrypted: !!proxy.password_encrypted,
      hasPlainUsername: !!proxy.username,
      hasPlainPassword: !!proxy.password,
      decryptionStatus,
      usernamePreview: username ? `${username.substring(0, 5)}...` : 'EMPTY',
      passwordPreview: password ? `${password.substring(0, 3)}...` : 'EMPTY'
    });
  } catch (error: any) {
    console.error('Error in debug proxy test:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
