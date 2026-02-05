import { useState, useEffect } from 'react';
import { useCampaigns, useCreateCampaign, useUpdateCampaign, useDeleteCampaign, useCampaignStats } from '@/hooks/use-campaigns';
import { useContacts } from '@/hooks/use-contacts';
import { Campaign, InsertCampaign } from '../../../shared/schema';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { 
  Megaphone, 
  Plus, 
  Search, 
  Play,
  Pause,
  Trash2,
  Edit,
  MoreHorizontal,
  Mail,
  Linkedin,
  MessageSquare,
  Phone,
  TrendingUp,
  Users,
  BarChart3,
  Eye,
  MousePointer,
  Reply,
  Rocket,
  Settings,
  Clock,
  Calendar,
  Building2,
  Sparkles,
  Copy,
  FileText
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { CampaignTemplateSelector } from './campaign-template-selector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CampaignAnalytics } from './campaign-analytics';
import { SophiaCampaignMonitor } from '@/components/agent-sophia/sophia-campaign-monitor';
import { CampaignManagementEnhancements } from './campaign-management-enhancements';
import { CampaignPipelineView } from './campaign-pipeline-view';
import { Sheet, SheetContent } from '@/components/ui/sheet';

const CAMPAIGN_TYPES = [
  { value: 'email', label: 'Email Campaign', icon: Mail },
  { value: 'linkedin', label: 'LinkedIn Outreach', icon: Linkedin },
  { value: 'multi-channel', label: 'Multi-Channel', icon: Megaphone },
];

const CAMPAIGN_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-500' },
  { value: 'active', label: 'Active', color: 'bg-green-500' },
  { value: 'paused', label: 'Paused', color: 'bg-yellow-500' },
  { value: 'completed', label: 'Completed', color: 'bg-blue-500' },
];

