import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Send, 
  Mail, 
  MessageSquare, 
  Brain, 
  Calendar,
  CheckCircle2,
  TrendingUp,
  Users,
  Target
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AgentStats {
  emails_sent: number;
  responses_received: number;
  linkedin_actions: number;
  responses_analyzed: number;
  meetings_scheduled: number;
  leads_qualified: number;
  avg_response_rate: number;
  total_contacts_engaged: number;
}

export function AnalyticsTab() {
  const [stats, setStats] = useState<AgentStats>({
    emails_sent: 0,
    responses_received: 0,
    linkedin_actions: 0,
    responses_analyzed: 0,
    meetings_scheduled: 0,
    leads_qualified: 0,
    avg_response_rate: 0,
    total_contacts_engaged: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all activities
      const { data: activities } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('user_id', user.id);

      if (!activities) return;

      // Calculate stats
      const emailsSent = activities.filter(a => a.activity_type === 'email_sent').length;
      const responsesReceived = activities.filter(a => a.activity_type === 'response_detected' || a.activity_type === 'email_received').length;
      const linkedinActions = activities.filter(a => a.activity_type?.startsWith('linkedin_')).length;
      const responsesAnalyzed = activities.filter(a => a.activity_type === 'ai_decision').length;
      const meetingsScheduled = activities.filter(a => a.activity_type === 'meeting_scheduled').length;
      const leadsQualified = activities.filter(a => a.activity_type === 'lead_qualified').length;

      // Get unique contacts
      const uniqueContacts = new Set(
        activities
          .map(a => a.activity_data?.contact_id || a.activity_data?.contact_email)
          .filter(Boolean)
      ).size;

      // Calculate response rate
      const responseRate = emailsSent > 0 
        ? Math.round((responsesReceived / emailsSent) * 100) 
        : 0;

      setStats({
        emails_sent: emailsSent,
        responses_received: responsesReceived,
        linkedin_actions: linkedinActions,
        responses_analyzed: responsesAnalyzed,
        meetings_scheduled: meetingsScheduled,
        leads_qualified: leadsQualified,
        avg_response_rate: responseRate,
        total_contacts_engaged: uniqueContacts,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const statCards = [
    {
      title: "Emails Sent",
      value: stats.emails_sent,
      icon: Send,
      color: "text-blue-500",
      bgColor: "bg-blue-100 dark:bg-blue-900",
    },
    {
      title: "Responses Received",
      value: stats.responses_received,
      icon: Mail,
      color: "text-green-500",
      bgColor: "bg-green-100 dark:bg-green-900",
    },
    {
      title: "LinkedIn Actions",
      value: stats.linkedin_actions,
      icon: MessageSquare,
      color: "text-indigo-500",
      bgColor: "bg-indigo-100 dark:bg-indigo-900",
    },
    {
      title: "Responses Analyzed",
      value: stats.responses_analyzed,
      icon: Brain,
      color: "text-purple-500",
      bgColor: "bg-purple-100 dark:bg-purple-900",
    },
    {
      title: "Meetings Scheduled",
      value: stats.meetings_scheduled,
      icon: Calendar,
      color: "text-green-500",
      bgColor: "bg-green-100 dark:bg-green-900",
    },
    {
      title: "Leads Qualified",
      value: stats.leads_qualified,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-100 dark:bg-emerald-900",
    },
    {
      title: "Response Rate",
      value: `${stats.avg_response_rate}%`,
      icon: TrendingUp,
      color: "text-amber-500",
      bgColor: "bg-amber-100 dark:bg-amber-900",
    },
    {
      title: "Contacts Engaged",
      value: stats.total_contacts_engaged,
      icon: Users,
      color: "text-cyan-500",
      bgColor: "bg-cyan-100 dark:bg-cyan-900",
    },
  ];

  return (
    <div className="space-y-6" data-testid="analytics-tab">
      <Card>
        <CardHeader>
          <CardTitle>Performance Analytics</CardTitle>
          <CardDescription>
            Detailed metrics on Agent Sophia's performance across all channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <Icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <span className="text-2xl font-bold text-foreground">
                        {stat.value}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Engagement Metrics</CardTitle>
          <CardDescription>
            Track how contacts are responding to Agent Sophia's outreach
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email Response Rate</span>
              <span className="text-sm text-muted-foreground">{stats.avg_response_rate}%</span>
            </div>
            <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
              <div 
                className="bg-green-500 h-full transition-all duration-500"
                style={{ width: `${stats.avg_response_rate}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Conversion Rate</span>
                </div>
                <div className="text-2xl font-bold">
                  {stats.emails_sent > 0 
                    ? Math.round((stats.meetings_scheduled / stats.emails_sent) * 100) 
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Emails to meetings
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">AI Efficiency</span>
                </div>
                <div className="text-2xl font-bold">
                  {stats.responses_received > 0
                    ? Math.round((stats.responses_analyzed / stats.responses_received) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Responses analyzed
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
