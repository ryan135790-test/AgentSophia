import type { UserLinkedInSettings } from '../../shared/schema';

// ============================================
// LINKEDIN SAFETY ENGINE
// Comprehensive safety controls for LinkedIn automation
// ============================================

// 7-DAY WARMUP SCHEDULE
// Gradual increase to build account trust
const WARMUP_SCHEDULE = {
  day1_ultra_light: {
    day: 1,
    connections: 5,
    messages: 10,
    hourlyConnections: 1,
    hourlyMessages: 2,
    description: 'Ultra-light: Building initial trust',
  },
  day2_light: {
    day: 2,
    connections: 10,
    messages: 15,
    hourlyConnections: 2,
    hourlyMessages: 3,
    description: 'Light: Gradual increase',
  },
  day3_moderate: {
    day: 3,
    connections: 15,
    messages: 25,
    hourlyConnections: 3,
    hourlyMessages: 4,
    description: 'Moderate: Establishing patterns',
  },
  day4_building: {
    day: 4,
    connections: 20,
    messages: 20,
    hourlyConnections: 4,
    hourlyMessages: 3,
    description: 'Building: Increasing activity',
  },
  day5_normal: {
    day: 5,
    connections: 30,
    messages: 25,
    hourlyConnections: 5,
    hourlyMessages: 4,
    description: 'Normal: Standard activity levels',
  },
  day6_expanded: {
    day: 6,
    connections: 40,
    messages: 30,
    hourlyConnections: 6,
    hourlyMessages: 5,
    description: 'Expanded: Near-full capacity',
  },
  day7_full: {
    day: 7,
    connections: 50,
    messages: 35,
    hourlyConnections: 7,
    hourlyMessages: 5,
    description: 'Full: Complete warmup, normal limits',
  },
  completed: {
    day: 8,
    connections: 50,
    messages: 40,
    hourlyConnections: 8,
    hourlyMessages: 6,
    description: 'Warmup complete: Full operation',
  },
};

// ACCOUNT AGE MULTIPLIERS
// Newer accounts need more conservative limits
const ACCOUNT_AGE_MULTIPLIERS = {
  new: 0.5,        // < 30 days: 50% of base limits
  young: 0.7,      // 30-90 days: 70% of base limits
  established: 0.9, // 90-365 days: 90% of base limits
  mature: 1.0,     // > 365 days: Full limits
};

// POST-WARMUP LIMIT PROFILES
// Users can choose their risk tolerance after completing warmup
export const POST_WARMUP_PROFILES = {
  safe: {
    connections: 30,
    messages: 25,
    hourlyConnections: 4,
    hourlyMessages: 4,
    riskLevel: 'low',
    description: '🛡️ Safe: Conservative limits, minimal risk of LinkedIn flags',
    warning: null,
  },
  moderate: {
    connections: 50,
    messages: 40,
    hourlyConnections: 8,
    hourlyMessages: 6,
    riskLevel: 'low',
    description: '⚖️ Moderate: Balanced output and safety (recommended)',
    warning: null,
  },
  aggressive: {
    connections: 80,
    messages: 80,
    hourlyConnections: 12,
    hourlyMessages: 12,
    riskLevel: 'medium',
    description: '🚀 Aggressive: Higher output, elevated risk of restrictions',
    warning: '⚠️ AGGRESSIVE MODE: Using high-volume limits (80 connections, 80 messages/day). This increases the risk of LinkedIn rate limits, warnings, or account restrictions. Monitor your acceptance rate closely.',
  },
};

// WEEKEND/OFF-HOURS MULTIPLIERS
const TIME_MULTIPLIERS = {
  weekend: 0.3,        // 30% activity on weekends
  outsideHours: 0.2,   // 20% activity outside business hours
  peakHours: 1.0,      // Full activity during peak hours (10-12, 14-16)
  normalHours: 0.8,    // 80% during normal business hours
};

