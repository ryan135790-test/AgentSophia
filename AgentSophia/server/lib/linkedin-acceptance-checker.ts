import { Pool } from 'pg';
import { markConnectionAccepted } from './linkedin-connection-tracker';
import { isSessionActive, getActiveSession, restoreLinkedInSession, acquireSessionLock, releaseSessionLock, isSessionLocked } from './linkedin-automation';
import { getOrAllocateProxy, revokeUserProxy } from './proxy-orchestration';
import { checkConnectionStatusViaVoyager } from './linkedin-voyager-search';

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes (Voyager API uses minimal data, matches industry standard)
const BATCH_SIZE = 25; // Check 25 pending connections per run (Voyager API is data-efficient)
const SESSION_RESTORE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hour cooldown after failed restore
const MAX_DAILY_RESTORE_ATTEMPTS = 3; // Max restore attempts per user/workspace per day

// Lock to prevent concurrent acceptance checks
let isCheckRunning = false;

// Track failed session restores to prevent runaway proxy usage
interface RestoreFailure {
  lastAttempt: Date;
  attemptCount: number;
  lastError: string;
}
const sessionRestoreFailures: Map<string, RestoreFailure> = new Map();

function shouldAttemptRestore(userId: string, workspaceId: string): { allowed: boolean; reason?: string } {
  const key = `${userId}:${workspaceId}`;
  const failure = sessionRestoreFailures.get(key);
  
  if (!failure) {
    return { allowed: true };
  }
  
  const hoursSinceLastAttempt = (Date.now() - failure.lastAttempt.getTime()) / (1000 * 60 * 60);
  
  // Reset after 24 hours
  if (hoursSinceLastAttempt >= 24) {
    sessionRestoreFailures.delete(key);
    return { allowed: true };
  }
  
  // Check if we've exceeded daily attempts
  if (failure.attemptCount >= MAX_DAILY_RESTORE_ATTEMPTS) {
    return { 
      allowed: false, 
      reason: `Exceeded ${MAX_DAILY_RESTORE_ATTEMPTS} restore attempts today (last error: ${failure.lastError}). Will retry in ${Math.ceil(24 - hoursSinceLastAttempt)}h` 
    };
  }
  
  return { allowed: true };
}

function recordRestoreFailure(userId: string, workspaceId: string, error: string): void {
  const key = `${userId}:${workspaceId}`;
  const existing = sessionRestoreFailures.get(key);
  
  if (existing) {
    existing.attemptCount++;
    existing.lastAttempt = new Date();
    existing.lastError = error;
  } else {
    sessionRestoreFailures.set(key, {
      lastAttempt: new Date(),
      attemptCount: 1,
      lastError: error
    });
  }
  
  console.log(`[Acceptance Checker] Recorded restore failure for ${key}: attempt ${sessionRestoreFailures.get(key)?.attemptCount}/${MAX_DAILY_RESTORE_ATTEMPTS}`);
}

interface PendingConnection {
  contactId: string;
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  sentAt: Date;
  workspaceId: string;
  userId: string;
}

export async function getPendingConnectionsToCheck(): Promise<PendingConnection[]> {
  const result = await pool.query(`
    SELECT DISTINCT ON (c.id)
      c.id as contact_id,
      c.first_name,
      c.last_name,
      c.linkedin_url,
      c.linkedin_connection_sent_at as sent_at,
      c.workspace_id,
      w.owner_id as user_id
    FROM contacts c
    JOIN workspaces w ON c.workspace_id = w.id
    WHERE c.linkedin_connection_status = 'pending'
      AND c.linkedin_url IS NOT NULL
      AND c.linkedin_connection_sent_at IS NOT NULL
      AND c.linkedin_connection_sent_at < NOW() - INTERVAL '5 minutes'
    ORDER BY c.id, c.linkedin_connection_sent_at ASC
    LIMIT $1
  `, [BATCH_SIZE]);
  
  return result.rows.map(row => ({
    contactId: row.contact_id,
    firstName: row.first_name,
    lastName: row.last_name,
    linkedinUrl: row.linkedin_url,
    sentAt: row.sent_at,
    workspaceId: row.workspace_id,
    userId: row.user_id
  }));
}

