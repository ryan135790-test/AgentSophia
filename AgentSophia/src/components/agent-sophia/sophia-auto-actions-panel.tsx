import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Play, 
  Pause, 
  Settings,
  TrendingUp,
  Brain,
  Shield,
  Activity,
  RefreshCw
} from 'lucide-react';

interface AutoActionRule {
  id: string;
  name: string;
  description: string;
  trigger: { type: string; value?: any };
  enabled: boolean;
  requiresApproval: boolean;
  priority: number;
}

interface PendingAction {
  id: string;
  ruleId: string;
  ruleName: string;
  leadId: string;
  leadName: string;
  action: { type: string; params: any };
  status: string;
  createdAt: string;
}

interface AutonomySettings {
  enabled: boolean;
  autonomyLevel: number;
  approvalThreshold: number;
  maxActionsPerHour: number;
  maxActionsPerDay: number;
  workingHoursOnly: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
}

interface AutoActionStats {
  pendingCount: number;
  executedToday: number;
  executedThisHour: number;
  approvalRate: number;
  topRules: { ruleId: string; ruleName: string; executionCount: number }[];
}

export function SophiaAutoActionsPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AutonomySettings | null>(null);
  const [rules, setRules] = useState<AutoActionRule[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [stats, setStats] = useState<AutoActionStats | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [settingsRes, rulesRes, pendingRes, statsRes] = await Promise.all([
        fetch('/api/sophia/predictive/autonomy-settings'),
        fetch('/api/sophia/predictive/auto-rules'),
        fetch('/api/sophia/predictive/pending-actions'),
        fetch('/api/sophia/predictive/auto-action-stats')
      ]);

      const [settingsData, rulesData, pendingData, statsData] = await Promise.all([
        settingsRes.json(),
        rulesRes.json(),
        pendingRes.json(),
        statsRes.json()
      ]);

      if (settingsData.success) setSettings(settingsData.settings);
      if (rulesData.success) setRules(rulesData.rules);
      if (pendingData.success) setPending(pendingData.pending);
      if (statsData.success) setStats(statsData.stats);
    } catch (error) {
      console.error('Failed to fetch auto-action data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<AutonomySettings>) => {
    try {
      const res = await fetch('/api/sophia/predictive/autonomy-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.settings);
        toast({ title: 'Settings updated', description: 'Sophia autonomy settings saved.' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' });
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/sophia/predictive/auto-rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      const data = await res.json();
      if (data.success) {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r));
        toast({ title: enabled ? 'Rule enabled' : 'Rule disabled' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
    }
  };

  const approveAction = async (executionId: string) => {
    try {
      const res = await fetch(`/api/sophia/predictive/approve-action/${executionId}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setPending(prev => prev.filter(p => p.id !== executionId));
        toast({ title: 'Action approved', description: 'Sophia executed the action.' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to approve action', variant: 'destructive' });
    }
  };

  const rejectAction = async (executionId: string) => {
    try {
      const res = await fetch(`/api/sophia/predictive/reject-action/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by user' })
      });
      const data = await res.json();
      if (data.success) {
        setPending(prev => prev.filter(p => p.id !== executionId));
        toast({ title: 'Action rejected' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to reject action', variant: 'destructive' });
    }
  };

  const pauseActions = async () => {
    try {
      const res = await fetch('/api/sophia/predictive/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours: 1 })
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Auto-actions paused', description: 'Sophia will pause for 1 hour.' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const resumeActions = async () => {
    try {
      const res = await fetch('/api/sophia/predictive/resume', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Auto-actions resumed' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          <span>Loading auto-actions...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2" data-testid="auto-actions-title">
            <Zap className="h-5 w-5" />
            Sophia Auto-Actions
          </CardTitle>
          <CardDescription className="text-amber-100">
            Autonomous actions based on lead engagement and behavior
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white/20 rounded-lg p-3">
              <div className="text-2xl font-bold">{stats?.executedToday || 0}</div>
              <div className="text-xs text-amber-100">Actions Today</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <div className="text-2xl font-bold">{stats?.pendingCount || 0}</div>
              <div className="text-xs text-amber-100">Pending Approval</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <div className="text-2xl font-bold">{stats?.approvalRate || 100}%</div>
              <div className="text-xs text-amber-100">Approval Rate</div>
            </div>
            <div className="bg-white/20 rounded-lg p-3">
              <div className="text-2xl font-bold">{settings?.autonomyLevel || 50}%</div>
              <div className="text-xs text-amber-100">Autonomy Level</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">
            Auto-Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Pending Approvals
              </CardTitle>
              <CardDescription>
                Actions waiting for your approval before Sophia executes them
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pending.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
                  <p>No pending actions. Sophia is running smoothly!</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {pending.map((action) => (
                      <div key={action.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{action.action.type.replace('_', ' ')}</Badge>
                              <span className="text-sm font-medium">{action.ruleName}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Lead: <span className="font-medium">{action.leadName}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(action.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => rejectAction(action.id)}
                              data-testid={`btn-reject-${action.id}`}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button 
                              size="sm"
                              onClick={() => approveAction(action.id)}
                              data-testid={`btn-approve-${action.id}`}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-500" />
                Automation Rules
              </CardTitle>
              <CardDescription>
                Enable or disable rules that trigger Sophia's automatic actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id} 
                      className={`border rounded-lg p-4 transition-colors ${rule.enabled ? 'bg-green-50 dark:bg-green-900/10 border-green-200' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rule.name}</span>
                            {rule.requiresApproval && (
                              <Badge variant="secondary" className="text-xs">
                                <Shield className="h-3 w-3 mr-1" />
                                Requires Approval
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{rule.description}</p>
                          <Badge variant="outline" className="text-xs">
                            Trigger: {rule.trigger.type.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                          data-testid={`switch-rule-${rule.id}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-500" />
                Autonomy Settings
              </CardTitle>
              <CardDescription>
                Control how independently Sophia can act
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-Actions Enabled</p>
                  <p className="text-sm text-muted-foreground">Allow Sophia to take automatic actions</p>
                </div>
                <Switch
                  checked={settings?.enabled || false}
                  onCheckedChange={(checked) => updateSettings({ enabled: checked })}
                  data-testid="switch-auto-actions-enabled"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Autonomy Level</p>
                  <span className="text-sm font-bold">{settings?.autonomyLevel || 50}%</span>
                </div>
                <Slider
                  value={[settings?.autonomyLevel || 50]}
                  onValueChange={([value]) => updateSettings({ autonomyLevel: value })}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-autonomy-level"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Manual (0%)</span>
                  <span>Semi-Auto (50%)</span>
                  <span>Fully Auto (100%)</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Approval Threshold</p>
                  <span className="text-sm">{settings?.approvalThreshold || 70}%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Actions require approval when autonomy is below this threshold
                </p>
                <Slider
                  value={[settings?.approvalThreshold || 70]}
                  onValueChange={([value]) => updateSettings({ approvalThreshold: value })}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-approval-threshold"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Working Hours Only</p>
                  <p className="text-sm text-muted-foreground">
                    Only execute actions during business hours ({settings?.workingHoursStart} - {settings?.workingHoursEnd})
                  </p>
                </div>
                <Switch
                  checked={settings?.workingHoursOnly || false}
                  onCheckedChange={(checked) => updateSettings({ workingHoursOnly: checked })}
                  data-testid="switch-working-hours"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{settings?.maxActionsPerHour || 10}</p>
                  <p className="text-xs text-muted-foreground">Max Actions/Hour</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{settings?.maxActionsPerDay || 50}</p>
                  <p className="text-xs text-muted-foreground">Max Actions/Day</p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={pauseActions}
                  data-testid="btn-pause-actions"
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause 1 Hour
                </Button>
                <Button 
                  className="flex-1"
                  onClick={resumeActions}
                  data-testid="btn-resume-actions"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
