/**
 * LinkedIn Anti-Fingerprint & Detection Avoidance Module
 * 
 * Implements advanced techniques to avoid browser fingerprinting and
 * LinkedIn's automation detection systems.
 */

import type { Page, Browser } from 'puppeteer-core';

export interface FingerprintProfile {
  userAgent: string;
  platform: string;
  language: string;
  languages: string[];
  screenResolution: { width: number; height: number };
  colorDepth: number;
  timezone: string;
  timezoneOffset: number;
  webGLVendor: string;
  webGLRenderer: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  plugins: number;
}

// Realistic browser fingerprint pools
const USER_AGENTS_2024 = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.2; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
];

const SCREEN_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
  { width: 1366, height: 768 },
  { width: 1536, height: 864 },
  { width: 1440, height: 900 },
  { width: 1680, height: 1050 },
  { width: 1280, height: 720 },
  { width: 1600, height: 900 },
  { width: 2560, height: 1600 },
  { width: 1920, height: 1200 }
];

const LANGUAGES = [
  { primary: 'en-US', full: ['en-US', 'en'] },
  { primary: 'en-GB', full: ['en-GB', 'en-US', 'en'] },
  { primary: 'en-US', full: ['en-US', 'en', 'es'] },
  { primary: 'en-US', full: ['en-US', 'en', 'fr'] },
  { primary: 'en-US', full: ['en-US', 'en', 'de'] }
];

const TIMEZONES = [
  { name: 'America/New_York', offset: -300 },
  { name: 'America/Chicago', offset: -360 },
  { name: 'America/Denver', offset: -420 },
  { name: 'America/Los_Angeles', offset: -480 },
  { name: 'America/Phoenix', offset: -420 },
  { name: 'Europe/London', offset: 0 },
  { name: 'Europe/Paris', offset: 60 },
  { name: 'Europe/Berlin', offset: 60 }
];

const WEBGL_CONFIGS = [
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce GTX 1080 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Apple Inc.', renderer: 'Apple M1 Pro' },
  { vendor: 'Apple Inc.', renderer: 'Apple M2' }
];

const HARDWARE_CONFIGS = [
  { cores: 8, memory: 8 },
  { cores: 4, memory: 8 },
  { cores: 6, memory: 16 },
  { cores: 8, memory: 16 },
  { cores: 12, memory: 32 },
  { cores: 16, memory: 32 }
];

/**
 * Generate a consistent fingerprint for a user
 * Same user always gets the same fingerprint to avoid detection
 */
export function generateConsistentFingerprint(userId: string): FingerprintProfile {
  // Create a simple hash from userId
  const hash = userId.split('').reduce((acc, char, idx) => {
    return acc + char.charCodeAt(0) * (idx + 1);
  }, 0);

  const userAgent = USER_AGENTS_2024[hash % USER_AGENTS_2024.length];
  const resolution = SCREEN_RESOLUTIONS[hash % SCREEN_RESOLUTIONS.length];
  const language = LANGUAGES[hash % LANGUAGES.length];
  const timezone = TIMEZONES[hash % TIMEZONES.length];
  const webgl = WEBGL_CONFIGS[hash % WEBGL_CONFIGS.length];
  const hardware = HARDWARE_CONFIGS[hash % HARDWARE_CONFIGS.length];

  // Derive platform from user agent
  let platform = 'Win32';
  if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS X')) {
    platform = 'MacIntel';
  } else if (userAgent.includes('Linux')) {
    platform = 'Linux x86_64';
  }

  return {
    userAgent,
    platform,
    language: language.primary,
    languages: language.full,
    screenResolution: resolution,
    colorDepth: 24,
    timezone: timezone.name,
    timezoneOffset: timezone.offset,
    webGLVendor: webgl.vendor,
    webGLRenderer: webgl.renderer,
    hardwareConcurrency: hardware.cores,
    deviceMemory: hardware.memory,
    plugins: 3 + (hash % 4) // 3-6 plugins
  };
}

/**
 * Apply fingerprint to a Puppeteer page
 */
