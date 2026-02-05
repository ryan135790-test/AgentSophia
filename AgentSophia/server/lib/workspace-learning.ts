/**
 * Workspace Learning System
 * Tracks performance data so Agent Sophia can learn and improve per workspace
 * Now with database persistence!
 */

import { db } from './db-service';

export interface PerformanceMetric {
  workspaceId: string;
  actionType: 'campaign' | 'message' | 'meeting' | 'follow_up';
  channel: 'email' | 'linkedin' | 'sms' | 'phone';
  metric: string; // 'open_rate', 'click_rate', 'reply_rate', 'conversion_rate', 'booking_rate'
  value: number;
  timestamp: string;
}

export interface WorkspaceLearningData {
  performanceMetrics: PerformanceMetric[];
  lastUpdated: string;
}

export interface WorkspacePerformance {
  workspaceId: string;
  totalCampaigns: number;
  totalMessagesSet: number;
  channelMetrics: {
    [channel: string]: {
      successRate: number;
      averageOpenRate?: number;
      averageClickRate?: number;
      averageReplyRate?: number;
      averageConversionRate?: number;
    };
  };
  topPerformingTemplates: Array<{ templateId: string; successRate: number }>;
  bestTimeToSend?: string; // e.g., "Tuesday 10:00 AM"
  insights: string[];
}

// In-memory cache for fast reads (backed by database for persistence)
const performanceCache: Map<string, WorkspacePerformance> = new Map();

/**
 * Log a performance metric for a workspace (with database persistence)
 */
export async function logPerformanceMetric(workspaceId: string, metric: Omit<PerformanceMetric, 'workspaceId' | 'timestamp'>): Promise<void> {
  const fullMetric: PerformanceMetric = {
    ...metric,
    workspaceId,
    timestamp: new Date().toISOString()
  };

  try {
    // Load existing data from database
    const existingData = await db.getWorkspaceLearning(workspaceId);
    const learningData: WorkspaceLearningData = existingData || {
      performanceMetrics: [],
      lastUpdated: new Date().toISOString()
    };

    // Add new metric
    learningData.performanceMetrics.push(fullMetric);
    learningData.lastUpdated = new Date().toISOString();

    // Save back to database
    await db.saveWorkspaceLearning(workspaceId, learningData);
    
    // Invalidate cache so it gets recalculated
    performanceCache.delete(workspaceId);

    console.log(`📊 Performance logged to DB for ${workspaceId}: ${metric.actionType}/${metric.channel} - ${metric.metric}: ${metric.value}`);
  } catch (error) {
    console.error('Failed to log performance metric:', error);
  }
}

/**
 * Get workspace performance summary for Agent Sophia's brain (with database persistence)
 */
export async function getWorkspacePerformance(workspaceId: string): Promise<WorkspacePerformance> {
  // Check cache first
  if (performanceCache.has(workspaceId)) {
    return performanceCache.get(workspaceId)!;
  }

  // Load from database
  let metrics: PerformanceMetric[] = [];
  try {
    const learningData = await db.getWorkspaceLearning(workspaceId);
    metrics = learningData?.performanceMetrics || [];
  } catch (error) {
    console.error('Failed to load workspace learning data:', error);
  }

  if (metrics.length === 0) {
    return {
      workspaceId,
      totalCampaigns: 0,
      totalMessagesSet: 0,
      channelMetrics: {},
      topPerformingTemplates: [],
      insights: ['No performance data yet. Start campaigns to build learning data.']
    };
  }

  // Calculate channel metrics
  const channelMetrics: WorkspacePerformance['channelMetrics'] = {};
  const channels = new Set(metrics.map(m => m.channel));

  for (const channel of channels) {
    const channelData = metrics.filter(m => m.channel === channel);
    const successMetrics = channelData.filter(m => m.metric.includes('rate'));

    channelMetrics[channel] = {
      successRate: successMetrics.length > 0
        ? successMetrics.reduce((sum, m) => sum + m.value, 0) / successMetrics.length
        : 0,
      averageOpenRate: calculateAverage(channelData, 'open_rate'),
      averageClickRate: calculateAverage(channelData, 'click_rate'),
      averageReplyRate: calculateAverage(channelData, 'reply_rate'),
      averageConversionRate: calculateAverage(channelData, 'conversion_rate'),
    };
  }

  // Generate insights
  const insights = generateInsights(metrics, channelMetrics);

  const performance: WorkspacePerformance = {
    workspaceId,
    totalCampaigns: metrics.filter(m => m.actionType === 'campaign').length,
    totalMessagesSet: metrics.filter(m => m.actionType === 'message').length,
    channelMetrics,
    topPerformingTemplates: [],
    insights
  };

  // Cache for 1 hour
  performanceCache.set(workspaceId, performance);
  return performance;
}

