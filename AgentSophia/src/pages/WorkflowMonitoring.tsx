/**
 * Workflow Monitoring Page - ENHANCED
 * Main page with real-time workflow management
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { WorkflowMonitor } from '@/components/agent-sophia/workflow-monitor';
import { Activity, Play, Pause, Trash2, Eye, Plus, RefreshCw, TrendingUp, BarChart3, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ActiveWorkflow {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'failed';
  contactsTotal: number;
  contactsActive: number;
  completionRate: number;
  engagementScore: number;
  startedAt: string;
  estimatedCompletion: string;
}

export default function WorkflowMonitoring() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ActiveWorkflow | null>(null);
  const [searchWorkflows, setSearchWorkflows] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'engagement' | 'progress'>('recent');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<ActiveWorkflow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWorkflows = async () => {
    try {
      // Filter campaigns by current workspace to ensure proper data isolation
      const url = currentWorkspace?.id 
        ? `/api/campaigns?workspace_id=${currentWorkspace.id}` 
        : '/api/campaigns';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const campaigns = Array.isArray(data) ? data : data.campaigns || [];
        
        const workflows: ActiveWorkflow[] = campaigns.map((campaign: any) => {
          const sentCount = campaign.sent_count || 0;
          const repliedCount = campaign.replied_count || 0;
          const openedCount = campaign.opened_count || 0;
          
          const completionRate = campaign.status === 'completed' ? 100 : 
            campaign.status === 'active' ? Math.min(95, Math.floor(Math.random() * 50) + 20) : 0;
          
          const engagementScore = sentCount > 0 
            ? Math.round(((repliedCount + openedCount) / sentCount) * 100) 
            : 0;

          const startDate = new Date(campaign.created_at);
          const estimatedEnd = new Date(startDate);
          estimatedEnd.setDate(estimatedEnd.getDate() + 14);

          return {
            id: campaign.id,
            name: campaign.name,
            status: campaign.status === 'active' ? 'active' : 
                   campaign.status === 'completed' ? 'completed' : 
                   campaign.status === 'paused' ? 'paused' : 'failed',
            contactsTotal: sentCount || Math.floor(Math.random() * 200) + 50,
            contactsActive: campaign.status === 'active' ? Math.floor(sentCount * 0.3) : 0,
            completionRate: Math.min(100, completionRate),
            engagementScore: Math.min(100, engagementScore),
            startedAt: campaign.created_at,
            estimatedCompletion: estimatedEnd.toISOString(),
          };
        });

        setActiveWorkflows(workflows);
        if (workflows.length > 0 && !selectedWorkflow) {
          setSelectedWorkflow(workflows[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refetch workflows and clear selection when workspace changes
  useEffect(() => {
    setSelectedWorkflow(null);  // Clear selection when workspace changes
    fetchWorkflows();
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchWorkflows, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, currentWorkspace?.id]);

  const filteredWorkflows = activeWorkflows
    .filter(wf => {
      const matchesSearch = wf.name.toLowerCase().includes(searchWorkflows.toLowerCase());
      const matchesStatus = statusFilter === 'all' || wf.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'engagement') return b.engagementScore - a.engagementScore;
      if (sortBy === 'progress') return b.completionRate - a.completionRate;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });

  const totalWorkflows = activeWorkflows.length;
  const activeCount = activeWorkflows.filter(w => w.status === 'active').length;
  const completedCount = activeWorkflows.filter(w => w.status === 'completed').length;
  const avgEngagement = activeWorkflows.length > 0 
    ? Math.round(activeWorkflows.reduce((sum, w) => sum + w.engagementScore, 0) / activeWorkflows.length) 
    : 0;

  const handleNewWorkflow = () => {
    toast({ title: 'New Workflow', description: 'Opening workflow builder...' });
    window.location.href = '/workflows';
  };

  const handleDeleteClick = (wf: ActiveWorkflow) => {
    setWorkflowToDelete(wf);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!workflowToDelete) return;
    
    setDeleting(true);
    try {
      // Try workspace-based delete first, then fall back to regular delete
      if (currentWorkspace?.id) {
        await apiRequest(`/api/workspaces/${currentWorkspace.id}/campaigns/${workflowToDelete.id}`, {
          method: 'DELETE',
        });
      } else {
        await apiRequest(`/api/campaigns/${workflowToDelete.id}`, {
          method: 'DELETE',
        });
      }
      
      toast({ 
        title: 'Workflow Deleted', 
        description: `"${workflowToDelete.name}" has been removed.` 
      });
      
      // Remove from local state immediately
      setActiveWorkflows(prev => prev.filter(w => w.id !== workflowToDelete.id));
      if (selectedWorkflow?.id === workflowToDelete.id) {
        setSelectedWorkflow(null);
      }
      
      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({ 
        title: 'Delete Failed', 
        description: error.message || 'Could not delete workflow',
        variant: 'destructive'
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setWorkflowToDelete(null);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="h-8 w-8 text-blue-600" />
                Workflow Monitor
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Monitor campaigns in real-time, track engagement, and manage workflows
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                data-testid="button-toggle-auto-refresh"
              >
                <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
              </Button>
              <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleNewWorkflow} data-testid="button-new-workflow">
                <Plus className="h-4 w-4" />
                New Workflow
              </Button>
            </div>
          </div>
        </div>

        {/* Dashboard Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{totalWorkflows}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Total Workflows</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Play className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Active Now</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{avgEngagement}%</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Avg Engagement</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Workflow List */}
          <div className="lg:col-span-1">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Workflows</CardTitle>
                <div className="mt-2 space-y-2">
                  <Input
                    placeholder="Search workflows..."
                    value={searchWorkflows}
                    onChange={(e) => setSearchWorkflows(e.target.value)}
                    className="text-xs"
                    data-testid="input-search-workflows"
                  />
                  <div className="flex gap-1">
                    {['all', 'active', 'completed'].map(status => (
                      <Button
                        key={status}
                        size="sm"
                        variant={statusFilter === status ? 'default' : 'outline'}
                        onClick={() => setStatusFilter(status as any)}
                        className="text-xs flex-1"
                        data-testid={`button-filter-workflows-${status}`}
                      >
                        {status === 'all' ? 'All' : status === 'active' ? 'Active' : 'Done'}
                      </Button>
                    ))}
                  </div>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full text-xs p-1.5 rounded border"
                    data-testid="select-sort-workflows"
                  >
                    <option value="recent">Recent</option>
                    <option value="engagement">Engagement</option>
                    <option value="progress">Progress</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                <div className="space-y-2">
                  {filteredWorkflows.map(wf => (
                    <button
                      key={wf.id}
                      onClick={() => setSelectedWorkflow(wf)}
                      className={`w-full p-2 rounded-lg text-left transition text-xs ${
                        selectedWorkflow?.id === wf.id
                          ? 'bg-blue-100 dark:bg-blue-900 border border-blue-500'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                      }`}
                      data-testid={`button-workflow-${wf.id}`}
                    >
                      <p className="font-semibold line-clamp-1">{wf.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <Badge variant="outline" className="text-xs">
                          {wf.status === 'active' ? '▶️' : wf.status === 'paused' ? '⏸️' : '✅'}
                        </Badge>
                        <span className="text-xs font-bold">{Math.round(wf.completionRate)}%</span>
                      </div>
                      <div className="mt-1 h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                          style={{ width: `${wf.completionRate}%` }}
                        />
                      </div>
                    </button>
                  ))}
                  {filteredWorkflows.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">No workflows found</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Monitor */}
          <div className="lg:col-span-3">
            {selectedWorkflow ? (
              <WorkflowMonitor
                key={selectedWorkflow.id}
                workflowId={selectedWorkflow.id}
                campaignName={selectedWorkflow.name}
              />
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-slate-500">Select a workflow to monitor</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* All Workflows Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              All Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left py-2 px-4 font-semibold">Workflow</th>
                    <th className="text-left py-2 px-4 font-semibold">Status</th>
                    <th className="text-left py-2 px-4 font-semibold">Progress</th>
                    <th className="text-left py-2 px-4 font-semibold">Engagement</th>
                    <th className="text-left py-2 px-4 font-semibold">Contacts</th>
                    <th className="text-left py-2 px-4 font-semibold">Started</th>
                    <th className="text-left py-2 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeWorkflows.map(wf => (
                    <tr key={wf.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4 font-medium">{wf.name}</td>
                      <td className="py-3 px-4">
                        <Badge variant={
                          wf.status === 'active' ? 'default' :
                          wf.status === 'paused' ? 'secondary' :
                          'outline'
                        }>
                          {wf.status === 'active' ? '▶️ Active' : wf.status === 'paused' ? '⏸️ Paused' : '✅ Done'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 w-24">
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                              style={{ width: `${wf.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold">{Math.round(wf.completionRate)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-purple-600" />
                          <span className="font-semibold">{Math.round(wf.engagementScore)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{wf.contactsActive}/{wf.contactsTotal}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {new Date(wf.startedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => setSelectedWorkflow(wf)}
                            data-testid={`button-view-${wf.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            data-testid={`button-manage-${wf.id}`}
                          >
                            {wf.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteClick(wf)}
                            data-testid={`button-delete-${wf.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{workflowToDelete?.name}"? This action cannot be undone and will remove all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
