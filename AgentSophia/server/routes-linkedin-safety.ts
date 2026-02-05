import { Router } from 'express';
import {
  createUnifiedSession,
  closeUnifiedSession,
  getSession,
  getActiveVisibleSession,
  getAllSessions,
  getSessionStatus,
  addSessionEvent,
  updateSessionStatus,
  navigateInSession,
  scrollInSession,
  humanTypeInSession,
  humanClickInSession,
  promoteToVisible,
  releaseObserverLock
} from './lib/linkedin-unified-session';
import {
  initializeSafetySettings,
  getSafetySettings,
  updateSafetySettings,
  updateCustomDailyLimits,
  updateCustomWeeklyLimits,
  getCurrentLimits,
  getTodayUsage,
  getWeeklyUsage,
  canPerformAction,
  recordAction,
  recordConnectionAccepted,
  updatePendingInvitations,
  getWarmUpProgress,
  setWarmUpMode,
  getRecentActions,
  getSafetyRecommendations,
  getAllConfiguredAccounts,
  getSafetyDashboard,
  getDefaultLimits,
  calculateNextDelay,
  shouldTakeBatchBreak,
  recordActionForBatch,
  resetBatchCounter,
  updateActionDelays,
  createMessageVariations,
  getNextMessageVariation,
  recordVariationUsage,
  getVariationStats,
  updateMessageVariationSettings,
  getMessageVariations,
  deleteMessageVariation,
  generateSimpleVariations,
  LinkedInAccountType,
  SafetySettings,
  DailyLimits,
  WeeklyLimits
} from './lib/linkedin-safety-controls';

const router = Router();

/**
 * Initialize safety settings for a new account
 */
