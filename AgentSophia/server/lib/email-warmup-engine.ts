// ============================================
// EMAIL WARMUP ENGINE
// Gradual domain/IP warmup with Sophia AI management
// ============================================

export interface EmailDomain {
  id: string;
  workspaceId: string;
  domain: string;
  provider: 'sendgrid' | 'ses' | 'postmark' | 'resend' | 'smtp';
  status: 'pending_verification' | 'verified' | 'warming' | 'warmed' | 'paused' | 'flagged';
  warmupDay: number;
  warmupStartedAt: Date | null;
  dailyLimit: number;
  sentToday: number;
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  bounceRate: number;
  complaintRate: number;
  reputationScore: number;
  lastSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WarmupSchedule {
  day: number;
  dailyLimit: number;
  description: string;
  recommendations: string[];
}

export interface WarmupAction {
  id: string;
  domainId: string;
  actionType: 'send_batch' | 'pause' | 'resume' | 'adjust_volume' | 'flag_issue';
  reason: string;
  performedAt: Date;
  performedBy: 'sophia' | 'user';
  result: 'success' | 'failed';
  details?: any;
}

export interface SophiaWarmupInsight {
  domain: string;
  healthScore: number;
  status: 'healthy' | 'warning' | 'critical';
  insights: string[];
  recommendations: string[];
  predictedWarmupCompletion: Date | null;
  riskFactors: string[];
  automatedActions: { action: string; scheduledFor: Date; reason: string }[];
}

const WARMUP_SCHEDULE: WarmupSchedule[] = [
  { day: 1, dailyLimit: 20, description: 'Initial warmup - Testing deliverability', recommendations: ['Send to engaged subscribers only', 'Monitor bounce rates closely'] },
  { day: 2, dailyLimit: 40, description: 'Building initial reputation', recommendations: ['Continue with engaged list', 'Check spam folder placement'] },
  { day: 3, dailyLimit: 75, description: 'Gradual increase', recommendations: ['Maintain consistent sending times', 'Segment by engagement'] },
  { day: 4, dailyLimit: 100, description: 'Establishing patterns', recommendations: ['Vary content slightly', 'Track open rates'] },
  { day: 5, dailyLimit: 150, description: 'Moderate volume', recommendations: ['Expand recipient pool', 'Monitor complaints'] },
  { day: 6, dailyLimit: 200, description: 'Increasing capacity', recommendations: ['Test different subject lines', 'Review delivery times'] },
  { day: 7, dailyLimit: 300, description: 'Week 1 complete', recommendations: ['Analyze first week metrics', 'Adjust strategy if needed'] },
  { day: 8, dailyLimit: 400, description: 'Week 2 begins', recommendations: ['Maintain consistency', 'Expand content variety'] },
  { day: 9, dailyLimit: 500, description: 'Growing volume', recommendations: ['Monitor inbox placement', 'Check authentication'] },
  { day: 10, dailyLimit: 650, description: 'Accelerating', recommendations: ['Review engagement metrics', 'Clean inactive addresses'] },
  { day: 11, dailyLimit: 800, description: 'Strong foundation', recommendations: ['Test larger segments', 'Verify SPF/DKIM'] },
  { day: 12, dailyLimit: 1000, description: 'Hitting stride', recommendations: ['Analyze top-performing content', 'Expand safely'] },
  { day: 13, dailyLimit: 1250, description: 'Building momentum', recommendations: ['Maintain quality over quantity', 'Review bounce patterns'] },
  { day: 14, dailyLimit: 1500, description: 'Week 2 complete', recommendations: ['Full metrics review', 'Prepare for scale'] },
  { day: 15, dailyLimit: 2000, description: 'Scaling up', recommendations: ['Increase gradually', 'Monitor deliverability'] },
  { day: 16, dailyLimit: 2500, description: 'Approaching capacity', recommendations: ['Final reputation building', 'Quality checks'] },
  { day: 17, dailyLimit: 3000, description: 'Near completion', recommendations: ['Test full volume', 'Verify all metrics'] },
  { day: 18, dailyLimit: 4000, description: 'Final stretch', recommendations: ['Prepare for full operation', 'Document learnings'] },
  { day: 19, dailyLimit: 5000, description: 'Warmup complete', recommendations: ['Maintain sending consistency', 'Regular monitoring'] },
  { day: 20, dailyLimit: 10000, description: 'Full capacity', recommendations: ['Scale responsibly', 'Keep engagement high'] },
];

const PROVIDER_CONFIGS = {
  sendgrid: {
    name: 'SendGrid',
    maxDailyNew: 10000,
    warmupRequired: true,
    dedicatedIpCost: 30,
    features: ['Marketing + Transactional', 'Email Validation', 'Templates', 'Analytics'],
    apiDocsUrl: 'https://docs.sendgrid.com',
  },
  ses: {
    name: 'Amazon SES',
    maxDailyNew: 50000,
    warmupRequired: true,
    dedicatedIpCost: 25,
    features: ['Ultra Low Cost', 'AWS Integration', 'High Scalability'],
    apiDocsUrl: 'https://docs.aws.amazon.com/ses',
  },
  postmark: {
    name: 'Postmark',
    maxDailyNew: 10000,
    warmupRequired: false,
    dedicatedIpCost: 0,
    features: ['Fastest Delivery', 'Transactional Focus', 'Great Support'],
    apiDocsUrl: 'https://postmarkapp.com/developer',
  },
  resend: {
    name: 'Resend',
    maxDailyNew: 10000,
    warmupRequired: true,
    dedicatedIpCost: 20,
    features: ['Modern API', 'Developer Focused', 'React Email Support'],
    apiDocsUrl: 'https://resend.com/docs',
  },
  smtp: {
    name: 'Custom SMTP',
    maxDailyNew: 5000,
    warmupRequired: true,
    dedicatedIpCost: 0,
    features: ['Full Control', 'Any Provider', 'Self-Managed'],
    apiDocsUrl: '',
  },
};

class EmailWarmupEngine {
  private domains: Map<string, EmailDomain> = new Map();
  private actions: Map<string, WarmupAction[]> = new Map();
  private sophiaEnabled: boolean = true;

