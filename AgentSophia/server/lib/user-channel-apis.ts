// User-Connected Channel APIs
// This file provides channel execution using user's connected accounts from My Connections
// Features: Automatic OAuth token refresh, per-user account routing, connection validation

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { 
  sendLinkedInMessage as puppeteerSendMessage, 
  sendConnectionRequest as puppeteerSendConnectionRequest,
  isSessionActive,
  validateSession,
  restoreLinkedInSession,
  acquireSessionLock,
  releaseSessionLock,
  isSessionLocked,
  closeLinkedInSession,
  withProxyResilience
} from './linkedin-automation';
import { getOrAllocateProxy } from './proxy-orchestration';
import { 
  LinkedInSafety,
  calculateAdjustedLimits
} from './linkedin-safety';
import type { UserLinkedInSettings } from '../../shared/schema';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Use service role for data operations (not auth verification)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Database pool for session lookup
let connectionString: string;
let useSSL = false;
if (process.env.SUPABASE_DB_URL) {
  connectionString = process.env.SUPABASE_DB_URL;
  useSSL = true;
} else if (process.env.PGHOST && process.env.PGDATABASE) {
  const pgUser = process.env.PGUSER || 'postgres';
  const pgPassword = process.env.PGPASSWORD || '';
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  connectionString = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
} else {
  connectionString = '';
}
const dbPool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
});

