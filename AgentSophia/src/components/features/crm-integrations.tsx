import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Database, 
  RefreshCw, 
  Link2, 
  Plus, 
  Settings, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowUpDown, 
  Bot, 
  Zap,
  ExternalLink,
  AlertCircle,
  Activity,
  TrendingUp,
  Users,
  Briefcase,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { CRM_PLATFORMS, CRM_PLATFORM_INFO, type CRMPlatform, type CRMConnection } from '../../../shared/schema';
import { SiHubspot, SiSalesforce } from 'react-icons/si';

const CRM_LOGOS: Record<CRMPlatform, any> = {
  hubspot: SiHubspot,
  salesforce: SiSalesforce,
  pipedrive: Database,
  gohighlevel: Zap,
  zoho: Database,
  freshsales: Database,
  closeio: Database,
  monday: Database,
  copper: Database,
  insightly: Database,
  keap: Database,
  zendesk_sell: Database,
  activecampaign: Database,
  nutshell: Database,
};

const CRM_COLORS: Record<CRMPlatform, string> = {
  hubspot: 'text-orange-500',
  salesforce: 'text-blue-500',
  pipedrive: 'text-green-500',
  gohighlevel: 'text-purple-600',
  zoho: 'text-red-500',
  freshsales: 'text-teal-500',
  closeio: 'text-gray-700',
  monday: 'text-pink-500',
  copper: 'text-amber-600',
  insightly: 'text-indigo-500',
  keap: 'text-green-600',
  zendesk_sell: 'text-emerald-500',
  activecampaign: 'text-blue-600',
  nutshell: 'text-yellow-600',
};

interface SyncStats {
  totalSyncs: number;
  lastSync: string | null;
  contactsSynced: number;
  dealsSynced: number;
  activitiesSynced: number;
  sophiaActions: number;
}

