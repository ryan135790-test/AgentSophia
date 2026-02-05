export interface MessageTemplate {
  id: string;
  workspaceId: string;
  name: string;
  category: 'connection_note' | 'first_message' | 'follow_up' | 'inmail' | 'thank_you' | 'meeting_request';
  subject?: string;
  content: string;
  variables: string[];
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  avgAcceptanceRate: number | null;
  avgReplyRate: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceTemplate {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  steps: SequenceStep[];
  isPublic: boolean;
  createdBy: string;
  usageCount: number;
  avgConversionRate: number | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SequenceStep {
  id: string;
  order: number;
  actionType: 'profile_view' | 'connection_request' | 'message' | 'inmail' | 'post_like' | 'wait';
  delayDays: number;
  delayHours: number;
  templateId: string | null;
  customContent?: string;
  customSubject?: string;
  condition?: {
    type: 'if_connected' | 'if_not_connected' | 'if_replied' | 'if_not_replied' | 'if_opened';
    thenStepId: string;
    elseStepId: string;
  };
}

export interface TemplatePerformance {
  templateId: string;
  sent: number;
  accepted: number;
  replied: number;
  meetings: number;
  acceptanceRate: number;
  replyRate: number;
  meetingRate: number;
}

class LinkedInTemplateLibrary {
  private templates: Map<string, MessageTemplate> = new Map();
  private sequences: Map<string, SequenceTemplate> = new Map();
  private templatePerformance: Map<string, TemplatePerformance> = new Map();

  constructor() {
    this.loadDefaultTemplates();
  }

  private loadDefaultTemplates(): void {
    const defaultTemplates: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        workspaceId: 'system',
        name: 'Professional Introduction',
        category: 'connection_note',
        content: 'Hi {{firstName}}, I noticed we\'re both in the {{industry}} space. Would love to connect and exchange ideas on {{topic}}.',
        variables: ['firstName', 'industry', 'topic'],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgAcceptanceRate: 52,
        avgReplyRate: null,
        tags: ['professional', 'networking', 'industry-specific'],
      },
      {
        workspaceId: 'system',
        name: 'Mutual Connection',
        category: 'connection_note',
        content: 'Hi {{firstName}}, I see we\'re both connected with {{mutualConnection}}. I\'d love to add you to my network!',
        variables: ['firstName', 'mutualConnection'],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgAcceptanceRate: 68,
        avgReplyRate: null,
        tags: ['mutual-connection', 'warm-intro'],
      },
      {
        workspaceId: 'system',
        name: 'Compliment Their Work',
        category: 'connection_note',
        content: 'Hi {{firstName}}, really enjoyed your recent post about {{topic}}. Would love to connect and learn more about your approach at {{company}}.',
        variables: ['firstName', 'topic', 'company'],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgAcceptanceRate: 61,
        avgReplyRate: null,
        tags: ['compliment', 'engagement', 'content-based'],
      },
      {
        workspaceId: 'system',
        name: 'Value-First Opener',
        category: 'first_message',
        content: 'Hey {{firstName}}, thanks for connecting! I noticed {{company}} is in the {{industry}} space. I recently helped a similar company {{result}}. Would you be open to a quick chat about how you\'re handling {{challenge}}?',
        variables: ['firstName', 'company', 'industry', 'result', 'challenge'],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgAcceptanceRate: null,
        avgReplyRate: 18,
        tags: ['value-first', 'problem-solving', 'sales'],
      },
      {
        workspaceId: 'system',
        name: 'Quick Question Follow-Up',
        category: 'follow_up',
        content: 'Hey {{firstName}}, just wanted to bump this up. Quick question - is {{challenge}} something that\'s on your radar right now?',
        variables: ['firstName', 'challenge'],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgAcceptanceRate: null,
        avgReplyRate: 12,
        tags: ['follow-up', 'question', 'short'],
      },
      {
        workspaceId: 'system',
        name: 'Breakup Email',
        category: 'follow_up',
        content: 'Hi {{firstName}}, I\'ve reached out a few times without hearing back. I understand you\'re busy, so I\'ll close the loop here. If {{challenge}} ever becomes a priority, feel free to reach out. Best of luck with everything at {{company}}!',
        variables: ['firstName', 'challenge', 'company'],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgAcceptanceRate: null,
        avgReplyRate: 22,
        tags: ['breakup', 'final-follow-up', 'polite'],
      },
      {
        workspaceId: 'system',
        name: 'InMail - Cold Outreach',
        category: 'inmail',
        subject: 'Quick thought on {{company}}\'s {{topic}}',
        content: 'Hi {{firstName}},\n\nI came across {{company}} while researching {{industry}} leaders, and I was impressed by {{achievement}}.\n\nI help companies like yours {{value_prop}}. Would you be open to a brief 15-minute call to explore if there\'s a fit?\n\nBest,\n{{senderName}}',
        variables: ['firstName', 'company', 'industry', 'achievement', 'value_prop', 'senderName'],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgAcceptanceRate: null,
        avgReplyRate: 8,
        tags: ['inmail', 'cold-outreach', 'personalized'],
      },
      {
        workspaceId: 'system',
        name: 'Meeting Request',
        category: 'meeting_request',
        content: 'Hey {{firstName}}, based on our conversation, I think it would be valuable to hop on a quick call. Would {{proposedTime}} work for a 15-minute chat? Here\'s my calendar link: {{calendarLink}}',
        variables: ['firstName', 'proposedTime', 'calendarLink'],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgAcceptanceRate: null,
        avgReplyRate: 35,
        tags: ['meeting', 'calendar', 'cta'],
      },
    ];

    defaultTemplates.forEach(template => {
      const id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.templates.set(id, {
        ...template,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    const defaultSequences: Omit<SequenceTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        workspaceId: 'system',
        name: 'Standard Sales Outreach',
        description: 'Classic 4-step sequence: Connect → Wait → Value message → Follow-up',
        steps: [
          { id: 's1', order: 1, actionType: 'profile_view', delayDays: 0, delayHours: 0, templateId: null },
          { id: 's2', order: 2, actionType: 'connection_request', delayDays: 0, delayHours: 4, templateId: null },
          { id: 's3', order: 3, actionType: 'wait', delayDays: 1, delayHours: 0, templateId: null },
          { id: 's4', order: 4, actionType: 'message', delayDays: 0, delayHours: 0, templateId: null },
          { id: 's5', order: 5, actionType: 'wait', delayDays: 3, delayHours: 0, templateId: null },
          { id: 's6', order: 6, actionType: 'message', delayDays: 0, delayHours: 0, templateId: null },
        ],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgConversionRate: 4.2,
        tags: ['sales', 'standard', 'proven'],
      },
      {
        workspaceId: 'system',
        name: 'Warm Engagement First',
        description: 'Warm up with engagement before connecting: View → Like → View → Connect',
        steps: [
          { id: 's1', order: 1, actionType: 'profile_view', delayDays: 0, delayHours: 0, templateId: null },
          { id: 's2', order: 2, actionType: 'post_like', delayDays: 1, delayHours: 0, templateId: null },
          { id: 's3', order: 3, actionType: 'profile_view', delayDays: 2, delayHours: 0, templateId: null },
          { id: 's4', order: 4, actionType: 'connection_request', delayDays: 0, delayHours: 6, templateId: null },
          { id: 's5', order: 5, actionType: 'wait', delayDays: 1, delayHours: 0, templateId: null },
          { id: 's6', order: 6, actionType: 'message', delayDays: 0, delayHours: 0, templateId: null },
        ],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgConversionRate: 5.8,
        tags: ['warm', 'engagement', 'high-acceptance'],
      },
      {
        workspaceId: 'system',
        name: 'InMail Blast',
        description: 'Direct InMail approach for Sales Navigator users',
        steps: [
          { id: 's1', order: 1, actionType: 'profile_view', delayDays: 0, delayHours: 0, templateId: null },
          { id: 's2', order: 2, actionType: 'inmail', delayDays: 0, delayHours: 2, templateId: null },
          { id: 's3', order: 3, actionType: 'wait', delayDays: 5, delayHours: 0, templateId: null },
          { id: 's4', order: 4, actionType: 'inmail', delayDays: 0, delayHours: 0, templateId: null },
        ],
        isPublic: true,
        createdBy: 'system',
        usageCount: 0,
        avgConversionRate: 2.1,
        tags: ['inmail', 'sales-navigator', 'direct'],
      },
    ];

    defaultSequences.forEach(sequence => {
      const id = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.sequences.set(id, {
        ...sequence,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
  }

  createTemplate(template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'avgAcceptanceRate' | 'avgReplyRate'>): MessageTemplate {
    const id = `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTemplate: MessageTemplate = {
      ...template,
      id,
      usageCount: 0,
      avgAcceptanceRate: null,
      avgReplyRate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  updateTemplate(templateId: string, updates: Partial<MessageTemplate>): MessageTemplate | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    Object.assign(template, updates, { updatedAt: new Date() });
    return template;
  }

  deleteTemplate(templateId: string): boolean {
    return this.templates.delete(templateId);
  }

  getTemplate(templateId: string): MessageTemplate | null {
    return this.templates.get(templateId) || null;
  }

  getTemplates(workspaceId: string, filters?: {
    category?: MessageTemplate['category'];
    tags?: string[];
    search?: string;
  }): MessageTemplate[] {
    let results = Array.from(this.templates.values())
      .filter(t => t.workspaceId === workspaceId || t.isPublic);

    if (filters?.category) {
      results = results.filter(t => t.category === filters.category);
    }

    if (filters?.tags?.length) {
      results = results.filter(t => 
        filters.tags!.some(tag => t.tags.includes(tag))
      );
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(search) ||
        t.content.toLowerCase().includes(search)
      );
    }

    return results.sort((a, b) => b.usageCount - a.usageCount);
  }

  createSequence(sequence: Omit<SequenceTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'avgConversionRate'>): SequenceTemplate {
    const id = `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newSequence: SequenceTemplate = {
      ...sequence,
      id,
      usageCount: 0,
      avgConversionRate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sequences.set(id, newSequence);
    return newSequence;
  }

  getSequences(workspaceId: string): SequenceTemplate[] {
    return Array.from(this.sequences.values())
      .filter(s => s.workspaceId === workspaceId || s.isPublic)
      .sort((a, b) => b.usageCount - a.usageCount);
  }

  cloneTemplate(templateId: string, workspaceId: string, createdBy: string): MessageTemplate | null {
    const original = this.templates.get(templateId);
    if (!original) return null;

    return this.createTemplate({
      ...original,
      workspaceId,
      name: `${original.name} (Copy)`,
      isPublic: false,
      createdBy,
      tags: [...original.tags],
      variables: [...original.variables],
    });
  }

  cloneSequence(sequenceId: string, workspaceId: string, createdBy: string): SequenceTemplate | null {
    const original = this.sequences.get(sequenceId);
    if (!original) return null;

    return this.createSequence({
      ...original,
      workspaceId,
      name: `${original.name} (Copy)`,
      isPublic: false,
      createdBy,
      tags: [...original.tags],
      steps: original.steps.map(s => ({ ...s, id: `s_${Math.random().toString(36).substr(2, 9)}` })),
    });
  }

  recordTemplateUsage(templateId: string, outcome: 'sent' | 'accepted' | 'replied' | 'meeting'): void {
    const template = this.templates.get(templateId);
    if (!template) return;

    template.usageCount++;

    const performance = this.templatePerformance.get(templateId) || {
      templateId,
      sent: 0,
      accepted: 0,
      replied: 0,
      meetings: 0,
      acceptanceRate: 0,
      replyRate: 0,
      meetingRate: 0,
    };

    if (outcome === 'sent') performance.sent++;
    if (outcome === 'accepted') performance.accepted++;
    if (outcome === 'replied') performance.replied++;
    if (outcome === 'meeting') performance.meetings++;

    if (performance.sent > 0) {
      performance.acceptanceRate = (performance.accepted / performance.sent) * 100;
      performance.replyRate = (performance.replied / performance.sent) * 100;
      performance.meetingRate = (performance.meetings / performance.sent) * 100;

      if (template.category === 'connection_note') {
        template.avgAcceptanceRate = Math.round(performance.acceptanceRate * 10) / 10;
      } else {
        template.avgReplyRate = Math.round(performance.replyRate * 10) / 10;
      }
    }

    this.templatePerformance.set(templateId, performance);
  }

  getTopPerformingTemplates(workspaceId: string, category: MessageTemplate['category'], limit: number = 5): MessageTemplate[] {
    return this.getTemplates(workspaceId, { category })
      .filter(t => t.usageCount >= 10)
      .sort((a, b) => {
        const aRate = a.avgAcceptanceRate || a.avgReplyRate || 0;
        const bRate = b.avgAcceptanceRate || b.avgReplyRate || 0;
        return bRate - aRate;
      })
      .slice(0, limit);
  }

  parseVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  }

  renderTemplate(templateId: string, data: Record<string, string>): string | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    let rendered = template.content;
    
    for (const [key, value] of Object.entries(data)) {
      rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    
    return rendered;
  }
}

export const linkedInTemplateLibrary = new LinkedInTemplateLibrary();
