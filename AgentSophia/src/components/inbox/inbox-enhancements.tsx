import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { 
  Filter,
  Save,
  Trash2,
  CheckSquare,
  Archive,
  Tag,
  UserPlus,
  Clock,
  Bell,
  FileText,
  Copy,
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  Search,
  AtSign,
  Users,
  Keyboard,
  Timer,
  Brain,
  Star,
  Mail,
  Linkedin,
  Phone,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Send,
  Calendar as CalendarIcon,
  Target,
  DollarSign,
  Flame,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  MoreHorizontal,
  X,
  Plus,
  Play,
  Pause,
  Check,
  AlertCircle,
  Info
} from "lucide-react";
import { format, formatDistanceToNow, addHours, addDays, isAfter, isBefore } from "date-fns";
import { CampaignResponse } from "../../../shared/schema";

interface SavedView {
  id: string;
  name: string;
  filters: {
    intents?: string[];
    channels?: string[];
    isRead?: boolean;
    urgency?: string;
    dateRange?: string;
    assignee?: string;
  };
  isDefault?: boolean;
  sophiaRecommended?: boolean;
}

interface SnoozeConfig {
  messageId: string;
  snoozeUntil: Date;
  reason?: string;
}

interface ResponseTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  tokens: string[];
  sophiaScore?: number;
}

interface TeamMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  online?: boolean;
}

interface InternalNote {
  id: string;
  messageId: string;
  authorId: string;
  authorName: string;
  content: string;
  mentions: string[];
  createdAt: Date;
}

interface SLAConfig {
  urgentResponseTime: number;
  normalResponseTime: number;
  lowResponseTime: number;
}

interface InboxEnhancementsProps {
  responses: CampaignResponse[];
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onApplyFilter: (filters: any) => void;
  onBulkAction: (action: string, ids: string[]) => void;
  currentFilters: any;
}

const demoSavedViews: SavedView[] = [
  { id: '1', name: 'Hot Leads', filters: { intents: ['interested', 'meeting_request'], urgency: 'high' }, sophiaRecommended: true },
  { id: '2', name: 'Needs Response', filters: { isRead: true, urgency: 'high' }, isDefault: true },
  { id: '3', name: 'Meeting Requests', filters: { intents: ['meeting_request'] } },
  { id: '4', name: 'Questions', filters: { intents: ['question'] } },
  { id: '5', name: 'Unread Messages', filters: { isRead: false } },
];

const demoTemplates: ResponseTemplate[] = [
  { id: '1', name: 'Thank You - Interest', content: 'Thank you for your interest in {{product}}! I\'d love to schedule a quick call to discuss how we can help {{company}}. Would {{suggested_time}} work for you?', category: 'interested', tokens: ['product', 'company', 'suggested_time'], sophiaScore: 95 },
  { id: '2', name: 'Answer Question', content: 'Great question! {{answer}} Let me know if you have any other questions - I\'m happy to help.', category: 'question', tokens: ['answer'], sophiaScore: 88 },
  { id: '3', name: 'Schedule Meeting', content: 'I\'d be happy to set up a meeting! Based on your availability, how about {{suggested_times}}? I\'ll send a calendar invite once confirmed.', category: 'meeting_request', tokens: ['suggested_times'], sophiaScore: 92 },
  { id: '4', name: 'Follow Up', content: 'Hi {{first_name}}, just following up on my previous message. Have you had a chance to review {{topic}}? I\'d love to hear your thoughts.', category: 'follow_up', tokens: ['first_name', 'topic'], sophiaScore: 85 },
  { id: '5', name: 'Objection Handler', content: 'I understand your concern about {{objection}}. Many of our clients felt the same way initially. Here\'s how we addressed it: {{solution}}', category: 'objection', tokens: ['objection', 'solution'], sophiaScore: 90 },
];

const demoTeamMembers: TeamMember[] = [
  { id: '1', name: 'Sarah Chen', role: 'Sales Lead', online: true },
  { id: '2', name: 'Mike Johnson', role: 'Account Executive', online: true },
  { id: '3', name: 'Emily Davis', role: 'SDR', online: false },
  { id: '4', name: 'Alex Kim', role: 'Customer Success', online: true },
];

