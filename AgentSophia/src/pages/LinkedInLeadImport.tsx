import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useLinkedInAccount } from "@/contexts/LinkedInAccountContext";
import { useAuth } from "@/components/auth/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Users, 
  Calendar, 
  ThumbsUp, 
  MessageCircle, 
  Download, 
  Play, 
  Pause,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  Filter,
  RefreshCw,
  Database,
  Zap,
  UserPlus,
  Tag,
  Save,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SophiaHeader } from "@/components/agent-sophia/sophia-header";
import { LeadSourceSelector } from "@/components/linkedin/LeadSourceSelector";

interface LeadSource {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface ScrapingJob {
  id: string;
  workspaceId: string;
  source: string;
  sourceId: string;
  sourceName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'interrupted' | 'rate_limited';
  progress: number;
  totalItems: number;
  scrapedItems: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface ScrapedLead {
  id: string;
  workspaceId: string;
  profileUrl: string;
  name: string;
  firstName?: string;
  lastName?: string;
  headline: string;
  location: string;
  connectionDegree: string;
  source: string;
  sourceId: string;
  scrapedAt: string;
  enriched: boolean;
  email?: string;
  company?: string;
}

const iconMap: Record<string, any> = {
  'users': Users,
  'calendar': Calendar,
  'thumbs-up': ThumbsUp,
  'message-circle': MessageCircle,
};

export default function LinkedInLeadImport() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const { currentAccountId } = useLinkedInAccount();
  const { user } = useAuth();
  const workspaceId = currentWorkspace?.id || "";
  const accountId = currentAccountId || user?.id || "";
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [importTags, setImportTags] = useState("");
  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set());
  const [connectionFilter, setConnectionFilter] = useState<string>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  const { data: sources } = useQuery<{ sources: LeadSource[] }>({
    queryKey: ['/api/linkedin/advanced/leads/sources'],
  });

  const buildParams = (base: string) => {
    const params = new URLSearchParams();
    if (workspaceId) params.set('workspace_id', workspaceId);
    if (accountId) params.set('account_id', accountId);
    return `${base}?${params.toString()}`;
  };