router.post('/accounts/initialize', async (req, res) => {
  try {
    const { accountId, accountType, connectionCount, accountAgeDays, ssiScore, enableWarmUp } = req.body;
    
    if (!accountId || !accountType) {
      return res.status(400).json({ error: 'accountId and accountType are required' });
    }
    
    const account: LinkedInAccountType = {
      type: accountType,
      connectionCount: connectionCount || 0,
      accountAgeDays: accountAgeDays || 0,
      ssiScore
    };
    
    const settings = initializeSafetySettings(accountId, account, enableWarmUp);
    
    res.json({
      success: true,
      settings,
      message: settings.warmUpMode.enabled 
        ? 'Account initialized with warm-up mode enabled (recommended for new accounts)'
        : 'Account initialized with standard limits'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get safety settings for an account
 */
router.get('/accounts/:accountId/settings', async (req, res) => {
  try {
    const { accountId } = req.params;
    const settings = getSafetySettings(accountId);
    
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update safety settings
 */
router.patch('/accounts/:accountId/settings', async (req, res) => {
  try {
    const { accountId } = req.params;
    const updates = req.body;
    
    const settings = updateSafetySettings(accountId, updates);
    
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get current effective limits (considering warm-up mode)
 */
router.get('/accounts/:accountId/limits', async (req, res) => {
  try {
    const { accountId } = req.params;
    const limits = getCurrentLimits(accountId);
    const warmUpProgress = getWarmUpProgress(accountId);
    
    res.json({
      success: true,
      limits,
      warmUp: warmUpProgress
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get today's usage stats
 */
router.get('/accounts/:accountId/usage/today', async (req, res) => {
  try {
    const { accountId } = req.params;
    const usage = getTodayUsage(accountId);
    const limits = getCurrentLimits(accountId);
    
    res.json({
      success: true,
      usage,
      limits,
      remaining: {
        connectionRequests: Math.max(0, limits.connectionRequests - usage.connectionRequestsSent),
        messages: Math.max(0, limits.messages - usage.messagesSent),
        profileViews: Math.max(0, limits.profileViews - usage.profileViews),
        postLikes: Math.max(0, limits.postLikes - usage.postLikes),
        totalActions: Math.max(0, limits.totalActions - usage.totalActions)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get weekly usage stats
 */
router.get('/accounts/:accountId/usage/weekly', async (req, res) => {
  try {
    const { accountId } = req.params;
    const usage = getWeeklyUsage(accountId);
    const settings = getSafetySettings(accountId);
    
    res.json({
      success: true,
      usage,
      weeklyLimits: settings?.weeklyLimits || { connectionRequests: 100, messages: 100 },
      remaining: settings ? {
        connectionRequests: Math.max(0, settings.weeklyLimits.connectionRequests - usage.connectionRequestsSent),
        messages: Math.max(0, settings.weeklyLimits.messages - usage.messagesSent)
      } : null
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Check if an action can be performed
 */
router.post('/accounts/:accountId/check-action', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { actionType } = req.body;
    
    if (!actionType) {
      return res.status(400).json({ error: 'actionType is required' });
    }
    
    const result = canPerformAction(accountId, actionType);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record an action
 */
router.post('/accounts/:accountId/record-action', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { actionType, success = true, error } = req.body;
    
    if (!actionType) {
      return res.status(400).json({ error: 'actionType is required' });
    }
    
    recordAction(accountId, actionType, success, error);
    const usage = getTodayUsage(accountId);
    
    res.json({
      success: true,
      message: 'Action recorded',
      currentUsage: usage
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record a connection acceptance
 */
router.post('/accounts/:accountId/record-acceptance', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    recordConnectionAccepted(accountId);
    const usage = getTodayUsage(accountId);
    
    res.json({
      success: true,
      acceptanceRate: usage.acceptanceRate,
      connectionsAccepted: usage.connectionsAccepted
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update pending invitation count
 */
router.post('/accounts/:accountId/pending-invitations', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { count } = req.body;
    
    if (typeof count !== 'number') {
      return res.status(400).json({ error: 'count must be a number' });
    }
    
    updatePendingInvitations(accountId, count);
    
    res.json({
      success: true,
      pendingInvitations: count
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get warm-up progress
 */
router.get('/accounts/:accountId/warm-up', async (req, res) => {
  try {
    const { accountId } = req.params;
    const progress = getWarmUpProgress(accountId);
    
    if (!progress) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    res.json({
      success: true,
      ...progress
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Enable/disable warm-up mode
 */
router.post('/accounts/:accountId/warm-up', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' });
    }
    
    const settings = setWarmUpMode(accountId, enabled);
    
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    res.json({
      success: true,
      warmUpMode: settings.warmUpMode,
      message: enabled ? 'Warm-up mode enabled' : 'Warm-up mode disabled'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent actions log
 */
router.get('/accounts/:accountId/actions', async (req, res) => {
  try {
    const { accountId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    const actions = getRecentActions(accountId, limit);
    
    res.json({
      success: true,
      actions
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get safety recommendations
 */
router.get('/accounts/:accountId/recommendations', async (req, res) => {
  try {
    const { accountId } = req.params;
    const recommendations = getSafetyRecommendations(accountId);
    
    res.json({
      success: true,
      recommendations
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all configured accounts
 */
router.get('/accounts', async (req, res) => {
  try {
    const accounts = getAllConfiguredAccounts();
    
    res.json({
      success: true,
      accounts,
      count: accounts.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get safety dashboard (overview of all accounts)
 */
router.get('/dashboard', async (req, res) => {
  try {
    const dashboard = getSafetyDashboard();
    
    res.json({
      success: true,
      ...dashboard
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get default limits for an account type
 */
router.get('/defaults/:accountType', async (req, res) => {
  try {
    const { accountType } = req.params;
    
    if (!['free', 'premium', 'sales_navigator'].includes(accountType)) {
      return res.status(400).json({ error: 'Invalid account type. Use: free, premium, or sales_navigator' });
    }
    
    const defaults = getDefaultLimits(accountType as 'free' | 'premium' | 'sales_navigator');
    
    res.json({
      success: true,
      accountType,
      ...defaults
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk update daily limits
 */
router.patch('/accounts/:accountId/daily-limits', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { connectionRequests, messages, profileViews, postLikes, endorsements, totalActions } = req.body;
    
    const settings = getSafetySettings(accountId);
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    const { searchPulls } = req.body;
    
    const updatedLimits = {
      ...settings.dailyLimits,
      ...(connectionRequests !== undefined && { connectionRequests }),
      ...(messages !== undefined && { messages }),
      ...(profileViews !== undefined && { profileViews }),
      ...(searchPulls !== undefined && { searchPulls }),
      ...(postLikes !== undefined && { postLikes }),
      ...(endorsements !== undefined && { endorsements }),
      ...(totalActions !== undefined && { totalActions })
    };
    
    const updated = updateCustomDailyLimits(accountId, updatedLimits);
    
    res.json({
      success: true,
      dailyLimits: updated?.dailyLimits
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Bulk update weekly limits
 */
router.patch('/accounts/:accountId/weekly-limits', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { connectionRequests, messages } = req.body;
    
    const settings = getSafetySettings(accountId);
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    const updatedLimits = {
      ...settings.weeklyLimits,
      ...(connectionRequests !== undefined && { connectionRequests }),
      ...(messages !== undefined && { messages })
    };
    
    const updated = updateCustomWeeklyLimits(accountId, updatedLimits);
    
    res.json({
      success: true,
      weeklyLimits: updated?.weeklyLimits
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update safety features
 */
router.patch('/accounts/:accountId/safety-features', async (req, res) => {
  try {
    const { accountId } = req.params;
    const features = req.body;
    
    const settings = getSafetySettings(accountId);
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    const updatedFeatures = {
      ...settings.safetyFeatures,
      ...features
    };
    
    const updated = updateSafetySettings(accountId, { safetyFeatures: updatedFeatures });
    
    res.json({
      success: true,
      safetyFeatures: updated?.safetyFeatures
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TIME DELAY ROUTES
// ============================================

/**
 * Get action delay settings
 */
router.get('/accounts/:accountId/delays', async (req, res) => {
  try {
    const { accountId } = req.params;
    const settings = getSafetySettings(accountId);
    
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    res.json({
      success: true,
      actionDelays: settings.actionDelays
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update action delay settings
 */
router.patch('/accounts/:accountId/delays', async (req, res) => {
  try {
    const { accountId } = req.params;
    const updates = req.body;
    
    const settings = updateActionDelays(accountId, updates);
    
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    res.json({
      success: true,
      actionDelays: settings.actionDelays
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Calculate next delay for an action
 */
router.get('/accounts/:accountId/next-delay', async (req, res) => {
  try {
    const { accountId } = req.params;
    const delay = calculateNextDelay(accountId);
    const batchBreak = shouldTakeBatchBreak(accountId);
    
    res.json({
      success: true,
      delay,
      batchBreak
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record action for batch tracking
 */
router.post('/accounts/:accountId/record-batch-action', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    recordActionForBatch(accountId);
    const batchBreak = shouldTakeBatchBreak(accountId);
    
    res.json({
      success: true,
      batchBreak
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reset batch counter
 */
router.post('/accounts/:accountId/reset-batch', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    resetBatchCounter(accountId);
    
    res.json({
      success: true,
      message: 'Batch counter reset'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MESSAGE VARIATION ROUTES
// ============================================

/**
 * Get message variation settings
 */
router.get('/accounts/:accountId/variations/settings', async (req, res) => {
  try {
    const { accountId } = req.params;
    const settings = getSafetySettings(accountId);
    
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    res.json({
      success: true,
      messageVariations: settings.messageVariations
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update message variation settings
 */
router.patch('/accounts/:accountId/variations/settings', async (req, res) => {
  try {
    const { accountId } = req.params;
    const updates = req.body;
    
    const settings = updateMessageVariationSettings(accountId, updates);
    
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    res.json({
      success: true,
      messageVariations: settings.messageVariations
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all message variations for an account
 */
router.get('/accounts/:accountId/variations', async (req, res) => {
  try {
    const { accountId } = req.params;
    const variations = getMessageVariations(accountId);
    
    res.json({
      success: true,
      variations,
      count: variations.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Create new message variations
 */
router.post('/accounts/:accountId/variations', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { originalMessage, variations } = req.body;
    
    if (!originalMessage || !variations || !Array.isArray(variations)) {
      return res.status(400).json({ error: 'originalMessage and variations array required' });
    }
    
    const variation = createMessageVariations(accountId, originalMessage, variations);
    
    res.json({
      success: true,
      variation
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Generate simple variations from a message (no AI)
 */
router.post('/accounts/:accountId/variations/generate', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { originalMessage, count = 3 } = req.body;
    
    if (!originalMessage) {
      return res.status(400).json({ error: 'originalMessage required' });
    }
    
    const variations = generateSimpleVariations(originalMessage, count);
    
    // Optionally save them
    if (req.body.save) {
      const saved = createMessageVariations(accountId, originalMessage, variations);
      return res.json({
        success: true,
        variations,
        saved
      });
    }
    
    res.json({
      success: true,
      variations
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get next variation to use
 */
router.get('/accounts/:accountId/variations/:variationId/next', async (req, res) => {
  try {
    const { accountId, variationId } = req.params;
    const next = getNextMessageVariation(accountId, variationId);
    
    if (!next) {
      return res.status(404).json({ error: 'Variation not found' });
    }
    
    res.json({
      success: true,
      ...next
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record variation usage/outcome
 */
router.post('/accounts/:accountId/variations/:variationId/record', async (req, res) => {
  try {
    const { accountId, variationId } = req.params;
    const { variationIndex, outcome } = req.body;
    
    if (typeof variationIndex !== 'number' || !['sent', 'opened', 'replied'].includes(outcome)) {
      return res.status(400).json({ error: 'variationIndex (number) and outcome (sent|opened|replied) required' });
    }
    
    recordVariationUsage(accountId, variationId, variationIndex, outcome);
    
    res.json({
      success: true,
      message: 'Usage recorded'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get variation performance stats
 */
router.get('/accounts/:accountId/variations/:variationId/stats', async (req, res) => {
  try {
    const { accountId, variationId } = req.params;
    const stats = getVariationStats(accountId, variationId);
    
    if (!stats) {
      return res.status(404).json({ error: 'Variation not found' });
    }
    
    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Delete a message variation
 */
router.delete('/accounts/:accountId/variations/:variationId', async (req, res) => {
  try {
    const { accountId, variationId } = req.params;
    const deleted = deleteMessageVariation(accountId, variationId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Variation not found' });
    }
    
    res.json({
      success: true,
      message: 'Variation deleted'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TEST HARNESS ROUTES
// Safe testing without hitting real LinkedIn
// ============================================

import {
  runFullTestSuite,
  testSafetyControls,
  testHumanLikeBehavior,
  testRateLimiting
} from './lib/linkedin-test-harness';

import {
  startLiveBrowserDemo,
  runLiveDemoSequence,
  stopLiveBrowser,
  getLiveBrowserStatus
} from './lib/linkedin-live-browser';

/**
 * Run full LinkedIn automation test suite
 */
router.get('/test/full-suite', async (_req, res) => {
  try {
    const results = await runFullTestSuite();
    res.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run safety controls test suite only
 */
router.get('/test/safety-controls', async (_req, res) => {
  try {
    const results = await testSafetyControls();
    res.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run human-like behavior test suite only
 */
router.get('/test/human-behavior', async (_req, res) => {
  try {
    const results = await testHumanLikeBehavior();
    res.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Run rate limiting test suite only
 */
router.get('/test/rate-limiting', async (_req, res) => {
  try {
    const results = await testRateLimiting();
    res.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// LIVE BROWSER DEMO ROUTES
// Watch automation in real-time via VNC
// ============================================

/**
 * Start live browser demo session
 */
router.post('/live-browser/start', async (_req, res) => {
  try {
    const result = await startLiveBrowserDemo();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Run demo sequence in live browser
 */
router.post('/live-browser/run-demo', async (_req, res) => {
  try {
    const result = await runLiveDemoSequence();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message, actions: [] });
  }
});

/**
 * Stop live browser session
 */
router.post('/live-browser/stop', async (_req, res) => {
  try {
    const result = await stopLiveBrowser();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message, summary: null });
  }
});

/**
 * Get live browser status
 */
router.get('/live-browser/status', async (_req, res) => {
  try {
    const status = getLiveBrowserStatus();
    res.json({
      success: true,
      session: status
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SOPHIA LINKEDIN COMPLIANCE ROUTES
// ============================================

import { sophiaLinkedInCompliance } from './lib/sophia-linkedin-compliance';

/**
 * Sophia pre-action safety check
 * Call before any LinkedIn automation action
 */
router.post('/sophia/pre-action-check', async (req, res) => {
  try {
    const { settings, actionType, workspaceId } = req.body;
    
    if (!settings || !actionType) {
      return res.status(400).json({ error: 'settings and actionType are required' });
    }
    
    const result = sophiaLinkedInCompliance.preActionCheck(settings, actionType, workspaceId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Sophia activity monitoring
 * Call after each LinkedIn action to monitor for issues
 */
router.post('/sophia/monitor-activity', async (req, res) => {
  try {
    const { accountId, actionType, success, wasAccepted, workspaceId } = req.body;
    
    if (!accountId || !actionType) {
      return res.status(400).json({ error: 'accountId and actionType are required' });
    }
    
    const result = sophiaLinkedInCompliance.monitorActivity(
      accountId, 
      actionType, 
      success !== false, 
      wasAccepted, 
      workspaceId
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get Sophia compliance report for an account
 */
router.get('/sophia/compliance-report/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { workspaceId } = req.query;
    
    const settings = getSafetySettings(accountId);
    if (!settings) {
      return res.status(404).json({ error: 'Account not configured' });
    }
    
    const report = sophiaLinkedInCompliance.generateReport(
      accountId, 
      settings, 
      workspaceId as string | undefined
    );
    res.json({ success: true, report });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get LinkedIn compliance guidelines
 */
router.get('/sophia/compliance-guidelines', async (_req, res) => {
  try {
    const guidelines = sophiaLinkedInCompliance.getGuidelines();
    res.json({ success: true, guidelines });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get recent compliance violations
 */
router.get('/sophia/violations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const violations = sophiaLinkedInCompliance.getViolations(limit);
    res.json({ success: true, violations, count: violations.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get auto-pause events
 */
router.get('/sophia/auto-pause-events', async (req, res) => {
  try {
    const { accountId } = req.query;
    const events = sophiaLinkedInCompliance.getAutoPauseEvents(accountId as string | undefined);
    res.json({ success: true, events, count: events.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// LIVE CAMPAIGN OBSERVER ENDPOINTS
// ============================================

/**
 * Start a visible session for live campaign viewing
 */
router.post('/campaign-observer/start', async (req, res) => {
  try {
    const { userId, workspaceId, campaignId, cookies, observerId } = req.body;
    
    if (!userId || !workspaceId) {
      return res.status(400).json({ error: 'userId and workspaceId are required' });
    }

    const activeVisible = getActiveVisibleSession();
    if (activeVisible && activeVisible.campaignId !== campaignId) {
      return res.status(409).json({ 
        error: 'Another campaign is being observed',
        activeCampaign: activeVisible.campaignId,
        message: 'Stop the current observer session first'
      });
    }

    const session = await createUnifiedSession({
      userId,
      workspaceId,
      campaignId,
      visible: true,
      cookies,
      observerId: observerId || `obs-${Date.now()}`
    });

    res.json({
      success: true,
      message: 'Live campaign observer started! Switch to VNC/Desktop view to watch.',
      sessionId: session.id,
      status: session.status
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Stop the campaign observer session
 */
router.post('/campaign-observer/stop', async (req, res) => {
  try {
    const { sessionId, userId, workspaceId, campaignId } = req.body;
    
    const key = sessionId || (userId && workspaceId ? 
      (campaignId ? `${userId}:${workspaceId}:${campaignId}` : `${userId}:${workspaceId}`) : null);
    
    if (!key) {
      const activeSession = getActiveVisibleSession();
      if (activeSession) {
        await closeUnifiedSession(activeSession.id);
        return res.json({ success: true, message: 'Active observer session stopped' });
      }
      return res.status(400).json({ error: 'No session identifier provided' });
    }

    await closeUnifiedSession(key);
    res.json({ success: true, message: 'Campaign observer stopped' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get current observer session status
 */
router.get('/campaign-observer/status', async (req, res) => {
  try {
    const { sessionId } = req.query;
    
    if (sessionId) {
      const status = getSessionStatus(sessionId as string);
      if (status) {
        return res.json({ success: true, session: status });
      }
      return res.json({ success: true, session: null, message: 'Session not found' });
    }

    const activeSession = getActiveVisibleSession();
    if (activeSession) {
      return res.json({
        success: true,
        session: {
          id: activeSession.id,
          campaignId: activeSession.campaignId,
          visible: activeSession.isVisible,
          status: activeSession.status,
          currentAction: activeSession.currentAction,
          duration: Date.now() - activeSession.startTime.getTime(),
          events: activeSession.events.slice(-20)
        }
      });
    }

    res.json({ success: true, session: null, message: 'No active observer session' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all active sessions
 */
router.get('/campaign-observer/sessions', async (_req, res) => {
  try {
    const sessions = getAllSessions();
    const summary = sessions.map(s => ({
      id: s.id,
      userId: s.userId,
      workspaceId: s.workspaceId,
      campaignId: s.campaignId,
      visible: s.isVisible,
      status: s.status,
      currentAction: s.currentAction,
      duration: Date.now() - s.startTime.getTime()
    }));
    res.json({ success: true, sessions: summary, count: sessions.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Navigate to LinkedIn in the observer session
 */
router.post('/campaign-observer/navigate', async (req, res) => {
  try {
    const { sessionId, url } = req.body;
    
    const session = sessionId ? getSession(sessionId) : getActiveVisibleSession();
    if (!session) {
      return res.status(404).json({ error: 'No active observer session' });
    }

    await navigateInSession(session, url || 'https://www.linkedin.com/feed');
    res.json({ success: true, message: `Navigated to ${url || 'LinkedIn feed'}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Perform a demo action in the observer session
 */
router.post('/campaign-observer/demo-action', async (req, res) => {
  try {
    const { sessionId, action } = req.body;
    
    const session = sessionId ? getSession(sessionId) : getActiveVisibleSession();
    if (!session) {
      return res.status(404).json({ error: 'No active observer session' });
    }

    updateSessionStatus(session.id, 'running', `Performing: ${action}`);

    switch (action) {
      case 'scroll':
        await scrollInSession(session, 300);
        break;
      case 'navigate-feed':
        await navigateInSession(session, 'https://www.linkedin.com/feed');
        break;
      case 'navigate-network':
        await navigateInSession(session, 'https://www.linkedin.com/mynetwork');
        break;
      case 'navigate-messages':
        await navigateInSession(session, 'https://www.linkedin.com/messaging');
        break;
      default:
        addSessionEvent(session.id, { type: 'action', message: `Demo action: ${action}` });
    }

    updateSessionStatus(session.id, 'idle', 'Ready for next action');
    res.json({ success: true, message: `Performed ${action}` });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Simulate a campaign action (for demonstration)
 */
router.post('/campaign-observer/simulate-campaign-action', async (req, res) => {
  try {
    const { sessionId, actionType, targetProfile, message } = req.body;
    
    const session = sessionId ? getSession(sessionId) : getActiveVisibleSession();
    if (!session) {
      return res.status(404).json({ error: 'No active observer session' });
    }

    updateSessionStatus(session.id, 'running', `Simulating: ${actionType}`);

    const actions: string[] = [];

    switch (actionType) {
      case 'view_profile':
        addSessionEvent(session.id, { type: 'action', message: `Viewing profile: ${targetProfile || 'example'}` });
        await navigateInSession(session, `https://www.linkedin.com/in/${targetProfile || 'example'}`);
        await scrollInSession(session, 400);
        actions.push('Viewed profile', 'Scrolled through profile');
        break;

      case 'connection_request':
        addSessionEvent(session.id, { type: 'action', message: 'Simulating connection request flow...' });
        await navigateInSession(session, 'https://www.linkedin.com/mynetwork');
        await scrollInSession(session, 200);
        addSessionEvent(session.id, { type: 'action', message: 'Would click Connect button here (simulation only)' });
        actions.push('Navigated to network', 'Located connect button', 'Simulated click (demo mode)');
        break;

      case 'send_message':
        addSessionEvent(session.id, { type: 'action', message: 'Simulating message flow...' });
        await navigateInSession(session, 'https://www.linkedin.com/messaging');
        addSessionEvent(session.id, { type: 'action', message: `Would type: "${message || 'Hello!'}" (simulation only)` });
        actions.push('Opened messaging', 'Located compose area', 'Simulated typing (demo mode)');
        break;

      default:
        addSessionEvent(session.id, { type: 'action', message: `Unknown action: ${actionType}` });
        actions.push(`Unknown action: ${actionType}`);
    }

    updateSessionStatus(session.id, 'idle', 'Simulation complete');
    res.json({ success: true, actionType, actions, message: 'Simulation completed - no real actions taken' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
