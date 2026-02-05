import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import {
  Linkedin, Settings, Users, MessageSquare, UserPlus,
  CheckCircle, XCircle, AlertCircle, RefreshCw, ExternalLink,
  Shield, BarChart3, Clock, Send, Loader2,
  Zap, TrendingUp, Trash2
} from "lucide-react";
import { LinkedInSafetyControlsPanel } from "@/components/linkedin/linkedin-safety-controls-panel";
import LinkedInComplianceDashboard from "@/components/linkedin/linkedin-compliance-dashboard";
import { LinkedInSafetyOverrides } from "@/components/linkedin/linkedin-safety-overrides";
import { LinkedInLocationSync } from "@/components/linkedin/linkedin-location-sync";
import LinkedInLiveBrowserDemo from "@/components/linkedin/linkedin-live-browser-demo";
import LinkedInCampaignObserver from "@/components/linkedin/linkedin-campaign-observer";
import { useSearchParams } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface LinkedInAccount {
  id: string;
  name: string;
  email: string;
  profile_url: string;
  status: 'active' | 'paused' | 'disconnected' | 'rate_limited';
  daily_limit: number;
  messages_sent_today: number;
  connections_sent_today: number;
  last_activity: string;
  connected_at: string;
}

interface LinkedInStats {
  total_messages_sent: number;
  total_connections_sent: number;
  total_replies: number;
  acceptance_rate: number;
  reply_rate: number;
  accounts_connected: number;
}

