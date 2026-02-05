import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  MessageSquare, 
  Calendar, 
  Users, 
  Zap,
  CheckCircle2,
  XCircle,
  Info,
  Play,
  Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface AutomationToggle {
  id: string;
  title: string;
  description: string;
  icon: any;
  enabled: boolean;
  requiresSetup?: string;
  setupComplete?: boolean;
}

export function AutomationControls() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [automations, setAutomations] = useState<AutomationToggle[]>([
    {
      id: "monitor_emails",
      title: "Monitor Email Inbox",
      description: "Automatically check Office 365 inbox for responses every 15 minutes",
      icon: Mail,
      enabled: false,
      requiresSetup: "Office 365",
      setupComplete: false
    },
    {
      id: "auto_respond_emails",
      title: "Auto-Respond to Emails",
      description: "Generate and send AI responses to incoming emails (requires approval in Semi-Autonomous mode)",
      icon: MessageSquare,
      enabled: false,
      requiresSetup: "Office 365",
      setupComplete: false
    },
    {
      id: "send_followups",
      title: "Send Follow-ups",
      description: "Automatically send scheduled follow-up emails to non-responsive contacts",
      icon: Zap,
      enabled: false,
      requiresSetup: "Office 365",
      setupComplete: false
    },
    {
      id: "linkedin_outreach",
      title: "LinkedIn Automation",
      description: "Send connection requests and messages on LinkedIn (requires Partner API)",
      icon: Users,
      enabled: false,
      requiresSetup: "LinkedIn",
      setupComplete: false
    },
    {
      id: "auto_book_meetings",
      title: "Auto-Book Meetings",
      description: "Automatically book calendar meetings when prospects request them (≥90% confidence)",
      icon: Calendar,
      enabled: false,
      requiresSetup: "Office 365",
      setupComplete: false
    }
  ]);

  const [masterEnabled, setMasterEnabled] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    checkSetupStatus();
    loadAutomationSettings();
  }, [currentWorkspace?.id]);

  const checkSetupStatus = async () => {
    // Check Office 365 connection
    const office365Config = localStorage.getItem('office365_config');
    const hasOffice365 = !!office365Config;

    // Check LinkedIn connection (workspace-scoped)
    let hasLinkedIn = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && currentWorkspace?.id) {
        const { data: linkedinConnection } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', user.id)
          .eq('workspace_id', currentWorkspace.id)
          .eq('platform', 'linkedin')
          .eq('is_active', true)
          .maybeSingle();
        hasLinkedIn = !!linkedinConnection;
      }
    } catch (error) {
      // Table might not exist yet
      console.log('LinkedIn check skipped - table may not exist');
    }

    setAutomations(prev => prev.map(auto => {
      if (auto.requiresSetup === "Office 365") {
        return { ...auto, setupComplete: hasOffice365 };
      }
      if (auto.requiresSetup === "LinkedIn") {
        return { ...auto, setupComplete: hasLinkedIn };
      }
      return auto;
    }));
  };

  const loadAutomationSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: config } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (config) {
        setMasterEnabled(config.is_active);
        const criteria = config.decision_criteria as any;
        
        setAutomations(prev => prev.map(auto => {
          switch(auto.id) {
            case "monitor_emails":
              return { ...auto, enabled: criteria?.monitor_emails ?? false };
            case "auto_respond_emails":
              return { ...auto, enabled: criteria?.auto_respond_emails ?? false };
            case "send_followups":
              return { ...auto, enabled: criteria?.send_followups ?? true };
            case "linkedin_outreach":
              return { ...auto, enabled: criteria?.linkedin_outreach ?? false };
            case "auto_book_meetings":
              return { ...auto, enabled: config.meeting_booking?.auto_book_meetings ?? false };
            default:
              return auto;
          }
        }));
      }
    } catch (error) {
      console.error('Error loading automation settings:', error);
    }
  };

  const toggleAutomation = async (id: string, enabled: boolean) => {
    const automation = automations.find(a => a.id === id);
    
    // Check if setup is required
    if (automation?.requiresSetup && !automation.setupComplete) {
      toast({
        title: "Setup Required",
        description: `Please connect ${automation.requiresSetup} first in the Automation tab.`,
        variant: "destructive",
      });
      return;
    }

    // Update local state
    setAutomations(prev => prev.map(auto => 
      auto.id === id ? { ...auto, enabled } : auto
    ));

    // Save to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: config } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const criteria = (config?.decision_criteria as any) || {};
      const updatedCriteria = { ...criteria, [id]: enabled };

      if (id === "auto_book_meetings") {
        await supabase
          .from('agent_configs')
          .update({
            meeting_booking: {
              ...(config?.meeting_booking as any),
              auto_book_meetings: enabled
            }
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('agent_configs')
          .update({
            decision_criteria: updatedCriteria
          })
          .eq('user_id', user.id);
      }

      toast({
        title: enabled ? "Automation Enabled" : "Automation Disabled",
        description: `${automation?.title} has been ${enabled ? 'enabled' : 'disabled'}.`,
      });
    } catch (error) {
      console.error('Error saving automation setting:', error);
      toast({
        title: "Save Failed",
        description: "Could not save automation settings. Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleMaster = async (enabled: boolean) => {
    setMasterEnabled(enabled);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('agent_configs')
        .update({ is_active: enabled })
        .eq('user_id', user.id);

      toast({
        title: enabled ? "Agent Sophia Activated" : "Agent Sophia Paused",
        description: enabled 
          ? "Agent Sophia will now perform enabled automations every 15 minutes."
          : "All automations are paused. No automatic actions will be taken.",
      });
    } catch (error) {
      console.error('Error toggling master switch:', error);
      toast({
        title: "Error",
        description: "Could not update Agent Sophia status.",
        variant: "destructive",
      });
    }
  };

  const runNow = async () => {
    setIsRunning(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('No active session');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-sophia-orchestrator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'run_now',
          userId: user.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to run orchestrator');
      }

      const result = await response.json();

      toast({
        title: "Agent Sophia Ran Successfully! ✨",
        description: `Checked ${result.results?.responsesDetected || 0} responses. ${result.results?.decisionsTriggered || 0} decisions made. ${result.results?.decisionsTriggered > 0 ? 'Check the Overview tab for pending actions!' : 'No new actions to approve.'}`,
        duration: 5000,
      });

      // Navigate to overview tab to show approval queue (if we're not already there)
      if (result.results?.decisionsTriggered > 0) {
        // Dispatch custom event to navigate to overview
        window.dispatchEvent(new CustomEvent('navigate', { detail: 'agent-sophia' }));
      }

    } catch (error: any) {
      console.error('Error running orchestrator:', error);
      toast({
        title: "Run Failed",
        description: error.message || "Could not trigger Agent Sophia. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRunning(false);
    }
  };

  const enabledCount = automations.filter(a => a.enabled).length;
  const setupCompleteCount = automations.filter(a => a.setupComplete).length;

  return (
    <Card className="border-2" data-testid="card-automation-controls">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Automation Controls</CardTitle>
            <CardDescription>
              Choose which tasks Agent Sophia should handle automatically
            </CardDescription>
          </div>
          <Badge variant={masterEnabled ? "default" : "secondary"} className="text-sm px-3 py-1">
            {masterEnabled ? "Active" : "Paused"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Master Switch */}
        <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-secondary/30">
          <div className="space-y-1 flex-1">
            <Label className="text-base font-semibold">Master Control</Label>
            <p className="text-sm text-muted-foreground">
              {masterEnabled 
                ? "Agent Sophia is running. Automations execute every 15 minutes."
                : "Agent Sophia is paused. No automatic actions will be taken."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={runNow}
              disabled={!masterEnabled || isRunning}
              variant="outline"
              size="sm"
              data-testid="button-run-now"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Now
                </>
              )}
            </Button>
            <Switch
              checked={masterEnabled}
              onCheckedChange={toggleMaster}
              data-testid="switch-master-automation"
            />
          </div>
        </div>

        <Separator />

        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-primary">{enabledCount}/{automations.length}</div>
            <div className="text-xs text-muted-foreground">Automations Enabled</div>
          </div>
          <div className="text-center p-3 border rounded-lg">
            <div className="text-2xl font-bold text-primary">{setupCompleteCount}/{automations.length}</div>
            <div className="text-xs text-muted-foreground">Integrations Connected</div>
          </div>
        </div>

        <Separator />

        {/* Individual Automations */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Individual Automations</Label>
          {automations.map((automation) => {
            const Icon = automation.icon;
            return (
              <div
                key={automation.id}
                className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                  automation.setupComplete 
                    ? 'hover:bg-secondary/50' 
                    : 'opacity-60 bg-muted'
                }`}
                data-testid={`automation-${automation.id}`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className={`p-2 rounded-lg ${
                    automation.enabled ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      automation.enabled ? 'text-primary' : 'text-muted-foreground'
                    }`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">{automation.title}</Label>
                      {!automation.setupComplete && (
                        <Badge variant="outline" className="text-xs">
                          Setup Required
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {automation.description}
                    </p>
                  </div>
                </div>

                <Switch
                  checked={automation.enabled}
                  onCheckedChange={(checked) => toggleAutomation(automation.id, checked)}
                  disabled={!masterEnabled || !automation.setupComplete}
                  data-testid={`switch-${automation.id}`}
                />
              </div>
            );
          })}
        </div>

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>How it works:</strong> When automations are enabled, Agent Sophia checks for tasks every 15 minutes. 
            In Semi-Autonomous mode, complex actions require your approval. In Fully Autonomous mode, all enabled actions execute automatically.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
