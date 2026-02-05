/**
 * Sophia's Self-Learning Engine
 * Tracks decision outcomes, learns patterns, improves autonomy
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

export interface DecisionOutcome {
  decision_id: string;
  action_type: string; // send_email, send_sms, book_meeting, etc
  workspace_id: string;
  contact_id: string;
  campaign_id: string;
  initial_confidence: number; // 0-100
  outcome: 'success' | 'failure' | 'neutral'; // Based on response
  response_time?: number; // ms
  engagement_signal?: string; // opened, clicked, replied, etc
  metadata?: Record<string, any>;
}

export interface ConfidenceModel {
  action_type: string;
  total_decisions: number;
  successful_decisions: number;
  success_rate: number;
  average_confidence: number;
  min_confidence_for_auto: number; // Dynamic threshold
  recent_accuracy: number; // Last 20 decisions
}

/**
 * Log decision outcome for learning
 */
export async function logDecisionOutcome(outcome: DecisionOutcome): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO decision_outcomes 
       (decision_id, action_type, workspace_id, contact_id, campaign_id, 
        initial_confidence, outcome, response_time, engagement_signal, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
      [
        outcome.decision_id,
        outcome.action_type,
        outcome.workspace_id,
        outcome.contact_id,
        outcome.campaign_id,
        outcome.initial_confidence,
        outcome.outcome,
        outcome.response_time,
        outcome.engagement_signal,
        JSON.stringify(outcome.metadata),
      ]
    );
  } catch (error) {
    console.error('Error logging decision outcome:', error);
  }
}

/**
 * Calculate confidence model for action type
 */
