import { createClient } from '@supabase/supabase-js';
import { encryptToken, decryptToken } from './encryption';
import { sharedPool } from './shared-db-pool';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[Proxy Orchestration] Supabase client initialized');
  } catch (error) {
    console.warn('[Proxy Orchestration] Failed to initialize Supabase client:', error);
  }
} else {
  console.warn('[Proxy Orchestration] Missing Supabase credentials - proxy features unavailable');
}

let tablesInitialized = false;

export async function initProxyTables(): Promise<void> {
  if (tablesInitialized) return;
  if (!supabase) {
    console.warn('[Proxy Init] Supabase not available - skipping table initialization');
    return;
  }
  
  try {
    // Check if system_proxies table exists by trying to select from it
    const { data: checkData, error: checkError } = await supabase
      .from('system_proxies')
      .select('id')
      .limit(1);
    
    console.log('[Proxy Init] Table check result - data:', checkData?.length || 0, 'rows, error:', checkError?.message || 'none', 'code:', checkError?.code || 'none');
    
    if (checkError?.code === '42P01') {
      // Table doesn't exist - create it via RPC or direct SQL
      console.log('[Proxy Init] Creating system_proxies table...');
      
      // Use raw SQL via RPC function or create tables manually
      const createProxiesSQL = `
        CREATE TABLE IF NOT EXISTS system_proxies (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          provider VARCHAR(100) NOT NULL DEFAULT 'decodo',
          proxy_type VARCHAR(50) NOT NULL DEFAULT 'mobile',
          host VARCHAR(255) NOT NULL,
          port INTEGER NOT NULL,
          username_encrypted TEXT,
          password_encrypted TEXT,
          label VARCHAR(255),
          country_code VARCHAR(10) DEFAULT 'US',
          status VARCHAR(50) DEFAULT 'available',
          health_score INTEGER DEFAULT 100,
          auto_rotate BOOLEAN DEFAULT true,
          rotation_interval_hours INTEGER DEFAULT 24,
          last_health_check TIMESTAMPTZ,
          last_used_at TIMESTAMPTZ,
          total_requests INTEGER DEFAULT 0,
          failed_requests INTEGER DEFAULT 0,
          avg_latency_ms INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      const createAllocationsSQL = `
        CREATE TABLE IF NOT EXISTS proxy_allocations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proxy_id UUID REFERENCES system_proxies(id) ON DELETE CASCADE,
          user_id UUID NOT NULL,
          workspace_id UUID NOT NULL,
          status VARCHAR(50) DEFAULT 'active',
          current_session_id VARCHAR(255),
          allocated_at TIMESTAMPTZ DEFAULT NOW(),
          next_rotation_at TIMESTAMPTZ,
          released_at TIMESTAMPTZ
        );
      `;
      
      const createAuditSQL = `
        CREATE TABLE IF NOT EXISTS proxy_audit_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          proxy_id UUID,
          user_id UUID,
          action VARCHAR(100) NOT NULL,
          details TEXT,
          performed_by UUID,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `;
      
      // Try using the Supabase SQL editor function if available
      // Otherwise, tables need to be created manually in Supabase dashboard
      console.log('[Proxy Init] Tables need to be created in Supabase. Please run the following SQL:');
      console.log(createProxiesSQL);
      console.log(createAllocationsSQL);
      console.log(createAuditSQL);
    } else {
      console.log('[Proxy Init] system_proxies table exists');
    }
    
    tablesInitialized = true;
  } catch (error) {
    console.error('[Proxy Init] Error checking/creating tables:', error);
  }
}

// Initialize tables on module load
initProxyTables().catch(console.error);

interface ProxyConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  password: string;
  stickySessionId?: string;
  provider?: string;
}

interface AllocationResult {
  success: boolean;
  proxy?: ProxyConfig;
  allocationId?: string;
  message?: string;
}

export async function getOrAllocateProxy(
  userId: string,
  workspaceId: string
): Promise<AllocationResult> {
  try {
    // Use direct PostgreSQL to avoid Supabase replica lag
    const allocResult = await sharedPool.query(`
      SELECT pa.*, 
             sp.id as proxy_id, sp.host, sp.port, sp.username_encrypted, 
             sp.password_encrypted, sp.provider
      FROM proxy_allocations pa
      JOIN system_proxies sp ON pa.proxy_id = sp.id
      WHERE pa.user_id = $1
        AND pa.workspace_id = $2
        AND pa.status = 'active'
      LIMIT 1
    `, [userId, workspaceId]);

    if (allocResult.rows.length > 0) {
      const row = allocResult.rows[0];
      
      // Check if rotation is needed
      if (row.next_rotation_at && new Date(row.next_rotation_at) < new Date()) {
        return await rotateUserProxy(userId, workspaceId, row.id);
      }

      // DECODO FIX: Always use port 7000 for Decodo sticky sessions
      // Port 7000 is the ONLY port that supports sticky session parameters
      // Other Decodo ports (10009, 10040, 10049) use raw auth and fail for sticky sessions
      let proxyPort = row.port;
      if (row.provider === 'decodo') {
        const originalPort = proxyPort;
        proxyPort = 7000;
        console.log(`[Proxy] DECODO: Using port 7000 for sticky sessions (allocation had ${originalPort})`);
      } else {
        console.log(`[Proxy] Using port ${proxyPort} for session ${userId.slice(0, 8)} (provider: ${row.provider})`);
      }
      
      // Use the EXACT session ID from the allocation - never generate a new one
      // The session ID was created during login and must be preserved
      const stickySessionId = row.current_session_id;
      if (stickySessionId) {
        console.log(`[Proxy] Using LOCKED session ID: ${stickySessionId.slice(0, 20)}...`);
      } else {
        console.log(`[Proxy] ⚠️ No session ID found - session may have been created without one`);
      }

      return {
        success: true,
        proxy: {
          id: row.proxy_id,
          host: row.host,
          port: proxyPort,
          username: row.username_encrypted ? decryptToken(row.username_encrypted) : '',
          password: row.password_encrypted ? decryptToken(row.password_encrypted) : '',
          stickySessionId: stickySessionId || undefined,
          provider: row.provider || undefined,
        },
        allocationId: row.id,
      };
    }

    return await allocateNewProxy(userId, workspaceId);
  } catch (error: any) {
    console.error('Error getting/allocating proxy:', error);
    return { success: false, message: error.message };
  }
}

// Get a specific proxy by ID (for sessions that need to use the same proxy they logged in with)
export async function getProxyById(proxyId: string, userId?: string, workspaceId?: string): Promise<AllocationResult> {
  if (!supabase) {
    return { success: false, message: 'Supabase not initialized' };
  }
  
  try {
    const { data: proxy, error } = await supabase
      .from('system_proxies')
      .select('*')
      .eq('id', proxyId)
      .single();
    
    if (error || !proxy) {
      console.log(`[Proxy] Proxy not found by ID ${proxyId}: ${error?.message || 'no data'}`);
      return { success: false, message: `Proxy ${proxyId} not found` };
    }
    
    // DECODO FIX: Always use port 7000 for Decodo sticky sessions
    // Port 7000 is the ONLY port that supports sticky session parameters
    // Other ports (10009, 10040, 10049, etc.) use raw auth and fail
    let proxyPort = proxy.port;
    if (proxy.provider === 'decodo') {
      const originalPort = proxyPort;
      proxyPort = 7000;
      console.log(`[Proxy] getProxyById: DECODO - Using port 7000 for sticky sessions (was ${originalPort})`);
    } else {
      console.log(`[Proxy] getProxyById: Using port ${proxyPort} for proxy ${proxyId} (provider: ${proxy.provider})`);
    }
    
    // CRITICAL: Look up the allocation to get the sticky session ID
    // This ensures we use the SAME IP that was used during login
    let stickySessionId: string | undefined;
    if (userId && workspaceId) {
      const { data: allocation } = await supabase
        .from('proxy_allocations')
        .select('current_session_id')
        .eq('proxy_id', proxyId)
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (allocation?.current_session_id) {
        stickySessionId = allocation.current_session_id;
        console.log(`[Proxy] getProxyById: Found sticky session ID: ${stickySessionId}`);
      } else {
        // Generate a new session ID if no allocation exists
        stickySessionId = `sess_${userId.slice(0, 8)}_${Date.now()}`;
        console.log(`[Proxy] getProxyById: No allocation found, generated new session ID: ${stickySessionId}`);
      }
    }
    
    return {
      success: true,
      proxy: {
        id: proxy.id,
        host: proxy.host,
        port: proxyPort,
        username: proxy.username_encrypted ? decryptToken(proxy.username_encrypted) : '',
        password: proxy.password_encrypted ? decryptToken(proxy.password_encrypted) : '',
        provider: proxy.provider || undefined,
        stickySessionId,
      },
    };
  } catch (err: any) {
    console.error('[Proxy] Error getting proxy by ID:', err.message);
    return { success: false, message: err.message };
  }
}

async function allocateNewProxy(
  userId: string,
  workspaceId: string
): Promise<AllocationResult> {
  console.log(`[Proxy] allocateNewProxy called for user=${userId.slice(0, 8)}, workspace=${workspaceId.slice(0, 8)}`);
  
  // First try to find a "master" proxy (pay-per-GB model with unlimited sessions)
  // Use maybeSingle() to avoid errors when no master proxy exists
  const { data: masterProxies, error: masterError } = await supabase
    .from('system_proxies')
    .select('*')
    .eq('proxy_type', 'master')
    .eq('status', 'available')
    .order('health_score', { ascending: false })
    .limit(1);
  
  const masterProxy = masterProxies?.[0] || null;
  console.log(`[Proxy] Master proxy query: found=${!!masterProxy}, count=${masterProxies?.length || 0}, error=${masterError?.message || 'none'}`);

  // If master proxy exists, use it with a unique sticky session (no need to mark as allocated)
  if (masterProxy) {
    const now = new Date().toISOString();
    const nextRotation = new Date(Date.now() + (masterProxy.rotation_interval_hours || 24) * 60 * 60 * 1000).toISOString();
    const sessionId = `sess_${userId.slice(0, 8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data: allocation, error: allocError } = await supabase
      .from('proxy_allocations')
      .insert({
        proxy_id: masterProxy.id,
        user_id: userId,
        workspace_id: workspaceId,
        status: 'active',
        allocated_at: now,
        next_rotation_at: nextRotation,
        current_session_id: sessionId,
      })
      .select()
      .single();

    if (allocError) {
      console.error(`[Proxy] Failed to create allocation for workspace=${workspaceId.slice(0, 8)}:`, allocError.message, 'code:', allocError.code, 'details:', allocError.details);
      
      // If it's a unique constraint violation, try to clean up and retry
      if (allocError.code === '23505') {
        console.log('[Proxy] Cleaning up stale allocation and retrying...');
        await supabase
          .from('proxy_allocations')
          .delete()
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId);
        
        // Retry the insert
        const { data: retryAllocation, error: retryError } = await supabase
          .from('proxy_allocations')
          .insert({
            proxy_id: masterProxy.id,
            user_id: userId,
            workspace_id: workspaceId,
            status: 'active',
            allocated_at: now,
            next_rotation_at: nextRotation,
            current_session_id: sessionId,
          })
          .select()
          .single();
        
        if (retryError) {
          console.error('[Proxy] Retry also failed:', retryError.message);
          return { success: false, message: `Failed to create allocation: ${retryError.message}` };
        }
        
        // Use port 7000 for Decodo, otherwise database port
        let retryPort = masterProxy.port;
        if (masterProxy.host === 'gate.decodo.com' || masterProxy.provider === 'decodo') {
          retryPort = 7000;
          console.log(`[Proxy] Retry: Using port 7000 for Decodo sticky sessions`);
        }
        
        return {
          success: true,
          proxy: {
            id: masterProxy.id,
            host: masterProxy.host,
            port: retryPort,
            username: masterProxy.username_encrypted ? decryptToken(masterProxy.username_encrypted) : '',
            password: masterProxy.password_encrypted ? decryptToken(masterProxy.password_encrypted) : '',
            stickySessionId: sessionId,
            provider: masterProxy.provider || undefined,
          },
          allocationId: retryAllocation.id,
        };
      }
      
      return { success: false, message: `Failed to create allocation: ${allocError.message}` };
    }

    await supabase
      .from('system_proxies')
      .update({ last_used_at: now })
      .eq('id', masterProxy.id);

    await logProxyAction(masterProxy.id, userId, 'session_created', `Master proxy session for workspace ${workspaceId}`);

    // Use the port stored in the database, but override for Decodo global endpoint
    let proxyPort = masterProxy.port;
    
    // CRITICAL FIX: Decodo requires port 7000 for sticky sessions
    if (masterProxy.host === 'gate.decodo.com' || masterProxy.provider === 'decodo') {
      proxyPort = 7000;
      console.log(`[Proxy] Using port 7000 for Decodo sticky sessions (was ${masterProxy.port})`);
    } else {
      console.log(`[Proxy] Using database port ${proxyPort} for session ${userId.slice(0, 8)}`);
    }
    
    return {
      success: true,
      proxy: {
        id: masterProxy.id,
        host: masterProxy.host,
        port: proxyPort,
        username: masterProxy.username_encrypted ? decryptToken(masterProxy.username_encrypted) : '',
        password: masterProxy.password_encrypted ? decryptToken(masterProxy.password_encrypted) : '',
        stickySessionId: sessionId,
        provider: masterProxy.provider || undefined,
      },
      allocationId: allocation.id,
    };
  }

  // Fallback: use dedicated proxy pool (one proxy per user)
  console.log(`[Proxy] No master proxy, trying dedicated proxy pool...`);
  const { data: availableProxies, error: proxyError } = await supabase
    .from('system_proxies')
    .select('*')
    .eq('status', 'available')
    .neq('proxy_type', 'master')
    .order('health_score', { ascending: false })
    .order('last_used_at', { ascending: true, nullsFirst: true })
    .limit(1);

  const availableProxy = availableProxies?.[0] || null;
  console.log(`[Proxy] Dedicated proxy query: found=${!!availableProxy}, count=${availableProxies?.length || 0}, error=${proxyError?.message || 'none'}`);

  if (proxyError || !availableProxy) {
    console.error(`[Proxy] No proxies available for workspace=${workspaceId.slice(0, 8)}`);
    return { success: false, message: 'No available proxies in pool. Add a master proxy or dedicated proxies in Super Admin.' };
  }

  const now = new Date().toISOString();
  const nextRotation = new Date(Date.now() + (availableProxy.rotation_interval_hours || 24) * 60 * 60 * 1000).toISOString();
  const sessionId = `sess_${userId.slice(0, 8)}_${Date.now()}`;

  const { data: allocation, error: allocError } = await supabase
    .from('proxy_allocations')
    .insert({
      proxy_id: availableProxy.id,
      user_id: userId,
      workspace_id: workspaceId,
      status: 'active',
      allocated_at: now,
      next_rotation_at: nextRotation,
      current_session_id: sessionId,
    })
    .select()
    .single();

  if (allocError) {
    console.error(`[Proxy] Allocation insert failed: code=${allocError.code}, message=${allocError.message}, details=${allocError.details}`);
    
    // If it's a duplicate key error, clean up stale allocation and retry
    if (allocError.code === '23505') {
      console.log('[Proxy] Cleaning up stale dedicated allocation and retrying...');
      await supabase
        .from('proxy_allocations')
        .delete()
        .eq('user_id', userId)
        .eq('workspace_id', workspaceId);
      
      // Retry the insert
      const { data: retryAllocation, error: retryError } = await supabase
        .from('proxy_allocations')
        .insert({
          proxy_id: availableProxy.id,
          user_id: userId,
          workspace_id: workspaceId,
          status: 'active',
          allocated_at: now,
          next_rotation_at: nextRotation,
          current_session_id: sessionId,
        })
        .select()
        .single();
      
      if (retryError) {
        console.error('[Proxy] Retry also failed:', retryError.message);
        return { success: false, message: `Failed to create allocation: ${retryError.message}` };
      }
      
      await supabase
        .from('system_proxies')
        .update({ status: 'allocated', last_used_at: now })
        .eq('id', availableProxy.id);

      await logProxyAction(availableProxy.id, userId, 'allocated_to_user', `Auto-allocated to workspace ${workspaceId} (retry after cleanup)`);

      // Use port 7000 for Decodo sticky sessions
      let dedicatedRetryPort = availableProxy.port;
      if (availableProxy.host === 'gate.decodo.com' || availableProxy.provider === 'decodo') {
        dedicatedRetryPort = 7000;
        console.log(`[Proxy] Dedicated retry: Using port 7000 for Decodo sticky sessions`);
      }
      
      return {
        success: true,
        proxy: {
          id: availableProxy.id,
          host: availableProxy.host,
          port: dedicatedRetryPort,
          username: availableProxy.username_encrypted ? decryptToken(availableProxy.username_encrypted) : '',
          password: availableProxy.password_encrypted ? decryptToken(availableProxy.password_encrypted) : '',
          stickySessionId: sessionId,
          provider: availableProxy.provider || undefined,
        },
        allocationId: retryAllocation.id,
      };
    }
    
    return { success: false, message: `Failed to create allocation: ${allocError.message}` };
  }

  await supabase
    .from('system_proxies')
    .update({ status: 'allocated', last_used_at: now })
    .eq('id', availableProxy.id);

  await logProxyAction(availableProxy.id, userId, 'allocated_to_user', `Auto-allocated to workspace ${workspaceId}`);

  // Use port 7000 for Decodo sticky sessions
  let dedicatedPort = availableProxy.port;
  if (availableProxy.host === 'gate.decodo.com' || availableProxy.provider === 'decodo') {
    dedicatedPort = 7000;
    console.log(`[Proxy] Dedicated: Using port 7000 for Decodo sticky sessions (was ${availableProxy.port})`);
  }

  return {
    success: true,
    proxy: {
      id: availableProxy.id,
      host: availableProxy.host,
      port: dedicatedPort,
      username: availableProxy.username_encrypted ? decryptToken(availableProxy.username_encrypted) : '',
      password: availableProxy.password_encrypted ? decryptToken(availableProxy.password_encrypted) : '',
      stickySessionId: sessionId,
      provider: availableProxy.provider || undefined,
    },
    allocationId: allocation.id,
  };
}

