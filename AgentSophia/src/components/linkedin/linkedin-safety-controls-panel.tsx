import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Users, 
  MessageSquare, 
  Eye, 
  ThumbsUp, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Settings,
  Activity,
  Zap,
  Target,
  RefreshCw,
  Flame,
  Snowflake,
  Linkedin
} from 'lucide-react';

interface DailyLimits {
  connectionRequests: number;
  messages: number;
  profileViews: number;
  searchPulls: number;
  postLikes: number;
  endorsements: number;
  totalActions: number;
}

interface WeeklyLimits {
  connectionRequests: number;
  messages: number;
}

interface UsageStats {
  connectionRequestsSent: number;
  messagesSent: number;
  profileViews: number;
  postLikes: number;
  endorsements: number;
  totalActions: number;
  connectionsAccepted: number;
  acceptanceRate: number;
  pendingInvitations: number;
}

interface AccountSummary {
  accountId: string;
  accountType: string;
  warmUpEnabled: boolean;
  warmUpProgress: number;
  todayUsage: UsageStats;
  limits: DailyLimits;
  healthScore: number;
  recommendations: string[];
}

export function LinkedInSafetyControlsPanel() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    totalAccounts: 0,
    activeToday: 0,
    totalConnectionsSentToday: 0,
    totalMessagesSentToday: 0,
    averageAcceptanceRate: 0
  });
  const { toast } = useToast();

  const [customLimits, setCustomLimits] = useState<DailyLimits>({
    connectionRequests: 25,
    messages: 20,
    profileViews: 100,
    searchPulls: 100,
    postLikes: 50,
    endorsements: 15,
    totalActions: 250
  });

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/linkedin/safety/dashboard');
      const data = await res.json();
      
      if (data.success) {
        setAccounts(data.accounts || []);
        setTotalStats(data.totalStats || {
          totalAccounts: 0,
          activeToday: 0,
          totalConnectionsSentToday: 0,
          totalMessagesSentToday: 0,
          averageAcceptanceRate: 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleWarmUp = async (accountId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/linkedin/safety/accounts/${accountId}/warm-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: enabled ? 'Warm-up Enabled' : 'Warm-up Disabled',
          description: data.message
        });
        fetchDashboard();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to toggle warm-up mode',
        variant: 'destructive'
      });
    }
  };

  const updateLimits = async (accountId: string) => {
    try {
      const res = await fetch(`/api/linkedin/safety/accounts/${accountId}/daily-limits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customLimits)
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast({
          title: 'Limits Updated',
          description: 'Daily limits have been updated'
        });
        fetchDashboard();
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update limits',
        variant: 'destructive'
      });
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-700">Healthy</Badge>;
    if (score >= 50) return <Badge className="bg-yellow-100 text-yellow-700">Warning</Badge>;
    return <Badge className="bg-red-100 text-red-700">At Risk</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-emerald-600" />
          <p className="text-muted-foreground text-sm">Configure safety limits, warm-up schedules, and time delays per account</p>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={fetchDashboard}
          data-testid="button-refresh-dashboard"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card data-testid="card-stat-accounts">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Accounts</span>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-total-accounts">{totalStats.totalAccounts}</p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-active">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Active Today</span>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-active-today">{totalStats.activeToday}</p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-connections">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">Connections Sent</span>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-connections-sent">{totalStats.totalConnectionsSentToday}</p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-messages">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">Messages Sent</span>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-messages-sent">{totalStats.totalMessagesSentToday}</p>
          </CardContent>
        </Card>
        
        <Card data-testid="card-stat-acceptance">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Avg Acceptance</span>
            </div>
            <p className="text-2xl font-bold mt-2" data-testid="text-avg-acceptance">{totalStats.averageAcceptanceRate}%</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-linkedin-safety" className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <Shield className="h-4 w-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="warmup" data-testid="tab-warmup">
            <Flame className="h-4 w-4 mr-2" />
            Warm-up
          </TabsTrigger>
          <TabsTrigger value="delays" data-testid="tab-delays">
            <Clock className="h-4 w-4 mr-2" />
            Time Delays
          </TabsTrigger>
          <TabsTrigger value="variations" data-testid="tab-variations">
            <MessageSquare className="h-4 w-4 mr-2" />
            Variations
          </TabsTrigger>
          <TabsTrigger value="limits" data-testid="tab-limits">
            <Settings className="h-4 w-4 mr-2" />
            Limits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
            <Shield className="h-4 w-4 text-blue-600" />
            <AlertTitle>LinkedIn Safety Best Practices</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Daily Limits:</strong> 20-25 connection requests, 15-22 messages, 80-100 profile views</li>
                <li><strong>Weekly Limits:</strong> 100-200 connection requests (based on account type)</li>
                <li><strong>Target Acceptance Rate:</strong> 25-30% to avoid spam flags</li>
                <li><strong>Pending Invitations:</strong> Keep under 700 to avoid restrictions</li>
              </ul>
            </AlertDescription>
          </Alert>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : accounts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Accounts Configured</h3>
                <p className="text-muted-foreground mb-4">
                  Connect your LinkedIn accounts in the Accounts tab to manage safety controls
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {accounts.map((account) => (
                <Card key={account.accountId} data-testid={`card-account-${account.accountId}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Linkedin className="h-5 w-5 text-blue-600" />
                        <div>
                          <CardTitle className="text-lg" data-testid={`text-account-id-${account.accountId}`}>
                            {account.accountId}
                          </CardTitle>
                          <CardDescription>
                            {account.accountType.replace('_', ' ').toUpperCase()} Account
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {account.warmUpEnabled && (
                          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                            <Flame className="h-3 w-3 mr-1" />
                            Warm-up: {account.warmUpProgress}%
                          </Badge>
                        )}
                        {getHealthBadge(account.healthScore)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Users className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                        <p className="text-xs text-muted-foreground">Connections</p>
                        <p className="font-bold" data-testid={`text-connections-${account.accountId}`}>
                          {account.todayUsage.connectionRequestsSent}/{account.limits.connectionRequests}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <MessageSquare className="h-4 w-4 mx-auto mb-1 text-green-500" />
                        <p className="text-xs text-muted-foreground">Messages</p>
                        <p className="font-bold" data-testid={`text-messages-${account.accountId}`}>
                          {account.todayUsage.messagesSent}/{account.limits.messages}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Eye className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                        <p className="text-xs text-muted-foreground">Profile Views</p>
                        <p className="font-bold">
                          {account.todayUsage.profileViews}/{account.limits.profileViews}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Target className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                        <p className="text-xs text-muted-foreground">Acceptance</p>
                        <p className={`font-bold ${account.todayUsage.acceptanceRate >= 25 ? 'text-green-600' : 'text-red-600'}`}>
                          {account.todayUsage.acceptanceRate}%
                        </p>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Activity className="h-4 w-4 mx-auto mb-1 text-orange-500" />
                        <p className="text-xs text-muted-foreground">Total Actions</p>
                        <p className="font-bold">
                          {account.todayUsage.totalActions}/{account.limits.totalActions}
                        </p>
                      </div>
                    </div>

                    {account.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Recommendations:</p>
                        {account.recommendations.map((rec, idx) => (
                          <Alert key={idx} className="py-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-sm">{rec}</AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="warmup" className="space-y-4">
          <Alert className="bg-orange-50 dark:bg-orange-900/20 border-orange-200">
            <Flame className="h-4 w-4 text-orange-600" />
            <AlertTitle>3-Week Warm-up Protocol</AlertTitle>
            <AlertDescription>
              <p className="mt-2 text-sm">
                New accounts should warm up gradually over 3 weeks to avoid restrictions:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Week 1:</strong> 5-15 connection requests/day, 3-10 messages/day</li>
                <li><strong>Week 2:</strong> 17-22 connection requests/day, 12-17 messages/day</li>
                <li><strong>Week 3:</strong> 23-25 connection requests/day, 18-22 messages/day</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Warm-up Status
              </CardTitle>
              <CardDescription>
                Accounts with fewer than 100 connections automatically start in warm-up mode
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No accounts configured</p>
              ) : (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div 
                      key={account.accountId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`warmup-row-${account.accountId}`}
                    >
                      <div className="flex items-center gap-4">
                        <Linkedin className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">{account.accountId}</p>
                          <p className="text-sm text-muted-foreground">
                            {account.accountType.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        {account.warmUpEnabled && (
                          <div className="w-48">
                            <div className="flex justify-between text-sm mb-1">
                              <span>Progress</span>
                              <span>{account.warmUpProgress}%</span>
                            </div>
                            <Progress value={account.warmUpProgress} className="h-2" />
                            <p className="text-xs text-muted-foreground mt-1">
                              {Math.ceil((100 - account.warmUpProgress) / 100 * 21)} days remaining
                            </p>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`warmup-${account.accountId}`}>Warm-up Mode</Label>
                          <Switch
                            id={`warmup-${account.accountId}`}
                            checked={account.warmUpEnabled}
                            onCheckedChange={(checked) => toggleWarmUp(account.accountId, checked)}
                            data-testid={`switch-warmup-${account.accountId}`}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="limits" className="space-y-4">
          <Alert>
            <Settings className="h-4 w-4" />
            <AlertTitle>Custom Daily Limits</AlertTitle>
            <AlertDescription>
              Adjust limits based on your account type and risk tolerance. Recommended limits are pre-filled based on industry best practices.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Default Limits by Account Type</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Snowflake className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Free Account</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Connections/day:</span>
                    <span>20</span>
                    <span className="text-muted-foreground">Messages/day:</span>
                    <span>15</span>
                    <span className="text-muted-foreground">Connections/week:</span>
                    <span>100</span>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">Premium Account</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Connections/day:</span>
                    <span>25</span>
                    <span className="text-muted-foreground">Messages/day:</span>
                    <span>22</span>
                    <span className="text-muted-foreground">Connections/week:</span>
                    <span>150</span>
                  </div>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Sales Navigator</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Connections/day:</span>
                    <span>25</span>
                    <span className="text-muted-foreground">Messages/day:</span>
                    <span>25</span>
                    <span className="text-muted-foreground">Connections/week:</span>
                    <span>200</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Configure Custom Limits</CardTitle>
                <CardDescription>Set custom limits for a specific account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Select Account</Label>
                  <Select 
                    value={selectedAccount || ''} 
                    onValueChange={setSelectedAccount}
                  >
                    <SelectTrigger data-testid="select-account-for-limits">
                      <SelectValue placeholder="Choose an account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem 
                          key={account.accountId} 
                          value={account.accountId}
                        >
                          {account.accountId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label>Connection Requests/Day: {customLimits.connectionRequests}</Label>
                    <Slider
                      value={[customLimits.connectionRequests]}
                      onValueChange={([v]) => setCustomLimits({...customLimits, connectionRequests: v})}
                      max={50}
                      min={5}
                      step={1}
                      className="mt-2"
                      data-testid="slider-connection-requests"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Recommended: 20-25</p>
                  </div>

                  <div>
                    <Label>Messages/Day: {customLimits.messages}</Label>
                    <Slider
                      value={[customLimits.messages]}
                      onValueChange={([v]) => setCustomLimits({...customLimits, messages: v})}
                      max={50}
                      min={5}
                      step={1}
                      className="mt-2"
                      data-testid="slider-messages"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Recommended: 15-22</p>
                  </div>

                  <div>
                    <Label>Profile Views/Day: {customLimits.profileViews}</Label>
                    <Slider
                      value={[customLimits.profileViews]}
                      onValueChange={([v]) => setCustomLimits({...customLimits, profileViews: v})}
                      max={150}
                      min={20}
                      step={5}
                      className="mt-2"
                      data-testid="slider-profile-views"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Recommended: 80-100</p>
                  </div>

                  <div>
                    <Label>Search Pulls/Day: {customLimits.searchPulls}</Label>
                    <Slider
                      value={[customLimits.searchPulls]}
                      onValueChange={([v]) => setCustomLimits({...customLimits, searchPulls: v})}
                      max={200}
                      min={25}
                      step={5}
                      className="mt-2"
                      data-testid="slider-search-pulls"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Default: 100/day</p>
                  </div>

                  <div>
                    <Label>Post Likes/Day: {customLimits.postLikes}</Label>
                    <Slider
                      value={[customLimits.postLikes]}
                      onValueChange={([v]) => setCustomLimits({...customLimits, postLikes: v})}
                      max={100}
                      min={10}
                      step={5}
                      className="mt-2"
                      data-testid="slider-post-likes"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Recommended: 30-50</p>
                  </div>

                  <div>
                    <Label>Total Actions/Day: {customLimits.totalActions}</Label>
                    <Slider
                      value={[customLimits.totalActions]}
                      onValueChange={([v]) => setCustomLimits({...customLimits, totalActions: v})}
                      max={300}
                      min={50}
                      step={10}
                      className="mt-2"
                      data-testid="slider-total-actions"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Recommended: &lt;250</p>
                  </div>
                </div>

                <Button 
                  onClick={() => selectedAccount && updateLimits(selectedAccount)}
                  disabled={!selectedAccount}
                  className="w-full"
                  data-testid="button-update-limits"
                >
                  Update Limits
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Time Delays Tab */}
        <TabsContent value="delays" className="space-y-4">
          <Alert className="bg-purple-50 dark:bg-purple-900/20 border-purple-200">
            <Clock className="h-4 w-4 text-purple-600" />
            <AlertTitle>Safe Time Delays</AlertTitle>
            <AlertDescription>
              <p className="mt-2 text-sm">
                Random delays between actions help avoid detection. Recommended settings:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Between actions:</strong> 45-180 seconds (randomized)</li>
                <li><strong>Between batches:</strong> 5 minutes after every 5 actions</li>
                <li><strong>Humanization:</strong> Extra random pauses (30% chance)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-500" />
                Action Delay Settings
              </CardTitle>
              <CardDescription>
                Configure time delays between LinkedIn actions to appear more human-like
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Delay Between Actions
                    </h4>
                    
                    <div>
                      <Label>Minimum Delay (seconds)</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <Slider
                          defaultValue={[45]}
                          max={120}
                          min={10}
                          step={5}
                          className="flex-1"
                          data-testid="slider-min-delay"
                        />
                        <Badge variant="outline">45s</Badge>
                      </div>
                    </div>
                    
                    <div>
                      <Label>Maximum Delay (seconds)</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <Slider
                          defaultValue={[180]}
                          max={300}
                          min={60}
                          step={10}
                          className="flex-1"
                          data-testid="slider-max-delay"
                        />
                        <Badge variant="outline">180s</Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <p className="font-medium text-sm">Randomize Delays</p>
                        <p className="text-xs text-muted-foreground">Vary delay times randomly</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-randomize-delays" />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Batch Control
                    </h4>
                    
                    <div>
                      <Label>Actions per Batch</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <Slider
                          defaultValue={[5]}
                          max={10}
                          min={3}
                          step={1}
                          className="flex-1"
                          data-testid="slider-batch-size"
                        />
                        <Badge variant="outline">5</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Take a break after this many actions</p>
                    </div>
                    
                    <div>
                      <Label>Break Duration (minutes)</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <Slider
                          defaultValue={[5]}
                          max={15}
                          min={2}
                          step={1}
                          className="flex-1"
                          data-testid="slider-batch-break"
                        />
                        <Badge variant="outline">5 min</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Humanization
                    </h4>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Enable Humanization</p>
                        <p className="text-xs text-muted-foreground">Add extra random pauses</p>
                      </div>
                      <Switch defaultChecked data-testid="switch-humanization" />
                    </div>
                    
                    <div>
                      <Label>Humanization Chance</Label>
                      <div className="flex items-center gap-3 mt-2">
                        <Slider
                          defaultValue={[30]}
                          max={50}
                          min={10}
                          step={5}
                          className="flex-1"
                          data-testid="slider-humanization-chance"
                        />
                        <Badge variant="outline">30%</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Chance of adding extra 30-120s pause</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <Button className="w-full" data-testid="button-save-delays">
                Save Delay Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Message Variations Tab */}
        <TabsContent value="variations" className="space-y-4">
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200">
            <MessageSquare className="h-4 w-4 text-green-600" />
            <AlertTitle>Message Variations (A/B Testing)</AlertTitle>
            <AlertDescription>
              <p className="mt-2 text-sm">
                Send 3 slight variations of each message to avoid spam detection and test what works best:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li><strong>Opening lines:</strong> Hi, Hello, Hey variations</li>
                <li><strong>Word swaps:</strong> great → excellent, interesting → intriguing</li>
                <li><strong>CTA variations:</strong> Different call-to-action phrases</li>
                <li><strong>Rotation:</strong> Sequential, random, or A/B weighted by performance</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Variation Settings
                </CardTitle>
                <CardDescription>
                  Configure how message variations are generated and rotated
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Enable Variations</p>
                    <p className="text-xs text-muted-foreground">Use message variations in campaigns</p>
                  </div>
                  <Switch defaultChecked data-testid="switch-enable-variations" />
                </div>
                
                <Separator />
                
                <div>
                  <Label>Variations per Message</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Slider
                      defaultValue={[3]}
                      max={5}
                      min={2}
                      step={1}
                      className="flex-1"
                      data-testid="slider-variations-count"
                    />
                    <Badge variant="outline">3</Badge>
                  </div>
                </div>
                
                <div>
                  <Label>Rotation Strategy</Label>
                  <Select defaultValue="random">
                    <SelectTrigger className="mt-2" data-testid="select-rotation-strategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sequential">Sequential (1, 2, 3, 1, 2, 3...)</SelectItem>
                      <SelectItem value="random">Random</SelectItem>
                      <SelectItem value="ab_test">A/B Test (weight by reply rate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <Label>Variation Types</Label>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Opening Line Variations</span>
                    <Switch defaultChecked data-testid="switch-vary-opening" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Closing Line Variations</span>
                    <Switch defaultChecked data-testid="switch-vary-closing" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Call-to-Action Variations</span>
                    <Switch defaultChecked data-testid="switch-vary-cta" />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Word/Phrase Swaps</span>
                    <Switch defaultChecked data-testid="switch-vary-words" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Generate Variations
                </CardTitle>
                <CardDescription>
                  Create variations from your message template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Original Message</Label>
                  <textarea
                    className="w-full mt-2 p-3 border rounded-lg min-h-[120px] text-sm resize-none"
                    placeholder="Hi {{name}},&#10;&#10;I noticed you're working on {{company}}. I'd love to connect and share some insights that might be helpful.&#10;&#10;Would you be open to a quick chat?&#10;&#10;Best regards"
                    data-testid="textarea-original-message"
                  />
                </div>
                
                <Button className="w-full" variant="outline" data-testid="button-generate-variations">
                  <Zap className="h-4 w-4 mr-2" />
                  Generate 3 Variations
                </Button>
                
                <div className="space-y-3">
                  <Label>Generated Variations</Label>
                  
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">Variation 1</Badge>
                      <span className="text-xs text-muted-foreground">0 sent • 0% reply</span>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      Generate variations to see them here...
                    </p>
                  </div>
                  
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">Variation 2</Badge>
                      <span className="text-xs text-muted-foreground">0 sent • 0% reply</span>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      Generate variations to see them here...
                    </p>
                  </div>
                  
                  <div className="p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">Variation 3</Badge>
                      <span className="text-xs text-muted-foreground">0 sent • 0% reply</span>
                    </div>
                    <p className="text-sm text-muted-foreground italic">
                      Generate variations to see them here...
                    </p>
                  </div>
                </div>
                
                <Button className="w-full" data-testid="button-save-variations">
                  Save Variations
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
