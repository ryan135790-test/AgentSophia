/**
 * Research Knowledge Base for Agent Sophia
 * Access to industry benchmarks, best practices, and marketing research
 * Allows Sophia to make data-driven, research-backed recommendations
 */

export interface ResearchInsight {
  category: string;
  metric: string;
  value: number;
  unit: string;
  source: string;
  year: number;
  description: string;
}

export interface BestPractice {
  channel: string;
  practice: string;
  impact: 'high' | 'medium' | 'low';
  research: string;
  implementation: string;
}

export interface CampaignOptimization {
  tactic: string;
  improvement: string;
  baselineVsOptimized: string;
  research: string;
}

// Industry Benchmarks from HubSpot, Mailchimp, LinkedIn, and marketing research
const RESEARCH_DATABASE: ResearchInsight[] = [
  // Email Benchmarks
  { category: 'email', metric: 'open_rate', value: 21.5, unit: '%', source: 'Mailchimp 2024', year: 2024, description: 'Average email open rate across industries' },
  { category: 'email', metric: 'click_rate', value: 2.6, unit: '%', source: 'Mailchimp 2024', year: 2024, description: 'Average click-through rate' },
  { category: 'email', metric: 'conversion_rate', value: 1.9, unit: '%', source: 'HubSpot Research', year: 2024, description: 'Average conversion rate' },
  { category: 'email', metric: 'best_send_time_open', value: 45, unit: '%', source: 'Klaviyo Study', year: 2023, description: 'Open rate improvement when sent at optimal time' },
  { category: 'email', metric: 'personalization_lift', value: 26, unit: '%', source: 'Experian', year: 2023, description: 'Revenue lift from personalized emails' },
  { category: 'email', metric: 'subject_line_emoji_lift', value: 56, unit: '%', source: 'Mailchimp Data', year: 2024, description: 'Open rate increase with relevant emoji' },
  
  // LinkedIn Benchmarks
  { category: 'linkedin', metric: 'connection_request_rate', value: 15, unit: '%', source: 'LinkedIn Sales Insights', year: 2024, description: 'Average connection request acceptance rate' },
  { category: 'linkedin', metric: 'message_reply_rate', value: 10, unit: '%', source: 'LinkedIn Sales Navigator', year: 2024, description: 'Average reply rate for outreach messages' },
  { category: 'linkedin', metric: 'post_engagement_rate', value: 1.5, unit: '%', source: 'LinkedIn Content Report', year: 2024, description: 'Average engagement rate on posts' },
  { category: 'linkedin', metric: 'video_vs_text', value: 5, unit: 'x', source: 'LinkedIn Research', year: 2024, description: 'Video content gets 5x more engagement' },
  { category: 'linkedin', metric: 'personalization_conversion', value: 40, unit: '%', source: 'Sales Intelligence Report', year: 2023, description: 'Conversion lift from personalized messages' },
  
  // SMS Benchmarks
  { category: 'sms', metric: 'open_rate', value: 98, unit: '%', source: 'Twilio Research', year: 2024, description: 'SMS message read rate (nearly all opened)' },
  { category: 'sms', metric: 'click_rate', value: 36, unit: '%', source: 'HubSpot SMS Data', year: 2024, description: 'Click-through rate when link included' },
  { category: 'sms', metric: 'response_rate', value: 45, unit: '%', source: 'SMS Marketing Report', year: 2024, description: 'Average response rate to SMS campaigns' },
  { category: 'sms', metric: 'opt_in_retention', value: 83, unit: '%', source: 'Twilio Industry Report', year: 2023, description: 'Subscriber retention rate' },
  
  // Multi-channel
  { category: 'multichannel', metric: 'channel_combination_lift', value: 3, unit: 'x', source: 'McKinsey', year: 2023, description: 'Conversion lift from multi-channel approach' },
  { category: 'multichannel', metric: 'email_linkedin_combo', value: 2.5, unit: 'x', source: 'Sales Engagement Report', year: 2024, description: 'Lift from email + LinkedIn sequence' },
];

const BEST_PRACTICES: BestPractice[] = [
  // Email Best Practices
  {
    channel: 'email',
    practice: 'Personalization beyond name',
    impact: 'high',
    research: 'Experian found 26% revenue lift with dynamic content',
    implementation: 'Include company, role, pain point references'
  },
  {
    channel: 'email',
    practice: 'A/B test subject lines',
    impact: 'high',
    research: 'Subject line changes can improve open rates by 45%',
    implementation: 'Test two versions, send to 10% sample, scale winner'
  },
  {
    channel: 'email',
    practice: 'Optimal send time targeting',
    impact: 'medium',
    research: 'Right time can improve opens by 45%',
    implementation: 'Send Tuesday-Thursday, 10am-2pm local time'
  },
  {
    channel: 'email',
    practice: 'Clear CTA and value prop',
    impact: 'high',
    research: 'Clear ask improves click rates by 40%',
    implementation: 'One primary CTA, benefit-focused copy'
  },
  
  // LinkedIn Best Practices
  {
    channel: 'linkedin',
    practice: 'Research profile before message',
    impact: 'high',
    research: 'Personalized messages get 40% higher conversion',
    implementation: 'Reference recent activity, company news, or role'
  },
  {
    channel: 'linkedin',
    practice: 'Warm connections before DM',
    impact: 'medium',
    research: 'Connection acceptance improves reply rates',
    implementation: 'Connect, wait 1-3 days, then message'
  },
  {
    channel: 'linkedin',
    practice: 'Short, conversational messages',
    impact: 'high',
    research: 'Shorter messages get 25% higher reply rates',
    implementation: 'Keep under 150 characters, ask genuine question'
  },
  {
    channel: 'linkedin',
    practice: 'Native content engagement',
    impact: 'medium',
    research: 'Engaging on posts increases response likelihood',
    implementation: 'Comment on recent posts before outreach'
  },
  
  // SMS Best Practices
  {
    channel: 'sms',
    practice: 'Keep under 160 characters',
    impact: 'high',
    research: 'Multi-part SMS has 20% lower engagement',
    implementation: 'Compress message, use link shortener'
  },
  {
    channel: 'sms',
    practice: 'Clear call to action',
    impact: 'high',
    research: 'SMS with clear CTA gets 45% response rate',
    implementation: 'Use action verb: "Reply YES", "Click here"'
  },
  {
    channel: 'sms',
    practice: 'Respect time zones and quiet hours',
    impact: 'medium',
    research: 'Messages 8am-8pm get better engagement',
    implementation: 'Queue messages for recipient timezone'
  },
];

