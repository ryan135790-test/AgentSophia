import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { followupId } = await req.json();

    if (!followupId) {
      throw new Error('Missing required field: followupId');
    }

    // Fetch followup queue item
    const { data: followup, error: followupError } = await supabaseClient
      .from('followup_queue')
      .select('*, contacts(*)')
      .eq('id', followupId)
      .eq('user_id', user.id)
      .single();

    if (followupError || !followup) {
      throw new Error('Followup not found or unauthorized');
    }

    // Get Office 365 access token from connector_configs
    const { data: connectorConfig, error: connectorError } = await supabaseClient
      .from('connector_configs')
      .select('email_access_token, email_refresh_token, email_token_expiry')
      .eq('user_id', user.id)
      .eq('email_provider', 'outlook')
      .single();

    if (connectorError || !connectorConfig) {
      throw new Error('Office 365 not connected. Please connect in Agent Sophia Setup.');
    }

    let accessToken = connectorConfig.email_access_token;

    // Check if token needs refresh
    const now = Date.now();
    let tokenExpiry: number;

    if (typeof connectorConfig.email_token_expiry === 'string') {
      if (connectorConfig.email_token_expiry.includes('T')) {
        tokenExpiry = new Date(connectorConfig.email_token_expiry).getTime();
      } else {
        tokenExpiry = Number(connectorConfig.email_token_expiry);
      }
    } else {
      tokenExpiry = connectorConfig.email_token_expiry;
    }

    if (!Number.isFinite(tokenExpiry) || now >= tokenExpiry) {
      // Refresh token
      const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('OFFICE365_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('OFFICE365_CLIENT_SECRET') ?? '',
          refresh_token: connectorConfig.email_refresh_token,
          grant_type: 'refresh_token',
          scope: 'openid profile email offline_access Mail.Send Mail.Read Mail.ReadWrite Calendars.ReadWrite Contacts.ReadWrite',
        }),
      });

      if (!refreshResponse.ok) {
        throw new Error('Failed to refresh Office 365 token');
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update tokens in database
      await supabaseClient
        .from('connector_configs')
        .update({
          email_access_token: accessToken,
          email_refresh_token: refreshData.refresh_token || connectorConfig.email_refresh_token,
          email_token_expiry: Date.now() + (refreshData.expires_in * 1000),
        })
        .eq('user_id', user.id)
        .eq('email_provider', 'outlook');
    }

    // Update status to sending
    await supabaseClient
      .from('followup_queue')
      .update({ status: 'sending' })
      .eq('id', followupId);

    // Send email via Microsoft Graph API
    const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/sendMail';

    // Get subject and content from correct columns (check all possible locations)
    const subject = followup.metadata?.subject || followup.subject || 'Follow-up';
    const content = followup.suggested_message || followup.message_content || followup.content || '';

    // Safety check: Don't send blank emails
    if (!content || content.trim().length === 0) {
      console.error('❌ Cannot send email with blank content');
      
      await supabaseClient
        .from('followup_queue')
        .update({ 
          status: 'failed',
          metadata: { 
            ...followup.metadata,
            error: 'Email content is empty - cannot send'
          }
        })
        .eq('id', followupId);

      throw new Error('Email content is empty. Please edit the message before sending.');
    }

    const emailMessage = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: content,
        },
        toRecipients: [{ 
          emailAddress: { address: followup.contacts.email } 
        }],
      },
      saveToSentItems: true,
    };

    const graphResponse = await fetch(graphEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailMessage),
    });

    if (!graphResponse.ok) {
      const errorData = await graphResponse.json();
      console.error('Graph API error:', errorData);
      
      // Update status to failed
      await supabaseClient
        .from('followup_queue')
        .update({ 
          status: 'failed',
          metadata: { 
            ...followup.metadata,
            error: errorData.error?.message || 'Failed to send'
          }
        })
        .eq('id', followupId);

      throw new Error(errorData.error?.message || 'Failed to send email via Microsoft Graph');
    }

    // Update status to sent
    await supabaseClient
      .from('followup_queue')
      .update({ 
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', followupId);

    // Log to sophia_sent_messages
    await supabaseClient
      .from('sophia_sent_messages')
      .insert({
        user_id: user.id,
        contact_id: followup.contact_id,
        channel: 'email',
        provider: 'office365',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          subject: subject,
          content: content,
          to: followup.contacts.email,
          followup_id: followupId,
          followup_type: followup.followup_type,
        },
      });

    // Log activity
    await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        contact_id: followup.contact_id,
        activity_type: followup.followup_type === 'meeting' ? 'meeting_followup_sent' : 'follow_up_sent',
        outcome: 'success',
        metadata: {
          provider: 'office365',
          channel: 'email',
          to: followup.contacts.email,
          subject: subject,
          content: content,
          followup_id: followupId,
          approved_by_user: true,
        },
      });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Email sent successfully',
        followupId: followupId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Execute followup error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to execute followup'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
