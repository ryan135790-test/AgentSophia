import { Router } from 'express';
import {
  setWorkspaceApiKey,
  getWorkspaceApiKeysMasked,
  removeWorkspaceApiKey,
  hasWorkspaceApiKey,
  testWorkspaceApiKey,
  getWorkspaceProviderStatus,
  getWorkspaceUsage,
  getWorkspaceUsageHistory,
  getWorkspaceResendClient,
  getWorkspaceOpenAIClient,
  recordAIUsage,
  recordEmailUsage,
  PROVIDER_PRICING,
  WorkspaceApiKeys
} from './lib/workspace-api-keys';

const router = Router();

/**
 * GET /api/workspace/:workspaceId/api-keys
 * Get all configured API keys (masked) for a workspace
 */
router.get('/:workspaceId/api-keys', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const keys = await getWorkspaceApiKeysMasked(workspaceId);
    const status = await getWorkspaceProviderStatus(workspaceId);

    res.json({
      keys,
      status,
      message: status.ai.configured && status.email.configured 
        ? 'All providers configured'
        : `Missing: ${!status.ai.configured ? 'AI provider' : ''}${!status.ai.configured && !status.email.configured ? ', ' : ''}${!status.email.configured ? 'Email provider' : ''}`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get API keys', details: error.message });
  }
});

/**
 * POST /api/workspace/:workspaceId/api-keys
 * Set an API key for a workspace
 */
router.post('/:workspaceId/api-keys', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { provider, value } = req.body;

    if (!provider || !value) {
      return res.status(400).json({ error: 'Provider and value are required' });
    }

    const validProviders: (keyof WorkspaceApiKeys)[] = [
      'openai_api_key', 'anthropic_api_key',
      'resend_api_key', 'sendgrid_api_key', 'ses_access_key', 'ses_secret_key', 'ses_region',
      'postmark_api_key', 'primary_ai_provider', 'primary_email_provider'
    ];

    if (!validProviders.includes(provider)) {
      return res.status(400).json({ 
        error: 'Invalid provider',
        validProviders 
      });
    }

    const result = await setWorkspaceApiKey(workspaceId, provider, value);

    res.json({
      success: result.success,
      provider,
      masked: result.masked,
      message: `${provider} has been configured for this workspace`
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to set API key', details: error.message });
  }
});

/**
 * DELETE /api/workspace/:workspaceId/api-keys/:provider
 * Remove an API key from a workspace
 */
