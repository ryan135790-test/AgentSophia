import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

interface LinkedInProfile {
  sub: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email: string;
  email_verified?: boolean;
  locale?: string;
}

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

    const { code, state, redirectUri } = await req.json();

    if (!code) {
      throw new Error('Authorization code is required');
    }

    const clientId = Deno.env.get('LINKEDIN_CLIENT_ID');
    const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error('LinkedIn OAuth credentials not configured');
    }

    // Exchange authorization code for access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('LinkedIn token exchange failed:', errorText);
      throw new Error(`Failed to exchange code for token: ${errorText}`);
    }

    const tokenData: LinkedInTokenResponse = await tokenResponse.json();
    console.log('Token exchange successful, expires in:', tokenData.expires_in);

    // Get user profile using OpenID Connect userinfo endpoint
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('LinkedIn profile fetch failed:', errorText);
      throw new Error(`Failed to fetch profile: ${errorText}`);
    }

    const profile: LinkedInProfile = await profileResponse.json();
    console.log('Profile fetched for:', profile.email);

    // Calculate token expiration (LinkedIn tokens last 60 days)
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Check if connection already exists
    const { data: existingConnection } = await supabaseClient
      .from('social_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'linkedin')
      .single();

    let connection;

    if (existingConnection) {
      // Update existing connection
      const { data: updated, error: updateError } = await supabaseClient
        .from('social_connections')
        .update({
          access_token: tokenData.access_token,
          token_expires_at: expiresAt,
          account_name: profile.name,
          account_id: profile.sub,
          profile_data: {
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            sub: profile.sub,
            given_name: profile.given_name,
            family_name: profile.family_name,
          },
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingConnection.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update connection: ${updateError.message}`);
      }

      connection = updated;
      console.log('LinkedIn connection updated');
    } else {
      // Create new connection
      const { data: created, error: createError } = await supabaseClient
        .from('social_connections')
        .insert({
          user_id: user.id,
          platform: 'linkedin',
          account_name: profile.name,
          account_id: profile.sub,
          access_token: tokenData.access_token,
          token_expires_at: expiresAt,
          profile_data: {
            email: profile.email,
            name: profile.name,
            picture: profile.picture,
            sub: profile.sub,
            given_name: profile.given_name,
            family_name: profile.family_name,
          },
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create connection: ${createError.message}`);
      }

      connection = created;
      console.log('LinkedIn connection created');
    }

    // Log activity
    await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: user.id,
        activity_type: 'integration_connected',
        channel: 'linkedin',
        outcome: 'success',
        metadata: {
          account_name: profile.name,
          account_email: profile.email,
        },
      });

    // IMPORTANT: Never send access_token or other sensitive fields to client
    // Only return safe, non-sensitive metadata
    return new Response(
      JSON.stringify({
        success: true,
        connection: {
          id: connection.id,
          platform: connection.platform,
          account_name: connection.account_name,
          account_id: connection.account_id,
          is_active: connection.is_active,
          created_at: connection.created_at,
          updated_at: connection.updated_at,
        },
        profile: {
          name: profile.name,
          email: profile.email,
          picture: profile.picture,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('LinkedIn OAuth error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to complete LinkedIn OAuth flow'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});