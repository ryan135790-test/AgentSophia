import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Zap,
  TrendingUp
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface LiveStats {
  isRunning: boolean;
  lastRun?: Date;
  tasksToday: number;
  pendingApprovals: number;
  activeChannels: number;
}

export function LiveStatus() {
  const { currentWorkspace } = useWorkspace();
  const [stats, setStats] = useState<LiveStats>({
    isRunning: false,
    tasksToday: 0,
    pendingApprovals: 0,
    activeChannels: 0,
  });

  useEffect(() => {
    loadStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [currentWorkspace?.id]);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if agent is active
      const { data: config } = await supabase
        .from('agent_configs')
        .select('is_active')
        .eq('user_id', user.id)
        .single();

      // Get today's activities
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data: activities } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());

      // Get pending approvals
      const { data: pending } = await supabase
        .from('followup_queue')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending_approval');

      // Count active channels
      const office365Config = localStorage.getItem('office365_config');
      let activeChannels = 0;
      if (office365Config) activeChannels++;

      // Check LinkedIn connection for current workspace (check both tables like frontend does)
      if (currentWorkspace?.id) {
        try {
          // First check linkedin_puppeteer_settings (auto-login)
          const { data: puppeteerConn } = await supabase
            .from('linkedin_puppeteer_settings')
            .select('id')
            .eq('workspace_id', currentWorkspace.id)
            .not('session_cookies_encrypted', 'is', null)
            .maybeSingle();
          
          if (puppeteerConn) {
            activeChannels++;
          } else {
            // Fall back to user_linkedin_settings (manual)
            const { data: linkedinConn } = await supabase
              .from('user_linkedin_settings')
              .select('id')
              .eq('workspace_id', currentWorkspace.id)
              .not('session_cookies_encrypted', 'is', null)
              .maybeSingle();
            if (linkedinConn) activeChannels++;
          }
        } catch (e) {
          // LinkedIn not connected for this workspace
        }
      }

      setStats({
        isRunning: config?.is_active || false,
        lastRun: activities && activities.length > 0 
          ? new Date(activities[0].created_at) 
          : undefined,
        tasksToday: activities?.length || 0,
        pendingApprovals: pending?.length || 0,
        activeChannels,
      });
    } catch (error) {
      console.error('Error loading live stats:', error);
    }
  };

  return (
    <Card className="border-2" data-testid="card-live-status">
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Status */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              {stats.isRunning ? (
                <Activity className="h-8 w-8 text-green-600 animate-pulse" />
              ) : (
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="text-xs text-muted-foreground">Status</div>
            <Badge 
              variant={stats.isRunning ? "default" : "secondary"}
              className={stats.isRunning ? "bg-green-500" : ""}
            >
              {stats.isRunning ? "Active" : "Paused"}
            </Badge>
          </div>

          {/* Tasks Today */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <div className="text-2xl font-bold">{stats.tasksToday}</div>
            <div className="text-xs text-muted-foreground">Tasks Today</div>
          </div>

          {/* Pending Approvals */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle2 className="h-8 w-8 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-600">{stats.pendingApprovals}</div>
            <div className="text-xs text-muted-foreground">Need Approval</div>
          </div>

          {/* Active Channels */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-blue-600">{stats.activeChannels}</div>
            <div className="text-xs text-muted-foreground">Active Channels</div>
          </div>

          {/* Last Run */}
          <div className="text-center col-span-2 md:col-span-1">
            <div className="flex items-center justify-center mb-2">
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
            <div className="text-xs text-muted-foreground">Last Activity</div>
            <div className="text-sm font-medium">
              {stats.lastRun ? (
                <span>{stats.lastRun.toLocaleTimeString()}</span>
              ) : (
                <span className="text-muted-foreground">No activity</span>
              )}
            </div>
          </div>
        </div>

        {stats.isRunning && (
          <div className="mt-4 text-center text-xs text-muted-foreground">
            Agent Sophia checks for tasks every 15 minutes
          </div>
        )}
      </CardContent>
    </Card>
  );
}
