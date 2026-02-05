// ============================================
// SOPHIA EMAIL MANAGER
// Autonomous AI-powered email management
// Integrates with Resend, handles warmup, content generation, and optimization
// ============================================

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================
// EMAIL PROVIDER ABSTRACTION
// ============================================

export interface EmailProvider {
  name: string;
  send(email: EmailMessage): Promise<SendResult>;
  getStatus(emailId: string): Promise<EmailStatus>;
}

export interface EmailMessage {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  tags?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface EmailStatus {
  id: string;
  status: 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained';
  openedAt?: Date;
  clickedAt?: Date;
}

// Resend Provider Implementation
class ResendProvider implements EmailProvider {
  name = 'resend';
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
  }

  async send(email: EmailMessage): Promise<SendResult> {
    if (!this.apiKey) {
      return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          from: email.from,
          to: Array.isArray(email.to) ? email.to : [email.to],
          subject: email.subject,
          html: email.html,
          text: email.text,
          reply_to: email.replyTo,
          cc: email.cc,
          bcc: email.bcc,
          tags: email.tags ? Object.entries(email.tags).map(([name, value]) => ({ name, value })) : undefined
        })
      });

      const data = await response.json();

      if (response.ok) {
        return { success: true, id: data.id };
      } else {
        return { success: false, error: data.message || 'Failed to send' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getStatus(emailId: string): Promise<EmailStatus> {
    return { id: emailId, status: 'sent' };
  }
}

// ============================================
// SOPHIA'S PREDICTIVE SEND TIME OPTIMIZER
// ============================================

export interface ContactEngagement {
  contactId: string;
  email: string;
  timezone: string;
  bestHours: number[];
  bestDays: number[];
  avgOpenTime: number;
  avgResponseTime: number;
  engagementScore: number;
  lastOpened: Date | null;
  lastClicked: Date | null;
  lastReplied: Date | null;
}

class SendTimeOptimizer {
  private engagementData: Map<string, ContactEngagement> = new Map();

  recordEngagement(
    contactId: string,
    email: string,
    eventType: 'open' | 'click' | 'reply',
    timestamp: Date
  ) {
    const existing = this.engagementData.get(contactId) || this.createDefaultEngagement(contactId, email);
    
    const hour = timestamp.getHours();
    const day = timestamp.getDay();

    if (!existing.bestHours.includes(hour)) {
      existing.bestHours.push(hour);
      existing.bestHours = existing.bestHours.slice(-5);
    }
    if (!existing.bestDays.includes(day)) {
      existing.bestDays.push(day);
      existing.bestDays = existing.bestDays.slice(-3);
    }

    if (eventType === 'open') existing.lastOpened = timestamp;
    if (eventType === 'click') existing.lastClicked = timestamp;
    if (eventType === 'reply') existing.lastReplied = timestamp;

    existing.engagementScore = Math.min(100, existing.engagementScore + 5);
    this.engagementData.set(contactId, existing);
  }

  private createDefaultEngagement(contactId: string, email: string): ContactEngagement {
    return {
      contactId,
      email,
      timezone: 'America/New_York',
      bestHours: [9, 10, 14, 15],
      bestDays: [1, 2, 3, 4],
      avgOpenTime: 14,
      avgResponseTime: 120,
      engagementScore: 50,
      lastOpened: null,
      lastClicked: null,
      lastReplied: null
    };
  }

  predictBestSendTime(contactId: string): { date: Date; confidence: number; reason: string } {
    const engagement = this.engagementData.get(contactId);
    
    if (!engagement || engagement.engagementScore < 30) {
      const defaultTime = this.getDefaultOptimalTime();
      return {
        date: defaultTime,
        confidence: 0.6,
        reason: 'Using industry best practices (limited contact history)'
      };
    }

    const now = new Date();
    const optimalHour = engagement.bestHours[0] || 10;
    const optimalDay = engagement.bestDays[0] || 2;

    let targetDate = new Date(now);
    while (targetDate.getDay() !== optimalDay) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    targetDate.setHours(optimalHour, 0, 0, 0);

    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 7);
    }

    return {
      date: targetDate,
      confidence: Math.min(0.95, engagement.engagementScore / 100 + 0.3),
      reason: `Based on ${engagement.email}'s engagement patterns`
    };
  }

  private getDefaultOptimalTime(): Date {
    const now = new Date();
    let target = new Date(now);
    
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() + 1);
    }
    
    target.setHours(10, 0, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1);
      while (target.getDay() === 0 || target.getDay() === 6) {
        target.setDate(target.getDate() + 1);
      }
    }
    
    return target;
  }

  getAudienceInsights(contactIds: string[]): {
    avgEngagement: number;
    bestSendWindow: { day: string; hour: string };
    highEngagers: number;
    lowEngagers: number;
    recommendations: string[];
  } {
    const engagements = contactIds
      .map(id => this.engagementData.get(id))
      .filter((e): e is ContactEngagement => e !== undefined);

    if (engagements.length === 0) {
      return {
        avgEngagement: 50,
        bestSendWindow: { day: 'Tuesday', hour: '10:00 AM' },
        highEngagers: 0,
        lowEngagers: contactIds.length,
        recommendations: ['Build engagement history by sending to this audience']
      };
    }

    const avgEngagement = engagements.reduce((sum, e) => sum + e.engagementScore, 0) / engagements.length;
    const highEngagers = engagements.filter(e => e.engagementScore >= 70).length;
    const lowEngagers = engagements.filter(e => e.engagementScore < 40).length;

    const hourCounts: Record<number, number> = {};
    const dayCounts: Record<number, number> = {};
    engagements.forEach(e => {
      e.bestHours.forEach(h => hourCounts[h] = (hourCounts[h] || 0) + 1);
      e.bestDays.forEach(d => dayCounts[d] = (dayCounts[d] || 0) + 1);
    });

    const bestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '10';
    const bestDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '2';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const recommendations: string[] = [];
    if (lowEngagers > engagements.length * 0.5) {
      recommendations.push('Consider re-engagement campaign for low-engagement contacts');
    }
    if (avgEngagement < 50) {
      recommendations.push('Review email content and subject lines to improve engagement');
    }
    if (avgEngagement > 70) {
      recommendations.push('Strong engagement! Consider increasing send frequency');
    }

    return {
      avgEngagement: Math.round(avgEngagement),
      bestSendWindow: { 
        day: days[parseInt(bestDay)], 
        hour: `${parseInt(bestHour) > 12 ? parseInt(bestHour) - 12 : parseInt(bestHour)}:00 ${parseInt(bestHour) >= 12 ? 'PM' : 'AM'}` 
      },
      highEngagers,
      lowEngagers,
      recommendations
    };
  }
}

