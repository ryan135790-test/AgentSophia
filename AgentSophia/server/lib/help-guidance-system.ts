/**
 * Help & Guidance System
 * Prevents users from getting lost with contextual help, tips, and guided flows
 */

export interface HelpTopic {
  id: string;
  title: string;
  description: string;
  steps: string[];
  tips: string[];
  relatedFeatures: string[];
}

export interface UserGuidanceState {
  userId: string;
  completedSteps: string[];
  currentStep?: string;
  helpTopicsViewed: string[];
  preferredLearningStyle: 'visual' | 'textual' | 'interactive';
}

// Comprehensive help content database
const HELP_TOPICS: Record<string, HelpTopic> = {
  'campaign-creation': {
    id: 'campaign-creation',
    title: 'Create Your First Campaign',
    description: 'Guide to building and launching a multi-channel campaign',
    steps: [
      '1. Click "Chat with Sophia" to start',
      '2. Select channels (Email, LinkedIn, SMS)',
      '3. Describe your product and target audience',
      '4. Define your goal (e.g., increase pipeline)',
      '5. Name your campaign',
      '6. Choose lead source (Manual, LinkedIn, CSV)',
      '7. Review generated messages',
      '8. Sophia validates everything',
      '9. Launch campaign',
      '10. Track performance'
    ],
    tips: [
      '💡 Multi-channel campaigns get 3x higher conversion',
      '💡 Include personalization tags like [Name], [Company]',
      '💡 Keep messages short and personal',
      '💡 Use research-backed best practices',
      '💡 Test different message versions'
    ],
    relatedFeatures: ['workflow-builder', 'performance-tracking', 'research-insights']
  },

  'workflow-builder': {
    id: 'workflow-builder',
    title: 'Visual Workflow Builder',
    description: 'Create automated sequences with visual drag-and-drop',
    steps: [
      '1. Launch a campaign or create new workflow',
      '2. Click "Convert to Workflow" on Campaigns page',
      '3. Drag nodes onto canvas',
      '4. Connect nodes with edges',
      '5. Configure each node (message, timing)',
      '6. Add conditions (if replied, if opened)',
      '7. Set timing between steps (wait nodes)',
      '8. Preview the complete flow',
      '9. Test with sample contacts',
      '10. Publish workflow'
    ],
    tips: [
      '🔄 Multi-touch sequences increase response rates 2.5x',
      '⏱️ Wait 2-3 days between touches for better engagement',
      '🔀 Add conditions to branch based on responses',
      '📊 Monitor metrics at each step',
      '🎯 Segment contacts for targeted flows'
    ],
    relatedFeatures: ['campaign-creation', 'performance-tracking']
  },

  'performance-tracking': {
    id: 'performance-tracking',
    title: 'Track Campaign Performance',
    description: 'Monitor metrics and learn from campaign results',
    steps: [
      '1. Go to Campaigns page after launching',
      '2. View campaign status (Active, Completed)',
      '3. Check channel metrics (opens, clicks, replies)',
      '4. Compare to industry benchmarks',
      '5. Analyze top performing messages',
      '6. Review Sophia\'s recommendations',
      '7. Identify underperforming channels',
      '8. Adjust future campaigns based on data',
      '9. Monitor conversion pipeline',
      '10. Plan optimization strategy'
    ],
    tips: [
      '📧 Email average: 21.5% open rate, 2.6% click rate',
      '🔗 LinkedIn average: 15% connection rate, 10% reply rate',
      '📱 SMS average: 98% open rate, 45% response rate',
      '📈 Research shows personalization lifts revenue 26%',
      '🎯 Best time: Tuesday-Thursday, 10am-2pm'
    ],
    relatedFeatures: ['campaign-creation', 'research-insights']
  },

  'research-insights': {
    id: 'research-insights',
    title: 'Use Research Insights',
    description: 'Leverage industry benchmarks and best practices',
    steps: [
      '1. Sophia references research automatically',
      '2. See benchmarks for your selected channels',
      '3. Read best practice recommendations',
      '4. Understand why Sophia suggests tactics',
      '5. Apply recommended personalization',
      '6. Test recommended timing',
      '7. Use multi-channel strategy insights',
      '8. Reference competitor benchmarks',
      '9. Implement optimization strategies',
      '10. Track improvements'
    ],
    tips: [
      '🧠 Sophia combines YOUR data + research data',
      '📚 Research from HubSpot, Mailchimp, LinkedIn',
      '🎯 Personalization: 26% revenue lift (Experian)',
      '📊 Multi-channel: 3x conversion improvement',
      '✉️ A/B testing: 45% better open rates'
    ],
    relatedFeatures: ['campaign-creation', 'performance-tracking']
  },

  'sophia-features': {
    id: 'sophia-features',
    title: 'Meet Agent Sophia',
    description: 'Learn how Sophia helps you create better campaigns',
    steps: [
      '1. Sophia has a real brain with 3 systems',
      '2. Learning Brain: Learns from your campaigns',
      '3. Research Brain: Backed by industry data',
      '4. Validation Brain: Catches errors proactively',
      '5. She shows her thinking process (🧠)',
      '6. She makes data-backed recommendations',
      '7. She validates before campaign launch',
      '8. She suggests optimizations',
      '9. She remembers your preferences',
      '10. She gets smarter over time'
    ],
    tips: [
      '🧠 Sophia thinks like a real strategist',
      '💭 She shows reasoning: "Based on X campaigns + research..."',
      '✅ She validates workflows before launch',
      '🎯 She makes personalized recommendations',
      '📊 She learns from your results'
    ],
    relatedFeatures: ['campaign-creation', 'research-insights']
  }
};

