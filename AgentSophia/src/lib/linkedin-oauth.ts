import { supabase } from "@/integrations/supabase/client";

/**
 * LinkedIn OAuth Configuration
 * 
 * Required LinkedIn App Setup:
 * 1. Go to https://www.linkedin.com/developers/
 * 2. Create an app and associate it with a LinkedIn Page
 * 3. Add redirect URI: YOUR_DOMAIN/oauth/linkedin/callback
 * 4. Request access to "Sign In with LinkedIn using OpenID Connect"
 * 5. Add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to Supabase Edge Function secrets
 */

// LinkedIn OAuth scopes
const SCOPES = [
  'openid',           // OpenID Connect (required for userinfo)
  'email',            // User's email address
  'profile',          // Basic profile info
  'w_member_social',  // Post on behalf of user
];

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Initiate LinkedIn OAuth flow
 * Redirects user to LinkedIn authorization page
 * @param workspaceId - The workspace ID to associate this LinkedIn connection with
 */
export function initiateLinkedInOAuth(workspaceId?: string) {
  // Get LinkedIn Client ID from environment
  const clientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID;
  
  if (!clientId) {
    throw new Error('LinkedIn Client ID not configured. Please add VITE_LINKEDIN_CLIENT_ID to environment variables.');
  }

  if (!workspaceId) {
    throw new Error('Workspace ID is required - LinkedIn connections are workspace-specific');
  }

  // Generate and store state for CSRF protection
  const state = generateState();
  sessionStorage.setItem('linkedin_oauth_state', state);
  sessionStorage.setItem('linkedin_oauth_workspace_id', workspaceId);

  // Build redirect URI - must match LinkedIn app config AND route in App.tsx
  // LinkedIn app is configured with /oauth/callback/linkedin
  const redirectUri = `${window.location.origin}/oauth/callback/linkedin`;
  sessionStorage.setItem('linkedin_redirect_uri', redirectUri);
  
  // Also store in localStorage as backup (sessionStorage can be cleared on redirect)
  localStorage.setItem('linkedin_oauth_state', state);
  localStorage.setItem('linkedin_redirect_uri', redirectUri);
  localStorage.setItem('linkedin_oauth_workspace_id', workspaceId);

  // Build authorization URL
  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('scope', SCOPES.join(' '));

  console.log('Redirecting to LinkedIn OAuth:', authUrl.toString());

  // Redirect to LinkedIn
  window.location.href = authUrl.toString();
}

/**
 * Handle OAuth callback from LinkedIn
 * Exchanges authorization code for access token
 */
