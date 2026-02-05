import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  Mail, 
  MessageSquare, 
  Phone, 
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Send,
  StickyNote,
  History,
  Sparkles,
  Building2,
  Globe,
  Linkedin,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  SkipForward,
  ArrowRight,
  User,
  AlertCircle,
  TrendingUp,
  Zap,
  Brain,
  Target,
  Activity,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  Lightbulb,
  Bot
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SophiaController } from '@/lib/sophia-control';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface CampaignStep {
  id: string;
  name: string;
  type: 'email' | 'linkedin' | 'sms' | 'phone' | 'delay';
  order: number;
  contacts: PipelineContact[];
}

interface PipelineContact {
  id: string;
  name: string;
  email: string;
  company?: string;
  title?: string;
  status: 'pending' | 'sent' | 'opened' | 'replied' | 'bounced' | 'skipped';
  enteredStepAt: Date;
  lastActivity?: Date;
  sophiaScore?: number;
  sophiaInsight?: string;
}

interface ContactActivity {
  id: string;
  type: 'email_sent' | 'email_opened' | 'email_replied' | 'linkedin_sent' | 'linkedin_replied' | 'call' | 'meeting' | 'note';
  channel: 'email' | 'linkedin' | 'phone' | 'sms' | 'meeting';
  content: string;
  timestamp: Date;
  direction: 'outbound' | 'inbound';
  campaignId?: string;
  campaignName?: string;
}

interface CampaignPipelineViewProps {
  campaignId: string;
  campaignName: string;
  onClose?: () => void;
}

const DEMO_STEPS: CampaignStep[] = [
  {
    id: 'step-1',
    name: 'Initial Email',
    type: 'email',
    order: 1,
    contacts: [
      { id: 'c1', name: 'Sarah Johnson', email: 'sarah@techcorp.com', company: 'TechCorp', title: 'VP Sales', status: 'sent', enteredStepAt: new Date(Date.now() - 86400000 * 2), lastActivity: new Date(Date.now() - 3600000), sophiaScore: 85, sophiaInsight: 'High engagement probability based on similar profiles' },
      { id: 'c2', name: 'Michael Chen', email: 'mchen@innovate.io', company: 'Innovate.io', title: 'Director', status: 'opened', enteredStepAt: new Date(Date.now() - 86400000), lastActivity: new Date(Date.now() - 7200000), sophiaScore: 92, sophiaInsight: 'Opened 3 times, recommend immediate follow-up' },
      { id: 'c3', name: 'Emily Davis', email: 'emily@startup.co', company: 'Startup Co', title: 'CEO', status: 'pending', enteredStepAt: new Date(Date.now() - 3600000), sophiaScore: 78 },
    ]
  },
  {
    id: 'step-2',
    name: 'Wait 2 Days',
    type: 'delay',
    order: 2,
    contacts: [
      { id: 'c4', name: 'James Wilson', email: 'jwilson@enterprise.com', company: 'Enterprise Inc', title: 'CTO', status: 'pending', enteredStepAt: new Date(Date.now() - 86400000), sophiaScore: 88 },
      { id: 'c5', name: 'Lisa Park', email: 'lisa@growth.co', company: 'Growth Co', title: 'Head of Marketing', status: 'pending', enteredStepAt: new Date(Date.now() - 43200000), sophiaScore: 75 },
    ]
  },
  {
    id: 'step-3',
    name: 'Follow-up Email',
    type: 'email',
    order: 3,
    contacts: [
      { id: 'c6', name: 'David Brown', email: 'dbrown@bigco.com', company: 'BigCo', title: 'Sales Manager', status: 'sent', enteredStepAt: new Date(Date.now() - 86400000 * 3), lastActivity: new Date(Date.now() - 86400000), sophiaScore: 65 },
      { id: 'c7', name: 'Amanda Lee', email: 'alee@tech.io', company: 'Tech.io', title: 'VP Product', status: 'replied', enteredStepAt: new Date(Date.now() - 86400000 * 4), lastActivity: new Date(Date.now() - 43200000), sophiaScore: 95, sophiaInsight: 'Positive reply! Schedule meeting immediately' },
    ]
  },
  {
    id: 'step-4',
    name: 'LinkedIn Connect',
    type: 'linkedin',
    order: 4,
    contacts: [
      { id: 'c8', name: 'Robert Kim', email: 'rkim@solutions.com', company: 'Solutions Inc', title: 'Director of Ops', status: 'sent', enteredStepAt: new Date(Date.now() - 86400000 * 5), sophiaScore: 70 },
    ]
  },
  {
    id: 'step-5',
    name: 'Final Follow-up',
    type: 'email',
    order: 5,
    contacts: [
      { id: 'c9', name: 'Jennifer Taylor', email: 'jtaylor@corp.com', company: 'Corp Ltd', title: 'CEO', status: 'bounced', enteredStepAt: new Date(Date.now() - 86400000 * 7), sophiaScore: 0, sophiaInsight: 'Email bounced - verify email address' },
    ]
  },
  {
    id: 'completed',
    name: 'Completed',
    type: 'email',
    order: 6,
    contacts: [
      { id: 'c10', name: 'Chris Martinez', email: 'cmartinez@success.co', company: 'Success Co', title: 'Founder', status: 'replied', enteredStepAt: new Date(Date.now() - 86400000 * 10), lastActivity: new Date(Date.now() - 86400000 * 2), sophiaScore: 100, sophiaInsight: 'Meeting booked! Deal in progress' },
    ]
  }
];

