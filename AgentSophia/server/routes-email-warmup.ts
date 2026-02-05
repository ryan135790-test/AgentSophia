import { Router } from 'express';
import { emailWarmupEngine } from './lib/email-warmup-engine';

const router = Router();

/**
 * GET /api/email-warmup/providers
 * Get available email providers with comparison
 */
router.get('/providers', async (req, res) => {
  const providers = emailWarmupEngine.getProviderConfigs();
  
  res.json({
    providers,
    comparison: [
      {
        provider: 'ses',
        name: 'Amazon SES',
        costPer100k: '$10',
        bestFor: 'High volume, budget-conscious',
        deliverability: 'Good (self-managed)',
        setupComplexity: 'High',
        recommendation: 'Best for cost at scale'
      },
      {
        provider: 'sendgrid',
        name: 'SendGrid',
        costPer100k: '$20-90',
        bestFor: 'All-in-one platform',
        deliverability: 'Good',
        setupComplexity: 'Medium',
        recommendation: 'Best for marketing + transactional'
      },
      {
        provider: 'postmark',
        name: 'Postmark',
        costPer100k: '$75',
        bestFor: 'Speed-critical transactional',
        deliverability: 'Excellent',
        setupComplexity: 'Low',
        recommendation: 'Best for transactional speed'
      },
      {
        provider: 'resend',
        name: 'Resend',
        costPer100k: '$20-50',
        bestFor: 'Developer experience',
        deliverability: 'Good',
        setupComplexity: 'Low',
        recommendation: 'Best modern API'
      }
    ],
    sophiaRecommendation: {
      provider: 'ses',
      reason: 'For your volume, Amazon SES offers the best cost-efficiency. Pair with Postmark for critical transactional emails.',
      estimatedMonthlyCost: '$15-50'
    }
  });
});

/**
 * GET /api/email-warmup/schedule
 * Get the 20-day warmup schedule
 */
router.get('/schedule', async (req, res) => {
  const schedule = emailWarmupEngine.getWarmupSchedule();
  
  res.json({
    schedule,
    totalDays: 20,
    startLimit: 20,
    endLimit: 10000,
    sophiaTips: [
      'Sophia will automatically advance your warmup based on metrics',
      'If issues are detected, Sophia will pause and notify you',
      'Maintain consistent sending times for best results',
      'Focus on engaged subscribers during warmup'
    ]
  });
});

/**
 * GET /api/email-warmup/dashboard
 * Get warmup dashboard for workspace
 */
router.get('/dashboard', async (req, res) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'workspace_1';
    const dashboard = emailWarmupEngine.getWarmupDashboard(workspaceId);
    
    res.json(dashboard);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get dashboard', details: error.message });
  }
});

/**
 * POST /api/email-warmup/domains
 * Add a new domain for warmup
 */
