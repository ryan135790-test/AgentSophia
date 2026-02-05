import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Linkedin, 
  Facebook, 
  Twitter, 
  Instagram,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  ExternalLink,
  Save,
  Trash2,
  Settings,
  Key,
  Loader2
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

type Platform = 'linkedin' | 'facebook' | 'twitter' | 'instagram' | 'tiktok';

interface PlatformConfig {
  name: string;
  icon: any;
  color: string;
  bgColor: string;
  description: string;
  developerUrl: string;
  scopes: string[];
  instructions: string[];
}

const platformConfigs: Record<Platform, PlatformConfig> = {
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    description: 'Enable LinkedIn OAuth for users to connect their profiles',
    developerUrl: 'https://www.linkedin.com/developers/apps',
    scopes: ['r_liteprofile', 'r_emailaddress', 'w_member_social'],
    instructions: [
      'Go to LinkedIn Developer Portal',
      'Create a new app or select existing one',
      'Copy the Client ID and Client Secret',
      'Add your redirect URL in OAuth 2.0 settings'
    ]
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    description: 'Enable Facebook/Meta OAuth for page connections',
    developerUrl: 'https://developers.facebook.com/apps/',
    scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
    instructions: [
      'Go to Meta for Developers',
      'Create a new app (Business type)',
      'Add Facebook Login product',
      'Copy App ID and App Secret from Settings > Basic'
    ]
  },
  twitter: {
    name: 'Twitter/X',
    icon: Twitter,
    color: 'text-sky-500',
    bgColor: 'bg-sky-50 dark:bg-sky-950',
    description: 'Enable Twitter/X OAuth for posting and engagement',
    developerUrl: 'https://developer.twitter.com/en/portal/dashboard',
    scopes: ['tweet.read', 'tweet.write', 'users.read'],
    instructions: [
      'Go to Twitter Developer Portal',
      'Create a new project and app',
      'Set up User Authentication with OAuth 2.0',
      'Copy Client ID and Client Secret from Keys & Tokens'
    ]
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-950',
    description: 'Enable Instagram Business OAuth via Facebook',
    developerUrl: 'https://developers.facebook.com/apps/',
    scopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_insights'],
    instructions: [
      'Instagram uses Facebook/Meta app system',
      'Create/configure your Facebook app first',
      'Add Instagram Graph API product',
      'Link your Instagram Business account'
    ]
  },
  tiktok: {
    name: 'TikTok',
    icon: SiTiktok,
    color: 'text-slate-900 dark:text-slate-100',
    bgColor: 'bg-slate-100 dark:bg-slate-900',
    description: 'Enable TikTok OAuth for video content',
    developerUrl: 'https://developers.tiktok.com/',
    scopes: ['video.publish', 'video.upload', 'user.info.basic'],
    instructions: [
      'Go to TikTok for Developers',
      'Register as a developer if needed',
      'Create a new app and request API access',
      'Copy Client Key and Client Secret after approval'
    ]
  }
};

interface PlatformCredentialsState {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface ServerCredential {
  platform: Platform;
  client_id: string | null;
  redirect_uri: string | null;
  is_configured: boolean;
}

interface PlatformApiSetupProps {
  workspaceId: string;
  onCredentialsSaved?: (platform: Platform) => void;
}

export function PlatformApiSetup({ workspaceId, onCredentialsSaved }: PlatformApiSetupProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState<Record<Platform, boolean>>({
    linkedin: false,
    facebook: false,
    twitter: false,
    instagram: false,
    tiktok: false
  });
  const [credentials, setCredentials] = useState<Record<Platform, PlatformCredentialsState>>({
    linkedin: { clientId: '', clientSecret: '', redirectUri: '' },
    facebook: { clientId: '', clientSecret: '', redirectUri: '' },
    twitter: { clientId: '', clientSecret: '', redirectUri: '' },
    instagram: { clientId: '', clientSecret: '', redirectUri: '' },
    tiktok: { clientId: '', clientSecret: '', redirectUri: '' }
  });
  const [savingPlatform, setSavingPlatform] = useState<Platform | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const { data: serverCredentials, isLoading } = useQuery<{ credentials: ServerCredential[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'platform-credentials'],
    enabled: !!workspaceId
  });

