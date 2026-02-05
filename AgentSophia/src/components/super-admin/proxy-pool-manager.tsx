import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/integrations/supabase/client';
import { 
  Server, Plus, Trash2, RefreshCw, Activity, Globe, 
  CheckCircle, XCircle, AlertTriangle, Wifi, WifiOff, Settings
} from 'lucide-react';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token 
    ? { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

interface ProxyPoolStats {
  total: number;
  available: number;
  allocated: number;
  unhealthy: number;
  disabled: number;
}

interface SystemProxy {
  id: string;
  provider: string;
  proxy_type: string;
  host: string;
  port: number;
  has_credentials: boolean;
  status: 'available' | 'allocated' | 'rotating' | 'unhealthy' | 'disabled';
  health_score: number;
  label: string | null;
  country_code: string | null;
  auto_rotate: boolean;
  rotation_interval_hours: number;
  last_health_check: string | null;
  last_used_at: string | null;
  total_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  created_at: string;
}

const PROXY_PROVIDERS = [
  { value: 'decodo', label: 'Decodo Mobile ($2.25/GB) - Recommended', recommended: true },
  { value: 'anyip', label: 'AnyIP - $2/GB' },
  { value: 'smartproxy', label: 'Smartproxy (Legacy)' },
  { value: 'iproyal', label: 'IPRoyal (Unlimited Data)' },
  { value: 'brightdata', label: 'Bright Data' },
  { value: 'oxylabs', label: 'Oxylabs' },
  { value: 'soax', label: 'SOAX' },
  { value: 'proxidize', label: 'Proxidize' },
  { value: 'thesocialproxy', label: 'The Social Proxy' },
  { value: 'other', label: 'Other' },
];

const PROVIDER_CONFIGS: Record<string, { 
  defaultHost: string; 
  defaultPort: string; 
  usernameHint: string;
  passwordHint: string;
  setupUrl: string;
  notes: string;
  pricing: string;
}> = {
  decodo: {
    defaultHost: 'gate.decodo.com',
    defaultPort: '7000',
    usernameHint: 'USERNAME-sessionduration-60',
    passwordHint: 'Your Decodo password',
    setupUrl: 'https://dashboard.decodo.com',
    notes: 'Use code MOBILE50 for 50% off. Sticky sessions up to 24 hours. Add -country-us for US IPs. Port 10001-49999 for sticky sessions.',
    pricing: '$2.25/GB - Best value mobile proxies',
  },
  anyip: {
    defaultHost: 'portal.anyip.io',
    defaultPort: '1080',
    usernameHint: 'user_XXXX,type_mobile,country_US',
    passwordHint: 'Your AnyIP password',
    setupUrl: 'https://dashboard.anyip.io',
    notes: 'Cheapest mobile proxies. Add session_NAME to username for sticky sessions (7 days default). Use sesstime_X for custom duration in minutes.',
    pricing: '$2/GB - Best value',
  },
  smartproxy: {
    defaultHost: 'gate.smartproxy.com',
    defaultPort: '10000',
    usernameHint: 'user-USERNAME-sessionduration-30',
    passwordHint: 'Your Smartproxy password',
    setupUrl: 'https://dashboard.smartproxy.com/mobile-proxies',
    notes: 'Legacy - now Decodo. Use code MOBILE50 for 50% off.',
    pricing: '$4/GB with discount code',
  },
  iproyal: {
    defaultHost: 'geo.iproyal.com',
    defaultPort: '32325',
    usernameHint: 'USERNAME',
    passwordHint: 'PASSWORD_country-us_session-RANDOM_lifetime-1440m',
    setupUrl: 'https://dashboard.iproyal.com/mobile-proxies',
    notes: 'Unlimited data with fair use. Add country code and session lifetime to password for sticky sessions.',
    pricing: '$80/month unlimited',
  },
  brightdata: {
    defaultHost: 'brd.superproxy.io',
    defaultPort: '22225',
    usernameHint: 'brd-customer-CUSTOMER_ID-zone-ZONE',
    passwordHint: 'Your zone password',
    setupUrl: 'https://brightdata.com/cp/zones',
    notes: 'Create a mobile zone in your dashboard. Enterprise-grade with highest IP diversity.',
    pricing: 'From $5.88/GB',
  },
  oxylabs: {
    defaultHost: 'pr.oxylabs.io',
    defaultPort: '7777',
    usernameHint: 'customer-USERNAME-cc-us-sessid-RANDOM-sesstime-30',
    passwordHint: 'Your Oxylabs password',
    setupUrl: 'https://dashboard.oxylabs.io/en/residential-proxies',
    notes: '20M+ mobile IPs with 99.9% uptime. Add session parameters to username for sticky sessions.',
    pricing: 'From $9/GB',
  },
  soax: {
    defaultHost: 'proxy.soax.com',
    defaultPort: '9000',
    usernameHint: 'package-PACKAGE_ID-country-US',
    passwordHint: 'Your SOAX password',
    setupUrl: 'https://dashboard.soax.com',
    notes: 'Requires KYC for LinkedIn use. 99.95% success rate.',
    pricing: 'From $90/month',
  },
  proxidize: {
    defaultHost: 'Your Proxidize server IP',
    defaultPort: '8080',
    usernameHint: 'admin',
    passwordHint: 'Your Proxidize password',
    setupUrl: 'https://proxidize.com/dashboard',
    notes: 'Self-hosted mobile proxy farm. Truly unlimited with your own hardware.',
    pricing: 'Hardware cost only',
  },
  thesocialproxy: {
    defaultHost: 'Your assigned proxy IP',
    defaultPort: '30000',
    usernameHint: 'Provided username',
    passwordHint: 'Provided password',
    setupUrl: 'https://thesocialproxy.com/dashboard',
    notes: 'Dedicated 4G/5G proxies for social media. Bulk discounts available.',
    pricing: 'From $119/month',
  },
  other: {
    defaultHost: '',
    defaultPort: '',
    usernameHint: 'Username from provider',
    passwordHint: 'Password from provider',
    setupUrl: '',
    notes: 'Enter your proxy details manually.',
    pricing: 'Varies',
  },
};

export function ProxyPoolManager() {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    provider: 'smartproxy',
    host: 'gate.smartproxy.com',
    port: '10000',
    username: '',
    password: '',
    label: '',
    countryCode: 'US',
    rotationIntervalHours: 24,
  });
  const [bulkFormData, setBulkFormData] = useState({
    provider: 'decodo',
    host: 'gate.decodo.com',
    basePort: '10001',
    username: '',
    password: '',
    labelPrefix: 'Decodo Mobile',
    countryCode: 'US',
    count: 5,
    rotationIntervalHours: 24,
  });

  const handleProviderChange = (provider: string) => {
    const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.other;
    setFormData({
      ...formData,
      provider,
      host: config.defaultHost,
      port: config.defaultPort,
    });
  };

  const currentProviderConfig = PROVIDER_CONFIGS[formData.provider] || PROVIDER_CONFIGS.other;

  const { data, isLoading, refetch } = useQuery<{ stats: ProxyPoolStats; proxies: SystemProxy[] }>({
    queryKey: ['/api/super-admin/proxy-pool'],
    queryFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/super-admin/proxy-pool', { headers });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to fetch proxies' }));
        throw new Error(error.message || error.error || 'Failed to fetch proxies');
      }
      return response.json();
    },
  });

  const addProxyMutation = useMutation({
    mutationFn: async (proxyData: typeof formData) => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/super-admin/proxy-pool', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...proxyData,
          port: parseInt(proxyData.port) || 0,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to add proxy' }));
        throw new Error(error.message || error.error || 'Failed to add proxy');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Proxy added successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/proxy-pool'] });
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add proxy', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ proxyId, status }: { proxyId: string; status: string }) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/super-admin/proxy-pool/${proxyId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to update status' }));
        throw new Error(error.message || error.error || 'Failed to update status');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Proxy status updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/proxy-pool'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });

  const removeProxyMutation = useMutation({
    mutationFn: async (proxyId: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/super-admin/proxy-pool/${proxyId}`, {
        method: 'DELETE',
        headers,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to remove proxy' }));
        throw new Error(error.message || error.error || 'Failed to remove proxy');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Proxy removed' });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/proxy-pool'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to remove proxy', description: error.message, variant: 'destructive' });
    },
  });

  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/super-admin/proxy-pool/health-check', {
        method: 'POST',
        headers,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Health check failed' }));
        throw new Error(error.message || error.error || 'Health check failed');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Health check completed' });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Health check failed', description: error.message, variant: 'destructive' });
    },
  });

  const bulkAddMutation = useMutation({
    mutationFn: async (data: typeof bulkFormData) => {
      const proxies = [];
      const basePortNum = parseInt(data.basePort) || 10001;
      
      for (let i = 0; i < data.count; i++) {
        proxies.push({
          provider: data.provider,
          host: data.host,
          port: basePortNum + i,
          username: data.username,
          password: data.password,
          label: `${data.labelPrefix} ${i + 1}`,
          countryCode: data.countryCode,
          rotationIntervalHours: data.rotationIntervalHours,
        });
      }

      const headers = await getAuthHeaders();
      const response = await fetch('/api/super-admin/proxy-pool/bulk', {
        method: 'POST',
        headers,
        body: JSON.stringify({ proxies }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to bulk add proxies' }));
        throw new Error(error.message || error.error || 'Failed to bulk add proxies');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({ title: `${variables.count} proxies added successfully` });
      queryClient.invalidateQueries({ queryKey: ['/api/super-admin/proxy-pool'] });
      setBulkDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: 'Failed to bulk add proxies', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    const defaultConfig = PROVIDER_CONFIGS.smartproxy;
    setFormData({
      provider: 'smartproxy',
      host: defaultConfig.defaultHost,
      port: defaultConfig.defaultPort,
      username: '',
      password: '',
      label: '',
      countryCode: 'US',
      rotationIntervalHours: 24,
    });
  };

  const getStatusBadge = (status: string, healthScore: number) => {
    const configs: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      available: { variant: 'default', icon: CheckCircle },
      allocated: { variant: 'secondary', icon: Wifi },
      rotating: { variant: 'outline', icon: RefreshCw },
      unhealthy: { variant: 'destructive', icon: AlertTriangle },
      disabled: { variant: 'outline', icon: WifiOff },
    };
    const config = configs[status] || configs.disabled;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const stats = data?.stats || { total: 0, available: 0, allocated: 0, unhealthy: 0, disabled: 0 };
  const proxies = data?.proxies || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold" data-testid="title-proxy-pool">System Proxy Pool</h2>
          <p className="text-muted-foreground">Manage mobile proxies for LinkedIn automation across all workspaces</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => healthCheckMutation.mutate()} disabled={healthCheckMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${healthCheckMutation.isPending ? 'animate-spin' : ''}`} />
            Health Check
          </Button>
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-add">
                <Server className="h-4 w-4 mr-2" />
                Bulk Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Bulk Add Proxies</DialogTitle>
                <DialogDescription>Generate multiple proxy entries with sequential ports (ideal for Decodo sticky sessions)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md p-3 text-sm text-green-700 dark:text-green-300">
                  <strong>Recommended:</strong> For LinkedIn automation, create 5-10 proxies per active user to ensure IP rotation and reduce detection risk.
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Number of Proxies</Label>
                    <Input 
                      type="number" 
                      value={bulkFormData.count} 
                      onChange={(e) => setBulkFormData({ ...bulkFormData, count: parseInt(e.target.value) || 5 })} 
                      min={1} 
                      max={50} 
                      data-testid="input-bulk-count" 
                    />
                    <p className="text-xs text-muted-foreground">5-10 recommended per user</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Starting Port</Label>
                    <Input 
                      value={bulkFormData.basePort} 
                      onChange={(e) => setBulkFormData({ ...bulkFormData, basePort: e.target.value })} 
                      placeholder="10001"
                      data-testid="input-bulk-base-port" 
                    />
                    <p className="text-xs text-muted-foreground">Ports: {bulkFormData.basePort}-{parseInt(bulkFormData.basePort) + bulkFormData.count - 1}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Host</Label>
                    <Input 
                      value={bulkFormData.host} 
                      onChange={(e) => setBulkFormData({ ...bulkFormData, host: e.target.value })} 
                      placeholder="gate.decodo.com" 
                      data-testid="input-bulk-host" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country Code</Label>
                    <Input 
                      value={bulkFormData.countryCode} 
                      onChange={(e) => setBulkFormData({ ...bulkFormData, countryCode: e.target.value })} 
                      placeholder="US" 
                      maxLength={2}
                      data-testid="input-bulk-country" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input 
                      value={bulkFormData.username} 
                      onChange={(e) => setBulkFormData({ ...bulkFormData, username: e.target.value })} 
                      placeholder="Your Decodo username"
                      data-testid="input-bulk-username" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input 
                      type="password" 
                      value={bulkFormData.password} 
                      onChange={(e) => setBulkFormData({ ...bulkFormData, password: e.target.value })} 
                      placeholder="Your Decodo password"
                      data-testid="input-bulk-password" 
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Label Prefix</Label>
                  <Input 
                    value={bulkFormData.labelPrefix} 
                    onChange={(e) => setBulkFormData({ ...bulkFormData, labelPrefix: e.target.value })} 
                    placeholder="Decodo Mobile"
                    data-testid="input-bulk-label" 
                  />
                  <p className="text-xs text-muted-foreground">Labels: "{bulkFormData.labelPrefix} 1", "{bulkFormData.labelPrefix} 2", etc.</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => {
                    const clampedCount = Math.min(Math.max(bulkFormData.count, 1), 50);
                    bulkAddMutation.mutate({ ...bulkFormData, count: clampedCount });
                  }} 
                  disabled={bulkAddMutation.isPending || !bulkFormData.host || !bulkFormData.username || !bulkFormData.password || bulkFormData.count > 50}
                  data-testid="button-create-bulk"
                >
                  {bulkFormData.count > 50 
                    ? 'Max 50 proxies at once' 
                    : bulkAddMutation.isPending 
                      ? 'Creating...' 
                      : `Create ${Math.min(bulkFormData.count, 50)} Proxies`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-proxy">
                <Plus className="h-4 w-4 mr-2" />
                Add Proxy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Proxy to Pool</DialogTitle>
                <DialogDescription>Add a new mobile proxy for automatic assignment to users</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={formData.provider} onValueChange={handleProviderChange}>
                    <SelectTrigger data-testid="select-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROXY_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentProviderConfig.setupUrl && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{currentProviderConfig.pricing}</span>
                      <a 
                        href={currentProviderConfig.setupUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3" />
                        Get credentials
                      </a>
                    </div>
                  )}
                </div>

                {currentProviderConfig.notes && (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3 text-xs text-blue-700 dark:text-blue-300">
                    <strong>Tip:</strong> {currentProviderConfig.notes}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Host</Label>
                    <Input value={formData.host} onChange={(e) => setFormData({ ...formData, host: e.target.value })} placeholder={currentProviderConfig.defaultHost || "proxy.example.com"} data-testid="input-host" />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input value={formData.port} onChange={(e) => setFormData({ ...formData, port: e.target.value })} placeholder={currentProviderConfig.defaultPort || "8080"} data-testid="input-port" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder={currentProviderConfig.usernameHint} data-testid="input-username" />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder={currentProviderConfig.passwordHint} data-testid="input-password" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Label (optional)</Label>
                    <Input value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="US Mobile 1" data-testid="input-label" />
                  </div>
                  <div className="space-y-2">
                    <Label>Country Code</Label>
                    <Input value={formData.countryCode} onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })} placeholder="US" maxLength={2} data-testid="input-country" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Rotation Interval (hours)</Label>
                  <Input type="number" value={formData.rotationIntervalHours} onChange={(e) => setFormData({ ...formData, rotationIntervalHours: parseInt(e.target.value) || 24 })} min={1} max={168} data-testid="input-rotation" />
                  <p className="text-xs text-muted-foreground">Proxy will auto-rotate after this many hours (recommended: 24 for LinkedIn)</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => addProxyMutation.mutate(formData)} disabled={addProxyMutation.isPending || !formData.host || !formData.port} data-testid="button-save-proxy">
                  {addProxyMutation.isPending ? 'Adding...' : 'Add Proxy'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Server className="h-8 w-8 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Proxies</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{stats.available}</div>
              <div className="text-sm text-muted-foreground">Available</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Wifi className="h-8 w-8 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{stats.allocated}</div>
              <div className="text-sm text-muted-foreground">Allocated</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-500" />
              <div className="text-2xl font-bold">{stats.unhealthy}</div>
              <div className="text-sm text-muted-foreground">Unhealthy</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <WifiOff className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <div className="text-2xl font-bold">{stats.disabled}</div>
              <div className="text-sm text-muted-foreground">Disabled</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proxy Pool</CardTitle>
          <CardDescription>All proxies are auto-assigned to users when they start LinkedIn automation</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading proxies...</div>
          ) : proxies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No proxies in pool. Add your first proxy to enable LinkedIn automation.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proxy</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Rotation</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proxies.map((proxy) => (
                  <TableRow key={proxy.id} data-testid={`row-proxy-${proxy.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{proxy.label || `${proxy.host}:${proxy.port}`}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {proxy.country_code || 'Unknown'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{proxy.provider || 'Mobile Sticky'}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(proxy.status, proxy.health_score)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={proxy.health_score ?? 100} className="w-16 h-2" />
                        <span className="text-sm">{proxy.health_score ?? 100}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {proxy.auto_rotate ? `Every ${proxy.rotation_interval_hours || 24}h` : 'Manual'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{proxy.total_requests ?? 0} requests</div>
                        <div className="text-muted-foreground">{proxy.avg_latency_ms ?? 0}ms avg</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {proxy.status === 'disabled' ? (
                          <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ proxyId: proxy.id, status: 'available' })} data-testid={`button-enable-${proxy.id}`}>
                            Enable
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ proxyId: proxy.id, status: 'disabled' })} data-testid={`button-disable-${proxy.id}`}>
                            Disable
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => removeProxyMutation.mutate(proxy.id)} disabled={proxy.status === 'allocated'} data-testid={`button-remove-${proxy.id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
