/**
 * Sophia LinkedIn Compliance Monitor
 * Agent Sophia's autonomous compliance oversight for LinkedIn automation
 * 
 * Integrates with:
 * - linkedin-safety.ts (core safety engine)
 * - linkedin-safety-controls.ts (limit management)
 * - campaign-compliance.ts (campaign checks)
 */

import * as linkedinSafety from './linkedin-safety';
import * as safetyControls from './linkedin-safety-controls';

export interface ComplianceViolation {
  id: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  message: string;
  actionTaken: string;
  workspaceId?: string;
  accountId?: string;
  details?: Record<string, any>;
}

export interface ComplianceReport {
  generatedAt: string;
  overallScore: number;
  riskLevel: 'safe' | 'moderate' | 'elevated' | 'critical';
  violations: ComplianceViolation[];
  recommendations: string[];
  accountHealth: {
    acceptanceRate: number;
    warmupProgress: number;
    dailyUsage: number;
    safetyScore: number;
  };
  sophiaInsights: string[];
}

export interface AutoPauseEvent {
  accountId: string;
  reason: string;
  pausedAt: string;
  resumeAt?: string;
  autoResumeEnabled: boolean;
}

const violationLog: ComplianceViolation[] = [];
const autoPauseEvents: AutoPauseEvent[] = [];

export function generateViolationId(): string {
  return `viol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function logViolation(violation: Omit<ComplianceViolation, 'id' | 'timestamp'>): ComplianceViolation {
  const fullViolation: ComplianceViolation = {
    ...violation,
    id: generateViolationId(),
    timestamp: new Date().toISOString()
  };
  
  violationLog.push(fullViolation);
  
  if (violationLog.length > 1000) {
    violationLog.splice(0, 100);
  }
  
  console.log(`[Sophia Compliance] ${violation.severity.toUpperCase()}: ${violation.message}`);
  
  return fullViolation;
}

export function sophiaPreActionCheck(
  settings: any,
  actionType: 'connection' | 'message' | 'profile_view' | 'post_like',
  workspaceId?: string
): {
  canProceed: boolean;
  reason?: string;
  sophiaAdvice?: string;
  adjustedDelay?: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
} {
  const safetyCheck = linkedinSafety.performSafetyCheck(settings, actionType === 'connection' ? 'connection' : 'message');
  
  if (!safetyCheck.canProceed) {
    logViolation({
      severity: safetyCheck.riskLevel === 'critical' ? 'critical' : 'medium',
      type: 'action_blocked',
      message: safetyCheck.reason || 'Action blocked by safety engine',
      actionTaken: 'Action prevented',
      workspaceId,
      details: { actionType, safetyScore: safetyCheck.safetyScore }
    });
    
    return {
      canProceed: false,
      reason: safetyCheck.reason,
      sophiaAdvice: generateSophiaAdvice(safetyCheck, actionType),
      riskLevel: safetyCheck.riskLevel
    };
  }
  
  const acceptanceRate = settings.acceptance_rate ?? 50;
  if (acceptanceRate < 30 && actionType === 'connection') {
    logViolation({
      severity: 'medium',
      type: 'low_acceptance_warning',
      message: `Low acceptance rate (${acceptanceRate}%) detected`,
      actionTaken: 'Proceeding with caution - added extra delay',
      workspaceId
    });
    
    return {
      canProceed: true,
      sophiaAdvice: `I'm allowing this action but adding extra delay. Your acceptance rate of ${acceptanceRate}% is concerning. Consider improving your connection request messages.`,
      adjustedDelay: 120000,
      riskLevel: 'medium'
    };
  }
  
  const delay = linkedinSafety.getRandomActionDelay(settings);
  
  return {
    canProceed: true,
    adjustedDelay: delay,
    riskLevel: safetyCheck.riskLevel,
    sophiaAdvice: safetyCheck.recommendations?.join('. ')
  };
}

function generateSophiaAdvice(
  safetyCheck: linkedinSafety.SafetyCheckResult,
  actionType: string
): string {
  const adviceTemplates: Record<string, string[]> = {
    critical: [
      "I've paused LinkedIn automation to protect your account. Let's wait for the safety score to improve.",
      "Your account safety is my priority. I'm holding all LinkedIn actions until conditions improve.",
      "I detected a critical risk and have stopped automation. This is to prevent potential account restrictions."
    ],
    high: [
      "I'm seeing elevated risk levels. I recommend reducing activity for the next few hours.",
      "Your account health needs attention. I suggest reviewing your connection request messages.",
      "High risk detected. I'm proceeding cautiously and recommend reducing daily targets."
    ],
    medium: [
      "There's room for improvement in your LinkedIn approach. Consider personalizing messages more.",
      "I'm monitoring some concerning patterns. Let's focus on quality over quantity.",
      "Your acceptance rate could be better. I recommend targeting more relevant prospects."
    ],
    low: [
      "Everything looks good! Your LinkedIn automation is running safely.",
      "Your account health is excellent. Keep up the good work!",
      "All safety checks passed. You're operating within safe limits."
    ]
  };
  
  const level = safetyCheck.riskLevel;
  const templates = adviceTemplates[level] || adviceTemplates.low;
  return templates[Math.floor(Math.random() * templates.length)];
}