const DEMO_ACTIVITIES: ContactActivity[] = [
  { id: 'a1', type: 'email_sent', channel: 'email', content: 'Initial outreach email sent', timestamp: new Date(Date.now() - 86400000 * 5), direction: 'outbound', campaignId: '1', campaignName: 'Q4 Outreach' },
  { id: 'a2', type: 'email_opened', channel: 'email', content: 'Email opened (3 times)', timestamp: new Date(Date.now() - 86400000 * 4), direction: 'inbound' },
  { id: 'a3', type: 'email_sent', channel: 'email', content: 'Follow-up email sent', timestamp: new Date(Date.now() - 86400000 * 3), direction: 'outbound', campaignId: '1', campaignName: 'Q4 Outreach' },
  { id: 'a4', type: 'linkedin_sent', channel: 'linkedin', content: 'LinkedIn connection request sent', timestamp: new Date(Date.now() - 86400000 * 2), direction: 'outbound' },
  { id: 'a5', type: 'email_replied', channel: 'email', content: 'Thanks for reaching out! I\'d love to learn more about your solution. Can we schedule a call next week?', timestamp: new Date(Date.now() - 86400000), direction: 'inbound' },
  { id: 'a6', type: 'note', channel: 'email', content: 'Hot lead - follow up immediately. Interested in enterprise plan.', timestamp: new Date(Date.now() - 3600000), direction: 'outbound' },
];

