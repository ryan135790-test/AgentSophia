/**
 * Workflow Monitor & Control Dashboard - ENHANCED
 * Real-time updates, search, engagement tracking, quick actions
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Play, Pause, Edit, Trash2, Eye, BarChart3, Users, Clock, CheckCircle2, AlertCircle,
  Activity, Zap, RefreshCw, Download, Search, Send, Tag, RotateCcw, ChevronDown, TrendingUp,
  MessageCircle, Calendar, ArrowRight, Filter, MoreHorizontal, Check, Mail, Linkedin, Phone, 
  Voicemail, Timer, Settings2, Sparkles, Lightbulb
} from 'lucide-react';
import { CampaignControls } from './campaign-controls';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EngagementEvent {
  timestamp: string;
  action: string;
  details: string;
}

interface ContactProgress {
  id: string;
  name: string;
  email: string;
  currentStep: number;
  completedSteps: number;
  totalSteps: number;
  currentStepName?: string;
  currentStepType?: 'email' | 'linkedin' | 'sms' | 'phone' | 'voicemail' | 'delay';
  nextStepName?: string;
  nextStepScheduled?: string;
  status: 'active' | 'completed' | 'paused' | 'failed' | 'pending' | 'skipped' | 'sent';
  lastActivity: string;
  engagement: string;
  engagementScore: number;
  intent?: string;
  history: EngagementEvent[];
  errorLabel?: string;
  isSessionError?: boolean;
  queuePosition?: number;
  inviteStatus?: 'pending' | 'sent' | 'not_applicable';
  inviteSentAt?: string;
  firstScheduledAt?: string;
}

interface WorkflowStep {
  id: string;
  type: 'email' | 'linkedin' | 'sms' | 'phone' | 'voicemail' | 'delay';
  label: string;
  description?: string;
  status: 'completed' | 'in_progress' | 'pending' | 'failed';
}

interface WorkflowMonitorProps {
  workflowId: string;
  campaignName: string;
  workspaceId?: string;
}

export function WorkflowMonitor({ workflowId, campaignName, workspaceId: initialWorkspaceId }: WorkflowMonitorProps) {
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<any>(null);
  const [workspaceId, setWorkspaceId] = useState<string>(initialWorkspaceId || '');
  const [contacts, setContacts] = useState<ContactProgress[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactProgress[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'sent' | 'pending' | 'skipped' | 'completed' | 'failed'>('all');
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [inviteLoading, setInviteLoading] = useState(false);
  const [hasScheduledInvites, setHasScheduledInvites] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [isLinkedInSearch, setIsLinkedInSearch] = useState(false);
  const [searchJobStatus, setSearchJobStatus] = useState<{ status: string; resultsCount: number; error?: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [stepFilter, setStepFilter] = useState<string>('all');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [linkedInActuallyConnected, setLinkedInActuallyConnected] = useState<boolean | null>(null);
  const [errorBreakdown, setErrorBreakdown] = useState<{
    errorType: string;
    count: number;
    label: string;
    recommendation: string;
    sampleError?: string;
  }[]>([]);
  const [showErrorDetails, setShowErrorDetails] = useState<string | null>(null);
  const [retryingErrorType, setRetryingErrorType] = useState<string | null>(null);
  const [editingDailyLimit, setEditingDailyLimit] = useState(false);
  const [dailyLimitInput, setDailyLimitInput] = useState('');
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [sophiaInsights, setSophiaInsights] = useState<{
    summary: string;
    insights: Array<{
      type: 'recommendation' | 'opportunity' | 'warning' | 'achievement';
      title: string;
      description: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    metrics: {
      totalContacts: number;
      invitesSent: number;
      awaitingResponse: number;
      connected: number;
      scheduled: number;
      alreadyConnected: number;
      failed: number;
    };
  } | null>(null);
  const [warmupAnalytics, setWarmupAnalytics] = useState<{
    warmup: {
      currentDay: number;
      weekNumber: number;
      dailyLimit: number;
      sentToday: number;
      scheduledToday: number;
      remainingToday: number;
      progressPercent: number;
      nextScheduledAt: string | null;
    };
    analytics: {
      acceptanceRate: number;
      totalSent: number;
      totalAccepted: number;
      totalSkipped: number;
      totalFailed: number;
      avgResponseDays: number | null;
      dailyData: Array<{ date: string; sent: number; accepted: number }>;
    };
  } | null>(null);
  const [campaignStatus, setCampaignStatus] = useState<{
    currentStage: string;
    stageLabel: string;
    stageProgress: number;
    totalContacts: number;
    nextAction: {
      type: string;
      label: string;
      scheduledAt: string;
      contactName: string;
    } | null;
    scheduleWindow: {
      start: string | null;
      end: string | null;
      pendingCount: number;
    } | null;
    channelBreakdown: {
      linkedin_connection: { pending: number; sent: number; completed: number; failed: number };
      linkedin_message: { pending: number; sent: number; completed: number; failed: number };
    } | null;
    serverTime: string;
  } | null>(null);

  // Bulk selection handlers
  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
  };

  const clearSelection = () => {
    setSelectedContacts(new Set());
  };

  const handleBulkRetry = async () => {
    if (selectedContacts.size === 0) return;
    setBulkActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/campaigns/${workflowId}/bulk-retry`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ contactIds: Array.from(selectedContacts) })
      });
      if (res.ok) {
        clearSelection();
        fetchWorkflowData();
      } else {
        const error = await res.json();
        setInviteError(error.error || 'Bulk retry failed');
      }
    } catch (error) {
      setInviteError('Network error during bulk retry');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkSkip = async () => {
    if (selectedContacts.size === 0) return;
    setBulkActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/campaigns/${workflowId}/bulk-skip`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ contactIds: Array.from(selectedContacts) })
      });
      if (res.ok) {
        clearSelection();
        fetchWorkflowData();
      } else {
        const error = await res.json();
        setInviteError(error.error || 'Bulk skip failed');
      }
    } catch (error) {
      setInviteError('Network error during bulk skip');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleResetFailed = async () => {
    setResetLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/campaigns/${workflowId}/reset-failed-steps`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const result = await res.json();
        console.log('Reset failed steps:', result);
        setInviteError(null);
        fetchWorkflowData();
      } else {
        const error = await res.json();
        console.error('Failed to reset steps:', error);
        setInviteError(error.error || 'Failed to reset');
      }
    } catch (error) {
      console.error('Error resetting failed steps:', error);
      setInviteError('Network error - please try again');
    } finally {
      setResetLoading(false);
    }
  };

  const handleRetryErrorType = async (errorType: string) => {
    setRetryingErrorType(errorType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/campaigns/${workflowId}/reset-failed-steps`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ errorType })
      });
      if (res.ok) {
        const result = await res.json();
        console.log(`Reset ${result.resetCount} steps for error type ${errorType}`);
        setInviteError(null);
        fetchWorkflowData();
      } else {
        const error = await res.json();
        console.error('Failed to retry error type:', error);
        setInviteError(error.error || 'Failed to retry');
      }
    } catch (err) {
      console.error('Error retrying error type:', err);
      setInviteError('Failed to retry');
    } finally {
      setRetryingErrorType(null);
    }
  };

  const handleStartLinkedInInvites = async () => {
    setInviteLoading(true);
    setInviteError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/campaigns/${workflowId}/schedule-linkedin-invites`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const result = await res.json();
        console.log('LinkedIn invites scheduled:', result);
        setHasScheduledInvites(true);
        fetchWorkflowData();
      } else {
        const error = await res.json();
        console.error('Failed to schedule invites:', error);
        setInviteError(error.error || 'Failed to schedule invites');
      }
    } catch (error) {
      console.error('Error scheduling LinkedIn invites:', error);
      setInviteError('Network error - please try again');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleSaveDailyLimit = async () => {
    const newLimit = parseInt(dailyLimitInput);
    if (isNaN(newLimit) || newLimit < 1 || newLimit > 100) {
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/linkedin/update-daily-limit`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ workspace_id: workspaceId, daily_limit: newLimit })
      });
      if (res.ok) {
        setWarmupAnalytics(prev => prev ? { ...prev, warmup: { ...prev.warmup, dailyLimit: newLimit } } : null);
        setEditingDailyLimit(false);
      }
    } catch (error) {
      console.error('Error updating daily limit:', error);
    }
  };

  const handlePauseResume = async () => {
    setPauseLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const newStatus = isPaused ? 'active' : 'paused';
      const res = await fetch(`/api/campaigns/${workflowId}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        setIsPaused(!isPaused);
        setWorkflow((prev: any) => prev ? { ...prev, status: newStatus } : prev);
      } else {
        console.error('Failed to update campaign status');
      }
    } catch (error) {
      console.error('Error updating campaign status:', error);
    } finally {
      setPauseLoading(false);
    }
  };

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchWorkflowData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, workflowId]);

  useEffect(() => {
    fetchWorkflowData(true); // Initial load
  }, [workflowId]);

  // Filter contacts based on search and status
  useEffect(() => {
    let filtered = contacts;

    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }

    // Filter by current step
    if (stepFilter !== 'all') {
      const stepNum = parseInt(stepFilter);
      filtered = filtered.filter(c => c.currentStep === stepNum);
    }

    setFilteredContacts(filtered);
    
    // Sync selected contacts with visible contacts - remove any hidden selections
    setSelectedContacts(prev => {
      const visibleIds = new Set(filtered.map(c => c.id));
      const next = new Set([...prev].filter(id => visibleIds.has(id)));
      return next.size !== prev.size ? next : prev;
    });
  }, [contacts, searchQuery, statusFilter, stepFilter]);

  const fetchWorkflowData = async (isInitialLoad = false) => {
    // Only show loading spinner on initial load, not on auto-refresh
    if (isInitialLoad || contacts.length === 0) {
      setLoading(true);
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = session?.access_token 
        ? { 'Authorization': `Bearer ${session.access_token}` }
        : {};
      
      // Fetch real campaign data with steps and execution progress
      const [campaignRes, progressRes, logsRes, insightsRes, warmupRes] = await Promise.all([
        fetch(`/api/campaigns/${workflowId}`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`/api/campaigns/${workflowId}/progress`, { headers }).then(r => r.ok ? r.json() : { contacts: [] }),
        fetch(`/api/campaigns/${workflowId}/execution-logs`, { headers }).then(r => r.ok ? r.json() : { logs: [] }),
        fetch(`/api/campaigns/${workflowId}/sophia-insights`, { headers }).then(r => r.ok ? r.json() : null),
        fetch(`/api/campaigns/${workflowId}/warmup-analytics`, { headers }).then(r => r.ok ? r.json() : null)
      ]);
      
      // Set Sophia insights
      if (insightsRes) {
        setSophiaInsights(insightsRes);
      }
      
      // Set warmup analytics
      if (warmupRes) {
        setWarmupAnalytics(warmupRes);
      }

      if (campaignRes) {
        const steps = (campaignRes.steps || []).map((step: any, idx: number) => ({
          id: step.id || String(idx + 1),
          type: step.channel || 'email',
          label: step.label || `Step ${idx + 1}`,
          status: step.status || 'pending'
        }));

        const campaignPaused = campaignRes.status === 'paused';
        setIsPaused(campaignPaused);
        
        // Capture workspace_id for campaign controls
        const effectiveWorkspaceId = campaignRes.workspace_id || workspaceId;
        if (campaignRes.workspace_id && !workspaceId) {
          setWorkspaceId(campaignRes.workspace_id);
        }
        
        // Check actual LinkedIn connection status for this workspace
        // First try the primary status endpoint, then fallback to puppeteer connection status
        if (effectiveWorkspaceId && session?.access_token) {
          try {
            let isConnected = false;
            
            // Try primary status endpoint
            const liStatusRes = await fetch(`/api/workspaces/${effectiveWorkspaceId}/linkedin/status`, { headers });
            if (liStatusRes.ok) {
              const liStatus = await liStatusRes.json();
              if (liStatus.connected === true) {
                isConnected = true;
              }
            }
            
            // If not connected via primary, check puppeteer connection status as fallback
            if (!isConnected) {
              try {
                const puppeteerStatusRes = await fetch(`/api/linkedin/puppeteer/connection-status?workspace_id=${effectiveWorkspaceId}`, { headers });
                if (puppeteerStatusRes.ok) {
                  const puppeteerStatus = await puppeteerStatusRes.json();
                  if (puppeteerStatus.connected === true) {
                    isConnected = true;
                    console.log('[LinkedIn Status] Connected via puppeteer auto-login');
                  }
                }
              } catch (e) {
                console.log('Could not fetch puppeteer status:', e);
              }
            }
            
            setLinkedInActuallyConnected(isConnected);
          } catch (e) {
            console.log('Could not fetch LinkedIn status:', e);
            setLinkedInActuallyConnected(null);
          }
        }
        
        // Check if this is a LinkedIn Search workflow
        const isLinkedInSearchCampaign = campaignRes.type === 'linkedin_search' || 
          campaignRes.settings?.is_linkedin_search === true;
        setIsLinkedInSearch(isLinkedInSearchCampaign);
        
        // If LinkedIn Search, fetch search job status
        if (isLinkedInSearchCampaign && session?.access_token) {
          try {
            const searchJobRes = await fetch(`/api/campaigns/${workflowId}/search-job-status`, { headers });
            if (searchJobRes.ok) {
              const jobStatus = await searchJobRes.json();
              setSearchJobStatus(jobStatus);
            }
          } catch (e) {
            console.log('Could not fetch search job status:', e);
          }
        }
        
        setWorkflow({
          id: workflowId,
          name: campaignRes.name || campaignName,
          status: campaignPaused ? 'paused' : 'active',
          startedAt: campaignRes.created_at || new Date().toISOString(),
          steps
        });
      } else {
        setWorkflow({
          id: workflowId,
          name: campaignName,
          status: 'active',
          startedAt: new Date().toISOString(),
          steps: []
        });
      }

      // Transform real contact progress data
      const realContacts: ContactProgress[] = (progressRes.contacts || []).map((c: any) => {
        const logs = (logsRes.logs || []).filter((l: any) => l.contact_id === c.contact_id);
        const history: EngagementEvent[] = logs.map((l: any) => ({
          timestamp: new Date(l.executed_at || l.created_at).toLocaleString(),
          action: l.action || l.channel || 'Action',
          details: l.result || l.status || ''
        }));

        const rawCompletedSteps = c.completed_steps || 0;
        const totalSteps = c.total_steps || 1;
        // Guard completedSteps to valid bounds
        const completedSteps = Math.max(0, Math.min(rawCompletedSteps, totalSteps));
        const status = c.status === 'completed' ? 'completed' : 
                       c.status === 'failed' ? 'failed' : 
                       c.status === 'paused' ? 'paused' : 
                       c.status === 'pending' ? 'pending' :
                       c.status === 'skipped' ? 'skipped' :
                       c.status === 'sent' ? 'sent' : 'active';
        
        // Get current and next step info from campaign steps
        const steps = campaignRes?.steps || [];
        const currentStepIdx = Math.min(completedSteps, steps.length - 1);
        const currentStepData = steps[currentStepIdx];
        const nextStepData = steps[currentStepIdx + 1];

        return {
          id: c.contact_id || c.id,
          name: c.contact_name || c.name || 'Unknown',
          email: c.contact_email || c.email || '',
          currentStep: completedSteps + 1,
          completedSteps,
          totalSteps,
          currentStepName: currentStepData?.label || c.current_step_name || `Step ${completedSteps + 1}`,
          currentStepType: currentStepData?.channel || c.current_step_type || 'email',
          nextStepName: nextStepData?.label || c.next_step_name,
          nextStepScheduled: c.next_step_scheduled ? formatTimeAgo(new Date(c.next_step_scheduled)) : undefined,
          status,
          lastActivity: c.last_activity ? formatTimeAgo(new Date(c.last_activity)) : 'Never',
          engagement: c.last_action || 'Pending',
          engagementScore: c.engagement_score || Math.round((completedSteps / totalSteps) * 100),
          intent: c.intent || undefined,
          history,
          errorLabel: c.error_label || undefined,
          isSessionError: c.is_session_error || false,
          queuePosition: c.queue_position || undefined,
          inviteStatus: c.invite_status || 'not_applicable',
          inviteSentAt: c.invite_sent_at || undefined,
          firstScheduledAt: c.first_scheduled_at || undefined
        };
      });

      setContacts(realContacts);
      setHasScheduledInvites(progressRes.hasScheduledInvites || false);
      setErrorBreakdown(progressRes.errorBreakdown || []);
      setCampaignStatus(progressRes.campaignStatus || null);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch workflow data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Helper to get step type icon and color
  const getStepTypeInfo = (type?: string) => {
    switch (type) {
      case 'linkedin':
        return { icon: Linkedin, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' };
      case 'email':
        return { icon: Mail, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' };
      case 'sms':
        return { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' };
      case 'phone':
        return { icon: Phone, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' };
      case 'voicemail':
        return { icon: Voicemail, color: 'text-pink-600', bg: 'bg-pink-100 dark:bg-pink-900/30' };
      case 'delay':
        return { icon: Timer, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800/50' };
      default:
        return { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' };
    }
  };

  if (loading && contacts.length === 0 && !workflow) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300">
        <Card className="border-2 border-slate-200">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="p-3 bg-slate-50 rounded border">
                  <Skeleton className="h-3 w-12 mb-2" />
                  <Skeleton className="h-6 w-8" />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-32" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="p-3 border rounded-lg">
                <div className="flex justify-between mb-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!workflow) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-sm text-slate-500">No workflow data available</p>
        </CardContent>
      </Card>
    );
  }

  // Show message when workflow exists but no contacts yet
  if (contacts.length === 0 && workflow) {
    // LinkedIn Search workflow - show search progress
    if (isLinkedInSearch) {
      const getSearchStatusMessage = () => {
        if (!searchJobStatus) return 'Initializing LinkedIn search...';
        switch (searchJobStatus.status) {
          case 'pending': return 'LinkedIn search queued - starting soon...';
          case 'running': return `Searching LinkedIn for leads... (${searchJobStatus.resultsCount || 0} found so far)`;
          case 'completed': return searchJobStatus.resultsCount > 0 
            ? `Search complete! Found ${searchJobStatus.resultsCount} leads. Importing to contacts...`
            : 'Search complete - no leads found matching your criteria';
          case 'failed': return `Search failed: ${searchJobStatus.error || 'Unknown error'}`;
          default: return 'LinkedIn search in progress...';
        }
      };
      
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <Search className="h-8 w-8 text-blue-500" />
                {(!searchJobStatus || searchJobStatus.status === 'pending' || searchJobStatus.status === 'running') && (
                  <RefreshCw className="h-4 w-4 text-blue-500 absolute -bottom-1 -right-1 animate-spin" />
                )}
              </div>
              <div>
                <p className="font-medium">{campaignName}</p>
                <p className="text-sm text-blue-600 mt-1">
                  {getSearchStatusMessage()}
                </p>
              </div>
              {searchJobStatus?.status === 'running' && (
                <Progress value={Math.min((searchJobStatus.resultsCount || 0) * 2, 90)} className="w-48" />
              )}
              {autoRefresh && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Auto-refreshing every 5 seconds</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Regular workflow - show waiting for contacts
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Users className="h-8 w-8 text-slate-400" />
            <div>
              <p className="font-medium">{campaignName}</p>
              <p className="text-sm text-slate-500 mt-1">
                {workflow.status === 'active' 
                  ? 'Workflow is running - waiting for contacts to be added...'
                  : 'No contacts in this workflow yet'}
              </p>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Refreshing...</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const completedCount = contacts.filter(c => c.status === 'completed').length;
  const activeCount = contacts.filter(c => c.status === 'active').length;
  const failedCount = contacts.filter(c => c.status === 'failed').length;
  const avgEngagementScore = Math.round(contacts.reduce((sum, c) => sum + c.engagementScore, 0) / contacts.length);
  
  // Check if there are any session errors
  const hasSessionErrors = contacts.some(c => c.isSessionError);
  const sessionErrorCount = contacts.filter(c => c.isSessionError).length;
  
  // Only show LinkedIn not connected banner if:
  // 1. We have session errors AND
  // 2. LinkedIn is actually not connected (linkedInActuallyConnected === false)
  // If linkedInActuallyConnected is true or null (unknown), don't show the "not connected" banner
  const showLinkedInNotConnectedBanner = hasSessionErrors && linkedInActuallyConnected === false;
  
  // Show a different banner if there are session errors but LinkedIn IS now connected
  const showRetryBanner = hasSessionErrors && linkedInActuallyConnected === true;

  return (
    <div className="space-y-4">
      {/* LinkedIn Not Connected Banner - only shows when LinkedIn is actually not connected */}
      {showLinkedInNotConnectedBanner && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3" data-testid="banner-linkedin-session-error">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">LinkedIn Not Connected</p>
            <p className="text-sm text-red-700 mt-1">
              {sessionErrorCount} contact{sessionErrorCount > 1 ? 's' : ''} failed because your LinkedIn account is not connected. 
              Please go to <strong>My Connections</strong> to connect your LinkedIn account, then reset the failed contacts.
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => navigate('/my-connections')}
            data-testid="button-go-to-connections"
          >
            Go to Connections
          </Button>
        </div>
      )}
      
      {/* Retry Banner - shows when LinkedIn IS connected but there are old failed contacts */}
      {showRetryBanner && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3" data-testid="banner-linkedin-retry">
          <RefreshCw className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">Ready to Retry Failed Contacts</p>
            <p className="text-sm text-amber-700 mt-1">
              {sessionErrorCount} contact{sessionErrorCount > 1 ? 's' : ''} previously failed due to session issues. 
              LinkedIn is now connected - click "Reset Failed" to retry these contacts.
            </p>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            className="border-amber-300 text-amber-700 hover:bg-amber-100"
            onClick={handleResetFailed}
            disabled={resetLoading}
            data-testid="button-reset-failed-banner"
          >
            {resetLoading ? 'Resetting...' : 'Reset Failed'}
          </Button>
        </div>
      )}

      {/* Error Insights Panel - Shows breakdown of errors by type */}
      {errorBreakdown.length > 0 && (
        <Card className="border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20" data-testid="error-insights-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <CardTitle className="text-base text-red-800 dark:text-red-200">
                  Error Insights
                </CardTitle>
                <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-300">
                  {errorBreakdown.reduce((sum, e) => sum + e.count, 0)} failed
                </Badge>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/30"
                onClick={handleResetFailed}
                disabled={resetLoading}
                data-testid="button-reset-all-errors"
              >
                {resetLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry All Failed
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {errorBreakdown.map((error, idx) => (
                <div 
                  key={idx} 
                  className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-red-100 dark:border-red-900 cursor-pointer hover:border-red-300 dark:hover:border-red-700 transition-colors"
                  onClick={() => setShowErrorDetails(showErrorDetails === error.errorType ? null : error.errorType)}
                  data-testid={`error-breakdown-${error.errorType}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        error.errorType === 'connection_timeout' ? 'bg-orange-100 text-orange-700' :
                        error.errorType === 'linkedin_not_connected' ? 'bg-red-100 text-red-700' :
                        error.errorType === 'session_expired' ? 'bg-yellow-100 text-yellow-700' :
                        error.errorType === 'missing_linkedin_url' ? 'bg-purple-100 text-purple-700' :
                        error.errorType === 'warmup_limit' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {error.count}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{error.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {error.count} contact{error.count > 1 ? 's' : ''} affected
                        </p>
                      </div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showErrorDetails === error.errorType ? 'rotate-180' : ''}`} />
                  </div>
                  {showErrorDetails === error.errorType && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                        <Zap className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Recommendation</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{error.recommendation}</p>
                        </div>
                      </div>
                      {error.sampleError && (
                        <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-400 font-mono overflow-x-auto">
                          {error.sampleError.length > 200 ? error.sampleError.substring(0, 200) + '...' : error.sampleError}
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30"
                          onClick={(e) => { e.stopPropagation(); handleRetryErrorType(error.errorType); }}
                          disabled={retryingErrorType === error.errorType}
                          data-testid={`button-retry-${error.errorType}`}
                        >
                          {retryingErrorType === error.errorType ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Retry {error.count} Failed
                            </>
                          )}
                        </Button>
                        {(error.errorType === 'linkedin_not_connected' || error.errorType === 'session_expired') && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                            onClick={(e) => { e.stopPropagation(); navigate('/my-connections'); }}
                            data-testid="button-go-connections-error"
                          >
                            Go to Connections
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Header - Simplified and cleaner */}
      <Card className="border border-slate-200 dark:border-slate-700 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors duration-300 ${isPaused ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-green-100 dark:bg-green-900/30'}`}>
                <Activity className={`h-5 w-5 transition-colors duration-300 ${isPaused ? 'text-yellow-600' : 'text-green-600'}`} />
              </div>
              <div>
                <CardTitle className="text-lg">{campaignName}</CardTitle>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Updated {lastRefresh.toLocaleTimeString()}</span>
                  {autoRefresh && (
                    <span className="flex items-center gap-1 text-green-600">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      Live
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Badge 
              className={`transition-all duration-300 ${isPaused ? 'bg-yellow-500/10 text-yellow-700 border-yellow-300' : 'bg-green-500/10 text-green-700 border-green-300'}`}
              variant="outline"
            >
              {isPaused ? 'Paused' : 'Running'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Compact Stats Row */}
          <div className="flex gap-4 py-3 border-y border-slate-100 dark:border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{contacts.length}</span>
              <span className="text-xs text-slate-500">contacts</span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-sm font-medium">{activeCount}</span>
                <span className="text-xs text-slate-500">active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium">{completedCount}</span>
                <span className="text-xs text-slate-500">done</span>
              </div>
              {failedCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-red-600">{failedCount}</span>
                  <span className="text-xs text-slate-500">failed</span>
                </div>
              )}
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-sm font-medium">{avgEngagementScore}%</span>
              <span className="text-xs text-slate-500">engagement</span>
            </div>
          </div>

          {/* Warmup Progress Bar & Analytics */}
          {warmupAnalytics && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="warmup-analytics-section">
              {/* Warmup Progress */}
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                      <Zap className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Warmup Progress</span>
                      <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                        Day {warmupAnalytics.warmup.currentDay} <span className="text-sm font-normal text-slate-500">• Week {warmupAnalytics.warmup.weekNumber}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {editingDailyLimit ? (
                      <div className="flex items-center gap-1">
                        <span className="text-2xl font-bold text-amber-600">{warmupAnalytics.warmup.sentToday}/</span>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={dailyLimitInput}
                          onChange={(e) => setDailyLimitInput(e.target.value)}
                          className="w-16 h-8 text-lg font-bold text-amber-600"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveDailyLimit();
                            if (e.key === 'Escape') setEditingDailyLimit(false);
                          }}
                          autoFocus
                          data-testid="input-daily-limit"
                        />
                        <Button size="sm" variant="ghost" onClick={handleSaveDailyLimit} className="h-6 w-6 p-0" data-testid="btn-save-limit">
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    ) : (
                      <p 
                        className="text-2xl font-bold text-amber-600 cursor-pointer hover:underline" 
                        onClick={() => { setDailyLimitInput(warmupAnalytics.warmup.dailyLimit.toString()); setEditingDailyLimit(true); }}
                        title="Click to edit daily limit"
                        data-testid="text-daily-limit"
                      >
                        {warmupAnalytics.warmup.sentToday}/{warmupAnalytics.warmup.dailyLimit}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">sent today</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>{warmupAnalytics.warmup.scheduledToday} more scheduled today</span>
                    <span>{warmupAnalytics.warmup.progressPercent}%</span>
                  </div>
                  <Progress value={warmupAnalytics.warmup.progressPercent} className="h-2 bg-amber-100" />
                </div>
                {warmupAnalytics.warmup.nextScheduledAt && (
                  <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Next invite: {new Date(warmupAnalytics.warmup.nextScheduledAt).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true,
                      timeZoneName: 'short'
                    })}
                  </p>
                )}
              </div>

              {/* Analytics Cards */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg border border-emerald-200 dark:border-emerald-900">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Analytics</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-600">{warmupAnalytics.analytics.acceptanceRate}%</p>
                    <p className="text-xs text-slate-500">Acceptance Rate</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{warmupAnalytics.analytics.totalSent}</p>
                    <p className="text-xs text-slate-500">Invites Sent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{warmupAnalytics.analytics.totalAccepted}</p>
                    <p className="text-xs text-slate-500">Accepted</p>
                  </div>
                </div>
                {warmupAnalytics.analytics.avgResponseDays !== null && (
                  <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Avg Response Time</span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {warmupAnalytics.analytics.avgResponseDays} days
                      </span>
                    </div>
                  </div>
                )}
                {warmupAnalytics.analytics.dailyData.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                    <div 
                      className="flex items-center justify-between cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30 -mx-2 px-2 py-1 rounded transition-colors"
                      onClick={() => setShowActivityDetails(!showActivityDetails)}
                      data-testid="btn-toggle-activity-details"
                    >
                      <p className="text-xs text-slate-500">Last 7 Days Activity</p>
                      <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${showActivityDetails ? 'rotate-180' : ''}`} />
                    </div>
                    <div className="flex items-end gap-1 h-10 mt-2">
                      {warmupAnalytics.analytics.dailyData.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <div 
                            className="w-full bg-emerald-400 dark:bg-emerald-500 rounded-t cursor-pointer hover:bg-emerald-500 dark:hover:bg-emerald-400 transition-colors"
                            style={{ height: `${Math.max(4, (day.sent / Math.max(...warmupAnalytics.analytics.dailyData.map(d => d.sent), 1)) * 32)}px` }}
                            title={`${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}: ${day.sent} sent, ${day.accepted} accepted`}
                            onClick={() => setShowActivityDetails(true)}
                          />
                        </div>
                      ))}
                    </div>
                    {showActivityDetails && (
                      <div className="mt-3 space-y-1 bg-white dark:bg-slate-900 rounded-lg p-2 border border-emerald-200 dark:border-emerald-800">
                        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-slate-500 border-b pb-1 mb-1">
                          <span>Day</span>
                          <span className="text-center">Sent</span>
                          <span className="text-center">Accepted</span>
                          <span className="text-center">Rate</span>
                        </div>
                        {warmupAnalytics.analytics.dailyData.map((day, i) => (
                          <div key={i} className="grid grid-cols-4 gap-2 text-xs">
                            <span className="font-medium">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            <span className="text-center text-blue-600 font-semibold">{day.sent}</span>
                            <span className="text-center text-green-600 font-semibold">{day.accepted}</span>
                            <span className="text-center text-purple-600">{day.sent > 0 ? Math.round((day.accepted / day.sent) * 100) : 0}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Campaign Stage & Next Action */}
          {campaignStatus && (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg border border-blue-100 dark:border-blue-900" data-testid="campaign-status-card">
              <div className="flex flex-wrap gap-6">
                {/* Current Stage */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">Current Stage</span>
                  </div>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{campaignStatus.stageLabel}</p>
                  {campaignStatus.channelBreakdown?.linkedin_connection && (
                    <div className="flex gap-3 mt-1 text-xs text-slate-600 dark:text-slate-400">
                      <span>{campaignStatus.channelBreakdown.linkedin_connection.pending} pending</span>
                      <span>{campaignStatus.channelBreakdown.linkedin_connection.sent} sent</span>
                      <span>{campaignStatus.channelBreakdown.linkedin_connection.completed} accepted</span>
                      {campaignStatus.channelBreakdown.linkedin_connection.failed > 0 && (
                        <span className="text-red-500">{campaignStatus.channelBreakdown.linkedin_connection.failed} failed</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Next Action */}
                {campaignStatus.nextAction && (
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-400">Next Action</span>
                    </div>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{campaignStatus.nextAction.label}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium">{campaignStatus.nextAction.contactName}</span>
                      {' • '}
                      <span>{new Date(campaignStatus.nextAction.scheduledAt).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}</span>
                    </p>
                  </div>
                )}

                {/* Schedule Window */}
                {campaignStatus.scheduleWindow && campaignStatus.scheduleWindow.pendingCount > 0 && (
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-400">Schedule Window</span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {campaignStatus.scheduleWindow.pendingCount} actions scheduled
                    </p>
                    {campaignStatus.scheduleWindow.start && campaignStatus.scheduleWindow.end && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(campaignStatus.scheduleWindow.start).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                        {' → '}
                        {new Date(campaignStatus.scheduleWindow.end).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visual Timeline Stepper */}
          {workflow?.steps && workflow.steps.length > 0 && (
            <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg" data-testid="workflow-timeline">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Workflow Progress</span>
                <span className="text-xs text-slate-500">{workflow.steps.length} steps</span>
              </div>
              <div className="flex items-center gap-1">
                {workflow.steps.map((step: WorkflowStep, idx: number) => {
                  const stepInfo = getStepTypeInfo(step.type);
                  const StepIcon = stepInfo.icon;
                  const stepNumber = idx + 1;
                  const contactsOnStep = contacts.filter(c => c.currentStep === stepNumber && c.status === 'active').length;
                  // A step is completed only if ALL contacts have completedSteps >= stepNumber (0-indexed: stepNumber-1)
                  // This means they've finished this step regardless of current status
                  const isCompleted = contacts.length > 0 && contacts.every(c => c.completedSteps >= stepNumber);
                  const hasActive = contactsOnStep > 0;
                  
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <button
                        onClick={() => setStepFilter(stepFilter === String(stepNumber) ? 'all' : String(stepNumber))}
                        className={`relative flex flex-col items-center p-2 rounded-lg transition-all duration-200 flex-1 min-w-0 ${
                          stepFilter === String(stepNumber) 
                            ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-500' 
                            : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                        data-testid={`step-filter-${stepNumber}`}
                        aria-label={`Filter by step ${stepNumber}: ${step.label}. ${contactsOnStep} contacts currently on this step.`}
                        title={`${step.label} - ${contactsOnStep} contacts`}
                      >
                        <div className={`p-1.5 rounded-full mb-1 ${
                          isCompleted ? 'bg-green-100 dark:bg-green-900/30' :
                          hasActive ? stepInfo.bg :
                          'bg-slate-200 dark:bg-slate-700'
                        }`}>
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <StepIcon className={`h-4 w-4 ${hasActive ? stepInfo.color : 'text-slate-400'}`} />
                          )}
                        </div>
                        <span className="text-[10px] font-medium truncate w-full text-center">{step.label}</span>
                        {contactsOnStep > 0 && (
                          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px]">
                            {contactsOnStep}
                          </span>
                        )}
                      </button>
                      {idx < workflow.steps.length - 1 && (
                        <div className={`h-0.5 w-3 flex-shrink-0 ${isCompleted ? 'bg-green-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              {stepFilter !== 'all' && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    Filtering: Step {stepFilter}
                  </span>
                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setStepFilter('all')} data-testid="button-clear-step-filter">
                    Clear filter
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Simplified Controls - Primary + Dropdown */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {/* Primary Action */}
              {contacts.length > 0 && !hasScheduledInvites ? (
                <Button 
                  onClick={handleStartLinkedInInvites}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 transition-all duration-200"
                  disabled={inviteLoading}
                  data-testid="button-start-linkedin-invites"
                >
                  {inviteLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Start Invites
                    </>
                  )}
                </Button>
              ) : hasScheduledInvites ? (
                <div 
                  className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                  data-testid="status-invites-running"
                >
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-700 dark:text-green-400">Invites Running</span>
                </div>
              ) : null}

              {/* Pause/Resume */}
              <Button
                onClick={handlePauseResume}
                size="sm"
                variant="outline"
                disabled={pauseLoading}
                className="gap-2 transition-all duration-200"
                data-testid={isPaused ? 'button-resume-workflow' : 'button-pause-workflow'}
              >
                {pauseLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>

              {/* Reset Failed - Only show if there are failures */}
              {failedCount > 0 && (
                <Button 
                  onClick={handleResetFailed}
                  size="sm"
                  variant="outline"
                  className="gap-2 border-orange-300 text-orange-600 hover:bg-orange-50 transition-all duration-200"
                  disabled={resetLoading}
                  data-testid="button-reset-failed"
                >
                  {resetLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                  Reset Failed
                </Button>
              )}

              {/* Campaign Controls - Add Leads, Volume, Searches */}
              {workspaceId && (
                <CampaignControls
                  campaignId={workflowId}
                  workspaceId={workspaceId}
                  onContactsAdded={fetchWorkflowData}
                />
              )}
            </div>

            {/* More Options Dropdown */}
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                size="sm"
                variant="ghost"
                className={`gap-1 transition-all duration-200 ${autoRefresh ? 'text-green-600' : 'text-slate-500'}`}
                data-testid="button-toggle-refresh"
                aria-label={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
                title={autoRefresh ? 'Auto-refresh on (click to disable)' : 'Auto-refresh off (click to enable)'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-1" 
                    data-testid="button-more-options"
                    aria-label="More options"
                    title="More options"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem 
                    className="gap-2 cursor-pointer" 
                    data-testid="button-edit-workflow"
                    onClick={() => navigate(`/workflows/${workflowId}/edit`)}
                  >
                    <Edit className="h-4 w-4" />
                    Edit Workflow
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="gap-2 cursor-pointer" 
                    data-testid="button-download-results"
                    onClick={() => {
                      const dataStr = JSON.stringify(contacts, null, 2);
                      const blob = new Blob([dataStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${campaignName.replace(/\s+/g, '_')}_contacts.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Export Data
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="gap-2 cursor-pointer"
                    data-testid="button-refresh-now"
                    onClick={() => fetchWorkflowData()}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh Now
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Error State with dismiss */}
          {inviteError && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-400">{inviteError}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                onClick={() => setInviteError(null)}
                aria-label="Dismiss error"
                data-testid="button-dismiss-error"
              >
                <span className="text-red-500 text-lg leading-none">&times;</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sophia Insights Panel */}
      {sophiaInsights && sophiaInsights.insights.length > 0 && (
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-slate-900 dark:to-purple-950 border-purple-200 dark:border-purple-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 animate-pulse" />
                <CardTitle className="text-lg">Sophia's Insights</CardTitle>
              </div>
              <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 border-purple-300">
                {sophiaInsights.insights.length} insight{sophiaInsights.insights.length !== 1 ? 's' : ''}
              </Badge>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">{sophiaInsights.summary}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {sophiaInsights.insights.slice(0, 4).map((insight, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border ${
                  insight.type === 'warning' ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' :
                  insight.type === 'opportunity' ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' :
                  insight.type === 'achievement' ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' :
                  'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
                }`}
              >
                <div className="flex items-start gap-2">
                  {insight.type === 'warning' ? <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" /> :
                   insight.type === 'opportunity' ? <TrendingUp className="h-4 w-4 text-green-600 mt-0.5" /> :
                   insight.type === 'achievement' ? <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5" /> :
                   <Lightbulb className="h-4 w-4 text-amber-600 mt-0.5" />}
                  <div>
                    <p className="font-medium text-sm">{insight.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{insight.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabbed Interface */}
      <Tabs defaultValue="contacts" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contacts">👥 Contacts ({filteredContacts.length})</TabsTrigger>
          <TabsTrigger value="steps">📊 Steps</TabsTrigger>
          <TabsTrigger value="analytics">📈 Analytics</TabsTrigger>
        </TabsList>

        {/* Contact Progress Tab */}
        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Contact Progress
              </CardTitle>
              <CardDescription>
                Search, filter, and manage contact engagement
              </CardDescription>

              {/* Search & Filter */}
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                      data-testid="input-search-contacts"
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2"
                    size="sm"
                    onClick={() => fetchWorkflowData()}
                    data-testid="button-refresh-contacts"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Status Filters with Counts */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: 'All', icon: null, count: contacts.length },
                    { key: 'sent', label: 'Invite Sent', icon: <Send className="h-3 w-3 text-purple-600" />, count: contacts.filter(c => c.status === 'sent').length },
                    { key: 'pending', label: 'Scheduled', icon: <Clock className="h-3 w-3 text-amber-600" />, count: contacts.filter(c => c.status === 'pending').length },
                    { key: 'active', label: 'Active', icon: <Activity className="h-3 w-3 text-blue-600" />, count: contacts.filter(c => c.status === 'active').length },
                    { key: 'skipped', label: 'Already Connected', icon: <CheckCircle2 className="h-3 w-3 text-slate-500" />, count: contacts.filter(c => c.status === 'skipped').length },
                    { key: 'completed', label: 'Accepted', icon: <CheckCircle2 className="h-3 w-3 text-green-600" />, count: contacts.filter(c => c.status === 'completed').length },
                    { key: 'failed', label: 'Failed', icon: <AlertCircle className="h-3 w-3 text-red-600" />, count: contacts.filter(c => c.status === 'failed').length },
                  ].map(({ key, label, icon, count }) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={statusFilter === key ? 'default' : 'outline'}
                      onClick={() => setStatusFilter(key as any)}
                      className="gap-1.5"
                      data-testid={`button-filter-${key}`}
                    >
                      {icon}
                      {label}
                      {count > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{count}</Badge>}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Bulk Actions Bar */}
              {selectedContacts.size > 0 && (
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200" data-testid="bulk-actions-bar">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                      onCheckedChange={(checked) => checked ? selectAllVisible() : clearSelection()}
                      aria-label="Select all visible contacts"
                      data-testid="checkbox-select-all-bulk"
                    />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      {selectedContacts.size} contact{selectedContacts.size > 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-blue-600 h-7"
                      onClick={clearSelection}
                      data-testid="button-clear-selection"
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
                      onClick={handleBulkRetry}
                      disabled={bulkActionLoading}
                      data-testid="button-bulk-retry"
                    >
                      {bulkActionLoading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                      Retry Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={handleBulkSkip}
                      disabled={bulkActionLoading}
                      data-testid="button-bulk-skip"
                    >
                      Skip Selected
                    </Button>
                  </div>
                </div>
              )}

              {/* Select All Header */}
              {filteredContacts.length > 0 && selectedContacts.size === 0 && (
                <div className="mb-2 flex items-center gap-2">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => selectAllVisible()}
                    aria-label="Select all visible contacts"
                    data-testid="checkbox-select-all-header"
                  />
                  <span className="text-xs text-slate-500">Select all ({filteredContacts.length})</span>
                </div>
              )}

              <div className="space-y-2">
                {filteredContacts.map(contact => (
                  <div 
                    key={contact.id} 
                    className={`border rounded-lg hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all duration-200 overflow-hidden ${
                      selectedContacts.has(contact.id) ? 'ring-2 ring-blue-500 border-blue-300' : ''
                    }`}
                  >
                    <div
                      className="p-3 cursor-pointer select-none"
                      onClick={() => setExpandedContact(expandedContact === contact.id ? null : contact.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Selection Checkbox */}
                          <Checkbox
                            checked={selectedContacts.has(contact.id)}
                            onCheckedChange={() => toggleContactSelection(contact.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${contact.name}`}
                            data-testid={`checkbox-contact-${contact.id}`}
                          />
                          
                          {/* Queue Position */}
                          {contact.queuePosition && (
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300" title={`Queue position #${contact.queuePosition}`}>
                              {contact.queuePosition}
                            </div>
                          )}
                          
                          {/* Invite Status indicator */}
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center transition-colors duration-200 ${
                            contact.status === 'sent' ? 'bg-purple-100 dark:bg-purple-900/30' :
                            contact.inviteStatus === 'sent' ? 'bg-purple-100 dark:bg-purple-900/30' :
                            contact.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                            contact.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30' :
                            contact.status === 'skipped' ? 'bg-slate-100 dark:bg-slate-700' :
                            contact.status === 'active' ? 'bg-blue-100 dark:bg-blue-900/30' :
                            contact.status === 'failed' ? 'bg-red-100 dark:bg-red-900/30' :
                            'bg-slate-100 dark:bg-slate-700'
                          }`} title={
                            contact.status === 'sent' ? 'Invite sent - awaiting acceptance' :
                            contact.inviteStatus === 'sent' ? `Invite sent${contact.inviteSentAt ? ` on ${new Date(contact.inviteSentAt).toLocaleDateString()}` : ''}` :
                            contact.status === 'pending' ? 'Scheduled for sending' :
                            contact.status === 'skipped' ? 'Already connected (1st degree)' :
                            contact.status === 'completed' ? 'Connection accepted' :
                            contact.inviteStatus === 'pending' ? 'Invite pending' :
                            contact.status
                          }>
                            {contact.status === 'sent' ? (
                              <Send className="h-4 w-4 text-purple-600" />
                            ) : contact.inviteStatus === 'sent' ? (
                              <Send className="h-4 w-4 text-purple-600" />
                            ) : contact.status === 'completed' ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : contact.status === 'pending' ? (
                              <Clock className="h-4 w-4 text-amber-600" />
                            ) : contact.status === 'skipped' ? (
                              <CheckCircle2 className="h-4 w-4 text-slate-500" />
                            ) : contact.status === 'active' ? (
                              <Activity className="h-4 w-4 text-blue-600" />
                            ) : contact.status === 'failed' ? (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{contact.name}</p>
                              {contact.inviteStatus === 'sent' && (
                                <Badge variant="outline" className="text-xs flex-shrink-0 border-purple-300 text-purple-700 bg-purple-50">
                                  Invite Sent
                                </Badge>
                              )}
                              {contact.intent && (
                                <Badge variant="secondary" className="text-xs flex-shrink-0">
                                  {contact.intent}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                              <span className="truncate">{contact.email}</span>
                              <span className="flex-shrink-0">•</span>
                              <span className="flex-shrink-0">{contact.lastActivity}</span>
                              {contact.inviteSentAt && (
                                <>
                                  <span className="flex-shrink-0">•</span>
                                  <span className="flex-shrink-0 text-green-600">Invite sent {formatTimeAgo(new Date(contact.inviteSentAt))}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {/* Current Step with Icon - The key insight */}
                          {contact.status === 'active' && contact.currentStepName && (
                            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md border bg-white dark:bg-slate-800" data-testid={`current-step-${contact.id}`}>
                              {(() => {
                                const stepInfo = getStepTypeInfo(contact.currentStepType);
                                const StepIcon = stepInfo.icon;
                                return <StepIcon className={`h-3.5 w-3.5 ${stepInfo.color}`} />;
                              })()}
                              <span className="text-xs font-medium truncate max-w-24">{contact.currentStepName}</span>
                            </div>
                          )}
                          
                          {/* Progress indicator */}
                          <div className="hidden sm:flex items-center gap-2 text-xs">
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${(contact.currentStep / contact.totalSteps) * 100}%` }}
                              />
                            </div>
                            <span className="text-slate-500 w-8">{contact.currentStep}/{contact.totalSteps}</span>
                          </div>
                          
                          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${expandedContact === contact.id ? 'rotate-180' : ''}`} />
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details - Smooth animation */}
                    <div className={`transition-all duration-300 ease-in-out ${
                      expandedContact === contact.id ? 'opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
                    }`}>
                      <div className="border-t p-3 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                        {/* Error label if failed */}
                        {contact.status === 'failed' && contact.errorLabel && (
                          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
                            {contact.errorLabel}
                          </div>
                        )}

                        {/* Step Progress Details - Key insight section */}
                        {contact.status === 'active' && (
                          <div className="grid grid-cols-2 gap-3" data-testid={`step-details-${contact.id}`}>
                            {/* Current Step */}
                            <div className="p-3 rounded-lg border bg-white dark:bg-slate-800">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Current Step</p>
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const stepInfo = getStepTypeInfo(contact.currentStepType);
                                  const StepIcon = stepInfo.icon;
                                  return (
                                    <div className={`p-1.5 rounded ${stepInfo.bg}`}>
                                      <StepIcon className={`h-4 w-4 ${stepInfo.color}`} />
                                    </div>
                                  );
                                })()}
                                <div>
                                  <p className="text-sm font-medium">{contact.currentStepName || `Step ${contact.currentStep}`}</p>
                                  <p className="text-xs text-slate-500">Step {contact.currentStep} of {contact.totalSteps}</p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Next Step */}
                            {contact.nextStepName && (
                              <div className="p-3 rounded-lg border bg-white dark:bg-slate-800 border-dashed">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Next Step</p>
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded bg-slate-100 dark:bg-slate-700">
                                    <ArrowRight className="h-4 w-4 text-slate-400" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{contact.nextStepName}</p>
                                    {contact.nextStepScheduled && (
                                      <p className="text-xs text-slate-500">Scheduled: {contact.nextStepScheduled}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Engagement History */}
                        {contact.history.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Activity History</p>
                            <div className="space-y-1.5">
                              {contact.history.slice(0, 3).map((event, idx) => (
                                <div key={idx} className="text-xs p-2 bg-white dark:bg-slate-800 rounded border flex justify-between items-start gap-2">
                                  <div>
                                    <span className="font-medium">{event.action}</span>
                                    {event.details && <span className="text-slate-500 ml-1">- {event.details}</span>}
                                  </div>
                                  <span className="text-slate-400 flex-shrink-0">{event.timestamp}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Quick Actions - Simplified */}
                        <div className="flex gap-2 pt-1">
                          {contact.status === 'failed' ? (
                            <Button size="sm" variant="outline" className="gap-1.5 text-orange-600 border-orange-300 hover:bg-orange-50" data-testid={`button-retry-${contact.id}`}>
                              <RotateCcw className="h-3.5 w-3.5" />
                              Retry
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" className="gap-1.5" data-testid={`button-send-follow-up-${contact.id}`}>
                                <Send className="h-3.5 w-3.5" />
                                Message
                              </Button>
                              <Button size="sm" variant="ghost" className="gap-1.5 text-slate-600" data-testid={`button-schedule-contact-${contact.id}`}>
                                <Calendar className="h-3.5 w-3.5" />
                                Schedule
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredContacts.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No contacts found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflow Steps Tab */}
        <TabsContent value="steps">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Workflow Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {workflow.steps.map((step: WorkflowStep, idx: number) => (
                  <div key={step.id} className="space-y-1">
                    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
                      <div className="text-lg">
                        {step.status === 'completed' ? '✅' : step.status === 'in_progress' ? '⏳' : '⭕'}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{step.label}</p>
                        {step.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-400">{step.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                      </Badge>
                    </div>
                    {idx < workflow.steps.length - 1 && (
                      <div className="flex justify-center text-slate-400">↓</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Analytics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border">
                  <p className="text-xs text-green-600 dark:text-green-400">Completion Rate</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {Math.round((completedCount / contacts.length) * 100)}%
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">{completedCount} completed</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border">
                  <p className="text-xs text-blue-600 dark:text-blue-400">Avg Engagement</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {avgEngagementScore}%
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">{activeCount} active</p>
                </div>
              </div>

              {/* Intent Distribution */}
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border">
                <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-2">
                  🎯 Intent Distribution:
                </p>
                <div className="space-y-1 text-xs">
                  {[
                    { intent: 'Interested', count: 2, color: 'text-green-600' },
                    { intent: 'Meeting Scheduled', count: 1, color: 'text-blue-600' },
                    { intent: 'Not Interested', count: 1, color: 'text-red-600' },
                  ].map(item => (
                    <div key={item.intent} className="flex justify-between">
                      <span>{item.intent}</span>
                      <span className={`font-bold ${item.color}`}>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Engagement Actions */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  ⚡ Top Engagement Actions:
                </p>
                <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
                  <p>• 3 email opens</p>
                  <p>• 1 link click</p>
                  <p>• 1 reply received</p>
                  <p>• 1 meeting booked</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
