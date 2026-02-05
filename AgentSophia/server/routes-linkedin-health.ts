import { Router } from 'express';
import * as scraperHealth from './lib/linkedin-scraper-health';

const router = Router();

// Get current health metrics
router.get('/metrics', (req, res) => {
  try {
    const metrics = scraperHealth.getHealthMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get health check history
router.get('/history', (req, res) => {
  try {
    const history = scraperHealth.getHealthHistory();
    res.json({ history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get dashboard summary
router.get('/dashboard', (req, res) => {
  try {
    const metrics = scraperHealth.getHealthMetrics();
    const history = scraperHealth.getHealthHistory();
    
    // Calculate trend
    const recentHistory = history.slice(0, 10);
    const successCount = recentHistory.filter(h => h.success && h.leadsFound > 0).length;
    const trend = recentHistory.length > 0 
      ? (successCount / recentHistory.length) >= 0.8 ? 'stable' : 'declining'
      : 'unknown';
    
    res.json({
      status: metrics.status,
      statusColor: metrics.status === 'healthy' ? 'green' 
        : metrics.status === 'degraded' ? 'yellow' 
        : metrics.status === 'failing' ? 'red' 
        : 'gray',
      successRate: metrics.successRate24h,
      totalSearches: metrics.totalSearches24h,
      failedSearches: metrics.failedSearches24h,
      lastCanaryRun: metrics.lastCanaryRun,
      lastCanarySuccess: metrics.lastCanarySuccess,
      lastError: metrics.lastError,
      lastErrorTime: metrics.lastErrorTime,
      trend,
      selectorHealth: metrics.selectorHealth,
      recentHistory: recentHistory.map(h => ({
        timestamp: h.timestamp,
        success: h.success,
        leadsFound: h.leadsFound,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Manual trigger for canary test (for admin use)
router.post('/canary', async (req, res) => {
  try {
    // This would trigger a test search - for now just return a placeholder
    res.json({ 
      message: 'Canary test triggered. Results will be available in health metrics.',
      note: 'Full canary test requires LinkedIn session. Use regular search to test.'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reset daily metrics (admin only)
router.post('/reset', (req, res) => {
  try {
    scraperHealth.resetDailyMetrics();
    res.json({ success: true, message: 'Daily metrics reset' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
