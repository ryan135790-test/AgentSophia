import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  Shield, 
  Clock, 
  Users, 
  MessageSquare, 
  Zap,
  Save,
  RotateCcw,
  Info,
  RefreshCw
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';

interface SafetyOverrideSettings {
  autoStopOnLowAcceptance: boolean;
  acceptanceRateThreshold: number;
  withdrawOldInvitations: boolean;
  pendingInvitationLimit: number;
  pauseOnRestriction: boolean;
  workingHoursOnly: boolean;
  workingHoursStart: number;
  workingHoursEnd: number;
  warmupEnabled: boolean;
  dailyConnectionLimit: number;
  dailyMessageLimit: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
}

const defaultSettings: SafetyOverrideSettings = {
  autoStopOnLowAcceptance: true,
  acceptanceRateThreshold: 25,
  withdrawOldInvitations: true,
  pendingInvitationLimit: 700,
  pauseOnRestriction: true,
  workingHoursOnly: true,
  workingHoursStart: 9,
  workingHoursEnd: 18,
  warmupEnabled: true,
  dailyConnectionLimit: 25,
  dailyMessageLimit: 22,
  minDelaySeconds: 45,
  maxDelaySeconds: 180,
};

interface LinkedInSafetyOverridesProps {
  accountId?: string;
}