export async function getConfidenceModel(
  workspaceId: string,
  actionType: string
): Promise<ConfidenceModel> {
  try {
    const result = await pool.query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successful,
        AVG(initial_confidence) as avg_confidence,
        (SELECT AVG(CASE WHEN outcome = 'success' THEN 100 ELSE 0 END)
         FROM decision_outcomes 
         WHERE action_type = $1 AND workspace_id = $2 
         ORDER BY created_at DESC LIMIT 20) as recent_accuracy
       FROM decision_outcomes 
       WHERE action_type = $1 AND workspace_id = $2`,
      [actionType, workspaceId]
    );

    const row = result.rows[0] || {};
    const total = parseInt(row.total) || 0;
    const successful = parseInt(row.successful) || 0;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    // Dynamic threshold: lower when success rate is high, higher when uncertain
    const minConfidence = Math.max(60, Math.min(85, 100 - (successRate * 0.2)));

    return {
      action_type: actionType,
      total_decisions: total,
      successful_decisions: successful,
      success_rate: Math.round(successRate),
      average_confidence: Math.round(parseFloat(row.avg_confidence) || 0),
      min_confidence_for_auto: Math.round(minConfidence),
      recent_accuracy: Math.round(parseFloat(row.recent_accuracy) || 0),
    };
  } catch (error) {
    console.error('Error calculating confidence model:', error);
    return {
      action_type: actionType,
      total_decisions: 0,
      successful_decisions: 0,
      success_rate: 0,
      average_confidence: 0,
      min_confidence_for_auto: 80,
      recent_accuracy: 0,
    };
  }
}

/**
 * Determine if action should be executed autonomously
 */
export async function shouldExecuteAutonomously(
  workspaceId: string,
  actionType: string,
  confidence: number
): Promise<boolean> {
  const model = await getConfidenceModel(workspaceId, actionType);
  
  // Execute if:
  // 1. Confidence exceeds threshold
  // 2. We have historical success with this action
  // 3. Recent accuracy is high
  const shouldExecute =
    confidence >= model.min_confidence_for_auto &&
    model.success_rate >= 75 &&
    model.recent_accuracy >= 70;

  console.log(`🤖 Autonomous decision for ${actionType}: ${shouldExecute ? '✅ AUTO' : '❌ NEEDS APPROVAL'}`);
  console.log(`   Confidence: ${confidence}/${model.min_confidence_for_auto}, Success: ${model.success_rate}%, Recent: ${model.recent_accuracy}%`);

  return shouldExecute;
}

/**
 * Learn from lead behavior patterns
 */
export async function analyzeBehaviorPatterns(workspaceId: string) {
  try {
    const result = await pool.query(
      `SELECT 
        action_type,
        outcome,
        COUNT(*) as frequency,
        AVG(initial_confidence) as avg_conf,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))) as avg_response_time
       FROM decision_outcomes
       WHERE workspace_id = $1
       GROUP BY action_type, outcome
       ORDER BY frequency DESC LIMIT 20`,
      [workspaceId]
    );

    return {
      workspace_id: workspaceId,
      patterns: result.rows,
      insights: generateInsights(result.rows),
    };
  } catch (error) {
    console.error('Error analyzing patterns:', error);
    return { workspace_id: workspaceId, patterns: [], insights: [] };
  }
}

function generateInsights(patterns: any[]): string[] {
  const insights: string[] = [];

  // Find most successful actions
  const successfulActions = patterns
    .filter(p => p.outcome === 'success')
    .sort((a, b) => b.frequency - a.frequency);

  if (successfulActions.length > 0) {
    insights.push(`✅ Best action: ${successfulActions[0].action_type} (${successfulActions[0].frequency} successes)`);
  }

  // Find actions that need improvement
  const failedActions = patterns
    .filter(p => p.outcome === 'failure')
    .sort((a, b) => b.frequency - a.frequency);

  if (failedActions.length > 0) {
    insights.push(`⚠️ Needs improvement: ${failedActions[0].action_type} (${failedActions[0].frequency} failures)`);
  }

  // Find fastest response times
  const fastActions = patterns.filter(p => p.avg_response_time).sort((a, b) => a.avg_response_time - b.avg_response_time);
  if (fastActions.length > 0) {
    insights.push(`⚡ Fastest: ${fastActions[0].action_type} (${Math.round(fastActions[0].avg_response_time)}s avg)`);
  }

  return insights;
}

/**
 * Get autonomous decision readiness score for workspace
 */
export async function getAutonomyReadiness(workspaceId: string) {
  try {
    const models = await Promise.all([
      getConfidenceModel(workspaceId, 'send_email'),
      getConfidenceModel(workspaceId, 'send_sms'),
      getConfidenceModel(workspaceId, 'book_meeting'),
    ]);

    const avgSuccessRate = models.reduce((sum, m) => sum + m.success_rate, 0) / models.length;
    const avgAccuracy = models.reduce((sum, m) => sum + m.recent_accuracy, 0) / models.length;

    // Readiness score (0-100)
    const readiness = Math.round((avgSuccessRate * 0.6 + avgAccuracy * 0.4));

    return {
      workspace_id: workspaceId,
      overall_readiness: readiness,
      readiness_level: readiness > 80 ? 'expert' : readiness > 60 ? 'advanced' : readiness > 40 ? 'intermediate' : 'learning',
      models,
      recommendation: generateReadinessRecommendation(readiness),
    };
  } catch (error) {
    console.error('Error calculating readiness:', error);
    return {
      workspace_id: workspaceId,
      overall_readiness: 0,
      readiness_level: 'learning',
      models: [],
      recommendation: 'Sophia is still learning. More campaigns needed for autonomous decisions.',
    };
  }
}

function generateReadinessRecommendation(readiness: number): string {
  if (readiness > 85) {
    return '🚀 Sophia is expert-level! Full autonomy recommended for all actions.';
  } else if (readiness > 70) {
    return '⭐ Sophia is advanced. Ready for most autonomous decisions with oversight.';
  } else if (readiness > 50) {
    return '📈 Sophia is improving. Recommend hybrid mode with admin approval for critical actions.';
  } else {
    return '🎓 Sophia is learning. Review her recommendations before full autonomy.';
  }
}