/**
 * Get recommendations for Agent Sophia to improve
 */
export async function getPerformanceRecommendations(workspaceId: string): Promise<string[]> {
  const performance = await getWorkspacePerformance(workspaceId);
  const recommendations: string[] = [];

  // Find best performing channel
  let bestChannel = '';
  let bestRate = 0;
  for (const [channel, metrics] of Object.entries(performance.channelMetrics)) {
    if (metrics.successRate > bestRate) {
      bestRate = metrics.successRate;
      bestChannel = channel;
    }
  }

  if (bestChannel && bestRate > 0) {
    recommendations.push(`📈 ${bestChannel} is your top performer (${(bestRate * 100).toFixed(1)}% success rate). Consider prioritizing it.`);
  }

  // Find underperforming channels
  for (const [channel, metrics] of Object.entries(performance.channelMetrics)) {
    if (metrics.successRate < 0.05 && metrics.successRate > 0) {
      recommendations.push(`⚠️ ${channel} has low engagement. Try different messaging or timing.`);
    }
  }

  // Email-specific recommendations
  const emailMetrics = performance.channelMetrics['email'];
  if (emailMetrics?.averageOpenRate && emailMetrics.averageOpenRate < 0.25) {
    recommendations.push(`✉️ Email open rate (${(emailMetrics.averageOpenRate * 100).toFixed(1)}%) is below benchmark. Test new subject lines.`);
  }

  // LinkedIn recommendations
  const linkedinMetrics = performance.channelMetrics['linkedin'];
  if (linkedinMetrics?.averageReplyRate && linkedinMetrics.averageReplyRate > 0.1) {
    recommendations.push(`🔗 LinkedIn is driving conversations (${(linkedinMetrics.averageReplyRate * 100).toFixed(1)}% reply rate). Double down here.`);
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue running campaigns to build more performance data for recommendations.');
  }

  return recommendations;
}

function calculateAverage(metrics: PerformanceMetric[], metricName: string): number | undefined {
  const filtered = metrics.filter(m => m.metric === metricName);
  if (filtered.length === 0) return undefined;
  return filtered.reduce((sum, m) => sum + m.value, 0) / filtered.length;
}

function generateInsights(metrics: PerformanceMetric[], channelMetrics: WorkspacePerformance['channelMetrics']): string[] {
  const insights: string[] = [];

  const totalMetrics = metrics.length;
  if (totalMetrics < 5) {
    insights.push(`🚀 Getting started: ${totalMetrics} data points collected. Keep running campaigns for better recommendations.`);
  } else {
    insights.push(`📊 Analyzing ${totalMetrics} performance data points across campaigns.`);
  }

  const activeChannels = Object.keys(channelMetrics).length;
  if (activeChannels > 1) {
    insights.push(`🎯 Multi-channel approach detected (${activeChannels} channels). Optimizing mix...`);
  }

  return insights;
}

/**
 * Export workspace learning data for Agent Sophia's system prompt injection
 */
export async function generateSophiaContextForWorkspace(workspaceId: string): Promise<string> {
  const performance = await getWorkspacePerformance(workspaceId);
  const recommendations = await getPerformanceRecommendations(workspaceId);

  let context = `## Workspace Performance Context for ${workspaceId}\n\n`;

  context += `### What's Working\n`;
  for (const [channel, metrics] of Object.entries(performance.channelMetrics)) {
    context += `- ${channel}: ${(metrics.successRate * 100).toFixed(1)}% success rate\n`;
  }

  context += `\n### Recommendations\n`;
  recommendations.forEach(rec => {
    context += `- ${rec}\n`;
  });

  context += `\n### Guidelines\n`;
  context += `- Prioritize channels with higher success rates\n`;
  context += `- Test new messaging when a channel drops below 5% success rate\n`;
  context += `- Scale what works: increase frequency on high-performing channels\n`;

  return context;
}
