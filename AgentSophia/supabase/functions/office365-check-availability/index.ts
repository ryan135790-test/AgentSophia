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

    const { accessToken, startTime, endTime } = await req.json();

    if (!accessToken || !startTime || !endTime) {
      throw new Error('Missing required fields: accessToken, startTime, endTime');
    }

    // Microsoft Graph API endpoint for calendar view
    const startDate = new Date(startTime).toISOString();
    const endDate = new Date(endTime).toISOString();
    
    const graphEndpoint = `https://graph.microsoft.com/v1.0/me/calendarview?startDateTime=${startDate}&endDateTime=${endDate}`;

    const graphResponse = await fetch(graphEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!graphResponse.ok) {
      const errorData = await graphResponse.json();
      console.error('Graph API error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to check calendar availability');
    }

    const events = await graphResponse.json();

    // If there are any events in the time slot, it's not available
    const available = !events.value || events.value.length === 0;

    return new Response(
      JSON.stringify({ 
        success: true,
        available: available,
        eventsCount: events.value?.length || 0,
        events: events.value || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Office 365 check availability error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to check calendar availability'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
