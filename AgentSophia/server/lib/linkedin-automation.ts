import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer-core';
import { execSync } from 'child_process';
import { decryptToken } from './encryption';
import { 
  LinkedInSafety, 
  performSafetyCheck, 
  recordActionResult, 
  getRandomActionDelay,
  getSafetyStatus,
  initializeSafetySettings 
} from './linkedin-safety';
import type { UserLinkedInSettings } from '../../shared/schema';
import { revokeUserProxy, getOrAllocateProxy } from './proxy-orchestration';

// Enable stealth plugin for anti-detection
puppeteerExtra.use(StealthPlugin());

// Proxy health tracking
const proxyHealthMap = new Map<string, { failures: number; lastFailure: Date; healthy: boolean }>();
const MAX_PROXY_FAILURES = 3;
const PROXY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown after max failures

function isProxyError(error: string | Error): boolean {
  const errorStr = typeof error === 'string' ? error : error.message;
  return errorStr.includes('ERR_TUNNEL_CONNECTION_FAILED') ||
         errorStr.includes('ERR_PROXY_CONNECTION_FAILED') ||
         errorStr.includes('ERR_TUNNEL') ||
         errorStr.includes('ERR_PROXY') ||
         errorStr.includes('PROXY_AUTH_ERROR') ||
         errorStr.includes('HTTP ERROR 407') ||
         errorStr.includes('net::ERR_CONNECTION_RESET') ||
         errorStr.includes('net::ERR_CONNECTION_REFUSED');
}

async function handleProxyFailure(userId: string, workspaceId: string, error: string): Promise<void> {
  const key = `${userId}:${workspaceId}`;
  const health = proxyHealthMap.get(key) || { failures: 0, lastFailure: new Date(0), healthy: true };
  
  health.failures++;
  health.lastFailure = new Date();
  
  console.log(`[Proxy Resilience] Failure #${health.failures} for ${key.slice(0,16)}: ${error.slice(0,50)}`);
  
  if (health.failures >= MAX_PROXY_FAILURES) {
    health.healthy = false;
    console.log(`[Proxy Resilience] Proxy marked unhealthy after ${MAX_PROXY_FAILURES} failures, rotating...`);
    
    // Revoke the current proxy allocation to force a new one
    try {
      await revokeUserProxy(userId, workspaceId);
      console.log(`[Proxy Resilience] ✅ Proxy revoked, will get fresh proxy on next attempt`);
    } catch (revokeError) {
      console.error(`[Proxy Resilience] Failed to revoke proxy:`, revokeError);
    }
    
    // Reset failure count after rotation
    health.failures = 0;
  }
  
  proxyHealthMap.set(key, health);
}

function resetProxyHealth(userId: string, workspaceId: string): void {
  const key = `${userId}:${workspaceId}`;
  proxyHealthMap.set(key, { failures: 0, lastFailure: new Date(0), healthy: true });
}

// Exponential backoff delay
function getBackoffDelay(attempt: number): number {
  const baseDelay = 2000; // 2 seconds
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  return delay + Math.random() * 1000; // Add jitter
}