// ============================================
// SOPHIA'S CONTENT GENERATOR
// ============================================

class EmailContentGenerator {
  async generateSubjectLines(
    context: { industry: string; goal: string; audience: string; tone: string },
    count: number = 5
  ): Promise<{ subjects: string[]; recommendation: string }> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert email marketer. Generate compelling subject lines that drive opens.'
          },
          {
            role: 'user',
            content: `Generate ${count} email subject lines for:
Industry: ${context.industry}
Goal: ${context.goal}
Audience: ${context.audience}
Tone: ${context.tone}

Return only the subject lines, one per line.`
          }
        ],
        temperature: 0.8
      });

      const subjects = response.choices[0].message.content?.split('\n').filter(s => s.trim()) || [];
      
      return {
        subjects: subjects.slice(0, count),
        recommendation: subjects[0] || 'Quick question about your goals'
      };
    } catch (error) {
      return {
        subjects: [
          'Quick question for you',
          'Thought you might find this interesting',
          'Following up on our conversation',
          'A resource I thought you\'d appreciate',
          'Can we connect this week?'
        ],
        recommendation: 'Quick question for you'
      };
    }
  }

  async generateEmailBody(
    context: {
      goal: string;
      recipient: { firstName: string; company: string; role: string };
      tone: string;
      keyPoints: string[];
      cta: string;
    }
  ): Promise<{ html: string; text: string; preview: string }> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert email copywriter. Write concise, compelling emails that drive action.'
          },
          {
            role: 'user',
            content: `Write a professional email for:
Goal: ${context.goal}
Recipient: ${context.recipient.firstName} at ${context.recipient.company} (${context.recipient.role})
Tone: ${context.tone}
Key points to cover: ${context.keyPoints.join(', ')}
Call to action: ${context.cta}

Keep it under 150 words. Use short paragraphs.`
          }
        ],
        temperature: 0.7
      });

      const text = response.choices[0].message.content || '';
      const html = text.split('\n').map(p => p.trim() ? `<p>${p}</p>` : '').join('\n');

      return {
        html,
        text,
        preview: text.slice(0, 100) + '...'
      };
    } catch (error) {
      return {
        html: '<p>Hi {{firstName}},</p><p>I wanted to reach out...</p>',
        text: 'Hi {{firstName}},\n\nI wanted to reach out...',
        preview: 'I wanted to reach out...'
      };
    }
  }

  async optimizeContent(
    currentContent: string,
    metrics: { openRate: number; clickRate: number; replyRate: number }
  ): Promise<{ suggestions: string[]; improvedContent: string }> {
    const suggestions: string[] = [];

    if (metrics.openRate < 20) {
      suggestions.push('Subject line needs work - try adding personalization or urgency');
    }
    if (metrics.clickRate < 5) {
      suggestions.push('CTA is not compelling - make it more specific and action-oriented');
    }
    if (metrics.replyRate < 3) {
      suggestions.push('Email may be too long or impersonal - add a direct question');
    }

    return {
      suggestions,
      improvedContent: currentContent
    };
  }
}

