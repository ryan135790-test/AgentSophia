import { Router } from 'express';
import * as lookupCredits from './lib/lookup-credits';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

router.get('/balance/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const balance = await lookupCredits.getWorkspaceBalanceAsync(workspaceId);
    const available = await lookupCredits.getAvailableCreditsAsync(workspaceId);
    
    res.json({
      ...balance,
      available_credits: available,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/usage/:workspaceId', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const stats = lookupCredits.getLookupUsageStats(workspaceId);
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/transactions/:workspaceId', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const history = lookupCredits.getTransactionHistory(workspaceId, limit);
    
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/lookup/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { lookup_type, provider, input_data, contact_id, campaign_id, user_id } = req.body;
    
    if (!lookupCredits.hasEnoughCredits(workspaceId)) {
      return res.status(402).json({ 
        error: 'Insufficient credits',
        available: lookupCredits.getAvailableCredits(workspaceId)
      });
    }
    
    if (!lookupCredits.reserveCredits(workspaceId)) {
      return res.status(402).json({ error: 'Could not reserve credits' });
    }
    
    const startTime = Date.now();
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = lookupCredits.useCredits(workspaceId, 1, {
        lookupType: lookup_type,
        contactId: contact_id,
        description: `${lookup_type} lookup via ${provider}`,
      });
      
      const usage = lookupCredits.recordLookupUsage(workspaceId, {
        lookup_type,
        provider,
        input_data,
        result_data: { success: true, demo: true },
        status: 'success',
        credits_used: 1,
        contact_id,
        campaign_id,
        user_id,
      });
      
      res.json({
        success: true,
        usage_id: usage.id,
        credits_remaining: result.newBalance,
        result: { demo: true, found: true },
      });
      
    } catch (lookupError: any) {
      lookupCredits.releaseReservedCredits(workspaceId);
      
      lookupCredits.recordLookupUsage(workspaceId, {
        lookup_type,
        provider,
        input_data,
        status: 'failed',
        credits_used: 0,
        contact_id,
        campaign_id,
        user_id,
      });
      
      throw lookupError;
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/packages', (req, res) => {
  try {
    const packages = lookupCredits.getAllCreditPackages();
    res.json(packages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/packages', (req, res) => {
  try {
    const { name, credits, price_cents, description } = req.body;
    const pkg = lookupCredits.createCreditPackage({
      name,
      credits,
      price_cents,
      description,
    });
    res.json(pkg);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/admin/packages/:packageId', (req, res) => {
  try {
    const { packageId } = req.params;
    const updates = req.body;
    const pkg = lookupCredits.updateCreditPackage(packageId, updates);
    
    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }
    
    res.json(pkg);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/workspaces', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      const balances = await lookupCredits.getAllWorkspaceBalancesFromDb();
      return res.json(balances);
    }

    const { data: workspaces, error } = await supabaseAdmin
      .from('workspaces')
      .select('id, name')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Credits Admin] Supabase error:', error);
      const balances = await lookupCredits.getAllWorkspaceBalancesFromDb();
      return res.json(balances);
    }

    const balances = await Promise.all(
      (workspaces || []).map(async (ws: { id: string; name: string }) => {
        const balance = await lookupCredits.getWorkspaceBalanceAsync(ws.id);
        return {
          ...balance,
          workspace_name: ws.name,
        };
      })
    );

    res.json(balances);
  } catch (error: any) {
    console.error('[Credits Admin] Error fetching workspaces:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/initialize-workspace/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const balance = await lookupCredits.getWorkspaceBalanceAsync(workspaceId);
    res.json(balance);
  } catch (error: any) {
    console.error('[Credits Admin] Error initializing workspace:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/workspaces/:workspaceId/add-credits', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { amount, performed_by, package_id, description } = req.body;
    
    const result = lookupCredits.addCreditsToWorkspace(
      workspaceId,
      amount,
      performed_by
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/workspaces/:workspaceId/adjust', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { amount, performed_by, reason } = req.body;
    
    const result = lookupCredits.adjustCredits(
      workspaceId,
      amount,
      reason,
      performed_by
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/workspaces/:workspaceId/allocation', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { monthly_allocation, performed_by } = req.body;
    
    const balance = lookupCredits.setMonthlyAllocation(
      workspaceId,
      monthly_allocation
    );
    
    res.json(balance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/workspaces/:workspaceId/reset', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const balance = lookupCredits.resetMonthlyAllocation(workspaceId);
    
    if (!balance) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    res.json(balance);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/admin/purchases/pending', (req, res) => {
  try {
    const purchases = lookupCredits.getPendingPurchases();
    res.json(purchases);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/purchases/:purchaseId/approve', (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { approved_by } = req.body;
    
    const result = lookupCredits.approvePurchase(purchaseId, approved_by);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Failed to approve' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/admin/purchases/:purchaseId/reject', (req, res) => {
  try {
    const { purchaseId } = req.params;
    const { approved_by, reason } = req.body;
    
    const result = lookupCredits.rejectPurchase(purchaseId, approved_by, reason);
    
    if (!result.success) {
      return res.status(404).json({ error: 'Purchase not found or already processed' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