// Resilient operation wrapper with automatic proxy rotation and retry
export async function withProxyResilience<T>(
  userId: string,
  workspaceId: string,
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    onProxyError?: () => Promise<void>;
    operationName?: string;
  } = {}
): Promise<T> {
  const { maxRetries = 3, onProxyError, operationName = 'operation' } = options;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await operation();
      
      // If successful, reset health counter
      resetProxyHealth(userId, workspaceId);
      
      return result;
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      
      if (isProxyError(errorMessage)) {
        console.log(`[Proxy Resilience] ${operationName} failed with proxy error (attempt ${attempt + 1}/${maxRetries}): ${errorMessage.slice(0,60)}`);
        
        // Track the failure and potentially rotate proxy
        await handleProxyFailure(userId, workspaceId, errorMessage);
        
        // Close existing session to force fresh proxy on next attempt
        if (onProxyError) {
          try {
            await onProxyError();
          } catch (cleanupError) {
            console.error(`[Proxy Resilience] Cleanup error:`, cleanupError);
          }
        }
        
        if (attempt < maxRetries - 1) {
          const delay = getBackoffDelay(attempt);
          console.log(`[Proxy Resilience] Waiting ${Math.round(delay/1000)}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Non-proxy error or max retries reached
      throw error;
    }
  }
  
  throw new Error(`${operationName} failed after ${maxRetries} attempts`);
}

interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  stickySessionId?: string;
  provider?: string;
}

function formatProxyUsername(baseUsername: string, sessionId: string | undefined, provider?: string, port?: number): string {
  if (!sessionId) return baseUsername;
  
  switch (provider?.toLowerCase()) {
    case 'anyip':
      return `${baseUsername},session_${sessionId}`;
    case 'iproyal':
      return `${baseUsername}_session-${sessionId}`;
    case 'oxylabs':
      return baseUsername.includes('-sessid-') 
        ? baseUsername.replace(/-sessid-[^-]+/, `-sessid-${sessionId}`)
        : `${baseUsername}-sessid-${sessionId}`;
    case 'smartproxy':
    case 'decodo':
      // CRITICAL: Only Decodo port 7000 requires sticky session format
      // All other Decodo ports (10018, 10048, 10050, etc.) use raw username
      if (port !== 7000) {
        console.log(`[Proxy Auth] Decodo port ${port} detected - using raw username (no session params)`);
        return baseUsername;
      }
      // Decodo port 7000: CORRECT format per official docs
      // Format: user-{username}-session-{id}-sessionduration-{minutes}
      // Note: baseUsername might already have 'user-' prefix or not
      const cleanUsername = baseUsername.startsWith('user-') ? baseUsername.slice(5) : baseUsername;
      return `user-${cleanUsername}-session-${sessionId}-sessionduration-30`;
    case 'brightdata':
    case 'bright_data':
      return `${baseUsername}-session-${sessionId}`;
    default:
      return `${baseUsername}-session-${sessionId}`;
  }
}

interface LinkedInSession {
  browser: Browser;
  page: Page;
  userId: string;
  workspaceId: string;
  lastActivity: Date;
  dailyInvitesSent: number;
  dailyMessagesSent: number;
  dailyInviteLimit: number;
  dailyMessageLimit: number;
  settings?: UserLinkedInSettings;
}

interface AutomationResult {
  success: boolean;
  message: string;
  data?: any;
  safetyUpdate?: Partial<UserLinkedInSettings>;
}

interface RateLimits {
  dailyInviteLimit: number;
  dailyMessageLimit: number;
  invitesSentToday: number;
  messagesSentToday: number;
}

function getSessionKey(userId: string, workspaceId: string): string {
  return `${userId}:${workspaceId}`;
}

const activeSessions: Map<string, LinkedInSession> = new Map();

// Session locks to prevent concurrent access (acceptance checker vs campaign executor race condition)
const sessionLocks: Map<string, { locked: boolean; lockedBy: string; lockedAt: Date }> = new Map();

export function acquireSessionLock(userId: string, workspaceId: string, caller: string): boolean {
  const key = getSessionKey(userId, workspaceId);
  const lock = sessionLocks.get(key);
  
  // Check if already locked
  if (lock?.locked) {
    // Auto-release if locked for more than 60 seconds (stale lock)
    const lockAge = Date.now() - lock.lockedAt.getTime();
    if (lockAge > 60000) {
      console.log(`[Session Lock] Releasing stale lock for ${key} (locked by ${lock.lockedBy} for ${Math.round(lockAge/1000)}s)`);
    } else {
      console.log(`[Session Lock] Cannot acquire lock for ${key} - already locked by ${lock.lockedBy}`);
      return false;
    }
  }
  
  sessionLocks.set(key, { locked: true, lockedBy: caller, lockedAt: new Date() });
  console.log(`[Session Lock] Acquired by ${caller} for ${key}`);
  return true;
}

export function releaseSessionLock(userId: string, workspaceId: string, caller: string): void {
  const key = getSessionKey(userId, workspaceId);
  const lock = sessionLocks.get(key);
  
  if (lock?.locked && lock.lockedBy === caller) {
    sessionLocks.set(key, { locked: false, lockedBy: '', lockedAt: new Date() });
    console.log(`[Session Lock] Released by ${caller} for ${key}`);
  }
}

export function isSessionLocked(userId: string, workspaceId: string): boolean {
  const key = getSessionKey(userId, workspaceId);
  const lock = sessionLocks.get(key);
  if (!lock?.locked) return false;
  
  // Check for stale lock
  const lockAge = Date.now() - lock.lockedAt.getTime();
  return lockAge < 60000;
}

// Dynamic Chromium path resolution
let cachedChromiumPath: string | undefined = undefined;
let chromiumPathChecked = false;

function getChromiumPath(): string | undefined {
  if (chromiumPathChecked) return cachedChromiumPath;
  chromiumPathChecked = true;
  
  // Try environment variable first
  if (process.env.CHROMIUM_PATH) {
    try {
      execSync(`test -x "${process.env.CHROMIUM_PATH}"`, { timeout: 2000 });
      cachedChromiumPath = process.env.CHROMIUM_PATH;
      console.log(`[LinkedIn Automation] Using CHROMIUM_PATH: ${cachedChromiumPath}`);
      return cachedChromiumPath;
    } catch {}
  }
  
  // Use 'which chromium' for system-installed version
  try {
    const whichPath = execSync('which chromium 2>/dev/null', { encoding: 'utf8', timeout: 2000 }).trim();
    if (whichPath) {
      cachedChromiumPath = whichPath;
      console.log(`[LinkedIn Automation] Using system chromium: ${cachedChromiumPath}`);
      return cachedChromiumPath;
    }
  } catch {}
  
  // Fallback to known Nix store path
  const fallbackPath = '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium';
  try {
    execSync(`test -x "${fallbackPath}"`, { timeout: 2000 });
    cachedChromiumPath = fallbackPath;
    console.log(`[LinkedIn Automation] Using fallback path: ${cachedChromiumPath}`);
    return cachedChromiumPath;
  } catch {}
  
  // Last resort - return undefined to let puppeteer use its bundled chromium
  console.log('[LinkedIn Automation] No system chromium found, letting puppeteer use bundled browser');
  cachedChromiumPath = undefined;
  return cachedChromiumPath;
}

// BROWSER FINGERPRINT RANDOMIZATION
// Each user gets a unique but consistent browser fingerprint based on their session
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
];

const LANGUAGES = [
  'en-US,en;q=0.9',
  'en-US,en;q=0.9,es;q=0.8',
  'en-GB,en;q=0.9,en-US;q=0.8',
  'en-US,en;q=0.9,fr;q=0.8',
];

// Generate consistent fingerprint for a user (same user always gets same fingerprint)
function getUserFingerprint(userId: string) {
  // Simple hash to get consistent index for user
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    userAgent: USER_AGENTS[hash % USER_AGENTS.length],
    resolution: SCREEN_RESOLUTIONS[hash % SCREEN_RESOLUTIONS.length],
    language: LANGUAGES[hash % LANGUAGES.length],
    // Randomize but consistent platform hints
    platform: hash % 3 === 0 ? 'MacIntel' : hash % 3 === 1 ? 'Win32' : 'Linux x86_64',
  };
}

// ENHANCED HUMAN-LIKE DELAYS with more variance
const HUMAN_DELAYS = {
  typing: { min: 35, max: 180 },           // Varied typing speed
  click: { min: 80, max: 400 },            // Natural click hesitation
  navigation: { min: 2500, max: 7000 },    // Page load observation time
  betweenActions: { min: 1500, max: 5000 }, // Thinking time between actions
  scrollPause: { min: 400, max: 2000 },    // Reading/scanning pause
  formFill: { min: 800, max: 2500 },       // Form field transition
  buttonHover: { min: 200, max: 600 },     // Pre-click hover
  pageRead: { min: 3000, max: 8000 },      // Reading page content
};

function randomDelay(type: keyof typeof HUMAN_DELAYS): number {
  const { min, max } = HUMAN_DELAYS[type];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await sleep(randomDelay('click'));
  
  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(randomDelay('typing'));
  }
}

async function humanClick(page: Page, selector: string): Promise<void> {
  const element = await page.$(selector);
  if (!element) throw new Error(`Element not found: ${selector}`);
  
  const box = await element.boundingBox();
  if (!box) throw new Error(`Cannot get bounding box for: ${selector}`);
  
  const x = box.x + box.width * (0.3 + Math.random() * 0.4);
  const y = box.y + box.height * (0.3 + Math.random() * 0.4);
  
  await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 10) });
  await sleep(randomDelay('click'));
  await page.mouse.click(x, y);
}

async function randomScroll(page: Page): Promise<void> {
  const scrollAmount = 100 + Math.floor(Math.random() * 300);
  await page.evaluate((amount) => {
    window.scrollBy({ top: amount, behavior: 'smooth' });
  }, scrollAmount);
  await sleep(randomDelay('scrollPause'));
}

export async function createLinkedInSession(
  userId: string,
  workspaceId: string,
  proxyConfig: ProxyConfig,
  rateLimits: RateLimits
): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  try {
    const sessionKey = getSessionKey(userId, workspaceId);
    const existingSession = activeSessions.get(sessionKey);
    if (existingSession) {
      try {
        const pages = await existingSession.browser.pages();
        if (pages.length > 0) {
          return { success: true, sessionId: sessionKey };
        }
      } catch {
        activeSessions.delete(sessionKey);
      }
    }

    if (!proxyConfig.username || !proxyConfig.password) {
      return { success: false, error: 'Proxy credentials not configured' };
    }

    // Credentials come already decrypted from getOrAllocateProxy in proxy-orchestration.ts
    // Do NOT decrypt again - that was causing 407 auth failures
    const proxyUsername = formatProxyUsername(proxyConfig.username, proxyConfig.stickySessionId, proxyConfig.provider, proxyConfig.port);
    const proxyPassword = proxyConfig.password;

    console.log(`[LinkedIn Automation] Proxy auth debug:`);
    console.log(`[LinkedIn Automation]   → Provider: ${proxyConfig.provider}`);
    console.log(`[LinkedIn Automation]   → Base username length: ${proxyConfig.username.length}`);
    console.log(`[LinkedIn Automation]   → Password length: ${proxyPassword.length}`);
    console.log(`[LinkedIn Automation]   → Session ID: ${proxyConfig.stickySessionId}`);
    console.log(`[LinkedIn Automation]   → Final username: ${proxyUsername.substring(0, 20)}...`);

    const proxyUrl = `http://${proxyConfig.host}:${proxyConfig.port}`;
    
    // Get consistent fingerprint for this user
    const fingerprint = getUserFingerprint(userId);
    
    const chromiumPath = getChromiumPath();
    console.log(`[LinkedIn Automation] Creating session with proxy ${proxyConfig.host}:${proxyConfig.port}, session: ${proxyConfig.stickySessionId || 'none'}, fingerprint: ${fingerprint.platform}`);
    console.log(`[LinkedIn Automation] Chromium path: ${chromiumPath || 'puppeteer default'}`);

    const browser = await puppeteerExtra.launch({
      executablePath: chromiumPath || undefined,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        `--proxy-server=${proxyUrl}`,
        `--window-size=${fingerprint.resolution.width},${fingerprint.resolution.height}`,
      ],
      defaultViewport: {
        width: fingerprint.resolution.width,
        height: fingerprint.resolution.height,
        deviceScaleFactor: 1,
        isMobile: false,
      },
    });

    const page = await browser.newPage();
    
    // Set longer default timeouts for proxy connections
    page.setDefaultNavigationTimeout(90000); // 90 seconds for navigation
    page.setDefaultTimeout(60000); // 60 seconds for other operations

    console.log(`[LinkedIn Automation] Authenticating with proxy:`);
    console.log(`[LinkedIn Automation]   → username: ${proxyUsername}`);
    console.log(`[LinkedIn Automation]   → password length: ${proxyPassword?.length || 0}`);
    console.log(`[LinkedIn Automation]   → password first 3 chars: ${proxyPassword?.substring(0, 3)}`);
    
    await page.authenticate({
      username: proxyUsername,
      password: proxyPassword,
    });

    // Set user-specific fingerprint
    await page.setUserAgent(fingerprint.userAgent);

    await page.setExtraHTTPHeaders({
      'Accept-Language': fingerprint.language,
      'Accept-Encoding': 'gzip, deflate, br',
    });
    
    // DATA-SAVING MODE: Block non-essential resources to minimize bandwidth
    await page.setRequestInterception(true);
    page.on('request', async (request: any) => {
      // Check if request is already handled
      if (request.isInterceptResolutionHandled?.()) {
        return;
      }
      
      try {
        const resourceType = request.resourceType();
        const url = request.url();
        
        // Block heavy resources that aren't needed for automation
        const blockedTypes = ['image', 'font', 'media', 'other', 'manifest'];
        
        // Block tracking/analytics URLs
        const blockedPatterns = [
          'analytics', 'tracking', 'pixel', 'beacon', 'telemetry',
          'ads', 'doubleclick', 'googlesyndication', 'facebook.com/tr',
          'li.protechts.net', 'www.linkedin.com/li/track',
          'platform.linkedin.com/litms', 'realtime.www.linkedin.com'
        ];
        
        // Allow essential resources
        const essentialPatterns = [
          'linkedin.com/voyager', 'linkedin.com/login', 
          'linkedin.com/uas', 'linkedin.com/checkpoint',
          '/feed/', '/in/', '/mynetwork/', '/messaging/'
        ];
        
        const isBlocked = blockedTypes.includes(resourceType) ||
                         blockedPatterns.some(p => url.includes(p));
        const isEssential = essentialPatterns.some(p => url.includes(p));
        
        if (isBlocked && !isEssential) {
          await request.abort().catch(() => {});
        } else {
          await request.continue().catch(() => {});
        }
      } catch (err) {
        // Silently ignore - request was already handled
      }
    });
    
    // Override navigator properties to match fingerprint
    await page.evaluateOnNewDocument((platform) => {
      Object.defineProperty(navigator, 'platform', { get: () => platform });
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    }, fingerprint.platform);

    activeSessions.set(sessionKey, {
      browser,
      page,
      userId,
      workspaceId,
      lastActivity: new Date(),
      dailyInvitesSent: rateLimits.invitesSentToday,
      dailyMessagesSent: rateLimits.messagesSentToday,
      dailyInviteLimit: rateLimits.dailyInviteLimit,
      dailyMessageLimit: rateLimits.dailyMessageLimit,
    });

    return { success: true, sessionId: sessionKey };
  } catch (error: any) {
    console.error('Failed to create LinkedIn session:', error);
    return { success: false, error: error.message };
  }
}

export async function restoreLinkedInSession(
  userId: string,
  workspaceId: string,
  cookies: string,
  proxyConfig: ProxyConfig,
  rateLimits: RateLimits
): Promise<AutomationResult> {
  try {
    const sessionKey = getSessionKey(userId, workspaceId);
    const sessionResult = await createLinkedInSession(userId, workspaceId, proxyConfig, rateLimits);
    if (!sessionResult.success) {
      return { success: false, message: sessionResult.error || 'Failed to create session' };
    }

    const session = activeSessions.get(sessionKey);
    if (!session) {
      return { success: false, message: 'Session not found after creation' };
    }

    const decryptedCookies = decryptToken(cookies);
    const parsedCookies = JSON.parse(decryptedCookies);

    await session.page.setCookie(...parsedCookies);

    console.log(`[LinkedIn Restore] Navigating to LinkedIn feed...`);
    const response = await session.page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded', // Use faster wait condition first
      timeout: 90000, // Increase timeout to 90s for slow proxy connections
    });
    
    // Check for proxy authentication errors (407)
    const currentUrl = session.page.url();
    const status = response?.status();
    
    console.log(`[LinkedIn Restore] Navigation result - URL: ${currentUrl}, Status: ${status}`);
    
    if (currentUrl.includes('chrome-error://') || status === 407) {
      await closeLinkedInSession(userId, workspaceId);
      return { success: false, message: 'PROXY_AUTH_ERROR: Proxy authentication failed (HTTP 407)' };
    }
    
    // CRITICAL: Check if we ended up on a login/signup page - session cookies are invalid
    const isLoginPage = currentUrl.includes('/login') || 
                        currentUrl.includes('/signup') || 
                        currentUrl.includes('/uas/login') ||
                        currentUrl.includes('/checkpoint') ||
                        currentUrl.includes('/authwall');
    
    if (isLoginPage) {
      console.log(`[LinkedIn Restore] FAILED - Landed on login page: ${currentUrl}`);
      await closeLinkedInSession(userId, workspaceId);
      return { success: false, message: 'SESSION_LOGGED_OUT: Session cookies expired, re-authentication required' };
    }

    await sleep(randomDelay('navigation'));

    const pageStatus = await session.page.evaluate(() => {
      const bodyText = document.body?.innerText || '';
      const title = document.title || '';
      // Check for proxy error pages
      if (bodyText.includes('HTTP ERROR 407') || bodyText.includes('Proxy Authentication Required')) {
        return { loggedIn: false, isProxyError: true };
      }
      // Check for connection errors (proxy tunnel failures often show this)
      if (bodyText.includes('ERR_TUNNEL') || bodyText.includes('ERR_CONNECTION') || 
          bodyText.includes('ERR_PROXY') || bodyText.includes('This site can') ||
          title.includes('can\'t be reached') || title.includes('error')) {
        return { loggedIn: false, isProxyError: true };
      }
      // Check for login indicators
      if (title.includes('Sign In') || title.includes('Sign Up') || title.includes('Log In')) {
        return { loggedIn: false, isProxyError: false };
      }
      const hasLoginForm = document.querySelector('.join-form') || 
             document.querySelector('[data-tracking-control-name="guest_homepage-basic_sign-in-submit"]') ||
             document.querySelector('input[name="session_password"]');
      return { loggedIn: !hasLoginForm, isProxyError: false };
    });

    if (!pageStatus.loggedIn) {
      await closeLinkedInSession(userId, workspaceId);
      // Return different error message based on whether it's a proxy error
      if (pageStatus.isProxyError) {
        return { success: false, message: 'PROXY_TUNNEL_FAILED: Proxy connection error, will retry with new port' };
      }
      return { success: false, message: 'SESSION_LOGGED_OUT: Session cookies expired, please re-authenticate' };
    }

    // Extract profile name from page and update database if we got a better name
    try {
      const pageTitle = await session.page.title();
      console.log(`[LinkedIn Restore] Page title: ${pageTitle}`);
      
      let profileName: string | null = null;
      
      // First try: LinkedIn titles are typically "(22) FirstName LastName | LinkedIn" or "FirstName LastName | LinkedIn"
      if (pageTitle && pageTitle.includes('|')) {
        // Remove notification count like "(22) " if present
        let cleanTitle = pageTitle.replace(/^\(\d+\)\s*/, '');
        const namePart = cleanTitle.split('|')[0].trim();
        if (namePart && namePart.length > 2 && namePart.length < 50 && 
            !namePart.toLowerCase().includes('linkedin') && namePart !== 'Feed') {
          profileName = namePart;
          console.log(`[LinkedIn Restore] Got name from title: ${profileName}`);
        }
      }
      
      // Second try: Look for user name on the feed page sidebar
      if (!profileName) {
        profileName = await session.page.evaluate(() => {
          // Try to find the user's name from the feed page left sidebar
          const nameSelectors = [
            '.feed-identity-module__actor-meta a',
            '.artdeco-entity-lockup__title',
            '.feed-identity-module__member-photo + div a',
            '[data-test-feed-identity-module] a',
            '.profile-rail-card__actor-link',
          ];
          for (const selector of nameSelectors) {
            const el = document.querySelector(selector);
            const text = el?.textContent?.trim();
            if (text && text.length > 2 && text.length < 50) {
              return text;
            }
          }
          return null;
        });
        if (profileName) {
          console.log(`[LinkedIn Restore] Got name from feed sidebar: ${profileName}`);
        }
      }
      
      // Update database if we got a valid name
      if (profileName) {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          const { error } = await supabase
            .from('linkedin_puppeteer_settings')
            .update({ profile_name: profileName })
            .eq('workspace_id', workspaceId);
          if (!error) {
            console.log(`[LinkedIn Restore] Updated profile_name to: ${profileName}`);
          }
        }
      }
    } catch (e) {
      // Non-critical - just log and continue
      console.log('[LinkedIn Restore] Could not extract/update profile name:', e);
    }

    return { success: true, message: 'Session restored successfully' };
  } catch (error: any) {
    console.error('Failed to restore LinkedIn session:', error);
    await closeLinkedInSession(userId, workspaceId);
    
    // Check if this is a proxy tunnel error (not a session issue)
    if (isProxyError(error)) {
      return { success: false, message: `PROXY_TUNNEL_FAILED: ${error.message}` };
    }
    
    return { success: false, message: error.message };
  }
}

