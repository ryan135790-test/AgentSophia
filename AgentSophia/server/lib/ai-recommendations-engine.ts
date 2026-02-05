/**
 * AI Recommendations Engine
 * Generate Sophia's smart recommendations for next campaign
 */

export interface AIRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  recommendation: string;
  reasoning: string;
  expected_impact: string;
  action: string;
}

export function generateAIRecommendations(learning: any): AIRecommendation[] {
  const recs: AIRecommendation[] = [];

  // Channel recommendations
  if (learning.best_channel === 'Email') {
    recs.push({
      priority: 'high',
      category: 'Channel Strategy',
      recommendation: 'Add SMS to your next campaign',
      reasoning: 'SMS has 45% reply rate vs email 2.6%. Combined = 3x conversion.',
      expected_impact: '3x higher reply rate',
      action: 'Use Email + SMS in next campaign'
    });
  }

  // Content recommendations
  if (learning.avg_open_rate < 20) {
    recs.push({
      priority: 'high',
      category: 'Message Content',
      recommendation: 'A/B test subject lines',
      reasoning: `Your open rate is ${learning.avg_open_rate.toFixed(1)}% (under 21.5% benchmark)`,
      expected_impact: '15-20% improvement in open rates',
      action: 'Create 2 subject line variations for next campaign'
    });
  }

  if (learning.avg_reply_rate > 10) {
    recs.push({
      priority: 'high',
      category: 'Growth Strategy',
      recommendation: 'Scale successful campaign to larger audience',
      reasoning: 'Your reply rate is exceptional. Time to scale.',
      expected_impact: '2-3x more replies',
      action: 'Run same campaign to 2x larger audience'
    });
  }

  // Sequence recommendations
  if (learning.total_campaigns >= 3) {
    recs.push({
      priority: 'medium',
      category: 'Campaign Structure',
      recommendation: 'Try multi-touch sequences',
      reasoning: 'Data shows 5-7 touches warm up cold leads 2.5x better',
      expected_impact: '2.5x conversion improvement',
      action: 'Build 3-email sequence in workflow builder'
    });
  }

  // Time recommendations
  recs.push({
    priority: 'medium',
    category: 'Timing',
    recommendation: 'Send campaigns Tue-Thu, 10am-2pm',
    reasoning: 'Research shows 20% higher engagement in these windows',
    expected_impact: '20% higher engagement',
    action: 'Schedule next campaign for optimal time'
  });

  // Personalization
  recs.push({
    priority: 'high',
    category: 'Personalization',
    recommendation: 'Use [FirstName], [Company], [Role] tags',
    reasoning: 'Personalization lifts response by 26% (Experian)',
    expected_impact: '26% revenue lift',
    action: 'Add personal tags to all messages'
  });

  return recs.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Get priority action for user
 */
export function getPriorityAction(recs: AIRecommendation[]): AIRecommendation | null {
  return recs.find(r => r.priority === 'high') || recs[0] || null;
}
