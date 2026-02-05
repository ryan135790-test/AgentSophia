/**
 * LinkedIn Safety Controls Module
 * Based on Heyreach best practices for safe LinkedIn automation
 * 
 * Key Limits (2024):
 * - Connection Requests: 20-25/day, 100-200/week
 * - Messages: 100-150/week depending on account type
 * - Profile Views: 80-100/day
 * - Total Actions: <250/day
 * - Pending Invitations: Keep under 700
 */

export interface LinkedInAccountType {
  type: 'free' | 'premium' | 'sales_navigator';
  connectionCount: number;
  accountAgeDays: number;
  ssiScore?: number; // Social Selling Index (0-100)
}

export interface DailyLimits {
  connectionRequests: number;
  messages: number;
  profileViews: number;
  searchPulls: number; // LinkedIn search result pulls per day
  postLikes: number;
  endorsements: number;
  totalActions: number;
}

export interface WeeklyLimits {
  connectionRequests: number;
  messages: number;
}

export interface WarmUpConfig {
  enabled: boolean;
  startDate: Date;
  currentDay: number;
  targetDailyConnections: number;
  schedule: WarmUpSchedule[];
}

export interface WarmUpSchedule {
  day: number;
  connectionRequests: number;
  messages: number;
  profileViews: number;
  postLikes: number;
}

export interface ActionDelaySettings {
  enabled: boolean;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  randomizeDelay: boolean;
  delayBetweenBatches: number; // seconds between batch of actions
  batchSize: number; // actions per batch before delay
  humanizationEnabled: boolean; // add extra random pauses
  humanizationChance: number; // 0-100, chance of extra pause
}

export interface MessageVariation {
  id: string;
  originalMessage: string;
  variations: string[];
  rotationType: 'sequential' | 'random' | 'ab_test';
  currentIndex: number;
  usageStats: {
    [variationIndex: number]: {
      sent: number;
      opened: number;
      replied: number;
    };
  };
}

export interface MessageVariationSettings {
  enabled: boolean;
  autoGenerateVariations: boolean;
  variationsPerMessage: number; // default 3
  variationTypes: {
    openingLine: boolean;
    closingLine: boolean;
    callToAction: boolean;
    personalization: boolean;
  };
  rotationStrategy: 'sequential' | 'random' | 'ab_test';
}

export interface SafetySettings {
  accountId: string;
  accountType: LinkedInAccountType;
  warmUpMode: WarmUpConfig;
  dailyLimits: DailyLimits;
  weeklyLimits: WeeklyLimits;
  actionDelays: ActionDelaySettings;
  messageVariations: MessageVariationSettings;
  safetyFeatures: {
    autoStopOnLowAcceptance: boolean;
    acceptanceRateThreshold: number; // Default 25%
    withdrawOldInvitations: boolean;
    pendingInvitationLimit: number; // Default 700
    pauseOnRestriction: boolean;
    workingHoursOnly: boolean;
    workingHours: { start: number; end: number };
  };
  lastUpdated: Date;
}

export interface UsageStats {
  accountId: string;
  date: string;
  connectionRequestsSent: number;
  messagesSent: number;
  profileViews: number;
  searchPulls: number; // LinkedIn search pulls
  postLikes: number;
  endorsements: number;
  totalActions: number;
  connectionsAccepted: number;
  acceptanceRate: number;
  pendingInvitations: number;
}

export interface WeeklyUsageStats {
  accountId: string;
  weekStart: string;
  connectionRequestsSent: number;
  messagesSent: number;
  totalActions: number;
  averageAcceptanceRate: number;
}

// Default limits based on Heyreach best practices
const DEFAULT_FREE_LIMITS: DailyLimits = {
  connectionRequests: 20,
  messages: 15, // ~100/week
  profileViews: 80,
  searchPulls: 1000, // 1000 LinkedIn search pulls per day per account
  postLikes: 30,
  endorsements: 10,
  totalActions: 200
};

const DEFAULT_PREMIUM_LIMITS: DailyLimits = {
  connectionRequests: 25,
  messages: 22, // ~150/week
  profileViews: 100,
  searchPulls: 1000, // 1000 LinkedIn search pulls per day per account
  postLikes: 40,
  endorsements: 15,
  totalActions: 250
};

const DEFAULT_SALES_NAV_LIMITS: DailyLimits = {
  connectionRequests: 25,
  messages: 25,
  profileViews: 100,
  searchPulls: 1000, // 1000 LinkedIn search pulls per day per account
  postLikes: 50,
  endorsements: 20,
  totalActions: 250
};

const DEFAULT_FREE_WEEKLY: WeeklyLimits = {
  connectionRequests: 100,
  messages: 100
};