router.delete('/:workspaceId/api-keys/:provider', async (req, res) => {
  try {
    const { workspaceId, provider } = req.params;

    const success = await removeWorkspaceApiKey(workspaceId, provider as keyof WorkspaceApiKeys);

    res.json({
      success,
      message: success ? `${provider} removed from workspace` : 'Key not found'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to remove API key', details: error.message });
  }
});

/**
 * POST /api/workspace/:workspaceId/api-keys/:provider/test
 * Test if an API key is valid
 */
router.post('/:workspaceId/api-keys/:provider/test', async (req, res) => {
  try {
    const { workspaceId, provider } = req.params;

    const result = await testWorkspaceApiKey(
      workspaceId, 
      provider as 'openai' | 'resend' | 'sendgrid' | 'ses' | 'postmark'
    );

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to test API key', details: error.message });
  }
});

/**
 * GET /api/workspace/:workspaceId/usage
 * Get current month usage for a workspace
 */
router.get('/:workspaceId/usage', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { period } = req.query;

    const usage = await getWorkspaceUsage(workspaceId, period as string | undefined);

    res.json({
      usage,
      formatted: {
        ai: `${usage.ai_requests.toLocaleString()} requests, ${(usage.ai_tokens_used / 1000).toFixed(1)}K tokens`,
        email: `${usage.emails_sent.toLocaleString()} sent, ${usage.emails_delivered.toLocaleString()} delivered`,
        cost: `$${usage.total_cost_estimate.toFixed(2)} estimated`
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get usage', details: error.message });
  }
});

/**
 * GET /api/workspace/:workspaceId/usage/history
 * Get usage history for a workspace
 */
router.get('/:workspaceId/usage/history', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { months } = req.query;

    const history = await getWorkspaceUsageHistory(workspaceId, parseInt(months as string) || 6);

    const totalCost = history.reduce((sum, h) => sum + h.total_cost_estimate, 0);
    const totalEmails = history.reduce((sum, h) => sum + h.emails_sent, 0);
    const totalAI = history.reduce((sum, h) => sum + h.ai_requests, 0);

    res.json({
      history,
      summary: {
        totalCost: `$${totalCost.toFixed(2)}`,
        totalEmails: totalEmails.toLocaleString(),
        totalAIRequests: totalAI.toLocaleString()
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get usage history', details: error.message });
  }
});

/**
 * GET /api/workspace/:workspaceId/providers/status
 * Get provider configuration status
 */
router.get('/:workspaceId/providers/status', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const status = await getWorkspaceProviderStatus(workspaceId);

    const recommendations: string[] = [];
    
    if (!status.ai.configured) {
      recommendations.push('Add your OpenAI or Anthropic API key to enable AI features');
    } else if (status.ai.fallback) {
      recommendations.push('Consider adding your own OpenAI API key for better cost control');
    }
    
    if (!status.email.configured) {
      recommendations.push('Add Resend API key to enable email sending (recommended)');
    }

    res.json({
      ...status,
      recommendations,
      ready: status.ai.configured && status.email.configured
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

/**
 * GET /api/workspace/pricing
 * Get pricing information for all providers
 */
router.get('/pricing', async (req, res) => {
  res.json(PROVIDER_PRICING);
});

/**
 * POST /api/workspace/:workspaceId/send-email
 * Send email using workspace's configured email provider
 */
router.post('/:workspaceId/send-email', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { from, to, subject, html, text } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'to and subject are required' });
    }

    const client = await getWorkspaceResendClient(workspaceId);
    if (!client) {
      return res.status(400).json({ 
        error: 'No email provider configured',
        setup: 'Add RESEND_API_KEY via POST /api/workspace/:workspaceId/api-keys'
      });
    }

    const result = await client.send({
      from: from || 'noreply@example.com',
      to,
      subject,
      html,
      text
    });

    res.json({
      success: result.success,
      emailId: result.id,
      error: result.error
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

/**
 * POST /api/workspace/:workspaceId/ai-complete
 * Use workspace's AI provider for completion
 */
router.post('/:workspaceId/ai-complete', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { messages, model, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const client = await getWorkspaceOpenAIClient(workspaceId);
    if (!client) {
      return res.status(400).json({ 
        error: 'No AI provider configured',
        setup: 'Add OPENAI_API_KEY via POST /api/workspace/:workspaceId/api-keys'
      });
    }

    const response = await client.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages,
      max_tokens: max_tokens || 1000
    });

    // Track usage
    const tokensUsed = response.usage?.total_tokens || 0;
    await recordAIUsage(workspaceId, tokensUsed);

    res.json({
      success: true,
      content: response.choices[0].message.content,
      usage: {
        tokens: tokensUsed,
        estimatedCost: `$${((tokensUsed / 1_000_000) * 5).toFixed(4)}`
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'AI completion failed', details: error.message });
  }
});

/**
 * GET /api/workspace/:workspaceId/setup-guide
 * Get setup guide for workspace API keys
 */
router.get('/:workspaceId/setup-guide', async (req, res) => {
  const { workspaceId } = req.params;
  const status = await getWorkspaceProviderStatus(workspaceId);

  res.json({
    currentStatus: status,
    steps: [
      {
        step: 1,
        title: 'Configure AI Provider',
        done: status.ai.configured && !status.ai.fallback,
        usingFallback: status.ai.fallback,
        options: [
          {
            provider: 'openai',
            name: 'OpenAI',
            recommended: true,
            signupUrl: 'https://platform.openai.com/api-keys',
            envVar: 'openai_api_key',
            pricing: 'GPT-4o: $2.50-$10/1M tokens'
          },
          {
            provider: 'anthropic',
            name: 'Anthropic Claude',
            recommended: false,
            signupUrl: 'https://console.anthropic.com/',
            envVar: 'anthropic_api_key',
            pricing: 'Claude Sonnet: $3-$15/1M tokens'
          }
        ]
      },
      {
        step: 2,
        title: 'Configure Email Provider',
        done: status.email.configured,
        options: [
          {
            provider: 'resend',
            name: 'Resend',
            recommended: true,
            signupUrl: 'https://resend.com/api-keys',
            envVar: 'resend_api_key',
            pricing: '$20/mo for 50K emails'
          },
          {
            provider: 'sendgrid',
            name: 'SendGrid',
            recommended: false,
            signupUrl: 'https://app.sendgrid.com/settings/api_keys',
            envVar: 'sendgrid_api_key',
            pricing: 'Free 100/day, then $20+/mo'
          },
          {
            provider: 'ses',
            name: 'Amazon SES',
            recommended: false,
            signupUrl: 'https://console.aws.amazon.com/ses/',
            envVars: ['ses_access_key', 'ses_secret_key', 'ses_region'],
            pricing: '$0.10/1000 emails (cheapest)'
          }
        ]
      }
    ],
    apiEndpoint: `/api/workspace/${workspaceId}/api-keys`,
    example: {
      method: 'POST',
      body: {
        provider: 'resend_api_key',
        value: 're_xxxx...'
      }
    }
  });
});

export default router;
