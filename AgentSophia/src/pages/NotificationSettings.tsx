import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { apiRequest } from "@/lib/queryClient";
import { 
  Bell, 
  Smartphone, 
  MessageSquare, 
  Mail,
  Slack,
  Check,
  ExternalLink,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Users,
  Target,
  Calendar
} from "lucide-react";
import { SiSlack } from "react-icons/si";

interface NotificationChannel {
  id: string;
  name: string;
  icon: typeof Bell;
  connected: boolean;
  webhook?: string;
}

interface NotificationEvent {
  id: string;
  label: string;
  description: string;
  category: string;
  email: boolean;
  push: boolean;
  slack: boolean;
  teams: boolean;
}

export default function NotificationSettings() {
  const { session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [slackWebhook, setSlackWebhook] = useState('');
  const [teamsWebhook, setTeamsWebhook] = useState('');
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<NotificationEvent[]>([
    { id: 'new_lead', label: 'New Lead', description: 'When a new lead is added', category: 'leads', email: true, push: true, slack: true, teams: false },
    { id: 'lead_reply', label: 'Lead Reply', description: 'When a lead responds to outreach', category: 'leads', email: true, push: true, slack: true, teams: true },
    { id: 'deal_won', label: 'Deal Won', description: 'When a deal is marked as won', category: 'deals', email: true, push: true, slack: true, teams: true },
    { id: 'deal_lost', label: 'Deal Lost', description: 'When a deal is marked as lost', category: 'deals', email: false, push: false, slack: true, teams: false },
    { id: 'campaign_complete', label: 'Campaign Complete', description: 'When a campaign finishes sending', category: 'campaigns', email: true, push: false, slack: true, teams: false },
    { id: 'campaign_error', label: 'Campaign Error', description: 'When a campaign encounters an error', category: 'campaigns', email: true, push: true, slack: true, teams: true },
    { id: 'sophia_action', label: 'Sophia Action', description: 'When Sophia takes an autonomous action', category: 'ai', email: false, push: true, slack: true, teams: false },
    { id: 'sophia_approval', label: 'Approval Required', description: 'When Sophia needs your approval', category: 'ai', email: true, push: true, slack: true, teams: true },
    { id: 'meeting_scheduled', label: 'Meeting Scheduled', description: 'When a meeting is booked', category: 'meetings', email: true, push: true, slack: false, teams: false },
    { id: 'team_invite', label: 'Team Invite', description: 'When someone is invited to workspace', category: 'team', email: true, push: false, slack: false, teams: false },
  ]);

  const saveMutation = useMutation({
    mutationFn: async (data: { notifications: NotificationEvent[], slack_webhook: string, teams_webhook: string }) => {
      return apiRequest('/api/notification-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          workspace_id: currentWorkspace?.id,
          ...data
        })
      });
    },
    onSuccess: () => {
      toast.success('Notification settings saved!');
    },
    onError: () => {
      toast.error('Failed to save settings');
    }
  });

  const testWebhook = async (type: 'slack' | 'teams') => {
    const webhook = type === 'slack' ? slackWebhook : teamsWebhook;
    if (!webhook) {
      toast.error(`Please enter a ${type === 'slack' ? 'Slack' : 'Teams'} webhook URL`);
      return;
    }

    setTestingChannel(type);
    try {
      const response = await fetch('/api/test-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ type, webhook_url: webhook })
      });

      if (response.ok) {
        toast.success(`Test message sent to ${type === 'slack' ? 'Slack' : 'Teams'}!`);
      } else {
        toast.error('Failed to send test message. Check your webhook URL.');
      }
    } catch (error) {
      toast.error('Failed to send test message');
    } finally {
      setTestingChannel(null);
    }
  };

  const toggleNotification = (eventId: string, channel: 'email' | 'push' | 'slack' | 'teams') => {
    setNotifications(prev => prev.map(n => 
      n.id === eventId ? { ...n, [channel]: !n[channel] } : n
    ));
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'leads': return Users;
      case 'deals': return Target;
      case 'campaigns': return Mail;
      case 'ai': return AlertTriangle;
      case 'meetings': return Calendar;
      case 'team': return Users;
      default: return Bell;
    }
  };

  const handleSave = () => {
    saveMutation.mutate({
      notifications,
      slack_webhook: slackWebhook,
      teams_webhook: teamsWebhook
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Notification Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure how and when you receive alerts
          </p>
        </div>
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-notifications">
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>

      <Tabs defaultValue="channels" className="space-y-6">
        <TabsList>
          <TabsTrigger value="channels" data-testid="tab-channels">
            <MessageSquare className="mr-2 h-4 w-4" />
            Channels
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">
            <Bell className="mr-2 h-4 w-4" />
            Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SiSlack className="h-5 w-5 text-[#4A154B]" />
                  Slack Integration
                </CardTitle>
                <CardDescription>
                  Send notifications to a Slack channel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slack-webhook">Webhook URL</Label>
                  <Input
                    id="slack-webhook"
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    data-testid="input-slack-webhook"
                  />
                  <p className="text-xs text-muted-foreground">
                    <a 
                      href="https://api.slack.com/messaging/webhooks" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Learn how to create a webhook
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => testWebhook('slack')}
                  disabled={testingChannel === 'slack'}
                  data-testid="button-test-slack"
                >
                  {testingChannel === 'slack' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  Send Test Message
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-[#6264A7]" />
                  Microsoft Teams Integration
                </CardTitle>
                <CardDescription>
                  Send notifications to a Teams channel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="teams-webhook">Webhook URL</Label>
                  <Input
                    id="teams-webhook"
                    placeholder="https://outlook.office.com/webhook/..."
                    value={teamsWebhook}
                    onChange={(e) => setTeamsWebhook(e.target.value)}
                    data-testid="input-teams-webhook"
                  />
                  <p className="text-xs text-muted-foreground">
                    <a 
                      href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Learn how to create a webhook
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => testWebhook('teams')}
                  disabled={testingChannel === 'teams'}
                  data-testid="button-test-teams"
                >
                  {testingChannel === 'teams' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="mr-2 h-4 w-4" />
                  )}
                  Send Test Message
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Mobile Push Notifications
                </CardTitle>
                <CardDescription>
                  Get alerts on your mobile device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Push Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive real-time alerts on your phone
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-push-enabled" />
                </div>
                <div className="mt-4 p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Download our mobile app to receive push notifications
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">iOS</Badge>
                    <Badge variant="outline">Android</Badge>
                    <Badge>Coming Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Notifications
                </CardTitle>
                <CardDescription>
                  Receive notifications via email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Enable Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get important updates in your inbox
                    </p>
                  </div>
                  <Switch defaultChecked data-testid="switch-email-enabled" />
                </div>
                <div className="mt-4 space-y-2">
                  <Label>Digest Frequency</Label>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Instant</Badge>
                    <Badge variant="secondary" className="cursor-pointer">Daily</Badge>
                    <Badge variant="outline" className="cursor-pointer hover:bg-primary hover:text-primary-foreground">Weekly</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Events</CardTitle>
              <CardDescription>
                Choose which events trigger notifications and how
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                <div className="grid grid-cols-5 gap-4 py-2 px-4 bg-muted rounded-t-lg font-medium text-sm">
                  <div className="col-span-2">Event</div>
                  <div className="text-center">Email</div>
                  <div className="text-center">Push</div>
                  <div className="text-center">Slack/Teams</div>
                </div>
                {notifications.map((event) => {
                  const Icon = getCategoryIcon(event.category);
                  return (
                    <div 
                      key={event.id}
                      className="grid grid-cols-5 gap-4 py-3 px-4 border-b last:border-0 items-center"
                    >
                      <div className="col-span-2 flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{event.label}</p>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <Switch
                          checked={event.email}
                          onCheckedChange={() => toggleNotification(event.id, 'email')}
                          data-testid={`switch-${event.id}-email`}
                        />
                      </div>
                      <div className="flex justify-center">
                        <Switch
                          checked={event.push}
                          onCheckedChange={() => toggleNotification(event.id, 'push')}
                          data-testid={`switch-${event.id}-push`}
                        />
                      </div>
                      <div className="flex justify-center gap-2">
                        <Switch
                          checked={event.slack || event.teams}
                          onCheckedChange={() => {
                            toggleNotification(event.id, 'slack');
                            toggleNotification(event.id, 'teams');
                          }}
                          data-testid={`switch-${event.id}-slack`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
