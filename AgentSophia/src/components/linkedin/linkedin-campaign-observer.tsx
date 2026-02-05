import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Eye, EyeOff, Play, Square, Monitor, Activity,
  Clock, Navigation, MousePointer, MessageSquare, UserPlus, User,
  RefreshCw, Zap, AlertTriangle, CheckCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface SessionEvent {
  timestamp: string;
  type: 'action' | 'navigation' | 'status' | 'error';
  message: string;
}

interface ObserverSession {
  id: string;
  campaignId?: string;
  visible: boolean;
  status: string;
  currentAction: string;
  duration: number;
  events: SessionEvent[];
}

interface Campaign {
  id: number;
  name: string;
  status: string;
}

export default function LinkedInCampaignObserver() {
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [isPolling, setIsPolling] = useState(false);
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const userId = user?.id || 'anonymous';
  const workspaceId = currentWorkspace?.id;
  
  if (!workspaceId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  const { data: statusData, refetch: refetchStatus } = useQuery<{ success: boolean; session: ObserverSession | null }>({
    queryKey: ['/api/linkedin/safety/campaign-observer/status'],
    refetchInterval: isPolling ? 2000 : false,
  });

  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ['/api/workspaces', workspaceId, 'campaigns'],
    queryFn: async () => {
      if (!workspaceId) return [];
      const res = await fetch(`/api/workspaces/${workspaceId}/campaigns`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!workspaceId,
  });

  const startObserverMutation = useMutation({
    mutationFn: async (campaignId?: string) => {
      return apiRequest('/api/linkedin/safety/campaign-observer/start', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          workspaceId,
          campaignId: campaignId || undefined,
          observerId: `obs-${Date.now()}`
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      setIsPolling(true);
      refetchStatus();
    }
  });

  const stopObserverMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/linkedin/safety/campaign-observer/stop', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      setIsPolling(false);
      refetchStatus();
    }
  });

  const simulateActionMutation = useMutation({
    mutationFn: async (actionType: string) => {
      return apiRequest('/api/linkedin/safety/campaign-observer/simulate-campaign-action', {
        method: 'POST',
        body: JSON.stringify({ actionType }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      refetchStatus();
    }
  });

  const navigateMutation = useMutation({
    mutationFn: async (action: string) => {
      return apiRequest('/api/linkedin/safety/campaign-observer/demo-action', {
        method: 'POST',
        body: JSON.stringify({ action }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      refetchStatus();
    }
  });

  const session = statusData?.session;
  const isActive = session?.visible;

  useEffect(() => {
    if (session?.visible) {
      setIsPolling(true);
    }
  }, [session?.visible]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            Live Campaign Observer
          </CardTitle>
          <CardDescription>
            Watch real campaign actions happen live in the Desktop/VNC view
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
            <Monitor className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">How to Watch Live</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Open the <strong>Desktop</strong> or <strong>VNC</strong> tab in Replit (next to Console)</li>
                <li>Start the observer session below</li>
                <li>Use the action buttons to simulate campaign actions</li>
                <li>Watch the browser perform actions in real-time!</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Session Control
              </h3>

              <div className="space-y-3">
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger data-testid="select-campaign">
                    <SelectValue placeholder="Select a campaign (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No specific campaign</SelectItem>
                    {campaigns?.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id.toString()}>
                        {campaign.name} ({campaign.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  {!isActive ? (
                    <Button
                      onClick={() => startObserverMutation.mutate(selectedCampaign !== "none" ? selectedCampaign : undefined)}
                      disabled={startObserverMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid="btn-start-observer"
                    >
                      {startObserverMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 mr-2" />
                      )}
                      Start Live Observer
                    </Button>
                  ) : (
                    <Button
                      onClick={() => stopObserverMutation.mutate()}
                      disabled={stopObserverMutation.isPending}
                      variant="destructive"
                      className="flex-1"
                      data-testid="btn-stop-observer"
                    >
                      {stopObserverMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Square className="w-4 h-4 mr-2" />
                      )}
                      Stop Observer
                    </Button>
                  )}
                </div>
              </div>

              {isActive && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Quick Navigation</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateMutation.mutate('navigate-feed')}
                        disabled={navigateMutation.isPending}
                        data-testid="btn-nav-feed"
                      >
                        <Navigation className="w-4 h-4 mr-1" />
                        Feed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateMutation.mutate('navigate-network')}
                        disabled={navigateMutation.isPending}
                        data-testid="btn-nav-network"
                      >
                        <UserPlus className="w-4 h-4 mr-1" />
                        Network
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateMutation.mutate('navigate-messages')}
                        disabled={navigateMutation.isPending}
                        data-testid="btn-nav-messages"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Messages
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigateMutation.mutate('scroll')}
                        disabled={navigateMutation.isPending}
                        data-testid="btn-scroll"
                      >
                        <MousePointer className="w-4 h-4 mr-1" />
                        Scroll
                      </Button>
                    </div>
                  </div>

                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Simulate Campaign Actions</h4>
                    <div className="space-y-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => simulateActionMutation.mutate('view_profile')}
                        disabled={simulateActionMutation.isPending}
                        data-testid="btn-sim-view-profile"
                      >
                        <User className="w-4 h-4 mr-2" />
                        View Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => simulateActionMutation.mutate('connection_request')}
                        disabled={simulateActionMutation.isPending}
                        data-testid="btn-sim-connection"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Connection Request Flow
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={() => simulateActionMutation.mutate('send_message')}
                        disabled={simulateActionMutation.isPending}
                        data-testid="btn-sim-message"
                      >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Send Message Flow
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-500" />
                Session Status
              </h3>

              <div className="p-4 rounded-lg border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-green-400 mr-2 animate-pulse" />
                        Active
                      </>
                    ) : (
                      <>
                        <EyeOff className="w-3 h-3 mr-1" />
                        Inactive
                      </>
                    )}
                  </Badge>
                </div>

                {session && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Duration</span>
                      <span className="font-mono text-sm">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatDuration(session.duration)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Action</span>
                      <span className="text-sm truncate max-w-[180px]">{session.currentAction}</span>
                    </div>
                    {session.campaignId && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Campaign</span>
                        <Badge variant="outline">{session.campaignId}</Badge>
                      </div>
                    )}
                  </>
                )}
              </div>

              {session?.events && session.events.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Recent Events</h4>
                  <ScrollArea className="h-[200px] rounded-md border p-3">
                    <div className="space-y-2">
                      {[...session.events].reverse().map((event, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2 text-sm p-2 rounded bg-muted/30"
                        >
                          {event.type === 'navigation' && <Navigation className="w-3 h-3 mt-1 text-blue-500" />}
                          {event.type === 'action' && <Zap className="w-3 h-3 mt-1 text-yellow-500" />}
                          {event.type === 'status' && <CheckCircle className="w-3 h-3 mt-1 text-green-500" />}
                          {event.type === 'error' && <AlertTriangle className="w-3 h-3 mt-1 text-red-500" />}
                          <div className="flex-1">
                            <p className="text-xs">{event.message}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(event.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>

          {isActive && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-200">Session Active</AlertTitle>
              <AlertDescription className="text-green-700 dark:text-green-300">
                The browser is running! Open the <strong>Desktop/VNC tab</strong> to watch actions in real-time.
                Use the navigation and simulation buttons to see the browser respond.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
