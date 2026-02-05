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
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      throw new Error('No authorization header');
    }

    // Extract JWT token
    const jwt = authHeader.replace('Bearer ', '');
    
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Server configuration error');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Validate JWT and get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(jwt);
    
    if (userError) {
      console.error('Auth validation error:', userError);
      throw new Error('Authentication failed: ' + userError.message);
    }
    
    if (!user) {
      console.error('No user found in token');
      throw new Error('Invalid authentication token');
    }

    console.log('✅ Authenticated user:', user.id);

    // Read from request body
    const body = await req.json();
    const accessToken = body.accessToken;
    const maxResults = parseInt(body.maxResults || '10');
    const unreadOnly = body.unreadOnly === true;

    if (!accessToken) {
      throw new Error('Office 365 access token is required');
    }

    console.log('📧 Fetching emails from Microsoft Graph API...');

    // Build Microsoft Graph API endpoint
    let graphEndpoint = `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages?$top=${maxResults}&$orderby=receivedDateTime desc`;
    
    if (unreadOnly) {
      graphEndpoint += '&$filter=isRead eq false';
    }

    graphEndpoint += '&$select=id,subject,from,receivedDateTime,bodyPreview,isRead,hasAttachments';

    // Call Microsoft Graph API
    const graphResponse = await fetch(graphEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!graphResponse.ok) {
      const errorData = await graphResponse.json();
      console.error('❌ Microsoft Graph API error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to read inbox from Microsoft Graph');
    }

    const data = await graphResponse.json();
    const emails = data.value || [];

    console.log(`✅ Successfully retrieved ${emails.length} emails`);

    // Transform to our format
    const formattedEmails = emails.map((email: any) => ({
      id: email.id,
      subject: email.subject,
      from: {
        name: email.from?.emailAddress?.name || 'Unknown',
        email: email.from?.emailAddress?.address || '',
      },
      receivedAt: email.receivedDateTime,
      preview: email.bodyPreview,
      isRead: email.isRead,
      hasAttachments: email.hasAttachments,
    }));

    // Log activity (don't fail if this errors)
    try {
      await supabaseClient
        .from('agent_activities')
        .insert({
          user_id: user.id,
          activity_type: 'inbox_checked',
          outcome: 'success',
          metadata: {
            provider: 'office365',
            emails_retrieved: formattedEmails.length,
            unread_only: unreadOnly,
          },
        });
      console.log('✅ Activity logged');
    } catch (activityError) {
      console.error('⚠️ Failed to log activity (non-fatal):', activityError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        emails: formattedEmails,
        total: formattedEmails.length,
        provider: 'office365',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Office 365 read inbox error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        details: 'Failed to read inbox via Office 365'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