const DEFAULT_PREMIUM_WEEKLY: WeeklyLimits = {
  connectionRequests: 150,
  messages: 150
};

const DEFAULT_SALES_NAV_WEEKLY: WeeklyLimits = {
  connectionRequests: 200,
  messages: 200
};

// 3-week warm-up schedule based on Heyreach recommendations
const WARM_UP_SCHEDULE: WarmUpSchedule[] = [
  { day: 1, connectionRequests: 5, messages: 3, profileViews: 20, postLikes: 10 },
  { day: 2, connectionRequests: 8, messages: 5, profileViews: 30, postLikes: 15 },
  { day: 3, connectionRequests: 10, messages: 7, profileViews: 40, postLikes: 20 },
  { day: 4, connectionRequests: 12, messages: 8, profileViews: 50, postLikes: 25 },
  { day: 5, connectionRequests: 15, messages: 10, profileViews: 60, postLikes: 30 },
  { day: 6, connectionRequests: 17, messages: 12, profileViews: 65, postLikes: 32 },
  { day: 7, connectionRequests: 18, messages: 13, profileViews: 70, postLikes: 35 },
  { day: 8, connectionRequests: 19, messages: 14, profileViews: 72, postLikes: 36 },
  { day: 9, connectionRequests: 20, messages: 15, profileViews: 75, postLikes: 38 },
  { day: 10, connectionRequests: 20, messages: 15, profileViews: 78, postLikes: 40 },
  { day: 11, connectionRequests: 21, messages: 16, profileViews: 80, postLikes: 42 },
  { day: 12, connectionRequests: 22, messages: 17, profileViews: 82, postLikes: 44 },
  { day: 13, connectionRequests: 23, messages: 18, profileViews: 85, postLikes: 46 },
  { day: 14, connectionRequests: 24, messages: 19, profileViews: 88, postLikes: 48 },
  { day: 15, connectionRequests: 25, messages: 20, profileViews: 90, postLikes: 50 },
  { day: 16, connectionRequests: 25, messages: 20, profileViews: 92, postLikes: 50 },
  { day: 17, connectionRequests: 25, messages: 21, profileViews: 94, postLikes: 50 },
  { day: 18, connectionRequests: 25, messages: 22, profileViews: 96, postLikes: 50 },
  { day: 19, connectionRequests: 25, messages: 22, profileViews: 98, postLikes: 50 },
  { day: 20, connectionRequests: 25, messages: 22, profileViews: 100, postLikes: 50 },
  { day: 21, connectionRequests: 25, messages: 22, profileViews: 100, postLikes: 50 },
];

// In-memory storage for safety settings and usage tracking
const safetySettingsStore = new Map<string, SafetySettings>();
const dailyUsageStore = new Map<string, UsageStats>();
const weeklyUsageStore = new Map<string, WeeklyUsageStats>();
const actionLogStore: Array<{
  accountId: string;
  action: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}> = [];

/**
 * Get default limits based on account type
 */
export function getDefaultLimits(accountType: LinkedInAccountType['type']): {
  daily: DailyLimits;
  weekly: WeeklyLimits;
} {
  switch (accountType) {
    case 'sales_navigator':
      return { daily: DEFAULT_SALES_NAV_LIMITS, weekly: DEFAULT_SALES_NAV_WEEKLY };
    case 'premium':
      return { daily: DEFAULT_PREMIUM_LIMITS, weekly: DEFAULT_PREMIUM_WEEKLY };
    default:
      return { daily: DEFAULT_FREE_LIMITS, weekly: DEFAULT_FREE_WEEKLY };
  }
}

/**
 * Initialize safety settings for an account
 */
export function initializeSafetySettings(
  accountId: string,
  accountType: LinkedInAccountType,
  enableWarmUp: boolean = false
): SafetySettings {
  const defaults = getDefaultLimits(accountType.type);
  
  const settings: SafetySettings = {
    accountId,
    accountType,
    warmUpMode: {
      enabled: enableWarmUp || accountType.connectionCount < 100,
      startDate: new Date(),
      currentDay: 1,
      targetDailyConnections: defaults.daily.connectionRequests,
      schedule: WARM_UP_SCHEDULE
    },
    dailyLimits: defaults.daily,
    weeklyLimits: defaults.weekly,
    actionDelays: {
      enabled: true,
      minDelaySeconds: 45,
      maxDelaySeconds: 180,
      randomizeDelay: true,
      delayBetweenBatches: 300, // 5 minutes between batches
      batchSize: 5,
      humanizationEnabled: true,
      humanizationChance: 30 // 30% chance of extra pause
    },
    messageVariations: {
      enabled: true,
      autoGenerateVariations: false,
      variationsPerMessage: 3,
      variationTypes: {
        openingLine: true,
        closingLine: true,
        callToAction: true,
        personalization: true
      },
      rotationStrategy: 'random'
    },
    safetyFeatures: {
      autoStopOnLowAcceptance: true,
      acceptanceRateThreshold: 25,
      withdrawOldInvitations: true,
      pendingInvitationLimit: 700,
      pauseOnRestriction: true,
      workingHoursOnly: true,
      workingHours: { start: 9, end: 18 }
    },
    lastUpdated: new Date()
  };
  
  safetySettingsStore.set(accountId, settings);
  return settings;
}