const keyboardShortcuts = [
  { key: 'j', description: 'Next message' },
  { key: 'k', description: 'Previous message' },
  { key: 'r', description: 'Reply to message' },
  { key: 'e', description: 'Archive message' },
  { key: 's', description: 'Snooze message' },
  { key: 'a', description: 'Assign to team member' },
  { key: 't', description: 'Add tag' },
  { key: 'n', description: 'Add internal note' },
  { key: '/', description: 'Focus search' },
  { key: 'Esc', description: 'Clear selection' },
];

export function InboxEnhancements({ 
  responses, 
  selectedIds, 
  onSelectIds, 
  onApplyFilter,
  onBulkAction,
  currentFilters 
}: InboxEnhancementsProps) {
  const [activeTab, setActiveTab] = useState("filters");
  const [savedViews, setSavedViews] = useState<SavedView[]>(demoSavedViews);
  const [newViewName, setNewViewName] = useState("");
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [snoozedMessages, setSnoozedMessages] = useState<SnoozeConfig[]>([]);
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState<Date | undefined>();
  const [templates, setTemplates] = useState<ResponseTemplate[]>(demoTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<ResponseTemplate | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<any>({});
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [slaConfig, setSlaConfig] = useState<SLAConfig>({ urgentResponseTime: 1, normalResponseTime: 4, lowResponseTime: 24 });
  const [sophiaMonitoring, setSophiaMonitoring] = useState(true);
  const [sophiaPriorityQueue, setSophiaPriorityQueue] = useState<CampaignResponse[]>([]);
  const [sophiaInsights, setSophiaInsights] = useState<string[]>([]);

  useEffect(() => {
    if (sophiaMonitoring) {
      generateSophiaPriorityQueue();
      generateSophiaInsights();
    }
  }, [responses, sophiaMonitoring]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!keyboardEnabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          setShowSearchPanel(true);
          break;
        case 'Escape':
          onSelectIds([]);
          setShowSearchPanel(false);
          break;
        case '?':
          if (e.shiftKey) {
            setShowShortcutsDialog(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, onSelectIds]);

  const generateSophiaPriorityQueue = () => {
    const prioritized = [...responses].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;
      
      if (a.intent_tag === 'interested') scoreA += 30;
      if (a.intent_tag === 'meeting_request') scoreA += 35;
      if (a.intent_tag === 'question') scoreA += 20;
      if (!a.is_read) scoreA += 15;
      scoreA += (a.confidence_score || 0) * 20;
      
      if (b.intent_tag === 'interested') scoreB += 30;
      if (b.intent_tag === 'meeting_request') scoreB += 35;
      if (b.intent_tag === 'question') scoreB += 20;
      if (!b.is_read) scoreB += 15;
      scoreB += (b.confidence_score || 0) * 20;
      
      return scoreB - scoreA;
    });
    
    setSophiaPriorityQueue(prioritized.slice(0, 10));
  };

  const generateSophiaInsights = () => {
    const insights: string[] = [];
    
    const unreadCount = responses.filter(r => !r.is_read).length;
    if (unreadCount > 5) {
      insights.push(`You have ${unreadCount} unread messages. I recommend prioritizing the ${Math.min(3, unreadCount)} with highest intent scores.`);
    }
    
    const meetingRequests = responses.filter(r => r.intent_tag === 'meeting_request' && !r.is_read);
    if (meetingRequests.length > 0) {
      insights.push(`${meetingRequests.length} meeting request${meetingRequests.length > 1 ? 's' : ''} awaiting response. These have the highest conversion potential.`);
    }
    
    const interested = responses.filter(r => r.intent_tag === 'interested');
    if (interested.length > 0) {
      insights.push(`${interested.length} lead${interested.length > 1 ? 's show' : ' shows'} strong interest. Consider moving them to the next stage.`);
    }

    const oldUnread = responses.filter(r => {
      if (r.is_read) return false;
      const createdAt = new Date(r.created_at || Date.now());
      return isBefore(createdAt, addHours(new Date(), -24));
    });
    if (oldUnread.length > 0) {
      insights.push(`${oldUnread.length} message${oldUnread.length > 1 ? 's are' : ' is'} over 24 hours old without response. SLA breach risk!`);
    }
    
    setSophiaInsights(insights);
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    
    const newView: SavedView = {
      id: Date.now().toString(),
      name: newViewName,
      filters: currentFilters
    };
    
    setSavedViews([...savedViews, newView]);
    setNewViewName("");
    setShowSaveViewDialog(false);
  };

  const handleDeleteView = (viewId: string) => {
    setSavedViews(savedViews.filter(v => v.id !== viewId));
  };

  const handleApplyView = (view: SavedView) => {
    onApplyFilter(view.filters);
  };

  const handleBulkSelect = (selectAll: boolean) => {
    if (selectAll) {
      onSelectIds(responses.map(r => r.id));
    } else {
      onSelectIds([]);
    }
  };

  const handleSnoozeMessage = (until: Date) => {
    selectedIds.forEach(id => {
      setSnoozedMessages(prev => [...prev, { messageId: id, snoozeUntil: until }]);
    });
    setShowSnoozeDialog(false);
    onSelectIds([]);
  };

  const getSophiaSuggestedTemplate = (intent: string): ResponseTemplate | null => {
    const matching = templates.filter(t => t.category === intent || t.category === 'follow_up');
    return matching.sort((a, b) => (b.sophiaScore || 0) - (a.sophiaScore || 0))[0] || null;
  };

  const getSLAStatus = (response: CampaignResponse): { status: 'ok' | 'warning' | 'breach'; timeLeft: string } => {
    const createdAt = new Date(response.created_at || Date.now());
    const now = new Date();
    const hoursSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    let threshold = slaConfig.normalResponseTime;
    if (response.intent_tag === 'meeting_request' || response.intent_tag === 'interested') {
      threshold = slaConfig.urgentResponseTime;
    }
    
    if (hoursSince > threshold) {
      return { status: 'breach', timeLeft: `${Math.round(hoursSince - threshold)}h overdue` };
    } else if (hoursSince > threshold * 0.75) {
      return { status: 'warning', timeLeft: `${Math.round(threshold - hoursSince)}h left` };
    }
    return { status: 'ok', timeLeft: `${Math.round(threshold - hoursSince)}h left` };
  };

  return (
    <div className="border-b bg-muted/30">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <TabsList className="h-8">
            <TabsTrigger value="filters" className="text-xs px-3" data-testid="tab-filters">
              <Filter className="h-3 w-3 mr-1" /> Filters
            </TabsTrigger>
            <TabsTrigger value="bulk" className="text-xs px-3" data-testid="tab-bulk">
              <CheckSquare className="h-3 w-3 mr-1" /> Bulk ({selectedIds.length})
            </TabsTrigger>
            <TabsTrigger value="priority" className="text-xs px-3" data-testid="tab-priority">
              <Flame className="h-3 w-3 mr-1" /> Priority
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs px-3" data-testid="tab-templates">
              <FileText className="h-3 w-3 mr-1" /> Templates
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs px-3" data-testid="tab-team">
              <Users className="h-3 w-3 mr-1" /> Team
            </TabsTrigger>
            <TabsTrigger value="sla" className="text-xs px-3" data-testid="tab-sla">
              <Timer className="h-3 w-3 mr-1" /> SLA
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearchPanel(!showSearchPanel)}
              className="h-7 text-xs"
              data-testid="button-toggle-search"
            >
              <Search className="h-3 w-3 mr-1" /> Search
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowShortcutsDialog(true)}
              className="h-7 text-xs"
              data-testid="button-shortcuts"
            >
              <Keyboard className="h-3 w-3" />
            </Button>
            <div className="flex items-center gap-1">
              <Brain className="h-4 w-4 text-purple-500" />
              <Switch
                checked={sophiaMonitoring}
                onCheckedChange={setSophiaMonitoring}
                data-testid="switch-sophia-monitoring"
              />
            </div>
          </div>
        </div>

        {showSearchPanel && (
          <div className="p-4 border-b bg-background">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Search messages by keyword, contact name, or content..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  autoFocus
                  data-testid="input-search-messages"
                />
              </div>
              <Select value={searchFilters.channel || 'all'} onValueChange={(v) => setSearchFilters({...searchFilters, channel: v})}>
                <SelectTrigger className="w-32" data-testid="select-search-channel">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
              <Select value={searchFilters.intent || 'all'} onValueChange={(v) => setSearchFilters({...searchFilters, intent: v})}>
                <SelectTrigger className="w-32" data-testid="select-search-intent">
                  <SelectValue placeholder="Intent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Intents</SelectItem>
                  <SelectItem value="interested">Interested</SelectItem>
                  <SelectItem value="question">Question</SelectItem>
                  <SelectItem value="meeting_request">Meeting</SelectItem>
                  <SelectItem value="objection">Objection</SelectItem>
                </SelectContent>
              </Select>
              <Select value={searchFilters.dateRange || 'all'} onValueChange={(v) => setSearchFilters({...searchFilters, dateRange: v})}>
                <SelectTrigger className="w-32" data-testid="select-search-date">
                  <SelectValue placeholder="Date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => { setSearchQuery(""); setSearchFilters({}); }} variant="outline" size="sm" data-testid="button-clear-search">
                Clear
              </Button>
            </div>
          </div>
        )}

        {sophiaMonitoring && sophiaInsights.length > 0 && (
          <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border-b">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-purple-700 dark:text-purple-300">Sophia Insights: </span>
                <span className="text-purple-600 dark:text-purple-400">{sophiaInsights[0]}</span>
                {sophiaInsights.length > 1 && (
                  <span className="text-purple-500 ml-1">(+{sophiaInsights.length - 1} more)</span>
                )}
              </div>
            </div>
          </div>
        )}

        <TabsContent value="filters" className="p-4 m-0">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label className="text-xs font-medium mb-2 block">Saved Views</Label>
              <div className="flex flex-wrap gap-2">
                {savedViews.map(view => (
                  <Badge
                    key={view.id}
                    variant={view.isDefault ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/10 flex items-center gap-1"
                    onClick={() => handleApplyView(view)}
                    data-testid={`badge-view-${view.id}`}
                  >
                    {view.sophiaRecommended && <Sparkles className="h-3 w-3 text-purple-500" />}
                    {view.name}
                    <X
                      className="h-3 w-3 ml-1 hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
                    />
                  </Badge>
                ))}
                <Dialog open={showSaveViewDialog} onOpenChange={setShowSaveViewDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-6 text-xs" data-testid="button-save-view">
                      <Plus className="h-3 w-3 mr-1" /> Save View
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Save Current Filters as View</DialogTitle>
                      <DialogDescription>Create a reusable filter view for quick access</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Label>View Name</Label>
                      <Input
                        value={newViewName}
                        onChange={(e) => setNewViewName(e.target.value)}
                        placeholder="e.g., Hot Leads, Priority Follow-ups"
                        data-testid="input-view-name"
                      />
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSaveViewDialog(false)}>Cancel</Button>
                      <Button onClick={handleSaveView} data-testid="button-confirm-save-view">Save View</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            
            <div>
              <Label className="text-xs font-medium mb-2 block">Quick Filters</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onApplyFilter({ isRead: false })} data-testid="button-filter-unread">
                  Unread
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onApplyFilter({ intents: ['interested', 'meeting_request'] })} data-testid="button-filter-hot">
                  <Flame className="h-3 w-3 mr-1" /> Hot
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onApplyFilter({ urgency: 'high' })} data-testid="button-filter-urgent">
                  <AlertTriangle className="h-3 w-3 mr-1" /> Urgent
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onApplyFilter({})} data-testid="button-filter-clear">
                  <RotateCcw className="h-3 w-3 mr-1" /> Clear
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="p-4 m-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.length === responses.length && responses.length > 0}
                  onCheckedChange={(checked) => handleBulkSelect(!!checked)}
                  data-testid="checkbox-select-all"
                />
                <span className="text-sm">{selectedIds.length} selected</span>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.length === 0}
                  onClick={() => onBulkAction('markRead', selectedIds)}
                  data-testid="button-bulk-read"
                >
                  <Eye className="h-4 w-4 mr-1" /> Mark Read
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.length === 0}
                  onClick={() => onBulkAction('markUnread', selectedIds)}
                  data-testid="button-bulk-unread"
                >
                  <EyeOff className="h-4 w-4 mr-1" /> Mark Unread
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.length === 0}
                  onClick={() => onBulkAction('archive', selectedIds)}
                  data-testid="button-bulk-archive"
                >
                  <Archive className="h-4 w-4 mr-1" /> Archive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.length === 0}
                  onClick={() => setShowSnoozeDialog(true)}
                  data-testid="button-bulk-snooze"
                >
                  <Clock className="h-4 w-4 mr-1" /> Snooze
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={selectedIds.length === 0}
                  onClick={() => onBulkAction('addTag', selectedIds)}
                  data-testid="button-bulk-tag"
                >
                  <Tag className="h-4 w-4 mr-1" /> Tag
                </Button>
              </div>
            </div>
            
            {sophiaMonitoring && selectedIds.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <Sparkles className="h-4 w-4" />
                <span>Sophia recommends: Archive {Math.floor(selectedIds.length * 0.3)} low-priority messages</span>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-purple-600" data-testid="button-sophia-bulk-suggest">
                  Apply
                </Button>
              </div>
            )}
          </div>

          <Dialog open={showSnoozeDialog} onOpenChange={setShowSnoozeDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Snooze Messages
                </DialogTitle>
                <DialogDescription>
                  These messages will reappear at the selected time
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => handleSnoozeMessage(addHours(new Date(), 1))} data-testid="button-snooze-1h">
                    In 1 hour
                  </Button>
                  <Button variant="outline" onClick={() => handleSnoozeMessage(addHours(new Date(), 4))} data-testid="button-snooze-4h">
                    In 4 hours
                  </Button>
                  <Button variant="outline" onClick={() => handleSnoozeMessage(addDays(new Date(), 1))} data-testid="button-snooze-1d">
                    Tomorrow
                  </Button>
                  <Button variant="outline" onClick={() => handleSnoozeMessage(addDays(new Date(), 7))} data-testid="button-snooze-1w">
                    Next week
                  </Button>
                </div>
                <Separator />
                <div>
                  <Label className="mb-2 block">Or pick a date:</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start" data-testid="button-snooze-custom">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {snoozeDate ? format(snoozeDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={snoozeDate}
                        onSelect={setSnoozeDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {sophiaMonitoring && (
                  <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      Sophia suggests: Snooze until tomorrow 9 AM based on typical response patterns
                    </span>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSnoozeDialog(false)}>Cancel</Button>
                {snoozeDate && (
                  <Button onClick={() => handleSnoozeMessage(snoozeDate)} data-testid="button-confirm-snooze">
                    Snooze until {format(snoozeDate, 'PP')}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="priority" className="p-4 m-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                Sophia Priority Queue
              </h3>
              <p className="text-xs text-muted-foreground">Messages ranked by urgency, deal value, and conversion potential</p>
            </div>
            <Button variant="outline" size="sm" onClick={generateSophiaPriorityQueue} data-testid="button-refresh-priority">
              <RotateCcw className="h-4 w-4 mr-1" /> Refresh
            </Button>
          </div>
          
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {sophiaPriorityQueue.map((response, index) => {
                const sla = getSLAStatus(response);
                return (
                  <div
                    key={response.id}
                    className="flex items-center gap-3 p-2 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    data-testid={`priority-item-${response.id}`}
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 text-xs font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{response.sender_name || 'Unknown'}</span>
                        <Badge variant="outline" className="text-xs">{response.intent_tag}</Badge>
                        <Badge 
                          variant={sla.status === 'breach' ? 'destructive' : sla.status === 'warning' ? 'secondary' : 'outline'}
                          className="text-xs"
                        >
                          {sla.timeLeft}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{response.message_content}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Priority</div>
                        <div className="text-sm font-medium text-purple-600">{Math.round((response.confidence_score || 0.5) * 100)}%</div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7" data-testid={`button-respond-${response.id}`}>
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="templates" className="p-4 m-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium">Response Templates</h3>
              <p className="text-xs text-muted-foreground">Quick responses with personalization tokens</p>
            </div>
            <Button variant="outline" size="sm" data-testid="button-new-template">
              <Plus className="h-4 w-4 mr-1" /> New Template
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {templates.map(template => (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => { setSelectedTemplate(template); setShowTemplateDialog(true); }}
                data-testid={`template-${template.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{template.name}</span>
                    {template.sophiaScore && (
                      <Badge variant="outline" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1 text-purple-500" />
                        {template.sophiaScore}%
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{template.content}</p>
                  <div className="flex gap-1 mt-2">
                    {template.tokens.slice(0, 2).map(token => (
                      <Badge key={token} variant="secondary" className="text-xs">
                        {`{{${token}}}`}
                      </Badge>
                    ))}
                    {template.tokens.length > 2 && (
                      <Badge variant="secondary" className="text-xs">+{template.tokens.length - 2}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedTemplate?.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  value={selectedTemplate?.content || ''}
                  className="min-h-32"
                  readOnly
                />
                <div>
                  <Label className="text-xs">Personalization Tokens</Label>
                  <div className="flex gap-2 mt-1">
                    {selectedTemplate?.tokens.map(token => (
                      <Badge key={token} variant="outline">{`{{${token}}}`}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
                <Button data-testid="button-use-template">
                  <Copy className="h-4 w-4 mr-1" /> Use Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="team" className="p-4 m-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-3">Team Members</h3>
              <div className="space-y-2">
                {demoTeamMembers.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2 border rounded-lg"
                    data-testid={`team-member-${member.id}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{member.name}</span>
                        {member.online && <span className="w-2 h-2 rounded-full bg-green-500" />}
                      </div>
                      <span className="text-xs text-muted-foreground">{member.role}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={selectedIds.length === 0}
                      onClick={() => onBulkAction('assign', selectedIds)}
                      data-testid={`button-assign-${member.id}`}
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                Internal Notes
                <Button variant="ghost" size="sm" onClick={() => setShowNoteDialog(true)} data-testid="button-add-note">
                  <Plus className="h-4 w-4" />
                </Button>
              </h3>
              <div className="space-y-2">
                {internalNotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center border rounded-lg">
                    No notes yet. Add internal notes to collaborate with your team.
                  </p>
                ) : (
                  internalNotes.map(note => (
                    <div key={note.id} className="p-2 border rounded-lg text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{note.authorName}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(note.createdAt, { addSuffix: true })}
                        </span>
                      </div>
                      <p>{note.content}</p>
                    </div>
                  ))
                )}
              </div>

              {sophiaMonitoring && (
                <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="font-medium text-sm text-purple-700 dark:text-purple-300">Sophia Routing</span>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    I'm monitoring team workloads. Sarah has capacity for 3 more messages today. 
                    Consider routing urgent items to her.
                  </p>
                </div>
              )}
            </div>
          </div>

          <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Internal Note</DialogTitle>
                <DialogDescription>This note is only visible to your team</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note... Use @name to mention team members"
                  className="min-h-24"
                  data-testid="input-internal-note"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    setInternalNotes([...internalNotes, {
                      id: Date.now().toString(),
                      messageId: selectedIds[0] || '',
                      authorId: '1',
                      authorName: 'You',
                      content: newNote,
                      mentions: [],
                      createdAt: new Date()
                    }]);
                    setNewNote("");
                    setShowNoteDialog(false);
                  }}
                  data-testid="button-save-note"
                >
                  Save Note
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="sla" className="p-4 m-0">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-3">Response Time SLA</h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Urgent (Interested/Meeting Request)</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={slaConfig.urgentResponseTime}
                      onChange={(e) => setSlaConfig({...slaConfig, urgentResponseTime: parseInt(e.target.value) || 1})}
                      className="w-20"
                      data-testid="input-sla-urgent"
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Normal Priority</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={slaConfig.normalResponseTime}
                      onChange={(e) => setSlaConfig({...slaConfig, normalResponseTime: parseInt(e.target.value) || 4})}
                      className="w-20"
                      data-testid="input-sla-normal"
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Low Priority</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={slaConfig.lowResponseTime}
                      onChange={(e) => setSlaConfig({...slaConfig, lowResponseTime: parseInt(e.target.value) || 24})}
                      className="w-20"
                      data-testid="input-sla-low"
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3">Current SLA Status</h3>
              <div className="space-y-2">
                {responses.slice(0, 5).map(response => {
                  const sla = getSLAStatus(response);
                  return (
                    <div
                      key={response.id}
                      className={`flex items-center justify-between p-2 border rounded-lg ${
                        sla.status === 'breach' ? 'border-red-500 bg-red-50 dark:bg-red-950/30' :
                        sla.status === 'warning' ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30' : ''
                      }`}
                      data-testid={`sla-status-${response.id}`}
                    >
                      <div className="flex items-center gap-2">
                        {sla.status === 'breach' ? (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        ) : sla.status === 'warning' ? (
                          <AlertCircle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Check className="h-4 w-4 text-green-500" />
                        )}
                        <span className="text-sm truncate max-w-32">{response.sender_name || 'Unknown'}</span>
                      </div>
                      <Badge
                        variant={sla.status === 'breach' ? 'destructive' : sla.status === 'warning' ? 'secondary' : 'outline'}
                      >
                        {sla.timeLeft}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {sophiaMonitoring && (
                <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span className="font-medium text-sm text-purple-700 dark:text-purple-300">Sophia SLA Monitor</span>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    {responses.filter(r => getSLAStatus(r).status === 'breach').length > 0
                      ? `Warning: ${responses.filter(r => getSLAStatus(r).status === 'breach').length} messages are past SLA. I'll notify you before others breach.`
                      : 'All messages are within SLA. I\'ll alert you 15 minutes before any breach.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showShortcutsDialog} onOpenChange={setShowShortcutsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-5 w-5" /> Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            {keyboardShortcuts.map(shortcut => (
              <div key={shortcut.key} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">{shortcut.description}</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{shortcut.key}</kbd>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-4 border-t">
            <span className="text-sm">Enable keyboard shortcuts</span>
            <Switch
              checked={keyboardEnabled}
              onCheckedChange={setKeyboardEnabled}
              data-testid="switch-keyboard-shortcuts"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ConversationThread({ contactId, responses }: { contactId: string; responses: CampaignResponse[] }) {
  const contactResponses = responses.filter(r => r.contact_id === contactId);
  const [sophiaAnalysis, setSophiaAnalysis] = useState<string>("");
  
  useEffect(() => {
    if (contactResponses.length > 1) {
      setSophiaAnalysis(`Conversation pattern: ${contactResponses.length} exchanges over ${formatDistanceToNow(new Date(contactResponses[0].created_at || Date.now()))}. Sentiment trending ${contactResponses[contactResponses.length - 1].intent_tag === 'interested' ? 'positive' : 'neutral'}.`);
    }
  }, [contactResponses]);

  return (
    <div className="space-y-4">
      {sophiaAnalysis && (
        <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
          <Sparkles className="h-4 w-4 text-purple-500 mt-0.5" />
          <div>
            <span className="font-medium text-sm text-purple-700 dark:text-purple-300">Sophia Analysis: </span>
            <span className="text-sm text-purple-600 dark:text-purple-400">{sophiaAnalysis}</span>
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        {contactResponses.map((response, index) => (
          <div
            key={response.id}
            className={`p-3 rounded-lg ${index % 2 === 0 ? 'bg-muted ml-8' : 'bg-primary/10 mr-8'}`}
            data-testid={`thread-message-${response.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">{response.sender_name || 'Unknown'}</span>
              <span className="text-xs text-muted-foreground">
                {response.created_at ? format(new Date(response.created_at), 'PPp') : 'Unknown date'}
              </span>
            </div>
            <p className="text-sm">{response.message_content}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">{response.channel}</Badge>
              <Badge variant="outline" className="text-xs">{response.intent_tag}</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
