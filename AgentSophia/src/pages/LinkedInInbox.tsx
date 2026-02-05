import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLinkedInAccount } from '@/contexts/LinkedInAccountContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  MessageSquare, 
  Bot, 
  User, 
  CheckCircle2, 
  XCircle, 
  RefreshCw,
  Send,
  Clock,
  AlertTriangle,
  Zap,
  Settings,
  Inbox,
  ThumbsUp,
  ThumbsDown,
  Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SophiaHeader } from "@/components/agent-sophia/sophia-header";

interface InboxMessage {
  id: string;
  senderName: string;
  senderProfileUrl: string;
  content: string;
  receivedAt: string;
  isRead: boolean;
  classification?: {
    sentiment: 'positive' | 'neutral' | 'negative';
    intent: string;
    priority: 'high' | 'medium' | 'low';
    isHotLead: boolean;
    requiresApproval: boolean;
  };
}

interface Draft {
  id: string;
  messageId: string;
  content: string;
  tone: string;
  status: 'pending' | 'approved' | 'rejected' | 'sent';
  generatedAt: string;
}

interface InboxSettings {
  mode: 'manual' | 'copilot' | 'autopilot';
  autoReplyDelay: number;
  responseStyle: string;
  includeSignature: boolean;
  signature: string;
  autoClassify: boolean;
  prioritizeHotLeads: boolean;
  excludeKeywords: string[];
  maxAutoRepliesPerDay: number;
  requireApprovalForNegative: boolean;
  notifyOnHighPriority: boolean;
}

interface InboxStats {
  totalMessages: number;
  unreadCount: number;
  pendingDrafts: number;
  sentToday: number;
  hotLeads: number;
  autoRepliesRemaining: number;
}

