import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAgentActivities } from "@/lib/agent-sophia-api";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import {
  Users,
  MessageSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
  Search,
  Filter,
  RotateCcw,
  Send,
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Pause,
  MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Activity {
  id: string;
  type: string;
  contactName: string;
  contactId?: string;
  company?: string;
  channel?: string;
  action: string;
  outcome: 'success' | 'failed' | 'pending';
  details?: string;
  timestamp: string;
  isAutonomous?: boolean;
}

type FilterType = 'all' | 'email' | 'linkedin' | 'meeting' | 'qualified' | 'escalated';
type OutcomeFilter = 'all' | 'success' | 'failed' | 'pending';

export function ActivityLogEnhanced() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null);
  const [instructionDialog, setInstructionDialog] = useState<{open: boolean; activityId: string | null; contactId?: string}>({
    open: false,
    activityId: null
  });
  const [instruction, setInstruction] = useState("");

  const { data: activities = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/agent-sophia/activities'],
    queryFn: () => getAgentActivities(100),
  });

  const instructSophiaMutation = useMutation({
    mutationFn: async (data: { activityId: string; instruction: string; contactId?: string }) => {
      return apiRequest('/api/sophia/instruct', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Instruction Sent",
        description: "Sophia will follow your instructions for this contact.",
      });
      setInstructionDialog({ open: false, activityId: null });
      setInstruction("");
      queryClient.invalidateQueries({ queryKey: ['/api/agent-sophia/activities'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send instruction to Sophia.",
        variant: "destructive",
      });
    }
  });

  const retryActionMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return apiRequest(`/api/sophia/retry-action/${activityId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Action Queued",
        description: "Sophia will retry this action.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agent-sophia/activities'] });
    },
  });

  const pauseContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest(`/api/sophia/pause-contact/${contactId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Contact Paused",
        description: "Sophia will not contact this person until resumed.",
      });
    },
  });

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'prospecting':
        return <Users className="h-4 w-4" />;
      case 'outreach_sent':
      case 'email_sent':
      case 'follow_up_sent':
        return <MessageSquare className="h-4 w-4" />;
      case 'meeting_scheduled':
        return <Calendar className="h-4 w-4" />;
      case 'lead_qualified':
        return <TrendingUp className="h-4 w-4" />;
      case 'lead_disqualified':
        return <TrendingDown className="h-4 w-4" />;
      case 'escalated_to_human':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Eye className="h-4 w-4" />;
    }
  };

  const getOutcomeIcon = (outcome: Activity['outcome']) => {
    switch (outcome) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'meeting_scheduled':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'escalated_to_human':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'lead_disqualified':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'lead_qualified':
        return 'bg-primary/10 text-primary border-primary/20';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getActivityLabel = (type: Activity['type']) => {
    switch (type) {
      case 'prospecting':
        return 'Prospecting';
      case 'outreach_sent':
      case 'email_sent':
        return 'Email Sent';
      case 'follow_up_sent':
        return 'Follow-up';
      case 'linkedin_sent':
        return 'LinkedIn';
      case 'response_analyzed':
        return 'Response Analyzed';
      case 'meeting_scheduled':
        return 'Meeting Scheduled';
      case 'escalated_to_human':
        return 'Escalated';
      case 'lead_qualified':
        return 'Lead Qualified';
      case 'lead_disqualified':
        return 'Lead Disqualified';
      default:
        return 'Activity';
    }
  };

  const filteredActivities = activities.filter((dbActivity: any) => {
    const activity = {
      type: dbActivity.activity_type,
      contactName: dbActivity.contact?.first_name || 'Unknown',
      company: dbActivity.contact?.company,
      action: dbActivity.action_taken,
      outcome: dbActivity.outcome,
    };

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!activity.contactName.toLowerCase().includes(query) &&
          !activity.company?.toLowerCase().includes(query) &&
          !activity.action?.toLowerCase().includes(query)) {
        return false;
      }
    }

    if (typeFilter !== 'all') {
      const typeMap: Record<string, string[]> = {
        email: ['outreach_sent', 'email_sent', 'follow_up_sent'],
        linkedin: ['linkedin_sent'],
        meeting: ['meeting_scheduled'],
        qualified: ['lead_qualified'],
        escalated: ['escalated_to_human'],
      };
      if (!typeMap[typeFilter]?.includes(activity.type)) {
        return false;
      }
    }

    if (outcomeFilter !== 'all' && activity.outcome !== outcomeFilter) {
      return false;
    }

    return true;
  });

  const handleExport = () => {
    const exportData = filteredActivities.map((dbActivity: any) => {
      const timestamp = formatDistanceToNow(new Date(dbActivity.created_at), { addSuffix: true });
      const contactName = dbActivity.contact?.first_name || 'Unknown';
      const company = dbActivity.contact?.company || '';
      return `${timestamp},${dbActivity.activity_type},${contactName},${company},${dbActivity.action_taken},${dbActivity.outcome}`;
    });
    
    const csv = ['Timestamp,Type,Contact,Company,Action,Outcome', ...exportData].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sophia-activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handleInstructSophia = (activityId: string, contactId?: string) => {
    setInstructionDialog({ open: true, activityId, contactId });
  };

  const submitInstruction = () => {
    if (!instructionDialog.activityId || !instruction.trim()) return;
    instructSophiaMutation.mutate({
      activityId: instructionDialog.activityId,
      instruction: instruction.trim(),
      contactId: instructionDialog.contactId,
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Activity History
              </CardTitle>
              <CardDescription>
                View Sophia's actions and give her new instructions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-log">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by contact, company, or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-activities"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as FilterType)}>
              <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="meeting">Meetings</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={outcomeFilter} onValueChange={(v) => setOutcomeFilter(v as OutcomeFilter)}>
              <SelectTrigger className="w-[140px]" data-testid="select-outcome-filter">
                <SelectValue placeholder="Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="success">✅ Success</SelectItem>
                <SelectItem value="pending">⏳ Pending</SelectItem>
                <SelectItem value="failed">❌ Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Separator className="mt-4" />
                  </div>
                ))}
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Activity Found</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {searchQuery || typeFilter !== 'all' || outcomeFilter !== 'all'
                    ? "No activities match your filters. Try adjusting your search."
                    : "Sophia hasn't performed any actions yet. Activate her to start seeing activity."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredActivities.map((dbActivity: any, index: number) => {
                  const activity: Activity = {
                    id: dbActivity.id,
                    type: dbActivity.activity_type,
                    contactName: dbActivity.contact?.first_name || 'Unknown',
                    contactId: dbActivity.contact_id,
                    company: dbActivity.contact?.company,
                    channel: dbActivity.metadata?.channel,
                    action: dbActivity.action_taken,
                    outcome: dbActivity.outcome as 'success' | 'failed' | 'pending',
                    details: dbActivity.outcome_details,
                    timestamp: formatDistanceToNow(new Date(dbActivity.created_at), { addSuffix: true }),
                    isAutonomous: dbActivity.is_autonomous,
                  };

                  const isExpanded = expandedActivity === activity.id;

                  return (
                    <div 
                      key={activity.id}
                      className={`border rounded-lg transition-all ${isExpanded ? 'shadow-md' : 'hover:shadow-sm'}`}
                      data-testid={`activity-item-${activity.id}`}
                    >
                      <div 
                        className="flex items-start p-4 cursor-pointer"
                        onClick={() => setExpandedActivity(isExpanded ? null : activity.id)}
                      >
                        <div className={`p-2 rounded-lg mr-3 ${getActivityColor(activity.type)}`}>
                          {getActivityIcon(activity.type)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={getActivityColor(activity.type)}>
                                {getActivityLabel(activity.type)}
                              </Badge>
                              {activity.channel && (
                                <Badge variant="secondary" className="text-xs">
                                  {activity.channel}
                                </Badge>
                              )}
                              {activity.isAutonomous && (
                                <Badge variant="outline" className="text-xs bg-primary/10 text-primary">
                                  <Bot className="h-3 w-3 mr-1" />
                                  Autonomous
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {getOutcomeIcon(activity.outcome)}
                              <span className="hidden sm:inline">{activity.timestamp}</span>
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </div>

                          <div className="mt-2">
                            <div className="flex items-baseline gap-2">
                              <span className="font-medium">{activity.contactName}</span>
                              {activity.company && (
                                <>
                                  <span className="text-muted-foreground">•</span>
                                  <span className="text-sm text-muted-foreground">{activity.company}</span>
                                </>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{activity.action}</p>
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0">
                          <Separator className="mb-4" />
                          
                          {activity.details && (
                            <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">{activity.details}</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {activity.contactId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/contacts/${activity.contactId}`);
                                }}
                                data-testid={`button-view-contact-${activity.id}`}
                              >
                                <ExternalLink className="h-4 w-4 mr-2" />
                                View Contact
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInstructSophia(activity.id, activity.contactId);
                              }}
                              data-testid={`button-instruct-sophia-${activity.id}`}
                            >
                              <MessageCircle className="h-4 w-4 mr-2" />
                              Tell Sophia
                            </Button>

                            {activity.outcome === 'failed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  retryActionMutation.mutate(activity.id);
                                }}
                                disabled={retryActionMutation.isPending}
                                data-testid={`button-retry-${activity.id}`}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Retry
                              </Button>
                            )}

                            {activity.contactId && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  pauseContactMutation.mutate(activity.contactId!);
                                }}
                                disabled={pauseContactMutation.isPending}
                                data-testid={`button-pause-contact-${activity.id}`}
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pause Contact
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={instructionDialog.open} onOpenChange={(open) => setInstructionDialog({ ...instructionDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Tell Sophia What To Do
            </DialogTitle>
            <DialogDescription>
              Give Sophia specific instructions for this contact or action.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="e.g., 'Send a follow-up email asking about their Q1 budget' or 'Schedule a demo call for next week' or 'Stop contacting this person'"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              className="min-h-[120px]"
              data-testid="textarea-sophia-instruction"
            />
            
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setInstruction("Send a personalized follow-up email")}
              >
                Follow-up Email
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setInstruction("Try reaching out on LinkedIn instead")}
              >
                Try LinkedIn
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setInstruction("Schedule a meeting or demo call")}
              >
                Schedule Meeting
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setInstruction("Mark as not interested and stop outreach")}
              >
                Stop Outreach
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInstructionDialog({ open: false, activityId: null })}>
              Cancel
            </Button>
            <Button 
              onClick={submitInstruction}
              disabled={!instruction.trim() || instructSophiaMutation.isPending}
              data-testid="button-submit-instruction"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Instruction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
