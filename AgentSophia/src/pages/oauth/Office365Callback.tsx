import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export function Office365Callback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Connecting to Office 365...');
  const [errorDetails, setErrorDetails] = useState<any>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get authorization code from URL
        // Note: Microsoft sometimes adds a # at the end which can interfere with URLSearchParams
        const urlParams = window.location.search;
        const params = new URLSearchParams(urlParams.split('#')[0]); // Remove fragment if present
        const code = params.get('code');
        const error = params.get('error');

        console.log('OAuth callback URL:', window.location.href);
        console.log('URL params:', window.location.search);
        console.log('Authorization code received:', code ? 'YES (length: ' + code.length + ')' : 'NO');
        console.log('Error in URL:', error);

        if (error) {
          throw new Error(params.get('error_description') || 'Authorization failed');
        }

        if (!code) {
          setErrorDetails({ 
            error: 'No code in URL', 
            fullUrl: window.location.href, 
            search: window.location.search,
            hash: window.location.hash,
            allParams: Object.fromEntries(params.entries())
          });
          throw new Error('No authorization code received from Microsoft');
        }

        // Add debug info even when code exists
        setErrorDetails({
          status: 'Sending to Edge Function',
          hasCode: true,
          codeLength: code.length,
          redirectUri: `${window.location.origin}/oauth/office365/callback`,
          fullUrl: window.location.href
        });

        // Exchange code for access token (server-side via Supabase Edge Function)
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        
        const requestBody = {
          code,
          redirectUri: `${window.location.origin}/oauth/office365/callback`,
        };
        
        console.log('Sending to Edge Function:', { 
          url: `${supabaseUrl}/functions/v1/office365-token-exchange`,
          hasCode: !!code,
          redirectUri: requestBody.redirectUri
        });
        
        const response = await fetch(`${supabaseUrl}/functions/v1/office365-token-exchange`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('Token exchange failed:', errorData);
          console.error('Redirect URI sent:', `${window.location.origin}/oauth/office365/callback`);
          setErrorDetails(errorData);
          throw new Error(errorData.error_description || errorData.error || errorData.details || 'Failed to exchange authorization code');
        }

        const data = await response.json();

        // Get user info
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
          },
        });

        if (!userResponse.ok) {
          throw new Error('Failed to fetch user information');
        }

        const user = await userResponse.json();

        // Save to localStorage
        const config = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in * 1000),
          email: user.mail || user.userPrincipalName,
          displayName: user.displayName,
        };

        localStorage.setItem('office365_config', JSON.stringify(config));

        setStatus('success');
        setMessage(`Successfully connected as ${user.displayName}`);

        // Close popup and notify parent window
        setTimeout(() => {
          if (window.opener) {
            window.opener.postMessage({ type: 'office365_connected', data: config }, window.location.origin);
            window.close();
          } else {
            // If not in popup, redirect to main app
            window.location.href = '/?tab=agent-sophia';
          }
        }, 2000);

      } catch (error) {
        console.error('Office 365 OAuth error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Connection failed');
        // Use functional state update to preserve any error details already set
        setErrorDetails(prev => prev || { error: error instanceof Error ? error.message : 'Unknown error' });

        setTimeout(() => {
          if (window.opener) {
            window.opener.postMessage({ type: 'office365_error', error: error instanceof Error ? error.message : 'Unknown error' }, window.location.origin);
            window.close();
          }
        }, 3000);
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4 p-8">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="text-lg font-medium text-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">Please wait...</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <p className="text-lg font-medium text-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">This window will close automatically...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 mx-auto text-red-500" />
            <p className="text-lg font-medium text-foreground">Connection Failed</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            {errorDetails && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 rounded-lg text-left max-w-2xl">
                <p className="text-xs font-semibold text-red-900 dark:text-red-100 mb-2">Debug Information:</p>
                <pre className="text-xs text-red-800 dark:text-red-200 overflow-auto max-h-64">
                  {JSON.stringify(errorDetails, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
