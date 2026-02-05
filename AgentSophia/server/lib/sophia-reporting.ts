import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';

// Priority: SUPABASE_DB_URL (works in production) > PGHOST (dev only)
let connectionString: string;
let useSSL = false;

if (process.env.SUPABASE_DB_URL) {
  connectionString = process.env.SUPABASE_DB_URL;
  useSSL = true;
} else if (process.env.PGHOST && process.env.PGDATABASE) {
  const pgUser = process.env.PGUSER || 'postgres';
  const pgPassword = process.env.PGPASSWORD || '';
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  connectionString = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
} else {
  connectionString = '';
}

const pool = new Pool({ 
  connectionString, 
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
});

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

export interface LearningOutcome {
  id?: string;
  workspace_id?: string;
  action_type: string;
  original_decision: string;
  user_decision: 'approved' | 'rejected' | 'modified';
  modification_details?: string;
  sophia_reasoning: string;
  sophia_confidence: number;
  user_feedback?: string;
  learned_pattern?: string;
  applied_to_future: boolean;
  created_at?: string;
}

export interface HealthAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  category: 'linkedin' | 'email' | 'campaign' | 'approval' | 'system';
  title: string;
  message: string;
  actionRequired: boolean;
  actionLabel?: string;
  actionUrl?: string;
  dismissible: boolean;
  createdAt: string;
  expiresAt?: string;
}

export interface Recommendation {
  id: string;
  type: 'channel_switch' | 'timing' | 'content' | 'escalation' | 'engagement' | 'optimization';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  reason: string;
  actionLabel: string;
  actionData: Record<string, any>;
  confidence: number;
  potentialImpact: string;
  createdAt: string;
}

export interface RevenueAttribution {
  id?: string;
  deal_id: string;
  deal_value: number;
  contact_id: string;
  campaign_id?: string;
  workspace_id?: string;
  sophia_actions: SophiaAction[];
  total_touchpoints: number;
  first_touch_channel: string;
  last_touch_channel: string;
  conversion_path: string[];
  attribution_model: 'first_touch' | 'last_touch' | 'linear' | 'time_decay';
  attributed_revenue: number;
  created_at?: string;
}

export interface SophiaAction {
  action_type: string;
  channel: string;
  timestamp: string;
  was_autonomous: boolean;
  confidence_score: number;
  outcome?: 'opened' | 'clicked' | 'replied' | 'meeting_booked' | 'no_response';
}

export async function initReportingTables(): Promise<void> {
  console.log('[Sophia Reporting] Initializing tables...');
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_auto_execute_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id VARCHAR(255) UNIQUE NOT NULL DEFAULT 'default',
        enabled BOOLEAN DEFAULT false,
        confidence_threshold INTEGER DEFAULT 80,
        scheduled_interval VARCHAR(50) DEFAULT 'off',
        last_run_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_learning_outcomes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID,
        action_type VARCHAR(100) NOT NULL,
        original_decision TEXT NOT NULL,
        user_decision VARCHAR(50) NOT NULL,
        modification_details TEXT,
        sophia_reasoning TEXT,
        sophia_confidence NUMERIC,
        user_feedback TEXT,
        learned_pattern TEXT,
        applied_to_future BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_health_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID,
        alert_type VARCHAR(50) NOT NULL,
        category VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        action_required BOOLEAN DEFAULT false,
        action_label VARCHAR(100),
        action_url TEXT,
        dismissible BOOLEAN DEFAULT true,
        dismissed BOOLEAN DEFAULT false,
        dismissed_by UUID,
        dismissed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID,
        contact_id UUID,
        campaign_id UUID,
        recommendation_type VARCHAR(100) NOT NULL,
        priority VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        reason TEXT,
        action_label VARCHAR(100),
        action_data JSONB,
        confidence NUMERIC,
        potential_impact TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        acted_on BOOLEAN DEFAULT false,
        acted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_revenue_attribution (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL,
        deal_value NUMERIC NOT NULL,
        contact_id UUID NOT NULL,
        campaign_id UUID,
        workspace_id UUID,
        sophia_actions JSONB DEFAULT '[]',
        total_touchpoints INTEGER DEFAULT 0,
        first_touch_channel VARCHAR(50),
        last_touch_channel VARCHAR(50),
        conversion_path JSONB DEFAULT '[]',
        attribution_model VARCHAR(50) DEFAULT 'linear',
        attributed_revenue NUMERIC DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_learning_workspace ON sophia_learning_outcomes(workspace_id);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_alerts_workspace ON sophia_health_alerts(workspace_id, dismissed);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_recommendations_workspace ON sophia_recommendations(workspace_id, status);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_revenue_deal ON sophia_revenue_attribution(deal_id);`);

    console.log('[Sophia Reporting] Tables initialized successfully');
  } catch (error) {
    console.error('[Sophia Reporting] Error initializing tables:', error);
  }
}

export async function logLearningOutcome(outcome: LearningOutcome): Promise<void> {
  try {
    const learnedPattern = generateLearnedPattern(outcome);
    
    await pool.query(`
      INSERT INTO sophia_learning_outcomes 
      (workspace_id, action_type, original_decision, user_decision, modification_details,
       sophia_reasoning, sophia_confidence, user_feedback, learned_pattern, applied_to_future)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      outcome.workspace_id,
      outcome.action_type,
      outcome.original_decision,
      outcome.user_decision,
      outcome.modification_details,
      outcome.sophia_reasoning,
      outcome.sophia_confidence,
      outcome.user_feedback,
      learnedPattern,
      false
    ]);

    console.log(`[Sophia Learning] Logged outcome: ${outcome.action_type} → ${outcome.user_decision}`);
    
    if (learnedPattern) {
      console.log(`[Sophia Learning] Pattern learned: ${learnedPattern}`);
    }
  } catch (error) {
    console.error('[Sophia Learning] Error logging outcome:', error);
  }
}

