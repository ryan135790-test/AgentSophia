import { Express, Request, Response } from 'express';
import {
  processLeadImportForCampaignMatching,
  getPendingCampaignMatches,
  approveCampaignMatch,
  rejectCampaignMatch,
  getWorkspaceAutonomySettings,
  initCampaignMatcherTables,
} from './lib/sophia-campaign-matcher';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

export function registerSophiaCampaignMatcherRoutes(app: Express) {
  setTimeout(() => {
    initCampaignMatcherTables().catch(err => {
      console.log('[Sophia Matcher] Table init deferred - will create on first use');
    });
  }, 5000);

  app.get('/api/sophia/campaign-matches/:workspaceId', async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      const matches = await getPendingCampaignMatches(workspaceId);
      res.json({ success: true, matches });
    } catch (error: any) {
      console.error('[Sophia Matcher API] Error fetching matches:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sophia/campaign-matches/:matchId/approve', async (req: Request, res: Response) => {
    try {
      const { matchId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const success = await approveCampaignMatch(matchId, userId);
      res.json({ success });
    } catch (error: any) {
      console.error('[Sophia Matcher API] Error approving match:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sophia/campaign-matches/:matchId/reject', async (req: Request, res: Response) => {
    try {
      const { matchId } = req.params;
      const { userId, reason } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, error: 'userId is required' });
      }

      const success = await rejectCampaignMatch(matchId, userId, reason);
      res.json({ success });
    } catch (error: any) {
      console.error('[Sophia Matcher API] Error rejecting match:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/sophia/autonomy-settings/:workspaceId', async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      const settings = await getWorkspaceAutonomySettings(workspaceId);
      res.json({ success: true, settings });
    } catch (error: any) {
      console.error('[Sophia Matcher API] Error fetching settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.put('/api/sophia/autonomy-settings/:workspaceId', async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.params;
      const settings = req.body;

      await pool.query(
        `INSERT INTO sophia_autonomy_settings 
         (id, workspace_id, campaign_assignment_mode, min_confidence_for_auto, 
          notify_on_auto_assign, max_auto_assigns_per_day, learning_enabled, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())
         ON CONFLICT (workspace_id) 
         DO UPDATE SET 
           campaign_assignment_mode = $2,
           min_confidence_for_auto = $3,
           notify_on_auto_assign = $4,
           max_auto_assigns_per_day = $5,
           learning_enabled = $6,
           updated_at = NOW()`,
        [
          workspaceId,
          settings.campaign_assignment_mode || 'manual_approval',
          settings.min_confidence_for_auto || 75,
          settings.notify_on_auto_assign !== false,
          settings.max_auto_assigns_per_day || 50,
          settings.learning_enabled !== false,
        ]
      );

      res.json({ success: true });
    } catch (error: any) {
      console.error('[Sophia Matcher API] Error updating settings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sophia/process-lead-import', async (req: Request, res: Response) => {
    try {
      const { workspaceId, leads, preSelectedCampaignId } = req.body;

      if (!workspaceId || !leads || !Array.isArray(leads)) {
        return res.status(400).json({ 
          success: false, 
          error: 'workspaceId and leads array are required' 
        });
      }

      const result = await processLeadImportForCampaignMatching(
        workspaceId,
        leads,
        preSelectedCampaignId
      );

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('[Sophia Matcher API] Error processing lead import:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sophia/campaign-matches/bulk-approve', async (req: Request, res: Response) => {
    try {
      const { matchIds, userId } = req.body;

      if (!matchIds || !Array.isArray(matchIds) || !userId) {
        return res.status(400).json({ 
          success: false, 
          error: 'matchIds array and userId are required' 
        });
      }

      let approved = 0;
      for (const matchId of matchIds) {
        const success = await approveCampaignMatch(matchId, userId);
        if (success) approved++;
      }

      res.json({ success: true, approved, total: matchIds.length });
    } catch (error: any) {
      console.error('[Sophia Matcher API] Error bulk approving:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/sophia/campaign-matches/bulk-reject', async (req: Request, res: Response) => {
    try {
      const { matchIds, userId, reason } = req.body;

      if (!matchIds || !Array.isArray(matchIds) || !userId) {
        return res.status(400).json({ 
          success: false, 
          error: 'matchIds array and userId are required' 
        });
      }

      let rejected = 0;
      for (const matchId of matchIds) {
        const success = await rejectCampaignMatch(matchId, userId, reason);
        if (success) rejected++;
      }

      res.json({ success: true, rejected, total: matchIds.length });
    } catch (error: any) {
      console.error('[Sophia Matcher API] Error bulk rejecting:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('✅ Sophia Campaign Matcher routes registered');
}
