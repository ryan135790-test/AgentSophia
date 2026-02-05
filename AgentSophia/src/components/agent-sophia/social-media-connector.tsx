import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink,
  Linkedin,
  Twitter,
  Facebook,
  Instagram
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { LinkedInConnectButton } from "@/components/linkedin/LinkedInConnectButton";

interface Platform {
  id: string;
  name: string;
  icon: any;
  color: string;
  connected: boolean;
  connectedAccount?: string;
}

export function SocialMediaConnector() {
  const [platforms, setPlatforms] = useState<Platform[]>([
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-600', connected: false },
    { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: 'bg-black dark:bg-white', connected: false },
    { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-500', connected: false },
    { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-gradient-to-tr from-purple-600 to-pink-600', connected: false },
  ]);
  
  const { toast } = useToast();

  // Check connected platforms on mount
  useEffect(() => {
    checkConnectedPlatforms();
  }, []);

  const checkConnectedPlatforms = () => {
    const savedPlatforms = platforms.map(platform => {
      const saved = localStorage.getItem(`${platform.id}_config`);
      if (saved) {
        try {
          const config = JSON.parse(saved);
          if (config.accessToken) {
            return { ...platform, connected: true, connectedAccount: config.account };
          }
        } catch (e) {
          console.error(`Failed to parse ${platform.id} config:`, e);
        }
      }
      return platform;
    });
    
    setPlatforms(savedPlatforms);
  };

  const handleConnect = async (platformId: string) => {
    const clientIds: Record<string, string> = {
      linkedin: import.meta.env.VITE_LINKEDIN_CLIENT_ID,
      twitter: import.meta.env.VITE_TWITTER_CLIENT_ID,
      facebook: import.meta.env.VITE_FACEBOOK_APP_ID,
      instagram: import.meta.env.VITE_FACEBOOK_APP_ID, // Instagram uses Facebook OAuth
    };

    const clientId = clientIds[platformId];

    if (!clientId) {
      toast({
        title: "Configuration Required",
        description: `Please configure ${platformId.toUpperCase()} app credentials in environment variables. See setup guide.`,
        variant: "destructive",
      });
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/${platformId}/callback`;
    let authUrl = '';

    // Platform-specific OAuth URLs
    switch (platformId) {
      case 'linkedin':
        const linkedinScopes = ['openid', 'profile', 'w_member_social'].join(' ');
        authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
          `response_type=code` +
          `&client_id=${clientId}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(linkedinScopes)}`;
        break;

      case 'twitter':
        // Twitter OAuth 2.0 with PKCE
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        localStorage.setItem('twitter_code_verifier', codeVerifier);
        
        const twitterScopes = ['tweet.read', 'tweet.write', 'users.read'].join(' ');
        authUrl = `https://twitter.com/i/oauth2/authorize?` +
          `response_type=code` +
          `&client_id=${clientId}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${encodeURIComponent(twitterScopes)}` +
          `&state=${generateState()}` +
          `&code_challenge=${codeChallenge}` +
          `&code_challenge_method=S256`;
        break;

      case 'facebook':
      case 'instagram':
        const fbScopes = [
          'pages_show_list',
          'pages_read_engagement',
          'pages_manage_posts',
          'instagram_basic',
          'instagram_content_publish'
        ].join(',');
        authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
          `client_id=${clientId}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&scope=${fbScopes}` +
          `&response_type=code`;
        break;
    }

    if (!authUrl) {
      toast({
        title: "Platform Not Supported",
        description: `OAuth flow for ${platformId} not yet implemented.`,
        variant: "destructive",
      });
      return;
    }

    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      authUrl,
      `${platformId} Authorization`,
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const handleDisconnect = (platformId: string) => {
    localStorage.removeItem(`${platformId}_config`);
    
    setPlatforms(platforms.map(p => 
      p.id === platformId ? { ...p, connected: false, connectedAccount: undefined } : p
    ));
    
    toast({
      title: "Disconnected",
      description: `${platformId} integration has been disconnected.`,
    });
  };

  // Helper functions for Twitter PKCE
  const generateCodeVerifier = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
  };

  const generateCodeChallenge = async (verifier: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(digest));
  };

  const base64URLEncode = (buffer: Uint8Array) => {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const generateState = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  return (
    <Card data-testid="card-social-media-connector">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Social Media Integration</span>
        </CardTitle>
        <CardDescription>
          Connect Agent Sophia to social platforms for automated posting
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platforms Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {platforms.map((platform) => {
            const Icon = platform.icon;
            
            return (
              <div
                key={platform.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                data-testid={`platform-${platform.id}`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`${platform.color} p-2 rounded-lg text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{platform.name}</p>
                    {platform.connected && platform.connectedAccount && (
                      <p className="text-xs text-muted-foreground">{platform.connectedAccount}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {platform.id === 'linkedin' ? (
                    <LinkedInConnectButton variant="outline" size="sm" showStatus={false} />
                  ) : platform.connected ? (
                    <>
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(platform.id)}
                        data-testid={`disconnect-${platform.id}`}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(platform.id)}
                      data-testid={`connect-${platform.id}`}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Features */}
        <div>
          <h4 className="font-medium mb-3">Agent Sophia will be able to:</h4>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Post content automatically across all connected platforms</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Schedule posts for optimal engagement times</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Generate AI-powered content for each platform</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Track engagement and responses</span>
            </div>
          </div>
        </div>

        <Alert>
          <AlertDescription>
            <strong>Setup Required:</strong> Before connecting, you need to create developer apps for each platform.
            See the admin setup guide for detailed instructions.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