function generateLearnedPattern(outcome: LearningOutcome): string | null {
  if (outcome.user_decision === 'rejected') {
    if (outcome.sophia_confidence < 70) {
      return `Low confidence (${outcome.sophia_confidence}%) ${outcome.action_type} actions should always require approval`;
    }
    return `User rejected ${outcome.action_type} - consider more conservative approach`;
  }
  
  if (outcome.user_decision === 'modified') {
    return `User modified ${outcome.action_type} - learn from modification: ${outcome.modification_details?.substring(0, 100)}`;
  }
  
  if (outcome.user_decision === 'approved' && outcome.sophia_confidence >= 85) {
    return `High confidence ${outcome.action_type} actions are typically approved - can increase autonomy`;
  }
  
  return null;
}

export async function getLearningInsights(workspaceId?: string): Promise<{
  totalDecisions: number;
  approvalRate: number;
  patterns: string[];
  confidenceAdjustments: { action: string; adjustment: number }[];
}> {
  try {
    const whereClause = workspaceId ? 'WHERE workspace_id = $1' : '';
    const params = workspaceId ? [workspaceId] : [];
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE user_decision = 'approved') as approved,
        COUNT(*) FILTER (WHERE user_decision = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE user_decision = 'modified') as modified,
        ARRAY_AGG(DISTINCT learned_pattern) FILTER (WHERE learned_pattern IS NOT NULL) as patterns
      FROM sophia_learning_outcomes
      ${whereClause}
    `, params);
    
    const data = result.rows[0];
    const total = Number(data.total) || 0;
    const approved = Number(data.approved) || 0;
    
    const confidenceByAction = await pool.query(`
      SELECT action_type,
        AVG(CASE WHEN user_decision = 'approved' THEN 1 ELSE 0 END) as approval_rate,
        AVG(sophia_confidence) as avg_confidence
      FROM sophia_learning_outcomes
      ${whereClause}
      GROUP BY action_type
    `, params);
    
    const adjustments = confidenceByAction.rows.map(row => ({
      action: row.action_type,
      adjustment: row.approval_rate > 0.8 ? 5 : row.approval_rate < 0.5 ? -10 : 0
    })).filter(a => a.adjustment !== 0);
    
    return {
      totalDecisions: total,
      approvalRate: total > 0 ? (approved / total) * 100 : 0,
      patterns: data.patterns || [],
      confidenceAdjustments: adjustments
    };
  } catch (error) {
    console.error('[Sophia Learning] Error getting insights:', error);
    return { totalDecisions: 0, approvalRate: 0, patterns: [], confidenceAdjustments: [] };
  }
}

export async function createHealthAlert(alert: Omit<HealthAlert, 'id' | 'createdAt'>, workspaceId?: string): Promise<string> {
  try {
    const result = await pool.query(`
      INSERT INTO sophia_health_alerts 
      (workspace_id, alert_type, category, title, message, action_required, 
       action_label, action_url, dismissible, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      workspaceId,
      alert.type,
      alert.category,
      alert.title,
      alert.message,
      alert.actionRequired,
      alert.actionLabel,
      alert.actionUrl,
      alert.dismissible,
      alert.expiresAt
    ]);
    
    console.log(`[Sophia Alert] Created ${alert.type} alert: ${alert.title}`);
    return result.rows[0].id;
  } catch (error) {
    console.error('[Sophia Alert] Error creating alert:', error);
    throw error;
  }
}

