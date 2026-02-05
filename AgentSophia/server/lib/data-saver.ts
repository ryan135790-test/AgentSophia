/**
 * Centralized Data-Saving Module for LinkedIn Automation
 * Tracks data usage and blocks unnecessary resources to minimize bandwidth
 */

// Data usage tracking per workspace per day
interface DailyUsage {
  date: string;
  bytesEstimate: number;
  pageLoads: number;
  profileVisits: number;
  actionsPerformed: number;
}

const usageByWorkspace: Map<string, DailyUsage> = new Map();

// Estimated bytes per operation (conservative estimates)
const ESTIMATES = {
  PAGE_LOAD_MINIMAL: 50_000,      // ~50KB for HTML-only page
  PAGE_LOAD_FULL: 2_000_000,      // ~2MB for full page with images
  PROFILE_VISIT: 100_000,         // ~100KB for profile check
  CONNECTION_ACTION: 20_000,      // ~20KB for connection request
  BROWSER_LAUNCH: 5_000_000,      // ~5MB for browser initialization
};

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function getWorkspaceUsage(workspaceId: string): DailyUsage {
  const today = getToday();
  const key = `${workspaceId}:${today}`;
  
  let usage = usageByWorkspace.get(key);
  if (!usage || usage.date !== today) {
    usage = {
      date: today,
      bytesEstimate: 0,
      pageLoads: 0,
      profileVisits: 0,
      actionsPerformed: 0,
    };
    usageByWorkspace.set(key, usage);
  }
  
  return usage;
}

export function trackPageLoad(workspaceId: string, isMinimal: boolean = true): void {
  const usage = getWorkspaceUsage(workspaceId);
  usage.pageLoads++;
  usage.bytesEstimate += isMinimal ? ESTIMATES.PAGE_LOAD_MINIMAL : ESTIMATES.PAGE_LOAD_FULL;
}

export function trackProfileVisit(workspaceId: string): void {
  const usage = getWorkspaceUsage(workspaceId);
  usage.profileVisits++;
  usage.bytesEstimate += ESTIMATES.PROFILE_VISIT;
}

export function trackAction(workspaceId: string): void {
  const usage = getWorkspaceUsage(workspaceId);
  usage.actionsPerformed++;
  usage.bytesEstimate += ESTIMATES.CONNECTION_ACTION;
}

export function trackBrowserLaunch(workspaceId: string): void {
  const usage = getWorkspaceUsage(workspaceId);
  usage.bytesEstimate += ESTIMATES.BROWSER_LAUNCH;
}

export function getUsageSummary(workspaceId: string): { megabytes: number; pageLoads: number; profileVisits: number; actions: number } {
  const usage = getWorkspaceUsage(workspaceId);
  return {
    megabytes: Math.round(usage.bytesEstimate / 1_000_000 * 10) / 10,
    pageLoads: usage.pageLoads,
    profileVisits: usage.profileVisits,
    actions: usage.actionsPerformed,
  };
}

export function getAllUsageSummaries(): { workspaceId: string; date: string; megabytes: number; pageLoads: number }[] {
  const summaries: { workspaceId: string; date: string; megabytes: number; pageLoads: number }[] = [];
  
  for (const [key, usage] of usageByWorkspace.entries()) {
    const [workspaceId] = key.split(':');
    summaries.push({
      workspaceId,
      date: usage.date,
      megabytes: Math.round(usage.bytesEstimate / 1_000_000 * 10) / 10,
      pageLoads: usage.pageLoads,
    });
  }
  
  return summaries;
}

// Daily limit per workspace (default 100MB)
const DAILY_LIMIT_BYTES = 100_000_000;

export function isWithinDailyLimit(workspaceId: string): boolean {
  const usage = getWorkspaceUsage(workspaceId);
  return usage.bytesEstimate < DAILY_LIMIT_BYTES;
}

export function getDailyLimitStatus(workspaceId: string): { used: number; limit: number; percentUsed: number; isOverLimit: boolean } {
  const usage = getWorkspaceUsage(workspaceId);
  const limitMB = DAILY_LIMIT_BYTES / 1_000_000;
  const usedMB = Math.round(usage.bytesEstimate / 1_000_000 * 10) / 10;
  
  return {
    used: usedMB,
    limit: limitMB,
    percentUsed: Math.round((usage.bytesEstimate / DAILY_LIMIT_BYTES) * 100),
    isOverLimit: usage.bytesEstimate >= DAILY_LIMIT_BYTES,
  };
}

