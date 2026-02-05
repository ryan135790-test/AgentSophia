/**
 * Sophia Smart Contextual Tips System
 * Provides intelligent, context-aware tips during campaign creation
 */

export const SMART_TIPS = {
  channels: {
    email: "📧 Email tip: Subject lines matter! Test: short (5-7 words) vs personalized. Research shows 36% higher open rates.",
    linkedin: "🔗 LinkedIn tip: Connect first, then message. Native LinkedIn messages get 15% higher response than InMail.",
    sms: "📱 SMS tip: Keep it SHORT (160 chars max). SMS gets 98% open rate - your fastest engagement channel!",
    'multi-channel': "🚀 Multi-channel power: Using Email + LinkedIn + SMS together = 3x conversion vs single channel. Do it!"
  },

  product: {
    vague: "💡 Make it more specific! 'Helps close deals' → 'Reduces sales cycle by 40%' = 5x better response.",
    specific: "✅ Love it! Specific benefits = better results. Now let's target the right people.",
    generic: "🎯 Pro tip: Focus on OUTCOME, not feature. 'Reduces hiring time by 50%' beats 'AI-powered recruiting tool'."
  },

  audience: {
    specific: "🎯 Excellent targeting! Specific audiences = higher conversion. You're thinking like a strategist.",
    broad: "💡 Tip: The more specific, the better response rate. 'Ops leaders at 100-500 person companies' > 'business owners'",
    industry: "🔥 Targeting by industry = smart! Industry-specific messaging gets 40% better open rates."
  },

  goal: {
    meetings: "📅 Smart goal! Booking meetings is the clearest conversion metric. I'll optimize for calendar acceptance.",
    leads: "📈 Lead generation goal. Pro tip: Warm leads convert 4x better than cold - focus follow-ups on engagement.",
    signups: "🚀 Signups as goal = great for product adoption. I'll optimize for CTR (click-through rate).",
    sales: "💰 Revenue goal - the ultimate measure! I'll track the full funnel to ROI."
  },

  campaign_name: {
    descriptive: "✅ Clear name! This helps me remember your strategy for next campaign.",
    vague: "💡 Tip: Name it by GOAL or AUDIENCE, not just date. Helps you remember the strategy later!",
    seasonal: "📅 Seasonal campaign - smart! Time-based campaigns get better urgency."
  }
};

export const RESEARCH_TIPS = [
  "🧠 Did you know? Personalization lifts response by 26% (Experian). Use [FirstName], [Company], [Role] tags!",
  "📧 Email benchmark: 21.5% average open rate, 2.6% click rate. Multi-touch sequences improve by 45%.",
  "🔗 LinkedIn fact: 15% connection rate is industry average. But LinkedIn messages get 10% reply rate!",
  "📱 SMS insight: 98% open rate in 3 minutes! But only use SMS for time-sensitive, valuable messages.",
  "⏱️ Timing matters: Best sending times are Tues-Thurs, 10am-2pm. Monday/Friday get 20% lower engagement.",
  "💬 Reply rate wins: 45% average SMS reply rate beats email (2.6%) by 17x! But respect the channel.",
  "🔄 Multi-touch magic: 2-3 touch sequences convert 2.5x better than single touch. Plan sequences!",
  "🎯 A/B testing: Even small A/B tests improve performance by 45%. Always test subject lines or copy.",
  "💰 Revenue lift: Personalized campaigns drive 26% revenue lift. Every [Tag] you add = more revenue.",
  "🚀 Mobile first: 81% of emails opened on mobile. Keep messages SHORT and CTAs big!",
  "❄️ Cold to hot: Takes 5-7 touches to warm up cold leads. Build sequences, not single blasts!",
  "🧪 Segment power: Segmented campaigns get 14% higher open rates. Know your audience type!"
];

export const OPTIMIZATION_TIPS = {
  low_open_rate: "📧 Low open rate? Try: 1) Shorter subject lines (5-7 words), 2) Personalize, 3) A/B test sender name",
  low_click_rate: "🖱️ Low clicks? Make CTAs bigger/clearer. Button > link. 'See the demo' > 'Learn more'",
  low_reply_rate: "💬 No replies? Make messages shorter, more personal, and ask a specific question.",
  good_open_not_clicking: "📊 Opens but no clicks? Your subject is solid but CTA is weak. Make it clearer what they're clicking to.",
  high_performance: "🎉 Crushing it! Keep this message template. Run it to more audiences. Scale what works!"
};

/**
 * Get smart tip based on campaign step
 */
export function getSmartTip(step: string, context: any): string {
  if (step === 'channels' && context.selectedChannels) {
    const channels = Array.from(context.selectedChannels);
    if (channels.length > 1) {
      return SMART_TIPS.channels['multi-channel'];
    }
    return SMART_TIPS.channels[channels[0] as keyof typeof SMART_TIPS.channels] || "";
  }

  if (step === 'product' && context.product) {
    const length = context.product.length;
    if (length < 50) return SMART_TIPS.product.vague;
    if (length > 150) return SMART_TIPS.product.specific;
    return SMART_TIPS.product.generic;
  }

  if (step === 'audience' && context.audience) {
    if (context.audience.includes('company') || context.audience.includes('size')) {
      return SMART_TIPS.audience.specific;
    }
    return SMART_TIPS.audience.broad;
  }

  if (step === 'goal' && context.goal) {
    if (context.goal.toLowerCase().includes('meeting')) return SMART_TIPS.goal.meetings;
    if (context.goal.toLowerCase().includes('lead')) return SMART_TIPS.goal.leads;
    if (context.goal.toLowerCase().includes('signup')) return SMART_TIPS.goal.signups;
    if (context.goal.toLowerCase().includes('sale') || context.goal.toLowerCase().includes('close')) return SMART_TIPS.goal.sales;
  }

  return "";
}

/**
 * Get random research tip
 */
export function getResearchTip(): string {
  return RESEARCH_TIPS[Math.floor(Math.random() * RESEARCH_TIPS.length)];
}

/**
 * Get optimization suggestions based on campaign metrics
 */
export function getOptimizationSuggestion(metrics: any): string {
  if (!metrics) return "";

  const { open_rate = 0, click_rate = 0, reply_rate = 0 } = metrics;

  if (open_rate > 30 && click_rate < 2) {
    return OPTIMIZATION_TIPS.good_open_not_clicking;
  }
  if (open_rate < 20) {
    return OPTIMIZATION_TIPS.low_open_rate;
  }
  if (click_rate < 1.5) {
    return OPTIMIZATION_TIPS.low_click_rate;
  }
  if (reply_rate < 5) {
    return OPTIMIZATION_TIPS.low_reply_rate;
  }
  if (open_rate > 25 && reply_rate > 10) {
    return OPTIMIZATION_TIPS.high_performance;
  }

  return "";
}
