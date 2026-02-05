import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import { getOrAllocateProxy, getProxyById } from './proxy-orchestration';
import { applyDataSavingMode, trackBrowserLaunch } from './data-saver';

// Enable stealth plugin for anti-detection
puppeteerExtra.use(StealthPlugin());

const DECODO_GLOBAL_HOST = 'gate.decodo.com';
const DECODO_US_HOST = 'gate.decodo.com'; // Switched to global - US endpoint was returning 502

function formatProxyUsername(baseUsername: string, sessionId: string | undefined, provider?: string, port?: number): string {
  if (!sessionId) return baseUsername;
  
  // CRITICAL: Decodo session parameters ONLY work on port 7000
  // Port 10048 and other ports use raw username without session formatting
  if (provider?.toLowerCase() === 'decodo' || provider?.toLowerCase() === 'smartproxy') {
    if (port !== 7000) {
      console.log(`[Proxy Auth] Decodo port ${port} - using raw username (no session param)`);
      return baseUsername;
    }
    // Port 7000 CORRECT format: user-{username}-session-{id}-sessionduration-{minutes}
    console.log(`[Proxy Auth] Decodo port 7000 - using sticky session format`);
    return `user-${baseUsername}-session-${sessionId}-sessionduration-30`;
  }
  
  switch (provider?.toLowerCase()) {
    case 'anyip':
      return `${baseUsername},session_${sessionId}`;
    case 'iproyal':
      return `${baseUsername}_session-${sessionId}`;
    case 'oxylabs':
      return baseUsername.includes('-sessid-') 
        ? baseUsername.replace(/-sessid-[^-]+/, `-sessid-${sessionId}`)
        : `${baseUsername}-sessid-${sessionId}`;
    case 'brightdata':
      return `${baseUsername}-session-${sessionId}`;
    default:
      return `${baseUsername}-session-${sessionId}`;
  }
}

let resolvedChromiumPath: string | null = null;

export async function resolveChromiumExecutable(): Promise<string> {
  if (resolvedChromiumPath) {
    return resolvedChromiumPath;
  }

  console.log('[LinkedIn Browser] Resolving Chromium path...');

  // First try CHROMIUM_PATH env var if set
  if (process.env.CHROMIUM_PATH) {
    try {
      execSync(`test -x "${process.env.CHROMIUM_PATH}"`, { timeout: 2000 });
      console.log(`[LinkedIn Browser] Using env CHROMIUM_PATH: ${process.env.CHROMIUM_PATH}`);
      resolvedChromiumPath = process.env.CHROMIUM_PATH;
      return resolvedChromiumPath;
    } catch {
      console.log('[LinkedIn Browser] CHROMIUM_PATH not executable, trying alternatives');
    }
  }

  // Try 'which chromium' - most reliable in container environments
  try {
    const whichPath = execSync('which chromium 2>/dev/null', {
      encoding: 'utf8',
      timeout: 2000,
    }).trim();
    if (whichPath) {
      console.log(`[LinkedIn Browser] Using which chromium: ${whichPath}`);
      resolvedChromiumPath = whichPath;
      return whichPath;
    }
  } catch {}

  // Default to puppeteer-managed browser (most reliable for spawn issues)
  console.log('[LinkedIn Browser] Using Puppeteer-managed browser (bundled Chromium)');
  resolvedChromiumPath = 'puppeteer-managed';
  return 'puppeteer-managed';
}

export interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  stickySessionId?: string;
  provider?: string;
}

export interface LinkedInBrowserOptions {
  cookies: any[];
  userId?: string;
  workspaceId?: string;
  useProxy?: boolean;
  timeout?: number;
  savedProxyId?: string; // Use a specific proxy (for quick_login sessions)
  disableDataSaver?: boolean; // Disable data-saving mode to load all resources
}

export interface LinkedInBrowserResult {
  browser: Browser;
  page: Page;
  proxy?: ProxyConfig;
}