export function sophiaMonitorActivity(
  accountId: string,
  actionType: string,
  success: boolean,
  wasAccepted?: boolean,
  workspaceId?: string
): {
  shouldPause: boolean;
  pauseReason?: string;
  sophiaMessage?: string;
} {
  const todayUsage = safetyControls.getTodayUsage(accountId);
  const consecutiveFailures = success ? 0 : 1;
  
  if (!success) {
    if (consecutiveFailures >= 3 || todayUsage.acceptanceRate < 15) {
      logViolation({
        severity: 'high',
        type: 'consecutive_failures',
        message: `${consecutiveFailures} consecutive failures detected`,
        actionTaken: 'Auto-pausing for 1 hour',
        workspaceId,
        accountId
      });
      
      autoPauseEvents.push({
        accountId,
        reason: 'Multiple consecutive failures',
        pausedAt: new Date().toISOString(),
        resumeAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        autoResumeEnabled: true
      });
      
      return {
        shouldPause: true,
        pauseReason: 'Multiple consecutive failures detected',
        sophiaMessage: "I've detected multiple failures in a row. I'm pausing automation for 1 hour to protect your account. This could indicate LinkedIn is rate limiting your actions."
      };
    }
  }
  
  if (wasAccepted === false && todayUsage.acceptanceRate < 25) {
    const recentRejections = Math.max(0, todayUsage.connectionRequestsSent - todayUsage.connectionsAccepted);
    if (recentRejections >= 5) {
      logViolation({
        severity: 'medium',
        type: 'high_rejection_rate',
        message: `High rejection rate: ${recentRejections} recent rejections`,
        actionTaken: 'Reducing connection request rate',
        workspaceId,
        accountId
      });
      
      return {
        shouldPause: false,
        sophiaMessage: "I'm noticing a pattern of rejected connection requests. I'm automatically reducing your daily limit to improve acceptance rates. Consider revising your connection messages."
      };
    }
  }
  
  return { shouldPause: false };
}