// ACCEPTANCE RATE THRESHOLDS
const ACCEPTANCE_THRESHOLDS = {
  critical: 10,   // Immediate pause if below 10%
  warning: 20,    // Warning and reduced activity below 20%
  caution: 30,    // Slight reduction below 30%
  healthy: 40,    // Good health above 40%
};

// SAFETY SCORE FACTORS
const SAFETY_SCORE_WEIGHTS = {
  acceptanceRate: 30,
  consecutiveSuccess: 20,
  warmupCompliance: 15,
  hourlyCompliance: 15,
  noWarnings: 20,
};

export interface SafetyCheckResult {
  canProceed: boolean;
  reason?: string;
  adjustedLimits?: {
    dailyConnections: number;
    dailyMessages: number;
    hourlyConnections: number;
    hourlyMessages: number;
  };
  recommendations?: string[];
  safetyScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActionResult {
  success: boolean;
  actionType: 'connection' | 'message';
  updatedSettings: Partial<UserLinkedInSettings>;
  safetyScore: number;
}

// Get the current warmup phase based on start date
export function getWarmupPhase(settings: UserLinkedInSettings): keyof typeof WARMUP_SCHEDULE {
  if (!settings.is_warming_up || !settings.warmup_started_at) {
    return 'completed';
  }

  const startDate = new Date(settings.warmup_started_at);
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (daysSinceStart >= 8) {
    return 'completed';
  }

  const phases: (keyof typeof WARMUP_SCHEDULE)[] = [
    'day1_ultra_light',
    'day2_light',
    'day3_moderate',
    'day4_building',
    'day5_normal',
    'day6_expanded',
    'day7_full',
    'completed',
  ];

  return phases[Math.min(daysSinceStart - 1, 7)] || 'completed';
}

// Get account age category
export function getAccountAgeCategory(accountAgeDays: number): 'new' | 'young' | 'established' | 'mature' {
  if (accountAgeDays < 30) return 'new';
  if (accountAgeDays < 90) return 'young';
  if (accountAgeDays < 365) return 'established';
  return 'mature';
}

// Check if current time is within business hours
export function isWithinBusinessHours(settings: UserLinkedInSettings): { isWithin: boolean; multiplier: number } {
  const now = new Date();
  
  // Convert to user's timezone
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: settings.timezone || 'America/New_York' }));
  const hour = userTime.getHours();
  const dayOfWeek = userTime.getDay(); // 0 = Sunday, 6 = Saturday

  // Weekend check
  if (settings.reduce_weekend_activity && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return { isWithin: false, multiplier: TIME_MULTIPLIERS.weekend };
  }

  // Business hours check
  if (!settings.respect_business_hours) {
    return { isWithin: true, multiplier: 1.0 };
  }

  const startHour = settings.business_hours_start ?? 9;
  const endHour = settings.business_hours_end ?? 18;

  if (hour < startHour || hour >= endHour) {
    return { isWithin: false, multiplier: TIME_MULTIPLIERS.outsideHours };
  }

  // Peak hours (10-12, 14-16)
  if ((hour >= 10 && hour < 12) || (hour >= 14 && hour < 16)) {
    return { isWithin: true, multiplier: TIME_MULTIPLIERS.peakHours };
  }

  return { isWithin: true, multiplier: TIME_MULTIPLIERS.normalHours };
}

// Check if we need to reset hourly counters
export function shouldResetHourlyCounters(settings: UserLinkedInSettings): boolean {
  if (!settings.current_hour_start) return true;

  const hourStart = new Date(settings.current_hour_start);
  const now = new Date();
  const hoursDiff = (now.getTime() - hourStart.getTime()) / (1000 * 60 * 60);

  return hoursDiff >= 1;
}

// Check if we need to reset daily counters
export function shouldResetDailyCounters(settings: UserLinkedInSettings): boolean {
  if (!settings.last_activity_date) return true;

  const lastActivity = new Date(settings.last_activity_date);
  const now = new Date();

  // Reset if different day
  return lastActivity.toDateString() !== now.toDateString();
}

