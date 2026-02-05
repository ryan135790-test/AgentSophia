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

    if (!accessToken || !recipientId) {
      throw new Error('Missing required fields: accessToken, recipientId');
    }

    // IMPORTANT: LinkedIn connection requests require LinkedIn Partner Program access
    // This endpoint is not available via standard OAuth applications
    // For production use, you need to:
    // 1. Apply for LinkedIn Partner Program: https://business.linkedin.com/marketing-solutions/marketing-partners
    // 2. Get approval for Invitations API access
    // 3. Use the approved Partner API endpoints
    //
    // Alternative: Use LinkedIn Sales Navigator API (requires enterprise license)
    // or implement manual approval workflow where users send connections manually
    
    // Check if LinkedIn Partner API is enabled (feature flag)
    const partnerApiEnabled = Deno.env.get('LINKEDIN_PARTNER_API_ENABLED') === 'true';
    
    if (!partnerApiEnabled) {
      // Return success with manual action required
      await supabaseClient
        .from('agent_activities')
        .insert({
          user_id: user.id,
          activity_type: 'outreach',
          channel: 'linkedin',
          outcome: 'pending_manual_action',
          metadata: {
            action: 'connection_request',
            recipient_id: recipientId,
            message: message,
            note: 'Manual action required - LinkedIn Partner API not enabled',
          },
        });

      return new Response(
        JSON.stringify({ 
          success: true,
          id: `manual-connection-${Date.now()}`,
          message: 'Connection request queued for manual sending. LinkedIn Partner API access required for automation.',
          requiresManualAction: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Partner API implementation (only runs if enabled)
    const linkedInEndpoint = `https://api.linkedin.com/v2/invitations`;

    const invitation = {
      invitee: {
        'com.linkedin.voyager.growth.invitation.InviteeProfile': {
          profileId: recipientId
        }
      },
      message: message || '',
      trackingId: `agent-sophia-${Date.now()}`,
    };

    const linkedInResponse = await fetch(linkedInEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(invitation),
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
        activity_type: 'outreach',
        channel: 'linkedin',
        outcome: 'success',
        metadata: {
          action: 'connection_request',
          recipient_id: recipientId,
          message: message,
          invitation_id: result.id,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        id: result.id || `connection-${Date.now()}`,
        message: 'Connection request sent successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('LinkedIn send connection error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to send LinkedIn connection request'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
