import type { Express } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  executeCampaign, 
  scheduleCampaignSteps,
  approveScheduledStep,
  rejectScheduledStep,
  getPendingApprovals,
  startCampaignExecutorJob,
  stopCampaignExecutorJob,
  autoScheduleStepsForNewContacts
} from './lib/campaign-executor';
import { initCampaignExecutorTables } from './lib/db-init-campaign-executor';
import { logLearningOutcome } from './lib/sophia-reporting';
import { generateSophiaInsights } from './lib/sophia-campaign-monitor';
import { sharedPool as pool } from './lib/shared-db-pool';
// Stale connection job removed - no auto-withdrawals needed

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Validate Supabase configuration
const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);
const isSupabaseServiceConfigured = !!(supabaseUrl && supabaseServiceKey);

// Only create clients if properly configured
const supabaseAuth = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
const supabase = isSupabaseServiceConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

async function getAuthenticatedUser(req: any): Promise<{ id: string } | null> {
  if (!supabaseAuth) return null;
  
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  
  const token = authHeader.substring(7);
  if (!token || token.length < 20) return null;
  
  try {
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// Helper functions for error type labeling
function getErrorTypeLabel(errorType: string): string {
  const labels: Record<string, string> = {
    'connection_timeout': 'Connection Timeout',
    'linkedin_not_connected': 'LinkedIn Not Connected',
    'session_expired': 'Session Expired',
    'proxy_error': 'Proxy Connection Failed',
    'missing_linkedin_url': 'Missing LinkedIn URL',
    'warmup_limit': 'Warmup Limit Reached',
    'rate_limited': 'Rate Limited by LinkedIn',
    'other_error': 'Other Error',
    'unknown': 'Unknown Error'
  };
  return labels[errorType] || 'Error';
}

function getErrorRecommendation(errorType: string): string {
  const recommendations: Record<string, string> = {
    'connection_timeout': 'The browser connection to LinkedIn timed out. This often happens when the system is under heavy load. Try resetting the failed contacts to retry.',
    'linkedin_not_connected': 'Your LinkedIn account is not connected. Go to My Connections to link your LinkedIn account.',
    'session_expired': 'Your LinkedIn session has expired. Please reconnect your LinkedIn account in My Connections.',
    'proxy_error': 'The proxy server connection failed. This is usually temporary - try resetting the failed contacts.',
    'missing_linkedin_url': 'These contacts do not have a LinkedIn profile URL. Update their contact information to include LinkedIn URLs.',
    'warmup_limit': 'Daily warmup limit reached to protect your account. These will automatically retry tomorrow.',
    'rate_limited': 'LinkedIn is temporarily limiting requests. Wait a few hours before retrying.',
    'other_error': 'An unexpected error occurred. Try resetting and retrying these contacts.',
    'unknown': 'Unable to determine the error cause. Try resetting and retrying these contacts.'
  };
  return recommendations[errorType] || 'Try resetting the failed contacts to retry.';
}

export function registerCampaignExecutorRoutes(app: Express) {
  
  initCampaignExecutorTables().then(() => {
    startCampaignExecutorJob(60000);
    // Stale connection job removed - no auto-withdrawals needed
  }).catch(err => {
    console.error('[Campaign Executor] Init failed:', err);
  });

  app.post('/api/campaign-scheduled-steps/reset-failed', async (req, res) => {
    try {
      // First check current status
      const beforeResult = await pool.query(`
        SELECT status, COUNT(*) as count 
        FROM campaign_scheduled_steps 
        GROUP BY status
      `);
      console.log(`[Campaign Steps] Status BEFORE reset: ${JSON.stringify(beforeResult.rows)}`);
      
      // Reset both failed steps AND stuck executing steps (older than 5 minutes)
      // Use STAGGERED scheduling - each step gets 90 seconds apart to prevent lock collisions
      const result = await pool.query(`
        UPDATE campaign_scheduled_steps css
        SET status = 'pending', 
            executed_at = NULL, 
            error_message = NULL,
            scheduled_at = NOW() + (rn.row_num * INTERVAL '90 seconds'),
            updated_at = NOW()
        FROM (
          SELECT sub.id as step_id, ROW_NUMBER() OVER (ORDER BY sub.id) - 1 as row_num
          FROM campaign_scheduled_steps sub
          WHERE sub.status = 'failed'
             OR (sub.status = 'executing' AND sub.updated_at < NOW() - INTERVAL '5 minutes')
        ) rn
        WHERE css.id = rn.step_id
          AND (css.status = 'failed'
             OR (css.status = 'executing' AND css.updated_at < NOW() - INTERVAL '5 minutes'))
        RETURNING css.id
      `);
      
      // Verify the update
      const afterResult = await pool.query(`
        SELECT status, COUNT(*) as count 
        FROM campaign_scheduled_steps 
        GROUP BY status
      `);
      console.log(`[Campaign Steps] Status AFTER reset: ${JSON.stringify(afterResult.rows)}`);
      console.log(`[Campaign Steps] Reset ${result.rowCount} steps to pending`);
      
      res.json({ 
        success: true, 
        resetCount: result.rowCount,
        ids: result.rows.map(r => r.id),
        before: beforeResult.rows,
        after: afterResult.rows
      });
    } catch (error) {
      console.error('[Campaign Steps] Reset failed:', error);
      res.status(500).json({ error: 'Reset failed' });
    }
  });

  app.post('/api/campaigns/:campaignId/execute-scheduled', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { forceApproval, skipAutonomyCheck } = req.body;

      if (!supabase) {
        return res.status(503).json({ error: 'Database not configured' });
      }

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .single();

      if (campaignError || !campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const result = await executeCampaign(
        campaignId,
        user.id,
        campaign.workspace_id,
        { forceApproval, skipAutonomyCheck }
      );

      res.json(result);
    } catch (error) {
      console.error('Campaign execution error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Execution failed' 
      });
    }
  });

  app.post('/api/campaigns/:campaignId/schedule-steps', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { contacts, steps } = req.body;

      if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
        return res.status(400).json({ error: 'contacts array is required' });
      }

      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: 'steps array is required' });
      }

      if (!supabase) {
        return res.status(503).json({ error: 'Database not configured' });
      }

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .single();

      if (campaignError || !campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const result = await scheduleCampaignSteps(
        campaignId,
        campaign.workspace_id,
        contacts,
        steps
      );

      res.json(result);
    } catch (error) {
      console.error('Schedule steps error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Scheduling failed' 
      });
    }
  });

  app.post('/api/campaigns/:campaignId/schedule-linkedin-invites', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { inviteMessage } = req.body;

      if (!supabase) {
        return res.status(503).json({ error: 'Database not configured' });
      }

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('user_id', user.id)
        .single();

      if (campaignError || !campaign) {
        return res.status(404).json({ error: 'Campaign not found or not authorized' });
      }

      const { data: campaignContacts, error: ccError } = await supabase
        .from('campaign_contacts')
        .select('contact_id, status')
        .eq('campaign_id', campaignId)
        .in('status', ['pending', 'imported', 'assigned']);

      if (ccError || !campaignContacts || campaignContacts.length === 0) {
        return res.status(400).json({ error: 'No contacts found in campaign' });
      }

      console.log(`[Campaign Executor] Scheduling LinkedIn invites for ${campaignContacts.length} contacts in campaign ${campaignId}`);

      const contacts = campaignContacts.map(cc => ({ id: cc.contact_id }));
      
      const defaultInviteMessage = inviteMessage || "Hi {{first_name}}, I came across your profile and thought we might benefit from connecting. Looking forward to networking with you!";
      
      const steps = [
        {
          channel: 'linkedin_connection',
          delay: 0,
          subject: 'LinkedIn Connection Invite',
          content: defaultInviteMessage
        }
      ];

      const result = await scheduleCampaignSteps(
        campaignId,
        campaign.workspace_id,
        contacts,
        steps
      );

      const scheduledContactIds = contacts.map(c => c.id);
      await supabase
        .from('campaign_contacts')
        .update({ status: 'invite_scheduled', current_step: 1 })
        .eq('campaign_id', campaignId)
        .in('contact_id', scheduledContactIds);

      console.log(`[Campaign Executor] Scheduled ${result.scheduledCount} LinkedIn invite steps`);

      res.json({
        success: true,
        scheduledCount: result.scheduledCount,
        message: `Scheduled LinkedIn connection invites for ${contacts.length} contacts`
      });
    } catch (error) {
      console.error('Schedule LinkedIn invites error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Scheduling failed' 
      });
    }
  });

  // Manual trigger for auto-scheduling steps for new contacts
  app.post('/api/campaigns/auto-schedule-steps', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      console.log(`[Auto-Schedule API] Manual trigger by user ${user.id}`);
      
      const result = await autoScheduleStepsForNewContacts();
      
      return res.json({
        success: true,
        scheduled: result.scheduled,
        errors: result.errors,
        message: `Scheduled ${result.scheduled} contacts for LinkedIn connection steps`
      });
    } catch (error) {
      console.error('[Auto-Schedule API] Error:', error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Auto-scheduling failed' 
      });
    }
  });

  app.post('/api/campaigns/:campaignId/backfill-scheduled-steps', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { inviteMessage } = req.body;
      const defaultMessage = inviteMessage || "Hi, I'd like to connect with you on LinkedIn.";

      console.log(`[Backfill] Starting backfill for campaign ${campaignId}`);

      if (!supabase) {
        return res.status(500).json({ error: 'Supabase not configured' });
      }

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('id, workspace_id, name')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const { data: contacts, error: contactsError } = await supabase
        .from('campaign_contacts')
        .select('contact_id, status')
        .eq('campaign_id', campaignId)
        .eq('status', 'invite_scheduled');

      if (contactsError) {
        return res.status(500).json({ error: 'Failed to fetch contacts' });
      }

      if (!contacts || contacts.length === 0) {
        return res.json({ 
          success: true, 
          message: 'No contacts with invite_scheduled status found',
          backfilledCount: 0 
        });
      }

      console.log(`[Backfill] Found ${contacts.length} contacts with invite_scheduled status`);

      const existingSteps = await pool.query(
        `SELECT contact_id FROM campaign_scheduled_steps WHERE campaign_id = $1`,
        [campaignId]
      );
      const existingContactIds = new Set(existingSteps.rows.map(r => r.contact_id));

      const contactIds = contacts
        .map(c => c.contact_id)
        .filter(id => !existingContactIds.has(id));

      if (contactIds.length === 0) {
        return res.json({ 
          success: true, 
          message: 'All contacts already have scheduled steps',
          backfilledCount: 0 
        });
      }

      const { data: contactDetails, error: detailsError } = await supabase
        .from('contacts')
        .select('id, linkedin_url, first_name, last_name, company')
        .in('id', contactIds);

      if (detailsError || !contactDetails) {
        return res.status(500).json({ error: 'Failed to fetch contact details' });
      }

      const contactsWithLinkedIn = contactDetails.filter(c => c.linkedin_url && c.linkedin_url.trim().length > 0);
      console.log(`[Backfill] ${contactsWithLinkedIn.length} of ${contactDetails.length} contacts have LinkedIn URLs`);

      let backfilledCount = 0;
      const now = new Date();

      for (let i = 0; i < contactsWithLinkedIn.length; i++) {
        const contact = contactsWithLinkedIn[i];
        const scheduledAt = new Date(now.getTime() + (i * 5 * 60 * 1000)); // 5 min spacing

        const personalizedMessage = defaultMessage
          .replace(/\{\{first_name\}\}/gi, contact.first_name || '')
          .replace(/\{\{last_name\}\}/gi, contact.last_name || '')
          .replace(/\{\{company\}\}/gi, contact.company || '')
          .trim();

        try {
          await pool.query(
            `INSERT INTO campaign_scheduled_steps (
              campaign_id, contact_id, workspace_id,
              step_index, channel, subject, content,
              scheduled_at, status, requires_approval
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (campaign_id, contact_id, step_index) DO NOTHING`,
            [
              campaignId,
              contact.id,
              campaign.workspace_id,
              0,
              'linkedin_connection',
              'LinkedIn Connection Invite',
              personalizedMessage,
              scheduledAt.toISOString(),
              'pending',
              false
            ]
          );
          backfilledCount++;
        } catch (err) {
          console.error(`[Backfill] Error inserting step for contact ${contact.id}:`, err);
        }
      }

      console.log(`[Backfill] Completed: ${backfilledCount} steps created`);

      res.json({
        success: true,
        message: `Backfilled ${backfilledCount} scheduled steps for campaign`,
        backfilledCount,
        totalContactsChecked: contacts.length,
        contactsWithLinkedIn: contactsWithLinkedIn.length
      });
    } catch (error) {
      console.error('[Backfill] Error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Backfill failed' 
      });
    }
  });

  app.get('/api/approvals/pending', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const workspaceId = req.query.workspaceId as string | undefined;

      const approvals = await getPendingApprovals(workspaceId || null);

      const enrichedApprovals = await Promise.all(
        approvals.map(async (approval) => {
          let contactInfo: { first_name: string; last_name: string; email: string; company: string } | null = null;
          let campaignInfo: { name: string } | null = null;

          if (approval.contact_id && supabase) {
            const { data: contactData } = await supabase
              .from('contacts')
              .select('first_name, last_name, email, company')
              .eq('id', approval.contact_id)
              .single();
            if (contactData) {
              contactInfo = contactData;
            }
          }

          if (approval.campaign_id && supabase) {
            const { data: campaignData } = await supabase
              .from('campaigns')
              .select('name')
              .eq('id', approval.campaign_id)
              .single();
            if (campaignData) {
              campaignInfo = campaignData;
            }
          }

          return {
            ...approval,
            contact: contactInfo,
            campaign: campaignInfo,
          };
        })
      );

      res.json({ approvals: enrichedApprovals });
    } catch (error) {
      console.error('Get approvals error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get approvals' 
      });
    }
  });

  app.post('/api/approvals/:stepId/approve', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { stepId } = req.params;

      const stepResult = await pool.query(
        `SELECT css.*, sai.sophia_reasoning, sai.sophia_confidence 
         FROM campaign_scheduled_steps css
         LEFT JOIN sophia_approval_items sai ON sai.scheduled_step_id = css.id
         WHERE css.id = $1`,
        [stepId]
      );
      const step = stepResult.rows[0];

      await approveScheduledStep(stepId, user.id);

      if (step) {
        await logLearningOutcome({
          workspace_id: step.workspace_id,
          action_type: `send_${step.channel}`,
          original_decision: `Send ${step.channel} to contact: ${step.content?.substring(0, 100)}...`,
          user_decision: 'approved',
          sophia_reasoning: step.sophia_reasoning || 'Autonomous action queued for approval',
          sophia_confidence: Number(step.sophia_confidence) || 75,
          applied_to_future: false
        });
      }

      res.json({ success: true, message: 'Step approved successfully' });
    } catch (error) {
      console.error('Approve step error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Approval failed' 
      });
    }
  });

  app.post('/api/approvals/:stepId/reject', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { stepId } = req.params;
      const { reason } = req.body;

      const stepResult = await pool.query(
        `SELECT css.*, sai.sophia_reasoning, sai.sophia_confidence 
         FROM campaign_scheduled_steps css
         LEFT JOIN sophia_approval_items sai ON sai.scheduled_step_id = css.id
         WHERE css.id = $1`,
        [stepId]
      );
      const step = stepResult.rows[0];

      await rejectScheduledStep(stepId, user.id, reason);

      if (step) {
        await logLearningOutcome({
          workspace_id: step.workspace_id,
          action_type: `send_${step.channel}`,
          original_decision: `Send ${step.channel} to contact: ${step.content?.substring(0, 100)}...`,
          user_decision: 'rejected',
          sophia_reasoning: step.sophia_reasoning || 'Autonomous action queued for approval',
          sophia_confidence: Number(step.sophia_confidence) || 75,
          user_feedback: reason || 'No reason provided',
          applied_to_future: false
        });
      }

      res.json({ success: true, message: 'Step rejected successfully' });
    } catch (error) {
      console.error('Reject step error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Rejection failed' 
      });
    }
  });

  app.get('/api/campaigns/:campaignId/scheduled-steps', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;

      const stepsResult = await pool.query(
        `SELECT * FROM campaign_scheduled_steps 
         WHERE campaign_id = $1
         ORDER BY scheduled_at, step_index`,
        [campaignId]
      );

      const steps = stepsResult.rows;
      
      if (steps.length === 0) {
        return res.json({ steps: [] });
      }

      const contactIds = [...new Set(steps.map((s: any) => s.contact_id).filter(Boolean))];
      
      let contactsMap: Record<string, any> = {};
      if (contactIds.length > 0 && supabase) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, company')
          .in('id', contactIds);
        
        if (contacts) {
          contactsMap = contacts.reduce((acc: Record<string, any>, c: any) => {
            acc[c.id] = c;
            return acc;
          }, {});
        }
      }

      const enrichedSteps = steps.map((step: any) => ({
        ...step,
        first_name: contactsMap[step.contact_id]?.first_name || null,
        last_name: contactsMap[step.contact_id]?.last_name || null,
        email: contactsMap[step.contact_id]?.email || null,
        company: contactsMap[step.contact_id]?.company || null,
      }));

      res.json({ steps: enrichedSteps });
    } catch (error) {
      console.error('Get scheduled steps error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get steps' 
      });
    }
  });

  app.get('/api/campaigns/:campaignId/progress', async (req, res) => {
    try {
      console.log('[Campaign Progress] Request received for campaign:', req.params.campaignId);
      
      const user = await getAuthenticatedUser(req);
      if (!user) {
        console.log('[Campaign Progress] No authenticated user');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      console.log('[Campaign Progress] User authenticated:', user.id);

      const { campaignId } = req.params;

      // Get all scheduled steps grouped by contact with current step details
      const stepsResult = await pool.query(
        `SELECT 
          contact_id,
          COUNT(*) as total_steps,
          COUNT(CASE WHEN status IN ('sent', 'completed') THEN 1 END) as completed_steps,
          MAX(CASE WHEN status IN ('sent', 'completed') THEN executed_at END) as last_activity,
          MIN(scheduled_at) as first_scheduled_at,
          MIN(CASE WHEN status = 'pending' THEN scheduled_at END) as next_scheduled_at,
          (SELECT executed_at FROM campaign_scheduled_steps css_exec 
           WHERE css_exec.campaign_id = $1 AND css_exec.contact_id = campaign_scheduled_steps.contact_id 
           AND css_exec.channel = 'linkedin_connection' AND css_exec.status IN ('sent', 'completed')
           ORDER BY step_index LIMIT 1) as invite_sent_at,
          (SELECT channel FROM campaign_scheduled_steps css2 
           WHERE css2.campaign_id = $1 AND css2.contact_id = campaign_scheduled_steps.contact_id 
           ORDER BY step_index DESC LIMIT 1) as current_channel,
          (SELECT status FROM campaign_scheduled_steps css3 
           WHERE css3.campaign_id = $1 AND css3.contact_id = campaign_scheduled_steps.contact_id 
           ORDER BY step_index DESC LIMIT 1) as current_step_status,
          (SELECT error_message FROM campaign_scheduled_steps css4 
           WHERE css4.campaign_id = $1 AND css4.contact_id = campaign_scheduled_steps.contact_id 
           AND css4.status = 'failed'
           ORDER BY step_index DESC LIMIT 1) as error_message,
          CASE 
            WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) > 0 THEN 'failed'
            WHEN COUNT(*) = COUNT(CASE WHEN status IN ('sent', 'completed') THEN 1 END) AND COUNT(CASE WHEN status = 'completed' THEN 1 END) > 0 THEN 'completed'
            WHEN COUNT(CASE WHEN status = 'sent' THEN 1 END) > 0 THEN 'sent'
            WHEN COUNT(CASE WHEN status = 'skipped' THEN 1 END) > 0 AND COUNT(CASE WHEN status NOT IN ('skipped', 'sent', 'completed') THEN 1 END) = 0 THEN 'skipped'
            WHEN COUNT(CASE WHEN status = 'requires_approval' THEN 1 END) > 0 THEN 'awaiting_approval'
            WHEN COUNT(CASE WHEN status = 'executing' THEN 1 END) > 0 THEN 'executing'
            WHEN COUNT(CASE WHEN status = 'pending' THEN 1 END) > 0 THEN 'pending'
            ELSE 'active'
          END as status
         FROM campaign_scheduled_steps 
         WHERE campaign_id = $1 AND contact_id IS NOT NULL
         GROUP BY contact_id
         ORDER BY MIN(scheduled_at) ASC NULLS LAST`,
        [campaignId]
      );

      let contactProgress = stepsResult.rows;
      
      // Also get contacts from campaign_contacts table (in Supabase) that may not have steps yet
      if (supabase) {
        const { data: campaignContacts, error: ccError } = await supabase
          .from('campaign_contacts')
          .select('contact_id, status, current_step, assigned_at')
          .eq('campaign_id', campaignId);
        
        if (ccError) {
          console.log('[Campaign Progress] Error fetching campaign_contacts:', ccError.message);
        }
        
        const existingContactIds = new Set(contactProgress.map((c: any) => c.contact_id));
        
        // Add contacts from campaign_contacts that aren't in scheduled steps
        if (campaignContacts) {
          console.log(`[Campaign Progress] Found ${campaignContacts.length} contacts in campaign_contacts for ${campaignId}`);
          for (const cc of campaignContacts) {
            if (!existingContactIds.has(cc.contact_id)) {
              const ccStatus = cc.status || 'pending';
              const statusLabel = ccStatus === 'invite_scheduled' ? 'invite_scheduled' : 
                                  ccStatus === 'imported' ? 'imported' : 
                                  ccStatus === 'assigned' ? 'assigned' : 'pending';
              contactProgress.push({
                contact_id: cc.contact_id,
                total_steps: 0,
                completed_steps: 0,
                last_activity: cc.assigned_at,
                current_channel: ccStatus === 'invite_scheduled' ? 'linkedin_connection' : null,
                current_step_status: ccStatus === 'invite_scheduled' ? 'pending' : null,
                status: statusLabel
              });
            }
          }
        }
      }
      
      if (contactProgress.length === 0) {
        return res.json({ contacts: [] });
      }

      const contactIds = contactProgress.map((c: any) => c.contact_id);
      
      let contactsMap: Record<string, any> = {};
      if (supabase) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, company')
          .in('id', contactIds);
        
        if (contacts) {
          contactsMap = contacts.reduce((acc: Record<string, any>, c: any) => {
            acc[c.id] = c;
            return acc;
          }, {});
        }
      }

      const getStepLabel = (channel: string | null, stepStatus: string | null, overallStatus: string) => {
        if (!channel) {
          if (overallStatus === 'invite_scheduled') return 'Invite Scheduled';
          if (overallStatus === 'pending' || overallStatus === 'imported' || overallStatus === 'assigned') return 'Awaiting Invite';
          return 'Not Started';
        }
        
        const channelLabels: Record<string, Record<string, string>> = {
          'linkedin_connection': {
            'pending': 'Awaiting Response',
            'approved': 'Invite Ready',
            'executing': 'Sending Invite...',
            'sent': 'Awaiting Response',
            'completed': 'Connected',
            'failed': 'Invite Failed',
            'skipped': 'Already Connected',
            'deferred': 'Warmup Limit - Queued for Tomorrow',
            'requires_approval': 'Needs Approval'
          },
          'linkedin_message': {
            'pending': 'Message Scheduled',
            'approved': 'Message Ready',
            'executing': 'Sending Message...',
            'sent': 'Message Sent',
            'completed': 'Message Delivered',
            'failed': 'Message Failed',
            'requires_approval': 'Needs Approval'
          },
          'email': {
            'pending': 'Email Scheduled',
            'approved': 'Email Ready',
            'executing': 'Sending Email...',
            'sent': 'Email Sent',
            'completed': 'Email Delivered',
            'failed': 'Email Failed',
            'requires_approval': 'Needs Approval'
          }
        };
        
        const channelLabel = channelLabels[channel] || channelLabels['linkedin_connection'];
        return channelLabel[stepStatus || 'pending'] || `${channel}: ${stepStatus || 'pending'}`;
      };

      // Parse error messages to user-friendly format
      const parseErrorMessage = (error: string | null): { label: string; isSessionError: boolean } => {
        if (!error) return { label: 'Unknown error', isSessionError: false };
        
        // Check for specific error codes first
        if (error.includes('LINKEDIN_NOT_CONNECTED')) {
          return { label: 'LinkedIn Not Connected', isSessionError: true };
        }
        if (error.includes('LINKEDIN_SESSION_EXPIRED')) {
          return { label: 'LinkedIn Session Expired', isSessionError: true };
        }
        if (error.includes('LINKEDIN_SESSION_ERROR')) {
          return { label: 'LinkedIn Session Error', isSessionError: true };
        }
        
        // Fallback pattern matching for legacy errors
        if (error.includes('No saved LinkedIn session') || error.includes('No session cookies')) {
          return { label: 'LinkedIn Not Connected', isSessionError: true };
        }
        if (error.includes('inactive') || error.includes('Please reconnect')) {
          return { label: 'LinkedIn Session Expired', isSessionError: true };
        }
        if (error.includes('proxy') || error.includes('Proxy')) {
          return { label: 'Proxy Connection Failed', isSessionError: false };
        }
        if (error.includes('profile URL required') || error.includes('profile URL or ID')) {
          return { label: 'Missing LinkedIn Profile URL', isSessionError: false };
        }
        if (error.includes('WARMUP_DEFERRED')) {
          return { label: 'Deferred: Warmup Limit Reached', isSessionError: false };
        }
        
        // Generic fallback - truncate long messages
        const truncated = error.length > 50 ? error.substring(0, 50) + '...' : error;
        return { label: truncated, isSessionError: false };
      };

      const enrichedContacts = contactProgress.map((p: any, idx: number) => {
        const errorInfo = p.error_message ? parseErrorMessage(p.error_message) : null;
        const inviteSent = !!p.invite_sent_at;
        const inviteStatus = inviteSent ? 'sent' : (p.current_channel === 'linkedin_connection' ? 'pending' : 'not_applicable');
        
        return {
          contact_id: p.contact_id,
          contact_name: contactsMap[p.contact_id] 
            ? `${contactsMap[p.contact_id].first_name || ''} ${contactsMap[p.contact_id].last_name || ''}`.trim() || 'Unknown'
            : 'Unknown',
          contact_email: contactsMap[p.contact_id]?.email || '',
          company: contactsMap[p.contact_id]?.company || '',
          total_steps: parseInt(p.total_steps) || 0,
          completed_steps: parseInt(p.completed_steps) || 0,
          status: p.status,
          current_step_label: getStepLabel(p.current_channel, p.current_step_status, p.status),
          last_activity: p.last_activity,
          last_action: getStepLabel(p.current_channel, p.current_step_status, p.status),
          error_message: p.error_message || null,
          error_label: errorInfo?.label || null,
          is_session_error: errorInfo?.isSessionError || false,
          queue_position: idx + 1,
          first_scheduled_at: p.first_scheduled_at || null,
          next_scheduled_at: p.next_scheduled_at || null,
          invite_sent_at: p.invite_sent_at || null,
          invite_status: inviteStatus
        };
      });

      const hasScheduledInvites = enrichedContacts.some((c: any) => 
        c.current_step_label && c.current_step_label !== 'Awaiting Invite' && c.current_step_label !== 'Not Started'
      );
      
      // Get error breakdown statistics for failed contacts
      const errorBreakdownResult = await pool.query(`
        SELECT 
          CASE 
            WHEN error_message ILIKE '%timeout%' OR error_message ILIKE '%Network.enable%' THEN 'connection_timeout'
            WHEN error_message ILIKE '%LINKEDIN_NOT_CONNECTED%' OR error_message ILIKE '%No saved LinkedIn session%' THEN 'linkedin_not_connected'
            WHEN error_message ILIKE '%LINKEDIN_SESSION_EXPIRED%' OR error_message ILIKE '%inactive%' THEN 'session_expired'
            WHEN error_message ILIKE '%proxy%' THEN 'proxy_error'
            WHEN error_message ILIKE '%profile URL%' OR error_message ILIKE '%Missing LinkedIn%' THEN 'missing_linkedin_url'
            WHEN error_message ILIKE '%WARMUP_DEFERRED%' THEN 'warmup_limit'
            WHEN error_message ILIKE '%rate limit%' OR error_message ILIKE '%throttl%' THEN 'rate_limited'
            WHEN error_message IS NOT NULL THEN 'other_error'
            ELSE 'unknown'
          END as error_type,
          COUNT(*) as count,
          MAX(error_message) as sample_error
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 
          AND status = 'failed'
        GROUP BY 
          CASE 
            WHEN error_message ILIKE '%timeout%' OR error_message ILIKE '%Network.enable%' THEN 'connection_timeout'
            WHEN error_message ILIKE '%LINKEDIN_NOT_CONNECTED%' OR error_message ILIKE '%No saved LinkedIn session%' THEN 'linkedin_not_connected'
            WHEN error_message ILIKE '%LINKEDIN_SESSION_EXPIRED%' OR error_message ILIKE '%inactive%' THEN 'session_expired'
            WHEN error_message ILIKE '%proxy%' THEN 'proxy_error'
            WHEN error_message ILIKE '%profile URL%' OR error_message ILIKE '%Missing LinkedIn%' THEN 'missing_linkedin_url'
            WHEN error_message ILIKE '%WARMUP_DEFERRED%' THEN 'warmup_limit'
            WHEN error_message ILIKE '%rate limit%' OR error_message ILIKE '%throttl%' THEN 'rate_limited'
            WHEN error_message IS NOT NULL THEN 'other_error'
            ELSE 'unknown'
          END
        ORDER BY count DESC
      `, [campaignId]);

      const errorBreakdown = errorBreakdownResult.rows.map((row: any) => ({
        errorType: row.error_type,
        count: parseInt(row.count),
        sampleError: row.sample_error,
        label: getErrorTypeLabel(row.error_type),
        recommendation: getErrorRecommendation(row.error_type)
      }));

      const totalFailed = errorBreakdown.reduce((sum: number, e: any) => sum + e.count, 0);
      
      // Get campaign stage summary with next action timing
      const stageStatsResult = await pool.query(`
        SELECT 
          channel,
          status,
          COUNT(*) as count,
          MIN(scheduled_at) as earliest_scheduled,
          MAX(scheduled_at) as latest_scheduled,
          MIN(CASE WHEN status = 'pending' THEN scheduled_at END) as next_pending_at
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1
        GROUP BY channel, status
        ORDER BY 
          CASE channel 
            WHEN 'linkedin_connection' THEN 1 
            WHEN 'linkedin_message' THEN 2 
            WHEN 'email' THEN 3 
            ELSE 4 
          END,
          CASE status 
            WHEN 'pending' THEN 1 
            WHEN 'executing' THEN 2 
            WHEN 'sent' THEN 3 
            WHEN 'completed' THEN 4 
            WHEN 'failed' THEN 5 
            ELSE 6 
          END
      `, [campaignId]);
      
      // Get the next scheduled step overall
      const nextStepResult = await pool.query(`
        SELECT 
          css.id,
          css.channel,
          css.scheduled_at,
          css.status,
          c.first_name,
          c.last_name
        FROM campaign_scheduled_steps css
        LEFT JOIN contacts c ON css.contact_id = c.id
        WHERE css.campaign_id = $1 
          AND css.status = 'pending'
          AND css.scheduled_at IS NOT NULL
        ORDER BY css.scheduled_at ASC
        LIMIT 1
      `, [campaignId]);
      
      // Get schedule range for pending steps
      const scheduleRangeResult = await pool.query(`
        SELECT 
          MIN(scheduled_at) as earliest_pending,
          MAX(scheduled_at) as latest_pending,
          COUNT(*) as pending_count
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 AND status = 'pending'
      `, [campaignId]);
      
      // Build stage summary
      const stageStats = stageStatsResult.rows;
      const nextStep = nextStepResult.rows[0] || null;
      const scheduleRange = scheduleRangeResult.rows[0] || { earliest_pending: null, latest_pending: null, pending_count: 0 };
      
      // Determine current campaign stage
      const channelStats: Record<string, { pending: number; executing: number; sent: number; completed: number; failed: number }> = {};
      stageStats.forEach((stat: any) => {
        if (!channelStats[stat.channel]) {
          channelStats[stat.channel] = { pending: 0, executing: 0, sent: 0, completed: 0, failed: 0 };
        }
        channelStats[stat.channel][stat.status as keyof typeof channelStats[string]] = parseInt(stat.count);
      });
      
      // Calculate overall totals
      const totalContacts = enrichedContacts.length;
      const connectionStats = channelStats['linkedin_connection'] || { pending: 0, executing: 0, sent: 0, completed: 0, failed: 0 };
      const messageStats = channelStats['linkedin_message'] || { pending: 0, executing: 0, sent: 0, completed: 0, failed: 0 };
      
      // Determine campaign stage based on what's happening
      let currentStage = 'unknown';
      let stageLabel = 'Unknown';
      let stageProgress = 0;
      
      if (connectionStats.pending > 0 && connectionStats.sent === 0 && connectionStats.completed === 0) {
        currentStage = 'connection_scheduled';
        stageLabel = 'Connection Requests Scheduled';
        stageProgress = 0;
      } else if (connectionStats.executing > 0) {
        currentStage = 'sending_connections';
        stageLabel = 'Sending Connection Requests';
        stageProgress = Math.round((connectionStats.sent + connectionStats.completed) / totalContacts * 100);
      } else if (connectionStats.sent > 0 || connectionStats.completed > 0) {
        const connectionTotal = connectionStats.pending + connectionStats.sent + connectionStats.completed;
        const connectionDone = connectionStats.sent + connectionStats.completed;
        if (connectionStats.pending > 0) {
          currentStage = 'connections_in_progress';
          stageLabel = 'Connection Requests In Progress';
          stageProgress = Math.round(connectionDone / connectionTotal * 100);
        } else if (messageStats.pending > 0) {
          currentStage = 'messages_scheduled';
          stageLabel = 'Follow-up Messages Scheduled';
          stageProgress = Math.round(connectionDone / totalContacts * 100);
        } else {
          currentStage = 'connections_complete';
          stageLabel = 'Connection Requests Complete';
          stageProgress = 100;
        }
      } else if (totalContacts > 0) {
        currentStage = 'contacts_imported';
        stageLabel = 'Contacts Imported - Awaiting Scheduling';
        stageProgress = 0;
      }
      
      // Format next action info
      let nextAction: { type: string; label: string; scheduledAt: string; contactName: string } | null = null;
      if (nextStep) {
        const channelLabels: Record<string, string> = {
          'linkedin_connection': 'LinkedIn Connection Request',
          'linkedin_message': 'LinkedIn Message',
          'email': 'Email'
        };
        nextAction = {
          type: nextStep.channel,
          label: channelLabels[nextStep.channel] || nextStep.channel,
          scheduledAt: nextStep.scheduled_at,
          contactName: `${nextStep.first_name || ''} ${nextStep.last_name || ''}`.trim() || 'Unknown'
        };
      }
      
      // Build campaign status summary
      const campaignStatus = {
        currentStage,
        stageLabel,
        stageProgress,
        totalContacts,
        nextAction,
        scheduleWindow: {
          start: scheduleRange.earliest_pending,
          end: scheduleRange.latest_pending,
          pendingCount: parseInt(scheduleRange.pending_count) || 0
        },
        channelBreakdown: {
          linkedin_connection: {
            label: 'LinkedIn Connections',
            pending: connectionStats.pending,
            sent: connectionStats.sent,
            completed: connectionStats.completed,
            failed: connectionStats.failed,
            total: connectionStats.pending + connectionStats.sent + connectionStats.completed + connectionStats.failed
          },
          linkedin_message: {
            label: 'LinkedIn Messages',
            pending: messageStats.pending,
            sent: messageStats.sent,
            completed: messageStats.completed,
            failed: messageStats.failed,
            total: messageStats.pending + messageStats.sent + messageStats.completed + messageStats.failed
          }
        },
        serverTime: new Date().toISOString()
      };
      
      res.json({ 
        contacts: enrichedContacts,
        hasScheduledInvites,
        errorBreakdown,
        totalFailed,
        campaignStatus
      });
    } catch (error) {
      console.error('Get campaign progress error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get progress' 
      });
    }
  });

  // Sophia insights endpoint - provides AI monitoring and recommendations
  app.get('/api/campaigns/:campaignId/sophia-insights', async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      // Get contact progress for this campaign
      const contactsResult = await pool.query(`
        SELECT 
          contact_id,
          CASE 
            WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) > 0 THEN 'failed'
            WHEN COUNT(CASE WHEN status = 'sent' THEN 1 END) > 0 THEN 'sent'
            WHEN COUNT(CASE WHEN status = 'completed' THEN 1 END) > 0 THEN 'completed'
            WHEN COUNT(CASE WHEN status = 'skipped' THEN 1 END) > 0 THEN 'skipped'
            WHEN COUNT(CASE WHEN status = 'pending' THEN 1 END) > 0 THEN 'pending'
            ELSE 'active'
          END as status,
          MAX(executed_at) as invite_sent_at
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 AND contact_id IS NOT NULL
        GROUP BY contact_id
      `, [campaignId]);
      
      // Get contact names
      const contactIds = contactsResult.rows.map(r => r.contact_id).filter(Boolean);
      let contactsMap: Record<string, string> = {};
      
      if (contactIds.length > 0 && supabase) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .in('id', contactIds);
        
        if (contacts) {
          contactsMap = Object.fromEntries(
            contacts.map(c => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()])
          );
        }
      }
      
      // Build contacts array for insights
      const contactsForInsights = contactsResult.rows.map(r => ({
        status: r.status,
        name: contactsMap[r.contact_id] || 'Unknown',
        inviteSentAt: r.invite_sent_at
      }));
      
      // Generate Sophia insights
      const insights = await generateSophiaInsights(campaignId, contactsForInsights);
      
      res.json(insights);
    } catch (error) {
      console.error('Sophia insights error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to generate insights',
        summary: 'Unable to generate insights at this time.',
        insights: [],
        metrics: { totalContacts: 0, invitesSent: 0, awaitingResponse: 0, connected: 0, scheduled: 0, alreadyConnected: 0, failed: 0 }
      });
    }
  });

  // Campaign status summary endpoint (for monitoring dashboard)
  app.get('/api/campaigns/:campaignId/status-summary', async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      // Get campaign info
      let campaignName = 'Unknown Campaign';
      if (supabase) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('name')
          .eq('id', campaignId)
          .single();
        if (campaign?.name) campaignName = campaign.name;
      }
      
      // Get step statistics by channel and status
      const statsResult = await pool.query(`
        SELECT 
          channel,
          status,
          COUNT(*) as count,
          MIN(scheduled_at) as earliest,
          MAX(scheduled_at) as latest
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1
        GROUP BY channel, status
        ORDER BY channel, status
      `, [campaignId]);
      
      // Get next pending step
      const nextStepResult = await pool.query(`
        SELECT 
          css.channel,
          css.scheduled_at,
          c.first_name,
          c.last_name
        FROM campaign_scheduled_steps css
        LEFT JOIN contacts c ON css.contact_id = c.id
        WHERE css.campaign_id = $1 
          AND css.status = 'pending'
          AND css.scheduled_at IS NOT NULL
        ORDER BY css.scheduled_at ASC
        LIMIT 1
      `, [campaignId]);
      
      // Get schedule window
      const windowResult = await pool.query(`
        SELECT 
          MIN(scheduled_at) as start_time,
          MAX(scheduled_at) as end_time,
          COUNT(*) as pending_count
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 AND status = 'pending'
      `, [campaignId]);
      
      // Get total contacts
      const contactsResult = await pool.query(`
        SELECT COUNT(DISTINCT contact_id) as total
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1
      `, [campaignId]);
      
      // Aggregate stats
      const stats = statsResult.rows;
      const connectionPending = stats.find((s: any) => s.channel === 'linkedin_connection' && s.status === 'pending');
      const connectionSent = stats.find((s: any) => s.channel === 'linkedin_connection' && s.status === 'sent');
      const connectionCompleted = stats.find((s: any) => s.channel === 'linkedin_connection' && s.status === 'completed');
      const connectionFailed = stats.find((s: any) => s.channel === 'linkedin_connection' && s.status === 'failed');
      
      const nextStep = nextStepResult.rows[0];
      const window = windowResult.rows[0];
      const totalContacts = parseInt(contactsResult.rows[0]?.total) || 0;
      
      // Determine current stage
      let stage = 'unknown';
      let stageLabel = 'Unknown';
      if (connectionPending && !connectionSent && !connectionCompleted) {
        stage = 'scheduled';
        stageLabel = 'Connection Requests Scheduled';
      } else if (connectionSent || connectionCompleted) {
        if (connectionPending) {
          stage = 'in_progress';
          stageLabel = 'Sending Connection Requests';
        } else {
          stage = 'complete';
          stageLabel = 'All Connection Requests Sent';
        }
      }
      
      // Build summary
      const channelLabels: Record<string, string> = {
        'linkedin_connection': 'LinkedIn Connection',
        'linkedin_message': 'LinkedIn Message',
        'email': 'Email'
      };
      
      res.json({
        campaignId,
        campaignName,
        currentStage: stage,
        stageLabel,
        totalContacts,
        breakdown: {
          connections: {
            pending: parseInt(connectionPending?.count) || 0,
            sent: parseInt(connectionSent?.count) || 0,
            completed: parseInt(connectionCompleted?.count) || 0,
            failed: parseInt(connectionFailed?.count) || 0
          }
        },
        scheduleWindow: window ? {
          startTime: window.start_time,
          endTime: window.end_time,
          pendingCount: parseInt(window.pending_count) || 0
        } : null,
        nextAction: nextStep ? {
          type: nextStep.channel,
          label: channelLabels[nextStep.channel] || nextStep.channel,
          scheduledAt: nextStep.scheduled_at,
          contactName: `${nextStep.first_name || ''} ${nextStep.last_name || ''}`.trim()
        } : null,
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('Campaign status summary error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  app.get('/api/campaigns/:campaignId/execution-logs', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;

      const result = await pool.query(
        `SELECT * FROM campaign_execution_logs 
         WHERE campaign_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [campaignId]
      );

      res.json({ logs: result.rows });
    } catch (error) {
      console.error('Get execution logs error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get logs' 
      });
    }
  });

  app.post('/api/approvals/bulk-approve', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { stepIds } = req.body;

      if (!stepIds || !Array.isArray(stepIds)) {
        return res.status(400).json({ error: 'stepIds array is required' });
      }

      const results = await Promise.all(
        stepIds.map(stepId => approveScheduledStep(stepId, user.id))
      );

      res.json({ 
        success: true, 
        approved: results.filter(r => r.success).length,
        message: `${results.filter(r => r.success).length} steps approved` 
      });
    } catch (error) {
      console.error('Bulk approve error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Bulk approval failed' 
      });
    }
  });

  // Reset failed steps so they can be retried
  app.post('/api/campaigns/:campaignId/reset-failed-steps', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { contactIds, errorType } = req.body; // Optional: reset specific contacts or by error type

      // Verify campaign ownership
      if (supabase) {
        const { data: campaign, error: campaignError } = await supabase
          .from('campaigns')
          .select('id, user_id')
          .eq('id', campaignId)
          .eq('user_id', user.id)
          .single();

        if (campaignError || !campaign) {
          return res.status(404).json({ error: 'Campaign not found or not authorized' });
        }
      }

      // First, get the failed steps to reset so we can stagger them
      let selectQuery = `
        SELECT id FROM campaign_scheduled_steps
        WHERE campaign_id = $1 
          AND status = 'failed'
      `;
      const selectParams: any[] = [campaignId];
      let selectParamIndex = 2;

      // Build the query to reset failed steps with STAGGERED scheduling
      // Each step gets scheduled 90 seconds apart to prevent lock collisions
      let query = `
        UPDATE campaign_scheduled_steps css
        SET status = 'pending', 
            error_message = NULL,
            scheduled_at = NOW() + (rn.row_num * INTERVAL '90 seconds'),
            updated_at = NOW()
        FROM (
          SELECT sub.id as step_id, ROW_NUMBER() OVER (ORDER BY sub.id) - 1 as row_num
          FROM campaign_scheduled_steps sub
          WHERE sub.campaign_id = $1 AND sub.status = 'failed'
        ) rn
        WHERE css.id = rn.step_id
          AND css.campaign_id = $1 
          AND css.status = 'failed'
      `;
      const params: any[] = [campaignId];
      let paramIndex = 2;

      // Filter by error type if specified - use same patterns as error breakdown query
      if (errorType) {
        switch (errorType) {
          case 'connection_timeout':
            query += ` AND (css.error_message ILIKE $${paramIndex} OR css.error_message ILIKE $${paramIndex + 1})`;
            params.push('%timeout%', '%Network.enable%');
            paramIndex += 2;
            break;
          case 'linkedin_not_connected':
            query += ` AND (css.error_message ILIKE $${paramIndex} OR css.error_message ILIKE $${paramIndex + 1})`;
            params.push('%LINKEDIN_NOT_CONNECTED%', '%No saved LinkedIn session%');
            paramIndex += 2;
            break;
          case 'session_expired':
            query += ` AND (css.error_message ILIKE $${paramIndex} OR css.error_message ILIKE $${paramIndex + 1})`;
            params.push('%LINKEDIN_SESSION_EXPIRED%', '%inactive%');
            paramIndex += 2;
            break;
          case 'proxy_error':
            query += ` AND css.error_message ILIKE $${paramIndex}`;
            params.push('%proxy%');
            paramIndex += 1;
            break;
          case 'missing_linkedin_url':
            query += ` AND (css.error_message ILIKE $${paramIndex} OR css.error_message ILIKE $${paramIndex + 1})`;
            params.push('%profile URL%', '%Missing LinkedIn%');
            paramIndex += 2;
            break;
          case 'warmup_limit':
            query += ` AND css.error_message ILIKE $${paramIndex}`;
            params.push('%WARMUP_DEFERRED%');
            paramIndex += 1;
            break;
          case 'rate_limited':
            query += ` AND (css.error_message ILIKE $${paramIndex} OR css.error_message ILIKE $${paramIndex + 1})`;
            params.push('%rate limit%', '%throttl%');
            paramIndex += 2;
            break;
          case 'other_error':
            // other_error = has error message but doesn't match any known pattern
            query += ` AND css.error_message IS NOT NULL 
              AND css.error_message NOT ILIKE '%timeout%' 
              AND css.error_message NOT ILIKE '%Network.enable%'
              AND css.error_message NOT ILIKE '%LINKEDIN_NOT_CONNECTED%' 
              AND css.error_message NOT ILIKE '%No saved LinkedIn session%'
              AND css.error_message NOT ILIKE '%LINKEDIN_SESSION_EXPIRED%' 
              AND css.error_message NOT ILIKE '%inactive%'
              AND css.error_message NOT ILIKE '%proxy%'
              AND css.error_message NOT ILIKE '%profile URL%' 
              AND css.error_message NOT ILIKE '%Missing LinkedIn%'
              AND css.error_message NOT ILIKE '%WARMUP_DEFERRED%'
              AND css.error_message NOT ILIKE '%rate limit%' 
              AND css.error_message NOT ILIKE '%throttl%'`;
            break;
          case 'unknown':
            query += ` AND css.error_message IS NULL`;
            break;
          default:
            console.log(`[Reset Failed Steps] Unknown error type: ${errorType}, resetting all failed`);
        }
      }

      if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
        query += ` AND css.contact_id = ANY($${paramIndex}::uuid[])`;
        params.push(contactIds);
      }

      query += ' RETURNING css.id, css.contact_id';

      const result = await pool.query(query, params);

      // Also reset the campaign_contacts status if they were marked as failed
      if (supabase) {
        const contactIdsToReset = result.rows.map(r => r.contact_id);
        if (contactIdsToReset.length > 0) {
          await supabase
            .from('campaign_contacts')
            .update({ status: 'invite_scheduled' })
            .eq('campaign_id', campaignId)
            .in('contact_id', contactIdsToReset);
        }
      }

      console.log(`[Campaign Executor] Reset ${result.rows.length} failed steps for campaign ${campaignId}`);

      res.json({
        success: true,
        resetCount: result.rows.length,
        message: `Reset ${result.rows.length} failed steps. They will be retried on the next execution cycle.`
      });
    } catch (error) {
      console.error('Reset failed steps error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to reset steps' 
      });
    }
  });

  // DEV ONLY: Debug endpoint to check campaign step status
  app.get('/api/dev/campaigns/:campaignId/debug-steps', async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      const result = await pool.query(`
        SELECT id, contact_id, channel, status, scheduled_at, executed_at, error_message
        FROM campaign_scheduled_steps 
        WHERE campaign_id = $1
        ORDER BY scheduled_at
        LIMIT 20
      `, [campaignId]);
      
      const pendingCount = await pool.query(`
        SELECT COUNT(*) as count FROM campaign_scheduled_steps 
        WHERE campaign_id = $1 AND status IN ('pending', 'approved') AND scheduled_at <= NOW()
      `, [campaignId]);
      
      res.json({
        campaignId,
        totalSteps: result.rows.length,
        pendingNow: parseInt(pendingCount.rows[0]?.count || '0'),
        steps: result.rows
      });
    } catch (error) {
      console.error('[DEV] Debug steps error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch steps' });
    }
  });

  // DEV ONLY: Reset failed steps without auth for testing
  app.post('/api/dev/campaigns/:campaignId/reset-failed-steps', async (req, res) => {
    try {
      const { campaignId } = req.params;

      // Reset all failed steps to pending
      const result = await pool.query(`
        UPDATE campaign_scheduled_steps 
        SET status = 'pending', 
            error_message = NULL,
            scheduled_at = NOW(),
            updated_at = NOW()
        WHERE campaign_id = $1 
          AND status = 'failed'
        RETURNING id, contact_id
      `, [campaignId]);

      // Also reset the campaign_contacts status
      if (supabase && result.rows.length > 0) {
        const contactIdsToReset = result.rows.map(r => r.contact_id);
        await supabase
          .from('campaign_contacts')
          .update({ status: 'invite_scheduled' })
          .eq('campaign_id', campaignId)
          .in('contact_id', contactIdsToReset);
      }

      console.log(`[DEV] Reset ${result.rows.length} failed steps for campaign ${campaignId}`);
      
      // Verify the reset worked
      const verifyResult = await pool.query(`
        SELECT status, COUNT(*) as count 
        FROM campaign_scheduled_steps 
        WHERE campaign_id = $1 
        GROUP BY status
      `, [campaignId]);
      console.log(`[DEV] After reset - status summary: ${JSON.stringify(verifyResult.rows)}`);

      res.json({
        success: true,
        resetCount: result.rows.length,
        statusAfterReset: verifyResult.rows,
        message: `Reset ${result.rows.length} failed steps. They will be retried on the next execution cycle (every 60s).`
      });
    } catch (error) {
      console.error('[DEV] Reset failed steps error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to reset steps' 
      });
    }
  });

  // DEV ONLY: Reset "sent" steps that have errors back to pending
  app.post('/api/dev/campaigns/:campaignId/reset-errored-sent-steps', async (req, res) => {
    try {
      const { campaignId } = req.params;

      // Reset steps that are marked "sent" but have error_message (failed execution)
      const result = await pool.query(`
        UPDATE campaign_scheduled_steps 
        SET status = 'pending', 
            error_message = NULL,
            executed_at = NULL,
            scheduled_at = NOW(),
            updated_at = NOW()
        WHERE campaign_id = $1 
          AND status = 'sent'
          AND error_message IS NOT NULL
        RETURNING id, contact_id, error_message
      `, [campaignId]);

      console.log(`[DEV] Reset ${result.rows.length} errored "sent" steps for campaign ${campaignId}`);

      res.json({
        success: true,
        resetCount: result.rows.length,
        resetSteps: result.rows,
        message: `Reset ${result.rows.length} errored "sent" steps to pending. They will retry on next cycle.`
      });
    } catch (error) {
      console.error('[DEV] Reset errored sent steps error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to reset steps' 
      });
    }
  });

  // DEV ONLY: Reset ALL sent steps to pending for testing (clears daily counter)
  app.post('/api/dev/campaigns/:campaignId/reset-all-sent-steps', async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      // Reset ALL sent steps back to pending - useful for testing when no real invites were sent
      const result = await pool.query(`
        UPDATE campaign_scheduled_steps 
        SET status = 'pending', 
            error_message = NULL,
            executed_at = NULL,
            scheduled_at = NOW(),
            updated_at = NOW()
        WHERE campaign_id = $1 
          AND status = 'sent'
        RETURNING id, contact_id
      `, [campaignId]);
      
      console.log(`[DEV] Reset ${result.rows.length} sent steps to pending for campaign ${campaignId}`);
      
      // Get updated status summary
      const statusSummary = await pool.query(`
        SELECT status, COUNT(*)::int as count 
        FROM campaign_scheduled_steps 
        WHERE campaign_id = $1 
        GROUP BY status 
        ORDER BY status
      `, [campaignId]);
      
      res.json({
        success: true,
        resetCount: result.rows.length,
        statusAfterReset: statusSummary.rows,
        message: `Reset ${result.rows.length} sent steps to pending. Daily counter is now 0.`
      });
    } catch (error) {
      console.error('[DEV] Reset all sent steps error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to reset sent steps' 
      });
    }
  });

  // DEV ONLY: Reschedule pending steps to run NOW
  app.post('/api/dev/campaigns/:campaignId/schedule-now', async (req, res) => {
    try {
      const { campaignId } = req.params;

      // Update all pending steps to execute NOW
      const result = await pool.query(`
        UPDATE campaign_scheduled_steps 
        SET scheduled_at = NOW(),
            updated_at = NOW()
        WHERE campaign_id = $1 
          AND status = 'pending'
        RETURNING id, contact_id, channel
      `, [campaignId]);

      console.log(`[DEV] Rescheduled ${result.rows.length} pending steps to NOW for campaign ${campaignId}`);

      res.json({
        success: true,
        rescheduledCount: result.rows.length,
        message: `Rescheduled ${result.rows.length} pending steps to execute now. They will run on the next executor cycle (every 60s).`
      });
    } catch (error) {
      console.error('[DEV] Schedule now error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to reschedule steps' 
      });
    }
  });

  // DEV ONLY: Reschedule ONE pending step to run NOW (for testing)
  app.post('/api/dev/campaigns/:campaignId/schedule-one-now', async (req, res) => {
    try {
      const { campaignId } = req.params;

      // Update just ONE pending step to execute NOW
      const result = await pool.query(`
        UPDATE campaign_scheduled_steps 
        SET scheduled_at = NOW(),
            updated_at = NOW()
        WHERE id = (
          SELECT id FROM campaign_scheduled_steps
          WHERE campaign_id = $1 
            AND status = 'pending'
          ORDER BY scheduled_at ASC
          LIMIT 1
        )
        RETURNING id, contact_id, channel
      `, [campaignId]);

      if (result.rows.length === 0) {
        return res.json({ success: false, message: 'No pending steps found' });
      }

      console.log(`[DEV] Rescheduled 1 pending step to NOW for campaign ${campaignId}:`, result.rows[0]);

      res.json({
        success: true,
        step: result.rows[0],
        message: `Rescheduled 1 step to execute now. Will run on the next executor cycle (every 60s).`
      });
    } catch (error) {
      console.error('[DEV] Schedule one now error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to reschedule step' 
      });
    }
  });

  // Get failed steps with error details for debugging
  app.get('/api/campaigns/:campaignId/failed-steps', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;

      const result = await pool.query(
        `SELECT 
          css.id,
          css.contact_id,
          css.channel,
          css.status,
          css.error_message,
          css.created_at,
          css.executed_at,
          css.scheduled_at
         FROM campaign_scheduled_steps css
         WHERE css.campaign_id = $1 
           AND css.status = 'failed'
         ORDER BY css.executed_at DESC`,
        [campaignId]
      );

      // Enrich with contact names if available
      let enrichedSteps = result.rows;
      if (supabase && result.rows.length > 0) {
        const contactIds = result.rows.map(r => r.contact_id);
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name, email, linkedin_url')
          .in('id', contactIds);

        if (contacts) {
          const contactsMap = contacts.reduce((acc: any, c: any) => {
            acc[c.id] = c;
            return acc;
          }, {});

          enrichedSteps = result.rows.map(step => ({
            ...step,
            contact_name: contactsMap[step.contact_id] 
              ? `${contactsMap[step.contact_id].first_name || ''} ${contactsMap[step.contact_id].last_name || ''}`.trim()
              : 'Unknown',
            contact_email: contactsMap[step.contact_id]?.email || '',
            linkedin_url: contactsMap[step.contact_id]?.linkedin_url || null
          }));
        }
      }

      res.json({ 
        failedSteps: enrichedSteps,
        totalFailed: enrichedSteps.length 
      });
    } catch (error) {
      console.error('Get failed steps error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get failed steps' 
      });
    }
  });

  app.get('/api/campaigns/:campaignId/search-job-status', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const workspaceId = req.headers['x-workspace-id'] as string || req.query.workspaceId as string;

      if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      // First try to get campaign info to find related search jobs
      const campaignResult = await supabase
        .from('campaigns')
        .select('settings, workspace_id')
        .eq('id', campaignId)
        .single();
      
      if (!campaignResult.data) {
        return res.json({ status: 'not_started', resultsCount: 0 });
      }

      const wsId = campaignResult.data.workspace_id || workspaceId;
      
      // Find the most recent LinkedIn search job for this workspace
      const result = await pool.query(
        `SELECT id, status, total_found, total_pulled, error, created_at, started_at, completed_at
         FROM linkedin_search_jobs 
         WHERE workspace_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [wsId]
      );

      if (result.rows.length === 0) {
        return res.json({ status: 'not_started', resultsCount: 0 });
      }

      const job = result.rows[0];
      res.json({
        status: job.status,
        resultsCount: job.total_pulled || job.total_found || 0,
        error: job.error,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at
      });
    } catch (error) {
      console.error('Get search job status error:', error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : 'Failed to get search job status' 
      });
    }
  });

  // DEV endpoint to schedule LinkedIn invites without auth (for testing only)
  app.post('/api/dev/campaigns/:campaignId/schedule-linkedin-invites', async (req, res) => {
    // Security: Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'This endpoint is only available in development' });
    }
    
    try {
      const { campaignId } = req.params;
      const { workspaceId, inviteMessage } = req.body;
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
      }
      
      // Get all campaign contacts that need invites scheduled
      const ccResult = await pool.query(
        `SELECT cc.contact_id, c.first_name, c.linkedin_url
         FROM campaign_contacts cc
         JOIN contacts c ON c.id::text = cc.contact_id::text
         WHERE cc.campaign_id = $1 
         AND cc.status IN ('pending', 'imported', 'assigned')
         AND c.linkedin_url IS NOT NULL`,
        [campaignId]
      );
      
      if (ccResult.rows.length === 0) {
        return res.json({ scheduled: 0, message: 'No contacts found needing invites' });
      }
      
      // Check which contacts already have scheduled steps
      const existingSteps = await pool.query(
        `SELECT DISTINCT contact_id FROM campaign_scheduled_steps WHERE campaign_id = $1`,
        [campaignId]
      );
      const existingContactIds = new Set(existingSteps.rows.map(r => r.contact_id));
      
      const contactsToSchedule = ccResult.rows.filter(c => !existingContactIds.has(c.contact_id));
      
      if (contactsToSchedule.length === 0) {
        return res.json({ scheduled: 0, message: 'All contacts already have scheduled steps', existingCount: existingContactIds.size });
      }
      
      console.log(`[Campaign Executor DEV] Scheduling LinkedIn invites for ${contactsToSchedule.length} new contacts (${existingContactIds.size} already have steps)`);
      
      const contacts = contactsToSchedule.map(c => ({ id: c.contact_id }));
      const defaultInviteMessage = inviteMessage || "Hi {{first_name}}, I came across your profile and thought we might benefit from connecting. Looking forward to networking with you!";
      
      const steps = [{
        channel: 'linkedin_connection',
        delay: 0,
        subject: 'LinkedIn Connection Invite',
        content: defaultInviteMessage
      }];
      
      const result = await scheduleCampaignSteps(campaignId, workspaceId, contacts, steps);
      
      console.log(`[Campaign Executor DEV] Scheduled ${result.scheduledCount} LinkedIn invite steps`);
      
      res.json({ 
        scheduled: result.scheduledCount, 
        skippedExisting: existingContactIds.size,
        total: ccResult.rows.length,
        message: `Scheduled ${result.scheduledCount} new invites (${existingContactIds.size} already had steps)`
      });
    } catch (error) {
      console.error('DEV schedule invites error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // DEBUG endpoint to check scheduled steps (no auth for debugging)
  app.get('/api/debug/scheduled-steps/:campaignId', async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      const result = await pool.query(
        `SELECT 
           css.id, 
           css.campaign_id, 
           css.contact_id, 
           css.step_index, 
           css.channel,
           css.status, 
           css.scheduled_at, 
           css.error_message, 
           css.created_at,
           c.first_name,
           c.last_name
         FROM campaign_scheduled_steps css
         LEFT JOIN contacts c ON css.contact_id = c.id
         WHERE css.campaign_id = $1
         ORDER BY css.scheduled_at ASC
         LIMIT 50`,
        [campaignId]
      );
      
      const stats = await pool.query(
        `SELECT status, COUNT(*) as count 
         FROM campaign_scheduled_steps 
         WHERE campaign_id = $1 
         GROUP BY status`,
        [campaignId]
      );
      
      const scheduleRange = await pool.query(
        `SELECT 
           MIN(scheduled_at) as earliest_scheduled,
           MAX(scheduled_at) as latest_scheduled
         FROM campaign_scheduled_steps 
         WHERE campaign_id = $1`,
        [campaignId]
      );
      
      res.json({ 
        steps: result.rows, 
        stats: stats.rows,
        schedule_range: scheduleRange.rows[0],
        serverTime: new Date().toISOString()
      });
    } catch (error) {
      console.error('Debug scheduled steps error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Reschedule pending invites with warmup logic (spread across days starting today)
  app.post('/api/campaigns/:campaignId/reschedule-warmup', async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      // Get pending steps for this campaign
      const pendingResult = await pool.query(
        `SELECT id, contact_id, workspace_id FROM campaign_scheduled_steps 
         WHERE campaign_id = $1 AND status = 'pending' AND channel = 'linkedin_connection'
         ORDER BY id`,
        [campaignId]
      );
      
      if (pendingResult.rows.length === 0) {
        return res.json({ message: 'No pending steps to reschedule', count: 0 });
      }
      
      const workspaceId = pendingResult.rows[0].workspace_id;
      
      // Warmup limits - industry standard WEEKLY ramp (not daily!)
      // Week 1: 5/day, Week 2: 10/day, Week 3: 15/day, Week 4+: 20-25/day
      // Using day index: days 0-6 = 5, days 7-13 = 10, days 14-20 = 15, days 21+ = 20-25
      const getWarmupLimit = (daysSinceStart: number): number => {
        if (daysSinceStart < 7) return 5;       // Week 1
        if (daysSinceStart < 14) return 10;     // Week 2
        if (daysSinceStart < 21) return 15;     // Week 3
        if (daysSinceStart < 28) return 20;     // Week 4
        return 25;                               // Week 5+ (max safe limit for most accounts)
      };
      const BASE_DAILY_LIMIT = 25; // Max safe for free accounts
      
      // Get warmup day (days since first ever scheduled invite)
      const warmupDayResult = await pool.query(
        `SELECT MIN(scheduled_at) as first_scheduled FROM campaign_scheduled_steps 
         WHERE workspace_id = $1 AND channel = 'linkedin_connection' AND status IN ('completed', 'sent')`,
        [workspaceId]
      );
      const firstScheduled = warmupDayResult.rows[0]?.first_scheduled;
      let warmupDay = 0;
      if (firstScheduled) {
        warmupDay = Math.floor((Date.now() - new Date(firstScheduled).getTime()) / (24 * 60 * 60 * 1000));
      }
      
      const now = new Date();
      let currentDay = 0;
      let scheduledOnCurrentDay = 0;
      
      // Get daily limit based on warmup day
      const getDailyLimit = (dayOffset: number): number => {
        const daysSinceStart = warmupDay + dayOffset;
        return getWarmupLimit(daysSinceStart);
      };
      
      let currentDayLimit = getDailyLimit(0);
      
      // Extended hours: 8 AM to 9 PM (allow evening sends)
      const getRandomTimeInBusinessHours = (dayOffset: number): Date => {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);
        
        if (dayOffset === 0) {
          // For today: schedule within the next 2 hours if possible, otherwise random in remaining window
          const currentHour = now.getHours();
          if (currentHour < 21) { // Before 9 PM
            // Schedule between now and 9 PM
            const remainingHours = 21 - currentHour;
            const randomMinutes = Math.floor(Math.random() * (remainingHours * 60));
            date.setTime(now.getTime() + (randomMinutes + 5) * 60 * 1000); // At least 5 mins from now
          } else {
            // Past 9 PM, push to tomorrow
            date.setDate(date.getDate() + 1);
            const hour = 8 + Math.floor(Math.random() * 13); // 8 AM - 9 PM
            date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
          }
        } else {
          // Future days: random between 8 AM and 9 PM
          const hour = 8 + Math.floor(Math.random() * 13);
          const minute = Math.floor(Math.random() * 60);
          date.setHours(hour, minute, Math.floor(Math.random() * 60), 0);
        }
        return date;
      };
      
      let updatedCount = 0;
      const schedule: { day: number, count: number }[] = [];
      
      for (const row of pendingResult.rows) {
        // Check if we hit today's limit
        if (scheduledOnCurrentDay >= currentDayLimit) {
          schedule.push({ day: currentDay, count: scheduledOnCurrentDay });
          currentDay++;
          scheduledOnCurrentDay = 0;
          currentDayLimit = getDailyLimit(currentDay);
        }
        
        const scheduledTime = getRandomTimeInBusinessHours(currentDay);
        scheduledOnCurrentDay++;
        
        await pool.query(
          `UPDATE campaign_scheduled_steps SET scheduled_at = $1 WHERE id = $2`,
          [scheduledTime.toISOString(), row.id]
        );
        updatedCount++;
      }
      
      // Add final day
      if (scheduledOnCurrentDay > 0) {
        schedule.push({ day: currentDay, count: scheduledOnCurrentDay });
      }
      
      console.log(`[Warmup Reschedule] Campaign ${campaignId}: Rescheduled ${updatedCount} invites across ${currentDay + 1} days`);
      
      res.json({ 
        message: 'Rescheduled with warmup logic',
        count: updatedCount,
        warmupDay,
        schedule,
        daysSpread: currentDay + 1
      });
    } catch (error) {
      console.error('Reschedule warmup error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to reschedule' });
    }
  });

  // Get campaign contacts grouped by step with connection status
  app.get('/api/campaigns/:campaignId/contacts-by-step', async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      const result = await pool.query(`
        SELECT 
          css.step_index,
          css.channel,
          css.status as step_status,
          c.id as contact_id,
          c.first_name,
          c.last_name,
          c.linkedin_url,
          c.linkedin_connection_status,
          c.linkedin_connection_sent_at,
          c.linkedin_connection_accepted_at,
          css.executed_at,
          css.scheduled_at
        FROM campaign_scheduled_steps css
        JOIN contacts c ON c.id::text = css.contact_id::text
        WHERE css.campaign_id = $1
        ORDER BY css.step_index, css.status, c.first_name
      `, [campaignId]);
      
      // Group by step
      const stepMap = new Map<number, {
        stepIndex: number;
        channel: string;
        contacts: any[];
        stats: { pending: number; sent: number; failed: number; accepted: number };
      }>();
      
      for (const row of result.rows) {
        if (!stepMap.has(row.step_index)) {
          stepMap.set(row.step_index, {
            stepIndex: row.step_index,
            channel: row.channel,
            contacts: [],
            stats: { pending: 0, sent: 0, failed: 0, accepted: 0 }
          });
        }
        
        const step = stepMap.get(row.step_index)!;
        step.contacts.push({
          contactId: row.contact_id,
          firstName: row.first_name,
          lastName: row.last_name,
          linkedinUrl: row.linkedin_url,
          stepStatus: row.step_status,
          connectionStatus: row.linkedin_connection_status || 'none',
          connectionSentAt: row.linkedin_connection_sent_at,
          connectionAcceptedAt: row.linkedin_connection_accepted_at,
          executedAt: row.executed_at,
          scheduledAt: row.scheduled_at
        });
        
        // Update stats
        if (row.step_status === 'pending') step.stats.pending++;
        else if (row.step_status === 'sent') step.stats.sent++;
        else if (row.step_status === 'failed') step.stats.failed++;
        if (row.linkedin_connection_status === 'accepted') step.stats.accepted++;
      }
      
      res.json({
        success: true,
        steps: Array.from(stepMap.values()).sort((a, b) => a.stepIndex - b.stepIndex)
      });
    } catch (error) {
      console.error('Get contacts by step error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Get LinkedIn connection stats for a workspace
  app.get('/api/workspaces/:workspaceId/linkedin-connection-stats', async (req, res) => {
    try {
      const { workspaceId } = req.params;
      
      const result = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE linkedin_connection_status IS NOT NULL AND linkedin_connection_status != 'none') as total,
          COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending') as pending,
          COUNT(*) FILTER (WHERE linkedin_connection_status = 'accepted') as accepted,
          COUNT(*) FILTER (WHERE linkedin_connection_status = 'withdrawn') as withdrawn,
          COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending_withdrawal') as pending_withdrawal,
          COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending' 
                           AND linkedin_connection_sent_at < NOW() - INTERVAL '30 days') as stale
        FROM contacts
        WHERE workspace_id = $1
      `, [workspaceId]);
      
      res.json({
        success: true,
        stats: {
          total: parseInt(result.rows[0].total) || 0,
          pending: parseInt(result.rows[0].pending) || 0,
          accepted: parseInt(result.rows[0].accepted) || 0,
          withdrawn: parseInt(result.rows[0].withdrawn) || 0,
          pendingWithdrawal: parseInt(result.rows[0].pending_withdrawal) || 0,
          stale: parseInt(result.rows[0].stale) || 0
        }
      });
    } catch (error) {
      console.error('Get connection stats error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Get stale connections (pending for 30+ days) that should be withdrawn
  app.get('/api/workspaces/:workspaceId/stale-connections', async (req, res) => {
    try {
      const { workspaceId } = req.params;
      const staleDays = Math.max(1, Math.min(365, parseInt(req.query.days as string) || 30));
      
      const result = await pool.query(`
        SELECT 
          id as contact_id,
          first_name,
          last_name,
          linkedin_url,
          linkedin_connection_status,
          linkedin_connection_sent_at,
          EXTRACT(DAY FROM NOW() - linkedin_connection_sent_at)::int as days_pending
        FROM contacts
        WHERE workspace_id = $1
          AND linkedin_connection_status = 'pending'
          AND linkedin_connection_sent_at < NOW() - ($2 || ' days')::interval
        ORDER BY linkedin_connection_sent_at ASC
      `, [workspaceId, staleDays.toString()]);
      
      res.json({
        success: true,
        staleConnections: result.rows,
        count: result.rows.length,
        staleDays
      });
    } catch (error) {
      console.error('Get stale connections error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Mark connection as accepted (called when we detect acceptance)
  // Only valid from 'pending' status
  app.post('/api/contacts/:contactId/connection-accepted', async (req, res) => {
    try {
      const { contactId } = req.params;
      
      const result = await pool.query(`
        UPDATE contacts 
        SET linkedin_connection_status = 'accepted',
            linkedin_connection_accepted_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND linkedin_connection_status = 'pending'
        RETURNING id
      `, [contactId]);
      
      if (result.rowCount === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Contact not found or not in pending status' 
        });
      }
      
      res.json({ success: true, message: 'Connection marked as accepted' });
    } catch (error) {
      console.error('Mark connection accepted error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Mark connection as withdrawn (valid from 'pending' or 'pending_withdrawal' status)
  app.post('/api/contacts/:contactId/connection-withdrawn', async (req, res) => {
    try {
      const { contactId } = req.params;
      
      const result = await pool.query(`
        UPDATE contacts 
        SET linkedin_connection_status = 'withdrawn',
            linkedin_connection_withdrawn_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
          AND linkedin_connection_status IN ('pending', 'pending_withdrawal')
        RETURNING id
      `, [contactId]);
      
      if (result.rowCount === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Contact not found or not in pending/pending_withdrawal status' 
        });
      }
      
      res.json({ success: true, message: 'Connection marked as withdrawn' });
    } catch (error) {
      console.error('Mark connection withdrawn error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Get pending withdrawals for a workspace
  app.get('/api/workspaces/:workspaceId/pending-withdrawals', async (req, res) => {
    try {
      const { workspaceId } = req.params;
      
      const result = await pool.query(`
        SELECT 
          id as contact_id,
          first_name,
          last_name,
          linkedin_url,
          linkedin_connection_sent_at,
          EXTRACT(DAY FROM NOW() - linkedin_connection_sent_at)::int as days_pending
        FROM contacts
        WHERE workspace_id = $1
          AND linkedin_connection_status = 'pending_withdrawal'
          AND linkedin_url IS NOT NULL
        ORDER BY linkedin_connection_sent_at ASC
      `, [workspaceId]);
      
      res.json({
        success: true,
        pendingWithdrawals: result.rows,
        count: result.rows.length
      });
    } catch (error) {
      console.error('Get pending withdrawals error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // ============================================
  // CAMPAIGN PACING & VOLUME CONTROLS
  // ============================================

  // Get campaign pacing settings
  app.get('/api/campaigns/:campaignId/pacing', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;

      // Get campaign with settings
      const result = await pool.query(`
        SELECT 
          id,
          name,
          settings,
          status,
          created_at,
          (SELECT COUNT(*) FROM campaign_contacts WHERE campaign_id = $1) as total_contacts,
          (SELECT COUNT(*) FROM campaign_scheduled_steps WHERE campaign_id = $1 AND status = 'pending') as pending_steps,
          (SELECT COUNT(*) FROM campaign_scheduled_steps WHERE campaign_id = $1 AND status = 'sent') as completed_steps
        FROM campaigns
        WHERE id = $1 AND user_id = $2
      `, [campaignId, user.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const campaign = result.rows[0];
      const settings = campaign.settings || {};
      
      // Extract pacing settings with defaults
      const pacing = {
        dailyLimit: settings.daily_limit || 25,
        weeklyLimit: settings.weekly_limit || 100,
        sendingHours: settings.sending_hours || { start: 9, end: 17 },
        timezone: settings.timezone || 'America/New_York',
        pauseOnWeekends: settings.pause_on_weekends ?? true,
        delayBetweenActions: settings.delay_between_actions || 60, // seconds
        batchSize: settings.batch_size || 10,
        warmupEnabled: settings.warmup_enabled || false,
        warmupDay: settings.warmup_day || 0
      };

      res.json({
        success: true,
        campaignId,
        campaignName: campaign.name,
        status: campaign.status,
        pacing,
        stats: {
          totalContacts: parseInt(campaign.total_contacts) || 0,
          pendingSteps: parseInt(campaign.pending_steps) || 0,
          completedSteps: parseInt(campaign.completed_steps) || 0
        }
      });
    } catch (error) {
      console.error('Get campaign pacing error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Update campaign pacing settings
  app.patch('/api/campaigns/:campaignId/pacing', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { dailyLimit, weeklyLimit, sendingHours, timezone, pauseOnWeekends, delayBetweenActions, batchSize } = req.body;

      // Get current campaign settings
      const currentResult = await pool.query(
        'SELECT settings FROM campaigns WHERE id = $1 AND user_id = $2',
        [campaignId, user.id]
      );

      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const currentSettings = currentResult.rows[0].settings || {};
      
      // Merge new pacing settings
      const updatedSettings = {
        ...currentSettings,
        ...(dailyLimit !== undefined && { daily_limit: dailyLimit }),
        ...(weeklyLimit !== undefined && { weekly_limit: weeklyLimit }),
        ...(sendingHours !== undefined && { sending_hours: sendingHours }),
        ...(timezone !== undefined && { timezone }),
        ...(pauseOnWeekends !== undefined && { pause_on_weekends: pauseOnWeekends }),
        ...(delayBetweenActions !== undefined && { delay_between_actions: delayBetweenActions }),
        ...(batchSize !== undefined && { batch_size: batchSize })
      };

      // Update campaign
      await pool.query(
        'UPDATE campaigns SET settings = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
        [JSON.stringify(updatedSettings), campaignId, user.id]
      );

      res.json({ 
        success: true, 
        message: 'Pacing settings updated',
        pacing: {
          dailyLimit: updatedSettings.daily_limit || 25,
          weeklyLimit: updatedSettings.weekly_limit || 100,
          sendingHours: updatedSettings.sending_hours || { start: 9, end: 17 },
          timezone: updatedSettings.timezone || 'America/New_York',
          pauseOnWeekends: updatedSettings.pause_on_weekends ?? true,
          delayBetweenActions: updatedSettings.delay_between_actions || 60,
          batchSize: updatedSettings.batch_size || 10
        }
      });
    } catch (error) {
      console.error('Update campaign pacing error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Get warmup progress and analytics for a campaign
  app.get('/api/campaigns/:campaignId/warmup-analytics', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;

      // Verify campaign ownership
      const campaignCheck = await pool.query(
        'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
        [campaignId, user.id]
      );
      
      if (campaignCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Get warmup day calculation
      const warmupDayResult = await pool.query(`
        SELECT MIN(scheduled_at) as first_scheduled
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1
      `, [campaignId]);

      const firstScheduled = warmupDayResult.rows[0]?.first_scheduled;
      let warmupDay = 1;
      if (firstScheduled) {
        warmupDay = Math.floor((Date.now() - new Date(firstScheduled).getTime()) / (24 * 60 * 60 * 1000)) + 1;
      }

      // Calculate daily limit based on warmup day
      const getWarmupLimit = (day: number): number => {
        if (day <= 7) return 5;       // Week 1: 5/day
        if (day <= 14) return 10;     // Week 2: 10/day
        if (day <= 21) return 15;     // Week 3: 15/day
        if (day <= 28) return 20;     // Week 4: 20/day
        return 25;                     // Week 5+: 25/day
      };

      const dailyLimit = getWarmupLimit(warmupDay);
      const weekNumber = Math.ceil(warmupDay / 7);

      // Get today's sent count - use UTC dates for consistency
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      
      // Debug: log all steps to understand the data
      const allStepsResult = await pool.query(`
        SELECT id, status, executed_at, scheduled_at
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1
        ORDER BY COALESCE(executed_at, scheduled_at) DESC
        LIMIT 15
      `, [campaignId]);
      console.log('[Warmup Analytics] Today start (UTC):', todayStart.toISOString());
      console.log('[Warmup Analytics] All steps (any status):', JSON.stringify(allStepsResult.rows, null, 2));
      
      const todaySentResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 
          AND status = 'sent'
          AND executed_at >= $2
      `, [campaignId, todayStart.toISOString()]);

      const sentToday = parseInt(todaySentResult.rows[0]?.count) || 0;
      console.log('[Warmup Analytics] Sent today count:', sentToday);

      // Get scheduled for today (remaining)
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const scheduledTodayResult = await pool.query(`
        SELECT COUNT(*) as count
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 
          AND status = 'pending'
          AND scheduled_at >= $2
          AND scheduled_at <= $3
      `, [campaignId, todayStart.toISOString(), todayEnd.toISOString()]);

      const scheduledToday = parseInt(scheduledTodayResult.rows[0]?.count) || 0;

      // Get analytics: acceptance rate by day for the last 7 days
      const analyticsResult = await pool.query(`
        SELECT 
          DATE(executed_at) as date,
          COUNT(*) FILTER (WHERE status = 'sent') as invites_sent,
          COUNT(*) FILTER (WHERE status = 'completed') as accepted
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 
          AND executed_at >= NOW() - INTERVAL '7 days'
          AND status IN ('sent', 'completed')
        GROUP BY DATE(executed_at)
        ORDER BY date ASC
      `, [campaignId]);

      // Get overall stats
      const overallResult = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
          COUNT(*) FILTER (WHERE status = 'completed') as total_accepted,
          COUNT(*) FILTER (WHERE status = 'skipped') as total_skipped,
          COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
          MIN(executed_at) FILTER (WHERE status = 'sent') as first_invite_sent,
          MAX(executed_at) FILTER (WHERE status = 'completed') as last_acceptance
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1
      `, [campaignId]);

      const overall = overallResult.rows[0] || {};
      const totalSent = parseInt(overall.total_sent) || 0;
      const totalAccepted = parseInt(overall.total_accepted) || 0;
      const acceptanceRate = totalSent > 0 ? Math.round((totalAccepted / totalSent) * 100) : 0;

      // Calculate average response time (days between invite sent and acceptance)
      const responseTimeResult = await pool.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (updated_at - executed_at)) / 86400) as avg_days
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 
          AND status = 'completed'
          AND executed_at IS NOT NULL
          AND updated_at IS NOT NULL
      `, [campaignId]);

      const avgResponseDays = responseTimeResult.rows[0]?.avg_days 
        ? Math.round(parseFloat(responseTimeResult.rows[0].avg_days) * 10) / 10 
        : null;

      // Next scheduled invite time
      const nextScheduledResult = await pool.query(`
        SELECT scheduled_at
        FROM campaign_scheduled_steps
        WHERE campaign_id = $1 AND status = 'pending'
        ORDER BY scheduled_at ASC
        LIMIT 1
      `, [campaignId]);

      const nextScheduledAt = nextScheduledResult.rows[0]?.scheduled_at || null;

      res.json({
        warmup: {
          currentDay: warmupDay,
          weekNumber,
          dailyLimit,
          sentToday,
          scheduledToday,
          remainingToday: Math.max(0, dailyLimit - sentToday),
          progressPercent: Math.min(100, Math.round((sentToday / dailyLimit) * 100)),
          nextScheduledAt
        },
        analytics: {
          acceptanceRate,
          totalSent,
          totalAccepted,
          totalSkipped: parseInt(overall.total_skipped) || 0,
          totalFailed: parseInt(overall.total_failed) || 0,
          avgResponseDays,
          dailyData: analyticsResult.rows.map(row => ({
            date: row.date,
            sent: parseInt(row.invites_sent) || 0,
            accepted: parseInt(row.accepted) || 0
          }))
        }
      });
    } catch (error) {
      console.error('Get warmup analytics error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Add contacts to a running campaign (with optional scheduling)
  app.post('/api/campaigns/:campaignId/add-contacts', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { contactIds, scheduleImmediately } = req.body;

      if (!Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'contactIds array is required' });
      }

      // Verify campaign exists and belongs to user
      const campaignResult = await pool.query(
        'SELECT id, workspace_id, settings, steps FROM campaigns WHERE id = $1 AND user_id = $2',
        [campaignId, user.id]
      );

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const campaign = campaignResult.rows[0];
      const workspaceId = campaign.workspace_id;
      let addedCount = 0;
      let skippedCount = 0;
      let unauthorizedCount = 0;
      const addedContactIds: string[] = [];

      // SECURITY: Verify all contacts belong to the same workspace as the campaign
      // Only add contacts that exist in the same workspace
      for (const contactId of contactIds) {
        try {
          // First verify the contact belongs to the same workspace
          const contactCheck = await pool.query(
            'SELECT id FROM contacts WHERE id = $1 AND workspace_id = $2',
            [contactId, workspaceId]
          );
          
          if (contactCheck.rows.length === 0) {
            // Contact doesn't exist or doesn't belong to this workspace - skip it
            unauthorizedCount++;
            continue;
          }

          await pool.query(`
            INSERT INTO campaign_contacts (campaign_id, contact_id, status, created_at)
            VALUES ($1, $2, 'active', NOW())
            ON CONFLICT (campaign_id, contact_id) DO NOTHING
          `, [campaignId, contactId]);
          
          // Check if actually inserted
          const insertCheck = await pool.query(
            'SELECT 1 FROM campaign_contacts WHERE campaign_id = $1 AND contact_id = $2 AND created_at > NOW() - INTERVAL \'5 seconds\'',
            [campaignId, contactId]
          );
          
          if (insertCheck.rows.length > 0) {
            addedCount++;
            addedContactIds.push(contactId);
          } else {
            skippedCount++;
          }
        } catch (err) {
          console.log(`Skipping duplicate contact ${contactId}`);
          skippedCount++;
        }
      }

      // If scheduleImmediately is true, schedule campaign steps for new contacts
      let scheduledSteps = 0;
      if (scheduleImmediately && addedContactIds.length > 0) {
        const steps = campaign.steps || [];
        const settings = campaign.settings || {};
        const dailyLimit = settings.daily_limit || 25;

        for (const contactId of addedContactIds) {
          // Schedule first step for each contact
          if (steps.length > 0) {
            const firstStep = steps[0];
            const scheduledAt = new Date();
            scheduledAt.setMinutes(scheduledAt.getMinutes() + Math.floor(Math.random() * 60)); // Random delay up to 1 hour

            await pool.query(`
              INSERT INTO campaign_scheduled_steps 
              (campaign_id, contact_id, step_index, step_type, step_data, scheduled_at, status, created_at)
              VALUES ($1, $2, 0, $3, $4, $5, 'pending', NOW())
              ON CONFLICT DO NOTHING
            `, [
              campaignId,
              contactId,
              firstStep.channel || 'email',
              JSON.stringify(firstStep),
              scheduledAt
            ]);
            scheduledSteps++;
          }
        }
      }

      res.json({
        success: true,
        added: addedCount,
        skipped: skippedCount,
        unauthorized: unauthorizedCount,
        scheduledSteps,
        message: `Added ${addedCount} contacts to campaign${scheduledSteps > 0 ? ` (${scheduledSteps} steps scheduled)` : ''}${unauthorizedCount > 0 ? ` (${unauthorizedCount} invalid/unauthorized)` : ''}`
      });
    } catch (error) {
      console.error('Add contacts to campaign error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // ============================================
  // MULTI-SEARCH MANAGEMENT
  // ============================================

  // Get all LinkedIn searches linked to a campaign
  app.get('/api/campaigns/:campaignId/linkedin-searches', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;

      // Verify campaign exists
      const campaignCheck = await pool.query(
        'SELECT id, workspace_id FROM campaigns WHERE id = $1 AND user_id = $2',
        [campaignId, user.id]
      );

      if (campaignCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const workspaceId = campaignCheck.rows[0].workspace_id;

      // Get all search jobs for this campaign
      const searchesResult = await pool.query(`
        SELECT 
          lsj.id,
          lsj.search_url,
          lsj.search_filters,
          lsj.status,
          lsj.results_count,
          lsj.current_page,
          lsj.total_pages,
          lsj.error,
          lsj.created_at,
          lsj.updated_at,
          (SELECT COUNT(*) FROM linkedin_scraped_leads lsl WHERE lsl.search_job_id = lsj.id) as leads_scraped,
          (SELECT COUNT(*) FROM contacts c 
           JOIN campaign_contacts cc ON c.id = cc.contact_id 
           WHERE cc.campaign_id = $1 AND c.source LIKE '%' || lsj.id || '%') as leads_imported
        FROM linkedin_search_jobs lsj
        WHERE lsj.workspace_id = $2
          AND (lsj.campaign_id = $1 OR lsj.id IN (
            SELECT DISTINCT SUBSTRING(c.source FROM 'search_job:([a-f0-9-]+)')::uuid
            FROM contacts c
            JOIN campaign_contacts cc ON c.id = cc.contact_id
            WHERE cc.campaign_id = $1 AND c.source LIKE 'linkedin_search%'
          ))
        ORDER BY lsj.created_at DESC
      `, [campaignId, workspaceId]);

      res.json({
        success: true,
        campaignId,
        searches: searchesResult.rows,
        totalSearches: searchesResult.rows.length
      });
    } catch (error) {
      console.error('Get campaign LinkedIn searches error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Link an existing search job to a campaign
  app.post('/api/campaigns/:campaignId/link-search', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { searchJobId } = req.body;

      if (!searchJobId) {
        return res.status(400).json({ error: 'searchJobId is required' });
      }

      // Verify campaign exists
      const campaignCheck = await pool.query(
        'SELECT id, workspace_id FROM campaigns WHERE id = $1 AND user_id = $2',
        [campaignId, user.id]
      );

      if (campaignCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const workspaceId = campaignCheck.rows[0].workspace_id;

      // Verify search job exists in same workspace
      const searchCheck = await pool.query(
        'SELECT id, status, results_count FROM linkedin_search_jobs WHERE id = $1 AND workspace_id = $2',
        [searchJobId, workspaceId]
      );

      if (searchCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Search job not found in this workspace' });
      }

      // Update search job to link to campaign
      await pool.query(
        'UPDATE linkedin_search_jobs SET campaign_id = $1, updated_at = NOW() WHERE id = $2',
        [campaignId, searchJobId]
      );

      // Import all leads from this search into the campaign
      const leadsResult = await pool.query(`
        SELECT id, first_name, last_name, email, linkedin_url, headline, company, location
        FROM linkedin_scraped_leads
        WHERE search_job_id = $1
      `, [searchJobId]);

      let importedCount = 0;
      for (const lead of leadsResult.rows) {
        try {
          // Check if contact already exists
          const existingContact = await pool.query(
            'SELECT id FROM contacts WHERE workspace_id = $1 AND linkedin_url = $2',
            [workspaceId, lead.linkedin_url]
          );

          let contactId: string;
          if (existingContact.rows.length > 0) {
            contactId = existingContact.rows[0].id;
          } else {
            // Create new contact
            const insertResult = await pool.query(`
              INSERT INTO contacts (workspace_id, user_id, first_name, last_name, email, linkedin_url, company, title, status, source, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, NOW())
              RETURNING id
            `, [
              workspaceId,
              user.id,
              lead.first_name,
              lead.last_name,
              lead.email,
              lead.linkedin_url,
              lead.company,
              lead.headline,
              `linkedin_search:${searchJobId}`
            ]);
            contactId = insertResult.rows[0].id;
          }

          // Add to campaign_contacts
          await pool.query(`
            INSERT INTO campaign_contacts (campaign_id, contact_id, status, created_at)
            VALUES ($1, $2, 'active', NOW())
            ON CONFLICT (campaign_id, contact_id) DO NOTHING
          `, [campaignId, contactId]);

          importedCount++;
        } catch (err) {
          console.log('Error importing lead:', err);
        }
      }

      res.json({
        success: true,
        message: `Linked search job and imported ${importedCount} leads to campaign`,
        searchJobId,
        leadsImported: importedCount
      });
    } catch (error) {
      console.error('Link search to campaign error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Get available contacts to add to campaign (not already in campaign)
  app.get('/api/campaigns/:campaignId/available-contacts', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { campaignId } = req.params;
      const { search, limit = 50 } = req.query;

      // Get campaign workspace
      const campaignResult = await pool.query(
        'SELECT workspace_id FROM campaigns WHERE id = $1 AND user_id = $2',
        [campaignId, user.id]
      );

      if (campaignResult.rows.length === 0) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      const workspaceId = campaignResult.rows[0].workspace_id;

      // Get contacts not in this campaign
      let query = `
        SELECT c.id, c.first_name, c.last_name, c.email, c.linkedin_url, c.company, c.title, c.source
        FROM contacts c
        WHERE c.workspace_id = $1
          AND c.id NOT IN (SELECT contact_id FROM campaign_contacts WHERE campaign_id = $2)
      `;
      const params: any[] = [workspaceId, campaignId];

      if (search) {
        query += ` AND (
          c.first_name ILIKE $3 
          OR c.last_name ILIKE $3 
          OR c.email ILIKE $3 
          OR c.company ILIKE $3
        )`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1}`;
      params.push(parseInt(limit as string) || 50);

      const result = await pool.query(query, params);

      // Get total count
      const countResult = await pool.query(`
        SELECT COUNT(*) as total
        FROM contacts c
        WHERE c.workspace_id = $1
          AND c.id NOT IN (SELECT contact_id FROM campaign_contacts WHERE campaign_id = $2)
      `, [workspaceId, campaignId]);

      res.json({
        success: true,
        contacts: result.rows,
        total: parseInt(countResult.rows[0].total) || 0
      });
    } catch (error) {
      console.error('Get available contacts error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });

  // Get unlinked search jobs (searches without a campaign)
  app.get('/api/workspaces/:workspaceId/unlinked-searches', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { workspaceId } = req.params;

      const result = await pool.query(`
        SELECT 
          lsj.id,
          lsj.search_url,
          lsj.search_filters,
          lsj.status,
          lsj.results_count,
          lsj.created_at,
          (SELECT COUNT(*) FROM linkedin_scraped_leads lsl WHERE lsl.search_job_id = lsj.id) as leads_count
        FROM linkedin_search_jobs lsj
        WHERE lsj.workspace_id = $1
          AND lsj.user_id = $2
          AND lsj.campaign_id IS NULL
          AND lsj.status IN ('completed', 'partial')
        ORDER BY lsj.created_at DESC
        LIMIT 20
      `, [workspaceId, user.id]);

      res.json({
        success: true,
        searches: result.rows
      });
    } catch (error) {
      console.error('Get unlinked searches error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Error' });
    }
  });
}
