import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bot, 
  Zap, 
  Users, 
  Mail, 
  MessageSquare, 
  Linkedin, 
  Phone, 
  Sparkles,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  Eye,
  Edit2,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Settings2,
  Target,
  TrendingUp
} from "lucide-react";
import type { BrandVoice } from "./brand-voice-selector";

interface Campaign {
  id: string;
  name: string;
  type: string;
  status: string;
  contacts_count?: number;
  brandVoiceId?: string;
  brandVoiceName?: string;
}

interface ContactInCampaign {
  id: string;
  name: string;
  email: string;
  company?: string;
  status: 'pending' | 'in_progress' | 'messaged' | 'replied' | 'converted' | 'opted_out';
  sophiaStatus: 'waiting' | 'drafting' | 'pending_approval' | 'sent' | 'completed';
  lastAction?: string;
  lastActionAt?: string;
  draftMessage?: string;
  channel?: string;
}

interface SophiaCampaignConfig {
  campaignId: string;
  enabled: boolean;
  autonomyLevel: 'manual' | 'semi_autonomous' | 'fully_autonomous';
  brandVoiceId: string | null;
  approvalRequired: boolean;
  maxDailyMessages: number;
  personalizationLevel: 'basic' | 'moderate' | 'deep';
}

interface SophiaCampaignManagerProps {
  workspaceId: string;
}