export async function sendConnectionRequest(
  userId: string,
  workspaceId: string,
  profileUrl: string,
  note?: string
): Promise<AutomationResult> {
  const sessionKey = getSessionKey(userId, workspaceId);
  const session = activeSessions.get(sessionKey);
  if (!session) {
    return { success: false, message: 'No active session found' };
  }

  // IMPORTANT: Regular LinkedIn does NOT support adding notes to connection requests
  // Notes are only available with Sales Navigator. Attempting to add notes on regular
  // LinkedIn triggers CAPTCHA. Always send without note for regular LinkedIn.
  const effectiveNote = undefined; // Force no note for regular LinkedIn
  console.log('[LinkedIn Connect] Note disabled for regular LinkedIn (Sales Navigator required for notes)');

  try {
    session.lastActivity = new Date();

    console.log('[LinkedIn Connect] Navigating to profile:', profileUrl);
    await session.page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });

    await sleep(randomDelay('navigation'));
    
    // CRITICAL: Check if we're on a login/signup page - means session is logged out
    const currentUrl = session.page.url();
    const isLoginPage = currentUrl.includes('/login') || 
                        currentUrl.includes('/signup') || 
                        currentUrl.includes('/uas/login') ||
                        currentUrl.includes('/checkpoint') ||
                        currentUrl.includes('/authwall');
    
    if (isLoginPage) {
      console.log('[LinkedIn Connect] LOGGED OUT - Landed on login page:', currentUrl);
      // Invalidate the session since we're logged out
      activeSessions.delete(sessionKey);
      return { 
        success: false, 
        message: 'SESSION_LOGGED_OUT: LinkedIn session expired, re-authentication required',
        data: { needsReauth: true }
      };
    }
    
    await randomScroll(session.page);

    const pageState = await session.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.innerText?.trim() || '',
        ariaLabel: b.getAttribute('aria-label') || '',
        className: b.className || ''
      }));
      const pendingEl = document.querySelector('button[aria-label*="Pending"]') || 
                        document.querySelector('span.artdeco-button__text');
      const isPending = pendingEl?.textContent?.includes('Pending');
      const isConnected = !!document.querySelector('button[aria-label*="Message"]');
      const hasFollow = !!document.querySelector('button[aria-label*="Follow"]');
      const title = document.title || '';
      return { buttons: buttons.slice(0, 10), isPending, isConnected, hasFollow, title };
    });
    
    console.log('[LinkedIn Connect] Page state:', JSON.stringify({
      title: pageState.title,
      isPending: pageState.isPending,
      isConnected: pageState.isConnected,
      hasFollow: pageState.hasFollow,
      buttonCount: pageState.buttons.length
    }));

    // Debug: If page title doesn't look like a profile, log more info
    if (!pageState.title.includes('LinkedIn') || pageState.title === 'www.linkedin.com' || pageState.title.includes('Sign In')) {
      const pageDebug = await session.page.evaluate(() => {
        const url = window.location.href;
        const h1 = document.querySelector('h1')?.textContent?.trim() || '';
        const bodyText = document.body?.innerText?.substring(0, 500) || '';
        const errorMsgs = Array.from(document.querySelectorAll('.error, .alert, [role="alert"]')).map(el => el.textContent?.trim()).slice(0, 3);
        return { url, h1, bodyText, errorMsgs };
      });
      console.log('[LinkedIn Connect] Page debug - URL:', pageDebug.url);
      console.log('[LinkedIn Connect] Page debug - H1:', pageDebug.h1);
      console.log('[LinkedIn Connect] Page debug - Body preview:', pageDebug.bodyText?.substring(0, 200));
      if (pageDebug.errorMsgs.length > 0) {
        console.log('[LinkedIn Connect] Page debug - Error messages:', pageDebug.errorMsgs);
      }
      
      // Check for invalid/non-existent page - should delete contact
      const isInvalidPage = pageDebug.bodyText?.includes("This page doesn't exist") ||
                            pageDebug.bodyText?.includes("Page not found") ||
                            pageDebug.bodyText?.includes("profile is not available") ||
                            pageDebug.url?.includes('/search/results/') ||
                            pageDebug.h1 === 'LinkedIn';
      
      if (isInvalidPage) {
        console.log('[LinkedIn Connect] INVALID_PROFILE_URL detected - page does not exist or is a search URL');
        return {
          success: false,
          message: 'INVALID_PROFILE_URL: This LinkedIn profile does not exist or URL is invalid',
          data: { status: 'invalid_url', profileUrl, shouldDelete: true }
        };
      }
    }

    if (pageState.isPending) {
      console.log('[LinkedIn Connect] Connection already pending - skipping');
      return { success: true, message: 'Connection request already pending', data: { status: 'pending', profileUrl } };
    }

    // Check if already connected - if there's a Message button and it's a 1st degree connection
    // Note: hasFollow being true with isConnected could mean it's someone you follow but aren't connected to
    if (pageState.isConnected) {
      // Double-check by looking for "1st" degree indicator
      const connectionDegree = await session.page.evaluate(() => {
        const degreeEl = document.querySelector('.distance-badge, span.dist-value, .pv-text-details__separator');
        const degreeText = degreeEl?.textContent?.trim() || '';
        const bodyText = document.body?.innerText || '';
        const is1stDegree = degreeText.includes('1st') || bodyText.includes('1st degree connection');
        const isPending = bodyText.includes('Pending') || !!document.querySelector('[aria-label*="Pending"]');
        return { is1stDegree, isPending, degreeText };
      });
      
      console.log('[LinkedIn Connect] Connection degree check:', connectionDegree);
      
      if (connectionDegree.isPending) {
        return { success: true, message: 'Connection request already pending', data: { status: 'pending', profileUrl } };
      }
      
      if (connectionDegree.is1stDegree) {
        console.log('[LinkedIn Connect] Already 1st degree connection - skipping');
        return { success: true, message: 'Already connected (1st degree)', data: { status: 'connected', profileUrl } };
      }
    }

    // COMPREHENSIVE CSS selectors for Connect button - LinkedIn moves this around frequently
    const connectSelectors = [
      // Primary button selectors (most common locations)
      'button[aria-label*="Connect"]',
      'button[aria-label*="Invite"][aria-label*="connect"]',
      'button[aria-label*="Connect with"]',
      
      // Profile actions area
      'button.pvs-profile-actions__action',
      'div.pvs-profile-actions button',
      'div.pvs-profile-actions__action button',
      '.pv-top-card-v2-ctas button',
      '.pv-top-card--list button',
      
      // Action bar buttons
      'section.artdeco-card button.artdeco-button--primary',
      '.artdeco-card button.artdeco-button--2',
      '.artdeco-card button.artdeco-button--secondary',
      
      // Profile header area
      '.ph5 button.artdeco-button',
      '.scaffold-layout__main button.artdeco-button',
      
      // New LinkedIn UI (2024+)
      '[data-test-id="connect-button"]',
      '[data-control-name="connect"]',
      'button[data-control-name="srp_profile_actions"]',
      
      // Search results page connect buttons
      '.entity-result__actions button',
      '.search-result__actions button',
      '.reusable-search__result-container button',
      
      // Generic fallbacks
      'main button.artdeco-button--primary',
      'main button.artdeco-button--secondary'
    ];

    let connectButton: import('puppeteer').ElementHandle<Element> | null = null;
    
    // First try standard CSS selectors
    console.log('[LinkedIn Connect] Searching for Connect button with', connectSelectors.length, 'selector patterns...');
    for (const selector of connectSelectors) {
      try {
        const elements = await session.page.$$(selector);
        for (const el of elements) {
          const text = await el.evaluate(e => e.textContent?.trim().toLowerCase() || '');
          const label = await el.evaluate(e => e.getAttribute('aria-label')?.toLowerCase() || '');
          if ((text === 'connect' || text.includes('connect')) && !text.includes('pending') && !text.includes('disconnect')) {
            connectButton = el;
            console.log('[LinkedIn Connect] Found button with selector:', selector, 'text:', text);
            break;
          }
          if (label.includes('connect') && !label.includes('pending') && !label.includes('disconnect')) {
            connectButton = el;
            console.log('[LinkedIn Connect] Found button with aria-label:', label);
            break;
          }
        }
        if (connectButton) break;
      } catch { /* selector not valid or no match */ }
    }

    // Fallback: comprehensive JavaScript button search
    if (!connectButton) {
      console.log('[LinkedIn Connect] Trying comprehensive JavaScript button search...');
      const handle = await session.page.evaluateHandle(() => {
        // Search all possible clickable elements
        const candidates = Array.from(document.querySelectorAll(
          'button, div[role="button"], span[role="button"], a[role="button"], li[role="button"]'
        ));
        
        return candidates.find(b => {
          const text = (b.textContent || '').toLowerCase().trim();
          const label = b.getAttribute('aria-label')?.toLowerCase() || '';
          const dataControl = b.getAttribute('data-control-name')?.toLowerCase() || '';
          
          // Check for Connect in text, label, or data attributes
          const isConnect = 
            text === 'connect' || 
            text.startsWith('connect ') ||
            label.includes('connect') ||
            dataControl.includes('connect');
          
          // Exclude pending, disconnect, or already connected states
          const notExcluded = 
            !text.includes('pending') && 
            !label.includes('pending') &&
            !text.includes('disconnect') &&
            !text.includes('connected') &&
            !text.includes('message');
          
          // Make sure element is visible
          const style = window.getComputedStyle(b);
          const isVisible = style.display !== 'none' && 
                           style.visibility !== 'hidden' && 
                           style.opacity !== '0';
          
          return isConnect && notExcluded && isVisible;
        }) || null;
      });
      
      const element = handle.asElement();
      if (element) {
        connectButton = element as import('puppeteer').ElementHandle<Element>;
        console.log('[LinkedIn Connect] Found button via comprehensive JS search');
      }
    }

    // Try "More actions" dropdown - LinkedIn often hides Connect here
    if (!connectButton) {
      console.log('[LinkedIn Connect] No direct Connect button found, checking dropdowns...');
      
      // Extended list of More/ellipsis button selectors
      const moreSelectors = [
        'button[aria-label="More actions"]',
        'button[aria-label*="More"]',
        'button[aria-label*="more"]',
        'button.artdeco-dropdown__trigger',
        'button[aria-label*="ellipsis"]',
        'button[aria-label*="..."]',
        '.pvs-overflow-actions-dropdown__trigger',
        '.artdeco-dropdown__trigger--placement-bottom',
        'button.pvs-profile-actions__overflow-toggle',
        // Three dots / ellipsis icons
        'button svg[data-test-icon="overflow-web-ios-medium"]',
        'button:has(svg.artdeco-icon--overflow)',
        // Generic overflow buttons
        '[data-control-name="overflow_actions"]'
      ];
      
      let moreButton: import('puppeteer').ElementHandle<Element> | null = null;
      for (const sel of moreSelectors) {
        try {
          moreButton = await session.page.$(sel);
          if (moreButton) {
            console.log('[LinkedIn Connect] Found More button with selector:', sel);
            break;
          }
        } catch { /* selector might use :has() which isn't always supported */ }
      }
      
      // Also try JS search for More/ellipsis button
      if (!moreButton) {
        const moreHandle = await session.page.evaluateHandle(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.find(b => {
            const label = b.getAttribute('aria-label')?.toLowerCase() || '';
            const text = (b.textContent || '').toLowerCase().trim();
            const hasSvg = b.querySelector('svg') !== null;
            
            return (label.includes('more') || label.includes('overflow') || 
                    text === '...' || text === '•••' || 
                    (hasSvg && label === '' && text === '')) &&
                   !label.includes('show more');
          }) || null;
        });
        const moreEl = moreHandle.asElement();
        if (moreEl) {
          moreButton = moreEl as import('puppeteer').ElementHandle<Element>;
          console.log('[LinkedIn Connect] Found More button via JS search');
        }
      }
      
      if (moreButton) {
        console.log('[LinkedIn Connect] Clicking More actions dropdown...');
        await moreButton.click();
        await sleep(randomDelay('betweenActions'));
        
        // Wait for dropdown to appear
        await sleep(500);
        
        // Look for Connect in dropdown with comprehensive search
        const connectInDropdown = await session.page.evaluateHandle(() => {
          // Check multiple dropdown container types
          const dropdownSelectors = [
            '[role="menu"]',
            '.artdeco-dropdown__content',
            '.artdeco-dropdown__content-inner',
            '.pvs-overflow-actions-dropdown__content',
            '[data-test-id="overflow-menu"]',
            '.artdeco-dropdown--is-open'
          ];
          
          let container = null;
          for (const sel of dropdownSelectors) {
            container = document.querySelector(sel);
            if (container) break;
          }
          
          if (!container) container = document.body;
          
          const items = Array.from(container.querySelectorAll(
            '[role="menuitem"], .artdeco-dropdown__item, li, a, button, span'
          ));
          
          return items.find(i => {
            const text = (i.textContent || '').toLowerCase().trim();
            const label = i.getAttribute('aria-label')?.toLowerCase() || '';
            return (text.includes('connect') || label.includes('connect')) && 
                   !text.includes('pending') && 
                   !text.includes('disconnect');
          }) || null;
        });
        
        const dropdownElement = connectInDropdown.asElement() as import('puppeteer').ElementHandle<Element> | null;
        if (dropdownElement) {
          await dropdownElement.click();
          console.log('[LinkedIn Connect] Clicked Connect in dropdown');
        } else {
          // Log what's actually in the dropdown for debugging
          const dropdownState = await session.page.evaluate(() => {
            const items = Array.from(document.querySelectorAll(
              '[role="menuitem"], .artdeco-dropdown__item, li, [role="menu"] *'
            ));
            return items
              .map(i => i.textContent?.trim() || '')
              .filter(t => t.length > 0 && t.length < 50)
              .slice(0, 10);
          });
          console.log('[LinkedIn Connect] Dropdown items:', JSON.stringify(dropdownState));
          
          // Close dropdown by clicking elsewhere
          await session.page.keyboard.press('Escape');
          
          return { 
            success: false, 
            message: 'Connect option not found in dropdown - may already be connected or pending',
            data: { status: 'unknown', dropdownItems: dropdownState }
          };
        }
      } else {
        console.log('[LinkedIn Connect] No Connect button or More actions found');
        console.log('[LinkedIn Connect] Available buttons:', JSON.stringify(pageState.buttons.slice(0, 5)));
        
        // Check if they're already pending or connected
        const alreadyInvitedCheck = await session.page.evaluate(() => {
          const bodyText = document.body?.innerText || '';
          const hasPendingBtn = !!document.querySelector('button[aria-label*="Pending"]');
          const hasPendingText = bodyText.includes('Pending') || bodyText.includes('pending');
          const hasMessageBtn = !!document.querySelector('button[aria-label*="Message"]');
          const is1stDegree = bodyText.includes('1st degree') || bodyText.includes('1st connection');
          const hasWithdrawOption = bodyText.includes('Withdraw');
          return { 
            isPending: hasPendingBtn || hasPendingText || hasWithdrawOption,
            isConnected: hasMessageBtn && is1stDegree,
            hasPendingBtn,
            hasPendingText,
            hasMessageBtn,
            is1stDegree
          };
        });
        
        console.log('[LinkedIn Connect] Already invited check:', JSON.stringify(alreadyInvitedCheck));
        
        if (alreadyInvitedCheck.isPending) {
          console.log('[LinkedIn Connect] ✅ Connection already pending - marking as already_invited');
          return { 
            success: true, 
            message: 'Connection request already sent',
            data: { status: 'already_invited', profileUrl }
          };
        }
        
        if (alreadyInvitedCheck.isConnected) {
          console.log('[LinkedIn Connect] ✅ Already connected (1st degree)');
          return { 
            success: true, 
            message: 'Already connected',
            data: { status: 'already_connected', profileUrl }
          };
        }
        
        return { 
          success: false, 
          message: 'Connect button not found',
          data: { status: 'unknown', availableButtons: pageState.buttons.slice(0, 5) }
        };
      }
    } else {
      console.log('[LinkedIn Connect] Clicking Connect button...');
      // Scroll button into view and use JavaScript click for better reliability
      await session.page.evaluate((btn) => {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, connectButton);
      await sleep(500);
      
      // Use JavaScript click which is more reliable on React apps
      await session.page.evaluate((btn) => {
        (btn as HTMLElement).click();
      }, connectButton);
      console.log('[LinkedIn Connect] Button clicked via JavaScript');
    }

    // Wait for the connection modal to appear
    console.log('[LinkedIn Connect] Waiting for connection modal...');
    await sleep(1500); // Give modal time to render
    
    // Check if the connection modal appeared AND immediately try to click Send
    // This is atomic to avoid timing issues where modal changes between check and click
    const modalResult = await session.page.evaluate((noteToAdd: string | null) => {
      const addNoteBtn = document.querySelector('button[aria-label="Add a note"]') as HTMLElement | null;
      const sendNowBtn = (document.querySelector('button[aria-label="Send now"]') || 
                         document.querySelector('button[aria-label="Send invitation"]') ||
                         document.querySelector('button[aria-label="Send without a note"]')) as HTMLElement | null;
      const modalHeader = document.querySelector('[role="dialog"] h2, [role="dialog"] h3');
      const anyDialog = document.querySelector('[role="dialog"]');
      
      // Also look for send buttons by text content in case aria-labels don't match
      let sendBtnByText: HTMLElement | null = null;
      if (!sendNowBtn && anyDialog) {
        const buttons = anyDialog.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase().trim() || '';
          if (text === 'send' || text === 'send now' || text.includes('send without') || text === 'send invitation') {
            sendBtnByText = btn as HTMLElement;
            break;
          }
        }
      }
      
      const effectiveSendBtn = sendNowBtn || sendBtnByText;
      
      const result = {
        hasAddNote: !!addNoteBtn,
        hasSendNow: !!effectiveSendBtn,
        modalHeaderText: modalHeader?.textContent?.trim() || '',
        hasDialog: !!anyDialog,
        dialogContent: anyDialog?.textContent?.substring(0, 200) || '',
        clickedSend: false,
        addedNote: false,
        error: ''
      };
      
      // If modal has send button and we don't need to add a note, click immediately
      if (effectiveSendBtn && !noteToAdd) {
        try {
          effectiveSendBtn.click();
          result.clickedSend = true;
        } catch (e) {
          result.error = `Failed to click send: ${e}`;
        }
      }
      
      // If we need to add a note, click Add Note first
      if (addNoteBtn && noteToAdd) {
        try {
          addNoteBtn.click();
          result.addedNote = true;
        } catch (e) {
          result.error = `Failed to click add note: ${e}`;
        }
      }
      
      return result;
    }, effectiveNote || null);
    
    console.log('[LinkedIn Connect] Modal result:', JSON.stringify(modalResult));
    
    // If we clicked send atomically, we're done!
    if (modalResult.clickedSend) {
      console.log('[LinkedIn Connect] ✅ Send button clicked atomically');
      await sleep(1500); // Wait for request to process
      
      // Verify the modal closed and we're back on the profile
      const postSendState = await session.page.evaluate(() => {
        const modalVisible = !!document.querySelector('[role="dialog"]');
        const pendingButton = document.querySelector('button[aria-label*="Pending"]');
        const bodyText = document.body?.innerText || '';
        const hasPending = !!pendingButton || bodyText.includes('Pending');
        return { modalVisible, hasPending };
      });
      
      console.log('[LinkedIn Connect] Post-send state:', postSendState);
      
      if (postSendState.hasPending) {
        console.log('[LinkedIn Connect] ✅ VERIFIED: Connection request sent - status now shows Pending');
        return { 
          success: true, 
          message: 'Connection request sent successfully (verified)',
          data: { profileUrl, noteIncluded: false, verified: true }
        };
      } else if (!postSendState.modalVisible) {
        console.log('[LinkedIn Connect] Modal closed - assuming request was sent');
        return { 
          success: true, 
          message: 'Connection request sent successfully',
          data: { profileUrl, noteIncluded: false, verified: false }
        };
      }
    }
    
    // Handle note adding if we clicked Add Note
    if (modalResult.addedNote && effectiveNote) {
      console.log('[LinkedIn Connect] Add Note clicked, waiting for textarea...');
      
      // Wait longer and try multiple times for the textarea to appear
      const textareaSelectors = [
        'textarea[name="message"]',
        'textarea#custom-message',
        '[role="dialog"] textarea',
        '.send-invite__custom-message textarea',
        'textarea.connect-button-send-invite__custom-message',
        '.artdeco-modal textarea',
        'form textarea'
      ];
      
      let noteTextarea: any = null;
      let foundSelector = '';
      
      // Try 3 times with increasing delays
      for (let attempt = 0; attempt < 3; attempt++) {
        await sleep(500 + (attempt * 300)); // 500ms, 800ms, 1100ms
        
        for (const selector of textareaSelectors) {
          noteTextarea = await session.page.$(selector);
          if (noteTextarea) {
            foundSelector = selector;
            break;
          }
        }
        
        if (noteTextarea) break;
        
        // Log page state for debugging
        if (attempt === 2) {
          const dialogState = await session.page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]');
            return {
              hasDialog: !!dialog,
              dialogHTML: dialog?.innerHTML?.substring(0, 500) || 'none',
              textareas: Array.from(document.querySelectorAll('textarea')).map(t => ({
                name: t.name,
                id: t.id,
                className: t.className
              }))
            };
          });
          console.log('[LinkedIn Connect] Dialog state after Add Note:', JSON.stringify(dialogState));
        }
      }
      
      if (noteTextarea && effectiveNote) {
        console.log(`[LinkedIn Connect] Found textarea with selector: ${foundSelector}`);
        await humanType(session.page, foundSelector, effectiveNote);
        await sleep(500);
        
        // Now click send
        const sendAfterNote = await session.page.evaluate(() => {
          const sendBtn = (document.querySelector('button[aria-label="Send now"]') || 
                          document.querySelector('button[aria-label="Send invitation"]') ||
                          document.querySelector('button[aria-label="Send"]') ||
                          document.querySelector('[role="dialog"] button.artdeco-button--primary')) as HTMLElement | null;
          if (sendBtn) {
            sendBtn.click();
            return { clicked: true, buttonText: sendBtn.textContent?.trim() || '' };
          }
          // Also try finding by button text
          const allBtns = document.querySelectorAll('[role="dialog"] button');
          for (const btn of allBtns) {
            const text = btn.textContent?.toLowerCase().trim() || '';
            if (text === 'send' || text === 'send now' || text === 'send invitation') {
              (btn as HTMLElement).click();
              return { clicked: true, buttonText: text };
            }
          }
          return { clicked: false, buttonText: '' };
        });
        
        if (sendAfterNote.clicked) {
          console.log(`[LinkedIn Connect] ✅ Sent connection with note (button: ${sendAfterNote.buttonText})`);
          await sleep(1500);
          return { 
            success: true, 
            message: 'Connection request sent with note',
            data: { profileUrl, noteIncluded: true, verified: false }
          };
        } else {
          console.log('[LinkedIn Connect] ⚠️ Could not find Send button after adding note');
        }
      } else {
        // Check if CAPTCHA appeared (indicated by g-recaptcha-response textarea)
        const hasCaptcha = await session.page.evaluate(() => {
          return !!document.querySelector('textarea.g-recaptcha-response, #g-recaptcha-response-100000');
        });
        
        if (hasCaptcha) {
          console.log('[LinkedIn Connect] ⚠️ CAPTCHA detected - dismissing modal and retrying without note');
          // Close the current modal
          await session.page.evaluate(() => {
            const dismissBtn = document.querySelector('button[aria-label="Dismiss"]') as HTMLElement | null;
            if (dismissBtn) dismissBtn.click();
          });
          await sleep(1000);
          
          // Click Connect button again
          const connectRetry = await session.page.evaluate(() => {
            const btn = document.querySelector('button[aria-label*="Invite"][aria-label*="connect"]') as HTMLElement | null ||
                        Array.from(document.querySelectorAll('button')).find(b => 
                          b.textContent?.toLowerCase().trim() === 'connect') as HTMLElement | null;
            if (btn) {
              btn.click();
              return true;
            }
            return false;
          });
          
          if (connectRetry) {
            await sleep(1500);
            // Now click Send without a note immediately
            const sendWithoutNote = await session.page.evaluate(() => {
              const sendBtn = (document.querySelector('button[aria-label="Send without a note"]') ||
                              document.querySelector('button[aria-label="Send now"]')) as HTMLElement | null;
              if (sendBtn) {
                sendBtn.click();
                return { clicked: true, buttonText: sendBtn.textContent?.trim() || '' };
              }
              // Try by text content
              const buttons = document.querySelectorAll('[role="dialog"] button');
              for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase().trim() || '';
                if (text.includes('send') && !text.includes('add')) {
                  (btn as HTMLElement).click();
                  return { clicked: true, buttonText: text };
                }
              }
              return { clicked: false, buttonText: '' };
            });
            
            if (sendWithoutNote.clicked) {
              console.log(`[LinkedIn Connect] ✅ Sent without note after CAPTCHA recovery (button: ${sendWithoutNote.buttonText})`);
              await sleep(1500);
              return { 
                success: true, 
                message: 'Connection request sent (CAPTCHA recovery - no note)',
                data: { profileUrl, noteIncluded: false, verified: false, captchaRecovery: true }
              };
            }
          }
        }
        
        console.log('[LinkedIn Connect] ⚠️ Could not find textarea after clicking Add Note');
        // Try clicking Send without a note as fallback
        const fallbackSend = await session.page.evaluate(() => {
          const sendBtn = (document.querySelector('button[aria-label="Send without a note"]') ||
                          document.querySelector('button[aria-label="Send now"]') ||
                          document.querySelector('[role="dialog"] button.artdeco-button--primary')) as HTMLElement | null;
          if (sendBtn) {
            sendBtn.click();
            return { clicked: true, buttonText: sendBtn.textContent?.trim() || '' };
          }
          return { clicked: false, buttonText: '' };
        });
        
        if (fallbackSend.clicked) {
          console.log(`[LinkedIn Connect] ✅ Sent without note as fallback (button: ${fallbackSend.buttonText})`);
          await sleep(1500);
          return { 
            success: true, 
            message: 'Connection request sent (fallback - no note)',
            data: { profileUrl, noteIncluded: false, verified: false }
          };
        }
      }
    }
    
    // If no connection modal but there's a dialog, it might be a different popup
    if (!modalResult.hasSendNow && !modalResult.hasAddNote && modalResult.hasDialog) {
      console.log('[LinkedIn Connect] Non-connection dialog detected, attempting to close and retry...');
      
      // Try to close any non-connection dialog and immediately try Connect + Send
      const retryResult = await session.page.evaluate(() => {
        // Close the current dialog
        const closeBtn = document.querySelector('[role="dialog"] button[aria-label="Dismiss"]') ||
                        document.querySelector('[role="dialog"] button[aria-label="Close"]') ||
                        document.querySelector('button[data-test-modal-close-btn]');
        if (closeBtn) {
          (closeBtn as HTMLElement).click();
          return { closed: true, needsRetry: true };
        }
        return { closed: false, needsRetry: false };
      });
      
      if (retryResult.closed) {
        console.log('[LinkedIn Connect] Closed unrelated dialog, trying Connect again...');
        await sleep(1500);
        
        // Try the whole flow again - find Connect, click, and immediately send
        const retryConnectAndSend = await session.page.evaluate(() => {
          // Find Connect button
          let connectBtn: HTMLElement | null = null;
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
            const text = btn.textContent?.toLowerCase() || '';
            if ((ariaLabel.includes('connect') || ariaLabel.includes('invite')) && 
                !text.includes('message')) {
              connectBtn = btn as HTMLElement;
              break;
            }
          }
          
          if (!connectBtn) {
            return { found: false, clicked: false, sent: false };
          }
          
          connectBtn.click();
          return { found: true, clicked: true, sent: false, needsModalWait: true };
        });
        
        if (retryConnectAndSend.clicked) {
          await sleep(2000); // Wait for modal
          
          // Now try to click send
          const retrySend = await session.page.evaluate(() => {
            const sendBtn = (document.querySelector('button[aria-label="Send now"]') || 
                            document.querySelector('button[aria-label="Send invitation"]') ||
                            document.querySelector('button[aria-label="Send without a note"]')) as HTMLElement | null;
            if (sendBtn) {
              sendBtn.click();
              return { sent: true };
            }
            return { sent: false };
          });
          
          if (retrySend.sent) {
            console.log('[LinkedIn Connect] ✅ Sent on retry');
            await sleep(1500);
            return { 
              success: true, 
              message: 'Connection request sent on retry',
              data: { profileUrl, noteIncluded: false, verified: false }
            };
          }
        }
      }
    }
    
    // If we got here without success, fall through to existing button search logic
    // Look for send button in the modal - this confirms the modal actually appeared
    // Try multiple selectors and also text-based matching
    let sendButton: any = await session.page.$('button[aria-label="Send now"]') ||
                          await session.page.$('button[aria-label="Send invitation"]') ||
                          await session.page.$('button[aria-label="Send without a note"]');
    
    // If standard selectors fail, try finding by button text inside the dialog
    if (!sendButton) {
      sendButton = await session.page.evaluateHandle(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return null;
        
        const buttons = dialog.querySelectorAll('button');
        for (const btn of buttons) {
          const text = btn.textContent?.toLowerCase().trim() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          // Look for send-related buttons
          if (text.includes('send') || ariaLabel.includes('send') ||
              text === 'send now' || text === 'send without a note' || 
              text === 'send invitation') {
            return btn;
          }
        }
        return null;
      }).then(handle => handle.asElement());
    }
    
    if (sendButton) {
      await sendButton.click();
      console.log('[LinkedIn Connect] Clicked send button in modal');
      await sleep(randomDelay('navigation'));
      
      // Verify the modal closed and we're back on the profile
      const postSendState = await session.page.evaluate(() => {
        const modalVisible = !!document.querySelector('[role="dialog"]');
        const pendingButton = document.querySelector('button[aria-label*="Pending"]');
        const bodyText = document.body?.innerText || '';
        const hasPending = !!pendingButton || bodyText.includes('Pending');
        return { modalVisible, hasPending };
      });
      
      console.log('[LinkedIn Connect] Post-send state:', postSendState);
      
      if (postSendState.hasPending) {
        console.log('[LinkedIn Connect] ✅ VERIFIED: Connection request sent - status now shows Pending');
        return { 
          success: true, 
          message: 'Connection request sent successfully (verified)',
          data: { profileUrl, noteIncluded: !!note, verified: true }
        };
      } else if (!postSendState.modalVisible) {
        console.log('[LinkedIn Connect] Modal closed - assuming request was sent');
        return { 
          success: true, 
          message: 'Connection request sent successfully',
          data: { profileUrl, noteIncluded: !!note, verified: false }
        };
      }
    } else {
      // No send button found - the modal likely didn't appear
      console.log('[LinkedIn Connect] ⚠️ No send modal appeared after clicking Connect button');
      
      // Check if maybe we clicked the wrong button or the person is already connected
      const afterClickState = await session.page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const dialogButtons = dialog ? Array.from(dialog.querySelectorAll('button')).map(b => ({
          text: b.textContent?.trim() || '',
          ariaLabel: b.getAttribute('aria-label') || '',
          className: b.className?.substring(0, 50) || ''
        })).slice(0, 10) : [];
        const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
          text: b.textContent?.trim() || '',
          ariaLabel: b.getAttribute('aria-label') || ''
        })).filter(b => b.text || b.ariaLabel).slice(0, 8);
        const modalVisible = !!dialog;
        const isPending = !!document.querySelector('[aria-label*="Pending"]');
        return { buttons, dialogButtons, modalVisible, isPending };
      });
      
      console.log('[LinkedIn Connect] After-click state:', JSON.stringify(afterClickState));
      console.log('[LinkedIn Connect] Dialog buttons:', JSON.stringify(afterClickState.dialogButtons));
      
      if (afterClickState.isPending) {
        return { success: true, message: 'Connection request pending (may have been sent previously)', data: { profileUrl } };
      }
      
      return { 
        success: false, 
        message: 'Connection modal did not appear - Connect button click may have failed',
        data: { profileUrl, afterClickState }
      };
    }

    await sleep(randomDelay('navigation'));

    return { 
      success: true, 
      message: 'Connection request sent successfully',
      data: { profileUrl, noteIncluded: !!note }
    };
  } catch (error: any) {
    console.error('Failed to send connection request:', error);
    
    // Detect stale/detached session and clear it so it can be recreated on retry
    if (error.message?.includes('detached Frame') || error.message?.includes('Target closed') || error.message?.includes('Session closed')) {
      console.log('[LinkedIn Connect] Session appears stale - clearing for retry');
      activeSessions.delete(sessionKey);
    }
    
    return { success: false, message: error.message };
  }
}

