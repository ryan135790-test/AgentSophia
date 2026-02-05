/**
 * Sophia Action Execution Routes
 * API endpoints for executing autonomous actions
 */

import express from 'express';
import { executeAction, executeIntentActions } from './lib/action-executor';
import type { IntentType } from './lib/intent-detection-engine';

const router = express.Router();

router.post('/execute', async (req, res) => {
  try {
    const { actionType, leadId, messageId, intent, config } = req.body;
    if (!actionType || !leadId) {
      return res.status(400).json({ error: 'Missing required fields: actionType, leadId' });
    }
    const result = await executeAction(actionType, leadId, messageId || '', intent || 'interested', config);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message, success: false });
  }
});

router.post('/execute-intent', async (req, res) => {
  try {
    const { leadId, messageId, intent, actions } = req.body;
    if (!leadId || !intent) {
      return res.status(400).json({ error: 'Missing required fields: leadId, intent' });
    }
    const results = await executeIntentActions(
      leadId,
      messageId || '',
      intent as IntentType,
      actions || ['send_reply', 'tag_lead', 'route_to_sales']
    );
    res.json({
      success: true,
      totalExecuted: results.length,
      results: results,
      summary: {
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, success: false });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { actions } = req.body;
    if (!Array.isArray(actions)) {
      return res.status(400).json({ error: 'Invalid request: actions must be an array' });
    }
    const results = [];
    for (const action of actions) {
      const result = await executeAction(
        action.actionType,
        action.leadId,
        action.messageId || '',
        action.intent || 'interested',
        action.config
      );
      results.push(result);
    }
    res.json({
      success: true,
      totalExecuted: results.length,
      results: results,
      summary: {
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message, success: false });
  }
});

export default router;
