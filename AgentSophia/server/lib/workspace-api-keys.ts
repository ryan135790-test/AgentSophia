// ============================================
// WORKSPACE API KEY MANAGEMENT
// Each workspace manages their own API keys for AI and Email
// Keys are stored encrypted in database (workspace_api_credentials table)
// Usage is tracked per workspace for billing
// ============================================

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { Pool } from 'pg';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Use a fixed key derived from environment or generate one
const ENCRYPTION_KEY = process.env.API_KEY_ENCRYPTION_SECRET || 
  createHash('sha256').update('workspace-api-keys-default-key').digest();
const IV_LENGTH = 16;

// Encrypt sensitive API keys before storage
function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

// Decrypt API keys when needed
function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

// Mask API key for display
function maskApiKey(key: string): string {
  if (!key || key.length < 12) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

// Workspace API Key Types
export interface WorkspaceApiKeys {
  // AI Providers
  openai_api_key?: string;
  anthropic_api_key?: string;
  
  // Email Providers
  resend_api_key?: string;
  sendgrid_api_key?: string;
  ses_access_key?: string;
  ses_secret_key?: string;
  ses_region?: string;
  postmark_api_key?: string;
  
  // WhatsApp (Meta Business API)
  whatsapp_access_token?: string;
  whatsapp_phone_number_id?: string;
  whatsapp_business_account_id?: string;
  whatsapp_verify_token?: string;
  
  // Primary selections
  primary_ai_provider?: 'openai' | 'anthropic' | 'platform';
  primary_email_provider?: 'resend' | 'sendgrid' | 'ses' | 'postmark';
}

export interface WorkspaceUsage {
  workspaceId: string;
  period: string; // YYYY-MM format
  
  // AI Usage
  ai_requests: number;
  ai_tokens_used: number;
  ai_cost_estimate: number;
  
  // Email Usage
  emails_sent: number;
  emails_delivered: number;
  emails_bounced: number;
  email_cost_estimate: number;
  
  // Totals
  total_cost_estimate: number;
}

// In-memory cache for faster access (synced with database)
const keyCache: Map<string, WorkspaceApiKeys> = new Map();
const usageCache: Map<string, WorkspaceUsage> = new Map();

// Helper to map provider names
const PROVIDER_MAP: Record<string, string> = {
  'openai_api_key': 'openai',
  'anthropic_api_key': 'anthropic',
  'resend_api_key': 'resend',
  'sendgrid_api_key': 'sendgrid',
  'ses_access_key': 'ses',
  'ses_secret_key': 'ses',
  'postmark_api_key': 'postmark'
};

// ============================================
// API KEY MANAGEMENT (Database-backed with cache)
// ============================================

export async function setWorkspaceApiKey(
  workspaceId: string,
  provider: keyof WorkspaceApiKeys,
  value: string
): Promise<{ success: boolean; masked: string }> {
  try {
    const dbProvider = PROVIDER_MAP[provider] || provider;
    const encryptedValue = provider.includes('key') || provider.includes('secret') 
      ? encrypt(value) 
      : value;
    const maskedValue = provider.includes('key') || provider.includes('secret') 
      ? maskApiKey(value) 
      : value;

    // Upsert to database
    await pool.query(`
      INSERT INTO workspace_api_credentials (id, workspace_id, provider, encrypted_key, key_masked, is_active, test_status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, true, 'untested', NOW(), NOW())
      ON CONFLICT (workspace_id, provider) 
      DO UPDATE SET encrypted_key = $3, key_masked = $4, is_active = true, updated_at = NOW()
    `, [workspaceId, dbProvider, encryptedValue, maskedValue]);

    // Update cache
    const existing = keyCache.get(workspaceId) || {} as WorkspaceApiKeys;
    (existing as any)[provider] = encryptedValue;
    keyCache.set(workspaceId, existing);

    return { success: true, masked: maskedValue };
  } catch (error: any) {
    // Fallback to in-memory if DB fails
    console.warn('DB write failed, using in-memory:', error.message);
    const existing = keyCache.get(workspaceId) || {} as WorkspaceApiKeys;
    const encryptedValue = provider.includes('key') || provider.includes('secret') 
      ? encrypt(value) 
      : value;
    (existing as any)[provider] = encryptedValue;
    keyCache.set(workspaceId, existing);
    
    return {
      success: true,
      masked: provider.includes('key') || provider.includes('secret') ? maskApiKey(value) : value
    };
  }
}

export async function getWorkspaceApiKey(
  workspaceId: string,
  provider: keyof WorkspaceApiKeys
): Promise<string | undefined> {
  // Check cache first
  const cached = keyCache.get(workspaceId);
  if (cached && cached[provider]) {
    const value = cached[provider] as string;
    if (provider.includes('key') || provider.includes('secret')) {
      return decrypt(value);
    }
    return value;
  }

  // Load from database
  try {
    const dbProvider = PROVIDER_MAP[provider] || provider;
    const result = await pool.query<{ encrypted_key: string }>(
      'SELECT encrypted_key FROM workspace_api_credentials WHERE workspace_id = $1 AND provider = $2 AND is_active = true',
      [workspaceId, dbProvider]
    );
    
    if (result.rows.length > 0) {
      const encryptedKey = result.rows[0].encrypted_key;
      
      // Update cache
      const existing = keyCache.get(workspaceId) || {} as WorkspaceApiKeys;
      (existing as any)[provider] = encryptedKey;
      keyCache.set(workspaceId, existing);
      
      if (provider.includes('key') || provider.includes('secret')) {
        return decrypt(encryptedKey);
      }
      return encryptedKey;
    }
  } catch (error: any) {
    console.warn('DB read failed:', error.message);
  }

  return undefined;
}

export async function getWorkspaceApiKeysMasked(workspaceId: string): Promise<Record<string, string | undefined>> {
  try {
    const result = await pool.query<{ provider: string; key_masked: string }>(
      'SELECT provider, key_masked FROM workspace_api_credentials WHERE workspace_id = $1 AND is_active = true',
      [workspaceId]
    );

    const keys: Record<string, string | undefined> = {};
    for (const row of result.rows) {
      keys[`${row.provider}_api_key`] = row.key_masked;
    }
    return keys;
  } catch (error: any) {
    // Fallback to cache
    const cached = keyCache.get(workspaceId) || {};
    return {
      openai_api_key: cached.openai_api_key ? maskApiKey(decrypt(cached.openai_api_key)) : undefined,
      anthropic_api_key: cached.anthropic_api_key ? maskApiKey(decrypt(cached.anthropic_api_key)) : undefined,
      resend_api_key: cached.resend_api_key ? maskApiKey(decrypt(cached.resend_api_key)) : undefined,
      sendgrid_api_key: cached.sendgrid_api_key ? maskApiKey(decrypt(cached.sendgrid_api_key)) : undefined,
      postmark_api_key: cached.postmark_api_key ? maskApiKey(decrypt(cached.postmark_api_key)) : undefined,
    };
  }
}

export async function removeWorkspaceApiKey(
  workspaceId: string,
  provider: keyof WorkspaceApiKeys
): Promise<boolean> {
  try {
    const dbProvider = PROVIDER_MAP[provider] || provider;
    await pool.query(
      'UPDATE workspace_api_credentials SET is_active = false, updated_at = NOW() WHERE workspace_id = $1 AND provider = $2',
      [workspaceId, dbProvider]
    );
    
    // Update cache
    const cached = keyCache.get(workspaceId);
    if (cached) {
      delete (cached as any)[provider];
    }
    
    return true;
  } catch (error: any) {
    console.warn('DB delete failed:', error.message);
    const cached = keyCache.get(workspaceId);
    if (cached) {
      delete (cached as any)[provider];
      return true;
    }
    return false;
  }
}

export async function hasWorkspaceApiKey(workspaceId: string, provider: keyof WorkspaceApiKeys): Promise<boolean> {
  const key = await getWorkspaceApiKey(workspaceId, provider);
  return !!key;
}

// ============================================
// PROVIDER CLIENTS
// ============================================

export async function getWorkspaceOpenAIClient(workspaceId: string) {
  const apiKey = await getWorkspaceApiKey(workspaceId, 'openai_api_key');
  if (!apiKey) return null;
  
  const OpenAI = require('openai').default;
  return new OpenAI({ apiKey });
}

export async function getWorkspaceResendClient(workspaceId: string) {
  const apiKey = await getWorkspaceApiKey(workspaceId, 'resend_api_key');
  if (!apiKey) return null;
  
  return {
    apiKey,
    send: async (email: {
      from: string;
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
    }) => {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          from: email.from,
          to: Array.isArray(email.to) ? email.to : [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text
        })
      });
      
      const data = await response.json();
      
      // Track usage
      await recordEmailUsage(workspaceId, 1, response.ok ? 1 : 0, response.ok ? 0 : 1);
      
      return { success: response.ok, id: data.id, error: data.message };
    }
  };
}

