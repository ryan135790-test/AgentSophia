import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp, 
  Pause, 
  Calendar,
  Zap,
  Activity,
  Target,
  Info
} from "lucide-react";
import type { UserLinkedInSettings } from "../../../shared/schema";

interface SafetyStatusProps {
  settings: UserLinkedInSettings;
}

const WARMUP_PHASES = {
  day1_ultra_light: { day: 1, label: 'Day 1: Ultra Light', color: 'bg-blue-500' },
  day2_light: { day: 2, label: 'Day 2: Light', color: 'bg-blue-500' },
  day3_moderate: { day: 3, label: 'Day 3: Moderate', color: 'bg-cyan-500' },
  day4_building: { day: 4, label: 'Day 4: Building', color: 'bg-cyan-500' },
  day5_normal: { day: 5, label: 'Day 5: Normal', color: 'bg-green-500' },
  day6_expanded: { day: 6, label: 'Day 6: Expanded', color: 'bg-green-500' },
  day7_full: { day: 7, label: 'Day 7: Full', color: 'bg-emerald-500' },
  completed: { day: 8, label: 'Warmup Complete', color: 'bg-emerald-600' },
};

const RISK_COLORS = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const RISK_LABELS = {
  low: 'Low Risk',
  medium: 'Medium Risk',
  high: 'High Risk',
  critical: 'Critical',
};

