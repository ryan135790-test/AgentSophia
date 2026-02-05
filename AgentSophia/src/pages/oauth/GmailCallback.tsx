import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// OAuth callback page for Gmail
// Handles authorization code flow - exchanges code for tokens server-side

export function GmailCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Connecting to Gmail...');

  useEffect(() => {
    const processOAuth = async () => {
      // Parse OAuth response from URL query params (authorization code flow)
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const error = params.get('error');
      const errorDescription = params.get('error_description');

      if (error) {
        setStatus('error');
        setMessage(errorDescription || error || 'Authorization was denied');
        window.opener?.postMessage(
          { type: 'gmail_oauth_error', error: errorDescription || error },
          window.location.origin
        );
        setTimeout(() => window.close(), 2000);
        return;
      }

      if (!code) {
        // Check for implicit flow (hash) as fallback
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        
        if (accessToken) {
          // Handle implicit flow (legacy)
          const expiresIn = parseInt(hashParams.get('expires_in') || '3600');
          const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
          
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const userInfo = await userInfoRes.json();
            
            setStatus('success');
            setMessage('Gmail connected!');
            window.opener?.postMessage(
              {
                type: 'gmail_oauth_success',
                data: { accessToken, expiresAt, email: userInfo.email },
              },
              window.location.origin
            );
          } catch {
            setStatus('error');
            setMessage('Failed to get user info');
            window.opener?.postMessage(
              { type: 'gmail_oauth_error', error: 'Failed to get user info' },
              window.location.origin
            );
          }
          setTimeout(() => window.close(), 2000);
          return;
        }
        
        setStatus('error');
        setMessage('No authorization code received');
        window.opener?.postMessage(
          { type: 'gmail_oauth_error', error: 'No authorization code received' },
          window.location.origin
        );
        setTimeout(() => window.close(), 2000);
        return;
      }

      // Exchange authorization code for tokens via server
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Use the same redirect_uri that was used to initiate OAuth
        const redirectUri = `${window.location.origin}/oauth/gmail/callback`;
        
        // Call server to exchange code
        const response = await fetch('/api/oauth/gmail/exchange', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ code, state, redirectUri }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to exchange code');
        }

        setStatus('success');
        setMessage(`Connected as ${result.email}`);
        
        window.opener?.postMessage(
          {
            type: 'gmail_oauth_success',
            data: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken,
              expiresAt: result.expiresAt,
              email: result.email,
            },
          },
          window.location.origin
        );
        setTimeout(() => window.close(), 2000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Connection failed');
        window.opener?.postMessage(
          { type: 'gmail_oauth_error', error: err.message || 'Connection failed' },
          window.location.origin
        );
        setTimeout(() => window.close(), 2000);
      }
    };

    processOAuth();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        {status === 'processing' && (
          <>
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2">Connecting to Gmail...</h2>
            <p className="text-gray-500">Please wait while we complete the connection.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-2xl">✓</span>
            </div>
            <h2 className="text-xl font-semibold text-green-600 mb-2">Gmail Connected!</h2>
            <p className="text-gray-500">{message}</p>
            <p className="text-sm text-gray-400 mt-2">This window will close automatically.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">✗</span>
            </div>
            <h2 className="text-xl font-semibold text-red-600 mb-2">Connection Failed</h2>
            <p className="text-gray-500">{message}</p>
            <p className="text-sm text-gray-400 mt-2">This window will close automatically.</p>
          </>
        )}
      </div>
    </div>
  );
}
