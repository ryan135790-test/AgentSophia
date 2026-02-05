import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageEditorModal } from "@/components/message-editor/message-editor-modal";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Calendar,
  MessageSquare,
  Clock,
  TrendingUp,
  Sparkles,
  User,
  Building2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Eye,
  Send,
  ChevronLeft,
  ChevronRight,
  Zap,
  Target,
  CheckSquare,
  XSquare,
  Lightbulb,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, isToday, isThisWeek } from "date-fns";

interface PendingAction {
  id: string;
  type: 'email' | 'meeting' | 'followup';
  contactName: string;
  contactEmail: string;
  subject: string;
  message: string;
  originalEmail?: string;
  originalFrom?: string;
  originalSubject?: string;
  aiReasoning: string;
  confidence: number;
  urgency?: 'high' | 'medium' | 'low';
  intent?: string;
  createdAt: string;
  scheduledFor?: string;
  metadata?: any;
}

interface AutoBookedMeeting {
  id: string;
  contactName: string;
  subject: string;
  meetingTime: string;
  bookedAt: string;
  isInternal: boolean;
  metadata?: any;
}

type FilterType = 'all' | 'meetings' | 'replies' | 'followups';
type UrgencyFilter = 'all' | 'high' | 'medium' | 'low';

export function TriPaneApprovalWorkspace() {
  const { toast } = useToast();
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [selectedAction, setSelectedAction] = useState<PendingAction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Auto-booked meetings
  const [autoBookedMeetings, setAutoBookedMeetings] = useState<AutoBookedMeeting[]>([]);
  const [showAutoBooked, setShowAutoBooked] = useState(true);
  
  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  
  // Right pane tab selection
  const [rightPaneTab, setRightPaneTab] = useState<'compose' | 'context'>('compose');
  
  // Editable fields
  const [editedSubject, setEditedSubject] = useState('');
  const [editedMessage, setEditedMessage] = useState('');
  const [editedTone, setEditedTone] = useState('professional');
  const [scheduledTime, setScheduledTime] = useState('');
  
  // Keyboard shortcuts state
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Message editor modal state
  const [showMessageEditor, setShowMessageEditor] = useState(false);

  // Helper to select action (preserves current tab unless no action was selected before)
  const selectAction = (action: PendingAction | null, forceTab?: 'compose' | 'context') => {
    const wasNoSelection = !selectedAction;
    setSelectedAction(action);
    if (action) {
      // Only default to compose tab if we're switching from no selection, or if explicitly forced
      if (forceTab) {
        setRightPaneTab(forceTab);
      } else if (wasNoSelection) {
        setRightPaneTab('compose');
      }
      // Otherwise preserve the current tab (user might be in Context tab)
    }
  };

  useEffect(() => {
    loadActions();
    loadAutoBookedMeetings();
    const interval = setInterval(() => {
      loadActions();
      loadAutoBookedMeetings();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedAction) {
      setEditedSubject(selectedAction.subject || '');
      setEditedMessage(selectedAction.message || '');
      setScheduledTime(selectedAction.scheduledFor || '');
    }
  }, [selectedAction]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      
      const filtered = getFilteredAndSortedActions();
      
      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          if (selectedIndex < filtered.length - 1) {
            const newIndex = selectedIndex + 1;
            setSelectedIndex(newIndex);
            selectAction(filtered[newIndex]);
          }
          break;
        case 'k':
          e.preventDefault();
          if (selectedIndex > 0) {
            const newIndex = selectedIndex - 1;
            setSelectedIndex(newIndex);
            selectAction(filtered[newIndex]);
          }
          break;
        case 'a':
          e.preventDefault();
          if (selectedAction) handleApprove();
          break;
        case 'x':
          e.preventDefault();
          if (selectedAction) handleDecline();
          break;
        case 'enter':
          e.preventDefault();
          if (filtered[selectedIndex]) {
            selectAction(filtered[selectedIndex]);
          }
          break;
        case 'escape':
          e.preventDefault();
          selectAction(null);
          setSelectedIds(new Set());
          setIsBulkMode(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedIndex, selectedAction, actions, filterType, urgencyFilter, searchQuery]);

  const loadActions = async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query 1: Get pending followups from followup_queue
      const { data: queue, error: queueError } = await supabase
        .from('followup_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (queueError) {
        console.error('❌ Error loading followup queue:', queueError);
        throw queueError;
      }
      
      console.log('📧 Followup queue loaded:', { 
        count: queue?.length || 0,
        items: queue?.map(q => ({ 
          id: q.id, 
          type: q.channel,
          status: q.status,
          created: q.created_at 
        })) 
      });

      // Query 2: Get pending meeting approvals only (approved ones are done)
      const { data: meetings, error: meetingsError } = await supabase
        .from('meeting_approvals')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50);

      if (meetingsError) {
        console.error('❌ Error loading meetings:', meetingsError);
        throw meetingsError;
      }
      
      console.log('📅 Meeting approvals loaded:', { 
        count: meetings?.length || 0, 
        meetings: meetings?.map(m => ({ 
          id: m.id, 
          prospect: m.prospect_name,
          status: m.status,
          created: m.created_at 
        })) 
      });

      // Format followup_queue items
      const formattedQueue: PendingAction[] = (queue || []).map(item => {
        const rawConfidence = item.metadata?.confidence_score || item.metadata?.confidence;
        const confidence = rawConfidence 
          ? (rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence)
          : 85;
        
        return {
          id: item.id,
          type: item.channel === 'email' ? 'email' : item.channel === 'meeting' ? 'meeting' : 'followup',
          contactName: item.metadata?.prospect_name || item.metadata?.prospect_email || 'Unknown',
          contactEmail: item.metadata?.prospect_email || '',
          subject: item.metadata?.subject || 'Follow-up',
          message: item.message_content || item.suggested_message || item.content || '',
          originalEmail: item.metadata?.original_email,
          originalFrom: item.metadata?.original_from,
          originalSubject: item.metadata?.original_subject,
          aiReasoning: item.metadata?.ai_reasoning || item.ai_reasoning || 'AI recommended this action',
          confidence: Math.round(confidence),
          urgency: item.metadata?.urgency || 'medium',
          intent: item.metadata?.intent,
          createdAt: item.created_at,
          scheduledFor: item.scheduled_for,
          metadata: item.metadata,
        };
      });

      // Format meeting_approvals items
      const formattedMeetings: PendingAction[] = (meetings || []).map(item => {
        const rawConfidence = item.confidence || item.confidence_score;
        const confidence = rawConfidence 
          ? (typeof rawConfidence === 'string' ? parseFloat(rawConfidence) * 100 : rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence)
          : 90;
        
        return {
          id: item.id,
          type: 'meeting',
          contactName: item.prospect_name || item.prospect_email || 'Unknown',
          contactEmail: item.prospect_email || '',
          subject: item.suggested_subject || item.edited_subject || 'Meeting Request',
          message: item.suggested_description || item.edited_description || 
                   `Meeting scheduled for ${item.suggested_duration || item.duration_minutes || 30} minutes`,
          originalEmail: item.metadata?.original_email,
          originalFrom: item.prospect_email,
          originalSubject: item.subject,
          aiReasoning: item.ai_reasoning || 'AI detected a meeting opportunity',
          confidence: Math.round(confidence),
          urgency: item.status === 'approved' ? 'low' : 'high',
          intent: item.detected_intent || 'meeting_request',
          createdAt: item.created_at,
          scheduledFor: item.suggested_time || item.edited_time,
          metadata: {
            ...item.metadata,
            meeting_link: item.meeting_link,
            booked_at: item.booked_at,
            status: item.status,
            is_meeting_approval: true,
          },
        };
      });

      // Merge both sources and sort by createdAt descending (newest first)
      const allActions = [...formattedQueue, ...formattedMeetings];
      allActions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setActions(allActions);
      
      if (allActions.length > 0 && !selectedAction) {
        selectAction(allActions[0]);
      }
      
      if (showLoading) {
        toast({
          title: "✅ Refreshed",
          description: `Found ${allActions.length} item${allActions.length !== 1 ? 's' : ''} (${formattedQueue.length} followups, ${formattedMeetings.length} meetings)`,
        });
      }
    } catch (error) {
      console.error('Error loading actions:', error);
      if (showLoading) {
        toast({
          title: "Error",
          description: "Failed to load pending actions",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadAutoBookedMeetings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get auto-booked meetings from agent_activities (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: activities, error } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('activity_type', 'meeting_scheduled')
        .eq('metadata->>auto_executed', 'true')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading auto-booked meetings:', error);
        return;
      }

      const formatted: AutoBookedMeeting[] = (activities || []).map(activity => ({
        id: activity.id,
        contactName: activity.metadata?.contact_name || 'Unknown',
        subject: activity.outcome_details || 'Meeting scheduled',
        meetingTime: activity.metadata?.meeting_time || activity.created_at,
        bookedAt: activity.created_at,
        isInternal: activity.metadata?.is_internal || false,
        metadata: activity.metadata,
      }));

      console.log('📅 Auto-booked meetings loaded:', { count: formatted.length });
      setAutoBookedMeetings(formatted);
    } catch (error) {
      console.error('Error loading auto-booked meetings:', error);
    }
  };

  const getFilteredAndSortedActions = useCallback(() => {
    let filtered = actions.filter(action => {
      if (filterType === 'meetings' && action.type !== 'meeting') return false;
      if (filterType === 'replies' && action.type !== 'email') return false;
      if (filterType === 'followups' && action.type !== 'followup') return false;
      if (urgencyFilter !== 'all' && action.urgency !== urgencyFilter) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          action.contactName.toLowerCase().includes(query) ||
          action.contactEmail.toLowerCase().includes(query) ||
          action.subject.toLowerCase().includes(query) ||
          action.message.toLowerCase().includes(query)
        );
      }
      
      return true;
    });

    // Smart sort: high urgency first
    filtered.sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      const aUrgency = urgencyOrder[a.urgency || 'medium'];
      const bUrgency = urgencyOrder[b.urgency || 'medium'];
      if (aUrgency !== bUrgency) return aUrgency - bUrgency;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return filtered;
  }, [actions, filterType, urgencyFilter, searchQuery]);

  const getGroupedActions = useCallback(() => {
    const filtered = getFilteredAndSortedActions();
    const today: PendingAction[] = [];
    const thisWeek: PendingAction[] = [];
    const older: PendingAction[] = [];

    filtered.forEach(action => {
      const date = new Date(action.createdAt);
      if (isToday(date)) {
        today.push(action);
      } else if (isThisWeek(date)) {
        thisWeek.push(action);
      } else {
        older.push(action);
      }
    });

    return { today, thisWeek, older };
  }, [getFilteredAndSortedActions]);

  const handleApprove = async () => {
    if (!selectedAction) return;
    
    setIsProcessing(true);
    try {
      // Check if this is a meeting approval or followup queue item
      const isMeetingApproval = selectedAction.metadata?.is_meeting_approval || selectedAction.type === 'meeting';
      
      if (isMeetingApproval) {
        // Handle meeting approval - just update status
        const updates: any = { status: 'approved' };
        
        if (editedSubject !== selectedAction.subject) {
          updates.edited_subject = editedSubject;
        }
        if (editedMessage !== selectedAction.message) {
          updates.edited_description = editedMessage;
        }
        
        await supabase
          .from('meeting_approvals')
          .update(updates)
          .eq('id', selectedAction.id);

        toast({
          title: "✅ Meeting Approved!",
          description: `Meeting with ${selectedAction.contactName} has been approved`,
        });
      } else {
        // Handle followup queue item - execute the email
        const updates: any = {};
        
        if (editedSubject !== selectedAction.subject) {
          updates.metadata = { 
            ...(selectedAction.metadata || {}),
            subject: editedSubject 
          };
        }
        if (editedMessage !== selectedAction.message) {
          updates.suggested_message = editedMessage;
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from('followup_queue')
            .update(updates)
            .eq('id', selectedAction.id);
        }

        // Get auth token
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated');
        }

        // Call execute-followup Edge Function to actually send the email
        const { data, error } = await supabase.functions.invoke('execute-followup', {
          body: { followupId: selectedAction.id },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) {
          console.error('Execute followup error:', error);
          throw new Error(error.message || 'Failed to send email');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Failed to send email');
        }

        toast({
          title: "✅ Email Sent!",
          description: `Successfully sent to ${selectedAction.contactName}`,
        });
      }

      await loadActions();
      
      const filtered = getFilteredAndSortedActions();
      const currentIndex = filtered.findIndex(a => a.id === selectedAction.id);
      if (currentIndex < filtered.length - 1) {
        selectAction(filtered[currentIndex + 1]);
        setSelectedIndex(currentIndex);
      } else if (filtered.length > 1) {
        selectAction(filtered[currentIndex - 1]);
        setSelectedIndex(currentIndex - 1);
      } else {
        selectAction(null);
      }
    } catch (error: any) {
      console.error('Approval error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (!selectedAction) return;
    
    setIsProcessing(true);
    try {
      // Check if this is a meeting approval or followup queue item
      const isMeetingApproval = selectedAction.metadata?.is_meeting_approval || selectedAction.type === 'meeting';
      
      if (isMeetingApproval) {
        await supabase
          .from('meeting_approvals')
          .update({ status: 'cancelled' })
          .eq('id', selectedAction.id);
      } else {
        await supabase
          .from('followup_queue')
          .update({ status: 'rejected' })
          .eq('id', selectedAction.id);
      }

      toast({
        title: "❌ Rejected",
        description: "Action cancelled successfully.",
      });

      await loadActions();
      
      const filtered = getFilteredAndSortedActions();
      const currentIndex = filtered.findIndex(a => a.id === selectedAction.id);
      if (currentIndex < filtered.length - 1) {
        selectAction(filtered[currentIndex + 1]);
        setSelectedIndex(currentIndex);
      } else if (filtered.length > 1) {
        selectAction(filtered[currentIndex - 1]);
        setSelectedIndex(currentIndex - 1);
      } else {
        selectAction(null);
      }
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

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    
    setIsProcessing(true);
    try {
      // Separate meeting approvals from followup queue items
      const selectedActions = actions.filter(a => selectedIds.has(a.id));
      const meetingActions = selectedActions.filter(a => a.metadata?.is_meeting_approval || a.type === 'meeting');
      const followupActions = selectedActions.filter(a => !(a.metadata?.is_meeting_approval || a.type === 'meeting'));
      
      // Update meeting approvals status
      if (meetingActions.length > 0) {
        await Promise.all(meetingActions.map(action =>
          supabase.from('meeting_approvals').update({ status: 'approved' }).eq('id', action.id)
        ));
      }
      
      // For followup items, execute them first, then mark as approved only if successful
      if (followupActions.length > 0) {
        // Get auth token for executing followups
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Not authenticated. Please log in again to send emails.');
        }
        
        // Execute each followup via Edge Function and track results
        const results = await Promise.all(followupActions.map(async (action) => {
          try {
            const { data, error } = await supabase.functions.invoke('execute-followup', {
              body: { followupId: action.id },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            
            // Check if execution was successful
            if (error || !data?.success) {
              console.error(`Failed to execute followup ${action.id}:`, error || data?.error);
              return { id: action.id, success: false, error: error || data?.error };
            }
            
            // Success - the execute-followup function already updated the status
            return { id: action.id, success: true };
          } catch (err) {
            console.error(`Failed to execute followup ${action.id}:`, err);
            return { id: action.id, success: false, error: err };
          }
        }));
        
        // Count successes and failures
        const successCount = results.filter(r => r.success).length;
        const failures = results.filter(r => !r.success);
        
        if (failures.length > 0) {
          console.error('Some followups failed:', failures);
          toast({
            title: "⚠️ Partial Success",
            description: `${successCount} of ${followupActions.length} emails sent successfully. ${failures.length} failed - check console for details.`,
            variant: "destructive",
          });
        } else if (followupActions.length > 0) {
          toast({
            title: "✅ Emails Sent!",
            description: `${followupActions.length} email${followupActions.length > 1 ? 's' : ''} sent successfully.`,
          });
        }
      }
      
      // Only show generic success for meetings
      if (meetingActions.length > 0 && followupActions.length === 0) {
        toast({
          title: "✅ Meetings Approved!",
          description: `${meetingActions.length} meeting${meetingActions.length > 1 ? 's' : ''} approved successfully.`,
        });
      }
      
      setSelectedIds(new Set());
      setIsBulkMode(false);
      await loadActions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve actions",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkDecline = async () => {
    if (selectedIds.size === 0) return;
    
    setIsProcessing(true);
    try {
      // Separate meeting approvals from followup queue items
      const selectedActions = actions.filter(a => selectedIds.has(a.id));
      const meetingIds = selectedActions.filter(a => a.metadata?.is_meeting_approval || a.type === 'meeting').map(a => a.id);
      const followupIds = selectedActions.filter(a => !(a.metadata?.is_meeting_approval || a.type === 'meeting')).map(a => a.id);
      
      const promises = [];
      
      // Update meeting approvals
      if (meetingIds.length > 0) {
        promises.push(...meetingIds.map(id =>
          supabase.from('meeting_approvals').update({ status: 'cancelled' }).eq('id', id)
        ));
      }
      
      // Update followup queue items
      if (followupIds.length > 0) {
        promises.push(...followupIds.map(id =>
          supabase.from('followup_queue').update({ status: 'rejected' }).eq('id', id)
        ));
      }
      
      await Promise.all(promises);
      
      toast({
        title: "❌ Bulk Declined!",
        description: `${selectedIds.size} actions declined successfully.`,
      });
      
      setSelectedIds(new Set());
      setIsBulkMode(false);
      await loadActions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to decline actions",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail;
      case 'meeting': return Calendar;
      case 'followup': return MessageSquare;
      default: return Mail;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-500';
      case 'meeting': return 'bg-green-500';
      case 'followup': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getUrgencyBorderColor = (urgency?: string) => {
    switch (urgency) {
      case 'high': return 'border-l-4 border-l-red-500';
      case 'medium': return 'border-l-4 border-l-yellow-500';
      case 'low': return 'border-l-4 border-l-green-500';
      default: return 'border-l-4 border-l-gray-300';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-green-500';
    if (confidence >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStats = () => {
    const filtered = getFilteredAndSortedActions();
    const high = filtered.filter(a => a.urgency === 'high').length;
    const medium = filtered.filter(a => a.urgency === 'medium').length;
    const low = filtered.filter(a => a.urgency === 'low').length;
    return { total: filtered.length, high, medium, low };
  };

  const stats = getStats();
  const { today, thisWeek, older } = getGroupedActions();

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-16 w-16 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Better empty state
  if (actions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                All Caught Up!
              </CardTitle>
              <CardDescription>No actions pending approval right now</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadActions(true)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Check Again
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/30 rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-medium mb-2">💡 What happens next?</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Sophia automatically checks your emails every 15 minutes</li>
                  <li>• When she finds new responses, they'll appear here for review</li>
                  <li>• High-priority items are sorted to the top automatically</li>
                  <li>• You can approve, edit, or decline her suggestions</li>
                </ul>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium mb-2">🎯 Quick Tips</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Use <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">j/k</kbd> to navigate quickly</li>
                  <li>• Press <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">a</kbd> to approve or <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">x</kbd> to decline</li>
                  <li>• Enable bulk mode to process multiple items at once</li>
                  <li>• Collapse the context pane for more editing space</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick Stats Bar */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Actions</p>
              </div>
              <Separator orientation="vertical" className="h-10" />
              <div className="flex gap-4">
                {stats.high > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm font-medium">{stats.high} High</span>
                  </div>
                )}
                {stats.medium > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <span className="text-sm font-medium">{stats.medium} Medium</span>
                  </div>
                )}
                {stats.low > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">{stats.low} Low</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isBulkMode && selectedIds.size > 0 && (
                <>
                  <Badge variant="secondary" className="text-sm">
                    {selectedIds.size} selected
                  </Badge>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleBulkApprove}
                    disabled={isProcessing}
                  >
                    <CheckSquare className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkDecline}
                    disabled={isProcessing}
                  >
                    <XSquare className="h-4 w-4 mr-1" />
                    Decline All
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsBulkMode(!isBulkMode);
                  setSelectedIds(new Set());
                }}
              >
                <Zap className="h-4 w-4 mr-1" />
                {isBulkMode ? 'Exit Bulk' : 'Bulk Mode'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadActions(true)}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Help */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium">⌨️ Shortcuts:</span>
            <div className="flex gap-4">
              <span><kbd className="px-1.5 py-0.5 bg-background border rounded">j/k</kbd> navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-background border rounded">a</kbd> approve</span>
              <span><kbd className="px-1.5 py-0.5 bg-background border rounded">x</kbd> decline</span>
              <span><kbd className="px-1.5 py-0.5 bg-background border rounded">Esc</kbd> deselect</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-Column Workspace */}
      <div className="grid grid-cols-1 gap-4 h-[700px] lg:grid-cols-8">
        
        {/* LEFT PANE: Queue List */}
        <Card className="lg:col-span-3" style={{ overflow: 'hidden' }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Queue
                <Badge variant="secondary" className="ml-2">
                  {getFilteredAndSortedActions().length}
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadActions(true)}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {/* Filters */}
            <div className="space-y-2 pt-2">
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9"
              />
              
              <div className="flex gap-2">
                <Tabs value={filterType} onValueChange={(v) => setFilterType(v as FilterType)} className="flex-1">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                    <TabsTrigger value="meetings" className="text-xs">
                      <Calendar className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger value="replies" className="text-xs">
                      <Mail className="h-3 w-3" />
                    </TabsTrigger>
                    <TabsTrigger value="followups" className="text-xs">
                      <MessageSquare className="h-3 w-3" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <Select value={urgencyFilter} onValueChange={(v) => setUrgencyFilter(v as UrgencyFilter)}>
                  <SelectTrigger className="w-24 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="high">🔴 High</SelectItem>
                    <SelectItem value="medium">🟡 Med</SelectItem>
                    <SelectItem value="low">🟢 Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          
          <ScrollArea className="h-[580px]">
            <div className="px-4 pb-4 space-y-4">
              {/* Recently Auto-Booked Meetings */}
              {autoBookedMeetings.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowAutoBooked(!showAutoBooked)}
                    className="flex items-center gap-2 w-full text-left mb-2 hover:opacity-70 transition-opacity"
                    data-testid="toggle-autobooked"
                  >
                    {showAutoBooked ? (
                      <ChevronRight className="h-3 w-3" />
                    ) : (
                      <ChevronLeft className="h-3 w-3" />
                    )}
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Recently Auto-Booked ({autoBookedMeetings.length})
                    </h3>
                  </button>
                  
                  {showAutoBooked && (
                    <div className="space-y-2 mb-4">
                      {autoBookedMeetings.map((meeting) => (
                        <div
                          key={meeting.id}
                          className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                          data-testid={`autobooked-meeting-${meeting.id}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded bg-green-100 dark:bg-green-900/40 flex-shrink-0">
                              <Calendar className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">{meeting.contactName}</span>
                                <Badge variant="outline" className="h-5 px-1.5 text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                                  {meeting.isInternal ? 'Internal' : 'External'}
                                </Badge>
                              </div>
                              
                              <p className="text-xs text-muted-foreground truncate mb-1">
                                {meeting.subject}
                              </p>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{new Date(meeting.meetingTime).toLocaleString()}</span>
                              </div>
                              
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                ✓ Auto-booked {formatDistanceToNow(new Date(meeting.bookedAt))} ago
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Time-based groups */}
              {today.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Today
                  </h3>
                  <div className="space-y-2">
                    {today.map((action) => {
                      const Icon = getActionIcon(action.type);
                      const isSelected = selectedAction?.id === action.id;
                      
                      return (
                        <div
                          key={action.id}
                          onClick={() => selectAction(action)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectAction(action);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                            getUrgencyBorderColor(action.urgency)
                          } ${
                            isSelected 
                              ? 'border-primary bg-primary/5 shadow-sm' 
                              : 'border-border bg-card hover:border-primary/50'
                          }`}
                          data-testid={`action-item-${action.id}`}
                        >
                          <div className="flex items-start gap-3">
                            {isBulkMode && (
                              <Checkbox
                                checked={selectedIds.has(action.id)}
                                onCheckedChange={() => toggleSelection(action.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            
                            <div className={`p-2 rounded ${getActionColor(action.type)} bg-opacity-10 flex-shrink-0`}>
                              <Icon className={`h-4 w-4 ${getActionColor(action.type).replace('bg-', 'text-')}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">{action.contactName}</span>
                                {action.urgency === 'high' && (
                                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">🔴</Badge>
                                )}
                              </div>
                              
                              <p className="text-xs text-muted-foreground truncate mb-2">
                                {action.subject}
                              </p>
                              
                              {/* Confidence progress bar */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Confidence</span>
                                  <span className="font-medium">{action.confidence}%</span>
                                </div>
                                <Progress 
                                  value={action.confidence} 
                                  className="h-1.5"
                                />
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                <Clock className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                            
                            {/* Inline quick actions */}
                            {!isBulkMode && isSelected && (
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove();
                                  }}
                                  data-testid={`inline-approve-${action.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDecline();
                                  }}
                                  data-testid={`inline-decline-${action.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {thisWeek.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    This Week
                  </h3>
                  <div className="space-y-2">
                    {thisWeek.map((action) => {
                      const Icon = getActionIcon(action.type);
                      const isSelected = selectedAction?.id === action.id;
                      
                      return (
                        <div
                          key={action.id}
                          onClick={() => selectAction(action)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectAction(action);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                            getUrgencyBorderColor(action.urgency)
                          } ${
                            isSelected 
                              ? 'border-primary bg-primary/5 shadow-sm' 
                              : 'border-border bg-card hover:border-primary/50'
                          }`}
                          data-testid={`action-item-${action.id}`}
                        >
                          <div className="flex items-start gap-3">
                            {isBulkMode && (
                              <Checkbox
                                checked={selectedIds.has(action.id)}
                                onCheckedChange={() => toggleSelection(action.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            
                            <div className={`p-2 rounded ${getActionColor(action.type)} bg-opacity-10 flex-shrink-0`}>
                              <Icon className={`h-4 w-4 ${getActionColor(action.type).replace('bg-', 'text-')}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">{action.contactName}</span>
                                {action.urgency === 'high' && (
                                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">🔴</Badge>
                                )}
                              </div>
                              
                              <p className="text-xs text-muted-foreground truncate mb-2">
                                {action.subject}
                              </p>
                              
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Confidence</span>
                                  <span className="font-medium">{action.confidence}%</span>
                                </div>
                                <Progress 
                                  value={action.confidence} 
                                  className="h-1.5"
                                />
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                <Clock className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                            
                            {!isBulkMode && isSelected && (
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove();
                                  }}
                                  data-testid={`inline-approve-${action.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDecline();
                                  }}
                                  data-testid={`inline-decline-${action.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {older.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Older
                  </h3>
                  <div className="space-y-2">
                    {older.map((action) => {
                      const Icon = getActionIcon(action.type);
                      const isSelected = selectedAction?.id === action.id;
                      
                      return (
                        <div
                          key={action.id}
                          onClick={() => selectAction(action)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              selectAction(action);
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                            getUrgencyBorderColor(action.urgency)
                          } ${
                            isSelected 
                              ? 'border-primary bg-primary/5 shadow-sm' 
                              : 'border-border bg-card hover:border-primary/50'
                          }`}
                          data-testid={`action-item-${action.id}`}
                        >
                          <div className="flex items-start gap-3">
                            {isBulkMode && (
                              <Checkbox
                                checked={selectedIds.has(action.id)}
                                onCheckedChange={() => toggleSelection(action.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            
                            <div className={`p-2 rounded ${getActionColor(action.type)} bg-opacity-10 flex-shrink-0`}>
                              <Icon className={`h-4 w-4 ${getActionColor(action.type).replace('bg-', 'text-')}`} />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm truncate">{action.contactName}</span>
                                {action.urgency === 'high' && (
                                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">🔴</Badge>
                                )}
                              </div>
                              
                              <p className="text-xs text-muted-foreground truncate mb-2">
                                {action.subject}
                              </p>
                              
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Confidence</span>
                                  <span className="font-medium">{action.confidence}%</span>
                                </div>
                                <Progress 
                                  value={action.confidence} 
                                  className="h-1.5"
                                />
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                                <Clock className="h-3 w-3" />
                                <span>{formatDistanceToNow(new Date(action.createdAt), { addSuffix: true })}</span>
                              </div>
                            </div>
                            
                            {!isBulkMode && isSelected && (
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApprove();
                                  }}
                                  data-testid={`inline-approve-${action.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDecline();
                                  }}
                                  data-testid={`inline-decline-${action.id}`}
                                >
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>
        
        {/* RIGHT PANE: Decision Canvas (Tabbed) */}
        {selectedAction && (
          <Card className="lg:col-span-5" style={{ overflow: 'hidden' }}>
            <Tabs value={rightPaneTab} onValueChange={(v) => setRightPaneTab(v as 'compose' | 'context')}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between mb-2">
                  <CardTitle className="text-lg">Decision Canvas</CardTitle>
                </div>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="compose" data-testid="tab-compose">
                    <Send className="h-4 w-4 mr-2" />
                    Compose
                  </TabsTrigger>
                  <TabsTrigger value="context" data-testid="tab-context">
                    <Eye className="h-4 w-4 mr-2" />
                    Context
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="compose" className="mt-0">
                <ScrollArea className="h-[580px]">
                  <div className="px-4 pb-4 space-y-4">
                    {/* Meeting Confirmation Banner (if meeting) */}
                    {selectedAction.type === 'meeting' && (selectedAction.scheduledFor || selectedAction.metadata?.suggested_time || selectedAction.metadata?.scheduled_time) && (
                      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Calendar className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-green-900 dark:text-green-100">
                              Meeting Scheduled
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                              {new Date(selectedAction.scheduledFor || selectedAction.metadata?.suggested_time || selectedAction.metadata?.scheduled_time || '').toLocaleString()}
                            </p>
                            {selectedAction.metadata?.meeting_link && (
                              <a 
                                href={selectedAction.metadata.meeting_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-green-600 dark:text-green-400 underline mt-1 inline-block"
                              >
                                Join Meeting →
                              </a>
                            )}
                          </div>
                          <Badge variant="default" className="bg-green-600">
                            {selectedAction.metadata.status || 'Confirmed'}
                          </Badge>
                        </div>
                      </div>
                    )}

                    {/* Subject Line */}
                    <div>
                      <Label className="text-xs font-medium">Subject Line</Label>
                      <Input
                        value={editedSubject}
                        onChange={(e) => setEditedSubject(e.target.value)}
                        className="mt-1.5"
                        placeholder="Enter email subject..."
                        data-testid="input-subject"
                      />
                    </div>

                    {/* Tone Selector */}
                    <div>
                      <Label className="text-xs font-medium">Tone</Label>
                      <Select value={editedTone} onValueChange={setEditedTone}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Message Body - with Full Editor Button */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium">Message</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowMessageEditor(true)}
                          className="text-xs"
                          data-testid="button-open-full-editor"
                        >
                          📝 Open Full Editor
                        </Button>
                      </div>
                      <Textarea
                        value={editedMessage}
                        onChange={(e) => setEditedMessage(e.target.value)}
                        className="mt-1.5 min-h-[200px]"
                        placeholder="Enter your message..."
                        data-testid="textarea-message"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {editedMessage.length} characters
                        {editedMessage !== selectedAction.message && (
                          <span className="text-yellow-600 ml-2">• Edited</span>
                        )}
                      </p>
                    </div>

                    {/* Scheduled Time (if applicable) */}
                    {selectedAction.scheduledFor && (
                      <div>
                        <Label className="text-xs font-medium">Scheduled For</Label>
                        <Input
                          type="datetime-local"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="space-y-2 pt-4">
                      <Button
                        onClick={handleApprove}
                        className="w-full h-12 text-base"
                        disabled={isProcessing}
                        data-testid="button-approve"
                      >
                        <CheckCircle2 className="h-5 w-5 mr-2" />
                        {isProcessing ? 'Processing...' : 'Approve & Execute'}
                      </Button>
                      
                      <Button
                        onClick={handleDecline}
                        variant="outline"
                        className="w-full"
                        disabled={isProcessing}
                        data-testid="button-decline"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Decline
                      </Button>
                    </div>

                    {/* Unsaved changes indicator */}
                    {(editedMessage !== selectedAction.message || editedSubject !== selectedAction.subject) && (
                      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                        <p className="text-xs text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          You have unsaved changes
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="context" className="mt-0">
                <ScrollArea className="h-[630px]">
                  <div className="px-4 pb-4 space-y-4">
                    {/* Contact Info */}
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedAction.contactName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{selectedAction.contactEmail}</p>
                    </div>

                    {/* Original Email */}
                    {selectedAction.originalEmail && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Mail className="h-4 w-4 text-blue-600" />
                          Original Message
                        </h4>
                        <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
                          {selectedAction.originalSubject && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Subject:</span>
                              <p className="text-sm">{selectedAction.originalSubject}</p>
                            </div>
                          )}
                          {selectedAction.originalFrom && (
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">From:</span>
                              <p className="text-sm">{selectedAction.originalFrom}</p>
                            </div>
                          )}
                          <Separator />
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Message:</span>
                            <p className="text-sm whitespace-pre-wrap mt-1">{selectedAction.originalEmail}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI Reasoning */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        Why Sophia Recommends This
                      </h4>
                      <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-4">
                        <p className="text-sm text-muted-foreground">{selectedAction.aiReasoning}</p>
                      </div>
                    </div>

                    {/* Intent & Confidence */}
                    <div className="space-y-3">
                      {selectedAction.intent && (
                        <Badge variant="outline" className="w-full justify-center py-2">
                          Intent: {selectedAction.intent}
                        </Badge>
                      )}
                      
                      {/* Visual confidence gauge */}
                      <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">AI Confidence</span>
                          <span className="text-lg font-bold">{selectedAction.confidence}%</span>
                        </div>
                        <Progress 
                          value={selectedAction.confidence} 
                          className="h-3"
                        />
                        <p className="text-xs text-muted-foreground text-center">
                          {selectedAction.confidence >= 90 && "🎯 Very High Confidence"}
                          {selectedAction.confidence >= 70 && selectedAction.confidence < 90 && "✅ Good Confidence"}
                          {selectedAction.confidence < 70 && "⚠️ Review Carefully"}
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </Card>
        )}

        {/* Full Message Editor Modal */}
        {selectedAction && (
          <MessageEditorModal
            open={showMessageEditor}
            onOpenChange={setShowMessageEditor}
            versions={[
              {
                id: 'current',
                text: editedMessage,
                subject: editedSubject,
                reasoning: selectedAction.aiReasoning,
                confidence: selectedAction.confidence,
                isOriginal: true
              },
              {
                id: 'original',
                text: selectedAction.message,
                subject: selectedAction.subject,
                isOriginal: false
              }
            ]}
            selectedVersionId="current"
            onSave={(version) => {
              setEditedMessage(version.text);
              setEditedSubject(version.subject || editedSubject);
            }}
            onApprove={(version) => {
              setEditedMessage(version.text);
              setEditedSubject(version.subject || editedSubject);
              handleApprove();
              setShowMessageEditor(false);
            }}
            onReject={handleDecline}
            title="Edit Message"
            description="Review and edit the message before approving"
            contactName={selectedAction.contactName}
          />
        )}
      </div>
    </div>
  );
}