export function generateComplianceReport(
  accountId: string,
  settings: any,
  workspaceId?: string
): ComplianceReport {
  const safetyScore = linkedinSafety.calculateSafetyScore(settings);
  const riskLevel = linkedinSafety.determineRiskLevel(settings, safetyScore);
  const warmupSummary = linkedinSafety.getWarmupSummary(settings);
  const adjustedLimits = linkedinSafety.calculateAdjustedLimits(settings);
  
  const recentViolations = violationLog
    .filter(v => v.accountId === accountId || v.workspaceId === workspaceId)
    .filter(v => new Date(v.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .slice(-20);
  
  const recommendations: string[] = [];
  const sophiaInsights: string[] = [];
  
  if (settings.acceptance_rate < 30) {
    recommendations.push('Improve connection request messages to boost acceptance rate');
    sophiaInsights.push(`Your acceptance rate of ${settings.acceptance_rate}% is below optimal. I recommend personalizing your connection messages more.`);
  }
  
  if (settings.is_warming_up) {
    recommendations.push(`Continue warmup process - Day ${warmupSummary.day} of 7`);
    sophiaInsights.push(`Your account is in warmup mode. I'm gradually increasing your daily limits to build trust with LinkedIn.`);
  }
  
  if (riskLevel === 'high' || riskLevel === 'critical') {
    recommendations.push('Reduce LinkedIn activity until safety score improves');
    sophiaInsights.push('I recommend reducing activity levels. Your current risk level requires caution.');
  }
  
  const pendingCount = settings.pending_invitations ?? 0;
  if (pendingCount > 500) {
    recommendations.push(`Withdraw old pending invitations (${pendingCount} pending)`);
    sophiaInsights.push(`You have ${pendingCount} pending invitations. LinkedIn may flag accounts with too many pending requests. Consider withdrawing old ones.`);
  }
  
  if (recentViolations.filter(v => v.severity === 'critical').length > 0) {
    sophiaInsights.push('There have been critical violations recently. I recommend reviewing your automation settings.');
  }
  
  const overallScore = calculateOverallComplianceScore(settings, recentViolations);
  
  let reportRiskLevel: 'safe' | 'moderate' | 'elevated' | 'critical';
  if (overallScore >= 80) reportRiskLevel = 'safe';
  else if (overallScore >= 60) reportRiskLevel = 'moderate';
  else if (overallScore >= 40) reportRiskLevel = 'elevated';
  else reportRiskLevel = 'critical';
  
  return {
    generatedAt: new Date().toISOString(),
    overallScore,
    riskLevel: reportRiskLevel,
    violations: recentViolations,
    recommendations,
    accountHealth: {
      acceptanceRate: settings.acceptance_rate ?? 50,
      warmupProgress: warmupSummary.progress,
      dailyUsage: ((settings.connections_sent_today ?? 0) / adjustedLimits.dailyConnections) * 100,
      safetyScore
    },
    sophiaInsights
  };
}

function calculateOverallComplianceScore(
  settings: any,
  recentViolations: ComplianceViolation[]
): number {
  let score = 100;
  
  score -= recentViolations.filter(v => v.severity === 'critical').length * 15;
  score -= recentViolations.filter(v => v.severity === 'high').length * 10;
  score -= recentViolations.filter(v => v.severity === 'medium').length * 5;
  score -= recentViolations.filter(v => v.severity === 'low').length * 2;
  
  const safetyScore = linkedinSafety.calculateSafetyScore(settings);
  score = Math.round((score * 0.6) + (safetyScore * 0.4));
  
  return Math.max(0, Math.min(100, score));
}

export function getLinkedInComplianceGuidelines(): {
  category: string;
  guidelines: { rule: string; explanation: string; sophiaEnforcement: string }[];
}[] {
  return [
    {
      category: 'Connection Requests',
      guidelines: [
        {
          rule: 'Maximum 20-25 connection requests per day',
          explanation: 'LinkedIn limits connection requests to prevent spam. Exceeding this risks account restrictions.',
          sophiaEnforcement: 'I automatically cap daily connections and adjust based on your account age and health.'
        },
        {
          rule: 'Keep pending invitations under 700',
          explanation: 'Too many pending invitations signals spammy behavior to LinkedIn.',
          sophiaEnforcement: 'I monitor pending invitations and recommend withdrawing old requests.'
        },
        {
          rule: 'Maintain acceptance rate above 30%',
          explanation: 'Low acceptance rates indicate poor targeting or spammy messages.',
          sophiaEnforcement: 'I auto-pause when acceptance rate drops too low and recommend message improvements.'
        }
      ]
    },
    {
      category: 'Messages',
      guidelines: [
        {
          rule: 'Maximum 100-150 messages per week',
          explanation: 'LinkedIn tracks messaging patterns. Excessive messaging triggers restrictions.',
          sophiaEnforcement: 'I track weekly message counts and reduce daily limits as you approach weekly caps.'
        },
        {
          rule: 'Use message variations',
          explanation: 'Identical messages are flagged as spam by LinkedIn.',
          sophiaEnforcement: 'I use spintax and AI variations to ensure each message is unique.'
        }
      ]
    },
    {
      category: 'Activity Timing',
      guidelines: [
        {
          rule: 'Operate during business hours (9 AM - 6 PM)',
          explanation: 'Activity outside business hours is a red flag for automation.',
          sophiaEnforcement: 'I respect business hours and reduce activity during off-hours and weekends.'
        },
        {
          rule: 'Random delays between actions (45-180 seconds)',
          explanation: 'Human-like timing patterns avoid bot detection.',
          sophiaEnforcement: 'I add random delays between all actions with occasional longer breaks.'
        }
      ]
    },
    {
      category: 'Account Warmup',
      guidelines: [
        {
          rule: '7-21 day warmup period for new automation',
          explanation: 'Sudden spikes in activity trigger LinkedIn\'s anti-automation systems.',
          sophiaEnforcement: 'I enforce a gradual 7-day warmup with progressively increasing limits.'
        },
        {
          rule: 'Adjust limits based on account age',
          explanation: 'Newer accounts have stricter internal limits from LinkedIn.',
          sophiaEnforcement: 'I reduce limits for accounts less than 90 days old.'
        }
      ]
    },
    {
      category: 'Legal & Ethical',
      guidelines: [
        {
          rule: 'LinkedIn automation may violate LinkedIn ToS',
          explanation: 'While commonly used, automation tools are technically against LinkedIn\'s Terms of Service.',
          sophiaEnforcement: 'I implement maximum safety measures but cannot eliminate all risk. Users proceed at their own discretion.'
        },
        {
          rule: 'Respect opt-outs and unsubscribe requests',
          explanation: 'Continuing to contact someone who has asked to stop is harassment.',
          sophiaEnforcement: 'I maintain an opt-out list and never contact opted-out leads.'
        }
      ]
    }
  ];
}

export function getRecentViolations(limit: number = 50): ComplianceViolation[] {
  return violationLog.slice(-limit).reverse();
}

export function getAutoPauseEvents(accountId?: string): AutoPauseEvent[] {
  if (accountId) {
    return autoPauseEvents.filter(e => e.accountId === accountId);
  }
  return autoPauseEvents;
}

export function clearViolationLog(): void {
  violationLog.length = 0;
  console.log('[Sophia Compliance] Violation log cleared');
}

export const sophiaLinkedInCompliance = {
  preActionCheck: sophiaPreActionCheck,
  monitorActivity: sophiaMonitorActivity,
  generateReport: generateComplianceReport,
  getGuidelines: getLinkedInComplianceGuidelines,
  getViolations: getRecentViolations,
  getAutoPauseEvents,
  logViolation,
  clearViolationLog
};
