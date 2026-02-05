/**
 * LinkedIn CAPTCHA Detection and Handling
 * 
 * Detects various types of verification challenges and implements
 * appropriate response strategies to maintain account safety.
 */

import type { Page } from 'puppeteer-core';

export interface CaptchaDetectionResult {
  detected: boolean;
  type: 'recaptcha' | 'hcaptcha' | 'funcaptcha' | 'image_verification' | 'phone_verification' | 'email_verification' | 'security_check' | 'none';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionRequired: string;
  canAutoResolve: boolean;
  selectors?: string[];
}

export interface CaptchaHandlingResult {
  handled: boolean;
  method: 'skipped' | 'paused' | 'notified' | 'manual_required';
  message: string;
  shouldPauseAutomation: boolean;
  pauseDurationMinutes?: number;
}

// CAPTCHA selectors for different types
const CAPTCHA_SELECTORS = {
  recaptcha: [
    'iframe[src*="recaptcha"]',
    '.g-recaptcha',
    '#recaptcha',
    'iframe[title*="recaptcha"]'
  ],
  hcaptcha: [
    'iframe[src*="hcaptcha"]',
    '.h-captcha',
    '#hcaptcha'
  ],
  funcaptcha: [
    'iframe[src*="funcaptcha"]',
    '#FunCaptcha'
  ],
  image_verification: [
    '[data-test-id="captcha-challenge"]',
    '.captcha-module',
    '[class*="captcha"]',
    '[id*="captcha"]'
  ],
  security_check: [
    '[data-test-id="security-verification"]',
    '.security-verification',
    '[class*="security-check"]',
    '[class*="challenge"]'
  ],
  phone_verification: [
    '[data-test-id="phone-verification"]',
    'input[type="tel"]',
    '[class*="phone-verify"]',
    '[aria-label*="phone"]'
  ],
  email_verification: [
    '[data-test-id="email-verification"]',
    '[class*="email-verify"]',
    '[class*="verification-code"]'
  ]
};

// LinkedIn-specific warning/restriction indicators
const RESTRICTION_SELECTORS = [
  '[class*="restriction"]',
  '[class*="limited"]',
  '[class*="suspended"]',
  '[class*="blocked"]',
  '[data-test-id="restriction-banner"]',
  '.artdeco-inline-feedback--error'
];

/**
 * Detect if any CAPTCHA or verification challenge is present on the page
 */
export async function detectCaptcha(page: Page): Promise<CaptchaDetectionResult> {
  try {
    // Check for each CAPTCHA type
    for (const [type, selectors] of Object.entries(CAPTCHA_SELECTORS)) {
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            return getCaptchaResponse(type as keyof typeof CAPTCHA_SELECTORS, selectors);
          }
        } catch {
          continue;
        }
      }
    }

    // Check for restriction indicators
    for (const selector of RESTRICTION_SELECTORS) {
      try {
        const element = await page.$(selector);
        if (element) {
          return {
            detected: true,
            type: 'security_check',
            severity: 'critical',
            actionRequired: 'Account may be restricted. Manual review required.',
            canAutoResolve: false,
            selectors: [selector]
          };
        }
      } catch {
        continue;
      }
    }

    // Check page content for warning text
    const pageContent = await page.content();
    const warningPatterns = [
      /unusual activity/i,
      /verify your identity/i,
      /security check/i,
      /prove you're not a robot/i,
      /suspicious activity/i,
      /temporarily restricted/i,
      /too many requests/i
    ];

    for (const pattern of warningPatterns) {
      if (pattern.test(pageContent)) {
        return {
          detected: true,
          type: 'security_check',
          severity: 'high',
          actionRequired: 'Security warning detected in page content',
          canAutoResolve: false
        };
      }
    }

    return {
      detected: false,
      type: 'none',
      severity: 'low',
      actionRequired: 'No action required',
      canAutoResolve: true
    };

  } catch (error: any) {
    console.error('[CAPTCHA Detection] Error:', error.message);
    return {
      detected: false,
      type: 'none',
      severity: 'low',
      actionRequired: 'Detection error - proceed with caution',
      canAutoResolve: true
    };
  }
}

/**
 * Get appropriate response based on CAPTCHA type
 */
function getCaptchaResponse(type: keyof typeof CAPTCHA_SELECTORS, selectors: string[]): CaptchaDetectionResult {
  switch (type) {
    case 'recaptcha':
    case 'hcaptcha':
    case 'funcaptcha':
      return {
        detected: true,
        type,
        severity: 'high',
        actionRequired: 'CAPTCHA challenge detected. Automation must pause.',
        canAutoResolve: false,
        selectors
      };

    case 'image_verification':
      return {
        detected: true,
        type,
        severity: 'high',
        actionRequired: 'Image verification required. Manual intervention needed.',
        canAutoResolve: false,
        selectors
      };

    case 'phone_verification':
      return {
        detected: true,
        type,
        severity: 'critical',
        actionRequired: 'Phone verification required. Account may be flagged.',
        canAutoResolve: false,
        selectors
      };

    case 'email_verification':
      return {
        detected: true,
        type,
        severity: 'medium',
        actionRequired: 'Email verification required. Check inbox.',
        canAutoResolve: false,
        selectors
      };

    case 'security_check':
      return {
        detected: true,
        type,
        severity: 'critical',
        actionRequired: 'Security check triggered. Stop all automation immediately.',
        canAutoResolve: false,
        selectors
      };

    default:
      return {
        detected: true,
        type: 'security_check',
        severity: 'medium',
        actionRequired: 'Unknown verification detected',
        canAutoResolve: false,
        selectors
      };
  }
}

