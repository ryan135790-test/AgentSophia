import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  Brain, TrendingUp, AlertTriangle, Lightbulb, DollarSign, CheckCircle2, 
  XCircle, ArrowRight, RefreshCw, Zap, Target, MessageSquare, Mail, Linkedin, Phone,
  Play, Clock, Settings2, Sparkles, History, ThumbsUp, ThumbsDown, Users, Send,
  Calendar, BarChart3, Activity, Pause, FastForward, ChevronDown, Eye
} from 'lucide-react';

interface LearningData {
  total_decisions: number;
  approval_rate: string;
  patterns_learned: number;
  patterns: string[];
  confidence_adjustments: { action: string; adjustment: number }[];
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  createdAt: string;
}

interface Recommendation {
  id: string;
  type: string;
  priority: string;
  title: string;
  description: string;
  reason: string;
  actionLabel: string;
  actionData: Record<string, any>;
  confidence: number;
  potentialImpact: string;
  createdAt: string;
}

interface RevenueData {
  total_attributed: string;
  autonomous_revenue: string;
  human_assisted_revenue: string;
  by_channel: { channel: string; revenue: number; deals: number }[];
  by_touchpoints: { touchpoints: number; deals: number; avgValue: number }[];
}

interface PendingApproval {
  id: string;
  stepId: string;
  channel: string;
  content: string;
  contactName: string;
  confidence: number;
  reason: string;
  createdAt: string;
}

interface SophiaThinking {
  decision: string;
  dataAnalyzed: string[];
  confidenceFactors: { factor: string; score: number }[];
}

interface ActionHistory {
  id: string;
  action: string;
  type: 'approved' | 'rejected' | 'auto_executed' | 'scheduled';
  channel: string;
  content?: string;
  result: string;
  executedAt: string;
  confidence?: number;
  reasoning?: string;
  contactId?: string;
  sophiaThinking?: SophiaThinking;
}

interface DashboardData {
  learning: LearningData;
  alerts: { total: number; critical: number; warnings: number; items: Alert[] };
  recommendations: { total: number; high_priority: number; items: Recommendation[] };
  revenue: RevenueData;
  pendingApprovals?: PendingApproval[];
  actionHistory?: ActionHistory[];
}

interface SophiaReportingDashboardProps {
  workspaceId?: string;
}

interface AutoExecuteSettings {
  enabled: boolean;
  confidenceThreshold: number;
  scheduledInterval: string;
  autonomyLevel: number;
  learningMode: boolean;
}

const DEMO_DASHBOARD_DATA: DashboardData = {
  learning: {
    total_decisions: 0,
    approval_rate: '0%',
    patterns_learned: 0,
    patterns: [],
    confidence_adjustments: []
  },
  alerts: { total: 0, critical: 0, warnings: 0, items: [] },
  recommendations: { total: 0, high_priority: 0, items: [] },
  revenue: {
    total_attributed: '$0',
    autonomous_revenue: '$0',
    human_assisted_revenue: '$0',
    by_channel: [],
    by_touchpoints: []
  }
};

const DEMO_PENDING_APPROVALS: PendingApproval[] = [];
const DEMO_ACTION_HISTORY: ActionHistory[] = [];

