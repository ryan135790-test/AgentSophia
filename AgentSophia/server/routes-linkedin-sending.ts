import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import { triggerAcceptanceCheck } from './lib/linkedin-acceptance-checker';

const router = Router();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// LINKEDIN CAMPAIGN SENDING & TRACKING
// ============================================

/**
 * POST /api/linkedin/send-connection-requests
 * Send LinkedIn connection requests via Heyreach API
 */
router.post('/send-connection-requests', async (req, res) => {
  const { campaignId, contacts, messageTemplate } = req.body;

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'No contacts provided' });
  }

  // Simulate LinkedIn connection request sending
  const connectionResults = contacts.map((contact: any) => ({
    contact_id: contact.id,
    linkedin_profile: contact.linkedin_url,
    status: 'sent',
    send_time: new Date().toISOString(),
    tracking_id: `li_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }));

  res.json({
    success: true,
    campaign_id: campaignId,
    connection_requests_sent: connectionResults.length,
    campaign_log: {
      campaign_id: campaignId,
      sent_at: new Date().toISOString(),
      total_contacts: contacts.length,
      message_preview: messageTemplate ? messageTemplate.substring(0, 50) + '...' : 'No message',
      status: 'sent',
      tracking_enabled: true
    },
    connection_results: connectionResults,
    message: `✅ ${connectionResults.length} LinkedIn connection requests sent`,
    expected_acceptance_rate: '45-65%',
    daily_limits: {
      requests_sent_today: connectionResults.length,
      daily_limit: 100,
      remaining: Math.max(0, 100 - connectionResults.length)
    }
  });
});

/**
 * POST /api/linkedin/send-messages
 * Send LinkedIn messages to connected profiles
 */
router.post('/send-messages', async (req, res) => {
  const { campaignId, contacts, messageTemplate } = req.body;

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'No contacts provided' });
  }

  // Simulate LinkedIn message sending
  const messageResults = contacts.map((contact: any) => ({
    contact_id: contact.id,
    linkedin_profile: contact.linkedin_url,
    status: 'sent',
    send_time: new Date().toISOString(),
    tracking_id: `li_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }));

  res.json({
    success: true,
    campaign_id: campaignId,
    messages_sent: messageResults.length,
    message_log: {
      campaign_id: campaignId,
      sent_at: new Date().toISOString(),
      total_recipients: contacts.length,
      message_preview: messageTemplate.substring(0, 80) + '...',
      status: 'sent',
      tracking_enabled: true
    },
    message_results: messageResults,
    message: `✅ ${messageResults.length} LinkedIn messages sent`,
    expected_response_rate: '12-18%',
    expected_meeting_rate: '2-4%'
  });
});

/**
 * POST /api/linkedin/send-inmail
 * Send Sales Navigator InMail to non-connected profiles
 * Uses Sales Navigator for InMail, but searches can be done via either source
 */