function normalizeCookiesForPuppeteer(cookies: any[]): any[] {
  if (!cookies || !Array.isArray(cookies)) return [];

  const cookieMap = new Map<string, any>();

  for (const cookie of cookies) {
    if (!cookie.name || !cookie.value) continue;

    // Normalize domain to .linkedin.com for subdomain access
    let domain = cookie.domain || '.linkedin.com';
    // Strip any leading dot first, then add it back consistently
    domain = domain.replace(/^\./, '');
    // Ensure it's the root linkedin.com domain with leading dot
    if (domain === 'linkedin.com' || domain === 'www.linkedin.com') {
      domain = '.linkedin.com';
    } else if (!domain.startsWith('.')) {
      domain = '.' + domain;
    }

    const existingCookie = cookieMap.get(cookie.name);
    if (existingCookie && existingCookie.domain === '.linkedin.com' && domain !== '.linkedin.com') {
      continue;
    }

    const normalized: any = {
      name: cookie.name,
      value: cookie.value,
      domain: domain, // Use the normalized domain, not the original!
      path: cookie.path || '/',
      secure: cookie.secure !== false,
      httpOnly: cookie.httpOnly !== false,
      url: 'https://www.linkedin.com', // Add URL as fallback for Puppeteer
    };

    if (cookie.expires && cookie.expires > 0) {
      normalized.expires = cookie.expires;
    }

    if (cookie.sameSite) {
      const sameSite = String(cookie.sameSite).toLowerCase();
      if (sameSite === 'no_restriction') {
        normalized.sameSite = 'None';
      } else if (sameSite !== 'unspecified') {
        normalized.sameSite = cookie.sameSite;
      }
    }

    cookieMap.set(cookie.name, normalized);
  }

  const result = Array.from(cookieMap.values());
  console.log(`[LinkedIn Browser] Normalized ${cookies.length} cookies to ${result.length} unique`);
  
  // Debug: Log cookie domains to verify normalization
  const liAtCookie = result.find(c => c.name === 'li_at');
  if (liAtCookie) {
    console.log(`[LinkedIn Browser] li_at cookie domain: "${liAtCookie.domain}" (should be ".linkedin.com")`);
  }
  
  return result;
}

function getStealthLaunchArgs(proxyUrl?: string): string[] {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process', // Important for containerized environments
    '--disable-extensions',
    '--window-size=1920,1080',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-infobars',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-software-rasterizer', // Helps with GPU issues in containers
  ];

  if (proxyUrl) {
    args.push(`--proxy-server=${proxyUrl}`);
    args.push('--ignore-certificate-errors');
    args.push('--ignore-ssl-errors');
  }

  return args;
}

async function injectStealthScripts(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
      ],
    });

    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });

    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;

    (window as any).chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: {},
    };

    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);

    // WebGL fingerprint spoofing - critical for LinkedIn detection
    const getParameterOriginal = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter: any) {
      if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
      if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
      return getParameterOriginal.call(this, parameter);
    };
    
    const getParameter2Original = (WebGL2RenderingContext?.prototype as any)?.getParameter;
    if (getParameter2Original) {
      WebGL2RenderingContext.prototype.getParameter = function(parameter: any) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter2Original.call(this, parameter);
      };
    }

    // Canvas fingerprint noise - add tiny random variations
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
      if (this.width > 16 && this.height > 16) {
        const ctx = this.getContext('2d');
        if (ctx) {
          const imageData = ctx.getImageData(0, 0, this.width, this.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = imageData.data[i] ^ (Math.random() > 0.99 ? 1 : 0);
          }
          ctx.putImageData(imageData, 0, 0);
        }
      }
      return originalToDataURL.call(this, type, quality);
    };

    // Screen dimensions - use realistic values
    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

    // Timezone spoofing for US-based sessions
    const originalDateTimeFormat = Intl.DateTimeFormat;
    (Intl as any).DateTimeFormat = function(locale?: string | string[], options?: Intl.DateTimeFormatOptions) {
      if (!options?.timeZone) {
        options = { ...options, timeZone: 'America/New_York' };
      }
      return new originalDateTimeFormat(locale, options);
    };
    (Intl as any).DateTimeFormat.prototype = originalDateTimeFormat.prototype;
  });

  console.log('[LinkedIn Browser] Enhanced stealth scripts injected (WebGL, Canvas, Screen, Timezone)');
}