// Auto-restore LinkedIn session from saved cookies and proxy
async function ensureLinkedInSession(
  userId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[Session v2] ensureLinkedInSession called for ${userId}/${workspaceId}`);
  
  const sessionActive = isSessionActive(userId, workspaceId);
  console.log(`[Session v2] isSessionActive returned: ${sessionActive}`);
  
  if (sessionActive) {
    console.log(`[Session v2] Validating existing session...`);
    // Validate that the session is actually usable (browser/page not detached)
    const isValid = await validateSession(userId, workspaceId);
    console.log(`[Session v2] validateSession returned: ${isValid}`);
    if (isValid) {
      console.log(`[Session v2] Returning existing valid session`);
      return { success: true };
    }
    console.log(`[User Channel APIs] Session was active but validation failed - will recreate`);
    // If validation failed, the stale session was already removed by validateSession
  }

  console.log(`[User Channel APIs] No active session for ${userId}/${workspaceId}, attempting auto-restore...`);

  try {
    const { data: settings, error } = await supabase
      .from('linkedin_puppeteer_settings')
      .select('session_cookies_encrypted, proxy_id, is_active, sticky_session_id')
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !settings) {
      console.log(`[User Channel APIs] ❌ No LinkedIn settings found for workspace ${workspaceId}. Error: ${error?.message || 'No data returned'}`);
      return { 
        success: false, 
        error: 'LINKEDIN_NOT_CONNECTED: No saved LinkedIn session found. Please connect your LinkedIn account from My Connections.' 
      };
    }

    if (!settings.is_active) {
      console.log(`[User Channel APIs] ❌ LinkedIn session inactive for workspace ${workspaceId}`);
      return { 
        success: false, 
        error: 'LINKEDIN_SESSION_EXPIRED: LinkedIn session is inactive. Please reconnect from My Connections.' 
      };
    }

    if (!settings.session_cookies_encrypted) {
      console.log(`[User Channel APIs] ❌ No session cookies for workspace ${workspaceId}`);
      return { 
        success: false, 
        error: 'LINKEDIN_NOT_CONNECTED: No session cookies found. Please complete LinkedIn login from My Connections.' 
      };
    }

    // CRITICAL: Use the same proxy that was used during login to maintain IP consistency
    // The proxy_id stored in settings points to the exact proxy used when cookies were created
    let proxyResult;
    if (settings.proxy_id) {
      console.log(`[User Channel APIs] Using stored proxy ${settings.proxy_id} from login session`);
      const { getProxyById } = await import('./proxy-orchestration');
      proxyResult = await getProxyById(settings.proxy_id, userId, workspaceId);
    } else {
      console.log(`[User Channel APIs] No stored proxy_id, allocating new proxy`);
      proxyResult = await getOrAllocateProxy(userId, workspaceId);
    }
    
    if (!proxyResult.success || !proxyResult.proxy) {
      return { 
        success: false, 
        error: 'Failed to allocate proxy for LinkedIn session. Please try again.' 
      };
    }

    const proxy = proxyResult.proxy;
    
    // CRITICAL FIX: Use the sticky_session_id from the database settings if available
    // This ensures we use the EXACT same IP that was used during login
    // The allocation table lookup can fail/return new session IDs, causing IP mismatches
    const effectiveStickySessionId = settings.sticky_session_id || proxy.stickySessionId;
    console.log(`[User Channel APIs] Using proxy ${proxy.host}:${proxy.port} for session restore, sticky_session: ${effectiveStickySessionId || 'none'} (from ${settings.sticky_session_id ? 'database' : 'allocation'})`);
    
    const proxyConfig = {
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      password: proxy.password,
      stickySessionId: effectiveStickySessionId,
      provider: proxy.provider,
    };

    // Fetch user's LinkedIn safety settings for warmup limits
    const { data: safetySettings } = await supabase
      .from('linkedin_user_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .single();

    // Calculate warmup-adjusted limits
    let rateLimits = {
      invitesSentToday: 0,
      messagesSentToday: 0,
      dailyInviteLimit: 50,
      dailyMessageLimit: 100,
    };

    if (safetySettings) {
      const adjustedLimits = calculateAdjustedLimits(safetySettings as UserLinkedInSettings);
      rateLimits = {
        invitesSentToday: safetySettings.connections_sent_today || 0,
        messagesSentToday: safetySettings.messages_sent_today || 0,
        dailyInviteLimit: adjustedLimits.dailyConnections,
        dailyMessageLimit: adjustedLimits.dailyMessages,
      };
      
      // Log warmup override warning if active
      if (adjustedLimits.warmupOverrideWarning) {
        console.warn(`[User Channel APIs] ${adjustedLimits.warmupOverrideWarning}`);
      }
      
      console.log(`[User Channel APIs] Using limits: invites=${rateLimits.dailyInviteLimit}, messages=${rateLimits.dailyMessageLimit}, warmup=${safetySettings.is_warming_up ? 'active' : 'complete'}, override=${safetySettings.warmup_override_enabled ? 'YES' : 'no'}`);
    }

    const restoreResult = await restoreLinkedInSession(
      userId,
      workspaceId,
      settings.session_cookies_encrypted,
      proxyConfig,
      rateLimits
    );

    if (!restoreResult.success) {
      console.log(`[User Channel APIs] ❌ Failed to restore session for workspace ${workspaceId}: ${restoreResult.message}`);
      
      // IRONCLAD SESSION PROTECTION: NEVER switch proxy ports - this causes IP changes that invalidate sessions
      // If proxy fails, return a temporary error and let the system retry later with the SAME port
      if (restoreResult.message?.includes('PROXY_TUNNEL_FAILED') || 
          restoreResult.message?.includes('ERR_TUNNEL') ||
          restoreResult.message?.includes('ERR_PROXY') ||
          restoreResult.message?.includes('ECONNREFUSED') ||
          restoreResult.message?.includes('proxy') ||
          restoreResult.message?.includes('timeout')) {
        console.log(`[User Channel APIs] ⏸️ PROXY TEMPORARILY UNAVAILABLE - Preserving session, will retry later with SAME port`);
        console.log(`[User Channel APIs] ⚠️ NOT switching proxy ports to protect session IP consistency`);
        
        // CRITICAL: Do NOT switch ports, do NOT mark session as expired
        // The cookies are still valid - only the proxy connection failed temporarily
        // Campaign executor will see this as a temporary error and retry
        return { 
          success: false, 
          error: `PROXY_TEMPORARILY_UNAVAILABLE: Proxy connection failed temporarily. Will retry with same configuration. Session cookies preserved.` 
        };
      }
      
      // Only mark as expired if LinkedIn itself logged us out (not proxy issues)
      // Be very strict about what qualifies as a true session expiration
      if (restoreResult.message?.includes('SESSION_LOGGED_OUT') || 
          restoreResult.message?.includes('login page detected')) {
        // ADDITIONAL CHECK: Only mark expired if we actually reached LinkedIn (not a proxy failure)
        const isProxyFailure = restoreResult.message?.includes('proxy') || 
                               restoreResult.message?.includes('tunnel') ||
                               restoreResult.message?.includes('ECONNREFUSED');
        
        if (!isProxyFailure) {
          console.log(`[User Channel APIs] ⚠️ TRUE session expiration detected - marking as inactive`);
          await supabase
            .from('linkedin_puppeteer_settings')
            .update({ is_active: false, profile_name: 'Session Expired - Please Reconnect' })
            .eq('workspace_id', workspaceId);
            
          return { 
            success: false, 
            error: `LINKEDIN_SESSION_EXPIRED: ${restoreResult.message || 'LinkedIn session expired. Please reconnect from My Connections.'}` 
          };
        } else {
          console.log(`[User Channel APIs] ⏸️ Login page detected but may be proxy issue - NOT marking as expired`);
          return { 
            success: false, 
            error: `PROXY_TEMPORARILY_UNAVAILABLE: Could not verify session due to proxy issues. Will retry later.` 
          };
        }
      }
      
      // For any other error, don't immediately mark as expired - could be temporary
      console.log(`[User Channel APIs] ⚠️ Unknown restore error - treating as temporary, NOT invalidating session`);
      return { 
        success: false, 
        error: `LINKEDIN_TEMPORARY_ERROR: ${restoreResult.message || 'Temporary issue. Will retry automatically.'}` 
      };
    }

    console.log(`[User Channel APIs] Successfully restored LinkedIn session for ${userId}/${workspaceId}`);
    
    // CRITICAL: Reset is_active flag on successful restore
    // This ensures UI shows correct "Connected" status after recovery from transient errors
    try {
      await supabase
        .from('linkedin_puppeteer_settings')
        .update({ is_active: true })
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId);
      console.log(`[User Channel APIs] ✅ Reset is_active=true for workspace ${workspaceId}`);
    } catch (updateErr: any) {
      console.log(`[User Channel APIs] Warning: Failed to update is_active flag: ${updateErr.message}`);
    }
    
    return { success: true };
  } catch (err: any) {
    console.error('[User Channel APIs] Session restore error:', err);
    return { 
      success: false, 
      error: `LINKEDIN_SESSION_ERROR: ${err.message || 'Failed to restore LinkedIn session'}` 
    };
  }
}

// OAuth configuration
const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID || '';
const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET || '';
const OFFICE365_CLIENT_ID = process.env.OFFICE365_CLIENT_ID || '';
const OFFICE365_CLIENT_SECRET = process.env.OFFICE365_CLIENT_SECRET || '';
const OFFICE365_TENANT_ID = process.env.OFFICE365_TENANT_ID || 'common';

// Token refresh result interface
interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

// Refresh Gmail OAuth token
async function refreshGmailToken(refreshToken: string): Promise<TokenRefreshResult> {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    return { success: false, error: 'Gmail OAuth not configured' };
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GMAIL_CLIENT_ID,
        client_secret: GMAIL_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gmail token refresh failed:', errorData);
      return { 
        success: false, 
        error: errorData.error_description || errorData.error || 'Token refresh failed' 
      };
    }

    const data = await response.json();
    
    // Calculate expiry time (default 1 hour if not provided)
    const expiresIn = data.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Google may return new refresh token
      expiresAt,
    };
  } catch (error: any) {
    console.error('Gmail token refresh error:', error);
    return { success: false, error: error.message || 'Token refresh failed' };
  }
}

// Refresh Office 365 OAuth token
async function refreshOffice365Token(refreshToken: string): Promise<TokenRefreshResult> {
  if (!OFFICE365_CLIENT_ID || !OFFICE365_CLIENT_SECRET) {
    return { success: false, error: 'Office 365 OAuth not configured' };
  }

  try {
    const tokenUrl = `https://login.microsoftonline.com/${OFFICE365_TENANT_ID}/oauth2/v2.0/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: OFFICE365_CLIENT_ID,
        client_secret: OFFICE365_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.ReadWrite offline_access',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Office 365 token refresh failed:', errorData);
      return { 
        success: false, 
        error: errorData.error_description || errorData.error || 'Token refresh failed' 
      };
    }

    const data = await response.json();
    
    // Calculate expiry time (default 1 hour if not provided)
    const expiresIn = data.expires_in || 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Microsoft returns new refresh token
      expiresAt,
    };
  } catch (error: any) {
    console.error('Office 365 token refresh error:', error);
    return { success: false, error: error.message || 'Token refresh failed' };
  }
}

