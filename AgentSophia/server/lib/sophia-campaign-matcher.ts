import OpenAI from 'openai';
import { Pool } from 'pg';
import { db } from './db-service';

const openai = new OpenAI();

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

interface LeadData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  company?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  tags?: string[] | null;
}

interface CampaignData {
  id: string;
  name: string;
  goal?: string | null;
  audience?: string | null;
  channels?: string[];
  status?: string | null;
}

interface MatchResult {
  campaignId: string;
  campaignName: string;
  score: number;
  rationale: string;
  matchFactors: {
    job_title_match?: number;
    industry_match?: number;
    company_size_match?: number;
    engagement_potential?: number;
  };
}

interface AutonomySettings {
  campaign_assignment_mode: 'manual_approval' | 'semi_autonomous' | 'fully_autonomous';
  min_confidence_for_auto: number;
  notify_on_auto_assign: boolean;
  max_auto_assigns_per_day: number;
}

export async function getWorkspaceAutonomySettings(workspaceId: string): Promise<AutonomySettings> {
  try {
    const result = await pool.query(
      `SELECT * FROM sophia_autonomy_settings WHERE workspace_id = $1`,
      [workspaceId]
    );
    
    if (result.rows.length > 0) {
      return result.rows[0];
    }
    
    return {
      campaign_assignment_mode: 'manual_approval',
      min_confidence_for_auto: 75,
      notify_on_auto_assign: true,
      max_auto_assigns_per_day: 50,
    };
  } catch (error) {
    console.error('[Sophia Matcher] Error fetching autonomy settings:', error);
    return {
      campaign_assignment_mode: 'manual_approval',
      min_confidence_for_auto: 75,
      notify_on_auto_assign: true,
      max_auto_assigns_per_day: 50,
    };
  }
}

export async function getActiveCampaigns(workspaceId: string): Promise<CampaignData[]> {
  try {
    const result = await pool.query(
      `SELECT id, name, goal, audience, channels, status 
       FROM campaigns 
       WHERE workspace_id = $1 AND status IN ('active', 'draft', 'paused')
       ORDER BY created_at DESC`,
      [workspaceId]
    );
    return result.rows;
  } catch (error) {
    console.error('[Sophia Matcher] Error fetching campaigns:', error);
    return [];
  }
}

export async function scoreLeadAgainstCampaign(
  lead: LeadData,
  campaign: CampaignData
): Promise<MatchResult> {
  const leadDescription = [
    lead.job_title && `Title: ${lead.job_title}`,
    lead.company && `Company: ${lead.company}`,
    lead.tags?.length && `Tags: ${lead.tags.join(', ')}`,
  ].filter(Boolean).join(', ');

  const campaignDescription = [
    `Campaign: ${campaign.name}`,
    campaign.goal && `Goal: ${campaign.goal}`,
    campaign.audience && `Target Audience: ${campaign.audience}`,
    campaign.channels?.length && `Channels: ${campaign.channels.join(', ')}`,
  ].filter(Boolean).join(', ');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are Sophia, an AI sales assistant. Score how well a lead matches a campaign.
          
Return a JSON object with:
- score: 0-100 (how well the lead matches the campaign's target audience)
- rationale: Brief explanation (1-2 sentences)
- factors: Object with job_title_match, industry_match, engagement_potential (each 0-100)

Consider:
- Job title relevance to campaign audience
- Company/industry fit
- Lead quality signals (email, LinkedIn presence)
- Campaign goal alignment`
        },
        {
          role: 'user',
          content: `Lead: ${leadDescription || 'No details available'}

Campaign: ${campaignDescription}

Score this lead's fit for the campaign.`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      score: Math.min(100, Math.max(0, result.score || 50)),
      rationale: result.rationale || 'Match score calculated based on available data.',
      matchFactors: {
        job_title_match: result.factors?.job_title_match || 50,
        industry_match: result.factors?.industry_match || 50,
        engagement_potential: result.factors?.engagement_potential || 50,
      },
    };
  } catch (error) {
    console.error('[Sophia Matcher] AI scoring error:', error);
    
    let baseScore = 50;
    if (lead.job_title && campaign.audience?.toLowerCase().includes(lead.job_title.toLowerCase())) {
      baseScore += 20;
    }
    if (lead.email) baseScore += 10;
    if (lead.linkedin_url) baseScore += 10;
    
    return {
      campaignId: campaign.id,
      campaignName: campaign.name,
      score: Math.min(100, baseScore),
      rationale: 'Score calculated using heuristic matching.',
      matchFactors: {
        job_title_match: lead.job_title ? 60 : 40,
        industry_match: 50,
        engagement_potential: (lead.email ? 30 : 0) + (lead.linkedin_url ? 30 : 0) + 20,
      },
    };
  }
}

