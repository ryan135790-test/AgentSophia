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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { 
      to, 
      subject, 
      body, 
      accessToken,
      cc,
      bcc,
      contactId,
      campaignId
    } = await req.json();

    if (!to || !subject || !body || !accessToken) {
      throw new Error('Missing required fields: to, subject, body, accessToken');
    }

    // Send email via Microsoft Graph API
    const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/sendMail';

    const emailMessage = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: body,
        },
        toRecipients: Array.isArray(to) 
          ? to.map(email => ({ emailAddress: { address: email } }))
          : [{ emailAddress: { address: to } }],
        ...(cc && {
          ccRecipients: Array.isArray(cc)
            ? cc.map(email => ({ emailAddress: { address: email } }))
            : [{ emailAddress: { address: cc } }]
        }),
        ...(bcc && {
          bccRecipients: Array.isArray(bcc)
            ? bcc.map(email => ({ emailAddress: { address: email } }))
            : [{ emailAddress: { address: bcc } }]
        }),
      },
      saveToSentItems: true, // Save to Outlook Sent Items
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
      throw new Error(errorData.error?.message || 'Failed to send email via Microsoft Graph');
    }

    // Log to sophia_sent_messages table
    const { error: logError } = await supabaseClient
      .from('sophia_sent_messages')
      .insert({
        user_id: user.id,
        contact_id: contactId,
        campaign_id: campaignId,
        channel: 'email',
        provider: 'office365',
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: {
          subject: subject,
          to: to,
          cc: cc,
          bcc: bcc,
        },
      });

    if (logError) {
      console.error('Failed to log message:', logError);
    }

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'message_sent',
        outcome: 'success',
        metadata: {
          provider: 'office365',
          channel: 'email',
          to: to,
          subject: subject,
          contact_id: contactId,
          campaign_id: campaignId,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Email sent successfully via Office 365',
        provider: 'office365',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Office 365 send email error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to send email via Office 365'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