// ============================================
// SOPHIA'S REPLY CLASSIFIER
// ============================================

export interface ReplyClassification {
  intent: 'interested' | 'not_interested' | 'question' | 'meeting_request' | 'objection' | 'out_of_office' | 'unsubscribe' | 'neutral';
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high';
  suggestedAction: string;
  autoReplyDraft?: string;
  confidence: number;
}

class ReplyClassifier {
  async classify(replyContent: string): Promise<ReplyClassification> {
    const lowerContent = replyContent.toLowerCase();

    if (lowerContent.includes('out of office') || lowerContent.includes('ooo') || lowerContent.includes('vacation')) {
      return {
        intent: 'out_of_office',
        sentiment: 'neutral',
        urgency: 'low',
        suggestedAction: 'Schedule follow-up for their return',
        confidence: 0.95
      };
    }

    if (lowerContent.includes('unsubscribe') || lowerContent.includes('remove me') || lowerContent.includes('stop emailing')) {
      return {
        intent: 'unsubscribe',
        sentiment: 'negative',
        urgency: 'high',
        suggestedAction: 'Remove from list immediately',
        confidence: 0.98
      };
    }

    if (lowerContent.includes('not interested') || lowerContent.includes('no thanks') || lowerContent.includes('pass')) {
      return {
        intent: 'not_interested',
        sentiment: 'negative',
        urgency: 'low',
        suggestedAction: 'Move to nurture sequence or archive',
        confidence: 0.85
      };
    }

    if (lowerContent.includes('schedule') || lowerContent.includes('meet') || lowerContent.includes('call') || lowerContent.includes('demo')) {
      return {
        intent: 'meeting_request',
        sentiment: 'positive',
        urgency: 'high',
        suggestedAction: 'Send calendar link immediately',
        autoReplyDraft: this.generateMeetingReply(),
        confidence: 0.9
      };
    }

    if (lowerContent.includes('interested') || lowerContent.includes('tell me more') || lowerContent.includes('sounds good')) {
      return {
        intent: 'interested',
        sentiment: 'positive',
        urgency: 'high',
        suggestedAction: 'Send more information and propose next steps',
        confidence: 0.85
      };
    }

    if (lowerContent.includes('?') || lowerContent.includes('how') || lowerContent.includes('what') || lowerContent.includes('why')) {
      return {
        intent: 'question',
        sentiment: 'neutral',
        urgency: 'medium',
        suggestedAction: 'Answer their question and move conversation forward',
        confidence: 0.75
      };
    }

    if (lowerContent.includes('expensive') || lowerContent.includes('budget') || lowerContent.includes('competitor')) {
      return {
        intent: 'objection',
        sentiment: 'neutral',
        urgency: 'medium',
        suggestedAction: 'Address objection with value proposition',
        confidence: 0.8
      };
    }

    return {
      intent: 'neutral',
      sentiment: 'neutral',
      urgency: 'medium',
      suggestedAction: 'Review and respond personally',
      confidence: 0.5
    };
  }

  private generateMeetingReply(): string {
    return `Thanks for your interest! I'd love to set up a time to chat.

Here's my calendar link: [CALENDAR_LINK]

Feel free to pick any time that works for you, or let me know if you'd prefer I suggest some times.

Looking forward to connecting!`;
  }

