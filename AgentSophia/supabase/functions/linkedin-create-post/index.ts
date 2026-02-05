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

    const { accessToken, content, visibility = 'PUBLIC' } = await req.json();

    if (!accessToken || !content) {
      throw new Error('Missing required fields: accessToken, content');
    }

    // Get user's LinkedIn profile ID
    const profileResponse = await fetch('https://api.linkedin.com/v2/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error('Failed to get LinkedIn profile');
    }

    const profile = await profileResponse.json();
    const profileId = profile.id;

    // LinkedIn UGC (User Generated Content) API endpoint
    const ugcEndpoint = 'https://api.linkedin.com/v2/ugcPosts';

    const postPayload = {
      author: `urn:li:person:${profileId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': visibility,
      },
    };

    const linkedInResponse = await fetch(ugcEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(postPayload),
    });

    if (!linkedInResponse.ok) {
      const errorText = await linkedInResponse.text();
      console.error('LinkedIn API error:', errorText);
      throw new Error(`Failed to create post: ${errorText}`);
    }

    const result = await linkedInResponse.json();

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'social_post',
        channel: 'linkedin',
        outcome: 'success',
        metadata: {
          action: 'create_post',
          content: content,
          post_id: result.id,
          visibility: visibility,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        id: result.id || `post-${Date.now()}`,
        message: 'LinkedIn post created successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('LinkedIn create post error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to create LinkedIn post'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