const CAMPAIGN_OPTIMIZATIONS: CampaignOptimization[] = [
  {
    tactic: 'Multi-touch sequence (3+ touches)',
    improvement: '2.5x higher conversion',
    baselineVsOptimized: '5% vs 12% conversion',
    research: 'Sales development teams using 3+ touches see 2.5x improvement'
  },
  {
    tactic: 'Channel switching (email → LinkedIn → SMS)',
    improvement: '3x higher response',
    baselineVsOptimized: '10% vs 30% engagement',
    research: 'Different decision-makers check different channels'
  },
  {
    tactic: 'Timing optimization (wait 2-3 days between touches)',
    improvement: '1.8x better open rates',
    baselineVsOptimized: '15% vs 27% openrate',
    research: 'Back-to-back messages decrease engagement'
  },
  {
    tactic: 'Personalization with company research',
    improvement: '2x higher reply rates',
    baselineVsOptimized: '8% vs 16% reply rate',
    research: 'Mentioning specific challenges increases response'
  },
  {
    tactic: 'Segmentation by company size/industry',
    improvement: '1.5x better targeting',
    baselineVsOptimized: 'Generic message vs tailored',
    research: 'Tailored messaging to persona improves relevance'
  },
  {
    tactic: 'Lead scoring before outreach',
    improvement: '35% fewer wasted touches',
    baselineVsOptimized: 'Random contacts vs qualified',
    research: 'Targeting right persona saves resources'
  },
];

/**
 * Get industry benchmark for a channel/metric
 */
export function getBenchmark(channel: string, metric: string): ResearchInsight | null {
  return RESEARCH_DATABASE.find(r => r.category === channel && r.metric === metric) || null;
}

/**
 * Get research-backed best practices for a channel
 */
export function getBestPracticesForChannel(channel: string): BestPractice[] {
  return BEST_PRACTICES.filter(bp => bp.channel === channel || bp.channel === 'general');
}

/**
 * Generate research-backed recommendations
 */
export function generateResearchRecommendations(channels: string[]): string[] {
  const recommendations: string[] = [];

  // Multi-channel recommendation
  if (channels.length > 1) {
    const multiChannelBench = RESEARCH_DATABASE.find(r => r.metric === 'channel_combination_lift');
    if (multiChannelBench) {
      recommendations.push(
        `📊 Research shows multi-channel approach drives ${multiChannelBench.value}x conversion lift (${multiChannelBench.source})`
      );
    }
  }

  // Channel-specific recommendations
  for (const channel of channels) {
    const practices = getBestPracticesForChannel(channel);
    if (practices.length > 0) {
      const highImpact = practices.filter(p => p.impact === 'high')[0];
      if (highImpact) {
        recommendations.push(
          `💡 For ${channel}: ${highImpact.practice} (${highImpact.research})`
        );
      }
    }
  }

  // Optimization recommendations
  recommendations.push(
    `🎯 Use multi-touch sequences: ${CAMPAIGN_OPTIMIZATIONS[0].improvement}`
  );

  return recommendations;
}

/**
 * Get campaign optimization strategies
 */
export function getCampaignOptimizations(): CampaignOptimization[] {
  return CAMPAIGN_OPTIMIZATIONS;
}

/**
 * Generate research context for Sophia's thinking
 */
export function generateResearchContext(workspaceData: any): string {
  let context = '🧠 Research-backed thinking:\n\n';

  // Add relevant benchmarks
  const channels = workspaceData.channels || [];
  for (const channel of channels) {
    const benchmark = getBenchmark(channel, 'open_rate') || getBenchmark(channel, 'connection_request_rate');
    if (benchmark) {
      context += `📊 ${channel.toUpperCase()}: Industry average is ${benchmark.value}${benchmark.unit} ${benchmark.description} (${benchmark.source})\n`;
    }
  }

  context += '\n💡 Optimization Strategies:\n';
  const optimizations = getCampaignOptimizations().slice(0, 3);
  for (const opt of optimizations) {
    context += `• ${opt.tactic}: ${opt.improvement}\n`;
  }

  return context;
}

/**
 * Sophia's research-informed analysis
 */
export function getSophiaResearchAnalysis(
  channels: string[],
  workspacePerformance: any
): {
  benchmarks: string[];
  recommendations: string[];
  optimizations: string[];
} {
  const benchmarks: string[] = [];
  const recommendations: string[] = [];
  const optimizations: string[] = [];

  // Benchmarks
  for (const channel of channels) {
    const openRate = getBenchmark(channel, 'open_rate');
    if (openRate) {
      benchmarks.push(
        `${channel}: ${openRate.value}${openRate.unit} industry average`
      );
    }
  }

  // Recommendations
  recommendations.push(...generateResearchRecommendations(channels));

  // Optimizations
  for (const opt of getCampaignOptimizations()) {
    optimizations.push(`${opt.tactic} → ${opt.improvement}`);
  }

  return { benchmarks, recommendations, optimizations };
}
