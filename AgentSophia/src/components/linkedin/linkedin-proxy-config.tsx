import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  Shield, Wifi, Globe, CheckCircle, XCircle, Loader2,
  AlertCircle, Settings, Zap, Activity
} from "lucide-react";

interface LinkedInProxyConfigProps {
  onClose?: () => void;
}

export function LinkedInProxyConfig({ onClose }: LinkedInProxyConfigProps) {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [testingProxy, setTestingProxy] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; ip?: string; error?: string } | null>(null);

  const [formData, setFormData] = useState({
    proxy_enabled: false,
    proxy_provider: '',
    proxy_host: '',
    proxy_port: '',
    proxy_username: '',
    proxy_password: '',
    daily_connection_limit: 25,
    daily_message_limit: 50,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['linkedin-automation-settings', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const res = await fetch(`/api/linkedin-automation/settings?workspace_id=${currentWorkspace.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      
      if (data.settings) {
        setFormData({
          proxy_enabled: data.settings.proxy_enabled || false,
          proxy_provider: data.settings.proxy_provider || '',
          proxy_host: data.settings.proxy_host || '',
          proxy_port: data.settings.proxy_port?.toString() || '',
          proxy_username: '',
          proxy_password: '',
          daily_connection_limit: data.settings.daily_connection_limit || 25,
          daily_message_limit: data.settings.daily_message_limit || 50,
        });
      }
      return data.settings;
    },
    enabled: !!currentWorkspace?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ['linkedin-automation-stats', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const res = await fetch(`/api/linkedin-automation/stats?workspace_id=${currentWorkspace.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!currentWorkspace?.id,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      return apiRequest('/api/linkedin-automation/settings', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: currentWorkspace?.id,
          ...data,
          proxy_port: data.proxy_port ? parseInt(data.proxy_port) : null,
        }),
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
    },
    onSuccess: () => {
      toast({ title: 'Settings Saved', description: 'LinkedIn automation settings updated' });
      queryClient.invalidateQueries({ queryKey: ['linkedin-automation-settings'] });
      queryClient.invalidateQueries({ queryKey: ['linkedin-automation-stats'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleTestProxy = async () => {
    setTestingProxy(true);
    setTestResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      await saveMutation.mutateAsync(formData);
      
      const res = await fetch('/api/linkedin-automation/test-proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ workspace_id: currentWorkspace?.id })
      });
      
      const result = await res.json();
      setTestResult(result);
      
      if (result.success) {
        toast({ title: 'Proxy Connected', description: `Your IP: ${result.ip}` });
      } else {
        toast({ title: 'Proxy Failed', description: result.error, variant: 'destructive' });
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setTestingProxy(false);
    }
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Sticky Mobile Proxy Configuration
          </CardTitle>
          <CardDescription>
            Configure your personal mobile proxy for safe LinkedIn automation. Each user should have their own dedicated proxy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="flex items-center gap-3">
              <Wifi className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Enable Proxy</p>
                <p className="text-sm text-muted-foreground">Route LinkedIn traffic through your mobile proxy</p>
              </div>
            </div>
            <Switch
              checked={formData.proxy_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, proxy_enabled: checked })}
              data-testid="switch-proxy-enabled"
            />
          </div>

          {formData.proxy_enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proxy Provider</Label>
                  <Select
                    value={formData.proxy_provider}
                    onValueChange={(value) => setFormData({ ...formData, proxy_provider: value })}
                  >
                    <SelectTrigger data-testid="select-proxy-provider">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="decodo">Decodo Mobile - $2.25/GB (Recommended)</SelectItem>
                      <SelectItem value="anyip">AnyIP - $2/GB</SelectItem>
                      <SelectItem value="bright_data">Bright Data</SelectItem>
                      <SelectItem value="oxylabs">Oxylabs</SelectItem>
                      <SelectItem value="iproyal">IPRoyal</SelectItem>
                      <SelectItem value="custom">Custom Provider</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Proxy Host</Label>
                  <Input
                    placeholder="proxy.example.com"
                    value={formData.proxy_host}
                    onChange={(e) => setFormData({ ...formData, proxy_host: e.target.value })}
                    data-testid="input-proxy-host"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Proxy Port</Label>
                  <Input
                    type="number"
                    placeholder="8080"
                    value={formData.proxy_port}
                    onChange={(e) => setFormData({ ...formData, proxy_port: e.target.value })}
                    data-testid="input-proxy-port"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    placeholder="proxy_username"
                    value={formData.proxy_username}
                    onChange={(e) => setFormData({ ...formData, proxy_username: e.target.value })}
                    data-testid="input-proxy-username"
                  />
                  {settings?.proxy_username_encrypted && (
                    <p className="text-xs text-green-600">Username configured</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.proxy_password}
                    onChange={(e) => setFormData({ ...formData, proxy_password: e.target.value })}
                    data-testid="input-proxy-password"
                  />
                  {settings?.proxy_password_encrypted && (
                    <p className="text-xs text-green-600">Password configured</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleTestProxy}
                  disabled={testingProxy || !formData.proxy_host}
                  variant="outline"
                  data-testid="button-test-proxy"
                >
                  {testingProxy ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Globe className="h-4 w-4 mr-2" />
                  )}
                  Test Proxy Connection
                </Button>

                {testResult && (
                  <Badge variant={testResult.success ? "default" : "destructive"}>
                    {testResult.success ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected: {testResult.ip}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Failed
                      </>
                    )}
                  </Badge>
                )}
              </div>

              {stats?.current_ip && (
                <Alert>
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    Current IP: <span className="font-mono font-medium">{stats.current_ip}</span>
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Safety Limits
          </CardTitle>
          <CardDescription>
            Configure daily limits to keep your LinkedIn account safe
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Daily Connection Requests</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.daily_connection_limit}
                onChange={(e) => setFormData({ ...formData, daily_connection_limit: parseInt(e.target.value) || 0 })}
                data-testid="input-daily-connection-limit"
              />
              <p className="text-xs text-muted-foreground">
                Used today: {stats?.connections_sent_today || 0} / {formData.daily_connection_limit}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Daily Messages</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={formData.daily_message_limit}
                onChange={(e) => setFormData({ ...formData, daily_message_limit: parseInt(e.target.value) || 0 })}
                data-testid="input-daily-message-limit"
              />
              <p className="text-xs text-muted-foreground">
                Used today: {stats?.messages_sent_today || 0} / {formData.daily_message_limit}
              </p>
            </div>
          </div>

          <Alert className="bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Recommended limits:</strong> Start with 20-25 connections and 30-50 messages per day. 
              Increase gradually after 2 weeks of consistent use.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold">{stats.connections_sent_today || 0}</p>
                <p className="text-xs text-muted-foreground">Connections Today</p>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <p className="text-2xl font-bold">{stats.messages_sent_today || 0}</p>
                <p className="text-xs text-muted-foreground">Messages Today</p>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <Badge variant={stats.session_status === 'active' ? 'default' : 'secondary'}>
                  {stats.session_status || 'disconnected'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Session Status</p>
              </div>
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
                {stats.is_warming_up ? (
                  <>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                      <Zap className="h-3 w-3 mr-1" />
                      Day {stats.warmup_day}/14
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Warmup Mode</p>
                  </>
                ) : (
                  <>
                    <Badge variant="default" className="bg-green-600">Active</Badge>
                    <p className="text-xs text-muted-foreground mt-1">Fully Warmed Up</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        {onClose && (
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-proxy-config">
            Cancel
          </Button>
        )}
        <Button 
          onClick={handleSave} 
          disabled={saveMutation.isPending}
          data-testid="button-save-proxy-config"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
