import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  XCircle, 
  Mail, 
  MessageSquare, 
  Calendar,
  Edit3,
  Eye,
  Sparkles,
  Clock,
  TrendingUp,
  User,
  FileText,
  ArrowRight,
  RefreshCw
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PendingAction {
  id: string;
  type: 'email' | 'linkedin_message' | 'meeting' | 'followup';
  contact_name: string;
  contact_email?: string;
  subject?: string;
  message: string;
  ai_reasoning: string;
  confidence: number;
  created_at: string;
  scheduled_for?: string;
  original_email?: string;
  original_subject?: string;
  original_from?: string;
  decision_type?: string;
}

export function ImprovedApprovalQueue() {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPendingActions();
    const interval = setInterval(loadPendingActions, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingActions = async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: queue, error } = await supabase
        .from('followup_queue')
        .select(`
          *,
          contact:contacts(name, email)
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading pending actions:', error);
        if (showLoading) {
          toast({
            title: "Error",
            description: "Failed to load pending actions",
            variant: "destructive",
          });
        }
        return;
      }

      if (queue) {
        const formatted = queue.map(item => ({
          id: item.id,
          type: item.channel as any,
          contact_name: item.contact?.name || item.metadata?.prospect_name || item.contact?.email || 'Unknown Contact',
          contact_email: item.contact?.email || item.metadata?.prospect_email,
          message: item.message_content || item.suggested_message || '',
          ai_reasoning: item.metadata?.ai_reasoning || item.ai_reasoning || 'AI recommended this action',
          confidence: item.metadata?.confidence_score || item.metadata?.confidence || 85,
          created_at: item.created_at,
          scheduled_for: item.scheduled_for,
          subject: item.metadata?.subject,
          original_email: item.metadata?.original_email,
          original_subject: item.metadata?.original_subject,
          original_from: item.metadata?.original_from || item.contact?.email,
          decision_type: item.metadata?.decision_type,
        }));
        setPendingActions(formatted);
        
        if (showLoading) {
          toast({
            title: "✅ Refreshed",
            description: `Found ${formatted.length} pending action${formatted.length !== 1 ? 's' : ''}`,
          });
        }
      }
    } catch (error) {
      console.error('Error loading pending actions:', error);
      if (showLoading) {
        toast({
          title: "Error",
          description: "Failed to load pending actions",
          variant: "destructive",
        });
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const handleApprove = async (action: PendingAction, editedText?: string) => {
    setIsProcessing(true);
    try {
      const updates: any = { status: 'approved' };
      if (editedText && editedText !== action.message) {
        updates.message_content = editedText;
      }

      await supabase
        .from('followup_queue')
        .update(updates)
        .eq('id', action.id);

      toast({
        title: "✅ Approved!",
        description: "Agent Sophia will execute this action shortly.",
      });

      loadPendingActions();
      setSelectedAction(null);
      setEditedMessage("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve action",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (actionId: string) => {
    setIsProcessing(true);
    try {
      await supabase
        .from('followup_queue')
        .update({ status: 'rejected' })
        .eq('id', actionId);

      toast({
        title: "❌ Rejected",
        description: "Action cancelled successfully.",
      });

      loadPendingActions();
      setSelectedAction(null);
      setEditedMessage("");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject action",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'linkedin_message': return MessageSquare;
      case 'meeting': return Calendar;
      default: return MessageSquare;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-500';
      case 'linkedin_message': return 'bg-purple-500';
      case 'meeting': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getActionLabel = (type: string, decision_type?: string) => {
    if (decision_type === 'schedule_meeting' || decision_type === 'accept_meeting') {
      return 'Meeting Response';
    }
    if (decision_type === 'send_reply') {
      return 'Email Reply';
    }
    if (decision_type === 'send_followup') {
      return 'Follow-up Email';
    }
    
    switch (type) {
      case 'email': return 'Email';
      case 'linkedin_message': return 'LinkedIn Message';
      case 'meeting': return 'Meeting';
      default: return 'Action';
    }
  };

  if (pendingActions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                All Caught Up!
              </CardTitle>
              <CardDescription>
                No actions pending your approval right now
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadPendingActions(true)}
              disabled={isLoading}
              data-testid="button-refresh-queue"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Checking...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
            <AlertDescription>
              Agent Sophia will queue actions here for your review when she detects opportunities to respond to contacts, book meetings, or send follow-ups.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                Review & Approve
                <Badge variant="secondary" className="ml-2">
                  {pendingActions.length} pending
                </Badge>
              </CardTitle>
              <CardDescription>
                Agent Sophia has proposed these actions - review details and approve to execute
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadPendingActions(true)}
              disabled={isLoading}
              data-testid="button-refresh-queue"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Checking...' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingActions.map((action) => {
              const Icon = getActionIcon(action.type);
              const isExpanded = selectedAction?.id === action.id;
              const actionLabel = getActionLabel(action.type, action.decision_type);

              return (
                <div
                  key={action.id}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-all"
                  data-testid={`action-card-${action.id}`}
                >
                  {/* Collapsed View */}
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${getActionColor(action.type)} bg-opacity-10`}>
                        <Icon className={`h-5 w-5 ${getActionColor(action.type).replace('bg-', 'text-')}`} />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className="font-semibold">{action.contact_name}</h4>
                          <Badge variant="default" className={getActionColor(action.type)}>
                            {actionLabel}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {action.confidence}% confident
                          </Badge>
                        </div>

                        {action.contact_email && (
                          <p className="text-sm text-muted-foreground">{action.contact_email}</p>
                        )}

                        {action.subject && (
                          <div className="mt-1 flex items-center gap-2 text-sm">
                            <FileText className="h-3 w-3" />
                            <span className="font-medium">Re: {action.subject}</span>
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(action.created_at).toLocaleString()}</span>
                        </div>

                        {!isExpanded && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {action.message}
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAction(isExpanded ? null : action);
                            setEditedMessage(isExpanded ? "" : action.message);
                          }}
                          data-testid={`button-review-${action.id}`}
                        >
                          {isExpanded ? 'Collapse' : 'Review'}
                          <Eye className="h-4 w-4 ml-2" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded View */}
                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t pt-4">
                        {/* Original Email Context */}
                        {action.original_email && (
                          <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="original">
                              <AccordionTrigger className="text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-blue-600" />
                                  <span>View Original Message</span>
                                  {action.original_from && (
                                    <span className="text-muted-foreground text-xs">
                                      from {action.original_from}
                                    </span>
                                  )}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                                  {action.original_subject && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground">Subject:</span>
                                      <p className="text-sm font-medium">{action.original_subject}</p>
                                    </div>
                                  )}
                                  {action.original_from && (
                                    <div>
                                      <span className="text-xs font-medium text-muted-foreground">From:</span>
                                      <p className="text-sm">{action.original_from}</p>
                                    </div>
                                  )}
                                  <Separator />
                                  <div>
                                    <span className="text-xs font-medium text-muted-foreground">Message:</span>
                                    <p className="text-sm whitespace-pre-wrap mt-1">{action.original_email}</p>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}

                        {/* AI Reasoning */}
                        <div className="bg-purple-50 dark:bg-purple-950/20 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span className="font-medium text-sm">Why Sophia Recommends This</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{action.ai_reasoning}</p>
                        </div>

                        {/* What Sophia Will Do */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <span className="font-medium text-sm">What Sophia Will Do</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className={getActionColor(action.type)}>
                              {actionLabel}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {action.type === 'meeting' ? 'Book a meeting' : 'Send this message'} to {action.contact_name}
                            </span>
                          </div>
                        </div>

                        {/* Message Preview/Edit */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Edit3 className="h-4 w-4" />
                            <span className="font-medium text-sm">
                              {action.type === 'meeting' ? 'Meeting Details' : 'Message Content'}
                            </span>
                            <span className="text-xs text-muted-foreground">(Edit before approving if needed)</span>
                          </div>
                          <Textarea
                            value={editedMessage}
                            onChange={(e) => setEditedMessage(e.target.value)}
                            rows={8}
                            className="font-mono text-sm"
                            placeholder="Edit message here..."
                            data-testid={`textarea-edit-${action.id}`}
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            onClick={() => handleReject(action.id)}
                            disabled={isProcessing}
                            data-testid={`button-reject-${action.id}`}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject
                          </Button>
                          <Button
                            onClick={() => handleApprove(action, editedMessage)}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700"
                            data-testid={`button-approve-${action.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {isProcessing ? 'Approving...' : 'Approve & Execute'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
