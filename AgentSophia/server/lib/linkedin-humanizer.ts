import type { Page } from 'puppeteer';

export async function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise(resolve => setTimeout(resolve, delay));
}

export async function humanTypeDelay(): Promise<void> {
  await randomDelay(50, 150);
}

export async function simulateMouseMovement(page: Page): Promise<void> {
  try {
    const viewport = page.viewport();
    if (!viewport) return;
    
    const startX = Math.random() * viewport.width * 0.3;
    const startY = Math.random() * viewport.height * 0.3;
    const endX = viewport.width * 0.5 + Math.random() * viewport.width * 0.3;
    const endY = viewport.height * 0.5 + Math.random() * viewport.height * 0.3;
    
    const steps = 10 + Math.floor(Math.random() * 10);
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const easeT = t * t * (3 - 2 * t);
      const x = startX + (endX - startX) * easeT;
      const y = startY + (endY - startY) * easeT;
      
      await page.mouse.move(x, y);
      await randomDelay(10, 30);
    }
  } catch (e) {
  }
}

export async function simulateHumanScroll(page: Page): Promise<void> {
  try {
    const scrolls = 2 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < scrolls; i++) {
      const scrollAmount = 200 + Math.floor(Math.random() * 400);
      
      await page.evaluate((amount) => {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }, scrollAmount);
      
      await randomDelay(800, 2000);
    }
    
    if (Math.random() > 0.7) {
      await page.evaluate(() => {
        window.scrollBy({ top: -150, behavior: 'smooth' });
      });
      await randomDelay(500, 1000);
    }
  } catch (e) {
  }
}

export async function simulatePageReading(page: Page, minSeconds: number = 3, maxSeconds: number = 8): Promise<void> {
  const readTime = (minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000;
  
  await simulateMouseMovement(page);
  await randomDelay(readTime * 0.3, readTime * 0.5);
  await simulateHumanScroll(page);
  await randomDelay(readTime * 0.3, readTime * 0.5);
  
  if (Math.random() > 0.5) {
    await simulateMouseMovement(page);
  }
}

export async function simulateHumanNavigation(page: Page): Promise<void> {
  await randomDelay(1000, 3000);
  await simulateMouseMovement(page);
  await randomDelay(500, 1500);
}

export async function getHumanPageDelay(): Promise<number> {
  const baseDelay = 25000;
  const jitter = Math.random() * 20000;
  return baseDelay + jitter;
}

export async function getProfileViewDelay(): Promise<number> {
  const baseDelay = 8000;
  const jitter = Math.random() * 7000;
  return baseDelay + jitter;
}

export function detectCaptcha(html: string): boolean {
  const lowercaseHtml = html.toLowerCase();
  
  // Check for actual CAPTCHA challenge elements/messages, NOT just the word "captcha"
  // LinkedIn embeds "captcha" in analytics scripts on normal pages, causing false positives
  const captchaIndicators = [
    // Actual CAPTCHA widget elements (specific selectors)
    'captcha-internal',
    'g-recaptcha',
    'h-captcha',
    'cf-turnstile',
    'challenge-form',
    'captcha-box',
    'captcha_container',
    'captcha-container',
    'arkose-iframe',
    // Challenge/verification messages that indicate a real block
    'please verify you are human',
    'verify you are human',
    'security verification required',
    'unusual activity detected',
    'confirm you are not a robot',
    'complete the security check',
    'solve this puzzle',
    'let\'s do a quick security check',
    // LinkedIn-specific challenge indicators (element attributes)
    'id="captcha"',
    'class="captcha"',
    'data-captcha',
  ];
  
  return captchaIndicators.some(indicator => lowercaseHtml.includes(indicator));
}

export interface RateLimitConfig {
  maxPagesPerHour: number;
  maxProfilesPerDay: number;
  cooldownHours: number;
  captchaThreshold: number;
}

export const SAFE_RATE_LIMITS: RateLimitConfig = {
  maxPagesPerHour: 10,
  maxProfilesPerDay: 120,
  cooldownHours: 6,
  captchaThreshold: 2,
};

export const WARMUP_SCHEDULE: Record<number, { maxPages: number; maxProfiles: number }> = {
  1: { maxPages: 3, maxProfiles: 15 },
  2: { maxPages: 5, maxProfiles: 30 },
  3: { maxPages: 6, maxProfiles: 45 },
  4: { maxPages: 7, maxProfiles: 60 },
  5: { maxPages: 8, maxProfiles: 80 },
  6: { maxPages: 9, maxProfiles: 100 },
  7: { maxPages: 10, maxProfiles: 120 },
};

export function getWarmupLimits(daysActive: number): { maxPages: number; maxProfiles: number } {
  if (daysActive >= 7) return WARMUP_SCHEDULE[7];
  if (daysActive < 1) return WARMUP_SCHEDULE[1];
  return WARMUP_SCHEDULE[daysActive] || WARMUP_SCHEDULE[1];
}