  const saveMutation = useMutation({
    mutationFn: async ({ platform, clientId, clientSecret }: { platform: Platform; clientId: string; clientSecret: string }) => {
      return await apiRequest(`/api/workspaces/${workspaceId}/platform-credentials`, {
        method: 'POST',
        body: JSON.stringify({
          platform,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${baseUrl}/oauth/callback/${platform}`
        })
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'platform-credentials'] });
      toast({
        title: "Credentials Saved",
        description: `${platformConfigs[variables.platform].name} API credentials have been securely saved.`,
      });
      setCredentials(prev => ({
        ...prev,
        [variables.platform]: { clientId: '', clientSecret: '', redirectUri: '' }
      }));
      onCredentialsSaved?.(variables.platform);
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save credentials. Please try again.",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (platform: Platform) => {
      return await apiRequest(`/api/workspaces/${workspaceId}/platform-credentials/${platform}`, {
        method: 'DELETE'
      });
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'platform-credentials'] });
      toast({
        title: "Credentials Removed",
        description: `${platformConfigs[platform].name} API credentials have been removed.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to remove credentials.",
        variant: "destructive",
      });
    }
  });

  const isConfigured = (platform: Platform): boolean => {
    const cred = serverCredentials?.credentials?.find(c => c.platform === platform);
    return cred?.is_configured ?? false;
  };

  const handleSave = async (platform: Platform) => {
    const creds = credentials[platform];
    if (!creds.clientId || !creds.clientSecret) {
      toast({
        title: "Missing Credentials",
        description: "Please enter both Client ID and Client Secret.",
        variant: "destructive",
      });
      return;
    }

    setSavingPlatform(platform);
    try {
      await saveMutation.mutateAsync({
        platform,
        clientId: creds.clientId,
        clientSecret: creds.clientSecret
      });
    } finally {
      setSavingPlatform(null);
    }
  };

  const handleRemove = (platform: Platform) => {
    deleteMutation.mutate(platform);
  };

  const toggleShowSecret = (platform: Platform) => {
    setShowSecrets(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const updateCredential = (platform: Platform, field: keyof PlatformCredentialsState, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        [field]: value
      }
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading platform credentials...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Key className="h-6 w-6" />
          Platform API Setup
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure API credentials for each social platform to enable user connections
        </p>
      </div>

      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <Settings className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>How it works:</strong> Enter your API credentials below. Once saved, users will be able to connect their personal social media accounts via OAuth. Credentials are stored securely on the server.
        </AlertDescription>
      </Alert>

      <Accordion type="single" collapsible className="space-y-3">
        {(Object.keys(platformConfigs) as Platform[]).map((platform) => {
          const config = platformConfigs[platform];
          const Icon = config.icon;
          const configured = isConfigured(platform);
          const creds = credentials[platform];

          return (
            <AccordionItem 
              key={platform} 
              value={platform}
              className="border rounded-lg overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.bgColor}`}>
                      <Icon className={`h-5 w-5 ${config.color}`} />
                    </div>
                    <div className="text-left">
                      <h4 className="font-semibold text-foreground">{config.name}</h4>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={configured ? "default" : "secondary"}
                    className={configured ? "bg-green-600 hover:bg-green-600" : ""}
                  >
                    {configured ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Configured</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Not Set Up</>
                    )}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                    <h5 className="font-medium text-sm flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Setup Instructions
                    </h5>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      {config.instructions.map((instruction, i) => (
                        <li key={i}>{instruction}</li>
                      ))}
                    </ol>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => window.open(config.developerUrl, '_blank')}
                      data-testid={`button-open-developer-portal-${platform}`}
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Open Developer Portal
                    </Button>
                  </div>

                  {configured ? (
                    <div className="space-y-4">
                      <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                          <strong>Configured:</strong> {config.name} OAuth is ready. Users can connect their accounts.
                        </AlertDescription>
                      </Alert>
                      <Button
                        variant="destructive"
                        onClick={() => handleRemove(platform)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-remove-credentials-${platform}`}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Remove Credentials
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${platform}-client-id`}>Client ID / App ID</Label>
                        <Input
                          id={`${platform}-client-id`}
                          placeholder="Enter your Client ID"
                          value={creds.clientId}
                          onChange={(e) => updateCredential(platform, 'clientId', e.target.value)}
                          data-testid={`input-client-id-${platform}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${platform}-client-secret`}>Client Secret / App Secret</Label>
                        <div className="relative">
                          <Input
                            id={`${platform}-client-secret`}
                            type={showSecrets[platform] ? "text" : "password"}
                            placeholder="Enter your Client Secret"
                            value={creds.clientSecret}
                            onChange={(e) => updateCredential(platform, 'clientSecret', e.target.value)}
                            data-testid={`input-client-secret-${platform}`}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => toggleShowSecret(platform)}
                            data-testid={`button-toggle-secret-${platform}`}
                          >
                            {showSecrets[platform] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`${platform}-redirect-uri`}>Redirect URI (for your app settings)</Label>
                        <div className="flex gap-2">
                          <Input
                            id={`${platform}-redirect-uri`}
                            value={`${baseUrl}/oauth/callback/${platform}`}
                            readOnly
                            className="bg-muted"
                            data-testid={`input-redirect-uri-${platform}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(`${baseUrl}/oauth/callback/${platform}`);
                              toast({
                                title: "Copied",
                                description: "Redirect URI copied to clipboard",
                              });
                            }}
                            data-testid={`button-copy-redirect-${platform}`}
                          >
                            Copy
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Add this URL to your app's OAuth redirect settings in the developer portal
                        </p>
                      </div>

                      <Button
                        onClick={() => handleSave(platform)}
                        disabled={!creds.clientId || !creds.clientSecret || savingPlatform === platform}
                        className="w-full"
                        data-testid={`button-save-credentials-${platform}`}
                      >
                        {savingPlatform === platform ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save Credentials
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
                    <strong>Required Scopes:</strong> {config.scopes.join(', ')}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

export function isPlatformConfigured(platform: Platform): boolean {
  return false;
}

export function getStoredCredentials(platform: Platform): { clientId: string; clientSecret: string } | null {
  return null;
}
