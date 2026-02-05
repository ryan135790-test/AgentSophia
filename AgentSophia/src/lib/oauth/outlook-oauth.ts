// Outlook/Microsoft OAuth handler for frontend-only app
// Uses popup window flow for OAuth

const OUTLOOK_CLIENT_ID = import.meta.env.VITE_OUTLOOK_CLIENT_ID || '';
const OUTLOOK_SCOPES = 'Mail.Send User.Read offline_access';
const OUTLOOK_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

export interface OutlookOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userEmail: string;
}

export class OutlookOAuthClient {
  private clientId: string;
  private redirectUri: string;

  constructor(clientId?: string) {
    this.clientId = clientId || OUTLOOK_CLIENT_ID;
    this.redirectUri = `${window.location.origin}/oauth/outlook/callback`;
  }

  // Start OAuth flow in popup window
  async authorize(): Promise<OutlookOAuthTokens> {
    // Check if client ID is configured
    if (!this.clientId) {
      throw new Error('Outlook OAuth is not configured. Please set VITE_OUTLOOK_CLIENT_ID in environment variables.');
    }

    return new Promise((resolve, reject) => {
      const authUrl = this.getAuthUrl();
      const popup = window.open(
        authUrl,
        'Outlook OAuth',
        'width=500,height=600,left=100,top=100'
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for OAuth.'));
        return;
      }

      // Listen for OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'outlook_oauth_success') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          resolve(event.data.tokens);
        } else if (event.data.type === 'outlook_oauth_error') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          reject(new Error(event.data.error));
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          reject(new Error('OAuth popup was closed'));
        }
      }, 1000);
    });
  }

  // Generate OAuth authorization URL
  private getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'token', // Use implicit flow for frontend
      scope: OUTLOOK_SCOPES,
      response_mode: 'fragment',
      state: `outlook_${Date.now()}`,
    });

    return `${OUTLOOK_AUTH_URL}?${params.toString()}`;
  }

  // Save tokens to localStorage
  static saveTokens(tokens: OutlookOAuthTokens): void {
    localStorage.setItem('outlook_oauth_tokens', JSON.stringify(tokens));
  }

  // Load tokens from localStorage
  static loadTokens(): OutlookOAuthTokens | null {
    const stored = localStorage.getItem('outlook_oauth_tokens');
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  // Check if tokens are expired
  static isTokenExpired(tokens: OutlookOAuthTokens): boolean {
    return Date.now() >= tokens.expiresAt;
  }

  // Clear tokens
  static clearTokens(): void {
    localStorage.removeItem('outlook_oauth_tokens');
  }

  // Get user email from access token
  static async getUserEmail(accessToken: string): Promise<string> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = await response.json();
    return data.mail || data.userPrincipalName;
  }
}
