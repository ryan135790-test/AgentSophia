import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export interface ComplianceCheck {
  passed: boolean;
  issues: ComplianceIssue[];
  warnings: string[];
  canProceed: boolean;
}

export interface ComplianceIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  affectedContacts?: string[];
}

export interface CampaignActivityLog {
  id?: string;
  campaign_id: string;
  user_id: string;
  workspace_id?: string;
  action: 'created' | 'activated' | 'paused' | 'completed' | 'message_sent' | 'message_failed' | 'compliance_check' | 'rate_limit_hit';
  channel?: 'email' | 'sms' | 'linkedin' | 'phone' | 'voicemail';
  contact_id?: string;
  contact_email?: string;
  contact_phone?: string;
  message_id?: string;
  status: 'success' | 'failed' | 'pending' | 'skipped';
  details?: Record<string, any>;
  error_message?: string;
  created_at?: string;
}

export async function runComplianceCheck(
  userId: string,
  campaignId: string,
  contacts: any[],
  steps: any[]
): Promise<ComplianceCheck> {
  const issues: ComplianceIssue[] = [];
  const warnings: string[] = [];

  console.log(`[Compliance] Running checks for campaign ${campaignId} with ${contacts.length} contacts`);

  if (!contacts || contacts.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_CONTACTS',
      message: 'Campaign has no contacts to send to'
    });
  }

  if (!steps || steps.length === 0) {
    issues.push({
      severity: 'error',
      code: 'NO_STEPS',
      message: 'Campaign has no message steps defined'
    });
  }

  const channels = [...new Set(steps?.map(s => s.channel) || [])];
  
  for (const channel of channels) {
    if (channel === 'email') {
      const contactsWithoutEmail = contacts.filter(c => !c.email);
      if (contactsWithoutEmail.length > 0) {
        warnings.push(`${contactsWithoutEmail.length} contacts missing email addresses`);
      }
      
      if (!process.env.SENDGRID_API_KEY && !process.env.RESEND_API_KEY) {
        issues.push({
          severity: 'warning',
          code: 'NO_EMAIL_PROVIDER',
          message: 'No email provider configured (SendGrid/Resend). Messages will be simulated.'
        });
      }
    }

    if (channel === 'sms') {
      const contactsWithoutPhone = contacts.filter(c => !c.phone);
      if (contactsWithoutPhone.length > 0) {
        warnings.push(`${contactsWithoutPhone.length} contacts missing phone numbers`);
      }

      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        issues.push({
          severity: 'warning',
          code: 'NO_SMS_PROVIDER',
          message: 'No SMS provider configured (Twilio). Messages will be simulated.'
        });
      }
    }

    if (channel === 'linkedin') {
      const contactsWithoutLinkedIn = contacts.filter(c => !c.linkedin_url && !c.linkedin_id);
      if (contactsWithoutLinkedIn.length > 0) {
        warnings.push(`${contactsWithoutLinkedIn.length} contacts missing LinkedIn profiles`);
      }
    }
  }

  const { data: optedOut } = await supabase
    .from('contact_preferences')
    .select('contact_id')
    .in('contact_id', contacts.map(c => c.id))
    .eq('opted_out', true);

  if (optedOut && optedOut.length > 0) {
    issues.push({
      severity: 'error',
      code: 'OPTED_OUT_CONTACTS',
      message: `${optedOut.length} contact(s) have opted out and will be skipped`,
      affectedContacts: optedOut.map(o => o.contact_id)
    });
  }

  const { data: recentActivity } = await supabase
    .from('campaign_activity_log')
    .select('contact_email, created_at')
    .eq('user_id', userId)
    .eq('action', 'message_sent')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const sentToday = recentActivity?.length || 0;
  const dailyLimit = 500;
  
  if (sentToday + contacts.length > dailyLimit) {
    issues.push({
      severity: 'warning',
      code: 'RATE_LIMIT_WARNING',
      message: `You've sent ${sentToday} messages today. Adding ${contacts.length} more may approach the daily limit of ${dailyLimit}.`
    });
  }

  if (contacts.length > 1000) {
    issues.push({
      severity: 'warning',
      code: 'LARGE_CAMPAIGN',
      message: `Large campaign with ${contacts.length} contacts. Consider sending in smaller batches.`
    });
  }

  await logCampaignActivity({
    campaign_id: campaignId,
    user_id: userId,
    action: 'compliance_check',
    status: issues.filter(i => i.severity === 'error').length === 0 ? 'success' : 'failed',
    details: {
      contactCount: contacts.length,
      stepCount: steps?.length || 0,
      channels,
      issueCount: issues.length,
      warningCount: warnings.length,
      issues: issues.map(i => ({ code: i.code, severity: i.severity }))
    }
  });

  const hasBlockingErrors = issues.some(i => i.severity === 'error' && i.code !== 'OPTED_OUT_CONTACTS');

  return {
    passed: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    warnings,
    canProceed: !hasBlockingErrors
  };
}