// Calculate adjusted limits based on all safety factors
export function calculateAdjustedLimits(settings: UserLinkedInSettings): {
  dailyConnections: number;
  dailyMessages: number;
  hourlyConnections: number;
  hourlyMessages: number;
  warmupOverrideWarning?: string;
} {
  // Check for warmup override - user can bypass warmup with warning
  if (settings.warmup_override_enabled && settings.is_warming_up) {
    console.warn(`[LinkedIn Safety] ⚠️ WARMUP OVERRIDE ACTIVE for user - using manual limits instead of warmup schedule. Reason: ${settings.warmup_override_reason || 'Not specified'}`);
    
    // Use user-configured limits directly (bypassing warmup)
    return {
      dailyConnections: settings.daily_connection_limit ?? 50,
      dailyMessages: settings.daily_message_limit ?? 40,
      hourlyConnections: settings.hourly_connection_limit ?? 8,
      hourlyMessages: settings.hourly_message_limit ?? 6,
      warmupOverrideWarning: `⚠️ Warmup override is active. Using manual limits (${settings.daily_connection_limit} connections, ${settings.daily_message_limit} messages/day) instead of warmup schedule. This may increase account risk.`,
    };
  }

  // Check if warmup is completed - use post-warmup profile
  const warmupPhase = getWarmupPhase(settings);
  let warmupOverrideWarning: string | undefined;
  
  let dailyConnections: number;
  let dailyMessages: number;
  let hourlyConnections: number;
  let hourlyMessages: number;
  
  if (warmupPhase === 'completed' || !settings.is_warming_up) {
    // Warmup complete - use selected post-warmup profile
    const profile = settings.post_warmup_profile || 'moderate';
    const profileLimits = POST_WARMUP_PROFILES[profile];
    
    dailyConnections = profileLimits.connections;
    dailyMessages = profileLimits.messages;
    hourlyConnections = profileLimits.hourlyConnections;
    hourlyMessages = profileLimits.hourlyMessages;
    
    // Log warning for aggressive mode
    if (profile === 'aggressive' && profileLimits.warning) {
      console.warn(`[LinkedIn Safety] ${profileLimits.warning}`);
      warmupOverrideWarning = profileLimits.warning;
    }
    
    console.log(`[LinkedIn Safety] Post-warmup profile: ${profile} (${dailyConnections} connections, ${dailyMessages} messages/day)`);
  } else {
    // Still warming up - use warmup schedule
    const warmupLimits = WARMUP_SCHEDULE[warmupPhase];
    dailyConnections = warmupLimits.connections;
    dailyMessages = warmupLimits.messages;
    hourlyConnections = warmupLimits.hourlyConnections;
    hourlyMessages = warmupLimits.hourlyMessages;
  }

  // Apply account age multiplier
  const ageCategory = getAccountAgeCategory(settings.linkedin_account_age_days || 0);
  const ageMultiplier = ACCOUNT_AGE_MULTIPLIERS[ageCategory];

  dailyConnections = Math.floor(dailyConnections * ageMultiplier);
  dailyMessages = Math.floor(dailyMessages * ageMultiplier);
  hourlyConnections = Math.max(1, Math.floor(hourlyConnections * ageMultiplier));
  hourlyMessages = Math.max(1, Math.floor(hourlyMessages * ageMultiplier));

  // Apply time-based multiplier
  const timeCheck = isWithinBusinessHours(settings);
  dailyConnections = Math.floor(dailyConnections * timeCheck.multiplier);
  dailyMessages = Math.floor(dailyMessages * timeCheck.multiplier);
  hourlyConnections = Math.max(1, Math.floor(hourlyConnections * timeCheck.multiplier));
  hourlyMessages = Math.max(1, Math.floor(hourlyMessages * timeCheck.multiplier));

  // Apply acceptance rate penalty if needed
  const acceptanceRate = settings.acceptance_rate ?? 50;
  if (acceptanceRate < ACCEPTANCE_THRESHOLDS.caution && (settings.total_connections_sent ?? 0) >= 20) {
    const acceptancePenalty = acceptanceRate < ACCEPTANCE_THRESHOLDS.warning ? 0.5 : 0.7;
    dailyConnections = Math.floor(dailyConnections * acceptancePenalty);
    hourlyConnections = Math.max(1, Math.floor(hourlyConnections * acceptancePenalty));
  }

  // Ensure minimum values
  return {
    dailyConnections: Math.max(1, dailyConnections),
    dailyMessages: Math.max(2, dailyMessages),
    hourlyConnections: Math.max(1, hourlyConnections),
    hourlyMessages: Math.max(1, hourlyMessages),
    warmupOverrideWarning,
  };
}

