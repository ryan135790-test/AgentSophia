import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  Gauge, 
  Mail, 
  Linkedin, 
  MessageSquare,
  Phone,
  AlertTriangle,
  Check,
  Loader2,
  Info,
  Clock
} from "lucide-react";

interface RateLimitConfig {
  channel: string;
  enabled: boolean;
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  cooldown_minutes: number;
  burst_limit: number;
}

export default function RateLimiting() {
  const { session } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const [configs, setConfigs] = useState<RateLimitConfig[]>([
    { channel: 'email', enabled: true, requests_per_minute: 30, requests_per_hour: 500, requests_per_day: 2000, cooldown_minutes: 5, burst_limit: 50 },
    { channel: 'linkedin', enabled: true, requests_per_minute: 5, requests_per_hour: 50, requests_per_day: 100, cooldown_minutes: 15, burst_limit: 10 },
    { channel: 'sms', enabled: true, requests_per_minute: 10, requests_per_hour: 100, requests_per_day: 500, cooldown_minutes: 5, burst_limit: 20 },
    { channel: 'phone', enabled: true, requests_per_minute: 2, requests_per_hour: 20, requests_per_day: 50, cooldown_minutes: 30, burst_limit: 5 },
    { channel: 'api', enabled: true, requests_per_minute: 60, requests_per_hour: 1000, requests_per_day: 10000, cooldown_minutes: 1, burst_limit: 100 },
  ]);

  const [globalEnabled, setGlobalEnabled] = useState(true);

  const saveMutation = useMutation({
    mutationFn: async (data: { global_enabled: boolean, configs: RateLimitConfig[] }) => {
      return apiRequest('/api/rate-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          workspace_id: currentWorkspace?.id,
          ...data
        })
      });
    },
    onSuccess: () => {
      toast.success('Rate limits saved!');
    },
    onError: () => {
      toast.error('Failed to save rate limits');
    }
  });

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return Mail;
      case 'linkedin': return Linkedin;
      case 'sms': return MessageSquare;
      case 'phone': return Phone;
      case 'api': return Shield;
      default: return Gauge;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'email': return 'Email Sending';
      case 'linkedin': return 'LinkedIn Actions';
      case 'sms': return 'SMS Messages';
      case 'phone': return 'Phone Calls';
      case 'api': return 'API Requests';
      default: return channel;
    }
  };

  const updateConfig = (channel: string, updates: Partial<RateLimitConfig>) => {
    setConfigs(prev => prev.map(c => 
      c.channel === channel ? { ...c, ...updates } : c
    ));
  };

  const handleSave = () => {
    saveMutation.mutate({
      global_enabled: globalEnabled,
      configs
    });
  };

  const resetToDefaults = () => {
    setConfigs([
      { channel: 'email', enabled: true, requests_per_minute: 30, requests_per_hour: 500, requests_per_day: 2000, cooldown_minutes: 5, burst_limit: 50 },
      { channel: 'linkedin', enabled: true, requests_per_minute: 5, requests_per_hour: 50, requests_per_day: 100, cooldown_minutes: 15, burst_limit: 10 },
      { channel: 'sms', enabled: true, requests_per_minute: 10, requests_per_hour: 100, requests_per_day: 500, cooldown_minutes: 5, burst_limit: 20 },
      { channel: 'phone', enabled: true, requests_per_minute: 2, requests_per_hour: 20, requests_per_day: 50, cooldown_minutes: 30, burst_limit: 5 },
      { channel: 'api', enabled: true, requests_per_minute: 60, requests_per_hour: 1000, requests_per_day: 10000, cooldown_minutes: 1, burst_limit: 100 },
    ]);
    toast.info('Reset to default values');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Rate Limiting</h1>
          <p className="text-muted-foreground mt-1">
            Control outreach velocity to protect your accounts and reputation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetToDefaults} data-testid="button-reset-defaults">
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-limits">
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Global Rate Limiting
          </CardTitle>
          <CardDescription>
            Enable or disable rate limiting across all channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch
                checked={globalEnabled}
                onCheckedChange={setGlobalEnabled}
                data-testid="switch-global-rate-limit"
              />
              <div>
                <p className="font-medium">Rate Limiting Enabled</p>
                <p className="text-sm text-muted-foreground">
                  Protect your accounts from being flagged or banned
                </p>
              </div>
            </div>
            <Badge variant={globalEnabled ? 'default' : 'secondary'}>
              {globalEnabled ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          
          {!globalEnabled && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Warning: Rate Limiting Disabled</p>
                <p className="text-sm text-muted-foreground">
                  Disabling rate limits may cause your email domains to be blacklisted or 
                  social accounts to be restricted. Proceed with caution.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList>
          {configs.map(config => {
            const Icon = getChannelIcon(config.channel);
            return (
              <TabsTrigger key={config.channel} value={config.channel} data-testid={`tab-${config.channel}`}>
                <Icon className="mr-2 h-4 w-4" />
                {getChannelLabel(config.channel).split(' ')[0]}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {configs.map(config => {
          const Icon = getChannelIcon(config.channel);
          return (
            <TabsContent key={config.channel} value={config.channel}>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle>{getChannelLabel(config.channel)}</CardTitle>
                        <CardDescription>Configure rate limits for {config.channel} operations</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`${config.channel}-enabled`}>Enabled</Label>
                      <Switch
                        id={`${config.channel}-enabled`}
                        checked={config.enabled}
                        onCheckedChange={(checked) => updateConfig(config.channel, { enabled: checked })}
                        data-testid={`switch-${config.channel}-enabled`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Per Minute</Label>
                        <span className="text-sm font-medium">{config.requests_per_minute}</span>
                      </div>
                      <Slider
                        value={[config.requests_per_minute]}
                        onValueChange={([v]) => updateConfig(config.channel, { requests_per_minute: v })}
                        max={config.channel === 'linkedin' ? 20 : 100}
                        min={1}
                        step={1}
                        disabled={!config.enabled}
                        data-testid={`slider-${config.channel}-per-minute`}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Per Hour</Label>
                        <span className="text-sm font-medium">{config.requests_per_hour}</span>
                      </div>
                      <Slider
                        value={[config.requests_per_hour]}
                        onValueChange={([v]) => updateConfig(config.channel, { requests_per_hour: v })}
                        max={config.channel === 'linkedin' ? 200 : 2000}
                        min={10}
                        step={10}
                        disabled={!config.enabled}
                        data-testid={`slider-${config.channel}-per-hour`}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Per Day</Label>
                        <span className="text-sm font-medium">{config.requests_per_day}</span>
                      </div>
                      <Slider
                        value={[config.requests_per_day]}
                        onValueChange={([v]) => updateConfig(config.channel, { requests_per_day: v })}
                        max={config.channel === 'linkedin' ? 500 : 10000}
                        min={50}
                        step={50}
                        disabled={!config.enabled}
                        data-testid={`slider-${config.channel}-per-day`}
                      />
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2 pt-4 border-t">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Cooldown Period (minutes)
                      </Label>
                      <Input
                        type="number"
                        value={config.cooldown_minutes}
                        onChange={(e) => updateConfig(config.channel, { cooldown_minutes: parseInt(e.target.value) || 1 })}
                        min={1}
                        max={60}
                        disabled={!config.enabled}
                        data-testid={`input-${config.channel}-cooldown`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Wait time after hitting rate limit
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Gauge className="h-4 w-4" />
                        Burst Limit
                      </Label>
                      <Input
                        type="number"
                        value={config.burst_limit}
                        onChange={(e) => updateConfig(config.channel, { burst_limit: parseInt(e.target.value) || 1 })}
                        min={1}
                        max={200}
                        disabled={!config.enabled}
                        data-testid={`input-${config.channel}-burst`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Maximum requests in a short burst
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      {config.channel === 'linkedin' && (
                        <p>LinkedIn has strict limits. We recommend staying under 100 connection requests and 50 messages per day to avoid restrictions.</p>
                      )}
                      {config.channel === 'email' && (
                        <p>New email domains should start with lower limits (50-100/day) and gradually increase over 2-4 weeks.</p>
                      )}
                      {config.channel === 'sms' && (
                        <p>SMS rates depend on your carrier. Check your provider's limits to avoid delivery issues.</p>
                      )}
                      {config.channel === 'phone' && (
                        <p>Phone call limits help prevent carrier blocks. Space calls throughout the day for best results.</p>
                      )}
                      {config.channel === 'api' && (
                        <p>API rate limits protect your integration from abuse. Adjust based on your usage patterns.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