// Persist refreshed tokens to database
async function persistRefreshedTokens(
  connectionId: number,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date
): Promise<boolean> {
  try {
    const updateData: Record<string, any> = {
      access_token: accessToken,
      updated_at: new Date().toISOString(),
    };
    
    if (refreshToken) {
      updateData.refresh_token = refreshToken;
    }
    
    if (expiresAt) {
      updateData.token_expires_at = expiresAt.toISOString();
    }

    const { error } = await supabase
      .from('connected_accounts')
      .update(updateData)
      .eq('id', connectionId);

    if (error) {
      console.error('Failed to persist refreshed tokens:', error);
      return false;
    }

    console.log(`Successfully refreshed and persisted tokens for connection ${connectionId}`);
    return true;
  } catch (error) {
    console.error('Error persisting tokens:', error);
    return false;
  }
}

// Helper to convert LinkedIn ID to profile URL if needed
function normalizeLinkedInProfileUrl(identifier: string | undefined): string | null {
  if (!identifier) return null;
  
  // Already a URL
  if (identifier.startsWith('http://') || identifier.startsWith('https://')) {
    return identifier;
  }
  
  // LinkedIn URN format (urn:li:person:xxx)
  if (identifier.startsWith('urn:li:')) {
    const id = identifier.split(':').pop();
    return `https://www.linkedin.com/in/${id}`;
  }
  
  // Plain ID - construct URL
  return `https://www.linkedin.com/in/${identifier}`;
}

// Types for user connections
interface UserLinkedInConnection {
  id: number;
  user_id: string;
  linkedin_account_id: string;
  linkedin_access_token?: string;
  profile_data: Record<string, any>;
  is_active: boolean;
}

interface UserEmailConnection {
  id: number;
  user_id: string;
  provider: 'gmail' | 'office365';
  access_token: string;
  refresh_token?: string;
  email: string;
  is_active: boolean;
}

interface CampaignRecipient {
  email?: string;
  phone?: string;
  linkedinProfileUrl?: string;
  linkedinId?: string;
  firstName?: string;
  lastName?: string;
}

interface CampaignContent {
  subject?: string;
  body: string;
}

interface ExecutionResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deferred?: boolean;  // True when action is deferred due to warmup limits
}

// Get user's LinkedIn connection (from social_connections table)
// Now filters by workspace_id to support separate LinkedIn connections per workspace
export async function getUserLinkedInConnection(userId: string, workspaceId?: string): Promise<UserLinkedInConnection | null> {
  try {
    let query = supabase
      .from('social_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'linkedin')
      .eq('is_active', true);
    
    // Filter by workspace if provided
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      return null;
    }

    // Map social_connections fields to UserLinkedInConnection interface
    return {
      id: data.id,
      user_id: data.user_id,
      linkedin_account_id: data.account_id || data.id,
      linkedin_access_token: data.access_token,
      profile_data: data.profile_data || {},
      is_active: data.is_active,
    };
  } catch (error) {
    console.error('Error fetching user LinkedIn connection:', error);
    return null;
  }
}

// Get user's email connection (Gmail or Office 365)
export async function getUserEmailConnection(userId: string): Promise<UserEmailConnection | null> {
  try {
    const { data, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .in('provider', ['gmail', 'office365'])
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      user_id: data.user_id,
      provider: data.provider,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      email: data.email || data.account_email,
      is_active: data.is_active,
    };
  } catch (error) {
    console.error('Error fetching user email connection:', error);
    return null;
  }
}