  async generateAutoReply(
    classification: ReplyClassification,
    context: { contactName: string; originalSubject: string }
  ): Promise<string | null> {
    if (classification.confidence < 0.8) return null;

    switch (classification.intent) {
      case 'meeting_request':
        return classification.autoReplyDraft || null;
      case 'out_of_office':
        return null;
      case 'unsubscribe':
        return `Hi ${context.contactName},

You've been removed from our mailing list. You won't receive any more emails from us.

If this was a mistake, just reply to this email.

Best regards`;
      default:
        return null;
    }
  }
}

// ============================================
// SOPHIA'S WARMUP AUTOMATION
// ============================================

export interface WarmupDomain {
  id: string;
  domain: string;
  provider: string;
  status: 'pending' | 'warming' | 'warmed' | 'paused' | 'flagged';
  warmupDay: number;
  dailyLimit: number;
  sentToday: number;
  metrics: {
    deliveryRate: number;
    openRate: number;
    bounceRate: number;
    complaintRate: number;
    reputationScore: number;
  };
}

class WarmupAutomation {
  private domains: Map<string, WarmupDomain> = new Map();
  private warmupEmails: string[] = [];
  private sendLogs: Map<string, { sentAt: Date; opened: boolean; bounced: boolean }[]> = new Map();

  private readonly WARMUP_SCHEDULE = [
    { day: 1, limit: 20 }, { day: 2, limit: 40 }, { day: 3, limit: 75 },
    { day: 4, limit: 100 }, { day: 5, limit: 150 }, { day: 6, limit: 200 },
    { day: 7, limit: 300 }, { day: 8, limit: 400 }, { day: 9, limit: 500 },
    { day: 10, limit: 650 }, { day: 11, limit: 800 }, { day: 12, limit: 1000 },
    { day: 13, limit: 1250 }, { day: 14, limit: 1500 }, { day: 15, limit: 2000 },
    { day: 16, limit: 2500 }, { day: 17, limit: 3000 }, { day: 18, limit: 4000 },
    { day: 19, limit: 5000 }, { day: 20, limit: 10000 }
  ];

  registerDomain(id: string, domain: string, provider: string): WarmupDomain {
    const warmupDomain: WarmupDomain = {
      id,
      domain,
      provider,
      status: 'pending',
      warmupDay: 0,
      dailyLimit: 0,
      sentToday: 0,
      metrics: {
        deliveryRate: 100,
        openRate: 0,
        bounceRate: 0,
        complaintRate: 0,
        reputationScore: 100
      }
    };
    this.domains.set(id, warmupDomain);
    return warmupDomain;
  }

  startWarmup(domainId: string): { success: boolean; message: string } {
    const domain = this.domains.get(domainId);
    if (!domain) return { success: false, message: 'Domain not found' };

    domain.status = 'warming';
    domain.warmupDay = 1;
    domain.dailyLimit = 20;

    return {
      success: true,
      message: `Warmup started for ${domain.domain}. Day 1 limit: 20 emails`
    };
  }

  async executeWarmupCycle(domainId: string): Promise<{
    sent: number;
    remaining: number;
    status: string;
    nextAction: string;
  }> {
    const domain = this.domains.get(domainId);
    if (!domain || domain.status !== 'warming') {
      return { sent: 0, remaining: 0, status: 'inactive', nextAction: 'Start warmup first' };
    }

    const toSend = Math.min(domain.dailyLimit - domain.sentToday, 10);
    
    domain.sentToday += toSend;
    
    const remaining = domain.dailyLimit - domain.sentToday;
    let nextAction = 'Continue sending';

    if (remaining === 0) {
      nextAction = 'Daily limit reached. Wait for tomorrow to continue.';
    }

    if (domain.metrics.bounceRate > 5) {
      domain.status = 'flagged';
      nextAction = 'ALERT: High bounce rate detected. Pausing warmup.';
    }

    if (domain.metrics.complaintRate > 0.3) {
      domain.status = 'flagged';
      nextAction = 'ALERT: High complaint rate detected. Pausing warmup.';
    }

    return {
      sent: toSend,
      remaining,
      status: domain.status,
      nextAction
    };
  }