export async function launchLinkedInBrowser(options: LinkedInBrowserOptions): Promise<LinkedInBrowserResult | null> {
  const { cookies, userId, workspaceId, useProxy = true, timeout = 120000, savedProxyId, disableDataSaver = false } = options;

  // Resource management: Check if we can acquire a browser session
  let resourceManager: any;
  const sessionId = `browser-${userId || 'anon'}-${Date.now()}`;
  try {
    const rm = await import('./resource-manager.js');
    resourceManager = rm.resourceManager;
    
    if (!resourceManager.canAcquireBrowserSession()) {
      console.error('[LinkedIn Browser] Cannot launch: max concurrent browser sessions reached');
      return null;
    }
    resourceManager.acquireBrowserSession(sessionId);
  } catch (err) {
    console.log('[LinkedIn Browser] Resource manager not available, proceeding without limits');
  }

  if (!cookies || cookies.length === 0) {
    console.error('[LinkedIn Browser] No cookies provided');
    resourceManager?.releaseBrowserSession(sessionId);
    return null;
  }

  const normalizedCookies = normalizeCookiesForPuppeteer(cookies);
  if (normalizedCookies.length === 0) {
    console.error('[LinkedIn Browser] No valid cookies after normalization');
    return null;
  }

  let browser: Browser | null = null;
  let proxy: ProxyConfig | undefined;

  try {
    const chromiumPath = await resolveChromiumExecutable();
    let proxyUrl: string | undefined;

    if (useProxy && userId && workspaceId) {
      try {
        // CRITICAL: If we have a savedProxyId (from quick_login), use that specific proxy
        // This ensures we use the same proxy that was used during login to avoid IP mismatch
        let proxyResult;
        if (savedProxyId) {
          console.log(`[LinkedIn Browser] Using saved proxy ID: ${savedProxyId}`);
          proxyResult = await getProxyById(savedProxyId, userId, workspaceId);
          
          // CRITICAL: For quick_login sessions, if saved proxy lookup fails, we MUST abort
          // Proceeding without the original proxy would cause IP mismatch and trigger CAPTCHA
          if (!proxyResult.success || !proxyResult.proxy) {
            console.error(`[LinkedIn Browser] ABORT: Saved proxy ${savedProxyId} not found. Cannot proceed without matching proxy.`);
            throw new Error(`Session proxy not available. Your LinkedIn session was created with a specific proxy that is no longer available. Please re-connect your LinkedIn account.`);
          }
        } else {
          proxyResult = await getOrAllocateProxy(userId, workspaceId);
        }
        
        console.log(`[LinkedIn Browser] Proxy ${savedProxyId ? 'lookup' : 'allocation'} result: success=${proxyResult.success}, hasProxy=${!!proxyResult.proxy}, message=${proxyResult.message || 'none'}`);
        if (proxyResult.success && proxyResult.proxy) {
          let proxyHost = proxyResult.proxy.host;
          if (proxyResult.proxy.provider === 'decodo' && proxyHost === DECODO_GLOBAL_HOST) {
            proxyHost = DECODO_US_HOST;
          }
          proxyUrl = `http://${proxyHost}:${proxyResult.proxy.port}`;
          proxy = { ...proxyResult.proxy, host: proxyHost };
          console.log(`[LinkedIn Browser] Using proxy: ${proxyHost}:${proxyResult.proxy.port}`);
          console.log(`[LinkedIn Browser] Proxy auth: hasUsername=${!!proxy?.username}, hasPassword=${!!proxy?.password}, provider=${proxy?.provider}`);
        } else {
          console.log(`[LinkedIn Browser] No proxy available, proceeding without proxy`);
        }
      } catch (err: any) {
        // For saved proxy lookups, propagate the error - don't silently continue without proxy
        if (savedProxyId) {
          throw err;
        }
        console.log(`[LinkedIn Browser] Proxy allocation failed: ${err.message}, continuing without proxy`);
      }
    } else {
      console.log(`[LinkedIn Browser] Proxy skipped: useProxy=${useProxy}, hasUserId=${!!userId}, hasWorkspaceId=${!!workspaceId}`);
    }

    const args = getStealthLaunchArgs(proxyUrl);

    const launchOptions: any = {
      headless: true,
      args,
      timeout,
      protocolTimeout: timeout,
    };

    if (chromiumPath !== 'puppeteer-managed') {
      launchOptions.executablePath = chromiumPath;
    }

    console.log('[LinkedIn Browser] Launching browser...');
    
    // Retry logic for transient spawn errors (EIO, ENOENT, etc.)
    let launchAttempts = 0;
    const maxAttempts = 2;
    while (launchAttempts < maxAttempts) {
      try {
        browser = await puppeteerExtra.launch(launchOptions);
        console.log('[LinkedIn Browser] Browser launched successfully (with Stealth)');
        break;
      } catch (launchErr: any) {
        launchAttempts++;
        const isSpawnError = launchErr.message?.includes('spawn') || launchErr.code === 'EIO' || launchErr.code === 'ENOENT';
        
        if (isSpawnError && launchAttempts < maxAttempts) {
          console.log(`[LinkedIn Browser] Spawn error on attempt ${launchAttempts}, retrying in 1s...`);
          // Clear cached path in case Nix store path changed
          resolvedChromiumPath = null;
          await new Promise(r => setTimeout(r, 1000));
          const newPath = await resolveChromiumExecutable();
          if (newPath !== 'puppeteer-managed') {
            launchOptions.executablePath = newPath;
          } else {
            delete launchOptions.executablePath;
          }
          continue;
        }
        
        // Provide user-friendly error message
        if (isSpawnError) {
          throw new Error(`Browser launch failed: The browser process could not start. This is typically a temporary server resource issue. Please try again in a few moments.`);
        }
        throw launchErr;
      }
    }
    
    if (!browser) {
      throw new Error('Failed to launch browser after multiple attempts');
    }

    // Wait for browser to be fully ready before creating page
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const page = await browser.newPage();
    
    // Wait for page to be fully initialized to avoid "Requesting main frame too early" error
    await page.waitForFunction(() => true, { timeout: 5000 }).catch(() => {});
    
    // Apply data-saving mode to block images, fonts, CSS, tracking (unless disabled)
    if (!disableDataSaver) {
      await applyDataSavingMode(page, options.workspaceId);
      trackBrowserLaunch(options.workspaceId || 'unknown');
      console.log('[LinkedIn Browser] Data-saving mode enabled - blocking non-essential resources');
    } else {
      console.log('[LinkedIn Browser] Data-saving mode DISABLED - loading all resources for debugging');
    }

    if (proxy?.username && proxy?.password) {
      const proxyUsername = formatProxyUsername(proxy.username, proxy.stickySessionId, proxy.provider, proxy.port);
      
      console.log(`[LinkedIn Browser] Proxy auth debug:`);
      console.log(`[LinkedIn Browser]   → Provider: ${proxy.provider || 'unknown'}`);
      console.log(`[LinkedIn Browser]   → Base username: ${proxy.username.substring(0, 10)}... (len: ${proxy.username.length})`);
      console.log(`[LinkedIn Browser]   → Password length: ${proxy.password.length}`);
      console.log(`[LinkedIn Browser]   → Session ID: ${proxy.stickySessionId || 'none'}`);
      console.log(`[LinkedIn Browser]   → Final username: ${proxyUsername.substring(0, 30)}...`);

      await page.authenticate({ username: proxyUsername, password: proxy.password });
      console.log('[LinkedIn Browser] Proxy authentication configured');
    } else {
      console.log(`[LinkedIn Browser] Skipping proxy auth: hasUsername=${!!proxy?.username}, hasPassword=${!!proxy?.password}`);
    }

    // Force desktop experience - critical when using mobile proxies
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
    
    // Set extra headers to force desktop mode
    await page.setExtraHTTPHeaders({
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-CH-UA': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
    });
    
    await injectStealthScripts(page);

    // CRITICAL: Set cookies BEFORE any navigation to LinkedIn
    // Otherwise LinkedIn sees an unauthenticated request first and invalidates the session
    await page.setCookie(...normalizedCookies);
    console.log('[LinkedIn Browser] Cookies set successfully');
    
    // Debug: Log the cookies that were actually set
    const liAtCookieValue = normalizedCookies.find(c => c.name === 'li_at')?.value;
    console.log(`[LinkedIn Browser] Cookie debug - li_at length: ${liAtCookieValue?.length || 0}, cookies count: ${normalizedCookies.length}`);
    console.log(`[LinkedIn Browser] Cookie names being set: ${normalizedCookies.map(c => c.name).join(', ')}`);

    try {
      const response = await page.goto('https://www.linkedin.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
      const status = response?.status() || 'unknown';
      const finalUrl = page.url();
      console.log(`[LinkedIn Browser] Initial navigation: ${finalUrl} (status: ${status})`);
      
      // Check if we ended up on an error page
      if (finalUrl.includes('chrome-error://') || finalUrl === 'about:blank') {
        console.error(`[LinkedIn Browser] NETWORK ERROR - could not reach LinkedIn. Check DNS/network.`);
      } else if (finalUrl.includes('login') || finalUrl.includes('authwall')) {
        console.warn(`[LinkedIn Browser] Session cookies not accepted - redirected to login`);
      }
    } catch (err: any) {
      console.log(`[LinkedIn Browser] Initial navigation error: ${err.message}`);
    }

    return { browser, page, proxy };
  } catch (err: any) {
    console.error('[LinkedIn Browser] Launch failed:', err.message);
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
    // Release browser session on failure
    resourceManager?.releaseBrowserSession(sessionId);
    throw err;
  }
}

export function createBrowserCleanup(browser: Browser, sessionId?: string): () => Promise<void> {
  return async () => {
    try {
      await browser.close();
      console.log('[LinkedIn Browser] Browser closed');
      
      if (sessionId) {
        try {
          const { resourceManager } = await import('./resource-manager.js');
          resourceManager.releaseBrowserSession(sessionId);
        } catch {}
      }
    } catch (err: any) {
      console.error('[LinkedIn Browser] Error closing browser:', err.message);
    }
  };
}

export async function navigateToLinkedIn(page: Page, url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'; timeout?: number }): Promise<{ success: boolean; error?: string; captchaDetected?: boolean }> {
  const waitUntil = options?.waitUntil || 'domcontentloaded';
  const timeout = options?.timeout || 60000;

  try {
    await page.goto(url, { waitUntil, timeout });
    const currentUrl = page.url();

    console.log(`[LinkedIn Browser] Navigated to: ${currentUrl}`);

    if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
      console.warn('[LinkedIn Browser] CAPTCHA/checkpoint detected');
      return { success: false, error: 'CAPTCHA challenge detected', captchaDetected: true };
    }

    if (currentUrl.includes('login') || currentUrl.includes('authwall')) {
      return { success: false, error: 'Session expired - login required' };
    }

    return { success: true };
  } catch (err: any) {
    console.error(`[LinkedIn Browser] Navigation error: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export async function checkLoginStatus(page: Page): Promise<boolean> {
  try {
    const isLoggedIn = await page.evaluate(() => {
      return !!(
        document.querySelector('.global-nav__me') ||
        document.querySelector('.feed-identity-module') ||
        document.querySelector('[data-control-name="identity_welcome_message"]') ||
        document.querySelector('.search-global-typeahead')
      );
    });
    return isLoggedIn;
  } catch {
    return false;
  }
}

export async function addHumanDelay(min: number = 500, max: number = 2000): Promise<void> {
  const delay = min + Math.random() * (max - min);
  await new Promise((resolve) => setTimeout(resolve, delay));
}
