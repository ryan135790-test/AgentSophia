import { Router } from 'express';
import { bulkEmailEngine } from './lib/bulk-email-engine';

const router = Router();

/**
 * POST /api/bulk-email/campaigns
 * Create a new bulk email campaign
 */
router.post('/campaigns', async (req, res) => {
  try {
    const { 
      workspaceId, 
      name, 
      template, 
      recipients, 
      fromEmail, 
      fromName,
      replyTo,
      settings 
    } = req.body;

    if (!workspaceId || !name || !template || !recipients || !fromEmail || !fromName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const campaign = bulkEmailEngine.createCampaign(
      workspaceId,
      name,
      template,
      recipients,
      fromEmail,
      fromName,
      settings
    );

    res.json({
      success: true,
      campaign,
      message: `Campaign "${name}" created with ${campaign.stats.totalRecipients} valid recipients`,
      validation: {
        valid: campaign.stats.validated,
        invalid: campaign.stats.invalid,
        mergeFieldsDetected: campaign.template.mergeFields
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create campaign', details: error.message });
  }
});

/**
 * GET /api/bulk-email/campaigns
 * Get all campaigns for a workspace
 */
router.get('/campaigns', async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID required' });
    }

    const campaigns = bulkEmailEngine.getWorkspaceCampaigns(workspaceId);

    res.json({
      campaigns,
      total: campaigns.length
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get campaigns', details: error.message });
  }
});

/**
 * GET /api/bulk-email/campaigns/:campaignId
 * Get campaign details and progress
 */
router.get('/campaigns/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const progress = bulkEmailEngine.getCampaignProgress(campaignId);

    if (!progress.campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(progress);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get campaign', details: error.message });
  }
});

/**
 * POST /api/bulk-email/campaigns/:campaignId/start
 * Start sending a campaign
 */
router.post('/campaigns/:campaignId/start', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result = await bulkEmailEngine.startCampaign(campaignId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to start campaign', details: error.message });
  }
});

/**
 * POST /api/bulk-email/campaigns/:campaignId/pause
 * Pause a sending campaign
 */
router.post('/campaigns/:campaignId/pause', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const result = bulkEmailEngine.pauseCampaign(campaignId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to pause campaign', details: error.message });
  }
});

/**
 * POST /api/bulk-email/campaigns/:campaignId/schedule
 * Schedule a campaign for later
 */
router.post('/campaigns/:campaignId/schedule', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ error: 'Scheduled time required' });
    }

    const result = bulkEmailEngine.scheduleCampaign(campaignId, new Date(scheduledAt));

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to schedule campaign', details: error.message });
  }
});

/**
 * POST /api/bulk-email/validate
 * Validate a list of email recipients
 */
router.post('/validate', async (req, res) => {
  try {
    const { recipients } = req.body;

    if (!recipients || !Array.isArray(recipients)) {
      return res.status(400).json({ error: 'Recipients array required' });
    }

    const result = bulkEmailEngine.validateRecipients(recipients);

    res.json({
      ...result,
      message: `Validated ${result.stats.total} recipients: ${result.stats.valid} valid, ${result.stats.invalid} invalid, ${result.stats.duplicates} duplicates removed`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to validate recipients', details: error.message });
  }
});

/**
 * GET /api/bulk-email/deliverability
 * Get deliverability health metrics
 */
router.get('/deliverability', async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    
    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID required' });
    }

    const health = bulkEmailEngine.getDeliverabilityHealth(workspaceId);

    res.json(health);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get deliverability health', details: error.message });
  }
});

/**
 * POST /api/bulk-email/webhooks/bounce
 * Handle email bounce webhook
 */
