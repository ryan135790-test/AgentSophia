import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ThumbsUp, 
  MessageCircle, 
  Award, 
  UserPlus, 
  Play, 
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { SophiaHeader } from "@/components/agent-sophia/sophia-header";

interface EngagementSettings {
  workspaceId: string;
  dailyLimits: {
    likes: number;
    comments: number;
    endorsements: number;
    follows: number;
  };
  delays: {
    minDelay: number;
    maxDelay: number;
  };
  commentTemplates: string[];
  enabled: boolean;
  activeHours: {
    start: number;
    end: number;
  };
}

interface EngagementStats {
  today: {
    likes: number;
    comments: number;
    endorsements: number;
    follows: number;
  };
  limits: {
    likes: number;
    comments: number;
    endorsements: number;
    follows: number;
  };
  remaining: {
    likes: number;
    comments: number;
    endorsements: number;
    follows: number;
  };
  totalActions: number;
  successRate: number;
}

interface ActionType {
  id: string;
  name: string;
  description: string;
  defaultLimit: number;
}

interface ActionLog {
  id: string;
  type: string;
  targetUrl: string;
  targetName: string;
  status: 'success' | 'failed';
  performedAt: string;
  error?: string;
}

export default function LinkedInEngagement() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("like_post");
  const [newTemplate, setNewTemplate] = useState("");

  const { data: settings } = useQuery<EngagementSettings>({
    queryKey: ['/api/linkedin/advanced/engagement/settings', workspaceId],
  });

  const { data: stats } = useQuery<EngagementStats>({
    queryKey: ['/api/linkedin/advanced/engagement/stats', workspaceId],
  });

  const { data: actionTypes } = useQuery<{ actionTypes: ActionType[] }>({
    queryKey: ['/api/linkedin/advanced/engagement/actions-types'],
  });

  const { data: actionLogs = [] } = useQuery<ActionLog[]>({
    queryKey: ['/api/linkedin/advanced/engagement/logs', workspaceId],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (newSettings: Partial<EngagementSettings>) =>
      apiRequest(`/api/linkedin/advanced/engagement/settings/${workspaceId}`, {
        method: 'PUT',
        body: JSON.stringify(newSettings),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/engagement/settings', workspaceId] });
      toast({ title: "Settings updated" });
    },
  });

  const performActionMutation = useMutation({
    mutationFn: ({ action, targetUrl, template }: { action: string; targetUrl: string; template?: string }) =>
      apiRequest(`/api/linkedin/advanced/engagement/perform/${workspaceId}`, {
        method: 'POST',
        body: JSON.stringify({ action, targetUrl, template }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/engagement/stats', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/engagement/logs', workspaceId] });
      toast({ title: data.message || "Action performed" });
      setTargetUrl("");
    },
    onError: (error: any) => {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
    },
  });

  const addTemplateMutation = useMutation({
    mutationFn: (template: string) =>
      apiRequest(`/api/linkedin/advanced/engagement/templates/${workspaceId}`, {
        method: 'POST',
        body: JSON.stringify({ template }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin/advanced/engagement/settings', workspaceId] });
      toast({ title: "Template added" });
      setNewTemplate("");
    },
  });

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'like_post': return <ThumbsUp className="h-5 w-5 text-blue-500" />;
      case 'comment_post': return <MessageCircle className="h-5 w-5 text-green-500" />;
      case 'endorse_skill': return <Award className="h-5 w-5 text-yellow-500" />;
      case 'follow_profile': return <UserPlus className="h-5 w-5 text-purple-500" />;
      default: return <Zap className="h-5 w-5" />;
    }
  };

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100);
  };

  return (
    <div className="min-h-screen bg-background">
      <SophiaHeader />
      
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-bold">Post Engagement Actions</h1>
        <p className="text-muted-foreground">Automate likes, comments, endorsements, and follows with safety controls</p>
      </div>

      <div className="container mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <ThumbsUp className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-likes">
                    {stats?.today.likes || 0}/{stats?.limits.likes || 30}
                  </p>
                  <p className="text-sm text-muted-foreground">Likes Today</p>
                </div>
              </div>
              <Progress 
                value={getUsagePercentage(stats?.today.likes || 0, stats?.limits.likes || 30)} 
                className="mt-2 h-1" 
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-comments">
                    {stats?.today.comments || 0}/{stats?.limits.comments || 10}
                  </p>
                  <p className="text-sm text-muted-foreground">Comments Today</p>
                </div>
              </div>
              <Progress 
                value={getUsagePercentage(stats?.today.comments || 0, stats?.limits.comments || 10)} 
                className="mt-2 h-1" 
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-endorsements">
                    {stats?.today.endorsements || 0}/{stats?.limits.endorsements || 15}
                  </p>
                  <p className="text-sm text-muted-foreground">Endorsements Today</p>
                </div>
              </div>
              <Progress 
                value={getUsagePercentage(stats?.today.endorsements || 0, stats?.limits.endorsements || 15)} 
                className="mt-2 h-1" 
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <UserPlus className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold" data-testid="stat-follows">
                    {stats?.today.follows || 0}/{stats?.limits.follows || 20}
                  </p>
                  <p className="text-sm text-muted-foreground">Follows Today</p>
                </div>
              </div>
              <Progress 
                value={getUsagePercentage(stats?.today.follows || 0, stats?.limits.follows || 20)} 
                className="mt-2 h-1" 
              />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="actions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="actions" data-testid="tab-actions">
              <Zap className="h-4 w-4 mr-2" />
              Quick Actions
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">
              <MessageCircle className="h-4 w-4 mr-2" />
              Comment Templates
            </TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">
              <Activity className="h-4 w-4 mr-2" />
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="actions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Perform Engagement Action</CardTitle>
                <CardDescription>Select an action and provide the target LinkedIn URL</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {actionTypes?.actionTypes.map((action) => (
                    <div
                      key={action.id}
                      onClick={() => setSelectedAction(action.id)}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedAction === action.id
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-primary/50'
                      }`}
                      data-testid={`action-type-${action.id}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getActionIcon(action.id)}
                        <h4 className="font-medium">{action.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                      <p className="text-xs mt-2 text-muted-foreground">
                        Remaining: {stats?.remaining?.[action.id.replace('_post', 's').replace('_skill', 's').replace('_profile', 's') as keyof typeof stats.remaining] || action.defaultLimit}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label>Target URL</Label>
                  <Input
                    placeholder={
                      selectedAction === 'like_post' || selectedAction === 'comment_post'
                        ? 'https://www.linkedin.com/posts/username_activity-12345/'
                        : 'https://www.linkedin.com/in/username/'
                    }
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    data-testid="input-target-url"
                  />
                </div>

                {selectedAction === 'comment_post' && settings?.commentTemplates && settings.commentTemplates.length > 0 && (
                  <div className="space-y-2">
                    <Label>Comment Template (optional)</Label>
                    <Select>
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Select a template or leave blank for random" />
                      </SelectTrigger>
                      <SelectContent>
                        {settings.commentTemplates.map((template, i) => (
                          <SelectItem key={i} value={template}>{template.substring(0, 50)}...</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Button
                  onClick={() => performActionMutation.mutate({ action: selectedAction, targetUrl })}
                  disabled={!targetUrl || performActionMutation.isPending}
                  data-testid="button-perform-action"
                >
                  {performActionMutation.isPending ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-2" />
                  )}
                  Perform Action
                </Button>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-orange-700 dark:text-orange-400">Safety Controls Active</h4>
                    <p className="text-sm text-orange-600 dark:text-orange-300">
                      Actions are rate-limited with randomized delays to mimic human behavior and protect your account.
                      Daily limits reset at midnight UTC.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Daily Limits</CardTitle>
                <CardDescription>Configure maximum actions per day to stay within safe limits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <ThumbsUp className="h-4 w-4 text-blue-500" />
                        Likes per Day
                      </Label>
                      <span className="text-sm font-medium">{settings?.dailyLimits?.likes || 30}</span>
                    </div>
                    <Slider
                      value={[settings?.dailyLimits?.likes || 30]}
                      onValueChange={([value]) => 
                        updateSettingsMutation.mutate({ 
                          dailyLimits: { ...settings?.dailyLimits, likes: value } as any
                        })
                      }
                      max={50}
                      min={5}
                      step={5}
                      data-testid="slider-likes"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-green-500" />
                        Comments per Day
                      </Label>
                      <span className="text-sm font-medium">{settings?.dailyLimits?.comments || 10}</span>
                    </div>
                    <Slider
                      value={[settings?.dailyLimits?.comments || 10]}
                      onValueChange={([value]) => 
                        updateSettingsMutation.mutate({ 
                          dailyLimits: { ...settings?.dailyLimits, comments: value } as any
                        })
                      }
                      max={20}
                      min={2}
                      step={2}
                      data-testid="slider-comments"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-yellow-500" />
                        Endorsements per Day
                      </Label>
                      <span className="text-sm font-medium">{settings?.dailyLimits?.endorsements || 15}</span>
                    </div>
                    <Slider
                      value={[settings?.dailyLimits?.endorsements || 15]}
                      onValueChange={([value]) => 
                        updateSettingsMutation.mutate({ 
                          dailyLimits: { ...settings?.dailyLimits, endorsements: value } as any
                        })
                      }
                      max={30}
                      min={5}
                      step={5}
                      data-testid="slider-endorsements"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-purple-500" />
                        Follows per Day
                      </Label>
                      <span className="text-sm font-medium">{settings?.dailyLimits?.follows || 20}</span>
                    </div>
                    <Slider
                      value={[settings?.dailyLimits?.follows || 20]}
                      onValueChange={([value]) => 
                        updateSettingsMutation.mutate({ 
                          dailyLimits: { ...settings?.dailyLimits, follows: value } as any
                        })
                      }
                      max={40}
                      min={5}
                      step={5}
                      data-testid="slider-follows"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Delay Settings</CardTitle>
                <CardDescription>Configure random delays between actions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Minimum Delay (seconds)</Label>
                    <Input
                      type="number"
                      value={settings?.delays?.minDelay || 30}
                      onChange={(e) => 
                        updateSettingsMutation.mutate({ 
                          delays: { ...settings?.delays, minDelay: parseInt(e.target.value) } as any
                        })
                      }
                      data-testid="input-min-delay"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maximum Delay (seconds)</Label>
                    <Input
                      type="number"
                      value={settings?.delays?.maxDelay || 120}
                      onChange={(e) => 
                        updateSettingsMutation.mutate({ 
                          delays: { ...settings?.delays, maxDelay: parseInt(e.target.value) } as any
                        })
                      }
                      data-testid="input-max-delay"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Hours</CardTitle>
                <CardDescription>Only perform actions during business hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Active Hours</Label>
                    <p className="text-sm text-muted-foreground">Limit actions to specific hours</p>
                  </div>
                  <Switch
                    checked={settings?.enabled ?? true}
                    onCheckedChange={(checked) => updateSettingsMutation.mutate({ enabled: checked })}
                    data-testid="switch-active-hours"
                  />
                </div>
                {settings?.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Hour (24h)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={settings?.activeHours?.start || 9}
                        onChange={(e) => 
                          updateSettingsMutation.mutate({ 
                            activeHours: { ...settings?.activeHours, start: parseInt(e.target.value) } as any
                          })
                        }
                        data-testid="input-start-hour"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Hour (24h)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={23}
                        value={settings?.activeHours?.end || 18}
                        onChange={(e) => 
                          updateSettingsMutation.mutate({ 
                            activeHours: { ...settings?.activeHours, end: parseInt(e.target.value) } as any
                          })
                        }
                        data-testid="input-end-hour"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Comment Templates</CardTitle>
                <CardDescription>Create templates for automated comments - use {'{name}'} for personalization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    placeholder="Great insights, {name}! Thanks for sharing this valuable perspective."
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    data-testid="input-new-template"
                  />
                  <Button
                    onClick={() => addTemplateMutation.mutate(newTemplate)}
                    disabled={!newTemplate || addTemplateMutation.isPending}
                    data-testid="button-add-template"
                  >
                    Add Template
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Existing Templates</Label>
                  {settings?.commentTemplates && settings.commentTemplates.length > 0 ? (
                    <div className="space-y-2">
                      {settings.commentTemplates.map((template, i) => (
                        <div key={i} className="p-3 bg-muted rounded-lg text-sm" data-testid={`template-${i}`}>
                          {template}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No templates yet. Add one above.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log</CardTitle>
                <CardDescription>Recent engagement actions performed</CardDescription>
              </CardHeader>
              <CardContent>
                {actionLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No activity yet</p>
                    <p className="text-sm">Perform some engagement actions to see them here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {actionLogs.map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          data-testid={`log-${log.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {getActionIcon(log.type)}
                            <div>
                              <p className="font-medium text-sm">{log.targetName}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(log.performedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {log.status === 'success' ? (
                              <Badge className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