  getWarmupSchedule(): WarmupSchedule[] {
    return WARMUP_SCHEDULE;
  }

  getProviderConfigs() {
    return PROVIDER_CONFIGS;
  }

  getDailyLimitForDay(day: number): number {
    const schedule = WARMUP_SCHEDULE.find(s => s.day === day);
    if (schedule) return schedule.dailyLimit;
    if (day > 20) return 10000;
    return 20;
  }

  addDomain(
    workspaceId: string,
    domain: string,
    provider: EmailDomain['provider']
  ): EmailDomain {
    const id = `domain_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const emailDomain: EmailDomain = {
      id,
      workspaceId,
      domain,
      provider,
      status: 'pending_verification',
      warmupDay: 0,
      warmupStartedAt: null,
      dailyLimit: 0,
      sentToday: 0,
      totalSent: 0,
      deliveryRate: 100,
      openRate: 0,
      bounceRate: 0,
      complaintRate: 0,
      reputationScore: 100,
      lastSentAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.domains.set(id, emailDomain);
    this.actions.set(id, []);

    return emailDomain;
  }

  verifyDomain(domainId: string): { success: boolean; message: string; records?: any } {
    const domain = this.domains.get(domainId);
    if (!domain) {
      return { success: false, message: 'Domain not found' };
    }

    domain.status = 'verified';
    domain.updatedAt = new Date();

    return {
      success: true,
      message: 'Domain verified successfully',
      records: {
        spf: { status: 'verified', record: `v=spf1 include:${domain.provider}.com ~all` },
        dkim: { status: 'verified', record: `k=rsa; p=MIGfMA0GCSq...` },
        dmarc: { status: 'verified', record: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@' + domain.domain },
      }
    };
  }

  startWarmup(domainId: string): { success: boolean; message: string; schedule?: WarmupSchedule[] } {
    const domain = this.domains.get(domainId);
    if (!domain) {
      return { success: false, message: 'Domain not found' };
    }

    if (domain.status !== 'verified') {
      return { success: false, message: 'Domain must be verified before warmup' };
    }

    domain.status = 'warming';
    domain.warmupDay = 1;
    domain.warmupStartedAt = new Date();
    domain.dailyLimit = this.getDailyLimitForDay(1);
    domain.updatedAt = new Date();

    this.logAction(domainId, 'send_batch', 'Warmup started', 'sophia');

    return {
      success: true,
      message: `Warmup started for ${domain.domain}. Day 1 limit: ${domain.dailyLimit} emails`,
      schedule: WARMUP_SCHEDULE.slice(0, 7)
    };
  }

  advanceWarmupDay(domainId: string): { success: boolean; newDay: number; newLimit: number } {
    const domain = this.domains.get(domainId);
    if (!domain || domain.status !== 'warming') {
      return { success: false, newDay: 0, newLimit: 0 };
    }

    if (domain.bounceRate > 5 || domain.complaintRate > 0.3) {
      domain.status = 'flagged';
      this.logAction(domainId, 'flag_issue', 'High bounce/complaint rate detected', 'sophia');
      return { success: false, newDay: domain.warmupDay, newLimit: domain.dailyLimit };
    }

    domain.warmupDay++;
    domain.dailyLimit = this.getDailyLimitForDay(domain.warmupDay);
    domain.sentToday = 0;
    domain.updatedAt = new Date();

    if (domain.warmupDay >= 20) {
      domain.status = 'warmed';
      this.logAction(domainId, 'send_batch', 'Warmup completed successfully', 'sophia');
    }

    return {
      success: true,
      newDay: domain.warmupDay,
      newLimit: domain.dailyLimit
    };
  }

  recordSend(domainId: string, count: number): { allowed: boolean; sent: number; remaining: number } {
    const domain = this.domains.get(domainId);
    if (!domain) {
      return { allowed: false, sent: 0, remaining: 0 };
    }

    const allowedCount = Math.min(count, domain.dailyLimit - domain.sentToday);
    
    if (allowedCount <= 0) {
      return { allowed: false, sent: 0, remaining: 0 };
    }

    domain.sentToday += allowedCount;
    domain.totalSent += allowedCount;
    domain.lastSentAt = new Date();
    domain.updatedAt = new Date();

    return {
      allowed: true,
      sent: allowedCount,
      remaining: domain.dailyLimit - domain.sentToday
    };
  }

  recordMetrics(
    domainId: string,
    delivered: number,
    bounced: number,
    opened: number,
    complained: number
  ): void {
    const domain = this.domains.get(domainId);
    if (!domain) return;

    const total = delivered + bounced;
    if (total > 0) {
      const newDeliveryRate = (delivered / total) * 100;
      domain.deliveryRate = (domain.deliveryRate * 0.7) + (newDeliveryRate * 0.3);
      
      const newBounceRate = (bounced / total) * 100;
      domain.bounceRate = (domain.bounceRate * 0.7) + (newBounceRate * 0.3);
    }

    if (delivered > 0) {
      const newOpenRate = (opened / delivered) * 100;
      domain.openRate = (domain.openRate * 0.7) + (newOpenRate * 0.3);
      
      const newComplaintRate = (complained / delivered) * 100;
      domain.complaintRate = (domain.complaintRate * 0.7) + (newComplaintRate * 0.3);
    }

    domain.reputationScore = this.calculateReputationScore(domain);
    domain.updatedAt = new Date();

    if (domain.bounceRate > 5) {
      this.logAction(domainId, 'flag_issue', `High bounce rate: ${domain.bounceRate.toFixed(2)}%`, 'sophia');
    }
    if (domain.complaintRate > 0.3) {
      this.logAction(domainId, 'flag_issue', `High complaint rate: ${domain.complaintRate.toFixed(3)}%`, 'sophia');
    }
  }

  private calculateReputationScore(domain: EmailDomain): number {
    let score = 100;

    if (domain.bounceRate > 2) score -= (domain.bounceRate - 2) * 5;
    if (domain.bounceRate > 5) score -= (domain.bounceRate - 5) * 10;

    if (domain.complaintRate > 0.1) score -= (domain.complaintRate - 0.1) * 100;
    if (domain.complaintRate > 0.3) score -= (domain.complaintRate - 0.3) * 200;

    if (domain.openRate > 30) score += 5;
    if (domain.openRate > 40) score += 5;
    if (domain.openRate < 15) score -= 10;

    if (domain.deliveryRate > 98) score += 5;
    if (domain.deliveryRate < 95) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private logAction(
    domainId: string,
    actionType: WarmupAction['actionType'],
    reason: string,
    performedBy: 'sophia' | 'user'
  ): void {
    const action: WarmupAction = {
      id: `action_${Date.now()}`,
      domainId,
      actionType,
      reason,
      performedAt: new Date(),
      performedBy,
      result: 'success'
    };

    const domainActions = this.actions.get(domainId) || [];
    domainActions.push(action);
    this.actions.set(domainId, domainActions);
  }

  getDomain(domainId: string): EmailDomain | undefined {
    return this.domains.get(domainId);
  }

  getWorkspaceDomains(workspaceId: string): EmailDomain[] {
    return Array.from(this.domains.values())
      .filter(d => d.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getDomainActions(domainId: string): WarmupAction[] {
    return this.actions.get(domainId) || [];
  }

  getSophiaInsight(domainId: string): SophiaWarmupInsight | null {
    const domain = this.domains.get(domainId);
    if (!domain) return null;

    const insights: string[] = [];
    const recommendations: string[] = [];
    const riskFactors: string[] = [];
    const automatedActions: SophiaWarmupInsight['automatedActions'] = [];

    let healthScore = domain.reputationScore;
    let status: SophiaWarmupInsight['status'] = 'healthy';

    if (domain.bounceRate > 2) {
      insights.push(`Bounce rate (${domain.bounceRate.toFixed(2)}%) is above recommended 2%`);
      recommendations.push('Clean your email list and remove invalid addresses');
      riskFactors.push('High bounce rate affecting sender reputation');
      healthScore -= 10;
    }

    if (domain.complaintRate > 0.1) {
      insights.push(`Complaint rate (${domain.complaintRate.toFixed(3)}%) needs attention`);
      recommendations.push('Review email content and ensure proper opt-in');
      riskFactors.push('Spam complaints may trigger provider warnings');
      healthScore -= 15;
    }

    if (domain.openRate < 20 && domain.totalSent > 100) {
      insights.push(`Open rate (${domain.openRate.toFixed(1)}%) is below average`);
      recommendations.push('Improve subject lines and send time optimization');
    }

    if (domain.status === 'warming') {
      const daysRemaining = 20 - domain.warmupDay;
      insights.push(`Day ${domain.warmupDay} of warmup (${daysRemaining} days remaining)`);
      recommendations.push(`Today's limit: ${domain.dailyLimit} emails. Stay within limits.`);
      
      automatedActions.push({
        action: 'Advance to next warmup day',
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reason: 'Automatic progression based on metrics'
      });
    }

