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
      instagramAccountId, // Instagram Business Account ID
      caption,
      imageUrl, // Required for Instagram posts
      campaignId
    } = await req.json();

    if (!accessToken || !instagramAccountId || !imageUrl) {
      throw new Error('Missing required fields: accessToken, instagramAccountId, imageUrl');
    }

    // Instagram Graph API - Two-step process
    
    // Step 1: Create Media Container
    const createContainerEndpoint = `https://graph.facebook.com/v18.0/${instagramAccountId}/media`;
    
    const containerParams = new URLSearchParams({
      image_url: imageUrl,
      caption: caption || '',
      access_token: accessToken,
    });

    const containerResponse = await fetch(createContainerEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: containerParams.toString(),
    });

    if (!containerResponse.ok) {
      const errorData = await containerResponse.json();
      console.error('Instagram create container error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to create Instagram media container');
    }

    const containerData = await containerResponse.json();
    const creationId = containerData.id;

    // Step 2: Publish Media Container
    const publishEndpoint = `https://graph.facebook.com/v18.0/${instagramAccountId}/media_publish`;
    
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: accessToken,
    });

    const publishResponse = await fetch(publishEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams.toString(),
    });

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json();
      console.error('Instagram publish error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to publish Instagram post');
    }

    const publishData = await publishResponse.json();

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'social_post',
        outcome: 'success',
        metadata: {
          platform: 'instagram',
          post_id: publishData.id,
          instagram_account_id: instagramAccountId,
          caption_preview: caption?.substring(0, 100),
          campaign_id: campaignId,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        platform: 'instagram',
        post: {
          id: publishData.id,
          caption: caption,
        },
        message: 'Posted to Instagram successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Instagram post error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to post to Instagram'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
