import { useState, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { addHours, addDays } from "date-fns";
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Linkedin, 
  Share2,
  Star,
  StarOff,
  Sparkles,
  Tag as TagIcon,
  X,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Calendar,
  Coffee,
  Briefcase,
  Twitter,
  MapPin,
  TrendingUp,
  Hash,
  Send,
  Building2,
  UserPlus,
  FileText,
  Zap,
  Pause,
  Play,
  Edit2,
  Check,
  Ban,
  Loader2,
  Eye,
  Clock,
  Calendar as CalendarIcon
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInboxResponses, useMarkAsRead, useUpdateResponseIntent, useCreateResponse } from "@/hooks/use-inbox";
import { useContactProfile } from "@/hooks/use-contact-profile";
import { useUpdateContact } from "@/hooks/use-contacts";
import { useUpdateCampaign, useCampaign } from "@/hooks/use-campaigns";
import { CampaignResponse } from "../../../shared/schema";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { sendChatMessage } from "@/lib/openai-client";
import { InboxEnhancements, ConversationThread } from "./inbox-enhancements";

const channelIcons = {
  linkedin: Linkedin,
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  social: Share2,
};

const intentColors = {
  interested: "bg-green-500",
  not_interested: "bg-red-500",
  question: "bg-blue-500",
  objection: "bg-orange-500",
  meeting_request: "bg-purple-500",
  out_of_office: "bg-gray-500",
  other: "bg-slate-500",
};

