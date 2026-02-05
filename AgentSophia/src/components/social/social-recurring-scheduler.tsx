import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { supabase } from '@/integrations/supabase/client';
import type { BrandVoice } from '@/components/agent-sophia/brand-voice-selector';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Sparkles, 
  Check, 
  X, 
  RefreshCw, 
  Trash2,
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  Bot,
  CalendarDays,
  Repeat,
  Send,
  Eye,
  Edit,
  AlertCircle,
  Building2,
  CheckCircle
} from 'lucide-react';
import { SiTiktok } from 'react-icons/si';
import { format, addDays, parseISO } from 'date-fns';

interface ScheduledSocialPost {
  id: string;
  platform: string;
  content: string | null;
  hashtags: string[] | null;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  approval_status: string;
  recurring_schedule_id: string | null;
  recurring_social_schedules?: {
    name: string;
    platforms: string[];
  };
}

interface RecurringSocialSchedule {
  id: string;
  name: string;
  platforms: string[];
  account_ids?: string[];
  recurrence_type: string;
  recurrence_days: number[];
  post_time: string;
  is_active: boolean;
  topic_guidelines: string | null;
  content_themes: string[];
  posts_generated_count: number;
  posts_approved_count: number;
  posts_published_count: number;
}

interface ConnectedAccount {
  id: string;
  platform: string;
  account_type: string;
  account_name: string;
  account_username: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_default: boolean;
  connection_status: string;
}

const PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'text-blue-600' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'text-blue-700' },
  { id: 'twitter', name: 'Twitter/X', icon: Twitter, color: 'text-black dark:text-white' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'text-pink-600' },
  { id: 'tiktok', name: 'TikTok', icon: SiTiktok, color: 'text-black dark:text-white' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function SocialRecurringScheduler() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledSocialPost | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    platforms: ['linkedin'] as string[],
    account_ids: [] as string[],
    recurrence_type: 'weekly' as const,
    recurrence_days: [1, 3, 5] as number[],
    post_time: '09:00',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    topic_guidelines: '',
    content_themes: [] as string[],
    require_approval: true,
    auto_generate: true,
    brand_voice_id: '' as string,
  });
  const [themeInput, setThemeInput] = useState('');

  const { data: schedules, isLoading: schedulesLoading } = useQuery<RecurringSocialSchedule[]>({
    queryKey: ['/api/social/recurring-schedules']
  });

  const { data: pendingPosts, isLoading: postsLoading } = useQuery<ScheduledSocialPost[]>({
    queryKey: ['/api/social/scheduled-posts/pending-approval']
  });

  const { data: allPosts } = useQuery<ScheduledSocialPost[]>({
    queryKey: ['/api/social/scheduled-posts']
  });

  const { data: connectedAccounts = [] } = useQuery<ConnectedAccount[]>({
    queryKey: ['/api/social-scheduling/connected-accounts']
  });

  const { data: brandVoicesData, isLoading: brandVoicesLoading } = useQuery<{ brand_voices: BrandVoice[] }>({
    queryKey: ['/api/brand-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/brand-voices', {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) return { brand_voices: [] };
      return response.json();
    },
  });

  const brandVoices = brandVoicesData?.brand_voices || [];

  const accountsByPlatform = connectedAccounts.reduce((acc: Record<string, ConnectedAccount[]>, account) => {
    if (!acc[account.platform]) {
      acc[account.platform] = [];
    }
    acc[account.platform].push(account);
    return acc;
  }, {});

  const createScheduleMutation = useMutation({
    mutationFn: async (schedule: typeof newSchedule) => {
      return apiRequest('/api/social/recurring-schedules', {
        method: 'POST',
        body: JSON.stringify(schedule)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/recurring-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/social/scheduled-posts'] });
      setIsCreateOpen(false);
      resetForm();
      toast({
        title: 'Schedule Created',
        description: 'Agent Sophia will generate posts for your recurring schedule. Review them in the approval queue.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create schedule',
        variant: 'destructive',
      });
    }
  });

  const approvePostMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest(`/api/social/scheduled-posts/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/scheduled-posts'] });
      setSelectedPost(null);
      toast({
        title: 'Post Approved',
        description: 'The post will be published at the scheduled time.',
      });
    }
  });

  const rejectPostMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return apiRequest(`/api/social/scheduled-posts/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/scheduled-posts'] });
      setSelectedPost(null);
      setRejectionReason('');
      toast({
        title: 'Post Rejected',
        description: 'The post has been rejected and will not be published.',
      });
    }
  });

  const regeneratePostMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback?: string }) => {
      return apiRequest(`/api/social/scheduled-posts/${id}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ feedback })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/scheduled-posts'] });
      toast({
        title: 'Post Regenerated',
        description: 'Agent Sophia has created a new version of this post.',
      });
    }
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      return apiRequest(`/api/social/scheduled-posts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/scheduled-posts'] });
      setSelectedPost(null);
      setEditedContent('');
      toast({
        title: 'Post Updated',
        description: 'Your changes have been saved.',
      });
    }
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/social/recurring-schedules/${id}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social/recurring-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['/api/social/scheduled-posts'] });
      toast({
        title: 'Schedule Deleted',
        description: 'The recurring schedule and pending posts have been removed.',
      });
    }
  });

  const resetForm = () => {
    setNewSchedule({
      name: '',
      platforms: ['linkedin'],
      account_ids: [],
      recurrence_type: 'weekly',
      recurrence_days: [1, 3, 5],
      post_time: '09:00',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      topic_guidelines: '',
      content_themes: [],
      require_approval: true,
      auto_generate: true,
      brand_voice_id: '',
    });
    setThemeInput('');
  };

  const togglePlatform = (platformId: string) => {
    setNewSchedule(prev => {
      const isRemoving = prev.platforms.includes(platformId);
      const newPlatforms = isRemoving
        ? prev.platforms.filter(p => p !== platformId)
        : [...prev.platforms, platformId];
      
      let newAccountIds = prev.account_ids;
      if (isRemoving) {
        const platformAccounts = accountsByPlatform[platformId] || [];
        const platformAccountIds = platformAccounts.map(a => a.id);
        newAccountIds = prev.account_ids.filter(id => !platformAccountIds.includes(id));
      }
      
      return {
        ...prev,
        platforms: newPlatforms,
        account_ids: newAccountIds
      };
    });
  };

  const toggleAccount = (accountId: string) => {
    setNewSchedule(prev => ({
      ...prev,
      account_ids: prev.account_ids.includes(accountId)
        ? prev.account_ids.filter(id => id !== accountId)
        : [...prev.account_ids, accountId]
    }));
  };

  const getSelectedAccountsInfo = () => {
    return connectedAccounts.filter(acc => newSchedule.account_ids.includes(acc.id));
  };

  const toggleDay = (day: number) => {
    setNewSchedule(prev => ({
      ...prev,
      recurrence_days: prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter(d => d !== day)
        : [...prev.recurrence_days, day].sort()
    }));
  };

  const addTheme = () => {
    if (themeInput.trim() && !newSchedule.content_themes.includes(themeInput.trim())) {
      setNewSchedule(prev => ({
        ...prev,
        content_themes: [...prev.content_themes, themeInput.trim()]
      }));
      setThemeInput('');
    }
  };

  const removeTheme = (theme: string) => {
    setNewSchedule(prev => ({
      ...prev,
      content_themes: prev.content_themes.filter(t => t !== theme)
    }));
  };

  const getPlatformIcon = (platformId: string) => {
    const platform = PLATFORMS.find(p => p.id === platformId);
    if (!platform) return null;
    const Icon = platform.icon;
    return <Icon className={`h-4 w-4 ${platform.color}`} />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending Approval</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      case 'published':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">Published</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="approval" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="approval" className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Approval Queue
              {pendingPosts && pendingPosts.length > 0 && (
                <Badge variant="default" className="ml-1">{pendingPosts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedules" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Recurring Schedules
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar View
            </TabsTrigger>
          </TabsList>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2" data-testid="button-create-schedule">
                <Plus className="h-4 w-4" />
                New Recurring Schedule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Create Recurring Social Schedule
                </DialogTitle>
                <DialogDescription>
                  Set up a recurring schedule and Agent Sophia will automatically generate posts for you to approve before they go live.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="schedule-name">Schedule Name</Label>
                  <Input
                    id="schedule-name"
                    placeholder="e.g., Weekly Thought Leadership"
                    value={newSchedule.name}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-schedule-name"
                  />
                </div>

                <div className="space-y-4">
                  <Label>Post To</Label>
                  
                  <div className="space-y-3">
                    {PLATFORMS.map(platform => {
                      const isSelected = newSchedule.platforms.includes(platform.id);
                      const platformAccounts = accountsByPlatform[platform.id] || [];
                      const selectedAccountsForPlatform = newSchedule.account_ids.filter(id => 
                        platformAccounts.some(acc => acc.id === id)
                      );
                      const Icon = platform.icon;
                      
                      return (
                        <div 
                          key={platform.id} 
                          className={`rounded-lg border transition-all ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                        >
                          <div 
                            className="flex items-center gap-3 p-3 cursor-pointer"
                            onClick={() => togglePlatform(platform.id)}
                            data-testid={`button-platform-${platform.id}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePlatform(platform.id)}
                            />
                            <Icon className={`h-5 w-5 ${platform.color}`} />
                            <span className="font-medium flex-1">{platform.name}</span>
                            {isSelected && platformAccounts.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                {selectedAccountsForPlatform.length > 0 
                                  ? `${selectedAccountsForPlatform.length} selected`
                                  : `${platformAccounts.length} available`}
                              </Badge>
                            )}
                          </div>
                          
                          {isSelected && platformAccounts.length > 0 && (
                            <div className="px-3 pb-3 pt-0">
                              <div className="pl-8 space-y-2">
                                <p className="text-xs text-muted-foreground">Select accounts to post from:</p>
                                {platformAccounts.map(account => (
                                  <div
                                    key={account.id}
                                    className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                                      newSchedule.account_ids.includes(account.id)
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:bg-muted/50'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleAccount(account.id);
                                    }}
                                    data-testid={`account-select-${account.id}`}
                                  >
                                    <Checkbox
                                      checked={newSchedule.account_ids.includes(account.id)}
                                      onCheckedChange={() => toggleAccount(account.id)}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{account.account_name}</p>
                                      {account.account_username && (
                                        <p className="text-xs text-muted-foreground">@{account.account_username}</p>
                                      )}
                                    </div>
                                    <Badge variant="outline" className="text-xs shrink-0">
                                      {account.account_type}
                                    </Badge>
                                    {account.is_default && (
                                      <Badge className="bg-yellow-500/10 text-yellow-600 text-xs">Default</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {isSelected && platformAccounts.length === 0 && (
                            <div className="px-3 pb-3 pt-0">
                              <p className="text-xs text-muted-foreground pl-8">
                                No accounts connected. 
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 pl-1 text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsCreateOpen(false);
                                    window.dispatchEvent(new CustomEvent('social-tab-change', { detail: 'connections' }));
                                  }}
                                  data-testid="button-connect-account"
                                >
                                  Connect one
                                </Button>
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {newSchedule.account_ids.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {newSchedule.account_ids.length} account{newSchedule.account_ids.length > 1 ? 's' : ''} selected for posting
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recurrence Type</Label>
                    <Select
                      value={newSchedule.recurrence_type}
                      onValueChange={(value: any) => setNewSchedule(prev => ({ ...prev, recurrence_type: value }))}
                    >
                      <SelectTrigger data-testid="select-recurrence-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Post Time</Label>
                    <Input
                      type="time"
                      value={newSchedule.post_time}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, post_time: e.target.value }))}
                      data-testid="input-post-time"
                    />
                  </div>
                </div>

                {(newSchedule.recurrence_type === 'weekly' || newSchedule.recurrence_type === 'biweekly') && (
                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <Button
                          key={day.value}
                          variant={newSchedule.recurrence_days.includes(day.value) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleDay(day.value)}
                          className="w-12"
                          data-testid={`button-day-${day.value}`}
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={newSchedule.start_date}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, start_date: e.target.value }))}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={newSchedule.end_date}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, end_date: e.target.value }))}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>

                <Separator />

                {/* Brand Voice Selection */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-purple-500" />
                    Brand Voice
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Select a brand voice for Sophia to use when generating content
                  </p>
                  
                  <Select
                    value={newSchedule.brand_voice_id || 'default'}
                    onValueChange={(value) => setNewSchedule(prev => ({ ...prev, brand_voice_id: value === 'default' ? '' : value }))}
                    disabled={brandVoicesLoading}
                  >
                    <SelectTrigger data-testid="select-brand-voice">
                      <SelectValue placeholder={brandVoicesLoading ? "Loading brand voices..." : "Select brand voice..."} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-muted-foreground" />
                          Default Professional
                        </div>
                      </SelectItem>
                      {brandVoices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-purple-500" />
                            <span>{voice.name}</span>
                            <Badge variant="outline" className="text-xs ml-2">{voice.tone}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {newSchedule.brand_voice_id && brandVoices.find(v => v.id === newSchedule.brand_voice_id) && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 text-sm">
                      <p className="font-medium text-purple-700 dark:text-purple-300">
                        {brandVoices.find(v => v.id === newSchedule.brand_voice_id)?.companyName}
                      </p>
                      <p className="text-purple-600 dark:text-purple-400 text-xs mt-1">
                        Tone: {brandVoices.find(v => v.id === newSchedule.brand_voice_id)?.tone} • 
                        Industry: {brandVoices.find(v => v.id === newSchedule.brand_voice_id)?.industry}
                      </p>
                    </div>
                  )}

                  {brandVoices.length === 0 && !brandVoicesLoading && (
                    <p className="text-xs text-muted-foreground">
                      No custom brand voices yet. Create one in the Brand Voice tab.
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Topic Guidelines for Sophia
                  </Label>
                  <Textarea
                    placeholder="Describe what Sophia should write about... e.g., 'Share insights about AI in marketing, digital transformation trends, and B2B sales strategies'"
                    value={newSchedule.topic_guidelines}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, topic_guidelines: e.target.value }))}
                    className="min-h-[100px]"
                    data-testid="textarea-topic-guidelines"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Content Themes (Sophia will rotate through these)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a theme..."
                      value={themeInput}
                      onChange={(e) => setThemeInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTheme())}
                      data-testid="input-theme"
                    />
                    <Button type="button" onClick={addTheme} variant="outline" data-testid="button-add-theme">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {newSchedule.content_themes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newSchedule.content_themes.map(theme => (
                        <Badge key={theme} variant="secondary" className="flex items-center gap-1">
                          {theme}
                          <button onClick={() => removeTheme(theme)} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="require-approval"
                      checked={newSchedule.require_approval}
                      onCheckedChange={(checked) => setNewSchedule(prev => ({ ...prev, require_approval: checked }))}
                    />
                    <Label htmlFor="require-approval">Require my approval before posting</Label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button 
                  onClick={() => createScheduleMutation.mutate(newSchedule)}
                  disabled={!newSchedule.name || newSchedule.platforms.length === 0 || createScheduleMutation.isPending}
                  data-testid="button-submit-schedule"
                >
                  {createScheduleMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Create & Generate Posts
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="approval" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Posts Awaiting Your Approval
              </CardTitle>
              <CardDescription>
                Agent Sophia has generated these posts for your upcoming schedule. Review and approve each one before it goes live.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {postsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading posts...</div>
              ) : !pendingPosts || pendingPosts.length === 0 ? (
                <div className="text-center py-8">
                  <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-muted-foreground">No posts pending approval</p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {pendingPosts.map((post) => (
                      <Card key={post.id} className="border-l-4 border-l-yellow-500" data-testid={`card-pending-post-${post.id}`}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              {getPlatformIcon(post.platform)}
                              <span className="font-medium capitalize">{post.platform}</span>
                              {getStatusBadge(post.status)}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {post.scheduled_date ? format(parseISO(post.scheduled_date), 'MMM d, yyyy') : 'Not scheduled'}
                              {post.scheduled_time && (
                                <>
                                  <Clock className="h-4 w-4 ml-2" />
                                  {post.scheduled_time}
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="bg-muted/50 rounded-lg p-4 mb-4">
                            <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                            {post.hashtags && post.hashtags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {post.hashtags.map((tag, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">#{tag}</Badge>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPost(post);
                                setEditedContent(post.content || '');
                              }}
                              data-testid={`button-edit-${post.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => regeneratePostMutation.mutate({ id: post.id })}
                              disabled={regeneratePostMutation.isPending}
                              data-testid={`button-regenerate-${post.id}`}
                            >
                              <RefreshCw className={`h-4 w-4 mr-1 ${regeneratePostMutation.isPending ? 'animate-spin' : ''}`} />
                              Regenerate
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => rejectPostMutation.mutate({ id: post.id })}
                              disabled={rejectPostMutation.isPending}
                              data-testid={`button-reject-${post.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => approvePostMutation.mutate({ id: post.id })}
                              disabled={approvePostMutation.isPending}
                              className="bg-green-600 hover:bg-green-700"
                              data-testid={`button-approve-${post.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-primary" />
                Your Recurring Schedules
              </CardTitle>
              <CardDescription>
                Manage your recurring posting schedules. Sophia will generate new posts as each date approaches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {schedulesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading schedules...</div>
              ) : !schedules || schedules.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No recurring schedules yet</p>
                  <p className="text-muted-foreground mb-4">Create a schedule and Sophia will generate posts for you</p>
                  <Button onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Schedule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules.map((schedule) => (
                    <Card key={schedule.id} data-testid={`card-schedule-${schedule.id}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              {schedule.name}
                              {schedule.is_active ? (
                                <Badge variant="outline" className="bg-green-500/10 text-green-600">Active</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-gray-500/10 text-gray-600">Paused</Badge>
                              )}
                            </h4>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Repeat className="h-4 w-4" />
                                {schedule.recurrence_type}
                                {schedule.recurrence_days && schedule.recurrence_days.length > 0 && (
                                  <span className="ml-1">
                                    ({schedule.recurrence_days.map(d => DAYS_OF_WEEK[d]?.label).join(', ')})
                                  </span>
                                )}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {schedule.post_time}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {schedule.platforms.map(p => (
                                <span key={p}>{getPlatformIcon(p)}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right text-sm">
                              <p><span className="font-medium">{schedule.posts_generated_count || 0}</span> generated</p>
                              <p><span className="font-medium">{schedule.posts_approved_count || 0}</span> approved</p>
                              <p><span className="font-medium">{schedule.posts_published_count || 0}</span> published</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-schedule-${schedule.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        {schedule.topic_guidelines && (
                          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Topic Guidelines:</p>
                            <p className="text-sm">{schedule.topic_guidelines}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Upcoming Posts Calendar
              </CardTitle>
              <CardDescription>
                View all your scheduled posts across all platforms
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!allPosts || allPosts.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No scheduled posts yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {allPosts.map((post) => (
                      <div
                        key={post.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        data-testid={`row-scheduled-post-${post.id}`}
                      >
                        <div className="flex items-center gap-3">
                          {getPlatformIcon(post.platform)}
                          <div>
                            <p className="text-sm font-medium">
                              {post.content?.substring(0, 60)}...
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {post.scheduled_date ? format(parseISO(post.scheduled_date), 'MMM d, yyyy') : 'Unscheduled'}
                              {post.scheduled_time && ` at ${post.scheduled_time}`}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(post.status)}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
            <DialogDescription>
              Make changes to the AI-generated content
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="min-h-[200px]"
              data-testid="textarea-edit-content"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPost(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedPost) {
                  updatePostMutation.mutate({ id: selectedPost.id, content: editedContent });
                }
              }}
              disabled={updatePostMutation.isPending}
              data-testid="button-save-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