export async function logCampaignActivity(log: CampaignActivityLog): Promise<void> {
  try {
    const { error } = await supabase
      .from('campaign_activity_log')
      .insert({
        campaign_id: log.campaign_id,
        user_id: log.user_id,
        workspace_id: log.workspace_id || null,
        action: log.action,
        channel: log.channel || null,
        contact_id: log.contact_id || null,
        contact_email: log.contact_email || null,
        contact_phone: log.contact_phone || null,
        message_id: log.message_id || null,
        status: log.status,
        details: log.details || {},
        error_message: log.error_message || null,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('[CampaignLog] Failed to log activity:', error.message);
    } else {
      console.log(`[CampaignLog] ${log.action} - ${log.status} - Campaign: ${log.campaign_id}`);
    }
  } catch (err) {
    console.error('[CampaignLog] Error logging activity:', err);
  }
}

export async function logMessageSent(
  campaignId: string,
  userId: string,
  contact: any,
  channel: string,
  messageId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  await logCampaignActivity({
    campaign_id: campaignId,
    user_id: userId,
    action: success ? 'message_sent' : 'message_failed',
    channel: channel as any,
    contact_id: contact.id,
    contact_email: contact.email,
    contact_phone: contact.phone,
    message_id: messageId,
    status: success ? 'success' : 'failed',
    error_message: errorMessage,
    details: {
      contactName: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
      company: contact.company
    }
  });
}

export async function getCampaignActivityLog(
  campaignId: string,
  userId: string,
  limit: number = 100
): Promise<CampaignActivityLog[]> {
  const { data, error } = await supabase
    .from('campaign_activity_log')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[CampaignLog] Error fetching activity log:', error);
    return [];
  }

  return data || [];
}

export async function getCampaignStats(
  campaignId: string,
  userId: string
): Promise<{
  totalSent: number;
  totalFailed: number;
  byChannel: Record<string, { sent: number; failed: number }>;
  lastActivity?: string;
}> {
  const { data, error } = await supabase
    .from('campaign_activity_log')
    .select('action, channel, status, created_at')
    .eq('campaign_id', campaignId)
    .eq('user_id', userId)
    .in('action', ['message_sent', 'message_failed']);

  if (error || !data) {
    return { totalSent: 0, totalFailed: 0, byChannel: {} };
  }

  const byChannel: Record<string, { sent: number; failed: number }> = {};
  let totalSent = 0;
  let totalFailed = 0;

  for (const log of data) {
    const channel = log.channel || 'unknown';
    if (!byChannel[channel]) {
      byChannel[channel] = { sent: 0, failed: 0 };
    }

    if (log.status === 'success') {
      totalSent++;
      byChannel[channel].sent++;
    } else {
      totalFailed++;
      byChannel[channel].failed++;
    }
  }

  return {
    totalSent,
    totalFailed,
    byChannel,
    lastActivity: data[0]?.created_at
  };
}

export async function checkDailyRateLimit(
  userId: string,
  channel: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limits: Record<string, number> = {
    email: 500,
    sms: 200,
    linkedin: 50,
    phone: 100,
    voicemail: 50
  };

  const dailyLimit = limits[channel] || 100;

  const { count, error } = await supabase
    .from('campaign_activity_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('channel', channel)
    .eq('action', 'message_sent')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const sentToday = count || 0;

  return {
    allowed: sentToday < dailyLimit,
    remaining: Math.max(0, dailyLimit - sentToday),
    limit: dailyLimit
  };
}
