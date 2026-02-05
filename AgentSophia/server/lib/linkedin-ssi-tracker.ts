export interface SSIScore {
  overall: number;
  professionalBrand: number;
  findingPeople: number;
  engagingInsights: number;
  buildingRelationships: number;
  recordedAt: Date;
}

export interface SSIHistory {
  workspaceId: string;
  linkedInAccountId: string;
  scores: SSIScore[];
  industryRank?: number;
  networkRank?: number;
}

export interface SSITrend {
  period: '7d' | '30d' | '90d';
  overallChange: number;
  breakdown: {
    professionalBrand: number;
    findingPeople: number;
    engagingInsights: number;
    buildingRelationships: number;
  };
  trend: 'improving' | 'stable' | 'declining';
}

export interface SSIBenchmark {
  industry: string;
  averageScore: number;
  topPerformerScore: number;
  percentile: number;
}

export interface SSIRecommendation {
  pillar: 'professionalBrand' | 'findingPeople' | 'engagingInsights' | 'buildingRelationships';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  actions: string[];
}

const ssiHistories = new Map<string, SSIHistory>();

export function recordSSIScore(
  workspaceId: string,
  linkedInAccountId: string,
  score: Omit<SSIScore, 'recordedAt'>,
  industryRank?: number,
  networkRank?: number
): SSIScore {
  const key = `${workspaceId}:${linkedInAccountId}`;
  const history = ssiHistories.get(key) || {
    workspaceId,
    linkedInAccountId,
    scores: [],
  };

  const newScore: SSIScore = {
    ...score,
    recordedAt: new Date(),
  };

  history.scores.push(newScore);
  if (industryRank !== undefined) history.industryRank = industryRank;
  if (networkRank !== undefined) history.networkRank = networkRank;

  if (history.scores.length > 365) {
    history.scores = history.scores.slice(-365);
  }

  ssiHistories.set(key, history);
  return newScore;
}

export function getLatestSSI(workspaceId: string, linkedInAccountId: string): SSIScore | null {
  const key = `${workspaceId}:${linkedInAccountId}`;
  const history = ssiHistories.get(key);

  if (!history || history.scores.length === 0) return null;
  return history.scores[history.scores.length - 1];
}

export function getSSIHistory(
  workspaceId: string,
  linkedInAccountId: string,
  days: number = 30
): SSIScore[] {
  const key = `${workspaceId}:${linkedInAccountId}`;
  const history = ssiHistories.get(key);

  if (!history) return [];

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return history.scores.filter(s => s.recordedAt > cutoff);
}

export function calculateSSITrend(
  workspaceId: string,
  linkedInAccountId: string,
  period: '7d' | '30d' | '90d' = '30d'
): SSITrend | null {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const scores = getSSIHistory(workspaceId, linkedInAccountId, days);

  if (scores.length < 2) return null;

  const first = scores[0];
  const last = scores[scores.length - 1];

  const overallChange = last.overall - first.overall;
  const breakdown = {
    professionalBrand: last.professionalBrand - first.professionalBrand,
    findingPeople: last.findingPeople - first.findingPeople,
    engagingInsights: last.engagingInsights - first.engagingInsights,
    buildingRelationships: last.buildingRelationships - first.buildingRelationships,
  };

  let trend: 'improving' | 'stable' | 'declining';
  if (overallChange > 2) trend = 'improving';
  else if (overallChange < -2) trend = 'declining';
  else trend = 'stable';

  return { period, overallChange, breakdown, trend };
}