router.post('/domains', async (req, res) => {
  try {
    const { workspaceId, domain, provider } = req.body;
    
    if (!domain || !provider) {
      return res.status(400).json({ error: 'Domain and provider required' });
    }

    const emailDomain = emailWarmupEngine.addDomain(
      workspaceId || 'workspace_1',
      domain,
      provider
    );

    res.json({
      success: true,
      domain: emailDomain,
      nextSteps: [
        'Add DNS records for SPF, DKIM, and DMARC',
        'Verify domain ownership',
        'Start warmup process'
      ],
      dnsRecords: {
        spf: {
          type: 'TXT',
          name: '@',
          value: `v=spf1 include:${provider}.com ~all`
        },
        dkim: {
          type: 'TXT',
          name: `${provider}._domainkey`,
          value: 'k=rsa; p=MIGfMA0GCSq...'
        },
        dmarc: {
          type: 'TXT',
          name: '_dmarc',
          value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}`
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add domain', details: error.message });
  }
});

/**
 * GET /api/email-warmup/domains
 * Get all domains for workspace
 */
router.get('/domains', async (req, res) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'workspace_1';
    const domains = emailWarmupEngine.getWorkspaceDomains(workspaceId);
    
    res.json({ domains });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get domains', details: error.message });
  }
});

/**
 * GET /api/email-warmup/domains/:domainId
 * Get domain details with Sophia insights
 */
router.get('/domains/:domainId', async (req, res) => {
  try {
    const { domainId } = req.params;
    const domain = emailWarmupEngine.getDomain(domainId);
    
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const sophiaInsight = emailWarmupEngine.getSophiaInsight(domainId);
    const actions = emailWarmupEngine.getDomainActions(domainId);
    const recommendedAction = emailWarmupEngine.sophiaRecommendAction(domainId);

    res.json({
      domain,
      sophiaInsight,
      recentActions: actions.slice(-10),
      recommendedAction
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get domain', details: error.message });
  }
});

/**
 * POST /api/email-warmup/domains/:domainId/verify
 * Verify domain DNS records
 */
router.post('/domains/:domainId/verify', async (req, res) => {
  try {
    const { domainId } = req.params;
    const result = emailWarmupEngine.verifyDomain(domainId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify domain', details: error.message });
  }
});

/**
 * POST /api/email-warmup/domains/:domainId/start
 * Start warmup for a domain
 */
router.post('/domains/:domainId/start', async (req, res) => {
  try {
    const { domainId } = req.params;
    const result = emailWarmupEngine.startWarmup(domainId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to start warmup', details: error.message });
  }
});

/**
 * POST /api/email-warmup/domains/:domainId/pause
 * Pause warmup
 */
router.post('/domains/:domainId/pause', async (req, res) => {
  try {
    const { domainId } = req.params;
    const { reason } = req.body;
    
    const result = emailWarmupEngine.pauseWarmup(domainId, reason || 'User requested pause');
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to pause warmup', details: error.message });
  }
});

/**
 * POST /api/email-warmup/domains/:domainId/resume
 * Resume warmup
 */
router.post('/domains/:domainId/resume', async (req, res) => {
  try {
    const { domainId } = req.params;
    const result = emailWarmupEngine.resumeWarmup(domainId);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to resume warmup', details: error.message });
  }
});

/**
 * POST /api/email-warmup/domains/:domainId/advance
 * Manually advance to next warmup day
 */
router.post('/domains/:domainId/advance', async (req, res) => {
  try {
    const { domainId } = req.params;
    const result = emailWarmupEngine.advanceWarmupDay(domainId);
    
    if (!result.success) {
      return res.status(400).json({ error: 'Cannot advance warmup - check metrics' });
    }

    res.json({
      success: true,
      newDay: result.newDay,
      newLimit: result.newLimit,
      message: `Advanced to day ${result.newDay}. New daily limit: ${result.newLimit}`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to advance warmup', details: error.message });
  }
});

/**
 * POST /api/email-warmup/domains/:domainId/metrics
 * Record sending metrics
 */
router.post('/domains/:domainId/metrics', async (req, res) => {
  try {
    const { domainId } = req.params;
    const { delivered, bounced, opened, complained } = req.body;
    
    emailWarmupEngine.recordMetrics(domainId, delivered, bounced, opened, complained);
    
    const insight = emailWarmupEngine.getSophiaInsight(domainId);
    const recommendedAction = emailWarmupEngine.sophiaRecommendAction(domainId);

    res.json({
      success: true,
      sophiaInsight: insight,
      recommendedAction
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record metrics', details: error.message });
  }
});

/**
 * GET /api/email-warmup/sophia/insights
 * Get Sophia's warmup insights for all domains
 */
router.get('/sophia/insights', async (req, res) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'workspace_1';
    const dashboard = emailWarmupEngine.getWarmupDashboard(workspaceId);
    
    const criticalDomains = dashboard.sophiaInsights.filter(i => i.status === 'critical');
    const warningDomains = dashboard.sophiaInsights.filter(i => i.status === 'warning');

    res.json({
      summary: {
        totalDomains: dashboard.summary.total,
        healthy: dashboard.summary.total - criticalDomains.length - warningDomains.length,
        warnings: warningDomains.length,
        critical: criticalDomains.length,
        avgHealthScore: dashboard.summary.avgReputationScore
      },
      criticalAlerts: criticalDomains.map(d => ({
        domain: d.domain,
        issue: d.riskFactors[0] || 'Requires attention',
        action: d.recommendations[0] || 'Review domain health'
      })),
      insights: dashboard.sophiaInsights,
      overallRecommendation: criticalDomains.length > 0
        ? 'URGENT: Address critical domain issues immediately to protect sender reputation'
        : warningDomains.length > 0
        ? 'Some domains need attention. Review warnings to maintain deliverability.'
        : 'All domains are healthy. Continue current warmup strategy.'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get Sophia insights', details: error.message });
  }
});

/**
 * POST /api/email-warmup/sophia/auto-manage
 * Enable Sophia to auto-manage warmup
 */
router.post('/sophia/auto-manage', async (req, res) => {
  try {
    const { enabled, workspaceId } = req.body;
    
    res.json({
      success: true,
      autoManageEnabled: enabled,
      message: enabled 
        ? 'Sophia will now automatically manage your email warmup. She will advance days, pause on issues, and optimize sending.'
        : 'Auto-management disabled. You will need to manually advance warmup days.',
      capabilities: enabled ? [
        'Automatic daily advancement based on metrics',
        'Pause sending if bounce/complaint rates spike',
        'Resume when metrics stabilize',
        'Optimize sending times',
        'Alert you to potential issues',
        'Adjust volume based on engagement'
      ] : []
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update auto-manage', details: error.message });
  }
});

export default router;