export function SophiaReportingDashboard({ workspaceId }: SophiaReportingDashboardProps) {
  const isDemo = workspaceId === 'demo';
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [actionHistory, setActionHistory] = useState<ActionHistory[]>([]);
  const [expandedHistoryItem, setExpandedHistoryItem] = useState<string | null>(null);
  const [autoSettings, setAutoSettings] = useState<AutoExecuteSettings>({
    enabled: false,
    confidenceThreshold: 80,
    scheduledInterval: 'off',
    autonomyLevel: 65,
    learningMode: true
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (isDemo) {
      setData(DEMO_DASHBOARD_DATA);
      setPendingApprovals(DEMO_PENDING_APPROVALS);
      setActionHistory(DEMO_ACTION_HISTORY);
      setLoading(false);
      return;
    }
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    fetchDashboardData();
    fetchAutoSettings();
    fetchPendingApprovals();
    fetchActionHistory();
  }, [workspaceId, isDemo]);

  const fetchAutoSettings = async () => {
    if (!workspaceId) return;
    try {
      const [autoResponse, brainResponse] = await Promise.all([
        fetch(`/api/sophia/reporting/auto-execute/settings?workspaceId=${workspaceId}`),
        fetch(`/api/sophia/state?workspace_id=${workspaceId}`)
      ]);
      
      let mergedSettings: AutoExecuteSettings = {
        enabled: false,
        confidenceThreshold: 80,
        scheduledInterval: 'off',
        autonomyLevel: 65,
        learningMode: true
      };
      
      if (brainResponse.ok) {
        const brainData = await brainResponse.json();
        mergedSettings.enabled = brainData.is_autonomous ?? false;
        mergedSettings.confidenceThreshold = brainData.approval_threshold ?? 80;
        mergedSettings.autonomyLevel = brainData.autonomy_level ?? 65;
        mergedSettings.learningMode = brainData.learning_mode ?? true;
      }
      
      if (autoResponse.ok) {
        const autoData = await autoResponse.json();
        if (autoData.success && autoData.settings) {
          mergedSettings.scheduledInterval = autoData.settings.scheduledInterval ?? 'off';
        }
      }
      
      setAutoSettings(mergedSettings);
    } catch (error) {
      console.error('Failed to fetch auto settings:', error);
    }
  };

  const saveAutoSettings = async (newSettings: Partial<AutoExecuteSettings>) => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Settings changes are not saved in demo mode', variant: 'default' });
      setAutoSettings({ ...autoSettings, ...newSettings });
      return;
    }
    const updated = { ...autoSettings, ...newSettings };
    setAutoSettings(updated);
    
    try {
      await Promise.all([
        fetch('/api/sophia/reporting/auto-execute/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            scheduledInterval: updated.scheduledInterval,
            workspaceId 
          })
        }),
        fetch('/api/sophia/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            is_autonomous: updated.enabled,
            approval_threshold: updated.confidenceThreshold,
            autonomy_level: updated.autonomyLevel,
            learning_mode: updated.learningMode
          })
        })
      ]);
      toast({ title: 'Settings synced', description: 'Brain control and auto-execute settings updated' });
    } catch (error) {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const response = await fetch(`/api/sophia/pending-approvals${workspaceId ? `?workspaceId=${workspaceId}` : ''}`);
      if (response.ok) {
        const result = await response.json();
        setPendingApprovals(result.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch pending approvals:', error);
    }
  };

  const fetchActionHistory = async () => {
    try {
      const response = await fetch(`/api/sophia/reporting/action-history${workspaceId ? `?workspaceId=${workspaceId}` : ''}`);
      if (response.ok) {
        const result = await response.json();
        setActionHistory(result.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch action history:', error);
    }
  };

  const handleApprove = async (approvalId: string) => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Actions cannot be approved in demo mode' });
      return;
    }
    setActionLoading(`approve-${approvalId}`);
    try {
      const response = await fetch(`/api/sophia/approve/${approvalId}`, { method: 'POST' });
      if (response.ok) {
        toast({ title: 'Approved', description: 'Action has been approved and queued for execution' });
        fetchPendingApprovals();
        fetchActionHistory();
      }
    } catch (error) {
      toast({ title: 'Failed to approve', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (approvalId: string) => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Actions cannot be rejected in demo mode' });
      return;
    }
    setActionLoading(`reject-${approvalId}`);
    try {
      const response = await fetch(`/api/sophia/reject/${approvalId}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Rejected by user' })
      });
      if (response.ok) {
        toast({ title: 'Rejected', description: 'Action has been rejected' });
        fetchPendingApprovals();
        fetchActionHistory();
      }
    } catch (error) {
      toast({ title: 'Failed to reject', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const approveAllPending = async () => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Bulk actions are not available in demo mode' });
      return;
    }
    setActionLoading('approve-all');
    try {
      for (const approval of pendingApprovals) {
        await fetch(`/api/sophia/approve/${approval.id}`, { method: 'POST' });
      }
      toast({ title: 'All approved', description: `Approved ${pendingApprovals.length} pending actions` });
      fetchPendingApprovals();
      fetchActionHistory();
    } catch (error) {
      toast({ title: 'Failed to approve all', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const letSophiaHandleIt = async () => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Auto-execution is not available in demo mode' });
      return;
    }
    setActionLoading('handle-all');
    try {
      const response = await fetch('/api/sophia/reporting/auto-execute/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workspaceId,
          confidenceThreshold: autoSettings.confidenceThreshold 
        })
      });
      const result = await response.json();
      
      if (result.success) {
        toast({ 
          title: 'Sophia is on it!', 
          description: `Executed ${result.executed} actions automatically` 
        });
        fetchDashboardData();
        fetchPendingApprovals();
        fetchActionHistory();
      } else {
        toast({ title: 'Execution failed', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Failed to execute', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const url = workspaceId 
        ? `/api/sophia/reporting/dashboard?workspaceId=${workspaceId}`
        : '/api/sophia/reporting/dashboard';
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast({ title: 'Failed to load dashboard', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    setActionLoading('generate');
    try {
      const response = await fetch('/api/sophia/reporting/recommendations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Recommendations generated', description: `${result.recommendations.length} new recommendations` });
        fetchDashboardData();
      }
    } catch (error) {
      toast({ title: 'Failed to generate', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const executeRecommendation = async (rec: Recommendation) => {
    setActionLoading(rec.id);
    
    try {
      if (rec.actionData?.url) {
        navigate(rec.actionData.url);
        toast({ title: 'Navigating...', description: rec.title });
        setActionLoading(null);
        return;
      }

      const response = await fetch(`/api/sophia/reporting/recommendations/${rec.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: rec.type,
          actionData: rec.actionData
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        if (result.result?.redirectUrl) {
          navigate(result.result.redirectUrl);
        }
        toast({ 
          title: 'Action executed', 
          description: result.result?.details || rec.title 
        });
        fetchDashboardData();
      } else {
        toast({ title: 'Action failed', description: result.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Action failed', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const dismissRecommendation = async (recId: string) => {
    try {
      await fetch(`/api/sophia/reporting/recommendations/${recId}/dismiss`, {
        method: 'POST'
      });
      toast({ title: 'Recommendation dismissed' });
      fetchDashboardData();
    } catch (error) {
      toast({ title: 'Failed to dismiss', variant: 'destructive' });
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    try {
      await fetch(`/api/sophia/reporting/alerts/${alertId}/acknowledge`, {
        method: 'POST'
      });
      toast({ title: 'Alert acknowledged' });
      fetchDashboardData();
    } catch (error) {
      toast({ title: 'Failed to acknowledge', variant: 'destructive' });
    }
  };

  const checkAlerts = async () => {
    setActionLoading('alerts');
    try {
      const response = await fetch('/api/sophia/reporting/alerts/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Alerts checked', description: `${result.alerts.length} alerts found` });
        fetchDashboardData();
      }
    } catch (error) {
      toast({ title: 'Failed to check alerts', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <p>Loading Sophia's insights...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-slate-500">No data available</p>
        </CardContent>
      </Card>
    );
  }

  const channelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'linkedin': return <Linkedin className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-600" />
            Sophia Reporting Dashboard
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Insights, recommendations, and performance metrics
          </p>
        </div>
        <Button onClick={fetchDashboardData} variant="outline" size="sm" data-testid="button-refresh-dashboard">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="border-2 border-purple-500 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Sophia Autonomous Controls
            <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-300">
              <RefreshCw className="h-3 w-3 mr-1" />
              Synced with Brain Control
            </Badge>
          </CardTitle>
          <CardDescription className="flex items-center justify-between">
            <span>Let Sophia take action automatically based on her recommendations</span>
            <Button 
              variant="link" 
              size="sm" 
              className="text-purple-600 p-0 h-auto"
              onClick={() => navigate('/sophia-admin')}
              data-testid="link-brain-control"
            >
              <Brain className="h-3 w-3 mr-1" />
              Open Brain Control for more options
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-purple-600" />
                  <span className="font-medium text-sm">Auto-Execute</span>
                </div>
                <Switch
                  checked={autoSettings.enabled}
                  onCheckedChange={(checked) => saveAutoSettings({ enabled: checked })}
                  data-testid="switch-auto-execute"
                />
              </div>
              <p className="text-xs text-slate-500">
                {autoSettings.enabled 
                  ? 'Sophia will execute high-confidence actions automatically' 
                  : 'Manual approval required for all actions'}
              </p>
              {autoSettings.enabled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">Confidence threshold</span>
                    <span className="text-xs font-bold text-purple-600">{autoSettings.confidenceThreshold}%</span>
                  </div>
                  <Slider
                    value={[autoSettings.confidenceThreshold]}
                    onValueChange={([value]) => saveAutoSettings({ confidenceThreshold: value })}
                    min={50}
                    max={95}
                    step={5}
                    className="w-full"
                    data-testid="slider-confidence"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-sm">Scheduled Actions</span>
              </div>
              <Select 
                value={autoSettings.scheduledInterval} 
                onValueChange={(value) => saveAutoSettings({ scheduledInterval: value })}
              >
                <SelectTrigger className="w-full" data-testid="select-schedule">
                  <SelectValue placeholder="Select schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off - Manual only</SelectItem>
                  <SelectItem value="hourly">Every hour</SelectItem>
                  <SelectItem value="daily">Once per day</SelectItem>
                  <SelectItem value="realtime">Real-time (as detected)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                {autoSettings.scheduledInterval === 'off' 
                  ? 'Sophia waits for your command'
                  : autoSettings.scheduledInterval === 'realtime'
                  ? 'Sophia acts immediately when conditions are met'
                  : `Sophia reviews and acts ${autoSettings.scheduledInterval}`}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-purple-600" />
                <span className="font-medium text-sm">One-Click Execution</span>
              </div>
              <Button
                onClick={letSophiaHandleIt}
                disabled={actionLoading === 'handle-all'}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                data-testid="button-let-sophia-handle"
              >
                {actionLoading === 'handle-all' ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sophia is working...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Let Sophia Handle It
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500">
                Execute all recommendations above {autoSettings.confidenceThreshold}% confidence now
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-600" />
              Decisions Learned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-total-decisions">{data.learning.total_decisions}</p>
            <p className="text-xs text-slate-500">{data.learning.patterns_learned} patterns identified</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              Approval Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600" data-testid="text-approval-rate">{data.learning.approval_rate}</p>
            <Progress value={parseFloat(data.learning.approval_rate)} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-alerts-count">{data.alerts.total}</p>
            <p className="text-xs text-slate-500">{data.alerts.critical} critical, {data.alerts.warnings} warnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Revenue Attributed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600" data-testid="text-revenue">{data.revenue.total_attributed}</p>
            <p className="text-xs text-slate-500">{data.revenue.autonomous_revenue} autonomous</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="live" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="live" data-testid="tab-live">
            <Activity className="h-4 w-4 mr-1" />
            Live Feed
          </TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">
            <Clock className="h-4 w-4 mr-1" />
            Pending ({pendingApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">
            <Lightbulb className="h-4 w-4 mr-1" />
            Recommendations ({data.recommendations.total})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-1" />
            History
          </TabsTrigger>
          <TabsTrigger value="goals" data-testid="tab-goals">
            <Target className="h-4 w-4 mr-1" />
            Goals
          </TabsTrigger>
          <TabsTrigger value="focus" data-testid="tab-focus">
            <Zap className="h-4 w-4 mr-1" />
            Focus Mode
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-learning">
            <Brain className="h-4 w-4 mr-1" />
            Learning
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Alerts ({data.alerts.total})
          </TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">
            <DollarSign className="h-4 w-4 mr-1" />
            Revenue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600 animate-pulse" />
                  Live Activity Feed
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                    Live
                  </Badge>
                </CardTitle>
                <CardDescription>Real-time stream of Sophia's observations and actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto" data-testid="live-activity-feed">
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">No activity yet</p>
                    <p className="text-xs">Activity will appear here when Sophia executes campaign actions</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4 text-blue-600" />
                    Currently Watching
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Active Campaigns</span>
                    <span className="font-bold text-blue-600" data-testid="stat-active-campaigns">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Contacts in Sequences</span>
                    <span className="font-bold text-purple-600" data-testid="stat-contacts-sequences">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Pending Responses</span>
                    <span className="font-bold text-amber-600" data-testid="stat-pending-responses">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Hot Leads</span>
                    <span className="font-bold text-red-600" data-testid="stat-hot-leads">0</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Sophia's Current Priority
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg" data-testid="sophia-current-priority">
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-300">No active priority</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Start campaigns to see Sophia's priorities</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-green-600" />
                    Today's Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Actions Taken</span>
                    <span className="font-bold">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Responses Generated</span>
                    <span className="font-bold text-green-600">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Meetings Booked</span>
                    <span className="font-bold text-blue-600">0</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="goals" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-600" />
                  Active Goals
                </CardTitle>
                <CardDescription>Set targets for Sophia to work towards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'Book 10 meetings this week', progress: 40, current: 4, target: 10, deadline: '3 days left' },
                  { name: 'Qualify 50 new leads', progress: 72, current: 36, target: 50, deadline: '5 days left' },
                  { name: 'Increase email response rate to 15%', progress: 85, current: 12.8, target: 15, deadline: 'Ongoing', unit: '%' },
                ].map((goal, idx) => (
                  <div key={idx} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{goal.name}</span>
                      <Badge variant={goal.progress >= 75 ? 'default' : 'secondary'}>{goal.deadline}</Badge>
                    </div>
                    <Progress value={goal.progress} className="h-2 mb-2" />
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{goal.current}{goal.unit || ''} / {goal.target}{goal.unit || ''}</span>
                      <span className="font-medium text-purple-600">{goal.progress}% complete</span>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full" data-testid="button-add-goal">
                  <Target className="h-4 w-4 mr-2" />
                  Add New Goal
                </Button>
                <p className="text-xs text-slate-400 italic">Demo goals - configure your own targets</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  What-If Simulator
                </CardTitle>
                <CardDescription>Predict outcomes of autonomy changes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-4">
                  <div>
                    <label className="text-sm font-medium">If autonomy level is:</label>
                    <div className="flex items-center gap-2 mt-2">
                      <Slider defaultValue={[75]} min={0} max={100} step={5} className="flex-1" />
                      <span className="text-sm font-bold w-12">75%</span>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Sophia predicts:</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1"><Send className="h-3 w-3" /> Daily actions</span>
                        <span className="font-bold text-green-600">+45% more</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Response time</span>
                        <span className="font-bold text-green-600">-2 hours faster</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Meetings/week</span>
                        <span className="font-bold text-green-600">+3 more</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Risk level</span>
                        <span className="font-bold text-amber-600">Low-Medium</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button className="w-full bg-purple-600 hover:bg-purple-700" data-testid="button-apply-autonomy">
                  Apply This Autonomy Level
                </Button>
                <p className="text-xs text-slate-400 italic text-center">Predictions based on historical patterns</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="focus" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-600" />
                  Focus Mode
                </CardTitle>
                <CardDescription>Tell Sophia what to prioritize</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    { id: 'hot-leads', label: 'Hot Leads First', description: 'Prioritize contacts with high engagement scores', active: true },
                    { id: 'new-contacts', label: 'New Contact Outreach', description: 'Focus on initial touches to new leads', active: false },
                    { id: 'meeting-booking', label: 'Meeting Booking', description: 'Aggressively pursue meeting confirmations', active: true },
                    { id: 'nurture', label: 'Relationship Nurturing', description: 'Maintain engagement with existing contacts', active: false },
                  ].map((mode) => (
                    <div key={mode.id} className={`p-4 border rounded-lg ${mode.active ? 'border-purple-300 bg-purple-50 dark:bg-purple-950/30' : ''}`} data-testid={`focus-mode-${mode.id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{mode.label}</p>
                          <p className="text-xs text-slate-500">{mode.description}</p>
                        </div>
                        <Switch checked={mode.active} data-testid={`switch-focus-${mode.id}`} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-slate-400 italic">Focus modes influence Sophia's prioritization</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Contact Memory
                </CardTitle>
                <CardDescription>What Sophia remembers about your contacts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'John Smith', company: 'Acme Corp', memory: 'Prefers morning emails, responded well to case studies, decision maker', score: 92 },
                  { name: 'Sarah Johnson', company: 'TechStart', memory: 'LinkedIn active, likes industry insights, budget holder', score: 87 },
                  { name: 'Mike Chen', company: 'Growth Labs', memory: 'Quick responder, prefers short messages, met at conference', score: 78 },
                ].map((contact, idx) => (
                  <div key={idx} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{contact.name}</p>
                        <p className="text-xs text-slate-500">{contact.company}</p>
                      </div>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700">
                        <Brain className="h-3 w-3 mr-1" />
                        {contact.score}%
                      </Badge>
                    </div>
                    <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-xs text-blue-700 dark:text-blue-400">
                      <Lightbulb className="h-3 w-3 inline mr-1" />
                      {contact.memory}
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full" data-testid="button-view-all-memories">
                  View All Contact Memories
                </Button>
                <p className="text-xs text-slate-400 italic text-center">Sophia builds memory from interactions</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                    Pending Approvals
                  </CardTitle>
                  <CardDescription>Actions waiting for your review before execution</CardDescription>
                </div>
                {pendingApprovals.length > 0 && (
                  <Button 
                    onClick={approveAllPending}
                    disabled={actionLoading === 'approve-all'}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-approve-all"
                  >
                    {actionLoading === 'approve-all' ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4 mr-2" />
                    )}
                    Approve All ({pendingApprovals.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {pendingApprovals.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="font-medium">All caught up!</p>
                  <p className="text-sm">No actions pending your approval</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingApprovals.map((approval) => (
                    <div 
                      key={approval.id}
                      className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                      data-testid={`card-approval-${approval.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {approval.channel === 'email' && <Mail className="h-4 w-4 text-blue-600" />}
                            {approval.channel === 'linkedin' && <Linkedin className="h-4 w-4 text-blue-700" />}
                            {approval.channel === 'sms' && <MessageSquare className="h-4 w-4 text-green-600" />}
                            {approval.channel === 'phone' && <Phone className="h-4 w-4 text-purple-600" />}
                            <Badge variant="outline">{approval.channel}</Badge>
                            <span className="text-sm font-medium">{approval.contactName}</span>
                            <Badge variant={approval.confidence >= 80 ? 'default' : 'secondary'}>
                              {approval.confidence}% confidence
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                            {approval.content}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Reason: {approval.reason}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => handleApprove(approval.id)}
                            disabled={actionLoading === `approve-${approval.id}`}
                            data-testid={`button-approve-${approval.id}`}
                          >
                            {actionLoading === `approve-${approval.id}` ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <ThumbsUp className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(approval.id)}
                            disabled={actionLoading === `reject-${approval.id}`}
                            data-testid={`button-reject-${approval.id}`}
                          >
                            {actionLoading === `reject-${approval.id}` ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <ThumbsDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-slate-600" />
                Action History
              </CardTitle>
              <CardDescription>Recent actions executed by Sophia</CardDescription>
            </CardHeader>
            <CardContent>
              {actionHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No action history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {actionHistory.map((item) => (
                    <div 
                      key={item.id}
                      className="border rounded-lg overflow-hidden"
                      data-testid={`card-history-${item.id}`}
                    >
                      <div 
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"
                        onClick={() => setExpandedHistoryItem(expandedHistoryItem === item.id ? null : item.id)}
                      >
                        <div className="flex items-center gap-3">
                          {item.type === 'approved' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {item.type === 'rejected' && <XCircle className="h-4 w-4 text-red-600" />}
                          {item.type === 'auto_executed' && <Zap className="h-4 w-4 text-purple-600" />}
                          {item.type === 'scheduled' && <Calendar className="h-4 w-4 text-blue-600" />}
                          <div>
                            <p className="text-sm font-medium">{item.action}</p>
                            <p className="text-xs text-slate-500">{item.result}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{item.channel}</Badge>
                          {item.confidence && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              <Brain className="h-3 w-3 mr-1" />
                              {item.confidence}%
                            </Badge>
                          )}
                          <span className="text-xs text-slate-500">
                            {new Date(item.executedAt).toLocaleString()}
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedHistoryItem === item.id ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                      
                      {expandedHistoryItem === item.id && (
                        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t space-y-3">
                          {item.reasoning && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                              <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                                <Lightbulb className="h-3 w-3" />
                                Sophia's Reasoning:
                              </p>
                              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">{item.reasoning}</p>
                            </div>
                          )}
                          
                          {item.sophiaThinking && (
                            <>
                              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                                <p className="text-xs font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-1">
                                  <Brain className="h-3 w-3" />
                                  Decision:
                                </p>
                                <p className="text-sm text-purple-700 dark:text-purple-400 mt-1">{item.sophiaThinking.decision}</p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Data Analyzed:</p>
                                  <ul className="text-xs space-y-1">
                                    {item.sophiaThinking.dataAnalyzed.map((data, idx) => (
                                      <li key={idx} className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                        <Eye className="h-3 w-3" /> {data}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Confidence Factors:</p>
                                  <div className="space-y-1">
                                    {item.sophiaThinking.confidenceFactors.map((factor, idx) => (
                                      <div key={idx} className="flex items-center justify-between text-xs">
                                        <span className="text-slate-600 dark:text-slate-400">{factor.factor}</span>
                                        <span className={`font-medium ${factor.score >= 85 ? 'text-green-600' : factor.score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                          {factor.score}%
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                          
                          {item.content && (
                            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Content Preview:</p>
                              <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-3">{item.content}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Actionable Recommendations</CardTitle>
                  <CardDescription>Sophia's suggestions to improve your campaigns</CardDescription>
                </div>
                <Button 
                  onClick={generateRecommendations} 
                  disabled={actionLoading === 'generate'}
                  size="sm"
                  data-testid="button-generate-recommendations"
                >
                  {actionLoading === 'generate' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Generate New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.recommendations.items.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No recommendations yet. Click "Generate New" to analyze your campaigns.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.recommendations.items.map((rec) => (
                    <div 
                      key={rec.id} 
                      className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                      data-testid={`card-recommendation-${rec.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant={rec.priority === 'high' ? 'destructive' : 'secondary'}>
                              {rec.priority}
                            </Badge>
                            <Badge variant="outline">{rec.type}</Badge>
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              <Brain className="h-3 w-3 mr-1" />
                              {rec.confidence}% confident
                            </Badge>
                          </div>
                          <h4 className="font-medium text-base">{rec.title}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{rec.description}</p>
                          
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1">
                              <Lightbulb className="h-3 w-3" />
                              Why Sophia recommends this:
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">{rec.reason}</p>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-green-600" />
                              Expected impact: {rec.potentialImpact}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(rec.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={() => executeRecommendation(rec)}
                            disabled={actionLoading === rec.id}
                            data-testid={`button-action-${rec.id}`}
                          >
                            {actionLoading === rec.id ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                {rec.actionLabel}
                                <ArrowRight className="h-4 w-4 ml-1" />
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissRecommendation(rec.id)}
                            data-testid={`button-dismiss-${rec.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="mt-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Learning Velocity
                  </CardTitle>
                  <CardDescription>How Sophia's accuracy is improving over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-end justify-between gap-2 border-b border-l p-4">
                    {[
                      { week: 'Week 1', accuracy: 65 },
                      { week: 'Week 2', accuracy: 72 },
                      { week: 'Week 3', accuracy: 78 },
                      { week: 'Week 4', accuracy: 82 },
                      { week: 'Week 5', accuracy: 85 },
                      { week: 'Week 6', accuracy: 89 },
                      { week: 'This Week', accuracy: 92 },
                    ].map((data, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                        <div 
                          className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t transition-all hover:from-purple-700 hover:to-purple-500"
                          style={{ height: `${data.accuracy * 1.5}px` }}
                          title={`${data.accuracy}%`}
                        />
                        <span className="text-xs text-slate-500 truncate">{data.week.replace('Week ', 'W')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-slate-500">
                    <span>Started at 65%</span>
                    <span className="text-green-600 font-bold">Now at 92% (+27%)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    Learning Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{data.learning.total_decisions}</p>
                    <p className="text-xs text-slate-500">Total decisions analyzed</p>
                  </div>
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{data.learning.patterns_learned}</p>
                    <p className="text-xs text-slate-500">Patterns identified</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{data.learning.approval_rate}</p>
                    <p className="text-xs text-slate-500">Approval rate</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-600" />
                    Success Stories
                  </CardTitle>
                  <CardDescription>Wins attributed to Sophia's autonomous actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { title: 'Meeting booked with Enterprise Lead', contact: 'John Smith (Acme Corp)', action: 'Auto-sent follow-up at optimal time', revenue: '$45,000 potential', date: '2 days ago' },
                    { title: 'Re-engaged cold lead', contact: 'Sarah Johnson (TechStart)', action: 'Detected buying signal and sent case study', revenue: '$28,000 potential', date: '4 days ago' },
                    { title: 'Converted trial user', contact: 'Mike Chen (Growth Labs)', action: 'Timed outreach based on usage patterns', revenue: '$12,500 closed', date: '1 week ago' },
                  ].map((story, idx) => (
                    <div key={idx} className="p-3 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm text-green-800 dark:text-green-300">{story.title}</p>
                          <p className="text-xs text-slate-600">{story.contact}</p>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> {story.action}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-green-600">{story.revenue}</Badge>
                          <p className="text-xs text-slate-500 mt-1">{story.date}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    Before vs After Sophia
                  </CardTitle>
                  <CardDescription>Performance comparison since enabling Sophia</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { metric: 'Response Rate', before: 8, after: 18, unit: '%', improvement: '+125%' },
                    { metric: 'Avg Response Time', before: 4.5, after: 0.5, unit: 'hrs', improvement: '-89%', inverted: true },
                    { metric: 'Meetings/Week', before: 3, after: 8, unit: '', improvement: '+167%' },
                    { metric: 'Lead Qualification', before: 45, after: 78, unit: '%', improvement: '+73%' },
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{item.metric}</span>
                        <span className={`font-bold ${item.inverted ? 'text-green-600' : (item.after > item.before ? 'text-green-600' : 'text-red-600')}`}>
                          {item.improvement}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 w-12">Before</span>
                            <div className="flex-1 bg-slate-200 rounded-full h-2">
                              <div className="bg-slate-400 h-2 rounded-full" style={{ width: `${(item.before / Math.max(item.before, item.after)) * 100}%` }} />
                            </div>
                            <span className="text-xs w-16 text-right">{item.before}{item.unit}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500 w-12">After</span>
                            <div className="flex-1 bg-purple-100 rounded-full h-2">
                              <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${(item.after / Math.max(item.before, item.after)) * 100}%` }} />
                            </div>
                            <span className="text-xs w-16 text-right font-medium text-purple-600">{item.after}{item.unit}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Learned Patterns</CardTitle>
                  <CardDescription>What Sophia has learned from your decisions</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.learning.patterns.length === 0 ? (
                    <p className="text-slate-500 text-sm">No patterns learned yet</p>
                  ) : (
                    <div className="space-y-2">
                      {data.learning.patterns.map((pattern, idx) => (
                        <div 
                          key={idx} 
                          className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg text-sm"
                          data-testid={`text-pattern-${idx}`}
                        >
                          💡 {pattern}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Confidence Adjustments</CardTitle>
                  <CardDescription>How Sophia is calibrating per action type</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.learning.confidence_adjustments.length === 0 ? (
                    <p className="text-slate-500 text-sm">No adjustments yet</p>
                  ) : (
                    <div className="space-y-3">
                      {data.learning.confidence_adjustments.map((adj, idx) => (
                        <div key={idx} className="flex items-center justify-between" data-testid={`row-adjustment-${idx}`}>
                          <span className="font-medium text-sm">{adj.action}</span>
                          <Badge variant={adj.adjustment > 0 ? 'default' : 'destructive'}>
                            {adj.adjustment > 0 ? '+' : ''}{adj.adjustment}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Health Alerts</CardTitle>
                  <CardDescription>Issues that need your attention</CardDescription>
                </div>
                <Button 
                  onClick={checkAlerts} 
                  disabled={actionLoading === 'alerts'}
                  size="sm"
                  variant="outline"
                  data-testid="button-check-alerts"
                >
                  {actionLoading === 'alerts' ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  Check Now
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.alerts.items.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p>No active alerts. Everything looks good!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.alerts.items.map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-4 border rounded-lg ${
                        alert.severity === 'critical' 
                          ? 'border-red-300 bg-red-50 dark:bg-red-950/30' 
                          : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                      }`}
                      data-testid={`card-alert-${alert.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {alert.severity}
                            </Badge>
                            <span className="text-xs text-slate-500">{alert.type}</span>
                          </div>
                          <h4 className="font-medium">{alert.title}</h4>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{alert.message}</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => acknowledgeAlert(alert.id)}
                          data-testid={`button-acknowledge-${alert.id}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue by Channel</CardTitle>
                <CardDescription>How each channel contributes to revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {data.revenue.by_channel.length === 0 ? (
                  <p className="text-slate-500 text-sm">No revenue data yet</p>
                ) : (
                  <div className="space-y-3">
                    {data.revenue.by_channel.map((ch, idx) => (
                      <div key={idx} className="flex items-center justify-between" data-testid={`row-channel-revenue-${idx}`}>
                        <div className="flex items-center gap-2">
                          {channelIcon(ch.channel)}
                          <span className="font-medium capitalize">{ch.channel}</span>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">${ch.revenue.toLocaleString()}</p>
                          <p className="text-xs text-slate-500">{ch.deals} deals</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Revenue Attribution</CardTitle>
                <CardDescription>Autonomous vs human-assisted</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-600" />
                      <span>Autonomous Revenue</span>
                    </div>
                    <span className="font-bold text-purple-600" data-testid="text-autonomous-revenue">
                      {data.revenue.autonomous_revenue}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-600" />
                      <span>Human-Assisted</span>
                    </div>
                    <span className="font-bold text-blue-600" data-testid="text-human-revenue">
                      {data.revenue.human_assisted_revenue}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
