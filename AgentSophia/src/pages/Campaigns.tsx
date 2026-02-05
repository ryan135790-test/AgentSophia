import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Mail, Users, Zap, GitBranch, Eye, Pencil, Trash2, MoreVertical, Play, Pause, Plus, LayoutList, CalendarDays, Activity, Kanban, FolderOpen } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { CampaignsHelpOverlay } from "@/components/help-guidance/CampaignsHelp";
import { SophiaInsightsPanel } from "@/components/agent-sophia/sophia-insights-panel";
import { useState, useEffect } from "react";
import { CampaignOutcomeLogger } from "@/components/agent-sophia/campaign-outcome-logger";
import { CampaignCreationSelector } from "@/components/campaigns/campaign-creation-selector";
import { CampaignManagementEnhancements } from "@/components/campaigns/campaign-management-enhancements";
import { CampaignPipelineView } from "@/components/campaigns/campaign-pipeline-view";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CampaignData {
  id: string;
  name: string;
  type: string;
  status: string;
  target_audience: Record<string, any> | null;
  sent_count: number;
  opened_count: number;
  replied_count: number;
  created_at: string;
}

export default function Campaigns() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [sophiaInsights, setSophiaInsights] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignData | null>(null);
  const [outcomeDialogOpen, setOutcomeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignData | null>(null);
  const [showCreationSelector, setShowCreationSelector] = useState(false);
  const [activeView, setActiveView] = useState<string>('list');
  const [pipelineCampaign, setPipelineCampaign] = useState<CampaignData | null>(null);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';
  
  const { data: campaigns = [], isLoading } = useQuery<CampaignData[]>({
    queryKey: ['/api/workspaces', workspaceId, 'campaigns'],
    queryFn: async () => {
      if (!workspaceId) return [];
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/campaigns`);
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!workspaceId && !isDemo
  });

  useEffect(() => {
    const fetchInsights = async () => {
      if (!workspaceId) return;
      
      if (isDemo) {
        setSophiaInsights([
          { type: 'recommendation', title: 'A/B test subject lines', description: 'Your current open rate is below benchmark. Test new subject line strategies', action: 'Create new campaign', actionUrl: '/chat-sophia', impact: '+12% open rate' },
          { type: 'opportunity', title: 'LinkedIn outreach ready', description: '45 qualified leads without any LinkedIn contact yet', impact: '+$180k pipeline' }
        ]);
        return;
      }
      
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/sophia/insights/campaigns`).catch(() => null);
        if (res?.ok) setSophiaInsights(await res.json());
        else setSophiaInsights([]);
      } catch (error) {
        console.error('Error fetching Sophia insights:', error);
      }
    };
    fetchInsights();
  }, [workspaceId, isDemo]);

  const deleteCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'This is demo data. Create a real workspace to use this feature.' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/campaigns/${campaignId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      if (!isDemo) {
        queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'campaigns'] });
        toast({ title: 'Campaign Deleted', description: 'The campaign has been permanently deleted.' });
      }
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete campaign', variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ campaignId, status }: { campaignId: string; status: string }) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'This is demo data. Create a real workspace to use this feature.' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/campaigns/${campaignId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: (_, variables) => {
      if (!isDemo) {
        queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'campaigns'] });
        const statusLabel = variables.status === 'active' ? 'activated' : 'paused';
        toast({ title: 'Campaign Updated', description: `Campaign has been ${statusLabel}.` });
      }
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update campaign status', variant: 'destructive' });
    },
  });

  const handleActivate = (e: React.MouseEvent, campaign: CampaignData) => {
    e.stopPropagation();
    updateStatusMutation.mutate({ campaignId: campaign.id, status: 'active' });
  };

  const handlePause = (e: React.MouseEvent, campaign: CampaignData) => {
    e.stopPropagation();
    updateStatusMutation.mutate({ campaignId: campaign.id, status: 'paused' });
  };

  const handleDeleteClick = (e: React.MouseEvent, campaign: CampaignData) => {
    e.stopPropagation();
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, campaign: CampaignData) => {
    e.stopPropagation();
    navigate(`/campaigns/${campaign.id}?edit=true`);
  };

  const convertToWorkflow = async (campaign: CampaignData) => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'This is demo data. Create a real workspace to use this feature.' });
      return;
    }
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to convert to workflow');
      const workflow = await res.json();
      navigate(`/workflow-builder?id=${workflow.id}`);
    } catch (error: any) {
      console.error('Conversion error:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      'active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'draft': 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200',
      'paused': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'completed': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    };
    return variants[status] || variants['draft'];
  };

  const getChannelIcon = (type: string) => {
    const types: Record<string, typeof Mail> = {
      'email': Mail,
      'linkedin': Users,
      'multi-channel': Zap
    };
    const Icon = types[type] || Mail;
    return <Icon className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <CampaignsHelpOverlay />
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-muted-foreground mt-2">View and manage your multichannel campaigns</p>
          </div>
          <Button onClick={() => setShowCreationSelector(true)} className="bg-blue-600 hover:bg-blue-700" data-testid="btn-create-campaign">
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        <SophiaInsightsPanel insights={sophiaInsights} context="campaigns" isLoading={isLoading} />

        <Tabs value={activeView} onValueChange={setActiveView} className="space-y-6">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
            <TabsTrigger value="list" data-testid="tab-campaigns-list">
              <LayoutList className="w-4 h-4 mr-2" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="calendar" data-testid="tab-campaigns-calendar">
              <CalendarDays className="w-4 h-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="pipeline" data-testid="tab-campaigns-pipeline">
              <Kanban className="w-4 h-4 mr-2" />
              Contact Pipeline
            </TabsTrigger>
            <TabsTrigger value="advanced" data-testid="tab-campaigns-advanced">
              <Activity className="w-4 h-4 mr-2" />
              Advanced Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-6">
        {campaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="pt-12 text-center">
              <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first campaign to get started
              </p>
              <Button 
                onClick={() => setShowCreationSelector(true)} 
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="btn-create-first-campaign"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {campaigns.map(campaign => (
              <Card 
                key={campaign.id} 
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/campaigns/${campaign.id}`)}
                data-testid={`card-campaign-${campaign.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        {getChannelIcon(campaign.type)}
                        <CardTitle className="text-xl hover:text-blue-600 transition-colors">
                          {campaign.name}
                        </CardTitle>
                        <Badge className={getStatusBadge(campaign.status)}>
                          {campaign.status}
                        </Badge>
                      </div>
                      <CardDescription className="mt-2">
                        Created {formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {campaign.status !== 'active' ? (
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={(e) => handleActivate(e, campaign)}
                          className="gap-2 bg-green-600 hover:bg-green-700"
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-activate-campaign-${campaign.id}`}
                        >
                          <Play className="w-4 h-4" />
                          Activate
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={(e) => handlePause(e, campaign)}
                          className="gap-2 border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-pause-campaign-${campaign.id}`}
                        >
                          <Pause className="w-4 h-4" />
                          Pause
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/${campaign.id}`); }}
                        className="gap-2"
                        data-testid={`button-view-campaign-${campaign.id}`}
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => handleEditClick(e, campaign)}
                        className="gap-2"
                        data-testid={`button-edit-campaign-${campaign.id}`}
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" data-testid={`button-more-campaign-${campaign.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {campaign.status !== 'active' ? (
                            <DropdownMenuItem onClick={(e) => handleActivate(e, campaign)} className="text-green-600 focus:text-green-600">
                              <Play className="w-4 h-4 mr-2" />
                              Activate Campaign
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => handlePause(e, campaign)} className="text-yellow-600 focus:text-yellow-600">
                              <Pause className="w-4 h-4 mr-2" />
                              Pause Campaign
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/${campaign.id}`); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleEditClick(e, campaign)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Campaign
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/workflow-builder?id=${campaign.id}`); }}>
                            <GitBranch className="w-4 h-4 mr-2" />
                            Open in Workflow Builder
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => handleDeleteClick(e, campaign)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Campaign
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Sent</p>
                      <p className="text-2xl font-bold">{campaign.sent_count}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Opened</p>
                      <p className="text-2xl font-bold">{campaign.opened_count}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Replied</p>
                      <p className="text-2xl font-bold">{campaign.replied_count}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Open Rate</p>
                      <p className="text-2xl font-bold">
                        {campaign.sent_count > 0
                          ? Math.round((campaign.opened_count / campaign.sent_count) * 100)
                          : 0}%
                      </p>
                    </div>
                  </div>
                  {campaign.target_audience && (
                    <div className="mt-4 pt-4 border-t text-sm text-muted-foreground space-y-3">
                      <p><span className="font-semibold">Target:</span> {JSON.stringify(campaign.target_audience).substring(0, 100)}...</p>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); setSelectedCampaign(campaign); setOutcomeDialogOpen(true); }}
                          className="gap-2"
                          data-testid={`button-log-outcome-${campaign.id}`}
                        >
                          📊 Log Outcome
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); convertToWorkflow(campaign); }}
                          className="gap-2"
                          data-testid={`button-workflow-${campaign.id}`}
                        >
                          <GitBranch className="w-4 h-4" />
                          View as Workflow
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </TabsContent>

          <TabsContent value="calendar" className="space-y-6">
            <CampaignManagementEnhancements 
              campaigns={campaigns as any} 
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] })}
            />
          </TabsContent>

          <TabsContent value="pipeline" className="space-y-6">
            {pipelineCampaign ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" onClick={() => setPipelineCampaign(null)} data-testid="btn-back-from-pipeline">
                    Back to Campaign Selection
                  </Button>
                  <h2 className="text-xl font-semibold">{pipelineCampaign.name} - Contact Pipeline</h2>
                </div>
                <CampaignPipelineView 
                  campaignId={pipelineCampaign.id} 
                  campaignName={pipelineCampaign.name}
                  onClose={() => setPipelineCampaign(null)} 
                />
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Kanban className="w-5 h-5" />
                    Contact Pipeline View
                  </CardTitle>
                  <CardDescription>
                    Track how contacts move through your campaign stages
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {campaigns.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Create a campaign first to view contact pipeline
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {campaigns.map(campaign => (
                        <Card 
                          key={campaign.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setPipelineCampaign(campaign)}
                          data-testid={`btn-pipeline-campaign-${campaign.id}`}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                              {getChannelIcon(campaign.type)}
                              <div className="flex-1">
                                <p className="font-medium">{campaign.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {campaign.sent_count} contacts sent
                                </p>
                              </div>
                              <Badge className={getStatusBadge(campaign.status)}>
                                {campaign.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <CampaignManagementEnhancements 
              campaigns={campaigns as any} 
              onRefresh={() => queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] })}
            />
          </TabsContent>
        </Tabs>

        {/* Campaign Outcome Logger Dialog */}
        {selectedCampaign && (
          <CampaignOutcomeLogger
            campaignId={selectedCampaign.id}
            campaignName={selectedCampaign.name}
            open={outcomeDialogOpen}
            onOpenChange={setOutcomeDialogOpen}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{campaignToDelete?.name}"? This action cannot be undone and will permanently remove the campaign along with all its steps, contacts, and performance data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => campaignToDelete && deleteCampaignMutation.mutate(campaignToDelete.id)}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                disabled={deleteCampaignMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteCampaignMutation.isPending ? 'Deleting...' : 'Delete Campaign'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Campaign Creation Selector */}
        <CampaignCreationSelector 
          open={showCreationSelector} 
          onOpenChange={setShowCreationSelector} 
        />
      </div>
    </div>
  );
}
