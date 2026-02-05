import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrchestratorRequest {
  action: 'start' | 'stop' | 'run_now';
  userId: string;
  timeRange?: '24h' | '7d' | '30d';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body first
    const { action, userId, timeRange }: OrchestratorRequest = await req.json();
    
    if (!action || !userId) {
      throw new Error('Missing required fields: action, userId');
    }
    
    const emailTimeRange = timeRange || '24h';
    
    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    // Check if this is a service role key (for cron/automated calls)
    const isServiceRole = token === serviceRoleKey;
    
    if (isServiceRole) {
      console.log(`🔐 Service role authentication for user: ${userId}`);
    } else {
      // For user calls, verify JWT token
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      
      if (userError || !user) {
        throw new Error('Unauthorized');
      }
      
      // Verify user matches authenticated user
      if (userId !== user.id) {
        throw new Error('User ID mismatch');
      }
    }

    // Get agent configuration
    const { data: agentConfig, error: configError } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (configError || !agentConfig) {
      throw new Error('Agent configuration not found');
    }

    if (action === 'start') {
      // Mark agent as active
      await supabaseClient
        .from('agent_configs')
        .update({ is_active: true })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Agent Sophia started successfully',
          status: 'running',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (action === 'stop') {
      // Mark agent as inactive
      await supabaseClient
        .from('agent_configs')
        .update({ is_active: false })
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Agent Sophia stopped successfully',
          status: 'stopped',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (action === 'run_now') {
      // Execute autonomous operations immediately
      const results = await runAutonomousOperations(supabaseClient, userId, agentConfig, emailTimeRange);

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Autonomous operations executed successfully',
          results,
          tasksCompleted: results.tasksCompleted,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error('Orchestrator error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to execute orchestrator action'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

/**
 * Main autonomous operations loop
 * This function is called periodically (e.g., every 15 minutes) or manually
 */
async function runAutonomousOperations(supabaseClient: any, userId: string, agentConfig: any, timeRange: '24h' | '7d' | '30d' = '24h') {
  const results = {
    responsesDetected: 0,
    decisionsTriggered: 0,
    followUpsSent: 0,
    meetingsCreated: 0,
    tasksCompleted: 0,
    emailsScanned: 0,
    errors: [] as string[],
  };

  try {
    console.log(`Running autonomous operations for user ${userId} with time range: ${timeRange}`);

    // 1. Check for new responses (emails, LinkedIn messages)
    console.log('Step 1: Detecting new responses...');
    const responseResults = await detectNewResponses(supabaseClient, userId, timeRange);
    results.responsesDetected = responseResults.count;
    results.decisionsTriggered = responseResults.decisionsTriggered;
    results.emailsScanned = responseResults.emailsScanned || 0;
    if (responseResults.errors && responseResults.errors.length > 0) {
      results.errors.push(...responseResults.errors);
    }

    // 2. Execute pending follow-ups
    console.log('Step 2: Executing pending follow-ups...');
    const followUpResults = await executePendingFollowUps(supabaseClient, userId);
    results.followUpsSent = followUpResults.sent;

    // 3. Generate smart follow-ups for non-responsive contacts
    console.log('Step 3: Generating smart follow-ups...');
    const smartFollowUpResults = await generateSmartFollowUps(supabaseClient, userId);
    results.tasksCompleted = smartFollowUpResults.generated;

    // 4. Process meeting approvals (if auto-book is enabled)
    console.log('Step 4: Processing meeting approvals...');
    if (agentConfig.meeting_booking?.auto_book_qualified_leads) {
      const meetingResults = await processAutoBookMeetings(supabaseClient, userId);
      results.meetingsCreated = meetingResults.booked;
    }

    console.log('Autonomous operations completed:', results);

  } catch (error) {
    console.error('Error in autonomous operations:', error);
    results.errors.push(error.message);
  }

  return results;
}

/**
 * Detect new responses from email and LinkedIn
 */
async function detectNewResponses(supabaseClient: any, userId: string, timeRange: '24h' | '7d' | '30d' = '24h') {
  let responsesCount = 0;
  let decisionsCount = 0;
  let totalEmailsScanned = 0;
  const errors: string[] = [];

  try {
    // Get user's Office 365 connection (email_provider = 'outlook')
    const { data: office365Connection } = await supabaseClient
      .from('connector_configs')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Check if Office 365/Outlook is connected
    if (office365Connection && office365Connection.email_provider === 'outlook' && office365Connection.email_access_token) {
      // Check Office 365 inbox for new responses
      try {
        const emailResults = await checkOffice365Inbox(supabaseClient, userId, office365Connection, timeRange);
        responsesCount += emailResults.newResponses;
        decisionsCount += emailResults.decisionsTriggered;
        totalEmailsScanned += emailResults.emailsScanned || 0;
      } catch (emailError) {
        const errorMsg = `Email detection failed: ${emailError.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    } else {
      const msg = 'Office 365 not connected or no access token - skipping email detection';
      console.log(msg);
      errors.push(msg);
    }

    // Note: LinkedIn response detection disabled unless Partner API is enabled
    const linkedInPartnerEnabled = Deno.env.get('LINKEDIN_PARTNER_API_ENABLED') === 'true';
    if (linkedInPartnerEnabled) {
      const { data: linkedInConnection } = await supabaseClient
        .from('social_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'linkedin')
        .single();

      if (linkedInConnection) {
        try {
          const linkedInResults = await checkLinkedInMessages(supabaseClient, userId, linkedInConnection);
          responsesCount += linkedInResults.newResponses;
          decisionsCount += linkedInResults.decisionsTriggered;
        } catch (linkedInError) {
          const errorMsg = `LinkedIn detection failed: ${linkedInError.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }
    }

  } catch (error) {
    const errorMsg = `Error detecting responses: ${error.message}`;
    console.error(errorMsg);
    errors.push(errorMsg);
  }

  return {
    count: responsesCount,
    decisionsTriggered: decisionsCount,
    emailsScanned: totalEmailsScanned,
    errors,
  };
}

/**
 * Check Office 365 inbox for new email responses
 */
async function checkOffice365Inbox(supabaseClient: any, userId: string, connection: any, timeRange: '24h' | '7d' | '30d' = '24h') {
  let newResponses = 0;
  let decisionsTriggered = 0;
  let emailsScanned = 0;

  // Check if token is expired and refresh if needed
  let accessToken = connection.email_access_token;
  const tokenExpiry = connection.email_token_expiry;
  const refreshToken = connection.email_refresh_token;
  
  if (!accessToken || !refreshToken) {
    console.error('No Office 365 access token or refresh token found');
    throw new Error('Office 365 not properly connected - please reconnect Office 365');
  }

  // Check if token is expired (with 5-minute buffer)
  // tokenExpiry can be: number, numeric string (from BIGINT), or ISO date string
  let expiryMs: number;
  if (typeof tokenExpiry === 'number') {
    expiryMs = tokenExpiry;
  } else if (typeof tokenExpiry === 'string') {
    // Try parsing as numeric string first (BIGINT returns as string)
    const numericValue = Number(tokenExpiry);
    if (Number.isFinite(numericValue)) {
      expiryMs = numericValue;
      console.log(`📅 Token expiry parsed from numeric string: ${new Date(expiryMs).toISOString()}`);
    } else {
      // Fall back to ISO date parsing
      expiryMs = new Date(tokenExpiry).getTime();
      if (Number.isFinite(expiryMs)) {
        console.log(`📅 Token expiry parsed from ISO string: ${tokenExpiry} -> ${new Date(expiryMs).toISOString()}`);
      } else {
        console.warn(`⚠️ Invalid token expiry string: "${tokenExpiry}", treating as expired`);
      }
    }
  } else {
    expiryMs = NaN;
    console.warn('⚠️ Token expiry is not a number or string, treating as expired');
  }
  
  // Treat NaN or missing expiry as expired (force refresh)
  const isTokenExpired = !tokenExpiry || !Number.isFinite(expiryMs) || expiryMs < Date.now() + (5 * 60 * 1000);
  
  if (Number.isFinite(expiryMs)) {
    console.log(`🔍 Token expiry check: expires at ${new Date(expiryMs).toISOString()}, isExpired=${isTokenExpired}`);
  } else {
    console.log(`🔍 Token expiry check: expiryMs=INVALID (${expiryMs}), isExpired=${isTokenExpired}`);
  }
  
  if (isTokenExpired) {
    console.log('🔄 Access token expired, refreshing...');
    try {
      const refreshedTokens = await refreshOffice365Token(supabaseClient, userId, refreshToken);
      accessToken = refreshedTokens.accessToken;
      console.log('✅ Token refreshed successfully in proactive check');
    } catch (refreshError) {
      console.error('❌ Failed to refresh token:', refreshError);
      throw new Error('Failed to refresh Office 365 token - please reconnect Office 365');
    }
  }

  // Calculate time range based on parameter
  const hoursBack = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720; // 24h, 7d, or 30d
  const startDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  
  // Build URL with proper encoding using URLSearchParams
  const baseUrl = 'https://graph.microsoft.com/v1.0/me/messages';
  const url = new URL(baseUrl);
  url.searchParams.append('$filter', `receivedDateTime ge ${startDate}`);
  url.searchParams.append('$select', 'id,subject,from,receivedDateTime,body,bodyPreview,isRead');
  url.searchParams.append('$top', '50');
  url.searchParams.append('$orderby', 'receivedDateTime desc');

  console.log(`🔍 Checking Office 365 inbox for emails since ${startDate} (${timeRange})`);
  console.log(`📍 Graph API URL: ${url.toString()}`);

  let response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  // If we get a 401 (Unauthorized), the token might be expired/invalid - refresh and retry once
  if (response.status === 401) {
    console.log('⚠️ Got 401 error, token may be expired. Refreshing and retrying...');
    try {
      const refreshedTokens = await refreshOffice365Token(supabaseClient, userId, refreshToken);
      accessToken = refreshedTokens.accessToken;
      
      // Retry the request with the new token
      response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
      if (response.ok) {
        console.log('✅ Retry with refreshed token succeeded!');
      }
    } catch (refreshError) {
      console.error('❌ Token refresh failed:', refreshError);
      throw new Error(`Failed to refresh Office 365 token: ${refreshError.message}`);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    const errorMsg = `Office 365 API error (${response.status}): ${errorText}`;
    console.error('❌ Failed to fetch Office 365 emails:', errorMsg);
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const emails = data.value || [];
  emailsScanned = emails.length;
  
  console.log(`📧 Found ${emailsScanned} emails in Office 365 inbox from last ${timeRange}`);

  // For each email, check if it's a response to our outreach
  for (const email of emails) {
    const fromEmail = email.from?.emailAddress?.address;
    if (!fromEmail) {
      console.log('⚠️ Skipping email with no sender address');
      continue;
    }

    console.log(`📨 Checking email from: ${fromEmail}, subject: "${email.subject}", isRead: ${email.isRead}`);

    // Find matching contact
    const { data: contact, error: contactError } = await supabaseClient
      .from('contacts')
      .select('id, first_name, last_name, email')
      .eq('user_id', userId)
      .eq('email', fromEmail)
      .single();

    let contactId = null;
    let contactName = '';
    const senderName = email.from?.emailAddress?.name || fromEmail.split('@')[0];

    if (contactError || !contact) {
      console.log(`🆕 Email from UNKNOWN sender: ${senderName} (${fromEmail}) - will create contact on approval!`);
      contactName = senderName;
    } else {
      contactId = contact.id;
      contactName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || contact.email;
      console.log(`✅ Found matching contact: ${contactName} (${contact.email})`);
    }

    // Check if we've already processed this email (deduplication)
    const { data: existingResponse } = await supabaseClient
      .from('campaign_responses')
      .select('id')
      .eq('user_id', userId)
      .eq('metadata->>email_id', email.id)
      .single();

    if (existingResponse) {
      console.log(`⏭️ Already processed email ${email.id}, skipping`);
      continue;
    }

    // This is a new response (from known or unknown contact)
    newResponses++;
    console.log(`🆕 NEW response detected from ${contactName}!`);

    // Log the response (contact_id can be null for unknown senders)
    // Get full email body content (Microsoft Graph returns body as object with content and contentType)
    const emailBody = email.body?.content || email.bodyPreview || '';
    
    const { data: responseRecord, error: insertError} = await supabaseClient
      .from('campaign_responses')
      .insert({
        user_id: userId,
        contact_id: contactId, // null if unknown sender
        channel: 'email',
        response_text: emailBody,
        response_date: email.receivedDateTime,
        metadata: {
          email_id: email.id,
          subject: email.subject,
          from: fromEmail,
          from_name: senderName,
          // Store prospect info for unknown senders
          is_unknown_sender: !contactId,
          prospect_email: !contactId ? fromEmail : null,
          prospect_name: !contactId ? senderName : null,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert campaign response:', insertError);
      continue;
    }

    // Trigger AI decision engine (works with or without contact_id)
    if (responseRecord) {
      try {
        console.log(`🤖 Triggering AI decision engine for ${contactId ? 'contact' : 'unknown sender'} ${contactName}`);
        await triggerDecisionEngineForResponse(supabaseClient, userId, contactId, responseRecord.id, fromEmail, senderName);
        decisionsTriggered++;
        console.log(`✨ Decision triggered successfully!`);
      } catch (decisionError) {
        console.error('Failed to trigger decision:', decisionError);
      }
    }
  }

  return { newResponses, decisionsTriggered, emailsScanned };
}

/**
 * Trigger the AI decision engine for a contact or unknown sender response
 */
async function triggerDecisionEngineForResponse(
  supabaseClient: any, 
  userId: string, 
  contactId: string | null, 
  responseId: string,
  prospectEmail?: string,
  prospectName?: string
) {
  const functionUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/agent-sophia-decision';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: userId,
      contactId: contactId, // can be null for unknown senders
      responseId: responseId,
      prospectEmail: prospectEmail, // for unknown senders
      prospectName: prospectName, // for unknown senders
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to trigger decision engine');
  }

  return await response.json();
}

/**
 * Legacy function - redirects to triggerDecisionEngineForResponse
 */
async function triggerDecisionEngine(supabaseClient: any, userId: string, contactId: string, responseId: string) {
  return triggerDecisionEngineForResponse(supabaseClient, userId, contactId, responseId);
}

/**
 * Check LinkedIn for new messages (requires Partner API)
 */
async function checkLinkedInMessages(supabaseClient: any, userId: string, connection: any) {
  let newResponses = 0;
  let decisionsTriggered = 0;

  try {
    // Call linkedin-check-messages edge function
    const functionUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/linkedin-check-messages';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken: connection.access_token,
      }),
    });

    if (!response.ok) {
      console.error('Failed to check LinkedIn messages:', await response.text());
      return { newResponses: 0, decisionsTriggered: 0 };
    }

    const data = await response.json();
    const messages = data.messages || [];

    // Process each new message
    for (const message of messages) {
      const linkedInId = message.from?.id;
      const linkedInName = message.from?.name;
      if (!linkedInId) continue;

      // Find matching contact by LinkedIn ID or URL containing the ID
      const { data: contact } = await supabaseClient
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .or(`linkedin_id.eq.${linkedInId},linkedin_url.ilike.%${linkedInId}%`)
        .single();

      if (contact) {
        // Check for deduplication
        const { data: existingResponse } = await supabaseClient
          .from('campaign_responses')
          .select('id')
          .eq('user_id', userId)
          .eq('metadata->>message_id', message.id)
          .single();

        if (existingResponse) {
          continue; // Already processed
        }

        newResponses++;

        // Log the response
        const { data: responseRecord } = await supabaseClient
          .from('campaign_responses')
          .insert({
            user_id: userId,
            contact_id: contact.id,
            channel: 'linkedin',
            response_text: message.text || '',
            response_date: message.createdAt,
            metadata: {
              message_id: message.id,
              conversation_id: message.conversationId,
              from_id: linkedInId,
            },
          })
          .select()
          .single();

        // Trigger decision engine
        if (responseRecord) {
          try {
            await triggerDecisionEngine(supabaseClient, userId, contact.id, responseRecord.id);
            decisionsTriggered++;
          } catch (error) {
            console.error('Failed to trigger decision:', error);
          }
        }
      }
    }

  } catch (error) {
    console.error('Error checking LinkedIn messages:', error);
  }

  return { newResponses, decisionsTriggered };
}

/**
 * Execute pending follow-up tasks
 * Processes both 'pending' (auto-generated) and 'approved' (manually approved by user)
 */
async function executePendingFollowUps(supabaseClient: any, userId: string) {
  const { data: followUps, error } = await supabaseClient
    .from('followup_queue')
    .select('*, contacts(*)')
    .eq('user_id', userId)
    .in('status', ['pending', 'approved']) // Execute both auto and manually-approved items
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(10);

  if (error || !followUps || followUps.length === 0) {
    return { sent: 0 };
  }

  let sent = 0;

  for (const followUp of followUps) {
    try {
      let requiresManualAction = false;
      
      // Send via appropriate channel
      if (followUp.channel === 'email') {
        await sendFollowUpEmail(supabaseClient, userId, followUp);
      } else if (followUp.channel === 'linkedin') {
        const result = await sendFollowUpLinkedIn(supabaseClient, userId, followUp);
        requiresManualAction = result?.requiresManualAction || false;
      }
      // Add more channels as needed (SMS, phone, etc.)
      
      // Mark as sent or manual_required
      const newStatus = requiresManualAction ? 'manual_required' : 'sent';
      await supabaseClient
        .from('followup_queue')
        .update({ 
          status: newStatus, 
          sent_at: requiresManualAction ? null : new Date().toISOString(),
          failure_reason: requiresManualAction ? 'LinkedIn Partner API not enabled - manual action required' : null
        })
        .eq('id', followUp.id);

      // Log activity
      await supabaseClient
        .from('agent_activities')
        .insert({
          user_id: userId,
          activity_type: 'outreach',
          contact_id: followUp.contact_id,
          channel: followUp.channel,
          outcome: requiresManualAction ? 'pending_manual_action' : 'success',
          metadata: {
            followUpId: followUp.id,
            message: followUp.suggested_message,
            automated: !requiresManualAction,
            requires_manual_action: requiresManualAction,
          },
        });

      if (!requiresManualAction) {
        sent++;
      }
    } catch (error) {
      console.error(`Failed to send follow-up ${followUp.id}:`, error);
      
      await supabaseClient
        .from('followup_queue')
        .update({ 
          status: 'failed',
          failure_reason: error.message,
          retry_count: (followUp.retry_count || 0) + 1
        })
        .eq('id', followUp.id);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { sent };
}

/**
 * Send follow-up via email
 */
async function sendFollowUpEmail(supabaseClient: any, userId: string, followUp: any) {
  // Get Office 365 connection
  const { data: connection } = await supabaseClient
    .from('connector_configs')
    .select('email_access_token, email_provider')
    .eq('user_id', userId)
    .single();

  if (!connection?.email_access_token || connection.email_provider !== 'outlook') {
    throw new Error('Office 365 not connected');
  }

  // Send email via Microsoft Graph API
  const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/sendMail';
  
  const mailPayload = {
    message: {
      subject: `Following up - ${followUp.contacts?.name || 'our conversation'}`,
      body: {
        contentType: 'HTML',
        content: followUp.suggested_message,
      },
      toRecipients: [
        {
          emailAddress: {
            address: followUp.contacts?.email,
          },
        },
      ],
    },
  };

  const response = await fetch(graphEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.email_access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mailPayload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  // ✨ NEW: Sync contact to O365 after successful email send
  try {
    // Check if O365 contact sync is enabled
    const { data: agentConfig } = await supabaseClient
      .from('agent_configs')
      .select('sync_o365_contacts')
      .eq('user_id', userId)
      .single();

    if (agentConfig?.sync_o365_contacts && followUp.contacts?.email && followUp.contact_id) {
      console.log(`📇 Syncing contact to O365 after email send...`);
      
      await syncContactToO365(
        supabaseClient,
        userId,
        followUp.contacts,
        connection.email_access_token
      );

      // Log successful sync
      await supabaseClient
        .from('agent_activities')
        .insert({
          user_id: userId,
          activity_type: 'contact_synced',
          contact_id: followUp.contact_id,
          channel: 'office365',
          action_taken: 'Synced contact to O365 Contacts',
          outcome: 'success',
          metadata: {
            o365_contact_id: followUp.contacts.o365_contact_id,
            sync_timestamp: new Date().toISOString(),
          },
        });
    }
  } catch (syncError) {
    // Don't fail the email send if sync fails
    console.error('⚠️ Failed to sync contact to O365:', syncError);
    
    // Log the sync failure
    await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: userId,
        activity_type: 'contact_sync_failed',
        contact_id: followUp.contact_id,
        channel: 'office365',
        action_taken: 'Attempted to sync contact to O365',
        outcome: 'failed',
        outcome_details: syncError.message,
        metadata: {
          error: syncError.message,
        },
      });
  }
}

/**
 * Send follow-up via LinkedIn
 * Returns { requiresManualAction: boolean } to indicate if manual action is needed
 */
async function sendFollowUpLinkedIn(supabaseClient: any, userId: string, followUp: any) {
  // Get LinkedIn connection
  const { data: connection } = await supabaseClient
    .from('social_connections')
    .select('access_token')
    .eq('user_id', userId)
    .eq('platform', 'linkedin')
    .single();

  if (!connection?.access_token) {
    throw new Error('LinkedIn not connected');
  }

  // Call linkedin-send-message edge function
  const functionUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/linkedin-send-message';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      accessToken: connection.access_token,
      recipientId: followUp.contacts?.linkedin_id || followUp.metadata?.linkedin_id,
      message: followUp.suggested_message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'Failed to send LinkedIn message');
  }

  const result = await response.json();
  
  // Return result indicating if manual action is required
  return {
    requiresManualAction: result.requiresManualAction || false,
    message: result.message,
  };
}

/**
 * Generate smart AI follow-ups for contacts that haven't responded
 */
async function generateSmartFollowUps(supabaseClient: any, userId: string) {
  // Find contacts with sent outreach but no response in last 3 days
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentOutreach } = await supabaseClient
    .from('agent_activities')
    .select('contact_id, channel')
    .eq('user_id', userId)
    .eq('activity_type', 'outreach')
    .gte('created_at', threeDaysAgo);

  if (!recentOutreach || recentOutreach.length === 0) {
    return { generated: 0 };
  }

  // For each contact, check if they need a follow-up
  // This is a simplified version - production would use AI to generate contextual follow-ups
  let generated = 0;

  for (const outreach of recentOutreach.slice(0, 5)) { // Limit to 5 per run
    // Check if follow-up already exists
    const { data: existing } = await supabaseClient
      .from('followup_queue')
      .select('id')
      .eq('contact_id', outreach.contact_id)
      .eq('status', 'pending')
      .single();

    if (existing) continue; // Already has pending follow-up

    // Queue a follow-up for tomorrow
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await supabaseClient
      .from('followup_queue')
      .insert({
        user_id: userId,
        contact_id: outreach.contact_id,
        channel: outreach.channel,
        suggested_message: 'Following up on my previous message. Would love to connect!',
        scheduled_for: tomorrow.toISOString(),
        status: 'pending',
      });

    generated++;
  }

  return { generated };
}

/**
 * Auto-book meetings for high-confidence suggestions
 */
async function processAutoBookMeetings(supabaseClient: any, userId: string) {
  const { data: meetings } = await supabaseClient
    .from('meeting_approvals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .gte('confidence', 0.9) // Only auto-book high confidence
    .limit(5);

  if (!meetings || meetings.length === 0) {
    return { booked: 0 };
  }

  // Get Office 365 connection
  const { data: connection } = await supabaseClient
    .from('connector_configs')
    .select('email_access_token, email_provider')
    .eq('user_id', userId)
    .single();

  if (!connection?.email_access_token || connection.email_provider !== 'outlook') {
    console.log('Office 365 not connected - skipping auto-booking');
    return { booked: 0 };
  }

  let booked = 0;

  for (const meeting of meetings) {
    try {
      // Book meeting via Microsoft Graph API
      const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/events';

      const eventPayload = {
        subject: meeting.subject,
        body: {
          contentType: 'HTML',
          content: meeting.description || 'Meeting scheduled by Agent Sophia',
        },
        start: {
          dateTime: meeting.suggested_time,
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(new Date(meeting.suggested_time).getTime() + 30 * 60000).toISOString(),
          timeZone: 'UTC',
        },
        attendees: [
          {
            emailAddress: {
              address: meeting.attendee_email,
            },
            type: 'required',
          },
        ],
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      };

      const response = await fetch(graphEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${connection.email_access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventPayload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to book meeting: ${error}`);
      }

      const event = await response.json();

      // Mark as approved and booked
      await supabaseClient
        .from('meeting_approvals')
        .update({ 
          status: 'approved',
          meeting_link: event.onlineMeeting?.joinUrl,
          booked_at: new Date().toISOString(),
        })
        .eq('id', meeting.id);

      // Log activity
      await supabaseClient
        .from('agent_activities')
        .insert({
          user_id: userId,
          activity_type: 'meeting_booked',
          contact_id: meeting.contact_id,
          channel: 'office365',
          outcome: 'success',
          metadata: {
            meeting_id: event.id,
            subject: meeting.subject,
            start_time: meeting.suggested_time,
            online_meeting_url: event.onlineMeeting?.joinUrl,
            automated: true,
          },
        });

      booked++;
    } catch (error) {
      console.error(`Failed to auto-book meeting ${meeting.id}:`, error);
      
      // Mark as failed
      await supabaseClient
        .from('meeting_approvals')
        .update({ 
          status: 'rejected',
          rejection_reason: error.message,
        })
        .eq('id', meeting.id);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { booked };
}

/**
 * Refresh Office 365 access token using refresh token
 */
async function refreshOffice365Token(supabaseClient: any, userId: string, refreshToken: string) {
  console.log('🔄 Refreshing Office 365 access token...');
  
  // Microsoft OAuth token endpoint
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  // Get OAuth credentials from environment
  const clientId = Deno.env.get('OFFICE365_CLIENT_ID');
  const clientSecret = Deno.env.get('OFFICE365_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Office 365 OAuth credentials not configured');
  }
  
  // Build form data for token refresh
  const formData = new URLSearchParams();
  formData.append('client_id', clientId);
  formData.append('client_secret', clientSecret);
  formData.append('refresh_token', refreshToken);
  formData.append('grant_type', 'refresh_token');
  formData.append('scope', 'offline_access User.Read Mail.Read Mail.Send Calendars.ReadWrite Contacts.ReadWrite');
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Microsoft token refresh API error:', errorText);
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      throw new Error(`Token refresh failed: ${errorText}`);
    }
    throw new Error(`Token refresh failed: ${errorData.error_description || errorData.error || errorText}`);
  }
  
  const tokenData = await response.json();
  const newAccessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token || refreshToken; // Use new refresh token if provided
  const expiresIn = tokenData.expires_in || 3600; // Usually 3600 seconds (1 hour)
  const expiryTime = Date.now() + expiresIn * 1000; // Numeric timestamp (milliseconds since epoch)
  
  // Update database with new tokens
  const { error: updateError } = await supabaseClient
    .from('connector_configs')
    .update({
      email_access_token: newAccessToken,
      email_refresh_token: newRefreshToken,
      email_token_expiry: expiryTime,
    })
    .eq('user_id', userId)
    .eq('email_provider', 'outlook');
  
  if (updateError) {
    console.error('❌ Failed to update tokens in database:', updateError);
    throw new Error('Failed to save refreshed tokens');
  }
  
  console.log(`✅ Tokens refreshed and saved. New expiry: ${new Date(expiryTime).toISOString()}`);
  
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: expiryTime,
  };
}

/**
 * Sync contact to Office 365 Contacts
 * Creates new contact or updates existing one
 */
async function syncContactToO365(
  supabaseClient: any, 
  userId: string, 
  contact: any,
  accessToken: string
) {
  try {
    console.log(`🔄 Syncing contact ${contact.id} to O365...`);

    // Prepare O365 contact data
    const contactData: any = {
      givenName: contact.first_name || '',
      surname: contact.last_name || '',
      emailAddresses: contact.email ? [{
        address: contact.email,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
      }] : [],
      businessPhones: contact.phone ? [contact.phone] : [],
      companyName: contact.company || '',
      jobTitle: contact.job_title || contact.position || '',
      personalNotes: contact.notes || '',
    };

    // Check if contact already has O365 ID (update) or needs creation
    if (contact.o365_contact_id) {
      // Update existing O365 contact
      const updateEndpoint = `https://graph.microsoft.com/v1.0/me/contacts/${contact.o365_contact_id}`;
      
      const response = await fetch(updateEndpoint, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contactData),
      });

      if (!response.ok) {
        // If contact not found (404), create new one instead
        if (response.status === 404) {
          console.log(`⚠️ O365 contact ${contact.o365_contact_id} not found, creating new one...`);
          return await createO365Contact(supabaseClient, userId, contact, contactData, accessToken);
        }
        
        const error = await response.text();
        throw new Error(`Failed to update O365 contact: ${error}`);
      }

      console.log(`✅ Updated O365 contact ${contact.o365_contact_id}`);

      // Update sync timestamp
      await supabaseClient
        .from('contacts')
        .update({ o365_synced_at: new Date().toISOString() })
        .eq('id', contact.id);

      return { action: 'updated', o365ContactId: contact.o365_contact_id };

    } else {
      // Create new O365 contact
      return await createO365Contact(supabaseClient, userId, contact, contactData, accessToken);
    }

  } catch (error) {
    console.error('❌ Error syncing contact to O365:', error);
    throw error;
  }
}

/**
 * Create new contact in Office 365
 */
async function createO365Contact(
  supabaseClient: any,
  userId: string,
  contact: any,
  contactData: any,
  accessToken: string
) {
  const createEndpoint = 'https://graph.microsoft.com/v1.0/me/contacts';
  
  const response = await fetch(createEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(contactData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create O365 contact: ${error}`);
  }

  const newContact = await response.json();
  console.log(`✅ Created new O365 contact ${newContact.id}`);

  // Save O365 contact ID in our database
  await supabaseClient
    .from('contacts')
    .update({ 
      o365_contact_id: newContact.id,
      o365_synced_at: new Date().toISOString()
    })
    .eq('id', contact.id);

  return { action: 'created', o365ContactId: newContact.id };
}
