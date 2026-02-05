import { Router } from 'express';
import {
  sendWhatsAppMessage,
  sendBulkWhatsAppMessages,
  getWhatsAppTemplates,
  getConversations,
  addMessageToConversation,
  parseWhatsAppWebhook,
  verifyWhatsAppWebhook,
  getWhatsAppConfig,
  getWhatsAppAnalytics,
  recordWhatsAppEvent,
  validateWhatsAppCredentials,
  getWhatsAppBusinessProfile
} from './lib/whatsapp-integration';
import {
  runSpamTest,
  checkDomainReputation,
  SpamTestResult
} from './lib/spam-test-engine';
import {
  processSpintax,
  validateSpintax,
  previewSpintax,
  generateAllVariations,
  countVariations,
  analyzeSpintaxUsage,
  SPINTAX_TEMPLATES,
  getTemplatesByCategory,
  applySpintaxToEmail,
  generateEmailVariations
} from './lib/spintax-processor';
import { setWorkspaceApiKey, getWorkspaceApiKey } from './lib/workspace-api-keys';

const router = Router();

// ============================================
// WHATSAPP INTEGRATION ROUTES
// ============================================

router.post('/whatsapp/:workspaceId/send', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { to, type, text, templateName, templateLanguage, templateParams, mediaUrl, caption } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'Recipient phone number is required' });
    }

    const result = await sendWhatsAppMessage(workspaceId, {
      to,
      type: type || 'text',
      text,
      templateName,
      templateLanguage,
      templateParams,
      mediaUrl,
      caption
    });

    if (result.success) {
      recordWhatsAppEvent(workspaceId, 'sent');
      addMessageToConversation(workspaceId, to, {
        id: result.messageId!,
        direction: 'outbound',
        text: text || `[${type}]`,
        timestamp: result.timestamp!
      });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send WhatsApp message', details: error.message });
  }
});

router.post('/whatsapp/:workspaceId/send-bulk', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { messages, delayMs } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const result = await sendBulkWhatsAppMessages(workspaceId, messages, delayMs);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send bulk messages', details: error.message });
  }
});

router.get('/whatsapp/:workspaceId/templates', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const templates = await getWhatsAppTemplates(workspaceId);
    res.json({ templates });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch templates', details: error.message });
  }
});

router.get('/whatsapp/:workspaceId/conversations', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const conversations = getConversations(workspaceId);
    res.json({ conversations });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch conversations', details: error.message });
  }
});

router.get('/whatsapp/:workspaceId/analytics', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const analytics = getWhatsAppAnalytics(workspaceId);
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
});

router.get('/whatsapp/:workspaceId/profile', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const profile = await getWhatsAppBusinessProfile(workspaceId);
    res.json({ profile });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch business profile', details: error.message });
  }
});

router.get('/whatsapp/:workspaceId/status', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const config = await getWhatsAppConfig(workspaceId);
    
    res.json({
      configured: !!config,
      hasAccessToken: !!config?.accessToken,
      hasPhoneNumberId: !!config?.phoneNumberId,
      hasBusinessAccountId: !!config?.businessAccountId
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to check status', details: error.message });
  }
});

router.post('/whatsapp/:workspaceId/configure', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { accessToken, phoneNumberId, businessAccountId, verifyToken } = req.body;

    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({ error: 'Access token and phone number ID are required' });
    }

    const validation = await validateWhatsAppCredentials(accessToken, phoneNumberId);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid WhatsApp credentials', details: validation.error });
    }

    await setWorkspaceApiKey(workspaceId, 'whatsapp_access_token', accessToken);
    await setWorkspaceApiKey(workspaceId, 'whatsapp_phone_number_id', phoneNumberId);
    if (businessAccountId) {
      await setWorkspaceApiKey(workspaceId, 'whatsapp_business_account_id', businessAccountId);
    }
    if (verifyToken) {
      await setWorkspaceApiKey(workspaceId, 'whatsapp_verify_token', verifyToken);
    }

    res.json({
      success: true,
      phoneNumber: validation.phoneNumber,
      message: 'WhatsApp configured successfully'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to configure WhatsApp', details: error.message });
  }
});

