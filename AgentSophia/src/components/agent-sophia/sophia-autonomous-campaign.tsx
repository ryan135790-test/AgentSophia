import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bot, 
  Sparkles,
  Play,
  Pause,
  Target,
  Users,
  Mail,
  Linkedin,
  Search,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  UserPlus,
  FileText,
  Eye,
  RefreshCw,
  Settings2,
  Plus,
  ArrowRight,
  Loader2,
  History
} from "lucide-react";
import type { BrandVoice } from "./brand-voice-selector";

interface SophiaAutonomousCampaign {
  id: string;
  name: string;
  goal: string;
  targetAudience: {
    jobTitles: string[];
    industries: string[];
    companySize: string;
    location: string;
    keywords: string[];
  };
  brandVoiceId: string | null;
  brandVoiceName?: string;
  channels: string[];
  status: 'draft' | 'sourcing' | 'enriching' | 'designing' | 'running' | 'paused' | 'completed';
  leadsFound: number;
  leadsEnriched: number;
  messagesGenerated: number;
  messagesSent: number;
  responses: number;
  createdAt: string;
  lastActivityAt: string;
}

interface ActivityLogEntry {
  id: string;
  campaignId: string;
  timestamp: string;
  action: string;
  details: string;
  status: 'success' | 'pending' | 'in_progress' | 'error';
  metadata?: Record<string, any>;
}

interface SophiaAutonomousCampaignProps {
  workspaceId: string;
}

