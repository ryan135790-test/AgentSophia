/**
 * Sophia Brain Admin Panel Routes
 * Admin endpoints to view Sophia's inner workings and get improvement suggestions
 */

import express from 'express';
import {
  getSophiaBrainState,
  getSophiaAdminRecommendations,
  getSophiaLearningInsights,
  getModelPerformanceMetrics,
} from './lib/sophia-brain-admin';

const router = express.Router();

/**
 * GET /api/sophia/brain/:workspaceId
 * Get Sophia's complete brain state for admin view
 */
router.get('/brain/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }

    const brainState = await getSophiaBrainState(workspaceId);

    res.json({
      success: true,
      brain_state: brainState,
      message: '🧠 Sophia\'s brain exposed for admin view',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sophia/brain-recommendations/:workspaceId
 * Sophia helps admin improve her capabilities with specific recommendations
 */
router.get('/brain-recommendations/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }

    const recommendations = await getSophiaAdminRecommendations(workspaceId);

    res.json({
      success: true,
      ...recommendations,
      message: '💡 Sophia\'s suggestions to improve your setup and her capabilities',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sophia/brain-insights/:workspaceId
 * What Sophia has learned across all campaigns
 */
router.get('/brain-insights/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }

    const insights = await getSophiaLearningInsights(workspaceId);

    res.json({
      success: true,
      ...insights,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sophia/brain-model-performance/:workspaceId
 * Model performance metrics for Sophia's dual-LLM system
 */
router.get('/brain-model-performance/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }

    const metrics = await getModelPerformanceMetrics(workspaceId);

    res.json({
      success: true,
      model_performance: metrics,
      message: '📊 Sophia\'s AI model performance metrics',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/sophia/brain-summary/:workspaceId
 * Complete summary of Sophia's brain, recommendations, and insights
 */
router.get('/brain-summary/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ error: 'Missing workspaceId' });
    }

    const [brain, recommendations, insights, performance] = await Promise.all([
      getSophiaBrainState(workspaceId),
      getSophiaAdminRecommendations(workspaceId),
      getSophiaLearningInsights(workspaceId),
      getModelPerformanceMetrics(workspaceId),
    ]);

    res.json({
      success: true,
      sophia_brain: {
        state: brain,
        recommendations: recommendations.recommendations,
        insights: insights.learning_insights,
        model_performance: performance,
      },
      message: '🧠 Complete Sophia brain summary for admin',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