export function CampaignsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  
  const { data: campaigns = [], isLoading } = useCampaigns(workspaceId);
  const { data: contacts = [] } = useContacts();
  const { data: stats } = useCampaignStats();
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign(workspaceId);
  const deleteCampaign = useDeleteCampaign(workspaceId);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLaunchOpen, setIsLaunchOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'scheduled'>('now');
  const [selectedChannel, setSelectedChannel] = useState<'email' | 'sms' | 'linkedin'>('email');
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsSelectedCampaign, setAnalyticsSelectedCampaign] = useState<Campaign | null>(null);
  const [isSophiaMonitorOpen, setIsSophiaMonitorOpen] = useState(false);
  const [monitorSelectedCampaign, setMonitorSelectedCampaign] = useState<Campaign | null>(null);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [pipelineSelectedCampaign, setPipelineSelectedCampaign] = useState<Campaign | null>(null);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [systemProviders, setSystemProviders] = useState<any[]>([]);
  const [selectedEmailAccount, setSelectedEmailAccount] = useState<string>('auto');
  const [loadingProviders, setLoadingProviders] = useState(false);
  
  const [formData, setFormData] = useState<Partial<InsertCampaign> & { is_demo?: boolean }>({
    name: '',
    description: '',
    type: 'email',
    status: 'draft',
    is_demo: false,
  });
  const [modeFilter, setModeFilter] = useState('all');
  const [showTemplateSelector, setShowTemplateSelector] = useState(true);
  const [templateSteps, setTemplateSteps] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'advanced'>('list');

  const cloneCampaignMutation = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName?: string }) => {
      return apiRequest(`/api/campaigns/${id}/clone`, {
        method: 'POST',
        body: JSON.stringify({ newName })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: 'Success', description: 'Campaign cloned successfully!' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to clone campaign', variant: 'destructive' });
    }
  });

  const handleCloneCampaign = async (campaign: Campaign) => {
    const newName = prompt('Enter a name for the cloned campaign:', `${campaign.name} (Copy)`);
    if (newName) {
      await cloneCampaignMutation.mutateAsync({ id: campaign.id, newName });
    }
  };

  const handleSelectTemplate = async (template: any) => {
    setFormData({
      name: template.name,
      description: template.description,
      type: template.channels.includes('linkedin') && template.channels.includes('email') ? 'multi-channel' : 
            template.channels.includes('linkedin') ? 'linkedin' : 'email',
      status: 'draft',
    });
    setTemplateSteps(template.steps.map((step: any) => ({
      channel: step.channel,
      label: `Step ${step.order}`,
      subject: step.subject || null,
      content: step.content,
      delay: step.delay,
      delayUnit: step.delayUnit,
      order: step.order - 1,
    })));
    setShowTemplateSelector(false);
    toast({ 
      title: 'Template Applied', 
      description: `"${template.name}" template loaded. Customize and save your campaign.` 
    });
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesMode = modeFilter === 'all' || 
      (modeFilter === 'demo' && (campaign as any).is_demo) ||
      (modeFilter === 'live' && !(campaign as any).is_demo);
    return matchesSearch && matchesStatus && matchesMode;
  });

  const handleCreateCampaign = async () => {
    if (!formData.name) {
      toast({ title: 'Error', description: 'Campaign name is required', variant: 'destructive' });
      return;
    }
    
    try {
      const campaignData = {
        ...formData,
        steps: templateSteps.length > 0 ? templateSteps : undefined
      };
      await createCampaign.mutateAsync(campaignData as InsertCampaign);
      setIsCreateOpen(false);
      setFormData({ name: '', description: '', type: 'email', status: 'draft', is_demo: false });
      setTemplateSteps([]);
      setShowTemplateSelector(true);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    if (confirm('Are you sure you want to delete this campaign?')) {
      await deleteCampaign.mutateAsync(id);
    }
  };

  const fetchEmailAccounts = async () => {
    setLoadingProviders(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      
      const response = await fetch('/api/email-accounts', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmailAccounts(data.userAccounts || []);
        setSystemProviders(data.systemProviders || []);
      }
    } catch (error) {
      console.error('Error fetching email accounts:', error);
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!selectedCampaign) return;
    
    if (selectedContacts.length === 0) {
      toast({ title: 'Error', description: 'Please select at least one contact', variant: 'destructive' });
      return;
    }
    
    setIsLaunching(true);
    setLaunchProgress(0);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      const isDemo = (selectedCampaign as any).is_demo || false;
      
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          isDemo,
          contactIds: selectedContacts,
          steps: [
            { 
              channel: selectedChannel, 
              subject: selectedChannel === 'email' ? selectedCampaign.name : undefined, 
              content: selectedChannel === 'sms' 
                ? `Hi {{first_name}}, message from ${selectedCampaign.name}` 
                : 'Hello {{first_name}}, this is a test message from your campaign.' 
            }
          ],
          scheduledAt: scheduleMode === 'scheduled' ? scheduledAt : null,
          emailAccountId: selectedEmailAccount !== 'auto' && !isNaN(Number(selectedEmailAccount)) 
            ? Number(selectedEmailAccount) 
            : undefined,
          emailProvider: selectedEmailAccount === 'sendgrid' || selectedEmailAccount === 'resend' 
            ? selectedEmailAccount 
            : undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to launch campaign');
      }
      
      const result = await response.json();
      
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        setLaunchProgress(i);
        await new Promise(r => setTimeout(r, 200));
      }
      
      const message = scheduleMode === 'scheduled' 
        ? `Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}`
        : `Successfully sent to ${result.sentCount} contacts`;
      
      toast({
        title: scheduleMode === 'scheduled' ? 'Campaign Scheduled!' : 'Campaign Launched!',
        description: message,
      });
      
      setIsLaunchOpen(false);
      setSelectedContacts([]);
      setSelectedCampaign(null);
      setScheduledAt('');
      setScheduleMode('now');
      
    } catch (error: any) {
      toast({
        title: 'Launch Failed',
        description: error.message || 'Failed to launch campaign',
        variant: 'destructive',
      });
    } finally {
      setIsLaunching(false);
      setLaunchProgress(0);
    }
  };

  const openLaunchDialog = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsLaunchOpen(true);
    setSelectedEmailAccount('auto');
    fetchEmailAccounts();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = CAMPAIGN_STATUSES.find(s => s.value === status);
    return (
      <Badge className={`${statusConfig?.color || 'bg-gray-500'} text-white`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = CAMPAIGN_TYPES.find(t => t.value === type);
    const Icon = typeConfig?.icon || Megaphone;
    return <Icon className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Campaigns</h2>
            <p className="text-muted-foreground">Create and manage your outreach campaigns</p>
          </div>
        <div className="flex gap-2">
          <Button 
            variant={viewMode === 'advanced' ? 'default' : 'outline'}
            onClick={() => setViewMode(viewMode === 'list' ? 'advanced' : 'list')}
            data-testid="button-toggle-view"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {viewMode === 'list' ? 'Advanced Tools' : 'Campaign List'}
          </Button>
          <Button variant="outline" onClick={() => navigate('/chat-sophia')}>
            <Settings className="h-4 w-4 mr-2" />
            Build with Sophia
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" data-testid="button-create-campaign">
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className={showTemplateSelector ? "max-w-4xl" : ""}>
              <DialogHeader>
                <DialogTitle>Create New Campaign</DialogTitle>
                <DialogDescription>
                  {showTemplateSelector 
                    ? 'Start with a template or build from scratch'
                    : 'Set up a new outreach campaign'}
                </DialogDescription>
              </DialogHeader>
              
              {showTemplateSelector ? (
                <div className="space-y-4 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span className="font-medium">Campaign Templates</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowTemplateSelector(false)}
                    >
                      Start from Scratch
                    </Button>
                  </div>
                  <CampaignTemplateSelector 
                    onSelectTemplate={handleSelectTemplate}
                    onSkip={() => setShowTemplateSelector(false)}
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-4 py-4">
                    {templateSteps.length > 0 && (
                      <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 mb-4">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            Template loaded with {templateSteps.length} steps
                          </span>
                        </div>
                      </div>
                    )}
                    <div>
                      <Label htmlFor="name">Campaign Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Q4 Enterprise Outreach"
                        data-testid="input-campaign-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ''}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe the campaign objectives..."
                        data-testid="input-campaign-description"
                      />
                    </div>
                    <div>
                      <Label>Campaign Type</Label>
                      <Select 
                        value={formData.type} 
                        onValueChange={(value) => setFormData({ ...formData, type: value as any })}
                      >
                        <SelectTrigger data-testid="select-campaign-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMPAIGN_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div className="flex items-center gap-2">
                                <type.icon className="h-4 w-4" />
                                {type.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-base font-medium">Demo Mode</Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            Demo campaigns simulate sending without actually delivering messages. 
                            Use this for testing and demonstrations.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${!formData.is_demo ? 'font-medium text-green-600' : 'text-muted-foreground'}`}>LIVE</span>
                          <Checkbox 
                            checked={formData.is_demo || false}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_demo: checked === true })}
                            data-testid="checkbox-demo-mode"
                          />
                          <span className={`text-sm ${formData.is_demo ? 'font-medium text-orange-600' : 'text-muted-foreground'}`}>DEMO</span>
                        </div>
                      </div>
                      {!formData.is_demo && (
                        <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-700 dark:text-green-300">
                          <strong>Live Mode:</strong> This campaign will send real messages to real contacts. 
                          Make sure your email/LinkedIn accounts are connected.
                        </div>
                      )}
                      {formData.is_demo && (
                        <div className="mt-3 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded text-sm text-orange-700 dark:text-orange-300">
                          <strong>Demo Mode:</strong> Messages will be simulated. 
                          No real emails or LinkedIn messages will be sent.
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setShowTemplateSelector(true);
                        setTemplateSteps([]);
                        setFormData({ name: '', description: '', type: 'email', status: 'draft', is_demo: false });
                      }}
                    >
                      Back to Templates
                    </Button>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleCreateCampaign} 
                      disabled={createCampaign.isPending}
                      data-testid="button-submit-campaign"
                    >
                      {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Current Workspace Info */}
      <div className="p-4 border rounded-lg bg-card">
        <p className="text-sm font-medium mb-2">Current Workspace</p>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{currentWorkspace?.name || 'No workspace selected'}</span>
          {workspaceId && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => navigate(`/workspace/${workspaceId}/settings`)}
              data-testid="button-workspace-settings"
            >
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Button>
          )}
        </div>
      </div>
      </div>

      {/* Advanced Management View */}
      {viewMode === 'advanced' && (
        <CampaignManagementEnhancements 
          campaigns={campaigns} 
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] })} 
        />
      )}

      {/* Standard List View */}
      {viewMode === 'list' && (
        <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Campaigns</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <Megaphone className="h-8 w-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-500">{stats?.active || 0}</p>
              </div>
              <Play className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Messages Sent</p>
                <p className="text-2xl font-bold">{stats?.totalSent || 0}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Replies</p>
                <p className="text-2xl font-bold text-purple-500">{stats?.totalReplied || 0}</p>
              </div>
              <Reply className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-campaigns"
          />
        </div>
        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-full sm:w-[140px]" data-testid="select-mode-filter">
            <SelectValue placeholder="Filter by mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Modes</SelectItem>
            <SelectItem value="live">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Live Only
              </span>
            </SelectItem>
            <SelectItem value="demo">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500" />
                Demo Only
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {CAMPAIGN_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {filteredCampaigns.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first campaign to start reaching out to prospects
              </p>
              <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-campaign">
                <Plus className="h-4 w-4 mr-2" />
                Create Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredCampaigns.map((campaign) => (
            <Card 
              key={campaign.id} 
              className={`hover:shadow-md transition-shadow ${(campaign as any).is_demo ? 'border-orange-300 dark:border-orange-700 bg-orange-50/30 dark:bg-orange-900/10' : 'border-green-300 dark:border-green-700'}`}
              data-testid={`card-campaign-${campaign.id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${(campaign as any).is_demo ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-primary/10'}`}>
                      {getTypeIcon(campaign.type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{campaign.name}</h3>
                        {(campaign as any).is_demo ? (
                          <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700">
                            DEMO
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
                            LIVE
                          </Badge>
                        )}
                        {getStatusBadge(campaign.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {campaign.description || 'No description'}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {campaign.sent_count || 0} sent
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {campaign.opened_count || 0} opened
                        </span>
                        <span className="flex items-center gap-1">
                          <MousePointer className="h-3 w-3" />
                          {campaign.clicked_count || 0} clicked
                        </span>
                        <span className="flex items-center gap-1">
                          <Reply className="h-3 w-3" />
                          {campaign.replied_count || 0} replies
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openLaunchDialog(campaign)}
                      disabled={campaign.status === 'active'}
                      data-testid={`button-launch-${campaign.id}`}
                    >
                      <Rocket className="h-4 w-4 mr-1" />
                      Launch
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/workflows?campaign=${campaign.id}`)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Workflow
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setAnalyticsSelectedCampaign(campaign);
                          setIsAnalyticsOpen(true);
                        }}
                        data-testid={`button-view-analytics-${campaign.id}`}
                        >
                          <BarChart3 className="h-4 w-4 mr-2" />
                          View Analytics
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setPipelineSelectedCampaign(campaign);
                            setIsPipelineOpen(true);
                          }}
                          data-testid={`button-pipeline-${campaign.id}`}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Contact Pipeline
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setMonitorSelectedCampaign(campaign);
                            setIsSophiaMonitorOpen(true);
                          }}
                          data-testid={`button-sophia-monitor-${campaign.id}`}
                        >
                          <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
                          Sophia Monitor
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleCloneCampaign(campaign)}
                          data-testid={`button-clone-${campaign.id}`}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Clone Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
        </>
      )}

      {/* Launch Campaign Dialog */}
      <Dialog open={isLaunchOpen} onOpenChange={setIsLaunchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Launch Campaign: {selectedCampaign?.name}
              {(selectedCampaign as any)?.is_demo ? (
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">DEMO</Badge>
              ) : (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">LIVE</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {(selectedCampaign as any)?.is_demo 
                ? 'This is a demo campaign. Messages will be simulated - no real emails will be sent.'
                : 'This is a live campaign. Real messages will be sent to selected contacts.'}
            </DialogDescription>
          </DialogHeader>
          
          {isLaunching ? (
            <div className="py-8 space-y-4">
              <div className="text-center">
                <Rocket className="h-12 w-12 mx-auto text-primary animate-bounce" />
                <p className="mt-4 font-medium">Launching campaign...</p>
              </div>
              <Progress value={launchProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                Sending to {selectedContacts.length} contacts
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
                <div className="p-3 border rounded-lg bg-muted/50">
                  <Label className="text-base font-medium mb-3 block">Email Account</Label>
                  <Select 
                    value={selectedEmailAccount} 
                    onValueChange={setSelectedEmailAccount}
                    disabled={loadingProviders}
                  >
                    <SelectTrigger data-testid="select-email-account">
                      <SelectValue placeholder={loadingProviders ? "Loading accounts..." : "Select email account"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (use best available)</SelectItem>
                      {emailAccounts.length > 0 && (
                        <>
                          {emailAccounts.map((account) => (
                            <SelectItem key={account.id} value={String(account.id)}>
                              {account.label} - {account.email}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {systemProviders.length > 0 && (
                        <>
                          {systemProviders.map((provider) => (
                            <SelectItem key={provider.id} value={provider.id}>
                              {provider.label}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  {emailAccounts.length === 0 && systemProviders.length === 0 && !loadingProviders && (
                    <p className="text-xs text-muted-foreground mt-2">
                      No email accounts connected. <a href="/my-connections" className="text-blue-500 underline">Connect one</a>
                    </p>
                  )}
                </div>

                <div className="p-3 border rounded-lg bg-muted/50">
                  <Label className="text-base font-medium mb-3 block">Send Timing</Label>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="send-now"
                        name="schedule"
                        value="now"
                        checked={scheduleMode === 'now'}
                        onChange={() => setScheduleMode('now')}
                        data-testid="radio-send-now"
                      />
                      <Label htmlFor="send-now" className="font-normal cursor-pointer">Send immediately</Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="send-scheduled"
                        name="schedule"
                        value="scheduled"
                        checked={scheduleMode === 'scheduled'}
                        onChange={() => setScheduleMode('scheduled')}
                        data-testid="radio-send-scheduled"
                      />
                      <Label htmlFor="send-scheduled" className="font-normal cursor-pointer">Schedule for later</Label>
                    </div>
                    {scheduleMode === 'scheduled' && (
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="ml-6"
                        data-testid="input-scheduled-time"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-muted-foreground">
                      {selectedContacts.length} of {contacts.length} contacts selected
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedContacts(
                        selectedContacts.length === contacts.length 
                          ? [] 
                          : contacts.map(c => c.id)
                      )}
                    >
                      {selectedContacts.length === contacts.length ? 'Deselect All' : 'Select All'}
                    </Button>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {contacts.map((contact) => (
                      <div 
                        key={contact.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedContacts([...selectedContacts, contact.id]);
                            } else {
                              setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-medium">
                            {contact.first_name} {contact.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {contact.email} {contact.company && `• ${contact.company}`}
                          </p>
                        </div>
                      </div>
                    ))}
                    {contacts.length === 0 && (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">No contacts available</p>
                        <Button 
                          variant="link" 
                          onClick={() => {
                            setIsLaunchOpen(false);
                            navigate('/contacts');
                          }}
                        >
                          Add contacts first
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLaunchOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleLaunchCampaign}
              disabled={selectedContacts.length === 0}
              data-testid="button-confirm-launch"
            >
              <Rocket className="h-4 w-4 mr-2" />
              {scheduleMode === 'scheduled' ? 'Schedule' : 'Launch'} to {selectedContacts.length} Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics Modal */}
      <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Campaign Analytics: {analyticsSelectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              Performance metrics and engagement tracking
            </DialogDescription>
          </DialogHeader>
          {analyticsSelectedCampaign && (
            <CampaignAnalytics campaign={analyticsSelectedCampaign} />
          )}
        </DialogContent>
      </Dialog>

      {/* Sophia Campaign Monitor Dialog */}
      <Dialog open={isSophiaMonitorOpen} onOpenChange={setIsSophiaMonitorOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Sophia Campaign Monitor
            </DialogTitle>
            <DialogDescription>
              AI-powered campaign monitoring with real-time insights and adjustment recommendations
            </DialogDescription>
          </DialogHeader>
          {monitorSelectedCampaign && (
            <SophiaCampaignMonitor 
              campaignId={monitorSelectedCampaign.id} 
              campaignName={monitorSelectedCampaign.name}
              onClose={() => setIsSophiaMonitorOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Campaign Pipeline View */}
      <Sheet open={isPipelineOpen} onOpenChange={setIsPipelineOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[90vw] p-0">
          {pipelineSelectedCampaign && (
            <CampaignPipelineView 
              campaignId={pipelineSelectedCampaign.id}
              campaignName={pipelineSelectedCampaign.name}
              onClose={() => setIsPipelineOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