export function SophiaCampaignManager({ workspaceId }: SophiaCampaignManagerProps) {
  const { toast } = useToast();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configCampaign, setConfigCampaign] = useState<Campaign | null>(null);
  const [pendingApprovalContact, setPendingApprovalContact] = useState<ContactInCampaign | null>(null);

  const [campaignConfigs, setCampaignConfigs] = useState<Record<string, SophiaCampaignConfig>>({});

  const { data: configsData } = useQuery<{ configs: SophiaCampaignConfig[] }>({
    queryKey: ['/api/sophia/campaigns/configs', workspaceId],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/sophia/campaigns/configs?workspaceId=${workspaceId}`, {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) return { configs: [] };
      return response.json();
    },
  });

  useEffect(() => {
    if (configsData?.configs) {
      const configMap: Record<string, SophiaCampaignConfig> = {};
      configsData.configs.forEach(c => { configMap[c.campaignId] = c; });
      setCampaignConfigs(configMap);
    }
  }, [configsData]);

  const { data: campaignsData, isLoading: campaignsLoading } = useQuery<{ campaigns: Campaign[] }>({
    queryKey: ['/api/workspaces', workspaceId, 'campaigns'],
    queryFn: async () => {
      if (!workspaceId) return { campaigns: [] };
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/workspaces/${workspaceId}/campaigns`, {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) {
        return { campaigns: [] };
      }
      const data = await response.json();
      // Handle both array and object responses
      return Array.isArray(data) ? { campaigns: data } : data;
    },
    enabled: !!workspaceId,
  });

  const { data: brandVoicesData } = useQuery<{ brand_voices: BrandVoice[] }>({
    queryKey: ['/api/brand-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/brand-voices', {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) {
        return { brand_voices: [] };
      }
      return response.json();
    },
  });

  const campaigns = campaignsData?.campaigns || [];
  const brandVoices = brandVoicesData?.brand_voices || [];
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);
  const selectedConfig = selectedCampaignId ? campaignConfigs[selectedCampaignId] : null;

  const [contacts, setContacts] = useState<ContactInCampaign[]>([]);
  
  useEffect(() => {
    const fetchContacts = async () => {
      if (!selectedCampaignId) {
        setContacts([]);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(`/api/campaigns/${selectedCampaignId}/contacts`, {
          headers: {
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
          },
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setContacts(Array.isArray(data) ? data : data.contacts || []);
        }
      } catch (error) {
        console.error('Error fetching contacts:', error);
        setContacts([]);
      }
    };
    fetchContacts();
  }, [selectedCampaignId]);

  const handleConfigureCampaign = (campaign: Campaign) => {
    setConfigCampaign(campaign);
    setShowConfigDialog(true);
  };

  const handleSaveConfig = async (config: SophiaCampaignConfig) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/sophia/campaigns/${config.campaignId}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ ...config, workspaceId }),
        credentials: 'include',
      });
      
      if (response.ok) {
        setCampaignConfigs(prev => ({
          ...prev,
          [config.campaignId]: config
        }));
        queryClient.invalidateQueries({ queryKey: ['/api/sophia/campaigns/configs'] });
        setShowConfigDialog(false);
        toast({
          title: "Sophia Configuration Saved",
          description: `${configCampaign?.name} is now configured for ${config.autonomyLevel === 'fully_autonomous' ? 'full autonomy' : config.autonomyLevel === 'semi_autonomous' ? 'semi-autonomous' : 'manual'} management.`,
        });
      } else {
        throw new Error('Failed to save configuration');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save campaign configuration",
        variant: "destructive",
      });
    }
  };

  const handleApprove = async (contact: ContactInCampaign) => {
    if (!selectedCampaignId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const approvalId = `approval-${selectedCampaignId}-${contact.id}`;
      const response = await fetch(`/api/sophia/campaigns/${selectedCampaignId}/approvals/${approvalId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      
      if (response.ok) {
        toast({
          title: "Message Approved",
          description: `Sophia will now send the message to ${contact.name}.`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/sophia/campaigns', selectedCampaignId] });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to approve message", variant: "destructive" });
    }
    setPendingApprovalContact(null);
  };

  const handleReject = async (contact: ContactInCampaign) => {
    if (!selectedCampaignId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const approvalId = `approval-${selectedCampaignId}-${contact.id}`;
      const response = await fetch(`/api/sophia/campaigns/${selectedCampaignId}/approvals/${approvalId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ reason: 'User requested revision' }),
        credentials: 'include',
      });
      
      if (response.ok) {
        toast({
          title: "Message Rejected",
          description: `Sophia will draft a new message for ${contact.name}.`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/sophia/campaigns', selectedCampaignId] });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to reject message", variant: "destructive" });
    }
    setPendingApprovalContact(null);
  };

  const handleRegenerateDraft = async (contact: ContactInCampaign) => {
    if (!selectedCampaignId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const config = campaignConfigs[selectedCampaignId];
      const response = await fetch(`/api/sophia/campaigns/${selectedCampaignId}/contacts/${contact.id}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ 
          brandVoiceId: config?.brandVoiceId,
          personalizationLevel: config?.personalizationLevel || 'moderate'
        }),
        credentials: 'include',
      });
      
      if (response.ok) {
        toast({
          title: "Regenerating Draft",
          description: `Sophia is creating a new personalized message for ${contact.name}.`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/sophia/campaigns', selectedCampaignId] });
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to regenerate draft", variant: "destructive" });
    }
  };

  const getChannelIcon = (channel?: string) => {
    switch (channel) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'linkedin': return <Linkedin className="h-4 w-4" />;
      case 'sms': return <MessageSquare className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (sophiaStatus: ContactInCampaign['sophiaStatus']) => {
    switch (sophiaStatus) {
      case 'waiting':
        return <Badge variant="outline" className="text-slate-500"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
      case 'drafting':
        return <Badge variant="outline" className="text-blue-500 animate-pulse"><Sparkles className="h-3 w-3 mr-1" />Drafting...</Badge>;
      case 'pending_approval':
        return <Badge className="bg-amber-500"><Eye className="h-3 w-3 mr-1" />Review</Badge>;
      case 'sent':
        return <Badge className="bg-green-500"><Send className="h-3 w-3 mr-1" />Sent</Badge>;
      case 'completed':
        return <Badge className="bg-purple-500"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>;
    }
  };

  const pendingApprovals = contacts.filter(c => c.sophiaStatus === 'pending_approval');
  const activeCampaignsCount = Object.values(campaignConfigs).filter(c => c.enabled).length;
  const totalMessaged = contacts.filter(c => c.sophiaStatus === 'sent' || c.sophiaStatus === 'completed').length;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-purple-600 to-blue-600 border-0 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Sophia Campaign Manager
          </CardTitle>
          <CardDescription className="text-purple-100">
            Let Sophia autonomously manage your campaigns with personalized outreach using your brand voice
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
                <p className="text-2xl font-bold">{activeCampaignsCount}</p>
              </div>
              <Target className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
                <p className="text-2xl font-bold text-amber-500">{pendingApprovals.length}</p>
              </div>
              <Eye className="h-8 w-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Messages Sent</p>
                <p className="text-2xl font-bold text-green-600">{totalMessaged}</p>
              </div>
              <Send className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Response Rate</p>
                <p className="text-2xl font-bold text-blue-600">34%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Your Campaigns</CardTitle>
              <CardDescription>Select a campaign for Sophia to manage</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {campaigns.map((campaign) => {
                    const config = campaignConfigs[campaign.id];
                    const isEnabled = config?.enabled;
                    return (
                      <div
                        key={campaign.id}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedCampaignId === campaign.id
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-slate-200 hover:border-purple-300'
                        }`}
                        onClick={() => setSelectedCampaignId(campaign.id)}
                        data-testid={`campaign-item-${campaign.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{campaign.name}</span>
                              {isEnabled && (
                                <Badge className="bg-purple-500 text-xs">
                                  <Bot className="h-2 w-2 mr-1" />
                                  Sophia
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {getChannelIcon(campaign.type)}
                              <span className="text-xs text-muted-foreground">
                                {campaign.contacts_count} contacts
                              </span>
                            </div>
                            {campaign.brandVoiceName && (
                              <p className="text-xs text-purple-600 mt-1">
                                <Sparkles className="h-3 w-3 inline mr-1" />
                                {campaign.brandVoiceName}
                              </p>
                            )}
                          </div>
                          <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                            {campaign.status}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfigureCampaign(campaign);
                          }}
                          data-testid={`configure-campaign-${campaign.id}`}
                        >
                          <Settings2 className="h-3 w-3 mr-1" />
                          Configure Sophia
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2">
          {selectedCampaign ? (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {selectedCampaign.name}
                      {selectedConfig?.enabled && (
                        <Badge className="bg-purple-500">
                          <Bot className="h-3 w-3 mr-1" />
                          {selectedConfig.autonomyLevel === 'fully_autonomous' ? 'Fully Autonomous' : 'Semi-Autonomous'}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {selectedConfig?.enabled 
                        ? `Sophia is managing this campaign with ${selectedConfig.personalizationLevel} personalization`
                        : 'Configure Sophia to start autonomous outreach'}
                    </CardDescription>
                  </div>
                  {selectedConfig?.brandVoiceId && (
                    <Badge variant="outline" className="border-purple-300 text-purple-600">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {selectedCampaign.brandVoiceName || 'Brand Voice'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="contacts">
                  <TabsList className="mb-4">
                    <TabsTrigger value="contacts">
                      <Users className="h-4 w-4 mr-1" />
                      Contacts ({contacts.length})
                    </TabsTrigger>
                    <TabsTrigger value="approvals" className="relative">
                      <Eye className="h-4 w-4 mr-1" />
                      Approvals
                      {pendingApprovals.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                          {pendingApprovals.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="activity">
                      <Zap className="h-4 w-4 mr-1" />
                      Activity
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="contacts">
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            data-testid={`contact-row-${contact.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-medium">
                                  {contact.name.split(' ').map(n => n[0]).join('')}
                                </div>
                                <div>
                                  <p className="font-medium">{contact.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {contact.company} • {contact.email}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {getChannelIcon(contact.channel)}
                                {getStatusBadge(contact.sophiaStatus)}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{contact.lastAction}</span>
                              <span>{contact.lastActionAt}</span>
                            </div>
                            {contact.sophiaStatus === 'pending_approval' && (
                              <div className="mt-3 flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => setPendingApprovalContact(contact)}
                                  data-testid={`review-draft-${contact.id}`}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Review Draft
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1 bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApprove(contact)}
                                  data-testid={`quick-approve-${contact.id}`}
                                >
                                  <ThumbsUp className="h-3 w-3 mr-1" />
                                  Approve
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="approvals">
                    <ScrollArea className="h-[350px]">
                      {pendingApprovals.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                          <p>No pending approvals</p>
                          <p className="text-sm">Sophia will notify you when messages need review</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {pendingApprovals.map((contact) => (
                            <Card key={contact.id} className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
                              <CardContent className="pt-4">
                                <div className="flex items-start gap-3">
                                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-medium flex-shrink-0">
                                    {contact.name.split(' ').map(n => n[0]).join('')}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                      <div>
                                        <p className="font-medium">{contact.name}</p>
                                        <p className="text-sm text-muted-foreground">{contact.company}</p>
                                      </div>
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        {getChannelIcon(contact.channel)}
                                        <span className="text-xs">via {contact.channel}</span>
                                      </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border text-sm">
                                      {contact.draftMessage}
                                    </div>
                                    <div className="flex gap-2 mt-3">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRegenerateDraft(contact)}
                                        data-testid={`regenerate-${contact.id}`}
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" />
                                        Regenerate
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setPendingApprovalContact(contact)}
                                        data-testid={`edit-draft-${contact.id}`}
                                      >
                                        <Edit2 className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                        onClick={() => handleReject(contact)}
                                        data-testid={`reject-${contact.id}`}
                                      >
                                        <ThumbsDown className="h-3 w-3 mr-1" />
                                        Reject
                                      </Button>
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 ml-auto"
                                        onClick={() => handleApprove(contact)}
                                        data-testid={`approve-${contact.id}`}
                                      >
                                        <ThumbsUp className="h-3 w-3 mr-1" />
                                        Approve & Send
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="activity">
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {[
                          { time: '2 min ago', action: 'Sophia drafted a personalized email for Sarah Chen', type: 'draft' },
                          { time: '1 hour ago', action: 'Email sent to Michael Rodriguez', type: 'sent' },
                          { time: '3 hours ago', action: 'Positive reply received from Emily Watson', type: 'reply' },
                          { time: '5 hours ago', action: 'Campaign started with 156 contacts', type: 'start' },
                          { time: 'Yesterday', action: 'Brand voice "Enterprise Professional" applied', type: 'config' },
                        ].map((activity, idx) => (
                          <div key={idx} className="flex items-start gap-3 p-2">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                              activity.type === 'reply' ? 'bg-green-100 text-green-600' :
                              activity.type === 'sent' ? 'bg-blue-100 text-blue-600' :
                              activity.type === 'draft' ? 'bg-purple-100 text-purple-600' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {activity.type === 'reply' ? <MessageSquare className="h-4 w-4" /> :
                               activity.type === 'sent' ? <Send className="h-4 w-4" /> :
                               activity.type === 'draft' ? <Sparkles className="h-4 w-4" /> :
                               <Zap className="h-4 w-4" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">{activity.action}</p>
                              <p className="text-xs text-muted-foreground">{activity.time}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center py-12">
                <Bot className="h-16 w-16 mx-auto mb-4 text-purple-300" />
                <h3 className="text-lg font-semibold mb-2">Select a Campaign</h3>
                <p className="text-muted-foreground max-w-md">
                  Choose a campaign from the list to view contacts and configure Sophia's autonomous management settings
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CampaignConfigDialog
        open={showConfigDialog}
        onOpenChange={setShowConfigDialog}
        campaign={configCampaign}
        brandVoices={brandVoices}
        currentConfig={configCampaign ? campaignConfigs[configCampaign.id] : undefined}
        onSave={handleSaveConfig}
      />

      <DraftReviewDialog
        open={!!pendingApprovalContact}
        onOpenChange={(open) => !open && setPendingApprovalContact(null)}
        contact={pendingApprovalContact}
        onApprove={handleApprove}
        onReject={handleReject}
        onRegenerate={handleRegenerateDraft}
      />
    </div>
  );
}

interface CampaignConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: Campaign | null;
  brandVoices: BrandVoice[];
  currentConfig?: SophiaCampaignConfig;
  onSave: (config: SophiaCampaignConfig) => void;
}

function CampaignConfigDialog({ open, onOpenChange, campaign, brandVoices, currentConfig, onSave }: CampaignConfigDialogProps) {
  const [enabled, setEnabled] = useState(currentConfig?.enabled ?? false);
  const [autonomyLevel, setAutonomyLevel] = useState<SophiaCampaignConfig['autonomyLevel']>(currentConfig?.autonomyLevel ?? 'semi_autonomous');
  const [brandVoiceId, setBrandVoiceId] = useState<string | null>(currentConfig?.brandVoiceId ?? campaign?.brandVoiceId ?? null);
  const [approvalRequired, setApprovalRequired] = useState(currentConfig?.approvalRequired ?? true);
  const [maxDailyMessages, setMaxDailyMessages] = useState(currentConfig?.maxDailyMessages ?? 50);
  const [personalizationLevel, setPersonalizationLevel] = useState<SophiaCampaignConfig['personalizationLevel']>(currentConfig?.personalizationLevel ?? 'moderate');

  useEffect(() => {
    if (currentConfig) {
      setEnabled(currentConfig.enabled);
      setAutonomyLevel(currentConfig.autonomyLevel);
      setBrandVoiceId(currentConfig.brandVoiceId);
      setApprovalRequired(currentConfig.approvalRequired);
      setMaxDailyMessages(currentConfig.maxDailyMessages);
      setPersonalizationLevel(currentConfig.personalizationLevel);
    } else if (campaign) {
      setEnabled(false);
      setAutonomyLevel('semi_autonomous');
      setBrandVoiceId(campaign.brandVoiceId ?? null);
      setApprovalRequired(true);
      setMaxDailyMessages(50);
      setPersonalizationLevel('moderate');
    }
  }, [currentConfig, campaign]);

  const handleSave = () => {
    if (!campaign) return;
    onSave({
      campaignId: campaign.id,
      enabled,
      autonomyLevel,
      brandVoiceId,
      approvalRequired,
      maxDailyMessages,
      personalizationLevel,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-purple-600" />
            Configure Sophia for {campaign?.name}
          </DialogTitle>
          <DialogDescription>
            Set how Sophia should autonomously manage this campaign
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Sophia</Label>
              <p className="text-sm text-muted-foreground">Let Sophia manage this campaign</p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              data-testid="switch-enable-sophia"
            />
          </div>

          {enabled && (
            <>
              <div className="space-y-3">
                <Label>Autonomy Level</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'manual', label: 'Manual', desc: 'You control everything' },
                    { value: 'semi_autonomous', label: 'Semi-Auto', desc: 'Sophia drafts, you approve' },
                    { value: 'fully_autonomous', label: 'Full Auto', desc: 'Sophia handles everything' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        autonomyLevel === option.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : 'border-slate-200 hover:border-purple-300'
                      }`}
                      onClick={() => setAutonomyLevel(option.value as SophiaCampaignConfig['autonomyLevel'])}
                      data-testid={`autonomy-${option.value}`}
                    >
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Brand Voice</Label>
                <Select value={brandVoiceId || 'default'} onValueChange={(v) => setBrandVoiceId(v === 'default' ? null : v)}>
                  <SelectTrigger data-testid="select-brand-voice">
                    <SelectValue placeholder="Select brand voice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Professional Voice</SelectItem>
                    {brandVoices.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} ({voice.tone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Sophia will use this voice when crafting personalized messages
                </p>
              </div>

              <div className="space-y-2">
                <Label>Personalization Level</Label>
                <Select value={personalizationLevel} onValueChange={(v) => setPersonalizationLevel(v as SophiaCampaignConfig['personalizationLevel'])}>
                  <SelectTrigger data-testid="select-personalization">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic - Name & company only</SelectItem>
                    <SelectItem value="moderate">Moderate - Include role & industry context</SelectItem>
                    <SelectItem value="deep">Deep - Research-backed, highly personalized</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Daily Messages: {maxDailyMessages}</Label>
                <input
                  type="range"
                  min="10"
                  max="200"
                  value={maxDailyMessages}
                  onChange={(e) => setMaxDailyMessages(Number(e.target.value))}
                  className="w-full"
                  data-testid="slider-max-daily"
                />
                <p className="text-xs text-muted-foreground">
                  Safety limit for daily autonomous messages
                </p>
              </div>

              {autonomyLevel !== 'manual' && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Require Approval</Label>
                    <p className="text-sm text-muted-foreground">Review messages before sending</p>
                  </div>
                  <Switch
                    checked={approvalRequired}
                    onCheckedChange={setApprovalRequired}
                    disabled={autonomyLevel === 'semi_autonomous'}
                    data-testid="switch-approval"
                  />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="btn-cancel-config">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-gradient-to-r from-purple-600 to-blue-600"
            data-testid="btn-save-config"
          >
            {enabled ? 'Enable Sophia' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DraftReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactInCampaign | null;
  onApprove: (contact: ContactInCampaign) => void;
  onReject: (contact: ContactInCampaign) => void;
  onRegenerate: (contact: ContactInCampaign) => void;
}

function DraftReviewDialog({ open, onOpenChange, contact, onApprove, onReject, onRegenerate }: DraftReviewDialogProps) {
  const [editedMessage, setEditedMessage] = useState('');

  useEffect(() => {
    if (contact?.draftMessage) {
      setEditedMessage(contact.draftMessage);
    }
  }, [contact]);

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Review Draft for {contact.name}
          </DialogTitle>
          <DialogDescription>
            Sophia drafted this personalized message. Review, edit, or regenerate before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white font-medium">
              {contact.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <p className="font-medium">{contact.name}</p>
              <p className="text-sm text-muted-foreground">{contact.company} • {contact.email}</p>
            </div>
            <Badge className="ml-auto" variant="outline">
              via {contact.channel}
            </Badge>
          </div>

          <div className="space-y-2">
            <Label>Message Draft</Label>
            <textarea
              className="w-full min-h-[200px] p-4 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              value={editedMessage}
              onChange={(e) => setEditedMessage(e.target.value)}
              data-testid="textarea-draft-message"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            <span>Generated using your selected brand voice with {contact.company} research insights</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onRegenerate(contact)}
            data-testid="btn-regenerate"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Regenerate
          </Button>
          <Button
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => onReject(contact)}
            data-testid="btn-reject"
          >
            <ThumbsDown className="h-4 w-4 mr-2" />
            Reject
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onApprove(contact)}
            data-testid="btn-approve-send"
          >
            <ThumbsUp className="h-4 w-4 mr-2" />
            Approve & Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}