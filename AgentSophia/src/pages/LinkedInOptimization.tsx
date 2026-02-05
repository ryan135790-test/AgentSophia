import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { SophiaHeader } from '@/components/agent-sophia/sophia-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  Reply,
  FlaskConical,
  Ban,
  TrendingUp,
  Plus,
  Trash2,
  Play,
  Pause,
  Trophy,
  AlertCircle,
  CheckCircle2,
  Building,
  Mail,
  User,
  Search,
  Upload,
  ArrowUp,
  ArrowDown,
  Minus,
  Target,
  Users,
  MessageSquare,
  Handshake,
} from 'lucide-react';

export default function LinkedInOptimization() {
  const { currentWorkspace } = useWorkspace();
  const WORKSPACE_ID = currentWorkspace?.id || '';
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('reply-detection');
  const [newBlacklistEntry, setNewBlacklistEntry] = useState({ type: 'profile', value: '', reason: '' });
  const [newTestVariant, setNewTestVariant] = useState({ name: '', content: '' });
  const [testName, setTestName] = useState('');
  const [testType, setTestType] = useState<string>('connection_note');

  const { data: replyConfig } = useQuery<{
    enabled: boolean;
    stopSequenceOnReply: boolean;
    notifyOnReply: boolean;
    autoTagReplied: boolean;
    replyWindow: number;
  }>({
    queryKey: ['/api/linkedin/advanced/reply-detection/config', WORKSPACE_ID],
  });

  const { data: replyStats } = useQuery<{
    totalTracked: number;
    replied: number;
    replyRate: number;
    positiveReplies: number;
    negativeReplies: number;
    neutralReplies: number;
  }>({
    queryKey: ['/api/linkedin/advanced/reply-detection/stats', WORKSPACE_ID],
  });

  const { data: abTests = [] } = useQuery<any[]>({
    queryKey: ['/api/linkedin/advanced/ab-tests', WORKSPACE_ID],
  });

  const { data: blacklist = [] } = useQuery<any[]>({
    queryKey: ['/api/linkedin/advanced/blacklist', WORKSPACE_ID],
  });

  const { data: blacklistStats } = useQuery<{
    total: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    recentlyAdded: number;
  }>({
    queryKey: ['/api/linkedin/advanced/blacklist', WORKSPACE_ID, 'stats'],
  });

  const { data: dedupConfig } = useQuery<{
    enabled: boolean;
    checkLinkedInUrl: boolean;
    checkEmail: boolean;
    checkName: boolean;
    cooldownDays: number;
    maxCampaignsPerContact: number;
  }>({
    queryKey: ['/api/linkedin/advanced/deduplication', WORKSPACE_ID, 'config'],
  });

  const { data: ssiData } = useQuery<{
    current: {
      overall: number;
      professionalBrand: number;
      findingPeople: number;
      engagingInsights: number;
      buildingRelationships: number;
    } | null;
    trend7d: { trend: string; overallChange: number } | null;
    trend30d: { trend: string; overallChange: number } | null;
    recommendations: Array<{
      priority: string;
      title: string;
      description: string;
      impact: string;
      actions: string[];
    }>;
    industryRank?: number;
    networkRank?: number;
  }>({
    queryKey: ['/api/linkedin/advanced/ssi', WORKSPACE_ID, 'demo-account'],
  });

  const updateReplyConfigMutation = useMutation({
    mutationFn: (config: any) =>
      apiRequest(`/api/linkedin/advanced/reply-detection/config/${WORKSPACE_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/reply-detection/config'] });
      toast({ title: 'Reply detection settings updated' });
    },
  });

  const addBlacklistMutation = useMutation({
    mutationFn: (entry: any) =>
      apiRequest(`/api/linkedin/advanced/blacklist/${WORKSPACE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/blacklist'] });
      setNewBlacklistEntry({ type: 'profile', value: '', reason: '' });
      toast({ title: 'Added to blacklist' });
    },
  });

  const removeBlacklistMutation = useMutation({
    mutationFn: (entryId: string) =>
      apiRequest(`/api/linkedin/advanced/blacklist/${WORKSPACE_ID}/${entryId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/blacklist'] });
      toast({ title: 'Removed from blacklist' });
    },
  });

  const updateDedupConfigMutation = useMutation({
    mutationFn: (config: any) =>
      apiRequest(`/api/linkedin/advanced/deduplication/${WORKSPACE_ID}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/deduplication'] });
      toast({ title: 'Deduplication settings updated' });
    },
  });

  const createABTestMutation = useMutation({
    mutationFn: (test: any) =>
      apiRequest(`/api/linkedin/advanced/ab-tests/${WORKSPACE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/ab-tests'] });
      setTestName('');
      setNewTestVariant({ name: '', content: '' });
      toast({ title: 'A/B test created' });
    },
  });

  const startABTestMutation = useMutation({
    mutationFn: (testId: string) =>
      apiRequest(`/api/linkedin/advanced/ab-tests/${WORKSPACE_ID}/${testId}/start`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/ab-tests'] });
      toast({ title: 'A/B test started' });
    },
  });

  const pauseABTestMutation = useMutation({
    mutationFn: (testId: string) =>
      apiRequest(`/api/linkedin/advanced/ab-tests/${WORKSPACE_ID}/${testId}/pause`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/ab-tests'] });
      toast({ title: 'A/B test paused' });
    },
  });

  const getBlacklistIcon = (type: string) => {
    switch (type) {
      case 'profile': return <User className="h-4 w-4" />;
      case 'company': return <Building className="h-4 w-4" />;
      case 'email_domain': return <Mail className="h-4 w-4" />;
      case 'keyword': return <Search className="h-4 w-4" />;
      default: return <Ban className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <ArrowUp className="h-4 w-4 text-green-500" />;
      case 'declining': return <ArrowDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <SophiaHeader showIntegrations={false} />

      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">LinkedIn Optimization</h1>
          <p className="text-muted-foreground">
            Advanced features for reply detection, A/B testing, blacklists, and SSI tracking
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="reply-detection" data-testid="tab-reply-detection">
              <Reply className="h-4 w-4 mr-2" />
              Reply Detection
            </TabsTrigger>
            <TabsTrigger value="ab-testing" data-testid="tab-ab-testing">
              <FlaskConical className="h-4 w-4 mr-2" />
              A/B Testing
            </TabsTrigger>
            <TabsTrigger value="blacklist" data-testid="tab-blacklist">
              <Ban className="h-4 w-4 mr-2" />
              Blacklist
            </TabsTrigger>
            <TabsTrigger value="ssi" data-testid="tab-ssi">
              <TrendingUp className="h-4 w-4 mr-2" />
              SSI Tracker
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reply-detection" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{replyStats?.totalTracked || 0}</p>
                    <p className="text-sm text-muted-foreground">Messages Tracked</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600">{replyStats?.replied || 0}</p>
                    <p className="text-sm text-muted-foreground">Replies Received</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600">{replyStats?.replyRate?.toFixed(1) || 0}%</p>
                    <p className="text-sm text-muted-foreground">Reply Rate</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-purple-600">{replyStats?.positiveReplies || 0}</p>
                    <p className="text-sm text-muted-foreground">Positive Replies</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Reply Detection Settings</CardTitle>
                <CardDescription>Configure how sequences respond to prospect replies</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Reply Detection</Label>
                    <p className="text-sm text-muted-foreground">Monitor inbox for prospect replies</p>
                  </div>
                  <Switch
                    checked={replyConfig?.enabled ?? true}
                    onCheckedChange={(enabled) => updateReplyConfigMutation.mutate({ enabled })}
                    data-testid="switch-reply-enabled"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Stop Sequence on Reply</Label>
                    <p className="text-sm text-muted-foreground">Automatically pause sequence when reply detected</p>
                  </div>
                  <Switch
                    checked={replyConfig?.stopSequenceOnReply ?? true}
                    onCheckedChange={(stopSequenceOnReply) => updateReplyConfigMutation.mutate({ stopSequenceOnReply })}
                    data-testid="switch-stop-on-reply"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notify on Reply</Label>
                    <p className="text-sm text-muted-foreground">Send notification when reply is detected</p>
                  </div>
                  <Switch
                    checked={replyConfig?.notifyOnReply ?? true}
                    onCheckedChange={(notifyOnReply) => updateReplyConfigMutation.mutate({ notifyOnReply })}
                    data-testid="switch-notify-reply"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-tag Replied Contacts</Label>
                    <p className="text-sm text-muted-foreground">Automatically tag contacts who reply</p>
                  </div>
                  <Switch
                    checked={replyConfig?.autoTagReplied ?? true}
                    onCheckedChange={(autoTagReplied) => updateReplyConfigMutation.mutate({ autoTagReplied })}
                    data-testid="switch-auto-tag"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Reply Detection Window (hours)</Label>
                  <Select
                    value={String(replyConfig?.replyWindow || 72)}
                    onValueChange={(value) => updateReplyConfigMutation.mutate({ replyWindow: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="select-reply-window">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                      <SelectItem value="72">72 hours</SelectItem>
                      <SelectItem value="168">1 week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reply Sentiment Breakdown</CardTitle>
                <CardDescription>Analysis of received replies</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{replyStats?.positiveReplies || 0}</p>
                    <p className="text-sm text-muted-foreground">Positive</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">{replyStats?.neutralReplies || 0}</p>
                    <p className="text-sm text-muted-foreground">Neutral</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{replyStats?.negativeReplies || 0}</p>
                    <p className="text-sm text-muted-foreground">Negative</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ab-testing" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Create A/B Test</CardTitle>
                <CardDescription>Test different message variations to optimize performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Test Name</Label>
                    <Input
                      placeholder="e.g., Connection Note Test"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      data-testid="input-test-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Test Type</Label>
                    <Select value={testType} onValueChange={setTestType}>
                      <SelectTrigger data-testid="select-test-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="connection_note">Connection Note</SelectItem>
                        <SelectItem value="message">Follow-up Message</SelectItem>
                        <SelectItem value="inmail_subject">InMail Subject</SelectItem>
                        <SelectItem value="inmail_body">InMail Body</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Variant A (Control)</Label>
                  <Textarea
                    placeholder="Enter the control message content..."
                    value={newTestVariant.content}
                    onChange={(e) => setNewTestVariant({ ...newTestVariant, content: e.target.value })}
                    data-testid="input-variant-a"
                  />
                </div>

                <Button
                  onClick={() => {
                    if (testName && newTestVariant.content) {
                      createABTestMutation.mutate({
                        campaignId: 'demo-campaign',
                        name: testName,
                        testType,
                        variants: [
                          { name: 'Control', content: newTestVariant.content, weight: 50, isControl: true },
                          { name: 'Variant B', content: 'Alternative message content', weight: 50, isControl: false },
                        ],
                      });
                    }
                  }}
                  disabled={!testName || !newTestVariant.content}
                  data-testid="button-create-test"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create A/B Test
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active A/B Tests</CardTitle>
                <CardDescription>Monitor and manage your message experiments</CardDescription>
              </CardHeader>
              <CardContent>
                {abTests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FlaskConical className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No A/B tests yet</p>
                    <p className="text-sm">Create your first test above</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {abTests.map((test: any) => (
                      <div key={test.id} className="border rounded-lg p-4" data-testid={`test-${test.id}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-medium">{test.name}</h4>
                            <p className="text-sm text-muted-foreground">{test.testType}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={test.status === 'running' ? 'default' : 'secondary'}>
                              {test.status}
                            </Badge>
                            {test.status === 'draft' && (
                              <Button
                                size="sm"
                                onClick={() => startABTestMutation.mutate(test.id)}
                                data-testid={`button-start-${test.id}`}
                              >
                                <Play className="h-4 w-4 mr-1" />
                                Start
                              </Button>
                            )}
                            {test.status === 'running' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => pauseABTestMutation.mutate(test.id)}
                                data-testid={`button-pause-${test.id}`}
                              >
                                <Pause className="h-4 w-4 mr-1" />
                                Pause
                              </Button>
                            )}
                            {test.winnerId && (
                              <Badge variant="default" className="bg-green-500">
                                <Trophy className="h-3 w-3 mr-1" />
                                Winner Found
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {test.variants?.map((variant: any) => (
                            <div
                              key={variant.id}
                              className={`p-3 rounded-lg border ${
                                variant.id === test.winnerId ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{variant.name}</span>
                                {variant.isControl && <Badge variant="outline">Control</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{variant.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blacklist" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{blacklistStats?.total || 0}</p>
                    <p className="text-sm text-muted-foreground">Total Blocked</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{blacklistStats?.byType?.profile || 0}</p>
                    <p className="text-sm text-muted-foreground">Profiles</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{blacklistStats?.byType?.company || 0}</p>
                    <p className="text-sm text-muted-foreground">Companies</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold">{blacklistStats?.recentlyAdded || 0}</p>
                    <p className="text-sm text-muted-foreground">Added This Week</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Add to Blacklist</CardTitle>
                <CardDescription>Block profiles, companies, domains, or keywords</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={newBlacklistEntry.type}
                      onValueChange={(type) => setNewBlacklistEntry({ ...newBlacklistEntry, type })}
                    >
                      <SelectTrigger data-testid="select-blacklist-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profile">LinkedIn Profile</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                        <SelectItem value="email_domain">Email Domain</SelectItem>
                        <SelectItem value="keyword">Keyword</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input
                      placeholder={
                        newBlacklistEntry.type === 'profile' ? 'LinkedIn URL or username' :
                        newBlacklistEntry.type === 'company' ? 'Company name' :
                        newBlacklistEntry.type === 'email_domain' ? 'example.com' :
                        'Keyword to block'
                      }
                      value={newBlacklistEntry.value}
                      onChange={(e) => setNewBlacklistEntry({ ...newBlacklistEntry, value: e.target.value })}
                      data-testid="input-blacklist-value"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reason (optional)</Label>
                    <Input
                      placeholder="Why blocked?"
                      value={newBlacklistEntry.reason}
                      onChange={(e) => setNewBlacklistEntry({ ...newBlacklistEntry, reason: e.target.value })}
                      data-testid="input-blacklist-reason"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => addBlacklistMutation.mutate(newBlacklistEntry)}
                  disabled={!newBlacklistEntry.value}
                  data-testid="button-add-blacklist"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Blacklist
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deduplication Settings</CardTitle>
                <CardDescription>Prevent contacting the same person multiple times</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Deduplication</Label>
                    <p className="text-sm text-muted-foreground">Check for duplicates before adding to campaigns</p>
                  </div>
                  <Switch
                    checked={dedupConfig?.enabled ?? true}
                    onCheckedChange={(enabled) => updateDedupConfigMutation.mutate({ enabled })}
                    data-testid="switch-dedup-enabled"
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center justify-between">
                    <Label>Check LinkedIn URL</Label>
                    <Switch
                      checked={dedupConfig?.checkLinkedInUrl ?? true}
                      onCheckedChange={(checkLinkedInUrl) => updateDedupConfigMutation.mutate({ checkLinkedInUrl })}
                      data-testid="switch-check-linkedin"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Check Email</Label>
                    <Switch
                      checked={dedupConfig?.checkEmail ?? true}
                      onCheckedChange={(checkEmail) => updateDedupConfigMutation.mutate({ checkEmail })}
                      data-testid="switch-check-email"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Check Name + Company</Label>
                    <Switch
                      checked={dedupConfig?.checkName ?? false}
                      onCheckedChange={(checkName) => updateDedupConfigMutation.mutate({ checkName })}
                      data-testid="switch-check-name"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cooldown Period (days)</Label>
                    <Select
                      value={String(dedupConfig?.cooldownDays || 30)}
                      onValueChange={(value) => updateDedupConfigMutation.mutate({ cooldownDays: parseInt(value) })}
                    >
                      <SelectTrigger data-testid="select-cooldown">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="60">60 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Campaigns per Contact</Label>
                    <Select
                      value={String(dedupConfig?.maxCampaignsPerContact || 1)}
                      onValueChange={(value) => updateDedupConfigMutation.mutate({ maxCampaignsPerContact: parseInt(value) })}
                    >
                      <SelectTrigger data-testid="select-max-campaigns">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 campaign</SelectItem>
                        <SelectItem value="2">2 campaigns</SelectItem>
                        <SelectItem value="3">3 campaigns</SelectItem>
                        <SelectItem value="5">5 campaigns</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Blacklist Entries</CardTitle>
                <CardDescription>View and manage blocked items</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {blacklist.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Ban className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No blacklist entries yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {blacklist.map((entry: any) => (
                        <div
                          key={entry.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`blacklist-${entry.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {getBlacklistIcon(entry.type)}
                            <div>
                              <p className="font-medium">{entry.value}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Badge variant="outline">{entry.type}</Badge>
                                {entry.reason && <span>{entry.reason}</span>}
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeBlacklistMutation.mutate(entry.id)}
                            data-testid={`button-remove-${entry.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ssi" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="md:col-span-1">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-4xl font-bold">{ssiData?.current?.overall || '--'}</p>
                    <p className="text-sm text-muted-foreground">Overall SSI</p>
                    {ssiData?.trend30d && (
                      <div className="flex items-center justify-center gap-1 mt-2">
                        {getTrendIcon(ssiData.trend30d.trend)}
                        <span className={`text-sm ${
                          ssiData.trend30d.overallChange > 0 ? 'text-green-600' :
                          ssiData.trend30d.overallChange < 0 ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {ssiData.trend30d.overallChange > 0 ? '+' : ''}{ssiData.trend30d.overallChange}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold">{ssiData?.current?.professionalBrand || '--'}</p>
                    <p className="text-xs text-muted-foreground">Professional Brand</p>
                    <Progress value={(ssiData?.current?.professionalBrand || 0) * 4} className="h-1 mt-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Users className="h-5 w-5 text-green-500" />
                    </div>
                    <p className="text-2xl font-bold">{ssiData?.current?.findingPeople || '--'}</p>
                    <p className="text-xs text-muted-foreground">Finding People</p>
                    <Progress value={(ssiData?.current?.findingPeople || 0) * 4} className="h-1 mt-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <MessageSquare className="h-5 w-5 text-purple-500" />
                    </div>
                    <p className="text-2xl font-bold">{ssiData?.current?.engagingInsights || '--'}</p>
                    <p className="text-xs text-muted-foreground">Engaging Insights</p>
                    <Progress value={(ssiData?.current?.engagingInsights || 0) * 4} className="h-1 mt-2" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Handshake className="h-5 w-5 text-orange-500" />
                    </div>
                    <p className="text-2xl font-bold">{ssiData?.current?.buildingRelationships || '--'}</p>
                    <p className="text-xs text-muted-foreground">Building Relationships</p>
                    <Progress value={(ssiData?.current?.buildingRelationships || 0) * 4} className="h-1 mt-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {ssiData?.industryRank && (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Industry Rank</p>
                        <p className="text-2xl font-bold">Top {ssiData.industryRank}%</p>
                      </div>
                      <Badge variant="outline">Industry</Badge>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Network Rank</p>
                        <p className="text-2xl font-bold">Top {ssiData.networkRank}%</p>
                      </div>
                      <Badge variant="outline">Network</Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>AI Recommendations</CardTitle>
                <CardDescription>Personalized suggestions to improve your Social Selling Index</CardDescription>
              </CardHeader>
              <CardContent>
                {!ssiData?.recommendations || ssiData.recommendations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No SSI data available</p>
                    <p className="text-sm">Connect your LinkedIn account to track SSI</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {ssiData.recommendations.map((rec: any, index: number) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              rec.priority === 'high' ? 'destructive' :
                              rec.priority === 'medium' ? 'default' : 'secondary'
                            }>
                              {rec.priority} priority
                            </Badge>
                            <h4 className="font-medium">{rec.title}</h4>
                          </div>
                          <span className="text-sm text-green-600">{rec.impact}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{rec.description}</p>
                        <div className="space-y-1">
                          {rec.actions.map((action: string, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              {action}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
