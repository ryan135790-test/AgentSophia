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

    const { accessToken } = await req.json();

    if (!accessToken) {
      throw new Error('Missing required field: accessToken');
    }

    // IMPORTANT: LinkedIn Messaging API requires LinkedIn Partner Program access
    // Standard OAuth apps cannot access conversations via API
    
    const partnerApiEnabled = Deno.env.get('LINKEDIN_PARTNER_API_ENABLED') === 'true';
    
    if (!partnerApiEnabled) {
      // Return empty result with note
      return new Response(
        JSON.stringify({ 
          success: true,
          messages: [],
          count: 0,
          note: 'LinkedIn Partner API access required to check messages automatically. Please check LinkedIn manually.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Partner API implementation
    const conversationsEndpoint = 'https://api.linkedin.com/v2/conversations?q=unread';

    const linkedInResponse = await fetch(conversationsEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });

    if (!linkedInResponse.ok) {
      const errorText = await linkedInResponse.text();
      console.error('LinkedIn API error:', errorText);
      throw new Error(`LinkedIn Partner API error: ${errorText}. Ensure you have Partner Program access.`);
    }

    const result = await linkedInResponse.json();

    // Parse and format messages
    const messages = (result.elements || []).map((conversation: any) => ({
      id: conversation.id,
      from: {
        id: conversation.participants?.[0]?.id,
        name: conversation.participants?.[0]?.displayName,
      },
      text: conversation.lastMessage?.text || '',
      createdAt: conversation.lastActivityAt,
      conversationId: conversation.id,
    }));

    return new Response(
      JSON.stringify({ 
        success: true,
        messages: messages,
        count: messages.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('LinkedIn check messages error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to check LinkedIn messages'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
