// Gmail OAuth handler for frontend-only app
// Uses popup window flow for OAuth

const GMAIL_CLIENT_ID = import.meta.env.VITE_GMAIL_CLIENT_ID ||  '';
const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';
const GMAIL_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

export interface GmailOAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  userEmail: string;
}

export class GmailOAuthClient {
  private clientId: string;
  private redirectUri: string;

  constructor(clientId?: string) {
    this.clientId = clientId || GMAIL_CLIENT_ID;
    this.redirectUri = `${window.location.origin}/oauth/gmail/callback`;
  }

  // Start OAuth flow in popup window
  async authorize(): Promise<GmailOAuthTokens> {
    // Check if client ID is configured
    if (!this.clientId) {
      throw new Error('Gmail OAuth is not configured. Please set VITE_GMAIL_CLIENT_ID in environment variables.');
    }

    return new Promise((resolve, reject) => {
      const authUrl = this.getAuthUrl();
      const popup = window.open(
        authUrl,
        'Gmail OAuth',
        'width=500,height=600,left=100,top=100'
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for OAuth.'));
        return;
      }

      // Listen for OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'gmail_oauth_success') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          resolve(event.data.tokens);
        } else if (event.data.type === 'gmail_oauth_error') {
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
      scope: GMAIL_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state: `gmail_${Date.now()}`,
    });

    return `${GMAIL_AUTH_URL}?${params.toString()}`;
  }

  // Save tokens to localStorage
  static saveTokens(tokens: GmailOAuthTokens): void {
    localStorage.setItem('gmail_oauth_tokens', JSON.stringify(tokens));
  }

  // Load tokens from localStorage
  static loadTokens(): GmailOAuthTokens | null {
    const stored = localStorage.getItem('gmail_oauth_tokens');
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  // Check if tokens are expired
  static isTokenExpired(tokens: GmailOAuthTokens): boolean {
    return Date.now() >= tokens.expiresAt;
  }

  // Clear tokens
  static clearTokens(): void {
    localStorage.removeItem('gmail_oauth_tokens');
  }

  // Get user email from access token (using Google's userinfo endpoint)
  static async getUserEmail(accessToken: string): Promise<string> {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info');
    }

    const data = await response.json();
    return data.email;
  }
}
