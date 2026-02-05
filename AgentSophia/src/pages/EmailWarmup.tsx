import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { 
  Flame, Shield, CheckCircle, XCircle, AlertTriangle, Play, Pause, 
  Plus, Globe, TrendingUp, Calendar, Zap, Brain, Mail, Server,
  DollarSign, Clock, BarChart3, RefreshCw, ArrowRight, Sparkles
} from 'lucide-react';

interface EmailDomain {
  id: string;
  domain: string;
  provider: string;
  status: string;
  warmupDay: number;
  dailyLimit: number;
  sentToday: number;
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  bounceRate: number;
  complaintRate: number;
  reputationScore: number;
  createdAt: string;
}

interface WarmupSchedule {
  day: number;
  dailyLimit: number;
  description: string;
  recommendations: string[];
}

interface SophiaInsight {
  domain: string;
  healthScore: number;
  status: 'healthy' | 'warning' | 'critical';
  insights: string[];
  recommendations: string[];
  predictedWarmupCompletion: string | null;
  riskFactors: string[];
  automatedActions: { action: string; scheduledFor: string; reason: string }[];
}

interface ProviderComparison {
  provider: string;
  name: string;
  costPer100k: string;
  bestFor: string;
  deliverability: string;
  setupComplexity: string;
  recommendation: string;
}

