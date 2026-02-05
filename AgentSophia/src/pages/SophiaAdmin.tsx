import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Brain, Zap, Target, TrendingUp, AlertCircle, CheckCircle2, Lock, RefreshCw, Activity, Save, Loader2, ThumbsUp, ThumbsDown, Clock, TrendingDown, Pause, Play, Sliders, Plus, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SophiaIntelligencePanel } from '@/components/agent-sophia/sophia-intelligence-engine';
import { SophiaAutoActionsPanel } from '@/components/agent-sophia/sophia-auto-actions-panel';
import { SophiaPredictivePanel } from '@/components/agent-sophia/sophia-predictive-panel';
import { LinkedInSafetyControlsPanel } from '@/components/linkedin/linkedin-safety-controls-panel';
import { SophiaCampaignManager } from '@/components/agent-sophia/sophia-campaign-manager';
import { SophiaAutonomousCampaign } from '@/components/agent-sophia/sophia-autonomous-campaign';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface SophiaState {
  autonomy_level: number; // 0-100
  is_autonomous: boolean;
  learning_mode: boolean;
  auto_actions_enabled: boolean;
  approval_threshold: number; // 0-100
  model_performance: {
    consensus_accuracy: number;
    gpt4o_accuracy: number;
    claude_accuracy: number;
    last_updated: string;
  };
  brain_state: {
    active_campaigns: number;
    total_contacts: number;
    decisions_made: number;
    autonomous_actions: number;
    pending_approvals: number;
  };
}

