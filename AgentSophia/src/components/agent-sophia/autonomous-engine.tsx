import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Activity,
  Mail,
  MessageSquare,
  Phone,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface EngineStatus {
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  currentActivity?: string;
  tasksCompleted: number;
  tasksQueued: number;
}

interface ChannelStatus {
  channel: string;
  icon: any;
  active: boolean;
  lastActivity?: Date;
  pendingTasks: number;
  color: string;
}

export function AutonomousEngine() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus>({
    isRunning: false,
    tasksCompleted: 0,
    tasksQueued: 0,
  });
  
  const [channels, setChannels] = useState<ChannelStatus[]>([
    { channel: 'Email', icon: Mail, active: false, pendingTasks: 0, color: 'bg-blue-500' },
    { channel: 'LinkedIn', icon: MessageSquare, active: false, pendingTasks: 0, color: 'bg-blue-700' },
    { channel: 'SMS', icon: Phone, active: false, pendingTasks: 0, color: 'bg-green-500' },
    { channel: 'Meetings', icon: Calendar, active: false, pendingTasks: 0, color: 'bg-purple-500' },
  ]);

  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const { toast } = useToast();

  // Poll engine status
  useEffect(() => {
    const interval = setInterval(() => {
      if (engineStatus.isRunning) {
        checkEngineStatus();
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [engineStatus.isRunning]);

  const checkEngineStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check for pending tasks
      const { data: activities } = await supabase
        .from('agent_activities')
        .select('activity_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (activities) {
        const now = new Date();
        const recentActivities = activities.filter(a => {
          const activityDate = new Date(a.created_at);
          const hoursDiff = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);
          return hoursDiff < 1; // Last hour
        });

        setEngineStatus(prev => ({
          ...prev,
          tasksCompleted: recentActivities.length,
          lastRun: recentActivities[0] ? new Date(recentActivities[0].created_at) : prev.lastRun,
        }));
      }
    } catch (error) {
      console.error('Failed to check engine status:', error);
    }
  };

  const startEngine = async () => {
    setIsStarting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update agent config to set is_active = true
      const { data: config } = await supabase
        .from('agent_configs')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!config) {
        throw new Error('Agent configuration not found. Please configure Agent Sophia first.');
      }

      const { error: updateError } = await supabase
        .from('agent_configs')
        .update({ is_active: true })
        .eq('id', config.id);

      if (updateError) throw updateError;

      // Start the autonomous engine
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`${supabaseUrl}/functions/v1/agent-sophia-orchestrator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start',
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start engine');
      }

      setEngineStatus(prev => ({
        ...prev,
        isRunning: true,
        lastRun: new Date(),
        currentActivity: 'Initializing...',
      }));

      // Activate all configured channels
      setChannels(prev => prev.map(ch => ({ ...ch, active: true })));

      toast({
        title: "🚀 Engine Started",
        description: "Agent Sophia is now running autonomously and will handle all outreach operations.",
      });
    } catch (error: any) {
      console.error('Failed to start engine:', error);
      toast({
        title: "Failed to Start",
        description: error.message || "Could not start the autonomous engine",
        variant: "destructive",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const stopEngine = async () => {
    setIsStopping(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update agent config to set is_active = false
      const { data: config } = await supabase
        .from('agent_configs')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (config) {
        await supabase
          .from('agent_configs')
          .update({ is_active: false })
          .eq('id', config.id);
      }

      // Stop the autonomous engine
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      await fetch(`${supabaseUrl}/functions/v1/agent-sophia-orchestrator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'stop',
          userId: user.id,
        }),
      });

      setEngineStatus(prev => ({
        ...prev,
        isRunning: false,
        currentActivity: undefined,
      }));

      setChannels(prev => prev.map(ch => ({ ...ch, active: false })));

      toast({
        title: "⏸️ Engine Stopped",
        description: "Agent Sophia has been paused. No automated actions will be taken.",
      });
    } catch (error: any) {
      console.error('Failed to stop engine:', error);
      toast({
        title: "Failed to Stop",
        description: error.message || "Could not stop the autonomous engine",
        variant: "destructive",
      });
    } finally {
      setIsStopping(false);
    }
  };

  const triggerManualRun = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      toast({
        title: "🔄 Manual Run Triggered",
        description: "Sophia is checking for new responses and executing pending tasks...",
      });

      const response = await fetch(`${supabaseUrl}/functions/v1/agent-sophia-orchestrator`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'run_now',
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to trigger manual run');
      }

      const result = await response.json();
      
      toast({
        title: "✅ Manual Run Complete",
        description: `Processed ${result.tasksCompleted || 0} tasks across all channels.`,
      });

      checkEngineStatus();
    } catch (error: any) {
      console.error('Failed to trigger manual run:', error);
      toast({
        title: "Manual Run Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Autonomous Engine
              </CardTitle>
              <CardDescription>
                Central orchestrator managing all autonomous operations
              </CardDescription>
            </div>
            <Badge
              variant={engineStatus.isRunning ? "default" : "secondary"}
              className={engineStatus.isRunning ? "bg-green-500" : ""}
            >
              {engineStatus.isRunning ? (
                <>
                  <Activity className="h-3 w-3 mr-1 animate-pulse" />
                  Running
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3 mr-1" />
                  Stopped
                </>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Engine Controls */}
          <div className="flex items-center gap-2">
            {!engineStatus.isRunning ? (
              <Button
                onClick={startEngine}
                disabled={isStarting}
                className="flex-1"
                data-testid="button-start-engine"
              >
                {isStarting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Autonomous Mode
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={stopEngine}
                disabled={isStopping}
                variant="destructive"
                className="flex-1"
                data-testid="button-stop-engine"
              >
                {isStopping ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Stopping...
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop Autonomous Mode
                  </>
                )}
              </Button>
            )}
            <Button
              onClick={triggerManualRun}
              variant="outline"
              data-testid="button-manual-run"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          </div>

          {/* Engine Status */}
          {engineStatus.isRunning && engineStatus.currentActivity && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4 text-muted-foreground animate-pulse" />
                <span className="text-sm font-medium">Current Activity</span>
              </div>
              <p className="text-sm text-muted-foreground">{engineStatus.currentActivity}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {engineStatus.tasksCompleted}
              </div>
              <div className="text-xs text-muted-foreground">Tasks Completed</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {engineStatus.tasksQueued}
              </div>
              <div className="text-xs text-muted-foreground">Tasks Queued</div>
            </div>
            <div className="text-center p-3 border rounded-lg">
              <div className="text-2xl font-bold text-foreground">
                {channels.filter(ch => ch.active).length}
              </div>
              <div className="text-xs text-muted-foreground">Active Channels</div>
            </div>
          </div>

          {/* Last Run */}
          {engineStatus.lastRun && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last run: {engineStatus.lastRun.toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Status */}
      <Card>
        <CardHeader>
          <CardTitle>Channel Status</CardTitle>
          <CardDescription>
            Real-time status of all outreach channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {channels.map((channel) => {
              const Icon = channel.icon;
              return (
                <div
                  key={channel.channel}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`channel-${channel.channel.toLowerCase()}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`${channel.color} p-2 rounded-lg text-white`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium">{channel.channel}</p>
                      {channel.lastActivity && (
                        <p className="text-xs text-muted-foreground">
                          Last: {new Date(channel.lastActivity).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {channel.pendingTasks > 0 && (
                      <Badge variant="secondary">
                        {channel.pendingTasks} pending
                      </Badge>
                    )}
                    {channel.active ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
