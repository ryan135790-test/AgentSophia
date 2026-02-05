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
    const { code, redirectUri } = await req.json();

    if (!code) {
      throw new Error('Authorization code is required');
    }

    const clientId = Deno.env.get('OFFICE365_CLIENT_ID');
    const clientSecret = Deno.env.get('OFFICE365_CLIENT_SECRET');
    const tenantId = Deno.env.get('OFFICE365_TENANT_ID') || 'common';

    if (!clientId || !clientSecret) {
      throw new Error('Office 365 credentials not configured');
    }

    // Exchange authorization code for access token
    const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'User.Read Mail.Send Mail.Read Calendars.ReadWrite Contacts.ReadWrite offline_access',
    });

    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      console.error('Redirect URI:', redirectUri);
      console.error('Tenant ID:', tenantId);
      return new Response(
        JSON.stringify({ 
          error: errorData.error || 'token_exchange_failed',
          error_description: errorData.error_description || 'Failed to exchange authorization code',
          microsoft_error: errorData,
          debug: {
            redirectUri,
            tenantId,
            tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const tokenData = await tokenResponse.json();

    return new Response(
      JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        token_type: tokenData.token_type,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Office 365 token exchange error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to exchange Office 365 authorization code for access token'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
