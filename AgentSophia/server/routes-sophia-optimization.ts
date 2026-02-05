/**
 * Sophia Self-Optimization Routes
 * Endpoints for campaign self-optimization
 */

import express from 'express';
import {
  optimizeCampaign,
  optimizeAllCampaigns,
  getOptimizationHistory,
  getLearningInsights,
} from './lib/sophia-self-optimization';
import { Pool } from 'pg';

const router = express.Router();

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

/**
 * POST /api/sophia/optimize-campaign
 * Analyze and optimize a single campaign
 */
router.post('/optimize-campaign', async (req, res) => {
  try {
    const { campaignId, workspaceId, autoApply } = req.body;

    if (!campaignId || !workspaceId) {
      return res.status(400).json({ error: 'Missing campaignId or workspaceId' });
    }

    const result = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1 AND workspace_id = $2',
      [campaignId, workspaceId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const optimization = await optimizeCampaign(result.rows[0], workspaceId, autoApply !== false);

    res.json({
      success: true,
      optimization,
      message: `✨ Sophia analyzed your campaign and applied ${optimization.applied_changes.length} improvements`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/sophia/optimize-all
 * Analyze and optimize all active campaigns
 */
router.post('/optimize-all', async (req, res) => {
  try {
    const { workspaceId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }

    const optimizations = await optimizeAllCampaigns(workspaceId);

    const totalApplied = optimizations.reduce(
      (sum, opt) => sum + opt.applied_changes.length,
      0
    );

    res.json({
      success: true,
      campaignsOptimized: optimizations.length,
      totalChangesApplied: totalApplied,
      optimizations,
      message: `✨ Sophia optimized ${optimizations.length} campaigns with ${totalApplied} improvements`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sophia/optimization-history/:campaignId
 * Get optimization history for a campaign
 */
router.get('/optimization-history/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({ error: 'Missing campaignId' });
    }

    const history = await getOptimizationHistory(campaignId);

    res.json({
      success: true,
      campaignId,
      optimizationCount: history.length,
      history,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sophia/learning-insights/:workspaceId
 * Get what Sophia has learned across campaigns
 */
router.get('/learning-insights/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }

    const insights = await getLearningInsights(workspaceId);

    res.json({
      success: true,
      workspaceId,
      insights,
      message: '📊 Sophia has learned patterns from your campaigns',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
