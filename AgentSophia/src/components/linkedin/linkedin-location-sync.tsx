import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  MapPin, RefreshCw, Clock, CheckCircle, AlertCircle,
  Loader2, Globe, Shield, Zap, Navigation
} from "lucide-react";
import { format } from "date-fns";

interface LocationSyncStatus {
  enabled: boolean;
  current_location: string | null;
  proxy_country: string | null;
  last_sync_at: string | null;
  next_sync_at: string | null;
  sync_frequency: number;
  auto_detect_enabled: boolean;
  detected_location: string | null;
  sync_count_today: number;
}

const SYNC_TIMES = [
  { label: "4x daily (every 6 hours)", value: 4 },
  { label: "6x daily (every 4 hours)", value: 6 },
  { label: "8x daily (every 3 hours)", value: 8 },
  { label: "12x daily (every 2 hours)", value: 12 },
];

const COUNTRIES = [
  { code: "us", name: "United States", flag: "🇺🇸" },
  { code: "gb", name: "United Kingdom", flag: "🇬🇧" },
  { code: "ca", name: "Canada", flag: "🇨🇦" },
  { code: "au", name: "Australia", flag: "🇦🇺" },
  { code: "de", name: "Germany", flag: "🇩🇪" },
  { code: "fr", name: "France", flag: "🇫🇷" },
  { code: "nl", name: "Netherlands", flag: "🇳🇱" },
  { code: "es", name: "Spain", flag: "🇪🇸" },
  { code: "it", name: "Italy", flag: "🇮🇹" },
  { code: "jp", name: "Japan", flag: "🇯🇵" },
  { code: "sg", name: "Singapore", flag: "🇸🇬" },
  { code: "br", name: "Brazil", flag: "🇧🇷" },
  { code: "in", name: "India", flag: "🇮🇳" },
  { code: "mx", name: "Mexico", flag: "🇲🇽" },
];

