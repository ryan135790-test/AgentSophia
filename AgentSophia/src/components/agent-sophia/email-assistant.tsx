import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mail,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Edit,
  Trash2,
  RefreshCw,
  Sparkles,
  Clock,
  User,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { getValidAccessToken, getOffice365ConfigSync } from "@/lib/office365-auth";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface Email {
  id: string;
  subject: string;
  from: {
    name: string;
    email: string;
  };
  receivedAt: string;
  preview: string;
  body?: string;
  isRead: boolean;
  hasAttachments: boolean;
}

interface DraftReply {
  emailId: string;
  subject: string;
  to: string;
  generatedReply: string;
  editedReply?: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface EmailAssistantProps {
  onEmailSelect?: (email: Email | null) => void;
}

export function EmailAssistant({ onEmailSelect }: EmailAssistantProps = {}) {
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [drafts, setDrafts] = useState<Map<string, DraftReply>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  // Fetch emails from Office 365 with automatic token refresh (workspace-scoped)
  const { data: emailsData, isLoading: isLoadingEmails, error: emailsError, refetch: refetchEmails } = useQuery({
    queryKey: ['/api/office365/inbox', workspaceId],
    queryFn: async () => {
      // Get valid access token for this workspace (automatically refreshes if expired)
      const accessToken = await getValidAccessToken(workspaceId);
      if (!accessToken) throw new Error('Not connected to Office 365. Please reconnect.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Get user session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated. Please log in.');

      const response = await fetch(
        `${supabaseUrl}/functions/v1/office365-read-inbox`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken,
            maxResults: 20,
            unreadOnly: false,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email fetch error:', response.status, errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          throw new Error(`Failed to fetch emails: ${response.status} ${errorText}`);
        }
        throw new Error(errorData.error || `Failed to fetch emails: ${response.status}`);
      }

      const result = await response.json();
      console.log('Emails loaded successfully:', result);
      return result;
    },
    enabled: !!workspaceId && !!getOffice365ConfigSync(workspaceId),
  });

  // Generate AI reply for an email
  const generateReply = async (email: Email) => {
    setIsGenerating(true);
    try {
      // Check connection
      if (!getOffice365ConfigSync(workspaceId)) throw new Error('Not connected to Office 365');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Use AI assistant to generate reply
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          message: `Generate a professional email reply to this email:\n\nSubject: ${email.subject}\nFrom: ${email.from.name} <${email.from.email}>\n\n${email.preview}\n\nGenerate ONLY the email reply body, no subject line or metadata.`,
          context: {
            type: 'email_reply',
            emailSubject: email.subject,
            senderName: email.from.name,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate reply');
      }

      const data = await response.json();
      const generatedReply = data.response || data.message || 'Failed to generate reply';

      // Add to drafts
      const draft: DraftReply = {
        emailId: email.id,
        subject: `Re: ${email.subject}`,
        to: email.from.email,
        generatedReply,
        status: 'pending',
      };

      setDrafts(new Map(drafts.set(email.id, draft)));
      
      toast({
        title: "Reply Generated!",
        description: "AI has generated a draft reply. Review and approve to send.",
      });

    } catch (error) {
      console.error('Generate reply error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate reply",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Send approved email
  const sendEmailMutation = useMutation({
    mutationFn: async ({ draft, finalBody }: { draft: DraftReply; finalBody: string }) => {
      // Get valid access token for this workspace (automatically refreshes if expired)
      const accessToken = await getValidAccessToken(workspaceId);
      if (!accessToken) throw new Error('Not connected to Office 365. Please reconnect.');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/office365-send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          accessToken,
          to: draft.to,
          subject: draft.subject,
          body: finalBody,
          bodyType: 'text',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send email');
      }

      return response.json();
    },
    onSuccess: (_, { draft }) => {
      toast({
        title: "Email Sent!",
        description: `Reply sent to ${draft.to}`,
      });
      
      // Remove from drafts
      const newDrafts = new Map(drafts);
      newDrafts.delete(draft.emailId);
      setDrafts(newDrafts);
      
      // Refresh emails
      refetchEmails();
    },
    onError: (error) => {
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send email",
        variant: "destructive",
      });
    },
  });

  const config = getOffice365ConfigSync(workspaceId);
  const emails = emailsData?.emails || [];
  const unreadEmails = emails.filter((e: Email) => !e.isRead);

  // Show error toast when email fetching fails
  useEffect(() => {
    if (emailsError) {
      toast({
        title: "Failed to Load Emails",
        description: emailsError instanceof Error ? emailsError.message : "Could not fetch emails. Please check your Office 365 connection.",
        variant: "destructive",
      });
    }
  }, [emailsError, toast]);