export default function LinkedInInbox() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const { currentAccountId } = useLinkedInAccount();
  const workspaceId = currentWorkspace?.id || '';
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [selectedTone, setSelectedTone] = useState("professional");

  const buildParams = (base: string) => {
    const params = new URLSearchParams();
    if (workspaceId) params.set('workspace_id', workspaceId);
    if (currentAccountId) params.set('account_id', currentAccountId);
    return `${base}?${params.toString()}`;
  };

  const { data: settings } = useQuery<InboxSettings>({
    queryKey: ['/api/linkedin/advanced/inbox/settings', workspaceId, currentAccountId],
    queryFn: () => fetch(buildParams('/api/linkedin/advanced/inbox/settings')).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const { data: messages = [] } = useQuery<InboxMessage[]>({
    queryKey: ['/api/linkedin/advanced/inbox/messages', workspaceId, currentAccountId],
    queryFn: () => fetch(buildParams('/api/linkedin/advanced/inbox/messages')).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const { data: drafts = [] } = useQuery<Draft[]>({
    queryKey: ['/api/linkedin/advanced/inbox/drafts', workspaceId, currentAccountId],
    queryFn: () => fetch(buildParams('/api/linkedin/advanced/inbox/drafts')).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const { data: stats } = useQuery<InboxStats>({
    queryKey: ['/api/linkedin/advanced/inbox/stats', workspaceId, currentAccountId],
    queryFn: () => fetch(buildParams('/api/linkedin/advanced/inbox/stats')).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const { data: modes } = useQuery<{ modes: { id: string; name: string; description: string; features: string[] }[] }>({
    queryKey: ['/api/linkedin/advanced/inbox/modes'],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: Partial<InboxSettings>) =>
      apiRequest(`/api/linkedin/advanced/inbox/settings/${workspaceId}`, {
        method: 'PUT',
        body: JSON.stringify(newSettings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/inbox/settings', workspaceId, currentAccountId] });
      toast({ title: "Settings updated" });
    },
  });

  const generateDraftMutation = useMutation({
    mutationFn: (messageId: string) =>
      apiRequest(`/api/linkedin/advanced/inbox/drafts/${workspaceId}/${messageId}/generate`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/inbox/drafts', workspaceId, currentAccountId] });
      toast({ title: "Draft generated by Sophia" });
    },
  });

  const approveDraftMutation = useMutation({
    mutationFn: (draftId: string) =>
      apiRequest(`/api/linkedin/advanced/inbox/drafts/${workspaceId}/${draftId}/approve`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/inbox/drafts', workspaceId, currentAccountId] });
      toast({ title: "Draft approved and sent" });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: (draftId: string) =>
      apiRequest(`/api/linkedin/advanced/inbox/drafts/${workspaceId}/${draftId}/reject`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/inbox/drafts', workspaceId, currentAccountId] });
      toast({ title: "Draft rejected" });
    },
  });

  const regenerateDraftMutation = useMutation({
    mutationFn: ({ draftId, tone }: { draftId: string; tone: string }) =>
      apiRequest(`/api/linkedin/advanced/inbox/drafts/${workspaceId}/${draftId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({ tone }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/inbox/drafts', workspaceId, currentAccountId] });
      toast({ title: "Draft regenerated with new tone" });
    },
  });

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-500';
      case 'negative': return 'text-red-500';
      default: return 'text-yellow-500';
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive">High Priority</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      default: return <Badge variant="outline">Low</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SophiaHeader />
      
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold">AI Inbox Manager</h1>
        <p className="text-muted-foreground">Manage LinkedIn messages with Sophia's AI assistance</p>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Inbox className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-total-messages">{stats?.totalMessages || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Messages</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-unread">{stats?.unreadCount || 0}</p>
                  <p className="text-sm text-muted-foreground">Unread</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-pending-drafts">{stats?.pendingDrafts || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending Drafts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Zap className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-hot-leads">{stats?.hotLeads || 0}</p>
                  <p className="text-sm text-muted-foreground">Hot Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inbox" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inbox" data-testid="tab-inbox">
              <Inbox className="h-4 w-4 mr-2" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="drafts" data-testid="tab-drafts">
              <MessageSquare className="h-4 w-4 mr-2" />
              Drafts ({drafts.filter(d => d.status === 'pending').length})
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg">Messages</CardTitle>
                  <CardDescription>Click to view and respond</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    {messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No messages yet</p>
                        <p className="text-sm">Connect your LinkedIn account to sync messages</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            onClick={() => setSelectedMessage(message)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              selectedMessage?.id === message.id
                                ? 'bg-primary/10 border border-primary'
                                : 'hover:bg-muted'
                            } ${!message.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
                            data-testid={`message-item-${message.id}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <User className="h-8 w-8 p-1.5 bg-muted rounded-full" />
                                <div>
                                  <p className="font-medium text-sm">{message.senderName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(message.receivedAt).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              {message.classification?.isHotLead && (
                                <Badge variant="destructive" className="text-xs">Hot</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {message.content}
                            </p>
                            {message.classification && (
                              <div className="flex items-center gap-2 mt-2">
                                {getPriorityBadge(message.classification.priority)}
                                <span className={`text-xs ${getSentimentColor(message.classification.sentiment)}`}>
                                  {message.classification.sentiment}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Message Details</CardTitle>
                  <CardDescription>
                    {selectedMessage ? `From ${selectedMessage.senderName}` : 'Select a message to view'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedMessage ? (
                    <div className="space-y-4">
                      <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <User className="h-6 w-6" />
                            <span className="font-medium">{selectedMessage.senderName}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(selectedMessage.receivedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{selectedMessage.content}</p>
                      </div>

                      {selectedMessage.classification && (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Sentiment</p>
                            <p className={`font-medium ${getSentimentColor(selectedMessage.classification.sentiment)}`}>
                              {selectedMessage.classification.sentiment}
                            </p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Intent</p>
                            <p className="font-medium">{selectedMessage.classification.intent}</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Priority</p>
                            <p className="font-medium">{selectedMessage.classification.priority}</p>
                          </div>
                        </div>
                      )}

                      <Separator />

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            AI Response
                          </h4>
                          <Button
                            size="sm"
                            onClick={() => generateDraftMutation.mutate(selectedMessage.id)}
                            disabled={generateDraftMutation.isPending}
                            data-testid="button-generate-draft"
                          >
                            {generateDraftMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Bot className="h-4 w-4 mr-2" />
                            )}
                            Generate Draft
                          </Button>
                        </div>

                        {drafts.filter(d => d.messageId === selectedMessage.id && d.status === 'pending').map((draft) => (
                          <div key={draft.id} className="border rounded-lg p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">{draft.tone} tone</Badge>
                              <span className="text-xs text-muted-foreground">
                                Generated {new Date(draft.generatedAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <Textarea
                              value={draft.content}
                              readOnly
                              className="min-h-[100px]"
                              data-testid={`draft-content-${draft.id}`}
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => approveDraftMutation.mutate(draft.id)}
                                disabled={approveDraftMutation.isPending}
                                data-testid={`button-approve-draft-${draft.id}`}
                              >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Approve & Send
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectDraftMutation.mutate(draft.id)}
                                disabled={rejectDraftMutation.isPending}
                                data-testid={`button-reject-draft-${draft.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject
                              </Button>
                              <Select value={selectedTone} onValueChange={setSelectedTone}>
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="professional">Professional</SelectItem>
                                  <SelectItem value="friendly">Friendly</SelectItem>
                                  <SelectItem value="casual">Casual</SelectItem>
                                  <SelectItem value="formal">Formal</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => regenerateDraftMutation.mutate({ draftId: draft.id, tone: selectedTone })}
                                disabled={regenerateDraftMutation.isPending}
                                data-testid={`button-regenerate-draft-${draft.id}`}
                              >
                                <RefreshCw className={`h-4 w-4 ${regenerateDraftMutation.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>Select a message to view details</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="drafts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Drafts</CardTitle>
                <CardDescription>Review and approve AI-generated responses</CardDescription>
              </CardHeader>
              <CardContent>
                {drafts.filter(d => d.status === 'pending').length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No pending drafts</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {drafts.filter(d => d.status === 'pending').map((draft) => (
                      <div key={draft.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge>{draft.tone} tone</Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(draft.generatedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm mb-3">{draft.content}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => approveDraftMutation.mutate(draft.id)}
                            data-testid={`button-approve-${draft.id}`}
                          >
                            <ThumbsUp className="h-4 w-4 mr-2" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rejectDraftMutation.mutate(draft.id)}
                            data-testid={`button-reject-${draft.id}`}
                          >
                            <ThumbsDown className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI Mode Selection</CardTitle>
                <CardDescription>Choose how Sophia handles your LinkedIn messages</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {modes?.modes.map((mode) => (
                    <div
                      key={mode.id}
                      onClick={() => updateSettingsMutation.mutate({ mode: mode.id as 'manual' | 'copilot' | 'autopilot' })}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        settings?.mode === mode.id
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-primary/50'
                      }`}
                      data-testid={`mode-${mode.id}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {mode.id === 'manual' && <User className="h-5 w-5" />}
                        {mode.id === 'copilot' && <Bot className="h-5 w-5 text-blue-500" />}
                        {mode.id === 'autopilot' && <Zap className="h-5 w-5 text-purple-500" />}
                        <h4 className="font-medium">{mode.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{mode.description}</p>
                      <ul className="text-xs space-y-1">
                        {mode.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Response Settings</CardTitle>
                <CardDescription>Configure how Sophia generates responses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Response Style</Label>
                    <Select
                      value={settings?.responseStyle || 'professional'}
                      onValueChange={(value) => updateSettingsMutation.mutate({ responseStyle: value })}
                    >
                      <SelectTrigger data-testid="select-response-style">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Auto-Replies per Day</Label>
                    <Select
                      value={String(settings?.maxAutoRepliesPerDay || 50)}
                      onValueChange={(value) => updateSettingsMutation.mutate({ maxAutoRepliesPerDay: parseInt(value) })}
                    >
                      <SelectTrigger data-testid="select-max-replies">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="150">150</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-classify Messages</Label>
                      <p className="text-sm text-muted-foreground">Automatically analyze sentiment and intent</p>
                    </div>
                    <Switch
                      checked={settings?.autoClassify ?? true}
                      onCheckedChange={(checked) => updateSettingsMutation.mutate({ autoClassify: checked })}
                      data-testid="switch-auto-classify"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Prioritize Hot Leads</Label>
                      <p className="text-sm text-muted-foreground">Move high-intent messages to the top</p>
                    </div>
                    <Switch
                      checked={settings?.prioritizeHotLeads ?? true}
                      onCheckedChange={(checked) => updateSettingsMutation.mutate({ prioritizeHotLeads: checked })}
                      data-testid="switch-prioritize-leads"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Require Approval for Negative Sentiment</Label>
                      <p className="text-sm text-muted-foreground">Always review responses to unhappy leads</p>
                    </div>
                    <Switch
                      checked={settings?.requireApprovalForNegative ?? true}
                      onCheckedChange={(checked) => updateSettingsMutation.mutate({ requireApprovalForNegative: checked })}
                      data-testid="switch-approval-negative"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Include Signature</Label>
                      <p className="text-sm text-muted-foreground">Add your signature to all responses</p>
                    </div>
                    <Switch
                      checked={settings?.includeSignature ?? true}
                      onCheckedChange={(checked) => updateSettingsMutation.mutate({ includeSignature: checked })}
                      data-testid="switch-signature"
                    />
                  </div>
                </div>

                {settings?.includeSignature && (
                  <div className="space-y-2">
                    <Label>Signature</Label>
                    <Textarea
                      value={settings?.signature || ''}
                      onChange={(e) => updateSettingsMutation.mutate({ signature: e.target.value })}
                      placeholder="Best regards,
Your Name"
                      data-testid="input-signature"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {settings?.mode === 'autopilot' && (
              <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-orange-700 dark:text-orange-400">Autopilot Mode Active</h4>
                      <p className="text-sm text-orange-600 dark:text-orange-300">
                        Sophia will automatically respond to messages. Negative sentiment messages will still require 
                        your approval. Daily limit: {settings?.maxAutoRepliesPerDay || 50} auto-replies.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
