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
      content,
      mediaIds, // Array of uploaded media IDs (optional)
      campaignId
    } = await req.json();

    if (!accessToken || !content) {
      throw new Error('Missing required fields: accessToken, content');
    }

    if (content.length > 280) {
      throw new Error('Tweet content exceeds 280 characters');
    }

    // Twitter API v2 - Create Tweet
    const twitterEndpoint = 'https://api.twitter.com/2/tweets';

    const tweet = {
      text: content,
      ...(mediaIds && mediaIds.length > 0 && {
        media: {
          media_ids: mediaIds,
        },
      }),
    };

    const twitterResponse = await fetch(twitterEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweet),
    });

    if (!twitterResponse.ok) {
      const errorData = await twitterResponse.json();
      console.error('Twitter API error:', errorData);
      throw new Error(errorData.detail || 'Failed to post to Twitter');
    }

    const createdTweet = await twitterResponse.json();

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'social_post',
        outcome: 'success',
        metadata: {
          platform: 'twitter',
          tweet_id: createdTweet.data.id,
          content: content,
          campaign_id: campaignId,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        platform: 'twitter',
        tweet: {
          id: createdTweet.data.id,
          text: createdTweet.data.text,
        },
        message: 'Posted to Twitter successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Twitter post error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to post to Twitter'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
