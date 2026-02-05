/**
 * Sophia Self-Optimization Engine with Database Persistence
 */

import { createClient } from '@supabase/supabase-js';
import { getWorkspacePerformanceDB } from './workspace-learning-db';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Generate optimization strategies from database
 */
export async function generateOptimizationStrategiesDB(workspaceId: string) {
  try {
    const performance = await getWorkspacePerformanceDB(workspaceId);
    const strategies: any[] = [];

    // Channel optimization
    for (const [channel, metrics] of Object.entries(performance.channelMetrics)) {
      if (metrics.successRate < 0.2) {
        const strategy = {
          id: `strategy_${Date.now()}_${channel}`,
          workspace_id: workspaceId,
          type: 'messaging',
          title: `Improve ${channel} messaging`,
          description: `${channel} is underperforming (${(metrics.successRate * 100).toFixed(1)}% success rate).`,
          current_metric: metrics.successRate,
          expected_improvement: 0.35,
          implementation: `Run A/B test with 3 new message variations for ${channel}.`,
          status: 'proposed',
          confidence: 0.75,
        };

        // Save to database
        await supabase.from('optimization_strategies').insert(strategy);
        strategies.push(strategy);
      }
    }

    return strategies;
  } catch (error) {
    console.error('Error generating optimization strategies:', error);
    return [];
  }
}

/**
 * Get approved strategies from database
 */
export async function getApprovedStrategiesDB(workspaceId: string) {
  try {
    const { data: strategies, error } = await supabase
      .from('optimization_strategies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'approved');

    if (error) throw error;
    return strategies || [];
  } catch (error) {
    console.error('Error getting approved strategies:', error);
    return [];
  }
}

/**
 * Apply winning strategies in database
 */
export async function applyWinningStrategiesDB(workspaceId: string) {
  try {
    const approved = await getApprovedStrategiesDB(workspaceId);
    
    const applied = [];
    for (const strategy of approved) {
      await supabase
        .from('optimization_strategies')
        .update({ status: 'applied' })
        .eq('id', strategy.id);
      
      applied.push(strategy);
    }

    return {
      appliedStrategies: applied,
      totalExpectedLift: applied.reduce((sum, s) => sum + (s.expected_improvement * 100), 0)
    };
  } catch (error) {
    console.error('Error applying strategies:', error);
    return { appliedStrategies: [], totalExpectedLift: 0 };
  }
}

/**
 * Get optimization status
 */
export async function getOptimizationStatusDB(workspaceId: string) {
  try {
    const { data: allStrategies, error } = await supabase
      .from('optimization_strategies')
      .select('status')
      .eq('workspace_id', workspaceId);

    if (error) throw error;

    const strategies = allStrategies || [];
    return {
      totalStrategies: strategies.length,
      proposed: strategies.filter((s: any) => s.status === 'proposed').length,
      testing: strategies.filter((s: any) => s.status === 'testing').length,
      approved: strategies.filter((s: any) => s.status === 'approved').length,
      applied: strategies.filter((s: any) => s.status === 'applied').length,
      totalExpectedLift: 0
    };
  } catch (error) {
    console.error('Error getting optimization status:', error);
    return { totalStrategies: 0, proposed: 0, testing: 0, approved: 0, applied: 0, totalExpectedLift: 0 };
  }
}
