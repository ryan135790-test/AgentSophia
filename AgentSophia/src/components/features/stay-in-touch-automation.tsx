import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { 
  Bot, Clock, Users, Mail, MessageSquare, Phone, Calendar,
  AlertTriangle, CheckCircle, XCircle, Play, Pause, Plus,
  Settings, Sparkles, Heart, TrendingUp, Send, Eye, Edit,
  Trash2, RefreshCw, Bell, Zap, Target, ArrowRight
} from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { StayInTouchRule, StayInTouchTask, ContactEngagement } from '@shared/schema';

interface StayInTouchAutomationProps {
  workspaceId?: string;
}

export function StayInTouchAutomation({ workspaceId = 'default' }: StayInTouchAutomationProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateRule, setShowCreateRule] = useState(false);
  const [selectedTask, setSelectedTask] = useState<StayInTouchTask | null>(null);

  const isDemo = workspaceId === 'demo';
  const shouldFetch = !!workspaceId && workspaceId !== 'default' && !isDemo;

  // Fetch stay-in-touch rules (skip for demo workspace - use local demo data instead)
  const { data: rules = [], isLoading: rulesLoading } = useQuery<StayInTouchRule[]>({
    queryKey: ['/api/workspaces', workspaceId, 'stay-in-touch-rules'],
    enabled: shouldFetch,
  });

  // Fetch pending tasks (skip for demo workspace - use local demo data instead)
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<StayInTouchTask[]>({
    queryKey: ['/api/workspaces', workspaceId, 'stay-in-touch-tasks'],
    enabled: shouldFetch,
  });

  // Fetch contacts needing attention (skip for demo workspace - use local demo data instead)
  const { data: atRiskContacts = [], isLoading: contactsLoading } = useQuery<ContactEngagement[]>({
    queryKey: ['/api/workspaces', workspaceId, 'contacts-at-risk'],
    enabled: shouldFetch,
  });

  // Approve task mutation (no-op for demo workspace)
  const approveTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'This is demo data. Create a real workspace to use this feature.' });
        return;
      }
      return apiRequest('POST', `/api/workspaces/${workspaceId}/stay-in-touch-tasks/${taskId}/approve`);
    },
    onSuccess: () => {
      if (!isDemo) {
        queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'stay-in-touch-tasks'] });
        toast({ title: 'Message approved', description: 'Sophia will send the follow-up message.' });
      }
    },
  });

  // Reject task mutation (no-op for demo workspace)
  const rejectTask = useMutation({
    mutationFn: async (taskId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'This is demo data. Create a real workspace to use this feature.' });
        return;
      }
      return apiRequest('POST', `/api/workspaces/${workspaceId}/stay-in-touch-tasks/${taskId}/reject`);
    },
    onSuccess: () => {
      if (!isDemo) {
        queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'stay-in-touch-tasks'] });
        toast({ title: 'Task dismissed', description: 'This follow-up has been skipped.' });
      }
    },
  });

  // Stats calculation
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const approvedTasks = tasks.filter(t => t.status === 'approved' || t.status === 'sent');
  const atRiskCount = atRiskContacts.filter(c => c.relationship_health === 'at_risk' || c.relationship_health === 'needs_attention').length;

  // Demo data for initial display
  const demoRules: StayInTouchRule[] = [
    {
      id: '1',
      name: 'VIP Customer Check-In',
      description: 'Automatically reach out to VIP customers who haven\'t been contacted in 14 days',
      enabled: true,
      days_since_contact: 14,
      engagement_threshold: 'high',
      contact_types: ['vip', 'customer'],
      tags_include: ['vip'],
      tags_exclude: [],
      action_type: 'sophia_draft',
      sophia_generate_message: true,
      sophia_message_tone: 'friendly',
      sophia_message_purpose: 'check_in',
      auto_send: false,
      approval_required: true,
      max_followups_per_contact: 3,
      followup_interval_days: 7,
      priority: 'high',
      channels: ['email', 'linkedin'],
      channel_preference: 'primary_only',
      active_hours_start: '09:00',
      active_hours_end: '18:00',
      active_days: [1, 2, 3, 4, 5],
      timezone: 'America/New_York',
      workspace_id: workspaceId,
      user_id: 'demo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contacts_triggered: 45,
      messages_sent: 38,
      responses_received: 22,
      success_rate: 58,
      message_template_id: null,
      custom_message_prompt: null,
    },
    {
      id: '2',
      name: 'Prospect Re-Engagement',
      description: 'Re-engage cold prospects after 21 days of no response',
      enabled: true,
      days_since_contact: 21,
      engagement_threshold: 'low',
      contact_types: ['prospect'],
      tags_include: [],
      tags_exclude: ['unsubscribed'],
      action_type: 'sophia_draft',
      sophia_generate_message: true,
      sophia_message_tone: 'professional',
      sophia_message_purpose: 're_engage',
      auto_send: false,
      approval_required: true,
      max_followups_per_contact: 2,
      followup_interval_days: 14,
      priority: 'medium',
      channels: ['email'],
      channel_preference: 'primary_only',
      active_hours_start: '10:00',
      active_hours_end: '17:00',
      active_days: [1, 2, 3, 4, 5],
      timezone: 'America/New_York',
      workspace_id: workspaceId,
      user_id: 'demo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      contacts_triggered: 89,
      messages_sent: 72,
      responses_received: 15,
      success_rate: 21,
      message_template_id: null,
      custom_message_prompt: null,
    },
  ];

  const demoTasks: StayInTouchTask[] = [
    {
      id: '1',
      rule_id: '1',
      contact_id: 'c1',
      contact_name: 'Sarah Johnson',
      contact_email: 'sarah@techcorp.com',
      company: 'TechCorp Inc.',
      days_since_last_contact: 16,
      last_interaction_type: 'email',
      last_interaction_date: new Date(Date.now() - 16 * 24 * 60 * 60 * 1000).toISOString(),
      action_type: 'sophia_draft',
      channel: 'email',
      sophia_draft_subject: 'Quick check-in - Hope all is well!',
      sophia_draft_message: `Hi Sarah,

I hope this message finds you well! It's been a couple of weeks since we last connected, and I wanted to reach out to see how things are going with the implementation.

Is there anything I can help with or any questions that have come up? I'm always happy to jump on a quick call if that would be useful.

Looking forward to hearing from you!

Best regards`,
      sophia_confidence: 92,
      sophia_reasoning: 'Sarah is a VIP customer with high engagement history. A friendly check-in is appropriate given the 16-day gap.',
      status: 'pending',
      priority: 'high',
      scheduled_for: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      followup_count: 1,
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      notes: null,
    },
    {
      id: '2',
      rule_id: '2',
      contact_id: 'c2',
      contact_name: 'Michael Chen',
      contact_email: 'mchen@startuphub.io',
      company: 'StartupHub',
      days_since_last_contact: 23,
      last_interaction_type: 'linkedin',
      last_interaction_date: new Date(Date.now() - 23 * 24 * 60 * 60 * 1000).toISOString(),
      action_type: 'sophia_draft',
      channel: 'email',
      sophia_draft_subject: 'Thought you might find this interesting',
      sophia_draft_message: `Hi Michael,

I came across an article about AI-driven sales automation that made me think of our conversation about streamlining your outreach process.

I'd love to share some insights that have been working well for other startups in your space. Would you be open to a brief chat next week?

Let me know what works for you!

Best,`,
      sophia_confidence: 78,
      sophia_reasoning: 'Michael showed initial interest but has gone quiet. A value-driven re-engagement approach is recommended.',
      status: 'pending',
      priority: 'medium',
      scheduled_for: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      followup_count: 1,
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      notes: null,
    },
    {
      id: '3',
      rule_id: '1',
      contact_id: 'c3',
      contact_name: 'Emily Watson',
      contact_email: 'emily.w@growthco.com',
      company: 'GrowthCo',
      days_since_last_contact: 18,
      last_interaction_type: 'meeting',
      last_interaction_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000).toISOString(),
      action_type: 'sophia_draft',
      channel: 'linkedin',
      sophia_draft_subject: null,
      sophia_draft_message: `Hi Emily! It was great meeting with you a few weeks ago. I wanted to follow up and see if you had any questions about the proposal we discussed. Happy to hop on a quick call whenever works for you! 🙂`,
      sophia_confidence: 88,
      sophia_reasoning: 'Emily had a recent meeting and is likely evaluating options. A LinkedIn message feels more personal.',
      status: 'pending',
      priority: 'high',
      scheduled_for: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
      followup_count: 1,
      workspace_id: workspaceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      notes: null,
    },
  ];

  const demoAtRiskContacts: ContactEngagement[] = [
    {
      id: '1',
      contact_id: 'c4',
      workspace_id: workspaceId,
      engagement_score: 25,
      engagement_level: 'cooling',
      total_interactions: 8,
      email_interactions: 5,
      linkedin_interactions: 2,
      phone_interactions: 1,
      meeting_interactions: 0,
      first_interaction_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      last_interaction_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
      last_outbound_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      last_inbound_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString(),
      avg_response_time_hours: 48,
      response_rate: 30,
      relationship_health: 'at_risk',
      days_since_contact: 28,
      recommended_action: 'Send personalized re-engagement with value offer',
      sophia_notes: 'Engagement has dropped significantly. Previously responsive but last 2 emails unanswered.',
      sophia_next_best_action: 'Try LinkedIn message with industry insight',
      updated_at: new Date().toISOString(),
    },
    {
      id: '2',
      contact_id: 'c5',
      workspace_id: workspaceId,
      engagement_score: 42,
      engagement_level: 'cooling',
      total_interactions: 12,
      email_interactions: 8,
      linkedin_interactions: 3,
      phone_interactions: 0,
      meeting_interactions: 1,
      first_interaction_date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      last_interaction_date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      last_outbound_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      last_inbound_date: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
      avg_response_time_hours: 24,
      response_rate: 55,
      relationship_health: 'needs_attention',
      days_since_contact: 21,
      recommended_action: 'Schedule a quick call to reconnect',
      sophia_notes: 'Was very engaged, may have gotten busy. Good candidate for phone outreach.',
      sophia_next_best_action: 'Offer to schedule a brief 15-min call',
      updated_at: new Date().toISOString(),
    },
  ];

  const displayRules = rules.length > 0 ? rules : (isDemo ? demoRules : []);
  const displayTasks = tasks.length > 0 ? tasks : (isDemo ? demoTasks : []);
  const displayAtRisk = atRiskContacts.length > 0 ? atRiskContacts : (isDemo ? demoAtRiskContacts : []);

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"><Heart className="w-3 h-3 mr-1" /> Healthy</Badge>;
      case 'needs_attention':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"><AlertTriangle className="w-3 h-3 mr-1" /> Needs Attention</Badge>;
      case 'at_risk':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"><AlertTriangle className="w-3 h-3 mr-1" /> At Risk</Badge>;
      case 'lost':
        return <Badge variant="secondary"><XCircle className="w-3 h-3 mr-1" /> Lost</Badge>;
      default:
        return <Badge variant="outline">{health}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'linkedin': return <MessageSquare className="w-4 h-4" />;
      case 'sms': return <MessageSquare className="w-4 h-4" />;
      case 'phone': return <Phone className="w-4 h-4" />;
      default: return <Mail className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-blue-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="stay-in-touch-automation">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Bot className="w-6 h-6 text-primary" />
            Stay-in-Touch Automation
          </h1>
          <p className="text-muted-foreground mt-1">
            Let Sophia automatically track relationships and keep you connected with your contacts
          </p>
        </div>
        <Dialog open={showCreateRule} onOpenChange={setShowCreateRule}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-rule">
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Create Stay-in-Touch Rule
              </DialogTitle>
              <DialogDescription>
                Set up automated follow-ups that Sophia will manage for you
              </DialogDescription>
            </DialogHeader>
            <CreateRuleForm onSuccess={() => setShowCreateRule(false)} workspaceId={workspaceId} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Follow-ups</p>
                <p className="text-3xl font-bold" data-testid="text-pending-count">{displayTasks.filter(t => t.status === 'pending').length}</p>
              </div>
              <div className="p-3 bg-primary/10 rounded-full">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Awaiting your approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Contacts at Risk</p>
                <p className="text-3xl font-bold text-red-600" data-testid="text-at-risk-count">{displayAtRisk.filter(c => c.relationship_health === 'at_risk').length}</p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Need immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-3xl font-bold text-green-600" data-testid="text-sent-count">
                  {displayRules.reduce((sum, r) => sum + r.messages_sent, 0)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                <Send className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">By Sophia this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Response Rate</p>
                <p className="text-3xl font-bold" data-testid="text-response-rate">
                  {displayRules.length > 0 
                    ? Math.round(displayRules.reduce((sum, r) => sum + r.success_rate, 0) / displayRules.length)
                    : 0}%
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Average across rules</p>
          </CardContent>
        </Card>
      </div>

      {/* Empty State for non-demo workspaces */}
      {!isDemo && displayRules.length === 0 && displayTasks.length === 0 && displayAtRisk.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-12 text-center">
            <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Stay-in-Touch rules yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Create automated follow-up rules to let Sophia keep you connected with your contacts
            </p>
            <Button onClick={() => setShowCreateRule(true)} data-testid="btn-create-first-rule">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Rule
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs - only show if there's data or it's demo */}
      {(isDemo || displayRules.length > 0 || displayTasks.length > 0 || displayAtRisk.length > 0) && (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Target className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="w-4 h-4 mr-2" />
            Pending ({displayTasks.filter(t => t.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">
            <Settings className="w-4 h-4 mr-2" />
            Rules ({displayRules.length})
          </TabsTrigger>
          <TabsTrigger value="at-risk" data-testid="tab-at-risk">
            <AlertTriangle className="w-4 h-4 mr-2" />
            At Risk ({displayAtRisk.filter(c => c.relationship_health !== 'healthy').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sophia's Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Sophia's Recommendations
                </CardTitle>
                <CardDescription>AI-powered insights for your relationships</CardDescription>
              </CardHeader>
              <CardContent>
                {displayAtRisk.length === 0 && displayTasks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recommendations yet. Create rules and add contacts to get AI-powered insights.</p>
                  </div>
                ) : (
                <div className="space-y-4">
                  {displayAtRisk.length > 0 && (
                  <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-900 dark:text-amber-100">{displayAtRisk.length} contacts need attention</p>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          Some contacts are overdue for a check-in. Review pending follow-ups or create new rules.
                        </p>
                        <Button size="sm" className="mt-2" variant="outline" onClick={() => setActiveTab('at-risk')}>
                          View Contacts <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  )}

                  {displayTasks.filter(t => t.status === 'approved' || t.status === 'sent').length > 0 && (
                  <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">{displayTasks.filter(t => t.status === 'approved' || t.status === 'sent').length} follow-ups completed</p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          All approved messages were delivered successfully.
                        </p>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
                )}
              </CardContent>
            </Card>

            {/* Active Rules Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Active Automation Rules
                </CardTitle>
                <CardDescription>Currently running stay-in-touch rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {displayRules.filter(r => r.enabled).map(rule => (
                    <div key={rule.id} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          <span className="font-medium">{rule.name}</span>
                        </div>
                        <Badge variant="outline">{rule.days_since_contact} days</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{rule.contacts_triggered} triggered</span>
                        <span>{rule.messages_sent} sent</span>
                        <span>{rule.success_rate}% success</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pending Follow-ups</CardTitle>
              <CardDescription>Review and approve messages drafted by Sophia</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {displayTasks.filter(t => t.status === 'pending').map(task => (
                    <div key={task.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow" data-testid={`task-card-${task.id}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`w-1 h-full min-h-[100px] rounded ${getPriorityColor(task.priority)}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{task.contact_name}</span>
                              <Badge variant="outline">{task.company}</Badge>
                              {getChannelIcon(task.channel || 'email')}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Last contact: {task.days_since_last_contact} days ago via {task.last_interaction_type}
                            </p>
                            
                            {task.sophia_draft_subject && (
                              <p className="text-sm font-medium mb-1">Subject: {task.sophia_draft_subject}</p>
                            )}
                            
                            <div className="bg-muted/50 p-3 rounded-md text-sm whitespace-pre-wrap">
                              {task.sophia_draft_message}
                            </div>

                            <div className="flex items-center gap-2 mt-3">
                              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                <Bot className="w-3 h-3 mr-1" />
                                {task.sophia_confidence}% confidence
                              </Badge>
                              {task.sophia_reasoning && (
                                <span className="text-xs text-muted-foreground italic">
                                  "{task.sophia_reasoning}"
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => approveTask.mutate(task.id)}
                            disabled={approveTask.isPending}
                            data-testid={`button-approve-${task.id}`}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve & Send
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setSelectedTask(task)}
                            data-testid={`button-edit-${task.id}`}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => rejectTask.mutate(task.id)}
                            disabled={rejectTask.isPending}
                            data-testid={`button-dismiss-${task.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {displayTasks.filter(t => t.status === 'pending').length === 0 && (
                    <div className="text-center py-12">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                      <p className="text-lg font-medium">All caught up!</p>
                      <p className="text-muted-foreground">No pending follow-ups at the moment.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <div className="grid grid-cols-1 gap-4">
            {displayRules.length === 0 ? (
              <Card>
                <CardContent className="pt-12 text-center">
                  <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No automation rules</h3>
                  <p className="text-muted-foreground mb-4">Create your first rule to let Sophia manage follow-ups automatically.</p>
                  <Button onClick={() => setShowCreateRule(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Rule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              displayRules.map(rule => (
              <Card key={rule.id} data-testid={`rule-card-${rule.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Switch checked={rule.enabled} />
                        <h3 className="text-lg font-semibold">{rule.name}</h3>
                        {rule.enabled && <Badge className="bg-green-100 text-green-800">Active</Badge>}
                      </div>
                      <p className="text-muted-foreground mb-4">{rule.description}</p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground">Trigger After</p>
                          <p className="font-medium">{rule.days_since_contact} days</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Channels</p>
                          <div className="flex gap-1 mt-1">
                            {rule.channels.map(ch => (
                              <span key={ch}>{getChannelIcon(ch)}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Messages Sent</p>
                          <p className="font-medium">{rule.messages_sent}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Success Rate</p>
                          <p className="font-medium">{rule.success_rate}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )))}
          </div>
        </TabsContent>

        <TabsContent value="at-risk" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Contacts Needing Attention
              </CardTitle>
              <CardDescription>Relationships that are cooling off or at risk</CardDescription>
            </CardHeader>
            <CardContent>
              {displayAtRisk.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">All relationships healthy!</p>
                  <p className="text-muted-foreground">No contacts are currently at risk. Keep up the great work!</p>
                </div>
              ) : (
              <div className="space-y-4">
                {displayAtRisk.map(contact => (
                  <div key={contact.id} className="p-4 border rounded-lg" data-testid={`at-risk-card-${contact.id}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">Contact #{contact.contact_id}</span>
                          {getHealthBadge(contact.relationship_health)}
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Engagement Score</p>
                            <div className="flex items-center gap-2">
                              <Progress value={contact.engagement_score} className="w-20 h-2" />
                              <span className="text-sm font-medium">{contact.engagement_score}%</span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Days Since Contact</p>
                            <p className="font-medium text-red-600">{contact.days_since_contact} days</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Response Rate</p>
                            <p className="font-medium">{contact.response_rate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Total Interactions</p>
                            <p className="font-medium">{contact.total_interactions}</p>
                          </div>
                        </div>

                        {contact.sophia_next_best_action && (
                          <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-md">
                            <Bot className="w-4 h-4 text-primary" />
                            <span className="text-sm"><strong>Sophia suggests:</strong> {contact.sophia_next_best_action}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button size="sm">
                          <Send className="w-4 h-4 mr-1" />
                          Reach Out
                        </Button>
                        <Button size="sm" variant="outline">
                          <Calendar className="w-4 h-4 mr-1" />
                          Schedule Call
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
      </Tabs>
      )}
    </div>
  );
}

// Create Rule Form Component
function CreateRuleForm({ onSuccess, workspaceId }: { onSuccess: () => void; workspaceId: string }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    days_since_contact: 14,
    engagement_threshold: 'any',
    action_type: 'sophia_draft',
    sophia_message_tone: 'friendly',
    sophia_message_purpose: 'check_in',
    approval_required: true,
    channels: ['email'],
    priority: 'medium',
  });

  const createRule = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', `/api/workspaces/${workspaceId}/stay-in-touch-rules`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'stay-in-touch-rules'] });
      toast({ title: 'Rule created', description: 'Sophia will start monitoring your contacts.' });
      onSuccess();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create rule', variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label>Rule Name</Label>
          <Input 
            placeholder="e.g., VIP Customer Check-in"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            data-testid="input-rule-name"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea 
            placeholder="Describe what this rule does..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            data-testid="input-rule-description"
          />
        </div>

        <div>
          <Label>Trigger after (days without contact)</Label>
          <div className="flex items-center gap-4 mt-2">
            <Slider 
              value={[formData.days_since_contact]} 
              onValueChange={([val]) => setFormData({ ...formData, days_since_contact: val })}
              min={1}
              max={90}
              step={1}
              className="flex-1"
            />
            <span className="w-16 text-right font-medium">{formData.days_since_contact} days</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Message Tone</Label>
            <Select 
              value={formData.sophia_message_tone}
              onValueChange={(val) => setFormData({ ...formData, sophia_message_tone: val })}
            >
              <SelectTrigger data-testid="select-tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Message Purpose</Label>
            <Select 
              value={formData.sophia_message_purpose}
              onValueChange={(val) => setFormData({ ...formData, sophia_message_purpose: val })}
            >
              <SelectTrigger data-testid="select-purpose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="check_in">Check-in</SelectItem>
                <SelectItem value="share_value">Share Value</SelectItem>
                <SelectItem value="schedule_call">Schedule Call</SelectItem>
                <SelectItem value="re_engage">Re-engage</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Priority</Label>
          <Select 
            value={formData.priority}
            onValueChange={(val) => setFormData({ ...formData, priority: val })}
          >
            <SelectTrigger data-testid="select-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Require Approval</p>
            <p className="text-sm text-muted-foreground">Review messages before Sophia sends them</p>
          </div>
          <Switch 
            checked={formData.approval_required}
            onCheckedChange={(val) => setFormData({ ...formData, approval_required: val })}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onSuccess}>Cancel</Button>
        <Button 
          onClick={() => createRule.mutate(formData)}
          disabled={!formData.name || createRule.isPending}
          data-testid="button-save-rule"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Create Rule
        </Button>
      </div>
    </div>
  );
}

export default StayInTouchAutomation;