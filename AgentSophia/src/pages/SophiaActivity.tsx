import { useState, useEffect } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  CheckCircle, 
  Clock, 
  Play, 
  Pause, 
  SkipForward, 
  Edit3, 
  X, 
  ChevronUp, 
  ChevronDown,
  Mail,
  Linkedin,
  Calendar,
  MessageSquare,
  Target,
  TrendingUp,
  AlertCircle,
  Sparkles,
  RefreshCw,
  History,
  Zap,
  GripVertical
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface SophiaAction {
  id: string;
  action_type: string;
  description: string;
  contact_name?: string;
  campaign_name?: string;
  campaign_id?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'cancelled' | 'overridden';
  confidence?: number;
  reasoning?: string;
  created_at: string;
  completed_at?: string;
  result?: string;
  user_override?: boolean;
  override_reason?: string;
}

interface QueuedAction {
  id: string;
  action_type: string;
  description: string;
  contact_name?: string;
  campaign_name?: string;
  campaign_id?: string;
  scheduled_for: string;
  priority: number;
  confidence: number;
  reasoning: string;
  can_override: boolean;
}

const demoCompletedActions: SophiaAction[] = [
  {
    id: '1',
    action_type: 'send_email',
    description: 'Sent follow-up email to warm leads',
    contact_name: 'Sarah Johnson',
    campaign_name: 'Q4 Enterprise Outreach',
    campaign_id: 'demo-1',
    status: 'completed',
    confidence: 94,
    reasoning: 'Contact opened initial email 3 times and visited pricing page',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    completed_at: new Date(Date.now() - 3500000).toISOString(),
    result: 'Email delivered successfully'
  },
  {
    id: '2',
    action_type: 'send_linkedin',
    description: 'Sent LinkedIn connection request',
    contact_name: 'Michael Chen',
    campaign_name: 'Tech Leaders Campaign',
    campaign_id: 'demo-2',
    status: 'completed',
    confidence: 87,
    reasoning: 'VP Engineering at target company, matches ICP perfectly',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    completed_at: new Date(Date.now() - 7100000).toISOString(),
    result: 'Connection request sent'
  },
  {
    id: '3',
    action_type: 'schedule_meeting',
    description: 'Scheduled discovery call',
    contact_name: 'Lisa Park',
    campaign_name: 'Inbound Lead Nurture',
    campaign_id: 'demo-3',
    status: 'completed',
    confidence: 96,
    reasoning: 'Contact requested demo in reply, calendar availability confirmed',
    created_at: new Date(Date.now() - 14400000).toISOString(),
    completed_at: new Date(Date.now() - 14300000).toISOString(),
    result: 'Meeting scheduled for Dec 26, 2:00 PM'
  },
  {
    id: '4',
    action_type: 'score_lead',
    description: 'Updated lead score based on engagement',
    contact_name: 'James Wilson',
    campaign_name: 'Q4 Enterprise Outreach',
    campaign_id: 'demo-1',
    status: 'completed',
    confidence: 91,
    reasoning: 'High website activity + email engagement = MQL threshold reached',
    created_at: new Date(Date.now() - 21600000).toISOString(),
    completed_at: new Date(Date.now() - 21500000).toISOString(),
    result: 'Score updated: 45 → 78 (MQL)'
  },
  {
    id: '5',
    action_type: 'send_email',
    description: 'Sent personalized case study',
    contact_name: 'Amanda Foster',
    campaign_name: 'Tech Leaders Campaign',
    campaign_id: 'demo-2',
    status: 'overridden',
    confidence: 82,
    user_override: true,
    override_reason: 'Contact is already in conversation with sales rep',
    reasoning: 'Contact fits nurture sequence criteria',
    created_at: new Date(Date.now() - 28800000).toISOString(),
  }
];

const demoCurrentAction: SophiaAction = {
  id: 'current-1',
  action_type: 'analyze_responses',
  description: 'Analyzing 12 new campaign responses for intent signals',
  campaign_name: 'Q4 Enterprise Outreach',
  campaign_id: 'demo-1',
  status: 'in_progress',
  confidence: 89,
  reasoning: 'Batch processing overnight responses to prioritize morning follow-ups',
  created_at: new Date(Date.now() - 120000).toISOString(),
};

