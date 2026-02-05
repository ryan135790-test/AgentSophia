import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Mail, 
  MessageSquare, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Brain,
  Send,
  User,
  ChevronDown,
  AlertCircle
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Activity {
  id: string;
  activity_type: string;
  activity_data: any;
  status: string;
  ai_reasoning?: string;
  created_at: string;
}

export function ActivityHistory() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'today' | 'week'>('today');

  useEffect(() => {
    loadActivities();
  }, [filter]);

  const loadActivities = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from('agent_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Apply time filter
      if (filter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte('created_at', today.toISOString());
      } else if (filter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte('created_at', weekAgo.toISOString());
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'email_sent': return Send;
      case 'email_received': return Mail;
      case 'linkedin_connection': return User;
      case 'linkedin_message': return MessageSquare;
      case 'meeting_scheduled': return Calendar;
      case 'response_detected': return Mail;
      case 'ai_decision': return Brain;
      default: return CheckCircle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'failed': return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getActivityTitle = (activity: Activity) => {
    const data = activity.activity_data || {};
    switch (activity.activity_type) {
      case 'email_sent':
        return `Sent email to ${data.contact_name || 'contact'}`;
      case 'email_received':
        return `Received response from ${data.contact_name || 'contact'}`;
      case 'linkedin_connection':
        return `Sent LinkedIn connection to ${data.contact_name || 'contact'}`;
      case 'linkedin_message':
        return `Sent LinkedIn message to ${data.contact_name || 'contact'}`;
      case 'meeting_scheduled':
        return `Scheduled meeting with ${data.contact_name || 'contact'}`;
      case 'response_detected':
        return `Detected response from ${data.contact_name || 'contact'}`;
      case 'ai_decision':
        return `AI analyzed ${data.contact_name || 'contact'}`;
      default:
        return activity.activity_type.replace('_', ' ');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-activity-history">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity History</CardTitle>
            <CardDescription>
              See what Agent Sophia has been doing
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('today')}
              data-testid="button-filter-today"
            >
              Today
            </Button>
            <Button
              variant={filter === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('week')}
              data-testid="button-filter-week"
            >
              Week
            </Button>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              data-testid="button-filter-all"
            >
              All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No activities yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Enable automations in the Automation tab to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const Icon = getActivityIcon(activity.activity_type);
              return (
                <Collapsible key={activity.id}>
                  <div className="border rounded-lg p-4 hover:bg-secondary/30 transition-all">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${getStatusColor(activity.status)}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{getActivityTitle(activity)}</h4>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{new Date(activity.created_at).toLocaleString()}</span>
                              <Badge variant="outline" className="ml-2 capitalize">
                                {activity.status}
                              </Badge>
                            </div>
                          </div>
                          
                          {activity.ai_reasoning && (
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          )}
                        </div>

                        <CollapsibleContent className="mt-3">
                          {activity.ai_reasoning && (
                            <div className="p-3 bg-secondary/50 rounded text-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className="h-4 w-4 text-purple-600" />
                                <span className="font-medium">AI Reasoning</span>
                              </div>
                              <p className="text-muted-foreground">{activity.ai_reasoning}</p>
                            </div>
                          )}
                        </CollapsibleContent>
                      </div>
                    </div>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
