/**
 * LinkedIn Automated Login
 * Uses Puppeteer with rotating proxies to automatically log in and capture session cookies
 */

import puppeteerExtra from 'puppeteer-extra';
import puppeteer from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer-core';
import { generateConsistentFingerprint, applyFingerprint } from './linkedin-anti-fingerprint';
import { getOrAllocateProxy, revokeUserProxy } from './proxy-orchestration';
import { encryptToken } from './encryption';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { execSync } from 'child_process';

// Enable stealth plugin for anti-detection
puppeteerExtra.use(StealthPlugin());

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
      return `${baseUsername}-session-${sessionId}`;
    default:
      return `${baseUsername}-session-${sessionId}`;
  }
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[LinkedIn Auto-Login] Supabase client initialized');
  } catch (error) {
    console.warn('[LinkedIn Auto-Login] Failed to initialize Supabase client:', error);
  }
} else {
  console.warn('[LinkedIn Auto-Login] Missing Supabase credentials');
}

// Direct Postgres pool for table initialization
const dbPool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '',
  ssl: process.env.SUPABASE_DB_URL ? { rejectUnauthorized: false } : false,
  max: 2,
});

// Initialize the table on module load
async function initializeTable() {
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS linkedin_puppeteer_settings (
        id SERIAL PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL UNIQUE,
        user_id VARCHAR(255) NOT NULL,
        session_cookies_encrypted TEXT,
        session_captured_at TIMESTAMPTZ,
        profile_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        error_count INTEGER DEFAULT 0,
        last_error_at TIMESTAMPTZ,
        session_source VARCHAR(50) DEFAULT 'manual',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Add session_source column if it doesn't exist (for existing tables)
    await dbPool.query(`
      ALTER TABLE linkedin_puppeteer_settings 
      ADD COLUMN IF NOT EXISTS session_source VARCHAR(50) DEFAULT 'manual'
    `).catch(() => {});
    // Add proxy_allocation_id to persist which proxy was used for login
    await dbPool.query(`
      ALTER TABLE linkedin_puppeteer_settings 
      ADD COLUMN IF NOT EXISTS proxy_allocation_id VARCHAR(255)
    `).catch(() => {});
    // Add proxy_id to store the actual proxy used
    await dbPool.query(`
      ALTER TABLE linkedin_puppeteer_settings 
      ADD COLUMN IF NOT EXISTS proxy_id VARCHAR(255)
    `).catch(() => {});
    // CRITICAL: Add sticky_session_id to maintain IP consistency across session restores
    // This ensures we always use the same proxy IP that was used during login
    await dbPool.query(`
      ALTER TABLE linkedin_puppeteer_settings 
      ADD COLUMN IF NOT EXISTS sticky_session_id VARCHAR(255)
    `).catch(() => {});
    console.log('[LinkedIn Auto-Login] Table linkedin_puppeteer_settings initialized (with proxy columns + sticky_session_id)');
  } catch (err: any) {
    console.error('[LinkedIn Auto-Login] Failed to initialize table:', err.message);
  }
}

// Run initialization
initializeTable();

// Dynamic Chromium path resolution for cross-environment compatibility
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
      console.log(`[LinkedIn Auto-Login] Using CHROMIUM_PATH: ${cachedChromiumPath}`);
      return cachedChromiumPath;
    } catch {}
  }
  
  // Use 'which chromium' for system-installed version
  try {
    const whichPath = execSync('which chromium 2>/dev/null', { encoding: 'utf8', timeout: 2000 }).trim();
    if (whichPath) {
      cachedChromiumPath = whichPath;
      console.log(`[LinkedIn Auto-Login] Using system chromium: ${cachedChromiumPath}`);
      return cachedChromiumPath;
    }
  } catch {}
  
  // Try to find chromium in nix store
  try {
    const nixPath = execSync('find /nix/store -maxdepth 4 -path "*/bin/chromium" -type f -executable 2>/dev/null | head -1', { encoding: 'utf8', timeout: 5000 }).trim();
    if (nixPath) {
      cachedChromiumPath = nixPath;
      console.log(`[LinkedIn Auto-Login] Using nix store chromium: ${cachedChromiumPath}`);
      return cachedChromiumPath;
    }
  } catch {}
  
  // Fallback to known Nix store path
  const fallbackPath = '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium';
  try {
    execSync(`test -x "${fallbackPath}"`, { timeout: 2000 });
    cachedChromiumPath = fallbackPath;
    console.log(`[LinkedIn Auto-Login] Using fallback path: ${cachedChromiumPath}`);
    return cachedChromiumPath;
  } catch {}
  
  // Try puppeteer's built-in executablePath (may find cached browser)
  try {
    const puppeteerPath = puppeteer.executablePath();
    if (puppeteerPath) {
      execSync(`test -x "${puppeteerPath}"`, { timeout: 2000 });
      cachedChromiumPath = puppeteerPath;
      console.log(`[LinkedIn Auto-Login] Using puppeteer cached browser: ${cachedChromiumPath}`);
      return cachedChromiumPath;
    }
  } catch {}
  
  // Last resort - return undefined to let puppeteer try to download/find browser
  console.log('[LinkedIn Auto-Login] No system chromium found, letting puppeteer find browser');
  cachedChromiumPath = undefined;
  return cachedChromiumPath;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export type LoginStatus = 
  | 'starting'
  | 'launching_browser'
  | 'navigating'
  | 'entering_credentials'
  | 'submitting'
  | 'waiting_for_2fa'
  | 'capturing_cookies'
  | 'success'
  | 'error';

