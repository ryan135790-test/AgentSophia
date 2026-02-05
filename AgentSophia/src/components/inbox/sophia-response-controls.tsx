import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bot, 
  Mail, 
  Linkedin, 
  MessageSquare, 
  Phone,
  Calendar,
  Shield,
  Zap,
  Eye,
  CheckCircle2,
  AlertCircle,
  Settings,
  Brain,
  Sparkles,
  Twitter,
  MessageCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ResponseMode {
  id: string;
  label: string;
  description: string;
  icon: any;
}

interface ChannelControl {
  id: string;
  name: string;
  icon: any;
  autoRespond: boolean;
  requireApproval: boolean;
}

export function SophiaResponseControls() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  
  const [responseMode, setResponseMode] = useState<'autonomous' | 'semi-autonomous' | 'manual'>('semi-autonomous');
  const [confidenceThreshold, setConfidenceThreshold] = useState(85);
  const [channels, setChannels] = useState<ChannelControl[]>([
    { id: 'email', name: 'Email', icon: Mail, autoRespond: true, requireApproval: true },
    { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, autoRespond: true, requireApproval: true },
    { id: 'sms', name: 'SMS', icon: MessageSquare, autoRespond: false, requireApproval: true },
    { id: 'phone', name: 'Phone/Voicemail', icon: Phone, autoRespond: false, requireApproval: true },
    { id: 'twitter', name: 'Twitter/X', icon: Twitter, autoRespond: false, requireApproval: true },
  ]);
  
  const [intentFilters, setIntentFilters] = useState({
    interested: true,
    question: true,
    meeting_request: true,
    objection: false,
    not_interested: false,
    out_of_office: false,
  });
  
  const [autoBookMeetings, setAutoBookMeetings] = useState(false);
  const [sendFollowups, setSendFollowups] = useState(true);

  const responseModes: ResponseMode[] = [
    {
      id: 'autonomous',
      label: 'Fully Autonomous',
      description: 'Sophia responds immediately without approval',
      icon: Zap,
    },
    {
      id: 'semi-autonomous',
      label: 'Semi-Autonomous',
      description: 'Sophia drafts responses, you review & approve',
      icon: Eye,
    },
    {
      id: 'manual',
      label: 'Manual Only',
      description: 'All responses require manual composition',
      icon: Shield,
    },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: config } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (config) {
        const criteria = config.decision_criteria as any || {};
        const meetingConfig = config.meeting_booking as any || {};
        
        setResponseMode(criteria.response_mode || 'semi-autonomous');
        setConfidenceThreshold(criteria.confidence_threshold || 85);
        setAutoBookMeetings(meetingConfig.auto_book_meetings || false);
        setSendFollowups(criteria.send_followups !== false);
        
        if (criteria.intent_filters) {
          setIntentFilters(prev => ({ ...prev, ...criteria.intent_filters }));
        }
        
        if (criteria.channel_controls) {
          setChannels(prev => prev.map(ch => ({
            ...ch,
            autoRespond: criteria.channel_controls[ch.id]?.autoRespond ?? ch.autoRespond,
            requireApproval: criteria.channel_controls[ch.id]?.requireApproval ?? ch.requireApproval,
          })));
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const channelControls: Record<string, any> = {};
      channels.forEach(ch => {
        channelControls[ch.id] = {
          autoRespond: ch.autoRespond,
          requireApproval: ch.requireApproval,
        };
      });

      const { data: existingConfig } = await supabase
        .from('agent_configs')
        .select('id, decision_criteria, meeting_booking')
        .eq('user_id', user.id)
        .single();

      const updatedCriteria = {
        ...(existingConfig?.decision_criteria as object || {}),
        response_mode: responseMode,
        confidence_threshold: confidenceThreshold,
        intent_filters: intentFilters,
        channel_controls: channelControls,
        send_followups: sendFollowups,
      };

      const updatedMeetingBooking = {
        ...(existingConfig?.meeting_booking as object || {}),
        auto_book_meetings: autoBookMeetings,
      };

      if (existingConfig) {
        await supabase
          .from('agent_configs')
          .update({
            decision_criteria: updatedCriteria,
            meeting_booking: updatedMeetingBooking,
          })
          .eq('id', existingConfig.id);
      } else {
        await supabase
          .from('agent_configs')
          .insert({
            user_id: user.id,
            name: 'Sophia',
            role: 'sales_development',
            is_active: true,
            decision_criteria: updatedCriteria,
            meeting_booking: updatedMeetingBooking,
          });
      }

      toast({
        title: "Settings Saved",
        description: "Sophia's response controls have been updated",
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  const toggleChannelAutoRespond = (channelId: string) => {
    setChannels(prev => prev.map(ch => 
      ch.id === channelId ? { ...ch, autoRespond: !ch.autoRespond } : ch
    ));
  };

  const toggleChannelApproval = (channelId: string) => {
    setChannels(prev => prev.map(ch => 
      ch.id === channelId ? { ...ch, requireApproval: !ch.requireApproval } : ch
    ));
  };

  const toggleIntent = (intent: string) => {
    setIntentFilters(prev => ({ ...prev, [intent]: !prev[intent as keyof typeof prev] }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bot className="h-5 w-5 animate-pulse" />
            <span>Loading Sophia's settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Sophia Response Controls</CardTitle>
                <CardDescription>Configure how Sophia handles incoming messages</CardDescription>
              </div>
            </div>
            <Button onClick={saveSettings} data-testid="button-save-settings">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-sm font-medium">Response Mode</Label>
            <div className="grid grid-cols-3 gap-4">
              {responseModes.map((mode) => {
                const Icon = mode.icon;
                const isSelected = responseMode === mode.id;
                return (
                  <div
                    key={mode.id}
                    onClick={() => setResponseMode(mode.id as any)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                    data-testid={`mode-${mode.id}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className={`font-medium ${isSelected ? 'text-primary' : ''}`}>{mode.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{mode.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {responseMode !== 'manual' && (
            <>
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Confidence Threshold</Label>
                  <Badge variant="outline">{confidenceThreshold}%</Badge>
                </div>
                <Slider
                  value={[confidenceThreshold]}
                  onValueChange={([value]) => setConfidenceThreshold(value)}
                  min={50}
                  max={100}
                  step={5}
                  className="w-full"
                  data-testid="slider-confidence"
                />
                <p className="text-xs text-muted-foreground">
                  Sophia will only auto-respond when confidence is ≥{confidenceThreshold}%. Lower confidence responses require approval.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Channel Controls</Label>
                <div className="space-y-3">
                  {channels.map((channel) => {
                    const Icon = channel.icon;
                    return (
                      <div key={channel.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{channel.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={channel.autoRespond}
                              onCheckedChange={() => toggleChannelAutoRespond(channel.id)}
                              data-testid={`switch-auto-${channel.id}`}
                            />
                            <Label className="text-xs text-muted-foreground">Auto-respond</Label>
                          </div>
                          {channel.autoRespond && responseMode === 'semi-autonomous' && (
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={channel.requireApproval}
                                onCheckedChange={() => toggleChannelApproval(channel.id)}
                                data-testid={`switch-approval-${channel.id}`}
                              />
                              <Label className="text-xs text-muted-foreground">Require approval</Label>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Respond to Intent Types</Label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(intentFilters).map(([intent, enabled]) => (
                    <div 
                      key={intent}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={enabled ? "default" : "outline"}
                          className={enabled ? getIntentColor(intent) : ""}
                        >
                          {formatIntentLabel(intent)}
                        </Badge>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleIntent(intent)}
                        data-testid={`switch-intent-${intent}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-sm font-medium">Additional Automations</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm font-medium">Auto-Book Meetings</span>
                        <p className="text-xs text-muted-foreground">Automatically book when prospects request</p>
                      </div>
                    </div>
                    <Switch
                      checked={autoBookMeetings}
                      onCheckedChange={setAutoBookMeetings}
                      data-testid="switch-auto-book"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-sm font-medium">Send Follow-ups</span>
                        <p className="text-xs text-muted-foreground">Auto-send scheduled follow-up sequences</p>
                      </div>
                    </div>
                    <Switch
                      checked={sendFollowups}
                      onCheckedChange={setSendFollowups}
                      data-testid="switch-followups"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {responseMode === 'autonomous' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                In fully autonomous mode, Sophia will respond to messages immediately without your review. 
                Make sure your confidence threshold and intent filters are properly configured.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function getIntentColor(intent: string): string {
  const colors: Record<string, string> = {
    interested: 'bg-green-500',
    question: 'bg-blue-500',
    meeting_request: 'bg-purple-500',
    objection: 'bg-orange-500',
    not_interested: 'bg-red-500',
    out_of_office: 'bg-gray-500',
  };
  return colors[intent] || 'bg-slate-500';
}

function formatIntentLabel(intent: string): string {
  return intent
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
