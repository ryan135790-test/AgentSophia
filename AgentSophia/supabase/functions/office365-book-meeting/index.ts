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
      accessToken,
      attendees,
      subject,
      body,
      startTime,
      endTime,
      duration, // in minutes, alternative to endTime
      location,
      contactId,
      campaignId
    } = await req.json();

    if (!accessToken || !attendees || !subject || !startTime) {
      throw new Error('Missing required fields: accessToken, attendees, subject, startTime');
    }

    // Calculate end time if duration provided
    let calculatedEndTime = endTime;
    if (!calculatedEndTime && duration) {
      const start = new Date(startTime);
      calculatedEndTime = new Date(start.getTime() + duration * 60000).toISOString();
    }

    if (!calculatedEndTime) {
      throw new Error('Either endTime or duration must be provided');
    }

    // Create calendar event via Microsoft Graph API
    const graphEndpoint = 'https://graph.microsoft.com/v1.0/me/events';

    const event = {
      subject: subject,
      body: {
        contentType: 'HTML',
        content: body || `Meeting scheduled by Agent Sophia`,
      },
      start: {
        dateTime: startTime,
        timeZone: 'UTC',
      },
      end: {
        dateTime: calculatedEndTime,
        timeZone: 'UTC',
      },
      attendees: Array.isArray(attendees)
        ? attendees.map(email => ({
            emailAddress: {
              address: typeof email === 'string' ? email : email.email,
              name: typeof email === 'object' ? email.name : undefined,
            },
            type: 'required',
          }))
        : [{
            emailAddress: {
              address: attendees,
            },
            type: 'required',
          }],
      ...(location && { location: { displayName: location } }),
      isOnlineMeeting: true, // Enable Teams meeting
      onlineMeetingProvider: 'teamsForBusiness',
    };

    const graphResponse = await fetch(graphEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!graphResponse.ok) {
      const errorData = await graphResponse.json();
      console.error('Graph API error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to create calendar event');
    }

    const createdEvent = await graphResponse.json();

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'meeting_booked',
        outcome: 'success',
        metadata: {
          provider: 'office365',
          event_id: createdEvent.id,
          subject: subject,
          start_time: startTime,
          attendees: attendees,
          contact_id: contactId,
          campaign_id: campaignId,
          online_meeting_url: createdEvent.onlineMeeting?.joinUrl,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        event: {
          id: createdEvent.id,
          subject: createdEvent.subject,
          startTime: createdEvent.start.dateTime,
          endTime: createdEvent.end.dateTime,
          webLink: createdEvent.webLink,
          onlineMeetingUrl: createdEvent.onlineMeeting?.joinUrl,
        },
        message: 'Meeting booked successfully via Office 365',
        provider: 'office365',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Office 365 book meeting error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to book meeting via Office 365'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