// ============================================
// USAGE TRACKING
// ============================================

function getUsageKey(workspaceId: string): string {
  const now = new Date();
  return `${workspaceId}:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function recordAIUsage(workspaceId: string, tokensUsed: number) {
  const key = getUsageKey(workspaceId);
  const existing = usageCache.get(key) || createEmptyUsage(workspaceId);
  
  existing.ai_requests++;
  existing.ai_tokens_used += tokensUsed;
  // OpenAI GPT-4o pricing: ~$2.50/1M input, $10/1M output - estimate avg $5/1M
  existing.ai_cost_estimate += (tokensUsed / 1_000_000) * 5;
  existing.total_cost_estimate = existing.ai_cost_estimate + existing.email_cost_estimate;
  
  usageCache.set(key, existing);
  
  // Persist to database
  try {
    await pool.query(`
      INSERT INTO workspace_usage (id, workspace_id, period, ai_requests, ai_tokens_used, ai_cost_estimate, 
        emails_sent, emails_delivered, emails_bounced, email_cost_estimate, total_cost_estimate, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (workspace_id, period)
      DO UPDATE SET ai_requests = $3, ai_tokens_used = $4, ai_cost_estimate = $5, 
        total_cost_estimate = $10, updated_at = NOW()
    `, [workspaceId, existing.period, existing.ai_requests, existing.ai_tokens_used, existing.ai_cost_estimate,
        existing.emails_sent, existing.emails_delivered, existing.emails_bounced, existing.email_cost_estimate, 
        existing.total_cost_estimate]);
  } catch (error: any) {
    console.warn('Usage DB write failed:', error.message);
  }
}

export async function recordEmailUsage(workspaceId: string, sent: number, delivered: number, bounced: number) {
  const key = getUsageKey(workspaceId);
  const existing = usageCache.get(key) || createEmptyUsage(workspaceId);
  
  existing.emails_sent += sent;
  existing.emails_delivered += delivered;
  existing.emails_bounced += bounced;
  // Resend pricing: ~$0.40 per 1000 emails
  existing.email_cost_estimate += (sent / 1000) * 0.40;
  existing.total_cost_estimate = existing.ai_cost_estimate + existing.email_cost_estimate;
  
  usageCache.set(key, existing);
  
  // Persist to database
  try {
    await pool.query(`
      INSERT INTO workspace_usage (id, workspace_id, period, ai_requests, ai_tokens_used, ai_cost_estimate, 
        emails_sent, emails_delivered, emails_bounced, email_cost_estimate, total_cost_estimate, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (workspace_id, period)
      DO UPDATE SET emails_sent = $6, emails_delivered = $7, emails_bounced = $8, 
        email_cost_estimate = $9, total_cost_estimate = $10, updated_at = NOW()
    `, [workspaceId, existing.period, existing.ai_requests, existing.ai_tokens_used, existing.ai_cost_estimate,
        existing.emails_sent, existing.emails_delivered, existing.emails_bounced, existing.email_cost_estimate, 
        existing.total_cost_estimate]);
  } catch (error: any) {
    console.warn('Usage DB write failed:', error.message);
  }
}

function createEmptyUsage(workspaceId: string): WorkspaceUsage {
  const now = new Date();
  return {
    workspaceId,
    period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    ai_requests: 0,
    ai_tokens_used: 0,
    ai_cost_estimate: 0,
    emails_sent: 0,
    emails_delivered: 0,
    emails_bounced: 0,
    email_cost_estimate: 0,
    total_cost_estimate: 0
  };
}

export async function getWorkspaceUsage(workspaceId: string, period?: string): Promise<WorkspaceUsage> {
  const key = period ? `${workspaceId}:${period}` : getUsageKey(workspaceId);
  
  // Check cache first
  if (usageCache.has(key)) {
    return usageCache.get(key)!;
  }
  
  // Try to load from database
  try {
    const targetPeriod = period || getUsageKey(workspaceId).split(':')[1];
    const result = await pool.query<any>(
      'SELECT * FROM workspace_usage WHERE workspace_id = $1 AND period = $2',
      [workspaceId, targetPeriod]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      const usage: WorkspaceUsage = {
        workspaceId: row.workspace_id,
        period: row.period,
        ai_requests: row.ai_requests,
        ai_tokens_used: row.ai_tokens_used,
        ai_cost_estimate: row.ai_cost_estimate,
        emails_sent: row.emails_sent,
        emails_delivered: row.emails_delivered,
        emails_bounced: row.emails_bounced,
        email_cost_estimate: row.email_cost_estimate,
        total_cost_estimate: row.total_cost_estimate
      };
      usageCache.set(key, usage);
      return usage;
    }
  } catch (error: any) {
    console.warn('Usage DB read failed:', error.message);
  }
  
  return createEmptyUsage(workspaceId);
}

export async function getWorkspaceUsageHistory(workspaceId: string, months: number = 6): Promise<WorkspaceUsage[]> {
  const history: WorkspaceUsage[] = [];
  const now = new Date();
  
  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const key = `${workspaceId}:${period}`;
    const usage = usageCache.get(key) || { ...createEmptyUsage(workspaceId), period };
    history.push(usage);
  }
  
  return history;
}

// ============================================
// VALIDATION & TESTING
// ============================================

export async function testWorkspaceApiKey(
  workspaceId: string,
  provider: 'openai' | 'resend' | 'sendgrid' | 'ses' | 'postmark'
): Promise<{ valid: boolean; message: string }> {
  try {
    switch (provider) {
      case 'openai': {
        const apiKey = getWorkspaceApiKey(workspaceId, 'openai_api_key');
        if (!apiKey) return { valid: false, message: 'No OpenAI API key configured' };
        
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return response.ok 
          ? { valid: true, message: 'OpenAI API key is valid' }
          : { valid: false, message: 'Invalid OpenAI API key' };
      }
      
      case 'resend': {
        const apiKey = getWorkspaceApiKey(workspaceId, 'resend_api_key');
        if (!apiKey) return { valid: false, message: 'No Resend API key configured' };
        
        const response = await fetch('https://api.resend.com/domains', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return response.ok 
          ? { valid: true, message: 'Resend API key is valid' }
          : { valid: false, message: 'Invalid Resend API key' };
      }
      
      case 'sendgrid': {
        const apiKey = getWorkspaceApiKey(workspaceId, 'sendgrid_api_key');
        if (!apiKey) return { valid: false, message: 'No SendGrid API key configured' };
        
        const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        return response.ok 
          ? { valid: true, message: 'SendGrid API key is valid' }
          : { valid: false, message: 'Invalid SendGrid API key' };
      }
      
      default:
        return { valid: false, message: `Provider ${provider} not supported for testing` };
    }
  } catch (error: any) {
    return { valid: false, message: `Test failed: ${error.message}` };
  }
}

// ============================================
// WORKSPACE PROVIDER STATUS
// ============================================

export async function getWorkspaceProviderStatus(workspaceId: string): Promise<{
  ai: { configured: boolean; provider: string | null; fallback: boolean };
  email: { configured: boolean; provider: string | null };
  usage: WorkspaceUsage;
}> {
  const keys = keyCache.get(workspaceId) || {};
  const usage = await getWorkspaceUsage(workspaceId);
  
  // AI status
  let aiProvider: string | null = null;
  let aiConfigured = false;
  let aiFallback = false;
  
  if (keys.openai_api_key) {
    aiProvider = 'openai';
    aiConfigured = true;
  } else if (keys.anthropic_api_key) {
    aiProvider = 'anthropic';
    aiConfigured = true;
  } else if (process.env.OPENAI_API_KEY) {
    aiProvider = 'platform';
    aiConfigured = true;
    aiFallback = true; // Using platform key as fallback
  }
  
  // Email status
  let emailProvider: string | null = null;
  let emailConfigured = false;
  
  if (keys.resend_api_key) {
    emailProvider = 'resend';
    emailConfigured = true;
  } else if (keys.sendgrid_api_key) {
    emailProvider = 'sendgrid';
    emailConfigured = true;
  } else if (keys.ses_access_key && keys.ses_secret_key) {
    emailProvider = 'ses';
    emailConfigured = true;
  } else if (keys.postmark_api_key) {
    emailProvider = 'postmark';
    emailConfigured = true;
  }
  
  return {
    ai: { configured: aiConfigured, provider: aiProvider, fallback: aiFallback },
    email: { configured: emailConfigured, provider: emailProvider },
    usage
  };
}

// ============================================
// PRICING INFO
// ============================================

export const PROVIDER_PRICING = {
  ai: {
    openai: {
      name: 'OpenAI',
      models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
      pricing: {
        'gpt-4o': { input: 2.50, output: 10.00 }, // per 1M tokens
        'gpt-4o-mini': { input: 0.15, output: 0.60 },
        'gpt-3.5-turbo': { input: 0.50, output: 1.50 }
      },
      signup: 'https://platform.openai.com/api-keys'
    },
    anthropic: {
      name: 'Anthropic',
      models: ['claude-sonnet-4-20250514', 'claude-3-haiku'],
      pricing: {
        'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
        'claude-3-haiku': { input: 0.25, output: 1.25 }
      },
      signup: 'https://console.anthropic.com/'
    }
  },
  email: {
    resend: {
      name: 'Resend',
      pricing: '$20/mo for 50K emails, then $0.40/1000',
      features: ['Modern API', 'React Email', 'Fast delivery', 'Webhooks'],
      signup: 'https://resend.com/api-keys',
      recommended: true
    },
    sendgrid: {
      name: 'SendGrid',
      pricing: 'Free 100/day, then $20-90/mo',
      features: ['Templates', 'Analytics', 'Marketing tools'],
      signup: 'https://app.sendgrid.com/settings/api_keys',
      recommended: false
    },
    ses: {
      name: 'Amazon SES',
      pricing: '$0.10 per 1000 emails',
      features: ['Ultra low cost', 'High volume', 'AWS integration'],
      signup: 'https://console.aws.amazon.com/ses/',
      recommended: false
    },
    postmark: {
      name: 'Postmark',
      pricing: '$15/mo for 10K emails',
      features: ['Fastest delivery', 'Transactional focus', 'Great support'],
      signup: 'https://account.postmarkapp.com/servers',
      recommended: false
    }
  }
};
