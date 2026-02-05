/**
 * LinkedIn Session Keep-Alive Service
 * Prevents session timeout by periodically pinging LinkedIn to keep cookies active
 * LinkedIn sessions typically expire after 24-48 hours of inactivity
 */

import { Browser } from 'puppeteer';
import { decryptToken, encryptToken } from './encryption';
import { Pool } from 'pg';
import { launchLinkedInBrowser, navigateToLinkedIn, checkLoginStatus } from './linkedin-browser';

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '',
  ssl: process.env.SUPABASE_DB_URL ? { rejectUnauthorized: false } : false,
  max: 3,
});

const KEEP_ALIVE_INTERVAL = 4 * 60 * 60 * 1000;
const SESSION_CHECK_INTERVAL = 30 * 60 * 1000;

interface SessionHealth {
  accountId: string;
  workspaceId: string;
  lastPing: Date | null;
  lastSuccess: Date | null;
  isHealthy: boolean;
  consecutiveFailures: number;
  nextScheduledPing: Date;
  errorMessage?: string;
}

const sessionHealthMap = new Map<string, SessionHealth>();
let keepAliveInterval: NodeJS.Timeout | null = null;
let startupTimeout: NodeJS.Timeout | null = null;
let isRunning = false;
let activeBrowsers: Set<Browser> = new Set();
let isShuttingDown = false;

function getSessionKey(workspaceId: string, accountId: string): string {
  return `${workspaceId}:${accountId}`;
}

interface SessionCookiesResult {
  cookies: any[];
  sessionSource: 'quick_login' | 'manual' | 'unknown';
  proxyId?: string; // The proxy used during quick_login - MUST be reused for session consistency
  sourceTable: 'linkedin_puppeteer_settings' | 'user_linkedin_settings'; // Which table cookies came from
}

async function getLinkedInSessionCookies(workspaceId: string, accountId: string): Promise<any[] | null> {
  const result = await getLinkedInSessionWithSource(workspaceId, accountId);
  return result?.cookies || null;
}

async function getLinkedInSessionWithSource(workspaceId: string, accountId: string): Promise<SessionCookiesResult | null> {
  try {
    // FIRST: Check linkedin_puppeteer_settings (where auto-login AND manual paste store cookies)
    // FIX: Added user_id filter to prevent returning wrong user's session in multi-user workspaces
    try {
      const puppeteerResult = await pool.query(
        `SELECT session_cookies_encrypted, is_active, session_source, proxy_id 
         FROM linkedin_puppeteer_settings 
         WHERE workspace_id = $1 AND user_id = $2 AND session_cookies_encrypted IS NOT NULL
         ORDER BY session_captured_at DESC NULLS LAST
         LIMIT 1`,
        [workspaceId, accountId]
      );
      
      if (puppeteerResult.rows.length > 0 && puppeteerResult.rows[0].session_cookies_encrypted) {
        const decrypted = decryptToken(puppeteerResult.rows[0].session_cookies_encrypted);
        const sessionSource = puppeteerResult.rows[0].session_source === 'quick_login' ? 'quick_login' : 'manual';
        const proxyId = puppeteerResult.rows[0].proxy_id;
        return {
          cookies: JSON.parse(decrypted),
          sessionSource,
          proxyId,
          sourceTable: 'linkedin_puppeteer_settings', // Track source table for correct updates
        };
      }
    } catch (puppeteerErr) {
      // Table might not exist, continue to fallback
    }

    // SECOND: Try user_linkedin_settings (legacy fallback - treated as unknown)
    const result = await pool.query(
      `SELECT session_cookies_encrypted, is_active 
       FROM user_linkedin_settings 
       WHERE workspace_id = $1 AND user_id = $2 AND session_cookies_encrypted IS NOT NULL`,
      [workspaceId, accountId]
    );
    
    if (result.rows.length > 0 && result.rows[0].session_cookies_encrypted) {
      const decrypted = decryptToken(result.rows[0].session_cookies_encrypted);
      return {
        cookies: JSON.parse(decrypted),
        sessionSource: 'unknown' as const,
        sourceTable: 'user_linkedin_settings', // Track source table
      };
    }
    
    const workspaceResult = await pool.query(
      `SELECT session_cookies_encrypted, user_id 
       FROM user_linkedin_settings 
       WHERE workspace_id = $1 AND session_cookies_encrypted IS NOT NULL
       ORDER BY session_captured_at DESC NULLS LAST
       LIMIT 1`,
      [workspaceId]
    );
    
    if (workspaceResult.rows.length > 0 && workspaceResult.rows[0].session_cookies_encrypted) {
      const decrypted = decryptToken(workspaceResult.rows[0].session_cookies_encrypted);
      return {
        cookies: JSON.parse(decrypted),
        sessionSource: 'unknown' as const,
        sourceTable: 'user_linkedin_settings', // Track source table
      };
    }
    
    return null;
  } catch (err) {
    console.error('[Session KeepAlive] Failed to get session cookies:', err);
    return null;
  }
}

