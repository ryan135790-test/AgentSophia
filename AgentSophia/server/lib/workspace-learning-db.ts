/**
 * Workspace Learning System with Database Persistence
 * Stores performance data in PostgreSQL via Supabase
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  insights: string[];
}

/**
 * Log performance metric to database
 */
export async function logPerformanceMetricDB(
  workspaceId: string,
  metric: {
    actionType: string;
    channel: string;
    metric: string;
    value: number;
  }
): Promise<void> {
  try {
    await supabase.from('performance_metrics').insert({
      workspace_id: workspaceId,
      action_type: metric.actionType,
      channel: metric.channel,
      metric: metric.metric,
      value: metric.value,
    });
    console.log(`📊 Performance logged (DB): ${workspaceId}/${metric.channel}`);
  } catch (error) {
    console.error('Error logging performance metric:', error);
  }
}

/**
 * Get workspace performance from database
 */
export async function getWorkspacePerformanceDB(workspaceId: string): Promise<WorkspacePerformance> {
  try {
    const { data: metrics, error } = await supabase
      .from('performance_metrics')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    if (!metrics || metrics.length === 0) {
      return {
        workspaceId,
        totalCampaigns: 0,
        totalMessagesSet: 0,
        channelMetrics: {},
        insights: ['No performance data yet. Start campaigns to build learning data.']
      };
    }

    // Calculate channel metrics
    const channelMetrics: WorkspacePerformance['channelMetrics'] = {};
    const channels = new Set(metrics.map((m: any) => m.channel));

    for (const channel of channels) {
      const channelData = metrics.filter((m: any) => m.channel === channel);
      const successMetrics = channelData.filter((m: any) => m.metric.includes('rate'));

      channelMetrics[channel as string] = {
        successRate: successMetrics.length > 0
          ? successMetrics.reduce((sum: number, m: any) => sum + m.value, 0) / successMetrics.length
          : 0,
      };
    }

    const insights = generateInsights(metrics, channelMetrics);

    return {
      workspaceId,
      totalCampaigns: metrics.filter((m: any) => m.action_type === 'campaign').length,
      totalMessagesSet: metrics.filter((m: any) => m.action_type === 'message').length,
      channelMetrics,
      insights
    };
  } catch (error) {
    console.error('Error getting workspace performance:', error);
    return {
      workspaceId,
      totalCampaigns: 0,
      totalMessagesSet: 0,
      channelMetrics: {},
      insights: ['Error loading performance data']
    };
  }
}

/**
 * Get performance recommendations
 */
export async function getPerformanceRecommendationsDB(workspaceId: string): Promise<string[]> {
  const performance = await getWorkspacePerformanceDB(workspaceId);
  const recommendations: string[] = [];

  let bestChannel = '';
  let bestRate = 0;
  for (const [channel, metrics] of Object.entries(performance.channelMetrics)) {
    if (metrics.successRate > bestRate) {
      bestRate = metrics.successRate;
      bestChannel = channel;
    }
  }

  if (bestChannel && bestRate > 0) {
    recommendations.push(`📈 ${bestChannel} is your top performer (${(bestRate * 100).toFixed(1)}% success rate).`);
  }

  for (const [channel, metrics] of Object.entries(performance.channelMetrics)) {
    if (metrics.successRate < 0.05 && metrics.successRate > 0) {
      recommendations.push(`⚠️ ${channel} has low engagement. Try different messaging.`);
    }
  }

  if (recommendations.length === 0) {
    recommendations.push('Continue running campaigns to build more performance data.');
  }

  return recommendations;
}

/**
 * Generate Sophia context from database
 */
export async function generateSophiaContextForWorkspaceDB(workspaceId: string): Promise<string> {
  const performance = await getWorkspacePerformanceDB(workspaceId);
  const recommendations = await getPerformanceRecommendationsDB(workspaceId);

  let context = `## Workspace Performance Context (Live from Database)\n\n`;

  context += `### What's Working\n`;
  for (const [channel, metrics] of Object.entries(performance.channelMetrics)) {
    context += `- ${channel}: ${(metrics.successRate * 100).toFixed(1)}% success rate\n`;
  }

  context += `\n### Recommendations\n`;
  recommendations.forEach(rec => {
    context += `- ${rec}\n`;
  });

  return context;
}

function generateInsights(metrics: any[], channelMetrics: any): string[] {
  const insights: string[] = [];
  
  if (metrics.length < 5) {
    insights.push(`🚀 Getting started: ${metrics.length} data points collected.`);
  } else {
    insights.push(`📊 Analyzing ${metrics.length} performance data points.`);
  }

  const activeChannels = Object.keys(channelMetrics).length;
  if (activeChannels > 1) {
    insights.push(`🎯 Multi-channel approach detected (${activeChannels} channels).`);
  }

  return insights;
}