export function LinkedInSafetyStatus({ settings }: SafetyStatusProps) {
  const safetyScore = settings.safety_score ?? 100;
  const riskLevel = settings.risk_level ?? 'low';
  const warmupPhase = settings.warmup_phase ?? 'day1_ultra_light';
  const warmupInfo = WARMUP_PHASES[warmupPhase as keyof typeof WARMUP_PHASES] || WARMUP_PHASES.completed;
  const warmupProgress = Math.min(100, (warmupInfo.day / 7) * 100);

  const dailyConnectionsUsed = settings.connections_sent_today ?? 0;
  const dailyMessagesUsed = settings.messages_sent_today ?? 0;
  const hourlyConnectionsUsed = settings.connections_sent_this_hour ?? 0;
  const hourlyMessagesUsed = settings.messages_sent_this_hour ?? 0;

  const dailyConnectionLimit = settings.daily_connection_limit ?? 50;
  const dailyMessageLimit = settings.daily_message_limit ?? 80;
  const hourlyConnectionLimit = settings.hourly_connection_limit ?? 8;
  const hourlyMessageLimit = settings.hourly_message_limit ?? 12;

  const acceptanceRate = settings.acceptance_rate ?? 0;
  const isPaused = settings.is_paused ?? false;
  const isWarmingUp = settings.is_warming_up ?? true;

  return (
    <TooltipProvider>
      <div className="space-y-4" data-testid="linkedin-safety-status">
        {isPaused && (
          <Alert variant="destructive" data-testid="alert-paused">
            <Pause className="h-4 w-4" />
            <AlertDescription>
              <strong>Automation Paused:</strong> {settings.pause_reason || 'Safety pause active'}
              {settings.pause_until && (
                <span className="ml-2 text-sm">
                  Resumes: {new Date(settings.pause_until).toLocaleString()}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="card-safety-score">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Safety Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-gray-200 dark:text-gray-700"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${(safetyScore / 100) * 176} 176`}
                      className={safetyScore >= 70 ? 'text-green-500' : safetyScore >= 40 ? 'text-yellow-500' : 'text-red-500'}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                    {safetyScore}
                  </span>
                </div>
                <div>
                  <Badge className={`${RISK_COLORS[riskLevel]} text-white`} data-testid="badge-risk-level">
                    {RISK_LABELS[riskLevel]}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {safetyScore >= 80 ? 'Excellent health' : safetyScore >= 60 ? 'Good status' : safetyScore >= 40 ? 'Needs attention' : 'Critical - reduce activity'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-warmup-status">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Warmup Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{warmupInfo.label}</span>
                  {!isWarmingUp && <CheckCircle className="h-4 w-4 text-green-500" />}
                </div>
                <Progress value={warmupProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {isWarmingUp 
                    ? `Day ${warmupInfo.day} of 7 - Limits gradually increasing`
                    : 'Warmup complete - Operating at full capacity'
                  }
                </p>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-acceptance-rate">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Acceptance Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{acceptanceRate}%</span>
                  {acceptanceRate >= 40 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : acceptanceRate >= 20 ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.total_connections_sent ?? 0} sent, {settings.total_connections_accepted ?? 0} accepted
                </p>
                {acceptanceRate < 20 && (settings.total_connections_sent ?? 0) >= 20 && (
                  <p className="text-xs text-red-500">Low rate may trigger auto-pause</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-activity-limits">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Activity Limits
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Limits are dynamically adjusted based on warmup phase, account age, time of day, and acceptance rate.</p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1" data-testid="limit-daily-connections">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Daily Connections</span>
                  <span className="font-medium">{dailyConnectionsUsed}/{dailyConnectionLimit}</span>
                </div>
                <Progress 
                  value={(dailyConnectionsUsed / dailyConnectionLimit) * 100} 
                  className="h-1.5" 
                />
              </div>

              <div className="space-y-1" data-testid="limit-daily-messages">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Daily Messages</span>
                  <span className="font-medium">{dailyMessagesUsed}/{dailyMessageLimit}</span>
                </div>
                <Progress 
                  value={(dailyMessagesUsed / dailyMessageLimit) * 100} 
                  className="h-1.5" 
                />
              </div>

              <div className="space-y-1" data-testid="limit-hourly-connections">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Hourly Conn.
                  </span>
                  <span className="font-medium">{hourlyConnectionsUsed}/{hourlyConnectionLimit}</span>
                </div>
                <Progress 
                  value={(hourlyConnectionsUsed / hourlyConnectionLimit) * 100} 
                  className="h-1.5" 
                />
              </div>

              <div className="space-y-1" data-testid="limit-hourly-messages">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Hourly Msg.
                  </span>
                  <span className="font-medium">{hourlyMessagesUsed}/{hourlyMessageLimit}</span>
                </div>
                <Progress 
                  value={(hourlyMessagesUsed / hourlyMessageLimit) * 100} 
                  className="h-1.5" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card data-testid="card-scheduling">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Smart Scheduling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Business Hours</span>
                <Badge variant={settings.respect_business_hours ? "default" : "secondary"}>
                  {settings.respect_business_hours ? `${settings.business_hours_start ?? 9}:00 - ${settings.business_hours_end ?? 18}:00` : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Weekend Reduction</span>
                <Badge variant={settings.reduce_weekend_activity ? "default" : "secondary"}>
                  {settings.reduce_weekend_activity ? `${settings.weekend_activity_percent ?? 30}% activity` : 'Disabled'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Timezone</span>
                <span className="text-xs">{settings.timezone ?? 'America/New_York'}</span>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-randomization">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Activity Randomization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Action Delay</span>
                <span className="text-xs">
                  {settings.min_delay_between_actions_seconds ?? 45}s - {settings.max_delay_between_actions_seconds ?? 180}s
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Random Breaks</span>
                <Badge variant="secondary">{settings.random_break_probability ?? 15}% chance</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Account Age</span>
                <Badge variant="outline" className="capitalize">{settings.account_age_category ?? 'new'}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {settings.last_error && (
          <Alert variant="destructive" data-testid="alert-last-error">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Last Error:</strong> {settings.last_error}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </TooltipProvider>
  );
}

export function LinkedInSafetyBadge({ settings }: SafetyStatusProps) {
  const safetyScore = settings.safety_score ?? 100;
  const riskLevel = settings.risk_level ?? 'low';
  const isWarmingUp = settings.is_warming_up ?? true;
  const isPaused = settings.is_paused ?? false;

  if (isPaused) {
    return (
      <Badge variant="destructive" className="gap-1" data-testid="badge-safety-paused">
        <Pause className="h-3 w-3" />
        Paused
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid="badge-safety-status">
      <Badge className={`${RISK_COLORS[riskLevel]} text-white gap-1`}>
        <Shield className="h-3 w-3" />
        {safetyScore}%
      </Badge>
      {isWarmingUp && (
        <Badge variant="outline" className="gap-1">
          <TrendingUp className="h-3 w-3" />
          Warming Up
        </Badge>
      )}
    </div>
  );
}

export default LinkedInSafetyStatus;
