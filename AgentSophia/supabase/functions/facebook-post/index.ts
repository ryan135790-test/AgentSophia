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
      pageId, // Facebook Page ID to post to
      content,
      imageUrl,
      link,
      campaignId
    } = await req.json();

    if (!accessToken || !pageId || !content) {
      throw new Error('Missing required fields: accessToken, pageId, content');
    }

    // Facebook Graph API - Create Page Post
    const facebookEndpoint = `https://graph.facebook.com/v18.0/${pageId}/feed`;

    const params = new URLSearchParams({
      message: content,
      access_token: accessToken,
      ...(imageUrl && { picture: imageUrl }),
      ...(link && { link: link }),
    });

    const facebookResponse = await fetch(facebookEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!facebookResponse.ok) {
      const errorData = await facebookResponse.json();
      console.error('Facebook API error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to post to Facebook');
    }

    const createdPost = await facebookResponse.json();

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'social_post',
        outcome: 'success',
        metadata: {
          platform: 'facebook',
          post_id: createdPost.id,
          page_id: pageId,
          content_preview: content.substring(0, 100),
          campaign_id: campaignId,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        platform: 'facebook',
        post: {
          id: createdPost.id,
          content: content,
        },
        message: 'Posted to Facebook successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Facebook post error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to post to Facebook'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