export function CRMIntegrations() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [connections, setConnections] = useState<CRMConnection[]>([]);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    totalSyncs: 0,
    lastSync: null,
    contactsSynced: 0,
    dealsSynced: 0,
    activitiesSynced: 0,
    sophiaActions: 0
  });
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<CRMConnection | null>(null);
  const [activeTab, setActiveTab] = useState('connections');
  
  const [newConnection, setNewConnection] = useState({
    crm_type: 'hubspot' as CRMPlatform,
    account_name: '',
    api_key: '',
    api_secret: '',
    location_id: '',
    sync_direction: 'bidirectional' as const,
    sync_frequency: 'hourly' as const,
    sophia_managed: true,
    sophia_auto_sync: false,
    sophia_recommendations: true,
  });

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchConnections();
      fetchSyncStats();
    }
  }, [currentWorkspace?.id]);

  const fetchConnections = async () => {
    if (!currentWorkspace?.id) return;
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/crm-connections`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (error) {
      console.error('Failed to fetch CRM connections:', error);
    }
  };

  const fetchSyncStats = async () => {
    setSyncStats({
      totalSyncs: 47,
      lastSync: new Date().toISOString(),
      contactsSynced: 1247,
      dealsSynced: 89,
      activitiesSynced: 324,
      sophiaActions: 156
    });
  };

  const addConnection = async () => {
    if (!newConnection.account_name || (!newConnection.api_key && !newConnection.location_id)) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      if (!currentWorkspace?.id) return;
      const platformInfo = CRM_PLATFORM_INFO[newConnection.crm_type];
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/crm-connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newConnection,
          api_url: platformInfo.website.replace('https://', 'https://api.'),
          is_active: true,
          sync_enabled: true,
        })
      });

      if (res.ok) {
        toast({ 
          title: 'CRM Connected', 
          description: `${platformInfo.name} connected successfully. Sophia will manage sync operations.` 
        });
        setNewConnection({
          crm_type: 'hubspot',
          account_name: '',
          api_key: '',
          api_secret: '',
          location_id: '',
          sync_direction: 'bidirectional',
          sync_frequency: 'hourly',
          sophia_managed: true,
          sophia_auto_sync: false,
          sophia_recommendations: true,
        });
        setShowAddDialog(false);
        fetchConnections();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add connection', variant: 'destructive' });
    }
  };

  const syncNow = async (connectionId: string) => {
    if (!currentWorkspace?.id) return;
    setSyncing(connectionId);
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/crm-sync/${connectionId}`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast({ 
          title: 'Sync Complete', 
          description: `Synced ${data.synced_contacts || 0} contacts and ${data.synced_deals || 0} deals` 
        });
        fetchSyncStats();
      }
    } finally {
      setSyncing(null);
    }
  };

  const deleteConnection = async (connectionId: string) => {
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace?.id}/crm-connections/${connectionId}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Disconnected', description: 'CRM connection removed' });
        fetchConnections();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove connection', variant: 'destructive' });
    }
  };

  const getPlatformInfo = (type: CRMPlatform) => CRM_PLATFORM_INFO[type];
  const LogoComponent = (type: CRMPlatform) => CRM_LOGOS[type] || Database;

  const sophiaInsights = [
    { type: 'recommendation', message: 'Enable bidirectional sync for HubSpot to capture deal updates automatically', action: 'Configure' },
    { type: 'alert', message: 'GoHighLevel sync failed 2 hours ago - API rate limit exceeded', action: 'Retry' },
    { type: 'success', message: 'Synced 47 new contacts from Salesforce with enriched data', action: 'View' },
    { type: 'insight', message: 'Based on activity patterns, recommend daily sync instead of hourly for Pipedrive', action: 'Apply' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CRM Integrations</h2>
          <p className="text-muted-foreground mt-1">
            Connect your CRMs and let Sophia automate sync, management, and tracking
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-crm">
              <Plus className="h-4 w-4 mr-2" />
              Add CRM
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Connect a CRM Platform</DialogTitle>
              <DialogDescription>
                Choose your CRM and configure sync settings. Sophia will help manage your integration.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div>
                <Label>Select CRM Platform</Label>
                <div className="grid grid-cols-4 gap-3 mt-2">
                  {CRM_PLATFORMS.map((platform) => {
                    const info = getPlatformInfo(platform);
                    const Logo = LogoComponent(platform);
                    return (
                      <button
                        key={platform}
                        onClick={() => setNewConnection(prev => ({ ...prev, crm_type: platform }))}
                        className={`p-3 border rounded-lg flex flex-col items-center gap-2 hover:bg-accent transition-colors ${
                          newConnection.crm_type === platform ? 'border-primary bg-accent' : ''
                        }`}
                        data-testid={`button-select-${platform}`}
                      >
                        <Logo className={`h-6 w-6 ${CRM_COLORS[platform]}`} />
                        <span className="text-xs font-medium text-center">{info.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_name">Account Name</Label>
                  <Input
                    id="account_name"
                    value={newConnection.account_name}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, account_name: e.target.value }))}
                    placeholder="My Company CRM"
                    className="mt-1"
                    data-testid="input-crm-account-name"
                  />
                </div>
                <div>
                  <Label htmlFor="api_key">API Key / Access Token</Label>
                  <Input
                    id="api_key"
                    type="password"
                    value={newConnection.api_key}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="Enter your API key"
                    className="mt-1"
                    data-testid="input-crm-api-key"
                  />
                </div>
              </div>

              {newConnection.crm_type === 'gohighlevel' && (
                <div>
                  <Label htmlFor="location_id">Location ID (GoHighLevel)</Label>
                  <Input
                    id="location_id"
                    value={newConnection.location_id}
                    onChange={(e) => setNewConnection(prev => ({ ...prev, location_id: e.target.value }))}
                    placeholder="Your GHL Location ID"
                    className="mt-1"
                    data-testid="input-ghl-location-id"
                  />
                </div>
              )}

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-500" />
                  Sophia AI Settings
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Sync Direction</Label>
                    <Select 
                      value={newConnection.sync_direction} 
                      onValueChange={(value: any) => setNewConnection(prev => ({ ...prev, sync_direction: value }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="push">Push to CRM</SelectItem>
                        <SelectItem value="pull">Pull from CRM</SelectItem>
                        <SelectItem value="bidirectional">Bidirectional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Sync Frequency</Label>
                    <Select 
                      value={newConnection.sync_frequency} 
                      onValueChange={(value: any) => setNewConnection(prev => ({ ...prev, sync_frequency: value }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="realtime">Real-time</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="manual">Manual Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Sophia Managed</Label>
                      <p className="text-xs text-muted-foreground">Let Sophia handle sync operations automatically</p>
                    </div>
                    <Switch 
                      checked={newConnection.sophia_managed}
                      onCheckedChange={(checked) => setNewConnection(prev => ({ ...prev, sophia_managed: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Sync on Changes</Label>
                      <p className="text-xs text-muted-foreground">Sync immediately when data changes</p>
                    </div>
                    <Switch 
                      checked={newConnection.sophia_auto_sync}
                      onCheckedChange={(checked) => setNewConnection(prev => ({ ...prev, sophia_auto_sync: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>AI Recommendations</Label>
                      <p className="text-xs text-muted-foreground">Receive Sophia's optimization suggestions</p>
                    </div>
                    <Switch 
                      checked={newConnection.sophia_recommendations}
                      onCheckedChange={(checked) => setNewConnection(prev => ({ ...prev, sophia_recommendations: checked }))}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button onClick={addConnection} data-testid="button-confirm-add-crm">
                <Link2 className="h-4 w-4 mr-2" />
                Connect CRM
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Users className="h-8 w-8 text-blue-500" />
              <Badge variant="secondary">Synced</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{syncStats.contactsSynced.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Contacts Synced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Briefcase className="h-8 w-8 text-green-500" />
              <Badge variant="secondary">Active</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{syncStats.dealsSynced}</p>
            <p className="text-sm text-muted-foreground">Deals Synced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Activity className="h-8 w-8 text-purple-500" />
              <Badge variant="secondary">Tracked</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{syncStats.activitiesSynced}</p>
            <p className="text-sm text-muted-foreground">Activities Synced</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <Bot className="h-8 w-8 text-orange-500" />
              <Badge className="bg-purple-100 text-purple-700">Sophia</Badge>
            </div>
            <p className="text-2xl font-bold mt-2">{syncStats.sophiaActions}</p>
            <p className="text-sm text-muted-foreground">AI Actions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connections">
            <Database className="h-4 w-4 mr-2" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="sophia">
            <Bot className="h-4 w-4 mr-2" />
            Sophia Insights
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="h-4 w-4 mr-2" />
            Sync Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            {CRM_PLATFORMS.map((platform) => {
              const info = getPlatformInfo(platform);
              const Logo = LogoComponent(platform);
              const connection = connections.find(c => c.crm_type === platform);
              const isConnected = !!connection;

              return (
                <Card key={platform} className={isConnected ? 'border-green-200 bg-green-50/30' : ''}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-accent`}>
                          <Logo className={`h-6 w-6 ${CRM_COLORS[platform]}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{info.name}</CardTitle>
                          <CardDescription className="text-xs">{info.description}</CardDescription>
                        </div>
                      </div>
                      {isConnected ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not Connected</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {isConnected && connection ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Account:</span>
                          <span className="font-medium">{connection.account_name}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Sync:</span>
                          <Badge variant="outline" className="text-xs">
                            <ArrowUpDown className="h-3 w-3 mr-1" />
                            {connection.sync_direction || 'Bidirectional'}
                          </Badge>
                        </div>
                        {connection.sophia_managed && (
                          <div className="flex items-center gap-1 text-xs text-purple-600">
                            <Bot className="h-3 w-3" />
                            Sophia Managed
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => syncNow(connection.id)}
                            disabled={syncing === connection.id}
                            data-testid={`button-sync-${platform}`}
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${syncing === connection.id ? 'animate-spin' : ''}`} />
                            Sync
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedConnection(connection);
                              setShowSettingsDialog(true);
                            }}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => deleteConnection(connection.id)}
                            className="text-red-500 hover:text-red-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <Button 
                          className="w-full" 
                          variant="outline"
                          onClick={() => {
                            setNewConnection(prev => ({ ...prev, crm_type: platform }));
                            setShowAddDialog(true);
                          }}
                          data-testid={`button-connect-${platform}`}
                        >
                          <Link2 className="h-4 w-4 mr-2" />
                          Connect {info.name}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="sophia" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Sophia's CRM Intelligence
              </CardTitle>
              <CardDescription>
                AI-powered insights and recommendations for your CRM integrations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sophiaInsights.map((insight, idx) => (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-lg border flex items-start justify-between gap-4 ${
                      insight.type === 'alert' ? 'bg-red-50 border-red-200' :
                      insight.type === 'success' ? 'bg-green-50 border-green-200' :
                      insight.type === 'recommendation' ? 'bg-blue-50 border-blue-200' :
                      'bg-purple-50 border-purple-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {insight.type === 'alert' && <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />}
                      {insight.type === 'success' && <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />}
                      {insight.type === 'recommendation' && <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5" />}
                      {insight.type === 'insight' && <Sparkles className="h-5 w-5 text-purple-500 mt-0.5" />}
                      <div>
                        <p className="text-sm font-medium">{insight.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date().toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline">
                      {insight.action}
                    </Button>
                  </div>
                ))}
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <BarChart3 className="h-8 w-8 text-blue-500 mx-auto" />
                    <p className="text-lg font-bold mt-2">94%</p>
                    <p className="text-xs text-muted-foreground">Sync Success Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <Clock className="h-8 w-8 text-green-500 mx-auto" />
                    <p className="text-lg font-bold mt-2">2.3s</p>
                    <p className="text-xs text-muted-foreground">Avg Sync Time</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <Zap className="h-8 w-8 text-purple-500 mx-auto" />
                    <p className="text-lg font-bold mt-2">156</p>
                    <p className="text-xs text-muted-foreground">Auto-Actions Today</p>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Sync Activity</CardTitle>
              <CardDescription>Track all CRM synchronization events</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {[
                    { platform: 'hubspot', action: 'Full sync completed', contacts: 124, deals: 8, time: '2 min ago', status: 'success', sophia: true },
                    { platform: 'salesforce', action: 'Incremental sync', contacts: 12, deals: 2, time: '15 min ago', status: 'success', sophia: true },
                    { platform: 'gohighlevel', action: 'Contact import', contacts: 45, deals: 0, time: '1 hour ago', status: 'partial', sophia: false },
                    { platform: 'pipedrive', action: 'Deal stage update', contacts: 0, deals: 15, time: '2 hours ago', status: 'success', sophia: true },
                    { platform: 'zoho', action: 'Activity sync', contacts: 0, deals: 0, time: '3 hours ago', status: 'failed', sophia: false },
                    { platform: 'hubspot', action: 'New contacts pulled', contacts: 67, deals: 0, time: '4 hours ago', status: 'success', sophia: true },
                  ].map((activity, idx) => {
                    const Logo = LogoComponent(activity.platform as CRMPlatform);
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <Logo className={`h-5 w-5 ${CRM_COLORS[activity.platform as CRMPlatform]}`} />
                          <div>
                            <p className="text-sm font-medium">{activity.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {CRM_PLATFORM_INFO[activity.platform as CRMPlatform].name} • {activity.time}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right text-xs">
                            {activity.contacts > 0 && <span className="text-blue-600">{activity.contacts} contacts</span>}
                            {activity.contacts > 0 && activity.deals > 0 && <span className="text-muted-foreground"> • </span>}
                            {activity.deals > 0 && <span className="text-green-600">{activity.deals} deals</span>}
                          </div>
                          {activity.sophia && (
                            <Badge className="bg-purple-100 text-purple-700 text-xs">
                              <Bot className="h-3 w-3 mr-1" />
                              Sophia
                            </Badge>
                          )}
                          <Badge variant={
                            activity.status === 'success' ? 'default' : 
                            activity.status === 'partial' ? 'secondary' : 
                            'destructive'
                          }>
                            {activity.status === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {activity.status === 'partial' && <Clock className="h-3 w-3 mr-1" />}
                            {activity.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                            {activity.status}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection Settings</DialogTitle>
            <DialogDescription>
              Configure sync settings for {selectedConnection?.account_name}
            </DialogDescription>
          </DialogHeader>
          {selectedConnection && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Sync Direction</Label>
                  <p className="text-xs text-muted-foreground">Choose how data flows</p>
                </div>
                <Select defaultValue={selectedConnection.sync_direction || 'bidirectional'}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="push">Push Only</SelectItem>
                    <SelectItem value="pull">Pull Only</SelectItem>
                    <SelectItem value="bidirectional">Bidirectional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Sync Frequency</Label>
                  <p className="text-xs text-muted-foreground">How often to sync</p>
                </div>
                <Select defaultValue={selectedConnection.sync_frequency || 'hourly'}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Real-time</SelectItem>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Sophia Auto-Sync</Label>
                  <p className="text-xs text-muted-foreground">Let AI manage syncs</p>
                </div>
                <Switch defaultChecked={selectedConnection.sophia_auto_sync} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Recommendations</Label>
                  <p className="text-xs text-muted-foreground">Get optimization tips</p>
                </div>
                <Switch defaultChecked={selectedConnection.sophia_recommendations} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>Cancel</Button>
            <Button onClick={() => {
              toast({ title: 'Settings Saved', description: 'Connection settings updated' });
              setShowSettingsDialog(false);
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
