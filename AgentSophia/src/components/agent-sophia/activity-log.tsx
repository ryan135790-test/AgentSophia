import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/contexts/workspace-context";
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
  Linkedin,
  Mail,
  Phone,
} from "lucide-react";

interface Activity {
  id: string;
  type: string;
  contactName: string;
  company?: string;
  channel?: string;
  action: string;
  outcome: 'positive' | 'negative' | 'neutral';
  status: string;
  details?: string;
  timestamp: string;
  campaignName?: string;
}

export function ActivityLog() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  
  const { data: activities = [], isLoading } = useQuery({
    queryKey: `/api/sophia/activity-log/${workspaceId}`,
    enabled: !!workspaceId,
  });
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'prospecting':
        return <Users className="h-4 w-4" />;
      case 'outreach_sent':
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

  const getOutcomeIcon = (outcome: string, status: string) => {
    if (status === 'error' || status === 'failed') {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    switch (outcome) {
      case 'positive':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'negative':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'neutral':
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  const getChannelIcon = (action: string) => {
    if (action?.toLowerCase().includes('linkedin')) {
      return <Linkedin className="h-4 w-4" />;
    }
    if (action?.toLowerCase().includes('email')) {
      return <Mail className="h-4 w-4" />;
    }
    if (action?.toLowerCase().includes('phone') || action?.toLowerCase().includes('call')) {
      return <Phone className="h-4 w-4" />;
    }
    return <MessageSquare className="h-4 w-4" />;
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'meeting_scheduled':
        return 'bg-success/10 text-success border-success/20';
      case 'escalated_to_human':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'lead_disqualified':
        return 'bg-destructive/10 text-destructive border-destructive/20';
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
        return 'Outreach Sent';
      case 'follow_up_sent':
        return 'Follow-up Sent';
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

  const handleExport = () => {
    // Export activity log as CSV
    const exportData = activities.map((activity: any) => {
      const timestamp = activity.timestamp || '';
      const contactName = activity.contactName || 'Unknown';
      const campaign = activity.campaignName || '';
      return `${timestamp},${activity.type},${contactName},${campaign},${activity.action},${activity.status}`;
    });
    
    const csv = ['Timestamp,Type,Contact,Campaign,Action,Status', ...exportData].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-sophia-activity-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>
              Real-time tracking of Agent Sophia's actions and decisions
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="button-export-log">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                  <Separator className="mt-4" />
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Activity Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Agent Sophia hasn't performed any actions yet. Activate her and configure your settings to start seeing activity here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity: any, index: number) => {
                const timeAgo = activity.timestamp 
                  ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                  : 'Unknown time';

                return (
                  <div key={activity.id}>
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 rounded-lg ${activity.status === 'error' ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        {getChannelIcon(activity.action)}
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant={activity.status === 'error' ? 'destructive' : 'secondary'}>
                              {activity.type || 'Campaign'}
                            </Badge>
                            {activity.campaignName && (
                              <Badge variant="outline" className="text-xs">
                                {activity.campaignName}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            {getOutcomeIcon(activity.outcome, activity.status)}
                            <span>{timeAgo}</span>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-baseline space-x-2">
                            <span className="font-medium text-foreground">{activity.contactName || 'Unknown Contact'}</span>
                          </div>
                          <p className="text-sm text-foreground mt-1">{activity.action}</p>
                          {activity.details && (
                            <p className="text-sm text-muted-foreground mt-1 italic truncate max-w-md" title={activity.details}>
                              {activity.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {index < activities.length - 1 && <Separator className="mt-4" />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