export async function getActiveAlerts(workspaceId?: string): Promise<HealthAlert[]> {
  try {
    const result = await pool.query(`
      SELECT id, alert_type as type, category, title, message, action_required as "actionRequired",
             action_label as "actionLabel", action_url as "actionUrl", dismissible,
             created_at as "createdAt", expires_at as "expiresAt"
      FROM sophia_health_alerts
      WHERE dismissed = false 
        AND (expires_at IS NULL OR expires_at > NOW())
        ${workspaceId ? 'AND (workspace_id = $1 OR workspace_id IS NULL)' : ''}
      ORDER BY 
        CASE alert_type WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
        created_at DESC
    `, workspaceId ? [workspaceId] : []);
    
    return result.rows;
  } catch (error) {
    console.error('[Sophia Alert] Error getting alerts:', error);
    return [];
  }
}

export async function dismissAlert(alertId: string, userId: string): Promise<void> {
  await pool.query(`
    UPDATE sophia_health_alerts 
    SET dismissed = true, dismissed_by = $1, dismissed_at = NOW()
    WHERE id = $2
  `, [userId, alertId]);
}

export async function checkAndGenerateAlerts(workspaceId?: string): Promise<HealthAlert[]> {
  const alerts: HealthAlert[] = [];
  
  try {
    const pendingApprovals = await pool.query(`
      SELECT COUNT(*) as count, MIN(created_at) as oldest
      FROM sophia_approval_items 
      WHERE status = 'pending'
      ${workspaceId ? 'AND workspace_id = $1' : ''}
    `, workspaceId ? [workspaceId] : []);
    
    const count = Number(pendingApprovals.rows[0]?.count) || 0;
    const oldest = pendingApprovals.rows[0]?.oldest;
    
    if (count > 10) {
      const alertId = await createHealthAlert({
        type: 'warning',
        category: 'approval',
        title: 'Approval Queue Growing',
        message: `${count} actions are awaiting approval. Some have been pending for over 24 hours.`,
        actionRequired: true,
        actionLabel: 'Review Queue',
        actionUrl: '/approvals',
        dismissible: true,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }, workspaceId);
      
      alerts.push({
        id: alertId,
        type: 'warning',
        category: 'approval',
        title: 'Approval Queue Growing',
        message: `${count} actions are awaiting approval.`,
        actionRequired: true,
        actionLabel: 'Review Queue',
        actionUrl: '/approvals',
        dismissible: true,
        createdAt: new Date().toISOString()
      });
    }

    const failedSteps = await pool.query(`
      SELECT COUNT(*) as count
      FROM campaign_scheduled_steps 
      WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours'
      ${workspaceId ? 'AND workspace_id = $1' : ''}
    `, workspaceId ? [workspaceId] : []);
    
    const failedCount = Number(failedSteps.rows[0]?.count) || 0;
    
    if (failedCount > 5) {
      const alertId = await createHealthAlert({
        type: 'critical',
        category: 'campaign',
        title: 'Campaign Delivery Issues',
        message: `${failedCount} campaign messages failed in the last 24 hours. Check channel configurations.`,
        actionRequired: true,
        actionLabel: 'View Failed',
        actionUrl: '/campaigns',
        dismissible: false
      }, workspaceId);
      
      alerts.push({
        id: alertId,
        type: 'critical',
        category: 'campaign',
        title: 'Campaign Delivery Issues',
        message: `${failedCount} messages failed.`,
        actionRequired: true,
        actionLabel: 'View Failed',
        actionUrl: '/campaigns',
        dismissible: false,
        createdAt: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[Sophia Alert] Error checking alerts:', error);
  }
  
  return alerts;
}

export async function createRecommendation(
  recommendation: Omit<Recommendation, 'id' | 'createdAt'>,
  workspaceId?: string,
  contactId?: string,
  campaignId?: string
): Promise<string> {
  try {
    const result = await pool.query(`
      INSERT INTO sophia_recommendations 
      (workspace_id, contact_id, campaign_id, recommendation_type, priority, title, 
       description, reason, action_label, action_data, confidence, potential_impact)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      workspaceId,
      contactId,
      campaignId,
      recommendation.type,
      recommendation.priority,
      recommendation.title,
      recommendation.description,
      recommendation.reason,
      recommendation.actionLabel,
      JSON.stringify(recommendation.actionData),
      recommendation.confidence,
      recommendation.potentialImpact
    ]);
    
    console.log(`[Sophia Rec] Created: ${recommendation.title}`);
    return result.rows[0].id;
  } catch (error) {
    console.error('[Sophia Rec] Error creating recommendation:', error);
    throw error;
  }
}

export async function getRecommendations(workspaceId?: string, limit: number = 10): Promise<Recommendation[]> {
  try {
    const result = await pool.query(`
      SELECT id, recommendation_type as type, priority, title, description, reason,
             action_label as "actionLabel", action_data as "actionData", 
             confidence, potential_impact as "potentialImpact", created_at as "createdAt"
      FROM sophia_recommendations
      WHERE status = 'pending'
        ${workspaceId ? 'AND (workspace_id = $1 OR workspace_id IS NULL)' : ''}
      ORDER BY 
        CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        confidence DESC
      LIMIT ${limit}
    `, workspaceId ? [workspaceId] : []);
    
    return result.rows;
  } catch (error) {
    console.error('[Sophia Rec] Error getting recommendations:', error);
    return [];
  }
}

export async function generateRecommendations(workspaceId?: string): Promise<Recommendation[]> {
  const generatedRecs: Recommendation[] = [];
  
  try {
    const stuckContacts = await pool.query(`
      SELECT contact_id, channel, COUNT(*) as attempts
      FROM campaign_scheduled_steps
      WHERE status = 'sent' AND created_at > NOW() - INTERVAL '7 days'
      ${workspaceId ? 'AND workspace_id = $1' : ''}
      GROUP BY contact_id, channel
      HAVING COUNT(*) >= 3
    `, workspaceId ? [workspaceId] : []);
    
    for (const row of stuckContacts.rows) {
      const nextChannel = row.channel === 'email' ? 'linkedin' : 
                          row.channel === 'linkedin' ? 'phone' : 'email';
      
      const recId = await createRecommendation({
        type: 'channel_switch',
        priority: 'high',
        title: `Switch to ${nextChannel} for unresponsive contact`,
        description: `${row.attempts} ${row.channel} attempts with no response. Try a different channel.`,
        reason: `Contact has not responded to ${row.attempts} ${row.channel} messages`,
        actionLabel: `Switch to ${nextChannel}`,
        actionData: { contact_id: row.contact_id, from_channel: row.channel, to_channel: nextChannel },
        confidence: 78,
        potentialImpact: '25% higher response rate on channel switch'
      }, workspaceId, row.contact_id);
      
      generatedRecs.push({
        id: recId,
        type: 'channel_switch',
        priority: 'high',
        title: `Switch to ${nextChannel} for unresponsive contact`,
        description: `${row.attempts} ${row.channel} attempts with no response.`,
        reason: `Contact has not responded to ${row.attempts} ${row.channel} messages`,
        actionLabel: `Switch to ${nextChannel}`,
        actionData: { contact_id: row.contact_id, from_channel: row.channel, to_channel: nextChannel },
        confidence: 78,
        potentialImpact: '25% higher response rate',
        createdAt: new Date().toISOString()
      });
    }

    const lowPerformance = await pool.query(`
      SELECT campaign_id, 
        COUNT(*) FILTER (WHERE status = 'sent') as sent,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM campaign_scheduled_steps
      WHERE created_at > NOW() - INTERVAL '7 days'
      ${workspaceId ? 'AND workspace_id = $1' : ''}
      GROUP BY campaign_id
      HAVING COUNT(*) FILTER (WHERE status = 'failed') > COUNT(*) FILTER (WHERE status = 'sent') * 0.2
    `, workspaceId ? [workspaceId] : []);
    
    for (const row of lowPerformance.rows) {
      const total = Number(row.sent) + Number(row.failed);
      const failRate = total > 0 ? Math.round(Number(row.failed) / total * 100) : 0;
      
      const recId = await createRecommendation({
        type: 'optimization',
        priority: 'high',
        title: 'Campaign has high failure rate',
        description: `${row.failed} failures out of ${total} attempts (${failRate}%)`,
        reason: 'High failure rate may indicate deliverability issues or invalid contacts',
        actionLabel: 'Review Campaign',
        actionData: { campaign_id: row.campaign_id },
        confidence: 85,
        potentialImpact: 'Improve delivery rate by 30-50%'
      }, workspaceId, undefined, row.campaign_id);
      
      generatedRecs.push({
        id: recId,
        type: 'optimization',
        priority: 'high',
        title: 'Campaign has high failure rate',
        description: `${row.failed} failures (${failRate}%)`,
        reason: 'High failure rate - check deliverability',
        actionLabel: 'Review Campaign',
        actionData: { campaign_id: row.campaign_id },
        confidence: 85,
        potentialImpact: 'Improve delivery 30-50%',
        createdAt: new Date().toISOString()
      });
    }

    const pendingApprovals = await pool.query(`
      SELECT COUNT(*) as count FROM sophia_approval_items WHERE status = 'pending'
    `);
    
    if (Number(pendingApprovals.rows[0]?.count) > 5) {
      const recId = await createRecommendation({
        type: 'engagement',
        priority: 'medium',
        title: 'Review pending approval queue',
        description: `${pendingApprovals.rows[0].count} actions are waiting for your approval`,
        reason: 'Pending actions may slow down campaigns',
        actionLabel: 'Review Queue',
        actionData: { url: '/approvals' },
        confidence: 90,
        potentialImpact: 'Keep campaigns moving'
      }, workspaceId);
      
      generatedRecs.push({
        id: recId,
        type: 'engagement',
        priority: 'medium',
        title: 'Review pending approval queue',
        description: `${pendingApprovals.rows[0].count} actions waiting`,
        reason: 'Pending actions slow campaigns',
        actionLabel: 'Review Queue',
        actionData: { url: '/approvals' },
        confidence: 90,
        potentialImpact: 'Keep campaigns moving',
        createdAt: new Date().toISOString()
      });
    }

    const learningData = await getLearningInsights(workspaceId);
    if (learningData.totalDecisions > 5 && learningData.approvalRate < 60) {
      const recId = await createRecommendation({
        type: 'optimization',
        priority: 'medium',
        title: 'Sophia\'s suggestions need tuning',
        description: `Only ${learningData.approvalRate.toFixed(0)}% approval rate - Sophia may be too aggressive`,
        reason: 'Low approval rate indicates Sophia needs calibration',
        actionLabel: 'Adjust Autonomy Settings',
        actionData: { url: '/settings/sophia' },
        confidence: 80,
        potentialImpact: 'Better aligned suggestions'
      }, workspaceId);
      
      generatedRecs.push({
        id: recId,
        type: 'optimization',
        priority: 'medium',
        title: 'Sophia needs tuning',
        description: `${learningData.approvalRate.toFixed(0)}% approval rate`,
        reason: 'Low approval rate',
        actionLabel: 'Adjust Settings',
        actionData: { url: '/settings/sophia' },
        confidence: 80,
        potentialImpact: 'Better suggestions',
        createdAt: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('[Sophia Rec] Error generating recommendations:', error);
  }
  
  return generatedRecs;
}

export async function attributeRevenue(
  dealId: string,
  dealValue: number,
  contactId: string,
  workspaceId?: string
): Promise<void> {
  try {
    const actions = await pool.query(`
      SELECT channel, status, executed_at, requires_approval, 
             personalization_data->>'confidence' as confidence
      FROM campaign_scheduled_steps
      WHERE contact_id = $1 AND status = 'sent'
      ORDER BY executed_at ASC
    `, [contactId]);
    
    const sophiaActions: SophiaAction[] = actions.rows.map(a => ({
      action_type: 'outreach',
      channel: a.channel,
      timestamp: a.executed_at,
      was_autonomous: !a.requires_approval,
      confidence_score: Number(a.confidence) || 75,
      outcome: 'replied'
    }));
    
    const firstTouch = sophiaActions[0]?.channel || 'unknown';
    const lastTouch = sophiaActions[sophiaActions.length - 1]?.channel || 'unknown';
    const conversionPath = sophiaActions.map(a => a.channel);
    
    const attributedRevenue = sophiaActions.length > 0 
      ? dealValue / sophiaActions.length 
      : dealValue;
    
    await pool.query(`
      INSERT INTO sophia_revenue_attribution 
      (deal_id, deal_value, contact_id, workspace_id, sophia_actions, total_touchpoints,
       first_touch_channel, last_touch_channel, conversion_path, attribution_model, attributed_revenue)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      dealId,
      dealValue,
      contactId,
      workspaceId,
      JSON.stringify(sophiaActions),
      sophiaActions.length,
      firstTouch,
      lastTouch,
      JSON.stringify(conversionPath),
      'linear',
      attributedRevenue
    ]);
    
    console.log(`[Sophia Revenue] Attributed $${dealValue} deal to ${sophiaActions.length} touchpoints`);
  } catch (error) {
    console.error('[Sophia Revenue] Error attributing revenue:', error);
  }
}

export async function getRevenueAttribution(workspaceId?: string): Promise<{
  totalAttributedRevenue: number;
  byChannel: { channel: string; revenue: number; deals: number }[];
  byTouchpoint: { touchpoints: number; deals: number; avgValue: number }[];
  autonomousRevenue: number;
  humanAssistedRevenue: number;
}> {
  try {
    const result = await pool.query(`
      SELECT 
        SUM(deal_value) as total_revenue,
        SUM(attributed_revenue) as attributed_revenue,
        COUNT(*) as total_deals,
        first_touch_channel,
        last_touch_channel,
        total_touchpoints,
        sophia_actions
      FROM sophia_revenue_attribution
      ${workspaceId ? 'WHERE workspace_id = $1' : ''}
      GROUP BY first_touch_channel, last_touch_channel, total_touchpoints, sophia_actions
    `, workspaceId ? [workspaceId] : []);
    
    const channelRevenue: Record<string, { revenue: number; deals: number }> = {};
    const touchpointStats: Record<number, { deals: number; totalValue: number }> = {};
    let autonomousRevenue = 0;
    let humanAssistedRevenue = 0;
    
    for (const row of result.rows) {
      const lastChannel = row.last_touch_channel;
      if (!channelRevenue[lastChannel]) {
        channelRevenue[lastChannel] = { revenue: 0, deals: 0 };
      }
      channelRevenue[lastChannel].revenue += Number(row.total_revenue) || 0;
      channelRevenue[lastChannel].deals += 1;
      
      const tp = row.total_touchpoints || 1;
      if (!touchpointStats[tp]) {
        touchpointStats[tp] = { deals: 0, totalValue: 0 };
      }
      touchpointStats[tp].deals += 1;
      touchpointStats[tp].totalValue += Number(row.total_revenue) || 0;
      
      const actions = row.sophia_actions || [];
      const hasHumanAssist = actions.some((a: SophiaAction) => !a.was_autonomous);
      if (hasHumanAssist) {
        humanAssistedRevenue += Number(row.total_revenue) || 0;
      } else {
        autonomousRevenue += Number(row.total_revenue) || 0;
      }
    }
    
    return {
      totalAttributedRevenue: result.rows.reduce((sum, r) => sum + (Number(r.total_revenue) || 0), 0),
      byChannel: Object.entries(channelRevenue).map(([channel, data]) => ({
        channel,
        revenue: data.revenue,
        deals: data.deals
      })),
      byTouchpoint: Object.entries(touchpointStats).map(([tp, data]) => ({
        touchpoints: Number(tp),
        deals: data.deals,
        avgValue: data.deals > 0 ? data.totalValue / data.deals : 0
      })),
      autonomousRevenue,
      humanAssistedRevenue
    };
  } catch (error) {
    console.error('[Sophia Revenue] Error getting attribution:', error);
    return {
      totalAttributedRevenue: 0,
      byChannel: [],
      byTouchpoint: [],
      autonomousRevenue: 0,
      humanAssistedRevenue: 0
    };
  }
}

export async function getSophiaReport(workspaceId?: string): Promise<{
  learning: Awaited<ReturnType<typeof getLearningInsights>>;
  alerts: HealthAlert[];
  recommendations: Recommendation[];
  revenue: Awaited<ReturnType<typeof getRevenueAttribution>>;
}> {
  const [learning, alerts, recommendations, revenue] = await Promise.all([
    getLearningInsights(workspaceId),
    getActiveAlerts(workspaceId),
    getRecommendations(workspaceId),
    getRevenueAttribution(workspaceId)
  ]);
  
  return { learning, alerts, recommendations, revenue };
}
