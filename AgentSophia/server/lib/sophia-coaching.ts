/**
 * Sophia Coaching System
 * Proactive tips and suggestions based on user actions
 */

export interface SophiaCoachingContext {
  action: string;
  campaignCount?: number;
  lastCampaignPerformance?: any;
  userLocation?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
}

export function generateProactiveSuggestion(context: SophiaCoachingContext): string {
  const { action, campaignCount = 0, lastCampaignPerformance } = context;

  const suggestions: Record<string, (ctx: SophiaCoachingContext) => string> = {
    // Dashboard actions
    'dashboard-loaded': (ctx) => {
      if (ctx.campaignCount === 0) {
        return "🎯 Hey! Your dashboard is ready. Let's create your first campaign with me - I'll guide you through every step. Want to get started?";
      } else if (ctx.campaignCount < 3) {
        return `📊 Great! You've run ${ctx.campaignCount} campaign(s). I'm learning from your data. Let's create another one - I'll apply what I learned!`;
      } else {
        return "📈 You're crushing it with multiple campaigns! Want to run an advanced multi-channel sequence next? I can predict results.";
      }
    },

    'viewed-hot-leads': (ctx) => {
      return "🔥 Smart! Hot leads are your best opportunity. Follow up with them TODAY - research shows 80% of replies come within 24 hours of initial contact.";
    },

    'viewed-metrics': (ctx) => {
      if (ctx.lastCampaignPerformance?.open_rate > 25) {
        return "🚀 WOW! Your open rate is crushing benchmarks (25%+ vs 21.5% average). What's working? Let's replicate this in your next campaign!";
      } else if (ctx.lastCampaignPerformance?.reply_rate > 15) {
        return "💬 Excellent reply rate (15%+)! That means your message really resonated. I'm learning from this - next campaign will be even better.";
      } else {
        return "📊 Let me help improve your metrics. Try: 1) A/B test subject lines, 2) Shorten messages, 3) Add personalization tags. I'll track improvements!";
      }
    },

    // Campaign actions
    'campaign-launched': (ctx) => {
      return "🚀 Campaign live! I'm tracking every open, click, and reply. You'll see trends in 24-48 hours. Pro tip: Check metrics daily for quick optimization.";
    },

    'campaign-paused': (ctx) => {
      return "⏸️ Campaign paused. Want insights on why before you restart? I can show what's working and what to adjust.";
    },

    'viewed-campaign-details': (ctx) => {
      return "🔍 Checking the details! Here's my analysis: Focus on improving the channel with the lowest engagement first. Want specific recommendations?";
    },

    // Workflow actions
    'workflow-created': (ctx) => {
      return "🎯 Visual workflow created! Multi-step sequences get 2.5x better results. Pro tip: Add wait times of 2-3 days between touches for better conversions.";
    },

    // Research viewing
    'research-viewed': (ctx) => {
      return "🧠 Diving into research! Remember: personalization lifts revenue by 26% (Experian), and multi-channel increases conversion 3x. Apply these to your next campaign!";
    }
  };

  return suggestions[action]?.(context) || "";
}

/**
 * Suggest next best actions
 */
export function suggestNextActions(context: any): string[] {
  const suggestions: string[] = [];

  if (context.campaignCount === 0) {
    suggestions.push("🎯 Create your first campaign");
    suggestions.push("📚 Learn from research insights");
  } else if (context.campaignCount === 1) {
    suggestions.push("🔄 Create a follow-up campaign");
    suggestions.push("🎬 Build a visual workflow");
  } else {
    suggestions.push("📊 Compare campaign performance");
    suggestions.push("🚀 Run advanced multi-channel campaign");
  }

  if (context.hasHotLeads && context.hotLeadsCount > 0) {
    suggestions.push(`⚡ Follow up with ${context.hotLeadsCount} hot lead(s) today`);
  }

  if (context.avgOpenRate < 20) {
    suggestions.push("💡 Optimize message copy for better open rates");
  }

  return suggestions;
}

/**
 * Smart onboarding tip based on user level
 */
export function getSmartTip(userLevel: 'beginner' | 'intermediate' | 'advanced'): string {
  const tips = {
    beginner: "💡 Start with Email + LinkedIn together. Research shows multi-channel campaigns get 3x better results than single channel.",
    intermediate: "🚀 Try adding sequences (multiple touches). Data shows 2-3 touch campaigns convert 2.5x better than single touches.",
    advanced: "🧠 Use conditional workflows - branch based on replies to send different next steps. Personalization at scale = revenue growth!"
  };

  return tips[userLevel];
}

/**
 * Contextual encouragement
 */
export function getEncouragement(): string {
  const encouragements = [
    "🎯 You're building momentum! Keep going!",
    "📈 Your strategy is solid. Results coming soon!",
    "🚀 Data shows you're on the right track!",
    "💪 Great decision! This will improve results!",
    "⭐ You're thinking like a real strategist now!"
  ];

  return encouragements[Math.floor(Math.random() * encouragements.length)];
}
