import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Edit2,
  Mail,
  Linkedin,
  MessageSquare,
  Phone,
  Calendar,
  Sparkles,
  Clock,
  AlertCircle,
  ChevronRight,
  Loader2,
  Send,
  RefreshCw,
  Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

interface PendingResponse {
  id: string;
  type: 'email' | 'linkedin' | 'sms' | 'meeting';
  contactName: string;
  contactEmail: string;
  originalMessage: string;
  aiDraftResponse: string;
  confidence: number;
  intent: string;
  channel: string;
  createdAt: string;
  metadata?: any;
}

const channelIcons: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  sms: MessageSquare,
  phone: Phone,
  meeting: Calendar,
};

const intentColors: Record<string, string> = {
  interested: 'bg-green-500',
  question: 'bg-blue-500',
  meeting_request: 'bg-purple-500',
  objection: 'bg-orange-500',
  not_interested: 'bg-red-500',
  out_of_office: 'bg-gray-500',
};

export function PendingApprovalsPanel() {
  const { toast } = useToast();
  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<PendingResponse | null>(null);
  const [editedDraft, setEditedDraft] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);

  useEffect(() => {
    loadPendingResponses();
    const interval = setInterval(loadPendingResponses, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingResponses = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: queue, error } = await supabase
        .from('followup_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          console.warn('followup_queue table not found');
          setPendingResponses([]);
          return;
        }
        throw error;
      }

      const mapped: PendingResponse[] = (queue || []).map(item => ({
        id: item.id,
        type: item.channel || 'email',
        contactName: item.contact_name || 'Unknown Contact',
        contactEmail: item.contact_email || '',
        originalMessage: (item.metadata as any)?.original_message || '',
        aiDraftResponse: item.message_content || '',
        confidence: (item.metadata as any)?.confidence || 85,
        intent: (item.metadata as any)?.intent || 'question',
        channel: item.channel || 'email',
        createdAt: item.created_at,
        metadata: item.metadata,
      }));

      setPendingResponses(mapped);
    } catch (error) {
      console.error('Error loading pending responses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = (response: PendingResponse) => {
    setSelectedResponse(response);
    setEditedDraft(response.aiDraftResponse);
    setShowReviewDialog(true);
  };

  const handleApprove = async () => {
    if (!selectedResponse) return;
    
    setIsProcessing(true);
    try {
      await supabase
        .from('followup_queue')
        .update({ 
          status: 'approved',
          message_content: editedDraft,
          metadata: {
            ...(selectedResponse.metadata || {}),
            approved_at: new Date().toISOString(),
            final_message: editedDraft,
          }
        })
        .eq('id', selectedResponse.id);

      toast({
        title: "Response Approved",
        description: `Your ${selectedResponse.channel} response has been queued for sending`,
      });

      setPendingResponses(prev => prev.filter(r => r.id !== selectedResponse.id));
      setShowReviewDialog(false);
      setSelectedResponse(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve response",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedResponse) return;
    
    setIsProcessing(true);
    try {
      await supabase
        .from('followup_queue')
        .update({ 
          status: 'rejected',
          metadata: {
            ...(selectedResponse.metadata || {}),
            rejected_at: new Date().toISOString(),
          }
        })
        .eq('id', selectedResponse.id);

      toast({
        title: "Response Rejected",
        description: "The AI draft has been discarded",
      });

      setPendingResponses(prev => prev.filter(r => r.id !== selectedResponse.id));
      setShowReviewDialog(false);
      setSelectedResponse(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject response",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (pendingResponses.length === 0) return;
    
    setIsProcessing(true);
    try {
      const ids = pendingResponses.map(r => r.id);
      await supabase
        .from('followup_queue')
        .update({ status: 'approved' })
        .in('id', ids);

      toast({
        title: "All Responses Approved",
        description: `${pendingResponses.length} responses have been approved and queued`,
      });

      setPendingResponses([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to approve responses",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
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

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Pending Approvals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Pending Approvals
              {pendingResponses.length > 0 && (
                <Badge variant="secondary">{pendingResponses.length}</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadPendingResponses}
                data-testid="button-refresh-approvals"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              {pendingResponses.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={isProcessing}
                  data-testid="button-bulk-approve"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Approve All
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {pendingResponses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No pending approvals</p>
              <p className="text-xs mt-1">Sophia's drafts will appear here for review</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {pendingResponses.map((response) => {
                  const ChannelIcon = channelIcons[response.channel] || Mail;
                  return (
                    <div
                      key={response.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleReview(response)}
                      data-testid={`pending-response-${response.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="text-xs">
                            {getInitials(response.contactName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm truncate">
                              {response.contactName}
                            </span>
                            <div className="flex items-center gap-2">
                              <ChannelIcon className="h-3 w-3 text-muted-foreground" />
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${intentColors[response.intent] || 'bg-slate-500'} text-white`}
                              >
                                {response.intent.replace('_', ' ')}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {response.aiDraftResponse}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(response.createdAt), { addSuffix: true })}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                {response.confidence}% confident
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Review AI Response
            </DialogTitle>
            <DialogDescription>
              Review and edit Sophia's draft before sending
            </DialogDescription>
          </DialogHeader>
          
          {selectedResponse && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {getInitials(selectedResponse.contactName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedResponse.contactName}</p>
                    <p className="text-sm text-muted-foreground">{selectedResponse.contactEmail}</p>
                  </div>
                  <Badge className={`ml-auto ${intentColors[selectedResponse.intent]} text-white`}>
                    {selectedResponse.intent.replace('_', ' ')}
                  </Badge>
                </div>
                
                {selectedResponse.originalMessage && (
                  <>
                    <Separator className="my-3" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Original Message:</p>
                      <p className="text-sm bg-background p-3 rounded-lg">
                        {selectedResponse.originalMessage}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">Sophia's Draft Response:</p>
                  <Badge variant="outline">{selectedResponse.confidence}% confident</Badge>
                </div>
                <Textarea
                  value={editedDraft}
                  onChange={(e) => setEditedDraft(e.target.value)}
                  className="min-h-[150px]"
                  placeholder="Edit the response..."
                  data-testid="textarea-edit-draft"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isProcessing}
              data-testid="button-reject"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isProcessing || !editedDraft.trim()}
              data-testid="button-approve"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Approve & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