// Tooltips for UI elements
export const UI_TOOLTIPS: Record<string, string> = {
  'select-channels': 'Choose which channels to use (Email, LinkedIn, SMS, etc.) for maximum reach',
  'product-description': 'What are you selling? Be specific - Sophia uses this to craft better messages',
  'target-audience': 'Who are you targeting? Role, company size, industry helps with personalization',
  'campaign-goal': 'What\'s your goal? (e.g., increase pipeline, book meetings, generate leads)',
  'lead-source': 'Where will contacts come from? Manual entry, LinkedIn, CSV upload, or your database',
  'message-versions': 'Sophia creates 2 versions per channel - test both to see what works best',
  'validation-check': 'Sophia checks everything before launch to prevent mistakes',
  'workflow-preview': 'See the complete flow before launching - includes timing and conditions',
  'performance-metrics': 'Track opens, clicks, replies - compare to benchmarks',
  'research-reference': 'Backed by industry research and data - learn why Sophia suggests something'
};

/**
 * Get onboarding steps for a feature
 */
export function getHelpTopic(topicId: string): HelpTopic | null {
  return HELP_TOPICS[topicId] || null;
}

/**
 * Get all available help topics
 */
export function getAllHelpTopics(): HelpTopic[] {
  return Object.values(HELP_TOPICS);
}

/**
 * Get contextual help for UI element
 */
export function getTooltip(elementId: string): string | null {
  return UI_TOOLTIPS[elementId] || null;
}

/**
 * Generate Sophia coaching message based on user action
 */
export function generateSophiaCoachingTip(action: string, context: any): string {
  const coachingMessages: Record<string, (ctx: any) => string> = {
    'campaign-started': (ctx) => `🎯 Great! I see you're creating a campaign. Here's my strategy: Select channels first (multi-channel gets 3x higher conversion), then tell me about your product and audience. I'll handle the rest!`,
    
    'channels-selected': (ctx) => {
      const channels = ctx.channels?.join(' + ') || 'your channels';
      return `💡 Smart choice with ${channels}! Here's what I know from research: This combo historically drives better results. Now, tell me about your product - I'll craft messages optimized for each channel.`;
    },
    
    'first-message-generated': (ctx) => `✅ Check out these message versions - I crafted 2 for each channel based on what works best. Feel free to edit them to match your voice. The more specific, the higher your response rate!`,
    
    'campaign-ready': (ctx) => `🚀 Everything looks great! I validated your workflow, checked your data, and confirmed all best practices. Ready to launch whenever you are!`,
    
    'campaign-completed': (ctx) => `📊 Campaign done! Here's what I learned: Your data is now part of my knowledge. Next time, I'll reference THIS campaign to make even better recommendations. Want to run another one?`,
    
    'viewing-metrics': (ctx) => `📈 Your performance vs benchmarks: Email (${ctx.emailOpen || '21.5'}% open rate - industry avg is 21.5%), LinkedIn (10% reply - industry avg is 10%). You're on track! Want optimization suggestions?`,
    
    'need-help': (ctx) => `👋 Need guidance? Here are the most useful resources: 1) Campaign Creation Guide, 2) Research Insights Explainer, 3) Workflow Tutorial. Which would help most?`,
  };

  return coachingMessages[action]?.(context) || '';
}

/**
 * Track user progress through onboarding
 */
export function trackUserProgress(userId: string, action: string): Partial<UserGuidanceState> {
  return {
    userId,
    completedSteps: [action]
  };
}

/**
 * Suggest next steps based on user progress
 */
export function suggestNextSteps(completedSteps: string[]): string[] {
  const allSteps = [
    'view-dashboard',
    'create-first-campaign',
    'select-channels',
    'generate-messages',
    'preview-workflow',
    'launch-campaign',
    'view-metrics',
    'learn-research'
  ];

  const suggestions: string[] = [];
  
  if (!completedSteps.includes('create-first-campaign')) {
    suggestions.push('Create your first campaign');
  }
  if (completedSteps.includes('create-first-campaign') && !completedSteps.includes('launch-campaign')) {
    suggestions.push('Launch your campaign');
  }
  if (completedSteps.includes('launch-campaign') && !completedSteps.includes('view-metrics')) {
    suggestions.push('Check your campaign metrics');
  }
  if (completedSteps.length > 3) {
    suggestions.push('Explore advanced workflows');
  }

  return suggestions;
}

/**
 * Generate onboarding checklist
 */
export function getOnboardingChecklist(): Array<{step: string; completed?: boolean; description: string}> {
  return [
    { step: 'Meet Sophia', completed: false, description: 'Learn about your AI strategist' },
    { step: 'Create First Campaign', completed: false, description: 'Build a multi-channel campaign' },
    { step: 'Launch Campaign', completed: false, description: 'Go live with your campaign' },
    { step: 'Check Metrics', completed: false, description: 'Track performance and results' },
    { step: 'Learn Research', completed: false, description: 'Understand industry benchmarks' },
    { step: 'Build Workflow', completed: false, description: 'Create visual automation sequence' },
    { step: 'Optimize Strategy', completed: false, description: 'Apply learnings from results' }
  ];
}