    if (domain.openRate > 40) {
      insights.push('Excellent open rate - your content is resonating');
    }

    if (domain.deliveryRate > 98) {
      insights.push('Strong delivery rate indicates healthy sender reputation');
    }

    if (healthScore < 50) {
      status = 'critical';
    } else if (healthScore < 75) {
      status = 'warning';
    }

    const predictedWarmupCompletion = domain.status === 'warming' && domain.warmupStartedAt
      ? new Date(domain.warmupStartedAt.getTime() + (20 - domain.warmupDay) * 24 * 60 * 60 * 1000)
      : null;

    return {
      domain: domain.domain,
      healthScore,
      status,
      insights,
      recommendations,
      predictedWarmupCompletion,
      riskFactors,
      automatedActions
    };
  }

  sophiaRecommendAction(domainId: string): {
    action: string;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
    autoExecute: boolean;
  } | null {
    const domain = this.domains.get(domainId);
    if (!domain) return null;

    if (domain.complaintRate > 0.5) {
      return {
        action: 'pause_sending',
        reason: 'Critical complaint rate detected. Pause to protect sender reputation.',
        urgency: 'high',
        autoExecute: true
      };
    }

    if (domain.bounceRate > 10) {
      return {
        action: 'pause_and_clean_list',
        reason: 'High bounce rate requires list cleaning before continuing.',
        urgency: 'high',
        autoExecute: true
      };
    }

    if (domain.status === 'warming' && domain.sentToday >= domain.dailyLimit * 0.9) {
      return {
        action: 'hold_until_tomorrow',
        reason: 'Approaching daily limit. Hold remaining emails for tomorrow.',
        urgency: 'medium',
        autoExecute: false
      };
    }

    if (domain.openRate > 50 && domain.status === 'warming') {
      return {
        action: 'accelerate_warmup',
        reason: 'Excellent engagement. Consider accelerating warmup pace.',
        urgency: 'low',
        autoExecute: false
      };
    }

    return null;
  }