/**
 * Handle detected CAPTCHA - determines appropriate response
 */
export async function handleCaptcha(detection: CaptchaDetectionResult): Promise<CaptchaHandlingResult> {
  if (!detection.detected) {
    return {
      handled: true,
      method: 'skipped',
      message: 'No CAPTCHA present',
      shouldPauseAutomation: false
    };
  }

  switch (detection.severity) {
    case 'critical':
      return {
        handled: false,
        method: 'manual_required',
        message: `Critical: ${detection.actionRequired}. All automation stopped.`,
        shouldPauseAutomation: true,
        pauseDurationMinutes: 1440 // 24 hours
      };

    case 'high':
      return {
        handled: false,
        method: 'paused',
        message: `High severity: ${detection.actionRequired}. Automation paused.`,
        shouldPauseAutomation: true,
        pauseDurationMinutes: 240 // 4 hours
      };

    case 'medium':
      return {
        handled: false,
        method: 'notified',
        message: `Medium severity: ${detection.actionRequired}. User notification sent.`,
        shouldPauseAutomation: true,
        pauseDurationMinutes: 60 // 1 hour
      };

    case 'low':
    default:
      return {
        handled: true,
        method: 'skipped',
        message: 'Low severity issue - monitoring',
        shouldPauseAutomation: false
      };
  }
}

/**
 * Pre-action check - run before any LinkedIn automation action
 */
export async function preActionCaptchaCheck(page: Page): Promise<{
  canProceed: boolean;
  detection: CaptchaDetectionResult;
  handling?: CaptchaHandlingResult;
}> {
  const detection = await detectCaptcha(page);
  
  if (!detection.detected) {
    return { canProceed: true, detection };
  }

  const handling = await handleCaptcha(detection);
  
  return {
    canProceed: false,
    detection,
    handling
  };
}

/**
 * Monitor for rate limiting indicators
 */
export async function detectRateLimiting(page: Page): Promise<{
  isRateLimited: boolean;
  type: 'soft' | 'hard' | 'none';
  indicators: string[];
  recommendedPause: number; // minutes
}> {
  const indicators: string[] = [];
  
  try {
    const pageContent = await page.content();
    
    // Soft rate limiting indicators
    const softIndicators = [
      /slow down/i,
      /try again later/i,
      /too many requests/i,
      /rate limit/i
    ];
    
    // Hard rate limiting indicators
    const hardIndicators = [
      /temporarily blocked/i,
      /restricted/i,
      /suspended/i,
      /violated/i
    ];

    for (const pattern of hardIndicators) {
      if (pattern.test(pageContent)) {
        indicators.push(pattern.source);
        return {
          isRateLimited: true,
          type: 'hard',
          indicators,
          recommendedPause: 1440 // 24 hours
        };
      }
    }

    for (const pattern of softIndicators) {
      if (pattern.test(pageContent)) {
        indicators.push(pattern.source);
        return {
          isRateLimited: true,
          type: 'soft',
          indicators,
          recommendedPause: 60 // 1 hour
        };
      }
    }

    return {
      isRateLimited: false,
      type: 'none',
      indicators: [],
      recommendedPause: 0
    };

  } catch (error) {
    return {
      isRateLimited: false,
      type: 'none',
      indicators: ['Detection error'],
      recommendedPause: 30
    };
  }
}

/**
 * Check page URL for known LinkedIn challenge/restriction URLs
 */
export function checkUrlForChallenges(url: string): {
  isChallengeUrl: boolean;
  challengeType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
} {
  const challengePatterns = [
    { pattern: /checkpoint/i, type: 'checkpoint', severity: 'critical' as const },
    { pattern: /captcha/i, type: 'captcha', severity: 'high' as const },
    { pattern: /challenge/i, type: 'challenge', severity: 'high' as const },
    { pattern: /verify/i, type: 'verification', severity: 'medium' as const },
    { pattern: /restricted/i, type: 'restriction', severity: 'critical' as const },
    { pattern: /suspended/i, type: 'suspension', severity: 'critical' as const },
    { pattern: /security/i, type: 'security', severity: 'high' as const }
  ];

  for (const { pattern, type, severity } of challengePatterns) {
    if (pattern.test(url)) {
      return { isChallengeUrl: true, challengeType: type, severity };
    }
  }

  return { isChallengeUrl: false, challengeType: 'none', severity: 'low' };
}