function shouldRotate(allocation: any): boolean {
  if (!allocation.next_rotation_at) return false;
  return new Date(allocation.next_rotation_at) <= new Date();
}

async function rotateUserProxy(
  userId: string,
  workspaceId: string,
  currentAllocationId: string
): Promise<AllocationResult> {
  const { data: currentAlloc } = await supabase
    .from('proxy_allocations')
    .select('proxy_id')
    .eq('id', currentAllocationId)
    .single();

  if (currentAlloc) {
    await supabase
      .from('proxy_allocations')
      .update({ status: 'revoked' })
      .eq('id', currentAllocationId);

    await supabase
      .from('system_proxies')
      .update({ status: 'available', last_rotated_at: new Date().toISOString() })
      .eq('id', currentAlloc.proxy_id);

    await logProxyAction(currentAlloc.proxy_id, userId, 'rotation_triggered', 'Scheduled rotation');
  }

  return await allocateNewProxy(userId, workspaceId);
}

/**
 * Rotate the sticky session ID for an existing proxy allocation
 * This generates a new session ID to get a fresh IP from the mobile proxy provider
 * without changing the proxy allocation itself
 */
export async function rotateProxyStickySession(
  proxyId: string,
  userId: string,
  workspaceId: string
): Promise<{ success: boolean; newSessionId?: string; message?: string }> {
  if (!supabase) {
    return { success: false, message: 'Supabase not available' };
  }

  try {
    // Generate a new sticky session ID
    const newSessionId = `sess_${userId.slice(0, 8)}_${Date.now()}`;
    console.log(`[Proxy Rotation] Generating new sticky session: ${newSessionId}`);

    // Update the allocation with the new session ID
    const { error: updateError } = await supabase
      .from('proxy_allocations')
      .update({
        current_session_id: newSessionId,
        allocated_at: new Date().toISOString(), // Reset allocation time
      })
      .eq('proxy_id', proxyId)
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    if (updateError) {
      console.error('[Proxy Rotation] Failed to update allocation:', updateError);
      return { success: false, message: updateError.message };
    }

    // Also update the linkedin_puppeteer_settings table if it exists
    try {
      const { error: settingsError } = await supabase
        .from('linkedin_puppeteer_settings')
        .update({
          session_source: 'quick_login', // Keep as quick_login
          updated_at: new Date().toISOString(),
        })
        .eq('proxy_id', proxyId)
        .eq('workspace_id', workspaceId);

      if (settingsError) {
        console.warn('[Proxy Rotation] Could not update puppeteer settings:', settingsError.message);
      }
    } catch (e) {
      // Ignore if table doesn't exist
    }

    await logProxyAction(proxyId, userId, 'session_rotated', `New session: ${newSessionId} for workspace ${workspaceId}`);

    console.log(`[Proxy Rotation] Successfully rotated to new session: ${newSessionId}`);
    return { success: true, newSessionId };
  } catch (error: any) {
    console.error('[Proxy Rotation] Error:', error);
    return { success: false, message: error.message };
  }
}

