import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useSocialConnections } from "@/hooks/use-social-connections";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/components/auth/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { 
  Linkedin, 
  Facebook, 
  Twitter, 
  Instagram,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Key,
  ExternalLink,
  XCircle,
  Loader2
} from "lucide-react";
import { SiTiktok } from "react-icons/si";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";

type Platform = 'linkedin' | 'facebook' | 'twitter' | 'instagram' | 'tiktok';

interface ServerCredential {
  platform: Platform;
  client_id: string | null;
  is_configured: boolean;
}

const platformConfig = {
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    description: 'Connect your LinkedIn account to post professional content'
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    description: 'Connect your Facebook page to reach a broader audience'
  },
  twitter: {
    name: 'Twitter/X',
    icon: Twitter,
    color: 'text-sky-500',
    bgColor: 'bg-sky-50 dark:bg-sky-950',
    description: 'Connect your Twitter/X account for real-time engagement'
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50 dark:bg-pink-950',
    description: 'Connect your Instagram business account for visual content'
  },
  tiktok: {
    name: 'TikTok',
    icon: SiTiktok,
    color: 'text-slate-900 dark:text-slate-100',
    bgColor: 'bg-slate-100 dark:bg-slate-900',
    description: 'Connect your TikTok account for short-form video content'
  }
};