const demoQueuedActions: QueuedAction[] = [
  {
    id: 'q1',
    action_type: 'send_email',
    description: 'Send follow-up to 8 contacts who opened but didn\'t reply',
    campaign_name: 'Q4 Enterprise Outreach',
    campaign_id: 'demo-1',
    scheduled_for: new Date(Date.now() + 1800000).toISOString(),
    priority: 1,
    confidence: 92,
    reasoning: 'Optimal follow-up timing based on historical data (3-day gap, morning send)',
    can_override: true
  },
  {
    id: 'q2',
    action_type: 'send_linkedin',
    description: 'Connect with 5 decision-makers at Acme Corp',
    campaign_name: 'ABM - Acme Corp',
    campaign_id: 'demo-4',
    scheduled_for: new Date(Date.now() + 3600000).toISOString(),
    priority: 2,
    confidence: 88,
    reasoning: 'Multi-threading strategy - CEO already engaged, adding CTO and VP Sales',
    can_override: true
  },
  {
    id: 'q3',
    action_type: 'score_leads',
    description: 'Re-score 45 leads based on last week\'s engagement',
    campaign_name: 'All Campaigns',
    campaign_id: undefined,
    scheduled_for: new Date(Date.now() + 7200000).toISOString(),
    priority: 3,
    confidence: 95,
    reasoning: 'Weekly scoring refresh to identify new MQLs and cold leads',
    can_override: true
  },
  {
    id: 'q4',
    action_type: 'send_email',
    description: 'Send nurture content to 23 warm leads',
    campaign_name: 'Inbound Lead Nurture',
    campaign_id: 'demo-3',
    scheduled_for: new Date(Date.now() + 14400000).toISOString(),
    priority: 4,
    confidence: 86,
    reasoning: 'Leads in consideration stage - share customer success story',
    can_override: true
  },
  {
    id: 'q5',
    action_type: 'generate_report',
    description: 'Generate weekly campaign performance report',
    campaign_name: 'All Campaigns',
    campaign_id: undefined,
    scheduled_for: new Date(Date.now() + 21600000).toISOString(),
    priority: 5,
    confidence: 98,
    reasoning: 'Scheduled weekly report with AI insights and recommendations',
    can_override: true
  }
];

const getActionIcon = (type: string) => {
  switch (type) {
    case 'send_email': return <Mail className="h-4 w-4" />;
    case 'send_linkedin': return <Linkedin className="h-4 w-4" />;
    case 'schedule_meeting': return <Calendar className="h-4 w-4" />;
    case 'send_sms': return <MessageSquare className="h-4 w-4" />;
    case 'score_lead':
    case 'score_leads': return <Target className="h-4 w-4" />;
    case 'analyze_responses': return <TrendingUp className="h-4 w-4" />;
    case 'generate_report': return <Sparkles className="h-4 w-4" />;
    default: return <Zap className="h-4 w-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'in_progress': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'overridden': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
  }
};