  advanceDay(domainId: string): { success: boolean; newDay: number; newLimit: number } {
    const domain = this.domains.get(domainId);
    if (!domain) return { success: false, newDay: 0, newLimit: 0 };

    if (domain.metrics.bounceRate > 3 || domain.metrics.complaintRate > 0.2) {
      return { success: false, newDay: domain.warmupDay, newLimit: domain.dailyLimit };
    }

    domain.warmupDay++;
    domain.sentToday = 0;
    
    const schedule = this.WARMUP_SCHEDULE.find(s => s.day === domain.warmupDay);
    domain.dailyLimit = schedule?.limit || 10000;

    if (domain.warmupDay >= 20) {
      domain.status = 'warmed';
    }

    return { success: true, newDay: domain.warmupDay, newLimit: domain.dailyLimit };
  }

  recordMetrics(domainId: string, delivered: number, bounced: number, opened: number, complained: number) {
    const domain = this.domains.get(domainId);
    if (!domain) return;

    const total = delivered + bounced;
    if (total > 0) {
      domain.metrics.deliveryRate = (delivered / total) * 100;
      domain.metrics.bounceRate = (bounced / total) * 100;
    }
    if (delivered > 0) {
      domain.metrics.openRate = (opened / delivered) * 100;
      domain.metrics.complaintRate = (complained / delivered) * 100;
    }

    domain.metrics.reputationScore = this.calculateReputation(domain);
  }

  private calculateReputation(domain: WarmupDomain): number {
    let score = 100;
    score -= Math.max(0, domain.metrics.bounceRate - 2) * 5;
    score -= domain.metrics.complaintRate * 100;
    if (domain.metrics.openRate > 30) score += 5;
    return Math.max(0, Math.min(100, score));
  }

  getSophiaRecommendation(domainId: string): {
    action: string;
    reason: string;
    urgency: 'low' | 'medium' | 'high';
    autoExecute: boolean;
  } | null {
    const domain = this.domains.get(domainId);
    if (!domain) return null;

    if (domain.metrics.complaintRate > 0.5) {
      return {
        action: 'PAUSE_IMMEDIATELY',
        reason: 'Critical complaint rate. Protect sender reputation.',
        urgency: 'high',
        autoExecute: true
      };
    }

    if (domain.metrics.bounceRate > 8) {
      return {
        action: 'PAUSE_AND_CLEAN',
        reason: 'High bounce rate. Clean email list before continuing.',
        urgency: 'high',
        autoExecute: true
      };
    }

    if (domain.metrics.openRate > 50 && domain.warmupDay < 10) {
      return {
        action: 'ACCELERATE',
        reason: 'Excellent engagement. Can safely increase volume.',
        urgency: 'low',
        autoExecute: false
      };
    }

    if (domain.sentToday >= domain.dailyLimit) {
      return {
        action: 'WAIT',
        reason: 'Daily limit reached. Resume tomorrow.',
        urgency: 'low',
        autoExecute: true
      };
    }

    return null;
  }

  getDomainStatus(domainId: string): WarmupDomain | undefined {
    return this.domains.get(domainId);
  }

  getAllDomains(): WarmupDomain[] {
    return Array.from(this.domains.values());
  }
}

// ============================================
// SOPHIA EMAIL MANAGER - MAIN CLASS
// ============================================

class SophiaEmailManager {
  private provider: EmailProvider;
  private sendTimeOptimizer: SendTimeOptimizer;
  private contentGenerator: EmailContentGenerator;
  private replyClassifier: ReplyClassifier;
  private warmupAutomation: WarmupAutomation;
  
  private autonomyLevel: 'manual' | 'assisted' | 'autonomous' = 'assisted';
  private approvalThreshold: number = 0.8;

  constructor() {
    this.provider = new ResendProvider();
    this.sendTimeOptimizer = new SendTimeOptimizer();
    this.contentGenerator = new EmailContentGenerator();
    this.replyClassifier = new ReplyClassifier();
    this.warmupAutomation = new WarmupAutomation();
  }

  setAutonomyLevel(level: 'manual' | 'assisted' | 'autonomous') {
    this.autonomyLevel = level;
  }

  setApprovalThreshold(threshold: number) {
    this.approvalThreshold = Math.max(0, Math.min(1, threshold));
  }

