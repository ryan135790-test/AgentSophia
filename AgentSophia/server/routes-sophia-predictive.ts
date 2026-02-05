import { Router } from 'express';
import { 
  predictConversion, 
  batchPredictLeads, 
  getLeadPriorityQueue,
  calculateEngagementScore,
  calculateFitScore,
  detectIntentSignals,
  LeadEngagementData,
  LeadFitData
} from './lib/sophia-predictive-engine';
import {
  evaluateEngagementTrigger,
  approveRuleExecution,
  rejectRuleExecution,
  getAutonomySettings,
  updateAutonomySettings,
  getEngagementRules,
  updateEngagementRule,
  addEngagementRule,
  deleteEngagementRule,
  getPendingRuleExecutions,
  getRecentRuleExecutions,
  getAutoActionStats,
  pauseAutoActions,
  resumeAutoActions,
  emergencyStop,
  EngagementTrigger
} from './lib/sophia-auto-actions';

const router = Router();

router.post('/predict-lead', async (req, res) => {
  try {
    const { engagement, fit, leadId } = req.body;
    
    const prediction = predictConversion(
      engagement as Partial<LeadEngagementData>,
      fit as Partial<LeadFitData>
    );
    
    prediction.leadId = leadId || 'unknown';
    
    res.json({
      success: true,
      prediction
    });
  } catch (error: any) {
    console.error('[Predictive] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/predict-batch', async (req, res) => {
  try {
    const { leads } = req.body;
    
    if (!Array.isArray(leads)) {
      return res.status(400).json({ error: 'leads must be an array' });
    }
    
    const predictions = batchPredictLeads(leads);
    const priorityQueue = getLeadPriorityQueue(predictions);
    
    res.json({
      success: true,
      predictions,
      priorityQueue,
      summary: {
        total: predictions.length,
        readyToBuy: predictions.filter(p => p.buyingStage === 'ready_to_buy').length,
        highRisk: predictions.filter(p => p.riskLevel === 'high').length,
        avgConversionProbability: Math.round(
          predictions.reduce((sum, p) => sum + p.conversionProbability, 0) / predictions.length
        )
      }
    });
  } catch (error: any) {
    console.error('[Predictive] Batch error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/calculate-scores', async (req, res) => {
  try {
    const { engagement, fit } = req.body;
    
    const engagementScore = calculateEngagementScore(engagement || {});
    const fitScore = calculateFitScore(fit || {});
    const { score: intentScore, signals } = detectIntentSignals(engagement || {});
    
    const overallScore = Math.round(
      engagementScore * 0.4 + fitScore * 0.25 + intentScore * 0.35
    );
    
    res.json({
      success: true,
      scores: {
        engagement: engagementScore,
        fit: fitScore,
        intent: intentScore,
        overall: overallScore
      },
      intentSignals: signals,
      hotness: overallScore >= 80 ? 'Hot' : overallScore >= 50 ? 'Warm' : 'Cold'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/autonomy-settings', async (req, res) => {
  try {
    const settings = getAutonomySettings();
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/autonomy-settings', async (req, res) => {
  try {
    const updates = req.body;
    const settings = updateAutonomySettings(updates);
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/auto-rules', async (req, res) => {
  try {
    const rules = getEngagementRules();
    res.json({ success: true, rules });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/auto-rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const updates = req.body;
    const rule = updateEngagementRule(ruleId, updates);
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/auto-rules', async (req, res) => {
  try {
    const ruleData = req.body;
    const rule = addEngagementRule(ruleData);
    res.json({ success: true, rule });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/auto-rules/:ruleId', async (req, res) => {
  try {
    const { ruleId } = req.params;
    const deleted = deleteEngagementRule(ruleId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/trigger-evaluation', async (req, res) => {
  try {
    const { trigger, leadId, leadName, leadData } = req.body;
    
    const executions = evaluateEngagementTrigger(
      trigger as EngagementTrigger['type'],
      leadId,
      leadName,
      leadData
    );
    
    res.json({
      success: true,
      executions,
      triggeredCount: executions.length,
      pendingApproval: executions.filter(e => e.status === 'pending').length,
      autoExecuted: executions.filter(e => e.status === 'executed').length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pending-actions', async (req, res) => {
  try {
    const pending = getPendingRuleExecutions();
    res.json({ success: true, pending, count: pending.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/approve-action/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    const execution = approveRuleExecution(executionId);
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    res.json({ success: true, execution });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reject-action/:executionId', async (req, res) => {
  try {
    const { executionId } = req.params;
    const { reason } = req.body;
    const execution = rejectRuleExecution(executionId, reason);
    
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    
    res.json({ success: true, execution });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/recent-executions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const executions = getRecentRuleExecutions(limit);
    res.json({ success: true, executions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/auto-action-stats', async (req, res) => {
  try {
    const stats = getAutoActionStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pause', async (req, res) => {
  try {
    const { hours } = req.body;
    pauseAutoActions(hours || 1);
    res.json({ success: true, message: `Auto-actions paused for ${hours || 1} hour(s)` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/resume', async (req, res) => {
  try {
    resumeAutoActions();
    res.json({ success: true, message: 'Auto-actions resumed' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/emergency-stop', async (req, res) => {
  try {
    emergencyStop();
    res.json({ success: true, message: 'Emergency stop activated - all auto-actions disabled' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/dashboard', async (req, res) => {
  try {
    const settings = getAutonomySettings();
    const stats = getAutoActionStats();
    const pending = getPendingRuleExecutions();
    const rules = getEngagementRules();
    
    res.json({
      success: true,
      dashboard: {
        autonomy: {
          enabled: settings.enabled,
          level: settings.autonomyLevel,
          isPaused: settings.pauseUntil ? new Date() < settings.pauseUntil : false,
          pauseUntil: settings.pauseUntil
        },
        stats: {
          pendingApprovals: stats.pendingCount,
          executedToday: stats.executedToday,
          executedThisHour: stats.executedThisHour,
          approvalRate: stats.approvalRate,
          topRules: stats.topRules
        },
        pendingActions: pending.slice(0, 5),
        activeRules: rules.filter(r => r.enabled).length,
        totalRules: rules.length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