export async function findBestCampaignMatches(
  workspaceId: string,
  leads: LeadData[],
  topN: number = 3
): Promise<Map<string, MatchResult[]>> {
  const campaigns = await getActiveCampaigns(workspaceId);
  
  if (campaigns.length === 0) {
    console.log('[Sophia Matcher] No active campaigns found');
    return new Map();
  }

  const matchResults = new Map<string, MatchResult[]>();

  for (const lead of leads) {
    const leadMatches: MatchResult[] = [];

    for (const campaign of campaigns.slice(0, 5)) {
      const match = await scoreLeadAgainstCampaign(lead, campaign);
      leadMatches.push(match);
    }

    leadMatches.sort((a, b) => b.score - a.score);
    matchResults.set(lead.id, leadMatches.slice(0, topN));
  }

  return matchResults;
}

export async function createCampaignMatchSuggestion(
  workspaceId: string,
  leadId: string,
  matchResult: MatchResult,
  autonomyMode: string
): Promise<string | null> {
  try {
    const result = await pool.query(
      `INSERT INTO sophia_campaign_matches 
       (id, workspace_id, lead_contact_id, campaign_id, match_score, rationale, 
        match_factors, autonomy_mode, status, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING id`,
      [
        workspaceId,
        leadId,
        matchResult.campaignId,
        matchResult.score,
        matchResult.rationale,
        JSON.stringify(matchResult.matchFactors),
        autonomyMode,
        autonomyMode === 'fully_autonomous' && matchResult.score >= 75 ? 'auto_applied' : 'pending'
      ]
    );

    const matchId = result.rows[0]?.id;

    await pool.query(
      `INSERT INTO sophia_campaign_assignment_logs
       (id, workspace_id, match_id, lead_contact_id, campaign_id, action, performed_by, 
        confidence_at_action, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'sophia', $6, NOW())`,
      [
        workspaceId,
        matchId,
        leadId,
        matchResult.campaignId,
        autonomyMode === 'fully_autonomous' && matchResult.score >= 75 ? 'auto_assigned' : 'suggested',
        matchResult.score
      ]
    );

    return matchId;
  } catch (error) {
    console.error('[Sophia Matcher] Error creating match suggestion:', error);
    return null;
  }
}

export async function processLeadImportForCampaignMatching(
  workspaceId: string,
  leads: LeadData[],
  preSelectedCampaignId?: string
): Promise<{
  autoAssigned: number;
  suggestions: number;
  campaignId?: string;
}> {
  console.log(`[Sophia Matcher] Processing ${leads.length} leads for workspace ${workspaceId}`);

  if (preSelectedCampaignId) {
    try {
      const addedCount = await db.addContactsToCampaign(
        preSelectedCampaignId,
        leads.map(l => l.id)
      );
      console.log(`[Sophia Matcher] Added ${addedCount} leads to pre-selected campaign`);
      return { autoAssigned: addedCount, suggestions: 0, campaignId: preSelectedCampaignId };
    } catch (error) {
      console.error('[Sophia Matcher] Error adding to pre-selected campaign:', error);
    }
  }

  const settings = await getWorkspaceAutonomySettings(workspaceId);
  const matchResults = await findBestCampaignMatches(workspaceId, leads, 1);

  let autoAssigned = 0;
  let suggestions = 0;

  for (const [leadId, matches] of matchResults.entries()) {
    const bestMatch = matches[0];
    if (!bestMatch) continue;

    const shouldAutoAssign = 
      settings.campaign_assignment_mode === 'fully_autonomous' &&
      bestMatch.score >= settings.min_confidence_for_auto;

    if (shouldAutoAssign) {
      try {
        await db.addContactsToCampaign(bestMatch.campaignId, [leadId]);
        await createCampaignMatchSuggestion(workspaceId, leadId, bestMatch, 'fully_autonomous');
        autoAssigned++;
      } catch (error) {
        console.error(`[Sophia Matcher] Error auto-assigning lead ${leadId}:`, error);
      }
    } else if (bestMatch.score >= 50) {
      await createCampaignMatchSuggestion(workspaceId, leadId, bestMatch, settings.campaign_assignment_mode);
      suggestions++;
    }
  }

  console.log(`[Sophia Matcher] Complete: ${autoAssigned} auto-assigned, ${suggestions} suggestions`);
  return { autoAssigned, suggestions };
}