router.post('/webhooks/bounce', async (req, res) => {
  try {
    const { email, campaignId } = req.body;
    bulkEmailEngine.recordBounce(email, campaignId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record bounce', details: error.message });
  }
});

/**
 * POST /api/bulk-email/webhooks/unsubscribe
 * Handle unsubscribe
 */
router.post('/webhooks/unsubscribe', async (req, res) => {
  try {
    const { email, campaignId } = req.body;
    bulkEmailEngine.recordUnsubscribe(email, campaignId);
    res.json({ success: true, message: 'Successfully unsubscribed' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process unsubscribe', details: error.message });
  }
});

/**
 * POST /api/bulk-email/webhooks/open
 * Track email open
 */
router.post('/webhooks/open', async (req, res) => {
  try {
    const { campaignId, recipientId } = req.body;
    bulkEmailEngine.recordOpen(campaignId, recipientId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record open', details: error.message });
  }
});

/**
 * POST /api/bulk-email/webhooks/click
 * Track email click
 */
router.post('/webhooks/click', async (req, res) => {
  try {
    const { campaignId, recipientId } = req.body;
    bulkEmailEngine.recordClick(campaignId, recipientId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record click', details: error.message });
  }
});

/**
 * POST /api/bulk-email/webhooks/complaint
 * Handle spam complaint
 */
router.post('/webhooks/complaint', async (req, res) => {
  try {
    const { email, campaignId } = req.body;
    bulkEmailEngine.recordComplaint(email, campaignId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record complaint', details: error.message });
  }
});

/**
 * GET /api/bulk-email/templates
 * Get email template suggestions
 */
router.get('/templates', async (req, res) => {
  res.json({
    templates: [
      {
        id: 'cold_outreach',
        name: 'Cold Outreach',
        category: 'prospecting',
        subject: 'Quick question for {{company}}',
        htmlBody: `<p>Hi {{firstName}},</p>
<p>I noticed {{company}} is growing fast, and I wanted to reach out because we help companies like yours achieve [specific benefit].</p>
<p>Would you be open to a quick 15-minute call this week?</p>
<p>Best,<br>Your Name</p>`,
        mergeFields: ['firstName', 'company']
      },
      {
        id: 'follow_up',
        name: 'Follow Up',
        category: 'nurturing',
        subject: 'Following up - {{company}}',
        htmlBody: `<p>Hi {{firstName}},</p>
<p>I wanted to follow up on my previous email. I understand you're busy, so I'll keep this brief.</p>
<p>Our solution has helped companies similar to {{company}} achieve [specific result]. Would it make sense to chat?</p>
<p>Best,<br>Your Name</p>`,
        mergeFields: ['firstName', 'company']
      },
      {
        id: 'product_announcement',
        name: 'Product Announcement',
        category: 'marketing',
        subject: 'Exciting news for {{company}}!',
        htmlBody: `<p>Hi {{firstName}},</p>
<p>We're excited to announce [new feature/product] that we think could really benefit {{company}}.</p>
<p>[Brief description of what it does and the value]</p>
<p>Want to learn more? <a href="#">Schedule a demo</a></p>
<p>Best,<br>Your Name</p>`,
        mergeFields: ['firstName', 'company']
      },
      {
        id: 'event_invitation',
        name: 'Event Invitation',
        category: 'events',
        subject: '{{firstName}}, you\'re invited!',
        htmlBody: `<p>Hi {{firstName}},</p>
<p>We're hosting [event name] on [date] and would love to have you join us.</p>
<p>[Event details and what attendees will learn]</p>
<p><a href="#">Reserve your spot</a></p>
<p>Best,<br>Your Name</p>`,
        mergeFields: ['firstName']
      },
      {
        id: 'case_study',
        name: 'Case Study Share',
        category: 'nurturing',
        subject: 'How [Company] achieved [result]',
        htmlBody: `<p>Hi {{firstName}},</p>
<p>I thought you might find this interesting - we recently helped [Similar Company] achieve [specific result].</p>
<p>[Brief summary of the case study]</p>
<p>I'd love to discuss how {{company}} could see similar results. Are you available for a quick call?</p>
<p>Best,<br>Your Name</p>`,
        mergeFields: ['firstName', 'company']
      }
    ]
  });
});

/**
 * GET /api/bulk-email/best-send-times
 * Get AI-recommended best send times
 */
router.get('/best-send-times', async (req, res) => {
  res.json({
    recommendations: {
      bestDays: ['Tuesday', 'Wednesday', 'Thursday'],
      bestHours: ['9:00 AM', '10:00 AM', '2:00 PM'],
      worstDays: ['Monday', 'Friday', 'Weekend'],
      worstHours: ['Before 8 AM', 'After 6 PM', 'Lunch (12-1 PM)'],
      insights: [
        'Emails sent on Tuesday have 18% higher open rates',
        'Mid-morning (9-11 AM) sees peak engagement',
        'Avoid Monday mornings - inbox overload reduces visibility',
        'B2B emails perform best during work hours'
      ],
      personalizedRecommendation: {
        date: 'Next Tuesday',
        time: '10:00 AM EST',
        reason: 'Based on your audience engagement patterns, this time shows optimal open rates'
      }
    }
  });
});

export default router;
