import { createClient } from '@supabase/supabase-js';
import type { 
  CampaignScheduledStep, 
  SophiaApprovalItem,
  CampaignExecutionLog,
  AgentConfig 
} from '../../shared/schema';
import { executeCampaignStep } from './channel-apis';
import { 
  executeCampaignStepWithUserAccounts,
  getUserConnectedChannels 
} from './user-channel-apis';
import { emitSophiaActivity } from '../routes-sophia-control';
import { sophiaPreActionCheck } from './sophia-linkedin-compliance';
import { sharedPool as pool } from './shared-db-pool';
import { markConnectionSent } from './linkedin-connection-tracker';

// Supabase client for campaigns and contacts (stored in Supabase)
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Validate Supabase configuration
const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

// Only create client if properly configured
const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// ============================================
// LINKEDIN SEARCH CAMPAIGN AUTO-TRIGGER
// ============================================

// Track campaigns we've already attempted to trigger search for (to avoid re-triggering)
const linkedInSearchTriggeredCampaigns = new Set<string>();

async function checkAndTriggerLinkedInSearchCampaigns(): Promise<void> {
  if (!supabase) return;
  
  // Find active campaigns that have a workflow_id in settings
  // (campaigns created from workflow builder)
  const { data: searchCampaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, user_id, workspace_id, settings, type')
    .eq('status', 'active')
    .not('settings->workflow_id', 'is', null)
    .limit(10);
  
  if (error) {
    console.log(`[Campaign Executor] Error fetching campaigns: ${error.message}`);
    return;
  }
  
  if (!searchCampaigns || searchCampaigns.length === 0) {
    return;
  }
  
  console.log(`[Campaign Executor] Found ${searchCampaigns.length} active campaigns with workflows to check for LinkedIn Search`);
  
  for (const campaign of searchCampaigns) {
    // Skip if already triggered
    if (linkedInSearchTriggeredCampaigns.has(campaign.id)) {
      continue;
    }
    
    // Check if campaign has any contacts yet
    const { count: contactCount } = await supabase
      .from('campaign_contacts')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id);
    
    // Check if there's an active search job for this campaign
    const { data: existingJobs } = await supabase
      .from('linkedin_search_jobs')
      .select('id, status')
      .eq('campaign_id', campaign.id)
      .in('status', ['running', 'completed', 'paused'])
      .limit(1);
    
    if ((contactCount && contactCount > 0) || (existingJobs && existingJobs.length > 0)) {
      // Already has contacts or a search job - mark as triggered
      linkedInSearchTriggeredCampaigns.add(campaign.id);
      continue;
    }
    
    // This campaign needs its LinkedIn Search triggered!
    console.log(`[Campaign Executor] 🔍 Found LinkedIn Search campaign "${campaign.name}" (${campaign.id}) that needs search triggered`);
    
    try {
      // Get the workflow ID from campaign settings
      const workflowId = campaign.settings?.workflow_id;
      if (!workflowId) {
        console.log(`[Campaign Executor] ❌ Campaign ${campaign.id} has no workflow_id in settings`);
        linkedInSearchTriggeredCampaigns.add(campaign.id);
        continue;
      }
      
      // Find the LinkedIn Search node in the workflow
      const { data: allNodes } = await supabase
        .from('workflow_nodes')
        .select('config, node_type')
        .eq('workflow_id', workflowId);
      
      const searchNode = allNodes?.find((n: any) => 
        n.config?.originalType === 'linkedin_search' || 
        n.node_type === 'linkedin_search'
      );
      
      if (!searchNode?.config) {
        console.log(`[Campaign Executor] ❌ No linkedin_search node found in workflow ${workflowId}`);
        linkedInSearchTriggeredCampaigns.add(campaign.id);
        continue;
      }
      
      // Extract search config
      const nodeConfig = searchNode.config.config || searchNode.config;
      const searchConfig = {
        keywords: nodeConfig.keywords || nodeConfig.searchKeywords || '',
        jobTitle: nodeConfig.jobTitle || nodeConfig.title || '',
        company: nodeConfig.company || '',
        location: nodeConfig.location || '',
        industry: nodeConfig.industry || '',
        maxResults: nodeConfig.maxResults || nodeConfig.targetCount || 50,
        connectionDegree: nodeConfig.connectionDegree || '2nd',
      };
      
      console.log(`[Campaign Executor] 🔍 Triggering LinkedIn search for campaign ${campaign.id}:`, JSON.stringify(searchConfig));
      
      // Trigger the search
      const searchResult = await executeCampaignStepWithUserAccounts(
        campaign.user_id,
        'linkedin_search',
        { email: '' },
        { subject: '', body: '' },
        { searchConfig, workspaceId: campaign.workspace_id, campaignId: campaign.id }
      );
      
      if (searchResult.success) {
        console.log(`[Campaign Executor] ✅ LinkedIn search triggered for campaign ${campaign.id}:`, searchResult.messageId);
      } else {
        console.log(`[Campaign Executor] ❌ Failed to trigger LinkedIn search:`, searchResult.error);
      }
      
      // Mark as triggered regardless of result (to avoid retry loops)
      linkedInSearchTriggeredCampaigns.add(campaign.id);
      
    } catch (triggerError: any) {
      console.error(`[Campaign Executor] Error triggering LinkedIn search for campaign ${campaign.id}:`, triggerError.message);
      linkedInSearchTriggeredCampaigns.add(campaign.id);
    }
  }
}

// ============================================
// AUTO-SCHEDULE WORKFLOW STEPS FOR NEW CONTACTS
// ============================================