export async function approveCampaignMatch(
  matchId: string,
  userId: string
): Promise<boolean> {
  try {
    const matchResult = await pool.query(
      `SELECT * FROM sophia_campaign_matches WHERE id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) return false;

    const match = matchResult.rows[0];

    await db.addContactsToCampaign(match.campaign_id, [match.lead_contact_id]);

    await pool.query(
      `UPDATE sophia_campaign_matches 
       SET status = 'approved', approved_by = $2, applied_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [matchId, userId]
    );

    await pool.query(
      `INSERT INTO sophia_campaign_assignment_logs
       (id, workspace_id, match_id, lead_contact_id, campaign_id, action, performed_by, 
        user_id, previous_status, new_status, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'approved', 'user', $5, 'pending', 'approved', NOW())`,
      [match.workspace_id, matchId, match.lead_contact_id, match.campaign_id, userId]
    );

    return true;
  } catch (error) {
    console.error('[Sophia Matcher] Error approving match:', error);
    return false;
  }
}

export async function rejectCampaignMatch(
  matchId: string,
  userId: string,
  reason?: string
): Promise<boolean> {
  try {
    const matchResult = await pool.query(
      `SELECT * FROM sophia_campaign_matches WHERE id = $1`,
      [matchId]
    );

    if (matchResult.rows.length === 0) return false;

    const match = matchResult.rows[0];

    await pool.query(
      `UPDATE sophia_campaign_matches 
       SET status = 'rejected', rejected_reason = $2, updated_at = NOW()
       WHERE id = $1`,
      [matchId, reason || null]
    );

    await pool.query(
      `INSERT INTO sophia_campaign_assignment_logs
       (id, workspace_id, match_id, lead_contact_id, campaign_id, action, performed_by, 
        user_id, reason, previous_status, new_status, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'rejected', 'user', $5, $6, 'pending', 'rejected', NOW())`,
      [match.workspace_id, matchId, match.lead_contact_id, match.campaign_id, userId, reason || null]
    );

    return true;
  } catch (error) {
    console.error('[Sophia Matcher] Error rejecting match:', error);
    return false;
  }
}

export async function getPendingCampaignMatches(workspaceId: string): Promise<any[]> {
  try {
    const result = await pool.query(
      `SELECT 
        m.*,
        c.first_name as lead_first_name,
        c.last_name as lead_last_name,
        c.email as lead_email,
        c.company as lead_company,
        c.job_title as lead_job_title,
        camp.name as campaign_name,
        camp.goal as campaign_goal
       FROM sophia_campaign_matches m
       LEFT JOIN contacts c ON m.lead_contact_id = c.id
       LEFT JOIN campaigns camp ON m.campaign_id = camp.id
       WHERE m.workspace_id = $1 AND m.status = 'pending'
       ORDER BY m.match_score DESC, m.created_at DESC
       LIMIT 100`,
      [workspaceId]
    );
    return result.rows;
  } catch (error) {
    console.error('[Sophia Matcher] Error fetching pending matches:', error);
    return [];
  }
}

export async function initCampaignMatcherTables(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_campaign_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        lead_contact_id UUID NOT NULL,
        campaign_id UUID NOT NULL,
        match_score INTEGER NOT NULL,
        rationale TEXT,
        match_factors JSONB,
        autonomy_mode VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        approved_by UUID,
        rejected_reason TEXT,
        applied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_campaign_assignment_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL,
        match_id UUID,
        lead_contact_id UUID NOT NULL,
        campaign_id UUID NOT NULL,
        action VARCHAR(50) NOT NULL,
        performed_by VARCHAR(50) NOT NULL,
        user_id UUID,
        previous_status VARCHAR(50),
        new_status VARCHAR(50),
        reason TEXT,
        confidence_at_action INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_autonomy_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID NOT NULL UNIQUE,
        campaign_assignment_mode VARCHAR(50) DEFAULT 'manual_approval',
        min_confidence_for_auto INTEGER DEFAULT 75,
        enabled_channels JSONB,
        notify_on_auto_assign BOOLEAN DEFAULT true,
        max_auto_assigns_per_day INTEGER DEFAULT 50,
        learning_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('[Sophia Matcher] Tables initialized successfully');
  } catch (error) {
    console.error('[Sophia Matcher] Error initializing tables:', error);
  }
}