async function updateLinkedInSessionCookies(
  workspaceId: string, 
  accountId: string, 
  cookies: any[],
  sourceTable: 'linkedin_puppeteer_settings' | 'user_linkedin_settings' = 'user_linkedin_settings'
): Promise<void> {
  try {
    const encrypted = encryptToken(JSON.stringify(cookies));
    
    // FIX: Update the SAME table the cookies were read from
    // This prevents keep-alive from updating the wrong table
    if (sourceTable === 'linkedin_puppeteer_settings') {
      await pool.query(
        `UPDATE linkedin_puppeteer_settings 
         SET session_cookies_encrypted = $1, session_captured_at = NOW(), is_active = true
         WHERE workspace_id = $2 AND user_id = $3`,
        [encrypted, workspaceId, accountId]
      );
      console.log(`[Session KeepAlive] Updated cookies in linkedin_puppeteer_settings for ${accountId}`);
    } else {
      await pool.query(
        `UPDATE user_linkedin_settings 
         SET session_cookies_encrypted = $1, session_captured_at = NOW(), is_active = true
         WHERE workspace_id = $2 AND user_id = $3`,
        [encrypted, workspaceId, accountId]
      );
      console.log(`[Session KeepAlive] Updated cookies in user_linkedin_settings for ${accountId}`);
    }
  } catch (err) {
    console.error('[Session KeepAlive] Failed to update cookies:', err);
  }
}

async function getActiveLinkedInAccounts(): Promise<Array<{ workspaceId: string; accountId: string }>> {
  const accounts: Array<{ workspaceId: string; accountId: string }> = [];
  
  try {
    // Check linkedin_puppeteer_settings first (where auto-login saves)
    try {
      const puppeteerResult = await pool.query(
        `SELECT DISTINCT workspace_id, user_id 
         FROM linkedin_puppeteer_settings 
         WHERE session_cookies_encrypted IS NOT NULL AND is_active = true`
      );
      puppeteerResult.rows.forEach(row => {
        accounts.push({ workspaceId: row.workspace_id, accountId: row.user_id });
      });
    } catch (puppeteerErr) {
      // Table might not exist
    }

    // Also check user_linkedin_settings
    try {
      const result = await pool.query(
        `SELECT DISTINCT workspace_id, user_id 
         FROM user_linkedin_settings 
         WHERE session_cookies_encrypted IS NOT NULL AND is_active = true`
      );
      result.rows.forEach(row => {
        const key = `${row.workspace_id}:${row.user_id}`;
        if (!accounts.some(a => `${a.workspaceId}:${a.accountId}` === key)) {
          accounts.push({ workspaceId: row.workspace_id, accountId: row.user_id });
        }
      });
    } catch (err) {
      // Continue
    }

    return accounts;
  } catch (err) {
    console.error('[Session KeepAlive] Failed to get active accounts:', err);
    return [];
  }
}