interface LoginProgress {
  status: LoginStatus;
  message: string;
  requiresTwoFactor?: boolean;
  twoFactorType?: 'sms' | 'authenticator' | 'email';
}

interface LoginResult {
  success: boolean;
  message: string;
  cookies?: any[];
  profileName?: string;
  requiresTwoFactor?: boolean;
  twoFactorType?: string;
}

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes max for login session

const activeSessions: Map<string, {
  browser: Browser;
  page: Page;
  status: LoginStatus;
  workspaceId: string;
  userId: string;
  proxyAllocationId?: string;
  proxyId?: string;
  timeoutId?: NodeJS.Timeout;
}> = new Map();


export async function startAutomatedLogin(
  userId: string,
  workspaceId: string,
  email: string,
  password: string,
  onProgress?: (progress: LoginProgress) => void
): Promise<LoginResult> {
  let browser: Browser | null = null;
  let proxyAllocationId: string | undefined;
  
  const report = (status: LoginStatus, message: string, extra?: Partial<LoginProgress>) => {
    if (onProgress) {
      onProgress({ status, message, ...extra });
    }
    console.log(`[LinkedIn Auto-Login] ${status}: ${message}`);
  };

  const cleanupOnError = async () => {
    const session = activeSessions.get(workspaceId);
    if (session?.timeoutId) {
      clearTimeout(session.timeoutId);
    }
    if (browser) {
      try { await browser.close(); } catch {}
    }
    activeSessions.delete(workspaceId);
    if (proxyAllocationId) {
      await revokeUserProxy(userId, workspaceId).catch(() => {});
    }
  };

  const setupSessionTimeout = () => {
    const timeoutId = setTimeout(async () => {
      console.log(`[LinkedIn Auto-Login] Session timeout for workspace ${workspaceId}`);
      await cleanupOnError();
    }, SESSION_TIMEOUT_MS);
    return timeoutId;
  };

  try {
    report('starting', 'Initializing automated login...');

    const proxyResult = await getOrAllocateProxy(userId, workspaceId);
    proxyAllocationId = proxyResult.allocationId;
    
    if (!proxyResult.success) {
      console.log('[LinkedIn Auto-Login] No proxy available, proceeding without proxy');
    }
    
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
    ];

    if (proxyResult.success && proxyResult.proxy) {
      const { host, port, username, password: proxyPass } = proxyResult.proxy;
      browserArgs.push(`--proxy-server=${host}:${port}`);
      console.log(`[LinkedIn Auto-Login] Using proxy: ${host}:${port}`);
    }

    report('launching_browser', 'Launching secure browser (with Stealth)...');

    const chromiumPath = getChromiumPath();
    browser = await puppeteerExtra.launch({
      ...(chromiumPath && { executablePath: chromiumPath }),
      headless: true,
      args: browserArgs,
      defaultViewport: {
        width: 1366,
        height: 768
      }
    });

    let page = await browser.newPage();

    if (proxyResult.success && proxyResult.proxy) {
      // CRITICAL: Format username for port 7000 sticky sessions
      const formattedUsername = formatProxyUsername(
        proxyResult.proxy.username,
        proxyResult.proxy.stickySessionId,
        proxyResult.proxy.provider,
        proxyResult.proxy.port
      );
      console.log(`[LinkedIn Auto-Login] Proxy auth: formatted username for port ${proxyResult.proxy.port}`);
      await page.authenticate({
        username: formattedUsername,
        password: proxyResult.proxy.password
      });
    }

    const fingerprint = generateConsistentFingerprint(userId);
    await applyFingerprint(page, fingerprint);

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    const timeoutId = setupSessionTimeout();
    
    activeSessions.set(workspaceId, {
      browser,
      page,
      status: 'navigating',
      workspaceId,
      userId,
      proxyAllocationId: proxyResult.allocationId,
      proxyId: proxyResult.proxy?.id,
      stickySessionId: proxyResult.proxy?.stickySessionId,
      timeoutId
    });

    report('navigating', 'Navigating to LinkedIn...');
    
    // Try to navigate with proxy, fall back to no-proxy on socket errors
    let navigationSuccess = false;
    let retryWithoutProxy = false;
    
    try {
      await page.goto('https://www.linkedin.com/login', {
        waitUntil: 'networkidle2',
        timeout: 45000  // Reduced timeout for faster failover
      });
      navigationSuccess = true;
    } catch (navError: any) {
      const errorMsg = navError?.message?.toLowerCase() || '';
      // Check for proxy-related errors
      if (errorMsg.includes('socket') || 
          errorMsg.includes('econnreset') || 
          errorMsg.includes('econnrefused') ||
          errorMsg.includes('proxy') ||
          errorMsg.includes('tunnel') ||
          errorMsg.includes('timeout')) {
        console.log(`[LinkedIn Auto-Login] Proxy connection failed: ${navError.message}, retrying without proxy...`);
        retryWithoutProxy = proxyResult.success && proxyResult.proxy;
        if (!retryWithoutProxy) {
          throw navError; // No proxy was used, re-throw the error
        }
      } else {
        throw navError; // Non-proxy error, re-throw
      }
    }
    
    // Retry without proxy if proxy failed
    if (retryWithoutProxy && !navigationSuccess) {
      console.log('[LinkedIn Auto-Login] Retrying without proxy...');
      report('retrying', 'Connection issue detected, retrying...');
      
      // Close current browser and start fresh without proxy
      if (browser) {
        try { await browser.close(); } catch {}
      }
      
      const noProxyArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1366,768',
      ];
      
      const chromiumPathRetry = getChromiumPath();
      browser = await puppeteerExtra.launch({
        ...(chromiumPathRetry && { executablePath: chromiumPathRetry }),
        headless: true,
        args: noProxyArgs,
        defaultViewport: { width: 1366, height: 768 }
      });
      
      const newPage = await browser.newPage();
      const fingerprint = generateConsistentFingerprint(userId);
      await applyFingerprint(newPage, fingerprint);
      await newPage.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      });
      
      // Update page reference
      const session = activeSessions.get(workspaceId);
      if (session) {
        session.page = newPage;
        session.browser = browser;
      }
      
      await newPage.goto('https://www.linkedin.com/login', {
        waitUntil: 'networkidle2',
        timeout: 90000
      });
      
      // Replace page reference for rest of login
      page = newPage;
      console.log('[LinkedIn Auto-Login] Successfully connected without proxy');
    }

    await sleep(randomDelay(1500, 3000));

    report('entering_credentials', 'Entering credentials...');

    await page.waitForSelector('#username', { timeout: 10000 });
    await page.click('#username');
    await sleep(randomDelay(200, 500));

    for (const char of email) {
      await page.keyboard.type(char);
      await sleep(randomDelay(30, 100));
    }

    await sleep(randomDelay(300, 700));

    await page.click('#password');
    await sleep(randomDelay(200, 400));

    for (const char of password) {
      await page.keyboard.type(char);
      await sleep(randomDelay(40, 120));
    }
    
    await sleep(randomDelay(500, 1000));

    report('submitting', 'Submitting login...');

    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {})
    ]);

    await sleep(randomDelay(2000, 4000));

    const currentUrl = page.url();
    console.log(`[LinkedIn Auto-Login] Current URL after submit: ${currentUrl}`);

    if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
      const pageContent = await page.content();
      
      // Try to select verification method - prefer email, fallback to SMS, then authenticator
      let selectedMethod: 'email' | 'sms' | 'authenticator' | null = null;
      
      // Define selectors for each verification method (in priority order: email first)
      const verificationMethods = [
        {
          type: 'email' as const,
          selectors: [
            'button[data-test-id="challenge-selector-email"]',
            '[data-test="challenge-selector-email"]',
            'input[type="radio"][value="email"]',
            'button[aria-label*="email"]',
            '[data-litms-control-urn*="email"]'
          ],
          xpaths: [
            "//button[contains(translate(., 'EMAIL', 'email'), 'email')]",
            "//div[contains(@class, 'option')][contains(translate(., 'EMAIL', 'email'), 'email')]",
            "//label[contains(translate(., 'EMAIL', 'email'), 'email')]",
            "//span[contains(translate(., 'EMAIL', 'email'), 'email')]/ancestor::button",
            "//span[contains(translate(., 'EMAIL', 'email'), 'email')]/ancestor::div[@role='button']"
          ]
        },
        {
          type: 'sms' as const,
          selectors: [
            'button[data-test-id="challenge-selector-sms"]',
            '[data-test="challenge-selector-sms"]',
            'input[type="radio"][value="sms"]',
            'input[type="radio"][value="phone"]',
            'button[aria-label*="text"]',
            'button[aria-label*="SMS"]',
            'button[aria-label*="phone"]',
            '[data-litms-control-urn*="sms"]',
            '[data-litms-control-urn*="phone"]'
          ],
          xpaths: [
            "//button[contains(translate(., 'SMS', 'sms'), 'sms')]",
            "//button[contains(translate(., 'PHONE', 'phone'), 'phone')]",
            "//button[contains(translate(., 'TEXT', 'text'), 'text message')]",
            "//div[contains(@class, 'option')][contains(translate(., 'SMS', 'sms'), 'sms')]",
            "//label[contains(translate(., 'SMS', 'sms'), 'sms')]",
            "//span[contains(translate(., 'SMS', 'sms'), 'sms')]/ancestor::button"
          ]
        },
        {
          type: 'authenticator' as const,
          selectors: [
            'button[data-test-id="challenge-selector-authenticator"]',
            '[data-test="challenge-selector-authenticator"]',
            'input[type="radio"][value="authenticator"]',
            'button[aria-label*="authenticator"]',
            '[data-litms-control-urn*="authenticator"]'
          ],
          xpaths: [
            "//button[contains(translate(., 'AUTHENTICATOR', 'authenticator'), 'authenticator')]",
            "//div[contains(@class, 'option')][contains(translate(., 'AUTHENTICATOR', 'authenticator'), 'authenticator')]",
            "//label[contains(translate(., 'AUTHENTICATOR', 'authenticator'), 'authenticator')]"
          ]
        }
      ];
      
      // Try each verification method in priority order
      for (const method of verificationMethods) {
        if (selectedMethod) break;
        
        // Try CSS selectors first
        for (const selector of method.selectors) {
          try {
            const option = await page.$(selector);
            if (option) {
              console.log(`[LinkedIn Auto-Login] Found ${method.type} option with selector: ${selector}`);
              await option.click();
              await sleep(randomDelay(1500, 2500));
              console.log(`[LinkedIn Auto-Login] Selected ${method.type} verification method`);
              selectedMethod = method.type;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        if (selectedMethod) break;
        
        // Try XPath selectors
        for (const xpath of method.xpaths) {
          try {
            const elements = await page.$x(xpath);
            if (elements.length > 0) {
              console.log(`[LinkedIn Auto-Login] Found ${method.type} option with XPath: ${xpath}`);
              await (elements[0] as any).click();
              await sleep(randomDelay(1500, 2500));
              console.log(`[LinkedIn Auto-Login] Selected ${method.type} verification method via XPath`);
              selectedMethod = method.type;
              break;
            }
          } catch (e) {
            // Continue to next XPath
          }
        }
      }
      
      if (selectedMethod) {
        console.log(`[LinkedIn Auto-Login] Successfully selected ${selectedMethod} as verification method`);
      } else {
        console.log('[LinkedIn Auto-Login] Could not auto-select any verification method, proceeding with default');
      }
      
      // Re-check page content after potential selection
      const updatedPageContent = await page.content();
      
      let twoFactorType: 'sms' | 'authenticator' | 'email' = 'authenticator';
      if (updatedPageContent.includes('phone') || updatedPageContent.includes('SMS') || updatedPageContent.includes('text message')) {
        twoFactorType = 'sms';
      } else if (updatedPageContent.includes('email') || updatedPageContent.includes('Email')) {
        twoFactorType = 'email';
      }

      activeSessions.set(workspaceId, {
        browser,
        page,
        status: 'waiting_for_2fa',
        workspaceId,
        userId,
        proxyAllocationId: proxyResult.allocationId,
        proxyId: proxyResult.proxy?.id,
        stickySessionId: proxyResult.proxy?.stickySessionId
      });

      report('waiting_for_2fa', 'Two-factor authentication required', {
        requiresTwoFactor: true,
        twoFactorType
      });

      return {
        success: false,
        requiresTwoFactor: true,
        twoFactorType,
        message: `Please enter the ${twoFactorType === 'sms' ? 'SMS code' : twoFactorType === 'email' ? 'email code' : 'authenticator code'} sent to you`
      };
    }

    if (currentUrl.includes('login') && !currentUrl.includes('feed')) {
      const errorElement = await page.$('.alert-content, .form__label--error, [data-test="login-error"]');
      if (errorElement) {
        const errorText = await page.evaluate(el => el?.textContent || '', errorElement);
        await cleanupOnError();
        return {
          success: false,
          message: errorText.trim() || 'Invalid email or password'
        };
      }
    }

    report('capturing_cookies', 'Login successful! Capturing session...');

    const cookies = await page.cookies();
    const linkedInCookies = cookies.filter(c => c.domain.includes('linkedin.com'));
    
    const liAtCookie = linkedInCookies.find(c => c.name === 'li_at');
    if (!liAtCookie) {
      await cleanupOnError();
      return {
        success: false,
        message: 'Login appeared successful but session cookie not found. Please try again.'
      };
    }

    let profileName = 'LinkedIn User';
    try {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1000);
      
      // First try: Get name from page title (most reliable - matches Test Session logic)
      const pageTitle = await page.title();
      console.log(`[LinkedIn Auto-Login] Page title: ${pageTitle}`);
      
      // LinkedIn titles are typically "(22) FirstName LastName | LinkedIn" or "FirstName LastName | LinkedIn"
      if (pageTitle && pageTitle.includes('|')) {
        // Remove notification count like "(22) " if present
        let cleanTitle = pageTitle.replace(/^\(\d+\)\s*/, '');
        const namePart = cleanTitle.split('|')[0].trim();
        if (namePart && namePart.length > 2 && namePart.length < 50 && !namePart.toLowerCase().includes('linkedin')) {
          profileName = namePart;
          console.log(`[LinkedIn Auto-Login] Got name from page title: ${profileName}`);
        }
      }
      
      // Second try: Look for h1 elements on profile page
      if (profileName === 'LinkedIn User') {
        const h1Name = await page.evaluate(() => {
          const h1s = document.querySelectorAll('h1');
          for (const h1 of h1s) {
            const text = h1.textContent?.trim();
            if (text && text.length > 2 && text.length < 50 && 
                !text.toLowerCase().includes('linkedin') &&
                !text.includes('connections') &&
                !text.includes('followers')) {
              return text;
            }
          }
          return null;
        });
        if (h1Name) {
          profileName = h1Name;
          console.log(`[LinkedIn Auto-Login] Got name from h1: ${profileName}`);
        }
      }
      
      // Third try: Legacy selector as fallback
      if (profileName === 'LinkedIn User') {
        const nameElement = await page.$('.feed-identity-module__actor-meta a, .artdeco-entity-lockup__title');
        if (nameElement) {
          const legacyName = await page.evaluate(el => el?.textContent?.trim() || null, nameElement);
          if (legacyName) {
            profileName = legacyName;
            console.log(`[LinkedIn Auto-Login] Got name from legacy selector: ${profileName}`);
          }
        }
      }
    } catch (e) {
      console.log('[LinkedIn Auto-Login] Could not extract profile name, using default:', e);
    }

    const encryptedCookies = encryptToken(JSON.stringify(linkedInCookies));

    // Save session with the proxy that was used - critical for consistent IP usage
    // CRITICAL: Store sticky_session_id to maintain IP consistency across session restores
    const stickySessionId = proxyResult.proxy?.stickySessionId || null;
    const { error: saveError } = await supabase
      .from('linkedin_puppeteer_settings')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        session_cookies_encrypted: encryptedCookies,
        session_captured_at: new Date().toISOString(),
        profile_name: profileName,
        is_active: true,
        error_count: 0,
        last_error_at: null,
        session_source: 'quick_login',
        proxy_allocation_id: proxyResult.allocationId || null,
        proxy_id: proxyResult.proxy?.id || null,
        sticky_session_id: stickySessionId,
        updated_at: new Date().toISOString()
      }, { onConflict: 'workspace_id' });
    
    console.log(`[LinkedIn Auto-Login] Session saved with proxy_id: ${proxyResult.proxy?.id || 'none'}, sticky_session: ${stickySessionId || 'none'}`);

    if (saveError) {
      console.error('[LinkedIn Auto-Login] Error saving session:', saveError);
    }

    await browser.close();
    activeSessions.delete(workspaceId);

    report('success', 'LinkedIn connected successfully!');

    return {
      success: true,
      message: 'LinkedIn connected successfully!',
      profileName,
      cookies: linkedInCookies
    };

  } catch (error: any) {
    console.error('[LinkedIn Auto-Login] Error:', error);
    await cleanupOnError();
    return {
      success: false,
      message: error.message || 'Failed to connect to LinkedIn'
    };
  }
}