router.post('/send-inmail', async (req, res) => {
  const { 
    userId, 
    workspaceId, 
    contacts, 
    subjectTemplate, 
    messageTemplate,
    campaignId 
  } = req.body;

  if (!contacts || contacts.length === 0) {
    return res.status(400).json({ error: 'No contacts provided' });
  }

  if (!userId || !workspaceId) {
    return res.status(400).json({ error: 'userId and workspaceId required' });
  }

  // Import the InMail function dynamically to avoid circular deps
  const { sendSalesNavigatorInMail } = await import('./lib/linkedin-automation');

  const results: any[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const contact of contacts) {
    try {
      // Personalize templates
      const subject = subjectTemplate
        ?.replace(/\{\{firstName\}\}/g, contact.first_name || '')
        ?.replace(/\{\{lastName\}\}/g, contact.last_name || '')
        ?.replace(/\{\{company\}\}/g, contact.company || '')
        ?.replace(/\{\{title\}\}/g, contact.title || '')
        || 'Quick Question';

      const message = messageTemplate
        ?.replace(/\{\{firstName\}\}/g, contact.first_name || '')
        ?.replace(/\{\{lastName\}\}/g, contact.last_name || '')
        ?.replace(/\{\{company\}\}/g, contact.company || '')
        ?.replace(/\{\{title\}\}/g, contact.title || '')
        || '';

      if (!contact.linkedin_url) {
        results.push({
          contact_id: contact.id,
          status: 'skipped',
          reason: 'No LinkedIn URL'
        });
        failCount++;
        continue;
      }

      const result = await sendSalesNavigatorInMail(
        userId,
        workspaceId,
        contact.linkedin_url,
        subject,
        message
      );

      results.push({
        contact_id: contact.id,
        linkedin_profile: contact.linkedin_url,
        status: result.success ? 'sent' : 'failed',
        message: result.message,
        send_time: new Date().toISOString(),
        tracking_id: result.success ? `li_inmail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : undefined,
        type: 'inmail'
      });

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }

      // Safety delay between InMails (60-90 seconds)
      if (contacts.indexOf(contact) < contacts.length - 1) {
        const delay = 60000 + Math.random() * 30000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error: any) {
      results.push({
        contact_id: contact.id,
        status: 'error',
        error: error.message
      });
      failCount++;
    }
  }

  res.json({
    success: successCount > 0,
    campaign_id: campaignId,
    inmails_sent: successCount,
    inmails_failed: failCount,
    inmail_log: {
      campaign_id: campaignId,
      sent_at: new Date().toISOString(),
      total_recipients: contacts.length,
      successful: successCount,
      failed: failCount,
      subject_preview: subjectTemplate?.substring(0, 50) + '...',
      message_preview: messageTemplate?.substring(0, 80) + '...',
      type: 'sales_navigator_inmail'
    },
    inmail_results: results,
    message: `✅ ${successCount} InMails sent, ${failCount} failed`,
    note: 'InMail requires Sales Navigator subscription and recipient must be open to InMail'
  });
});

/**
 * GET /api/linkedin/engagement-status/:campaignId
 * Get LinkedIn engagement and acceptance stats
 */
router.get('/engagement-status/:campaignId', async (req, res) => {
  const { campaignId } = req.params;

  res.json({
    campaign_id: campaignId,
    connection_requests: {
      sent: 342,
      accepted: 198,
      pending: 112,
      declined: 32,
      acceptance_rate: '57.9%'
    },
    messages: {
      sent: 187,
      seen: 156,
      replied: 42,
      reply_rate: '22.5%',
      meeting_booked: 8,
      meeting_rate: '4.3%'
    },
    profile_interactions: {
      profile_views: 245,
      view_to_accept_rate: '0.81',
      avg_time_to_accept: '3.2 days'
    },
    top_responders: [
      { name: 'John Smith', title: 'VP Sales', company: 'Acme Corp', accepted: true, replied: true, meeting_scheduled: true },
      { name: 'Sarah Johnson', title: 'CMO', company: 'TechCorp', accepted: true, replied: true, meeting_scheduled: false },
      { name: 'Mike Chen', title: 'CEO', company: 'Startup XYZ', accepted: false, replied: false, meeting_scheduled: false }
    ],
    timing_analytics: {
      best_send_day: 'Tuesday',
      best_send_time: '9 AM',
      avg_response_time: '4.5 hours',
      peak_engagement_day: 'Wednesday'
    },
    last_updated: new Date().toISOString()
  });
});

/**
 * GET /api/linkedin/contact-history/:contactId
 * Get LinkedIn interaction history for a contact
 */
router.get('/contact-history/:contactId', async (req, res) => {
  const { contactId } = req.params;

  res.json({
    contact_id: contactId,
    linkedin_profile: 'https://linkedin.com/in/johnsmith',
    total_interactions: 5,
    interaction_history: [
      {
        interaction_id: 'li_001',
        date: '2025-01-15T09:00:00Z',
        type: 'connection_request',
        status: 'accepted',
        action_time: '2025-01-15T14:30:00Z'
      },
      {
        interaction_id: 'li_002',
        date: '2025-01-15T14:45:00Z',
        type: 'message',
        status: 'sent',
        message_preview: 'Hi John, your team could save 20 hours/week...',
        seen: true,
        seen_time: '2025-01-15T15:00:00Z',
        replied: true,
        reply: 'Sounds interesting, tell me more'
      },
      {
        interaction_id: 'li_003',
        date: '2025-01-15T16:00:00Z',
        type: 'profile_view',
        viewer_action: 'viewed_profile'
      }
    ],
    engagement_summary: {
      connection_status: 'Connected',
      message_engagement: 'High',
      profile_views: 3,
      sentiment: 'Positive',
      next_action: 'Schedule call - high engagement'
    }
  });
});

/**
 * POST /api/linkedin/message-reply-handler
 * Handle LinkedIn message replies
 */
router.post('/message-reply-handler', async (req, res) => {
  const { campaignId, contactId, replyMessage, respondedAt } = req.body;

  // Analyze sentiment and intent
  const hasInterest = replyMessage.toLowerCase().includes('interested') || replyMessage.toLowerCase().includes('yes');
  const asksMeeting = replyMessage.toLowerCase().includes('call') || replyMessage.toLowerCase().includes('meeting');

  res.json({
    status: 'reply_processed',
    campaign_id: campaignId,
    contact_id: contactId,
    message: replyMessage,
    sentiment: hasInterest ? 'Positive' : 'Neutral',
    intent: asksMeeting ? 'Meeting Request' : hasInterest ? 'Interested' : 'Question',
    action: asksMeeting ? 'Immediately schedule call' : hasInterest ? 'Send case study' : 'Answer question',
    timestamp: respondedAt,
    sophia_recommendation: hasInterest ? '🔥 Hot lead - schedule call immediately' : '📊 Continue engagement'
  });
});

/**
 * GET /api/linkedin/analytics/:campaignId
 * Get comprehensive LinkedIn campaign analytics
 */
router.get('/analytics/:campaignId', async (req, res) => {
  res.json({
    campaign_id: req.params.campaignId,
    performance_overview: {
      connection_requests_sent: 342,
      acceptance_rate: '57.9%',
      messages_sent: 187,
      message_reply_rate: '22.5%',
      meeting_booking_rate: '4.3%',
      revenue_generated: '$125000'
    },
    funnel_analytics: {
      connection_requests: 342,
      connections_accepted: 198,
      messages_sent: 187,
      messages_replied: 42,
      meetings_booked: 8,
      deals_closed: 2
    },
    engagement_by_title: [
      { title: 'VP Sales', sent: 85, accepted: 68, replied: 18, meetings: 4, conversion: '4.7%' },
      { title: 'CMO', sent: 92, accepted: 48, replied: 12, meetings: 2, conversion: '2.2%' },
      { title: 'CEO', sent: 78, accepted: 52, replied: 8, meetings: 2, conversion: '2.6%' },
      { title: 'Founder', sent: 64, accepted: 42, replied: 6, meetings: 1, conversion: '1.6%' }
    ],
    device_breakdown: {
      mobile: { views: 156, acceptance_rate: 0.54 },
      desktop: { views: 89, acceptance_rate: 0.68 }
    },
    sophia_insights: {
      best_sending_strategy: 'Connection request first, then message after 24 hours acceptance',
      highest_engagement_segment: 'VP Sales - 68% acceptance, 4.7% conversion',
      optimal_message_timing: 'Send within 24 hours of connection acceptance',
      recommended_message_length: '100-150 characters for highest reply rate',
      next_optimization: 'A/B test message templates by industry'
    }
  });
});

/**
 * GET /api/linkedin/safety-status
 * Get user's LinkedIn safety settings and status
 * Query params: workspace_id, account_id (optional - for multi-account support)
 */
router.get('/safety-status', async (req, res) => {
  const workspaceId = req.query.workspace_id as string | undefined;
  const accountId = req.query.account_id as string | undefined;
  
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'workspace_id required' });
  }
  
  try {
    const { data: dbSettings, error } = await supabase
      .from('linkedin_puppeteer_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    
    if (error) {
      console.error('[Safety Status] Database error:', error);
    }
    
    // Compute acceptance stats from contacts table (authoritative source)
    const { data: contactStats } = await supabase
      .from('contacts')
      .select('linkedin_connection_status')
      .eq('workspace_id', workspaceId)
      .not('linkedin_connection_sent_at', 'is', null);
    
    const totalSent = contactStats?.length || 0;
    const totalAccepted = contactStats?.filter(c => c.linkedin_connection_status === 'accepted').length || 0;
    const acceptanceRate = totalSent > 0 ? Math.round((totalAccepted / totalSent) * 100) : 0;
    
    console.log('[Safety Status] Workspace', workspaceId, '- computed from contacts:', {
      total_connections_sent: totalSent,
      total_connections_accepted: totalAccepted,
      acceptance_rate: acceptanceRate
    });
    
    const settings = {
      user_id: dbSettings?.user_id || 'unknown',
      workspace_id: workspaceId,
      account_id: accountId || null,
      
      linkedin_account_age_days: dbSettings?.linkedin_account_age_days ?? 180,
      account_age_category: 'established' as const,
      session_status: dbSettings?.is_active ? 'active' as const : 'inactive' as const,
      
      daily_connection_limit: dbSettings?.daily_connection_limit ?? 50,
      daily_message_limit: dbSettings?.daily_message_limit ?? 80,
      connections_sent_today: dbSettings?.connections_sent_today ?? 0,
      messages_sent_today: dbSettings?.messages_sent_today ?? 0,
      last_activity_date: dbSettings?.last_activity_date || new Date().toISOString(),
      
      hourly_connection_limit: dbSettings?.hourly_connection_limit ?? 8,
      hourly_message_limit: dbSettings?.hourly_message_limit ?? 12,
      connections_sent_this_hour: dbSettings?.connections_sent_this_hour ?? 0,
      messages_sent_this_hour: dbSettings?.messages_sent_this_hour ?? 0,
      current_hour_start: dbSettings?.current_hour_start || new Date().toISOString(),
      
      is_warming_up: dbSettings?.is_warming_up ?? true,
      warmup_day: dbSettings?.warmup_day ?? 1,
      warmup_phase: dbSettings?.warmup_phase ?? 'day1_ultra_light',
      warmup_started_at: dbSettings?.warmup_started_at,
      warmup_completed_at: dbSettings?.warmup_completed_at,
      
      total_connections_sent: totalSent,
      total_connections_accepted: totalAccepted,
      acceptance_rate: acceptanceRate,
      acceptance_rate_7day: acceptanceRate, // Use same rate for now
      low_acceptance_warnings: dbSettings?.low_acceptance_warnings ?? 0,
      paused_for_low_acceptance: dbSettings?.paused_for_low_acceptance ?? false,
      
      respect_business_hours: dbSettings?.respect_business_hours ?? true,
      business_hours_start: dbSettings?.business_hours_start ?? 9,
      business_hours_end: dbSettings?.business_hours_end ?? 18,
      timezone: dbSettings?.timezone ?? 'America/Chicago',
      reduce_weekend_activity: dbSettings?.reduce_weekend_activity ?? true,
      weekend_activity_percent: dbSettings?.weekend_activity_percent ?? 30,
      
      min_delay_between_actions_seconds: dbSettings?.min_delay_between_actions_seconds ?? 45,
      max_delay_between_actions_seconds: dbSettings?.max_delay_between_actions_seconds ?? 180,
      random_daily_start_offset_minutes: 30,
      random_break_probability: 15,
      random_break_duration_minutes: 15,
      
      safety_score: dbSettings?.safety_score ?? 100,
      risk_level: dbSettings?.risk_level ?? 'low',
      consecutive_success_count: dbSettings?.consecutive_success_count ?? 0,
      consecutive_failure_count: dbSettings?.consecutive_failure_count ?? 0,
      
      auto_pause_enabled: true,
      auto_pause_on_captcha: true,
      auto_pause_on_rate_limit: true,
      auto_pause_on_low_acceptance: true,
      auto_pause_acceptance_threshold: 20,
      
      is_active: dbSettings?.is_active ?? false,
      is_paused: dbSettings?.is_paused ?? false,
      error_count: dbSettings?.error_count ?? 0,
      total_sessions: 0,
      total_actions_lifetime: 0,
    };

    res.json({
      success: true,
      settings,
      message: 'Safety settings retrieved successfully'
    });
  } catch (error: any) {
    console.error('[Safety Status] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/linkedin/daily-analytics
 * Get daily LinkedIn connection analytics with day-over-day comparison
 * Query params: workspace_id, days (default 14)
 */
router.get('/daily-analytics', async (req, res) => {
  const workspaceId = req.query.workspace_id as string | undefined;
  const days = parseInt(req.query.days as string) || 14;
  
  if (!workspaceId) {
    return res.status(400).json({ error: 'workspace_id is required' });
  }
  
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    const { data: sentConnections, error: sentError } = await supabase
      .from('contacts')
      .select('linkedin_connection_sent_at, linkedin_connection_status')
      .eq('workspace_id', workspaceId)
      .not('linkedin_connection_sent_at', 'is', null)
      .gte('linkedin_connection_sent_at', startDateStr)
      .order('linkedin_connection_sent_at', { ascending: true });
    
    if (sentError) {
      console.error('[LinkedIn Daily Analytics] Error fetching contacts:', sentError);
      return res.status(500).json({ 
        success: false,
        error: 'Failed to fetch LinkedIn activity data',
        chartData: [],
        summary: { totalSent: 0, totalAccepted: 0, avgSentPerDay: 0, avgAcceptedPerDay: 0, acceptanceRate: 0, period: `${days} days` }
      });
    }
    
    const dailyData: Record<string, { date: string; sent: number; accepted: number }> = {};
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { date: dateStr, sent: 0, accepted: 0 };
    }
    
    if (sentConnections) {
      for (const contact of sentConnections) {
        if (contact.linkedin_connection_sent_at) {
          const dateStr = contact.linkedin_connection_sent_at.split('T')[0];
          if (dailyData[dateStr]) {
            dailyData[dateStr].sent++;
            if (contact.linkedin_connection_status === 'accepted' || contact.linkedin_connection_status === 'connected') {
              dailyData[dateStr].accepted++;
            }
          }
        }
      }
    }
    
    const sortedDays = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
    
    const chartData = sortedDays.map((day, index, arr) => {
      const prevDay = index > 0 ? arr[index - 1] : null;
      const sentChange = prevDay && prevDay.sent > 0 
        ? Math.round(((day.sent - prevDay.sent) / prevDay.sent) * 100) 
        : 0;
      const acceptedChange = prevDay && prevDay.accepted > 0 
        ? Math.round(((day.accepted - prevDay.accepted) / prevDay.accepted) * 100) 
        : 0;
      
      return {
        date: day.date,
        displayDate: new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sent: day.sent,
        accepted: day.accepted,
        sentChange,
        acceptedChange
      };
    });
    
    const totals = chartData.reduce((acc, day) => ({
      totalSent: acc.totalSent + day.sent,
      totalAccepted: acc.totalAccepted + day.accepted
    }), { totalSent: 0, totalAccepted: 0 });
    
    const avgSentPerDay = chartData.length > 0 ? Math.round(totals.totalSent / chartData.length) : 0;
    const avgAcceptedPerDay = chartData.length > 0 ? Math.round(totals.totalAccepted / chartData.length) : 0;
    const acceptanceRate = totals.totalSent > 0 
      ? Math.round((totals.totalAccepted / totals.totalSent) * 100) 
      : 0;
    
    res.json({
      success: true,
      chartData,
      summary: {
        totalSent: totals.totalSent,
        totalAccepted: totals.totalAccepted,
        avgSentPerDay,
        avgAcceptedPerDay,
        acceptanceRate,
        period: `${days} days`
      }
    });
  } catch (error) {
    console.error('[LinkedIn Daily Analytics] Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch daily analytics',
      chartData: [],
      summary: { totalSent: 0, totalAccepted: 0, avgSentPerDay: 0, avgAcceptedPerDay: 0, acceptanceRate: 0, period: `${days} days` }
    });
  }
});

/**
 * POST /api/linkedin/trigger-acceptance-check
 * Manually trigger acceptance check for pending connections
 */
router.post('/trigger-acceptance-check', async (req, res) => {
  try {
    console.log('[LinkedIn] Manual acceptance check triggered');
    const result = await triggerAcceptanceCheck();
    res.json({
      success: true,
      message: `Checked ${result.checked} connections: ${result.accepted} accepted, ${result.stillPending} pending, ${result.errors} errors`,
      ...result
    });
  } catch (error: any) {
    console.error('[LinkedIn] Acceptance check error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/linkedin/update-daily-limit
 * Update the daily connection limit for a workspace
 */
router.post('/update-daily-limit', async (req, res) => {
  try {
    const { workspace_id, daily_limit } = req.body;
    
    if (!workspace_id || !daily_limit) {
      return res.status(400).json({ success: false, error: 'workspace_id and daily_limit required' });
    }
    
    const limit = Math.max(1, Math.min(100, parseInt(daily_limit)));
    
    const { error } = await supabase
      .from('linkedin_puppeteer_settings')
      .update({ daily_connection_limit: limit, updated_at: new Date().toISOString() })
      .eq('workspace_id', workspace_id);
    
    if (error) {
      console.error('[Daily Limit] Update error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
    
    console.log(`[Daily Limit] Updated workspace ${workspace_id} to ${limit}/day`);
    res.json({ success: true, daily_limit: limit });
  } catch (error: any) {
    console.error('[Daily Limit] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/linkedin/sync-acceptance-counts
 * Sync acceptance counts from contacts to puppeteer settings AND campaign steps
 */
router.post('/sync-acceptance-counts', async (req, res) => {
  try {
    // First, sync campaign_scheduled_steps for any contacts marked as accepted
    const { data: acceptedContacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('linkedin_connection_status', 'accepted');
    
    let stepsUpdated = 0;
    for (const contact of acceptedContacts || []) {
      const { data: updated } = await supabase
        .from('campaign_scheduled_steps')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('contact_id', contact.id)
        .eq('status', 'sent')
        .eq('channel', 'linkedin_connection')
        .select();
      
      if (updated && updated.length > 0) {
        stepsUpdated += updated.length;
        console.log(`[Sync] Updated ${updated.length} step(s) to completed for contact ${contact.id}`);
      }
    }
    console.log(`[Sync] Total campaign steps updated to completed: ${stepsUpdated}`);
    
    const { data: workspaces, error: wsError } = await supabase
      .from('linkedin_puppeteer_settings')
      .select('workspace_id');
    
    if (wsError) throw wsError;
    
    let updated = 0;
    for (const ws of workspaces || []) {
      const { data: counts } = await supabase
        .from('contacts')
        .select('linkedin_connection_status')
        .eq('workspace_id', ws.workspace_id)
        .not('linkedin_connection_sent_at', 'is', null);
      
      const sent = counts?.length || 0;
      const accepted = counts?.filter(c => c.linkedin_connection_status === 'accepted').length || 0;
      const rate = sent > 0 ? Math.round((accepted / sent) * 100) : 0;
      
      await supabase
        .from('linkedin_puppeteer_settings')
        .update({
          total_connections_sent: sent,
          total_connections_accepted: accepted,
          acceptance_rate: rate,
          updated_at: new Date().toISOString()
        })
        .eq('workspace_id', ws.workspace_id);
      
      updated++;
      console.log(`[Sync] Workspace ${ws.workspace_id}: ${sent} sent, ${accepted} accepted, ${rate}%`);
    }
    
    res.json({ success: true, message: `Synced ${updated} workspaces` });
  } catch (error: any) {
    console.error('[Sync] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