export default function LinkedInSettings() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  
  // Get workspace and user from URL params (for super admin access)
  const urlWorkspaceId = searchParams.get('workspace');
  const urlUserId = searchParams.get('user');

  // Check HeyReach OAuth status (legacy)
  const { data: heyreachStatus, isLoading: heyreachLoading } = useQuery({
    queryKey: ['/api/heyreach/status'],
    queryFn: async () => {
      const res = await fetch('/api/heyreach/status');
      if (!res.ok) return { connected: false, accounts: [], stats: null };
      return res.json();
    },
  });
  
  // Also check Puppeteer session status (Quick Login / Manual Cookie)
  // Super admins can view any workspace's session using URL params
  // Use URL workspace if provided (super admin), otherwise use current workspace
  const effectiveWorkspaceId = urlWorkspaceId || workspaceId;
  
  const { data: puppeteerStatus, isLoading: puppeteerLoading, refetch: refetchPuppeteer } = useQuery({
    queryKey: ['/api/linkedin/puppeteer/connection-status', effectiveWorkspaceId, urlUserId],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { connected: false, profileName: null, sessionSource: null };
        
        // Build URL with workspace and optional user params
        let url = '/api/linkedin/puppeteer/connection-status';
        const params = new URLSearchParams();
        // Always pass workspace_id to filter sessions properly
        if (effectiveWorkspaceId) params.set('workspace_id', effectiveWorkspaceId);
        if (urlUserId) params.set('user_id', urlUserId);
        if (params.toString()) url += '?' + params.toString();
        
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!res.ok) return { connected: false, profileName: null, sessionSource: null };
        return res.json();
      } catch (error) {
        console.error('Failed to fetch puppeteer status:', error);
        return { connected: false, profileName: null, sessionSource: null };
      }
    },
    enabled: !!effectiveWorkspaceId,
  });
  
  // Combined connection status: connected if EITHER HeyReach OR Puppeteer session is active
  const connectionStatus = {
    connected: heyreachStatus?.connected || puppeteerStatus?.connected,
    accounts: heyreachStatus?.accounts || [],
    stats: heyreachStatus?.stats || null,
    puppeteerConnected: puppeteerStatus?.connected,
    puppeteerProfileName: puppeteerStatus?.profileName,
    puppeteerSessionSource: puppeteerStatus?.sessionSource,
  };
  const statusLoading = heyreachLoading || puppeteerLoading;
  
  const refetchStatus = () => {
    refetchPuppeteer();
  };

  const { data: accounts = [], isLoading: accountsLoading, refetch: refetchAccounts } = useQuery<LinkedInAccount[]>({
    queryKey: ['/api/heyreach/accounts'],
    queryFn: async () => {
      const res = await fetch('/api/heyreach/accounts');
      if (!res.ok) return [];
      const data = await res.json();
      return data.accounts || [];
    },
    enabled: connectionStatus?.connected,
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      // For Puppeteer connections, redirect to My Connections page for proper disconnect flow
      if (puppeteerStatus?.connected) {
        window.location.href = '/my-connections';
        return { redirected: true };
      }
      return apiRequest('/api/heyreach/disconnect', { method: 'POST' });
    },
    onSuccess: (data: any) => {
      if (!data?.redirected) {
        toast({ title: 'Disconnected', description: 'LinkedIn automation disconnected' });
        refetchStatus();
      }
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      // Use Puppeteer test endpoint if connected via Puppeteer, otherwise use HeyReach
      if (puppeteerStatus?.connected && workspaceId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not logged in');
        
        const res = await fetch('/api/linkedin-automation/test-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ workspace_id: workspaceId }),
        });
        return res.json();
      }
      return apiRequest('/api/heyreach/test', { method: 'POST' });
    },
    onSuccess: (data: any) => {
      if (data.success || data.valid) {
        toast({ title: 'Connection Test Passed', description: data.message || 'LinkedIn automation is working correctly' });
      } else {
        toast({ title: 'Connection Test Failed', description: data.error || data.message || 'API test failed', variant: 'destructive' });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Test Failed', description: error.message, variant: 'destructive' });
    },
  });

  const syncAccountsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/heyreach/sync-accounts', { method: 'POST' });
    },
    onSuccess: () => {
      toast({ title: 'Accounts Synced', description: 'LinkedIn accounts refreshed successfully' });
      refetchAccounts();
    },
  });

  const toggleAccountMutation = useMutation({
    mutationFn: async ({ accountId, enabled }: { accountId: string; enabled: boolean }) => {
      return apiRequest(`/api/heyreach/accounts/${accountId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      refetchAccounts();
    },
  });

  // Calculate stats, counting Puppeteer connection if HeyReach shows 0 accounts
  const baseStats = connectionStatus?.stats || {
    total_messages_sent: 0,
    total_connections_sent: 0,
    total_replies: 0,
    acceptance_rate: 0,
    reply_rate: 0,
    accounts_connected: 0,
  };
  
  // Count Puppeteer connection as an account if it's connected
  const stats: LinkedInStats = {
    ...baseStats,
    accounts_connected: baseStats.accounts_connected || (puppeteerStatus?.connected ? 1 : 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Paused</Badge>;
      case 'rate_limited':
        return <Badge className="bg-orange-100 text-orange-800"><AlertCircle className="w-3 h-3 mr-1" />Rate Limited</Badge>;
      case 'disconnected':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Disconnected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-sky-100 rounded-lg">
                <Linkedin className="w-8 h-8 text-sky-600" />
              </div>
              LinkedIn Settings
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your LinkedIn automation and outreach settings
            </p>
          </div>
        {connectionStatus?.connected && (
          <Button
            variant="outline"
            onClick={() => syncAccountsMutation.mutate()}
            disabled={syncAccountsMutation.isPending}
            data-testid="btn-sync-accounts"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncAccountsMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Accounts
          </Button>
        )}
      </div>

      <Tabs defaultValue="connection" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="connection">
            <Linkedin className="w-4 h-4 mr-2" />
            Connection
          </TabsTrigger>
          <TabsTrigger value="accounts" disabled={!connectionStatus?.connected}>
            <Users className="w-4 h-4 mr-2" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="safety" disabled={!connectionStatus?.connected}>
            <Shield className="w-4 h-4 mr-2" />
            Safety Controls
          </TabsTrigger>
          <TabsTrigger value="analytics" disabled={!connectionStatus?.connected}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" disabled={!connectionStatus?.connected}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <CheckCircle className="w-4 h-4 mr-2" />
            Compliance Testing
          </TabsTrigger>
          <TabsTrigger value="live-demo" data-testid="tab-live-demo">
            <Zap className="w-4 h-4 mr-2" />
            Live Browser Demo
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connection" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                LinkedIn Automation
              </CardTitle>
              <CardDescription>
                Connect your LinkedIn automation to enable outreach features. Settings are configured per user.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {connectionStatus?.connected ? (
                <div className="space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>Connected!</strong> LinkedIn automation is active and ready for outreach.
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">API Status</p>
                      <p className="text-sm text-muted-foreground">
                        {stats.accounts_connected} LinkedIn account(s) connected
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => testConnectionMutation.mutate()}
                        disabled={testConnectionMutation.isPending}
                        data-testid="btn-test-connection"
                      >
                        {testConnectionMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        Test Connection
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => disconnectMutation.mutate()}
                        disabled={disconnectMutation.isPending}
                        data-testid="btn-disconnect"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Disconnect
                      </Button>
                    </div>
                  </div>
                </div>
              ) : connectionStatus.puppeteerConnected ? (
                <div className="space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      <strong>LinkedIn Connected</strong> - Connected as {connectionStatus.puppeteerProfileName || 'LinkedIn User'} via {connectionStatus.puppeteerSessionSource === 'quick_login' ? 'Quick Login' : 'Manual Session'}
                    </AlertDescription>
                  </Alert>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">Session Status</p>
                      <p className="text-sm text-muted-foreground">
                        {connectionStatus.puppeteerProfileName || 'LinkedIn User'} - {connectionStatus.puppeteerSessionSource === 'quick_login' ? 'Proxy-enabled session' : 'Direct session'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => window.location.href = '/my-connections'}
                        data-testid="btn-manage-connection"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Manage Connection
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800">
                      <strong>LinkedIn Not Connected</strong> - Connect your LinkedIn account to enable outreach features.
                    </AlertDescription>
                  </Alert>

                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Linkedin className="w-8 h-8 text-sky-600" />
                    </div>
                    <h3 className="font-semibold mb-2">Connect Your LinkedIn Account</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      To use LinkedIn automation features, connect your personal LinkedIn account.
                    </p>
                    <Button
                      onClick={() => window.location.href = '/my-connections'}
                      className="bg-sky-600 hover:bg-sky-700"
                      data-testid="btn-go-to-connections"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Go to My Connections
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Linkedin className="w-6 h-6 text-sky-600" />
                  </div>
                  <h3 className="font-semibold mb-2">1. Connect Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Sign in with your LinkedIn credentials via My Connections
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-semibold mb-2">2. Configure Safety</h3>
                  <p className="text-sm text-muted-foreground">
                    Set your daily limits and safety controls for secure automation
                  </p>
                </div>
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Send className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold mb-2">3. Send Outreach</h3>
                  <p className="text-sm text-muted-foreground">
                    Sophia will use LinkedIn for connection requests and messages
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Connected LinkedIn Accounts
              </CardTitle>
              <CardDescription>
                Manage your LinkedIn accounts and personal settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accountsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-8">
                  <Linkedin className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="font-semibold mb-2">No LinkedIn Accounts Connected</h3>
                  <p className="text-muted-foreground mb-4">
                    Contact your administrator to connect your LinkedIn account
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div key={account.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-sky-100 rounded-full flex items-center justify-center">
                            <Linkedin className="w-6 h-6 text-sky-600" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{account.name}</h4>
                            <p className="text-sm text-muted-foreground">{account.email}</p>
                            <div className="flex items-center gap-2 mt-2">
                              {getStatusBadge(account.status)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={account.status === 'active'}
                            onCheckedChange={(checked) => 
                              toggleAccountMutation.mutate({ accountId: account.id, enabled: checked })
                            }
                            data-testid={`switch-account-${account.id}`}
                          />
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{account.messages_sent_today}</p>
                          <p className="text-xs text-muted-foreground">Messages Today</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{account.connections_sent_today}</p>
                          <p className="text-xs text-muted-foreground">Connections Today</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{account.daily_limit}</p>
                          <p className="text-xs text-muted-foreground">Daily Limit</p>
                        </div>
                        <div>
                          <div className="space-y-1">
                            <Progress 
                              value={(account.messages_sent_today / account.daily_limit) * 100} 
                              className="h-2"
                            />
                            <p className="text-xs text-muted-foreground">
                              {Math.round((account.messages_sent_today / account.daily_limit) * 100)}% Used
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Send className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total_messages_sent.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Messages Sent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-sky-100 rounded-lg">
                    <UserPlus className="w-6 h-6 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total_connections_sent.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Connection Requests</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total_replies.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Replies Received</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.acceptance_rate}%</p>
                    <p className="text-sm text-muted-foreground">Acceptance Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Connection Acceptance Rate</span>
                    <span className="font-medium">{stats.acceptance_rate}%</span>
                  </div>
                  <Progress value={stats.acceptance_rate} className="h-3" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Reply Rate</span>
                    <span className="font-medium">{stats.reply_rate}%</span>
                  </div>
                  <Progress value={stats.reply_rate} className="h-3" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="safety" className="space-y-6">
          <LinkedInLocationSync />
          <Separator className="my-6" />
          <LinkedInSafetyControlsPanel />
          <Separator className="my-6" />
          <LinkedInSafetyOverrides />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>LinkedIn Automation Settings</CardTitle>
              <CardDescription>
                Configure how Sophia uses LinkedIn for outreach
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-send Connection Requests</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send connection requests when contacts are added to campaigns
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-auto-connect" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Respect Daily Limits</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically pause sending when daily limits are reached
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-respect-limits" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Smart Timing</Label>
                  <p className="text-sm text-muted-foreground">
                    Send messages during recipient's active hours based on timezone
                  </p>
                </div>
                <Switch defaultChecked data-testid="switch-smart-timing" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <LinkedInComplianceDashboard />
        </TabsContent>

        <TabsContent value="live-demo" className="space-y-6">
          <LinkedInCampaignObserver />
          <LinkedInLiveBrowserDemo />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