export function SophiaAutonomousCampaign({ workspaceId }: SophiaAutonomousCampaignProps) {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    goal: '',
    jobTitles: '',
    industries: '',
    companySize: 'any',
    location: '',
    keywords: '',
    brandVoiceId: '',
    channels: ['linkedin', 'email'] as string[],
    approvalMode: 'semi' as 'full' | 'semi' | 'manual'
  });

  const { data: campaignsData, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery<{ campaigns: SophiaAutonomousCampaign[] }>({
    queryKey: ['/api/sophia/autonomous-campaigns', workspaceId],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/sophia/autonomous-campaigns?workspaceId=${workspaceId}`, {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) {
        return { campaigns: [] };
      }
      return response.json();
    },
  });

  const { data: brandVoicesData } = useQuery<{ brand_voices: BrandVoice[] }>({
    queryKey: ['/api/brand-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/brand-voices', {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) {
        return { brand_voices: [] };
      }
      return response.json();
    },
  });

  const { data: activityData, refetch: refetchActivity } = useQuery<{ activities: ActivityLogEntry[] }>({
    queryKey: ['/api/sophia/autonomous-campaigns', selectedCampaignId, 'activity'],
    enabled: !!selectedCampaignId,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!selectedCampaignId) return { activities: [] };
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/sophia/autonomous-campaigns/${selectedCampaignId}/activity`, {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) {
        return { activities: [] };
      }
      return response.json();
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: typeof newCampaign) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/sophia/autonomous-campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          ...campaignData,
          workspaceId,
          targetAudience: {
            jobTitles: campaignData.jobTitles.split(',').map(s => s.trim()).filter(Boolean),
            industries: campaignData.industries.split(',').map(s => s.trim()).filter(Boolean),
            companySize: campaignData.companySize,
            location: campaignData.location,
            keywords: campaignData.keywords.split(',').map(s => s.trim()).filter(Boolean),
          }
        }),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to create campaign');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/autonomous-campaigns'] });
      setShowCreateDialog(false);
      setSelectedCampaignId(data.campaign?.id);
      toast({
        title: "Sophia Campaign Created",
        description: "Sophia is now sourcing leads and designing your campaign.",
      });
      resetNewCampaign();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create campaign. Please try again.",
        variant: "destructive",
      });
    }
  });

  const toggleCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, action }: { campaignId: string; action: 'start' | 'pause' }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/sophia/autonomous-campaigns/${campaignId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`Failed to ${action} campaign`);
      return response.json();
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sophia/autonomous-campaigns'] });
      toast({
        title: action === 'start' ? "Campaign Started" : "Campaign Paused",
        description: action === 'start' ? "Sophia is now running your campaign." : "Campaign has been paused.",
      });
    }
  });

  const resetNewCampaign = () => {
    setNewCampaign({
      name: '',
      goal: '',
      jobTitles: '',
      industries: '',
      companySize: 'any',
      location: '',
      keywords: '',
      brandVoiceId: '',
      channels: ['linkedin', 'email'],
      approvalMode: 'semi'
    });
  };

  const campaigns = campaignsData?.campaigns || [];
  const brandVoices = brandVoicesData?.brand_voices || [];
  const activities = activityData?.activities || [];
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  const getStatusBadge = (status: SophiaAutonomousCampaign['status']) => {
    const statusConfig = {
      draft: { label: 'Draft', variant: 'outline' as const, icon: FileText },
      sourcing: { label: 'Sourcing Leads', variant: 'secondary' as const, icon: Search },
      enriching: { label: 'Enriching', variant: 'secondary' as const, icon: UserPlus },
      designing: { label: 'Designing', variant: 'secondary' as const, icon: Sparkles },
      running: { label: 'Running', variant: 'default' as const, icon: Play },
      paused: { label: 'Paused', variant: 'outline' as const, icon: Pause },
      completed: { label: 'Completed', variant: 'default' as const, icon: CheckCircle2 },
    };
    const config = statusConfig[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getActivityIcon = (action: string) => {
    if (action.includes('search') || action.includes('found')) return <Search className="h-4 w-4 text-blue-500" />;
    if (action.includes('enrich')) return <UserPlus className="h-4 w-4 text-purple-500" />;
    if (action.includes('design') || action.includes('created')) return <Sparkles className="h-4 w-4 text-amber-500" />;
    if (action.includes('sent') || action.includes('message')) return <Mail className="h-4 w-4 text-green-500" />;
    if (action.includes('linkedin') || action.includes('connection')) return <Linkedin className="h-4 w-4 text-blue-600" />;
    if (action.includes('response') || action.includes('replied')) return <MessageSquare className="h-4 w-4 text-emerald-500" />;
    return <Zap className="h-4 w-4 text-slate-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600" />
            Sophia Autonomous Campaigns
          </h3>
          <p className="text-sm text-muted-foreground">
            Let Sophia find leads, design outreach, and run campaigns autonomously
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-sophia-campaign" className="gap-2">
              <Plus className="h-4 w-4" />
              New Sophia Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                Create Sophia Campaign
              </DialogTitle>
              <DialogDescription>
                Tell Sophia your goal and she'll handle lead sourcing, enrichment, campaign design, and execution.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  data-testid="input-campaign-name"
                  placeholder="e.g., Q1 SaaS Founder Outreach"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign-goal">Campaign Goal</Label>
                <Textarea
                  id="campaign-goal"
                  data-testid="input-campaign-goal"
                  placeholder="e.g., Book demo calls with SaaS startup founders to show them our AI sales tool"
                  value={newCampaign.goal}
                  onChange={(e) => setNewCampaign(prev => ({ ...prev, goal: e.target.value }))}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Be specific about what you want to achieve</p>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Target Audience
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="job-titles">Job Titles</Label>
                      <Input
                        id="job-titles"
                        data-testid="input-job-titles"
                        placeholder="CEO, Founder, VP Sales"
                        value={newCampaign.jobTitles}
                        onChange={(e) => setNewCampaign(prev => ({ ...prev, jobTitles: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Comma-separated</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="industries">Industries</Label>
                      <Input
                        id="industries"
                        data-testid="input-industries"
                        placeholder="SaaS, Technology, Software"
                        value={newCampaign.industries}
                        onChange={(e) => setNewCampaign(prev => ({ ...prev, industries: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-size">Company Size</Label>
                      <Select
                        value={newCampaign.companySize}
                        onValueChange={(value) => setNewCampaign(prev => ({ ...prev, companySize: value }))}
                      >
                        <SelectTrigger data-testid="select-company-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any Size</SelectItem>
                          <SelectItem value="1-10">1-10 employees</SelectItem>
                          <SelectItem value="11-50">11-50 employees</SelectItem>
                          <SelectItem value="51-200">51-200 employees</SelectItem>
                          <SelectItem value="201-500">201-500 employees</SelectItem>
                          <SelectItem value="501+">501+ employees</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        data-testid="input-location"
                        placeholder="United States, UK, Remote"
                        value={newCampaign.location}
                        onChange={(e) => setNewCampaign(prev => ({ ...prev, location: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="keywords">Keywords (Optional)</Label>
                    <Input
                      id="keywords"
                      data-testid="input-keywords"
                      placeholder="AI, machine learning, automation"
                      value={newCampaign.keywords}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, keywords: e.target.value }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Brand Voice</Label>
                  <Select
                    value={newCampaign.brandVoiceId}
                    onValueChange={(value) => setNewCampaign(prev => ({ ...prev, brandVoiceId: value }))}
                  >
                    <SelectTrigger data-testid="select-brand-voice">
                      <SelectValue placeholder="Select brand voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {brandVoices.length === 0 && (
                        <SelectItem value="default">Default Professional</SelectItem>
                      )}
                      {brandVoices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Approval Mode</Label>
                  <Select
                    value={newCampaign.approvalMode}
                    onValueChange={(value: 'full' | 'semi' | 'manual') => setNewCampaign(prev => ({ ...prev, approvalMode: value }))}
                  >
                    <SelectTrigger data-testid="select-approval-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Fully Autonomous</SelectItem>
                      <SelectItem value="semi">Semi-Autonomous (Review first 5)</SelectItem>
                      <SelectItem value="manual">Manual Approval</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Channels</Label>
                <div className="flex flex-wrap gap-2">
                  {['linkedin', 'email', 'sms', 'phone'].map((channel) => (
                    <Button
                      key={channel}
                      type="button"
                      variant={newCampaign.channels.includes(channel) ? "default" : "outline"}
                      size="sm"
                      data-testid={`button-channel-${channel}`}
                      onClick={() => {
                        setNewCampaign(prev => ({
                          ...prev,
                          channels: prev.channels.includes(channel)
                            ? prev.channels.filter(c => c !== channel)
                            : [...prev.channels, channel]
                        }));
                      }}
                    >
                      {channel === 'linkedin' && <Linkedin className="h-4 w-4 mr-1" />}
                      {channel === 'email' && <Mail className="h-4 w-4 mr-1" />}
                      {channel === 'sms' && <MessageSquare className="h-4 w-4 mr-1" />}
                      {channel.charAt(0).toUpperCase() + channel.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => createCampaignMutation.mutate(newCampaign)}
                disabled={!newCampaign.name || !newCampaign.goal || createCampaignMutation.isPending}
                data-testid="button-launch-sophia-campaign"
                className="gap-2"
              >
                {createCampaignMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Launch Sophia Campaign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Your Sophia Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No Sophia campaigns yet</p>
                <p className="text-xs mt-1">Create one to let Sophia find and engage leads</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      onClick={() => setSelectedCampaignId(campaign.id)}
                      data-testid={`card-campaign-${campaign.id}`}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedCampaignId === campaign.id 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm">{campaign.name}</h4>
                        {getStatusBadge(campaign.status)}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {campaign.goal}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {campaign.leadsFound}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {campaign.messagesSent}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {campaign.responses}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedCampaign ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedCampaign.name}
                      {getStatusBadge(selectedCampaign.status)}
                    </CardTitle>
                    <CardDescription>{selectedCampaign.goal}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCampaign.status === 'running' ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleCampaignMutation.mutate({ campaignId: selectedCampaign.id, action: 'pause' })}
                        data-testid="button-pause-campaign"
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    ) : selectedCampaign.status !== 'completed' ? (
                      <Button 
                        size="sm"
                        onClick={() => toggleCampaignMutation.mutate({ campaignId: selectedCampaign.id, action: 'start' })}
                        data-testid="button-start-campaign"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        {selectedCampaign.status === 'paused' ? 'Resume' : 'Start'}
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon" onClick={() => refetchActivity()}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="activity">
                  <TabsList>
                    <TabsTrigger value="activity">
                      <History className="h-4 w-4 mr-1" />
                      Activity
                    </TabsTrigger>
                    <TabsTrigger value="metrics">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Metrics
                    </TabsTrigger>
                    <TabsTrigger value="settings">
                      <Settings2 className="h-4 w-4 mr-1" />
                      Settings
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="activity" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      {activities.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No activity yet</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {activities.map((activity) => (
                            <div 
                              key={activity.id} 
                              className="flex items-start gap-3 p-3 rounded-lg border"
                              data-testid={`activity-${activity.id}`}
                            >
                              <div className="mt-0.5">
                                {getActivityIcon(activity.action)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{activity.action}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{activity.details}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(activity.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <Badge 
                                variant={
                                  activity.status === 'success' ? 'default' : 
                                  activity.status === 'error' ? 'destructive' : 
                                  'secondary'
                                }
                                className="shrink-0"
                              >
                                {activity.status === 'success' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {activity.status === 'in_progress' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                {activity.status === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
                                {activity.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="metrics" className="mt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Search className="h-4 w-4" />
                            Leads Found
                          </div>
                          <p className="text-2xl font-bold">{selectedCampaign.leadsFound}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <UserPlus className="h-4 w-4" />
                            Enriched
                          </div>
                          <p className="text-2xl font-bold">{selectedCampaign.leadsEnriched}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Mail className="h-4 w-4" />
                            Messages Sent
                          </div>
                          <p className="text-2xl font-bold">{selectedCampaign.messagesSent}</p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <MessageSquare className="h-4 w-4" />
                            Responses
                          </div>
                          <p className="text-2xl font-bold text-green-600">{selectedCampaign.responses}</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="mt-4">
                      <CardContent className="pt-4">
                        <h4 className="text-sm font-medium mb-3">Pipeline Progress</h4>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>Lead Sourcing</span>
                              <span>{selectedCampaign.leadsFound} found</span>
                            </div>
                            <Progress value={100} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>Enrichment</span>
                              <span>{Math.round((selectedCampaign.leadsEnriched / Math.max(selectedCampaign.leadsFound, 1)) * 100)}%</span>
                            </div>
                            <Progress value={(selectedCampaign.leadsEnriched / Math.max(selectedCampaign.leadsFound, 1)) * 100} className="h-2" />
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span>Outreach</span>
                              <span>{selectedCampaign.messagesSent} / {selectedCampaign.leadsEnriched}</span>
                            </div>
                            <Progress value={(selectedCampaign.messagesSent / Math.max(selectedCampaign.leadsEnriched, 1)) * 100} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="settings" className="mt-4">
                    <Card>
                      <CardContent className="pt-4 space-y-4">
                        <div>
                          <h4 className="text-sm font-medium mb-2">Target Audience</h4>
                          <div className="flex flex-wrap gap-1">
                            {selectedCampaign.targetAudience.jobTitles.map((title, i) => (
                              <Badge key={i} variant="outline">{title}</Badge>
                            ))}
                            {selectedCampaign.targetAudience.industries.map((ind, i) => (
                              <Badge key={i} variant="secondary">{ind}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium mb-2">Channels</h4>
                          <div className="flex gap-2">
                            {selectedCampaign.channels.map((channel) => (
                              <Badge key={channel} className="gap-1">
                                {channel === 'linkedin' && <Linkedin className="h-3 w-3" />}
                                {channel === 'email' && <Mail className="h-3 w-3" />}
                                {channel}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {selectedCampaign.brandVoiceName && (
                          <div>
                            <h4 className="text-sm font-medium mb-2">Brand Voice</h4>
                            <Badge variant="outline">{selectedCampaign.brandVoiceName}</Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex items-center justify-center h-[500px]">
              <div className="text-center text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a campaign to view details</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