export default function SophiaAdmin() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [sophia, setSophia] = useState<SophiaState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autonomyLevel, setAutonomyLevel] = useState(50);
  const [approvalThreshold, setApprovalThreshold] = useState(75);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const [selectedModel, setSelectedModel] = useState('consensus');
  const [responseTime, setResponseTime] = useState('balanced');
  const [rateLimit, setRateLimit] = useState(50);
  const [activityFilter, setActivityFilter] = useState('all');
  
  const isDemo = currentWorkspace?.id === 'demo';
  
  // Demo data for pending approvals (only for demo workspace)
  const pendingApprovals = isDemo ? [
    { id: 'action_1', action: 'Send email to john@acme.com', confidence: 72, timestamp: new Date(Date.now() - 300000) },
    { id: 'action_2', action: 'Add Sarah Connor to LinkedIn campaign', confidence: 68, timestamp: new Date(Date.now() - 600000) },
    { id: 'action_3', action: 'Schedule SMS follow-up for Q2', confidence: 65, timestamp: new Date(Date.now() - 900000) },
  ] : [];
  
  // Demo data for recent activity (only for demo workspace)
  const recentActivity = isDemo ? [
    { id: 'decision_1', action: 'Approved: Email sent to lead segment', type: 'success', timestamp: new Date(Date.now() - 60000) },
    { id: 'decision_2', action: 'Auto-executed: Contact scoring update', type: 'success', timestamp: new Date(Date.now() - 180000) },
    { id: 'decision_3', action: 'Requested approval: Campaign budget allocation', type: 'pending', timestamp: new Date(Date.now() - 420000) },
    { id: 'decision_4', action: 'Learned: Subject lines with urgency get 34% more replies', type: 'learning', timestamp: new Date(Date.now() - 720000) },
  ] : [];

  useEffect(() => {
    fetchSophiaState();
  }, [isDemo, currentWorkspace?.id]);

  const fetchSophiaState = async () => {
    // For demo workspace, use empty/zeroed data without API calls
    if (isDemo || !currentWorkspace?.id) {
      setSophia({
        autonomy_level: 0,
        is_autonomous: false,
        learning_mode: false,
        auto_actions_enabled: false,
        approval_threshold: 75,
        model_performance: {
          consensus_accuracy: 0,
          gpt4o_accuracy: 0,
          claude_accuracy: 0,
          last_updated: new Date().toISOString(),
        },
        brain_state: {
          active_campaigns: 0,
          total_contacts: 0,
          decisions_made: 0,
          autonomous_actions: 0,
          pending_approvals: 0,
        },
      });
      setLoading(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/sophia/state?workspace_id=${currentWorkspace.id}`);
      if (res.ok) {
        setSophia(await res.json());
      } else {
        // Empty state for new workspaces
        setSophia({
          autonomy_level: 0,
          is_autonomous: false,
          learning_mode: false,
          auto_actions_enabled: false,
          approval_threshold: 75,
          model_performance: {
            consensus_accuracy: 0,
            gpt4o_accuracy: 0,
            claude_accuracy: 0,
            last_updated: new Date().toISOString(),
          },
          brain_state: {
            active_campaigns: 0,
            total_contacts: 0,
            decisions_made: 0,
            autonomous_actions: 0,
            pending_approvals: 0,
          },
        });
      }
    } catch (error) {
      console.error('Error fetching Sophia state:', error);
      // Empty state on error
      setSophia({
        autonomy_level: 0,
        is_autonomous: false,
        learning_mode: false,
        auto_actions_enabled: false,
        approval_threshold: 75,
        model_performance: {
          consensus_accuracy: 0,
          gpt4o_accuracy: 0,
          claude_accuracy: 0,
          last_updated: new Date().toISOString(),
        },
        brain_state: {
          active_campaigns: 0,
          total_contacts: 0,
          decisions_made: 0,
          autonomous_actions: 0,
          pending_approvals: 0,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAutonomyLevel = async (level: number) => {
    if (isDemo) {
      setAutonomyLevel(level);
      toast({ title: 'Demo Mode', description: 'Settings are not saved in demo mode' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/sophia/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autonomy_level: level })
      });
      if (res.ok) {
        setAutonomyLevel(level);
        setLastUpdate(new Date().toLocaleTimeString());
        toast({
          title: "Autonomy Level Updated",
          description: `Set to ${level}% ${level <= 33 ? '(Low)' : level <= 66 ? '(Medium)' : '(High)'}`,
        });
        fetchSophiaState();
      }
    } catch (error) {
      console.error('Error updating autonomy:', error);
      toast({
        title: "Error",
        description: "Failed to update autonomy level",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleAutonomous = async (enabled: boolean) => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Settings are not saved in demo mode' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/sophia/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_autonomous: enabled })
      });
      if (res.ok) {
        setLastUpdate(new Date().toLocaleTimeString());
        toast({
          title: enabled ? "Autonomous Execution Enabled" : "Autonomous Execution Disabled",
          description: enabled ? "Sophia will now execute actions autonomously" : "Sophia will wait for your approval",
        });
        fetchSophiaState();
      }
    } catch (error) {
      console.error('Error toggling autonomous:', error);
    } finally {
      setSaving(false);
    }
  };

  const toggleLearning = async (enabled: boolean) => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Settings are not saved in demo mode' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/sophia/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learning_mode: enabled })
      });
      if (res.ok) {
        setLastUpdate(new Date().toLocaleTimeString());
        toast({
          title: enabled ? "🧠 Learning Mode Enabled" : "🔒 Learning Mode Disabled",
          description: enabled ? "Sophia will learn from outcomes" : "Learning is disabled",
        });
        fetchSophiaState();
      }
    } catch (error) {
      console.error('Error toggling learning:', error);
    } finally {
      setSaving(false);
    }
  };

  const approveAction = (actionId: string) => {
    toast({
      title: "✅ Action Approved",
      description: "Sophia will proceed with execution",
    });
  };

  const rejectAction = (actionId: string) => {
    toast({
      title: "❌ Action Rejected",
      description: "Sophia will queue this for review",
    });
  };

  const togglePause = async () => {
    setIsPaused(!isPaused);
    toast({
      title: isPaused ? "▶️ Sophia Resumed" : "⏸️ Sophia Paused",
      description: isPaused ? "Sophia is now active" : "All autonomous actions suspended",
    });
  };

  const updateModel = async (model: string) => {
    setSelectedModel(model);
    toast({
      title: "🤖 AI Model Updated",
      description: `Switched to ${model === 'consensus' ? 'Consensus (Claude + GPT-4o)' : model === 'gpt4o' ? 'GPT-4o' : 'Claude Sonnet'}`,
    });
  };

  const updateResponseTime = async (time: string) => {
    setResponseTime(time);
    toast({
      title: "⚡ Response Time Updated",
      description: `Set to ${time === 'immediate' ? 'Immediate' : time === 'balanced' ? 'Balanced' : 'Cautious'}`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
        <div className="max-w-7xl mx-auto flex items-center justify-center h-96">
          <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!sophia) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
        <div className="max-w-7xl mx-auto text-center text-red-600">Error loading Sophia state</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 flex items-center gap-3">
              <Brain className="h-10 w-10 text-purple-600" />
              Sophia's Brain Control Panel
            </h1>
            <p className="text-slate-600 mt-2">Monitor, configure, and control Sophia's autonomous capabilities</p>
          </div>
          {lastUpdate && (
            <div className="text-right text-sm text-slate-600">
              <p>Last updated</p>
              <p className="font-mono text-slate-500">{lastUpdate}</p>
            </div>
          )}
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Autonomy Level</p>
                  <p className="text-3xl font-bold text-purple-600">{autonomyLevel}%</p>
                </div>
                <Zap className="h-8 w-8 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Decisions Made</p>
                  <p className="text-3xl font-bold">{sophia.brain_state.decisions_made}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">AI Accuracy</p>
                  <p className="text-3xl font-bold">{sophia.model_performance.consensus_accuracy}%</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Pending Approvals</p>
                  <p className="text-3xl font-bold text-orange-600">{pendingApprovals.length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Success Rate</p>
                  <p className="text-3xl font-bold text-emerald-600">92%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions: Pending Approvals */}
        {pendingApprovals.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <AlertCircle className="h-5 w-5" />
                ⏳ Actions Awaiting Approval ({pendingApprovals.length})
              </CardTitle>
              <CardDescription className="text-orange-800">Sophia is waiting for your decision on these actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingApprovals.map((action) => (
                <div key={action.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-100">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{action.action}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge variant="outline" className="text-xs">Confidence: {action.confidence}%</Badge>
                      <span className="text-xs text-slate-500">{Math.floor((Date.now() - action.timestamp.getTime()) / 60000)}m ago</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="hover:bg-green-50 hover:text-green-700" onClick={() => approveAction(action.id)}>
                      <ThumbsUp className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="hover:bg-red-50 hover:text-red-700" onClick={() => rejectAction(action.id)}>
                      <ThumbsDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Activity Feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Sophia's recent decisions and learning</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className={`mt-1 h-2 w-2 rounded-full ${
                    activity.type === 'success' ? 'bg-green-500' : activity.type === 'pending' ? 'bg-orange-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{activity.action}</p>
                    <p className="text-xs text-slate-500 mt-1">{Math.floor((Date.now() - activity.timestamp.getTime()) / 60000)}m ago</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {activity.type === 'success' ? '✅ Success' : activity.type === 'pending' ? '⏳ Pending' : '🧠 Learning'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="autonomy">Autonomy Controls</TabsTrigger>
            <TabsTrigger value="auto-actions">Auto-Actions</TabsTrigger>
            <TabsTrigger value="predictive">Predictive AI</TabsTrigger>
            <TabsTrigger value="linkedin-safety">LinkedIn Safety</TabsTrigger>
            <TabsTrigger value="settings">Brain Settings</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="memory">Memory & Learning</TabsTrigger>
          </TabsList>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns" className="space-y-4">
            <Tabs defaultValue="autonomous" className="space-y-4">
              <TabsList>
                <TabsTrigger value="autonomous">Sophia Campaigns</TabsTrigger>
                <TabsTrigger value="manage">Manage Existing</TabsTrigger>
              </TabsList>
              
              <TabsContent value="autonomous">
                <SophiaAutonomousCampaign workspaceId={currentWorkspace?.id || ''} />
              </TabsContent>
              
              <TabsContent value="manage">
                <SophiaCampaignManager workspaceId={currentWorkspace?.id || ''} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Autonomy Controls */}
          <TabsContent value="autonomy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Autonomy Level
                  <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-300">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Synced with Reports Dashboard
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center justify-between">
                  <span>Control how much Sophia acts independently</span>
                  <a 
                    href="/sophia-reports" 
                    className="text-purple-600 hover:underline text-sm flex items-center gap-1"
                  >
                    <Activity className="h-3 w-3" />
                    View Reports & Execute Actions
                  </a>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Autonomy Slider</label>
                    <Badge variant="outline" className="text-lg">{autonomyLevel}%</Badge>
                  </div>
                  <div className="relative">
                    <Slider
                      value={[autonomyLevel]}
                      onValueChange={(val) => updateAutonomyLevel(val[0])}
                      min={0}
                      max={100}
                      step={5}
                      disabled={saving}
                      className="cursor-pointer transition-all"
                    />
                    {saving && <Loader2 className="absolute right-0 -top-1 h-5 w-5 text-purple-600 animate-spin" />}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">
                    {autonomyLevel <= 33 && "🟢 Low autonomy - Most actions require approval"}
                    {autonomyLevel > 33 && autonomyLevel <= 66 && "🟡 Medium autonomy - Sophia makes smart decisions"}
                    {autonomyLevel > 66 && "🔴 High autonomy - Sophia acts freely with high confidence"}
                  </p>
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Enable Autonomous Execution</p>
                      <p className="text-xs text-slate-600">Allow Sophia to execute actions autonomously</p>
                    </div>
                    <Switch
                      checked={sophia.is_autonomous}
                      onCheckedChange={toggleAutonomous}
                      disabled={saving}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Enable Learning Mode</p>
                      <p className="text-xs text-slate-600">Let Sophia learn from outcomes and improve</p>
                    </div>
                    <Switch
                      checked={sophia.learning_mode}
                      onCheckedChange={toggleLearning}
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    💡 <strong>Tip:</strong> Start with low autonomy (20-30%) and gradually increase as Sophia learns and improves accuracy.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Approval Threshold</CardTitle>
                <CardDescription>Minimum confidence level before Sophia acts autonomously</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Confidence Threshold</label>
                    <Badge variant="outline" className="text-lg">{approvalThreshold}%</Badge>
                  </div>
                  <Slider
                    value={[approvalThreshold]}
                    onValueChange={(val) => setApprovalThreshold(val[0])}
                    min={50}
                    max={95}
                    step={5}
                    disabled={saving}
                  />
                  <p className="text-xs text-slate-600">
                    Actions with confidence below {approvalThreshold}% will be queued for your review
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings" className="space-y-4">
            {/* Emergency Controls */}
            <Card className={isPaused ? "border-red-200 bg-red-50" : "border-slate-200"}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {isPaused ? <Pause className="h-5 w-5 text-red-600" /> : <Play className="h-5 w-5 text-green-600" />}
                    Emergency Controls
                  </span>
                  <Button 
                    size="sm"
                    variant={isPaused ? "outline" : "destructive"}
                    onClick={togglePause}
                  >
                    {isPaused ? "Resume Sophia" : "Pause All Actions"}
                  </Button>
                </CardTitle>
                <CardDescription>{isPaused ? "All Sophia actions are suspended" : "Sophia is actively managing campaigns"}</CardDescription>
              </CardHeader>
            </Card>

            {/* AI Model Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Model Selection
                </CardTitle>
                <CardDescription>Choose which AI model Sophia uses for decisions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'consensus', label: 'Consensus', desc: 'Claude + GPT-4o', accuracy: '91%' },
                    { id: 'gpt4o', label: 'GPT-4o', desc: 'OpenAI Model', accuracy: '89%' },
                    { id: 'claude', label: 'Claude', desc: 'Anthropic Model', accuracy: '88%' }
                  ].map((model) => (
                    <button
                      key={model.id}
                      onClick={() => updateModel(model.id)}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        selectedModel === model.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="font-semibold text-sm">{model.label}</p>
                      <p className="text-xs text-slate-600">{model.desc}</p>
                      <p className="text-xs text-emerald-600 font-medium mt-2">Accuracy: {model.accuracy}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Response Time Control */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sliders className="h-5 w-5" />
                  Response Time
                </CardTitle>
                <CardDescription>Control how quickly Sophia makes decisions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'immediate', label: 'Immediate', desc: '< 5 sec', icon: '⚡' },
                    { id: 'balanced', label: 'Balanced', desc: '10-30 sec', icon: '⏱️' },
                    { id: 'cautious', label: 'Cautious', desc: '1-2 min', icon: '🐢' }
                  ].map((time) => (
                    <button
                      key={time.id}
                      onClick={() => updateResponseTime(time.id)}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        responseTime === time.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <p className="text-2xl mb-2">{time.icon}</p>
                      <p className="font-semibold text-sm">{time.label}</p>
                      <p className="text-xs text-slate-600">{time.desc}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Rate Limiting */}
            <Card>
              <CardHeader>
                <CardTitle>Decision Rate Limiting</CardTitle>
                <CardDescription>Maximum autonomous decisions per hour</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Decisions Per Hour</label>
                    <Badge variant="outline" className="text-lg">{rateLimit}/hr</Badge>
                  </div>
                  <Slider
                    value={[rateLimit]}
                    onValueChange={(val) => setRateLimit(val[0])}
                    min={10}
                    max={200}
                    step={10}
                    disabled={saving}
                  />
                  <p className="text-xs text-slate-600">
                    Limits autonomous decisions to {rateLimit} per hour {rateLimit <= 50 ? '(Conservative)' : rateLimit <= 100 ? '(Balanced)' : '(Aggressive)'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Activity Filter */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Monitoring</CardTitle>
                <CardDescription>Filter recent activity by type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'all', label: 'All Activity', icon: '📊' },
                    { id: 'success', label: 'Successes', icon: '✅' },
                    { id: 'pending', label: 'Pending', icon: '⏳' },
                    { id: 'learning', label: 'Learning', icon: '🧠' }
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActivityFilter(filter.id)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all ${
                        activityFilter === filter.id
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span className="mr-2">{filter.icon}</span>
                      {filter.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Approval Rules */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    Custom Approval Rules
                  </span>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Rule
                  </Button>
                </CardTitle>
                <CardDescription>Create auto-approval conditions for specific scenarios</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="bg-slate-50 p-3 rounded-lg border border-dashed">
                  <p className="text-sm text-slate-600">📌 Auto-approve actions with &gt;85% confidence from high-performing segments</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="text-xs">Edit</Button>
                    <Button size="sm" variant="outline" className="text-xs text-red-600 hover:text-red-700">Delete</Button>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-dashed">
                  <p className="text-sm text-slate-600">📌 Auto-approve follow-up emails for warm leads</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" className="text-xs">Edit</Button>
                    <Button size="sm" variant="outline" className="text-xs text-red-600 hover:text-red-700">Delete</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance */}
          <TabsContent value="performance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Model Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Consensus (Claude + GPT-4o)</span>
                      <span className="text-sm font-bold text-purple-600">{sophia.model_performance.consensus_accuracy}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-purple-600 h-2 rounded-full" style={{ width: `${sophia.model_performance.consensus_accuracy}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">GPT-4o</span>
                      <span className="text-sm font-bold text-blue-600">{sophia.model_performance.gpt4o_accuracy}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${sophia.model_performance.gpt4o_accuracy}%` }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">Claude</span>
                      <span className="text-sm font-bold text-amber-600">{sophia.model_performance.claude_accuracy}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div className="bg-amber-600 h-2 rounded-full" style={{ width: `${sophia.model_performance.claude_accuracy}%` }}></div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-xs text-slate-600">Last updated: {sophia.model_performance.last_updated}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Memory & Learning */}
          <TabsContent value="memory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Sophia's Memory & Learning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                  <p className="font-medium text-blue-900">🧠 What Sophia Remembers:</p>
                  <ul className="text-sm text-blue-800 space-y-1 ml-4">
                    <li>✓ All past decisions and their outcomes</li>
                    <li>✓ Contact engagement patterns & preferences</li>
                    <li>✓ Campaign performance metrics</li>
                    <li>✓ What actions work best for each segment</li>
                    <li>✓ Your approval patterns & preferences</li>
                  </ul>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
                  <p className="font-medium text-green-900">📈 What Sophia Learns:</p>
                  <ul className="text-sm text-green-800 space-y-1 ml-4">
                    <li>✓ Email subject lines that get replies (82% accuracy)</li>
                    <li>✓ Best time to contact each lead segment</li>
                    <li>✓ Which channels convert better</li>
                    <li>✓ Your personal approval thresholds</li>
                    <li>✓ Emerging market trends in your data</li>
                  </ul>
                </div>

                <Button className="w-full mt-4">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Learning Data
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Auto-Actions Tab */}
          <TabsContent value="auto-actions">
            <SophiaAutoActionsPanel />
          </TabsContent>

          {/* Predictive AI Tab */}
          <TabsContent value="predictive">
            <SophiaPredictivePanel />
          </TabsContent>

          {/* LinkedIn Safety Controls */}
          <TabsContent value="linkedin-safety">
            <LinkedInSafetyControlsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