export async function checkConnectionAccepted(
  page: any,
  linkedinUrl: string
): Promise<{ accepted: boolean; is1stDegree: boolean; error?: string }> {
  try {
    console.log(`[Acceptance Checker] Checking profile: ${linkedinUrl}`);
    
    // Enable aggressive request interception to minimize data usage
    await page.setRequestInterception(true);
    
    const requestHandler = async (request: any) => {
      // Check if request is already handled to prevent "Request is already handled" errors
      if (request.isInterceptResolutionHandled?.()) {
        return;
      }
      
      try {
        const resourceType = request.resourceType();
        const url = request.url();
        
        // ULTRA DATA-SAVING MODE: Only allow essential document requests
        // Block: images, fonts, stylesheets, media, scripts, XHR, fetch, websocket
        const blockedTypes = ['image', 'font', 'stylesheet', 'media', 'other', 'script', 'xhr', 'fetch', 'websocket', 'manifest'];
        
        // Also block tracking/analytics URLs
        const blockedPatterns = [
          'analytics', 'tracking', 'pixel', 'beacon', 'telemetry',
          'ads', 'doubleclick', 'googlesyndication', 'facebook.com/tr',
          'li/track', 'platform.linkedin.com/litms', 'linkedin.com/li/',
          '.js', '.css', '.woff', '.ttf', '.png', '.jpg', '.gif', '.svg', '.ico'
        ];
        
        if (blockedTypes.includes(resourceType)) {
          await request.abort().catch(() => {});
          return;
        }
        
        // Check URL patterns
        const lowerUrl = url.toLowerCase();
        if (blockedPatterns.some(pattern => lowerUrl.includes(pattern))) {
          await request.abort().catch(() => {});
          return;
        }
        
        // Only allow the main document and essential XHR for profile data
        if (resourceType === 'document' || url.includes('/voyager/api/identity')) {
          await request.continue().catch(() => {});
        } else {
          await request.abort().catch(() => {});
        }
      } catch (err) {
        // Silently ignore - request was already handled by another handler
      }
    };
    
    page.on('request', requestHandler);
    
    console.log('[Acceptance Checker] Ultra data-saving mode enabled');
    
    try {
      await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('body', { timeout: 5000 });
    
    // Minimal wait for DOM to settle - reduced from 2000ms to save data
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Check for 1st degree connection indicator
    const connectionStatus = await page.evaluate(() => {
      // Check for "1st" degree badge
      const degreeElements = document.querySelectorAll('.distance-badge, [class*="degree"], span');
      let is1stDegree = false;
      
      for (const el of degreeElements) {
        const text = el.textContent?.trim().toLowerCase() || '';
        if (text === '1st' || text.includes('1st degree')) {
          is1stDegree = true;
          break;
        }
      }
      
      // Check for "Message" button (only appears for 1st degree connections)
      const hasMessageButton = !!document.querySelector('button[aria-label*="Message"]');
      
      // Check if "Connect" button is NOT present (already connected)
      const hasConnectButton = !!document.querySelector('button[aria-label*="connect" i]');
      
      // Check for "Pending" button (invitation still pending)
      const hasPendingButton = !!document.querySelector('button[aria-label*="Pending"]');
      
      return {
        is1stDegree,
        hasMessageButton,
        hasConnectButton,
        hasPendingButton
      };
    });
    
      console.log(`[Acceptance Checker] Profile status:`, connectionStatus);
      
      // Determine if connection was accepted
      const accepted = connectionStatus.is1stDegree || 
                       (connectionStatus.hasMessageButton && !connectionStatus.hasConnectButton && !connectionStatus.hasPendingButton);
      
      return {
        accepted,
        is1stDegree: connectionStatus.is1stDegree
      };
    } finally {
      // Clean up: disable request interception and remove handler
      page.off('request', requestHandler);
      await page.setRequestInterception(false);
    }
  } catch (error: any) {
    console.error(`[Acceptance Checker] Error checking profile:`, error.message);
    return {
      accepted: false,
      is1stDegree: false,
      error: error.message
    };
  }
}