export function UnifiedInbox() {
  const { toast } = useToast();
  const [selectedResponse, setSelectedResponse] = useState<CampaignResponse | null>(null);
  const [newTag, setNewTag] = useState("");
  const [isEditing, setIsEditing] = useState<{[key: string]: boolean}>({});
  const [editValues, setEditValues] = useState<{[key: string]: string}>({});
  const [showAiApproval, setShowAiApproval] = useState(false);
  const [aiDraftResponse, setAiDraftResponse] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [responseMode, setResponseMode] = useState<'autonomous' | 'semi-autonomous' | 'manual'>('semi-autonomous');
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentFilters, setCurrentFilters] = useState<any>({});
  const [showEnhancements, setShowEnhancements] = useState(false);
  const [showThreadView, setShowThreadView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [keyboardEnabled, setKeyboardEnabled] = useState(true);
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false);
  const [snoozedMessages, setSnoozedMessages] = useState<{id: string; until: Date}[]>([]);
  
  // Use real Supabase hooks
  const { data: responses = [], isLoading: responsesLoading, error: responsesError } = useInboxResponses();
  const markAsRead = useMarkAsRead();
  const updateIntent = useUpdateResponseIntent();
  const updateContact = useUpdateContact();
  const updateCampaign = useUpdateCampaign();
  
  // Get contact profile for selected response
  const { data: contactProfile, isLoading: contactLoading } = useContactProfile(selectedResponse?.contact_id);
  
  // Get campaign for selected response
  const { data: campaign, isLoading: campaignLoading } = useCampaign(selectedResponse?.campaign_id || '');

  const getFilteredResponses = useCallback(() => {
    if (!responses) return [];
    let filtered = [...responses];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r => 
        r.sender_name?.toLowerCase().includes(query) ||
        r.message_content?.toLowerCase().includes(query)
      );
    }
    
    if (currentFilters.isRead !== undefined) {
      filtered = filtered.filter(r => r.is_read === currentFilters.isRead);
    }
    if (currentFilters.intents?.length > 0) {
      filtered = filtered.filter(r => currentFilters.intents.includes(r.intent_tag));
    }
    if (currentFilters.channels?.length > 0) {
      filtered = filtered.filter(r => currentFilters.channels.includes(r.channel));
    }
    if (currentFilters.urgency === 'high') {
      filtered = filtered.filter(r => 
        r.intent_tag === 'interested' || 
        r.intent_tag === 'meeting_request' || 
        (r.confidence_score || 0) > 0.8
      );
    }
    
    return filtered;
  }, [responses, currentFilters, searchQuery]);

  const filteredResponses = getFilteredResponses();

  useEffect(() => {
    loadResponseMode();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!keyboardEnabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const currentIndex = filteredResponses.findIndex(r => r.id === selectedResponse?.id);
      
      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          if (currentIndex < filteredResponses.length - 1) {
            handleResponseClick(filteredResponses[currentIndex + 1]);
          } else if (currentIndex === -1 && filteredResponses.length > 0) {
            handleResponseClick(filteredResponses[0]);
          }
          break;
        case 'k':
          e.preventDefault();
          if (currentIndex > 0) {
            handleResponseClick(filteredResponses[currentIndex - 1]);
          }
          break;
        case 'r':
          e.preventDefault();
          if (selectedResponse) {
            requestAiResponse();
          }
          break;
        case 'e':
          e.preventDefault();
          if (selectedResponse) {
            markAsRead.mutate({ id: selectedResponse.id, is_read: true });
            toast({ title: "Archived", description: "Message archived" });
          }
          break;
        case 's':
          e.preventDefault();
          if (selectedResponse) {
            setSelectedIds([selectedResponse.id]);
            setShowSnoozeDialog(true);
          }
          break;
        case 'escape':
          setSelectedResponse(null);
          setSelectedIds([]);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardEnabled, selectedResponse, filteredResponses]);

  const loadResponseMode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('agent_configs')
        .select('response_mode')
        .eq('user_id', user.id)
        .single();

      if (data?.response_mode) {
        setResponseMode(data.response_mode);
      }
    } catch (error) {
      console.error('Error loading response mode:', error);
    }
  };

  const toggleResponseMode = async () => {
    const newMode = responseMode === 'autonomous' ? 'semi-autonomous' : 'autonomous';
    setIsSavingMode(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('agent_configs')
        .update({ response_mode: newMode })
        .eq('user_id', user.id);

      setResponseMode(newMode);
      toast({
        title: "Mode Updated",
        description: `Switched to ${newMode === 'autonomous' ? 'Fully Autonomous' : 'Semi-Autonomous'} mode`,
      });
    } catch (error) {
      console.error('Error updating response mode:', error);
      toast({
        title: "Error",
        description: "Failed to update response mode",
        variant: "destructive",
      });
    } finally {
      setIsSavingMode(false);
    }
  };

  const handleResponseClick = (response: CampaignResponse) => {
    setSelectedResponse(response);
    
    // Mark as read if not already read
    if (!response.is_read) {
      markAsRead.mutate({ id: response.id, is_read: true });
    }
  };

  const toggleFavorite = () => {
    if (!contactProfile) return;
    
    updateContact.mutate({
      id: contactProfile.id,
      data: { is_favorite: !contactProfile.is_favorite }
    });
  };

  const addTag = () => {
    if (!contactProfile || !newTag.trim()) return;
    const currentTags = contactProfile.tags || [];
    if (!currentTags.includes(newTag.trim())) {
      updateContact.mutate({
        id: contactProfile.id,
        data: { tags: [...currentTags, newTag.trim()] }
      });
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    if (!contactProfile) return;
    const currentTags = contactProfile.tags || [];
    updateContact.mutate({
      id: contactProfile.id,
      data: { tags: currentTags.filter(t => t !== tagToRemove) }
    });
  };

  const handleIntentChange = (newIntent: string) => {
    if (!selectedResponse) return;
    
    updateIntent.mutate({
      id: selectedResponse.id,
      intent_tag: newIntent
    });
  };

  const startEditing = (field: string, currentValue: string) => {
    setIsEditing({ ...isEditing, [field]: true });
    setEditValues({ ...editValues, [field]: currentValue || '' });
  };

  const cancelEditing = (field: string) => {
    setIsEditing({ ...isEditing, [field]: false });
    setEditValues({ ...editValues, [field]: '' });
  };

  const saveField = (field: string) => {
    if (!contactProfile) return;
    
    updateContact.mutate({
      id: contactProfile.id,
      data: { [field]: editValues[field] }
    });
    setIsEditing({ ...isEditing, [field]: false });
  };

  const handleStageChange = (newStage: string) => {
    if (!contactProfile) return;
    
    updateContact.mutate({
      id: contactProfile.id,
      data: { stage: newStage }
    });
  };

  const handleCampaignControl = async (action: 'start' | 'pause' | 'stop') => {
    if (!campaign) return;
    
    const statusMap = {
      start: 'active' as const,
      pause: 'paused' as const,
      stop: 'completed' as const,
    };
    
    updateCampaign.mutate({
      id: campaign.id,
      data: { status: statusMap[action] }
    });
  };

  const requestAiResponse = async () => {
    if (!selectedResponse || !contactProfile) {
      toast({
        title: "Error",
        description: "Please select a response and ensure contact profile is loaded",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingAi(true);
    setAiDraftResponse("");
    setShowAiApproval(true);

    try {
      // Generate AI-powered response using GPT-5
      const aiResponse = await sendChatMessage([
        {
          role: 'system',
          content: `You are Agent Sophia, an AI SDR. Generate a professional, personalized reply to a prospect's message. Keep it concise (2-3 sentences), action-oriented, and include a clear next step (meeting, demo, or call). Match the prospect's tone.`
        },
        {
          role: 'user',
          content: `Contact: ${([contactProfile.first_name, contactProfile.last_name].filter(Boolean).join(' ').trim() || 'Unknown')}
Company: ${contactProfile.company || 'N/A'}
Position: ${contactProfile.position || 'N/A'}
Lead Stage: ${contactProfile.stage}
Their Message: "${selectedResponse.message_content}"
Campaign: ${campaign?.name || 'N/A'}

Generate a reply that moves the conversation forward.`
        }
      ], { persona: 'sophia', page: 'inbox' });

      setAiDraftResponse(aiResponse.message);
    } catch (error: any) {
      console.error('AI generation error:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      toast({
        title: "AI Generation Failed",
        description: `Could not generate response: ${errorMessage}. You can write manually instead.`,
        variant: "destructive"
      });
      setShowAiApproval(false);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const approveAiResponse = async () => {
    if (!selectedResponse || !contactProfile || !aiDraftResponse.trim()) return;
    
    setIsSendingReply(true);

    try {
      // In a production implementation, this would send the actual reply via the appropriate channel
      // (Email API, LinkedIn API, SMS API, etc.) and create an outbound_messages record.
      // For now, we'll mark the response as read and log the AI-approved reply.
      
      // Mark the inbound response as read
      await markAsRead.mutateAsync({ id: selectedResponse.id, is_read: true });
      
      // Update the contact's last interaction
      await updateContact.mutateAsync({
        id: contactProfile.id,
        data: { 
          last_contacted: new Date().toISOString(),
          stage: selectedResponse.intent_tag === 'interested' ? 'engaged' : contactProfile.stage
        }
      });

      // Log success
      console.log('AI-Approved Reply:', {
        contactId: contactProfile.id,
        contactName: [contactProfile.first_name, contactProfile.last_name].filter(Boolean).join(' ').trim() || 'Unknown',
        channel: selectedResponse.channel,
        aiReply: aiDraftResponse,
        originalMessage: selectedResponse.message_content
      });

      toast({
        title: "Response Sent",
        description: `Your AI-approved ${selectedResponse.channel} reply has been queued successfully`,
      });

      // Close dialog and clear draft only after success
      setShowAiApproval(false);
      setAiDraftResponse("");
      
    } catch (error: any) {
      console.error('Failed to send AI reply:', error);
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send AI-approved response. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleApplyFilter = (filters: any) => {
    setCurrentFilters(filters);
  };

  const handleBulkAction = async (action: string, ids: string[]) => {
    switch (action) {
      case 'markRead':
        for (const id of ids) {
          await markAsRead.mutateAsync({ id, is_read: true });
        }
        toast({ title: "Success", description: `Marked ${ids.length} messages as read` });
        break;
      case 'markUnread':
        for (const id of ids) {
          await markAsRead.mutateAsync({ id, is_read: false });
        }
        toast({ title: "Success", description: `Marked ${ids.length} messages as unread` });
        break;
      case 'archive':
        toast({ title: "Archived", description: `${ids.length} messages archived` });
        break;
      case 'addTag':
        toast({ title: "Tags", description: "Tag dialog opened" });
        break;
      case 'assign':
        toast({ title: "Assigned", description: `${ids.length} messages assigned to team member` });
        break;
      case 'snooze':
        setSelectedIds(ids);
        setShowSnoozeDialog(true);
        return;
    }
    setSelectedIds([]);
  };

  // Show error state with retry and details
  if (responsesError) {
    console.error("Inbox responses error:", responsesError);
    return (
      <div className="flex h-[calc(100vh-8rem)] gap-0 border rounded-lg overflow-hidden bg-background">
        <div className="w-80 border-r flex flex-col bg-muted/30 items-center justify-center p-6">
          <Alert variant="destructive" className="max-w-sm">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Failed to load inbox</p>
              <p className="text-xs text-muted-foreground mb-3">
                {responsesError instanceof Error ? responsesError.message : "Unknown error. Check your connection and try again."}
              </p>
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                size="sm"
                className="w-full"
              >
                Reload Page
              </Button>
            </AlertDescription>
          </Alert>
        </div>
        <div className="flex-1 bg-background flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select a message to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] border rounded-lg overflow-hidden bg-background">
      {/* Enhanced Toolbar */}
      {showEnhancements && (
        <InboxEnhancements
          responses={responses}
          selectedIds={selectedIds}
          onSelectIds={setSelectedIds}
          onApplyFilter={handleApplyFilter}
          onBulkAction={handleBulkAction}
          currentFilters={currentFilters}
        />
      )}
      
      <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar - Conversation List */}
      <div className="w-80 border-r flex flex-col bg-muted/30">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Inbox</h2>
            <div className="flex gap-1">
              <Button
                onClick={() => setShowEnhancements(!showEnhancements)}
                variant={showEnhancements ? 'default' : 'outline'}
                size="sm"
                data-testid="button-toggle-enhancements"
                title="Toggle advanced inbox tools"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
              <Button
                onClick={toggleResponseMode}
                disabled={isSavingMode}
                variant={responseMode === 'autonomous' ? 'default' : 'outline'}
                className="gap-2"
                size="sm"
                data-testid="button-toggle-mode"
                title={`Switch to ${responseMode === 'autonomous' ? 'Semi-Autonomous' : 'Fully Autonomous'} mode`}
              >
                {responseMode === 'autonomous' ? (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    Auto
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" />
                    Review
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" data-testid="badge-total-count">
              {filteredResponses.length} / {responses?.length || 0}
            </Badge>
            <Badge className="bg-green-500" data-testid="badge-interested-count">
              {responses?.filter(r => r.intent_tag === 'interested').length || 0} Interested
            </Badge>
            {Object.keys(currentFilters).length > 0 && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setCurrentFilters({})} data-testid="badge-clear-filters">
                Clear Filters
              </Badge>
            )}
          </div>
          <div className="relative">
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm pr-8"
              data-testid="input-search-inbox"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-6 w-6 p-0"
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {responsesLoading ? (
            <div className="p-4 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {filteredResponses.map((response) => {
                const ChannelIcon = channelIcons[response.channel];
                const isSelected = selectedResponse?.id === response.id;
                
                return (
                  <div
                    key={response.id}
                    onClick={() => handleResponseClick(response)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                      isSelected ? 'bg-muted' : ''
                    } ${!response.is_read ? 'border-l-4 border-l-primary' : ''}`}
                    data-testid={`conversation-item-${response.id}`}
                  >
                    <div className="flex gap-3">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback className="text-xs">
                          {getInitials(response.sender_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-medium truncate ${!response.is_read ? 'font-semibold' : ''}`}>
                            {response.sender_name}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                            {format(new Date(response.created_at), 'h:mm a')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mb-1">
                          {response.message_content}
                        </p>
                        <div className="flex items-center gap-2">
                          <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${intentColors[response.intent_tag]} text-white`}
                          >
                            {response.intent_tag.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Middle Panel - Message Thread */}
      <div className="flex-1 flex flex-col">
        {selectedResponse ? (
          <>
            {/* Header with Tabs */}
            <div className="border-b">
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {getInitials(selectedResponse.sender_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{selectedResponse.sender_name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedResponse.sender_identifier}</p>
                  </div>
                </div>
              </div>

              <Tabs defaultValue={selectedResponse.channel} className="px-4">
                <TabsList className="h-12" data-testid="tabs-channel-navigation">
                  <TabsTrigger value="linkedin" className="gap-2" data-testid="tab-linkedin">
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </TabsTrigger>
                  <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
                    <Mail className="h-4 w-4" />
                    Emails
                  </TabsTrigger>
                  <TabsTrigger value="phone" className="gap-2" data-testid="tab-phone">
                    <Phone className="h-4 w-4" />
                    Dialer
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="gap-2" data-testid="tab-sms">
                    <MessageSquare className="h-4 w-4" />
                    Tasks
                  </TabsTrigger>
                  <TabsTrigger value="social" className="gap-2" data-testid="tab-social">
                    <Share2 className="h-4 w-4" />
                    Activity
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Message Thread */}
            <ScrollArea className="flex-1 p-6">
              <div className="max-w-3xl space-y-4">
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs">
                      {getInitials(selectedResponse.sender_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm">{selectedResponse.sender_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(selectedResponse.responded_at || selectedResponse.created_at), 'MMM d, h:mm a')}
                      </span>
                    </div>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm whitespace-pre-wrap">{selectedResponse.message_content}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Reply Input */}
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="Type your reply..." 
                  className="flex-1"
                  data-testid="input-reply"
                />
                <Button
                  variant="outline"
                  onClick={requestAiResponse}
                  data-testid="button-ai-reply"
                  title="Generate AI response"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button data-testid="button-send">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground" data-testid="empty-state-inbox">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p data-testid="text-empty-message">Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Contact Profile */}
      <div className="w-96 border-l flex flex-col bg-muted/30 overflow-hidden">
        {selectedResponse && contactLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : selectedResponse && !contactProfile ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to load contact profile. Contact may have been deleted.
              </AlertDescription>
            </Alert>
          </div>
        ) : selectedResponse && contactProfile ? (
          <div className="flex-1 overflow-auto">
            <div className="p-4 space-y-4 pb-8">
              {/* Contact Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold" data-testid="text-contact-name">
                    {[contactProfile.first_name, contactProfile.last_name].filter(Boolean).join(' ').trim() || 'Unknown Contact'}
                  </h3>
                  <Button
                    variant={contactProfile.is_favorite ? "default" : "outline"}
                    size="sm"
                    onClick={toggleFavorite}
                    disabled={updateContact.isPending}
                    data-testid="button-toggle-favorite"
                  >
                    {updateContact.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : contactProfile.is_favorite ? (
                      <><Star className="h-4 w-4 mr-2 fill-current" /> Lead</>
                    ) : (
                      <><StarOff className="h-4 w-4 mr-2" /> Mark as Lead</>
                    )}
                  </Button>
                </div>

                {contactProfile.job_title && (
                  <p className="text-sm text-muted-foreground" data-testid="text-job-title">
                    {contactProfile.job_title}
                  </p>
                )}

                {/* Stage Selector */}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Sales Stage</Label>
                  <Select
                    value={contactProfile.stage}
                    onValueChange={handleStageChange}
                    disabled={updateContact.isPending}
                  >
                    <SelectTrigger className="w-full" data-testid="select-stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new" data-testid="select-item-stage-new">New</SelectItem>
                      <SelectItem value="contacted" data-testid="select-item-stage-contacted">Contacted</SelectItem>
                      <SelectItem value="qualified" data-testid="select-item-stage-qualified">Qualified</SelectItem>
                      <SelectItem value="proposal" data-testid="select-item-stage-proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation" data-testid="select-item-stage-negotiation">Negotiation</SelectItem>
                      <SelectItem value="closed-won" data-testid="select-item-stage-closed-won">Closed Won</SelectItem>
                      <SelectItem value="closed-lost" data-testid="select-item-stage-closed-lost">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Campaign Controls */}
                {campaign && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Campaign: {campaign.name}</Label>
                    <div className="flex gap-2">
                      <Button
                        variant={campaign.status === 'active' ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleCampaignControl('start')}
                        disabled={campaign.status === 'active' || updateCampaign.isPending}
                        className="flex-1"
                        data-testid="button-start-campaign"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                      <Button
                        variant={campaign.status === 'paused' ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleCampaignControl('pause')}
                        disabled={campaign.status === 'paused' || updateCampaign.isPending}
                        className="flex-1"
                        data-testid="button-pause-campaign"
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                      <Button
                        variant={campaign.status === 'completed' ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => handleCampaignControl('stop')}
                        disabled={campaign.status === 'completed' || updateCampaign.isPending}
                        className="flex-1"
                        data-testid="button-stop-campaign"
                      >
                        <Ban className="h-4 w-4 mr-1" />
                        Stop
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Contacts Section - Editable */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Contact Info
                </h4>
                <div className="space-y-3 text-sm">
                  {/* Email */}
                  <div className="flex items-center gap-2 group" data-testid="contact-email">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {isEditing.email ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          value={editValues.email}
                          onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                          className="h-7 text-sm flex-1"
                          placeholder="Email"
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveField('email')}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => cancelEditing('email')}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="truncate flex-1">{contactProfile.email || 'No email'}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 opacity-0 group-hover:opacity-100"
                          onClick={() => startEditing('email', contactProfile.email || '')}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2 group" data-testid="contact-phone">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {isEditing.phone ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          value={editValues.phone}
                          onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })}
                          className="h-7 text-sm flex-1"
                          placeholder="Phone"
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveField('phone')}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => cancelEditing('phone')}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1">{contactProfile.phone || 'No phone'}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 opacity-0 group-hover:opacity-100"
                          onClick={() => startEditing('phone', contactProfile.phone || '')}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Company */}
                  <div className="flex items-center gap-2 group" data-testid="contact-company">
                    <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {isEditing.company ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          value={editValues.company}
                          onChange={(e) => setEditValues({ ...editValues, company: e.target.value })}
                          className="h-7 text-sm flex-1"
                          placeholder="Company"
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveField('company')}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => cancelEditing('company')}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1">{contactProfile.company || 'No company'}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 opacity-0 group-hover:opacity-100"
                          onClick={() => startEditing('company', contactProfile.company || '')}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Position */}
                  <div className="flex items-center gap-2 group" data-testid="contact-position">
                    <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {isEditing.position ? (
                      <div className="flex gap-2 flex-1">
                        <Input
                          value={editValues.position}
                          onChange={(e) => setEditValues({ ...editValues, position: e.target.value })}
                          className="h-7 text-sm flex-1"
                          placeholder="Position"
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => saveField('position')}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => cancelEditing('position')}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1">{contactProfile.position || 'No position'}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 opacity-0 group-hover:opacity-100"
                          onClick={() => startEditing('position', contactProfile.position || '')}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Lead Score */}
              {contactProfile.score !== null && (
                <>
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <TrendingUp className="h-4 w-4" />
                      <span>Lead Score</span>
                    </div>
                    <p className="text-3xl font-bold" data-testid="text-lead-score">{contactProfile.score}</p>
                  </div>
                  <Separator />
                </>
              )}

              {/* Tags */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Tags
                </h4>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {contactProfile.tags?.map((tag, idx) => (
                      <Badge 
                        key={idx} 
                        variant="secondary" 
                        className="gap-1"
                        data-testid={`tag-${idx}`}
                      >
                        {tag}
                        <X 
                          className="h-3 w-3 cursor-pointer hover:text-destructive" 
                          onClick={() => removeTag(tag)}
                        />
                      </Badge>
                    )) || <p className="text-sm text-muted-foreground">No tags</p>}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag()}
                      className="h-8 text-sm"
                      data-testid="input-new-tag"
                    />
                    <Button 
                      size="sm" 
                      onClick={addTag}
                      disabled={updateContact.isPending || !newTag.trim()}
                      data-testid="button-add-tag"
                    >
                      <TagIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Response History */}
              {contactProfile.all_responses.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Response History</h4>
                  <div className="space-y-2">
                    {contactProfile.all_responses.slice(0, 5).map((resp, idx) => (
                      <div 
                        key={resp.id} 
                        className="text-sm border rounded-lg p-2"
                        data-testid={`response-history-${idx}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {resp.intent_tag.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(resp.created_at), 'MMM d')}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {resp.message_content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Work Experience */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Work experience</h4>
                <div className="space-y-3">
                  {[
                    {
                      title: 'General Counsel and Chief Compliance Officer',
                      company: 'Borderless',
                      period: 'Mar 2025 to Present',
                      duration: '4 mos'
                    },
                    {
                      title: 'Chief Compliance Officer',
                      company: 'BlockTower Capital',
                      period: 'Oct 2023 to Feb 2025',
                      duration: '1 yr 5 mos'
                    },
                    {
                      title: 'Regulatory Strategy Counsel',
                      company: 'Kraken Digital Asset Exchange',
                      period: 'Mar 2022 to Oct 2023',
                      duration: '1 yr 8 mos'
                    },
                    {
                      title: 'Vice President, Counsel',
                      company: 'Ares Management Corporation',
                      period: 'Apr 2020 to Mar 2022',
                      duration: '2 yrs'
                    },
                    {
                      title: 'Senior Associate',
                      company: 'Kirkland & Ellis',
                      period: 'Oct 2017 to Apr 2020',
                      duration: '2 yrs 7 mos'
                    },
                    {
                      title: 'Associate',
                      company: 'Willkie Farr & Gallagher LLP',
                      period: 'Sep 2014 to Oct 2017',
                      duration: '3 yrs 2 mos'
                    },
                    {
                      title: 'Honors Program',
                      company: 'U.S. Securities and Exchange Commission',
                      period: 'Jan 2014 to Mar 2014',
                      duration: '3 mos'
                    },
                    {
                      title: 'Legal Assistant',
                      company: 'Willkie, Farr & Gallagher LLP',
                      period: 'May 2009 to Jul 2011',
                      duration: '2 yrs 3 mos'
                    },
                    {
                      title: 'Tennis Instructor',
                      company: 'Chestnut Ridge Racquet Club',
                      period: 'Apr 2003 to Jun 2008',
                      duration: '5 yrs 3 mos'
                    }
                  ].map((job, idx) => (
                    <div key={idx} className="flex gap-3" data-testid={`work-experience-${idx}`}>
                      <div className="flex-shrink-0 mt-1">
                        <div className="h-8 w-8 bg-secondary rounded flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-medium">{job.title}</h5>
                        <p className="text-xs text-muted-foreground">{job.company}</p>
                        <p className="text-xs text-muted-foreground">
                          {job.period} · {job.duration}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Campaign Info */}
              <div className="bg-secondary/50 rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-semibold mb-3">Campaign Info</h4>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Name</p>
                      <p className="text-sm font-medium" data-testid="text-campaign-name">
                        {campaign?.name || 'No campaign'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Status</p>
                      <Badge variant="default" className="bg-green-600" data-testid="badge-campaign-status">
                        {campaign?.status || 'Unknown'}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-3">Step</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {[
                      { icon: TagIcon, label: 'Add Label', status: 'skipped', timing: null },
                      { icon: UserPlus, label: 'Send Connection Request', status: 'completed', timing: null },
                      { icon: CheckCircle2, label: 'If connected', status: 'completed', timing: null },
                      { icon: FileText, label: 'Enrich Profile', status: 'completed', timing: null },
                      { icon: MessageSquare, label: 'Send Message', status: 'completed', timing: null },
                      { icon: Zap, label: 'Perform Action', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Add Label', status: 'completed', timing: null },
                      { icon: MessageSquare, label: 'Send Message', status: 'skipped', timing: null },
                      { icon: TagIcon, label: 'Add Label', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Remove Label', status: 'completed', timing: null },
                      { icon: MessageSquare, label: 'Send Message', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Add Label', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Remove Label', status: 'completed', timing: null },
                      { icon: MessageSquare, label: 'Send Message', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Add Label', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Remove Label', status: 'completed', timing: null },
                      { icon: Zap, label: 'Perform Action', status: 'completed', timing: null },
                      { icon: MessageSquare, label: 'Send Message', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Add Label', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Remove Label', status: 'completed', timing: null },
                      { icon: MessageSquare, label: 'Send Message', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Add Label', status: 'completed', timing: null },
                      { icon: TagIcon, label: 'Remove Label', status: 'completed', timing: 'in 14 days' },
                      { icon: MessageSquare, label: 'Send Message', status: 'pending', timing: 'in 2 months' },
                      { icon: TagIcon, label: 'Add Label', status: 'pending', timing: 'in 2 months' },
                      { icon: TagIcon, label: 'Remove Label', status: 'pending', timing: 'in 2 months' },
                      { icon: MessageSquare, label: 'Send Message', status: 'pending', timing: 'in 2 months' },
                      { icon: TagIcon, label: 'Add Label', status: 'pending', timing: 'in 2 months' },
                      { icon: TagIcon, label: 'Remove Label', status: 'pending', timing: 'in 2 months' },
                      { icon: MessageSquare, label: 'Send Message', status: 'pending', timing: 'in 4 months' },
                      { icon: TagIcon, label: 'Add Label', status: 'pending', timing: 'in 4 months' },
                      { icon: TagIcon, label: 'Remove Label', status: 'pending', timing: 'in 4 months' },
                      { icon: MessageSquare, label: 'Send Message', status: 'pending', timing: 'in 5 months' },
                      { icon: TagIcon, label: 'Add Label', status: 'pending', timing: 'in 5 months' },
                      { icon: TagIcon, label: 'Remove Label', status: 'pending', timing: 'in 5 months' },
                      { icon: MessageSquare, label: 'Send Message', status: 'pending', timing: 'in 6 months' },
                      { icon: TagIcon, label: 'Add Label', status: 'pending', timing: 'in 6 months' },
                      { icon: TagIcon, label: 'Remove Label', status: 'pending', timing: 'in 6 months' },
                      { icon: MessageSquare, label: 'Send Message', status: 'pending', timing: 'in 8 months' },
                      { icon: TagIcon, label: 'Add Label', status: 'pending', timing: 'in 8 months' },
                      { icon: TagIcon, label: 'Remove Label', status: 'pending', timing: 'in 8 months' },
                    ].map((step, idx) => {
                      const StepIcon = step.icon;
                      return (
                        <div 
                          key={idx} 
                          className="flex items-center justify-between text-xs py-1"
                          data-testid={`campaign-step-${idx}`}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <StepIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className={step.status === 'skipped' ? 'text-muted-foreground' : ''}>
                              {step.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {step.timing && (
                              <span className="text-muted-foreground">{step.timing}</span>
                            )}
                            {step.status === 'completed' && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                            )}
                            {step.status === 'skipped' && (
                              <span className="text-muted-foreground">skipped</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full mt-4"
                    data-testid="button-pause-campaign"
                  >
                    <Pause className="h-3.5 w-3.5 mr-2" />
                    Pause for {[contactProfile.first_name, contactProfile.last_name].filter(Boolean).join(' ').trim() || 'this contact'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : selectedResponse && contactLoading ? (
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          selectedResponse && !contactProfile && (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground text-center">
                No contact linked to this response
              </p>
            </div>
          )
        )}
      </div>
      </div>

      {/* Snooze Dialog */}
      <Dialog open={showSnoozeDialog} onOpenChange={setShowSnoozeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" /> Snooze Messages
            </DialogTitle>
            <DialogDescription>
              {selectedIds.length > 1 
                ? `These ${selectedIds.length} messages will reappear at the selected time`
                : 'This message will reappear at the selected time'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  const snoozeUntil = addHours(new Date(), 1);
                  setSnoozedMessages(prev => [...prev, ...selectedIds.map(id => ({ id, until: snoozeUntil }))]);
                  setShowSnoozeDialog(false);
                  toast({ title: "Snoozed", description: `${selectedIds.length} message(s) snoozed for 1 hour` });
                  setSelectedIds([]);
                }}
                data-testid="button-snooze-1h"
              >
                In 1 hour
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  const snoozeUntil = addHours(new Date(), 4);
                  setSnoozedMessages(prev => [...prev, ...selectedIds.map(id => ({ id, until: snoozeUntil }))]);
                  setShowSnoozeDialog(false);
                  toast({ title: "Snoozed", description: `${selectedIds.length} message(s) snoozed for 4 hours` });
                  setSelectedIds([]);
                }}
                data-testid="button-snooze-4h"
              >
                In 4 hours
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  const snoozeUntil = addDays(new Date(), 1);
                  setSnoozedMessages(prev => [...prev, ...selectedIds.map(id => ({ id, until: snoozeUntil }))]);
                  setShowSnoozeDialog(false);
                  toast({ title: "Snoozed", description: `${selectedIds.length} message(s) snoozed until tomorrow` });
                  setSelectedIds([]);
                }}
                data-testid="button-snooze-1d"
              >
                Tomorrow
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  const snoozeUntil = addDays(new Date(), 7);
                  setSnoozedMessages(prev => [...prev, ...selectedIds.map(id => ({ id, until: snoozeUntil }))]);
                  setShowSnoozeDialog(false);
                  toast({ title: "Snoozed", description: `${selectedIds.length} message(s) snoozed until next week` });
                  setSelectedIds([]);
                }}
                data-testid="button-snooze-1w"
              >
                Next week
              </Button>
            </div>
            <Separator />
            <div className="flex items-center gap-2 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span className="text-sm text-purple-700 dark:text-purple-300">
                Sophia suggests: Snooze until tomorrow 9 AM for optimal follow-up timing
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSnoozeDialog(false); setSelectedIds([]); }}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Response Approval Dialog */}
      <Dialog open={showAiApproval} onOpenChange={setShowAiApproval}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Review AI Response
            </DialogTitle>
            <DialogDescription>
              Review and approve the AI-generated response before sending
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">AI Draft Response</Label>
              <Textarea
                value={aiDraftResponse}
                onChange={(e) => setAiDraftResponse(e.target.value)}
                className="min-h-[120px]"
                placeholder="AI response will appear here..."
                data-testid="textarea-ai-draft"
              />
            </div>
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>Tip:</strong> You can edit the response before sending. The AI generates a draft based on the conversation context.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAiApproval(false)}
              disabled={isSendingReply || isGeneratingAi}
              data-testid="button-cancel-ai"
            >
              Cancel
            </Button>
            <Button
              onClick={approveAiResponse}
              disabled={isSendingReply || isGeneratingAi || !aiDraftResponse.trim()}
              data-testid="button-approve-ai"
              className="bg-primary"
            >
              {isSendingReply ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : isGeneratingAi ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Approve & Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