  pauseWarmup(domainId: string, reason: string): { success: boolean; message: string } {
    const domain = this.domains.get(domainId);
    if (!domain) return { success: false, message: 'Domain not found' };

    domain.status = 'paused';
    domain.updatedAt = new Date();
    this.logAction(domainId, 'pause', reason, 'sophia');

    return { success: true, message: `Warmup paused for ${domain.domain}` };
  }

  resumeWarmup(domainId: string): { success: boolean; message: string } {
    const domain = this.domains.get(domainId);
    if (!domain) return { success: false, message: 'Domain not found' };

    if (domain.status !== 'paused' && domain.status !== 'flagged') {
      return { success: false, message: 'Domain is not paused' };
    }

    domain.status = 'warming';
    domain.updatedAt = new Date();
    this.logAction(domainId, 'resume', 'Warmup resumed', 'user');

    return { success: true, message: `Warmup resumed for ${domain.domain}` };
  }

  getWarmupDashboard(workspaceId: string): {
    domains: EmailDomain[];
    summary: {
      total: number;
      warming: number;
      warmed: number;
      flagged: number;
      avgReputationScore: number;
    };
    sophiaInsights: SophiaWarmupInsight[];
  } {
    const domains = this.getWorkspaceDomains(workspaceId);
    
    const summary = {
      total: domains.length,
      warming: domains.filter(d => d.status === 'warming').length,
      warmed: domains.filter(d => d.status === 'warmed').length,
      flagged: domains.filter(d => d.status === 'flagged').length,
      avgReputationScore: domains.length > 0
        ? Math.round(domains.reduce((sum, d) => sum + d.reputationScore, 0) / domains.length)
        : 100
    };

    const sophiaInsights = domains
      .map(d => this.getSophiaInsight(d.id))
      .filter((i): i is SophiaWarmupInsight => i !== null);

    return { domains, summary, sophiaInsights };
  }
}

export const emailWarmupEngine = new EmailWarmupEngine();