export function SocialConnectionsManager() {
  const { connections, isLoading, disconnect, toggleActive, isDisconnecting } = useSocialConnections();
  const { toast } = useToast();
  const [connectingPlatform, setConnectingPlatform] = useState<Platform | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const { currentWorkspace, loading: workspaceLoading, refreshWorkspaces } = useWorkspace();
  const { user } = useAuth();
  
  const workspaceId = currentWorkspace?.id;

  // Auto-create workspace if user doesn't have one
  const createDefaultWorkspace = async (): Promise<string | null> => {
    if (!user) return null;
    
    setCreatingWorkspace(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: `${user.email?.split('@')[0] || 'My'}'s Workspace`,
          description: 'Default workspace'
        })
      });

      if (response.ok) {
        const workspace = await response.json();
        await refreshWorkspaces();
        toast({
          title: "Workspace Created",
          description: "Your default workspace has been created.",
        });
        return workspace.id;
      }
      return null;
    } catch (error) {
      console.error('Error creating default workspace:', error);
      return null;
    } finally {
      setCreatingWorkspace(false);
    }
  };

  // Check workspace-level credentials (only when workspace is loaded)
  const { data: credentialsData } = useQuery<{ credentials: ServerCredential[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'platform-credentials'],
    enabled: !!workspaceId && !workspaceLoading
  });
  
  // Also check system-level credentials (for platforms configured at admin level)
  const { data: systemCredentialsData } = useQuery<{ credentials: ServerCredential[] }>({
    queryKey: ['/api/platform-credentials'],
  });

  const isPlatformConfigured = (platform: Platform): boolean => {
    // Check workspace-level first
    const workspaceCred = credentialsData?.credentials?.find(c => c.platform === platform);
    if (workspaceCred?.is_configured) return true;
    
    // Fall back to system-level credentials
    const systemCred = systemCredentialsData?.credentials?.find(c => c.platform === platform);
    return systemCred?.is_configured ?? false;
  };

  // Platforms that support multiple accounts
  const multiAccountPlatforms: Platform[] = ['linkedin'];
  
  // Group connections by platform
  const connectionsByPlatform = connections.reduce((acc, conn) => {
    const platform = conn.platform as Platform;
    if (!acc[platform]) acc[platform] = [];
    acc[platform].push(conn);
    return acc;
  }, {} as Record<Platform, typeof connections>);

  // All platforms that can still be added (either not connected, or support multi-account)
  const availablePlatforms = (Object.keys(platformConfig) as Platform[]).filter(
    p => !connectionsByPlatform[p] || multiAccountPlatforms.includes(p)
  );

  const handleOAuthConnect = async (platform: Platform) => {
    // Auto-create workspace if none exists
    let targetWorkspaceId = workspaceId;
    if (!targetWorkspaceId) {
      toast({
        title: "Creating Workspace",
        description: "Setting up your workspace...",
      });
      targetWorkspaceId = await createDefaultWorkspace();
      if (!targetWorkspaceId) {
        toast({
          title: "Workspace Required",
          description: "Unable to create workspace. Please try again or contact support.",
          variant: "destructive",
        });
        return;
      }
    }
    
    if (!isPlatformConfigured(platform)) {
      toast({
        title: "Setup Required",
        description: `Please configure ${platformConfig[platform].name} API credentials in Platform Integrations > API Setup first.`,
      });
      return;
    }
    
    setConnectingPlatform(platform);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please log in to connect your social accounts.",
          variant: "destructive",
        });
        return;
      }

      console.log(`[OAuth] Requesting auth URL for ${platform}, workspaceId: ${targetWorkspaceId}, userId: ${session.user.id}`);
      const response = await fetch(`/api/workspaces/${targetWorkspaceId}/oauth/${platform}/auth-url`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to get OAuth URL');
      }
      
      const data = await response.json();
      
      if (data.auth_url) {
        // Open in new tab/popup because LinkedIn blocks iframe embedding
        window.open(data.auth_url, '_blank', 'noopener,noreferrer');
        toast({
          title: "LinkedIn Authorization",
          description: "A new window has opened for LinkedIn authorization. Please complete the login there.",
        });
      } else {
        toast({
          title: "Connection Error",
          description: "Failed to generate OAuth URL. Please check your credentials.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Connection Error",
        description: error.message || "Failed to start OAuth flow. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConnectingPlatform(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-muted-foreground">Loading connections...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Connected Accounts</h3>
        <p className="text-sm text-muted-foreground">
          Manage your connected social media accounts. Toggle active status or remove connections.
        </p>
      </div>

      {connections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-4 bg-muted rounded-full mb-4">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-lg font-semibold text-foreground mb-2">No accounts connected</h4>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Connect your social media accounts to start scheduling and publishing posts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(Object.entries(connectionsByPlatform) as [Platform, typeof connections][]).map(([platform, platformConnections]) => {
            const config = platformConfig[platform];
            if (!config) return null;
            const Icon = config.icon;

            return (
              <div key={platform} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <h4 className="text-sm font-medium text-foreground">{config.name}</h4>
                  <Badge variant="secondary" className="text-xs">
                    {platformConnections.length} account{platformConnections.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {platformConnections.map((connection) => (
                    <Card key={connection.id} className="overflow-hidden" data-testid={`card-connection-${connection.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${config.bgColor}`}>
                              <Icon className={`h-5 w-5 ${config.color}`} />
                            </div>
                            <div>
                              <h4 className="font-medium text-foreground text-sm">{connection.account_name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {connection.is_active ? (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="h-3 w-3" /> Active
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Paused</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={connection.is_active}
                              onCheckedChange={() => toggleActive({ id: connection.id, isActive: !connection.is_active })}
                              data-testid={`switch-active-${connection.id}`}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => disconnect(connection.id)}
                              disabled={isDisconnecting}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                              data-testid={`button-disconnect-${connection.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">
          {connections.length > 0 ? 'Add More Accounts' : 'Connect Your First Account'}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {availablePlatforms.map((platform) => {
            const config = platformConfig[platform];
            const Icon = config.icon;
            const isConfigured = isPlatformConfigured(platform);
            
            return (
              <Dialog key={platform}>
                <DialogTrigger asChild>
                  <Card className={`cursor-pointer hover:border-primary transition-colors ${!isConfigured ? 'opacity-75' : ''}`} data-testid={`card-connect-${platform}`}>
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-lg ${config.bgColor}`}>
                          <Icon className={`h-6 w-6 ${config.color}`} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground flex items-center gap-2">
                            {config.name}
                            {isConfigured ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Ready
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                <Key className="h-3 w-3 mr-1" />
                                Setup Needed
                              </Badge>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground">Not connected</p>
                        </div>
                      </div>
                      <Button size="sm" variant={isConfigured ? "default" : "outline"} data-testid={`button-connect-${platform}`}>
                        <Plus className="h-4 w-4 mr-2" />
                        Connect
                      </Button>
                    </CardContent>
                  </Card>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Connect {config.name}</DialogTitle>
                    <DialogDescription>{config.description}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    {isConfigured ? (
                      <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                          <strong>Ready to Connect:</strong> Click the button below to securely connect your {config.name} account via OAuth.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <AlertDescription className="text-amber-800 dark:text-amber-200">
                          <strong>Setup Required:</strong> API credentials must be configured in <strong>Platform Integrations &gt; API Setup</strong> before you can connect this account.
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="space-y-3">
                      <div className="rounded-lg border p-4 space-y-2">
                        <h4 className="font-medium text-sm">What we'll access:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            Post content on your behalf
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            Read engagement metrics
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            Basic profile information
                          </li>
                        </ul>
                      </div>

                      <div className="rounded-lg border p-4 space-y-2">
                        <h4 className="font-medium text-sm">What we won't do:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-red-500" />
                            Access your messages
                          </li>
                          <li className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-red-500" />
                            Store your password
                          </li>
                          <li className="flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-red-500" />
                            Follow/unfollow accounts
                          </li>
                        </ul>
                      </div>
                    </div>

                    <Button 
                      className="w-full" 
                      onClick={() => handleOAuthConnect(platform)}
                      disabled={connectingPlatform === platform || !isConfigured}
                      data-testid={`button-oauth-${platform}`}
                    >
                      {connectingPlatform === platform ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Connecting...
                        </>
                      ) : !isConfigured ? (
                        <>
                          <Key className="h-4 w-4 mr-2" />
                          Configure API First
                        </>
                      ) : (
                        <>
                          <Icon className="h-4 w-4 mr-2" />
                          Connect {config.name} Account
                        </>
                      )}
                    </Button>
                    
                    <p className="text-xs text-muted-foreground text-center">
                      {isConfigured 
                        ? "Secure OAuth authentication • Revoke access anytime"
                        : "Go to Platform Integrations > API Setup to configure credentials"
                      }
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </div>
    </div>
  );
}