// Get ALL user's email connections (Gmail and Office 365)
export async function getAllUserEmailConnections(userId: string): Promise<UserEmailConnection[]> {
  try {
    const { data, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .in('provider', ['gmail', 'office365'])
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map(conn => ({
      id: conn.id,
      user_id: conn.user_id,
      provider: conn.provider,
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      email: conn.email || conn.account_email,
      is_active: conn.is_active,
    }));
  } catch (error) {
    console.error('Error fetching user email connections:', error);
    return [];
  }
}

// Get a specific email connection by ID
export async function getEmailConnectionById(userId: string, connectionId: number): Promise<UserEmailConnection | null> {
  try {
    const { data, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('id', connectionId)
      .in('provider', ['gmail', 'office365'])
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      user_id: data.user_id,
      provider: data.provider,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      email: data.email || data.account_email,
      is_active: data.is_active,
    };
  } catch (error) {
    console.error('Error fetching email connection by ID:', error);
    return null;
  }
}

// Check which channels user has connected (now workspace-aware for LinkedIn)
export async function getUserConnectedChannels(userId: string, workspaceId?: string): Promise<{
  linkedin: boolean;
  gmail: boolean;
  office365: boolean;
}> {
  const [linkedIn, emailConnections] = await Promise.all([
    getUserLinkedInConnection(userId, workspaceId),
    supabase
      .from('connected_accounts')
      .select('provider')
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('provider', ['gmail', 'office365']),
  ]);

  const emailProviders = emailConnections.data?.map(c => c.provider) || [];

  return {
    linkedin: !!linkedIn,
    gmail: emailProviders.includes('gmail'),
    office365: emailProviders.includes('office365'),
  };
}

// Send LinkedIn message using user's connected account (Puppeteer automation)
export async function sendLinkedInMessage(
  userId: string,
  recipient: CampaignRecipient,
  content: CampaignContent,
  workspaceId?: string
): Promise<ExecutionResult> {
  try {
    // Get workspace ID - required for proper session lookup
    const wsId = workspaceId || 'default';
    
    // First check for Puppeteer session cookies (workspace-level)
    // This is the primary method for LinkedIn automation
    const sessionResult = await ensureLinkedInSession(userId, wsId);
    if (!sessionResult.success) {
      // Only check OAuth connection if session cookies not found
      const connection = await getUserLinkedInConnection(userId, wsId);
      if (!connection) {
        return {
          success: false,
          error: 'LINKEDIN_NOT_CONNECTED: LinkedIn account not connected. Please connect your LinkedIn in My Connections.',
        };
      }
      // Has OAuth but session failed - report session error
      return {
        success: false,
        error: sessionResult.error || 'LINKEDIN_SESSION_ERROR: Failed to initialize LinkedIn session',
      };
    }

    // Normalize recipient identifier to URL format
    const recipientUrl = normalizeLinkedInProfileUrl(recipient.linkedinProfileUrl) 
      || normalizeLinkedInProfileUrl(recipient.linkedinId);
    
    if (!recipientUrl) {
      return {
        success: false,
        error: 'LinkedIn profile URL or ID required for recipient.',
      };
    }

    // Use Puppeteer automation to send message
    const result = await puppeteerSendMessage(userId, wsId, recipientUrl, content.body);
    
    if (!result.success) {
      return {
        success: false,
        error: result.message || 'Failed to send LinkedIn message',
      };
    }
    
    return {
      success: true,
      messageId: `linkedin_msg_${Date.now()}`,
    };
  } catch (error: any) {
    console.error('LinkedIn message error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send LinkedIn message',
    };
  }
}

// Send LinkedIn connection request using user's connected account (Puppeteer automation)
export async function sendLinkedInConnectionRequest(
  userId: string,
  recipient: CampaignRecipient,
  content: CampaignContent,
  workspaceId?: string
): Promise<ExecutionResult> {
  console.log(`[LinkedIn Connection] sendLinkedInConnectionRequest called`);
  console.log(`[LinkedIn Connection]   → userId: ${userId}`);
  console.log(`[LinkedIn Connection]   → workspaceId: ${workspaceId || 'not provided'}`);
  console.log(`[LinkedIn Connection]   → recipient.linkedinProfileUrl: ${recipient.linkedinProfileUrl || 'not set'}`);
  console.log(`[LinkedIn Connection]   → recipient.linkedinId: ${recipient.linkedinId || 'not set'}`);
  
  // Get workspace ID - required for proper session lookup
  const wsId = workspaceId || 'default';
  
  // Acquire session lock to prevent race conditions with acceptance checker
  if (!acquireSessionLock(userId, wsId, 'campaign-executor')) {
    console.log(`[LinkedIn Connection] Session locked by another process, waiting...`);
    // Wait a bit and retry once
    await new Promise(resolve => setTimeout(resolve, 5000));
    if (!acquireSessionLock(userId, wsId, 'campaign-executor')) {
      console.log(`[LinkedIn Connection] Still locked, returning error`);
      return {
        success: false,
        error: 'SESSION_LOCKED: LinkedIn session is busy with another operation. Will retry.',
      };
    }
  }
  
  try {
    // Use proxy resilience wrapper for automatic retry on tunnel failures
    return await withProxyResilience(
      userId,
      wsId,
      async () => {
        // First check for Puppeteer session cookies (workspace-level)
        // This is the primary method for LinkedIn automation
        console.log(`[LinkedIn Connection] Ensuring session for ${userId}/${wsId}...`);
        const sessionResult = await ensureLinkedInSession(userId, wsId);
        console.log(`[LinkedIn Connection] Session result: success=${sessionResult.success}, error=${sessionResult.error || 'none'}`);
        
        if (!sessionResult.success) {
          const sessionError = sessionResult.error || '';
          
          // Check if session expired - give clear message to user
          if (sessionError.includes('SESSION_EXPIRED') || 
              sessionError.includes('SESSION_LOGGED_OUT') ||
              sessionError.includes('cookies expired')) {
            console.log(`[LinkedIn Connection] ❌ Session expired for workspace ${wsId}`);
            return {
              success: false,
              error: 'LINKEDIN_SESSION_EXPIRED: Your LinkedIn session has expired. Please go to LinkedIn settings and use Quick Login to reconnect.',
            };
          }
          
          // Check if it's a proxy error (should be retried)
          if (sessionError.includes('ERR_TUNNEL') || sessionError.includes('ERR_PROXY')) {
            throw new Error(sessionError); // Throw to trigger retry
          }
          
          // Only check OAuth connection if session cookies not found at all
          const connection = await getUserLinkedInConnection(userId, wsId);
          if (!connection && sessionError.includes('No saved LinkedIn session')) {
            console.log(`[LinkedIn Connection] ❌ No LinkedIn connection found for user`);
            return {
              success: false,
              error: 'LINKEDIN_NOT_CONNECTED: LinkedIn account not connected. Please connect your LinkedIn in My Connections.',
            };
          }
          
          console.log(`[LinkedIn Connection] ❌ Session failed: ${sessionError}`);
          return {
            success: false,
            error: sessionError || 'LINKEDIN_SESSION_ERROR: Failed to initialize LinkedIn session. Please reconnect from My Connections.',
          };
        }

        // Normalize recipient identifier to URL format
        const recipientUrl = normalizeLinkedInProfileUrl(recipient.linkedinProfileUrl) 
          || normalizeLinkedInProfileUrl(recipient.linkedinId);
        
        console.log(`[LinkedIn Connection] Normalized recipient URL: ${recipientUrl || 'NONE'}`);
        
        if (!recipientUrl) {
          console.log(`[LinkedIn Connection] ❌ No valid LinkedIn profile URL for recipient`);
          return {
            success: false,
            error: 'LinkedIn profile URL required for connection request.',
          };
        }

        // Use Puppeteer automation to send connection request (with optional note)
        console.log(`[LinkedIn Connection] Calling puppeteerSendConnectionRequest...`);
        const result = await puppeteerSendConnectionRequest(userId, wsId, recipientUrl, content.body || undefined);
        console.log(`[LinkedIn Connection] Puppeteer result: success=${result.success}, message=${result.message || 'none'}`);
        
        // If proxy error, throw to trigger retry
        if (!result.success && result.message) {
          if (result.message.includes('ERR_TUNNEL') || result.message.includes('ERR_PROXY')) {
            throw new Error(result.message);
          }
        }
        
        if (!result.success) {
          console.log(`[LinkedIn Connection] ❌ Puppeteer failed: ${result.message}`);
          return {
            success: false,
            error: result.message || 'Failed to send connection request',
          };
        }

        console.log(`[LinkedIn Connection] ✅ Connection request sent successfully`);
        return {
          success: true,
          messageId: `linkedin_req_${Date.now()}`,
        };
      },
      {
        maxRetries: 3,
        operationName: 'LinkedIn Connection Request',
        onProxyError: async () => {
          // Close the session so it gets a fresh proxy on next attempt
          await closeLinkedInSession(userId, wsId);
        }
      }
    );
  } catch (error: any) {
    console.error('[LinkedIn Connection] Exception:', error);
    return {
      success: false,
      error: error.message || 'Failed to send connection request',
    };
  } finally {
    // Always release the session lock
    releaseSessionLock(userId, wsId, 'campaign-executor');
  }
}

// Helper function to actually send email via Gmail API
async function sendGmailRequest(
  accessToken: string,
  rawMessage: string
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: rawMessage }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      ok: false,
      status: response.status,
      error: errorData.error?.message || `Gmail API error: ${response.status}`,
    };
  }

  const data = await response.json();
  return { ok: true, status: response.status, data };
}

