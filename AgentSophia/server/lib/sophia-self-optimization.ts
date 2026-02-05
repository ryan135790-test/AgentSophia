/**
 * Sophia Self-Optimization Engine
 * Autonomously analyzes campaigns and makes improvements
 */

import { Pool } from 'pg';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { Campaign } from '@shared/schema';

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY });

export interface CampaignMetrics {
  campaign_id: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  open_rate: number; // percentage
  click_rate: number; // percentage
  reply_rate: number; // percentage
}

export interface OptimizationSuggestion {
  type: 'subject_line' | 'message_body' | 'timing' | 'targeting' | 'frequency';
  original: string;
  suggested: string;
  reasoning: string;
  estimated_improvement: number; // percentage
  confidence: number; // 0-100
}

export interface SelfOptimizationResult {
  campaign_id: string;
  analyzed_at: string;
  metrics: CampaignMetrics;
  suggestions: OptimizationSuggestion[];
  confidence: number;
  auto_applied: boolean;
  applied_changes: string[];
}

/**
 * Calculate campaign metrics
 */
function calculateMetrics(campaign: Campaign): CampaignMetrics {
  const sent = campaign.sent_count || 1;
  const opened = campaign.opened_count || 0;
  const clicked = campaign.clicked_count || 0;
  const replied = campaign.replied_count || 0;

  return {
    campaign_id: campaign.id,
    sent_count: sent,
    opened_count: opened,
    clicked_count: clicked,
    replied_count: replied,
    open_rate: (opened / sent) * 100,
    click_rate: (clicked / sent) * 100,
    reply_rate: (replied / sent) * 100,
  };
}

/**
 * Analyze campaign performance with dual models
 */
async function analyzePerformance(
  campaign: Campaign,
  metrics: CampaignMetrics
): Promise<OptimizationSuggestion[]> {
  const prompt = `Analyze this email campaign performance and suggest 3 specific improvements:

Campaign: ${campaign.name}
Description: ${campaign.description || 'N/A'}
Type: ${campaign.type}

Metrics:
- Open Rate: ${metrics.open_rate.toFixed(1)}%
- Click Rate: ${metrics.click_rate.toFixed(1)}%
- Reply Rate: ${metrics.reply_rate.toFixed(1)}%
- Total Sent: ${metrics.sent_count}

Respond with JSON array:
[
  {
    "type": "subject_line|message_body|timing|targeting|frequency",
    "original": "what's currently done",
    "suggested": "specific improvement",
    "reasoning": "why this will help",
    "estimated_improvement": 15
  }
]

Be specific and actionable.`;

  try {
    const [gptResponse, claudeResponse] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
      anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    ]);

    const gptText = gptResponse.choices[0].message.content || '[]';
    const claudeText = claudeResponse.content[0].type === 'text' ? claudeResponse.content[0].text : '[]';

    const gptSuggestions = JSON.parse(gptText);
    const claudeSuggestions = JSON.parse(claudeText);

    // Merge and deduplicate suggestions
    const allSuggestions = [...gptSuggestions, ...claudeSuggestions];
    const merged: Record<string, OptimizationSuggestion> = {};

    allSuggestions.forEach((s: any) => {
      const key = `${s.type}-${s.suggested}`;
      if (!merged[key]) {
        merged[key] = {
          ...s,
          confidence: 75,
        };
      }
    });

    return Object.values(merged).slice(0, 3);
  } catch (error) {
    console.error('Error analyzing performance:', error);
    return [];
  }
}

/**
 * Apply optimizations to campaign
 */