export async function handleLinkedInCallback(urlParams: URLSearchParams): Promise<{
  success: boolean;
  error?: string;
  connection?: any;
  profile?: any;
}> {
  try {
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // Check for OAuth errors
    if (error) {
      console.error('LinkedIn OAuth error:', error, errorDescription);
      return {
        success: false,
        error: errorDescription || error,
      };
    }

    // Verify we have a code
    if (!code) {
      return {
        success: false,
        error: 'No authorization code received from LinkedIn',
      };
    }

    // Verify state parameter (CSRF protection)
    // Support two OAuth flows:
    // 1. Client-side flow: state is random hex stored in localStorage/sessionStorage
    // 2. Server-side flow: state is base64-encoded JSON with workspace_id, user_id, nonce
    
    let storedState = sessionStorage.getItem('linkedin_oauth_state');
    if (!storedState) {
      storedState = localStorage.getItem('linkedin_oauth_state');
      if (storedState) {
        console.log('Using localStorage for OAuth state (sessionStorage was cleared)');
      }
    }
    
    let isServerSideFlow = false;
    let serverStateData: { workspace_id?: string; user_id?: string; nonce?: string; redirect_uri?: string } = {};
    
    // If no client-side state, check if this is a server-side flow (base64 encoded JSON)
    if (!storedState && state) {
      try {
        // Try to decode as base64 JSON (server-side flow)
        const decoded = atob(state);
        serverStateData = JSON.parse(decoded);
        if (serverStateData.workspace_id && serverStateData.user_id) {
          console.log('Detected server-side OAuth flow with workspaceId:', serverStateData.workspace_id);
          isServerSideFlow = true;
        }
      } catch (e) {
        // Not a valid base64 JSON, must be client-side flow that lost state
        console.log('State is not server-side format, treating as client-side flow');
      }
    }
    
    // Validate state based on flow type
    if (!isServerSideFlow) {
      if (!storedState) {
        console.error('No stored OAuth state found in sessionStorage or localStorage');
        return {
          success: false,
          error: 'OAuth session expired or not initiated. Please try connecting again.',
        };
      }
      
      if (!state || state !== storedState) {
        console.error('State mismatch:', { received: state, stored: storedState });
        return {
          success: false,
          error: 'Invalid state parameter - possible CSRF attack',
        };
      }
    }

    // Get redirect URI - for server-side flow, use the one from state
    // For client-side flow, use stored value
    let redirectUri: string | null = null;
    
    if (isServerSideFlow && serverStateData.redirect_uri) {
      // Server-side flow: use redirect URI from encoded state (critical for token exchange)
      redirectUri = serverStateData.redirect_uri;
      console.log('Using redirect URI from server-side state:', redirectUri);
    } else {
      // Client-side flow: try sessionStorage first, then localStorage
      redirectUri = sessionStorage.getItem('linkedin_redirect_uri');
      if (!redirectUri) {
        redirectUri = localStorage.getItem('linkedin_redirect_uri');
        if (redirectUri) {
          console.log('Using localStorage for redirect URI');
        }
      }
      if (!redirectUri) {
        console.log('No stored redirect URI, using default');
      }
    }

    // Get workspace ID - for server-side flow, use from state; for client-side, use stored value
    let workspaceId: string | null = null;
    if (isServerSideFlow && serverStateData.workspace_id) {
      workspaceId = serverStateData.workspace_id;
    } else {
      workspaceId = sessionStorage.getItem('linkedin_oauth_workspace_id');
      if (!workspaceId) {
        workspaceId = localStorage.getItem('linkedin_oauth_workspace_id');
      }
    }

    // Clean up both storages
    sessionStorage.removeItem('linkedin_oauth_state');
    sessionStorage.removeItem('linkedin_redirect_uri');
    sessionStorage.removeItem('linkedin_oauth_workspace_id');
    localStorage.removeItem('linkedin_oauth_state');
    localStorage.removeItem('linkedin_redirect_uri');
    localStorage.removeItem('linkedin_oauth_workspace_id');
    
    // Use stored or construct default redirect URI (matching LinkedIn app config)
    const finalRedirectUri = redirectUri || `${window.location.origin}/oauth/callback/linkedin`;

    // Get current user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return {
        success: false,
        error: 'Not authenticated. Please log in first.',
      };
    }

    // Verify we have a workspace ID
    if (!workspaceId) {
      return {
        success: false,
        error: 'Workspace ID not found. Please try connecting again from a workspace.',
      };
    }

    // For server-side flow, use the user_id from the encoded state (preserves original user)
    // For client-side flow, use the current session's user_id
    const targetUserId = isServerSideFlow && serverStateData.user_id 
      ? serverStateData.user_id 
      : session.user.id;
    
    console.log(`[LinkedIn OAuth] Using userId: ${targetUserId}, workspaceId: ${workspaceId} (from ${isServerSideFlow ? 'state' : 'session/storage'})`);

    // Call backend API to exchange code for token
    const response = await fetch('/api/oauth/linkedin/exchange', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code,
        redirectUri: finalRedirectUri,
        userId: targetUserId,
        workspaceId: workspaceId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to connect LinkedIn account');
    }

    const result = await response.json();

    console.log('LinkedIn connection successful:', result.profile.name);

    return {
      success: true,
      connection: result.connection,
      profile: result.profile,
    };

  } catch (error: any) {
    console.error('LinkedIn callback error:', error);
    return {
      success: false,
      error: error.message || 'Failed to complete LinkedIn authentication',
    };
  }
}

/**
 * Get current LinkedIn connection status for the user in a specific workspace
 * @param workspaceId - The workspace ID to check for LinkedIn connection
 */
export async function getLinkedInConnection(workspaceId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let query = supabase
    .from('social_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'linkedin')
    .eq('is_active', true);
  
  // Filter by workspace if provided
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching LinkedIn connection:', error);
    return null;
  }

  return data;
}

/**
 * Disconnect LinkedIn account from a specific workspace
 * @param workspaceId - The workspace ID to disconnect LinkedIn from
 */
export async function disconnectLinkedIn(workspaceId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('social_connections')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('platform', 'linkedin');
  
  // Filter by workspace if provided
  if (workspaceId) {
    query = query.eq('workspace_id', workspaceId);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to disconnect LinkedIn: ${error.message}`);
  }

  return { success: true };
}

/**
 * Check if LinkedIn token is expired or will expire soon
 */
export function isLinkedInTokenExpired(connection: any): boolean {
  if (!connection?.token_expires_at) return true;

  const expiresAt = new Date(connection.token_expires_at);
  const now = new Date();
  
  // Consider expired if less than 7 days remaining
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return expiresAt < sevenDaysFromNow;
}
