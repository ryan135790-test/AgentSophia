import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, CheckCircle, Link2, Trash2, ExternalLink, Key, Settings } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { PlatformApiSetup } from '@/components/social/platform-api-setup';
import { useAuth } from '@/components/auth/auth-provider';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const categoryIcons: Record<string, any> = {
  social: Link2,
  email: Link2,
  messaging: Link2,
  voice: Link2,
};

export default function IntegrationsHub() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState<'channels' | 'api-setup'>('channels');
  
  const workspaceId = currentWorkspace?.id || '';

  const { data: registryData, isLoading: registryLoading } = useQuery({
    queryKey: ['/api/integrations/registry'],
    queryFn: async () => {
      return await apiRequest('/api/integrations/registry', { method: 'GET' });
    }
  });

  const { data: accountsData, isLoading: accountsLoading, refetch: refetchAccounts } = useQuery({
    queryKey: ['/api/integrations/connected'],
    queryFn: async () => {
      return await apiRequest('/api/integrations/connected', { method: 'GET' });
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest('/api/integrations/disconnect', {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId })
      });
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Integration disconnected',
        variant: 'default'
      });
      refetchAccounts();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect',
        variant: 'destructive'
      });
    }
  });

  const handleConnect = (type: string) => {
    if (type === 'linkedin') {
      window.location.href = '/oauth/linkedin';
    } else {
      toast({
        title: 'Coming Soon',
        description: `${type} OAuth flow coming soon`,
        variant: 'default'
      });
    }
  };

  const registry = registryData?.registry || {};
  const connectedAccounts = accountsData?.accounts || [];

  const categories = ['all', 'social', 'email', 'messaging', 'voice'];

  const getFilteredIntegrations = () => {
    return Object.entries(registry).filter(([_, data]: [string, any]) => {
      if (selectedCategory === 'all') return true;
      return data.category === selectedCategory;
    });
  };

  const getConnectedAccounts = (type: string) => {
    return connectedAccounts.filter((acc: any) => acc.integration_type === type);
  };

  if (registryLoading || accountsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin mr-2" />
        <span className="text-muted-foreground">Loading integrations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Platform Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Connect channels and configure API credentials for your workspace
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'channels' | 'api-setup')} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="channels" className="flex items-center gap-2" data-testid="tab-channels">
            <Link2 className="h-4 w-4" />
            Connect Channels
          </TabsTrigger>
          <TabsTrigger value="api-setup" className="flex items-center gap-2" data-testid="tab-api-setup">
            <Key className="h-4 w-4" />
            API Setup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-6 mt-6">
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Seamless & Secure:</strong> You'll be redirected to connect your account. We never store passwords - just secure OAuth tokens. You can connect multiple accounts per channel.
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="all" onValueChange={setSelectedCategory} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="capitalize">
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map(cat => (
              <TabsContent key={cat} value={cat} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getFilteredIntegrations().map(([type, data]: [string, any]) => {
                    const connectedList = getConnectedAccounts(type);
                    const isConnected = connectedList.length > 0;

                    return (
                      <Card key={type} className="overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-6 space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-lg">{data.name}</h3>
                              <p className="text-xs text-muted-foreground mt-1">{data.description}</p>
                            </div>
                            {isConnected && (
                              <Badge className="bg-green-100 text-green-800">Connected</Badge>
                            )}
                          </div>

                          {isConnected && (
                            <div className="space-y-2 bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
                              <p className="text-xs font-medium text-green-900 dark:text-green-200">
                                <CheckCircle className="h-3 w-3 inline mr-1" />
                                Connected Accounts:
                              </p>
                              <div className="space-y-1">
                                {connectedList.map((acc: any) => (
                                  <div key={acc.id} className="flex items-center justify-between bg-white dark:bg-background p-2 rounded text-xs">
                                    <span className="truncate font-medium">{acc.display_name}</span>
                                    <button
                                      onClick={() => disconnectMutation.mutate(acc.id)}
                                      disabled={disconnectMutation.isPending}
                                      className="text-destructive hover:text-destructive/80"
                                      data-testid={`button-disconnect-${acc.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Button
                            onClick={() => handleConnect(type)}
                            className="w-full"
                            variant={isConnected ? 'outline' : 'default'}
                            size="lg"
                            data-testid={`button-connect-${type}`}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            {isConnected ? 'Add Another Account' : 'Connect Now'}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {getFilteredIntegrations().length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No integrations in this category</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>

          <Card className="p-6 bg-muted/50">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Connected Accounts</p>
                <p className="text-2xl font-bold">{connectedAccounts.length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Channels</p>
                <p className="text-2xl font-bold">{Object.keys(registry).length}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="text-2xl font-bold text-green-600">Ready</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="api-setup" className="mt-6">
          <PlatformApiSetup workspaceId={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