// Calculate safety score (0-100)
export function calculateSafetyScore(settings: UserLinkedInSettings): number {
  let score = 0;

  // Acceptance rate component (30 points)
  const acceptanceRate = settings.acceptance_rate ?? 50;
  if (acceptanceRate >= ACCEPTANCE_THRESHOLDS.healthy) {
    score += SAFETY_SCORE_WEIGHTS.acceptanceRate;
  } else if (acceptanceRate >= ACCEPTANCE_THRESHOLDS.caution) {
    score += SAFETY_SCORE_WEIGHTS.acceptanceRate * 0.7;
  } else if (acceptanceRate >= ACCEPTANCE_THRESHOLDS.warning) {
    score += SAFETY_SCORE_WEIGHTS.acceptanceRate * 0.4;
  } else {
    score += SAFETY_SCORE_WEIGHTS.acceptanceRate * 0.1;
  }

  // Consecutive success component (20 points)
  const successCount = settings.consecutive_success_count ?? 0;
  const failureCount = settings.consecutive_failure_count ?? 0;
  if (successCount >= 10 && failureCount === 0) {
    score += SAFETY_SCORE_WEIGHTS.consecutiveSuccess;
  } else if (successCount >= 5) {
    score += SAFETY_SCORE_WEIGHTS.consecutiveSuccess * 0.7;
  } else if (failureCount <= 1) {
    score += SAFETY_SCORE_WEIGHTS.consecutiveSuccess * 0.5;
  }

  // Warmup compliance (15 points)
  if (!settings.is_warming_up) {
    score += SAFETY_SCORE_WEIGHTS.warmupCompliance;
  } else {
    const warmupPhase = getWarmupPhase(settings);
    const expectedDay = WARMUP_SCHEDULE[warmupPhase].day;
    if (settings.warmup_day === expectedDay) {
      score += SAFETY_SCORE_WEIGHTS.warmupCompliance;
    } else {
      score += SAFETY_SCORE_WEIGHTS.warmupCompliance * 0.5;
    }
  }

  // Hourly compliance (15 points)
  const hourlyConnectionsUsed = settings.connections_sent_this_hour ?? 0;
  const hourlyLimit = settings.hourly_connection_limit ?? 5;
  if (hourlyConnectionsUsed <= hourlyLimit) {
    score += SAFETY_SCORE_WEIGHTS.hourlyCompliance;
  } else {
    score += SAFETY_SCORE_WEIGHTS.hourlyCompliance * 0.3;
  }

  // No warnings (20 points)
  if (!settings.last_linkedin_warning && !settings.paused_for_low_acceptance) {
    score += SAFETY_SCORE_WEIGHTS.noWarnings;
  } else if (settings.low_acceptance_warnings === 1) {
    score += SAFETY_SCORE_WEIGHTS.noWarnings * 0.5;
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

// Determine risk level based on safety score and other factors
export function determineRiskLevel(settings: UserLinkedInSettings, safetyScore: number): 'low' | 'medium' | 'high' | 'critical' {
  // Critical conditions
  if (settings.paused_for_low_acceptance) return 'critical';
  if ((settings.acceptance_rate ?? 50) < ACCEPTANCE_THRESHOLDS.critical) return 'critical';
  if ((settings.consecutive_failure_count ?? 0) >= 5) return 'critical';
  if (settings.last_linkedin_warning) return 'high';

  // Score-based
  if (safetyScore >= 80) return 'low';
  if (safetyScore >= 60) return 'medium';
  if (safetyScore >= 40) return 'high';
  return 'critical';
}

// Generate random delay between actions
export function getRandomActionDelay(settings: UserLinkedInSettings): number {
  // DEV MODE: Skip delays for testing
  const isDevMode = process.env.LINKEDIN_DEV_MODE === 'true';
  if (isDevMode) {
    console.log('[LinkedIn Safety] DEV MODE - Using minimal 5-second delay');
    return 5000; // 5 seconds for testing
  }
  
  // SAFETY: Minimum 60 seconds, max 180 seconds between connection requests
  // This prevents LinkedIn from detecting automated patterns
  const minDelay = Math.max((settings.min_delay_between_actions_seconds ?? 60), 60) * 1000;
  const maxDelay = Math.max((settings.max_delay_between_actions_seconds ?? 180), 120) * 1000;

  // Add random break chance
  const breakProbability = settings.random_break_probability ?? 15;
  if (Math.random() * 100 < breakProbability) {
    const breakDuration = (settings.random_break_duration_minutes ?? 15) * 60 * 1000;
    return breakDuration + Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
  }

  return Math.floor(Math.random() * (maxDelay - minDelay) + minDelay);
}

// MAIN SAFETY CHECK - Call before any action
export function performSafetyCheck(settings: UserLinkedInSettings, actionType: 'connection' | 'message'): SafetyCheckResult {
  const recommendations: string[] = [];
  let canProceed = true;
  let reason: string | undefined;

  // Check if paused
  if (settings.is_paused) {
    const pauseUntil = settings.pause_until ? new Date(settings.pause_until) : null;
    if (!pauseUntil || pauseUntil > new Date()) {
      return {
        canProceed: false,
        reason: `Account paused: ${settings.pause_reason || 'Safety pause active'}`,
        safetyScore: calculateSafetyScore(settings),
        riskLevel: 'critical',
      };
    }
  }

  // Check acceptance rate auto-pause
  if (settings.paused_for_low_acceptance && settings.auto_pause_on_low_acceptance) {
    const pauseUntil = settings.acceptance_pause_until ? new Date(settings.acceptance_pause_until) : null;
    if (!pauseUntil || pauseUntil > new Date()) {
      return {
        canProceed: false,
        reason: `Paused due to low acceptance rate (${settings.acceptance_rate}%). Will resume after cooldown.`,
        safetyScore: calculateSafetyScore(settings),
        riskLevel: 'critical',
      };
    }
  }

  // Calculate adjusted limits
  const adjustedLimits = calculateAdjustedLimits(settings);

  // Check daily limits
  if (actionType === 'connection') {
    if ((settings.connections_sent_today ?? 0) >= adjustedLimits.dailyConnections) {
      return {
        canProceed: false,
        reason: `Daily connection limit reached (${settings.connections_sent_today}/${adjustedLimits.dailyConnections})`,
        adjustedLimits,
        safetyScore: calculateSafetyScore(settings),
        riskLevel: 'medium',
      };
    }
  } else {
    if ((settings.messages_sent_today ?? 0) >= adjustedLimits.dailyMessages) {
      return {
        canProceed: false,
        reason: `Daily message limit reached (${settings.messages_sent_today}/${adjustedLimits.dailyMessages})`,
        adjustedLimits,
        safetyScore: calculateSafetyScore(settings),
        riskLevel: 'medium',
      };
    }
  }

  // Check hourly limits
  if (actionType === 'connection') {
    if ((settings.connections_sent_this_hour ?? 0) >= adjustedLimits.hourlyConnections) {
      return {
        canProceed: false,
        reason: `Hourly connection limit reached. Wait for next hour.`,
        adjustedLimits,
        recommendations: ['Hourly limits help spread activity naturally throughout the day'],
        safetyScore: calculateSafetyScore(settings),
        riskLevel: 'low',
      };
    }
  } else {
    if ((settings.messages_sent_this_hour ?? 0) >= adjustedLimits.hourlyMessages) {
      return {
        canProceed: false,
        reason: `Hourly message limit reached. Wait for next hour.`,
        adjustedLimits,
        recommendations: ['Hourly limits help spread activity naturally throughout the day'],
        safetyScore: calculateSafetyScore(settings),
        riskLevel: 'low',
      };
    }
  }

  // Check business hours
  const timeCheck = isWithinBusinessHours(settings);
  if (!timeCheck.isWithin && timeCheck.multiplier < 0.3) {
    recommendations.push('Activity outside business hours - reduced limits applied');
  }

  // Check acceptance rate warnings
  const acceptanceRate = settings.acceptance_rate ?? 50;
  if (acceptanceRate < ACCEPTANCE_THRESHOLDS.warning && (settings.total_connections_sent ?? 0) >= 20) {
    recommendations.push(`Low acceptance rate (${acceptanceRate}%) - consider improving your connection messages`);
  }

  // Check warmup status
  if (settings.is_warming_up) {
    const warmupPhase = getWarmupPhase(settings);
    recommendations.push(`Warmup Day ${WARMUP_SCHEDULE[warmupPhase].day}: ${WARMUP_SCHEDULE[warmupPhase].description}`);
  }

  const safetyScore = calculateSafetyScore(settings);
  const riskLevel = determineRiskLevel(settings, safetyScore);

  return {
    canProceed,
    reason,
    adjustedLimits,
    recommendations: recommendations.length > 0 ? recommendations : undefined,
    safetyScore,
    riskLevel,
  };
}

// Record action result and update settings
export function recordActionResult(
  settings: UserLinkedInSettings,
  actionType: 'connection' | 'message',
  success: boolean,
  wasAccepted?: boolean
): Partial<UserLinkedInSettings> {
  const updates: Partial<UserLinkedInSettings> = {};
  const now = new Date().toISOString();

  // Reset daily counters if new day
  if (shouldResetDailyCounters(settings)) {
    updates.connections_sent_today = 0;
    updates.messages_sent_today = 0;
    updates.last_activity_date = now;
  }

  // Reset hourly counters if new hour
  if (shouldResetHourlyCounters(settings)) {
    updates.connections_sent_this_hour = 0;
    updates.messages_sent_this_hour = 0;
    updates.current_hour_start = now;
  }

  // Increment counters
  if (actionType === 'connection') {
    updates.connections_sent_today = (settings.connections_sent_today ?? 0) + 1;
    updates.connections_sent_this_hour = (settings.connections_sent_this_hour ?? 0) + 1;

    if (success) {
      updates.total_connections_sent = (settings.total_connections_sent ?? 0) + 1;

      // Track acceptance if provided
      if (wasAccepted !== undefined) {
        if (wasAccepted) {
          updates.total_connections_accepted = (settings.total_connections_accepted ?? 0) + 1;
        }
        // Recalculate acceptance rate
        const totalSent = (updates.total_connections_sent ?? settings.total_connections_sent ?? 0);
        const totalAccepted = (updates.total_connections_accepted ?? settings.total_connections_accepted ?? 0);
        if (totalSent > 0) {
          updates.acceptance_rate = Math.round((totalAccepted / totalSent) * 100);
        }
      }
    }
  } else {
    updates.messages_sent_today = (settings.messages_sent_today ?? 0) + 1;
    updates.messages_sent_this_hour = (settings.messages_sent_this_hour ?? 0) + 1;
  }

  // Update success/failure streaks
  if (success) {
    updates.consecutive_success_count = (settings.consecutive_success_count ?? 0) + 1;
    updates.consecutive_failure_count = 0;
    updates.error_count = 0;
  } else {
    updates.consecutive_failure_count = (settings.consecutive_failure_count ?? 0) + 1;
    updates.consecutive_success_count = 0;
    updates.error_count = (settings.error_count ?? 0) + 1;
  }

  // Update total actions
  updates.total_actions_lifetime = (settings.total_actions_lifetime ?? 0) + 1;

  // Update warmup progress
  if (settings.is_warming_up) {
    const currentPhase = getWarmupPhase(settings);
    updates.warmup_phase = currentPhase;
    updates.warmup_day = WARMUP_SCHEDULE[currentPhase].day;

    if (currentPhase === 'completed') {
      updates.is_warming_up = false;
      updates.warmup_completed_at = now;
    }
  }

  // Check if we need to pause for low acceptance
  const acceptanceRate = updates.acceptance_rate ?? settings.acceptance_rate ?? 50;
  const totalSent = updates.total_connections_sent ?? settings.total_connections_sent ?? 0;

  if (
    settings.auto_pause_on_low_acceptance &&
    acceptanceRate < (settings.auto_pause_acceptance_threshold ?? 20) &&
    totalSent >= 20
  ) {
    updates.paused_for_low_acceptance = true;
    updates.is_paused = true;
    updates.pause_reason = `Low acceptance rate (${acceptanceRate}%) - automatic safety pause`;
    // Pause for 24 hours
    const pauseUntil = new Date();
    pauseUntil.setHours(pauseUntil.getHours() + 24);
    updates.acceptance_pause_until = pauseUntil.toISOString();
    updates.pause_until = pauseUntil.toISOString();
    updates.low_acceptance_warnings = (settings.low_acceptance_warnings ?? 0) + 1;
  }

  // Recalculate safety score and risk level
  const mergedSettings = { ...settings, ...updates };
  updates.safety_score = calculateSafetyScore(mergedSettings as UserLinkedInSettings);
  updates.risk_level = determineRiskLevel(mergedSettings as UserLinkedInSettings, updates.safety_score);

  // Update account age category
  updates.account_age_category = getAccountAgeCategory(settings.linkedin_account_age_days ?? 0);

  return updates;
}

// Get warmup status summary
export function getWarmupSummary(settings: UserLinkedInSettings): {
  phase: string;
  day: number;
  description: string;
  progress: number;
  limits: { connections: number; messages: number };
  isComplete: boolean;
} {
  const phase = getWarmupPhase(settings);
  const phaseInfo = WARMUP_SCHEDULE[phase];

  return {
    phase,
    day: phaseInfo.day,
    description: phaseInfo.description,
    progress: Math.min(100, Math.round((phaseInfo.day / 7) * 100)),
    limits: {
      connections: phaseInfo.connections,
      messages: phaseInfo.messages,
    },
    isComplete: phase === 'completed',
  };
}

// Get comprehensive safety status
export function getSafetyStatus(settings: UserLinkedInSettings): {
  safetyScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warmup: ReturnType<typeof getWarmupSummary>;
  limits: ReturnType<typeof calculateAdjustedLimits>;
  usage: {
    dailyConnections: { used: number; limit: number };
    dailyMessages: { used: number; limit: number };
    hourlyConnections: { used: number; limit: number };
    hourlyMessages: { used: number; limit: number };
  };
  acceptanceRate: number;
  isPaused: boolean;
  pauseReason?: string;
  recommendations: string[];
} {
  const safetyScore = calculateSafetyScore(settings);
  const riskLevel = determineRiskLevel(settings, safetyScore);
  const warmup = getWarmupSummary(settings);
  const limits = calculateAdjustedLimits(settings);

  const recommendations: string[] = [];

  // Generate recommendations
  if ((settings.acceptance_rate ?? 50) < 30) {
    recommendations.push('Improve your connection request messages to boost acceptance rate');
  }
  if (settings.is_warming_up) {
    recommendations.push(`Continue warmup process - Day ${warmup.day} of 7`);
  }
  if ((settings.consecutive_failure_count ?? 0) >= 3) {
    recommendations.push('Multiple consecutive failures detected - review your targeting');
  }
  if (riskLevel === 'high' || riskLevel === 'critical') {
    recommendations.push('Consider reducing activity until safety score improves');
  }

  return {
    safetyScore,
    riskLevel,
    warmup,
    limits,
    usage: {
      dailyConnections: {
        used: settings.connections_sent_today ?? 0,
        limit: limits.dailyConnections,
      },
      dailyMessages: {
        used: settings.messages_sent_today ?? 0,
        limit: limits.dailyMessages,
      },
      hourlyConnections: {
        used: settings.connections_sent_this_hour ?? 0,
        limit: limits.hourlyConnections,
      },
      hourlyMessages: {
        used: settings.messages_sent_this_hour ?? 0,
        limit: limits.hourlyMessages,
      },
    },
    acceptanceRate: settings.acceptance_rate ?? 0,
    isPaused: settings.is_paused ?? false,
    pauseReason: settings.pause_reason ?? undefined,
    recommendations,
  };
}

// Initialize safety settings for new LinkedIn connection
export function initializeSafetySettings(accountAgeDays: number = 0): Partial<UserLinkedInSettings> {
  const now = new Date().toISOString();
  const ageCategory = getAccountAgeCategory(accountAgeDays);

  return {
    linkedin_account_age_days: accountAgeDays,
    account_age_category: ageCategory,

    // Start warmup
    is_warming_up: true,
    warmup_day: 1,
    warmup_started_at: now,
    warmup_phase: 'day1_ultra_light',

    // Initial limits (will be adjusted by warmup)
    daily_connection_limit: 50,
    daily_message_limit: 40,
    hourly_connection_limit: 8,
    hourly_message_limit: 6,

    // Reset counters
    connections_sent_today: 0,
    messages_sent_today: 0,
    connections_sent_this_hour: 0,
    messages_sent_this_hour: 0,
    current_hour_start: now,
    last_activity_date: now,

    // Acceptance tracking
    total_connections_sent: 0,
    total_connections_accepted: 0,
    acceptance_rate: 0,
    acceptance_rate_7day: 0,
    low_acceptance_warnings: 0,
    paused_for_low_acceptance: false,

    // Smart scheduling defaults
    respect_business_hours: true,
    business_hours_start: 9,
    business_hours_end: 18,
    timezone: 'America/New_York',
    reduce_weekend_activity: true,
    weekend_activity_percent: 30,

    // Randomization
    min_delay_between_actions_seconds: 45,
    max_delay_between_actions_seconds: 180,
    random_daily_start_offset_minutes: 30,
    random_break_probability: 15,
    random_break_duration_minutes: 15,

    // Safety score
    safety_score: 100,
    risk_level: 'low',
    consecutive_success_count: 0,
    consecutive_failure_count: 0,

    // Auto-pause settings
    auto_pause_enabled: true,
    auto_pause_on_captcha: true,
    auto_pause_on_rate_limit: true,
    auto_pause_on_low_acceptance: true,
    auto_pause_acceptance_threshold: 20,

    // Status
    is_active: true,
    is_paused: false,
    error_count: 0,
    total_sessions: 0,
    total_actions_lifetime: 0,
  };
}

export const LinkedInSafety = {
  performSafetyCheck,
  recordActionResult,
  getWarmupSummary,
  getSafetyStatus,
  getRandomActionDelay,
  initializeSafetySettings,
  calculateAdjustedLimits,
  calculateSafetyScore,
  getWarmupPhase,
  getAccountAgeCategory,
  isWithinBusinessHours,
  shouldResetHourlyCounters,
  shouldResetDailyCounters,
  WARMUP_SCHEDULE,
  ACCOUNT_AGE_MULTIPLIERS,
  ACCEPTANCE_THRESHOLDS,
};

export default LinkedInSafety;