  if (!config) {
    return (
      <Alert>
        <Mail className="h-4 w-4" />
        <AlertDescription>
          Please connect your Office 365 account first to use the Email Assistant.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span>Agent Sophia - Email Assistant</span>
              </CardTitle>
              <CardDescription>
                AI-powered email management with approval workflow
              </CardDescription>
            </div>
            <Button
              onClick={() => refetchEmails()}
              disabled={isLoadingEmails}
              variant="outline"
              size="sm"
              data-testid="button-refresh-emails"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingEmails ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{emails.length}</p>
              <p className="text-sm text-muted-foreground">Total Emails</p>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{unreadEmails.length}</p>
              <p className="text-sm text-muted-foreground">Unread</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{drafts.size}</p>
              <p className="text-sm text-muted-foreground">Draft Replies</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Tabs */}
      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inbox" data-testid="tab-inbox">
            <Mail className="h-4 w-4 mr-2" />
            Inbox ({unreadEmails.length})
          </TabsTrigger>
          <TabsTrigger value="drafts" data-testid="tab-drafts">
            <Edit className="h-4 w-4 mr-2" />
            Pending Approvals ({drafts.size})
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Inbox</CardTitle>
              <CardDescription>Recent emails from your Office 365 account</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEmails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : emailsError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Failed to load emails. Please refresh or reconnect your Office 365 account.
                  </AlertDescription>
                </Alert>
              ) : emails.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No emails found</p>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2">
                    {emails.map((email: Email) => (
                      <div
                        key={email.id}
                        className={`p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors ${
                          selectedEmail?.id === email.id ? 'border-primary bg-muted/50' : ''
                        } ${!email.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
                        onClick={() => {
                          setSelectedEmail(email);
                          onEmailSelect?.(email);
                        }}
                        data-testid={`email-item-${email.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <p className="font-medium truncate">{email.from.name}</p>
                              {!email.isRead && (
                                <Badge variant="secondary" className="ml-2">New</Badge>
                              )}
                            </div>
                            <p className="font-semibold text-sm mb-1 truncate">{email.subject}</p>
                            <p className="text-sm text-muted-foreground line-clamp-2">{email.preview}</p>
                          </div>
                          <div className="flex flex-col items-end space-y-2 ml-4">
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(email.receivedAt).toLocaleDateString()}
                            </div>
                            {!drafts.has(email.id) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  generateReply(email);
                                }}
                                disabled={isGenerating}
                                data-testid={`button-generate-reply-${email.id}`}
                              >
                                <Sparkles className="h-3 w-3 mr-1" />
                                Generate Reply
                              </Button>
                            )}
                            {drafts.has(email.id) && (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Draft Ready
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Drafts Tab */}
        <TabsContent value="drafts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Review and approve AI-generated replies before sending</CardDescription>
            </CardHeader>
            <CardContent>
              {drafts.size === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No pending drafts. Generate a reply from the Inbox tab.
                </p>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-6">
                    {Array.from(drafts.entries()).map(([emailId, draft]) => (
                      <DraftApproval
                        key={emailId}
                        draft={draft}
                        email={emails.find((e: Email) => e.id === emailId)}
                        onApprove={(finalBody) => sendEmailMutation.mutate({ draft, finalBody })}
                        onReject={() => {
                          const newDrafts = new Map(drafts);
                          newDrafts.delete(emailId);
                          setDrafts(newDrafts);
                          toast({
                            title: "Draft Rejected",
                            description: "The draft has been discarded.",
                          });
                        }}
                        onEdit={(editedReply) => {
                          const newDrafts = new Map(drafts);
                          newDrafts.set(emailId, { ...draft, editedReply });
                          setDrafts(newDrafts);
                        }}
                        isSending={sendEmailMutation.isPending}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Draft Approval Component
function DraftApproval({
  draft,
  email,
  onApprove,
  onReject,
  onEdit,
  isSending,
}: {
  draft: DraftReply;
  email?: Email;
  onApprove: (finalBody: string) => void;
  onReject: () => void;
  onEdit: (editedReply: string) => void;
  isSending: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(draft.editedReply || draft.generatedReply);

  const finalReply = draft.editedReply || draft.generatedReply;

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              To: {draft.to}
            </Badge>
            {draft.editedReply && (
              <Badge variant="secondary" className="text-xs">
                <Edit className="h-3 w-3 mr-1" />
                Edited
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg">{draft.subject}</CardTitle>
          {email && (
            <p className="text-sm text-muted-foreground">
              In reply to: {email.subject}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Original Email Context */}
        {email && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Original Email:</p>
            <p className="text-sm">{email.preview}</p>
          </div>
        )}

        <Separator />

        {/* AI Generated Reply */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">AI-Generated Reply:</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              data-testid="button-toggle-edit"
            >
              <Edit className="h-4 w-4 mr-1" />
              {isEditing ? 'Preview' : 'Edit'}
            </Button>
          </div>
          {isEditing ? (
            <Textarea
              value={editedText}
              onChange={(e) => {
                setEditedText(e.target.value);
                onEdit(e.target.value);
              }}
              className="min-h-[200px] font-mono text-sm"
              data-testid="textarea-edit-reply"
            />
          ) : (
            <div className="p-4 bg-white dark:bg-gray-900 border rounded-lg whitespace-pre-wrap text-sm">
              {finalReply}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-2 pt-4">
          <Button
            variant="outline"
            onClick={onReject}
            disabled={isSending}
            data-testid="button-reject-draft"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
          <Button
            onClick={() => onApprove(finalReply)}
            disabled={isSending}
            data-testid="button-approve-send"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Approve & Send
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
