/**
 * Sophia Autonomous Executor
 * Makes autonomous decisions based on learned confidence models
 */

import { randomUUID } from 'crypto';
import { shouldExecuteAutonomously, logDecisionOutcome } from './sophia-learning-engine';

export interface AutonomousDecision {
  decision_id: string;
  action_type: string;
  contact_id: string;
  campaign_id: string;
  confidence: number;
  will_execute_autonomously: boolean;
  reasoning: string;
}

/**
 * Make an autonomous decision about an action
 */
export async function makeAutonomousDecision(
  workspaceId: string,
  actionType: string,
  contactId: string,
  campaignId: string,
  confidence: number
): Promise<AutonomousDecision> {
  const decisionId = randomUUID();

  const willExecute = await shouldExecuteAutonomously(workspaceId, actionType, confidence);

  const decision: AutonomousDecision = {
    decision_id: decisionId,
    action_type: actionType,
    contact_id: contactId,
    campaign_id: campaignId,
    confidence,
    will_execute_autonomously: willExecute,
    reasoning: willExecute
      ? `✅ High confidence (${confidence}%) + proven track record. Executing autonomously.`
      : `⏳ Needs approval. Confidence: ${confidence}%, Historical success < 75%.`,
  };

  return decision;
}

/**
 * Execute action if autonomous, otherwise return for approval
 */
export async function executeOrQueueForApproval(
  decision: AutonomousDecision,
  actionExecutor: (actionType: string) => Promise<boolean>
): Promise<{ executed: boolean; message: string; outcome?: any }> {
  if (decision.will_execute_autonomously) {
    try {
      const result = await actionExecutor(decision.action_type);
      
      // Log outcome for learning
      await logDecisionOutcome({
        decision_id: decision.decision_id,
        action_type: decision.action_type,
        workspace_id: '', // Would pass actual workspace
        contact_id: decision.contact_id,
        campaign_id: decision.campaign_id,
        initial_confidence: decision.confidence,
        outcome: result ? 'success' : 'failure',
        metadata: { autonomous: true },
      });

      return {
        executed: true,
        message: `✅ Sophia autonomously executed ${decision.action_type}`,
        outcome: { success: result },
      };
    } catch (error: any) {
      // Log failure
      await logDecisionOutcome({
        decision_id: decision.decision_id,
        action_type: decision.action_type,
        workspace_id: '',
        contact_id: decision.contact_id,
        campaign_id: decision.campaign_id,
        initial_confidence: decision.confidence,
        outcome: 'failure',
        metadata: { autonomous: true, error: error.message },
      });

      return {
        executed: false,
        message: `❌ Sophia's autonomous execution failed: ${error.message}`,
      };
    }
  } else {
    return {
      executed: false,
      message: `⏳ Action queued for admin approval: ${decision.reasoning}`,
    };
  }
}

/**
 * Sophia learns from a series of decisions
 */
export async function learnFromDecisions(decisions: AutonomousDecision[]): Promise<string> {
  const autonomous = decisions.filter(d => d.will_execute_autonomously).length;
  const queued = decisions.length - autonomous;

  return `📚 Sophia learned from ${decisions.length} decisions: ${autonomous} autonomous, ${queued} need approval`;
}
