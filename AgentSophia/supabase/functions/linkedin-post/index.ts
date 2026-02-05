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
      imageUrl,
      personUrn, // LinkedIn user URN (e.g., urn:li:person:ABC123)
      visibility = 'PUBLIC', // PUBLIC, CONNECTIONS, or LOGGED_IN
      campaignId
    } = await req.json();

    if (!accessToken || !content) {
      throw new Error('Missing required fields: accessToken, content');
    }

    // LinkedIn API v2 - Create UGC Post
    const linkedInEndpoint = 'https://api.linkedin.com/v2/ugcPosts';

    const post = {
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: content,
          },
          shareMediaCategory: imageUrl ? 'IMAGE' : 'NONE',
          ...(imageUrl && {
            media: [{
              status: 'READY',
              media: imageUrl,
            }],
          }),
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': visibility,
      },
    };

    const linkedInResponse = await fetch(linkedInEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(post),
    });

    if (!linkedInResponse.ok) {
      const errorData = await linkedInResponse.json();
      console.error('LinkedIn API error:', errorData);
      throw new Error(errorData.message || 'Failed to post to LinkedIn');
    }

    const createdPost = await linkedInResponse.json();

    // Log activity
    const { error: activityError } = await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'social_post',
        outcome: 'success',
        metadata: {
          platform: 'linkedin',
          post_id: createdPost.id,
          content_preview: content.substring(0, 100),
          campaign_id: campaignId,
          visibility: visibility,
        },
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        platform: 'linkedin',
        post: {
          id: createdPost.id,
          content: content,
        },
        message: 'Posted to LinkedIn successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('LinkedIn post error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to post to LinkedIn'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
