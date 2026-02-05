/**
 * Workspace Learning Insights
 * Tracks campaign performance patterns and generates smart insights
 */

export interface CampaignInsight {
  metric: string;
  value: number | string;
  trend: 'up' | 'down' | 'stable';
  benchmark: number;
  actionable_tip: string;
}

export interface WorkspaceLearning {
  total_campaigns: number;
  avg_open_rate: number;
  avg_reply_rate: number;
  avg_click_rate: number;
  best_channel: string;
  best_time_to_send: string;
  best_template_type: string;
  top_performing_subject_lines: string[];
  insights: CampaignInsight[];
  recommendations: string[];
  next_campaign_suggestion: string;
}

/**
 * Generate workspace learning insights from campaign data
 */
export function generateWorkspaceLearning(campaigns: any[]): WorkspaceLearning {
  if (campaigns.length === 0) {
    return {
      total_campaigns: 0,
      avg_open_rate: 0,
      avg_reply_rate: 0,
      avg_click_rate: 0,
      best_channel: 'Not enough data',
      best_time_to_send: 'Not enough data',
      best_template_type: 'Not enough data',
      top_performing_subject_lines: [],
      insights: [],
      recommendations: [
        '📧 Create your first campaign to start learning',
        '🔍 I\'ll track opens, clicks, and replies',
        '📊 After 3-5 campaigns, I\'ll show patterns',
        '🎯 Then I\'ll recommend next steps'
      ],
      next_campaign_suggestion: 'Create your first campaign!'
    };
  }

  // Calculate averages
  const avgOpenRate = campaigns.reduce((sum, c) => sum + (c.open_rate || 0), 0) / campaigns.length;
  const avgReplyRate = campaigns.reduce((sum, c) => sum + (c.reply_rate || 0), 0) / campaigns.length;
  const avgClickRate = campaigns.reduce((sum, c) => sum + (c.click_rate || 0), 0) / campaigns.length;

  // Find best channel
  const channelPerformance: Record<string, { count: number; opens: number; replies: number }> = {};
  campaigns.forEach(c => {
    if (!channelPerformance[c.channel]) {
      channelPerformance[c.channel] = { count: 0, opens: 0, replies: 0 };
    }
    channelPerformance[c.channel].count++;
    channelPerformance[c.channel].opens += c.open_rate || 0;
    channelPerformance[c.channel].replies += c.reply_rate || 0;
  });

  const bestChannel = Object.entries(channelPerformance).sort(
    (a, b) => (b[1].replies / b[1].count) - (a[1].replies / a[1].count)
  )[0]?.[0] || 'Email';

  // Generate insights
  const insights: CampaignInsight[] = [
    {
      metric: 'Average Open Rate',
      value: `${avgOpenRate.toFixed(1)}%`,
      trend: avgOpenRate > 25 ? 'up' : avgOpenRate > 15 ? 'stable' : 'down',
      benchmark: 21.5,
      actionable_tip: avgOpenRate > 25 ? '🎉 Crushing benchmark! Keep this formula.' : '💡 Try A/B testing subject lines'
    },
    {
      metric: 'Average Reply Rate',
      value: `${avgReplyRate.toFixed(1)}%`,
      trend: avgReplyRate > 10 ? 'up' : avgReplyRate > 5 ? 'stable' : 'down',
      benchmark: 2.6,
      actionable_tip: avgReplyRate > 10 ? '🚀 Excellent! People are responding!' : '💬 Make messages more personal'
    },
    {
      metric: 'Average Click Rate',
      value: `${avgClickRate.toFixed(1)}%`,
      trend: avgClickRate > 3 ? 'up' : avgClickRate > 1 ? 'stable' : 'down',
      benchmark: 2.6,
      actionable_tip: avgClickRate > 3 ? '✅ Strong CTAs are working' : '🖱️ Make CTAs more obvious'
    }
  ];

  // Generate recommendations
  const recommendations: string[] = [];
  if (avgOpenRate < 20) recommendations.push('📧 Optimize subject lines with A/B testing');
  if (avgReplyRate < 5) recommendations.push('💬 Make messages shorter and more personal');
  if (avgClickRate < 2) recommendations.push('🖱️ Use bigger CTAs, clear value prop');
  if (campaigns.length < 5) recommendations.push('🚀 Run more campaigns - more data = better learning');
  if (bestChannel === 'Email' && campaigns.length > 2) recommendations.push('📱 Try adding SMS - 45% reply rate!');
  if (recommendations.length === 0) {
    recommendations.push('🎯 You\'re performing great! Try scaling to larger audiences');
    recommendations.push('🔄 Test multi-channel campaigns - 3x conversion!');
    recommendations.push('🧪 Experiment with different messaging styles');
  }

  // Next campaign suggestion
  let nextCampaignSuggestion = '';
  if (campaigns.length === 1) {
    nextCampaignSuggestion = '🚀 Now that I\'ve seen one campaign, let\'s run similar one to new audience';
  } else if (campaigns.length < 5) {
    nextCampaignSuggestion = `📊 You\'ve run ${campaigns.length} campaigns. One more will show clear patterns!`;
  } else if (avgReplyRate > 10) {
    nextCampaignSuggestion = '🎉 Your strategy is working! Scale it to 2x larger audience';
  } else {
    nextCampaignSuggestion = '🔄 Try adding another channel to your best-performing campaign';
  }

  return {
    total_campaigns: campaigns.length,
    avg_open_rate: avgOpenRate,
    avg_reply_rate: avgReplyRate,
    avg_click_rate: avgClickRate,
    best_channel: bestChannel,
    best_time_to_send: 'Tues-Thurs, 10am-2pm',
    best_template_type: campaigns.length > 2 ? 'Multi-touch sequence' : 'Single email + follow-up',
    top_performing_subject_lines: campaigns
      .filter(c => c.subject && c.open_rate > avgOpenRate)
      .map(c => c.subject)
      .slice(0, 3),
    insights,
    recommendations,
    next_campaign_suggestion: nextCampaignSuggestion
  };
}