router.get('/whatsapp/webhook', async (req, res) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'agent-sophia-whatsapp';

  const result = await verifyWhatsAppWebhook(mode, token, challenge, verifyToken);
  
  if (result.valid) {
    res.status(200).send(result.challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/whatsapp/webhook', async (req, res) => {
  try {
    const events = parseWhatsAppWebhook(req.body);
    
    for (const event of events) {
      console.log('WhatsApp webhook event:', event.type, event.messageId);
      
      if (event.type === 'message_delivered') {
        // recordWhatsAppEvent for the relevant workspace
      } else if (event.type === 'message_read') {
        // recordWhatsAppEvent for the relevant workspace  
      }
    }

    res.sendStatus(200);
  } catch (error: any) {
    console.error('WhatsApp webhook error:', error);
    res.sendStatus(200);
  }
});

router.get('/whatsapp/setup-guide', async (req, res) => {
  res.json({
    title: 'WhatsApp Business API Setup',
    steps: [
      {
        step: 1,
        title: 'Create Meta Business Account',
        description: 'Go to business.facebook.com and create or use existing business account',
        url: 'https://business.facebook.com'
      },
      {
        step: 2,
        title: 'Create Meta Developer App',
        description: 'Go to developers.facebook.com, create an app with WhatsApp product',
        url: 'https://developers.facebook.com/apps'
      },
      {
        step: 3,
        title: 'Get Access Token',
        description: 'In your app dashboard, go to WhatsApp > API Setup to get temporary access token',
        note: 'For production, generate a permanent system user token'
      },
      {
        step: 4,
        title: 'Get Phone Number ID',
        description: 'From WhatsApp > API Setup, copy the Phone Number ID for your test number',
        note: 'You can add your own number or use the test number provided'
      },
      {
        step: 5,
        title: 'Configure Webhook (Optional)',
        description: 'Set webhook URL to receive message status updates and incoming messages',
        webhookUrl: `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : 'YOUR_DOMAIN'}/api/whatsapp/webhook`
      }
    ],
    pricing: {
      model: 'Per-conversation pricing',
      note: 'First 1,000 conversations/month are free',
      rates: {
        marketing: '$0.0147 - $0.0858 per conversation',
        utility: '$0.0040 - $0.0500 per conversation',
        authentication: '$0.0045 - $0.0600 per conversation',
        service: 'Free (first 1,000/month)'
      }
    }
  });
});

// ============================================
// SPAM TEST ROUTES
// ============================================

router.post('/spam-test/analyze', async (req, res) => {
  try {
    const { subject, htmlBody, textBody, fromEmail, fromName, replyTo, checkDomain } = req.body;

    if (!subject || !htmlBody || !fromEmail) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['subject', 'htmlBody', 'fromEmail']
      });
    }

    let domainInfo;
    if (checkDomain) {
      const domain = fromEmail.split('@')[1];
      domainInfo = await checkDomainReputation(domain);
    }

    const result = runSpamTest({
      subject,
      htmlBody,
      textBody,
      fromEmail,
      fromName,
      replyTo
    }, domainInfo);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Spam test failed', details: error.message });
  }
});

