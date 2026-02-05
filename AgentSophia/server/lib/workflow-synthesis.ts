import { CAMPAIGN_TEMPLATES, type CampaignTemplate } from './campaign-templates';

export interface WorkflowBrief {
  goal: string;
  audience: string;
  channels: string[];
  cadence?: 'aggressive' | 'moderate' | 'gentle';
  stepCount?: number;
  includeLinkedInSearch?: boolean;
  searchCriteria?: {
    keywords?: string;
    jobTitle?: string;
    company?: string;
    location?: string;
    industry?: string;
    maxResults?: number;
  };
  brandVoice?: 'professional' | 'friendly' | 'direct' | 'casual' | 'consultative';
  offer?: string;
}

export interface SynthesizedWorkflow {
  id: string;
  name: string;
  description: string;
  channels: string[];
  steps: Array<{
    id: string;
    order: number;
    channel: string;
    delay: number;
    delayUnit: 'hours' | 'days';
    subject?: string;
    content: string;
    config?: Record<string, any>;
    conditions?: Array<{
      type: string;
      thenAction: string;
      switchTo?: string;
    }>;
  }>;
  metadata: {
    generatedBy: 'sophia';
    templateUsed?: string;
    brief: WorkflowBrief;
    estimatedDuration: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
}

const DELAY_PATTERNS = {
  aggressive: { min: 1, max: 2, unit: 'days' as const },
  moderate: { min: 2, max: 4, unit: 'days' as const },
  gentle: { min: 3, max: 7, unit: 'days' as const }
};

const CHANNEL_ORDER_PRIORITY: Record<string, number> = {
  linkedin_search: 0,
  linkedin_connect: 1,
  linkedin: 2,
  email: 3,
  sms: 4,
  phone: 5,
  voicemail: 6
};

function generateId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function findBestMatchingTemplate(brief: WorkflowBrief): CampaignTemplate | null {
  const briefChannels = new Set(brief.channels.map(c => c.toLowerCase()));
  
  let bestMatch: CampaignTemplate | null = null;
  let bestScore = 0;
  
  for (const template of CAMPAIGN_TEMPLATES) {
    let score = 0;
    
    const templateChannels = new Set(template.channels.map(c => c.toLowerCase()));
    const overlap = [...briefChannels].filter(c => templateChannels.has(c)).length;
    score += overlap * 10;
    
    if (brief.goal) {
      const goalLower = brief.goal.toLowerCase();
      if (goalLower.includes('cold') && template.category === 'cold_outreach') score += 15;
      if (goalLower.includes('nurture') && template.category === 'nurture') score += 15;
      if (goalLower.includes('event') && template.category === 'event') score += 15;
      if (goalLower.includes('launch') && template.category === 'product_launch') score += 15;
      if (goalLower.includes('win back') && template.category === 're_engagement') score += 15;
    }
    
    if (brief.stepCount) {
      const stepDiff = Math.abs(template.steps.length - brief.stepCount);
      score -= stepDiff * 2;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }
  
  return bestMatch;
}

function generateContentForStep(
  stepNumber: number,
  channel: string,
  brief: WorkflowBrief,
  isFirstContact: boolean,
  isLastStep: boolean
): { subject?: string; content: string } {
  const audience = brief.audience || 'prospects';
  const offer = brief.offer || 'our solution';
  const voice = brief.brandVoice || 'professional';
  
  const tones: Record<string, { greeting: string; closing: string; style: string }> = {
    professional: { greeting: 'Hi {{first_name}}', closing: 'Best regards,\n{{sender_name}}', style: 'formal' },
    friendly: { greeting: 'Hey {{first_name}}!', closing: 'Cheers,\n{{sender_name}}', style: 'warm' },
    direct: { greeting: '{{first_name}}', closing: '{{sender_name}}', style: 'concise' },
    casual: { greeting: 'Hi {{first_name}}!', closing: 'Talk soon,\n{{sender_name}}', style: 'relaxed' },
    consultative: { greeting: 'Hi {{first_name}}', closing: 'Looking forward to your thoughts,\n{{sender_name}}', style: 'advisory' }
  };
  
  const tone = tones[voice] || tones.professional;
  
  if (channel === 'linkedin_search') {
    return {
      content: `Searching for ${audience} matching criteria`
    };
  }
  
  if (channel === 'linkedin_connect') {
    return {
      content: `${tone.greeting}, I noticed your work at {{company}} in {{industry}}. Would love to connect and share insights about ${offer}. Looking forward to connecting!`
    };
  }
  
  if (channel === 'linkedin' || channel === 'linkedin_message') {
    if (isFirstContact) {
      return {
        content: `${tone.greeting}, I came across your profile and was impressed by what you're building at {{company}}. I work with ${audience} on ${offer} - thought you might find some of our insights valuable. Would love to chat!`
      };
    }
    return {
      content: `${tone.greeting}, following up on my previous message. I have some specific ideas for {{company}} around ${offer}. Worth a quick chat this week?`
    };
  }
  
  if (channel === 'email') {
    if (isFirstContact) {
      return {
        subject: `Quick question about {{company}}`,
        content: `${tone.greeting},

I noticed {{company}} is making waves in {{industry}}. Companies like yours often face challenges with [pain point].

We've been helping ${audience} with ${offer}, achieving [specific results].

Would you be open to a quick 15-minute chat to explore if this might be valuable for {{company}}?

${tone.closing}`
      };
    }
    
    if (isLastStep) {
      return {
        subject: `Closing the loop - {{first_name}}`,
        content: `${tone.greeting},

I've reached out a few times about ${offer}. I understand timing might not be right.

If things change in the future, I'm always happy to connect. Wishing you continued success!

${tone.closing}`
      };
    }
    
    return {
      subject: `Re: Quick question about {{company}}`,
      content: `${tone.greeting},

Following up on my previous email. I wanted to share that [similar company] achieved [result] with ${offer}.

Would a brief call work for you this week?

${tone.closing}`
    };
  }
  
  if (channel === 'sms') {
    return {
      content: `Hi {{first_name}}, quick follow-up about ${offer} for {{company}}. Worth a 5-min call? Reply YES or STOP to opt out. - {{sender_name}}`
    };
  }
  
  if (channel === 'phone') {
    return {
      content: `Call script: "Hi {{first_name}}, this is {{sender_name}}. I've been reaching out about ${offer} for {{company}}. Do you have 2 minutes to chat?"`
    };
  }
  
  return {
    content: `${tone.greeting}, reaching out about ${offer}. Would love to connect. ${tone.closing}`
  };
}

export function synthesizeWorkflow(brief: WorkflowBrief): SynthesizedWorkflow {
  const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const matchingTemplate = findBestMatchingTemplate(brief);
  
  let channels = [...brief.channels];
  if (brief.includeLinkedInSearch) {
    channels = ['linkedin_search', ...channels.filter(c => c !== 'linkedin_search')];
  }
  
  channels.sort((a, b) => 
    (CHANNEL_ORDER_PRIORITY[a] ?? 99) - (CHANNEL_ORDER_PRIORITY[b] ?? 99)
  );
  
  const steps: SynthesizedWorkflow['steps'] = [];
  const cadence = brief.cadence || 'moderate';
  const delayPattern = DELAY_PATTERNS[cadence];
  const targetStepCount = brief.stepCount || 4;
  
  let stepOrder = 1;
  
  if (brief.includeLinkedInSearch && brief.searchCriteria) {
    steps.push({
      id: generateId(),
      order: stepOrder++,
      channel: 'linkedin_search',
      delay: 0,
      delayUnit: 'days',
      content: `Searching for leads matching criteria`,
      config: {
        searchConfig: {
          keywords: brief.searchCriteria.keywords || '',
          jobTitle: brief.searchCriteria.jobTitle || '',
          company: brief.searchCriteria.company || '',
          location: brief.searchCriteria.location || '',
          industry: brief.searchCriteria.industry || '',
          maxResults: brief.searchCriteria.maxResults || 50
        }
      }
    });
  }
  
  const outreachChannels = channels.filter(c => c !== 'linkedin_search');
  const stepsPerChannel = Math.max(1, Math.floor((targetStepCount - (brief.includeLinkedInSearch ? 1 : 0)) / outreachChannels.length));
  
  for (const channel of outreachChannels) {
    for (let i = 0; i < stepsPerChannel && steps.length < targetStepCount; i++) {
      const isFirstContact = steps.filter(s => s.channel !== 'linkedin_search').length === 0;
      const isLastStep = steps.length === targetStepCount - 1;
      
      const { subject, content } = generateContentForStep(
        stepOrder,
        channel,
        brief,
        isFirstContact,
        isLastStep
      );
      
      const delay = stepOrder === 1 ? 0 : 
        delayPattern.min + Math.floor(Math.random() * (delayPattern.max - delayPattern.min + 1));
      
      const step: SynthesizedWorkflow['steps'][0] = {
        id: generateId(),
        order: stepOrder++,
        channel,
        delay,
        delayUnit: delayPattern.unit,
        content
      };
      
      if (subject) {
        step.subject = subject;
      }
      
      if (stepOrder > 2) {
        step.conditions = [
          { type: 'if_replied', thenAction: 'end' }
        ];
      }
      
      steps.push(step);
    }
  }
  
  const totalDays = steps.reduce((sum, s) => sum + (s.delayUnit === 'days' ? s.delay : s.delay / 24), 0);
  const estimatedDuration = `${Math.ceil(totalDays)} days`;
  
  const difficulty = steps.length <= 3 ? 'beginner' : 
    steps.length <= 6 ? 'intermediate' : 'advanced';
  
  return {
    id: workflowId,
    name: `${brief.goal || 'Outreach Campaign'} - ${new Date().toLocaleDateString()}`,
    description: `AI-generated campaign targeting ${brief.audience || 'prospects'} via ${channels.join(', ')}`,
    channels,
    steps,
    metadata: {
      generatedBy: 'sophia',
      templateUsed: matchingTemplate?.id,
      brief,
      estimatedDuration,
      difficulty
    }
  };
}

export function synthesizeFromTemplate(templateId: string, customizations?: Partial<WorkflowBrief>): SynthesizedWorkflow | null {
  const template = CAMPAIGN_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;
  
  const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const steps = template.steps.map((step, index) => ({
    id: generateId(),
    order: step.order || index + 1,
    channel: step.channel,
    delay: step.delay,
    delayUnit: step.delayUnit,
    subject: step.subject,
    content: step.content,
    conditions: step.conditions
  }));
  
  if (customizations?.includeLinkedInSearch && customizations.searchCriteria) {
    steps.unshift({
      id: generateId(),
      order: 0,
      channel: 'linkedin_search',
      delay: 0,
      delayUnit: 'days',
      content: 'Searching for leads matching criteria',
      config: {
        searchConfig: customizations.searchCriteria
      }
    } as any);
    
    steps.forEach((step, idx) => {
      step.order = idx + 1;
    });
  }
  
  return {
    id: workflowId,
    name: template.name,
    description: template.description,
    channels: [...(customizations?.includeLinkedInSearch ? ['linkedin_search'] : []), ...template.channels],
    steps,
    metadata: {
      generatedBy: 'sophia',
      templateUsed: templateId,
      brief: {
        goal: template.description,
        audience: customizations?.audience || 'prospects',
        channels: template.channels,
        ...customizations
      },
      estimatedDuration: template.estimatedDuration,
      difficulty: template.difficulty
    }
  };
}

export function parseIntentToWorkflowBrief(userMessage: string, context?: any): WorkflowBrief | null {
  const lower = userMessage.toLowerCase();
  
  const hasWorkflowIntent = 
    lower.includes('campaign') ||
    lower.includes('outreach') ||
    lower.includes('sequence') ||
    lower.includes('workflow') ||
    lower.includes('reach out') ||
    lower.includes('send') ||
    lower.includes('create a') ||
    lower.includes('build a') ||
    lower.includes('generate') ||
    lower.includes('make a');
  
  if (!hasWorkflowIntent) return null;
  
  const channels: string[] = [];
  if (lower.includes('email')) channels.push('email');
  if (lower.includes('linkedin')) channels.push('linkedin');
  if (lower.includes('connect') || lower.includes('connection request')) channels.push('linkedin_connect');
  if (lower.includes('sms') || lower.includes('text message')) channels.push('sms');
  if (lower.includes('phone') || lower.includes('call')) channels.push('phone');
  
  if (channels.length === 0) {
    channels.push('email');
  }
  
  const includeLinkedInSearch = 
    lower.includes('find leads') ||
    lower.includes('search linkedin') ||
    lower.includes('linkedin search') ||
    lower.includes('discover') ||
    lower.includes('scrape') ||
    lower.includes('find prospects') ||
    lower.includes('generate leads');
  
  let cadence: WorkflowBrief['cadence'] = 'moderate';
  if (lower.includes('aggressive') || lower.includes('fast') || lower.includes('quick')) {
    cadence = 'aggressive';
  } else if (lower.includes('gentle') || lower.includes('slow') || lower.includes('soft')) {
    cadence = 'gentle';
  }
  
  let stepCount: number | undefined;
  const stepMatch = lower.match(/(\d+)\s*(?:step|touch|email|message)/);
  if (stepMatch) {
    stepCount = Math.min(10, Math.max(2, parseInt(stepMatch[1])));
  }
  
  let brandVoice: WorkflowBrief['brandVoice'] = 'professional';
  if (lower.includes('friendly') || lower.includes('warm')) brandVoice = 'friendly';
  if (lower.includes('direct') || lower.includes('bold')) brandVoice = 'direct';
  if (lower.includes('casual') || lower.includes('relaxed')) brandVoice = 'casual';
  
  let audience = '';
  const audienceMatch = lower.match(/(?:for|to|targeting|reach)\s+([^,.]+?)(?:\s+(?:about|with|via|using)|$)/i);
  if (audienceMatch) {
    audience = audienceMatch[1].trim();
  }
  
  let goal = 'Cold outreach campaign';
  if (lower.includes('nurture')) goal = 'Lead nurture campaign';
  if (lower.includes('event') || lower.includes('webinar')) goal = 'Event promotion campaign';
  if (lower.includes('launch') || lower.includes('announcement')) goal = 'Product launch campaign';
  if (lower.includes('re-engage') || lower.includes('win back')) goal = 'Re-engagement campaign';
  
  let searchCriteria: WorkflowBrief['searchCriteria'] | undefined;
  if (includeLinkedInSearch) {
    searchCriteria = {
      maxResults: 50
    };
    
    const titleMatch = lower.match(/(?:cto|ceo|cmo|vp|director|manager|founder|engineer)/gi);
    if (titleMatch) {
      searchCriteria.jobTitle = titleMatch[0];
    }
    
    const locationMatch = lower.match(/(?:in|from|based in)\s+([A-Za-z\s]+?)(?:\s+(?:who|that|and|,)|$)/i);
    if (locationMatch) {
      searchCriteria.location = locationMatch[1].trim();
    }
  }
  
  return {
    goal,
    audience,
    channels,
    cadence,
    stepCount,
    includeLinkedInSearch,
    searchCriteria,
    brandVoice
  };
}

export const LINKEDIN_SEARCH_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'icp-linkedin-discovery',
    name: 'ICP LinkedIn Discovery + Outreach',
    description: 'Find your ideal customers on LinkedIn using AI-powered search, then automatically connect and engage with personalized messaging.',
    category: 'cold_outreach',
    channels: ['linkedin_search', 'linkedin_connect', 'linkedin', 'email'],
    estimatedDuration: '14 days',
    difficulty: 'intermediate',
    expectedMetrics: {
      openRate: 'N/A',
      replyRate: '20-35%',
      conversionRate: '8-15%'
    },
    steps: [
      {
        order: 1,
        channel: 'linkedin_search',
        delay: 0,
        delayUnit: 'days',
        content: 'AI-powered LinkedIn search to find your ideal prospects'
      },
      {
        order: 2,
        channel: 'linkedin_connect',
        delay: 0,
        delayUnit: 'days',
        content: `Hi {{first_name}}, I noticed your impressive work at {{company}}. Would love to connect and share some insights relevant to {{industry}}!`
      },
      {
        order: 3,
        channel: 'linkedin',
        delay: 1,
        delayUnit: 'days',
        content: `Thanks for connecting, {{first_name}}! I've been working with companies like {{company}} on [specific challenge]. Curious what your biggest priority is right now?`,
        conditions: [{ type: 'if_replied', thenAction: 'end' }]
      },
      {
        order: 4,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'Quick thought for {{company}}',
        content: `Hi {{first_name}},

We connected on LinkedIn recently - wanted to follow up with something more detailed.

I've helped [similar companies] achieve [specific result]. Given what I saw about {{company}}, I think there's an opportunity here.

Would a quick 15-minute call be useful?

Best,
{{sender_name}}`,
        conditions: [{ type: 'if_replied', thenAction: 'end' }]
      }
    ],
    tags: ['linkedin search', 'icp', 'discovery', 'multichannel', 'sophia-powered'],
    sophiaRecommendation: 'I\'ll find your ideal customers using our AI search and warm them up before your first message.'
  },
  {
    id: 'event-attendee-outreach',
    name: 'Event Follow-Up Campaign',
    description: 'Post-event outreach sequence to convert event attendees into qualified leads. Perfect for conference follow-ups.',
    category: 'event',
    channels: ['email', 'linkedin'],
    estimatedDuration: '10 days',
    difficulty: 'beginner',
    expectedMetrics: {
      openRate: '50-65%',
      replyRate: '15-25%',
      conversionRate: '10-20%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: 'Great meeting you at [Event Name]!',
        content: `Hi {{first_name}},

It was great connecting at [Event Name]! I enjoyed our conversation about [topic discussed].

As promised, here's the [resource/link/info] I mentioned.

Would love to continue our conversation - how does a quick call next week look?

Best,
{{sender_name}}`
      },
      {
        order: 2,
        channel: 'linkedin',
        delay: 1,
        delayUnit: 'days',
        content: `Hi {{first_name}}! Great meeting you at [Event Name]. I just sent you a follow-up email - let's stay connected here too!`,
        conditions: [{ type: 'if_replied', thenAction: 'end' }]
      },
      {
        order: 3,
        channel: 'email',
        delay: 4,
        delayUnit: 'days',
        subject: 'Re: Great meeting you at [Event Name]',
        content: `Hi {{first_name}},

Quick follow-up from my previous email. I've been thinking about what you mentioned about {{company}} and [challenge].

I have some ideas that might help - worth a 15-minute chat?

{{sender_name}}`,
        conditions: [{ type: 'if_replied', thenAction: 'end' }]
      }
    ],
    tags: ['event', 'follow-up', 'conference', 'networking'],
    sophiaRecommendation: 'Send the first email within 24 hours of the event for best results. I can personalize each message based on your notes.'
  },
  {
    id: 'product-launch-nurture',
    name: 'Product Launch Nurture Sequence',
    description: 'Multi-touch campaign to build excitement and convert interest around a new product or feature launch.',
    category: 'product_launch',
    channels: ['email', 'linkedin', 'sms'],
    estimatedDuration: '14 days',
    difficulty: 'advanced',
    expectedMetrics: {
      openRate: '45-60%',
      replyRate: '12-20%',
      conversionRate: '8-15%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: 'Something exciting is coming...',
        content: `Hi {{first_name}},

We've been working on something special that I think you'll love.

On [Launch Date], we're unveiling [Product Name] - designed specifically for [target audience] like you.

Stay tuned for the full reveal. In the meantime, I'd love to hear: what's your biggest challenge with [problem area]?

{{sender_name}}`
      },
      {
        order: 2,
        channel: 'linkedin',
        delay: 3,
        delayUnit: 'days',
        content: `Hi {{first_name}}! Big things coming for {{company}} and teams like yours. Keep an eye on your inbox - you won't want to miss this!`
      },
      {
        order: 3,
        channel: 'email',
        delay: 4,
        delayUnit: 'days',
        subject: 'It\'s here: Introducing [Product Name]',
        content: `Hi {{first_name}},

The wait is over! [Product Name] is officially live.

**What's new:**
- [Feature 1]: [Benefit]
- [Feature 2]: [Benefit]  
- [Feature 3]: [Benefit]

**Special launch offer:** [Early adopter incentive]

[Try it now →]

Questions? Just reply to this email.

{{sender_name}}`,
        conditions: [{ type: 'if_clicked', thenAction: 'end' }]
      },
      {
        order: 4,
        channel: 'sms',
        delay: 2,
        delayUnit: 'days',
        content: `Hey {{first_name}}! Did you see [Product Name] is live? Early access ends [Date]. Check your email for details! - {{sender_name}}`
      },
      {
        order: 5,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'What others are saying about [Product Name]',
        content: `Hi {{first_name}},

Since launching [Product Name], here's what early users are saying:

"[Testimonial 1]" - [Customer Name]
"[Testimonial 2]" - [Customer Name]

The launch offer ends [Date]. Don't miss out!

[Get started →]

{{sender_name}}`
      }
    ],
    tags: ['product launch', 'nurture', 'multi-channel', 'teaser'],
    sophiaRecommendation: 'Build anticipation with teasers before the launch. I can A/B test subject lines to maximize open rates.'
  }
];
