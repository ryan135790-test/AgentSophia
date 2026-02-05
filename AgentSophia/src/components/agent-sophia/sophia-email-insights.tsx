import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  Sparkles,
  AlertTriangle,
  Clock,
  Target,
  Mail,
  Calendar,
  UserPlus,
  Reply,
  Bell,
  Loader2,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  Zap,
  ThumbsUp,
  ThumbsDown,
  DollarSign,
  Users,
  FileText,
  History,
  Send,
  CalendarCheck,
  Eye,
  Star,
  TrendingDown,
  Flame,
  AlertCircle,
  BellRing,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getValidAccessToken } from "@/lib/office365-auth";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface EmailInsight {
  intent: 'sales_inquiry' | 'support_request' | 'meeting_request' | 'follow_up' | 'newsletter' | 'personal' | 'spam' | 'other';
  urgency: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative';
  priorityScore: number;
  suggestedActions: SuggestedAction[];
  summary: string;
  keyPoints: string[];
  followUpDate?: string;
  contactContext?: string;
}

interface SuggestedAction {
  id: string;
  type: 'reply' | 'schedule_meeting' | 'add_to_crm' | 'follow_up' | 'archive' | 'delegate';
  label: string;
  description: string;
  confidence: number;
  autoExecute?: boolean;
}

interface Email {
  id: string;
  subject: string;
  from: {
    name: string;
    email: string;
  };
  receivedAt: string;
  preview: string;
  body?: string;
}

interface SophiaEmailInsightsProps {
  email: Email | null;
  onActionExecute: (action: SuggestedAction) => void;
  autonomyLevel: 'manual' | 'semi' | 'full';
  onAutonomyChange: (level: 'manual' | 'semi' | 'full') => void;
}

interface ActionHistoryItem {
  id: string;
  timestamp: string;
  actionType: 'email_auto_replied' | 'email_drafted' | 'email_analyzed' | 'meeting_auto_booked' | 'follow_up_scheduled';
  emailSubject: string;
  emailFrom: string;
  actionDetails: string;
  outcome: 'success' | 'pending' | 'failed';
  confidence: number;
  autonomyLevel: 'manual' | 'semi' | 'full';
  notified: boolean;
  draftContent?: string;
  meetingDetails?: { title: string; duration: number; suggestedTimes: string[] };
}

const actionTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
  email_auto_replied: { icon: Send, color: "text-green-500", label: "Auto Reply Sent" },
  email_drafted: { icon: FileText, color: "text-blue-500", label: "Draft Created" },
  email_analyzed: { icon: Eye, color: "text-purple-500", label: "Email Analyzed" },
  meeting_auto_booked: { icon: CalendarCheck, color: "text-orange-500", label: "Meeting Booked" },
  follow_up_scheduled: { icon: Clock, color: "text-yellow-500", label: "Follow-up Scheduled" },
};

const intentConfig: Record<string, { icon: any; color: string; label: string }> = {
  sales_inquiry: { icon: DollarSign, color: "text-green-500", label: "Sales Inquiry" },
  support_request: { icon: MessageSquare, color: "text-blue-500", label: "Support Request" },
  meeting_request: { icon: Calendar, color: "text-purple-500", label: "Meeting Request" },
  follow_up: { icon: Reply, color: "text-orange-500", label: "Follow Up" },
  newsletter: { icon: FileText, color: "text-gray-500", label: "Newsletter" },
  personal: { icon: Users, color: "text-pink-500", label: "Personal" },
  spam: { icon: AlertTriangle, color: "text-red-500", label: "Spam" },
  other: { icon: Mail, color: "text-gray-400", label: "Other" },
};