/**
 * Apply ultra data-saving mode to a Puppeteer page
 * Blocks images, fonts, stylesheets, media, and tracking scripts
 */
export async function applyDataSavingMode(page: any, workspaceId?: string): Promise<void> {
  try {
    await page.setRequestInterception(true);
    
    const requestHandler = async (request: any) => {
      if (request.isInterceptResolutionHandled?.()) {
        return;
      }
      
      try {
        const resourceType = request.resourceType();
        const url = request.url().toLowerCase();
        
        // MOBILE SPA MODE: Allow almost everything from LinkedIn domains
        // The mobile SPA needs JavaScript, CSS, and API calls to render search results
        // Only block bandwidth-heavy media resources
        
        const isLinkedInDomain = url.includes('linkedin.com') || url.includes('licdn.com');
        
        // Block tracking/analytics even from LinkedIn
        const isTracking = url.includes('analytics') || 
                          url.includes('tracking') || 
                          url.includes('pixel') || 
                          url.includes('beacon') ||
                          url.includes('telemetry') ||
                          url.includes('li/track') ||
                          url.includes('/litms');
        
        // Block media resources (images, fonts, media files) from any domain
        const isMediaResource = resourceType === 'image' || 
                               resourceType === 'font' ||
                               resourceType === 'media' ||
                               url.includes('.png') ||
                               url.includes('.jpg') ||
                               url.includes('.jpeg') ||
                               url.includes('.gif') ||
                               url.includes('.svg') ||
                               url.includes('.ico') ||
                               url.includes('.webp') ||
                               url.includes('.woff') ||
                               url.includes('.woff2') ||
                               url.includes('.ttf') ||
                               url.includes('.mp4') ||
                               url.includes('.mp3') ||
                               url.includes('.wav') ||
                               url.includes('media.licdn.com');
        
        // Block third-party ads/tracking
        const isThirdPartyTracking = url.includes('doubleclick') ||
                                     url.includes('googlesyndication') ||
                                     url.includes('facebook.com/tr');
        
        // ALLOW LinkedIn requests (except tracking and media)
        if (isLinkedInDomain && !isTracking && !isMediaResource) {
          await request.continue().catch(() => {});
          return;
        }
        
        // Block third-party tracking
        if (isThirdPartyTracking || isTracking) {
          await request.abort().catch(() => {});
          return;
        }
        
        // Block media resources
        if (isMediaResource) {
          await request.abort().catch(() => {});
          return;
        }
        
        // Block other non-LinkedIn resources
        if (!isLinkedInDomain) {
          await request.abort().catch(() => {});
          return;
        }
        
        // Default: continue
        await request.continue().catch(() => {});
      } catch (err) {
        // Silently ignore - request was already handled
      }
    };
    
    page.on('request', requestHandler);
    
    // Track the page load
    if (workspaceId) {
      trackPageLoad(workspaceId, true);
    }
    
    console.log('[Data Saver] Ultra data-saving mode enabled - blocking images, fonts, CSS, media, tracking');
  } catch (err) {
    console.error('[Data Saver] Failed to apply data-saving mode:', err);
  }
}

/**
 * Lightweight page navigation that skips waiting for full load
 */
export async function navigateMinimal(page: any, url: string, workspaceId?: string): Promise<void> {
  try {
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', // Don't wait for full load
      timeout: 30000 
    });
    
    if (workspaceId) {
      trackPageLoad(workspaceId, true);
    }
  } catch (err: any) {
    if (!err.message?.includes('net::ERR_ABORTED')) {
      throw err;
    }
    // ERR_ABORTED is expected when we block resources
  }
}

// Cleanup old usage data (keep last 7 days)
export function cleanupOldUsageData(): void {
  const today = new Date();
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff = sevenDaysAgo.toISOString().split('T')[0];
  
  for (const [key, usage] of usageByWorkspace.entries()) {
    if (usage.date < cutoff) {
      usageByWorkspace.delete(key);
    }
  }
}

// Run cleanup daily
setInterval(cleanupOldUsageData, 24 * 60 * 60 * 1000);
