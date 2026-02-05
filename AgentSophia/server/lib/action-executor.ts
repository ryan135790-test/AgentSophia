/**
 * Sophia Action Executor
 * Actually executes auto-actions instead of simulating them
 */

import { Pool } from 'pg';
import type { IntentType } from './intent-detection-engine';
import { getAutoReplyTemplate } from './sophia-auto-actions';

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

export interface ExecutionResult {
  success: boolean;
  action: string;
  message: string;
  details?: any;
  error?: string;
}

/**
 * Execute a single action
 */
export async function executeAction(
  actionType: string,
  leadId: string,
  messageId: string,
  intent: IntentType,
  config?: Record<string, any>
): Promise<ExecutionResult> {
  try {
    switch (actionType) {
      case 'send_reply':
        return await executeSendReply(leadId, messageId, intent);
      
      case 'tag_lead':
        return await executeTagLead(leadId, intent, config);
      
      case 'route_to_sales':
        return await executeRouteSales(leadId, config);
      
      case 'schedule_followup':
        return await executeScheduleFollowup(leadId, config);
      
      case 'book_meeting':
        return await executeBookMeeting(leadId, config);
      
      default:
        return {
          success: false,
          action: actionType,
          message: `Unknown action type: ${actionType}`,
          error: 'UNKNOWN_ACTION'
        };
    }
  } catch (error: any) {
    return {
      success: false,
      action: actionType,
      message: `Failed to execute ${actionType}`,
      error: error.message
    };
  }
}

/**
 * Send an automated reply
 */
