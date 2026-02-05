import { useState, useEffect, lazy, Suspense, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SophiaBrain, type SophiaBrainHandle } from "@/components/agent-sophia/sophia-brain";
import { SophiaShowcase } from "@/components/agent-sophia/sophia-showcase";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { SophiaWorkspaceProvider, useSophiaWorkspace } from "@/contexts/SophiaWorkspaceContext";
import {
  MessageSquare,
  Inbox,
  TrendingUp,
  Bot,
  Mail,
  Linkedin,
  Users,
  BarChart3,
  Sparkles,
  Layout,
  MessageCircleMore,
  Loader2,
  ExternalLink
} from "lucide-react";

const WorkflowBuilder = lazy(() => import("@/pages/WorkflowBuilder"));

interface IntegrationStatus {
  email: boolean;
  linkedin: boolean;
  sms: boolean;
  phone: boolean;
}

function ChatWithSophiaContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<'chat' | 'analytics'>('chat');
  const { chatMode, setChatMode } = useSophiaWorkspace();
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    email: true,
    linkedin: false,
    sms: false,
    phone: false
  });
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [showShowcase, setShowShowcase] = useState(false);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [actionHandled, setActionHandled] = useState(false);
  
  // Ref to imperatively control SophiaBrain
  const sophiaBrainRef = useRef<SophiaBrainHandle>(null);
  
  // Queue for prompts that need to be sent when ref is ready
  const pendingPromptRef = useRef<string | null>(null);
  
  // Container ref for scroll control
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Scroll to top on mount
  useEffect(() => {
    // Find the main scrollable container and scroll to top
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
  }, []);

  // Handle URL action parameters (e.g., ?action=create-campaign, ?action=smart-outreach)
  useEffect(() => {
    const action = searchParams.get('action');
    if (!actionHandled && action) {
      setActionHandled(true);
      // Clear the action param from URL to prevent re-triggering
      setSearchParams({}, { replace: true });
      
      let prompt = "";
      
      if (action === 'create-campaign') {
        prompt = "I want to create a new multichannel outreach campaign. Can you guide me through the process?";
      } else if (action === 'smart-outreach') {
        prompt = "I want to create a Smart Outreach campaign where you analyze each contact and pick the best channel for them based on their LinkedIn activity, email engagement, and history. Guide me through setting this up.";
      }
      
      if (prompt) {
        // Ensure chat mode is active
        setChatMode('conversational');
        setActiveView('chat');
        
        // Send the prompt when ready
        if (sophiaBrainRef.current) {
          sophiaBrainRef.current.sendPrompt(prompt).catch(err => {
            console.error('[ChatWithSophia] Error sending action prompt:', err);
          });
        } else {
          pendingPromptRef.current = prompt;
        }
      }
    }
  }, [searchParams, actionHandled, setChatMode, setSearchParams]);

  // Process any pending prompts when SophiaBrain becomes available
  useEffect(() => {
    if (sophiaBrainRef.current && pendingPromptRef.current) {
      const prompt = pendingPromptRef.current;
      pendingPromptRef.current = null;
      console.log('[ChatWithSophia] Processing queued prompt:', prompt);
      sophiaBrainRef.current.sendPrompt(prompt).catch(err => {
        console.error('[ChatWithSophia] Error sending queued prompt:', err);
      });
    }
  });

  useEffect(() => {
    const checkIntegrations = async () => {
      if (!user) return;

      const storedWorkspace = localStorage.getItem('selectedWorkspace');
      const isDemoMode = storedWorkspace === 'demo' || window.location.pathname.includes('demo');
      setCurrentWorkspaceId(storedWorkspace || null);
      setShowShowcase(isDemoMode);

      const { data } = await supabase
        .from('connector_configs')
        .select('email_provider, linkedin_connected, sms_provider, phone_provider')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setIntegrations({
          email: !!data.email_provider || true,
          linkedin: !!data.linkedin_connected,
          sms: !!data.sms_provider,
          phone: !!data.phone_provider
        });
      }
    };

    checkIntegrations();
  }, [user]);

  // Handle processing state changes from SophiaBrain
  const handleProcessingChange = useCallback((isProcessing: boolean) => {
    console.log('[ChatWithSophia] Processing change:', isProcessing);
    setIsProcessingAction(isProcessing);
  }, []);

  // Send a prompt to Sophia - called by quick action buttons
  const sendPromptToSophia = useCallback((prompt: string) => {
    if (isProcessingAction) {
      console.log('[ChatWithSophia] Already processing, skipping');
      return;
    }
    
    console.log('[ChatWithSophia] Sending prompt:', prompt);
    
    // Switch to chat view first
    setChatMode('conversational');
    setActiveView('chat');
    
    // If ref is ready, send immediately; otherwise queue it
    if (sophiaBrainRef.current) {
      console.log('[ChatWithSophia] Ref ready, sending immediately');
      sophiaBrainRef.current.sendPrompt(prompt).catch(err => {
        console.error('[ChatWithSophia] Error sending prompt:', err);
      });
    } else {
      console.log('[ChatWithSophia] Ref not ready, queuing prompt');
      pendingPromptRef.current = prompt;
    }
  }, [isProcessingAction, setChatMode]);

  // Handle showcase prompt selection (for demo mode)
  const handleShowcasePromptSelect = useCallback((prompt: string) => {
    sendPromptToSophia(prompt);
  }, [sendPromptToSophia]);

  return (
      <div className="flex flex-col min-h-full bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 p-6">
        {/* Page Title */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight" data-testid="text-sophia-title">Agent Sophia</h1>
              <p className="text-muted-foreground">Your AI Chief Marketing & Sales Officer</p>
            </div>
          </div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Connected:</span>
            <Badge variant={integrations.email ? "default" : "outline"} className="gap-0.5 text-[10px] h-5 px-1.5">
              <Mail className="h-2.5 w-2.5" />
              Email
            </Badge>
            <Badge variant={integrations.linkedin ? "default" : "outline"} className="gap-0.5 text-[10px] h-5 px-1.5">
              <Linkedin className="h-2.5 w-2.5" />
              LinkedIn
            </Badge>
          </div>

          <div className="flex bg-muted rounded-lg p-1 gap-0 border border-slate-200 dark:border-slate-700">
            <Button
              variant={activeView === 'chat' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-2 rounded"
              onClick={() => setActiveView('chat')}
              data-testid="tab-chat"
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-2 rounded"
              onClick={() => navigate('/inbox')}
              data-testid="tab-inbox"
            >
              <Inbox className="h-4 w-4" />
              Inbox
              <ExternalLink className="h-3 w-3 opacity-50" />
            </Button>
            <Button
              variant={activeView === 'analytics' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs font-medium gap-2 rounded"
              onClick={() => setActiveView('analytics')}
              data-testid="tab-analytics"
            >
              <TrendingUp className="h-4 w-4" />
              Stats
            </Button>
          </div>

          {activeView === 'chat' && (
            <div className="flex items-center gap-0 bg-muted rounded-lg p-1 border border-slate-200 dark:border-slate-700">
              <Button
                variant={chatMode === 'conversational' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0 rounded"
                onClick={() => setChatMode('conversational')}
                data-testid="button-mode-conversational"
                title="Conversational mode"
              >
                <MessageCircleMore className="h-4 w-4" />
              </Button>
              <Button
                variant={chatMode === 'visual' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0 rounded"
                onClick={() => setChatMode('visual')}
                data-testid="button-mode-visual"
                title="Visual mode"
              >
                <Layout className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Tab content area */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 mt-0 data-[state=active]:flex">
          <div className={`flex gap-4 flex-1 min-h-0 overflow-hidden ${showShowcase ? 'flex-row' : ''}`}>
            {showShowcase && (
              <div className="w-72 overflow-y-auto border-r px-4 py-3 bg-muted/30">
                <SophiaShowcase 
                  onPromptSelect={handleShowcasePromptSelect}
                  isLoading={isProcessingAction}
                  workspaceId={currentWorkspaceId || undefined}
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0 flex flex-col">
              {chatMode === 'conversational' ? (
                <SophiaBrain 
                  ref={sophiaBrainRef}
                  onProcessingChange={handleProcessingChange}
                  activeView={activeView}
                  onViewChange={setActiveView}
                  chatMode={chatMode}
                  onChatModeChange={setChatMode}
                  integrations={{ email: integrations.email, linkedin: integrations.linkedin }}
                />
              ) : (
                <Suspense fallback={
                  <Card>
                    <CardContent className="flex items-center justify-center py-12">
                      <div className="text-center space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <p className="text-sm text-muted-foreground">Loading visual workflow builder...</p>
                      </div>
                    </CardContent>
                  </Card>
                }>
                  <WorkflowBuilder />
                </Suspense>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-2">
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Need Help?</CardTitle>
              <CardDescription className="text-xs">
                Ask Sophia to analyze your data
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => sendPromptToSophia("Explain my campaign metrics")}
                  disabled={isProcessingAction}
                  data-testid="button-quick-explain-metrics"
                >
                  {isProcessingAction ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart3 className="h-4 w-4" />
                  )}
                  Explain Metrics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => sendPromptToSophia("Identify my stalled leads")}
                  disabled={isProcessingAction}
                  data-testid="button-quick-stalled-leads"
                >
                  {isProcessingAction ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  Find Stalled Leads
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => sendPromptToSophia("Recommend optimizations for my campaigns")}
                  disabled={isProcessingAction}
                  data-testid="button-quick-optimize"
                >
                  {isProcessingAction ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Optimize Campaigns
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Performance Analytics</CardTitle>
              <CardDescription className="text-sm">
                Track your multichannel campaign performance across all platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Campaign Data Yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Create your first workflow to start tracking performance
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => sendPromptToSophia("Build a new multichannel campaign")}
                  disabled={isProcessingAction}
                  data-testid="button-create-first-campaign"
                >
                  {isProcessingAction ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Create Your First Campaign
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
  );
}

export default function ChatWithSophia() {
  return (
    <SophiaWorkspaceProvider>
      <ChatWithSophiaContent />
    </SophiaWorkspaceProvider>
  );
}