export async function sendLinkedInMessage(
  userId: string,
  workspaceId: string,
  profileUrl: string,
  message: string
): Promise<AutomationResult> {
  const sessionKey = getSessionKey(userId, workspaceId);
  const session = activeSessions.get(sessionKey);
  if (!session) {
    return { success: false, message: 'No active session found' };
  }

  if (session.dailyMessagesSent >= session.dailyMessageLimit) {
    return { success: false, message: 'Daily message limit reached' };
  }

  try {
    session.lastActivity = new Date();

    await session.page.goto(profileUrl, {
      waitUntil: 'domcontentloaded', // Changed from networkidle2 to save bandwidth
      timeout: 30000,
    });

    await sleep(1500); // Wait for JS rendering, reduced from random navigation delay
    await randomScroll(session.page);

    const messageButton = await session.page.$('button[aria-label*="Message"]');
    if (!messageButton) {
      return { success: false, message: 'Message button not found - may not be connected' };
    }

    await humanClick(session.page, 'button[aria-label*="Message"]');
    await sleep(randomDelay('navigation'));

    await session.page.waitForSelector('div[role="textbox"]', { timeout: 10000 });
    await sleep(randomDelay('betweenActions'));

    const textbox = await session.page.$('div[role="textbox"]');
    if (!textbox) {
      return { success: false, message: 'Message textbox not found' };
    }

    await session.page.click('div[role="textbox"]');
    await sleep(randomDelay('click'));

    for (const char of message) {
      await session.page.keyboard.type(char);
      await sleep(randomDelay('typing'));
    }

    await sleep(randomDelay('betweenActions'));

    const sendButton = await session.page.$('button[type="submit"][class*="msg-form__send-button"]');
    if (sendButton) {
      await humanClick(session.page, 'button[type="submit"][class*="msg-form__send-button"]');
    } else {
      await session.page.keyboard.press('Enter');
    }

    await sleep(randomDelay('navigation'));

    return { 
      success: true, 
      message: 'Message sent successfully',
      data: { profileUrl, messageLength: message.length }
    };
  } catch (error: any) {
    console.error('Failed to send LinkedIn message:', error);
    return { success: false, message: error.message };
  }
}

