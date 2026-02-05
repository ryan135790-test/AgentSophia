import nodemailer from 'nodemailer';

export interface BulkEmailRecipient {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  customFields?: Record<string, string>;
}

export interface BulkEmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  mergeFields: string[];
}

export interface BulkEmailCampaign {
  id: string;
  workspaceId: string;
  name: string;
  status: 'draft' | 'validating' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed';
  template: BulkEmailTemplate;
  recipients: BulkEmailRecipient[];
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  settings: BulkEmailSettings;
  stats: BulkEmailStats;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkEmailSettings {
  batchSize: number;
  delayBetweenBatches: number;
  maxPerHour: number;
  trackOpens: boolean;
  trackClicks: boolean;
  enableUnsubscribe: boolean;
  abTestEnabled: boolean;
  abTestVariants?: BulkEmailTemplate[];
  warmupMode: boolean;
  warmupDay: number;
}

export interface BulkEmailStats {
  totalRecipients: number;
  validated: number;
  invalid: number;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  replied: number;
  unsubscribed: number;
  complained: number;
  failed: number;
  pending: number;
}

export interface EmailValidationResult {
  email: string;
  isValid: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
  isCatchAll: boolean;
  isDisposable: boolean;
  isFreeEmail: boolean;
}

export interface SendResult {
  recipientId: string;
  email: string;
  status: 'sent' | 'failed' | 'bounced' | 'skipped';
  messageId?: string;
  error?: string;
  sentAt: Date;
}

const WARMUP_LIMITS = {
  1: { perHour: 20, perDay: 50 },
  2: { perHour: 30, perDay: 100 },
  3: { perHour: 50, perDay: 200 },
  4: { perHour: 75, perDay: 350 },
  5: { perHour: 100, perDay: 500 },
  6: { perHour: 150, perDay: 750 },
  7: { perHour: 200, perDay: 1000 },
  completed: { perHour: 500, perDay: 5000 }
};

const DISPOSABLE_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
  'throwaway.email', 'fakeinbox.com', 'yopmail.com', 'temp-mail.org'
];

const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com'
];