router.post('/spam-test/quick', async (req, res) => {
  try {
    const { subject, body, fromEmail } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required' });
    }

    const result = runSpamTest({
      subject,
      htmlBody: body,
      fromEmail: fromEmail || 'test@example.com'
    });

    res.json({
      score: result.score,
      rating: result.rating,
      status: result.overallStatus,
      topIssues: result.checks
        .filter(c => c.status !== 'pass')
        .slice(0, 3)
        .map(c => ({ name: c.name, message: c.message, fix: c.fix })),
      deliverabilityPrediction: result.deliverabilityPrediction
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Quick spam test failed', details: error.message });
  }
});

router.post('/spam-test/domain', async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }

    const domainInfo = await checkDomainReputation(domain);
    
    const checks: { name: string; status: string; record?: string; policy?: string; fix?: string }[] = [];
    let score = 0;
    
    if (domainInfo.spf?.valid) {
      score += 33;
      checks.push({ name: 'SPF', status: 'pass', record: domainInfo.spf.record });
    } else {
      checks.push({ name: 'SPF', status: 'fail', fix: 'Add SPF record to DNS' });
    }
    
    if (domainInfo.dkim?.valid) {
      score += 33;
      checks.push({ name: 'DKIM', status: 'pass' });
    } else {
      checks.push({ name: 'DKIM', status: 'warning', fix: 'Configure DKIM with email provider' });
    }
    
    if (domainInfo.dmarc?.valid) {
      score += 34;
      checks.push({ name: 'DMARC', status: 'pass', policy: domainInfo.dmarc.policy });
    } else {
      checks.push({ name: 'DMARC', status: 'fail', fix: 'Add DMARC record: v=DMARC1; p=quarantine;' });
    }

    res.json({
      domain,
      score,
      rating: score >= 80 ? 'good' : score >= 50 ? 'fair' : 'poor',
      checks,
      details: domainInfo
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Domain check failed', details: error.message });
  }
});

router.get('/spam-test/trigger-words', async (req, res) => {
  const categories = {
    urgency: ['urgent', 'act now', 'limited time', 'hurry', 'last chance', 'expires'],
    financial: ['free', 'cash', 'money', 'earn', 'income', 'credit', 'debt', 'loan'],
    promises: ['guarantee', 'promise', 'amazing', 'incredible', 'miracle', '100%'],
    action: ['click here', 'buy now', 'order now', 'call now', 'apply now'],
    suspicious: ['winner', 'congratulations', 'selected', 'prize', 'casino', 'lottery']
  };

  res.json({
    categories,
    total: Object.values(categories).flat().length,
    tip: 'Avoid these words or use them sparingly in your email content'
  });
});

// ============================================
// SPINTAX ROUTES
// ============================================

router.post('/spintax/process', async (req, res) => {
  try {
    const { text, seed } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = processSpintax(text, seed);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process spintax', details: error.message });
  }
});

router.post('/spintax/validate', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = validateSpintax(text);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to validate spintax', details: error.message });
  }
});

router.post('/spintax/preview', async (req, res) => {
  try {
    const { text, count } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const previews = previewSpintax(text, count || 5);
    const variationsCount = countVariations(text);

    res.json({
      previews,
      totalVariations: variationsCount,
      showing: previews.length
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to preview spintax', details: error.message });
  }
});

router.post('/spintax/generate-all', async (req, res) => {
  try {
    const { text, maxVariations } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const variations = generateAllVariations(text, maxVariations || 100);

    res.json({
      variations,
      count: variations.length,
      maxRequested: maxVariations || 100
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate variations', details: error.message });
  }
});

router.post('/spintax/analyze', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const analysis = analyzeSpintaxUsage(text);
    const validation = validateSpintax(text);

    res.json({
      ...analysis,
      validation
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to analyze spintax', details: error.message });
  }
});

router.get('/spintax/templates', async (req, res) => {
  const { category } = req.query;

  if (category) {
    const templates = getTemplatesByCategory(category as string);
    res.json({ templates, category });
  } else {
    const categories = [...new Set(SPINTAX_TEMPLATES.map(t => t.category))];
    res.json({
      templates: SPINTAX_TEMPLATES,
      categories,
      total: SPINTAX_TEMPLATES.length
    });
  }
});

router.post('/spintax/apply-to-contacts', async (req, res) => {
  try {
    const { template, contacts, variationsPerContact } = req.body;

    if (!template || !contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Template and contacts array required' });
    }

    const results = generateEmailVariations(template, contacts, variationsPerContact || 1);

    res.json({
      results,
      totalGenerated: results.length,
      contactsProcessed: contacts.length
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to apply spintax', details: error.message });
  }
});

router.post('/spintax/email-with-contact', async (req, res) => {
  try {
    const { template, contact } = req.body;

    if (!template || !contact) {
      return res.status(400).json({ error: 'Template and contact data required' });
    }

    const result = applySpintaxToEmail(template, contact);

    res.json({
      original: template,
      processed: result,
      contact
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to apply spintax to email', details: error.message });
  }
});

export default router;