const urgencyConfig: Record<string, { color: string; bgColor: string }> = {
  high: { color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-950" },
  medium: { color: "text-yellow-600", bgColor: "bg-yellow-100 dark:bg-yellow-950" },
  low: { color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-950" },
};

interface ProactiveInsight {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'urgent';
  senderEmail?: string;
  threadId?: string;
  suggestedAction?: string;
  actionType?: string;
  createdAt: string;
}

interface SenderContext {
  email: string;
  name?: string;
  relationshipStrength: string;
  communicationStyle?: string;
  isVip: boolean;
  emailsReceived: number;
  emailsSent: number;
  keyTopics: string[];
}

const insightTypeConfig: Record<string, { icon: any; color: string }> = {
  cold_lead: { icon: TrendingDown, color: "text-blue-500" },
  frustrated_customer: { icon: AlertCircle, color: "text-red-500" },
  hot_prospect: { icon: Flame, color: "text-orange-500" },
  stale_thread: { icon: Clock, color: "text-yellow-500" },
  follow_up_overdue: { icon: BellRing, color: "text-red-500" },
  vip_waiting: { icon: Star, color: "text-purple-500" },
  sentiment_drop: { icon: TrendingDown, color: "text-red-500" },
  opportunity: { icon: TrendingUp, color: "text-green-500" },
  risk: { icon: AlertTriangle, color: "text-red-500" },
};

export function SophiaEmailInsights({ 
  email, 
  onActionExecute, 
  autonomyLevel, 
  onAutonomyChange 
}: SophiaEmailInsightsProps) {
  const [insight, setInsight] = useState<EmailInsight | null>(null);
  const [senderContext, setSenderContext] = useState<SenderContext | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'insights' | 'alerts' | 'history'>('insights');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  
  // Get userId and workspaceId for API calls
  const userId = user?.id;
  const workspaceId = currentWorkspace?.id;

  // Fetch action history
  const { data: historyData, refetch: refetchHistory } = useQuery<{ actions: ActionHistoryItem[]; total: number; unnotifiedCount: number }>({
    queryKey: ['/api/sophia-email/action-history', userId, workspaceId],
    queryFn: async () => {
      if (!userId) return { actions: [], total: 0, unnotifiedCount: 0 };
      const response = await fetch(`/api/sophia-email/action-history?userId=${userId}&workspaceId=${workspaceId || ''}`);
      if (!response.ok) throw new Error('Failed to fetch action history');
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch proactive insights
  const { data: insightsData, refetch: refetchInsights } = useQuery<{ insights: ProactiveInsight[]; summary: { total: number; urgent: number; warnings: number } }>({
    queryKey: ['/api/sophia-email/intelligence/insights', userId, workspaceId],
    queryFn: async () => {
      if (!userId) return { insights: [], summary: { total: 0, urgent: 0, warnings: 0 } };
      const response = await fetch(`/api/sophia-email/intelligence/insights?userId=${userId}&workspaceId=${workspaceId || ''}`);
      if (!response.ok) throw new Error('Failed to fetch insights');
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch intelligence stats
  const { data: statsData } = useQuery<{ stats: any }>({
    queryKey: ['/api/sophia-email/intelligence/stats', userId, workspaceId],
    queryFn: async () => {
      if (!userId) return { stats: null };
      const response = await fetch(`/api/sophia-email/intelligence/stats?userId=${userId}&workspaceId=${workspaceId || ''}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    enabled: !!userId,
    refetchInterval: 60000, // Refresh every minute
  });

  // Mark actions as notified
  const markNotifiedMutation = useMutation({
    mutationFn: async (actionIds: string[]) => {
      const response = await fetch('/api/sophia-email/mark-notified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionIds, userId, workspaceId }),
      });
      if (!response.ok) throw new Error('Failed to mark as notified');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sophia-email/action-history', userId, workspaceId] });
    },
  });

  // Dismiss insight
  const dismissInsightMutation = useMutation({
    mutationFn: async ({ insightId, action }: { insightId: string; action: 'actioned' | 'dismissed' }) => {
      const response = await fetch(`/api/sophia-email/intelligence/insights/${insightId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, workspaceId }),
      });
      if (!response.ok) throw new Error('Failed to update insight');
      return response.json();
    },
    onSuccess: () => {
      refetchInsights();
    },
  });

  // Schedule follow-up
  const scheduleFollowUpMutation = useMutation({
    mutationFn: async (params: { emailId: string; reminderType: string; dueAt: string }) => {
      const response = await fetch('/api/sophia-email/intelligence/follow-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, userId, workspaceId }),
      });
      if (!response.ok) throw new Error('Failed to schedule follow-up');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Follow-up Scheduled",
        description: "Sophia will remind you when it's time.",
      });
    },
  });

  // Process email autonomously
  const processAutonomousMutation = useMutation({
    mutationFn: async ({ emailData, analysis }: { emailData: Email; analysis: EmailInsight }) => {
      // Get user's access token for email sending
      const accessToken = await getValidAccessToken();
      
      const response = await fetch('/api/sophia-email/process-autonomous', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailData,
          analysis,
          autonomyLevel,
          userAccessToken: accessToken, // Pass token for actual sending
          userId,
          workspaceId,
        }),
      });
      if (!response.ok) throw new Error('Failed to process autonomously');
      return response.json();
    },
    onSuccess: (data) => {
      refetchHistory();
      if (data.actionsPerformed?.length > 0) {
        for (const action of data.actionsPerformed) {
          toast({
            title: `Sophia ${action.type === 'auto_replied' ? 'Auto-Replied' : action.type === 'meeting_booked' ? 'Booked Meeting' : 'Action Taken'}`,
            description: action.message,
          });
        }
      }
    },
  });

  useEffect(() => {
    if (email) {
      analyzeEmail(email);
    } else {
      setInsight(null);
    }
  }, [email?.id]);

  // Show notification for new actions
  useEffect(() => {
    if (historyData?.unnotifiedCount && historyData.unnotifiedCount > 0) {
      const unnotifiedActions = historyData.actions.filter(a => !a.notified);
      if (unnotifiedActions.length > 0 && activeTab !== 'history') {
        toast({
          title: `Sophia: ${unnotifiedActions.length} new action(s)`,
          description: unnotifiedActions[0]?.actionDetails || 'Check action history for details',
        });
      }
    }
  }, [historyData?.unnotifiedCount]);

  const analyzeEmail = async (emailToAnalyze: Email) => {
    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/sophia-email/analyze-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: emailToAnalyze.subject,
          from: emailToAnalyze.from,
          body: emailToAnalyze.preview,
          receivedAt: emailToAnalyze.receivedAt,
          userId,
          workspaceId,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setInsight(data.insight);

      // Trigger autonomous processing if not in manual mode
      if (autonomyLevel !== 'manual' && data.insight) {
        processAutonomousMutation.mutate({
          emailData: emailToAnalyze,
          analysis: data.insight,
        });
      }
    } catch (error) {
      console.error('Email analysis error:', error);
      setInsight({
        intent: 'other',
        urgency: 'medium',
        sentiment: 'neutral',
        priorityScore: 50,
        suggestedActions: [
          { id: '1', type: 'reply', label: 'Generate Reply', description: 'Create an AI-powered response', confidence: 0.9 },
        ],
        summary: 'Unable to fully analyze this email. Manual review recommended.',
        keyPoints: ['Analysis unavailable'],
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleMarkAllRead = () => {
    const actionIds = historyData?.actions.filter(a => !a.notified).map(a => a.id) || [];
    if (actionIds.length > 0) {
      markNotifiedMutation.mutate(actionIds);
    }
  };

  const executeAction = async (action: SuggestedAction) => {
    setExecutingAction(action.id);
    try {
      onActionExecute(action);
      toast({
        title: "Action Executed",
        description: action.label,
      });
    } finally {
      setExecutingAction(null);
    }
  };

  const IntentIcon = insight ? intentConfig[insight.intent]?.icon || Mail : Mail;

  // Proactive Insights Tab Content
  const ProactiveInsightsContent = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <BellRing className="h-4 w-4 text-orange-500" />
          Proactive Alerts
        </h4>
        {statsData?.stats && (
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>{statsData.stats.threads?.active || 0} active threads</span>
          </div>
        )}
      </div>

      {/* Intelligence Stats Summary */}
      {statsData?.stats && (
        <div className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded-lg text-xs">
          <div className="text-center">
            <p className="font-medium text-lg">{statsData.stats.followUps?.pending || 0}</p>
            <p className="text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-lg text-red-500">{statsData.stats.followUps?.overdue || 0}</p>
            <p className="text-muted-foreground">Overdue</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-lg text-purple-500">{statsData.stats.senders?.vips || 0}</p>
            <p className="text-muted-foreground">VIPs</p>
          </div>
        </div>
      )}
      
      {insightsData?.insights && insightsData.insights.length > 0 ? (
        <div className="space-y-2">
          {insightsData.insights.map((proactiveInsight) => {
            const InsightIcon = insightTypeConfig[proactiveInsight.type]?.icon || AlertCircle;
            return (
              <div
                key={proactiveInsight.id}
                className={`p-3 rounded-lg border ${
                  proactiveInsight.severity === 'urgent' 
                    ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' 
                    : proactiveInsight.severity === 'warning'
                    ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                    : 'bg-muted/50'
                }`}
                data-testid={`insight-${proactiveInsight.id}`}
              >
                <div className="flex items-start gap-2">
                  <InsightIcon className={`h-4 w-4 mt-0.5 ${insightTypeConfig[proactiveInsight.type]?.color || 'text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{proactiveInsight.title}</span>
                      <Badge 
                        variant={proactiveInsight.severity === 'urgent' ? 'destructive' : proactiveInsight.severity === 'warning' ? 'default' : 'secondary'}
                        className="text-xs flex-shrink-0"
                      >
                        {proactiveInsight.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{proactiveInsight.description}</p>
                    
                    {proactiveInsight.suggestedAction && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {proactiveInsight.suggestedAction}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(proactiveInsight.createdAt).toLocaleTimeString()}
                      </span>
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => dismissInsightMutation.mutate({ insightId: proactiveInsight.id, action: 'actioned' })}
                          data-testid={`button-action-insight-${proactiveInsight.id}`}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Done
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => dismissInsightMutation.mutate({ insightId: proactiveInsight.id, action: 'dismissed' })}
                          data-testid={`button-dismiss-insight-${proactiveInsight.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50 text-green-500" />
          <p className="text-sm">All caught up!</p>
          <p className="text-xs">Sophia will alert you when something needs attention</p>
        </div>
      )}
    </div>
  );

  // Handle draft approval
  const approveDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const response = await fetch(`/api/sophia-email/approve-draft/${draftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, workspaceId }),
      });
      if (!response.ok) throw new Error('Failed to approve draft');
      return response.json();
    },
    onSuccess: (data) => {
      refetchHistory();
      toast({
        title: "Draft Approved",
        description: "The draft has been approved. Use 'Approve & Send' in your email client.",
      });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const response = await fetch(`/api/sophia-email/reject-draft/${draftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, workspaceId }),
      });
      if (!response.ok) throw new Error('Failed to reject draft');
      return response.json();
    },
    onSuccess: () => {
      refetchHistory();
      toast({
        title: "Draft Rejected",
        description: "The draft has been discarded.",
      });
    },
  });

  // Action History Tab Content
  const ActionHistoryContent = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4 text-purple-500" />
          Action History
        </h4>
        {(historyData?.unnotifiedCount ?? 0) > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} data-testid="button-mark-all-read">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>
      
      {historyData?.actions && historyData.actions.length > 0 ? (
        <div className="space-y-2">
          {historyData.actions.slice(0, 15).map((action) => {
            const ActionIcon = actionTypeConfig[action.actionType]?.icon || Mail;
            const hasDraft = action.draftContent && action.outcome === 'pending';
            
            return (
              <div
                key={action.id}
                className={`p-3 rounded-lg border ${!action.notified ? 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800' : 'bg-muted/50'}`}
                data-testid={`action-history-${action.id}`}
              >
                <div className="flex items-start gap-2">
                  <ActionIcon className={`h-4 w-4 mt-0.5 ${actionTypeConfig[action.actionType]?.color || 'text-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {actionTypeConfig[action.actionType]?.label || action.actionType}
                      </span>
                      <Badge 
                        variant={action.outcome === 'success' ? 'default' : action.outcome === 'pending' ? 'secondary' : 'destructive'}
                        className="text-xs flex-shrink-0"
                      >
                        {action.outcome}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{action.emailSubject}</p>
                    <p className="text-xs text-muted-foreground mt-1">{action.actionDetails}</p>
                    
                    {/* Show draft content for pending drafts */}
                    {hasDraft && (
                      <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded border text-xs">
                        <p className="font-medium mb-1">Draft Reply:</p>
                        <p className="text-muted-foreground whitespace-pre-wrap line-clamp-4">{action.draftContent}</p>
                        <div className="flex gap-2 mt-2">
                          <Button 
                            size="sm" 
                            variant="default"
                            onClick={() => approveDraftMutation.mutate(action.id)}
                            disabled={approveDraftMutation.isPending}
                            data-testid={`button-approve-draft-${action.id}`}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => rejectDraftMutation.mutate(action.id)}
                            disabled={rejectDraftMutation.isPending}
                            data-testid={`button-reject-draft-${action.id}`}
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(action.confidence * 100)}% confident
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No actions yet</p>
          <p className="text-xs">Sophia will record her actions here</p>
        </div>
      )}
    </div>
  );

  if (!email) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Sophia Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'insights' | 'alerts' | 'history')}>
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
              <TabsTrigger value="alerts" className="relative" data-testid="tab-alerts">
                Alerts
                {(insightsData?.summary?.urgent ?? 0) > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center">
                    {insightsData?.summary?.urgent}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history" className="relative" data-testid="tab-history">
                History
                {(historyData?.unnotifiedCount ?? 0) > 0 && (
                  <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center">
                    {historyData?.unnotifiedCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="insights">
              <div className="flex items-center justify-center h-48">
                <div className="text-center text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select an email to view</p>
                  <p className="text-sm">Sophia's insights and recommendations</p>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="alerts">
              <ScrollArea className="h-[400px] pr-2">
                <ProactiveInsightsContent />
              </ScrollArea>
            </TabsContent>
            <TabsContent value="history">
              <ScrollArea className="h-[400px] pr-2">
                <ActionHistoryContent />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Sophia Insights
          </CardTitle>
          {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'insights' | 'alerts' | 'history')}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="insights" data-testid="tab-insights-main">Insights</TabsTrigger>
            <TabsTrigger value="alerts" className="relative" data-testid="tab-alerts-main">
              Alerts
              {(insightsData?.summary?.urgent ?? 0) > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center">
                  {insightsData?.summary?.urgent}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="relative" data-testid="tab-history-main">
              History
              {(historyData?.unnotifiedCount ?? 0) > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center">
                  {historyData?.unnotifiedCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insights" className="mt-0">
            <ScrollArea className="h-[500px] pr-2">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <Brain className="h-12 w-12 text-purple-500 animate-pulse" />
                <Sparkles className="h-4 w-4 text-yellow-500 absolute -top-1 -right-1 animate-bounce" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Analyzing email...</p>
            </div>
          ) : insight ? (
            <div className="space-y-4">
              <div className={`p-3 rounded-lg ${urgencyConfig[insight.urgency]?.bgColor || 'bg-muted'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <IntentIcon className={`h-4 w-4 ${intentConfig[insight.intent]?.color || 'text-gray-500'}`} />
                    <span className="font-medium text-sm">{intentConfig[insight.intent]?.label || 'Email'}</span>
                  </div>
                  <Badge variant={insight.urgency === 'high' ? 'destructive' : insight.urgency === 'medium' ? 'default' : 'secondary'}>
                    {insight.urgency.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span>Priority:</span>
                  <Progress value={insight.priorityScore} className="flex-1 h-2" />
                  <span className="font-medium">{insight.priorityScore}%</span>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Summary
                </h4>
                <p className="text-sm text-muted-foreground">{insight.summary}</p>
              </div>

              {insight.keyPoints.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Key Points</h4>
                  <ul className="space-y-1">
                    {insight.keyPoints.map((point, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <CheckCircle2 className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 text-sm mb-2">
                  <span>Sentiment:</span>
                  {insight.sentiment === 'positive' && <ThumbsUp className="h-4 w-4 text-green-500" />}
                  {insight.sentiment === 'neutral' && <span className="text-gray-500">Neutral</span>}
                  {insight.sentiment === 'negative' && <ThumbsDown className="h-4 w-4 text-red-500" />}
                  <span className="capitalize">{insight.sentiment}</span>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Zap className="h-4 w-4 text-orange-500" />
                  Suggested Actions
                </h4>
                <div className="space-y-2">
                  {insight.suggestedActions.map((action) => (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => executeAction(action)}
                      disabled={executingAction === action.id}
                      data-testid={`action-${action.type}`}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {action.type === 'reply' && <Reply className="h-4 w-4 text-blue-500" />}
                        {action.type === 'schedule_meeting' && <Calendar className="h-4 w-4 text-purple-500" />}
                        {action.type === 'add_to_crm' && <UserPlus className="h-4 w-4 text-green-500" />}
                        {action.type === 'follow_up' && <Bell className="h-4 w-4 text-orange-500" />}
                        {action.type === 'archive' && <FileText className="h-4 w-4 text-gray-500" />}
                        {action.type === 'delegate' && <Users className="h-4 w-4 text-pink-500" />}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{action.label}</p>
                          <p className="text-xs text-muted-foreground">{action.description}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(action.confidence * 100)}%
                        </Badge>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {insight.followUpDate && (
                <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span>Follow up by: {new Date(insight.followUpDate).toLocaleDateString()}</span>
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4 text-purple-500" />
                  Autonomy Level
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="manual" className="text-sm">Manual Approval</Label>
                    <Switch
                      id="manual"
                      checked={autonomyLevel === 'manual'}
                      onCheckedChange={() => onAutonomyChange('manual')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="semi" className="text-sm">Semi-Autonomous</Label>
                    <Switch
                      id="semi"
                      checked={autonomyLevel === 'semi'}
                      onCheckedChange={() => onAutonomyChange('semi')}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="full" className="text-sm">Fully Autonomous</Label>
                    <Switch
                      id="full"
                      checked={autonomyLevel === 'full'}
                      onCheckedChange={() => onAutonomyChange('full')}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {autonomyLevel === 'manual' && 'All actions require your approval'}
                    {autonomyLevel === 'semi' && 'High-confidence actions auto-draft, you approve'}
                    {autonomyLevel === 'full' && 'Sophia handles emails autonomously'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="alerts" className="mt-0">
            <ScrollArea className="h-[500px] pr-2">
              <ProactiveInsightsContent />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <ScrollArea className="h-[500px] pr-2">
              <ActionHistoryContent />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