export default function EmailWarmup() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  if (!workspaceId) {
    return <div className="p-8 text-center">Loading workspace...</div>;
  }
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState({ domain: '', provider: 'sendgrid' });
  const [sophiaAutoManage, setSophiaAutoManage] = useState(true);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<{
    domains: EmailDomain[];
    summary: { total: number; warming: number; warmed: number; flagged: number; avgReputationScore: number };
    sophiaInsights: SophiaInsight[];
  }>({
    queryKey: [`/api/workspaces/${workspaceId}/email-warmup/dashboard`],
    enabled: !!workspaceId && workspaceId !== 'default' && !isDemo
  });

  const { data: providers } = useQuery<{
    comparison: ProviderComparison[];
    sophiaRecommendation: { provider: string; reason: string; estimatedMonthlyCost: string };
  }>({
    queryKey: [`/api/workspaces/${workspaceId}/email-warmup/providers`],
    enabled: !!workspaceId && workspaceId !== 'default' && !isDemo
  });

  const { data: schedule } = useQuery<{
    schedule: WarmupSchedule[];
    sophiaTips: string[];
  }>({
    queryKey: [`/api/workspaces/${workspaceId}/email-warmup/schedule`],
    enabled: !!workspaceId && workspaceId !== 'default' && !isDemo
  });

  const { data: sophiaInsights } = useQuery<{
    summary: { totalDomains: number; healthy: number; warnings: number; critical: number; avgHealthScore: number };
    criticalAlerts: { domain: string; issue: string; action: string }[];
    overallRecommendation: string;
  }>({
    queryKey: [`/api/workspaces/${workspaceId}/email-warmup/sophia/insights`],
    enabled: !!workspaceId && workspaceId !== 'default'
  });

  const addDomainMutation = useMutation({
    mutationFn: async (data: { domain: string; provider: string }) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/email-warmup/domains`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      if (isDemo) return;
      toast({ title: 'Domain added', description: 'Configure DNS and verify to start warmup' });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/email-warmup/dashboard`] });
      setShowAddDomain(false);
      setNewDomain({ domain: '', provider: 'sendgrid' });
    }
  });

  const verifyDomainMutation = useMutation({
    mutationFn: async (domainId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/email-warmup/domains/${domainId}/verify`, { method: 'POST' });
    },
    onSuccess: () => {
      if (isDemo) return;
      toast({ title: 'Domain verified', description: 'You can now start warmup' });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/email-warmup/dashboard`] });
    }
  });

  const startWarmupMutation = useMutation({
    mutationFn: async (domainId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/email-warmup/domains/${domainId}/start`, { method: 'POST' });
    },
    onSuccess: () => {
      if (isDemo) return;
      toast({ title: 'Warmup started', description: 'Sophia will manage your warmup automatically' });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/email-warmup/dashboard`] });
    }
  });

  const pauseWarmupMutation = useMutation({
    mutationFn: async (domainId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/email-warmup/domains/${domainId}/pause`, { 
        method: 'POST',
        body: JSON.stringify({ reason: 'User requested pause' })
      });
    },
    onSuccess: () => {
      if (isDemo) return;
      toast({ title: 'Warmup paused' });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/email-warmup/dashboard`] });
    }
  });

  const resumeWarmupMutation = useMutation({
    mutationFn: async (domainId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/email-warmup/domains/${domainId}/resume`, { method: 'POST' });
    },
    onSuccess: () => {
      if (isDemo) return;
      toast({ title: 'Warmup resumed' });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/email-warmup/dashboard`] });
    }
  });

  const toggleAutoManageMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/email-warmup/sophia/auto-manage`, {
        method: 'POST',
        body: JSON.stringify({ enabled })
      });
    },
    onSuccess: (_, enabled) => {
      if (isDemo) return;
      setSophiaAutoManage(enabled);
      toast({ 
        title: enabled ? 'Sophia auto-management enabled' : 'Auto-management disabled',
        description: enabled ? 'Sophia will handle your warmup automatically' : 'Manual management required'
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: any }> = {
      pending_verification: { color: 'bg-gray-100 text-gray-800', icon: Clock },
      verified: { color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
      warming: { color: 'bg-yellow-100 text-yellow-800', icon: Flame },
      warmed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      paused: { color: 'bg-orange-100 text-orange-800', icon: Pause },
      flagged: { color: 'bg-red-100 text-red-800', icon: AlertTriangle }
    };
    
    const { color, icon: Icon } = variants[status] || variants.pending_verification;
    return (
      <Badge className={color}>
        <Icon className="w-3 h-3 mr-1" />
        {status.replace('_', ' ').charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  const getHealthBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
    return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Flame className="w-8 h-8 text-orange-500" />
            Email Warmup
          </h1>
          <p className="text-muted-foreground">Sophia-managed domain warmup for optimal deliverability</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 p-3 border rounded-lg bg-purple-50 dark:bg-purple-900/20">
            <Brain className="w-5 h-5 text-purple-600" />
            <div className="text-sm">
              <p className="font-medium">Sophia Auto-Manage</p>
              <p className="text-xs text-muted-foreground">AI handles warmup</p>
            </div>
            <Switch 
              checked={sophiaAutoManage}
              onCheckedChange={(v) => toggleAutoManageMutation.mutate(v)}
              data-testid="switch-sophia-auto"
            />
          </div>
          <Dialog open={showAddDomain} onOpenChange={setShowAddDomain}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-domain">
                <Plus className="w-4 h-4 mr-2" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Email Domain</DialogTitle>
                <DialogDescription>
                  Add a new domain for warmup. Sophia will guide you through the process.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain</Label>
                  <Input 
                    id="domain"
                    placeholder="mail.yourcompany.com"
                    value={newDomain.domain}
                    onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                    data-testid="input-domain"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email Provider</Label>
                  <Select 
                    value={newDomain.provider}
                    onValueChange={(v) => setNewDomain({ ...newDomain, provider: v })}
                  >
                    <SelectTrigger data-testid="select-provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="ses">Amazon SES (Best Value)</SelectItem>
                      <SelectItem value="postmark">Postmark (Fastest)</SelectItem>
                      <SelectItem value="resend">Resend</SelectItem>
                      <SelectItem value="smtp">Custom SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {providers?.sophiaRecommendation && (
                  <Alert className="bg-purple-50 border-purple-200">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <AlertTitle className="text-purple-800">Sophia Recommends</AlertTitle>
                    <AlertDescription className="text-purple-700">
                      {providers.sophiaRecommendation.reason}
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setShowAddDomain(false)}>Cancel</Button>
                  <Button 
                    onClick={() => addDomainMutation.mutate(newDomain)}
                    disabled={addDomainMutation.isPending || !newDomain.domain}
                    data-testid="button-submit-domain"
                  >
                    Add Domain
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {sophiaInsights?.criticalAlerts && sophiaInsights.criticalAlerts.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Critical Issues Detected</AlertTitle>
          <AlertDescription>
            {sophiaInsights.criticalAlerts.map((alert, i) => (
              <div key={i} className="mt-1">
                <strong>{alert.domain}:</strong> {alert.issue} - {alert.action}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Domains</p>
                <p className="text-2xl font-bold" data-testid="text-total-domains">
                  {dashboard?.summary?.total || 0}
                </p>
              </div>
              <Globe className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Currently Warming</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="text-warming">
                  {dashboard?.summary?.warming || 0}
                </p>
              </div>
              <Flame className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Fully Warmed</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-warmed">
                  {dashboard?.summary?.warmed || 0}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Health Score</p>
                <p className="text-2xl font-bold" data-testid="text-health">
                  {dashboard?.summary?.avgReputationScore || 100}%
                </p>
              </div>
              <Shield className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="providers" data-testid="tab-providers">
            <Server className="w-4 h-4 mr-2" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="schedule" data-testid="tab-schedule">
            <Calendar className="w-4 h-4 mr-2" />
            Warmup Schedule
          </TabsTrigger>
          <TabsTrigger value="sophia" data-testid="tab-sophia">
            <Brain className="w-4 h-4 mr-2" />
            Sophia Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          {dashboardLoading ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Loading...</CardContent></Card>
          ) : dashboard?.domains?.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No domains yet</h3>
                <p className="text-muted-foreground mb-4">Add your first email domain to start warmup</p>
                <Button onClick={() => setShowAddDomain(true)} data-testid="button-add-first">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Domain
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {dashboard?.domains?.map((domain) => (
                <Card key={domain.id} data-testid={`card-domain-${domain.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                          <Flame className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{domain.domain}</h3>
                            {getStatusBadge(domain.status)}
                            <Badge variant="outline">{domain.provider.toUpperCase()}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {domain.status === 'warming' 
                              ? `Day ${domain.warmupDay}/20 - Limit: ${domain.dailyLimit}/day`
                              : domain.status === 'warmed'
                              ? 'Fully warmed - Ready for production'
                              : 'Pending setup'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="grid grid-cols-4 gap-4 text-center text-sm">
                          <div>
                            <p className="text-muted-foreground">Sent Today</p>
                            <p className="font-medium">{domain.sentToday}/{domain.dailyLimit}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Delivery</p>
                            <p className="font-medium text-green-600">{domain.deliveryRate.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Open Rate</p>
                            <p className="font-medium text-blue-600">{domain.openRate.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Bounce</p>
                            <p className={`font-medium ${domain.bounceRate > 2 ? 'text-red-600' : 'text-green-600'}`}>
                              {domain.bounceRate.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {domain.status === 'pending_verification' && (
                            <Button 
                              size="sm"
                              onClick={() => verifyDomainMutation.mutate(domain.id)}
                              disabled={verifyDomainMutation.isPending}
                              data-testid={`button-verify-${domain.id}`}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Verify
                            </Button>
                          )}
                          {domain.status === 'verified' && (
                            <Button 
                              size="sm"
                              onClick={() => startWarmupMutation.mutate(domain.id)}
                              disabled={startWarmupMutation.isPending}
                              data-testid={`button-start-${domain.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start Warmup
                            </Button>
                          )}
                          {domain.status === 'warming' && (
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => pauseWarmupMutation.mutate(domain.id)}
                              disabled={pauseWarmupMutation.isPending}
                              data-testid={`button-pause-${domain.id}`}
                            >
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </Button>
                          )}
                          {(domain.status === 'paused' || domain.status === 'flagged') && (
                            <Button 
                              size="sm"
                              onClick={() => resumeWarmupMutation.mutate(domain.id)}
                              disabled={resumeWarmupMutation.isPending}
                              data-testid={`button-resume-${domain.id}`}
                            >
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Resume
                            </Button>
                          )}
                          {getHealthBadge(domain.reputationScore)}
                        </div>
                      </div>
                    </div>
                    
                    {domain.status === 'warming' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Warmup Progress</span>
                          <span>{Math.round((domain.warmupDay / 20) * 100)}%</span>
                        </div>
                        <Progress value={(domain.warmupDay / 20) * 100} className="h-2" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Sophia's Provider Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="font-medium text-purple-800 dark:text-purple-300">
                    {providers?.sophiaRecommendation?.reason || 'Analyzing your needs...'}
                  </p>
                  <p className="text-sm text-purple-600 mt-2">
                    Estimated monthly cost: {providers?.sophiaRecommendation?.estimatedMonthlyCost || '$15-50'}
                  </p>
                </div>
              </CardContent>
            </Card>
            
            {providers?.comparison?.map((p) => (
              <Card key={p.provider} data-testid={`card-provider-${p.provider}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{p.name}</span>
                    <Badge variant="outline">{p.costPer100k}</Badge>
                  </CardTitle>
                  <CardDescription>{p.bestFor}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Deliverability</span>
                    <span className="font-medium">{p.deliverability}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Setup Complexity</span>
                    <span className="font-medium">{p.setupComplexity}</span>
                  </div>
                  <Separator />
                  <p className="text-sm text-muted-foreground">{p.recommendation}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>20-Day Warmup Schedule</CardTitle>
              <CardDescription>Gradual volume increase managed by Sophia</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-3">
                {schedule?.schedule?.map((day) => (
                  <div 
                    key={day.day}
                    className="p-3 border rounded-lg text-center hover:bg-muted/50 transition-colors"
                    data-testid={`day-${day.day}`}
                  >
                    <p className="text-xs text-muted-foreground">Day {day.day}</p>
                    <p className="text-lg font-bold text-orange-600">{day.dailyLimit}</p>
                    <p className="text-xs text-muted-foreground">emails</p>
                  </div>
                ))}
              </div>
              
              {schedule?.sophiaTips && (
                <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <h4 className="font-medium flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-purple-600" />
                    Sophia's Tips
                  </h4>
                  <ul className="space-y-2">
                    {schedule.sophiaTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Zap className="w-4 h-4 mt-0.5 text-purple-500 flex-shrink-0" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sophia" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-600" />
                  Sophia's Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {sophiaInsights?.summary?.healthy || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Healthy</p>
                  </div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {sophiaInsights?.summary?.warnings || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Warnings</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Overall Recommendation</h4>
                  <p className="text-sm text-muted-foreground">
                    {sophiaInsights?.overallRecommendation || 'All systems operating normally'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Domain Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboard?.sophiaInsights?.map((insight) => (
                    <div key={insight.domain} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{insight.domain}</span>
                        {getHealthBadge(insight.healthScore)}
                      </div>
                      {insight.insights.slice(0, 2).map((text, i) => (
                        <p key={i} className="text-sm text-muted-foreground">{text}</p>
                      ))}
                      {insight.recommendations.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-sm text-purple-600">
                          <ArrowRight className="w-3 h-3" />
                          {insight.recommendations[0]}
                        </div>
                      )}
                    </div>
                  ))}
                  {(!dashboard?.sophiaInsights || dashboard.sophiaInsights.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Add domains to get Sophia's insights
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