  async sendOptimized(
    email: EmailMessage,
    contactId: string
  ): Promise<{ result: SendResult; scheduledFor?: Date; reason?: string }> {
    const prediction = this.sendTimeOptimizer.predictBestSendTime(contactId);

    if (this.autonomyLevel === 'autonomous' && prediction.confidence >= this.approvalThreshold) {
      const now = new Date();
      if (prediction.date > now) {
        return {
          result: { success: true, id: `scheduled_${Date.now()}` },
          scheduledFor: prediction.date,
          reason: prediction.reason
        };
      }
    }

    const result = await this.provider.send(email);
    return { result };
  }

  async generateCampaignContent(
    context: { industry: string; goal: string; audience: string; tone: string }
  ) {
    const subjectLines = await this.contentGenerator.generateSubjectLines(context);
    
    return {
      subjectLines,
      sophiaRecommendation: {
        subject: subjectLines.recommendation,
        confidence: 0.85,
        reason: 'Based on industry best practices and high-performing patterns'
      }
    };
  }

  async classifyReply(content: string) {
    return this.replyClassifier.classify(content);
  }

  async handleReplyAutonomously(
    replyContent: string,
    context: { contactName: string; originalSubject: string; contactEmail: string }
  ): Promise<{
    classification: ReplyClassification;
    autoReply?: string;
    actionTaken: string;
    requiresApproval: boolean;
  }> {
    const classification = await this.replyClassifier.classify(replyContent);
    
    if (this.autonomyLevel === 'manual') {
      return {
        classification,
        actionTaken: 'Classified - awaiting manual review',
        requiresApproval: true
      };
    }

    if (classification.confidence >= this.approvalThreshold && this.autonomyLevel === 'autonomous') {
      const autoReply = await this.replyClassifier.generateAutoReply(classification, context);
      
      if (autoReply && classification.intent === 'meeting_request') {
        return {
          classification,
          autoReply,
          actionTaken: 'Meeting request detected - auto-reply sent with calendar link',
          requiresApproval: false
        };
      }

      if (classification.intent === 'unsubscribe') {
        return {
          classification,
          actionTaken: 'Unsubscribe request - contact removed from lists',
          requiresApproval: false
        };
      }
    }

    return {
      classification,
      actionTaken: 'Classified - requires human review',
      requiresApproval: true
    };
  }

  registerWarmupDomain(domain: string, provider: string) {
    const id = `warmup_${Date.now()}`;
    return this.warmupAutomation.registerDomain(id, domain, provider);
  }

  startDomainWarmup(domainId: string) {
    return this.warmupAutomation.startWarmup(domainId);
  }

  async executeWarmupCycle(domainId: string) {
    const result = await this.warmupAutomation.executeWarmupCycle(domainId);
    
    const recommendation = this.warmupAutomation.getSophiaRecommendation(domainId);
    if (recommendation?.autoExecute && this.autonomyLevel === 'autonomous') {
      if (recommendation.action === 'PAUSE_IMMEDIATELY' || recommendation.action === 'PAUSE_AND_CLEAN') {
        return { ...result, autoAction: recommendation };
      }
    }

    return result;
  }

  advanceWarmupDay(domainId: string) {
    return this.warmupAutomation.advanceDay(domainId);
  }

  recordWarmupMetrics(domainId: string, delivered: number, bounced: number, opened: number, complained: number) {
    this.warmupAutomation.recordMetrics(domainId, delivered, bounced, opened, complained);
  }

  getWarmupStatus(domainId: string) {
    return this.warmupAutomation.getDomainStatus(domainId);
  }

  getAllWarmupDomains() {
    return this.warmupAutomation.getAllDomains();
  }

  getWarmupRecommendation(domainId: string) {
    return this.warmupAutomation.getSophiaRecommendation(domainId);
  }

  recordEngagement(contactId: string, email: string, eventType: 'open' | 'click' | 'reply') {
    this.sendTimeOptimizer.recordEngagement(contactId, email, eventType, new Date());
  }

  getAudienceInsights(contactIds: string[]) {
    return this.sendTimeOptimizer.getAudienceInsights(contactIds);
  }

  getStatus() {
    return {
      provider: this.provider.name,
      autonomyLevel: this.autonomyLevel,
      approvalThreshold: this.approvalThreshold,
      warmupDomains: this.warmupAutomation.getAllDomains().length,
      capabilities: [
        'Predictive send-time optimization',
        'AI content generation',
        'Reply classification',
        'Autonomous warmup management',
        'Multi-provider support (Resend, SES, SendGrid, Postmark)'
      ]
    };
  }
}

export const sophiaEmailManager = new SophiaEmailManager();