export async function sendSalesNavigatorInMail(
  userId: string,
  workspaceId: string,
  profileUrl: string,
  subject: string,
  message: string
): Promise<AutomationResult> {
  const sessionKey = getSessionKey(userId, workspaceId);
  const session = activeSessions.get(sessionKey);
  if (!session) {
    return { success: false, message: 'No active session found' };
  }

  if (session.dailyMessagesSent >= session.dailyMessageLimit) {
    return { success: false, message: 'Daily message limit reached' };
  }

  try {
    session.lastActivity = new Date();
    console.log('[LinkedIn InMail] Starting InMail to:', profileUrl);

    // Convert regular LinkedIn URL to Sales Navigator URL if needed
    let salesNavUrl = profileUrl;
    if (profileUrl.includes('linkedin.com/in/')) {
      const vanityName = profileUrl.split('/in/')[1]?.replace(/\/$/, '').split('?')[0];
      if (vanityName) {
        salesNavUrl = `https://www.linkedin.com/sales/people/${vanityName}`;
      }
    }

    await session.page.goto(salesNavUrl, {
      waitUntil: 'domcontentloaded', // Changed from networkidle2 to save bandwidth
      timeout: 30000,
    });

    await sleep(1500); // Wait for JS rendering
    await randomScroll(session.page);

    // Look for InMail button on Sales Navigator profile
    const inMailButtonSelectors = [
      'button[data-control-name="message"]',
      'button[aria-label*="InMail"]',
      'button[aria-label*="Send InMail"]',
      'button[aria-label*="Message"]',
      '.profile-topcard-actions button:has-text("Message")',
      '[data-action-type="INMAIL"]',
    ];

    let inMailButton: any = null;
    for (const selector of inMailButtonSelectors) {
      try {
        inMailButton = await session.page.$(selector);
        if (inMailButton) {
          console.log('[LinkedIn InMail] Found InMail button with selector:', selector);
          break;
        }
      } catch {}
    }

    // Try finding by text content if selectors fail
    if (!inMailButton) {
      const handle = await session.page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text.includes('message') || text.includes('inmail');
        }) || null;
      });
      
      const element = handle.asElement();
      if (element) {
        inMailButton = element;
      }
    }

    if (!inMailButton) {
      console.log('[LinkedIn InMail] No InMail button found - user may not be open to InMail or needs Premium');
      return { 
        success: false, 
        message: 'InMail button not found - recipient may not be open to InMail or you need Sales Navigator subscription',
        data: { profileUrl, salesNavUrl }
      };
    }

    await (inMailButton as any).click();
    await sleep(randomDelay('navigation'));

    // Wait for InMail compose modal
    await session.page.waitForSelector('[role="dialog"], .inmail-compose, .compose-form, [data-test-modal]', { 
      timeout: 10000 
    });
    await sleep(randomDelay('betweenActions'));

    // Fill in subject line if present
    const subjectInput = await session.page.$('input[name="subject"], input[placeholder*="Subject"], .inmail-subject-field input');
    if (subjectInput && subject) {
      await subjectInput.click();
      await sleep(randomDelay('click'));
      for (const char of subject) {
        await session.page.keyboard.type(char);
        await sleep(randomDelay('typing'));
      }
      console.log('[LinkedIn InMail] Subject entered');
    }

    await sleep(randomDelay('betweenActions'));

    // Fill in message body
    const messageTextbox = await session.page.$('textarea[name="body"], div[role="textbox"], .inmail-body-field textarea, [contenteditable="true"]');
    if (!messageTextbox) {
      return { success: false, message: 'InMail message textbox not found' };
    }

    await (messageTextbox as any).click();
    await sleep(randomDelay('click'));

    for (const char of message) {
      await session.page.keyboard.type(char);
      await sleep(randomDelay('typing'));
    }
    console.log('[LinkedIn InMail] Message body entered');

    await sleep(randomDelay('betweenActions'));

    // Click send button
    const sendButtonSelectors = [
      'button[data-control-name="send"]',
      'button[aria-label="Send"]',
      'button[type="submit"]',
      '.inmail-send-button',
      'button:has-text("Send")',
    ];

    let sendButton: any = null;
    for (const selector of sendButtonSelectors) {
      try {
        sendButton = await session.page.$(selector);
        if (sendButton) break;
      } catch {}
    }

    if (!sendButton) {
      const handle = await session.page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          return text === 'send' || text.includes('send inmail');
        }) || null;
      });
      const element = handle.asElement();
      if (element) {
        sendButton = element;
      }
    }

    if (sendButton) {
      await (sendButton as any).click();
      console.log('[LinkedIn InMail] Clicked send button');
      await sleep(randomDelay('navigation'));
      
      session.dailyMessagesSent++;
      
      return { 
        success: true, 
        message: 'InMail sent successfully',
        data: { 
          profileUrl, 
          salesNavUrl,
          subject,
          messageLength: message.length,
          type: 'inmail'
        }
      };
    } else {
      // Try pressing Enter as fallback
      await session.page.keyboard.press('Enter');
      await sleep(randomDelay('navigation'));
      
      session.dailyMessagesSent++;
      
      return { 
        success: true, 
        message: 'InMail sent (via Enter key)',
        data: { profileUrl, salesNavUrl, subject, messageLength: message.length, type: 'inmail' }
      };
    }
  } catch (error: any) {
    console.error('[LinkedIn InMail] Failed to send InMail:', error);
    return { success: false, message: `InMail failed: ${error.message}` };
  }
}