export function LinkedInSafetyOverrides({ accountId }: LinkedInSafetyOverridesProps = {}) {
  const [settings, setSettings] = useState<SafetyOverrideSettings>(defaultSettings);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    loadSettings();
  }, [accountId, currentWorkspace?.id]);

  const loadSettings = async () => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const effectiveAccountId = accountId || currentWorkspace.id;
      
      const response = await fetch(`/api/linkedin-safety/accounts/${effectiveAccountId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings({
            autoStopOnLowAcceptance: data.settings.safetyFeatures?.autoStopOnLowAcceptance ?? defaultSettings.autoStopOnLowAcceptance,
            acceptanceRateThreshold: data.settings.safetyFeatures?.acceptanceRateThreshold ?? defaultSettings.acceptanceRateThreshold,
            withdrawOldInvitations: data.settings.safetyFeatures?.withdrawOldInvitations ?? defaultSettings.withdrawOldInvitations,
            pendingInvitationLimit: data.settings.safetyFeatures?.pendingInvitationLimit ?? defaultSettings.pendingInvitationLimit,
            pauseOnRestriction: data.settings.safetyFeatures?.pauseOnRestriction ?? defaultSettings.pauseOnRestriction,
            workingHoursOnly: data.settings.activityHours?.workingHoursOnly ?? defaultSettings.workingHoursOnly,
            workingHoursStart: data.settings.activityHours?.start ?? defaultSettings.workingHoursStart,
            workingHoursEnd: data.settings.activityHours?.end ?? defaultSettings.workingHoursEnd,
            warmupEnabled: data.settings.warmUpMode ?? defaultSettings.warmupEnabled,
            dailyConnectionLimit: data.settings.dailyLimits?.connectionRequests ?? defaultSettings.dailyConnectionLimit,
            dailyMessageLimit: data.settings.dailyLimits?.messages ?? defaultSettings.dailyMessageLimit,
            minDelaySeconds: data.settings.actionDelays?.min ?? defaultSettings.minDelaySeconds,
            maxDelaySeconds: data.settings.actionDelays?.max ?? defaultSettings.maxDelaySeconds,
          });
        }
      }
    } catch (error) {
      console.error('Error loading safety settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof SafetyOverrideSettings>(
    key: K,
    value: SafetyOverrideSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  const saveSettings = async () => {
    if (!currentWorkspace?.id) {
      toast({ title: 'Error', description: 'No workspace selected', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const effectiveAccountId = accountId || currentWorkspace.id;
      
      const updatePayload = {
        warmUpMode: settings.warmupEnabled,
        dailyLimits: {
          connectionRequests: settings.dailyConnectionLimit,
          messages: settings.dailyMessageLimit,
        },
        activityHours: {
          workingHoursOnly: settings.workingHoursOnly,
          start: settings.workingHoursStart,
          end: settings.workingHoursEnd,
        },
        actionDelays: {
          min: settings.minDelaySeconds,
          max: settings.maxDelaySeconds,
        },
        safetyFeatures: {
          autoStopOnLowAcceptance: settings.autoStopOnLowAcceptance,
          acceptanceRateThreshold: settings.acceptanceRateThreshold,
          withdrawOldInvitations: settings.withdrawOldInvitations,
          pendingInvitationLimit: settings.pendingInvitationLimit,
          pauseOnRestriction: settings.pauseOnRestriction,
        }
      };
      
      const response = await fetch(`/api/linkedin-safety/accounts/${effectiveAccountId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify(updatePayload)
      });
      
      if (response.ok) {
        toast({ title: 'Settings saved', description: 'Your safety override settings have been updated.' });
        setHasChanges(false);
      } else {
        const error = await response.json();
        toast({ title: 'Error', description: error.error || 'Failed to save settings', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const riskLevel = calculateRiskLevel(settings);

  return (
    <div className="space-y-6" data-testid="linkedin-safety-overrides">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Safety Override Controls</h3>
          <p className="text-sm text-muted-foreground">
            Customize Sophia's LinkedIn safety enforcement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={riskLevel === 'low' ? 'default' : riskLevel === 'medium' ? 'secondary' : 'destructive'}
            data-testid="risk-level-badge"
          >
            {riskLevel === 'low' && <Shield className="w-3 h-3 mr-1" />}
            {riskLevel === 'medium' && <AlertTriangle className="w-3 h-3 mr-1" />}
            {riskLevel === 'high' && <Zap className="w-3 h-3 mr-1" />}
            {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk
          </Badge>
        </div>
      </div>

      {riskLevel === 'high' && (
        <Alert variant="destructive" data-testid="high-risk-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>High Risk Configuration</AlertTitle>
          <AlertDescription>
            Your current settings significantly increase the risk of LinkedIn account restrictions. 
            Sophia recommends enabling more safety features.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-acceptance-rate">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Acceptance Rate Protection
            </CardTitle>
            <CardDescription>
              Auto-pause when connection acceptance rate drops
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-stop" className="flex items-center gap-2">
                Enable auto-pause
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Sophia will pause automation if acceptance rate falls below threshold</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Switch
                id="auto-stop"
                checked={settings.autoStopOnLowAcceptance}
                onCheckedChange={(checked) => updateSetting('autoStopOnLowAcceptance', checked)}
                data-testid="switch-auto-stop"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Threshold: {settings.acceptanceRateThreshold}%</Label>
                <span className="text-xs text-muted-foreground">
                  Default: 25%
                </span>
              </div>
              <Slider
                value={[settings.acceptanceRateThreshold]}
                onValueChange={([value]) => updateSetting('acceptanceRateThreshold', value)}
                min={5}
                max={50}
                step={5}
                disabled={!settings.autoStopOnLowAcceptance}
                data-testid="slider-acceptance-threshold"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-invitations">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Manage old connection requests automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="withdraw-old">Auto-withdraw old invitations</Label>
              <Switch
                id="withdraw-old"
                checked={settings.withdrawOldInvitations}
                onCheckedChange={(checked) => updateSetting('withdrawOldInvitations', checked)}
                data-testid="switch-withdraw-old"
              />
            </div>
            <div className="space-y-2">
              <Label>Maximum pending: {settings.pendingInvitationLimit}</Label>
              <Slider
                value={[settings.pendingInvitationLimit]}
                onValueChange={([value]) => updateSetting('pendingInvitationLimit', value)}
                min={100}
                max={1000}
                step={50}
                data-testid="slider-pending-limit"
              />
              <p className="text-xs text-muted-foreground">
                LinkedIn may flag accounts with 700+ pending invitations
              </p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-business-hours">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Activity Timing
            </CardTitle>
            <CardDescription>
              Control when automation runs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="working-hours">Business hours only</Label>
              <Switch
                id="working-hours"
                checked={settings.workingHoursOnly}
                onCheckedChange={(checked) => updateSetting('workingHoursOnly', checked)}
                data-testid="switch-working-hours"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start hour</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.workingHoursStart}
                  onChange={(e) => updateSetting('workingHoursStart', parseInt(e.target.value))}
                  disabled={!settings.workingHoursOnly}
                  data-testid="input-hours-start"
                />
              </div>
              <div className="space-y-2">
                <Label>End hour</Label>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={settings.workingHoursEnd}
                  onChange={(e) => updateSetting('workingHoursEnd', parseInt(e.target.value))}
                  disabled={!settings.workingHoursOnly}
                  data-testid="input-hours-end"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="pause-restriction">Pause on LinkedIn restriction</Label>
              <Switch
                id="pause-restriction"
                checked={settings.pauseOnRestriction}
                onCheckedChange={(checked) => updateSetting('pauseOnRestriction', checked)}
                data-testid="switch-pause-restriction"
              />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-daily-limits">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Daily Limits
            </CardTitle>
            <CardDescription>
              Override Sophia's calculated daily limits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="warmup">Enable warmup mode</Label>
              <Switch
                id="warmup"
                checked={settings.warmupEnabled}
                onCheckedChange={(checked) => updateSetting('warmupEnabled', checked)}
                data-testid="switch-warmup"
              />
            </div>
            <div className="space-y-2">
              <Label>Connection requests/day: {settings.dailyConnectionLimit}</Label>
              <Slider
                value={[settings.dailyConnectionLimit]}
                onValueChange={([value]) => updateSetting('dailyConnectionLimit', value)}
                min={5}
                max={50}
                step={5}
                data-testid="slider-daily-connections"
              />
              <p className="text-xs text-muted-foreground">
                {settings.dailyConnectionLimit > 25 ? (
                  <span className="text-destructive">Above recommended limit of 25</span>
                ) : (
                  <span>Within safe range (max 25 recommended)</span>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Messages/day: {settings.dailyMessageLimit}</Label>
              <Slider
                value={[settings.dailyMessageLimit]}
                onValueChange={([value]) => updateSetting('dailyMessageLimit', value)}
                min={5}
                max={50}
                step={5}
                data-testid="slider-daily-messages"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-action-delays">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Action Delay Settings</CardTitle>
          <CardDescription>
            Random delays between actions to appear human-like
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Minimum delay: {settings.minDelaySeconds}s</Label>
              <Slider
                value={[settings.minDelaySeconds]}
                onValueChange={([value]) => updateSetting('minDelaySeconds', value)}
                min={10}
                max={120}
                step={5}
                data-testid="slider-min-delay"
              />
            </div>
            <div className="space-y-2">
              <Label>Maximum delay: {settings.maxDelaySeconds}s</Label>
              <Slider
                value={[settings.maxDelaySeconds]}
                onValueChange={([value]) => updateSetting('maxDelaySeconds', value)}
                min={60}
                max={300}
                step={10}
                data-testid="slider-max-delay"
              />
            </div>
          </div>
          {settings.minDelaySeconds < 30 && (
            <p className="text-xs text-destructive mt-2">
              Delays under 30 seconds may trigger bot detection
            </p>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={resetToDefaults}
          disabled={saving}
          data-testid="button-reset-defaults"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Sophia Defaults
        </Button>
        <Button
          onClick={saveSettings}
          disabled={!hasChanges || saving}
          data-testid="button-save-settings"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Override Settings'}
        </Button>
      </div>
    </div>
  );
}

function calculateRiskLevel(settings: SafetyOverrideSettings): 'low' | 'medium' | 'high' {
  let riskScore = 0;

  if (!settings.autoStopOnLowAcceptance) riskScore += 2;
  if (settings.acceptanceRateThreshold < 15) riskScore += 1;
  if (!settings.withdrawOldInvitations) riskScore += 1;
  if (settings.pendingInvitationLimit > 800) riskScore += 1;
  if (!settings.pauseOnRestriction) riskScore += 2;
  if (!settings.workingHoursOnly) riskScore += 1;
  if (!settings.warmupEnabled) riskScore += 2;
  if (settings.dailyConnectionLimit > 30) riskScore += 2;
  if (settings.dailyConnectionLimit > 40) riskScore += 1;
  if (settings.minDelaySeconds < 30) riskScore += 2;

  if (riskScore <= 2) return 'low';
  if (riskScore <= 5) return 'medium';
  return 'high';
}
