import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Building2 } from 'lucide-react';
import { TeamManagement } from '@/components/workspace/team-management';
import { AutoReplyConfig } from '@/components/agent-sophia/auto-reply-config';
import { WorkflowTriggers } from '@/components/automation/workflow-triggers';
import { SocialMediaManager } from '@/components/features/social-media-manager';
import { BrandVoiceManager } from '@/components/agent-sophia/brand-voice-manager';
import { EmailAssistant } from '@/components/agent-sophia/email-assistant';
import { ConversationAnalyzer } from '@/components/features/conversation-analyzer';
import { DealForecasting } from '@/components/features/deal-forecasting';
import { ContentGenerator } from '@/components/features/content-generator';
import { AIFineTuning } from '@/components/features/ai-fine-tuning';
import { EmailSMSSender } from '@/components/features/email-sms-sender';
import { CRMIntegrations } from '@/components/features/crm-integrations';
import { AnalyticsDashboard } from '@/components/features/analytics-dashboard';
import { CalendarBookingManager } from '@/components/features/calendar-booking-manager';
import { LeadEnrichment } from '@/components/features/lead-enrichment';
import { EmailSync } from '@/components/features/email-sync';
import { ActivityFeed } from '@/components/features/activity-feed';
import { ABMManager } from '@/components/features/abm-manager';
import { AdvancedReporting } from '@/components/features/advanced-reporting';
import { WorkspaceApiKeys } from '@/components/settings/workspace-api-keys';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function WorkspaceSettings() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workspaceId && user) {
      fetchWorkspace();
    }
  }, [workspaceId, user]);

  const fetchWorkspace = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch workspace');

      const data = await response.json();
      setWorkspace(data);
      setName(data.name);
      setDescription(data.description || '');
    } catch (error) {
      console.error('Error fetching workspace:', error);
      toast({ title: 'Error', description: 'Failed to load workspace', variant: 'destructive' });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Workspace name is required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ name, description })
      });

      if (!response.ok) throw new Error('Failed to update workspace');

      toast({ title: 'Success', description: 'Workspace updated' });
      await fetchWorkspace();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save workspace', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <p className="text-muted-foreground">Workspace not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Building2 className="h-8 w-8" />
              Workspace Settings
            </h1>
            <p className="text-muted-foreground">{workspace.name}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="w-full">
          <div className="flex overflow-x-auto pb-2 scrollbar-hide">
            <TabsList className="inline-flex gap-0 bg-transparent p-0">
              <TabsTrigger value="general" className="rounded-none border-b-2 border-transparent">General</TabsTrigger>
              <TabsTrigger value="team" className="rounded-none border-b-2 border-transparent">Team</TabsTrigger>
              <TabsTrigger value="auto-reply" className="rounded-none border-b-2 border-transparent">Auto-Reply</TabsTrigger>
              <TabsTrigger value="automation" className="rounded-none border-b-2 border-transparent">Automation</TabsTrigger>
              <TabsTrigger value="calendar" className="rounded-none border-b-2 border-transparent">Calendar</TabsTrigger>
              <TabsTrigger value="lead-enrich" className="rounded-none border-b-2 border-transparent">Leads</TabsTrigger>
              <TabsTrigger value="email-sync" className="rounded-none border-b-2 border-transparent">Email</TabsTrigger>
              <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent">Activity</TabsTrigger>
              <TabsTrigger value="abm" className="rounded-none border-b-2 border-transparent">ABM</TabsTrigger>
              <TabsTrigger value="social" className="rounded-none border-b-2 border-transparent">Social 📱</TabsTrigger>
              <TabsTrigger value="analysis" className="rounded-none border-b-2 border-transparent">Analysis</TabsTrigger>
              <TabsTrigger value="forecasting" className="rounded-none border-b-2 border-transparent">Forecast</TabsTrigger>
              <TabsTrigger value="content" className="rounded-none border-b-2 border-transparent">Content</TabsTrigger>
              <TabsTrigger value="fine-tuning" className="rounded-none border-b-2 border-transparent">AI Train</TabsTrigger>
              <TabsTrigger value="email-sms" className="rounded-none border-b-2 border-transparent">Email/SMS</TabsTrigger>
              <TabsTrigger value="crm" className="rounded-none border-b-2 border-transparent">CRM</TabsTrigger>
              <TabsTrigger value="analytics" className="rounded-none border-b-2 border-transparent">Analytics</TabsTrigger>
              <TabsTrigger value="reporting" className="rounded-none border-b-2 border-transparent">Reports</TabsTrigger>
              <TabsTrigger value="brand-voice" className="rounded-none border-b-2 border-transparent">Brand Voice</TabsTrigger>
              <TabsTrigger value="email-assistant" className="rounded-none border-b-2 border-transparent">Email AI</TabsTrigger>
              <TabsTrigger value="api-keys" className="rounded-none border-b-2 border-transparent">API Keys</TabsTrigger>
            </TabsList>
          </div>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workspace Information</CardTitle>
                <CardDescription>Update your workspace details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Workspace Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Workspace"
                    data-testid="input-workspace-name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description for your workspace"
                    data-testid="input-workspace-description"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Workspace ID</label>
                  <div className="p-3 bg-muted rounded-lg border">
                    <code className="text-sm font-mono">{workspace.id}</code>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button onClick={handleSaveSettings} disabled={saving} data-testid="button-save-workspace">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="outline" onClick={() => fetchWorkspace()}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Members Tab */}
          <TabsContent value="team" className="space-y-6">
            <TeamManagement workspaceId={workspaceId!} />
          </TabsContent>

          {/* Auto-Reply Tab */}
          <TabsContent value="auto-reply" className="space-y-6">
            <AutoReplyConfig workspaceId={workspaceId!} />
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="space-y-6">
            <WorkflowTriggers workspaceId={workspaceId!} />
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="space-y-6">
            <CalendarBookingManager />
          </TabsContent>

          {/* Lead Enrichment Tab */}
          <TabsContent value="lead-enrich" className="space-y-6">
            <LeadEnrichment />
          </TabsContent>

          {/* Email Sync Tab */}
          <TabsContent value="email-sync" className="space-y-6">
            <EmailSync />
          </TabsContent>

          {/* Activity Feed Tab */}
          <TabsContent value="activity" className="space-y-6">
            <ActivityFeed />
          </TabsContent>

          {/* ABM Tab */}
          <TabsContent value="abm" className="space-y-6">
            <ABMManager />
          </TabsContent>

          {/* Reporting Tab */}
          <TabsContent value="reporting" className="space-y-6">
            <AdvancedReporting />
          </TabsContent>

          {/* Email/SMS Tab */}
          <TabsContent value="email-sms" className="space-y-6">
            <EmailSMSSender />
          </TabsContent>

          {/* CRM Tab */}
          <TabsContent value="crm" className="space-y-6">
            <CRMIntegrations />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsDashboard />
          </TabsContent>

          {/* Social Media Tab */}
          <TabsContent value="social" className="space-y-6">
            <SocialMediaManager />
          </TabsContent>

          {/* Analysis Tab */}
          <TabsContent value="analysis" className="space-y-6">
            <ConversationAnalyzer />
          </TabsContent>

          {/* Forecasting Tab */}
          <TabsContent value="forecasting" className="space-y-6">
            <DealForecasting />
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-6">
            <ContentGenerator />
          </TabsContent>

          {/* Fine-tuning Tab */}
          <TabsContent value="fine-tuning" className="space-y-6">
            <AIFineTuning />
          </TabsContent>

          {/* Brand Voice Tab */}
          <TabsContent value="brand-voice" className="space-y-6">
            <BrandVoiceManager />
          </TabsContent>

          {/* Email Assistant Tab */}
          <TabsContent value="email-assistant" className="space-y-6">
            <EmailAssistant />
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-6">
            <WorkspaceApiKeys workspaceId={workspaceId!} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