function normalizeCookiesForPuppeteer(cookies: any[]): any[] {
  // Transient cookies to DROP - these expire quickly (30 min or less) and should be regenerated
  const transientCookies = ['__cf_bm', 'timezone', 'sdui_ver', '_gcl_au', 'AnalyticsSyncHistory', 'UserMatchHistory'];
  
  return cookies.map(cookie => {
    // Skip transient cookies
    if (transientCookies.includes(cookie.name)) {
      return null;
    }
    
    const normalized: any = {
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.linkedin.com',
      path: cookie.path || '/',
      secure: cookie.secure !== false,
      httpOnly: cookie.httpOnly !== false,
    };
    if (cookie.expires && cookie.expires > 0) {
      normalized.expires = cookie.expires;
    }
    if (cookie.sameSite) {
      normalized.sameSite = cookie.sameSite;
    }
    return normalized;
  }).filter(c => c && c.name && c.value);
}

function sanitizeCookiesForStorage(newCookies: any[], originalCookies: any[]): any[] | null {
  const essentialNames = ['li_at', 'JSESSIONID', 'liap', 'li_mc', 'bcookie', 'bscookie', 'lidc'];
  
  const cookieMap = new Map<string, any>();
  
  for (const cookie of originalCookies) {
    if (!cookie.name || !cookie.value) continue;
    cookieMap.set(cookie.name, {
      name: cookie.name,
      value: cookie.value,
      domain: '.linkedin.com',
      path: cookie.path || '/',
      secure: cookie.secure !== false,
      httpOnly: cookie.httpOnly !== false,
      expires: cookie.expires,
      sameSite: cookie.sameSite === 'no_restriction' ? 'None' : cookie.sameSite,
    });
  }
  
  for (const cookie of newCookies) {
    if (!cookie.name || !cookie.value) continue;
    if (!cookie.domain?.includes('linkedin.com')) continue;
    
    const normalized = {
      name: cookie.name,
      value: cookie.value,
      domain: '.linkedin.com',
      path: cookie.path || '/',
      secure: cookie.secure !== false,
      httpOnly: cookie.httpOnly !== false,
      expires: cookie.expires,
      sameSite: cookie.sameSite === 'no_restriction' ? 'None' : 
                cookie.sameSite === 'unspecified' ? 'Lax' : cookie.sameSite,
    };
    
    cookieMap.set(cookie.name, normalized);
  }
  
  const liAtCookie = cookieMap.get('li_at');
  if (!liAtCookie || !liAtCookie.value) {
    console.warn('[Session KeepAlive] CRITICAL: li_at cookie missing or empty after refresh - not updating storage');
    return null;
  }
  
  const result = Array.from(cookieMap.values());
  console.log(`[Session KeepAlive] Sanitized cookies: ${result.length} cookies, li_at present: ${!!liAtCookie.value}`);
  
  return result;
}