export async function autoScheduleStepsForNewContacts(): Promise<{ scheduled: number, errors: string[] }> {
  console.log('[Auto-Schedule] Starting auto-schedule check for new contacts...');
  
  if (!supabase) {
    console.log('[Auto-Schedule] No supabase client, skipping');
    return { scheduled: 0, errors: ['No supabase client'] };
  }
  
  // Find active campaigns with workflows that have contacts without scheduled steps
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, user_id, workspace_id, settings')
    .eq('status', 'active');
  
  console.log(`[Auto-Schedule] Found ${campaigns?.length || 0} active campaigns`);
  
  if (error) {
    console.log(`[Auto-Schedule] Error fetching campaigns: ${error.message}`);
    return { scheduled: 0, errors: [error.message] };
  }
  
  if (!campaigns || campaigns.length === 0) {
    return { scheduled: 0, errors: [] };
  }
  
  let totalScheduled = 0;
  const errors: string[] = [];
  
  for (const campaign of campaigns) {
    try {
      console.log(`[Auto-Schedule] Processing campaign ${campaign.id} (${campaign.settings?.name || 'unnamed'})`);
      
      // Get campaign steps from campaign_steps table
      const { data: campaignStepsData, error: stepsError } = await supabase
        .from('campaign_steps')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('order_index', { ascending: true });
      
      if (stepsError) {
        console.log(`[Auto-Schedule] Error fetching steps for campaign ${campaign.id}: ${stepsError.message}`);
        continue;
      }
      
      const campaignSteps = campaignStepsData || [];
      console.log(`[Auto-Schedule] Campaign ${campaign.id} has ${campaignSteps.length} steps`);
      
      if (!campaignSteps.length) {
        console.log(`[Auto-Schedule] Skipping campaign ${campaign.id} - no steps configured`);
        continue;
      }
      
      // Get contacts in this campaign that don't have scheduled steps
      {
        // Get all contacts in the campaign
        const { data: allCampaignContacts, error: contactsError } = await supabase
          .from('campaign_contacts')
          .select('contact_id')
          .eq('campaign_id', campaign.id);
        
        if (contactsError) {
          console.log(`[Auto-Schedule] Error fetching contacts for campaign ${campaign.id}: ${contactsError.message}`);
          continue;
        }
        
        console.log(`[Auto-Schedule] Campaign ${campaign.id} has ${allCampaignContacts?.length || 0} contacts in campaign_contacts`);
        
        if (!allCampaignContacts || allCampaignContacts.length === 0) continue;
        
        // Get contacts that already have scheduled steps
        const contactIds = allCampaignContacts.map(c => c.contact_id);
        const existingStepsResult = await pool.query(
          `SELECT DISTINCT contact_id FROM campaign_scheduled_steps WHERE campaign_id = $1`,
          [campaign.id]
        );
        const contactsWithSteps = new Set(existingStepsResult.rows.map(r => r.contact_id));
        console.log(`[Auto-Schedule] Campaign ${campaign.id} has ${contactsWithSteps.size} contacts with existing steps`);
        
        // Find contacts that need steps scheduled
        const contactsNeedingSteps = contactIds.filter(id => !contactsWithSteps.has(id));
        console.log(`[Auto-Schedule] Campaign ${campaign.id} has ${contactsNeedingSteps.length} contacts needing steps`);
        
        if (contactsNeedingSteps.length === 0) {
          console.log(`[Auto-Schedule] Skipping campaign ${campaign.id} - all contacts have steps`);
          continue;
        }
        
        // Filter to only linkedin_connection steps (skip linkedin_search as that's already done)
        const connectionSteps = campaignSteps.filter((s: any) => 
          s.channel === 'linkedin_connection' || s.action === 'linkedin_connection'
        );
        
        if (connectionSteps.length === 0) {
          console.log(`[Campaign Executor] No LinkedIn connection steps found in campaign ${campaign.id}, step channels: ${campaignSteps.map((s: any) => s.channel).join(', ')}`);
          continue;
        }
        
        console.log(`[Campaign Executor] Auto-scheduling ${connectionSteps.length} LinkedIn connection steps for ${contactsNeedingSteps.length} contacts in campaign ${campaign.id}`);
        
        // WARMUP SCHEDULING: Industry standard WEEKLY ramp
        // Week 1: 5/day, Week 2: 10/day, Week 3: 15/day, Week 4+: 20-25/day max
        const getWarmupLimit = (daysSinceStart: number): number => {
          if (daysSinceStart < 7) return 5;       // Week 1
          if (daysSinceStart < 14) return 10;     // Week 2
          if (daysSinceStart < 21) return 15;     // Week 3
          if (daysSinceStart < 28) return 20;     // Week 4
          return 25;                               // Week 5+ (max safe for free accounts)
        };
        const BASE_DAILY_LIMIT = 25;
        
        // Get count of invites already scheduled/sent today for this workspace
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const existingTodayResult = await pool.query(
          `SELECT COUNT(*) FROM campaign_scheduled_steps 
           WHERE workspace_id = $1 
           AND channel = 'linkedin_connection'
           AND scheduled_at >= $2::date
           AND scheduled_at < ($2::date + INTERVAL '1 day')`,
          [campaign.workspace_id, todayStart.toISOString()]
        );
        const alreadyScheduledToday = parseInt(existingTodayResult.rows[0]?.count || '0');
        
        // Get workspace warmup day (how many days since first invite)
        const warmupDayResult = await pool.query(
          `SELECT MIN(scheduled_at) as first_scheduled FROM campaign_scheduled_steps 
           WHERE workspace_id = $1 AND channel = 'linkedin_connection'`,
          [campaign.workspace_id]
        );
        const firstScheduled = warmupDayResult.rows[0]?.first_scheduled;
        let warmupDay = 0;
        if (firstScheduled) {
          warmupDay = Math.floor((Date.now() - new Date(firstScheduled).getTime()) / (24 * 60 * 60 * 1000));
        }
        const dailyLimit = getWarmupLimit(warmupDay);
        
        console.log(`[Warmup] Day ${warmupDay}, daily limit: ${dailyLimit}, already today: ${alreadyScheduledToday}`);
        
        // Schedule invites starting TODAY, spreading across days with warmup limits
        // Use CST timezone (UTC-6) for business hours calculation
        const CST_OFFSET_HOURS = -6;
        const now = new Date();
        const nowCST = new Date(now.getTime() + (CST_OFFSET_HOURS * 60 * 60 * 1000));
        const currentHourCST = nowCST.getUTCHours();
        
        console.log(`[Scheduler] Current UTC: ${now.toISOString()}, CST hour: ${currentHourCST}`);
        
        let currentDay = 0;
        let scheduledOnCurrentDay = alreadyScheduledToday;
        let currentDayLimit = dailyLimit;
        
        // Business hours: 9 AM to 6 PM CST
        const BUSINESS_START = 9;
        const BUSINESS_END = 18;
        
        const getRandomTimeInBusinessHours = (dayOffset: number): Date => {
          // Create date in CST context
          const baseDate = new Date(now);
          baseDate.setDate(baseDate.getDate() + dayOffset);
          
          // If scheduling for today, use current hour as minimum
          let minHour = BUSINESS_START;
          if (dayOffset === 0 && currentHourCST >= BUSINESS_START && currentHourCST < BUSINESS_END) {
            minHour = currentHourCST;
          }
          
          // If it's past business hours in CST today, push to tomorrow
          if (dayOffset === 0 && currentHourCST >= BUSINESS_END) {
            baseDate.setDate(baseDate.getDate() + 1);
            minHour = BUSINESS_START;
            console.log(`[Scheduler] Past CST business hours (${currentHourCST}), pushing to tomorrow`);
          }
          
          // Random hour between minHour and 6 PM CST
          const hoursRemaining = BUSINESS_END - minHour;
          const hourCST = minHour + Math.floor(Math.random() * Math.max(1, hoursRemaining));
          const minute = Math.floor(Math.random() * 60);
          
          // Convert CST time back to UTC for storage
          // CST is UTC-6, so add 6 hours to get UTC
          const utcHour = hourCST - CST_OFFSET_HOURS;
          baseDate.setUTCHours(utcHour, minute, Math.floor(Math.random() * 60), 0);
          
          console.log(`[Scheduler] Scheduled for CST hour ${hourCST}, UTC: ${baseDate.toISOString()}`);
          return baseDate;
        };
        
        for (const contactId of contactsNeedingSteps) {
          for (let i = 0; i < connectionSteps.length; i++) {
            const step = connectionSteps[i];
            
            // Check if we've hit today's limit, move to next day
            if (scheduledOnCurrentDay >= currentDayLimit) {
              currentDay++;
              scheduledOnCurrentDay = 0;
              // Update limit for new day based on warmup schedule
              const dayInWarmup = warmupDay + currentDay;
              currentDayLimit = getWarmupLimit(dayInWarmup);
              console.log(`[Warmup] Moving to day ${currentDay} (warmup day ${dayInWarmup}), limit: ${currentDayLimit}`);
            }
            
            const scheduledTime = getRandomTimeInBusinessHours(currentDay);
            scheduledOnCurrentDay++;
            
            await pool.query(
              `INSERT INTO campaign_scheduled_steps (
                campaign_id, contact_id, workspace_id,
                step_index, channel, subject, content,
                scheduled_at, status, requires_approval
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              ON CONFLICT DO NOTHING`,
              [
                campaign.id,
                contactId,
                campaign.workspace_id,
                i,
                'linkedin_connection',
                step.subject || 'LinkedIn Connection',
                step.message || step.content || step.template || 'Hi {{first_name}}, I came across your profile and would love to connect!',
                scheduledTime.toISOString(),
                'pending',
                false // Auto-approved since workflow was deployed by user
              ]
            );
          }
        }
        
        console.log(`[Campaign Executor] ✅ Scheduled LinkedIn connection steps for ${contactsNeedingSteps.length} contacts`);
        totalScheduled += contactsNeedingSteps.length;
      }
    } catch (err: any) {
      console.log(`[Campaign Executor] Error auto-scheduling steps for campaign ${campaign.id}: ${err.message}`);
      errors.push(`Campaign ${campaign.id}: ${err.message}`);
    }
  }
  
  console.log(`[Auto-Schedule] Complete - scheduled ${totalScheduled} contacts, ${errors.length} errors`);
  return { scheduled: totalScheduled, errors };
}

// ============================================
// AUTONOMY LEVEL HELPERS
// ============================================