export async function revokeUserProxy(userId: string, workspaceId: string): Promise<boolean> {
  try {
    const { data: allocation } = await supabase
      .from('proxy_allocations')
      .select('id, proxy_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (!allocation) return true;

    await supabase
      .from('proxy_allocations')
      .update({ status: 'revoked' })
      .eq('id', allocation.id);

    await supabase
      .from('system_proxies')
      .update({ status: 'available' })
      .eq('id', allocation.proxy_id);

    await logProxyAction(allocation.proxy_id, userId, 'revoked_from_user', 'Session ended');
    return true;
  } catch (error) {
    console.error('Error revoking proxy:', error);
    return false;
  }
}

export async function getUserProxyStatus(userId: string, workspaceId: string): Promise<{
  hasProxy: boolean;
  status?: string;
  proxyLabel?: string;
  nextRotation?: string;
  healthScore?: number;
}> {
  try {
    const { data: allocation } = await supabase
      .from('proxy_allocations')
      .select('*, system_proxies(label, health_score, provider)')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .single();

    if (!allocation) {
      return { hasProxy: false };
    }

    return {
      hasProxy: true,
      status: allocation.status,
      proxyLabel: allocation.system_proxies?.label || `${allocation.system_proxies?.provider} Proxy`,
      nextRotation: allocation.next_rotation_at,
      healthScore: allocation.system_proxies?.health_score,
    };
  } catch (error) {
    return { hasProxy: false };
  }
}

export async function getProxyPoolStats(): Promise<{
  total: number;
  available: number;
  allocated: number;
  unhealthy: number;
  disabled: number;
}> {
  const { data: proxies } = await supabase
    .from('system_proxies')
    .select('status');

  const stats = {
    total: proxies?.length || 0,
    available: 0,
    allocated: 0,
    unhealthy: 0,
    disabled: 0,
  };

  proxies?.forEach((p: any) => {
    if (p.status === 'available') stats.available++;
    else if (p.status === 'allocated') stats.allocated++;
    else if (p.status === 'unhealthy') stats.unhealthy++;
    else if (p.status === 'disabled') stats.disabled++;
  });

  return stats;
}

export async function addProxyToPool(
  proxyData: {
    provider: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
    label?: string;
    countryCode?: string;
    rotationIntervalHours?: number;
  },
  adminId: string
): Promise<{ success: boolean; proxyId?: string; message?: string }> {
  try {
    console.log('[Proxy Pool] Inserting proxy:', proxyData.host, ':', proxyData.port);
    
    // Build insert data with all available columns
    const insertData: Record<string, any> = {
      host: proxyData.host,
      port: proxyData.port,
      username_encrypted: proxyData.username ? encryptToken(proxyData.username) : null,
      password_encrypted: proxyData.password ? encryptToken(proxyData.password) : null,
      status: 'available',
      provider: proxyData.provider || 'mobile_sticky',
      proxy_type: 'mobile',
      label: proxyData.label || `${proxyData.provider || 'Proxy'} :${proxyData.port}`,
      country_code: proxyData.countryCode || 'US',
      health_score: 100,
      auto_rotate: true,
      rotation_interval_hours: proxyData.rotationIntervalHours || 24,
      total_requests: 0,
      failed_requests: 0,
      avg_latency_ms: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
      .from('system_proxies')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Proxy Pool] Insert error:', error.message, error.code, error.details, error.hint);
      return { success: false, message: `Database error: ${error.message}` };
    }

    if (!data || !data.id) {
      console.error('[Proxy Pool] Insert returned no data - possible RLS issue');
      return { success: false, message: 'Insert succeeded but no data returned - check RLS policies' };
    }

    console.log('[Proxy Pool] Insert success, proxy ID:', data.id);
    
    try {
      await logProxyAction(data.id, null, 'proxy_added', `Added by admin`, adminId);
    } catch (logError) {
      console.warn('[Proxy Pool] Failed to log action:', logError);
    }

    return { success: true, proxyId: data.id };
  } catch (error: any) {
    console.error('[Proxy Pool] Exception:', error.message, error.stack);
    return { success: false, message: error.message };
  }
}