export function LinkedInLocationSync() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [syncing, setSyncing] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState<{ country: string; city: string; ip: string } | null>(null);

  const { data: syncStatus, isLoading, refetch } = useQuery({
    queryKey: ['linkedin-location-sync', currentWorkspace?.id],
    queryFn: async () => {
      if (!currentWorkspace?.id) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const res = await fetch(`/api/linkedin-automation/location-sync/status?workspace_id=${currentWorkspace.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      if (!res.ok) return null;
      return res.json() as Promise<LocationSyncStatus>;
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 60000,
  });

  const detectLocationMutation = useMutation({
    mutationFn: async () => {
      setDetecting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const res = await fetch('/api/linkedin-automation/location-sync/detect', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workspace_id: currentWorkspace?.id })
      });
      
      if (!res.ok) throw new Error('Failed to detect location');
      return res.json();
    },
    onSuccess: (data) => {
      setDetectedLocation(data);
      toast({ 
        title: 'Location Detected', 
        description: `Your current location: ${data.city}, ${data.country}` 
      });
    },
    onError: (error: any) => {
      toast({ title: 'Detection Failed', description: error.message, variant: 'destructive' });
    },
    onSettled: () => setDetecting(false)
  });

  const syncNowMutation = useMutation({
    mutationFn: async (targetCountry?: string) => {
      setSyncing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      const res = await fetch('/api/linkedin-automation/location-sync/sync-now', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          workspace_id: currentWorkspace?.id,
          target_country: targetCountry 
        })
      });
      
      if (!res.ok) throw new Error('Failed to sync location');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Location Synced', 
        description: `Proxy location synced to ${data.country} (IP: ${data.ip})` 
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['linkedin-automation-settings'] });
    },
    onError: (error: any) => {
      toast({ title: 'Sync Failed', description: error.message, variant: 'destructive' });
    },
    onSettled: () => setSyncing(false)
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: { 
      location_sync_enabled?: boolean;
      sync_frequency?: number;
      auto_detect_enabled?: boolean;
      manual_country?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      return apiRequest('/api/linkedin-automation/location-sync/settings', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: currentWorkspace?.id,
          ...settings
        }),
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
    },
    onSuccess: () => {
      toast({ title: 'Settings Updated' });
      refetch();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const getCountryDisplay = (code: string | null) => {
    if (!code) return "Not set";
    const country = COUNTRIES.find(c => c.code === code);
    return country ? `${country.flag} ${country.name}` : code.toUpperCase();
  };

  const getNextSyncTime = () => {
    if (!syncStatus?.next_sync_at) return "Not scheduled";
    return format(new Date(syncStatus.next_sync_at), "h:mm a");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          Location Sync
        </CardTitle>
        <CardDescription>
          Keep your proxy location synced with your real location to mimic authentic user behavior
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-green-500" />
            <div>
              <p className="font-medium">Auto Location Sync</p>
              <p className="text-sm text-muted-foreground">
                Automatically sync proxy location throughout the day
              </p>
            </div>
          </div>
          <Switch
            checked={syncStatus?.enabled || false}
            onCheckedChange={(checked) => updateSettingsMutation.mutate({ location_sync_enabled: checked })}
            data-testid="switch-location-sync"
          />
        </div>

        {syncStatus?.enabled && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Current Proxy Location</span>
                </div>
                <p className="text-lg font-semibold">
                  {getCountryDisplay(syncStatus?.proxy_country || null)}
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Navigation className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Detected Location</span>
                </div>
                <p className="text-lg font-semibold">
                  {detectedLocation 
                    ? `${detectedLocation.city}, ${detectedLocation.country}`
                    : syncStatus?.detected_location || "Not detected"
                  }
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Last Sync</span>
                </div>
                <p className="text-sm">
                  {syncStatus?.last_sync_at 
                    ? format(new Date(syncStatus.last_sync_at), "MMM d, h:mm a")
                    : "Never"
                  }
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Next Sync</span>
                </div>
                <p className="text-sm">{getNextSyncTime()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Zap className="h-3 w-3" />
                {syncStatus?.sync_count_today || 0} syncs today
              </Badge>
              {syncStatus?.enabled && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Active
                </Badge>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <Select
                  value={syncStatus?.sync_frequency?.toString() || "4"}
                  onValueChange={(value) => updateSettingsMutation.mutate({ sync_frequency: parseInt(value) })}
                >
                  <SelectTrigger data-testid="select-sync-frequency">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    {SYNC_TIMES.map((time) => (
                      <SelectItem key={time.value} value={time.value.toString()}>
                        {time.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-Detect Location</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically detect your location before each sync
                  </p>
                </div>
                <Switch
                  checked={syncStatus?.auto_detect_enabled || false}
                  onCheckedChange={(checked) => updateSettingsMutation.mutate({ auto_detect_enabled: checked })}
                  data-testid="switch-auto-detect"
                />
              </div>

              {!syncStatus?.auto_detect_enabled && (
                <div className="space-y-2">
                  <Label>Manual Country Override</Label>
                  <Select
                    value={syncStatus?.proxy_country || ""}
                    onValueChange={(value) => updateSettingsMutation.mutate({ manual_country: value })}
                  >
                    <SelectTrigger data-testid="select-manual-country">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.flag} {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => detectLocationMutation.mutate()}
                disabled={detecting}
                data-testid="button-detect-location"
              >
                {detecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4 mr-2" />
                )}
                Detect My Location
              </Button>
              
              <Button
                onClick={() => syncNowMutation.mutate(detectedLocation?.country)}
                disabled={syncing}
                data-testid="button-sync-now"
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Location sync updates your Decodo proxy country parameter to match your current location, 
                making your LinkedIn activity appear more authentic. This runs automatically 
                {syncStatus?.sync_frequency || 4}x per day.
              </AlertDescription>
            </Alert>
          </>
        )}

        {!syncStatus?.enabled && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Enable location sync to automatically keep your proxy IP location aligned with your 
              real location. This mimics natural user behavior and reduces detection risk. 
              Recommended: sync at least 4 times daily.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