/**
 * Get safety settings for an account
 */
export function getSafetySettings(accountId: string): SafetySettings | null {
  return safetySettingsStore.get(accountId) || null;
}

/**
 * Update safety settings
 */
export function updateSafetySettings(
  accountId: string,
  updates: Partial<SafetySettings>
): SafetySettings | null {
  const existing = safetySettingsStore.get(accountId);
  if (!existing) return null;
  
  const updated = {
    ...existing,
    ...updates,
    lastUpdated: new Date()
  };
  
  safetySettingsStore.set(accountId, updated);
  return updated;
}

/**
 * Update custom daily limits for an account
 * Allows full customization of all daily limits per account
 */
export function updateCustomDailyLimits(
  accountId: string,
  limits: Partial<DailyLimits>
): SafetySettings | null {
  const settings = safetySettingsStore.get(accountId);
  if (!settings) return null;
  
  settings.dailyLimits = {
    ...settings.dailyLimits,
    ...limits
  };
  settings.lastUpdated = new Date();
  
  safetySettingsStore.set(accountId, settings);
  return settings;
}

/**
 * Update custom weekly limits for an account
 */
export function updateCustomWeeklyLimits(
  accountId: string,
  limits: Partial<WeeklyLimits>
): SafetySettings | null {
  const settings = safetySettingsStore.get(accountId);
  if (!settings) return null;
  
  settings.weeklyLimits = {
    ...settings.weeklyLimits,
    ...limits
  };
  settings.lastUpdated = new Date();
  
  safetySettingsStore.set(accountId, settings);
  return settings;
}

/**
 * Get current effective limits (considering warm-up mode)
 */