  const { data: advancedJobs = [] } = useQuery<ScrapingJob[]>({
    queryKey: ['/api/linkedin/advanced/leads/jobs', workspaceId, accountId],
    queryFn: () => fetch(buildParams('/api/linkedin/advanced/leads/jobs')).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const { data: searchJobs = [] } = useQuery<any[]>({
    queryKey: ['/api/linkedin-search/jobs', workspaceId, accountId],
    queryFn: () => fetch(buildParams('/api/linkedin-search/jobs')).then(r => r.json()),
    enabled: !!workspaceId,
    refetchInterval: 5000,
  });

  const jobs: ScrapingJob[] = [
    ...advancedJobs,
    ...searchJobs.map((job: any) => ({
      id: job.id,
      workspaceId: job.workspaceId,
      source: 'linkedin_search',
      sourceId: job.id,
      sourceName: job.searchCriteria?.keywords || job.criteria?.keywords || 'LinkedIn Search',
      status: job.status as ScrapingJob['status'],
      progress: job.progress || 0,
      totalItems: job.totalFound || 0,
      scrapedItems: job.totalPulled || 0,
      startedAt: job.startedAt || job.createdAt,
      completedAt: job.completedAt,
      error: job.error,
    })),
  ];

  const { data: advancedLeads = [] } = useQuery<ScrapedLead[]>({
    queryKey: ['/api/linkedin/advanced/leads', workspaceId, accountId],
    queryFn: () => fetch(buildParams('/api/linkedin/advanced/leads')).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const { data: searchLeadsData } = useQuery<{ leads: any[]; total: number }>({
    queryKey: ['/api/linkedin/search/leads', workspaceId, accountId],
    queryFn: () => fetch(buildParams('/api/linkedin/search/leads')).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const { data: campaigns } = useQuery<any[]>({
    queryKey: ['/api/campaigns', workspaceId],
    queryFn: () => fetch(`/api/campaigns?workspaceId=${workspaceId}`).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const leads = [
    ...advancedLeads,
    ...(searchLeadsData?.leads || []).map((lead: any) => ({
      id: lead.id,
      workspaceId: lead.workspaceId,
      profileUrl: lead.profileUrl,
      name: lead.name,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      headline: lead.headline,
      location: lead.location,
      connectionDegree: lead.connectionDegree || '3rd',
      source: lead.sourceType || 'search',
      sourceId: lead.searchJobId || '',
      scrapedAt: lead.createdAt,
      enriched: !!lead.email,
      email: lead.email,
      company: lead.company,
    })),
  ];

  const startScrapingMutation = useMutation({
    mutationFn: ({ source, sourceUrl }: { source: string; sourceUrl: string }) =>
      apiRequest(`/api/linkedin/advanced/leads/scrape/${workspaceId}`, {
        method: 'POST',
        body: JSON.stringify({ source, sourceUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/leads/jobs', workspaceId, accountId] });
      toast({ title: "Scraping job started" });
      setSourceUrl("");
      setSelectedSource(null);
    },
    onError: (error: any) => {
      toast({ title: "Failed to start scraping", description: error.message, variant: "destructive" });
    },
  });

  const exportLeadsMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/linkedin/advanced/leads/${workspaceId}/export`).then(res => res.blob()),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Leads exported successfully" });
    },
  });

  const saveToContactsMutation = useMutation({
    mutationFn: async ({ leadsToSave, tags }: { leadsToSave: ScrapedLead[]; tags: string[] }) => {
      const contacts = leadsToSave.map(lead => {
        const nameParts = lead.name.trim().split(' ').filter(p => p.length > 0);
        const firstName = nameParts[0] || lead.name || 'Unknown';
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
        const isValidUrl = lead.profileUrl?.startsWith('http');
        const validWorkspaceId = workspaceId && workspaceId.length > 0 ? workspaceId : null;
        return {
          first_name: firstName,
          last_name: lastName,
          email: lead.email || null,
          company: lead.company || null,
          job_title: lead.headline || null,
          linkedin_url: isValidUrl ? lead.profileUrl : null,
          source: `linkedin_${lead.source}`,
          stage: 'new',
          tags: tags.length > 0 ? tags : [],
          workspace_id: validWorkspaceId,
        };
      });
      return apiRequest('/api/contacts/bulk', {
        method: 'POST',
        body: JSON.stringify({ contacts }),
      });
    },
    onSuccess: (data: any, variables) => {
      const newSavedIds = new Set(savedLeadIds);
      variables.leadsToSave.forEach(lead => newSavedIds.add(lead.id));
      setSavedLeadIds(newSavedIds);
      setSelectedLeads(new Set());
      setShowSaveDialog(false);
      setImportTags("");
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      toast({ 
        title: "Contacts saved successfully", 
        description: `${variables.leadsToSave.length} leads saved to your contacts` 
      });
    },
    onError: (error: any) => {
      console.error('Save contacts error:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast({ 
        title: "Failed to save contacts", 
        description: errorMessage.includes('validation') 
          ? 'Some contact data was invalid. Please try again.' 
          : errorMessage, 
        variant: "destructive" 
      });
    },
  });

  const handleToggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleSelectAllLeads = () => {
    const unsavedLeads = filteredLeads.filter(l => !savedLeadIds.has(l.id));
    if (selectedLeads.size === unsavedLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(unsavedLeads.map(l => l.id)));
    }
  };

  const handleSaveSelectedLeads = () => {
    if (selectedLeads.size === 0) {
      toast({ title: "No leads selected", description: "Select leads to save to contacts", variant: "destructive" });
      return;
    }
    setShowSaveDialog(true);
  };

  const handleConfirmSave = () => {
    const leadsToSave = leads.filter(l => selectedLeads.has(l.id));
    const tags = importTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    saveToContactsMutation.mutate({ leadsToSave, tags });
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesConnection = connectionFilter === 'all' || 
      lead.connectionDegree === connectionFilter;
    
    return matchesSearch && matchesConnection;
  });

  const addToCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, contactIds }: { campaignId: string; contactIds: string[] }) => {
      return apiRequest(`/api/campaigns/${campaignId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contactIds }),
      });
    },
    onSuccess: () => {
      toast({ title: "Leads added to campaign", description: `${selectedLeads.size} leads added successfully` });
      setShowCampaignDialog(false);
      setSelectedLeads(new Set());
      setSelectedCampaignId("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to add to campaign", description: error.message, variant: "destructive" });
    },
  });

  const handleSendToCampaign = () => {
    if (selectedLeads.size === 0) {
      toast({ title: "No leads selected", description: "Select leads to add to a campaign", variant: "destructive" });
      return;
    }
    setShowCampaignDialog(true);
  };

  const deleteLeadsMutation = useMutation({
    mutationFn: async (leadIds: string[]) => {
      return apiRequest(`/api/linkedin/search/leads/${workspaceId}`, {
        method: 'DELETE',
        body: JSON.stringify({ leadIds }),
      });
    },
    onSuccess: (data: any) => {
      toast({ title: "Leads deleted", description: `${data.deletedCount} leads removed from staging` });
      setSelectedLeads(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/search/leads', workspaceId, accountId] });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete leads", description: error.message, variant: "destructive" });
    },
  });

  const handleDeleteSelected = () => {
    if (selectedLeads.size === 0) {
      toast({ title: "No leads selected", description: "Select leads to delete", variant: "destructive" });
      return;
    }
    deleteLeadsMutation.mutate(Array.from(selectedLeads));
  };

  const handleConfirmCampaign = async () => {
    if (!selectedCampaignId) {
      toast({ title: "No campaign selected", description: "Please select a campaign", variant: "destructive" });
      return;
    }
    
    const leadsToAdd = leads.filter(l => selectedLeads.has(l.id));
    const tags = importTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    try {
      const contacts = leadsToAdd.map(lead => {
        const nameParts = lead.name.trim().split(' ').filter((p: string) => p.length > 0);
        const firstName = lead.firstName || nameParts[0] || lead.name || 'Unknown';
        const lastName = lead.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : null);
        return {
          first_name: firstName,
          last_name: lastName,
          email: lead.email || null,
          company: lead.company || null,
          job_title: lead.headline || null,
          linkedin_url: lead.profileUrl?.startsWith('http') ? lead.profileUrl : null,
          source: `linkedin_${lead.source}`,
          stage: 'new',
          tags: tags.length > 0 ? tags : [],
          workspace_id: workspaceId,
        };
      });
      
      const savedContacts = await apiRequest('/api/contacts/bulk', {
        method: 'POST',
        body: JSON.stringify({ contacts }),
      });
      
      const allContactIds = [
        ...(savedContacts?.created || []).map((c: any) => c.id),
        ...(savedContacts?.existing || []).map((c: any) => c.id),
        ...(savedContacts?.updated || []).map((c: any) => c.id),
      ].filter(Boolean);
      
      if (allContactIds.length > 0) {
        addToCampaignMutation.mutate({
          campaignId: selectedCampaignId,
          contactIds: allContactIds,
        });
      } else {
        toast({ title: "No contacts to add", description: "No contacts were saved or found", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Failed to save contacts", description: error.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'interrupted':
        return <Badge className="bg-orange-500"><Pause className="h-3 w-3 mr-1" />Interrupted</Badge>;
      case 'rate_limited':
        return <Badge className="bg-yellow-500"><Clock className="h-3 w-3 mr-1" />Rate Limited</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const restartJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest(`/api/linkedin-search/jobs/${jobId}/restart`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({ title: "Job Restarted", description: "Search job has been restarted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/leads/jobs', workspaceId, accountId] });
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin-search/jobs', workspaceId, accountId] });
    },
    onError: (error: any) => {
      toast({ title: "Restart Failed", description: error.message, variant: "destructive" });
    }
  });

  const getSourceIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || Users;
    return <Icon className="h-6 w-6" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <SophiaHeader />
      
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold">Lead Import Sources</h1>
        <p className="text-muted-foreground">Scrape leads from LinkedIn groups, events, and post engagements</p>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-leads">{leads.length}</p>
                  <p className="text-sm text-muted-foreground">Total Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-enriched">{leads.filter(l => l.enriched).length}</p>
                  <p className="text-sm text-muted-foreground">Enriched</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-active-jobs">{jobs.filter(j => j.status === 'running').length}</p>
                  <p className="text-sm text-muted-foreground">Active Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Download className="h-8 w-8 text-purple-500" />
                <div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => exportLeadsMutation.mutate()}
                    disabled={leads.length === 0 || exportLeadsMutation.isPending}
                    data-testid="button-export-csv"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="data-sources" className="space-y-4">
          <TabsList>
            <TabsTrigger value="data-sources" data-testid="tab-data-sources">
              <Database className="h-4 w-4 mr-2" />
              Data Sources
            </TabsTrigger>
            <TabsTrigger value="sources" data-testid="tab-sources">
              <Users className="h-4 w-4 mr-2" />
              Scraper Sources
            </TabsTrigger>
            <TabsTrigger value="jobs" data-testid="tab-jobs">
              <Clock className="h-4 w-4 mr-2" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="leads" data-testid="tab-leads">
              <Users className="h-4 w-4 mr-2" />
              Leads ({leads.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data-sources" className="space-y-4">
            <LeadSourceSelector 
              workspaceId={workspaceId}
              accountId={accountId}
              onLeadsImported={(newLeads) => {
                queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/leads', workspaceId, accountId] });
                toast({
                  title: "Leads imported",
                  description: `Successfully imported ${newLeads.length} new leads`,
                });
              }}
            />
          </TabsContent>

          <TabsContent value="sources" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {sources?.sources.map((source) => (
                <Card
                  key={source.id}
                  onClick={() => setSelectedSource(source.id)}
                  className={`cursor-pointer transition-all ${
                    selectedSource === source.id
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'hover:border-primary/50'
                  }`}
                  data-testid={`source-${source.id}`}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center">
                      <div className={`p-3 rounded-full mb-3 ${
                        selectedSource === source.id ? 'bg-primary/10 text-primary' : 'bg-muted'
                      }`}>
                        {getSourceIcon(source.icon)}
                      </div>
                      <h3 className="font-medium">{source.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{source.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selectedSource && (
              <Card>
                <CardHeader>
                  <CardTitle>Start Scraping</CardTitle>
                  <CardDescription>
                    Enter the LinkedIn URL for the {sources?.sources.find(s => s.id === selectedSource)?.name.toLowerCase()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>LinkedIn URL</Label>
                    <Input
                      placeholder={
                        selectedSource === 'group' ? 'https://www.linkedin.com/groups/12345/' :
                        selectedSource === 'event' ? 'https://www.linkedin.com/events/12345/' :
                        'https://www.linkedin.com/posts/username_activity-12345/'
                      }
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                      data-testid="input-source-url"
                    />
                  </div>
                  <Button
                    onClick={() => startScrapingMutation.mutate({ source: selectedSource, sourceUrl })}
                    disabled={!sourceUrl || startScrapingMutation.isPending}
                    data-testid="button-start-scraping"
                  >
                    {startScrapingMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Start Scraping
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Scraping Jobs</CardTitle>
                <CardDescription>Track the progress of your lead import jobs</CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No scraping jobs yet</p>
                    <p className="text-sm">Select a source and start importing leads</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {jobs.map((job) => (
                      <div key={job.id} className="border rounded-lg p-4" data-testid={`job-${job.id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            {getSourceIcon(
                              sources?.sources.find(s => s.id === job.source)?.icon || 'users'
                            )}
                            <div>
                              <p className="font-medium">{job.sourceName}</p>
                              <p className="text-sm text-muted-foreground">
                                Started {new Date(job.startedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {getStatusBadge(job.status)}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{job.scrapedItems} of {job.totalItems} leads</span>
                            <span>{job.progress}%</span>
                          </div>
                          <Progress value={job.progress} className="h-2" />
                        </div>
                        {job.error && (
                          <div className="mt-2 text-sm text-red-500 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {job.error}
                          </div>
                        )}
                        {(job.status === 'interrupted' || job.status === 'failed' || job.status === 'rate_limited') && (
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => restartJobMutation.mutate(job.id)}
                              disabled={restartJobMutation.isPending}
                              data-testid={`button-restart-job-${job.id}`}
                            >
                              {restartJobMutation.isPending ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4 mr-2" />
                              )}
                              Restart Search
                            </Button>
                            <span className="text-xs text-muted-foreground">
                              {job.status === 'interrupted' ? 'Server restarted - click to continue' : 
                               job.status === 'rate_limited' ? 'Rate limit reached - try again later' :
                               'Search failed - click to retry'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leads" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Imported Leads</CardTitle>
                    <CardDescription>All leads scraped from LinkedIn - Select leads to save to your Contacts</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={connectionFilter}
                      onChange={(e) => setConnectionFilter(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      data-testid="select-connection-filter"
                    >
                      <option value="all">All Connections</option>
                      <option value="1st">1st Degree</option>
                      <option value="2nd">2nd Degree</option>
                      <option value="3rd">3rd Degree</option>
                    </select>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search leads..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64"
                        data-testid="input-search-leads"
                      />
                    </div>
                  </div>
                </div>
                {filteredLeads.length > 0 && (
                  <div className="flex items-center gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllLeads}
                      data-testid="button-select-all"
                    >
                      {selectedLeads.size === filteredLeads.filter(l => !savedLeadIds.has(l.id)).length 
                        ? "Deselect All" 
                        : `Select All (${filteredLeads.filter(l => !savedLeadIds.has(l.id)).length})`}
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveSelectedLeads}
                      disabled={selectedLeads.size === 0 || saveToContactsMutation.isPending}
                      data-testid="button-save-to-contacts"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Save to Contacts
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleSendToCampaign}
                      disabled={selectedLeads.size === 0}
                      data-testid="button-send-to-campaign"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      Send to Campaign
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleDeleteSelected}
                      disabled={selectedLeads.size === 0 || deleteLeadsMutation.isPending}
                      data-testid="button-delete-selected"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected
                    </Button>
                    {selectedLeads.size > 0 && (
                      <span className="text-sm text-muted-foreground">
                        {selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} selected
                      </span>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {filteredLeads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No leads found</p>
                    <p className="text-sm">Start scraping from LinkedIn sources</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {filteredLeads.map((lead) => {
                        const isSaved = savedLeadIds.has(lead.id);
                        const isSelected = selectedLeads.has(lead.id);
                        return (
                          <div
                            key={lead.id}
                            className={`flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 ${isSelected ? 'border-primary bg-primary/5' : ''} ${isSaved ? 'opacity-60' : ''}`}
                            data-testid={`lead-${lead.id}`}
                          >
                            <div className="flex items-center gap-3">
                              {!isSaved && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => handleToggleLeadSelection(lead.id)}
                                  data-testid={`checkbox-lead-${lead.id}`}
                                />
                              )}
                              <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center">
                                <Users className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium">{lead.name}</p>
                                  {lead.email && (
                                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                      {lead.email}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">{lead.headline}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {lead.company && <span>{lead.company}</span>}
                                  {lead.company && lead.location && <span>•</span>}
                                  {lead.location && <span>{lead.location}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isSaved && (
                                <Badge className="bg-green-500 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Saved
                                </Badge>
                              )}
                              {lead.enriched && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Enriched
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">{lead.source}</Badge>
                              <span className="text-xs text-muted-foreground">{lead.connectionDegree}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Leads to Contacts</DialogTitle>
            <DialogDescription>
              Save {selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} to your Contacts. 
              Add tags to organize them (optional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tags">
                <Tag className="h-4 w-4 inline mr-2" />
                Tags (comma-separated)
              </Label>
              <Input
                id="tags"
                placeholder="e.g., linkedin-import, q1-leads, tech-contacts"
                value={importTags}
                onChange={(e) => setImportTags(e.target.value)}
                data-testid="input-import-tags"
              />
              <p className="text-xs text-muted-foreground">
                These tags will be applied to all imported contacts
              </p>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Summary</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {selectedLeads.size} contacts will be created</li>
                <li>• Source: LinkedIn Import</li>
                <li>• Stage: New</li>
                {importTags && (
                  <li>• Tags: {importTags.split(',').map(t => t.trim()).filter(t => t).join(', ')}</li>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmSave}
              disabled={saveToContactsMutation.isPending}
              data-testid="button-confirm-save"
            >
              {saveToContactsMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save to Contacts
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Leads to Campaign</DialogTitle>
            <DialogDescription>
              Add {selectedLeads.size} lead{selectedLeads.size !== 1 ? 's' : ''} to a campaign. 
              They will be saved as contacts first.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign">Select Campaign</Label>
              <select
                id="campaign"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                data-testid="select-campaign"
              >
                <option value="">Choose a campaign...</option>
                {campaigns?.map((campaign: any) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-tags">
                <Tag className="h-4 w-4 inline mr-2" />
                Tags (optional)
              </Label>
              <Input
                id="campaign-tags"
                placeholder="e.g., campaign-import, priority"
                value={importTags}
                onChange={(e) => setImportTags(e.target.value)}
                data-testid="input-campaign-tags"
              />
            </div>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">What will happen:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• {selectedLeads.size} leads will be saved as contacts</li>
                <li>• Contacts will be added to the selected campaign</li>
                <li>• Campaign sequence will start for these contacts</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmCampaign}
              disabled={!selectedCampaignId || addToCampaignMutation.isPending}
              data-testid="button-confirm-campaign"
            >
              {addToCampaignMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Add to Campaign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