export async function applyFingerprint(page: Page, fingerprint: FingerprintProfile): Promise<void> {
  // Set user agent
  await page.setUserAgent(fingerprint.userAgent);

  // Set viewport
  await page.setViewport({
    width: fingerprint.screenResolution.width,
    height: fingerprint.screenResolution.height,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  });

  // Set language headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': fingerprint.languages.join(',') + ';q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Sec-Ch-Ua-Platform': `"${fingerprint.platform.includes('Mac') ? 'macOS' : fingerprint.platform.includes('Linux') ? 'Linux' : 'Windows'}"`,
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  });

  // Override navigator properties
  await page.evaluateOnNewDocument((fp) => {
    // Override platform
    Object.defineProperty(navigator, 'platform', { get: () => fp.platform });
    
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', { get: () => fp.languages });
    Object.defineProperty(navigator, 'language', { get: () => fp.language });
    
    // Override hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => fp.hardwareConcurrency });
    
    // Override device memory
    Object.defineProperty(navigator, 'deviceMemory', { get: () => fp.deviceMemory });
    
    // Override screen properties
    Object.defineProperty(screen, 'width', { get: () => fp.screenResolution.width });
    Object.defineProperty(screen, 'height', { get: () => fp.screenResolution.height });
    Object.defineProperty(screen, 'availWidth', { get: () => fp.screenResolution.width });
    Object.defineProperty(screen, 'availHeight', { get: () => fp.screenResolution.height - 40 });
    Object.defineProperty(screen, 'colorDepth', { get: () => fp.colorDepth });
    Object.defineProperty(screen, 'pixelDepth', { get: () => fp.colorDepth });
    
    // Override plugins (simulate real plugins)
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins: Array<{ name: string; filename: string }> = [];
        for (let i = 0; i < fp.plugins; i++) {
          plugins.push({ name: `Plugin ${i}`, filename: `plugin${i}.dll` });
        }
        return plugins;
      }
    });

    // Override WebGL
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(parameter) {
      if (parameter === 37445) return fp.webGLVendor;
      if (parameter === 37446) return fp.webGLRenderer;
      return getParameter.call(this, parameter);
    };

    // Override Date for timezone
    const originalDate = Date;
    const timezoneOffset = fp.timezoneOffset;
    // @ts-ignore
    Date = class extends originalDate {
      getTimezoneOffset() {
        return timezoneOffset;
      }
    };

    // Prevent automation detection via Chrome
    // @ts-ignore
    window.chrome = { runtime: {} };

    // Override permissions API
    const originalQuery = navigator.permissions?.query;
    if (originalQuery) {
      navigator.permissions.query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'denied', onchange: null } as PermissionStatus);
        }
        return originalQuery.call(navigator.permissions, parameters);
      };
    }

  }, fingerprint);
}

/**
 * Add noise to canvas fingerprinting attempts
 */
export async function addCanvasNoise(page: Page): Promise<void> {
  await page.evaluateOnNewDocument(() => {
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    HTMLCanvasElement.prototype.toDataURL = function(type?: string, quality?: any) {
      // Add subtle noise to canvas data
      const context = this.getContext('2d');
      if (context) {
        const imageData = context.getImageData(0, 0, this.width, this.height);
        const data = imageData.data;
        // Add very subtle noise (unnoticeable to humans, changes fingerprint)
        for (let i = 0; i < data.length; i += 4) {
          data[i] = Math.max(0, Math.min(255, data[i] + (Math.random() - 0.5) * 2));
        }
        context.putImageData(imageData, 0, 0);
      }
      return originalToDataURL.call(this, type, quality);
    };
  });
}

/**
 * Randomize request timing to avoid pattern detection
 */
export function getRandomizedTiming(baseMs: number, variancePercent: number = 30): number {
  const variance = baseMs * (variancePercent / 100);
  return baseMs + (Math.random() * variance * 2 - variance);
}

/**
 * Add realistic mouse movement patterns
 */
