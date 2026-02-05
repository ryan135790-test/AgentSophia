import { useEffect } from 'react';

// OAuth callback page for Outlook/Microsoft
// This page receives the OAuth redirect and sends tokens to the parent window

export function OutlookCallback() {
  useEffect(() => {
    // Parse OAuth response from URL hash
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    
    const accessToken = params.get('access_token');
    const error = params.get('error');

    if (error) {
      // Send error to parent window
      window.opener?.postMessage(
        {
          type: 'outlook_oauth_error',
          error: error || 'Unknown error occurred',
        },
        window.location.origin
      );
      // Close popup after sending error
      setTimeout(() => window.close(), 500);
    } else if (accessToken) {
      const expiresIn = parseInt(params.get('expires_in') || '3600');
      const expiresAt = Date.now() + expiresIn * 1000;

      // Get user email
      fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          // Send success to parent window
          window.opener?.postMessage(
            {
              type: 'outlook_oauth_success',
              tokens: {
                accessToken,
                expiresAt,
                userEmail: data.mail || data.userPrincipalName,
              },
            },
            window.location.origin
          );
          // Close popup after sending success
          setTimeout(() => window.close(), 500);
        })
        .catch((err) => {
          window.opener?.postMessage(
            {
              type: 'outlook_oauth_error',
              error: 'Failed to get user info',
            },
            window.location.origin
          );
          // Close popup after sending error
          setTimeout(() => window.close(), 500);
        });
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Connecting to Outlook...</h2>
        <p className="text-muted-foreground">This window will close automatically.</p>
      </div>
    </div>
  );
}
