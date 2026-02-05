import { Router } from 'express';
import { sophiaEmailManager } from './lib/sophia-email-manager';
import { sophiaEmailIntelligence } from './lib/sophia-email-intelligence';

const router = Router();

/**
 * GET /api/sophia-email/status
 * Get Sophia Email Manager status
 */
router.get('/status', async (req, res) => {
  try {
    const status = sophiaEmailManager.getStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

/**
 * POST /api/sophia-email/autonomy
 * Set Sophia's autonomy level for email management
 */
router.post('/autonomy', async (req, res) => {
  try {
    const { level, approvalThreshold } = req.body;
    
    if (level) {
      sophiaEmailManager.setAutonomyLevel(level);
    }
    if (approvalThreshold !== undefined) {
      sophiaEmailManager.setApprovalThreshold(approvalThreshold);
    }

    res.json({
      success: true,
      message: `Sophia autonomy set to "${level || 'assisted'}" with ${(approvalThreshold || 0.8) * 100}% approval threshold`,
      capabilities: level === 'autonomous' ? [
        'Auto-send at optimal times',
        'Auto-classify and respond to replies',
        'Auto-manage email warmup',
        'Auto-pause on delivery issues'
      ] : level === 'assisted' ? [
        'Suggest optimal send times',
        'Classify replies with suggestions',
        'Recommend warmup actions',
        'Alert on issues'
      ] : [
        'Manual control only',
        'Sophia provides analysis on request'
      ]
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to set autonomy', details: error.message });
  }
});

/**
 * POST /api/sophia-email/send
 * Send email with Sophia optimization
 */
router.post('/send', async (req, res) => {
  try {
    const { email, contactId } = req.body;
    
    if (!email || !email.to || !email.subject) {
      return res.status(400).json({ error: 'Email with to/subject required' });
    }

    const result = await sophiaEmailManager.sendOptimized(email, contactId || 'unknown');

    res.json({
      success: result.result.success,
      emailId: result.result.id,
      scheduledFor: result.scheduledFor,
      reason: result.reason,
      error: result.result.error
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

/**
 * POST /api/sophia-email/generate-content
 * Generate email content with AI
 */
router.post('/generate-content', async (req, res) => {
  try {
    const { industry, goal, audience, tone } = req.body;
    
    const content = await sophiaEmailManager.generateCampaignContent({
      industry: industry || 'Technology',
      goal: goal || 'Generate interest',
      audience: audience || 'Decision makers',
      tone: tone || 'Professional'
    });

    res.json(content);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate content', details: error.message });
  }
});

/**
 * POST /api/sophia-email/classify-reply
 * Classify an incoming reply
 */
router.post('/classify-reply', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Reply content required' });
    }

    const classification = await sophiaEmailManager.classifyReply(content);

    res.json({
      classification,
      sophiaInsight: `Detected ${classification.intent} intent with ${classification.sentiment} sentiment. Urgency: ${classification.urgency}`,
      suggestedAction: classification.suggestedAction
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to classify reply', details: error.message });
  }
});

/**
 * POST /api/sophia-email/handle-reply
 * Autonomously handle an incoming reply
 */
router.post('/handle-reply', async (req, res) => {
  try {
    const { content, contactName, originalSubject, contactEmail } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Reply content required' });
    }

    const result = await sophiaEmailManager.handleReplyAutonomously(content, {
      contactName: contactName || 'there',
      originalSubject: originalSubject || '',
      contactEmail: contactEmail || ''
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to handle reply', details: error.message });
  }
});

/**
 * POST /api/sophia-email/warmup/register
 * Register a new domain for warmup
 */
router.post('/warmup/register', async (req, res) => {
  try {
    const { domain, provider } = req.body;
    
    if (!domain || !provider) {
      return res.status(400).json({ error: 'Domain and provider required' });
    }

    const result = sophiaEmailManager.registerWarmupDomain(domain, provider);

    res.json({
      success: true,
      domain: result,
      message: `Domain ${domain} registered for warmup with ${provider}`,
      nextSteps: [
        'Verify DNS records (SPF, DKIM, DMARC)',
        'Start warmup when ready',
        'Sophia will automatically manage the warmup process'
      ]
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to register domain', details: error.message });
  }
});

/**
 * POST /api/sophia-email/warmup/:domainId/start
 * Start warmup for a domain
 */
router.post('/warmup/:domainId/start', async (req, res) => {
  try {
    const { domainId } = req.params;
    const result = sophiaEmailManager.startDomainWarmup(domainId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to start warmup', details: error.message });
  }
});

/**
 * POST /api/sophia-email/warmup/:domainId/execute
 * Execute a warmup cycle
 */
router.post('/warmup/:domainId/execute', async (req, res) => {
  try {
    const { domainId } = req.params;
    const result = await sophiaEmailManager.executeWarmupCycle(domainId);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to execute warmup', details: error.message });
  }
});

/**
 * POST /api/sophia-email/warmup/:domainId/advance
 * Advance to next warmup day
 */
router.post('/warmup/:domainId/advance', async (req, res) => {
  try {
    const { domainId } = req.params;
    const result = sophiaEmailManager.advanceWarmupDay(domainId);

    if (!result.success) {
      return res.status(400).json({ 
        error: 'Cannot advance - metrics not healthy',
        recommendation: 'Review bounce and complaint rates before advancing'
      });
    }

    res.json({
      success: true,
      newDay: result.newDay,
      newLimit: result.newLimit,
      message: `Advanced to day ${result.newDay}. New daily limit: ${result.newLimit}`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to advance', details: error.message });
  }
});

/**
 * POST /api/sophia-email/warmup/:domainId/metrics
 * Record warmup metrics
 */
router.post('/warmup/:domainId/metrics', async (req, res) => {
  try {
    const { domainId } = req.params;
    const { delivered, bounced, opened, complained } = req.body;

    sophiaEmailManager.recordWarmupMetrics(domainId, delivered, bounced, opened, complained);
    
    const status = sophiaEmailManager.getWarmupStatus(domainId);
    const recommendation = sophiaEmailManager.getWarmupRecommendation(domainId);

    res.json({
      success: true,
      currentStatus: status,
      sophiaRecommendation: recommendation
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record metrics', details: error.message });
  }
});

/**
 * GET /api/sophia-email/warmup/:domainId/status
 * Get warmup status for a domain
 */
router.get('/warmup/:domainId/status', async (req, res) => {
  try {
    const { domainId } = req.params;
    const status = sophiaEmailManager.getWarmupStatus(domainId);
    const recommendation = sophiaEmailManager.getWarmupRecommendation(domainId);

    if (!status) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    res.json({
      domain: status,
      sophiaRecommendation: recommendation
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

/**
 * GET /api/sophia-email/warmup/all
 * Get all warmup domains
 */
router.get('/warmup/all', async (req, res) => {
  try {
    const domains = sophiaEmailManager.getAllWarmupDomains();

    const summary = {
      total: domains.length,
      warming: domains.filter(d => d.status === 'warming').length,
      warmed: domains.filter(d => d.status === 'warmed').length,
      flagged: domains.filter(d => d.status === 'flagged').length
    };

    res.json({ domains, summary });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get domains', details: error.message });
  }
});

/**
 * POST /api/sophia-email/engagement
 * Record contact engagement
 */
router.post('/engagement', async (req, res) => {
  try {
    const { contactId, email, eventType } = req.body;
    
    if (!contactId || !email || !eventType) {
      return res.status(400).json({ error: 'contactId, email, and eventType required' });
    }

    sophiaEmailManager.recordEngagement(contactId, email, eventType);

    res.json({
      success: true,
      message: `${eventType} recorded for ${email}`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record engagement', details: error.message });
  }
});

/**
 * POST /api/sophia-email/audience-insights
 * Get AI insights for an audience
 */
router.post('/audience-insights', async (req, res) => {
  try {
    const { contactIds } = req.body;
    
    if (!contactIds || !Array.isArray(contactIds)) {
      return res.status(400).json({ error: 'contactIds array required' });
    }

    const insights = sophiaEmailManager.getAudienceInsights(contactIds);

    res.json({
      insights,
      sophiaSummary: `Audience of ${contactIds.length} contacts. Best send window: ${insights.bestSendWindow.day} at ${insights.bestSendWindow.hour}. ${insights.highEngagers} high engagers, ${insights.lowEngagers} need attention.`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get insights', details: error.message });
  }
});

/**
 * GET /api/sophia-email/providers
 * Get supported email providers
 */
router.get('/providers', async (req, res) => {
  res.json({
    providers: [
      {
        id: 'resend',
        name: 'Resend',
        recommended: true,
        costPer100k: '$20-50',
        features: ['Modern API', 'React Email', 'Fast delivery', 'Great DX'],
        setup: 'Add RESEND_API_KEY to secrets'
      },
      {
        id: 'ses',
        name: 'Amazon SES',
        recommended: false,
        costPer100k: '$10',
        features: ['Ultra low cost', 'High volume', 'AWS integration'],
        setup: 'Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY to secrets'
      },
      {
        id: 'sendgrid',
        name: 'SendGrid',
        recommended: false,
        costPer100k: '$20-90',
        features: ['Marketing + Transactional', 'Templates', 'Analytics'],
        setup: 'Add SENDGRID_API_KEY to secrets'
      },
      {
        id: 'postmark',
        name: 'Postmark',
        recommended: false,
        costPer100k: '$75',
        features: ['Fastest delivery', 'Transactional focus', 'Great support'],
        setup: 'Add POSTMARK_API_KEY to secrets'
      }
    ],
    sophiaRecommendation: {
      primary: 'resend',
      reason: 'Best balance of modern API, cost, and Sophia integration capabilities',
      forHighVolume: 'ses',
      forTransactional: 'postmark'
    }
  });
});

/**
 * POST /api/sophia-email/analyze-email
 * Analyze an email with Sophia AI for insights, intent, urgency, and suggested actions
 */
router.post('/analyze-email', async (req, res) => {
  try {
    const { subject, from, body, receivedAt } = req.body;
    
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body required' });
    }

    // Use OpenAI to analyze the email
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const analysisPrompt = `Analyze this email and provide insights in JSON format:

From: ${from?.name || 'Unknown'} <${from?.email || 'unknown'}>
Subject: ${subject}
Body: ${body}
Received: ${receivedAt || 'unknown'}

Respond with a JSON object containing:
{
  "intent": "one of: sales_inquiry, support_request, meeting_request, follow_up, newsletter, personal, spam, other",
  "urgency": "one of: high, medium, low",
  "sentiment": "one of: positive, neutral, negative",
  "priorityScore": "number 0-100 indicating priority",
  "summary": "2-3 sentence summary of the email",
  "keyPoints": ["array of 2-4 key points from the email"],
  "suggestedActions": [
    {
      "id": "unique id",
      "type": "one of: reply, schedule_meeting, add_to_crm, follow_up, archive, delegate",
      "label": "short action label",
      "description": "brief description of the action",
      "confidence": "number 0-1 indicating how confident this action is appropriate"
    }
  ],
  "followUpDate": "ISO date string if follow-up is recommended, null otherwise",
  "contactContext": "any relevant context about the sender if detectable"
}

Provide at least 2-3 suggested actions. Be helpful and specific.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are Sophia, an AI email analyst. Analyze emails and provide structured insights. Always respond with valid JSON only.' },
        { role: 'user', content: analysisPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const responseText = completion.choices[0]?.message?.content || '';
    
    // Parse JSON from response
    let insight;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insight = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      // Fallback insight
      insight = {
        intent: 'other',
        urgency: 'medium',
        sentiment: 'neutral',
        priorityScore: 50,
        summary: 'Unable to fully analyze this email.',
        keyPoints: ['Manual review recommended'],
        suggestedActions: [
          { id: '1', type: 'reply', label: 'Generate Reply', description: 'Create an AI-powered response', confidence: 0.8 }
        ]
      };
    }

    // Ensure suggestedActions have proper IDs
    if (insight.suggestedActions) {
      insight.suggestedActions = insight.suggestedActions.map((action: any, index: number) => ({
        ...action,
        id: action.id || `action-${index + 1}`
      }));
    }

    res.json({ 
      insight,
      analyzedAt: new Date().toISOString(),
      model: 'gpt-4o-mini'
    });
  } catch (error: any) {
    console.error('Email analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze email', 
      details: error.message,
      // Return fallback insight even on error
      insight: {
        intent: 'other',
        urgency: 'medium',
        sentiment: 'neutral',
        priorityScore: 50,
        summary: 'Analysis temporarily unavailable.',
        keyPoints: ['Please try again'],
        suggestedActions: [
          { id: '1', type: 'reply', label: 'Generate Reply', description: 'Create an AI-powered response', confidence: 0.8 }
        ]
      }
    });
  }
});

// In-memory action history (in production, this would be in database)
const actionHistory: Array<{
  id: string;
  timestamp: string;
  actionType: 'email_auto_replied' | 'email_drafted' | 'email_analyzed' | 'meeting_auto_booked' | 'follow_up_scheduled';
  emailSubject: string;
  emailFrom: string;
  actionDetails: string;
  outcome: 'success' | 'pending' | 'failed';
  confidence: number;
  autonomyLevel: 'manual' | 'semi' | 'full';
  notified: boolean;
  draftContent?: string;
  meetingDetails?: { title: string; duration: number; suggestedTimes: string[] };
}> = [];

// Pending drafts for approval (in production, this would be in database)
const pendingDrafts: Map<string, {
  emailId: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}> = new Map();

/**
 * POST /api/sophia-email/process-autonomous
 * Process an email autonomously based on analysis and autonomy level
 */
router.post('/process-autonomous', async (req, res) => {
  try {
    const { email, analysis, autonomyLevel, userAccessToken } = req.body;
    
    if (!email || !analysis) {
      return res.status(400).json({ error: 'Email and analysis required' });
    }

    const actionId = `action-${Date.now()}`;
    const actions: Array<any> = [];
    
    // Determine actions based on analysis and autonomy level
    const { intent, urgency, priorityScore, suggestedActions } = analysis;
    
    // Meeting request handling
    if (intent === 'meeting_request' && autonomyLevel !== 'manual') {
      const shouldAutoBook = autonomyLevel === 'full' || 
        (autonomyLevel === 'semi' && priorityScore >= 70);
      
      if (shouldAutoBook) {
        // Auto-book meeting (in production, integrate with Google Calendar)
        const meetingAction = {
          id: `${actionId}-meeting`,
          timestamp: new Date().toISOString(),
          actionType: 'meeting_auto_booked' as const,
          emailSubject: email.subject,
          emailFrom: email.from?.email || 'unknown',
          actionDetails: `Auto-booked meeting based on request. Priority: ${priorityScore}%`,
          outcome: 'success' as const,
          confidence: priorityScore / 100,
          autonomyLevel,
          notified: false
        };
        actionHistory.unshift(meetingAction);
        actions.push({
          type: 'meeting_booked',
          message: 'Sophia automatically scheduled a meeting based on the request',
          details: meetingAction
        });
      } else {
        // Draft meeting response for approval
        actions.push({
          type: 'meeting_suggested',
          message: 'Meeting request detected - ready to schedule when you approve',
          requiresApproval: true
        });
      }
    }
    
    // Generate reply content for semi and full autonomy modes
    if ((autonomyLevel === 'full' && urgency === 'high' && intent !== 'spam') || 
        (autonomyLevel === 'semi' && priorityScore >= 60)) {
      
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const replyPrompt = `Generate a brief, professional email reply to:
Subject: ${email.subject}
From: ${email.from?.name || 'Unknown'}
Content: ${email.preview || email.body || ''}

Keep the reply concise (2-3 sentences), professional, and acknowledge receipt. Don't make specific commitments.`;
      
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional email assistant. Generate brief, helpful replies.' },
          { role: 'user', content: replyPrompt }
        ],
        temperature: 0.5,
        max_tokens: 300,
      });
      
      const generatedReply = completion.choices[0]?.message?.content || '';
      const draftId = `${actionId}-draft`;
      
      // Store the draft for potential approval/sending
      pendingDrafts.set(draftId, {
        emailId: email.id,
        to: email.from?.email || '',
        subject: `Re: ${email.subject}`,
        body: generatedReply,
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
      
      if (autonomyLevel === 'full' && urgency === 'high') {
        // In full autonomy mode, actually send the email if we have an access token
        let sendSuccess = false;
        let sendError = '';
        
        if (userAccessToken) {
          try {
            // Call Office 365 send endpoint via Supabase Edge Function
            const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
            const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
            
            if (supabaseUrl && supabaseKey) {
              const sendResponse = await fetch(`${supabaseUrl}/functions/v1/office365-send-email`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                  'apikey': supabaseKey,
                },
                body: JSON.stringify({
                  accessToken: userAccessToken,
                  to: email.from?.email,
                  subject: `Re: ${email.subject}`,
                  body: generatedReply,
                  bodyType: 'text',
                }),
              });
              
              if (sendResponse.ok) {
                sendSuccess = true;
              } else {
                const errData = await sendResponse.json().catch(() => ({}));
                sendError = errData.error || 'Send failed';
              }
            }
          } catch (err: any) {
            sendError = err.message || 'Send error';
          }
        }
        
        const replyAction = {
          id: draftId,
          timestamp: new Date().toISOString(),
          actionType: 'email_auto_replied' as const,
          emailSubject: email.subject,
          emailFrom: email.from?.email || 'unknown',
          actionDetails: sendSuccess 
            ? `Auto-sent reply to urgent ${intent} email.`
            : `Auto-generated reply for urgent ${intent} email. ${sendError ? `(${sendError})` : 'Ready to send manually.'}`,
          outcome: sendSuccess ? 'success' as const : 'pending' as const,
          confidence: 0.85,
          autonomyLevel,
          notified: false,
          draftContent: generatedReply
        };
        actionHistory.unshift(replyAction);
        
        actions.push({
          type: sendSuccess ? 'auto_replied' : 'auto_reply_ready',
          message: sendSuccess 
            ? 'Sophia automatically sent a reply to this urgent email.'
            : 'Sophia generated an auto-reply for this urgent email. Click to review and send.',
          replyContent: generatedReply,
          draftId,
          to: email.from?.email,
          subject: `Re: ${email.subject}`,
          requiresSend: !sendSuccess,
          sent: sendSuccess,
          details: replyAction
        });
      } else {
        // Semi-autonomous mode - draft for approval
        const draftAction = {
          id: draftId,
          timestamp: new Date().toISOString(),
          actionType: 'email_drafted' as const,
          emailSubject: email.subject,
          emailFrom: email.from?.email || 'unknown',
          actionDetails: `Drafted reply for ${intent} email (priority: ${priorityScore}). Ready for review.`,
          outcome: 'pending' as const,
          confidence: priorityScore / 100,
          autonomyLevel,
          notified: false,
          draftContent: generatedReply
        };
        actionHistory.unshift(draftAction);
        
        actions.push({
          type: 'draft_ready',
          message: 'Sophia drafted a reply for your review',
          replyContent: generatedReply,
          draftId,
          to: email.from?.email,
          subject: `Re: ${email.subject}`,
          requiresApproval: true,
          details: draftAction
        });
      }
    }
    
    // Schedule follow-up if recommended
    if (analysis.followUpDate && autonomyLevel !== 'manual') {
      const followUpAction = {
        id: `${actionId}-followup`,
        timestamp: new Date().toISOString(),
        actionType: 'follow_up_scheduled' as const,
        emailSubject: email.subject,
        emailFrom: email.from?.email || 'unknown',
        actionDetails: `Scheduled follow-up for ${new Date(analysis.followUpDate).toLocaleDateString()}`,
        outcome: 'success' as const,
        confidence: 0.9,
        autonomyLevel,
        notified: false
      };
      actionHistory.unshift(followUpAction);
      
      actions.push({
        type: 'follow_up_scheduled',
        message: `Sophia scheduled a follow-up reminder for ${new Date(analysis.followUpDate).toLocaleDateString()}`,
        details: followUpAction
      });
    }
    
    // Record analysis action
    const analysisAction = {
      id: `${actionId}-analysis`,
      timestamp: new Date().toISOString(),
      actionType: 'email_analyzed' as const,
      emailSubject: email.subject,
      emailFrom: email.from?.email || 'unknown',
      actionDetails: `Analyzed: ${intent} intent, ${urgency} urgency, ${analysis.sentiment} sentiment`,
      outcome: 'success' as const,
      confidence: 0.95,
      autonomyLevel,
      notified: false
    };
    actionHistory.unshift(analysisAction);
    
    // Keep only last 100 actions
    if (actionHistory.length > 100) {
      actionHistory.splice(100);
    }
    
    res.json({
      success: true,
      actionsPerformed: actions,
      summary: `Sophia processed email with ${autonomyLevel} autonomy. ${actions.length} action(s) taken.`,
      actionId
    });
  } catch (error: any) {
    console.error('Autonomous processing error:', error);
    res.status(500).json({ error: 'Failed to process email autonomously', details: error.message });
  }
});

/**
 * GET /api/sophia-email/action-history
 * Get Sophia's action history
 */
router.get('/action-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const unnotifiedOnly = req.query.unnotified === 'true';
    
    let history = [...actionHistory];
    
    if (unnotifiedOnly) {
      history = history.filter(a => !a.notified);
    }
    
    res.json({
      actions: history.slice(0, limit),
      total: actionHistory.length,
      unnotifiedCount: actionHistory.filter(a => !a.notified).length
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get action history', details: error.message });
  }
});

/**
 * POST /api/sophia-email/mark-notified
 * Mark actions as notified
 */
router.post('/mark-notified', async (req, res) => {
  try {
    const { actionIds } = req.body;
    
    if (!actionIds || !Array.isArray(actionIds)) {
      return res.status(400).json({ error: 'actionIds array required' });
    }
    
    let markedCount = 0;
    for (const action of actionHistory) {
      if (actionIds.includes(action.id)) {
        action.notified = true;
        markedCount++;
      }
    }
    
    res.json({ success: true, markedCount });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to mark as notified', details: error.message });
  }
});

/**
 * POST /api/sophia-email/book-meeting
 * Book a meeting from an email
 */
router.post('/book-meeting', async (req, res) => {
  try {
    const { email, suggestedTimes, duration, title } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email context required' });
    }
    
    // In production, this would integrate with Google Calendar API
    const meetingId = `meeting-${Date.now()}`;
    
    // Record the booking action
    const bookingAction = {
      id: meetingId,
      timestamp: new Date().toISOString(),
      actionType: 'meeting_auto_booked' as const,
      emailSubject: email.subject || 'Meeting',
      emailFrom: email.from?.email || 'unknown',
      actionDetails: `Booked meeting: "${title || 'Follow-up Meeting'}" for ${duration || 30} minutes`,
      outcome: 'success' as const,
      confidence: 0.9,
      autonomyLevel: 'semi' as const,
      notified: false
    };
    actionHistory.unshift(bookingAction);
    
    res.json({
      success: true,
      meetingId,
      message: `Meeting "${title || 'Follow-up Meeting'}" scheduled successfully`,
      details: {
        title: title || 'Follow-up Meeting',
        duration: duration || 30,
        with: email.from?.email,
        suggestedTimes: suggestedTimes || ['Next available slot']
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to book meeting', details: error.message });
  }
});

/**
 * GET /api/sophia-email/pending-drafts
 * Get pending drafts for approval
 */
router.get('/pending-drafts', async (req, res) => {
  try {
    const drafts = Array.from(pendingDrafts.entries())
      .filter(([_, draft]) => draft.status === 'pending')
      .map(([id, draft]) => ({
        id,
        ...draft
      }));
    
    res.json({ drafts, count: drafts.length });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get pending drafts', details: error.message });
  }
});

/**
 * POST /api/sophia-email/approve-draft
 * Approve a draft (marks it as approved, frontend handles actual sending)
 */
router.post('/approve-draft/:draftId', async (req, res) => {
  try {
    const { draftId } = req.params;
    const draft = pendingDrafts.get(draftId);
    
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    draft.status = 'approved';
    pendingDrafts.set(draftId, draft);
    
    // Update action history
    const action = actionHistory.find(a => a.id === draftId);
    if (action) {
      action.outcome = 'success';
      action.actionDetails = action.actionDetails.replace('Ready for review', 'Approved and sent');
    }
    
    res.json({
      success: true,
      draft: { id: draftId, ...draft },
      message: 'Draft approved - ready to send'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to approve draft', details: error.message });
  }
});

/**
 * POST /api/sophia-email/reject-draft
 * Reject a draft
 */
router.post('/reject-draft/:draftId', async (req, res) => {
  try {
    const { draftId } = req.params;
    const draft = pendingDrafts.get(draftId);
    
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    draft.status = 'rejected';
    pendingDrafts.set(draftId, draft);
    
    // Update action history
    const action = actionHistory.find(a => a.id === draftId);
    if (action) {
      action.outcome = 'failed';
      action.actionDetails = action.actionDetails.replace('Ready for review', 'Rejected by user');
    }
    
    res.json({
      success: true,
      message: 'Draft rejected'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to reject draft', details: error.message });
  }
});

// ============================================
// EMAIL INTELLIGENCE ROUTES
// ============================================

/**
 * POST /api/sophia-email/intelligence/context-reply
 * Generate a context-aware reply using sender profile, thread history, and user preferences
 */
router.post('/intelligence/context-reply', async (req, res) => {
  try {
    const { email, userId, workspaceId } = req.body;
    
    if (!email || !email.id || !email.body) {
      return res.status(400).json({ error: 'Email with id and body required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId, workspaceId };
    const result = await sophiaEmailIntelligence.generateContextAwareReply(ctx, email);

    res.json({
      success: true,
      reply: result.reply,
      suggestions: result.suggestions,
      context: {
        thread: {
          id: result.context.thread.id,
          subject: result.context.thread.subject,
          messageCount: result.context.thread.message_count,
          status: result.context.thread.status,
          intent: result.context.thread.current_intent,
          sentimentTrend: result.context.thread.sentiment_trend,
          isNegotiation: result.context.thread.is_negotiation,
          negotiationStage: result.context.thread.negotiation_stage,
        },
        sender: {
          email: result.context.senderProfile.email_address,
          name: result.context.senderProfile.display_name,
          relationshipStrength: result.context.senderProfile.relationship_strength,
          communicationStyle: result.context.senderProfile.preferred_communication_style,
          isVip: result.context.senderProfile.is_vip,
          emailsReceived: result.context.senderProfile.emails_received,
          emailsSent: result.context.senderProfile.emails_sent,
          keyTopics: result.context.senderProfile.key_topics,
        },
        insights: result.context.relatedInsights.map(i => ({
          id: i.id,
          type: i.insight_type,
          title: i.title,
          severity: i.severity,
        })),
        activeFollowUps: result.context.activeFollowUps.length,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate context reply', details: error.message });
  }
});

/**
 * GET /api/sophia-email/intelligence/insights
 * Get proactive insights (stale threads, frustrated customers, opportunities, etc.)
 */
router.get('/intelligence/insights', async (req, res) => {
  try {
    const { userId, workspaceId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId: userId as string, workspaceId: workspaceId as string };

    // Generate new insights based on current data
    await sophiaEmailIntelligence.generateInsights(ctx);
    
    // Get active insights
    const insights = sophiaEmailIntelligence.getActiveInsights(ctx);

    res.json({
      success: true,
      insights: insights.map(i => ({
        id: i.id,
        type: i.insight_type,
        title: i.title,
        description: i.description,
        severity: i.severity,
        senderEmail: i.sender_email,
        threadId: i.thread_id,
        suggestedAction: i.suggested_action,
        actionType: i.action_type,
        status: i.status,
        createdAt: i.created_at,
      })),
      summary: {
        total: insights.length,
        urgent: insights.filter(i => i.severity === 'urgent').length,
        warnings: insights.filter(i => i.severity === 'warning').length,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get insights', details: error.message });
  }
});

/**
 * POST /api/sophia-email/intelligence/insights/:id/action
 * Mark an insight as actioned or dismissed
 */
router.post('/intelligence/insights/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, userId, workspaceId } = req.body; // 'actioned' or 'dismissed'

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId, workspaceId };

    if (action === 'actioned') {
      await sophiaEmailIntelligence.actionInsight(ctx, id);
    } else if (action === 'dismissed') {
      await sophiaEmailIntelligence.dismissInsight(ctx, id);
    } else {
      return res.status(400).json({ error: 'Action must be "actioned" or "dismissed"' });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update insight', details: error.message });
  }
});

/**
 * POST /api/sophia-email/intelligence/follow-up
 * Schedule a follow-up reminder
 */
router.post('/intelligence/follow-up', async (req, res) => {
  try {
    const { emailId, threadId, contactId, reminderType, dueAt, autoSend, suggestedMessage, userId, workspaceId } = req.body;

    if (!emailId || !reminderType || !dueAt) {
      return res.status(400).json({ error: 'emailId, reminderType, and dueAt required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId, workspaceId };

    const followUp = await sophiaEmailIntelligence.scheduleFollowUp(ctx, {
      emailId,
      threadId,
      contactId,
      reminderType,
      dueAt: new Date(dueAt),
      autoSend: autoSend || false,
      suggestedMessage,
    });

    res.json({
      success: true,
      followUp: {
        id: followUp.id,
        emailId: followUp.email_id,
        reminderType: followUp.reminder_type,
        dueAt: followUp.due_at,
        status: followUp.status,
        autoSend: followUp.auto_send,
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to schedule follow-up', details: error.message });
  }
});

/**
 * GET /api/sophia-email/intelligence/follow-ups
 * Get pending and overdue follow-ups
 */
router.get('/intelligence/follow-ups', async (req, res) => {
  try {
    const { userId, workspaceId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId: userId as string, workspaceId: workspaceId as string };
    const overdue = await sophiaEmailIntelligence.getOverdueFollowUps(ctx);

    res.json({
      success: true,
      overdue: overdue.map(f => ({
        id: f.id,
        emailId: f.email_id,
        threadId: f.thread_id,
        reminderType: f.reminder_type,
        dueAt: f.due_at,
        escalationLevel: f.escalation_level,
        suggestedMessage: f.suggested_message,
      })),
      overdueCount: overdue.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get follow-ups', details: error.message });
  }
});

/**
 * POST /api/sophia-email/intelligence/follow-up/:id/snooze
 * Snooze a follow-up
 */
router.post('/intelligence/follow-up/:id/snooze', async (req, res) => {
  try {
    const { id } = req.params;
    const { until, userId, workspaceId } = req.body;

    if (!until) {
      return res.status(400).json({ error: 'Snooze until date required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId, workspaceId };
    await sophiaEmailIntelligence.snoozeFollowUp(ctx, id, new Date(until));

    res.json({ success: true, message: `Follow-up snoozed until ${until}` });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to snooze follow-up', details: error.message });
  }
});

/**
 * POST /api/sophia-email/intelligence/follow-up/:id/complete
 * Mark a follow-up as completed
 */
router.post('/intelligence/follow-up/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, workspaceId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId, workspaceId };
    await sophiaEmailIntelligence.completeFollowUp(ctx, id);

    res.json({ success: true, message: 'Follow-up completed' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to complete follow-up', details: error.message });
  }
});

/**
 * POST /api/sophia-email/intelligence/feedback
 * Record draft feedback for learning
 */
router.post('/intelligence/feedback', async (req, res) => {
  try {
    const { originalDraft, finalVersion, feedbackType, recipientEmail, emailType, userId, workspaceId } = req.body;

    if (!originalDraft || !finalVersion || !feedbackType) {
      return res.status(400).json({ error: 'originalDraft, finalVersion, and feedbackType required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId, workspaceId };

    await sophiaEmailIntelligence.recordDraftFeedback(ctx, {
      originalDraft,
      finalVersion,
      feedbackType,
      recipientEmail,
      emailType,
    });

    res.json({
      success: true,
      message: `Feedback recorded: ${feedbackType}. Sophia is learning from your preferences.`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to record feedback', details: error.message });
  }
});

/**
 * GET /api/sophia-email/intelligence/preferences
 * Get learned user email preferences
 */
router.get('/intelligence/preferences', async (req, res) => {
  try {
    const { userId, workspaceId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId: userId as string, workspaceId: workspaceId as string };
    const prefs = sophiaEmailIntelligence.getUserPreferences(ctx);

    res.json({
      success: true,
      preferences: prefs ? {
        preferredTone: prefs.preferred_tone,
        preferredLength: prefs.preferred_length,
        preferredGreetingStyle: prefs.preferred_greeting_style,
        preferredClosingStyle: prefs.preferred_closing_style,
        signature: prefs.signature,
        workingHoursStart: prefs.working_hours_start,
        workingHoursEnd: prefs.working_hours_end,
        workingDays: prefs.working_days,
        timezone: prefs.timezone,
        defaultFollowUpDays: prefs.default_follow_up_days,
        maxFollowUps: prefs.max_follow_ups,
        brandVoiceDescription: prefs.brand_voice_description,
        avoidWords: prefs.avoid_words,
        preferredPhrases: prefs.preferred_phrases,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get preferences', details: error.message });
  }
});

/**
 * PUT /api/sophia-email/intelligence/preferences
 * Update user email preferences
 */
router.put('/intelligence/preferences', async (req, res) => {
  try {
    const { preferences, userId, workspaceId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // In a real implementation, this would update the database
    res.json({
      success: true,
      message: 'Preferences updated'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update preferences', details: error.message });
  }
});

/**
 * POST /api/sophia-email/intelligence/sender/:email/vip
 * Mark a sender as VIP
 */
router.post('/intelligence/sender/:email/vip', async (req, res) => {
  try {
    const { email } = req.params;
    const { isVip, priorityLevel, userId, workspaceId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId, workspaceId };
    await sophiaEmailIntelligence.updateSenderProfile(ctx, email, {
      is_vip: isVip !== undefined ? isVip : true,
      priority_level: priorityLevel || 'high',
    });

    res.json({
      success: true,
      message: `${email} marked as ${isVip ? 'VIP' : 'normal priority'}`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update sender VIP status', details: error.message });
  }
});

/**
 * GET /api/sophia-email/intelligence/stats
 * Get email intelligence statistics
 */
router.get('/intelligence/stats', async (req, res) => {
  try {
    const { userId, workspaceId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const ctx = { userId: userId as string, workspaceId: workspaceId as string };
    const stats = sophiaEmailIntelligence.getStats(ctx);

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

export default router;
