import type { Express } from "express";
import { createClient } from '@supabase/supabase-js';
import { generateOAuthState, getGmailOAuthUrl, getLinkedInOAuthUrl, getCalendarOAuthUrl, sendEmail, sendSMS, createCalendarEvent, getCalendarAvailability } from "./lib/integrations";
import crypto from 'crypto';
import { encryptToken, decryptToken } from './lib/encryption';

// Supabase client for data operations
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// In-memory state store for OAuth (with expiry)
const oauthStateStore = new Map<string, { userId: string; expiresAt: number }>();

// Clean expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStateStore.entries()) {
    if (data.expiresAt < now) {
      oauthStateStore.delete(state);
    }
  }
}, 60000); // Clean every minute

export function registerIntegrationRoutes(app: Express) {
  // ============================================
  // OAUTH ROUTES
  // ============================================

  // Gmail OAuth initiate - starts authorization code flow
  app.get("/oauth/gmail/start", async (req, res) => {
    try {
      // Get user from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const token = authHeader.substring(7);
      const supabaseAuth = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
      
      if (error || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Generate secure state with user binding
      const state = crypto.randomBytes(32).toString('hex');
      oauthStateStore.set(state, {
        userId: user.id,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
      });

      const clientId = process.env.GMAIL_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      const redirectUri = `${req.protocol}://${req.get('host')}/oauth/gmail/callback`;
      
      const scopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ].join(' ');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`;

      res.redirect(authUrl);
    } catch (error) {
      console.error('Gmail OAuth start error:', error);
      res.status(500).json({ error: 'Failed to start OAuth' });
    }
  });

  // Legacy Gmail OAuth initiate (kept for compatibility)
  app.get("/oauth/gmail", (req, res) => {
    const state = generateOAuthState();
    (req as any).session = (req as any).session || {};
    (req as any).session.oauthState = state;
    const url = getGmailOAuthUrl(state);
    res.redirect(url);
  });

  // Gmail OAuth callback - exchanges code for tokens and saves to database
  app.get("/oauth/gmail/callback", async (req, res) => {
    try {
      const { code, state, error: oauthError } = req.query;

      // Check for OAuth errors
      if (oauthError) {
        return res.send(getOAuthResultPage(false, null, oauthError as string));
      }

      // Validate state
      const stateData = oauthStateStore.get(state as string);
      if (!stateData) {
        // Try legacy session-based state
        const sessionState = ((req as any).session as any)?.oauthState;
        if (state !== sessionState) {
          return res.send(getOAuthResultPage(false, null, 'Invalid or expired state'));
        }
      }

      // Get user ID from state
      const userId = stateData?.userId;
      if (stateData) {
        oauthStateStore.delete(state as string); // One-time use
      }

      const clientId = process.env.GMAIL_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      const redirectUri = `${req.protocol}://${req.get('host')}/oauth/gmail/callback`;

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: code as string,
          client_id: clientId || '',
          client_secret: clientSecret || '',
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        console.error('Token exchange error:', tokens);
        return res.send(getOAuthResultPage(false, null, tokens.error_description || tokens.error));
      }

      // Get user email from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      const userInfo = await userInfoResponse.json();
      const userEmail = userInfo.email;

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      // Save to database if we have userId
      if (userId) {
        // Check if connection exists
        const { data: existing } = await supabase
          .from('connected_accounts')
          .select('id')
          .eq('user_id', userId)
          .eq('provider', 'gmail')
          .single();

        if (existing) {
          // Update existing connection (with encryption)
          await supabase
            .from('connected_accounts')
            .update({
              access_token: encryptToken(tokens.access_token),
              refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
              token_expires_at: expiresAt.toISOString(),
              email: userEmail,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          // Insert new connection (with encryption)
          await supabase
            .from('connected_accounts')
            .insert({
              user_id: userId,
              provider: 'gmail',
              access_token: encryptToken(tokens.access_token),
              refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
              token_expires_at: expiresAt.toISOString(),
              email: userEmail,
              is_active: true,
            });
        }
      }

      // Return success page that posts message to parent window
      return res.send(getOAuthResultPage(true, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt.toISOString(),
        email: userEmail,
      }));
    } catch (error) {
      console.error("Gmail OAuth error:", error);
      return res.send(getOAuthResultPage(false, null, 'OAuth failed'));
    }
  });

// Helper function to generate OAuth result page with postMessage
function getOAuthResultPage(success: boolean, data: any, error?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>${success ? 'Connected!' : 'Connection Failed'}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .success { color: #10b981; }
    .error { color: #ef4444; }
    h1 { margin: 0 0 10px; }
    p { color: #666; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    ${success ? `
      <h1 class="success">✓ Gmail Connected!</h1>
      <p>You can close this window.</p>
    ` : `
      <h1 class="error">✗ Connection Failed</h1>
      <p>${error || 'An error occurred'}</p>
    `}
  </div>
  <script>
    (function() {
      const message = ${success ? `{
        type: 'gmail_oauth_success',
        data: ${JSON.stringify(data)}
      }` : `{
        type: 'gmail_oauth_error',
        error: ${JSON.stringify(error || 'Connection failed')}
      }`};
      
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
        setTimeout(() => window.close(), 2000);
      }
    })();
  </script>
</body>
</html>
  `;
}

  // Gmail OAuth code exchange endpoint (called by frontend callback page)
  app.post("/api/oauth/gmail/exchange", async (req, res) => {
    try {
      const { code, state, redirectUri: clientRedirectUri } = req.body;

      if (!code) {
        return res.status(400).json({ success: false, error: 'Missing authorization code' });
      }

      // Get user from state parameter (encoded during OAuth initiation) - PRIMARY SOURCE
      let userId: string | null = null;
      if (state) {
        try {
          const statePayload = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
          console.log('Gmail exchange - State decoded, userId:', statePayload.userId);
          
          // Validate timestamp (state should be recent, within 10 minutes)
          const stateAge = Date.now() - (statePayload.timestamp || 0);
          if (stateAge < 10 * 60 * 1000) { // 10 minutes
            userId = statePayload.userId || null;
          } else {
            console.log('Gmail exchange - State expired, age:', stateAge);
          }
        } catch (e) {
          console.log('Gmail exchange - Could not decode state:', e);
        }
      }
      
      // Fallback: Get user from Authorization header (if state decoding fails)
      if (!userId) {
        const authHeader = req.headers.authorization;
        console.log('Gmail exchange - Auth header present:', !!authHeader);
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const supabaseAuth = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
          const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
          console.log('Gmail exchange - User lookup result:', user?.id, 'Error:', error?.message);
          userId = user?.id || null;
        }
      }
      
      console.log('Gmail exchange - Final userId:', userId);

      const clientId = process.env.GMAIL_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      
      // Use the redirect URI from the client (must match what was sent to Google)
      const redirectUri = clientRedirectUri || `https://${process.env.REPLIT_DEV_DOMAIN || req.get('host')}/oauth/gmail/callback`;
      
      console.log('Gmail token exchange - redirect_uri:', redirectUri);
      console.log('Gmail token exchange - clientRedirectUri:', clientRedirectUri);

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId || '',
          client_secret: clientSecret || '',
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        console.error('Token exchange error:', tokens);
        return res.status(400).json({ 
          success: false, 
          error: tokens.error_description || tokens.error 
        });
      }

      // Get user email from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      const userInfo = await userInfoResponse.json();
      const userEmail = userInfo.email;

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

      // Save to database if we have userId
      console.log('Gmail exchange - Saving to database, userId:', userId);
      if (userId) {
        // Check if connection exists
        const { data: existing, error: existingError } = await supabase
          .from('connected_accounts')
          .select('id')
          .eq('user_id', userId)
          .eq('provider', 'gmail')
          .single();
        
        console.log('Gmail exchange - Existing check:', existing?.id, 'Error:', existingError?.message);

        if (existing) {
          // Update existing connection (with encryption)
          const { error: updateError } = await supabase
            .from('connected_accounts')
            .update({
              access_token: encryptToken(tokens.access_token),
              refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
              token_expires_at: expiresAt.toISOString(),
              email: userEmail,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
          console.log('Gmail exchange - Update result, error:', updateError?.message);
        } else {
          // Insert new connection (with encryption)
          const { error: insertError } = await supabase
            .from('connected_accounts')
            .insert({
              user_id: userId,
              provider: 'gmail',
              access_token: encryptToken(tokens.access_token),
              refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
              token_expires_at: expiresAt.toISOString(),
              email: userEmail,
              is_active: true,
            });
          console.log('Gmail exchange - Insert result, error:', insertError?.message);
        }
      } else {
        console.log('Gmail exchange - No userId, tokens not saved to database');
      }

      return res.json({
        success: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt.toISOString(),
        email: userEmail,
      });
    } catch (error: any) {
      console.error("Gmail OAuth exchange error:", error);
      return res.status(500).json({ success: false, error: error.message || 'OAuth exchange failed' });
    }
  });

  // LinkedIn OAuth initiate (backend-initiated flow - uses /api prefix)
  app.get("/api/oauth/linkedin", (req, res) => {
    const state = generateOAuthState();
    (req as any).session = (req as any).session || {};
    (req as any).session.oauthState = state;
    const url = getLinkedInOAuthUrl(state);
    res.redirect(url);
  });

  // LinkedIn OAuth callback (backend token exchange - uses /api prefix)
  // Note: Frontend OAuth uses /oauth/linkedin/callback handled by React Router
  app.get("/api/oauth/linkedin/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const sessionState = ((req as any).session as any)?.oauthState;

      if (state !== sessionState) {
        return res.status(400).json({ error: "State mismatch" });
      }

      // Exchange code for token
      const tokenResponse = await fetch(
        "https://www.linkedin.com/oauth/v2/accessToken",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code as string,
            redirect_uri: `${process.env.APP_URL || "http://localhost:3001"}/api/oauth/linkedin/callback`,
            client_id: process.env.LINKEDIN_CLIENT_ID || "",
            client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
          }).toString(),
        }
      );

      const tokens = await tokenResponse.json();

      res.json({
        success: true,
        accessToken: tokens.access_token,
      });
    } catch (error) {
      console.error("LinkedIn OAuth error:", error);
      res.status(500).json({ error: "OAuth failed" });
    }
  });

  // LinkedIn OAuth token exchange (for frontend-initiated flow)
  app.post("/api/oauth/linkedin/exchange", async (req, res) => {
    try {
      const { code, redirectUri, userId, workspaceId } = req.body;

      if (!code || !redirectUri) {
        return res.status(400).json({ error: "Missing code or redirectUri" });
      }
      
      if (!workspaceId) {
        return res.status(400).json({ error: "Missing workspaceId - LinkedIn connections are workspace-specific" });
      }

      console.log('[LinkedIn OAuth] Exchanging code for token...');

      // Exchange code for token
      const tokenResponse = await fetch(
        "https://www.linkedin.com/oauth/v2/accessToken",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: code,
            redirect_uri: redirectUri,
            client_id: process.env.LINKEDIN_CLIENT_ID || "",
            client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
          }).toString(),
        }
      );

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        console.error('[LinkedIn OAuth] Token error:', tokens.error, tokens.error_description);
        return res.status(400).json({ 
          error: tokens.error_description || tokens.error 
        });
      }

      console.log('[LinkedIn OAuth] Token obtained, fetching profile...');

      // Fetch user profile using userinfo endpoint (OpenID Connect)
      const profileResponse = await fetch(
        "https://api.linkedin.com/v2/userinfo",
        {
          headers: {
            "Authorization": `Bearer ${tokens.access_token}`,
          },
        }
      );

      const profile = await profileResponse.json();

      if (profile.error) {
        console.error('[LinkedIn OAuth] Profile error:', profile.error);
        return res.status(400).json({ error: 'Failed to fetch LinkedIn profile' });
      }

      console.log('[LinkedIn OAuth] Profile fetched:', profile.name);

      // Calculate token expiry
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (tokens.expires_in || 5184000));

      // Save connection to Supabase if userId provided
      console.log('[LinkedIn OAuth] Attempting to save connection for userId:', userId);
      
      if (userId && workspaceId) {
        // Match schema: account_id, profile_data (JSON) instead of separate email/profile_picture
        // Now includes workspace_id for workspace-specific LinkedIn connections
        const connectionData = {
          user_id: userId,
          workspace_id: workspaceId,
          platform: 'linkedin',
          account_id: profile.sub,
          account_name: profile.name,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || null,
          token_expires_at: expiresAt.toISOString(),
          profile_data: {
            email: profile.email,
            picture: profile.picture,
            sub: profile.sub,
          },
          is_active: true,
        };

        console.log('[LinkedIn OAuth] Connection data prepared:', { 
          user_id: userId,
          workspace_id: workspaceId,
          platform: 'linkedin',
          account_id: profile.sub,
          account_name: profile.name 
        });

        // Check if THIS SPECIFIC account is already connected in THIS WORKSPACE
        const { data: existing, error: fetchError } = await supabase
          .from('social_connections')
          .select('id')
          .eq('user_id', userId)
          .eq('workspace_id', workspaceId)
          .eq('platform', 'linkedin')
          .eq('account_id', profile.sub)
          .maybeSingle();

        if (fetchError) {
          console.error('[LinkedIn OAuth] Fetch existing error:', fetchError.message, fetchError.code, fetchError.details);
        } else {
          console.log('[LinkedIn OAuth] Existing connection check:', existing ? `Found ID ${existing.id}` : 'No existing connection for this account');
        }

        let saveError: any = null;
        if (existing?.id) {
          // Update existing connection for this specific account
          console.log('[LinkedIn OAuth] Updating existing connection:', existing.id);
          const { error } = await supabase
            .from('social_connections')
            .update({
              account_name: profile.name,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || null,
              token_expires_at: expiresAt.toISOString(),
              profile_data: {
                email: profile.email,
                picture: profile.picture,
                sub: profile.sub,
              },
              is_active: true,
            })
            .eq('id', existing.id);
          saveError = error;
          if (!error) console.log('[LinkedIn OAuth] Connection updated successfully for user:', userId);
        } else {
          // Insert new connection (allows multiple LinkedIn accounts per user)
          console.log('[LinkedIn OAuth] Inserting new LinkedIn connection for account:', profile.name);
          const { error } = await supabase
            .from('social_connections')
            .insert(connectionData);
          saveError = error;
          if (!error) console.log('[LinkedIn OAuth] New connection created for user:', userId, 'account:', profile.name);
        }

        if (saveError) {
          console.error('[LinkedIn OAuth] Save error:', saveError.message, saveError.code, saveError.details);
        }
      } else {
        console.warn('[LinkedIn OAuth] No userId provided, skipping save');
      }

      res.json({
        success: true,
        profile: {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          picture: profile.picture,
        },
        connection: {
          platform: 'linkedin',
          accountName: profile.name,
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (error: any) {
      console.error("LinkedIn OAuth exchange error:", error);
      res.status(500).json({ error: error.message || "OAuth exchange failed" });
    }
  });

  // ============================================
  // LINKEDIN POSTING API
  // ============================================

  // POST /api/social/linkedin/post - Post to LinkedIn
  app.post("/api/social/linkedin/post", async (req, res) => {
    try {
      // Authenticate user from JWT token
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const token = authHeader.substring(7);
      const supabaseAuth = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { content, workspaceId, connectionId } = req.body;
      const authenticatedUserId = user.id;

      if (!content) {
        return res.status(400).json({ error: "Missing content" });
      }

      console.log('[LinkedIn Post] Starting post for user:', authenticatedUserId, 'workspaceId:', workspaceId, 'connectionId:', connectionId);

      // Require workspaceId for LinkedIn posts (workspace-specific connections)
      if (!workspaceId) {
        return res.status(400).json({ error: "Missing workspaceId - LinkedIn connections are workspace-specific" });
      }

      // Get the user's LinkedIn connection - specific one if provided, or first active one in workspace
      let connection: any = null;
      let connError: any = null;

      if (connectionId) {
        // Fetch specific connection by ID (must belong to user AND workspace)
        const { data, error } = await supabase
          .from('social_connections')
          .select('*')
          .eq('id', connectionId)
          .eq('user_id', authenticatedUserId)
          .eq('workspace_id', workspaceId)
          .eq('platform', 'linkedin')
          .eq('is_active', true)
          .maybeSingle();
        
        connection = data;
        connError = error;

        if (!connection) {
          console.error('[LinkedIn Post] Specified connection not found:', connectionId);
          return res.status(404).json({ 
            error: 'Selected LinkedIn account not found',
            details: 'The selected account may have been disconnected. Please refresh and try again.'
          });
        }
      } else {
        // Fetch first active LinkedIn connection in this workspace
        const { data, error } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', authenticatedUserId)
          .eq('workspace_id', workspaceId)
          .eq('platform', 'linkedin')
          .eq('is_active', true)
          .limit(1);
        
        connection = data?.[0];
        connError = error;
      }

      if (connError || !connection) {
        console.error('[LinkedIn Post] Connection not found:', connError?.message);
        return res.status(400).json({ 
          error: 'LinkedIn account not connected',
          details: 'Please connect your LinkedIn account in Social Media > Connections first.'
        });
      }

      // Check if token is expired
      if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
        return res.status(401).json({ 
          error: 'LinkedIn token expired',
          details: 'Please reconnect your LinkedIn account.'
        });
      }

      console.log('[LinkedIn Post] Using connection for:', connection.account_name);

      // Get the user's LinkedIn URN (person ID)
      const personUrn = `urn:li:person:${connection.account_id}`;

      // Create the post using LinkedIn's Posts API (new v2 API)
      const postBody = {
        author: personUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: content
            },
            shareMediaCategory: "NONE"
          }
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
      };

      console.log('[LinkedIn Post] Posting to LinkedIn API...');

      const postResponse = await fetch(
        "https://api.linkedin.com/v2/ugcPosts",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${connection.access_token}`,
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0"
          },
          body: JSON.stringify(postBody)
        }
      );

      const responseText = await postResponse.text();
      console.log('[LinkedIn Post] Response status:', postResponse.status);
      console.log('[LinkedIn Post] Response:', responseText);

      if (!postResponse.ok) {
        let errorDetails = responseText;
        try {
          const errorJson = JSON.parse(responseText);
          errorDetails = errorJson.message || errorJson.error || responseText;
        } catch (e) {}
        
        console.error('[LinkedIn Post] Post failed:', errorDetails);
        return res.status(postResponse.status).json({ 
          error: 'Failed to post to LinkedIn',
          details: errorDetails
        });
      }

      let postData;
      try {
        postData = JSON.parse(responseText);
      } catch (e) {
        postData = { id: 'unknown' };
      }

      console.log('[LinkedIn Post] Post successful, ID:', postData.id);

      // Save post record to database
      const { error: saveError } = await supabase
        .from('social_posts')
        .insert({
          user_id: authenticatedUserId,
          workspace_id: workspaceId || null,
          platform: 'linkedin',
          content: content,
          linkedin_post_id: postData.id,
          status: 'published',
          published_at: new Date().toISOString()
        });

      if (saveError) {
        console.error('[LinkedIn Post] Save error (non-fatal):', saveError.message);
      }

      res.json({
        success: true,
        postId: postData.id,
        message: 'Successfully posted to LinkedIn'
      });
    } catch (error: any) {
      console.error('[LinkedIn Post] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to post to LinkedIn' });
    }
  });

  // GET /api/social/posts - Get user's social posts
  app.get("/api/social/posts", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      const workspaceId = req.query.workspaceId as string;

      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }

      let query = supabase
        .from('social_posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { data: posts, error } = await query;

      if (error) throw error;

      res.json({ posts: posts || [] });
    } catch (error: any) {
      console.error('[Social Posts] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch posts' });
    }
  });

  // POST /api/social/posts/schedule - Schedule a post for later
  app.post("/api/social/posts/schedule", async (req, res) => {
    try {
      const { content, userId, workspaceId, platform, scheduledFor } = req.body;

      if (!content || !userId || !platform || !scheduledFor) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { data: post, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: userId,
          workspace_id: workspaceId || null,
          platform: platform,
          content: content,
          status: 'scheduled',
          scheduled_for: scheduledFor
        })
        .select()
        .single();

      if (error) throw error;

      res.json({ success: true, post });
    } catch (error: any) {
      console.error('[Social Posts] Schedule error:', error);
      res.status(500).json({ error: error.message || 'Failed to schedule post' });
    }
  });

  // Calendar OAuth initiate
  app.get("/oauth/calendar", (req, res) => {
    const state = generateOAuthState();
    (req as any).session = (req as any).session || {};
    (req as any).session.oauthState = state;
    const url = getCalendarOAuthUrl(state);
    res.redirect(url);
  });

  // Calendar OAuth callback
  app.get("/oauth/calendar/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const sessionState = ((req as any).session as any)?.oauthState;

      if (state !== sessionState) {
        return res.status(400).json({ error: "State mismatch" });
      }

      // Exchange code for token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: process.env.CALENDAR_CLIENT_ID,
          client_secret: process.env.CALENDAR_CLIENT_SECRET,
          redirect_uri: `${process.env.APP_URL || "http://localhost:3001"}/oauth/calendar/callback`,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenResponse.json();

      res.json({
        success: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
    } catch (error) {
      console.error("Calendar OAuth error:", error);
      res.status(500).json({ error: "OAuth failed" });
    }
  });

  // ============================================
  // EMAIL ROUTES
  // ============================================

  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html, text } = req.body;

      if (!to || !subject) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await sendEmail({ to, subject, html, text });

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Email error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // ============================================
  // SMS ROUTES
  // ============================================

  app.post("/api/send-sms", async (req, res) => {
    try {
      const { to, message } = req.body;

      if (!to || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await sendSMS({ to, message });

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("SMS error:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  // ============================================
  // CALENDAR ROUTES
  // ============================================

  app.post("/api/calendar/create-event", async (req, res) => {
    try {
      const { title, description, startTime, endTime, attendees, accessToken } = req.body;

      if (!title || !startTime || !endTime || !attendees || !accessToken) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await createCalendarEvent(
        {
          title,
          description,
          startTime,
          endTime,
          attendees,
        },
        accessToken
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Calendar create error:", error);
      res.status(500).json({ error: "Failed to create calendar event" });
    }
  });

  app.get("/api/calendar/availability", async (req, res) => {
    try {
      const { startTime, endTime, accessToken } = req.query;

      if (!startTime || !endTime || !accessToken) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await getCalendarAvailability(
        accessToken as string,
        startTime as string,
        endTime as string
      );

      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      console.error("Calendar availability error:", error);
      res.status(500).json({ error: "Failed to get calendar availability" });
    }
  });

  // ============================================
  // MIGRATION: Assign existing connections to workspace
  // ============================================
  
  // Migrate existing social connections without workspace_id to a specific workspace
  app.post("/api/social-connections/migrate-to-workspace", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const token = authHeader.substring(7);
      const supabaseAuth = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { workspaceId } = req.body;
      if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
      }

      console.log(`[Migration] Migrating social connections for user ${user.id} to workspace ${workspaceId}`);

      // Find connections without workspace_id for this user
      const { data: unmigrated, error: fetchError } = await supabase
        .from('social_connections')
        .select('id, platform, account_name')
        .eq('user_id', user.id)
        .is('workspace_id', null);

      if (fetchError) {
        console.error('[Migration] Error fetching unmigrated connections:', fetchError);
        return res.status(500).json({ error: 'Failed to fetch connections' });
      }

      if (!unmigrated || unmigrated.length === 0) {
        console.log('[Migration] No connections to migrate');
        return res.json({ message: 'No connections to migrate', migrated: 0 });
      }

      console.log(`[Migration] Found ${unmigrated.length} connections to migrate:`, unmigrated);

      // Update all unmigrated connections to the specified workspace
      const { error: updateError, count } = await supabase
        .from('social_connections')
        .update({ workspace_id: workspaceId })
        .eq('user_id', user.id)
        .is('workspace_id', null);

      if (updateError) {
        console.error('[Migration] Error updating connections:', updateError);
        return res.status(500).json({ error: 'Failed to migrate connections' });
      }

      console.log(`[Migration] Successfully migrated ${count || unmigrated.length} connections`);
      res.json({ 
        message: 'Connections migrated successfully', 
        migrated: count || unmigrated.length,
        connections: unmigrated 
      });
    } catch (error) {
      console.error('[Migration] Error:', error);
      res.status(500).json({ error: 'Migration failed' });
    }
  });

  // Check for unmigrated connections
  app.get("/api/social-connections/check-migration", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const token = authHeader.substring(7);
      const supabaseAuth = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || '');
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Find connections without workspace_id for this user
      const { data: unmigrated, error: fetchError } = await supabase
        .from('social_connections')
        .select('id, platform, account_name, created_at')
        .eq('user_id', user.id)
        .is('workspace_id', null);

      if (fetchError) {
        // If the column doesn't exist, return a message indicating migration is needed
        if (fetchError.message?.includes('workspace_id')) {
          return res.json({ 
            needsMigration: true, 
            reason: 'Database schema needs to be updated',
            unmigrated: [] 
          });
        }
        console.error('[Migration Check] Error:', fetchError);
        return res.status(500).json({ error: 'Failed to check migration status' });
      }

      res.json({ 
        needsMigration: (unmigrated?.length || 0) > 0,
        unmigrated: unmigrated || [] 
      });
    } catch (error) {
      console.error('[Migration Check] Error:', error);
      res.status(500).json({ error: 'Check failed' });
    }
  });
}