// Send email via user's connected Gmail account with automatic token refresh
export async function sendEmailViaGmail(
  userId: string,
  recipient: CampaignRecipient,
  content: CampaignContent
): Promise<ExecutionResult> {
  try {
    const { data: connection, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'gmail')
      .eq('is_active', true)
      .single();

    if (error || !connection) {
      return {
        success: false,
        error: 'Gmail account not connected. Please connect your Gmail in My Connections.',
      };
    }

    if (!recipient.email) {
      return {
        success: false,
        error: 'Recipient email address required.',
      };
    }

    // Create email message in RFC 2822 format
    const fromEmail = connection.email || connection.account_email;
    const emailLines = [
      `From: ${fromEmail}`,
      `To: ${recipient.email}`,
      `Subject: ${content.subject || 'Message from ' + fromEmail}`,
      'Content-Type: text/html; charset=utf-8',
      '',
      content.body,
    ];
    const rawMessage = Buffer.from(emailLines.join('\r\n')).toString('base64url');

    // First attempt with current access token
    let result = await sendGmailRequest(connection.access_token, rawMessage);

    // If 401 (unauthorized), try to refresh the token and retry
    if (!result.ok && result.status === 401) {
      console.log(`Gmail token expired for user ${userId}, attempting refresh...`);
      
      if (!connection.refresh_token) {
        return {
          success: false,
          error: 'Gmail token expired and no refresh token available. Please reconnect your Gmail in My Connections.',
        };
      }

      const refreshResult = await refreshGmailToken(connection.refresh_token);
      
      if (!refreshResult.success || !refreshResult.accessToken) {
        return {
          success: false,
          error: `Gmail token refresh failed: ${refreshResult.error}. Please reconnect your Gmail in My Connections.`,
        };
      }

      // Persist the new tokens
      await persistRefreshedTokens(
        connection.id,
        refreshResult.accessToken,
        refreshResult.refreshToken,
        refreshResult.expiresAt
      );

      // Retry with new access token
      result = await sendGmailRequest(refreshResult.accessToken, rawMessage);
    }

    if (!result.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send email via Gmail',
      };
    }

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error: any) {
    console.error('Gmail send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email via Gmail',
    };
  }
}

