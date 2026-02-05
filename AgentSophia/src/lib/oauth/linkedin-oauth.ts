// LinkedIn OAuth handler for frontend-only app
// Uses popup window flow for OAuth

const LINKEDIN_CLIENT_ID = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';
const LINKEDIN_SCOPES = 'openid profile email w_member_social';
const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';

export interface LinkedInOAuthTokens {
  accessToken: string;
  expiresAt: number;
  userEmail: string;
  userName: string;
  userProfileUrl?: string;
}

export class LinkedInOAuthClient {
  private clientId: string;
  private redirectUri: string;

  constructor(clientId?: string) {
    this.clientId = clientId || LINKEDIN_CLIENT_ID;
    this.redirectUri = `${window.location.origin}/oauth/linkedin/callback`;
  }

  // Start OAuth flow in popup window
  async authorize(): Promise<LinkedInOAuthTokens> {
    // Check if client ID is configured
    if (!this.clientId) {
      throw new Error('LinkedIn OAuth is not configured. Please set VITE_LINKEDIN_CLIENT_ID in environment variables. Contact support for setup assistance.');
    }

    return new Promise((resolve, reject) => {
      const authUrl = this.getAuthUrl();
      const popup = window.open(
        authUrl,
        'LinkedIn OAuth',
        'width=600,height=700,left=100,top=100'
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for OAuth.'));
        return;
      }

      // Listen for OAuth callback
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'linkedin_oauth_success') {
          window.removeEventListener('message', handleMessage);
          popup.close();
          resolve(event.data.tokens);
        } else if (event.data.type === 'linkedin_oauth_error') {
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
    const state = `linkedin_${Date.now()}`;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: LINKEDIN_SCOPES,
      state: state,
    });

    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  // Save tokens to localStorage
  static saveTokens(tokens: LinkedInOAuthTokens): void {
    localStorage.setItem('linkedin_oauth_tokens', JSON.stringify(tokens));
  }

  // Load tokens from localStorage
  static loadTokens(): LinkedInOAuthTokens | null {
    const stored = localStorage.getItem('linkedin_oauth_tokens');
    if (!stored) return null;
    
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  // Check if tokens are expired
  static isTokenExpired(tokens: LinkedInOAuthTokens): boolean {
    return Date.now() >= tokens.expiresAt;
  }

  // Clear tokens
  static clearTokens(): void {
    localStorage.removeItem('linkedin_oauth_tokens');
  }

  // Exchange authorization code for access token
  // NOTE: This requires a backend endpoint due to CORS restrictions
  static async exchangeCodeForToken(code: string, redirectUri: string): Promise<LinkedInOAuthTokens> {
    // This would normally call your backend endpoint
    // For now, we'll show an error that backend is needed
    throw new Error('LinkedIn OAuth requires backend token exchange. This feature requires additional setup.');
  }
}