export async function submitTwoFactorCode(
  workspaceId: string,
  code: string
): Promise<LoginResult> {
  const session = activeSessions.get(workspaceId);
  
  if (!session) {
    return {
      success: false,
      message: 'No active login session found. Please start the login process again.'
    };
  }

  const { browser, page, userId, proxyAllocationId, proxyId, stickySessionId } = session;

  const cleanupSession = async () => {
    try { await browser.close(); } catch {}
    activeSessions.delete(workspaceId);
    if (proxyAllocationId) {
      await revokeUserProxy(userId, workspaceId).catch(() => {});
    }
  };

  try {
    console.log(`[LinkedIn Auto-Login] Submitting 2FA code for workspace ${workspaceId}`);

    const codeInput = await page.$('input[name="pin"], input[type="text"], input.input_verification_pin');
    
    if (!codeInput) {
      await cleanupSession();
      return {
        success: false,
        message: 'Could not find verification code input field'
      };
    }

    await codeInput.click();
    await sleep(randomDelay(200, 400));

    for (const char of code) {
      await page.keyboard.type(char);
      await sleep(randomDelay(50, 100));
    }

    await sleep(randomDelay(500, 1000));

    const submitButton = await page.$('button[type="submit"], button.btn-primary');
    if (submitButton) {
      await Promise.all([
        submitButton.click(),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {})
      ]);
    } else {
      await page.keyboard.press('Enter');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
    }

    await sleep(randomDelay(2000, 4000));

    const currentUrl = page.url();
    
    if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
      const pageContent = await page.content();
      if (pageContent.includes('incorrect') || pageContent.includes('wrong') || pageContent.includes('invalid')) {
        return {
          success: false,
          requiresTwoFactor: true,
          message: 'Invalid verification code. Please try again.'
        };
      }
    }

    const cookies = await page.cookies();
    const linkedInCookies = cookies.filter(c => c.domain.includes('linkedin.com'));
    
    const liAtCookie = linkedInCookies.find(c => c.name === 'li_at');
    if (!liAtCookie) {
      await cleanupSession();
      return {
        success: false,
        message: 'Verification failed. Please try again.'
      };
    }

    let profileName = 'LinkedIn User';
    try {
      // Try to get profile name from /me redirect which shows the actual profile
      await page.goto('https://www.linkedin.com/me/', { waitUntil: 'networkidle2', timeout: 15000 });
      await sleep(1500);
      
      // The /me page redirects to /in/username - extract name from page title or h1
      const pageTitle = await page.title();
      // LinkedIn title format: "FirstName LastName | LinkedIn" or "FirstName LastName - Professional Profile"
      if (pageTitle && !pageTitle.includes('LinkedIn Login') && pageTitle.includes('|')) {
        profileName = pageTitle.split('|')[0].trim();
      } else if (pageTitle && pageTitle.includes('-')) {
        profileName = pageTitle.split('-')[0].trim();
      }
      
      // Fallback: try to find the name in the profile header
      if (profileName === 'LinkedIn User' || !profileName) {
        const nameElement = await page.$('h1.text-heading-xlarge, h1.inline, .pv-top-card--list li:first-child');
        if (nameElement) {
          const extractedName = await page.evaluate(el => el?.textContent?.trim(), nameElement);
          if (extractedName && extractedName.length > 0 && extractedName.length < 100) {
            profileName = extractedName;
          }
        }
      }
      
      console.log(`[LinkedIn Auto-Login] Extracted profile name: "${profileName}"`);
    } catch (e) {
      console.log('[LinkedIn Auto-Login] Could not extract profile name, using default');
    }

    const encryptedCookies = encryptToken(JSON.stringify(linkedInCookies));

    await supabase
      .from('linkedin_puppeteer_settings')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        session_cookies_encrypted: encryptedCookies,
        session_captured_at: new Date().toISOString(),
        profile_name: profileName,
        is_active: true,
        error_count: 0,
        session_source: 'quick_login',
        proxy_allocation_id: proxyAllocationId || null,
        proxy_id: proxyId || null,
        sticky_session_id: stickySessionId || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'workspace_id' });
    
    console.log(`[LinkedIn Auto-Login] 2FA success - Session saved with proxy_id: ${proxyId || 'none'}, sticky_session: ${stickySessionId || 'none'}`);

    await cleanupSession();

    return {
      success: true,
      message: 'LinkedIn connected successfully!',
      profileName
    };

  } catch (error: any) {
    console.error('[LinkedIn Auto-Login] 2FA error:', error);
    await cleanupSession();

    return {
      success: false,
      message: error.message || 'Failed to verify code'
    };
  }
}