class BulkEmailEngine {
  private campaigns: Map<string, BulkEmailCampaign> = new Map();
  private sendResults: Map<string, SendResult[]> = new Map();
  private unsubscribedEmails: Set<string> = new Set();
  private bouncedEmails: Set<string> = new Set();
  private complainedEmails: Set<string> = new Set();
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER || '',
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN || ''
        }
      });
    }
  }

  validateEmail(email: string): EmailValidationResult {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const domain = email.split('@')[1]?.toLowerCase() || '';
    
    if (!emailRegex.test(email)) {
      return {
        email,
        isValid: false,
        reason: 'Invalid email format',
        riskLevel: 'high',
        isCatchAll: false,
        isDisposable: false,
        isFreeEmail: false
      };
    }

    if (this.unsubscribedEmails.has(email.toLowerCase())) {
      return {
        email,
        isValid: false,
        reason: 'Previously unsubscribed',
        riskLevel: 'high',
        isCatchAll: false,
        isDisposable: false,
        isFreeEmail: false
      };
    }

    if (this.bouncedEmails.has(email.toLowerCase())) {
      return {
        email,
        isValid: false,
        reason: 'Previously bounced',
        riskLevel: 'high',
        isCatchAll: false,
        isDisposable: false,
        isFreeEmail: false
      };
    }

    if (this.complainedEmails.has(email.toLowerCase())) {
      return {
        email,
        isValid: false,
        reason: 'Previous spam complaint',
        riskLevel: 'high',
        isCatchAll: false,
        isDisposable: false,
        isFreeEmail: false
      };
    }

    const isDisposable = DISPOSABLE_DOMAINS.some(d => domain.includes(d));
    if (isDisposable) {
      return {
        email,
        isValid: false,
        reason: 'Disposable email address',
        riskLevel: 'high',
        isCatchAll: false,
        isDisposable: true,
        isFreeEmail: false
      };
    }

    const isFreeEmail = FREE_EMAIL_DOMAINS.includes(domain);
    
    return {
      email,
      isValid: true,
      riskLevel: isFreeEmail ? 'medium' : 'low',
      isCatchAll: false,
      isDisposable: false,
      isFreeEmail
    };
  }

  validateRecipients(recipients: BulkEmailRecipient[]): {
    valid: BulkEmailRecipient[];
    invalid: Array<{ recipient: BulkEmailRecipient; reason: string }>;
    stats: { total: number; valid: number; invalid: number; duplicates: number };
  } {
    const seen = new Set<string>();
    const valid: BulkEmailRecipient[] = [];
    const invalid: Array<{ recipient: BulkEmailRecipient; reason: string }> = [];
    let duplicates = 0;

    for (const recipient of recipients) {
      const email = recipient.email.toLowerCase().trim();
      
      if (seen.has(email)) {
        duplicates++;
        continue;
      }
      seen.add(email);

      const validation = this.validateEmail(email);
      if (validation.isValid) {
        valid.push({ ...recipient, email });
      } else {
        invalid.push({ recipient: { ...recipient, email }, reason: validation.reason || 'Invalid' });
      }
    }

    return {
      valid,
      invalid,
      stats: {
        total: recipients.length,
        valid: valid.length,
        invalid: invalid.length,
        duplicates
      }
    };
  }

  personalize(template: string, recipient: BulkEmailRecipient): string {
    let result = template;
    
    result = result.replace(/\{\{firstName\}\}/g, recipient.firstName || 'there');
    result = result.replace(/\{\{lastName\}\}/g, recipient.lastName || '');
    result = result.replace(/\{\{fullName\}\}/g, 
      `${recipient.firstName || ''} ${recipient.lastName || ''}`.trim() || 'there');
    result = result.replace(/\{\{company\}\}/g, recipient.company || 'your company');
    result = result.replace(/\{\{email\}\}/g, recipient.email);

    if (recipient.customFields) {
      for (const [key, value] of Object.entries(recipient.customFields)) {
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
      }
    }

    return result;
  }

  extractMergeFields(template: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const fields: string[] = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      if (!fields.includes(match[1])) {
        fields.push(match[1]);
      }
    }
    return fields;
  }

  createCampaign(
    workspaceId: string,
    name: string,
    template: Omit<BulkEmailTemplate, 'id' | 'mergeFields'>,
    recipients: BulkEmailRecipient[],
    fromEmail: string,
    fromName: string,
    settings: Partial<BulkEmailSettings> = {}
  ): BulkEmailCampaign {
    const campaignId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const templateId = `tpl_${Date.now()}`;
    
    const fullTemplate: BulkEmailTemplate = {
      ...template,
      id: templateId,
      mergeFields: [
        ...this.extractMergeFields(template.subject),
        ...this.extractMergeFields(template.htmlBody)
      ]
    };

    const validation = this.validateRecipients(recipients);

    const campaign: BulkEmailCampaign = {
      id: campaignId,
      workspaceId,
      name,
      status: 'draft',
      template: fullTemplate,
      recipients: validation.valid,
      fromEmail,
      fromName,
      settings: {
        batchSize: settings.batchSize || 50,
        delayBetweenBatches: settings.delayBetweenBatches || 5000,
        maxPerHour: settings.maxPerHour || 200,
        trackOpens: settings.trackOpens ?? true,
        trackClicks: settings.trackClicks ?? true,
        enableUnsubscribe: settings.enableUnsubscribe ?? true,
        abTestEnabled: settings.abTestEnabled || false,
        warmupMode: settings.warmupMode || false,
        warmupDay: settings.warmupDay || 7
      },
      stats: {
        totalRecipients: validation.valid.length,
        validated: validation.valid.length,
        invalid: validation.invalid.length,
        sent: 0,
        delivered: 0,
        bounced: 0,
        opened: 0,
        clicked: 0,
        replied: 0,
        unsubscribed: 0,
        complained: 0,
        failed: 0,
        pending: validation.valid.length
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.campaigns.set(campaignId, campaign);
    this.sendResults.set(campaignId, []);

    return campaign;
  }

  getCurrentLimits(settings: BulkEmailSettings): { perHour: number; perDay: number } {
    if (!settings.warmupMode) {
      return WARMUP_LIMITS.completed;
    }
    
    const day = Math.min(settings.warmupDay, 7) as keyof typeof WARMUP_LIMITS;
    return WARMUP_LIMITS[day] || WARMUP_LIMITS.completed;
  }

  async sendBatch(
    campaign: BulkEmailCampaign,
    batchRecipients: BulkEmailRecipient[]
  ): Promise<SendResult[]> {
    const results: SendResult[] = [];

    for (const recipient of batchRecipients) {
      try {
        const personalizedSubject = this.personalize(campaign.template.subject, recipient);
        let personalizedBody = this.personalize(campaign.template.htmlBody, recipient);

        if (campaign.settings.enableUnsubscribe) {
          const unsubscribeLink = `https://app.sophialeads.com/unsubscribe?email=${encodeURIComponent(recipient.email)}&campaign=${campaign.id}`;
          personalizedBody += `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
              <p>You received this email because you're on our contact list.</p>
              <p><a href="${unsubscribeLink}" style="color: #0066cc;">Unsubscribe</a> from future emails</p>
            </div>
          `;
        }

        if (campaign.settings.trackOpens) {
          const trackingPixel = `<img src="https://track.sophialeads.com/open/${campaign.id}/${recipient.id}" width="1" height="1" style="display:none" />`;
          personalizedBody += trackingPixel;
        }

        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        results.push({
          recipientId: recipient.id,
          email: recipient.email,
          status: 'sent',
          messageId,
          sentAt: new Date()
        });

        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      } catch (error: any) {
        results.push({
          recipientId: recipient.id,
          email: recipient.email,
          status: 'failed',
          error: error.message,
          sentAt: new Date()
        });
      }
    }

    return results;
  }

  async startCampaign(campaignId: string): Promise<{
    success: boolean;
    message: string;
    estimatedCompletionTime?: Date;
  }> {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return { success: false, message: 'Campaign not found' };
    }

    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      return { success: false, message: `Cannot start campaign in ${campaign.status} status` };
    }

    campaign.status = 'sending';
    campaign.startedAt = new Date();
    campaign.updatedAt = new Date();

    const limits = this.getCurrentLimits(campaign.settings);
    const totalBatches = Math.ceil(campaign.recipients.length / campaign.settings.batchSize);
    const estimatedMinutes = (totalBatches * campaign.settings.delayBetweenBatches) / 60000;
    const estimatedCompletionTime = new Date(Date.now() + estimatedMinutes * 60 * 1000);

    this.processCampaignAsync(campaign);

    return {
      success: true,
      message: `Campaign started. Sending to ${campaign.recipients.length} recipients in ${totalBatches} batches.`,
      estimatedCompletionTime
    };
  }

  private async processCampaignAsync(campaign: BulkEmailCampaign) {
    const { batchSize, delayBetweenBatches } = campaign.settings;
    const recipients = campaign.recipients.filter(r => {
      const existing = this.sendResults.get(campaign.id)?.find(s => s.recipientId === r.id);
      return !existing || existing.status === 'failed';
    });

    for (let i = 0; i < recipients.length; i += batchSize) {
      if (campaign.status === 'paused') break;

      const batch = recipients.slice(i, i + batchSize);
      const results = await this.sendBatch(campaign, batch);
      
      const existingResults = this.sendResults.get(campaign.id) || [];
      this.sendResults.set(campaign.id, [...existingResults, ...results]);

      campaign.stats.sent += results.filter(r => r.status === 'sent').length;
      campaign.stats.failed += results.filter(r => r.status === 'failed').length;
      campaign.stats.pending = campaign.stats.totalRecipients - campaign.stats.sent - campaign.stats.failed;
      campaign.updatedAt = new Date();

      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    if (campaign.status === 'sending') {
      campaign.status = 'completed';
      campaign.completedAt = new Date();
      campaign.updatedAt = new Date();
    }
  }

  pauseCampaign(campaignId: string): { success: boolean; message: string } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return { success: false, message: 'Campaign not found' };
    }

    if (campaign.status !== 'sending') {
      return { success: false, message: 'Campaign is not currently sending' };
    }

    campaign.status = 'paused';
    campaign.updatedAt = new Date();
    return { success: true, message: 'Campaign paused' };
  }

  getCampaign(campaignId: string): BulkEmailCampaign | undefined {
    return this.campaigns.get(campaignId);
  }

  getCampaignProgress(campaignId: string): {
    campaign: BulkEmailCampaign | undefined;
    results: SendResult[];
    progress: number;
    eta?: Date;
  } {
    const campaign = this.campaigns.get(campaignId);
    const results = this.sendResults.get(campaignId) || [];
    
    if (!campaign) {
      return { campaign: undefined, results: [], progress: 0 };
    }

    const progress = campaign.stats.totalRecipients > 0
      ? Math.round((campaign.stats.sent + campaign.stats.failed) / campaign.stats.totalRecipients * 100)
      : 0;

    let eta: Date | undefined;
    if (campaign.status === 'sending' && campaign.stats.sent > 0) {
      const elapsed = Date.now() - (campaign.startedAt?.getTime() || Date.now());
      const rate = campaign.stats.sent / elapsed;
      const remaining = campaign.stats.pending;
      eta = new Date(Date.now() + remaining / rate);
    }

    return { campaign, results, progress, eta };
  }

  getWorkspaceCampaigns(workspaceId: string): BulkEmailCampaign[] {
    return Array.from(this.campaigns.values())
      .filter(c => c.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  recordBounce(email: string, campaignId?: string) {
    this.bouncedEmails.add(email.toLowerCase());
    if (campaignId) {
      const campaign = this.campaigns.get(campaignId);
      if (campaign) {
        campaign.stats.bounced++;
        campaign.stats.delivered = campaign.stats.sent - campaign.stats.bounced;
        campaign.updatedAt = new Date();
      }
    }
  }

  recordUnsubscribe(email: string, campaignId?: string) {
    this.unsubscribedEmails.add(email.toLowerCase());
    if (campaignId) {
      const campaign = this.campaigns.get(campaignId);
      if (campaign) {
        campaign.stats.unsubscribed++;
        campaign.updatedAt = new Date();
      }
    }
  }

  recordOpen(campaignId: string, recipientId: string) {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      campaign.stats.opened++;
      campaign.updatedAt = new Date();
    }
  }

  recordClick(campaignId: string, recipientId: string) {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      campaign.stats.clicked++;
      campaign.updatedAt = new Date();
    }
  }

  recordReply(campaignId: string, recipientId: string) {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      campaign.stats.replied++;
      campaign.updatedAt = new Date();
    }
  }

  recordComplaint(email: string, campaignId?: string) {
    this.complainedEmails.add(email.toLowerCase());
    if (campaignId) {
      const campaign = this.campaigns.get(campaignId);
      if (campaign) {
        campaign.stats.complained++;
        campaign.updatedAt = new Date();
      }
    }
  }

  getDeliverabilityHealth(workspaceId: string): {
    overallScore: number;
    bounceRate: number;
    complaintRate: number;
    unsubscribeRate: number;
    recommendations: string[];
  } {
    const campaigns = this.getWorkspaceCampaigns(workspaceId);
    
    let totalSent = 0;
    let totalBounced = 0;
    let totalComplaints = 0;
    let totalUnsubscribes = 0;

    for (const campaign of campaigns) {
      totalSent += campaign.stats.sent;
      totalBounced += campaign.stats.bounced;
      totalComplaints += campaign.stats.complained;
      totalUnsubscribes += campaign.stats.unsubscribed;
    }

    const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
    const complaintRate = totalSent > 0 ? (totalComplaints / totalSent) * 100 : 0;
    const unsubscribeRate = totalSent > 0 ? (totalUnsubscribes / totalSent) * 100 : 0;

    let score = 100;
    const recommendations: string[] = [];

    if (bounceRate > 2) {
      score -= (bounceRate - 2) * 10;
      recommendations.push('High bounce rate detected. Clean your email list and validate addresses before sending.');
    }
    if (complaintRate > 0.1) {
      score -= complaintRate * 100;
      recommendations.push('Spam complaints above threshold. Review your targeting and email content.');
    }
    if (unsubscribeRate > 1) {
      score -= (unsubscribeRate - 1) * 5;
      recommendations.push('High unsubscribe rate. Consider segmenting your audience better.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Your email deliverability health is excellent. Keep up the good work!');
    }

    return {
      overallScore: Math.max(0, Math.min(100, Math.round(score))),
      bounceRate: Math.round(bounceRate * 100) / 100,
      complaintRate: Math.round(complaintRate * 1000) / 1000,
      unsubscribeRate: Math.round(unsubscribeRate * 100) / 100,
      recommendations
    };
  }

  scheduleCampaign(campaignId: string, scheduledAt: Date): { success: boolean; message: string } {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return { success: false, message: 'Campaign not found' };
    }

    if (campaign.status !== 'draft') {
      return { success: false, message: 'Only draft campaigns can be scheduled' };
    }

    campaign.status = 'scheduled';
    campaign.scheduledAt = scheduledAt;
    campaign.updatedAt = new Date();

    const delay = scheduledAt.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(() => {
        const c = this.campaigns.get(campaignId);
        if (c && c.status === 'scheduled') {
          this.startCampaign(campaignId);
        }
      }, delay);
    }

    return { success: true, message: `Campaign scheduled for ${scheduledAt.toISOString()}` };
  }
}

export const bulkEmailEngine = new BulkEmailEngine();
