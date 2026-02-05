import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Square, 
  Eye, 
  Monitor, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Activity,
  MousePointer2,
  Keyboard,
  RefreshCw
} from 'lucide-react';

interface LiveBrowserStatus {
  active: boolean;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentAction: string;
  duration: number;
  actionsPerformed: string[];
}

export default function LinkedInLiveBrowserDemo() {
  const [isPolling, setIsPolling] = useState(false);

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['/api/linkedin/safety/live-browser/status'],
    queryFn: async () => {
      const res = await fetch('/api/linkedin/safety/live-browser/status');
      return res.json();
    },
    refetchInterval: isPolling ? 2000 : false
  });

  const session: LiveBrowserStatus | null = statusData?.session || null;

  useEffect(() => {
    if (session?.active && session?.status === 'running') {
      setIsPolling(true);
    } else {
      setIsPolling(false);
    }
  }, [session?.active, session?.status]);

  const startBrowserMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/linkedin/safety/live-browser/start', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      refetchStatus();
    }
  });

  const runDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/linkedin/safety/live-browser/run-demo', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      refetchStatus();
    }
  });

  const stopBrowserMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/linkedin/safety/live-browser/stop', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      refetchStatus();
    }
  });

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    if (!session?.active) {
      return <Badge variant="secondary">Not Running</Badge>;
    }
    switch (session.status) {
      case 'running':
        return <Badge variant="default" className="bg-blue-500">Running</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Idle</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Monitor className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Live Browser Demo</CardTitle>
              <CardDescription>
                Watch LinkedIn automation in action with VNC display
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
          <Eye className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 dark:text-blue-200">How to Watch the Live Browser</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300 space-y-3">
            <div className="space-y-2">
              <p className="font-semibold">Step 1: Find the Desktop Tab</p>
              <p className="ml-4">Look at the right side of your Replit workspace. You should see tabs like "Webview", "Console", and "Desktop" (or "VNC").</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Step 2: Open the Desktop/VNC Tab</p>
              <p className="ml-4">Click on "Desktop" or "VNC" tab. This opens a virtual display that shows the server's screen.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Step 3: Start the Browser</p>
              <p className="ml-4">Click <strong>"Start Live Browser"</strong> below. A Chromium window will appear in the Desktop tab.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold">Step 4: Run the Demo</p>
              <p className="ml-4">Click <strong>"Run Demo Sequence"</strong> and watch the browser navigate, type, and scroll automatically!</p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-md mt-3">
              <p className="text-amber-800 dark:text-amber-300 text-sm">
                <strong>No Desktop tab?</strong> Some Replit plans don't include VNC access. You can still use the automation - you just won't see it visually. The demo actions will still run and show results here.
              </p>
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-3">
          {!session?.active ? (
            <Button
              onClick={() => startBrowserMutation.mutate()}
              disabled={startBrowserMutation.isPending}
              data-testid="button-start-live-browser"
            >
              {startBrowserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Browser...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Live Browser
                </>
              )}
            </Button>
          ) : (
            <>
              <Button
                onClick={() => runDemoMutation.mutate()}
                disabled={runDemoMutation.isPending || session.status === 'running'}
                data-testid="button-run-demo"
              >
                {runDemoMutation.isPending || session.status === 'running' ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running Demo...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    Run Demo Sequence
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                onClick={() => stopBrowserMutation.mutate()}
                disabled={stopBrowserMutation.isPending}
                data-testid="button-stop-browser"
              >
                {stopBrowserMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Browser
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => refetchStatus()}
                data-testid="button-refresh-status"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </>
          )}
        </div>

        {session?.active && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Current Action</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {session.currentAction || 'Waiting...'}
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Session Duration</span>
                </div>
                <p className="text-lg font-mono">
                  {formatDuration(session.duration)}
                </p>
              </div>
            </div>

            {session.actionsPerformed.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Actions Performed</h4>
                <ScrollArea className="h-[150px] rounded-lg border p-3">
                  <div className="space-y-2">
                    {session.actionsPerformed.map((action, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-muted-foreground">{action}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}

        <div className="border rounded-lg p-4 bg-muted/30">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            What the Demo Shows
          </h4>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-2 text-sm">
              <MousePointer2 className="h-4 w-4 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">Natural Mouse Movement</p>
                <p className="text-muted-foreground">Curved paths with variable speed</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Keyboard className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Human-Like Typing</p>
                <p className="text-muted-foreground">Random delays and occasional pauses</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Activity className="h-4 w-4 text-purple-500 mt-0.5" />
              <div>
                <p className="font-medium">Page Scrolling</p>
                <p className="text-muted-foreground">Smooth scrolling with reading pauses</p>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Monitor className="h-4 w-4 text-orange-500 mt-0.5" />
              <div>
                <p className="font-medium">Anti-Fingerprint</p>
                <p className="text-muted-foreground">Browser spoofing active</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
