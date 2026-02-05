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

    const { accessToken, recipientId, message } = await req.json();

    if (!accessToken || !recipientId || !message) {
      throw new Error('Missing required fields: accessToken, recipientId, message');
    }

    // IMPORTANT: LinkedIn Messaging API requires LinkedIn Partner Program access
    // Standard OAuth apps cannot send direct messages via API
    // See: https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messaging
    
    const partnerApiEnabled = Deno.env.get('LINKEDIN_PARTNER_API_ENABLED') === 'true';
    
    if (!partnerApiEnabled) {
      // Queue message for manual sending
      await supabaseClient
        .from('agent_activities')
        .insert({
          user_id: user.id,
          activity_type: 'message_sent',
          channel: 'linkedin',
          outcome: 'pending_manual_action',
          metadata: {
            action: 'direct_message',
            recipient_id: recipientId,
            message: message,
            note: 'Manual action required - LinkedIn Partner API not enabled',
          },
        });

      return new Response(
        JSON.stringify({ 
          success: true,
          id: `manual-message-${Date.now()}`,
          message: 'LinkedIn message queued for manual sending. LinkedIn Partner API access required for automation.',
          requiresManualAction: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Partner API implementation
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to get LinkedIn profile');
    }

    const profile = await profileResponse.json();

    const messagingEndpoint = 'https://api.linkedin.com/v2/messages';

    const messagePayload = {
      recipients: [`urn:li:person:${recipientId}`],
      subject: 'Message from Agent Sophia',
      body: message,
    };

    const linkedInResponse = await fetch(messagingEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!linkedInResponse.ok) {
      const errorText = await linkedInResponse.text();
      console.error('LinkedIn API error:', errorText);
      throw new Error(`LinkedIn Partner API error: ${errorText}. Ensure you have Partner Program access.`);
    }

    const result = await linkedInResponse.json();

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'message_sent',
        channel: 'linkedin',
        outcome: 'success',
        metadata: {
          action: 'direct_message',
          recipient_id: recipientId,
          message: message,
          message_id: result.id,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        id: result.id || `message-${Date.now()}`,
        message: 'LinkedIn message sent successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('LinkedIn send message error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to send LinkedIn message'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