export async function runAcceptanceCheck(): Promise<{
  checked: number;
  accepted: number;
  stillPending: number;
  errors: number;
}> {
  // Prevent concurrent checks
  if (isCheckRunning) {
    console.log('[Acceptance Checker] Check already in progress, skipping');
    return { checked: 0, accepted: 0, stillPending: 0, errors: 0 };
  }
  
  isCheckRunning = true;
  console.log('[Acceptance Checker] Starting acceptance check...');
  
  try {
    const pendingConnections = await getPendingConnectionsToCheck();
  
    if (pendingConnections.length === 0) {
      console.log('[Acceptance Checker] No pending connections to check');
      return { checked: 0, accepted: 0, stillPending: 0, errors: 0 };
    }
    
    console.log(`[Acceptance Checker] Found ${pendingConnections.length} pending connections to check`);
    
    let checked = 0;
    let accepted = 0;
    let stillPending = 0;
    let errors = 0;
    
    // Group by workspace/user to reuse sessions
    const byWorkspace = new Map<string, PendingConnection[]>();
  for (const conn of pendingConnections) {
    const key = `${conn.userId}/${conn.workspaceId}`;
    if (!byWorkspace.has(key)) {
      byWorkspace.set(key, []);
    }
    byWorkspace.get(key)!.push(conn);
  }
  
  for (const [key, connections] of byWorkspace) {
    const [userId, workspaceId] = key.split('/');
    
    // Acquire session lock to prevent race conditions with campaign executor
    if (!acquireSessionLock(userId, workspaceId, 'acceptance-checker')) {
      console.log(`[Acceptance Checker] Session locked, skipping ${key} (campaign execution in progress)`);
      continue;
    }
    
    try {
    let session = getActiveSession(userId, workspaceId);
    
    // If no active session, try to auto-restore
    if (!session?.page) {
      console.log(`[Acceptance Checker] No active session for ${key}, attempting auto-restore...`);
      
      // Check if we should attempt restore (prevents runaway proxy usage)
      const restoreCheck = shouldAttemptRestore(userId, workspaceId);
      if (!restoreCheck.allowed) {
        console.log(`[Acceptance Checker] Skipping restore for ${key}: ${restoreCheck.reason}`);
        continue;
      }
      
      try {
        // Get saved cookies from linkedin_puppeteer_settings table
        const cookieResult = await pool.query(`
          SELECT session_cookies_encrypted, is_active
          FROM linkedin_puppeteer_settings 
          WHERE workspace_id = $1 AND is_active = true
          LIMIT 1
        `, [workspaceId]);
        
        if (!cookieResult.rows[0]?.session_cookies_encrypted) {
          console.log(`[Acceptance Checker] No saved cookies for ${key}, skipping`);
          continue;
        }
        
        // Get proxy
        const proxyResult = await getOrAllocateProxy(userId, workspaceId);
        if (!proxyResult.success || !proxyResult.proxy) {
          console.log(`[Acceptance Checker] No proxy available for ${key}, skipping`);
          recordRestoreFailure(userId, workspaceId, 'No proxy available');
          continue;
        }
        
        // Default rate limits for acceptance checking (read-only operation)
        const rateLimits = {
          invitesSentToday: 0,
          messagesSentToday: 0,
          dailyInviteLimit: 10,
          dailyMessageLimit: 25
        };
        
        // Restore session
        const restoreResult = await restoreLinkedInSession(
          userId, 
          workspaceId, 
          cookieResult.rows[0].session_cookies_encrypted,
          proxyResult.proxy,
          rateLimits
        );
        
        if (!restoreResult.success) {
          console.log(`[Acceptance Checker] Failed to restore session for ${key}: ${restoreResult.message}`);
          
          // Check if it's a tunnel/proxy error - try rotating proxy
          const errorMsg = restoreResult.message || '';
          if (errorMsg.includes('ERR_TUNNEL_CONNECTION_FAILED') || 
              errorMsg.includes('ERR_PROXY_CONNECTION_FAILED') ||
              errorMsg.includes('net::ERR_')) {
            console.log(`[Acceptance Checker] 🔄 Tunnel error detected, rotating proxy for ${key}...`);
            try {
              // Revoke current proxy to force allocation of a new one
              await revokeUserProxy(userId, workspaceId);
              console.log(`[Acceptance Checker] ✅ Proxy revoked, will get new proxy on next attempt`);
            } catch (rotateErr: any) {
              console.log(`[Acceptance Checker] Failed to revoke proxy: ${rotateErr.message}`);
            }
          }
          
          recordRestoreFailure(userId, workspaceId, restoreResult.message || 'Session restore failed');
          continue;
        }
        
        session = getActiveSession(userId, workspaceId);
        console.log(`[Acceptance Checker] ✅ Session restored for ${key}`);
        
        // Reset is_active flag after successful restore
        try {
          await pool.query(
            `UPDATE linkedin_puppeteer_settings SET is_active = true WHERE workspace_id = $1 AND user_id = $2`,
            [workspaceId, userId]
          );
        } catch (flagErr: any) {
          console.log(`[Acceptance Checker] Warning: Failed to reset is_active: ${flagErr.message}`);
        }
      } catch (error: any) {
        console.log(`[Acceptance Checker] Error restoring session for ${key}: ${error.message}`);
        recordRestoreFailure(userId, workspaceId, error.message);
        continue;
      }
    }
    
    if (!session?.page) {
      console.log(`[Acceptance Checker] No page available for ${key}, skipping`);
      continue;
    }
    
    let tunnelErrorCount = 0;
    const MAX_TUNNEL_ERRORS = 2;
    
    for (const conn of connections) {
      try {
        checked++;
        
        // PRIMARY: Try Voyager API first (much lighter on data)
        console.log(`[Acceptance Checker] 🚀 Trying Voyager API for ${conn.firstName} ${conn.lastName}`);
        const voyagerResult = await checkConnectionStatusViaVoyager(workspaceId, userId, conn.linkedinUrl);
        
        if (voyagerResult.success) {
          console.log(`[Acceptance Checker] ✅ Voyager API: connected=${voyagerResult.isConnected}, pending=${voyagerResult.isPending}`);
          
          if (voyagerResult.isConnected) {
            accepted++;
            console.log(`[Acceptance Checker] ✅ ${conn.firstName} ${conn.lastName} ACCEPTED (via Voyager API)`);
            await markConnectionAccepted(conn.contactId);
          } else if (voyagerResult.isPending) {
            stillPending++;
            console.log(`[Acceptance Checker] ⏳ ${conn.firstName} ${conn.lastName} still pending`);
          } else {
            stillPending++;
            console.log(`[Acceptance Checker] Connection status unclear for ${conn.firstName} ${conn.lastName}`);
          }
          
          // Add small delay between API calls
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
          continue; // Skip browser fallback since Voyager worked
        }
        
        console.log(`[Acceptance Checker] Voyager API failed: ${voyagerResult.error}, falling back to browser...`);
        
        // FALLBACK: Browser automation
        // Check session is still valid
        if (!session?.page) {
          console.log(`[Acceptance Checker] Session lost, skipping remaining connections for ${key}`);
          break;
        }
        
        const result = await checkConnectionAccepted(session.page, conn.linkedinUrl);
        
        if (result.error) {
          errors++;
          console.log(`[Acceptance Checker] Error for ${conn.firstName} ${conn.lastName}: ${result.error}`);
          
          // Check for tunnel connection failure - need to refresh session
          if (result.error.includes('ERR_TUNNEL_CONNECTION_FAILED') || 
              result.error.includes('ERR_PROXY_CONNECTION_FAILED') ||
              result.error.includes('net::ERR_')) {
            tunnelErrorCount++;
            console.log(`[Acceptance Checker] ⚠️ Tunnel error ${tunnelErrorCount}/${MAX_TUNNEL_ERRORS}`);
            
            if (tunnelErrorCount >= MAX_TUNNEL_ERRORS) {
              console.log(`[Acceptance Checker] 🔄 Too many tunnel errors, refreshing session...`);
              
              // Close the broken session
              try {
                if (session?.browser) {
                  await session.browser.close();
                }
              } catch (e) {
                // Ignore close errors
              }
              
              // Wait a moment before reconnecting
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Get fresh proxy with new session ID
              const proxyResult = await getOrAllocateProxy(userId, workspaceId);
              if (!proxyResult.success || !proxyResult.proxy) {
                console.log(`[Acceptance Checker] Failed to get fresh proxy, stopping checks for ${key}`);
                break;
              }
              
              // Get saved cookies
              const cookieResult = await pool.query(`
                SELECT session_cookies_encrypted
                FROM linkedin_puppeteer_settings 
                WHERE workspace_id = $1 AND is_active = true
                LIMIT 1
              `, [workspaceId]);
              
              if (!cookieResult.rows[0]?.session_cookies_encrypted) {
                console.log(`[Acceptance Checker] No cookies found, stopping checks for ${key}`);
                break;
              }
              
              // Check if we should attempt restore (prevents runaway proxy usage)
              const restoreCheck = shouldAttemptRestore(userId, workspaceId);
              if (!restoreCheck.allowed) {
                console.log(`[Acceptance Checker] Skipping tunnel recovery restore: ${restoreCheck.reason}`);
                break;
              }
              
              // Restore with fresh session
              const rateLimits = {
                invitesSentToday: 0,
                messagesSentToday: 0,
                dailyInviteLimit: 10,
                dailyMessageLimit: 25
              };
              
              const restoreResult = await restoreLinkedInSession(
                userId, 
                workspaceId, 
                cookieResult.rows[0].session_cookies_encrypted,
                proxyResult.proxy,
                rateLimits
              );
              
              if (!restoreResult.success) {
                console.log(`[Acceptance Checker] Failed to restore fresh session, stopping: ${restoreResult.message}`);
                recordRestoreFailure(userId, workspaceId, restoreResult.message || 'Tunnel recovery restore failed');
                break;
              }
              
              session = getActiveSession(userId, workspaceId);
              tunnelErrorCount = 0;
              console.log(`[Acceptance Checker] ✅ Session refreshed successfully`);
              
              // Reset is_active flag after tunnel recovery
              try {
                await pool.query(
                  `UPDATE linkedin_puppeteer_settings SET is_active = true WHERE workspace_id = $1 AND user_id = $2`,
                  [workspaceId, userId]
                );
              } catch (flagErr: any) {
                console.log(`[Acceptance Checker] Warning: Failed to reset is_active: ${flagErr.message}`);
              }
            }
          }
          continue;
        }
        
        // Reset tunnel error count on successful check
        tunnelErrorCount = 0;
        
        if (result.accepted) {
          accepted++;
          await markConnectionAccepted(conn.contactId);
          console.log(`[Acceptance Checker] ✅ ${conn.firstName} ${conn.lastName} ACCEPTED connection!`);
        } else {
          stillPending++;
          console.log(`[Acceptance Checker] ⏳ ${conn.firstName} ${conn.lastName} still pending`);
        }
        
        // Rate limit between checks
        await new Promise(resolve => setTimeout(resolve, 1500));
        
      } catch (error: any) {
        errors++;
        console.error(`[Acceptance Checker] Error processing ${conn.firstName}:`, error.message);
      }
    }
    } finally {
      // Always release the session lock for this workspace
      releaseSessionLock(userId, workspaceId, 'acceptance-checker');
    }
  }
  
  console.log(`[Acceptance Checker] Complete: ${checked} checked, ${accepted} accepted, ${stillPending} pending, ${errors} errors`);
  
  return { checked, accepted, stillPending, errors };
  } finally {
    isCheckRunning = false;
  }
}

let acceptanceCheckInterval: NodeJS.Timeout | null = null;

export function startAcceptanceChecker(): void {
  if (acceptanceCheckInterval) {
    console.log('[Acceptance Checker] Already running');
    return;
  }
  
  console.log(`[Acceptance Checker] Started - checking every ${CHECK_INTERVAL_MS / 60000} minutes`);
  
  // Run immediately on start
  runAcceptanceCheck().catch(err => console.error('[Acceptance Checker] Initial run error:', err));
  
  // Then run periodically
  acceptanceCheckInterval = setInterval(() => {
    runAcceptanceCheck().catch(err => console.error('[Acceptance Checker] Periodic run error:', err));
  }, CHECK_INTERVAL_MS);
}

export function stopAcceptanceChecker(): void {
  if (acceptanceCheckInterval) {
    clearInterval(acceptanceCheckInterval);
    acceptanceCheckInterval = null;
    console.log('[Acceptance Checker] Stopped');
  }
}

// Manual trigger endpoint helper
export async function triggerAcceptanceCheck(): Promise<{
  checked: number;
  accepted: number;
  stillPending: number;
  errors: number;
}> {
  return runAcceptanceCheck();
}