export async function removeProxyFromPool(
  proxyId: string,
  adminId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { data: allocations } = await supabase
      .from('proxy_allocations')
      .select('id')
      .eq('proxy_id', proxyId)
      .eq('status', 'active');

    if (allocations && allocations.length > 0) {
      return { success: false, message: 'Cannot remove proxy with active allocations' };
    }

    const { error } = await supabase
      .from('system_proxies')
      .delete()
      .eq('id', proxyId);

    if (error) throw error;

    await logProxyAction(proxyId, null, 'proxy_removed', 'Removed from pool', adminId);

    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function updateProxyStatus(
  proxyId: string,
  status: 'available' | 'disabled',
  adminId: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const { error } = await supabase
      .from('system_proxies')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', proxyId);

    if (error) throw error;

    await logProxyAction(
      proxyId,
      null,
      status === 'disabled' ? 'proxy_disabled' : 'proxy_enabled',
      `Status changed to ${status}`,
      adminId
    );

    return { success: true };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// Bulk disable proxies, keeping only a specified number active
export async function bulkDisableProxies(
  keepActiveCount: number = 3,
  adminId: string
): Promise<{ success: boolean; disabled: number; keptActive: number; message?: string }> {
  try {
    // Get all non-disabled proxies, ordered by health score
    const { data: proxies, error: fetchError } = await supabase
      .from('system_proxies')
      .select('id, host, port, health_score, status')
      .neq('status', 'disabled')
      .order('health_score', { ascending: false });

    if (fetchError) throw fetchError;
    if (!proxies || proxies.length === 0) {
      return { success: true, disabled: 0, keptActive: 0, message: 'No proxies to disable' };
    }

    // Keep the top N healthiest proxies active
    const toKeepActive = proxies.slice(0, keepActiveCount);
    const toDisable = proxies.slice(keepActiveCount);

    console.log(`[Proxy Bulk Disable] Keeping ${toKeepActive.length} proxies active, disabling ${toDisable.length}`);

    // Disable the rest
    let disabledCount = 0;
    for (const proxy of toDisable) {
      const { error } = await supabase
        .from('system_proxies')
        .update({ status: 'disabled', updated_at: new Date().toISOString() })
        .eq('id', proxy.id);

      if (!error) {
        disabledCount++;
      }
    }

    await logProxyAction(
      null,
      null,
      'bulk_proxy_disable',
      `Disabled ${disabledCount} proxies, kept ${toKeepActive.length} active`,
      adminId
    );

    console.log(`[Proxy Bulk Disable] Complete: ${disabledCount} disabled, ${toKeepActive.length} active`);
    
    return { 
      success: true, 
      disabled: disabledCount, 
      keptActive: toKeepActive.length,
      message: `Disabled ${disabledCount} proxies, kept ${toKeepActive.length} active`
    };
  } catch (error: any) {
    console.error('[Proxy Bulk Disable] Error:', error);
    return { success: false, disabled: 0, keptActive: 0, message: error.message };
  }
}

async function logProxyAction(
  proxyId: string | null,
  userId: string | null,
  action: string,
  details: string,
  performedBy?: string
): Promise<void> {
  try {
    await supabase.from('proxy_audit_log').insert({
      proxy_id: proxyId,
      user_id: userId,
      action,
      details,
      performed_by: performedBy || userId || 'system',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log proxy action:', error);
  }
}

export async function runProxyHealthChecks(): Promise<void> {
  const { data: proxies } = await supabase
    .from('system_proxies')
    .select('*')
    .neq('status', 'disabled');

  if (!proxies) return;

  for (const proxy of proxies) {
    try {
      // Decrypt credentials before testing (they're stored encrypted in DB)
      let username = proxy.username;
      let password = proxy.password;
      
      if (proxy.username_encrypted) {
        try {
          username = decryptToken(proxy.username_encrypted);
        } catch (e) {
          console.error(`[Proxy Health] Failed to decrypt username for proxy ${proxy.id}`);
        }
      }
      if (proxy.password_encrypted) {
        try {
          password = decryptToken(proxy.password_encrypted);
        } catch (e) {
          console.error(`[Proxy Health] Failed to decrypt password for proxy ${proxy.id}`);
        }
      }
      
      const proxyWithCreds = {
        ...proxy,
        username,
        password
      };
      
      // Debug: Log first proxy's credential status (without revealing actual values)
      if (proxy.host === 'gate.decodo.com' && proxy.port === 10001) {
        console.log(`[Proxy Health Debug] Proxy ${proxy.host}:${proxy.port} - username: ${username ? 'SET (' + username.length + ' chars)' : 'EMPTY'}, password: ${password ? 'SET (' + password.length + ' chars)' : 'EMPTY'}`);
      }
      
      const startTime = Date.now();
      const testResult = await testProxyConnection(proxyWithCreds);
      const latency = Date.now() - startTime;

      const healthScore = testResult.success ? Math.min(100, 100 - (latency / 100)) : 0;

      await supabase
        .from('system_proxies')
        .update({
          health_score: Math.round(healthScore),
          avg_latency_ms: latency,
          last_health_check: new Date().toISOString(),
          status: testResult.success 
            ? (proxy.status === 'unhealthy' ? 'available' : proxy.status) 
            : 'unhealthy',
        })
        .eq('id', proxy.id);

      if (!testResult.success) {
        await logProxyAction(proxy.id, null, 'health_check_failed', testResult.error || 'Connection failed', 'system');
      }
    } catch (error) {
      console.error(`Health check failed for proxy ${proxy.id}:`, error);
    }
  }
}

async function testProxyConnection(proxy: any): Promise<{ success: boolean; error?: string; latency?: number }> {
  const startTime = Date.now();
  
  try {
    if (!proxy.host || !proxy.port) {
      return { success: false, error: 'Missing host or port' };
    }
    
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    const axios = (await import('axios')).default;
    
    // Build proxy URL with authentication - this is the correct format for HTTPS proxies
    let proxyUrl: string;
    if (proxy.username && proxy.password) {
      proxyUrl = `http://${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@${proxy.host}:${proxy.port}`;
    } else {
      proxyUrl = `http://${proxy.host}:${proxy.port}`;
    }
    
    // Create HTTPS proxy agent with SSL verification disabled (for expired certs)
    const httpsAgent = new HttpsProxyAgent(proxyUrl, {
      rejectUnauthorized: false
    });
    
    const response = await axios.get('https://httpbin.org/ip', {
      httpsAgent: httpsAgent,
      proxy: false, // Disable axios's built-in proxy, use our agent instead
      timeout: 10000,
    });
    
    if (response.status === 200) {
      const latency = Date.now() - startTime;
      console.log(`[Proxy Test] ${proxy.host}:${proxy.port} - Success (${latency}ms)`);
      return { success: true, latency };
    } else {
      console.log(`[Proxy Test] ${proxy.host}:${proxy.port} - Failed with status ${response.status}`);
      return { success: false, error: `HTTP ${response.status}` };
    }
  } catch (error: any) {
    const latency = Date.now() - startTime;
    const errMsg = error.code || error.message || 'Unknown error';
    console.log(`[Proxy Test] ${proxy.host}:${proxy.port} - Error: ${errMsg} (${latency}ms)`);
    return { success: false, error: errMsg };
  }
}

// DISABLED: Proxy health checks were causing stability issues (running too frequently)
// setInterval(() => {
//   runProxyHealthChecks().catch(console.error);
// }, 30 * 60 * 1000);

export async function runScheduledRotations(): Promise<void> {
  const { data: allocations } = await supabase
    .from('proxy_allocations')
    .select('*, system_proxies(auto_rotate)')
    .eq('status', 'active')
    .lt('next_rotation_at', new Date().toISOString());

  if (!allocations) return;

  for (const allocation of allocations) {
    if (allocation.system_proxies?.auto_rotate) {
      await rotateUserProxy(allocation.user_id, allocation.workspace_id, allocation.id);
    }
  }
}

// DISABLED: Proxy rotation was running every minute causing stability issues
// setInterval(() => {
//   runScheduledRotations().catch(console.error);
// }, 60 * 1000);