export async function getProfileInfo(
  userId: string,
  workspaceId: string,
  profileUrl: string
): Promise<AutomationResult> {
  const sessionKey = getSessionKey(userId, workspaceId);
  const session = activeSessions.get(sessionKey);
  if (!session) {
    return { success: false, message: 'No active session found' };
  }

  try {
    session.lastActivity = new Date();

    await session.page.goto(profileUrl, {
      waitUntil: 'domcontentloaded', // Changed from networkidle2 to save bandwidth
      timeout: 30000,
    });

    await sleep(1500); // Wait for JS rendering

    const profileData = await session.page.evaluate(() => {
      const getName = () => {
        const nameEl = document.querySelector('h1.text-heading-xlarge');
        return nameEl?.textContent?.trim() || '';
      };

      const getHeadline = () => {
        const headlineEl = document.querySelector('div.text-body-medium');
        return headlineEl?.textContent?.trim() || '';
      };

      const getLocation = () => {
        const locationEl = document.querySelector('span.text-body-small');
        return locationEl?.textContent?.trim() || '';
      };

      const getConnectionCount = () => {
        const connectionsEl = document.querySelector('li.text-body-small span');
        return connectionsEl?.textContent?.trim() || '';
      };

      return {
        name: getName(),
        headline: getHeadline(),
        location: getLocation(),
        connections: getConnectionCount(),
      };
    });

    return { 
      success: true, 
      message: 'Profile info retrieved',
      data: profileData
    };
  } catch (error: any) {
    console.error('Failed to get profile info:', error);
    return { success: false, message: error.message };
  }
}

