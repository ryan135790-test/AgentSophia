import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ContactProfileView } from "./contact-profile-view";
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Linkedin, 
  Share2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertCircle,
  Calendar,
  Coffee,
  Archive,
  Trash2,
  Eye,
  EyeOff,
  Sparkles
} from "lucide-react";
import { useInboxResponses, useMarkAsRead, useUpdateResponseIntent, useDeleteResponse, useClassifyIntent } from "@/hooks/use-inbox";
import { CampaignResponse } from "../../../shared/schema";
import { format } from "date-fns";
import { mockInboxResponses } from "@/hooks/use-mock-inbox-data";

const channelIcons = {
  linkedin: Linkedin,
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  social: Share2,
};

const intentIcons = {
  interested: CheckCircle2,
  not_interested: XCircle,
  question: HelpCircle,
  objection: AlertCircle,
  meeting_request: Calendar,
  out_of_office: Coffee,
  other: HelpCircle,
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
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedIntent, setSelectedIntent] = useState<string>("all");
  const [selectedResponse, setSelectedResponse] = useState<CampaignResponse | null>(null);

  const { data: dbResponses, isLoading, error } = useInboxResponses(
    selectedChannel !== "all" || selectedIntent !== "all" 
      ? {
          ...(selectedChannel !== "all" && { channel: selectedChannel }),
          ...(selectedIntent !== "all" && { intent_tag: selectedIntent }),
        }
      : undefined
  );

  // Use mock data if database isn't set up yet or query fails
  const useMockData = !!error || !dbResponses;
  
  let responses = useMockData ? mockInboxResponses : dbResponses;
  
  // Apply filters to mock data if needed
  if (useMockData) {
    if (selectedChannel !== "all") {
      responses = responses?.filter(r => r.channel === selectedChannel);
    }
    if (selectedIntent !== "all") {
      responses = responses?.filter(r => r.intent_tag === selectedIntent);
    }
  }

  const markAsRead = useMarkAsRead();
  const updateIntent = useUpdateResponseIntent();
  const deleteResponse = useDeleteResponse();
  const classifyIntent = useClassifyIntent();

  const handleResponseClick = (response: CampaignResponse) => {
    setSelectedResponse(response);
    // Only try to update if not using mock data
    if (!useMockData && !response.is_read) {
      markAsRead.mutate({ id: response.id, is_read: true });
    }
  };

  const handleReclassify = async (response: CampaignResponse) => {
    const result = await classifyIntent.mutateAsync({
      message_content: response.message_content,
      channel: response.channel,
      sender_name: response.sender_name,
    });

    if (result) {
      updateIntent.mutate({
        id: response.id,
        intent_tag: result.intent_tag,
        confidence_score: result.confidence_score,
      });
    }
  };

  const unreadCount = responses?.filter(r => !r.is_read).length || 0;
  const interestedCount = responses?.filter(r => r.intent_tag === 'interested').length || 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Unified Inbox</h2>
          <p className="text-muted-foreground">
            All campaign responses in one place with AI-powered intent classification
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-base" data-testid="badge-unread-count">
            {unreadCount} Unread
          </Badge>
          <Badge variant="default" className="bg-green-500 text-base" data-testid="badge-interested-count">
            {interestedCount} Interested
          </Badge>
        </div>
      </div>

      {useMockData && (
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Demo Mode:</strong> Showing sample responses. To see real data, run the database migration: <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">supabase/migrations/campaign_responses_table.sql</code>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-4">
        <Select value={selectedChannel} onValueChange={setSelectedChannel}>
          <SelectTrigger className="w-48" data-testid="select-channel">
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="phone">Phone</SelectItem>
            <SelectItem value="social">Social Media</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedIntent} onValueChange={setSelectedIntent}>
          <SelectTrigger className="w-48" data-testid="select-intent">
            <SelectValue placeholder="All Intent Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Intent Tags</SelectItem>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="not_interested">Not Interested</SelectItem>
            <SelectItem value="question">Question</SelectItem>
            <SelectItem value="objection">Objection</SelectItem>
            <SelectItem value="meeting_request">Meeting Request</SelectItem>
            <SelectItem value="out_of_office">Out of Office</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4">
        {/* Response List */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle>Responses</CardTitle>
            <CardDescription>
              {responses?.length || 0} total responses
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-20rem)]">
              {isLoading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Loading responses...
                </div>
              ) : responses && responses.length > 0 ? (
                <div className="divide-y">
                  {responses.map((response) => {
                    const ChannelIcon = channelIcons[response.channel];
                    const IntentIcon = intentIcons[response.intent_tag];
                    const intentColor = intentColors[response.intent_tag];

                    return (
                      <div
                        key={response.id}
                        onClick={() => handleResponseClick(response)}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedResponse?.id === response.id ? "bg-muted" : ""
                        } ${!response.is_read ? "border-l-4 border-l-blue-500" : ""}`}
                        data-testid={`response-item-${response.id}`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <ChannelIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">
                              {response.sender_name}
                            </span>
                          </div>
                          {!response.is_read && (
                            <div className="h-2 w-2 bg-blue-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {response.message_content}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge className={`${intentColor} text-white text-xs`}>
                            <IntentIcon className="h-3 w-3 mr-1" />
                            {response.intent_tag.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {response.responded_at 
                              ? format(new Date(response.responded_at), 'MMM d, h:mm a')
                              : format(new Date(response.created_at), 'MMM d, h:mm a')
                            }
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No responses yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Responses from your campaigns will appear here
                  </p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Response Detail */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Response Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedResponse ? (
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {(() => {
                      const ChannelIcon = channelIcons[selectedResponse.channel];
                      return <ChannelIcon className="h-6 w-6 text-muted-foreground" />;
                    })()}
                    <div>
                      <h3 className="text-xl font-semibold" data-testid="text-sender-name">
                        {selectedResponse.sender_name}
                      </h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-sender-identifier">
                        {selectedResponse.sender_identifier}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReclassify(selectedResponse)}
                      disabled={useMockData || classifyIntent.isPending}
                      data-testid="button-reclassify"
                      title={useMockData ? "Actions disabled in demo mode" : ""}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {classifyIntent.isPending ? "Analyzing..." : "Reclassify"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsRead.mutate({ 
                        id: selectedResponse.id, 
                        is_read: !selectedResponse.is_read 
                      })}
                      disabled={useMockData}
                      data-testid="button-toggle-read"
                      title={useMockData ? "Actions disabled in demo mode" : ""}
                    >
                      {selectedResponse.is_read ? (
                        <><EyeOff className="h-4 w-4 mr-2" /> Mark Unread</>
                      ) : (
                        <><Eye className="h-4 w-4 mr-2" /> Mark Read</>
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        deleteResponse.mutate(selectedResponse.id);
                        setSelectedResponse(null);
                      }}
                      disabled={useMockData}
                      data-testid="button-delete"
                      title={useMockData ? "Actions disabled in demo mode" : ""}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Intent Classification</h4>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const IntentIcon = intentIcons[selectedResponse.intent_tag];
                      const intentColor = intentColors[selectedResponse.intent_tag];
                      return (
                        <>
                          <Badge className={`${intentColor} text-white`}>
                            <IntentIcon className="h-4 w-4 mr-2" />
                            {selectedResponse.intent_tag.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Confidence: {(selectedResponse.confidence_score * 100).toFixed(0)}%
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-2">Message</h4>
                  <Card>
                    <CardContent className="pt-6">
                      <p className="whitespace-pre-wrap" data-testid="text-message-content">
                        {selectedResponse.message_content}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Channel</h4>
                    <p className="text-sm text-muted-foreground capitalize">
                      {selectedResponse.channel}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Received</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedResponse.responded_at 
                        ? format(new Date(selectedResponse.responded_at), 'PPpp')
                        : format(new Date(selectedResponse.created_at), 'PPpp')
                      }
                    </p>
                  </div>
                  {selectedResponse.campaign_id && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Campaign</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedResponse.campaign_id}
                      </p>
                    </div>
                  )}
                </div>

                <Separator className="my-6" />

                {/* Contact Profile */}
                <ContactProfileView contactId={selectedResponse.contact_id} />
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Select a response to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