export async function humanMouseMove(
  page: Page, 
  targetX: number, 
  targetY: number, 
  options: { steps?: number; curve?: boolean } = {}
): Promise<void> {
  const { steps = 25, curve = true } = options;
  
  // Get current mouse position (approximate from page center if unknown)
  const viewport = page.viewport();
  const startX = viewport ? viewport.width / 2 : 500;
  const startY = viewport ? viewport.height / 2 : 300;

  if (curve) {
    // Bezier curve for natural movement
    const controlX = startX + (targetX - startX) * 0.3 + (Math.random() - 0.5) * 100;
    const controlY = startY + (targetY - startY) * 0.7 + (Math.random() - 0.5) * 100;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * controlX + t * t * targetX;
      const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * controlY + t * t * targetY;
      
      await page.mouse.move(x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2);
      await new Promise(r => setTimeout(r, getRandomizedTiming(10, 50)));
    }
  } else {
    // Linear with small random deviations
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = startX + (targetX - startX) * t + (Math.random() - 0.5) * 3;
      const y = startY + (targetY - startY) * t + (Math.random() - 0.5) * 3;
      
      await page.mouse.move(x, y);
      await new Promise(r => setTimeout(r, getRandomizedTiming(8, 40)));
    }
  }
}

/**
 * Simulate realistic typing with errors and corrections
 */
export async function humanType(
  page: Page, 
  text: string, 
  options: { errorRate?: number; speedVariance?: number } = {}
): Promise<void> {
  const { errorRate = 0.02, speedVariance = 40 } = options;
  
  for (let i = 0; i < text.length; i++) {
    // Occasional typo simulation
    if (Math.random() < errorRate && text.length > 10) {
      // Type wrong character
      const wrongChar = String.fromCharCode(text.charCodeAt(i) + (Math.random() > 0.5 ? 1 : -1));
      await page.keyboard.type(wrongChar);
      await new Promise(r => setTimeout(r, getRandomizedTiming(200, 50)));
      
      // Backspace and correct
      await page.keyboard.press('Backspace');
      await new Promise(r => setTimeout(r, getRandomizedTiming(100, 30)));
    }
    
    // Type correct character
    await page.keyboard.type(text[i]);
    
    // Variable typing speed
    const baseDelay = text[i] === ' ' ? 100 : 80;
    await new Promise(r => setTimeout(r, getRandomizedTiming(baseDelay, speedVariance)));
    
    // Occasional longer pause (thinking)
    if (Math.random() < 0.05) {
      await new Promise(r => setTimeout(r, getRandomizedTiming(500, 50)));
    }
  }
}

/**
 * Check if current page behavior matches automation patterns
 */
export async function detectAutomationSignals(page: Page): Promise<{
  isDetectable: boolean;
  signals: string[];
  riskScore: number;
}> {
  const signals: string[] = [];
  let riskScore = 0;

  try {
    const automationCheck = await page.evaluate(() => {
      const checks: string[] = [];
      
      // Check for webdriver
      if (navigator.webdriver) {
        checks.push('webdriver_detected');
      }
      
      // Check for automation frameworks
      // @ts-ignore
      if (window.__selenium_unwrapped || window.__webdriver_evaluate) {
        checks.push('selenium_detected');
      }
      
      // @ts-ignore
      if (window.callPhantom || window._phantom) {
        checks.push('phantom_detected');
      }
      
      // Check plugins length
      if (navigator.plugins.length === 0) {
        checks.push('no_plugins');
      }
      
      // Check for consistent screen values
      if (screen.width === screen.availWidth && screen.height === screen.availHeight) {
        checks.push('suspicious_screen');
      }
      
      return checks;
    });

    signals.push(...automationCheck);
    riskScore = signals.length * 20;

  } catch (error) {
    signals.push('evaluation_error');
    riskScore = 10;
  }

  return {
    isDetectable: riskScore > 40,
    signals,
    riskScore: Math.min(100, riskScore)
  };
}

/**
 * Apply all anti-detection measures to a page
 */
export async function applyFullAntiDetection(page: Page, userId: string): Promise<void> {
  const fingerprint = generateConsistentFingerprint(userId);
  await applyFingerprint(page, fingerprint);
  await addCanvasNoise(page);
}
