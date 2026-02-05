/**
 * Multi-Model Consensus Engine
 * Claude + GPT-4o collaborate for smarter decisions
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { IntentType } from './intent-detection-engine';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export interface ModelPrediction {
  model: 'claude' | 'gpt4o';
  intent: IntentType;
  confidence: number; // 0-100
  reasoning: string;
  actions: string[];
}

export interface ConsensusResult {
  finalIntent: IntentType;
  consensusConfidence: number; // 0-100
  claudePrediction: ModelPrediction;
  gpt4oPrediction: ModelPrediction;
  agreement: boolean; // Both models agree
  recommendation: string;
}

/**
 * Get Claude's prediction
 */
async function getClaudePrediction(message: string): Promise<ModelPrediction> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `You are a sales intelligence AI. Analyze this prospect message and determine their intent.

Message: "${message}"

Respond in JSON format:
{
  "intent": "interested|not_interested|meeting_request|information_needed|price_inquiry|follow_up_needed|meeting_scheduled",
  "confidence": 0-100,
  "reasoning": "why this intent",
  "actions": ["send_reply", "tag_lead", "route_to_sales", etc]
}

Be precise and conservative with confidence scores.`
        }
      ]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = JSON.parse(text);

    return {
      model: 'claude',
      intent: parsed.intent,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      actions: parsed.actions || []
    };
  } catch (error: any) {
    console.error('Claude prediction error:', error.message);
    return {
      model: 'claude',
      intent: 'information_needed',
      confidence: 50,
      reasoning: 'Failed to analyze',
      actions: ['send_reply']
    };
  }
}

/**
 * Get GPT-4o's prediction
 */
async function getGpt4oPrediction(message: string): Promise<ModelPrediction> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      temperature: 0.5,
      messages: [
        {
          role: 'user',
          content: `You are a sales intelligence AI. Analyze this prospect message and determine their intent.

Message: "${message}"

Respond in JSON format:
{
  "intent": "interested|not_interested|meeting_request|information_needed|price_inquiry|follow_up_needed|meeting_scheduled",
  "confidence": 0-100,
  "reasoning": "why this intent",
  "actions": ["send_reply", "tag_lead", "route_to_sales", etc]
}

Be precise and conservative with confidence scores.`
        }
      ]
    });

    const text = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(text);

    return {
      model: 'gpt4o',
      intent: parsed.intent,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      actions: parsed.actions || []
    };
  } catch (error: any) {
    console.error('GPT-4o prediction error:', error.message);
    return {
      model: 'gpt4o',
      intent: 'information_needed',
      confidence: 50,
      reasoning: 'Failed to analyze',
      actions: ['send_reply']
    };
  }
}

/**
 * Get consensus from both models
 */
export async function getMultiModelConsensus(message: string): Promise<ConsensusResult> {
  const [claudePrediction, gpt4oPrediction] = await Promise.all([
    getClaudePrediction(message),
    getGpt4oPrediction(message)
  ]);

  const agreement = claudePrediction.intent === gpt4oPrediction.intent;
  
  // If both models agree, use their average confidence
  // If they disagree, use lower confidence and prefer the higher confidence model
  const finalIntent = agreement
    ? claudePrediction.intent
    : claudePrediction.confidence >= gpt4oPrediction.confidence
      ? claudePrediction.intent
      : gpt4oPrediction.intent;

  const consensusConfidence = agreement
    ? Math.min(
        Math.max(claudePrediction.confidence, gpt4oPrediction.confidence),
        100
      )
    : Math.max(claudePrediction.confidence, gpt4oPrediction.confidence) * 0.8; // Reduce confidence if disagreement

  // Combine action recommendations
  const allActions = new Set([...claudePrediction.actions, ...gpt4oPrediction.actions]);
  
  return {
    finalIntent,
    consensusConfidence: Math.round(consensusConfidence),
    claudePrediction,
    gpt4oPrediction,
    agreement,
    recommendation: agreement 
      ? `Both models agree: ${finalIntent.replace(/_/g, ' ')} (${Math.round(consensusConfidence)}% confident)`
      : `Models diverged. Using ${claudePrediction.confidence > gpt4oPrediction.confidence ? 'Claude' : 'GPT-4o'}'s prediction.`
  };
}

/**
 * Get predictive lead score (0-100)
 * Uses both models to score deal likelihood
 */
export async function getPredictiveLeadScore(
  leadHistory: { message: string; intent: IntentType }[]
): Promise<{ score: number; reasoning: string }> {
  if (leadHistory.length === 0) return { score: 50, reasoning: 'No history' };

  const historyText = leadHistory
    .map(h => `Intent: ${h.intent}, Message: "${h.message}"`)
    .join('\n');

  try {
    const [claudeScore, gptScore] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Rate this prospect's deal likelihood (0-100):

${historyText}

Respond with just a number 0-100 and brief reasoning in JSON format: { "score": X, "reasoning": "..." }`
          }
        ]
      }),
      anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: `Rate this prospect's deal likelihood (0-100):

${historyText}

Respond with just a number 0-100 and brief reasoning in JSON format: { "score": X, "reasoning": "..." }`
          }
        ]
      })
    ]);

    const gptText = claudeScore.choices[0].message.content || '{}';
    const claudeText = gptScore.content[0].type === 'text' ? gptScore.content[0].text : '{}';

    const gptParsed = JSON.parse(gptText);
    const claudeParsed = JSON.parse(claudeText);

    const avgScore = (gptParsed.score + claudeParsed.score) / 2;

    return {
      score: Math.round(avgScore),
      reasoning: `${gptParsed.reasoning} + ${claudeParsed.reasoning}`
    };
  } catch (error) {
    return { score: 50, reasoning: 'Unable to score' };
  }
}