async function pingLinkedInSession(
  workspaceId: string, 
  accountId: string, 
  cookies: any[],
  useProxy: boolean = true,
  savedProxyId?: string // CRITICAL: Use same proxy as quick_login to maintain IP consistency
): Promise<{ success: boolean; newCookies?: any[]; error?: string }> {
  if (isShuttingDown) {
    return { success: false, error: 'Service is shutting down' };
  }

  let browser: Browser | null = null;
  
  try {
    console.log(`[Session KeepAlive] Launching browser with useProxy=${useProxy}, savedProxyId=${savedProxyId || 'none'}`);
    const result = await launchLinkedInBrowser({
      cookies,
      userId: accountId,
      workspaceId,
      useProxy,
      timeout: 60000,
      savedProxyId, // Use the SAME proxy that was used during quick_login
    });

    if (!result) {
      return { success: false, error: 'Failed to launch browser' };
    }

    browser = result.browser;
    activeBrowsers.add(browser);
    const page = result.page;

    // Block images, fonts, stylesheets to save proxy data - we only need DOM for login check
    await page.setRequestInterception(true);
    page.on('request', (request: any) => {
      const resourceType = request.resourceType();
      if (['image', 'font', 'stylesheet', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    const navResult = await navigateToLinkedIn(page, 'https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    if (!navResult.success) {
      // ERR_TOO_MANY_REDIRECTS indicates expired/invalid session
      if (navResult.error?.includes('ERR_TOO_MANY_REDIRECTS')) {
        return { success: false, error: 'Session expired - LinkedIn redirect loop detected. Please reconnect your account.' };
      }
      return { success: false, error: navResult.error };
    }

    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

    const isLoggedIn = await checkLoginStatus(page);
    if (!isLoggedIn) {
      const currentUrl = page.url();
      if (currentUrl.includes('login') || currentUrl.includes('authwall') || currentUrl.includes('checkpoint')) {
        return { success: false, error: 'Session expired - login required' };
      }
    }

    const updatedCookies = await page.cookies();
    
    await browser.close();
    activeBrowsers.delete(browser);
    browser = null;

    console.log(`[Session KeepAlive] Successfully pinged LinkedIn for account ${accountId}`);
    return { success: true, newCookies: updatedCookies };
  } catch (error: any) {
    console.error(`[Session KeepAlive] Ping failed for account ${accountId}:`, error.message);
    return { success: false, error: error.message };
  } finally {
    if (browser) {
      try { 
        await browser.close(); 
        activeBrowsers.delete(browser);
      } catch (e) {}
    }
  }
}

async function refreshSession(workspaceId: string, accountId: string): Promise<boolean> {
  const sessionKey = getSessionKey(workspaceId, accountId);
  
  console.log(`[Session KeepAlive] Refreshing session for ${accountId} in workspace ${workspaceId}`);

  const sessionData = await getLinkedInSessionWithSource(workspaceId, accountId);
  if (!sessionData || sessionData.cookies.length === 0) {
    console.log(`[Session KeepAlive] No cookies found for account ${accountId}`);
    updateSessionHealth(sessionKey, {
      isHealthy: false,
      errorMessage: 'No session cookies found',
    });
    return false;
  }

  // SKIP keep-alive entirely for manual sessions!
  // Navigating to LinkedIn from a different IP (Replit server) will cause LinkedIn
  // to invalidate the session, logging the user out of their browser too.
  // Manual sessions rely on the user's browser keeping them active.
  if (sessionData.sessionSource === 'manual' || sessionData.sessionSource === 'unknown') {
    console.log(`[Session KeepAlive] SKIPPING manual session for ${accountId} - keep-alive would invalidate session`);
    // Mark as healthy to prevent alerts, but don't actually ping
    updateSessionHealth(sessionKey, {
      isHealthy: true,
      errorMessage: undefined,
    });
    return true; // Return true to prevent marking as unhealthy
  }

  // ONLY ping LinkedIn for quick_login sessions (created via automated login through proxy)
  const useProxy = true; // quick_login sessions always use proxy
  const savedProxyId = sessionData.proxyId; // Use SAME proxy to maintain IP consistency
  console.log(`[Session KeepAlive] Session source: ${sessionData.sessionSource}, useProxy: ${useProxy}, savedProxyId: ${savedProxyId || 'none'}`);

  const result = await pingLinkedInSession(workspaceId, accountId, sessionData.cookies, useProxy, savedProxyId);
  
  const health = sessionHealthMap.get(sessionKey) || {
    accountId,
    workspaceId,
    lastPing: null,
    lastSuccess: null,
    isHealthy: false,
    consecutiveFailures: 0,
    nextScheduledPing: new Date(Date.now() + KEEP_ALIVE_INTERVAL),
  };

  health.lastPing = new Date();
  health.nextScheduledPing = new Date(Date.now() + KEEP_ALIVE_INTERVAL);

  if (result.success) {
    health.lastSuccess = new Date();
    health.isHealthy = true;
    health.consecutiveFailures = 0;
    health.errorMessage = undefined;

    if (result.newCookies && result.newCookies.length > 0) {
      const sanitizedCookies = sanitizeCookiesForStorage(result.newCookies, sessionData.cookies);
      if (sanitizedCookies) {
        // FIX: Pass sourceTable to update the SAME table cookies were read from
        await updateLinkedInSessionCookies(workspaceId, accountId, sanitizedCookies, sessionData.sourceTable);
        console.log(`[Session KeepAlive] Updated cookies in ${sessionData.sourceTable} for ${accountId}`);
      } else {
        console.log(`[Session KeepAlive] Skipped cookie update for ${accountId} - sanitization returned null`);
      }
    }
  } else {
    health.consecutiveFailures++;
    health.errorMessage = result.error;
    
    if (health.consecutiveFailures >= 3) {
      health.isHealthy = false;
      console.warn(`[Session KeepAlive] Account ${accountId} marked unhealthy after ${health.consecutiveFailures} failures`);
    }
  }

  sessionHealthMap.set(sessionKey, health);
  return result.success;
}

function updateSessionHealth(sessionKey: string, updates: Partial<SessionHealth>) {
  const existing = sessionHealthMap.get(sessionKey);
  if (existing) {
    Object.assign(existing, updates);
    sessionHealthMap.set(sessionKey, existing);
  }
}

async function runKeepAliveCycle(): Promise<void> {
  if (!isRunning || isShuttingDown) return;

  console.log('[Session KeepAlive] Starting keep-alive cycle...');

  try {
    const activeAccounts = await getActiveLinkedInAccounts();
    
    if (!activeAccounts || activeAccounts.length === 0) {
      console.log('[Session KeepAlive] No active LinkedIn accounts found');
      return;
    }

    console.log(`[Session KeepAlive] Found ${activeAccounts.length} active accounts to refresh`);

    for (const account of activeAccounts) {
      if (!isRunning || isShuttingDown) break;

      const sessionKey = getSessionKey(account.workspaceId, account.accountId);
      const health = sessionHealthMap.get(sessionKey);

      if (health && health.nextScheduledPing > new Date()) {
        continue;
      }

      try {
        await refreshSession(account.workspaceId, account.accountId);
      } catch (err) {
        console.error(`[Session KeepAlive] Error refreshing ${account.accountId}:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 5000 + Math.random() * 5000));
    }
  } catch (error) {
    console.error('[Session KeepAlive] Cycle error:', error);
  }
}

export function startSessionKeepAlive(): void {
  if (isRunning) {
    console.log('[Session KeepAlive] Already running');
    return;
  }

  isRunning = true;
  isShuttingDown = false;
  console.log('[Session KeepAlive] Starting session keep-alive service...');
  console.log(`[Session KeepAlive] Ping interval: ${KEEP_ALIVE_INTERVAL / 1000 / 60} minutes`);

  // Delay first cycle to avoid blocking startup
  startupTimeout = setTimeout(() => {
    if (!isShuttingDown) {
      runKeepAliveCycle();
    }
  }, 60000);

  keepAliveInterval = setInterval(() => {
    if (!isShuttingDown) {
      runKeepAliveCycle();
    }
  }, SESSION_CHECK_INTERVAL);
}

// Graceful shutdown handlers
function setupShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`[Session KeepAlive] Received ${signal}, shutting down...`);
    await stopSessionKeepAlive();
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
}

// DISABLED: Auto-register shutdown handlers when module loads
// This was causing the workflow to shut down on SIGHUP when Vite reloads
// setupShutdownHandlers();

export async function stopSessionKeepAlive(): Promise<void> {
  isRunning = false;
  isShuttingDown = true;
  
  if (startupTimeout) {
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }
  
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
  
  // Close any active browsers
  if (activeBrowsers.size > 0) {
    console.log(`[Session KeepAlive] Closing ${activeBrowsers.size} active browser(s)...`);
    const closePromises = Array.from(activeBrowsers).map(async (browser) => {
      try {
        await browser.close();
      } catch (e) {
        // Ignore close errors during shutdown
      }
    });
    await Promise.all(closePromises);
    activeBrowsers.clear();
  }
  
  console.log('[Session KeepAlive] Service stopped');
}

export function getSessionHealth(workspaceId: string, accountId: string): SessionHealth | null {
  return sessionHealthMap.get(getSessionKey(workspaceId, accountId)) || null;
}

export function getAllSessionHealth(): SessionHealth[] {
  return Array.from(sessionHealthMap.values());
}

export async function forceRefreshSession(workspaceId: string, accountId: string): Promise<boolean> {
  return await refreshSession(workspaceId, accountId);
}

export function isKeepAliveRunning(): boolean {
  return isRunning;
}
