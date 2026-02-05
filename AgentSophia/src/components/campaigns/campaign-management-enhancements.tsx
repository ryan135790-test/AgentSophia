import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Campaign } from '../../../shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, isToday, isFuture } from 'date-fns';
import { 
  Calendar,
  CalendarDays,
  Activity,
  FolderOpen,
  Tag,
  GitCompare,
  Clock,
  History,
  Eye,
  GitBranch,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Archive,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Mail,
  Linkedin,
  MessageSquare,
  Phone,
  Send,
  Reply,
  Brain,
  Zap,
  Filter,
  MoreHorizontal,
  RefreshCw,
  ArrowRight,
  Users,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CampaignManagementProps {
  campaigns: Campaign[];
  onRefresh: () => void;
}

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  sms: MessageSquare,
  phone: Phone,
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-500',
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  completed: 'bg-blue-500',
};

export function CampaignCalendarView({ campaigns }: { campaigns: Campaign[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: scheduledSteps = [] } = useQuery<any[]>({
    queryKey: ['/api/campaign-steps/scheduled'],
    queryFn: async () => {
      const res = await fetch('/api/campaign-steps/scheduled');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date) => {
    const dayEvents: any[] = [];
    
    scheduledSteps.forEach((step: any) => {
      if (step.scheduled_at && isSameDay(parseISO(step.scheduled_at), day)) {
        dayEvents.push({
          type: 'step',
          channel: step.channel,
          campaign: campaigns.find(c => c.id === step.campaign_id),
          time: format(parseISO(step.scheduled_at), 'HH:mm'),
          status: step.status,
        });
      }
    });

    campaigns.forEach(campaign => {
      if (campaign.created_at && isSameDay(parseISO(campaign.created_at), day)) {
        dayEvents.push({
          type: 'campaign_created',
          campaign,
          time: format(parseISO(campaign.created_at), 'HH:mm'),
        });
      }
    });

    return dayEvents;
  };

  const previousMonth = () => setCurrentDate(prev => addDays(startOfMonth(prev), -1));
  const nextMonth = () => setCurrentDate(prev => addDays(endOfMonth(prev), 1));

  return (
    <Card data-testid="campaign-calendar-view">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Campaign Calendar</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={previousMonth} data-testid="calendar-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[150px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="icon" onClick={nextMonth} data-testid="calendar-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>Visual overview of all scheduled campaign activities</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: monthStart.getDay() }).map((_, i) => (
            <div key={`empty-${i}`} className="h-24 bg-muted/30 rounded" />
          ))}
          {daysInMonth.map((day, idx) => {
            const events = getEventsForDay(day);
            const hasEvents = events.length > 0;
            
            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "h-24 p-1 border rounded cursor-pointer transition-colors overflow-hidden",
                  isToday(day) && "border-blue-500 bg-blue-50 dark:bg-blue-950/30",
                  selectedDay && isSameDay(selectedDay, day) && "ring-2 ring-blue-500",
                  hasEvents && "bg-green-50 dark:bg-green-950/20",
                  "hover:bg-muted/50"
                )}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-sm font-medium",
                    isToday(day) && "text-blue-600"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {hasEvents && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1">
                      {events.length}
                    </Badge>
                  )}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {events.slice(0, 2).map((event, i) => {
                    const Icon = event.channel ? CHANNEL_ICONS[event.channel] || Send : Calendar;
                    return (
                      <div key={i} className="flex items-center gap-1 text-[10px] truncate">
                        <Icon className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{event.campaign?.name || 'Activity'}</span>
                      </div>
                    );
                  })}
                  {events.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{events.length - 2} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectedDay && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg" data-testid="calendar-day-detail">
            <h4 className="font-medium mb-2">
              {format(selectedDay, 'EEEE, MMMM d, yyyy')}
            </h4>
            <div className="space-y-2">
              {getEventsForDay(selectedDay).length > 0 ? (
                getEventsForDay(selectedDay).map((event, i) => {
                  const Icon = event.channel ? CHANNEL_ICONS[event.channel] || Send : Calendar;
                  return (
                    <div key={i} className="flex items-center gap-3 p-2 bg-background rounded">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{event.campaign?.name || 'Campaign Activity'}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.time} - {event.type === 'step' ? `${event.channel} step` : 'Created'}
                        </p>
                      </div>
                      {event.status && (
                        <Badge variant="outline" className="text-xs">{event.status}</Badge>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No scheduled activities</p>
              )}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3 italic flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Demo data shown. Connect campaigns to see real scheduled activities.
        </p>
      </CardContent>
    </Card>
  );
}

export function CampaignHealthDashboard({ campaigns }: { campaigns: Campaign[] }) {
  const activeCampaigns = campaigns.filter(c => c.status === 'active');
  const pausedCampaigns = campaigns.filter(c => c.status === 'paused');
  const draftCampaigns = campaigns.filter(c => c.status === 'draft');

  const getHealthScore = (campaign: Campaign) => {
    const openRate = campaign.sent_count > 0 ? (campaign.opened_count / campaign.sent_count) * 100 : 0;
    const clickRate = campaign.opened_count > 0 ? (campaign.clicked_count / campaign.opened_count) * 100 : 0;
    const replyRate = campaign.sent_count > 0 ? (campaign.replied_count / campaign.sent_count) * 100 : 0;
    
    let score = 50;
    if (openRate > 30) score += 20;
    else if (openRate > 20) score += 10;
    if (clickRate > 5) score += 15;
    if (replyRate > 3) score += 15;
    
    return Math.min(100, score);
  };

  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 60) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 40) return { label: 'Needs Attention', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const campaignHealthList = activeCampaigns.map(c => ({
    ...c,
    healthScore: getHealthScore(c),
    healthStatus: getHealthStatus(getHealthScore(c)),
  })).sort((a, b) => a.healthScore - b.healthScore);

  const criticalCampaigns = campaignHealthList.filter(c => c.healthScore < 40);
  const attentionCampaigns = campaignHealthList.filter(c => c.healthScore >= 40 && c.healthScore < 60);

  return (
    <Card data-testid="campaign-health-dashboard">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-600" />
          <CardTitle className="text-lg">Campaign Health</CardTitle>
        </div>
        <CardDescription>Real-time monitoring with alerts and Sophia suggestions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{activeCampaigns.length}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{pausedCampaigns.length}</div>
            <div className="text-xs text-muted-foreground">Paused</div>
          </div>
          <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{draftCampaigns.length}</div>
            <div className="text-xs text-muted-foreground">Drafts</div>
          </div>
          <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{criticalCampaigns.length}</div>
            <div className="text-xs text-muted-foreground">Need Attention</div>
          </div>
        </div>

        {criticalCampaigns.length > 0 && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-700 dark:text-red-400">Critical Alerts</span>
            </div>
            <div className="space-y-2">
              {criticalCampaigns.slice(0, 3).map(campaign => (
                <div key={campaign.id} className="flex items-center justify-between text-sm" data-testid={`health-alert-${campaign.id}`}>
                  <span>{campaign.name}</span>
                  <Badge variant="destructive" className="text-xs">Score: {campaign.healthScore}%</Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            Sophia's Recommendations
          </h4>
          <div className="space-y-2">
            {campaignHealthList.length > 0 ? (
              campaignHealthList.slice(0, 5).map(campaign => (
                <div key={campaign.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded" data-testid={`health-campaign-${campaign.id}`}>
                  <div className={cn("w-2 h-2 rounded-full", campaign.healthStatus.bg)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{campaign.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {campaign.healthScore < 60 
                        ? "Consider A/B testing subject lines to improve open rates"
                        : "Performing well - maintain current strategy"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={campaign.healthScore} className="w-16 h-2" />
                    <span className={cn("text-xs font-medium", campaign.healthStatus.color)}>
                      {campaign.healthScore}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No active campaigns to monitor</p>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 italic flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Health scores calculated from engagement metrics. Demo data may be shown.
        </p>
      </CardContent>
    </Card>
  );
}

export function BulkCampaignOperations({ campaigns, onRefresh }: CampaignManagementProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, ids }: { action: string; ids: string[] }) => {
      const results = await Promise.all(
        ids.map(id => 
          apiRequest(`/api/campaigns/${id}`, {
            method: action === 'delete' ? 'DELETE' : 'PATCH',
            body: action !== 'delete' ? JSON.stringify({ status: action }) : undefined,
          }).catch(err => ({ error: err.message, id }))
        )
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      setSelectedIds(new Set());
      onRefresh();
    },
  });

  const handleSelectAll = () => {
    if (selectedIds.size === campaigns.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(campaigns.map(c => c.id)));
    }
  };

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.size === 0) {
      toast({ title: 'No campaigns selected', variant: 'destructive' });
      return;
    }

    const actionLabel = action === 'delete' ? 'delete' : action === 'active' ? 'resume' : action;
    const confirmed = window.confirm(`Are you sure you want to ${actionLabel} ${selectedIds.size} campaign(s)?`);
    
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      await bulkActionMutation.mutateAsync({ action, ids: Array.from(selectedIds) });
      toast({ 
        title: 'Success', 
        description: `${selectedIds.size} campaigns ${actionLabel}d successfully` 
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Some operations failed', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card data-testid="bulk-campaign-operations">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Bulk Operations</CardTitle>
          </div>
          {selectedIds.size > 0 && (
            <Badge variant="secondary">{selectedIds.size} selected</Badge>
          )}
        </div>
        <CardDescription>Select multiple campaigns to pause, resume, archive, or clone at once</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Checkbox
            checked={selectedIds.size === campaigns.length && campaigns.length > 0}
            onCheckedChange={handleSelectAll}
            data-testid="bulk-select-all"
          />
          <span className="text-sm">Select All ({campaigns.length})</span>
          
          <div className="flex-1" />
          
          <Button
            size="sm"
            variant="outline"
            disabled={selectedIds.size === 0 || isProcessing}
            onClick={() => handleBulkAction('active')}
            data-testid="bulk-resume"
          >
            <Play className="h-3 w-3 mr-1" />
            Resume
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedIds.size === 0 || isProcessing}
            onClick={() => handleBulkAction('paused')}
            data-testid="bulk-pause"
          >
            <Pause className="h-3 w-3 mr-1" />
            Pause
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={selectedIds.size === 0 || isProcessing}
            onClick={() => handleBulkAction('completed')}
            data-testid="bulk-archive"
          >
            <Archive className="h-3 w-3 mr-1" />
            Archive
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={selectedIds.size === 0 || isProcessing}
            onClick={() => handleBulkAction('delete')}
            data-testid="bulk-delete"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        </div>

        <ScrollArea className="h-[200px]">
          <div className="space-y-1">
            {campaigns.map(campaign => (
              <div
                key={campaign.id}
                className={cn(
                  "flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors",
                  selectedIds.has(campaign.id) && "bg-blue-50 dark:bg-blue-950/30"
                )}
                onClick={() => handleToggle(campaign.id)}
                data-testid={`bulk-campaign-row-${campaign.id}`}
              >
                <Checkbox
                  checked={selectedIds.has(campaign.id)}
                  onCheckedChange={() => handleToggle(campaign.id)}
                />
                <div className={cn("w-2 h-2 rounded-full", STATUS_COLORS[campaign.status])} />
                <span className="flex-1 text-sm truncate">{campaign.name}</span>
                <Badge variant="outline" className="text-xs">{campaign.status}</Badge>
                <span className="text-xs text-muted-foreground">{campaign.sent_count} sent</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function CampaignFoldersTags({ campaigns, onRefresh }: CampaignManagementProps) {
  const [folders, setFolders] = useState<string[]>(['All Campaigns', 'Q4 Outreach', 'Product Launch', 'Nurture']);
  const [tags, setTags] = useState<string[]>(['high-priority', 'a/b-test', 'follow-up', 'cold-outreach', 'warm-leads']);
  const [selectedFolder, setSelectedFolder] = useState('All Campaigns');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [newFolder, setNewFolder] = useState('');
  const [newTag, setNewTag] = useState('');

  const handleAddFolder = () => {
    if (newFolder && !folders.includes(newFolder)) {
      setFolders([...folders, newFolder]);
      setNewFolder('');
    }
  };

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const toggleTag = (tag: string) => {
    const newSet = new Set(selectedTags);
    if (newSet.has(tag)) {
      newSet.delete(tag);
    } else {
      newSet.add(tag);
    }
    setSelectedTags(newSet);
  };

  return (
    <Card data-testid="campaign-folders-tags">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-lg">Folders & Tags</CardTitle>
        </div>
        <CardDescription>Organize campaigns by client, product line, or custom categories</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Folders
            </h4>
            <div className="space-y-1 mb-3">
              {folders.map((folder, idx) => (
                <div
                  key={folder}
                  onClick={() => setSelectedFolder(folder)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded cursor-pointer text-sm",
                    selectedFolder === folder 
                      ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                      : "hover:bg-muted/50"
                  )}
                  data-testid={`folder-${idx}`}
                >
                  <FolderOpen className="h-4 w-4" />
                  <span className="flex-1">{folder}</span>
                  <Badge variant="secondary" className="text-xs">
                    {folder === 'All Campaigns' ? campaigns.length : Math.floor(Math.random() * 5)}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="New folder..."
                value={newFolder}
                onChange={(e) => setNewFolder(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-new-folder"
              />
              <Button size="sm" onClick={handleAddFolder} data-testid="button-add-folder">Add</Button>
            </div>
          </div>

          <div>
            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </h4>
            <div className="flex flex-wrap gap-1 mb-3">
              {tags.map((tag, idx) => (
                <Badge
                  key={tag}
                  variant={selectedTags.has(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                  data-testid={`tag-${idx}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="New tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                className="h-8 text-sm"
                data-testid="input-new-tag"
              />
              <Button size="sm" onClick={handleAddTag} data-testid="button-add-tag">Add</Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 italic flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Folders and tags are demo-only. Full persistence coming soon.
        </p>
      </CardContent>
    </Card>
  );
}

export function CampaignComparisonTool({ campaigns }: { campaigns: Campaign[] }) {
  const [campaignA, setCampaignA] = useState<string>('');
  const [campaignB, setCampaignB] = useState<string>('');

  const campA = campaigns.find(c => c.id === campaignA);
  const campB = campaigns.find(c => c.id === campaignB);

  const getMetric = (campaign: Campaign | undefined, metric: string) => {
    if (!campaign) return 0;
    if (metric === 'openRate') return campaign.sent_count > 0 ? (campaign.opened_count / campaign.sent_count * 100) : 0;
    if (metric === 'clickRate') return campaign.opened_count > 0 ? (campaign.clicked_count / campaign.opened_count * 100) : 0;
    if (metric === 'replyRate') return campaign.sent_count > 0 ? (campaign.replied_count / campaign.sent_count * 100) : 0;
    return 0;
  };

  const metrics = [
    { key: 'sent_count', label: 'Emails Sent', format: (v: number) => v.toString() },
    { key: 'opened_count', label: 'Opens', format: (v: number) => v.toString() },
    { key: 'clicked_count', label: 'Clicks', format: (v: number) => v.toString() },
    { key: 'replied_count', label: 'Replies', format: (v: number) => v.toString() },
    { key: 'openRate', label: 'Open Rate', format: (v: number) => `${v.toFixed(1)}%`, calculated: true },
    { key: 'clickRate', label: 'Click Rate', format: (v: number) => `${v.toFixed(1)}%`, calculated: true },
    { key: 'replyRate', label: 'Reply Rate', format: (v: number) => `${v.toFixed(1)}%`, calculated: true },
  ];

  return (
    <Card data-testid="campaign-comparison-tool">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-purple-600" />
          <CardTitle className="text-lg">Campaign Comparison</CardTitle>
        </div>
        <CardDescription>Side-by-side performance comparison between campaigns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Campaign A</label>
            <Select value={campaignA} onValueChange={setCampaignA}>
              <SelectTrigger data-testid="select-campaign-a">
                <SelectValue placeholder="Select campaign..." />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Campaign B</label>
            <Select value={campaignB} onValueChange={setCampaignB}>
              <SelectTrigger data-testid="select-campaign-b">
                <SelectValue placeholder="Select campaign..." />
              </SelectTrigger>
              <SelectContent>
                {campaigns.filter(c => c.id !== campaignA).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {campA && campB && (
          <div className="border rounded-lg overflow-hidden" data-testid="comparison-results">
            <div className="grid grid-cols-3 bg-muted/50 p-2 text-sm font-medium">
              <div>Metric</div>
              <div className="text-center truncate">{campA.name}</div>
              <div className="text-center truncate">{campB.name}</div>
            </div>
            {metrics.map(metric => {
              const valA = metric.calculated 
                ? getMetric(campA, metric.key)
                : (campA as any)[metric.key] || 0;
              const valB = metric.calculated 
                ? getMetric(campB, metric.key)
                : (campB as any)[metric.key] || 0;
              const winner = valA > valB ? 'A' : valA < valB ? 'B' : 'tie';

              return (
                <div key={metric.key} className="grid grid-cols-3 p-2 border-t text-sm">
                  <div className="text-muted-foreground">{metric.label}</div>
                  <div className={cn(
                    "text-center font-medium",
                    winner === 'A' && "text-green-600"
                  )}>
                    {metric.format(valA)}
                    {winner === 'A' && <TrendingUp className="h-3 w-3 inline ml-1" />}
                  </div>
                  <div className={cn(
                    "text-center font-medium",
                    winner === 'B' && "text-green-600"
                  )}>
                    {metric.format(valB)}
                    {winner === 'B' && <TrendingUp className="h-3 w-3 inline ml-1" />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(!campaignA || !campaignB) && (
          <div className="text-center py-8 text-muted-foreground">
            Select two campaigns to compare their performance
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SmartSendTime({ campaigns }: { campaigns: Campaign[] }) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const campaign = campaigns.find(c => c.id === selectedCampaign);

  const optimalTimes = [
    { day: 'Monday', time: '10:30 AM', confidence: 92, reason: 'Highest open rates historically' },
    { day: 'Tuesday', time: '2:00 PM', confidence: 88, reason: 'Post-lunch engagement peak' },
    { day: 'Wednesday', time: '9:00 AM', confidence: 85, reason: 'Early morning attention' },
    { day: 'Thursday', time: '11:00 AM', confidence: 82, reason: 'Mid-week focus' },
    { day: 'Friday', time: '10:00 AM', confidence: 75, reason: 'Before weekend wind-down' },
  ];

  return (
    <Card data-testid="smart-send-time">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg">Smart Send Time</CardTitle>
        </div>
        <CardDescription>AI-driven optimal timing based on contact engagement patterns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger data-testid="select-campaign-timing">
              <SelectValue placeholder="Select a campaign for timing analysis..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-sm">Sophia's Optimal Send Times</span>
          </div>
          
          {optimalTimes.map((slot, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 bg-muted/30 rounded" data-testid={`send-time-${idx}`}>
              <div className="w-20 font-medium text-sm">{slot.day}</div>
              <div className="w-20 text-sm">{slot.time}</div>
              <Progress value={slot.confidence} className="flex-1 h-2" />
              <Badge variant="outline" className="text-xs">{slot.confidence}%</Badge>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <div className="flex items-start gap-2">
            <Sparkles className="h-4 w-4 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Per-Contact Optimization Available
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Enable "Smart Send" in campaign settings to automatically schedule sends at each contact's optimal time.
              </p>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3 italic flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Demo data shown. Actual times calculated from your engagement history.
        </p>
      </CardContent>
    </Card>
  );
}

export function CampaignVersionHistory({ campaigns }: { campaigns: Campaign[] }) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const campaign = campaigns.find(c => c.id === selectedCampaign);

  const versions = [
    { version: 'v3', date: '2024-01-15 14:30', author: 'John D.', changes: 'Updated subject line A/B test' },
    { version: 'v2', date: '2024-01-14 10:15', author: 'Sarah M.', changes: 'Added LinkedIn follow-up step' },
    { version: 'v1', date: '2024-01-12 09:00', author: 'John D.', changes: 'Initial campaign creation' },
  ];

  return (
    <Card data-testid="campaign-version-history">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-600" />
          <CardTitle className="text-lg">Version History</CardTitle>
        </div>
        <CardDescription>Track changes with the ability to rollback to previous versions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger data-testid="select-campaign-history">
              <SelectValue placeholder="Select a campaign to view history..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {campaign && (
          <div className="space-y-2">
            {versions.map((v, idx) => (
              <div key={v.version} className="flex items-center gap-3 p-3 bg-muted/30 rounded" data-testid={`version-${idx}`}>
                <div className="w-12">
                  <Badge variant={idx === 0 ? "default" : "outline"}>{v.version}</Badge>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{v.changes}</p>
                  <p className="text-xs text-muted-foreground">{v.author} - {v.date}</p>
                </div>
                {idx > 0 && (
                  <Button variant="outline" size="sm" data-testid={`rollback-${idx}`}>
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                )}
                {idx === 0 && (
                  <Badge variant="secondary" className="text-xs">Current</Badge>
                )}
              </div>
            ))}
          </div>
        )}

        {!selectedCampaign && (
          <div className="text-center py-8 text-muted-foreground">
            Select a campaign to view its version history
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3 italic flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Demo data shown. Actual version history tracked automatically.
        </p>
      </CardContent>
    </Card>
  );
}

export function LiveCampaignPreview({ campaigns }: { campaigns: Campaign[] }) {
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const campaign = campaigns.find(c => c.id === selectedCampaign);

  return (
    <Card data-testid="live-campaign-preview">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-green-600" />
          <CardTitle className="text-lg">Campaign Preview</CardTitle>
        </div>
        <CardDescription>Step through the campaign exactly as a contact would experience it</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={selectedCampaign} onValueChange={(v) => { setSelectedCampaign(v); }}>
            <SelectTrigger data-testid="select-campaign-preview">
              <SelectValue placeholder="Select a campaign to preview..." />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {campaign && (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No steps configured</p>
            <p className="text-sm mt-1">Configure campaign steps in the workflow builder to preview them here</p>
          </div>
        )}

        {!selectedCampaign && (
          <div className="text-center py-8 text-muted-foreground">
            Select a campaign to preview the contact experience
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CampaignDependencies({ campaigns }: { campaigns: Campaign[] }) {
  const [sourceCampaign, setSourceCampaign] = useState<string>('');
  const [targetCampaign, setTargetCampaign] = useState<string>('');
  const [triggerCondition, setTriggerCondition] = useState<string>('');

  const dependencies = [
    { source: 'Cold Outreach', target: 'Nurture Sequence', condition: 'when_completed', active: true },
    { source: 'Webinar Invite', target: 'Follow-up Series', condition: 'when_replied', active: true },
  ];

  const conditions = [
    { value: 'when_completed', label: 'When campaign completes' },
    { value: 'when_replied', label: 'When contact replies' },
    { value: 'when_no_response', label: 'When no response after completion' },
    { value: 'when_clicked', label: 'When contact clicks a link' },
  ];

  return (
    <Card data-testid="campaign-dependencies">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-5 w-5 text-cyan-600" />
          <CardTitle className="text-lg">Campaign Dependencies</CardTitle>
        </div>
        <CardDescription>Trigger campaigns based on outcomes of other campaigns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Select value={sourceCampaign} onValueChange={setSourceCampaign}>
            <SelectTrigger data-testid="select-source-campaign">
              <SelectValue placeholder="Source campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={triggerCondition} onValueChange={setTriggerCondition}>
            <SelectTrigger data-testid="select-trigger-condition">
              <SelectValue placeholder="Trigger when..." />
            </SelectTrigger>
            <SelectContent>
              {conditions.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={targetCampaign} onValueChange={setTargetCampaign}>
            <SelectTrigger data-testid="select-target-campaign">
              <SelectValue placeholder="Target campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.filter(c => c.id !== sourceCampaign).map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button className="w-full mb-4" disabled={!sourceCampaign || !targetCampaign || !triggerCondition} data-testid="button-create-dependency">
          Create Dependency
        </Button>

        <div className="space-y-2">
          <h4 className="font-medium text-sm">Active Dependencies</h4>
          {dependencies.map((dep, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm" data-testid={`dependency-${idx}`}>
              <Badge variant="outline">{dep.source}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline">{dep.target}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                {conditions.find(c => c.value === dep.condition)?.label}
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3 italic flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Demo feature. Dependencies will be saved when connected to backend.
        </p>
      </CardContent>
    </Card>
  );
}

export function CampaignResponseInbox({ campaigns }: { campaigns: Campaign[] }) {
  const [filter, setFilter] = useState<string>('all');

  return (
    <Card data-testid="campaign-response-inbox">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-rose-600" />
            <CardTitle className="text-lg">Response Inbox</CardTitle>
            <Badge variant="secondary">0 new</Badge>
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px]" data-testid="filter-responses">
              <SelectValue placeholder="Filter by intent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Responses</SelectItem>
              <SelectItem value="interested">Interested</SelectItem>
              <SelectItem value="question">Questions</SelectItem>
              <SelectItem value="meeting_request">Meeting Requests</SelectItem>
              <SelectItem value="not_interested">Not Interested</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CardDescription>Unified view of all replies across campaigns with quick actions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] flex flex-col items-center justify-center text-center text-muted-foreground">
          <Inbox className="h-12 w-12 mb-4 opacity-30" />
          <p className="font-medium">No responses yet</p>
          <p className="text-sm mt-1">Responses from your active campaigns will appear here</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampaignManagementEnhancements({ campaigns, onRefresh }: CampaignManagementProps) {
  const [activeTab, setActiveTab] = useState('calendar');

  return (
    <div className="space-y-6" data-testid="campaign-management-enhancements">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            Advanced Campaign Management
          </h2>
          <p className="text-muted-foreground">Powerful tools to manage, monitor, and optimize your campaigns</p>
        </div>
        <Button variant="outline" onClick={onRefresh} data-testid="button-refresh-campaigns">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="calendar" data-testid="tab-calendar">
            <CalendarDays className="h-4 w-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">
            <Activity className="h-4 w-4 mr-2" />
            Health
          </TabsTrigger>
          <TabsTrigger value="organize" data-testid="tab-organize">
            <FolderOpen className="h-4 w-4 mr-2" />
            Organize
          </TabsTrigger>
          <TabsTrigger value="analyze" data-testid="tab-analyze">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analyze
          </TabsTrigger>
          <TabsTrigger value="inbox" data-testid="tab-inbox">
            <Inbox className="h-4 w-4 mr-2" />
            Inbox
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <CampaignCalendarView campaigns={campaigns} />
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CampaignHealthDashboard campaigns={campaigns} />
            <SmartSendTime campaigns={campaigns} />
          </div>
        </TabsContent>

        <TabsContent value="organize" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <BulkCampaignOperations campaigns={campaigns} onRefresh={onRefresh} />
            <CampaignFoldersTags campaigns={campaigns} onRefresh={onRefresh} />
          </div>
        </TabsContent>

        <TabsContent value="analyze" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CampaignComparisonTool campaigns={campaigns} />
            <CampaignVersionHistory campaigns={campaigns} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LiveCampaignPreview campaigns={campaigns} />
            <CampaignDependencies campaigns={campaigns} />
          </div>
        </TabsContent>

        <TabsContent value="inbox" className="space-y-4">
          <CampaignResponseInbox campaigns={campaigns} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