export function getSSIRecommendations(score: SSIScore): SSIRecommendation[] {
  const recommendations: SSIRecommendation[] = [];

  if (score.professionalBrand < 20) {
    recommendations.push({
      pillar: 'professionalBrand',
      priority: 'high',
      title: 'Strengthen Your Professional Brand',
      description: 'Your profile visibility and content engagement need improvement.',
      impact: 'Could increase SSI by 5-10 points',
      actions: [
        'Complete all profile sections (headline, summary, experience)',
        'Add a professional profile photo and banner',
        'Publish 2-3 long-form articles per month',
        'Get endorsements for your top 5 skills',
        'Request recommendations from colleagues',
      ],
    });
  } else if (score.professionalBrand < 18) {
    recommendations.push({
      pillar: 'professionalBrand',
      priority: 'medium',
      title: 'Enhance Your Profile Visibility',
      description: 'Good foundation, but room to improve content presence.',
      impact: 'Could increase SSI by 3-5 points',
      actions: [
        'Post thought leadership content weekly',
        'Engage with industry hashtags',
        'Share company updates with insights',
      ],
    });
  }

  if (score.findingPeople < 20) {
    recommendations.push({
      pillar: 'findingPeople',
      priority: 'high',
      title: 'Improve Prospect Research',
      description: 'You\'re not utilizing LinkedIn\'s search tools effectively.',
      impact: 'Could increase SSI by 5-8 points',
      actions: [
        'Use Sales Navigator for advanced searches',
        'Save and organize lead lists',
        'Set up lead recommendations and alerts',
        'Use Boolean search operators for precision',
        'Explore 2nd/3rd degree connections strategically',
      ],
    });
  }

  if (score.engagingInsights < 18) {
    recommendations.push({
      pillar: 'engagingInsights',
      priority: 'medium',
      title: 'Boost Content Engagement',
      description: 'Increase your engagement with relevant content.',
      impact: 'Could increase SSI by 4-6 points',
      actions: [
        'Comment on 5-10 posts daily with valuable insights',
        'Share industry news with your perspective',
        'Join and participate in relevant groups',
        'Respond to comments on your own posts',
        'Use LinkedIn\'s content suggestion feature',
      ],
    });
  }

  if (score.buildingRelationships < 18) {
    recommendations.push({
      pillar: 'buildingRelationships',
      priority: 'medium',
      title: 'Strengthen Network Relationships',
      description: 'Focus on building deeper connections with your network.',
      impact: 'Could increase SSI by 4-7 points',
      actions: [
        'Send personalized connection requests',
        'Follow up with new connections via message',
        'Engage with decision-makers in target accounts',
        'Congratulate connections on work anniversaries',
        'Request introductions through mutual connections',
      ],
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      pillar: 'professionalBrand',
      priority: 'low',
      title: 'Maintain Your Strong Performance',
      description: 'Your SSI is excellent. Focus on consistency.',
      impact: 'Maintain top-tier status',
      actions: [
        'Continue regular content publishing',
        'Keep engaging with your network',
        'Share wins and case studies',
        'Mentor others in your network',
      ],
    });
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function estimateSSI(activityMetrics: {
  profileCompleteness: number;
  weeklyPosts: number;
  weeklyComments: number;
  connectionsSent: number;
  connectionsAccepted: number;
  profileViews: number;
  searchAppearances: number;
}): SSIScore {
  let professionalBrand = 5;
  professionalBrand += Math.min(activityMetrics.profileCompleteness / 5, 10);
  professionalBrand += Math.min(activityMetrics.weeklyPosts * 1.5, 5);
  professionalBrand += Math.min(activityMetrics.profileViews / 20, 5);

  let findingPeople = 5;
  findingPeople += Math.min(activityMetrics.searchAppearances / 10, 10);
  findingPeople += Math.min(activityMetrics.connectionsSent / 5, 10);

  let engagingInsights = 5;
  engagingInsights += Math.min(activityMetrics.weeklyComments * 0.5, 10);
  engagingInsights += Math.min(activityMetrics.weeklyPosts * 2, 10);

  let buildingRelationships = 5;
  const acceptanceRate = activityMetrics.connectionsSent > 0
    ? activityMetrics.connectionsAccepted / activityMetrics.connectionsSent
    : 0;
  buildingRelationships += acceptanceRate * 15;
  buildingRelationships += Math.min(activityMetrics.connectionsAccepted / 2, 5);

  professionalBrand = Math.min(Math.round(professionalBrand), 25);
  findingPeople = Math.min(Math.round(findingPeople), 25);
  engagingInsights = Math.min(Math.round(engagingInsights), 25);
  buildingRelationships = Math.min(Math.round(buildingRelationships), 25);

  return {
    overall: professionalBrand + findingPeople + engagingInsights + buildingRelationships,
    professionalBrand,
    findingPeople,
    engagingInsights,
    buildingRelationships,
    recordedAt: new Date(),
  };
}

export function getSSIDashboardData(workspaceId: string, linkedInAccountId: string): {
  current: SSIScore | null;
  history: SSIScore[];
  trend7d: SSITrend | null;
  trend30d: SSITrend | null;
  recommendations: SSIRecommendation[];
  industryRank?: number;
  networkRank?: number;
} {
  const key = `${workspaceId}:${linkedInAccountId}`;
  const history = ssiHistories.get(key);

  const current = getLatestSSI(workspaceId, linkedInAccountId);
  const scores = getSSIHistory(workspaceId, linkedInAccountId, 90);
  const trend7d = calculateSSITrend(workspaceId, linkedInAccountId, '7d');
  const trend30d = calculateSSITrend(workspaceId, linkedInAccountId, '30d');
  const recommendations = current ? getSSIRecommendations(current) : [];

  return {
    current,
    history: scores,
    trend7d,
    trend30d,
    recommendations,
    industryRank: history?.industryRank,
    networkRank: history?.networkRank,
  };
}

export function getAllSSIScores(workspaceId: string): Array<{
  linkedInAccountId: string;
  current: SSIScore | null;
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}> {
  const results: Array<{
    linkedInAccountId: string;
    current: SSIScore | null;
    trend: 'improving' | 'stable' | 'declining' | 'unknown';
  }> = [];

  for (const [key, history] of ssiHistories.entries()) {
    if (!key.startsWith(`${workspaceId}:`)) continue;

    const current = history.scores.length > 0 ? history.scores[history.scores.length - 1] : null;
    const trendData = calculateSSITrend(workspaceId, history.linkedInAccountId, '7d');

    results.push({
      linkedInAccountId: history.linkedInAccountId,
      current,
      trend: trendData?.trend || 'unknown',
    });
  }

  return results;
}