// Helper function to send email via Microsoft Graph API
async function sendOffice365Request(
  accessToken: string,
  recipient: string,
  subject: string,
  body: string
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: recipient,
            },
          },
        ],
      },
      saveToSentItems: true,
    }),
  });

  // Microsoft Graph returns 202 Accepted for sendMail (no body)
  if (response.ok || response.status === 202) {
    // Try to get message ID from response headers or body
    const data = await response.json().catch(() => null);
    return { 
      ok: true, 
      status: response.status,
      data: data || { id: `msg-${Date.now()}` } // Generate ID if not provided
    };
  }

  const errorData = await response.json().catch(() => ({}));
  return {
    ok: false,
    status: response.status,
    error: errorData.error?.message || `Office 365 API error: ${response.status}`,
  };
}

// Send email via user's connected Office 365 account with automatic token refresh
export async function sendEmailViaOffice365(
  userId: string,
  recipient: CampaignRecipient,
  content: CampaignContent
): Promise<ExecutionResult> {
  try {
    const { data: connection, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'office365')
      .eq('is_active', true)
      .single();

    if (error || !connection) {
      return {
        success: false,
        error: 'Office 365 account not connected. Please connect your Outlook in My Connections.',
      };
    }

    if (!recipient.email) {
      return {
        success: false,
        error: 'Recipient email address required.',
      };
    }

    const subject = content.subject || 'Message';
    
    // First attempt with current access token
    let result = await sendOffice365Request(
      connection.access_token,
      recipient.email,
      subject,
      content.body
    );

    // If 401 (unauthorized), try to refresh the token and retry
    if (!result.ok && result.status === 401) {
      console.log(`Office 365 token expired for user ${userId}, attempting refresh...`);
      
      if (!connection.refresh_token) {
        return {
          success: false,
          error: 'Office 365 token expired and no refresh token available. Please reconnect your Outlook in My Connections.',
        };
      }

      const refreshResult = await refreshOffice365Token(connection.refresh_token);
      
      if (!refreshResult.success || !refreshResult.accessToken) {
        return {
          success: false,
          error: `Office 365 token refresh failed: ${refreshResult.error}. Please reconnect your Outlook in My Connections.`,
        };
      }

      // Persist the new tokens
      await persistRefreshedTokens(
        connection.id,
        refreshResult.accessToken,
        refreshResult.refreshToken,
        refreshResult.expiresAt
      );

      // Retry with new access token
      result = await sendOffice365Request(
        refreshResult.accessToken,
        recipient.email,
        subject,
        content.body
      );
    }

    if (!result.ok) {
      return {
        success: false,
        error: result.error || 'Failed to send email via Office 365',
      };
    }

    return {
      success: true,
      messageId: result.data?.id || `office365-${Date.now()}`,
    };
  } catch (error: any) {
    console.error('Office 365 send error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email via Office 365',
    };
  }
}

// Send email using user's preferred connected account
export async function sendEmailViaUserAccount(
  userId: string,
  recipient: CampaignRecipient,
  content: CampaignContent,
  preferredProvider?: 'gmail' | 'office365'
): Promise<ExecutionResult> {
  // If preferred provider specified, try that first
  if (preferredProvider === 'gmail') {
    const result = await sendEmailViaGmail(userId, recipient, content);
    if (result.success) return result;
  } else if (preferredProvider === 'office365') {
    const result = await sendEmailViaOffice365(userId, recipient, content);
    if (result.success) return result;
  }

  // Try Gmail first, then Office 365
  const gmailResult = await sendEmailViaGmail(userId, recipient, content);
  if (gmailResult.success) return gmailResult;

  const office365Result = await sendEmailViaOffice365(userId, recipient, content);
  if (office365Result.success) return office365Result;

  // Return the most relevant error
  return {
    success: false,
    error: 'No email account connected. Please connect Gmail or Office 365 in My Connections.',
  };
}