async function getAutonomyConfig(workspaceId: string | null): Promise<AgentConfig | null> {
  try {
    // Try with workspace_id first, fallback to simpler query if column doesn't exist
    const result = await pool.query(
      `SELECT * FROM agent_configs LIMIT 1`
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching autonomy config:', error);
    return null;
  }
}

function shouldRequireApproval(
  autonomyLevel: 'manual_approval' | 'semi_autonomous' | 'fully_autonomous',
  channel: string,
  sophiaConfidence: number,
  confidenceThreshold: number = 80,
  isFromWorkflowDeployment: boolean = false
): { requiresApproval: boolean; reason: string } {
  // If this step comes from an explicitly deployed workflow, skip approval
  // The user already consented by clicking "Run Workflow"
  if (isFromWorkflowDeployment) {
    return { 
      requiresApproval: false, 
      reason: 'Step from user-deployed workflow - approval already granted by running the workflow' 
    };
  }
  
  switch (autonomyLevel) {
    case 'manual_approval':
      return { 
        requiresApproval: true, 
        reason: 'Autonomy level is set to manual approval - all actions require human review' 
      };
    
    case 'semi_autonomous':
      if (sophiaConfidence < confidenceThreshold) {
        return { 
          requiresApproval: true, 
          reason: `Confidence level (${sophiaConfidence}%) is below threshold (${confidenceThreshold}%) for semi-autonomous mode` 
        };
      }
      if (['linkedin', 'linkedin_message', 'linkedin_connection', 'phone', 'voicemail'].includes(channel)) {
        return { 
          requiresApproval: true, 
          reason: `${channel} channel requires approval in semi-autonomous mode` 
        };
      }
      return { requiresApproval: false, reason: 'Meets semi-autonomous criteria' };
    
    case 'fully_autonomous':
      return { requiresApproval: false, reason: 'Fully autonomous mode - no approval required' };
    
    default:
      return { requiresApproval: true, reason: 'Unknown autonomy level - defaulting to approval required' };
  }
}

// ============================================
// CONFIDENCE SCORING
// ============================================

function getStepConfidence(step: CampaignScheduledStep): number {
  if (step.personalization_data?.sophia_confidence) {
    return step.personalization_data.sophia_confidence;
  }
  
  switch (step.channel) {
    case 'email':
      return 90;
    case 'sms':
      return 85;
    case 'linkedin':
    case 'linkedin_message':
      return 75;
    case 'linkedin_connection':
      return 70;
    case 'phone':
    case 'voicemail':
      return 65;
    default:
      return 75;
  }
}

// ============================================
// APPROVAL QUEUE OPERATIONS
// ============================================

async function createApprovalItem(
  step: CampaignScheduledStep,
  reason: string,
  confidence: number = 75
): Promise<string> {
  const result = await pool.query(
    `INSERT INTO sophia_approval_items (
      workspace_id, user_id, action_type, action_data,
      campaign_id, contact_id, scheduled_step_id,
      sophia_confidence, sophia_reasoning,
      preview_subject, preview_content, preview_recipient,
      status, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id`,
    [
      step.workspace_id,
      null,
      'campaign_step',
      JSON.stringify({ channel: step.channel, step_index: step.step_index }),
      step.campaign_id,
      step.contact_id,
      step.id,
      confidence,
      reason,
      step.subject,
      step.content.substring(0, 500),
      null,
      'pending',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    ]
  );
  return result.rows[0].id;
}

async function updateStepStatus(
  stepId: string, 
  status: string, 
  messageId?: string, 
  errorMessage?: string
): Promise<void> {
  await pool.query(
    `UPDATE campaign_scheduled_steps 
     SET status = $1::varchar, 
         executed_at = CASE WHEN $1::varchar IN ('sent', 'failed', 'skipped') THEN NOW() ELSE executed_at END,
         requires_approval = CASE WHEN $1::varchar = 'requires_approval' THEN true ELSE requires_approval END,
         message_id = COALESCE($2::varchar, message_id),
         error_message = COALESCE($3::text, error_message),
         updated_at = NOW()
     WHERE id = $4::uuid`,
    [status, messageId || null, errorMessage || null, stepId]
  );
  
  // Track LinkedIn connection status on contact when step is sent
  if (status === 'sent') {
    try {
      const stepResult = await pool.query(
        `SELECT channel, contact_id FROM campaign_scheduled_steps WHERE id = $1`,
        [stepId]
      );
      const step = stepResult.rows[0];
      if (step && step.channel?.toLowerCase().includes('linkedin_connection')) {
        // Get LinkedIn URL from contact
        const contactResult = await pool.query(
          `SELECT linkedin_url FROM contacts WHERE id = $1`,
          [step.contact_id]
        );
        const linkedinUrl = contactResult.rows[0]?.linkedin_url;
        if (linkedinUrl) {
          await markConnectionSent(step.contact_id, linkedinUrl);
          console.log(`[Campaign Executor] Marked LinkedIn connection as pending for contact ${step.contact_id}`);
        }
      }
    } catch (trackError) {
      console.error('[Campaign Executor] Error tracking LinkedIn connection:', trackError);
    }
  }
}

// ============================================
// CAMPAIGN STEP EXECUTION
// ============================================

async function executeStep(
  step: CampaignScheduledStep,
  userId: string,
  workspaceId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured - cannot fetch contact data');
    }
    
    // Handle linkedin_search specially - it's a lead sourcing step, not a message step
    if ((step.channel as string) === 'linkedin_search') {
      // Parse the search configuration from step config
      const stepAny = step as any;
      const searchConfig = stepAny.config || {};
      
      console.log(`[Campaign Executor] Executing LinkedIn search with config:`, searchConfig);
      
      const result = await executeCampaignStepWithUserAccounts(
        userId,
        step.channel,
        { email: '', firstName: '', lastName: '' }, // Not needed for search
        { subject: '', body: '' }, // Not needed for search
        {
          searchConfig: {
            keywords: searchConfig.keywords,
            jobTitle: searchConfig.jobTitle,
            company: searchConfig.company,
            location: searchConfig.location,
            industry: searchConfig.industry,
            maxResults: searchConfig.maxResults || 25,
          },
          workspaceId: workspaceId,
          campaignId: step.campaign_id,
        }
      );
      
      return result;
    }
    
    // Standard contact-based steps (email, linkedin_message, etc.)
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', step.contact_id)
      .single();
    
    if (contactError || !contact) {
      throw new Error(`Contact not found: ${step.contact_id}`);
    }
    
    // Check LinkedIn warmup limits before executing LinkedIn actions
    if (step.channel.toLowerCase().includes('linkedin')) {
      const actionType = step.channel.toLowerCase().includes('connection') ? 'connection' : 'message';
      
      console.log(`[Campaign Executor] 🔒 LinkedIn Safety Check Starting`);
      console.log(`[Campaign Executor]   → Channel: ${step.channel}`);
      console.log(`[Campaign Executor]   → Action Type: ${actionType}`);
      console.log(`[Campaign Executor]   → User ID: ${userId}`);
      console.log(`[Campaign Executor]   → Contact ID: ${step.contact_id}`);
      
      // Get user's LinkedIn safety settings from Supabase
      const { data: safetySettings, error: settingsError } = await supabase
        .from('user_linkedin_settings')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      // Default warmup settings - Use proper warmup schedule (5/day week 1, ramping to 25/day by week 5+)
      // This matches the scheduling logic to prevent premature deferrals
      const getWarmupDailyLimit = (): number => {
        // Industry-standard warmup schedule: 5/day week 1, 10/day week 2, 15/day week 3, 20/day week 4, 25/day week 5+
        const warmupStartDate = new Date('2026-01-29'); // Campaign start date
        const now = new Date();
        const daysSinceStart = Math.floor((now.getTime() - warmupStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const weekNumber = Math.ceil(daysSinceStart / 7);
        
        if (weekNumber === 1) return 5;
        if (weekNumber === 2) return 10;
        if (weekNumber === 3) return 15;
        if (weekNumber === 4) return 20;
        return 25; // Week 5+
      };
      const DEFAULT_WARMUP_DAILY_LIMIT = getWarmupDailyLimit();
      console.log(`[Campaign Executor]   → Warmup daily limit: ${DEFAULT_WARMUP_DAILY_LIMIT} (proper warmup schedule)`);
      
      // Count how many LinkedIn connections this WORKSPACE has already sent today
      // IMPORTANT: Warmup limits are per-workspace (per-LinkedIn-account), not per-user
      // Each workspace has its own LinkedIn connection and should have independent warmup tracking
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      
      const { rows: sentTodayResult } = await pool.query(
        `SELECT COUNT(*) as count FROM campaign_scheduled_steps 
         WHERE status = 'sent' 
         AND channel ILIKE '%linkedin_connection%'
         AND updated_at >= $1
         AND campaign_id IN (
           SELECT id FROM campaigns WHERE workspace_id = $2
         )`,
        [todayStart.toISOString(), workspaceId]
      );
      const connectionsSentToday = parseInt(sentTodayResult?.[0]?.count || '0');
      console.log(`[Campaign Executor]   → Workspace ${workspaceId} has sent ${connectionsSentToday} connections today`);
      
      if (settingsError) {
        console.log(`[Campaign Executor]   → No safety settings found (${settingsError.message}) - using defaults`);
      }
      
      // Use explicit settings if available, otherwise apply default warmup limits
      const now = new Date().toISOString();
      const effectiveSettings = safetySettings || {
        is_warming_up: true,
        warmup_current_day: 1,
        warmup_started_at: now, // Required for warmup phase calculation
        warmup_phase: 'day1_ultra_light',
        daily_invite_limit: DEFAULT_WARMUP_DAILY_LIMIT,
        daily_connection_limit: DEFAULT_WARMUP_DAILY_LIMIT, // Used by calculateAdjustedLimits
        connections_sent_today: connectionsSentToday,
        acceptance_rate: 50,
        linkedin_account_age_days: 0, // New account assumption
        warmup_override_enabled: true, // Force use of our manual limit
        warmup_override_reason: 'Default conservative limit - no safety settings configured',
      };
      
      // Always update connections_sent_today to accurate count
      effectiveSettings.connections_sent_today = connectionsSentToday;
      
      // For accounts without explicit settings, do a simple daily limit check
      // This ensures warmup limits are enforced even if the safety system is complex
      if (!safetySettings && actionType === 'connection') {
        if (connectionsSentToday >= DEFAULT_WARMUP_DAILY_LIMIT) {
          console.log(`[Campaign Executor] ⏸️ DEFAULT WARMUP LIMIT REACHED: ${connectionsSentToday}/${DEFAULT_WARMUP_DAILY_LIMIT} connections sent today`);
          console.log(`[Campaign Executor] ⏸️ LinkedIn action DEFERRED - will retry tomorrow`);
          return {
            success: false,
            error: `WARMUP_DEFERRED: Default daily limit reached (${connectionsSentToday}/${DEFAULT_WARMUP_DAILY_LIMIT}). Configure warmup settings for customized limits.`,
            deferred: true,
          } as { success: boolean; error: string; deferred: boolean };
        }
      }
      
      const usingDefaults = !safetySettings;
      if (usingDefaults) {
        console.log(`[Campaign Executor]   → Using DEFAULT warmup limits (no settings configured):`);
      } else {
        console.log(`[Campaign Executor]   → Safety Settings Found:`);
      }
      console.log(`[Campaign Executor]     • Is Warming Up: ${effectiveSettings.is_warming_up ?? 'not set'}`);
      console.log(`[Campaign Executor]     • Warmup Day: ${effectiveSettings.warmup_current_day ?? 'not set'}`);
      console.log(`[Campaign Executor]     • Daily Invite Limit: ${effectiveSettings.daily_invite_limit ?? 'not set'}`);
      console.log(`[Campaign Executor]     • Connections Sent Today: ${effectiveSettings.connections_sent_today ?? 0}`);
      console.log(`[Campaign Executor]     • Acceptance Rate: ${effectiveSettings.acceptance_rate ?? 'not set'}%`);
      
      const safetyCheck = sophiaPreActionCheck(effectiveSettings, actionType, workspaceId);
      
      console.log(`[Campaign Executor]   → Safety Check Result:`);
      console.log(`[Campaign Executor]     • Can Proceed: ${safetyCheck.canProceed ? '✅ YES' : '❌ NO'}`);
      console.log(`[Campaign Executor]     • Risk Level: ${safetyCheck.riskLevel}`);
      if (safetyCheck.reason) {
        console.log(`[Campaign Executor]     • Reason: ${safetyCheck.reason}`);
      }
      if (safetyCheck.sophiaAdvice) {
        console.log(`[Campaign Executor]     • Sophia Advice: ${safetyCheck.sophiaAdvice}`);
      }
      
      if (!safetyCheck.canProceed) {
        console.log(`[Campaign Executor] ⏸️ LinkedIn action DEFERRED due to warmup limits - will retry tomorrow`);
        // Return a special "deferred" response instead of failure
        // This tells the executor to reschedule, not mark as failed
        return {
          success: false,
          error: `WARMUP_DEFERRED: ${safetyCheck.reason}`,
          deferred: true,
        } as { success: boolean; error: string; deferred: boolean };
      }
      
      // Add recommended delay if safety engine suggests it
      if (safetyCheck.adjustedDelay && safetyCheck.adjustedDelay > 0) {
        console.log(`[Campaign Executor]   → Adding safety delay: ${safetyCheck.adjustedDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, safetyCheck.adjustedDelay));
      }
      
      console.log(`[Campaign Executor] ✅ LinkedIn action APPROVED - proceeding with execution`);
    }
    
    let personalizedContent = step.content
      .replace(/\{\{first_name\}\}/g, contact.first_name || '')
      .replace(/\{\{last_name\}\}/g, contact.last_name || '')
      .replace(/\{\{company\}\}/g, contact.company || '');
    
    let personalizedSubject = (step.subject || '')
      .replace(/\{\{first_name\}\}/g, contact.first_name || '')
      .replace(/\{\{last_name\}\}/g, contact.last_name || '')
      .replace(/\{\{company\}\}/g, contact.company || '');

    console.log(`[Campaign Executor] Calling executeCampaignStepWithUserAccounts for step ${step.id}`);
    console.log(`[Campaign Executor]   → Channel: ${step.channel}`);
    console.log(`[Campaign Executor]   → Contact: ${contact.first_name} ${contact.last_name} (${contact.email})`);
    console.log(`[Campaign Executor]   → LinkedIn URL: ${contact.linkedin_url || 'NOT SET'}`);
    console.log(`[Campaign Executor]   → Workspace: ${workspaceId || 'default'}`);
    
    const result = await executeCampaignStepWithUserAccounts(
      userId,
      step.channel,
      {
        email: contact.email,
        phone: contact.phone,
        linkedinProfileUrl: contact.linkedin_url,
        firstName: contact.first_name,
        lastName: contact.last_name,
      },
      {
        subject: personalizedSubject,
        body: personalizedContent,
      },
      workspaceId ? { workspaceId } : undefined
    );

    console.log(`[Campaign Executor] Step ${step.id} execution result:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error('Step execution error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

// ============================================
// MAIN CAMPAIGN EXECUTOR
// ============================================

export interface CampaignExecutionResult {
  success: boolean;
  executionLogId: string;
  summary: {
    total: number;
    executed: number;
    pendingApproval: number;
    failed: number;
  };
  steps: Array<{
    stepId: string;
    contactId: string;
    channel: string;
    status: string;
    messageId?: string;
    error?: string;
    requiresApproval?: boolean;
    approvalReason?: string;
  }>;
}

export async function executeCampaign(
  campaignId: string,
  userId: string,
  workspaceId: string | null,
  options: {
    forceApproval?: boolean;
    skipAutonomyCheck?: boolean;
  } = {}
): Promise<CampaignExecutionResult> {
  const startedAt = new Date().toISOString();
  
  const agentConfig = await getAutonomyConfig(workspaceId);
  const autonomyLevel = agentConfig?.autonomy_level || 'semi_autonomous';
  const confidenceThreshold = agentConfig?.autonomy_policies?.confidence_threshold || 80;
  
  // Check if this campaign was deployed from a workflow
  let isFromWorkflowDeployment = false;
  try {
    const campaignResult = await pool.query(
      `SELECT settings FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    if (campaignResult.rows[0]?.settings?.workflow_id) {
      isFromWorkflowDeployment = true;
      console.log(`[Campaign Executor] Campaign ${campaignId} is from workflow deployment - skipping approval checks`);
    }
  } catch (e) {
    console.log(`[Campaign Executor] Could not check workflow origin:`, e);
  }
  
  console.log(`[Campaign Executor] Starting campaign ${campaignId}`);
  console.log(`[Campaign Executor] Workspace ID: ${workspaceId || 'NULL/UNDEFINED'}`);
  console.log(`[Campaign Executor] Autonomy level: ${autonomyLevel}, From workflow: ${isFromWorkflowDeployment}`);
  
  const logResult = await pool.query(
    `INSERT INTO campaign_execution_logs (
      campaign_id, workspace_id, execution_type, status,
      total_steps, completed_steps, failed_steps, pending_approval_steps,
      started_at, autonomy_level_used
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id`,
    [campaignId, workspaceId, 'full_run', 'started', 0, 0, 0, 0, startedAt, autonomyLevel]
  );
  const executionLogId = logResult.rows[0].id;

  const stepsResult = await pool.query(
    `SELECT * FROM campaign_scheduled_steps 
     WHERE campaign_id = $1 
       AND status IN ('pending', 'approved')
       AND scheduled_at <= NOW()
     ORDER BY step_index, scheduled_at`,
    [campaignId]
  );
  
  const steps = stepsResult.rows as CampaignScheduledStep[];
  const results: CampaignExecutionResult['steps'] = [];
  let executed = 0;
  let pendingApproval = 0;
  let failed = 0;

  for (const step of steps) {
    console.log(`[Campaign Executor] Processing step ${step.id} (${step.channel})`);
    
    // Emit activity started event for live monitoring
    const stepAny = step as any;
    if (workspaceId) {
      emitSophiaActivity(workspaceId, {
        type: 'started',
        actionId: step.id,
        actionType: `send_${step.channel}`,
        description: `Executing ${step.channel} campaign step`,
        campaignId: step.campaign_id,
        campaignName: stepAny.campaign_name || 'Campaign',
        channel: step.channel,
        contactName: stepAny.contact_name || step.contact_id,
        progress: 0,
        confidence: stepAny.confidence || 85,
        timestamp: new Date().toISOString()
      });
    }
    
    if (step.status === 'approved' || options.skipAutonomyCheck) {
      await updateStepStatus(step.id, 'executing');
      
      // Emit progress event
      if (workspaceId) {
        emitSophiaActivity(workspaceId, {
          type: 'progress',
          actionId: step.id,
          actionType: `send_${step.channel}`,
          description: `Sending ${step.channel} message`,
          campaignId: step.campaign_id,
          campaignName: stepAny.campaign_name || 'Campaign',
          channel: step.channel,
          contactName: stepAny.contact_name || step.contact_id,
          progress: 50,
          confidence: stepAny.confidence || 85,
          timestamp: new Date().toISOString()
        });
      }
      
      const result = await executeStep(step, userId, workspaceId || undefined);
      
      if (result.success) {
        await updateStepStatus(step.id, 'sent', result.messageId);
        executed++;
        results.push({
          stepId: step.id,
          contactId: step.contact_id,
          channel: step.channel,
          status: 'sent',
          messageId: result.messageId,
        });
        
        // Emit completed event
        if (workspaceId) {
          emitSophiaActivity(workspaceId, {
            type: 'completed',
            actionId: step.id,
            actionType: `send_${step.channel}`,
            description: `${step.channel} message sent successfully`,
            campaignId: step.campaign_id,
            campaignName: stepAny.campaign_name || 'Campaign',
            channel: step.channel,
            contactName: stepAny.contact_name || step.contact_id,
            progress: 100,
            confidence: stepAny.confidence || 85,
            timestamp: new Date().toISOString()
          });
        }
      } else if ((result as any).deferred) {
        // Step was deferred due to warmup limits - reschedule for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0); // Schedule for 9 AM tomorrow
        
        await pool.query(
          `UPDATE campaign_scheduled_steps 
           SET status = 'pending', 
               scheduled_at = $1::timestamp,
               error_message = 'Deferred: Daily warmup limit reached. Rescheduled for next day.',
               updated_at = NOW()
           WHERE id = $2::uuid`,
          [tomorrow.toISOString(), step.id]
        );
        
        console.log(`[Campaign Executor] Step ${step.id} deferred to ${tomorrow.toISOString()} due to warmup limits`);
        
        results.push({
          stepId: step.id,
          contactId: step.contact_id,
          channel: step.channel,
          status: 'deferred',
          error: 'Daily limit reached - rescheduled for tomorrow',
        });
        
        // Emit deferred event (not failure)
        if (workspaceId) {
          emitSophiaActivity(workspaceId, {
            type: 'progress',
            actionId: step.id,
            actionType: `send_${step.channel}`,
            description: `${step.channel} deferred: Daily warmup limit reached. Will retry tomorrow.`,
            campaignId: step.campaign_id,
            campaignName: stepAny.campaign_name || 'Campaign',
            channel: step.channel,
            contactName: stepAny.contact_name || step.contact_id,
            progress: 25,
            confidence: stepAny.confidence || 85,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Check if this is an invalid profile URL - if so, delete the contact
        const isInvalidProfileUrl = result.error?.includes('INVALID_PROFILE_URL') || 
                                     result.error?.includes('This LinkedIn profile does not exist');
        
        if (isInvalidProfileUrl && step.contact_id) {
          console.log(`[Campaign Executor] INVALID_PROFILE_URL detected - deleting contact ${step.contact_id}`);
          try {
            // Delete the contact from contacts table
            await supabase
              .from('contacts')
              .delete()
              .eq('id', step.contact_id);
            
            // Delete all campaign steps for this contact
            await supabase
              .from('campaign_steps')
              .delete()
              .eq('contact_id', step.contact_id);
            
            // Delete from campaign_contacts
            await supabase
              .from('campaign_contacts')
              .delete()
              .eq('contact_id', step.contact_id);
            
            console.log(`[Campaign Executor] Successfully deleted contact ${step.contact_id} with invalid LinkedIn URL`);
            
            // Emit cleanup event
            if (workspaceId) {
              emitSophiaActivity(workspaceId, {
                type: 'cleanup',
                actionId: step.id,
                actionType: 'delete_invalid_contact',
                description: `Deleted contact with invalid LinkedIn URL: ${stepAny.contact_name || step.contact_id}`,
                campaignId: step.campaign_id,
                campaignName: stepAny.campaign_name || 'Campaign',
                channel: step.channel,
                contactName: stepAny.contact_name || step.contact_id,
                progress: 100,
                confidence: 100,
                timestamp: new Date().toISOString()
              });
            }
            
            // Don't count as failed - it was cleaned up
            results.push({
              stepId: step.id,
              contactId: step.contact_id,
              channel: step.channel,
              status: 'deleted',
              error: 'Contact deleted due to invalid LinkedIn URL',
            });
            continue; // Skip to next step
          } catch (deleteError) {
            console.error(`[Campaign Executor] Failed to delete invalid contact:`, deleteError);
          }
        }
        
        // IRONCLAD SESSION PROTECTION: Handle proxy/temporary errors as retryable, not failed
        const isProxyOrTempError = result.error?.includes('PROXY_TEMPORARILY_UNAVAILABLE') ||
                                    result.error?.includes('LINKEDIN_TEMPORARY_ERROR') ||
                                    result.error?.includes('PROXY_TUNNEL_FAILED') ||
                                    result.error?.includes('ERR_TUNNEL') ||
                                    result.error?.includes('ECONNREFUSED') ||
                                    result.error?.includes('timeout');
        
        if (isProxyOrTempError) {
          // Reschedule for 15 minutes later instead of marking as failed
          const rescheduleTime = new Date(Date.now() + 15 * 60 * 1000);
          console.log(`[Campaign Executor] ⏸️ PROXY/TEMP ERROR - Rescheduling step ${step.id} for ${rescheduleTime.toISOString()}`);
          console.log(`[Campaign Executor] ⚠️ NOT marking as failed - session cookies are preserved`);
          
          await supabase
            .from('campaign_step_executions')
            .update({ 
              status: 'pending', 
              scheduled_at: rescheduleTime.toISOString(),
              error: null // Clear error so it shows as pending, not errored
            })
            .eq('id', step.id);
          
          results.push({
            stepId: step.id,
            contactId: step.contact_id,
            channel: step.channel,
            status: 'rescheduled',
            error: `Rescheduled due to temporary issue: ${result.error}`,
          });
          
          // Emit rescheduled event
          if (workspaceId) {
            emitSophiaActivity(workspaceId, {
              type: 'paused',
              actionId: step.id,
              actionType: `send_${step.channel}`,
              description: `Rescheduled for retry in 15 minutes (proxy temporarily unavailable)`,
              campaignId: step.campaign_id,
              campaignName: stepAny.campaign_name || 'Campaign',
              channel: step.channel,
              contactName: stepAny.contact_name || step.contact_id,
              progress: 0,
              confidence: stepAny.confidence || 85,
              timestamp: new Date().toISOString()
            });
          }
          continue; // Skip to next step
        }
        
        await updateStepStatus(step.id, 'failed', undefined, result.error);
        failed++;
        results.push({
          stepId: step.id,
          contactId: step.contact_id,
          channel: step.channel,
          status: 'failed',
          error: result.error,
        });
        
        // Emit failed event
        if (workspaceId) {
          emitSophiaActivity(workspaceId, {
            type: 'failed',
            actionId: step.id,
            actionType: `send_${step.channel}`,
            description: `${step.channel} message failed: ${result.error}`,
            campaignId: step.campaign_id,
            campaignName: stepAny.campaign_name || 'Campaign',
            channel: step.channel,
            contactName: stepAny.contact_name || step.contact_id,
            progress: 0,
            confidence: stepAny.confidence || 85,
            timestamp: new Date().toISOString()
          });
        }
      }
    } else {
      const sophiaConfidence = getStepConfidence(step);
      const approvalCheck = shouldRequireApproval(
        autonomyLevel as any,
        step.channel,
        sophiaConfidence,
        confidenceThreshold,
        isFromWorkflowDeployment
      );
      
      if (approvalCheck.requiresApproval || options.forceApproval) {
        await updateStepStatus(step.id, 'requires_approval');
        await createApprovalItem(step, approvalCheck.reason, sophiaConfidence);
        pendingApproval++;
        results.push({
          stepId: step.id,
          contactId: step.contact_id,
          channel: step.channel,
          status: 'requires_approval',
          requiresApproval: true,
          approvalReason: approvalCheck.reason,
        });
        console.log(`[Campaign Executor] Step ${step.id} requires approval: ${approvalCheck.reason}`);
      } else {
        await updateStepStatus(step.id, 'executing');
        
        const result = await executeStep(step, userId, workspaceId || undefined);
        
        if (result.success) {
          // Check for special statuses (already_invited, already_connected)
          const resultData = (result as any).data;
          const specialStatus = resultData?.status;
          
          if (specialStatus === 'already_invited' || specialStatus === 'pending') {
            // Contact already has a pending invitation - mark as skipped, not failed
            await updateStepStatus(step.id, 'skipped', undefined, 'Connection request already pending');
            console.log(`[Campaign Executor] Step ${step.id} skipped - already invited (pending connection)`);
            results.push({
              stepId: step.id,
              contactId: step.contact_id,
              channel: step.channel,
              status: 'skipped',
              message: 'Already invited - pending connection',
            });
          } else if (specialStatus === 'already_connected') {
            // Contact is already connected - mark as skipped
            await updateStepStatus(step.id, 'skipped', undefined, 'Already connected (1st degree)');
            console.log(`[Campaign Executor] Step ${step.id} skipped - already connected`);
            results.push({
              stepId: step.id,
              contactId: step.contact_id,
              channel: step.channel,
              status: 'skipped',
              message: 'Already connected',
            });
          } else {
            // Normal successful send
            await updateStepStatus(step.id, 'sent', result.messageId);
            executed++;
            results.push({
              stepId: step.id,
              contactId: step.contact_id,
              channel: step.channel,
              status: 'sent',
              messageId: result.messageId,
            });
          }
        } else if ((result as any).deferred) {
          // Step was deferred due to warmup limits - reschedule for tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);
          
          await pool.query(
            `UPDATE campaign_scheduled_steps 
             SET status = 'pending', 
                 scheduled_at = $1::timestamp,
                 error_message = 'Deferred: Daily warmup limit reached. Rescheduled for next day.',
                 updated_at = NOW()
             WHERE id = $2::uuid`,
            [tomorrow.toISOString(), step.id]
          );
          
          console.log(`[Campaign Executor] Step ${step.id} deferred to ${tomorrow.toISOString()} due to warmup limits`);
          
          results.push({
            stepId: step.id,
            contactId: step.contact_id,
            channel: step.channel,
            status: 'deferred',
            error: 'Daily limit reached - rescheduled for tomorrow',
          });
        } else {
          await updateStepStatus(step.id, 'failed', undefined, result.error);
          failed++;
          results.push({
            stepId: step.id,
            contactId: step.contact_id,
            channel: step.channel,
            status: 'failed',
            error: result.error,
          });
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  await pool.query(
    `UPDATE campaign_execution_logs 
     SET status = $1, 
         total_steps = $2,
         completed_steps = $3, 
         failed_steps = $4,
         pending_approval_steps = $5,
         completed_at = NOW()
     WHERE id = $6`,
    [
      failed > 0 && executed === 0 ? 'failed' : 'completed',
      steps.length,
      executed,
      failed,
      pendingApproval,
      executionLogId
    ]
  );

  console.log(`[Campaign Executor] Campaign ${campaignId} execution complete`);
  console.log(`[Campaign Executor] Results: ${executed} sent, ${pendingApproval} pending approval, ${failed} failed`);

  return {
    success: true,
    executionLogId,
    summary: {
      total: steps.length,
      executed,
      pendingApproval,
      failed,
    },
    steps: results,
  };
}

// ============================================
// SCHEDULE CAMPAIGN STEPS
// ============================================

export async function scheduleCampaignSteps(
  campaignId: string,
  workspaceId: string | null,
  contacts: Array<{ id: string }>,
  steps: Array<{
    channel: string;
    delay: number;
    subject?: string;
    content: string;
  }>
): Promise<{ success: boolean; scheduledCount: number }> {
  let scheduledCount = 0;
  const now = new Date();
  
  for (const contact of contacts) {
    let scheduledTime = new Date(now);
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      
      scheduledTime = new Date(scheduledTime.getTime() + step.delay * 24 * 60 * 60 * 1000);
      
      await pool.query(
        `INSERT INTO campaign_scheduled_steps (
          campaign_id, contact_id, workspace_id,
          step_index, channel, subject, content,
          scheduled_at, status, requires_approval
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          campaignId,
          contact.id,
          workspaceId,
          i,
          step.channel,
          step.subject || null,
          step.content,
          scheduledTime.toISOString(),
          'pending',
          false
        ]
      );
      scheduledCount++;
    }
  }
  
  console.log(`[Campaign Executor] Scheduled ${scheduledCount} steps for campaign ${campaignId}`);
  
  return { success: true, scheduledCount };
}

// ============================================
// APPROVAL ACTIONS
// ============================================

export async function approveScheduledStep(
  stepId: string,
  approvedBy: string
): Promise<{ success: boolean }> {
  await pool.query(
    `UPDATE campaign_scheduled_steps 
     SET status = 'approved', 
         approved_by = $1, 
         approved_at = NOW(),
         requires_approval = false,
         updated_at = NOW()
     WHERE id = $2`,
    [approvedBy, stepId]
  );
  
  await pool.query(
    `UPDATE sophia_approval_items 
     SET status = 'approved', 
         resolved_by = $1, 
         resolved_at = NOW(),
         updated_at = NOW()
     WHERE scheduled_step_id = $2`,
    [approvedBy, stepId]
  );
  
  return { success: true };
}

export async function rejectScheduledStep(
  stepId: string,
  rejectedBy: string,
  reason?: string
): Promise<{ success: boolean }> {
  await pool.query(
    `UPDATE campaign_scheduled_steps 
     SET status = 'cancelled', 
         error_message = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [reason || 'Rejected by user', stepId]
  );
  
  await pool.query(
    `UPDATE sophia_approval_items 
     SET status = 'rejected', 
         resolved_by = $1, 
         resolved_at = NOW(),
         resolution_notes = $2,
         updated_at = NOW()
     WHERE scheduled_step_id = $3`,
    [rejectedBy, reason, stepId]
  );
  
  return { success: true };
}

// ============================================
// GET PENDING APPROVALS
// ============================================

export async function getPendingApprovals(
  workspaceId: string | null
): Promise<SophiaApprovalItem[]> {
  const result = await pool.query(
    `SELECT * FROM sophia_approval_items 
     WHERE (workspace_id = $1 OR ($1 IS NULL AND workspace_id IS NULL))
       AND status = 'pending'
     ORDER BY created_at DESC`,
    [workspaceId]
  );
  return result.rows;
}

// ============================================
// BACKGROUND JOB RUNNER
// ============================================

let executorInterval: NodeJS.Timeout | null = null;

export function startCampaignExecutorJob(intervalMs: number = 60000) {
  if (executorInterval) {
    console.log('[Campaign Executor] Job already running');
    return;
  }
  
  if (!isSupabaseConfigured) {
    console.warn('[Campaign Executor] Supabase not configured - background job disabled');
    return;
  }
  
  console.log(`[Campaign Executor] Starting background job (interval: ${intervalMs}ms)`);
  
  executorInterval = setInterval(async () => {
    try {
      console.log('[Campaign Executor Job] Checking for pending steps...');
      
      // Debug: Check total steps and their statuses
      const debugResult = await pool.query(
        `SELECT status, COUNT(*) as count 
         FROM campaign_scheduled_steps 
         GROUP BY status`
      );
      console.log(`[Campaign Executor Job] Step status summary: ${JSON.stringify(debugResult.rows)}`);
      
      // Debug: Find any steps with error messages (indicates rescheduling)
      const rescheduledSteps = await pool.query(
        `SELECT id, status, scheduled_at, error_message, updated_at
         FROM campaign_scheduled_steps 
         WHERE error_message IS NOT NULL
         ORDER BY updated_at DESC
         LIMIT 5`
      );
      if (rescheduledSteps.rows.length > 0) {
        console.log(`[Campaign Executor Job] Rescheduled/errored steps found:`,
          JSON.stringify(rescheduledSteps.rows.map(r => ({
            id: r.id.slice(0,8),
            status: r.status,
            scheduled_at: r.scheduled_at,
            error: r.error_message?.slice(0,50),
            updated_at: r.updated_at
          }))));
      }
      
      // Debug: Check READY steps specifically (scheduled_at in past but still pending)
      const readySteps = await pool.query(
        `SELECT id, campaign_id, scheduled_at, NOW() as current_time, status, channel
         FROM campaign_scheduled_steps 
         WHERE status = 'pending'
           AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 10`
      );
      console.log(`[Campaign Executor Job] READY steps (past scheduled_at): ${readySteps.rows.length}`, 
        readySteps.rows.length > 0 ? JSON.stringify(readySteps.rows.map(r => ({
          id: r.id.slice(0,8),
          scheduled_at: r.scheduled_at,
          campaign_id: r.campaign_id.slice(0,8),
          channel: r.channel
        }))) : 'none');
      
      // Debug: Check next pending steps
      const nextPendingSteps = await pool.query(
        `SELECT scheduled_at, NOW() as current_time, 
                CASE WHEN scheduled_at <= NOW() THEN 'READY' ELSE 'FUTURE' END as readiness
         FROM campaign_scheduled_steps 
         WHERE status = 'pending'
         ORDER BY scheduled_at ASC
         LIMIT 5`
      );
      console.log(`[Campaign Executor Job] Next 5 pending steps:`, JSON.stringify(nextPendingSteps.rows));
      
      // First get pending and approved steps from PostgreSQL
      const pendingStepsResult = await pool.query(
        `SELECT DISTINCT campaign_id 
         FROM campaign_scheduled_steps 
         WHERE status IN ('pending', 'approved')
           AND scheduled_at <= NOW()
         LIMIT 10`
      );
      
      console.log(`[Campaign Executor Job] Found ${pendingStepsResult.rows.length} campaigns with pending steps`);
      
      // NEW: Check for LinkedIn Search campaigns that need their search triggered
      try {
        await checkAndTriggerLinkedInSearchCampaigns();
      } catch (searchError: any) {
        console.log(`[Campaign Executor Job] LinkedIn search check error: ${searchError.message}`);
      }
      
      // NEW: Auto-schedule workflow steps for contacts that don't have them yet
      try {
        await autoScheduleStepsForNewContacts();
      } catch (scheduleError: any) {
        console.log(`[Campaign Executor Job] Auto-schedule steps error: ${scheduleError.message}`);
      }
      
      if (pendingStepsResult.rows.length === 0) {
        return; // No steps to process
      }
      
      const campaignIds = pendingStepsResult.rows.map(r => r.campaign_id);
      
      // Get campaign details from Supabase
      if (!supabase) {
        console.error('[Campaign Executor Job] Supabase not available');
        return;
      }
      
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, user_id, workspace_id, status')
        .in('id', campaignIds)
        .eq('status', 'active');
      
      if (error) {
        console.error('[Campaign Executor Job] Supabase error:', error);
        return;
      }
      
      for (const campaign of campaigns || []) {
        console.log(`[Campaign Executor Job] Processing campaign ${campaign.id}`);
        await executeCampaign(
          campaign.id,
          campaign.user_id,
          campaign.workspace_id
        );
      }
    } catch (error) {
      console.error('[Campaign Executor Job] Error:', error);
    }
  }, intervalMs);
}

export function stopCampaignExecutorJob() {
  if (executorInterval) {
    clearInterval(executorInterval);
    executorInterval = null;
    console.log('[Campaign Executor] Background job stopped');
  }
}

// ============================================
// SAFETY-AWARE LINKEDIN INVITE SCHEDULING
// ============================================

import { 
  canPerformAction, 
  getSafetySettings,
  getDefaultLimits,
  initializeSafetySettings,
  calculateNextDelay,
  recordAction
} from './linkedin-safety-controls';

interface SafeSchedulingResult {
  success: boolean;
  scheduledCount: number;
  skippedCount: number;
  reason?: string;
  safetyLimits?: {
    dailyRemaining: number;
    weeklyRemaining: number;
    scheduledForToday: number;
    deferredToNextDay: number;
  };
}

/**
 * Schedule LinkedIn invites with safety controls integration
 * Respects daily/weekly limits, working hours, and spacing requirements
 * Personalizes messages and filters contacts without LinkedIn URLs
 */
export async function scheduleLinkedInInvitesWithSafety(
  campaignId: string,
  workspaceId: string | null,
  contacts: Array<{ id: string; linkedin_url?: string; first_name?: string; last_name?: string; company?: string }>,
  inviteMessage: string,
  linkedInAccountId?: string
): Promise<SafeSchedulingResult> {
  const accountId = linkedInAccountId || workspaceId || 'default';
  
  console.log(`[LinkedIn Safety Scheduler] Scheduling invites for ${contacts.length} contacts in campaign ${campaignId}`);
  console.log(`[LinkedIn Safety Scheduler] Using account/workspace: ${accountId}`);
  
  // Filter contacts that have LinkedIn URLs
  const contactsWithLinkedIn = contacts.filter(c => c.linkedin_url && c.linkedin_url.trim().length > 0);
  const skippedNoLinkedIn = contacts.length - contactsWithLinkedIn.length;
  
  if (skippedNoLinkedIn > 0) {
    console.log(`[LinkedIn Safety Scheduler] Skipping ${skippedNoLinkedIn} contacts without LinkedIn URLs`);
  }
  
  if (contactsWithLinkedIn.length === 0) {
    console.log(`[LinkedIn Safety Scheduler] No contacts with LinkedIn URLs found`);
    return {
      success: false,
      scheduledCount: 0,
      skippedCount: contacts.length,
      reason: 'No contacts have LinkedIn profile URLs',
      safetyLimits: {
        dailyRemaining: 0,
        weeklyRemaining: 0,
        scheduledForToday: 0,
        deferredToNextDay: 0
      }
    };
  }
  
  // Initialize safety settings if not already configured
  let settings = getSafetySettings(accountId);
  if (!settings) {
    console.log(`[LinkedIn Safety Scheduler] No safety settings found for ${accountId}, initializing defaults`);
    settings = initializeSafetySettings(accountId, {
      type: 'free',
      connectionCount: 500,
      accountAgeDays: 365
    });
  }
  
  // Check if we can perform any actions at all
  const actionCheck = canPerformAction(accountId, 'connection_request');
  
  if (!actionCheck.allowed) {
    console.log(`[LinkedIn Safety Scheduler] Cannot schedule invites: ${actionCheck.reason}`);
    return {
      success: false,
      scheduledCount: 0,
      skippedCount: contacts.length,
      reason: actionCheck.reason,
      safetyLimits: {
        dailyRemaining: actionCheck.remainingToday || 0,
        weeklyRemaining: actionCheck.remainingThisWeek || 0,
        scheduledForToday: 0,
        deferredToNextDay: contacts.length
      }
    };
  }
  
  const dailyLimit = actionCheck.remainingToday || 20;
  const weeklyLimit = actionCheck.remainingThisWeek || 100;
  const effectiveLimit = Math.min(dailyLimit, weeklyLimit, contactsWithLinkedIn.length);
  
  console.log(`[LinkedIn Safety Scheduler] Daily remaining: ${dailyLimit}, Weekly remaining: ${weeklyLimit}`);
  console.log(`[LinkedIn Safety Scheduler] Will schedule up to ${effectiveLimit} invites today`);
  
  let scheduledCount = 0;
  let skippedCount = skippedNoLinkedIn;
  let scheduledForToday = 0;
  let deferredToNextDay = 0;
  const actuallyScheduledContactIds: string[] = []; // Track actual inserts
  
  const now = new Date();
  let currentScheduleTime = new Date(now);
  
  // Get delay settings for spacing invites
  const delaySettings = calculateNextDelay(accountId);
  const baseDelayMinutes = delaySettings.delayMs ? Math.ceil(delaySettings.delayMs / 60000) : 5;
  
  // Helper to personalize message for a contact
  const personalizeMessage = (template: string, contact: { first_name?: string; last_name?: string; company?: string }): string => {
    return template
      .replace(/\{\{first_name\}\}/gi, contact.first_name || '')
      .replace(/\{\{last_name\}\}/gi, contact.last_name || '')
      .replace(/\{\{company\}\}/gi, contact.company || '')
      .trim();
  };
  
  for (let i = 0; i < contactsWithLinkedIn.length; i++) {
    const contact = contactsWithLinkedIn[i];
    
    // Personalize the invite message for this contact
    const personalizedMessage = personalizeMessage(inviteMessage, contact);
    
    // Check if we've hit today's limit - defer remaining to next day
    if (scheduledForToday >= effectiveLimit) {
      // Schedule for next day with staggered times
      const daysToAdd = Math.floor((i - effectiveLimit) / effectiveLimit) + 1;
      const positionInDay = (i - effectiveLimit) % effectiveLimit;
      
      const nextDayScheduleTime = new Date(now);
      nextDayScheduleTime.setDate(nextDayScheduleTime.getDate() + daysToAdd);
      nextDayScheduleTime.setHours(9, 0, 0, 0); // Start at 9 AM
      nextDayScheduleTime.setMinutes(nextDayScheduleTime.getMinutes() + (positionInDay * baseDelayMinutes));
      
      const result = await pool.query(
        `INSERT INTO campaign_scheduled_steps (
          campaign_id, contact_id, workspace_id,
          step_index, channel, subject, content,
          scheduled_at, status, requires_approval
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (campaign_id, contact_id, step_index) DO NOTHING`,
        [
          campaignId,
          contact.id,
          workspaceId,
          0,
          'linkedin_connection',
          'LinkedIn Connection Invite',
          personalizedMessage,
          nextDayScheduleTime.toISOString(),
          'pending',
          false
        ]
      );
      
      // Only count if actually inserted (rowCount > 0)
      if (result.rowCount && result.rowCount > 0) {
        scheduledCount++;
        deferredToNextDay++;
        actuallyScheduledContactIds.push(contact.id);
      }
      continue;
    }
    
    // Add delay between invites (humanized spacing)
    const randomDelay = baseDelayMinutes + Math.floor(Math.random() * 3);
    currentScheduleTime = new Date(currentScheduleTime.getTime() + randomDelay * 60 * 1000);
    
    // Check working hours - if outside, push to next day's working hours
    const hour = currentScheduleTime.getHours();
    const workingHoursStart = settings.safetyFeatures?.workingHours?.start || 9;
    const workingHoursEnd = settings.safetyFeatures?.workingHours?.end || 18;
    
    let isDeferred = false;
    if (hour >= workingHoursEnd || hour < workingHoursStart) {
      // Push to next day's start of working hours
      currentScheduleTime.setDate(currentScheduleTime.getDate() + 1);
      currentScheduleTime.setHours(workingHoursStart, Math.floor(Math.random() * 30), 0, 0);
      isDeferred = true;
    }
    
    try {
      const result = await pool.query(
        `INSERT INTO campaign_scheduled_steps (
          campaign_id, contact_id, workspace_id,
          step_index, channel, subject, content,
          scheduled_at, status, requires_approval
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (campaign_id, contact_id, step_index) DO NOTHING`,
        [
          campaignId,
          contact.id,
          workspaceId,
          0,
          'linkedin_connection',
          'LinkedIn Connection Invite',
          personalizedMessage,
          currentScheduleTime.toISOString(),
          'pending',
          false
        ]
      );
      
      // Only count if actually inserted (rowCount > 0)
      if (result.rowCount && result.rowCount > 0) {
        scheduledCount++;
        actuallyScheduledContactIds.push(contact.id);
        if (isDeferred) {
          deferredToNextDay++;
        } else {
          scheduledForToday++;
          // Record action in safety module for today's scheduled invites
          recordAction(accountId, 'connection_request');
        }
      }
    } catch (err) {
      console.error(`[LinkedIn Safety Scheduler] Error scheduling invite for contact ${contact.id}:`, err);
      skippedCount++;
    }
  }
  
  console.log(`[LinkedIn Safety Scheduler] Completed: ${scheduledCount} scheduled, ${skippedCount} skipped`);
  console.log(`[LinkedIn Safety Scheduler] Today: ${scheduledForToday}, Deferred: ${deferredToNextDay}`);
  
  // Update campaign_contacts status for actually scheduled contacts
  if (actuallyScheduledContactIds.length > 0 && supabase) {
    await supabase
      .from('campaign_contacts')
      .update({ status: 'invite_scheduled', current_step: 1 })
      .eq('campaign_id', campaignId)
      .in('contact_id', actuallyScheduledContactIds);
  }
  
  return {
    success: scheduledCount > 0,
    scheduledCount,
    skippedCount,
    safetyLimits: {
      dailyRemaining: Math.max(0, dailyLimit - scheduledForToday),
      weeklyRemaining: Math.max(0, weeklyLimit - scheduledCount),
      scheduledForToday,
      deferredToNextDay
    }
  };
}
