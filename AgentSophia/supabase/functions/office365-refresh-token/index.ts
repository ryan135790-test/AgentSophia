import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { refreshToken } = await req.json();

    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    const clientId = Deno.env.get('OFFICE365_CLIENT_ID');
    const clientSecret = Deno.env.get('OFFICE365_CLIENT_SECRET');
    const tenantId = Deno.env.get('OFFICE365_TENANT_ID') || 'common';

    if (!clientId || !clientSecret) {
      throw new Error('Office 365 credentials not configured');
    }

    // Exchange refresh token for new access token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'User.Read Mail.Send Mail.Read Calendars.ReadWrite Contacts.ReadWrite offline_access',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token refresh error:', errorData);
      throw new Error(errorData.error_description || 'Failed to refresh token');
    }

    const tokenData = await tokenResponse.json();

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token, // Microsoft may issue a new refresh token
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Office 365 token refresh error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        error_description: 'Failed to refresh Office 365 access token',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