// Send email via a SPECIFIC connected account by ID
export async function sendEmailViaSpecificAccount(
  userId: string,
  accountId: number,
  recipient: CampaignRecipient,
  content: CampaignContent
): Promise<ExecutionResult> {
  try {
    const { data: connection, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('id', accountId)
      .in('provider', ['gmail', 'office365'])
      .eq('is_active', true)
      .single();

    if (error || !connection) {
      return {
        success: false,
        error: 'Selected email account not found or not connected.',
      };
    }

    if (!recipient.email) {
      return {
        success: false,
        error: 'Recipient email address required.',
      };
    }

    const fromEmail = connection.email || connection.account_email;
    
    if (connection.provider === 'gmail') {
      const emailLines = [
        `From: ${fromEmail}`,
        `To: ${recipient.email}`,
        `Subject: ${content.subject || 'Message from ' + fromEmail}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        content.body,
      ];
      const rawMessage = Buffer.from(emailLines.join('\r\n')).toString('base64url');

      let result = await sendGmailRequest(connection.access_token, rawMessage);

      if (!result.ok && result.status === 401 && connection.refresh_token) {
        console.log(`Gmail token expired for account ${accountId}, attempting refresh...`);
        const refreshResult = await refreshGmailToken(connection.refresh_token);
        
        if (!refreshResult.success || !refreshResult.accessToken) {
          return {
            success: false,
            error: `Gmail token refresh failed: ${refreshResult.error}. Please reconnect your Gmail.`,
          };
        }

        await persistRefreshedTokens(
          connection.id,
          refreshResult.accessToken,
          refreshResult.refreshToken,
          refreshResult.expiresAt
        );

        result = await sendGmailRequest(refreshResult.accessToken, rawMessage);
      }

      if (!result.ok) {
        return {
          success: false,
          error: result.error || 'Failed to send email via Gmail',
        };
      }

      return {
        success: true,
        messageId: result.data?.id,
      };
    } else if (connection.provider === 'office365') {
      const subject = content.subject || 'Message';
      
      let result = await sendOffice365Request(
        connection.access_token,
        recipient.email,
        subject,
        content.body
      );

      if (!result.ok && result.status === 401 && connection.refresh_token) {
        console.log(`Office 365 token expired for account ${accountId}, attempting refresh...`);
        const refreshResult = await refreshOffice365Token(connection.refresh_token);
        
        if (!refreshResult.success || !refreshResult.accessToken) {
          return {
            success: false,
            error: `Office 365 token refresh failed: ${refreshResult.error}. Please reconnect your Outlook.`,
          };
        }

        await persistRefreshedTokens(
          connection.id,
          refreshResult.accessToken,
          refreshResult.refreshToken,
          refreshResult.expiresAt
        );

        result = await sendOffice365Request(
          refreshResult.accessToken,
          recipient.email,
          subject,
          content.body
        );
      }

      if (!result.ok) {
        return {
          success: false,
          error: result.error || 'Failed to send email via Office 365',
        };
      }

      return {
        success: true,
        messageId: result.data?.id || `office365-${Date.now()}`,
      };
    }

    return {
      success: false,
      error: `Unsupported email provider: ${connection.provider}`,
    };
  } catch (error: any) {
    console.error('Send email via specific account error:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

// Determine LinkedIn action from channel name and options
function resolveLinkedInAction(
  channel: string, 
  explicitAction?: 'message' | 'connection_request'
): 'message' | 'connection_request' {
  // Explicit action takes precedence
  if (explicitAction) return explicitAction;
  
  // Infer from channel name
  const lowerChannel = channel.toLowerCase();
  if (lowerChannel === 'linkedin_connection' || lowerChannel === 'linkedin_connect') {
    return 'connection_request';
  }
  
  // Default to message for generic 'linkedin' or 'linkedin_message'
  return 'message';
}

// Execute campaign step using user's connected accounts
export async function executeCampaignStepWithUserAccounts(
  userId: string,
  channel: string,
  recipient: CampaignRecipient,
  content: CampaignContent,
  options?: {
    emailProvider?: 'gmail' | 'office365';
    linkedInAction?: 'message' | 'connection_request';
    searchConfig?: {
      keywords?: string;
      jobTitle?: string;
      company?: string;
      location?: string;
      industry?: string;
      maxResults?: number;
    };
    workspaceId?: string;
    campaignId?: string;
  }
): Promise<ExecutionResult> {
  const normalizedChannel = normalizeChannel(channel);
  
  switch (normalizedChannel) {
    case 'email':
      return await sendEmailViaUserAccount(userId, recipient, content, options?.emailProvider);
    
    case 'linkedin_search': {
      // LinkedIn Search is a lead sourcing action - it finds and imports leads
      return await executeLinkedInSearch(userId, options?.searchConfig, options?.workspaceId, options?.campaignId);
    }
    
    case 'linkedin': {
      // Resolve the LinkedIn action deterministically
      const action = resolveLinkedInAction(channel, options?.linkedInAction);
      
      if (action === 'connection_request') {
        return await sendLinkedInConnectionRequest(userId, recipient, content, options?.workspaceId);
      }
      return await sendLinkedInMessage(userId, recipient, content, options?.workspaceId);
    }
    
    default:
      return {
        success: false,
        error: `Channel '${channel}' requires manual configuration. User connections only support email and LinkedIn.`,
      };
  }
}

// Execute LinkedIn Search to find and import leads
async function executeLinkedInSearch(
  userId: string,
  searchConfig?: {
    keywords?: string;
    jobTitle?: string;
    company?: string;
    location?: string;
    industry?: string;
    maxResults?: number;
    connectionDegree?: '1st' | '2nd' | '3rd' | 'all';
  },
  workspaceId?: string,
  campaignId?: string
): Promise<ExecutionResult> {
  console.log(`[LinkedIn Search] =======================================================`);
  console.log(`[LinkedIn Search] executeLinkedInSearch called at ${new Date().toISOString()}`);
  console.log(`[LinkedIn Search] userId: ${userId}, workspaceId: ${workspaceId}, campaignId: ${campaignId}`);
  console.log(`[LinkedIn Search] searchConfig:`, JSON.stringify(searchConfig, null, 2));
  
  try {
    if (!searchConfig) {
      console.log(`[LinkedIn Search] ERROR: No search config provided`);
      return { success: false, error: 'LinkedIn Search requires search configuration' };
    }

    if (!workspaceId) {
      console.log(`[LinkedIn Search] ERROR: No workspace ID provided`);
      return { success: false, error: 'LinkedIn Search requires a workspace ID' };
    }

    // Import the LinkedIn search scraper dynamically to avoid circular imports
    const { createSearchJob, validateLinkedInSession } = await import('./linkedin-search-scraper');
    
    // Look up the user's connected LinkedIn account for this workspace
    // LinkedIn sessions can be stored in multiple tables, so we check several sources
    let linkedInAccountId = userId; // Default to userId
    
    if (supabase) {
      // First try linkedin_accounts table
      const { data: linkedInAccounts } = await supabase
        .from('linkedin_accounts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('status', 'active')
        .limit(1);
      
      if (linkedInAccounts && linkedInAccounts.length > 0) {
        linkedInAccountId = linkedInAccounts[0].id;
        console.log(`[LinkedIn Search] Found LinkedIn account ${linkedInAccountId} in linkedin_accounts`);
      } else {
        // Also check user_linkedin_settings (where session cookies are stored)
        const { data: userSettings } = await supabase
          .from('user_linkedin_settings')
          .select('user_id')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true)
          .limit(1);
        
        if (userSettings && userSettings.length > 0) {
          linkedInAccountId = userSettings[0].user_id;
          console.log(`[LinkedIn Search] Found LinkedIn session via user_linkedin_settings for user ${linkedInAccountId}`);
        } else {
          // Also check linkedin_puppeteer_settings 
          const { data: puppeteerSettings } = await supabase
            .from('linkedin_puppeteer_settings')
            .select('workspace_id')
            .eq('workspace_id', workspaceId)
            .not('session_cookies_encrypted', 'is', null)
            .limit(1);
          
          if (puppeteerSettings && puppeteerSettings.length > 0) {
            console.log(`[LinkedIn Search] Found LinkedIn session via linkedin_puppeteer_settings for workspace ${workspaceId}`);
            // For puppeteer settings, we use userId since there's no explicit account id
          } else {
            console.log(`[LinkedIn Search] No active LinkedIn session found for workspace ${workspaceId}`);
          }
        }
      }
    }
    
    // Pre-flight check: validate LinkedIn session exists before creating the job
    // This checks the actual session cookies in user_linkedin_settings or linkedin_puppeteer_settings
    const sessionValidation = await validateLinkedInSession(workspaceId, linkedInAccountId);
    if (!sessionValidation.valid) {
      console.log(`[LinkedIn Search] Pre-flight failed: ${sessionValidation.error}`);
      return { 
        success: false, 
        error: sessionValidation.error || 'No LinkedIn session found. Please connect your LinkedIn account in My Connections page.' 
      };
    }
    console.log(`[LinkedIn Search] Pre-flight passed: session valid for workspace ${workspaceId}`);
    
    const maxResults = searchConfig.maxResults || 25;
    
    console.log(`[LinkedIn Search] Creating search job for account ${linkedInAccountId}, connection level: ${searchConfig.connectionDegree || '2nd (default)'}`);
    
    // Build search criteria from config
    // Normalize connectionDegree for the scraper (expects array)
    let connectionDegreeArray: ('1st' | '2nd' | '3rd')[] | undefined;
    if (searchConfig.connectionDegree) {
      if (searchConfig.connectionDegree === 'all') {
        connectionDegreeArray = ['1st', '2nd', '3rd'];
      } else {
        connectionDegreeArray = [searchConfig.connectionDegree as '1st' | '2nd' | '3rd'];
      }
    } else {
      // Default to 2nd degree connections
      connectionDegreeArray = ['2nd'];
    }
    
    const searchCriteria = {
      keywords: searchConfig.keywords,
      title: searchConfig.jobTitle,
      company: searchConfig.company,
      location: searchConfig.location,
      industry: searchConfig.industry,
      connectionDegree: connectionDegreeArray,
    };
    
    // Create the search job - this is async and runs in background
    // Pass campaignId and userId so leads are auto-imported to contacts when search completes
    const jobResult = createSearchJob(
      workspaceId,
      linkedInAccountId,
      searchCriteria,
      maxResults,
      campaignId,
      userId
    );
    
    if ('error' in jobResult) {
      return { success: false, error: jobResult.error };
    }
    
    console.log(`[LinkedIn Search] Search job created: ${jobResult.id}`);
    
    return {
      success: true,
      messageId: `linkedin_search_job_${jobResult.id}`,
    };
  } catch (error: any) {
    console.error('[LinkedIn Search] Execution error:', error);
    return {
      success: false,
      error: error.message || 'Failed to execute LinkedIn search',
    };
  }
}

// Normalize channel name to base type
function normalizeChannel(channel: string): 'email' | 'linkedin' | 'linkedin_search' | 'other' {
  const lowerChannel = channel.toLowerCase();
  if (lowerChannel === 'email') return 'email';
  if (lowerChannel === 'linkedin_search') return 'linkedin_search';
  if (lowerChannel.startsWith('linkedin')) return 'linkedin';
  return 'other';
}

// Validate that user has required connections for campaign
export async function validateUserConnectionsForCampaign(
  userId: string,
  channels: string[]
): Promise<{
  valid: boolean;
  missingConnections: string[];
  message?: string;
}> {
  const connections = await getUserConnectedChannels(userId);
  const missingConnections: string[] = [];
  const checkedTypes = new Set<string>();

  for (const channel of channels) {
    const normalized = normalizeChannel(channel);
    
    // Avoid duplicate checks
    if (checkedTypes.has(normalized)) continue;
    checkedTypes.add(normalized);
    
    if (normalized === 'email') {
      if (!connections.gmail && !connections.office365) {
        missingConnections.push('Email (Gmail or Office 365)');
      }
    } else if (normalized === 'linkedin') {
      if (!connections.linkedin) {
        missingConnections.push('LinkedIn');
      }
    }
  }

  if (missingConnections.length > 0) {
    return {
      valid: false,
      missingConnections,
      message: `Please connect the following accounts in My Connections before running this campaign: ${missingConnections.join(', ')}`,
    };
  }

  return {
    valid: true,
    missingConnections: [],
  };
}