/**
 * Get Sophia's learning summary
 */
export function getSophiaLearningMessage(learning: WorkspaceLearning): string {
  if (learning.total_campaigns === 0) {
    return "🧠 I'm ready to learn from your campaigns! Create your first one and I'll start tracking patterns.";
  }

  if (learning.total_campaigns === 1) {
    return `I've analyzed 1 campaign so far. My initial observation: ${learning.insights[1]?.actionable_tip}. Run one more and I'll start seeing patterns!`;
  }

  if (learning.total_campaigns < 5) {
    return `📊 I've learned from ${learning.total_campaigns} campaigns. Pattern emerging: ${learning.best_channel} works best for you. Let's do ${5 - learning.total_campaigns} more to solidify the strategy!`;
  }

  return `🧠 I've now analyzed ${learning.total_campaigns} campaigns. Here's my learned strategy for you: Focus on ${learning.best_channel}, optimize for ${learning.insights.find(i => i.metric === 'Average Reply Rate')?.value} reply rate, and scale what's working!`;
}

/**
 * Track what Sophia has learned
 */
export function getLearningProgressItems(learning: WorkspaceLearning): Array<{
  category: string;
  learned: string;
  icon: string;
}> {
  const items = [];

  if (learning.total_campaigns > 0) {
    items.push({
      category: 'Best Channel',
      learned: learning.best_channel,
      icon: '📡'
    });
  }

  if (learning.avg_open_rate > 0) {
    items.push({
      category: 'Open Rate Trend',
      learned: `${learning.avg_open_rate.toFixed(1)}% (vs 21.5% benchmark)`,
      icon: '📖'
    });
  }

  if (learning.avg_reply_rate > 0) {
    items.push({
      category: 'Reply Rate Trend',
      learned: `${learning.avg_reply_rate.toFixed(1)}% (vs 2.6% benchmark)`,
      icon: '💬'
    });
  }

  if (learning.best_template_type) {
    items.push({
      category: 'Best Template',
      learned: learning.best_template_type,
      icon: '🎨'
    });
  }

  if (learning.best_time_to_send) {
    items.push({
      category: 'Best Sending Time',
      learned: learning.best_time_to_send,
      icon: '⏰'
    });
  }

  return items;
}