async function executeSendReply(
  leadId: string,
  messageId: string,
  intent: IntentType
): Promise<ExecutionResult> {
  try {
    const replyText = getAutoReplyTemplate(intent);
    const now = new Date().toISOString();

    const result = await pool.query(
      `INSERT INTO inbox_messages 
       (id, workspace_id, lead_id, channel, direction, content, intent_detected, confidence, is_auto_reply, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        `reply_${Date.now()}`,
        'demo',
        leadId,
        'email',
        'outbound',
        replyText,
        intent,
        100,
        true,
        now,
        now
      ]
    );

    return {
      success: true,
      action: 'send_reply',
      message: `✅ Sent auto-reply for ${intent}`,
      details: {
        messageId: result.rows[0]?.id,
        intent,
        replyText: replyText.substring(0, 50) + '...'
      }
    };
  } catch (error: any) {
    return {
      success: false,
      action: 'send_reply',
      message: 'Failed to send reply',
      error: error.message
    };
  }
}

/**
 * Tag a lead in the CRM
 */
async function executeTagLead(
  leadId: string,
  intent: IntentType,
  config?: Record<string, any>
): Promise<ExecutionResult> {
  try {
    const tag = config?.tag || intent;
    const score = config?.score || 50;
    const now = new Date().toISOString();

    const result = await pool.query(
      `UPDATE demo_contacts 
       SET tags = COALESCE(tags, '[]'::jsonb) || $1::jsonb,
           score = $2,
           updated_at = $3
       WHERE id = $4
       RETURNING first_name, last_name, email`,
      [JSON.stringify([tag]), score, now, leadId]
    );

    const contact = result.rows[0];

    return {
      success: true,
      action: 'tag_lead',
      message: `✅ Tagged lead with "${tag}" (score: ${score})`,
      details: {
        leadId,
        tag,
        score,
        leadName: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()
      }
    };
  } catch (error: any) {
    return {
      success: false,
      action: 'tag_lead',
      message: 'Failed to tag lead',
      error: error.message
    };
  }
}

/**
 * Route lead to sales queue
 */
async function executeRouteSales(
  leadId: string,
  config?: Record<string, any>
): Promise<ExecutionResult> {
  try {
    const priority = config?.priority || 'high';
    const queue = config?.queue || 'sales';
    const now = new Date().toISOString();

    const result = await pool.query(
      `UPDATE demo_contacts 
       SET stage = 'qualified',
           metadata = jsonb_set(COALESCE(metadata, '{}'), '{routed_to}', $1),
           updated_at = $2
       WHERE id = $3
       RETURNING first_name, last_name, email`,
      [JSON.stringify(queue), now, leadId]
    );

    const contact = result.rows[0];

    return {
      success: true,
      action: 'route_to_sales',
      message: `✅ Routed to ${queue} team (Priority: ${priority})`,
      details: {
        leadId,
        queue,
        priority,
        leadName: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()
      }
    };
  } catch (error: any) {
    return {
      success: false,
      action: 'route_to_sales',
      message: 'Failed to route to sales',
      error: error.message
    };
  }
}

/**
 * Schedule a follow-up
 */
async function executeScheduleFollowup(
  leadId: string,
  config?: Record<string, any>
): Promise<ExecutionResult> {
  try {
    const days = config?.days || 5;
    const followupDate = new Date();
    followupDate.setDate(followupDate.getDate() + days);
    const now = new Date().toISOString();

    const result = await pool.query(
      `UPDATE demo_contacts 
       SET next_follow_up = $1,
           updated_at = $2
       WHERE id = $3
       RETURNING first_name, last_name, email`,
      [followupDate.toISOString(), now, leadId]
    );

    const contact = result.rows[0];

    return {
      success: true,
      action: 'schedule_followup',
      message: `✅ Scheduled follow-up in ${days} days (${followupDate.toLocaleDateString()})`,
      details: {
        leadId,
        followupDate: followupDate.toISOString(),
        daysUntil: days,
        leadName: `${contact?.first_name || ''} ${contact?.last_name || ''}`.trim()
      }
    };
  } catch (error: any) {
    return {
      success: false,
      action: 'schedule_followup',
      message: 'Failed to schedule follow-up',
      error: error.message
    };
  }
}

/**
 * Book a meeting
 */
async function executeBookMeeting(
  leadId: string,
  config?: Record<string, any>
): Promise<ExecutionResult> {
  try {
    const meetingTime = config?.meetingTime || new Date(Date.now() + 86400000).toISOString();
    const meetingDuration = config?.duration || 30;
    const now = new Date().toISOString();

    const result = await pool.query(
      `UPDATE demo_contacts 
       SET stage = 'meeting_scheduled',
           metadata = jsonb_set(COALESCE(metadata, '{}'), '{next_meeting}', $1),
           updated_at = $2
       WHERE id = $3
       RETURNING first_name, last_name, email`,
      [JSON.stringify(meetingTime), now, leadId]
    );

    const contact = result.rows[0];

    if (!contact) {
      return {
        success: false,
        action: 'book_meeting',
        message: 'Lead not found',
        error: 'LEAD_NOT_FOUND'
      };
    }

    return {
      success: true,
      action: 'book_meeting',
      message: `✅ Meeting booked for ${new Date(meetingTime).toLocaleString()}`,
      details: {
        leadId,
        meetingTime,
        duration: meetingDuration,
        leadName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        meetingLink: `https://meet.sophiaai.io/${leadId}`
      }
    };
  } catch (error: any) {
    return {
      success: false,
      action: 'book_meeting',
      message: 'Failed to book meeting',
      error: error.message
    };
  }
}

/**
 * Execute multiple actions for an intent
 */
export async function executeIntentActions(
  leadId: string,
  messageId: string,
  intent: IntentType,
  actionsToExecute: string[]
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];

  const actionConfigs: Record<string, Record<string, any>> = {
    send_reply: {},
    tag_lead: getTagConfig(intent),
    route_to_sales: { priority: 'high', queue: 'sales' },
    schedule_followup: { days: 5 },
    book_meeting: { duration: 30 }
  };

  for (const actionType of actionsToExecute) {
    const config = actionConfigs[actionType];
    const result = await executeAction(actionType, leadId, messageId, intent, config);
    results.push(result);
  }

  return results;
}

/**
 * Get tag config for an intent
 */
function getTagConfig(intent: IntentType): Record<string, any> {
  const tagConfigs: Record<IntentType, Record<string, any>> = {
    interested: { tag: 'hot-lead', score: 95 },
    not_interested: { tag: 'not-interested', score: 20 },
    meeting_request: { tag: 'meeting-requested', score: 80 },
    information_needed: { tag: 'researching', score: 60 },
    price_inquiry: { tag: 'price-inquiry', score: 50 },
    follow_up_needed: { tag: 'follow-up-pending', score: 40 },
    meeting_scheduled: { tag: 'meeting-confirmed', score: 85 }
  };

  return tagConfigs[intent] || { tag: intent, score: 50 };
}
