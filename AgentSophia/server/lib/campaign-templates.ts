export interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: 'cold_outreach' | 'nurture' | 're_engagement' | 'event' | 'product_launch';
  channels: string[];
  estimatedDuration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  expectedMetrics: {
    openRate: string;
    replyRate: string;
    conversionRate: string;
  };
  steps: Array<{
    order: number;
    channel: string;
    delay: number;
    delayUnit: 'hours' | 'days';
    subject?: string;
    content: string;
    conditions?: Array<{
      type: 'if_opened' | 'if_clicked' | 'if_replied' | 'if_not_opened' | 'if_not_replied';
      thenAction: 'continue' | 'skip' | 'switch_channel' | 'end';
      switchTo?: string;
    }>;
  }>;
  tags: string[];
  sophiaRecommendation?: string;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'cold-outreach-basic',
    name: 'Cold Outreach - Email First',
    description: 'Classic cold email sequence with strategic follow-ups. Perfect for B2B prospecting.',
    category: 'cold_outreach',
    channels: ['email'],
    estimatedDuration: '14 days',
    difficulty: 'beginner',
    expectedMetrics: {
      openRate: '25-35%',
      replyRate: '3-8%',
      conversionRate: '1-3%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: 'Quick question about {{company}}',
        content: `Hi {{first_name}},

I noticed {{company}} is growing rapidly in the {{industry}} space. Companies like yours often struggle with [pain point].

We've helped similar companies achieve [specific result]. Would you be open to a quick 15-minute chat this week?

Best,
{{sender_name}}`
      },
      {
        order: 2,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'Re: Quick question about {{company}}',
        content: `Hi {{first_name}},

Just wanted to follow up on my previous email. I understand you're busy, so I'll keep this brief.

[One sentence value prop]. Would a quick call work better for you?

Best,
{{sender_name}}`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 3,
        channel: 'email',
        delay: 4,
        delayUnit: 'days',
        subject: 'Last try - {{first_name}}',
        content: `Hi {{first_name}},

I'll keep this short - I've reached out a couple times about [value prop].

If this isn't relevant right now, no worries at all. Just let me know either way?

Thanks,
{{sender_name}}`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' }
        ]
      }
    ],
    tags: ['cold outreach', 'email', 'b2b', 'prospecting'],
    sophiaRecommendation: 'Great starting template! I recommend personalizing the first email with specific company research for 40% higher reply rates.'
  },
  {
    id: 'linkedin-invite-only',
    name: 'LinkedIn Invite Only',
    description: 'Simple LinkedIn connection request campaign. Send personalized connection requests to grow your network with targeted prospects.',
    category: 'cold_outreach',
    channels: ['linkedin_connect'],
    estimatedDuration: '1 day',
    difficulty: 'beginner',
    expectedMetrics: {
      openRate: 'N/A',
      replyRate: '20-40%',
      conversionRate: '15-30%'
    },
    steps: [
      {
        order: 1,
        channel: 'linkedin_connect',
        delay: 0,
        delayUnit: 'days',
        content: `Hi {{first_name}}, I came across your profile and was impressed by your work at {{company}}. Would love to connect and learn more about what you're building in {{industry}}.`
      }
    ],
    tags: ['linkedin', 'connection request', 'networking', 'simple'],
    sophiaRecommendation: 'Keep connection notes under 300 characters for best acceptance rates. I recommend mentioning something specific from their profile for 50% higher acceptance.'
  },
  {
    id: 'linkedin-connect-and-nurture',
    name: 'LinkedIn Connect & Nurture',
    description: 'Send a connection request, then nurture new connections with follow-up messages. Great for building relationships before pitching.',
    category: 'cold_outreach',
    channels: ['linkedin_connect', 'linkedin'],
    estimatedDuration: '7 days',
    difficulty: 'beginner',
    expectedMetrics: {
      openRate: 'N/A',
      replyRate: '25-45%',
      conversionRate: '10-20%'
    },
    steps: [
      {
        order: 1,
        channel: 'linkedin_connect',
        delay: 0,
        delayUnit: 'days',
        content: `Hi {{first_name}}, your experience in {{industry}} caught my attention. Would be great to connect!`
      },
      {
        order: 2,
        channel: 'linkedin',
        delay: 1,
        delayUnit: 'days',
        content: `Thanks for connecting, {{first_name}}! I noticed you're working on some interesting things at {{company}}. I'd love to hear more about your approach. What's been your biggest win lately?`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 3,
        channel: 'linkedin',
        delay: 3,
        delayUnit: 'days',
        content: `Hi {{first_name}}, I came across this article about {{industry}} trends and thought you might find it valuable. Would love to hear your thoughts if you have a moment!`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' }
        ]
      }
    ],
    tags: ['linkedin', 'connection request', 'nurture', 'relationship building'],
    sophiaRecommendation: 'Wait at least 24 hours after connection acceptance before sending the first message. This feels more natural and gets better response rates.'
  },
  {
    id: 'cold-outreach-multichannel',
    name: 'Multi-Channel Cold Outreach',
    description: 'Powerful sequence combining Email + LinkedIn for maximum reach. Uses conditional branching for smart follow-ups.',
    category: 'cold_outreach',
    channels: ['email', 'linkedin'],
    estimatedDuration: '21 days',
    difficulty: 'intermediate',
    expectedMetrics: {
      openRate: '35-45%',
      replyRate: '8-15%',
      conversionRate: '3-6%'
    },
    steps: [
      {
        order: 1,
        channel: 'linkedin',
        delay: 0,
        delayUnit: 'days',
        content: `Hi {{first_name}}, I noticed we're both in the {{industry}} space. I'd love to connect and share some insights that helped similar companies at {{company}}. Looking forward to connecting!`
      },
      {
        order: 2,
        channel: 'email',
        delay: 2,
        delayUnit: 'days',
        subject: 'Following up from LinkedIn - {{first_name}}',
        content: `Hi {{first_name}},

I recently sent you a connection request on LinkedIn. Wanted to also reach out here in case email works better for you.

I've been helping companies like {{company}} with [specific pain point], and thought you might find value in how we [solution].

Would you be open to a brief chat?

Best,
{{sender_name}}`
      },
      {
        order: 3,
        channel: 'linkedin',
        delay: 3,
        delayUnit: 'days',
        content: `Hi {{first_name}}, thanks for connecting! I wanted to share a quick insight: [industry stat or tip]. Would love to hear how {{company}} is approaching this.`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 4,
        channel: 'email',
        delay: 4,
        delayUnit: 'days',
        subject: 'Re: Following up from LinkedIn',
        content: `Hi {{first_name}},

Quick follow-up - I noticed [something specific about their company/recent news].

Given that, I thought you might be interested in how we helped [similar company] achieve [result].

Worth a quick chat?

{{sender_name}}`,
        conditions: [
          { type: 'if_not_opened', thenAction: 'switch_channel', switchTo: 'linkedin' },
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 5,
        channel: 'email',
        delay: 5,
        delayUnit: 'days',
        subject: 'Closing the loop - {{company}}',
        content: `{{first_name}},

Last note from me - I've reached out a few times about [value prop].

If now isn't the right time, totally understand. If things change, I'm always happy to chat.

Wishing you and the {{company}} team continued success!

{{sender_name}}`
      }
    ],
    tags: ['cold outreach', 'multi-channel', 'linkedin', 'email', 'b2b'],
    sophiaRecommendation: 'This multi-channel approach typically gets 2-3x higher response rates. I suggest sending LinkedIn connection requests in the morning (8-10 AM) for best acceptance rates.'
  },
  {
    id: 'lead-nurture-drip',
    name: 'Lead Nurture Drip',
    description: 'Educational content sequence to nurture warm leads over time. Perfect for inbound leads not ready to buy.',
    category: 'nurture',
    channels: ['email'],
    estimatedDuration: '30 days',
    difficulty: 'beginner',
    expectedMetrics: {
      openRate: '40-55%',
      replyRate: '5-12%',
      conversionRate: '8-15%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: 'Welcome! Here\'s your first resource',
        content: `Hi {{first_name}},

Thanks for your interest in [topic/product]. I wanted to personally reach out and share some resources that will help you [achieve goal].

First up: [Resource 1 - link to guide, video, or case study]

This covers [brief description of value].

I'll be sending you more helpful content over the coming weeks. Feel free to reply if you have any questions!

Best,
{{sender_name}}`
      },
      {
        order: 2,
        channel: 'email',
        delay: 5,
        delayUnit: 'days',
        subject: 'How {{similar_company}} achieved [result]',
        content: `Hi {{first_name}},

I wanted to share a success story that might resonate with you.

[Similar company] was facing [challenge] - sound familiar? Here's how they solved it: [brief case study or stats]

Full story here: [link]

Any questions? Just hit reply.

{{sender_name}}`
      },
      {
        order: 3,
        channel: 'email',
        delay: 7,
        delayUnit: 'days',
        subject: 'The #1 mistake in [industry/topic]',
        content: `Hi {{first_name}},

After working with hundreds of companies like {{company}}, I've noticed one common mistake that holds teams back:

[Describe the mistake and its impact]

The good news? It's fixable. Here's how: [solution or resource]

Worth a quick chat to see if this applies to your situation?

{{sender_name}}`
      },
      {
        order: 4,
        channel: 'email',
        delay: 7,
        delayUnit: 'days',
        subject: 'Ready to take the next step?',
        content: `Hi {{first_name}},

Over the past few weeks, I've shared some resources on [topic]. I hope they've been helpful!

At this point, many people in your shoes are ready to explore how this applies to their specific situation.

Would you be open to a quick call to discuss? I can share:
- How this applies to {{company}}
- Quick wins you can implement right away
- A roadmap for [desired outcome]

Let me know what works for you.

{{sender_name}}`
      }
    ],
    tags: ['nurture', 'drip', 'educational', 'inbound'],
    sophiaRecommendation: 'Nurture sequences work best with valuable content. I can analyze your best-performing content to suggest what to include in each step.'
  },
  {
    id: 're-engagement-winback',
    name: 'Re-Engagement Win-Back',
    description: 'Bring inactive leads or churned customers back to life. Uses urgency and value reminders.',
    category: 're_engagement',
    channels: ['email'],
    estimatedDuration: '14 days',
    difficulty: 'beginner',
    expectedMetrics: {
      openRate: '20-30%',
      replyRate: '3-8%',
      conversionRate: '5-12%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: 'We miss you, {{first_name}}!',
        content: `Hi {{first_name}},

It's been a while since we connected, and I wanted to reach out personally.

A lot has changed since we last spoke - we've added [new feature/improvement] that I think would be valuable for {{company}}.

Would you be open to a quick catch-up call? I'd love to hear what you've been working on and share what's new.

Best,
{{sender_name}}`
      },
      {
        order: 2,
        channel: 'email',
        delay: 4,
        delayUnit: 'days',
        subject: 'Quick question about {{company}}',
        content: `Hi {{first_name}},

I noticed {{company}} has been [growth indicator or news]. Congratulations!

I'm curious - are the challenges you mentioned before still relevant? Things like:
- [Pain point 1]
- [Pain point 2]

If so, I have some new ideas that might help. Quick 15-minute chat?

{{sender_name}}`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 3,
        channel: 'email',
        delay: 5,
        delayUnit: 'days',
        subject: 'Special offer for past friends',
        content: `Hi {{first_name}},

Since you were interested before, I wanted to offer you something exclusive:

[Special offer - discount, extended trial, free consultation, etc.]

This is available until [date]. If you'd like to take advantage, just reply and I'll set it up.

No pressure if timing isn't right - just wanted to make sure you knew about it.

{{sender_name}}`
      }
    ],
    tags: ['re-engagement', 'win-back', 'churned', 'inactive'],
    sophiaRecommendation: 'Re-engagement works best when you reference the original conversation or interest. I can pull context from your CRM to personalize these messages.'
  },
  {
    id: 'event-promotion',
    name: 'Event Promotion Sequence',
    description: 'Drive registrations for webinars, demos, or events. Includes reminder sequence.',
    category: 'event',
    channels: ['email', 'sms'],
    estimatedDuration: '10 days',
    difficulty: 'intermediate',
    expectedMetrics: {
      openRate: '45-60%',
      replyRate: '10-20%',
      conversionRate: '15-30%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: 'You\'re invited: [Event Name] - {{first_name}}',
        content: `Hi {{first_name}},

I'm hosting [Event Name] on [Date] and thought you'd find it valuable.

**What you'll learn:**
- [Key takeaway 1]
- [Key takeaway 2]
- [Key takeaway 3]

**When:** [Date & Time]
**Where:** [Virtual/Location]

[Register here →] [Link]

Space is limited to ensure quality interaction. Hope to see you there!

{{sender_name}}`
      },
      {
        order: 2,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'Did you see this? [Event Name]',
        content: `Hi {{first_name}},

Quick reminder about [Event Name] coming up on [Date].

We've already got [X] people registered, including folks from [notable companies].

[Register now →] [Link]

See you there?

{{sender_name}}`,
        conditions: [
          { type: 'if_clicked', thenAction: 'skip' }
        ]
      },
      {
        order: 3,
        channel: 'sms',
        delay: 1,
        delayUnit: 'days',
        content: `Hey {{first_name}}! [Event Name] is in 2 days. Last chance to register: [short link]. See you there! - {{sender_name}}`,
        conditions: [
          { type: 'if_not_opened', thenAction: 'continue' }
        ]
      },
      {
        order: 4,
        channel: 'email',
        delay: 0,
        delayUnit: 'hours',
        subject: '🔔 Starting in 1 hour: [Event Name]',
        content: `Hi {{first_name}},

Just a friendly reminder - [Event Name] starts in 1 hour!

**Join here:** [Link]

See you soon!

{{sender_name}}`
      }
    ],
    tags: ['event', 'webinar', 'demo', 'registration'],
    sophiaRecommendation: 'Event sequences have highest engagement in the 48 hours before the event. I recommend SMS reminders for 2x higher attendance rates.'
  },
  {
    id: 'product-launch-announcement',
    name: 'Product Launch Announcement',
    description: 'Generate excitement for new product or feature launches. Multi-touch sequence with urgency.',
    category: 'product_launch',
    channels: ['email', 'linkedin'],
    estimatedDuration: '7 days',
    difficulty: 'advanced',
    expectedMetrics: {
      openRate: '50-65%',
      replyRate: '8-15%',
      conversionRate: '10-20%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: '🚀 Introducing [Product/Feature Name]',
        content: `Hi {{first_name}},

Big news - we just launched [Product/Feature Name]!

**What's new:**
[Feature 1] - [Benefit]
[Feature 2] - [Benefit]
[Feature 3] - [Benefit]

**Early access offer:** [Special offer for early adopters]

[Check it out →] [Link]

I'd love to hear your thoughts!

{{sender_name}}`
      },
      {
        order: 2,
        channel: 'linkedin',
        delay: 2,
        delayUnit: 'days',
        content: `Hi {{first_name}}! Just launched something I think you'll find interesting for {{company}} - [one-line description]. Would love your feedback!`
      },
      {
        order: 3,
        channel: 'email',
        delay: 2,
        delayUnit: 'days',
        subject: 'What people are saying about [Product/Feature]',
        content: `Hi {{first_name}},

Since launching [Product/Feature] 4 days ago, here's what early users are saying:

"[Testimonial 1]" - [Name, Company]
"[Testimonial 2]" - [Name, Company]

The early access offer ends [Date]. Don't miss out!

[Get started →] [Link]

{{sender_name}}`,
        conditions: [
          { type: 'if_clicked', thenAction: 'end' }
        ]
      },
      {
        order: 4,
        channel: 'email',
        delay: 2,
        delayUnit: 'days',
        subject: '⏰ Last chance: Early access ends tomorrow',
        content: `Hi {{first_name}},

Quick heads up - the early access offer for [Product/Feature] ends tomorrow.

After that, [what changes - price increase, offer expires, etc.]

[Lock in your access →] [Link]

{{sender_name}}`
      }
    ],
    tags: ['product launch', 'announcement', 'urgency', 'new feature'],
    sophiaRecommendation: 'Product launches perform best when you segment by customer stage. I can help you create personalized versions for prospects vs existing customers.'
  },
  {
    id: 'intelligent-branching-sequence',
    name: 'Intelligent Branching Sequence',
    description: 'Advanced multi-path campaign with smart if/then logic. Sophia automatically routes contacts based on engagement.',
    category: 'cold_outreach',
    channels: ['email', 'linkedin', 'sms', 'phone'],
    estimatedDuration: '21 days',
    difficulty: 'advanced',
    expectedMetrics: {
      openRate: '45-60%',
      replyRate: '15-25%',
      conversionRate: '8-15%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: '[Industry insight] for {{company}}',
        content: `Hi {{first_name}},

I came across {{company}} while researching leaders in {{industry}}. I noticed [specific observation].

Quick question: Are you currently exploring ways to [solve pain point]?

If so, I have some insights from similar companies that might be valuable.

Best,
{{sender_name}}`
      },
      {
        order: 2,
        channel: 'linkedin',
        delay: 2,
        delayUnit: 'days',
        content: `Hi {{first_name}}, I sent you a brief email about {{company}}. Would love to connect here as well - I share regular insights on [topic] that might be valuable for your team.`,
        conditions: [
          { type: 'if_opened', thenAction: 'continue' },
          { type: 'if_not_opened', thenAction: 'switch_channel', switchTo: 'sms' }
        ]
      },
      {
        order: 3,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'Re: [Industry insight] for {{company}}',
        content: `Hi {{first_name}},

Following up on my previous email. I wanted to share that [similar company] achieved [specific result] by addressing the exact challenge I mentioned.

Would a 10-minute call make sense to explore if this applies to {{company}}?

{{sender_name}}`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' },
          { type: 'if_clicked', thenAction: 'continue' }
        ]
      },
      {
        order: 4,
        channel: 'phone',
        delay: 2,
        delayUnit: 'days',
        content: `Call script: "Hi {{first_name}}, this is {{sender_name}}. I've sent you a couple of emails about [topic] - wanted to quickly connect to see if this is relevant for {{company}} right now. Is this a good time for 2 minutes?"`,
        conditions: [
          { type: 'if_opened', thenAction: 'continue' },
          { type: 'if_not_opened', thenAction: 'switch_channel', switchTo: 'linkedin' }
        ]
      },
      {
        order: 5,
        channel: 'sms',
        delay: 2,
        delayUnit: 'days',
        content: `Hey {{first_name}}, tried reaching you about {{company}}. Worth a quick chat? Reply YES for a good time or STOP to opt out. - {{sender_name}}`,
        conditions: [
          { type: 'if_not_replied', thenAction: 'continue' }
        ]
      },
      {
        order: 6,
        channel: 'email',
        delay: 5,
        delayUnit: 'days',
        subject: 'Closing the loop - {{first_name}}',
        content: `Hi {{first_name}},

I've reached out a few times about [value prop] for {{company}}. I understand timing might not be right.

If things change in the future, I'm always happy to chat. Wishing you continued success!

{{sender_name}}`
      }
    ],
    tags: ['advanced', 'multi-channel', 'branching', 'intelligent', 'sophia-managed'],
    sophiaRecommendation: 'This is my most sophisticated template! I automatically route each contact based on their engagement - if someone opens but doesn\'t reply, I try a different channel. I\'ll show you real-time branch analytics as the campaign runs.'
  },
  {
    id: 'sophia-autonomous-outreach',
    name: 'Sophia Autonomous Outreach',
    description: 'Let Sophia run this campaign autonomously. She picks optimal channels per contact based on engagement history.',
    category: 'cold_outreach',
    channels: ['email', 'linkedin', 'sms', 'phone'],
    estimatedDuration: '14-30 days',
    difficulty: 'advanced',
    expectedMetrics: {
      openRate: '50-70%',
      replyRate: '18-28%',
      conversionRate: '10-18%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: '{{sophia_personalized_subject}}',
        content: `{{sophia_personalized_content}}

Best,
{{sender_name}}`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 2,
        channel: 'linkedin',
        delay: 2,
        delayUnit: 'days',
        content: `{{sophia_linkedin_message}}`,
        conditions: [
          { type: 'if_not_opened', thenAction: 'switch_channel', switchTo: 'sms' },
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 3,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'Re: {{sophia_personalized_subject}}',
        content: `{{sophia_followup_content}}`,
        conditions: [
          { type: 'if_clicked', thenAction: 'continue' },
          { type: 'if_not_opened', thenAction: 'switch_channel', switchTo: 'phone' }
        ]
      },
      {
        order: 4,
        channel: 'phone',
        delay: 2,
        delayUnit: 'days',
        content: `{{sophia_call_script}}`,
        conditions: [
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 5,
        channel: 'sms',
        delay: 3,
        delayUnit: 'days',
        content: `{{sophia_sms_message}}`,
        conditions: [
          { type: 'if_not_replied', thenAction: 'continue' }
        ]
      }
    ],
    tags: ['autonomous', 'ai-powered', 'sophia-managed', 'personalized', 'smart'],
    sophiaRecommendation: 'I\'ll fully manage this campaign for you! I analyze each contact\'s LinkedIn activity, email engagement history, and past interactions to pick the best channel. You just approve the big decisions - I handle the rest.'
  },
  {
    id: 'engagement-based-escalation',
    name: 'Engagement-Based Escalation',
    description: 'Smart escalation from low-touch to high-touch based on engagement signals. Perfect for high-value prospects.',
    category: 'cold_outreach',
    channels: ['email', 'linkedin', 'phone'],
    estimatedDuration: '21 days',
    difficulty: 'advanced',
    expectedMetrics: {
      openRate: '40-55%',
      replyRate: '12-20%',
      conversionRate: '8-15%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: 'Quick insight for {{company}}',
        content: `Hi {{first_name}},

I noticed {{company}} is [observation]. Companies in your position often [pain point].

Here's a 2-minute read on how [similar company] addressed this: [link]

Worth exploring for {{company}}?

{{sender_name}}`
      },
      {
        order: 2,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'Re: Quick insight for {{company}}',
        content: `Hi {{first_name}},

Noticed you opened my last email. The insight about [topic] resonated with a lot of folks in {{industry}}.

Would it help to see a specific example of how this applies to {{company}}? I can share a quick case study.

{{sender_name}}`,
        conditions: [
          { type: 'if_opened', thenAction: 'continue' },
          { type: 'if_not_opened', thenAction: 'switch_channel', switchTo: 'linkedin' }
        ]
      },
      {
        order: 3,
        channel: 'linkedin',
        delay: 2,
        delayUnit: 'days',
        content: `Hi {{first_name}}, I see you've been looking at my emails about [topic]. LinkedIn might be easier - would you prefer to chat here? I have some specific ideas for {{company}}.`,
        conditions: [
          { type: 'if_clicked', thenAction: 'continue' },
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 4,
        channel: 'phone',
        delay: 2,
        delayUnit: 'days',
        content: `Call script: "Hi {{first_name}}, I noticed you clicked on my case study link about [topic]. I'd love to walk you through exactly how [similar company] achieved those results - do you have 10 minutes this week?"`,
        conditions: [
          { type: 'if_clicked', thenAction: 'continue' }
        ]
      },
      {
        order: 5,
        channel: 'email',
        delay: 4,
        delayUnit: 'days',
        subject: 'Worth one more try - {{first_name}}',
        content: `Hi {{first_name}},

I've shared several resources on [topic] over the past few weeks. Based on your engagement, it seems like this might be relevant but timing isn't right.

Just so you know: I'm here whenever you're ready. No pressure.

All the best,
{{sender_name}}`
      }
    ],
    tags: ['escalation', 'engagement-based', 'high-value', 'intent-signals', 'advanced'],
    sophiaRecommendation: 'This template watches for buying signals. When someone opens multiple times or clicks links, I escalate to higher-touch channels. Perfect for enterprise prospects where personalization matters.'
  },
  {
    id: 'meeting-booking-sequence',
    name: 'Meeting Booking Sequence',
    description: 'Optimized for booking demos and meetings. Uses urgency and multiple booking options.',
    category: 'cold_outreach',
    channels: ['email', 'linkedin', 'sms'],
    estimatedDuration: '10 days',
    difficulty: 'intermediate',
    expectedMetrics: {
      openRate: '35-50%',
      replyRate: '10-18%',
      conversionRate: '5-12%'
    },
    steps: [
      {
        order: 1,
        channel: 'email',
        delay: 0,
        delayUnit: 'days',
        subject: '15 minutes to show you {{value_prop}}?',
        content: `Hi {{first_name}},

I help companies like {{company}} [achieve result]. In 15 minutes, I can show you exactly how.

**Pick a time that works:**
[Calendar link]

Or just reply with a time that works for you.

{{sender_name}}`
      },
      {
        order: 2,
        channel: 'linkedin',
        delay: 2,
        delayUnit: 'days',
        content: `Hi {{first_name}}! Sent you a quick email about a 15-min demo for {{company}}. Would LinkedIn be easier to coordinate? Let me know what works!`,
        conditions: [
          { type: 'if_not_opened', thenAction: 'continue' },
          { type: 'if_replied', thenAction: 'end' }
        ]
      },
      {
        order: 3,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'Quick - 3 times that work',
        content: `Hi {{first_name}},

I know you're busy, so I'll make this easy. Here are 3 specific times for our 15-min call:

- Tomorrow at 10 AM
- Thursday at 2 PM  
- Friday at 11 AM

Just reply with the one that works (or suggest another) and I'll send the invite.

{{sender_name}}`,
        conditions: [
          { type: 'if_opened', thenAction: 'continue' }
        ]
      },
      {
        order: 4,
        channel: 'sms',
        delay: 2,
        delayUnit: 'days',
        content: `Hey {{first_name}}! Still want to show you how [result] in 15 min. Best time this week? Reply with day/time. - {{sender_name}}`,
        conditions: [
          { type: 'if_not_replied', thenAction: 'continue' }
        ]
      },
      {
        order: 5,
        channel: 'email',
        delay: 3,
        delayUnit: 'days',
        subject: 'Last try - {{first_name}}',
        content: `{{first_name}},

I've reached out a few times about [value prop]. If it's not relevant right now, no worries at all.

If things change, my calendar is always open: [link]

Wishing you success!
{{sender_name}}`
      }
    ],
    tags: ['meeting', 'booking', 'demo', 'calendar', 'sales'],
    sophiaRecommendation: 'Meetings book 40% more often when you offer specific times vs just a calendar link. I personalize the suggested times based on the prospect\'s timezone and typical response patterns.'
  },
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
    id: 'event-attendee-follow-up',
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

[Try it now]

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

[Get started]

{{sender_name}}`
      }
    ],
    tags: ['product launch', 'nurture', 'multi-channel', 'teaser'],
    sophiaRecommendation: 'Build anticipation with teasers before the launch. I can A/B test subject lines to maximize open rates.'
  }
];

export function getTemplatesByCategory(category: CampaignTemplate['category']): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES.filter(t => t.category === category);
}

export function getTemplateById(id: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find(t => t.id === id);
}

export function getAllTemplates(): CampaignTemplate[] {
  return CAMPAIGN_TEMPLATES;
}

export function searchTemplates(query: string): CampaignTemplate[] {
  const lowerQuery = query.toLowerCase();
  return CAMPAIGN_TEMPLATES.filter(t => 
    t.name.toLowerCase().includes(lowerQuery) ||
    t.description.toLowerCase().includes(lowerQuery) ||
    t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

export function getTemplateCategories(): Array<{ id: CampaignTemplate['category']; name: string; description: string }> {
  return [
    { id: 'cold_outreach', name: 'Cold Outreach', description: 'Reach new prospects who don\'t know you yet' },
    { id: 'nurture', name: 'Lead Nurture', description: 'Educate and warm up interested leads' },
    { id: 're_engagement', name: 'Re-Engagement', description: 'Win back inactive leads or customers' },
    { id: 'event', name: 'Event Promotion', description: 'Drive registrations for webinars and events' },
    { id: 'product_launch', name: 'Product Launch', description: 'Announce new products or features' }
  ];
}