async function applyOptimizations(
  campaign: Campaign,
  suggestions: OptimizationSuggestion[]
): Promise<string[]> {
  const applied: string[] = [];

  for (const suggestion of suggestions) {
    if (suggestion.confidence >= 70) {
      try {
        // Update campaign settings with new values
        const updatedSettings = {
          ...campaign.settings,
          [`optimized_${suggestion.type}`]: suggestion.suggested,
          [`optimization_applied_at`]: new Date().toISOString(),
        };

        await pool.query(
          'UPDATE campaigns SET settings = $1 WHERE id = $2',
          [JSON.stringify(updatedSettings), campaign.id]
        );

        applied.push(`Updated ${suggestion.type}: ${suggestion.reasoning}`);
      } catch (error) {
        console.error(`Failed to apply optimization: ${error}`);
      }
    }
  }

  return applied;
}

/**
 * Persist learning from this optimization
 */
async function persistLearning(
  result: SelfOptimizationResult,
  workspaceId: string
): Promise<void> {
  try {
    // Store in learning_data table or similar
    await pool.query(
      `INSERT INTO campaign_optimizations 
       (campaign_id, workspace_id, metrics, suggestions, applied_changes, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        result.campaign_id,
        workspaceId,
        JSON.stringify(result.metrics),
        JSON.stringify(result.suggestions),
        JSON.stringify(result.applied_changes),
      ]
    );
  } catch (error) {
    console.error('Error persisting learning:', error);
  }
}

/**
 * Run self-optimization on a campaign
 */
export async function optimizeCampaign(
  campaign: Campaign,
  workspaceId: string,
  autoApply: boolean = true
): Promise<SelfOptimizationResult> {
  const metrics = calculateMetrics(campaign);
  const suggestions = await analyzePerformance(campaign, metrics);
  const applied = autoApply ? await applyOptimizations(campaign, suggestions) : [];

  const result: SelfOptimizationResult = {
    campaign_id: campaign.id,
    analyzed_at: new Date().toISOString(),
    metrics,
    suggestions,
    confidence: suggestions.reduce((acc, s) => acc + s.confidence, 0) / (suggestions.length || 1),
    auto_applied: autoApply,
    applied_changes: applied,
  };

  await persistLearning(result, workspaceId);
  return result;
}

/**
 * Batch optimize all active campaigns
 */
export async function optimizeAllCampaigns(
  workspaceId: string
): Promise<SelfOptimizationResult[]> {
  try {
    const result = await pool.query(
      'SELECT * FROM campaigns WHERE workspace_id = $1 AND status = $2 ORDER BY updated_at DESC LIMIT 10',
      [workspaceId, 'active']
    );

    const campaigns: Campaign[] = result.rows;
    const optimizations = await Promise.all(
      campaigns.map(c => optimizeCampaign(c, workspaceId, true))
    );

    return optimizations;
  } catch (error) {
    console.error('Error batch optimizing:', error);
    return [];
  }
}

/**
 * Get optimization history for learning
 */
export async function getOptimizationHistory(
  campaignId: string
): Promise<SelfOptimizationResult[]> {
  try {
    const result = await pool.query(
      `SELECT * FROM campaign_optimizations 
       WHERE campaign_id = $1 
       ORDER BY created_at DESC LIMIT 20`,
      [campaignId]
    );

    return result.rows.map(row => ({
      campaign_id: row.campaign_id,
      analyzed_at: row.created_at,
      metrics: row.metrics,
      suggestions: row.suggestions,
      confidence: 80,
      auto_applied: true,
      applied_changes: row.applied_changes,
    }));
  } catch (error) {
    console.error('Error fetching history:', error);
    return [];
  }
}

/**
 * Get learning insights across all campaigns
 */
export async function getLearningInsights(workspaceId: string) {
  try {
    const result = await pool.query(
      `SELECT 
        type, 
        COUNT(*) as frequency,
        AVG((suggestions->0->>'estimated_improvement')::float) as avg_improvement
       FROM campaign_optimizations
       WHERE workspace_id = $1
       GROUP BY type
       ORDER BY frequency DESC`,
      [workspaceId]
    );

    return result.rows;
  } catch (error) {
    console.error('Error getting insights:', error);
    return [];
  }
}
