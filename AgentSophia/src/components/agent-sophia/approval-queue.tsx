import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Mail, 
  MessageSquare, 
  Calendar,
  Edit,
  Eye,
  ChevronRight
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
}

export function ApprovalQueue() {
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPendingActions();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadPendingActions, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingActions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      console.log('🔍 Loading pending approvals for user:', user.id);

      // Load from followup_queue with status 'pending' (no join - use metadata)
      const { data: queue, error: queueError } = await supabase
        .from('followup_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Load from meeting_approvals with status 'pending' (no join - use metadata)
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_approvals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      console.log('📋 Follow-up queue:', queue?.length || 0, 'items');
      console.log('📅 Meeting approvals:', meetings?.length || 0, 'items');
      if (queueError) console.error('❌ Error fetching queue:', queueError);
      if (meetingsError) console.error('❌ Error fetching meetings:', meetingsError);

      const allActions: PendingAction[] = [];

      // Format follow-up queue items
      if (queue) {
        const formatted = queue.map(item => ({
          id: item.id,
          type: 'email' as any,
          contact_name: item.metadata?.prospect_name || item.metadata?.prospect_email || 'Unknown Contact',
          contact_email: item.metadata?.prospect_email,
          message: item.suggested_message || item.message_content || '',
          ai_reasoning: item.metadata?.ai_reasoning || item.ai_reasoning || 'AI recommended this action',
          confidence: Math.round((item.metadata?.confidence_score || item.confidence_score || 0.85) * 100),
          created_at: item.created_at,
          scheduled_for: item.scheduled_for,
        }));
        allActions.push(...formatted);
      }

      // Format meeting approvals
      if (meetings) {
        const formatted = meetings.map(item => ({
          id: `meeting-${item.id}`,
          type: 'meeting' as any,
          contact_name: item.metadata?.prospect_name || item.metadata?.prospect_email || 'Unknown Contact',
          contact_email: item.metadata?.prospect_email,
          message: `Meeting: ${item.suggested_subject || item.subject || 'Untitled Meeting'}`,
          ai_reasoning: item.metadata?.ai_reasoning || item.ai_reasoning || 'AI recommended scheduling a meeting',
          confidence: Math.round((item.metadata?.confidence_score || item.confidence_score || 0.85) * 100),
          created_at: item.created_at,
          scheduled_for: item.suggested_time,
        }));
        allActions.push(...formatted);
      }

      // Sort by created_at descending
      allActions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      console.log('✅ Total pending actions:', allActions.length);
      setPendingActions(allActions);
    } catch (error) {
      console.error('Error loading pending actions:', error);
    }
  };

  const openPreview = (action: PendingAction) => {
    setSelectedAction(action);
    setEditedMessage(action.message);
  };

  const closePreview = () => {
    setSelectedAction(null);
    setEditedMessage("");
  };

  const approveAction = async () => {
    if (!selectedAction) return;
    setIsApproving(true);

    try {
      // Update message if edited
      if (editedMessage !== selectedAction.message) {
        await supabase
          .from('followup_queue')
          .update({
            message_content: editedMessage,
            status: 'approved',
          })
          .eq('id', selectedAction.id);
      } else {
        await supabase
          .from('followup_queue')
          .update({ status: 'approved' })
          .eq('id', selectedAction.id);
      }

      toast({
        title: "Action Approved",
        description: "Agent Sophia will execute this action in the next cycle.",
      });

      loadPendingActions();
      closePreview();
    } catch (error) {
      toast({
        title: "Approval Failed",
        description: "Could not approve action. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const rejectAction = async () => {
    if (!selectedAction) return;

    try {
      await supabase
        .from('followup_queue')
        .update({ status: 'rejected' })
        .eq('id', selectedAction.id);

      toast({
        title: "Action Rejected",
        description: "This action has been cancelled.",
      });

      loadPendingActions();
      closePreview();
    } catch (error) {
      toast({
        title: "Rejection Failed",
        description: "Could not reject action. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'linkedin_message': return MessageSquare;
      case 'meeting': return Calendar;
      default: return Mail;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'linkedin_message': return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
      case 'meeting': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (pendingActions.length === 0) {
    return (
      <Card data-testid="card-approval-queue">
        <CardHeader>
          <CardTitle>Approval Queue</CardTitle>
          <CardDescription>
            Review and approve Agent Sophia's proposed actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>All caught up!</strong> No actions pending your approval.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="card-approval-queue">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Approval Queue</CardTitle>
              <CardDescription>
                {pendingActions.length} {pendingActions.length === 1 ? 'action' : 'actions'} pending your approval
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {pendingActions.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingActions.map((action) => {
              const Icon = getIcon(action.type);
              return (
                <div
                  key={action.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-all cursor-pointer"
                  onClick={() => openPreview(action)}
                  data-testid={`pending-action-${action.id}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`p-3 rounded-lg ${getTypeColor(action.type)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{action.contact_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {action.confidence}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {action.message}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{new Date(action.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview/Edit Dialog */}
      <Dialog open={!!selectedAction} onOpenChange={closePreview}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review Action</DialogTitle>
            <DialogDescription>
              Review, edit, and approve or reject this proposed action
            </DialogDescription>
          </DialogHeader>

          {selectedAction && (
            <div className="space-y-4">
              {/* Contact Info */}
              <div className="p-4 bg-secondary/30 rounded-lg">
                <div className="text-sm text-muted-foreground">Contact</div>
                <div className="font-semibold text-lg">{selectedAction.contact_name}</div>
                {selectedAction.contact_email && (
                  <div className="text-sm text-muted-foreground">{selectedAction.contact_email}</div>
                )}
              </div>

              {/* AI Reasoning */}
              <div>
                <Label className="text-sm font-medium">AI Reasoning</Label>
                <p className="text-sm text-muted-foreground mt-1 p-3 bg-secondary/30 rounded">
                  {selectedAction.ai_reasoning}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">
                    {selectedAction.confidence}% confidence
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {selectedAction.type.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {/* Message */}
              <div>
                <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Message (Editable)
                </Label>
                <Textarea
                  value={editedMessage}
                  onChange={(e) => setEditedMessage(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                  data-testid="textarea-edit-message"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  You can edit this message before approving
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={rejectAction}
              data-testid="button-reject-action"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={approveAction}
              disabled={isApproving}
              data-testid="button-approve-action"
            >
              {isApproving ? (
                <>Processing...</>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Send
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}