export function getCurrentLimits(accountId: string): DailyLimits {
  const settings = safetySettingsStore.get(accountId);
  if (!settings) {
    return DEFAULT_FREE_LIMITS;
  }
  
  if (settings.warmUpMode.enabled) {
    const daysSinceStart = Math.floor(
      (Date.now() - settings.warmUpMode.startDate.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1;
    
    const scheduleDay = Math.min(daysSinceStart, WARM_UP_SCHEDULE.length);
    const schedule = WARM_UP_SCHEDULE[scheduleDay - 1];
    
    return {
      connectionRequests: schedule.connectionRequests,
      messages: schedule.messages,
      profileViews: schedule.profileViews,
      searchPulls: settings.dailyLimits.searchPulls, // Use account's custom search limit
      postLikes: schedule.postLikes,
      endorsements: Math.floor(schedule.postLikes / 3),
      totalActions: schedule.connectionRequests + schedule.messages + 
                    schedule.profileViews + schedule.postLikes
    };
  }
  
  return settings.dailyLimits;
}

/**
 * Get today's usage stats for an account
 */
export function getTodayUsage(accountId: string): UsageStats {
  const today = new Date().toISOString().split('T')[0];
  const key = `${accountId}:${today}`;
  
  return dailyUsageStore.get(key) || {
    accountId,
    date: today,
    connectionRequestsSent: 0,
    messagesSent: 0,
    profileViews: 0,
    searchPulls: 0,
    postLikes: 0,
    endorsements: 0,
    totalActions: 0,
    connectionsAccepted: 0,
    acceptanceRate: 0,
    pendingInvitations: 0
  };
}

/**
 * Get this week's usage stats
 */
export function getWeeklyUsage(accountId: string): WeeklyUsageStats {
  const weekStart = getWeekStart(new Date()).toISOString().split('T')[0];
  const key = `${accountId}:${weekStart}`;
  
  return weeklyUsageStore.get(key) || {
    accountId,
    weekStart,
    connectionRequestsSent: 0,
    messagesSent: 0,
    totalActions: 0,
    averageAcceptanceRate: 0
  };
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * Check if an action can be performed
 */
export function canPerformAction(
  accountId: string,
  actionType: 'connection_request' | 'message' | 'profile_view' | 'post_like' | 'endorsement'
): { allowed: boolean; reason?: string; remainingToday?: number; remainingThisWeek?: number } {
  const settings = safetySettingsStore.get(accountId);
  if (!settings) {
    return { allowed: false, reason: 'Account not configured for safety controls' };
  }
  
  // Check working hours
  if (settings.safetyFeatures.workingHoursOnly) {
    const hour = new Date().getHours();
    if (hour < settings.safetyFeatures.workingHours.start || 
        hour >= settings.safetyFeatures.workingHours.end) {
      return { 
        allowed: false, 
        reason: `Outside working hours (${settings.safetyFeatures.workingHours.start}:00-${settings.safetyFeatures.workingHours.end}:00)` 
      };
    }
  }
  
  const limits = getCurrentLimits(accountId);
  const todayUsage = getTodayUsage(accountId);
  const weeklyUsage = getWeeklyUsage(accountId);
  
  // Check total daily actions
  if (todayUsage.totalActions >= limits.totalActions) {
    return { 
      allowed: false, 
      reason: `Daily action limit reached (${limits.totalActions})`,
      remainingToday: 0
    };
  }
  
  // Check acceptance rate
  if (settings.safetyFeatures.autoStopOnLowAcceptance && 
      todayUsage.connectionRequestsSent > 20) {
    if (todayUsage.acceptanceRate < settings.safetyFeatures.acceptanceRateThreshold) {
      return {
        allowed: false,
        reason: `Acceptance rate too low (${todayUsage.acceptanceRate}% < ${settings.safetyFeatures.acceptanceRateThreshold}%)`
      };
    }
  }
  
  // Check pending invitations
  if (actionType === 'connection_request' && 
      todayUsage.pendingInvitations >= settings.safetyFeatures.pendingInvitationLimit) {
    return {
      allowed: false,
      reason: `Too many pending invitations (${todayUsage.pendingInvitations}/${settings.safetyFeatures.pendingInvitationLimit})`
    };
  }
  
  // Check specific action limits
  switch (actionType) {
    case 'connection_request':
      if (todayUsage.connectionRequestsSent >= limits.connectionRequests) {
        return { 
          allowed: false, 
          reason: `Daily connection request limit reached (${limits.connectionRequests})`,
          remainingToday: 0,
          remainingThisWeek: Math.max(0, settings.weeklyLimits.connectionRequests - weeklyUsage.connectionRequestsSent)
        };
      }
      if (weeklyUsage.connectionRequestsSent >= settings.weeklyLimits.connectionRequests) {
        return {
          allowed: false,
          reason: `Weekly connection request limit reached (${settings.weeklyLimits.connectionRequests})`,
          remainingToday: 0,
          remainingThisWeek: 0
        };
      }
      return {
        allowed: true,
        remainingToday: limits.connectionRequests - todayUsage.connectionRequestsSent,
        remainingThisWeek: settings.weeklyLimits.connectionRequests - weeklyUsage.connectionRequestsSent
      };
      
    case 'message':
      if (todayUsage.messagesSent >= limits.messages) {
        return { 
          allowed: false, 
          reason: `Daily message limit reached (${limits.messages})`,
          remainingToday: 0
        };
      }
      if (weeklyUsage.messagesSent >= settings.weeklyLimits.messages) {
        return {
          allowed: false,
          reason: `Weekly message limit reached (${settings.weeklyLimits.messages})`,
          remainingThisWeek: 0
        };
      }
      return {
        allowed: true,
        remainingToday: limits.messages - todayUsage.messagesSent,
        remainingThisWeek: settings.weeklyLimits.messages - weeklyUsage.messagesSent
      };
      
    case 'profile_view':
      if (todayUsage.profileViews >= limits.profileViews) {
        return { 
          allowed: false, 
          reason: `Daily profile view limit reached (${limits.profileViews})`,
          remainingToday: 0
        };
      }
      return {
        allowed: true,
        remainingToday: limits.profileViews - todayUsage.profileViews
      };
      
    case 'post_like':
      if (todayUsage.postLikes >= limits.postLikes) {
        return { 
          allowed: false, 
          reason: `Daily post like limit reached (${limits.postLikes})`,
          remainingToday: 0
        };
      }
      return {
        allowed: true,
        remainingToday: limits.postLikes - todayUsage.postLikes
      };
      
    case 'endorsement':
      if (todayUsage.endorsements >= limits.endorsements) {
        return { 
          allowed: false, 
          reason: `Daily endorsement limit reached (${limits.endorsements})`,
          remainingToday: 0
        };
      }
      return {
        allowed: true,
        remainingToday: limits.endorsements - todayUsage.endorsements
      };
      
    default:
      return { allowed: true };
  }
}

/**
 * Record an action (call this after successful action)
 */
export function recordAction(
  accountId: string,
  actionType: 'connection_request' | 'message' | 'profile_view' | 'post_like' | 'endorsement',
  success: boolean = true,
  error?: string
): void {
  const today = new Date().toISOString().split('T')[0];
  const dailyKey = `${accountId}:${today}`;
  const weekStart = getWeekStart(new Date()).toISOString().split('T')[0];
  const weeklyKey = `${accountId}:${weekStart}`;
  
  // Update daily stats
  const dailyStats = getTodayUsage(accountId);
  
  if (success) {
    switch (actionType) {
      case 'connection_request':
        dailyStats.connectionRequestsSent++;
        break;
      case 'message':
        dailyStats.messagesSent++;
        break;
      case 'profile_view':
        dailyStats.profileViews++;
        break;
      case 'post_like':
        dailyStats.postLikes++;
        break;
      case 'endorsement':
        dailyStats.endorsements++;
        break;
    }
    dailyStats.totalActions++;
  }
  
  dailyUsageStore.set(dailyKey, dailyStats);
  
  // Update weekly stats
  const weeklyStats = getWeeklyUsage(accountId);
  if (success) {
    if (actionType === 'connection_request') {
      weeklyStats.connectionRequestsSent++;
    } else if (actionType === 'message') {
      weeklyStats.messagesSent++;
    }
    weeklyStats.totalActions++;
  }
  weeklyUsageStore.set(weeklyKey, weeklyStats);
  
  // Log action
  actionLogStore.push({
    accountId,
    action: actionType,
    timestamp: new Date(),
    success,
    error
  });
  
  // Keep log size manageable
  if (actionLogStore.length > 10000) {
    actionLogStore.splice(0, 1000);
  }
}

/**
 * Record a connection acceptance (for tracking acceptance rate)
 */
export function recordConnectionAccepted(accountId: string): void {
  const today = new Date().toISOString().split('T')[0];
  const key = `${accountId}:${today}`;
  
  const stats = getTodayUsage(accountId);
  stats.connectionsAccepted++;
  
  if (stats.connectionRequestsSent > 0) {
    stats.acceptanceRate = Math.round(
      (stats.connectionsAccepted / stats.connectionRequestsSent) * 100
    );
  }
  
  dailyUsageStore.set(key, stats);
}

/**
 * Update pending invitation count
 */
export function updatePendingInvitations(accountId: string, count: number): void {
  const today = new Date().toISOString().split('T')[0];
  const key = `${accountId}:${today}`;
  
  const stats = getTodayUsage(accountId);
  stats.pendingInvitations = count;
  dailyUsageStore.set(key, stats);
}

/**
 * Get warm-up progress
 */
export function getWarmUpProgress(accountId: string): {
  enabled: boolean;
  currentDay: number;
  totalDays: number;
  percentComplete: number;
  currentLimits: DailyLimits;
  targetLimits: DailyLimits;
  daysRemaining: number;
} | null {
  const settings = safetySettingsStore.get(accountId);
  if (!settings) return null;
  
  const daysSinceStart = Math.floor(
    (Date.now() - settings.warmUpMode.startDate.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  
  const currentDay = Math.min(daysSinceStart, WARM_UP_SCHEDULE.length);
  const totalDays = WARM_UP_SCHEDULE.length;
  
  return {
    enabled: settings.warmUpMode.enabled,
    currentDay,
    totalDays,
    percentComplete: Math.round((currentDay / totalDays) * 100),
    currentLimits: getCurrentLimits(accountId),
    targetLimits: settings.dailyLimits,
    daysRemaining: Math.max(0, totalDays - currentDay)
  };
}

/**
 * Enable/disable warm-up mode
 */
export function setWarmUpMode(accountId: string, enabled: boolean): SafetySettings | null {
  const settings = safetySettingsStore.get(accountId);
  if (!settings) return null;
  
  settings.warmUpMode.enabled = enabled;
  if (enabled) {
    settings.warmUpMode.startDate = new Date();
    settings.warmUpMode.currentDay = 1;
  }
  settings.lastUpdated = new Date();
  
  safetySettingsStore.set(accountId, settings);
  return settings;
}

/**
 * Get recent action log
 */
export function getRecentActions(accountId: string, limit: number = 50): Array<{
  action: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}> {
  return actionLogStore
    .filter(log => log.accountId === accountId)
    .slice(-limit)
    .reverse();
}

/**
 * Get safety recommendations based on current usage
 */
export function getSafetyRecommendations(accountId: string): string[] {
  const recommendations: string[] = [];
  const settings = safetySettingsStore.get(accountId);
  const todayUsage = getTodayUsage(accountId);
  const weeklyUsage = getWeeklyUsage(accountId);
  
  if (!settings) {
    recommendations.push('Configure safety settings for this account');
    return recommendations;
  }
  
  // Check acceptance rate
  if (todayUsage.acceptanceRate > 0 && todayUsage.acceptanceRate < 25) {
    recommendations.push(
      `Your acceptance rate (${todayUsage.acceptanceRate}%) is below 25%. Consider improving your targeting or profile.`
    );
  }
  
  // Check pending invitations
  if (todayUsage.pendingInvitations > 500) {
    recommendations.push(
      `You have ${todayUsage.pendingInvitations} pending invitations. Consider withdrawing old ones (recommended: keep under 700).`
    );
  }
  
  // Check if nearing limits
  const limits = getCurrentLimits(accountId);
  if (todayUsage.connectionRequestsSent > limits.connectionRequests * 0.8) {
    recommendations.push(
      `You've used ${todayUsage.connectionRequestsSent}/${limits.connectionRequests} connection requests today. Consider pacing.`
    );
  }
  
  // Warm-up recommendations
  if (settings.accountType.connectionCount < 100 && !settings.warmUpMode.enabled) {
    recommendations.push(
      'Your account has fewer than 100 connections. Enable warm-up mode for safer automation.'
    );
  }
  
  // Weekly pacing
  const weeklyConnectionLimit = settings.weeklyLimits.connectionRequests;
  const dayOfWeek = new Date().getDay();
  const expectedWeeklyProgress = (dayOfWeek / 7) * weeklyConnectionLimit;
  
  if (weeklyUsage.connectionRequestsSent > expectedWeeklyProgress * 1.3) {
    recommendations.push(
      'You\'re ahead of weekly pacing. Consider slowing down to avoid hitting weekly limits early.'
    );
  }
  
  return recommendations;
}

/**
 * Get all configured accounts
 */
export function getAllConfiguredAccounts(): SafetySettings[] {
  return Array.from(safetySettingsStore.values());
}

/**
 * Get dashboard summary for all accounts
 */
export function getSafetyDashboard(): {
  accounts: Array<{
    accountId: string;
    accountType: string;
    warmUpEnabled: boolean;
    warmUpProgress: number;
    todayUsage: UsageStats;
    weeklyUsage: WeeklyUsageStats;
    limits: DailyLimits;
    healthScore: number;
    recommendations: string[];
  }>;
  totalStats: {
    totalAccounts: number;
    activeToday: number;
    totalConnectionsSentToday: number;
    totalMessagesSentToday: number;
    averageAcceptanceRate: number;
  };
} {
  const accounts = getAllConfiguredAccounts();
  
  const accountSummaries = accounts.map(settings => {
    const todayUsage = getTodayUsage(settings.accountId);
    const weeklyUsage = getWeeklyUsage(settings.accountId);
    const warmUpProgress = getWarmUpProgress(settings.accountId);
    
    // Calculate health score (0-100)
    let healthScore = 100;
    if (todayUsage.acceptanceRate > 0 && todayUsage.acceptanceRate < 25) {
      healthScore -= 30;
    }
    if (todayUsage.pendingInvitations > 500) {
      healthScore -= 20;
    }
    if (todayUsage.totalActions > getCurrentLimits(settings.accountId).totalActions * 0.9) {
      healthScore -= 15;
    }
    
    return {
      accountId: settings.accountId,
      accountType: settings.accountType.type,
      warmUpEnabled: settings.warmUpMode.enabled,
      warmUpProgress: warmUpProgress?.percentComplete || 0,
      todayUsage,
      weeklyUsage,
      limits: getCurrentLimits(settings.accountId),
      healthScore: Math.max(0, healthScore),
      recommendations: getSafetyRecommendations(settings.accountId)
    };
  });
  
  const totalStats = {
    totalAccounts: accounts.length,
    activeToday: accountSummaries.filter(a => a.todayUsage.totalActions > 0).length,
    totalConnectionsSentToday: accountSummaries.reduce((sum, a) => sum + a.todayUsage.connectionRequestsSent, 0),
    totalMessagesSentToday: accountSummaries.reduce((sum, a) => sum + a.todayUsage.messagesSent, 0),
    averageAcceptanceRate: accountSummaries.length > 0
      ? Math.round(accountSummaries.reduce((sum, a) => sum + a.todayUsage.acceptanceRate, 0) / accountSummaries.length)
      : 0
  };
  
  return { accounts: accountSummaries, totalStats };
}

// ============================================
// TIME DELAY & HUMANIZATION FUNCTIONS
// ============================================

// Track last action time per account
const lastActionTimeStore = new Map<string, Date>();
const actionCountInBatchStore = new Map<string, number>();

/**
 * Calculate the next delay before an action can be performed
 * Returns delay in milliseconds
 */
export function calculateNextDelay(accountId: string): {
  delayMs: number;
  reason: string;
  humanized: boolean;
} {
  const settings = safetySettingsStore.get(accountId);
  if (!settings || !settings.actionDelays.enabled) {
    return { delayMs: 0, reason: 'Delays disabled', humanized: false };
  }
  
  const { minDelaySeconds, maxDelaySeconds, randomizeDelay, humanizationEnabled, humanizationChance } = settings.actionDelays;
  
  // Calculate base delay
  let delaySeconds: number;
  if (randomizeDelay) {
    delaySeconds = minDelaySeconds + Math.random() * (maxDelaySeconds - minDelaySeconds);
  } else {
    delaySeconds = (minDelaySeconds + maxDelaySeconds) / 2;
  }
  
  // Add humanization (extra random pauses)
  let humanized = false;
  if (humanizationEnabled && Math.random() * 100 < humanizationChance) {
    // Add an extra 30-120 seconds for humanization
    delaySeconds += 30 + Math.random() * 90;
    humanized = true;
  }
  
  return {
    delayMs: Math.round(delaySeconds * 1000),
    reason: humanized ? 'Humanized delay for natural behavior' : 'Standard safety delay',
    humanized
  };
}

/**
 * Check if batch delay is needed (after X actions, take a longer break)
 */
export function shouldTakeBatchBreak(accountId: string): {
  shouldBreak: boolean;
  breakDurationMs: number;
  actionsInBatch: number;
} {
  const settings = safetySettingsStore.get(accountId);
  if (!settings || !settings.actionDelays.enabled) {
    return { shouldBreak: false, breakDurationMs: 0, actionsInBatch: 0 };
  }
  
  const actionsInBatch = actionCountInBatchStore.get(accountId) || 0;
  const { batchSize, delayBetweenBatches } = settings.actionDelays;
  
  if (actionsInBatch >= batchSize) {
    return {
      shouldBreak: true,
      breakDurationMs: delayBetweenBatches * 1000,
      actionsInBatch
    };
  }
  
  return { shouldBreak: false, breakDurationMs: 0, actionsInBatch };
}

/**
 * Record action for batch tracking
 */
export function recordActionForBatch(accountId: string): void {
  const current = actionCountInBatchStore.get(accountId) || 0;
  actionCountInBatchStore.set(accountId, current + 1);
  lastActionTimeStore.set(accountId, new Date());
}

/**
 * Reset batch counter after batch break
 */
export function resetBatchCounter(accountId: string): void {
  actionCountInBatchStore.set(accountId, 0);
}

/**
 * Get time since last action
 */
export function getTimeSinceLastAction(accountId: string): number {
  const lastAction = lastActionTimeStore.get(accountId);
  if (!lastAction) return Infinity;
  return Date.now() - lastAction.getTime();
}

/**
 * Update action delay settings
 */
export function updateActionDelays(
  accountId: string,
  updates: Partial<ActionDelaySettings>
): SafetySettings | null {
  const settings = safetySettingsStore.get(accountId);
  if (!settings) return null;
  
  settings.actionDelays = {
    ...settings.actionDelays,
    ...updates
  };
  settings.lastUpdated = new Date();
  
  safetySettingsStore.set(accountId, settings);
  return settings;
}

// ============================================
// MESSAGE VARIATION FUNCTIONS
// ============================================

const messageVariationsStore = new Map<string, MessageVariation[]>();

/**
 * Create message variations for a template
 */
export function createMessageVariations(
  accountId: string,
  originalMessage: string,
  variations: string[]
): MessageVariation {
  const settings = safetySettingsStore.get(accountId);
  const rotationType = settings?.messageVariations.rotationStrategy || 'random';
  
  const variation: MessageVariation = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    originalMessage,
    variations,
    rotationType,
    currentIndex: 0,
    usageStats: {}
  };
  
  // Initialize usage stats for each variation
  variations.forEach((_, idx) => {
    variation.usageStats[idx] = { sent: 0, opened: 0, replied: 0 };
  });
  
  // Store the variation
  const existingVariations = messageVariationsStore.get(accountId) || [];
  existingVariations.push(variation);
  messageVariationsStore.set(accountId, existingVariations);
  
  return variation;
}

/**
 * Get the next message variation to use
 */
export function getNextMessageVariation(
  accountId: string,
  variationId: string
): { message: string; variationIndex: number } | null {
  const variations = messageVariationsStore.get(accountId);
  if (!variations) return null;
  
  const variation = variations.find(v => v.id === variationId);
  if (!variation || variation.variations.length === 0) return null;
  
  let index: number;
  
  switch (variation.rotationType) {
    case 'sequential':
      index = variation.currentIndex;
      variation.currentIndex = (variation.currentIndex + 1) % variation.variations.length;
      break;
      
    case 'random':
      index = Math.floor(Math.random() * variation.variations.length);
      break;
      
    case 'ab_test':
      // For A/B testing, weight selection by reply rate
      const weights = variation.variations.map((_, idx) => {
        const stats = variation.usageStats[idx];
        if (stats.sent === 0) return 1; // Equal weight for unsent
        return stats.replied / stats.sent; // Weight by reply rate
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let random = Math.random() * totalWeight;
      index = 0;
      for (let i = 0; i < weights.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          index = i;
          break;
        }
      }
      break;
      
    default:
      index = 0;
  }
  
  return {
    message: variation.variations[index],
    variationIndex: index
  };
}

/**
 * Record variation usage
 */
export function recordVariationUsage(
  accountId: string,
  variationId: string,
  variationIndex: number,
  outcome: 'sent' | 'opened' | 'replied'
): void {
  const variations = messageVariationsStore.get(accountId);
  if (!variations) return;
  
  const variation = variations.find(v => v.id === variationId);
  if (!variation || !variation.usageStats[variationIndex]) return;
  
  variation.usageStats[variationIndex][outcome]++;
}

/**
 * Get variation performance stats
 */
export function getVariationStats(
  accountId: string,
  variationId: string
): { variationIndex: number; sent: number; opened: number; replied: number; openRate: number; replyRate: number }[] | null {
  const variations = messageVariationsStore.get(accountId);
  if (!variations) return null;
  
  const variation = variations.find(v => v.id === variationId);
  if (!variation) return null;
  
  return Object.entries(variation.usageStats).map(([idx, stats]) => ({
    variationIndex: parseInt(idx),
    sent: stats.sent,
    opened: stats.opened,
    replied: stats.replied,
    openRate: stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0,
    replyRate: stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0
  }));
}

/**
 * Update message variation settings
 */
export function updateMessageVariationSettings(
  accountId: string,
  updates: Partial<MessageVariationSettings>
): SafetySettings | null {
  const settings = safetySettingsStore.get(accountId);
  if (!settings) return null;
  
  settings.messageVariations = {
    ...settings.messageVariations,
    ...updates
  };
  settings.lastUpdated = new Date();
  
  safetySettingsStore.set(accountId, settings);
  return settings;
}

/**
 * Get all message variations for an account
 */
export function getMessageVariations(accountId: string): MessageVariation[] {
  return messageVariationsStore.get(accountId) || [];
}

/**
 * Delete a message variation
 */
export function deleteMessageVariation(accountId: string, variationId: string): boolean {
  const variations = messageVariationsStore.get(accountId);
  if (!variations) return false;
  
  const filtered = variations.filter(v => v.id !== variationId);
  if (filtered.length === variations.length) return false;
  
  messageVariationsStore.set(accountId, filtered);
  return true;
}

/**
 * Generate simple message variations (without AI)
 * Creates slight variations using template patterns
 */
export function generateSimpleVariations(originalMessage: string, count: number = 3): string[] {
  const variations: string[] = [];
  
  // Opening line variations
  const openings = [
    'Hi {{name}},',
    'Hello {{name}},',
    'Hey {{name}},',
    'Hi there {{name}},',
    'Dear {{name}},'
  ];
  
  // Closing variations
  const closings = [
    'Best regards',
    'Best',
    'Thanks',
    'Looking forward to connecting',
    'Cheers'
  ];
  
  // CTA variations
  const ctas = [
    'Would you be open to a quick chat?',
    'Would love to connect and discuss further.',
    'Let me know if you\'d be interested in a brief call.',
    'Happy to share more details if you\'re interested.',
    'Feel free to reach out if you\'d like to learn more.'
  ];
  
  for (let i = 0; i < count; i++) {
    let variation = originalMessage;
    
    // Replace opening if contains common patterns
    const hasOpening = /^(Hi|Hello|Hey|Dear)\s+/i.test(variation);
    if (hasOpening) {
      const newOpening = openings[Math.floor(Math.random() * openings.length)];
      variation = variation.replace(/^(Hi|Hello|Hey|Dear)\s+[^,\n]+,?\s*/i, newOpening + ' ');
    }
    
    // Add slight word variations
    const wordVariations: { [key: string]: string[] } = {
      'great': ['excellent', 'fantastic', 'wonderful'],
      'interesting': ['intriguing', 'compelling', 'fascinating'],
      'would love to': ['would be happy to', 'would be glad to', 'would enjoy'],
      'I think': ['I believe', 'In my view', 'I\'d say'],
      'opportunity': ['chance', 'possibility', 'prospect']
    };
    
    Object.entries(wordVariations).forEach(([word, alternatives]) => {
      if (variation.toLowerCase().includes(word.toLowerCase()) && Math.random() > 0.5) {
        const alt = alternatives[Math.floor(Math.random() * alternatives.length)];
        variation = variation.replace(new RegExp(word, 'gi'), alt);
      }
    });
    
    variations.push(variation);
  }
  
  return variations;
}