export async function withdrawConnectionRequest(
  userId: string,
  workspaceId: string,
  profileUrl: string
): Promise<AutomationResult> {
  const sessionKey = getSessionKey(userId, workspaceId);
  const session = activeSessions.get(sessionKey);
  if (!session) {
    return { success: false, message: 'No active session found' };
  }

  try {
    session.lastActivity = new Date();
    console.log(`[LinkedIn Withdraw] Navigating to profile: ${profileUrl}`);

    await session.page.goto(profileUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 90000,
    });

    await sleep(randomDelay('navigation'));
    await randomScroll(session.page);

    // Look for "Pending" button which indicates a pending connection request
    const pendingButton = await session.page.$('button[aria-label*="Pending"]') ||
                          await session.page.$('button:has-text("Pending")');
    
    if (!pendingButton) {
      // Check if we're already connected
      const messageButton = await session.page.$('button[aria-label*="Message"]');
      if (messageButton) {
        return { 
          success: false, 
          message: 'Already connected - no pending request to withdraw',
          data: { status: 'already_connected' }
        };
      }
      
      // Check if there's a Connect button (no pending request)
      const connectButton = await session.page.$('button[aria-label*="Connect"]');
      if (connectButton) {
        return { 
          success: false, 
          message: 'No pending connection request found',
          data: { status: 'no_pending_request' }
        };
      }
      
      return { 
        success: false, 
        message: 'Could not determine connection status',
        data: { status: 'unknown' }
      };
    }

    console.log('[LinkedIn Withdraw] Found Pending button, clicking...');
    await pendingButton.click();
    await sleep(randomDelay('betweenActions'));

    // Look for "Withdraw" option in dropdown
    const withdrawButton = await session.page.$('button[aria-label*="Withdraw"]') ||
                           await session.page.$('button:has-text("Withdraw")') ||
                           await session.page.evaluateHandle(() => {
                             const buttons = Array.from(document.querySelectorAll('button, [role="menuitem"]'));
                             return buttons.find(b => (b.textContent || '').toLowerCase().includes('withdraw')) || null;
                           });

    const withdrawElement = withdrawButton ? (withdrawButton as any).asElement?.() || withdrawButton : null;
    if (!withdrawElement) {
      return { 
        success: false, 
        message: 'Withdraw option not found in dropdown',
        data: { status: 'withdraw_not_found' }
      };
    }

    await withdrawElement.click();
    await sleep(randomDelay('betweenActions'));

    // Confirm withdrawal if there's a confirmation dialog
    const confirmButton = await session.page.$('button[aria-label*="Withdraw"]') ||
                          await session.page.$('button.artdeco-modal__confirm-dialog-btn');
    if (confirmButton) {
      await confirmButton.click();
      await sleep(randomDelay('navigation'));
    }

    console.log('[LinkedIn Withdraw] Connection request withdrawn successfully');
    return { 
      success: true, 
      message: 'Connection request withdrawn successfully',
      data: { profileUrl, status: 'withdrawn' }
    };
  } catch (error: any) {
    console.error('Failed to withdraw connection request:', error);
    return { success: false, message: error.message };
  }
}