export function CampaignPipelineView({ campaignId, campaignName, onClose }: CampaignPipelineViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentWorkspace } = useWorkspace();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<PipelineContact | null>(null);
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('timeline');
  const [newNote, setNewNote] = useState('');
  const [steps] = useState<CampaignStep[]>(DEMO_STEPS);
  const [activities] = useState<ContactActivity[]>(DEMO_ACTIVITIES);
  
  const [sophiaAutoFollowUp, setSophiaAutoFollowUp] = useState(true);
  const [sophiaAutoPauseLowScorers, setSophiaAutoPauseLowScorers] = useState(false);
  const [sophiaAutoPrioritizeHot, setSophiaAutoPrioritizeHot] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const { data: sophiaState } = useQuery({
    queryKey: ['/api/sophia/state', campaignId, currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
    queryFn: async () => {
      try {
        const state = await SophiaController.getState(currentWorkspace?.id);
        return {
          isActive: state?.is_active ?? state?.isActive ?? state?.enabled ?? true,
          autonomyLevel: state?.autonomy_level ?? state?.autonomyLevel ?? 'semi_autonomous',
          isAutonomous: state?.is_autonomous ?? state?.isAutonomous ?? false
        };
      } catch {
        return { autonomyLevel: 'semi_autonomous', isActive: true, isAutonomous: false };
      }
    },
  });

  const executeSophiaAction = useMutation({
    mutationFn: async ({ action, contactId, confidence }: { action: string; contactId: string; confidence: number }) => {
      return await SophiaController.executeAction(action, contactId, campaignId, confidence);
    },
    onSuccess: () => {
      toast({ title: "Sophia Action Executed", description: "Action completed successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/pending-approvals'] });
    },
    onError: () => {
      toast({ title: "Action Failed", description: "Could not execute action", variant: "destructive" });
    }
  });

  const pipelineMetrics = useMemo(() => {
    const allContacts = steps.flatMap(s => s.contacts);
    const hotLeads = allContacts.filter(c => (c.sophiaScore || 0) >= 80);
    const coldLeads = allContacts.filter(c => (c.sophiaScore || 0) < 40);
    const replied = allContacts.filter(c => c.status === 'replied');
    const bounced = allContacts.filter(c => c.status === 'bounced');
    const avgScore = allContacts.length > 0 
      ? Math.round(allContacts.reduce((acc, c) => acc + (c.sophiaScore || 0), 0) / allContacts.length)
      : 0;
    
    return { hotLeads: hotLeads.length, coldLeads: coldLeads.length, replied: replied.length, bounced: bounced.length, avgScore };
  }, [steps]);

  const sophiaRecommendations = useMemo(() => {
    const recs: { type: 'urgent' | 'suggestion' | 'info'; message: string; action?: string; contactId?: string }[] = [];
    
    const hotLeadsNeedingAction = steps.flatMap(s => s.contacts)
      .filter(c => (c.sophiaScore || 0) >= 85 && c.status === 'opened');
    if (hotLeadsNeedingAction.length > 0) {
      recs.push({ 
        type: 'urgent', 
        message: `${hotLeadsNeedingAction.length} hot lead(s) opened emails - recommend immediate follow-up`,
        action: 'auto_follow_up',
        contactId: hotLeadsNeedingAction[0]?.id
      });
    }
    
    const staleContacts = steps.flatMap(s => s.contacts)
      .filter(c => c.enteredStepAt && (Date.now() - c.enteredStepAt.getTime()) > 86400000 * 5 && c.status === 'pending');
    if (staleContacts.length > 0) {
      recs.push({ 
        type: 'suggestion', 
        message: `${staleContacts.length} contact(s) haven't progressed in 5+ days - consider re-engagement`,
        action: 'reengage'
      });
    }
    
    const bouncedEmails = steps.flatMap(s => s.contacts).filter(c => c.status === 'bounced');
    if (bouncedEmails.length > 0) {
      recs.push({ 
        type: 'info', 
        message: `${bouncedEmails.length} email(s) bounced - verify addresses or try LinkedIn`,
        action: 'switch_channel'
      });
    }
    
    return recs;
  }, [steps]);

  const handleSophiaAnalyze = async () => {
    setIsAnalyzing(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    toast({ 
      title: "Sophia Analysis Complete", 
      description: `Found ${sophiaRecommendations.length} recommendations for this campaign` 
    });
    setIsAnalyzing(false);
  };

  const handleSophiaAutoAction = async (action: string, contactId?: string) => {
    if (contactId) {
      executeSophiaAction.mutate({ action, contactId, confidence: 0.85 });
    } else {
      toast({ title: "Sophia Action Queued", description: `Will ${action.replace('_', ' ')} for applicable contacts` });
    }
  };

  const totalContacts = useMemo(() => 
    steps.reduce((acc, step) => acc + step.contacts.length, 0),
    [steps]
  );

  const filteredSteps = useMemo(() => {
    if (!searchQuery) return steps;
    return steps.map(step => ({
      ...step,
      contacts: step.contacts.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }));
  }, [steps, searchQuery]);

  const handleContactClick = (contact: PipelineContact) => {
    setSelectedContact(contact);
    setIsContactSheetOpen(true);
  };

  const handleSkipContact = (contactId: string) => {
    toast({ title: "Contact Skipped", description: "Contact will skip remaining campaign steps" });
  };

  const handlePauseContact = (contactId: string) => {
    toast({ title: "Contact Paused", description: "Campaign paused for this contact" });
  };

  const handleSendMessage = () => {
    toast({ title: "Message Sent", description: "Your message has been queued for delivery" });
  };

  const handleScheduleMeeting = () => {
    toast({ title: "Meeting Scheduler", description: "Opening calendar to schedule meeting..." });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    toast({ title: "Note Added", description: "Note saved to contact history" });
    setNewNote('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'replied': return 'bg-green-500';
      case 'opened': return 'bg-blue-500';
      case 'sent': return 'bg-gray-400';
      case 'pending': return 'bg-yellow-500';
      case 'bounced': return 'bg-red-500';
      case 'skipped': return 'bg-gray-300';
      default: return 'bg-gray-400';
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'linkedin': return Linkedin;
      case 'sms': return MessageSquare;
      case 'phone': return Phone;
      case 'delay': return Clock;
      default: return Mail;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email_sent': case 'email_opened': case 'email_replied': return Mail;
      case 'linkedin_sent': case 'linkedin_replied': return Linkedin;
      case 'call': return Phone;
      case 'meeting': return Calendar;
      case 'note': return StickyNote;
      default: return Mail;
    }
  };

  return (
    <div className="h-full flex flex-col" data-testid="campaign-pipeline-view">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">{campaignName} - Pipeline View</h2>
          <p className="text-sm text-muted-foreground">{totalContacts} contacts across {steps.length} steps</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search contacts..." 
              className="pl-9 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-pipeline-search"
            />
          </div>
          <Button variant="outline" size="sm" data-testid="button-pipeline-filter">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      {/* Sophia Pipeline Analysis Panel */}
      <div className="p-4 border-b bg-gradient-to-r from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="flex items-start gap-6">
          {/* Sophia Header & Metrics */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Sophia Pipeline Analysis</h3>
                <p className="text-xs text-muted-foreground">
                  {sophiaState?.isActive ? 'Actively monitoring' : 'Monitoring paused'} • 
                  {sophiaState?.autonomyLevel === 'fully_autonomous' ? ' Full autonomy' : 
                   sophiaState?.autonomyLevel === 'semi_autonomous' ? ' Semi-autonomous' : ' Manual approval'}
                </p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto"
                onClick={handleSophiaAnalyze}
                disabled={isAnalyzing}
                data-testid="button-sophia-analyze"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                {isAnalyzing ? 'Analyzing...' : 'Refresh Analysis'}
              </Button>
            </div>
            
            {/* Metrics Row */}
            <div className="grid grid-cols-5 gap-3">
              <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-muted-foreground">Hot Leads</span>
                </div>
                <p className="text-lg font-semibold text-green-600" data-testid="metric-hot-leads">{pipelineMetrics.hotLeads}</p>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border">
                <div className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Avg Score</span>
                </div>
                <p className="text-lg font-semibold text-blue-600" data-testid="metric-avg-score">{pipelineMetrics.avgScore}%</p>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-muted-foreground">Replied</span>
                </div>
                <p className="text-lg font-semibold" data-testid="metric-replied">{pipelineMetrics.replied}</p>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border">
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs text-muted-foreground">Bounced</span>
                </div>
                <p className="text-lg font-semibold text-red-600" data-testid="metric-bounced">{pipelineMetrics.bounced}</p>
              </div>
              <div className="p-2 rounded-lg bg-white dark:bg-gray-900 border">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-xs text-muted-foreground">Cold</span>
                </div>
                <p className="text-lg font-semibold text-gray-600" data-testid="metric-cold-leads">{pipelineMetrics.coldLeads}</p>
              </div>
            </div>
          </div>

          <Separator orientation="vertical" className="h-32" />

          {/* Sophia Autonomous Controls */}
          <div className="w-64">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Sophia Autonomous Actions</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-followup" className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <Zap className="h-3.5 w-3.5 text-yellow-500" />
                  Auto follow-up hot leads
                </Label>
                <Switch 
                  id="auto-followup" 
                  checked={sophiaAutoFollowUp}
                  onCheckedChange={setSophiaAutoFollowUp}
                  data-testid="switch-auto-followup"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-pause" className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <Pause className="h-3.5 w-3.5 text-orange-500" />
                  Auto-pause low scorers
                </Label>
                <Switch 
                  id="auto-pause" 
                  checked={sophiaAutoPauseLowScorers}
                  onCheckedChange={setSophiaAutoPauseLowScorers}
                  data-testid="switch-auto-pause"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-prioritize" className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <Target className="h-3.5 w-3.5 text-green-500" />
                  Prioritize hot leads
                </Label>
                <Switch 
                  id="auto-prioritize" 
                  checked={sophiaAutoPrioritizeHot}
                  onCheckedChange={setSophiaAutoPrioritizeHot}
                  data-testid="switch-auto-prioritize"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sophia Recommendations */}
        {sophiaRecommendations.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-purple-500" />
              Sophia Recommendations
            </h4>
            <div className="flex flex-wrap gap-2">
              {sophiaRecommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                    rec.type === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                    rec.type === 'suggestion' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                    'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                  data-testid={`sophia-recommendation-${idx}`}
                >
                  {rec.type === 'urgent' && <AlertCircle className="h-3 w-3" />}
                  {rec.type === 'suggestion' && <Lightbulb className="h-3 w-3" />}
                  {rec.type === 'info' && <Bot className="h-3 w-3" />}
                  <span>{rec.message}</span>
                  {rec.action && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 px-2 ml-1"
                      onClick={() => handleSophiaAutoAction(rec.action!, rec.contactId)}
                      data-testid={`button-sophia-action-${idx}`}
                    >
                      Apply
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pipeline Kanban View */}
      <ScrollArea className="flex-1">
        <div className="flex gap-4 p-4 min-w-max">
          {filteredSteps.map((step, idx) => {
            const StepIcon = getStepIcon(step.type);
            return (
              <div 
                key={step.id} 
                className="w-72 flex-shrink-0"
                data-testid={`pipeline-step-${idx}`}
              >
                <Card className="h-full">
                  <CardHeader className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded ${step.type === 'delay' ? 'bg-orange-100 dark:bg-orange-950' : 'bg-blue-100 dark:bg-blue-950'}`}>
                          <StepIcon className={`h-4 w-4 ${step.type === 'delay' ? 'text-orange-600' : 'text-blue-600'}`} />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">{step.name}</CardTitle>
                          <p className="text-xs text-muted-foreground">Step {step.order}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {step.contacts.length}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pb-2 space-y-2 max-h-[500px] overflow-y-auto">
                    {step.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors group"
                        onClick={() => handleContactClick(contact)}
                        data-testid={`contact-card-${contact.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {contact.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{contact.name}</p>
                              <p className="text-xs text-muted-foreground">{contact.company}</p>
                            </div>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(contact.status)}`} />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground capitalize">{contact.status}</span>
                          {contact.sophiaScore && contact.sophiaScore >= 80 && (
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                              <span className="text-xs text-purple-600 dark:text-purple-400">{contact.sophiaScore}%</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(contact.enteredStepAt, { addSuffix: true })}
                        </p>
                        <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleContactClick(contact); }}
                            data-testid={`button-view-${contact.id}`}
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); handleSkipContact(contact.id); }}
                            data-testid={`button-skip-${contact.id}`}
                          >
                            <SkipForward className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {step.contacts.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No contacts at this step</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Contact Drill-Down Sheet */}
      <Sheet open={isContactSheetOpen} onOpenChange={setIsContactSheetOpen}>
        <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
          {selectedContact && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {selectedContact.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <SheetTitle>{selectedContact.name}</SheetTitle>
                      <SheetDescription>{selectedContact.title} at {selectedContact.company}</SheetDescription>
                    </div>
                  </div>
                  {selectedContact.sophiaScore && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-950/30 rounded-full">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                        {selectedContact.sophiaScore}% Score
                      </span>
                    </div>
                  )}
                </div>
              </SheetHeader>

              {/* Contact Info */}
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedContact.company}</span>
                  </div>
                </div>

                {/* Sophia Insight */}
                {selectedContact.sophiaInsight && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Sophia's Insight</span>
                    </div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">{selectedContact.sophiaInsight}</p>
                  </div>
                )}

                {/* Campaign Status */}
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Campaign Progress</span>
                      <Badge className={getStatusColor(selectedContact.status)}>{selectedContact.status}</Badge>
                    </div>
                    <Progress value={60} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Currently at Step 3 of 5 • Entered {formatDistanceToNow(selectedContact.enteredStepAt, { addSuffix: true })}
                    </p>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleSendMessage} data-testid="button-send-message">
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleScheduleMeeting} data-testid="button-schedule-meeting">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Meeting
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handlePauseContact(selectedContact.id)} data-testid="button-pause-contact">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSkipContact(selectedContact.id)} data-testid="button-skip-contact">
                    <SkipForward className="h-4 w-4 mr-2" />
                    Skip
                  </Button>
                </div>

                {/* Sophia Suggested Actions */}
                <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Bot className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">Sophia's Suggested Actions</span>
                    </div>
                    <div className="space-y-2">
                      {selectedContact.sophiaScore && selectedContact.sophiaScore >= 80 && (
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg">
                          <div className="flex items-center gap-2">
                            <ThumbsUp className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-xs">High priority - Follow up immediately</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs px-2"
                            onClick={() => handleSophiaAutoAction('immediate_followup', selectedContact.id)}
                            data-testid="button-sophia-followup"
                          >
                            <Zap className="h-3 w-3 mr-1" /> Execute
                          </Button>
                        </div>
                      )}
                      {selectedContact.status === 'opened' && (
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs">Email opened - Send personalized follow-up</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs px-2"
                            onClick={() => handleSophiaAutoAction('personalized_followup', selectedContact.id)}
                            data-testid="button-sophia-personalized"
                          >
                            <Zap className="h-3 w-3 mr-1" /> Execute
                          </Button>
                        </div>
                      )}
                      {selectedContact.status === 'replied' && (
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5 text-green-500" />
                            <span className="text-xs">Positive reply - Book a meeting</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs px-2"
                            onClick={handleScheduleMeeting}
                            data-testid="button-sophia-book-meeting"
                          >
                            <Zap className="h-3 w-3 mr-1" /> Execute
                          </Button>
                        </div>
                      )}
                      {selectedContact.status === 'bounced' && (
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Linkedin className="h-3.5 w-3.5 text-blue-600" />
                            <span className="text-xs">Email bounced - Try LinkedIn outreach</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs px-2"
                            onClick={() => handleSophiaAutoAction('switch_to_linkedin', selectedContact.id)}
                            data-testid="button-sophia-linkedin"
                          >
                            <Zap className="h-3 w-3 mr-1" /> Execute
                          </Button>
                        </div>
                      )}
                      {(!selectedContact.sophiaScore || selectedContact.sophiaScore < 40) && selectedContact.status === 'pending' && (
                        <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg">
                          <div className="flex items-center gap-2">
                            <ThumbsDown className="h-3.5 w-3.5 text-orange-500" />
                            <span className="text-xs">Low engagement - Consider pausing</span>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-xs px-2"
                            onClick={() => handlePauseContact(selectedContact.id)}
                            data-testid="button-sophia-pause"
                          >
                            <Pause className="h-3 w-3 mr-1" /> Pause
                          </Button>
                        </div>
                      )}
                      {/* Default suggestion */}
                      <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-purple-500" />
                          <span className="text-xs">Ask Sophia for custom recommendation</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-xs px-2"
                          onClick={() => toast({ title: "Sophia Analyzing", description: "Generating personalized recommendation..." })}
                          data-testid="button-sophia-analyze-contact"
                        >
                          <Sparkles className="h-3 w-3 mr-1" /> Ask
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Separator />

                {/* Tabs for Timeline, Notes, Conversations */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full">
                    <TabsTrigger value="timeline" className="flex-1" data-testid="tab-timeline">
                      <History className="h-4 w-4 mr-2" />
                      Timeline
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="flex-1" data-testid="tab-notes">
                      <StickyNote className="h-4 w-4 mr-2" />
                      Notes
                    </TabsTrigger>
                    <TabsTrigger value="conversations" className="flex-1" data-testid="tab-conversations">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Conversations
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="timeline" className="mt-4">
                    <div className="space-y-4">
                      {activities.map((activity) => {
                        const ActivityIcon = getActivityIcon(activity.type);
                        return (
                          <div 
                            key={activity.id} 
                            className="flex gap-3"
                            data-testid={`activity-${activity.id}`}
                          >
                            <div className={`p-2 rounded-full h-fit ${
                              activity.direction === 'inbound' 
                                ? 'bg-green-100 dark:bg-green-950' 
                                : 'bg-blue-100 dark:bg-blue-950'
                            }`}>
                              <ActivityIcon className={`h-4 w-4 ${
                                activity.direction === 'inbound' 
                                  ? 'text-green-600' 
                                  : 'text-blue-600'
                              }`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium capitalize">
                                  {activity.type.replace(/_/g, ' ')}
                                </p>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{activity.content}</p>
                              {activity.campaignName && (
                                <Badge variant="outline" className="mt-1 text-xs">
                                  {activity.campaignName}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="notes" className="mt-4">
                    <div className="space-y-4">
                      <div className="flex gap-2">
                        <Textarea 
                          placeholder="Add a note about this contact..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="min-h-[80px]"
                          data-testid="textarea-new-note"
                        />
                      </div>
                      <Button onClick={handleAddNote} size="sm" data-testid="button-add-note">
                        <StickyNote className="h-4 w-4 mr-2" />
                        Add Note
                      </Button>
                      <Separator />
                      <div className="space-y-3">
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">You</span>
                            <span className="text-xs text-muted-foreground">1 hour ago</span>
                          </div>
                          <p className="text-sm">Hot lead - follow up immediately. Interested in enterprise plan.</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="conversations" className="mt-4">
                    <div className="space-y-4">
                      {/* Email Thread */}
                      <Card>
                        <CardHeader className="py-3">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            <CardTitle className="text-sm">Email Thread</CardTitle>
                            <Badge variant="outline" className="ml-auto">3 messages</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="py-2">
                          <div className="space-y-3">
                            <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-sm">
                              <p className="font-medium text-xs mb-1">You (Initial Outreach)</p>
                              <p className="text-muted-foreground">Hi Sarah, I noticed your work at TechCorp...</p>
                            </div>
                            <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded text-sm">
                              <p className="font-medium text-xs mb-1">Sarah Johnson</p>
                              <p className="text-muted-foreground">Thanks for reaching out! I'd love to learn more...</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* LinkedIn Thread */}
                      <Card>
                        <CardHeader className="py-3">
                          <div className="flex items-center gap-2">
                            <Linkedin className="h-4 w-4" />
                            <CardTitle className="text-sm">LinkedIn Messages</CardTitle>
                            <Badge variant="outline" className="ml-auto">1 message</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="py-2">
                          <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-sm">
                            <p className="font-medium text-xs mb-1">Connection Request Sent</p>
                            <p className="text-muted-foreground">Pending acceptance...</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