export default function SophiaActivity() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';

  const [completedActions, setCompletedActions] = useState<SophiaAction[]>([]);
  const [currentAction, setCurrentAction] = useState<SophiaAction | null>(null);
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const [overrideDialog, setOverrideDialog] = useState<{ open: boolean; action: QueuedAction | null }>({ open: false, action: null });
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideType, setOverrideType] = useState<'skip' | 'modify' | 'prioritize'>('skip');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActivityData();
  }, [workspaceId, isDemo]);

  const loadActivityData = async () => {
    if (isDemo) {
      setCompletedActions(demoCompletedActions);
      setCurrentAction(demoCurrentAction);
      setQueuedActions(demoQueuedActions);
      setIsLoading(false);
      return;
    }

    if (!workspaceId) return;

    try {
      setIsLoading(true);
      
      const [activityRes, queueRes, currentRes] = await Promise.all([
        fetch(`/api/sophia/workspaces/${workspaceId}/activity`),
        fetch(`/api/sophia/workspaces/${workspaceId}/queue`),
        fetch(`/api/sophia/workspaces/${workspaceId}/current-task`)
      ]);

      if (activityRes.ok) {
        const data = await activityRes.json();
        setCompletedActions(Array.isArray(data) ? data : data.activities || []);
      }

      if (queueRes.ok) {
        const data = await queueRes.json();
        setQueuedActions(Array.isArray(data) ? data : data.queue || []);
      }

      if (currentRes.ok) {
        const data = await currentRes.json();
        setCurrentAction(data.task || null);
      }
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOverride = async (action: QueuedAction, type: 'skip' | 'modify' | 'prioritize') => {
    if (isDemo) {
      toast({
        title: "Demo Mode",
        description: "Override actions are simulated in demo mode. Switch to a real workspace to use this feature.",
      });
      
      if (type === 'skip') {
        setQueuedActions(prev => prev.filter(a => a.id !== action.id));
        setCompletedActions(prev => [{
          id: action.id,
          action_type: action.action_type,
          description: action.description,
          campaign_name: action.campaign_name,
          campaign_id: action.campaign_id,
          status: 'overridden',
          user_override: true,
          override_reason: overrideReason || 'User skipped this action',
          confidence: action.confidence,
          reasoning: action.reasoning,
          created_at: new Date().toISOString()
        }, ...prev]);
      } else if (type === 'prioritize') {
        setQueuedActions(prev => {
          const updated = prev.filter(a => a.id !== action.id);
          return [{ ...action, priority: 0 }, ...updated];
        });
      }
      
      setOverrideDialog({ open: false, action: null });
      setOverrideReason('');
      return;
    }

    try {
      await apiRequest(`/api/sophia/workspaces/${workspaceId}/override`, {
        method: 'POST',
        body: JSON.stringify({
          action_id: action.id,
          override_type: type,
          reason: overrideReason,
          learn_from_override: true
        })
      });

      toast({
        title: "Override Applied",
        description: `Sophia will learn from this ${type === 'skip' ? 'skip' : type === 'prioritize' ? 'prioritization' : 'modification'}.`,
      });

      // Refresh the activity data after successful override
      loadActivityData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply override",
        variant: "destructive",
      });
    } finally {
      setOverrideDialog({ open: false, action: null });
      setOverrideReason('');
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setQueuedActions(prev => {
      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
    
    if (!isDemo) {
      toast({
        title: "Queue Reordered",
        description: "Sophia will learn from your prioritization preferences.",
      });
    }
  };

  const handleMoveDown = (index: number) => {
    if (index === queuedActions.length - 1) return;
    setQueuedActions(prev => {
      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  const stats = {
    completedToday: completedActions.filter(a => {
      const today = new Date();
      const actionDate = new Date(a.created_at);
      return actionDate.toDateString() === today.toDateString();
    }).length,
    successRate: completedActions.length > 0 
      ? Math.round((completedActions.filter(a => a.status === 'completed').length / completedActions.length) * 100)
      : 0,
    avgConfidence: completedActions.length > 0
      ? Math.round(completedActions.reduce((sum, a) => sum + (a.confidence || 0), 0) / completedActions.length)
      : 0,
    overrides: completedActions.filter(a => a.user_override).length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Sophia Activity Dashboard</h1>
            <p className="text-muted-foreground">Track what Sophia has done, is doing, and will do next</p>
          </div>
        </div>
        <Button variant="outline" onClick={loadActivityData} data-testid="button-refresh">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.completedToday}</p>
                <p className="text-sm text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{stats.avgConfidence}%</p>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Edit3 className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{stats.overrides}</p>
                <p className="text-sm text-muted-foreground">Your Overrides</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Task */}
      {currentAction && (
        <Card className="border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Play className="h-5 w-5 animate-pulse" />
                Currently Working On
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                In Progress
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                {getActionIcon(currentAction.action_type)}
              </div>
              <div className="flex-1">
                <p className="font-medium">{currentAction.description}</p>
                {currentAction.campaign_name && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Campaign: {currentAction.campaign_name}
                  </p>
                )}
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                  {currentAction.reasoning}
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <Badge variant="outline">
                    {currentAction.confidence}% confidence
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Started {formatDistanceToNow(new Date(currentAction.created_at))} ago
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue" data-testid="tab-queue">
            <Clock className="h-4 w-4 mr-2" />
            Next Actions ({queuedActions.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="h-4 w-4 mr-2" />
            Activity History ({completedActions.length})
          </TabsTrigger>
        </TabsList>

        {/* Queue Tab */}
        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Actions Queue</CardTitle>
              <CardDescription>
                Review and modify what Sophia will do next. Drag to reorder or click to override.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {queuedActions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No actions queued</p>
                  <p className="text-sm">Sophia will queue new actions based on your campaign settings</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {queuedActions.map((action, index) => (
                      <div 
                        key={action.id}
                        className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            data-testid={`button-move-up-${action.id}`}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-6 p-0"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === queuedActions.length - 1}
                            data-testid={`button-move-down-${action.id}`}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
                          {getActionIcon(action.action_type)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{action.description}</p>
                              {action.campaign_name && (
                                <p className="text-sm text-muted-foreground">
                                  Campaign: {action.campaign_name}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              #{index + 1}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                            {action.reasoning}
                          </p>
                          
                          <div className="flex items-center gap-4 mt-3">
                            <Badge variant="outline">
                              {action.confidence}% confidence
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Scheduled: {format(new Date(action.scheduled_for), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOverrideType('prioritize');
                              handleMoveUp(index);
                            }}
                            data-testid={`button-prioritize-${action.id}`}
                          >
                            <Zap className="h-4 w-4 mr-1" />
                            Prioritize
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOverrideType('skip');
                              setOverrideDialog({ open: true, action });
                            }}
                            data-testid={`button-skip-${action.id}`}
                          >
                            <SkipForward className="h-4 w-4 mr-1" />
                            Skip
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Activity History</CardTitle>
              <CardDescription>
                What Sophia has done. Overridden actions help her learn your preferences.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {completedActions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No activity yet</p>
                  <p className="text-sm">Sophia's actions will appear here once she starts working</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {completedActions.map((action) => (
                      <div 
                        key={action.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border ${
                          action.user_override 
                            ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
                            : 'bg-slate-50 dark:bg-slate-900/50'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${
                          action.status === 'completed' 
                            ? 'bg-green-100 dark:bg-green-900/50'
                            : action.user_override
                            ? 'bg-purple-100 dark:bg-purple-900/50'
                            : 'bg-gray-100 dark:bg-gray-900/50'
                        }`}>
                          {getActionIcon(action.action_type)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{action.description}</p>
                              {action.contact_name && (
                                <p className="text-sm text-muted-foreground">
                                  Contact: {action.contact_name}
                                </p>
                              )}
                              {action.campaign_name && (
                                <p className="text-sm text-muted-foreground">
                                  Campaign: {action.campaign_name}
                                </p>
                              )}
                            </div>
                            <Badge className={getStatusColor(action.status)}>
                              {action.user_override ? 'Overridden' : action.status}
                            </Badge>
                          </div>
                          
                          {action.reasoning && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                              Sophia's reasoning: {action.reasoning}
                            </p>
                          )}
                          
                          {action.user_override && action.override_reason && (
                            <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900/30 rounded text-sm">
                              <span className="font-medium text-purple-700 dark:text-purple-300">Your feedback:</span>{' '}
                              {action.override_reason}
                            </div>
                          )}
                          
                          {action.result && (
                            <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                              Result: {action.result}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 mt-3">
                            {action.confidence && (
                              <Badge variant="outline">
                                {action.confidence}% confidence
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(action.created_at))} ago
                            </span>
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
      </Tabs>

      {/* Learning Insights */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Sophia's Learning from You
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-center py-4 text-muted-foreground">
            <Brain className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No learning patterns yet</p>
            <p className="text-xs">Sophia will learn from your override decisions and preferences</p>
          </div>
        </CardContent>
      </Card>

      {/* Override Dialog */}
      <Dialog open={overrideDialog.open} onOpenChange={(open) => setOverrideDialog({ open, action: overrideDialog.action })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Action</DialogTitle>
            <DialogDescription>
              Tell Sophia why you're skipping this action so she can learn from your decision.
            </DialogDescription>
          </DialogHeader>
          
          {overrideDialog.action && (
            <div className="py-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg mb-4">
                <p className="font-medium">{overrideDialog.action.description}</p>
                {overrideDialog.action.campaign_name && (
                  <p className="text-sm text-muted-foreground">
                    Campaign: {overrideDialog.action.campaign_name}
                  </p>
                )}
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-medium">Why are you skipping this? (Optional but helps Sophia learn)</label>
                <Textarea
                  placeholder="e.g., 'Contact is already in conversation with sales rep' or 'Wrong timing for this industry'"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                  data-testid="input-override-reason"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialog({ open: false, action: null })}>
              Cancel
            </Button>
            <Button 
              onClick={() => overrideDialog.action && handleOverride(overrideDialog.action, 'skip')}
              data-testid="button-confirm-skip"
            >
              Skip & Learn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