export async function closeLinkedInSession(userId: string, workspaceId: string): Promise<void> {
  const sessionKey = getSessionKey(userId, workspaceId);
  const session = activeSessions.get(sessionKey);
  if (session) {
    try {
      await session.browser.close();
    } catch (error) {
      console.error('Error closing browser:', error);
    }
    activeSessions.delete(sessionKey);
  }
}

export function getActiveSessionCount(): number {
  return activeSessions.size;
}

export function isSessionActive(userId: string, workspaceId: string): boolean {
  const sessionKey = getSessionKey(userId, workspaceId);
  return activeSessions.has(sessionKey);
}

export function getActiveSession(userId: string, workspaceId: string): LinkedInSession | null {
  const sessionKey = getSessionKey(userId, workspaceId);
  return activeSessions.get(sessionKey) || null;
}

// Validate that a session's browser/page is still responsive AND logged in
export async function validateSession(userId: string, workspaceId: string): Promise<boolean> {
  const sessionKey = getSessionKey(userId, workspaceId);
  const session = activeSessions.get(sessionKey);
  
  if (!session) {
    return false;
  }
  
  try {
    // Check if page is responsive AND user is still logged in
    const pageCheck = await session.page.evaluate(() => {
      const url = window.location.href;
      const title = document.title || '';
      return { url, title };
    });
    
    // Check if we're on a login/signup page - means session is logged out
    const isLoginPage = pageCheck.url.includes('/login') || 
                        pageCheck.url.includes('/signup') || 
                        pageCheck.url.includes('/uas/login') ||
                        pageCheck.url.includes('/checkpoint') ||
                        pageCheck.url.includes('/authwall') ||
                        pageCheck.title.includes('Sign In') ||
                        pageCheck.title.includes('Sign Up') ||
                        pageCheck.title.includes('Log In');
    
    if (isLoginPage) {
      console.log(`[LinkedIn Automation] Session logged out for ${sessionKey}, on page: ${pageCheck.url}`);
      activeSessions.delete(sessionKey);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.log(`[LinkedIn Automation] Session validation failed for ${sessionKey}: ${error.message}`);
    // Session is stale, remove it from the map
    activeSessions.delete(sessionKey);
    return false;
  }
}

setInterval(() => {
  const now = new Date();
  const maxIdleTime = 30 * 60 * 1000;

  for (const [sessionKey, session] of activeSessions.entries()) {
    if (now.getTime() - session.lastActivity.getTime() > maxIdleTime) {
      console.log(`Closing idle session: ${sessionKey}`);
      activeSessions.delete(sessionKey);
      session.browser.close().catch(console.error);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// SAFETY-ENHANCED AUTOMATION FUNCTIONS
// These wrap the core functions with full safety checks
// ============================================

export interface SafeAutomationResult extends AutomationResult {
  safetyUpdate?: Partial<UserLinkedInSettings>;
  safetyStatus?: ReturnType<typeof getSafetyStatus>;
  waitMs?: number;
}

export async function safeConnectionRequest(
  userId: string,
  workspaceId: string,
  profileUrl: string,
  settings: UserLinkedInSettings,
  note?: string
): Promise<SafeAutomationResult> {
  // Perform safety check before action
  const safetyCheck = performSafetyCheck(settings, 'connection');
  
  if (!safetyCheck.canProceed) {
    return {
      success: false,
      message: safetyCheck.reason || 'Safety check failed',
      safetyStatus: getSafetyStatus(settings),
    };
  }

  // Calculate delay for next action (for queue management)
  const waitMs = getRandomActionDelay(settings);

  // Wait the random delay before action
  await sleep(waitMs);

  // Execute the connection request
  const result = await sendConnectionRequest(userId, workspaceId, profileUrl, note);

  // Record the result and get updated settings
  const safetyUpdate = recordActionResult(settings, 'connection', result.success);

  return {
    ...result,
    safetyUpdate,
    safetyStatus: getSafetyStatus({ ...settings, ...safetyUpdate } as UserLinkedInSettings),
    waitMs,
  };
}

export async function safeLinkedInMessage(
  userId: string,
  workspaceId: string,
  profileUrl: string,
  message: string,
  settings: UserLinkedInSettings
): Promise<SafeAutomationResult> {
  // Perform safety check before action
  const safetyCheck = performSafetyCheck(settings, 'message');
  
  if (!safetyCheck.canProceed) {
    return {
      success: false,
      message: safetyCheck.reason || 'Safety check failed',
      safetyStatus: getSafetyStatus(settings),
    };
  }

  // Calculate delay for next action
  const waitMs = getRandomActionDelay(settings);

  // Wait the random delay before action
  await sleep(waitMs);

  // Execute the message send
  const result = await sendLinkedInMessage(userId, workspaceId, profileUrl, message);

  // Record the result and get updated settings
  const safetyUpdate = recordActionResult(settings, 'message', result.success);

  return {
    ...result,
    safetyUpdate,
    safetyStatus: getSafetyStatus({ ...settings, ...safetyUpdate } as UserLinkedInSettings),
    waitMs,
  };
}

export async function recordConnectionAccepted(
  settings: UserLinkedInSettings
): Promise<Partial<UserLinkedInSettings>> {
  // Update acceptance tracking when a connection is accepted
  const updates: Partial<UserLinkedInSettings> = {};
  
  updates.total_connections_accepted = (settings.total_connections_accepted ?? 0) + 1;
  
  // Recalculate acceptance rate
  const totalSent = settings.total_connections_sent ?? 0;
  const totalAccepted = updates.total_connections_accepted;
  
  if (totalSent > 0) {
    updates.acceptance_rate = Math.round((totalAccepted / totalSent) * 100);
  }

  // Update safety score
  const mergedSettings = { ...settings, ...updates };
  updates.safety_score = LinkedInSafety.calculateSafetyScore(mergedSettings as UserLinkedInSettings);
  
  // If acceptance improved and was paused, consider unpausing
  if (
    settings.paused_for_low_acceptance && 
    (updates.acceptance_rate ?? 0) >= (settings.auto_pause_acceptance_threshold ?? 20) + 10
  ) {
    updates.paused_for_low_acceptance = false;
    updates.is_paused = false;
    updates.pause_reason = null;
    updates.pause_until = null;
    updates.acceptance_pause_until = null;
  }

  return updates;
}

export function getLinkedInSafetyStatus(settings: UserLinkedInSettings) {
  return getSafetyStatus(settings);
}

export function initializeLinkedInSafety(accountAgeDays: number = 0) {
  return initializeSafetySettings(accountAgeDays);
}

export { LinkedInSafety };
// Force reload Fri Jan 16 02:45:51 AM UTC 2026