export async function cancelLogin(workspaceId: string): Promise<void> {
  const session = activeSessions.get(workspaceId);
  if (session) {
    const { browser, userId, proxyAllocationId } = session;
    
    try {
      await browser.close();
    } catch {}
    
    activeSessions.delete(workspaceId);
    
    if (proxyAllocationId && userId) {
      await revokeUserProxy(userId, workspaceId).catch(() => {});
    }
  }
}

export interface CookieValidationResult {
  success: boolean;
  message: string;
  proxyUsed?: { host: string; port: number };
  profileName?: string;
  validatedCookies?: any[];
}

export async function validateCookiesThroughProxy(
  userId: string,
  workspaceId: string,
  cookies: any[]
): Promise<CookieValidationResult> {
  let browser: Browser | null = null;
  let proxyHost = '';
  let proxyPort = 0;
  
  console.log(`[LinkedIn Cookie Validation] Starting validation for workspace ${workspaceId}`);
  console.log(`[LinkedIn Cookie Validation] Received ${cookies.length} cookies`);
  
  try {
    console.log(`[LinkedIn Cookie Validation] Allocating proxy for user ${userId.slice(0, 8)}...`);
    const proxyResult = await getOrAllocateProxy(userId, workspaceId);
    console.log(`[LinkedIn Cookie Validation] Proxy result: success=${proxyResult.success}, hasProxy=${!!proxyResult.proxy}, message=${proxyResult.message || 'none'}`);
    
    if (!proxyResult.success || !proxyResult.proxy) {
      console.error(`[LinkedIn Cookie Validation] Proxy allocation failed: ${proxyResult.message}`);
      return {
        success: false,
        message: `PROXY_ALLOCATION_FAILED: ${proxyResult.message || 'Unable to allocate a proxy for validation. Please contact support.'}`,
      };
    }
    
    proxyHost = proxyResult.proxy.host;
    proxyPort = proxyResult.proxy.port;
    
    const { host, port, username, password: proxyPass, stickySessionId, provider } = proxyResult.proxy;
    console.log(`[LinkedIn Cookie Validation] Using proxy: ${host}:${port}`);
    
    const browserArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--disable-extensions',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
      `--proxy-server=${host}:${port}`,
    ];
    
    const chromiumPathSession = getChromiumPath();
    browser = await puppeteerExtra.launch({
      ...(chromiumPathSession && { executablePath: chromiumPathSession }),
      headless: true,
      args: browserArgs,
      defaultViewport: { width: 1366, height: 768 },
      timeout: 60000,
    });
    
    const page = await browser.newPage();
    
    if (username && proxyPass) {
      const proxyUsername = formatProxyUsername(username, stickySessionId, provider, port);
      
      console.log(`[LinkedIn Cookie Validation] Proxy auth debug:`);
      console.log(`[LinkedIn Cookie Validation]   → Provider: ${provider || 'unknown'}`);
      console.log(`[LinkedIn Cookie Validation]   → Base username: ${username.substring(0, 10)}... (len: ${username.length})`);
      console.log(`[LinkedIn Cookie Validation]   → Password length: ${proxyPass.length}`);
      console.log(`[LinkedIn Cookie Validation]   → Session ID: ${stickySessionId || 'none'}`);
      console.log(`[LinkedIn Cookie Validation]   → Final username: ${proxyUsername.substring(0, 30)}...`);
      
      await page.authenticate({ username: proxyUsername, password: proxyPass });
      console.log(`[LinkedIn Cookie Validation] Proxy authentication configured`);
    } else {
      console.log(`[LinkedIn Cookie Validation] Skipping proxy auth: hasUsername=${!!username}, hasPassword=${!!proxyPass}`);
    }
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const normalizedCookies = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.linkedin.com',
      path: cookie.path || '/',
      secure: cookie.secure !== false,
      httpOnly: cookie.httpOnly !== false,
      ...(cookie.expires && cookie.expires > 0 ? { expires: cookie.expires } : {}),
      ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
    })).filter(c => c.name && c.value);
    
    const hasLiAt = normalizedCookies.some(c => c.name === 'li_at');
    if (!hasLiAt) {
      await browser.close();
      return {
        success: false,
        message: 'Missing required li_at cookie. Please ensure you have copied all LinkedIn cookies.',
      };
    }
    
    try {
      await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    } catch (err: any) {
      console.log(`[LinkedIn Cookie Validation] Initial navigation: ${err.message}`);
    }
    
    await page.setCookie(...normalizedCookies);
    console.log(`[LinkedIn Cookie Validation] Cookies set, navigating to feed...`);
    
    try {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2', timeout: 45000 });
    } catch (err: any) {
      if (err.message.includes('ERR_TOO_MANY_REDIRECTS')) {
        await browser.close();
        return {
          success: false,
          message: 'Session cookies are invalid or expired. Please get fresh cookies and try again.',
        };
      }
      console.log(`[LinkedIn Cookie Validation] Navigation timeout, checking page state...`);
    }
    
    const currentUrl = page.url();
    console.log(`[LinkedIn Cookie Validation] Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('login') || currentUrl.includes('authwall')) {
      await browser.close();
      return {
        success: false,
        message: 'Session cookies are expired. Please get fresh cookies from LinkedIn and try again.',
      };
    }
    
    if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
      await browser.close();
      return {
        success: false,
        message: 'LinkedIn is requesting verification. Please complete the challenge in your browser and get fresh cookies.',
      };
    }
    
    if (currentUrl.includes('chrome-error://')) {
      await browser.close();
      return {
        success: false,
        message: 'Network error while validating cookies through proxy. Please try again.',
      };
    }
    
    let isLoggedIn = false;
    try {
      // Wait briefly for page to settle after any redirects
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      isLoggedIn = await page.evaluate(() => {
        return !!(
          document.querySelector('.global-nav__me') ||
          document.querySelector('.feed-identity-module') ||
          document.querySelector('[data-control-name="identity_welcome_message"]') ||
          document.querySelector('.artdeco-card') && document.querySelector('[href*="/in/"]')
        );
      });
    } catch (evalError: any) {
      console.log(`[LinkedIn Cookie Validation] Evaluate error: ${evalError.message}`);
      // If context was destroyed due to navigation, cookies are likely invalid
      await browser.close();
      return {
        success: false,
        message: 'COOKIES_INVALID: Page redirected during validation. Your cookies may be expired. Please get fresh cookies.',
      };
    }
    
    if (!isLoggedIn) {
      await browser.close();
      return {
        success: false,
        message: 'COOKIES_INVALID: Could not verify login status. Your cookies may be expired or invalid. Please export fresh cookies from LinkedIn.',
      };
    }
    
    let profileName = 'LinkedIn User';
    try {
      // First try: Get name from page title (most reliable)
      const pageTitle = await page.title();
      if (pageTitle && pageTitle.includes('|')) {
        // Remove notification count like "(22) " if present
        let cleanTitle = pageTitle.replace(/^\(\d+\)\s*/, '');
        const namePart = cleanTitle.split('|')[0].trim();
        if (namePart && namePart.length > 2 && namePart.length < 50 && !namePart.toLowerCase().includes('linkedin')) {
          profileName = namePart;
        }
      }
      
      // Second try: Legacy selector as fallback
      if (profileName === 'LinkedIn User') {
        const nameElement = await page.$('.feed-identity-module__actor-meta, .artdeco-entity-lockup__title');
        if (nameElement) {
          const legacyName = await page.evaluate(el => el?.textContent?.trim() || null, nameElement);
          if (legacyName) {
            profileName = legacyName;
          }
        }
      }
    } catch (e) {}
    
    const validatedCookies = await page.cookies();
    const linkedInCookies = validatedCookies.filter(c => c.domain.includes('linkedin.com'));
    
    console.log(`[LinkedIn Cookie Validation] SUCCESS - Session validated through proxy ${proxyHost}:${proxyPort}`);
    
    return {
      success: true,
      message: 'Cookies validated successfully through proxy!',
      proxyUsed: { host, port },
      profileName,
      validatedCookies: linkedInCookies,
    };
    
  } catch (error: any) {
    console.error(`[LinkedIn Cookie Validation] Error:`, error.message);
    return {
      success: false,
      message: error.message?.includes('timeout') || error.message?.includes('Timeout')
        ? 'PROXY_TIMEOUT: The proxy connection timed out. Please try again.'
        : error.message?.includes('Navigation') || error.message?.includes('ERR_')
        ? 'PROXY_CONNECTION_FAILED: Could not connect through the proxy. Please try again.'
        : `VALIDATION_ERROR: ${error.message}`,
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch {}
      browser = null;
    }
  }
}

export async function connectLinkedInWithCookies(
  userId: string,
  workspaceId: string,
  cookies: any[]
): Promise<CookieValidationResult> {
  // IMPORTANT: Skip proxy validation for manually-pasted cookies!
  // Validating cookies through a proxy causes LinkedIn to detect the session
  // being used from a different IP and invalidate the session everywhere,
  // logging the user out of their browser.
  // 
  // Instead, we just verify the cookies look valid and store them.
  // The first actual scrape will confirm if they work.
  
  console.log(`[LinkedIn Manual Session] Accepting cookies without proxy validation to preserve user session`);
  console.log(`[LinkedIn Manual Session] Received ${cookies.length} cookies: ${cookies.map(c => c.name).join(', ')}`);
  
  // Basic validation - check for required cookies
  const normalizedCookies = cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain || '.linkedin.com',
    path: cookie.path || '/',
    expires: cookie.expirationDate ? Math.floor(cookie.expirationDate) : 
             cookie.expires ? Math.floor(cookie.expires) : 
             Math.floor(Date.now() / 1000) + 86400 * 365,
    httpOnly: cookie.httpOnly !== false,
    secure: cookie.secure !== false,
    ...(cookie.sameSite ? { sameSite: cookie.sameSite } : {}),
  })).filter(c => c.name && c.value);
  
  const hasLiAt = normalizedCookies.some(c => c.name === 'li_at');
  const hasJsessionid = normalizedCookies.some(c => c.name === 'JSESSIONID');
  
  if (!hasLiAt) {
    return {
      success: false,
      message: 'Missing required li_at cookie. Please ensure you copied all LinkedIn cookies.',
    };
  }
  
  if (!hasJsessionid) {
    console.log(`[LinkedIn Manual Session] Warning: JSESSIONID missing, session may be incomplete`);
  }
  
  // Warn about incomplete cookie sets - LinkedIn needs multiple cookies to work properly
  const essentialCookies = ['li_at', 'JSESSIONID', 'bcookie', 'bscookie', 'li_gc'];
  const presentCookies = essentialCookies.filter(name => normalizedCookies.some(c => c.name === name));
  const missingCookies = essentialCookies.filter(name => !normalizedCookies.some(c => c.name === name));
  
  if (normalizedCookies.length < 5) {
    console.warn(`[LinkedIn Manual Session] WARNING: Only ${normalizedCookies.length} cookies saved. LinkedIn sessions typically need 8+ cookies to work reliably.`);
    console.warn(`[LinkedIn Manual Session] Present: ${presentCookies.join(', ')}`);
    console.warn(`[LinkedIn Manual Session] Missing essential: ${missingCookies.join(', ')}`);
  }
  
  try {
    const encryptedCookies = encryptToken(JSON.stringify(normalizedCookies));
    
    await supabase
      .from('linkedin_puppeteer_settings')
      .upsert({
        workspace_id: workspaceId,
        user_id: userId,
        session_cookies_encrypted: encryptedCookies,
        session_captured_at: new Date().toISOString(),
        profile_name: 'LinkedIn User (Manual Session)',
        is_active: true,
        error_count: 0,
        session_source: 'manual',
        updated_at: new Date().toISOString()
      }, { onConflict: 'workspace_id' });
    
    console.log(`[LinkedIn Manual Session] Saved cookies for workspace ${workspaceId} (session_source=manual, no proxy)`);
    
    const cookieCountWarning = normalizedCookies.length < 5 
      ? ` Warning: Only ${normalizedCookies.length} cookies saved - scraping may fail. Please export ALL LinkedIn cookies using a browser extension like "Cookie Getter" or "EditThisCookie".`
      : '';
    
    return {
      success: true,
      message: `LinkedIn connected! ${normalizedCookies.length} cookies saved.${cookieCountWarning}`,
      profileName: 'LinkedIn User (Manual Session)',
    };
    
  } catch (error: any) {
    console.error(`[LinkedIn Manual Session] Failed to save cookies:`, error.message);
    return {
      success: false,
      message: 'Failed to save cookies. Please try again.',
    };
  }
}

export function getProxyInfoForUser(userId: string, workspaceId: string): Promise<{ host: string; port: number } | null> {
  return getOrAllocateProxy(userId, workspaceId).then(result => {
    if (result.success && result.proxy) {
      return { host: result.proxy.host, port: result.proxy.port };
    }
    return null;
  }).catch(() => null);
}
