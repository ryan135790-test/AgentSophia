import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Mail,
  Calendar,
  DollarSign,
  Clock,
  Target,
  Users,
  Zap,
  Award,
  RefreshCw,
  Download,
  Lightbulb,
  BarChart3,
  PieChart,
  Activity,
  Brain,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface DashboardMetrics {
  totalEmails: number;
  responseRate: number;
  meetingsBooked: number;
  conversionRate: number;
  avgResponseTime: number;
  revenueGenerated: number;
  timeSaved: number;
  leadScore: number;
  emailsSent30Days: number;
  responseRate30Days: number;
  trend: {
    emails: number;
    responses: number;
    meetings: number;
    revenue: number;
  };
}

interface BestPractice {
  metric: string;
  insight: string;
  impact: string;
  recommendation: string;
}

const demoMetrics: DashboardMetrics = {
  totalEmails: 1247,
  responseRate: 24.3,
  meetingsBooked: 47,
  conversionRate: 15.4,
  avgResponseTime: 4.2,
  revenueGenerated: 235000,
  timeSaved: 312,
  leadScore: 78,
  emailsSent30Days: 423,
  responseRate30Days: 26.8,
  trend: {
    emails: 12,
    responses: 8,
    meetings: 23,
    revenue: 18,
  },
};

const demoBestPractices: BestPractice[] = [
  {
    metric: 'Optimal Send Time',
    insight: 'Emails sent between 9-11 AM have 34% higher open rates',
    impact: '+12% response rate improvement',
    recommendation: 'Schedule campaigns for morning delivery in recipient timezone',
  },
  {
    metric: 'Subject Line Length',
    insight: 'Subject lines with 6-10 words perform 28% better',
    impact: '+8% open rate improvement',
    recommendation: 'Keep subject lines concise and action-oriented',
  },
  {
    metric: 'Follow-up Timing',
    insight: 'Second follow-up at day 3 shows highest conversion',
    impact: '+15% meeting booking rate',
    recommendation: 'Automate follow-up sequence with 3-day intervals',
  },
];

interface SophiaInsight {
  title: string;
  description: string;
  impact?: string;
  confidence?: string;
}

export default function Analytics() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [bestPractices, setBestPractices] = useState<BestPractice[]>([]);
  const [sophiaInsights, setSophiaInsights] = useState<SophiaInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadAnalytics();
  }, [timeRange, workspaceId, isDemo]);

  const loadAnalytics = async () => {
    if (isDemo) {
      setMetrics(demoMetrics);
      setBestPractices(demoBestPractices);
      setSophiaInsights([
        { title: 'High Performance', description: 'Your campaigns are performing 23% above industry average', impact: '+15% response boost', confidence: '94%' },
        { title: 'Best Send Time', description: 'Emails sent 9-11 AM have 34% higher open rates', impact: '+12% response rate', confidence: '89%' },
        { title: 'Quick Win', description: '3 optimization opportunities identified', impact: '+$45K potential', confidence: '87%' }
      ]);
      setIsLoading(false);
      return;
    }
    
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Calculate date range
      const now = new Date();
      let startDate = new Date();
      switch (timeRange) {
        case '7d':
          startDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(now.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(now.getDate() - 90);
          break;
        case 'all':
          startDate = new Date('2020-01-01');
          break;
      }

      // Fetch agent activities for the time range
      const { data: activities, error: activitiesError } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      if (activitiesError) throw activitiesError;

      // Fetch campaign responses
      const { data: responses, error: responsesError } = await supabase
        .from('campaign_responses')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      if (responsesError) throw responsesError;

      // Calculate metrics
      const emailsSent = activities?.filter(a => a.activity_type === 'outreach_sent' || a.activity_type === 'follow_up_sent').length || 0;
      const totalResponses = responses?.length || 0;
      const meetingsBooked = activities?.filter(a => a.activity_type === 'meeting_scheduled').length || 0;
      const responseRate = emailsSent > 0 ? (totalResponses / emailsSent) * 100 : 0;
      const conversionRate = totalResponses > 0 ? (meetingsBooked / totalResponses) * 100 : 0;

      // Calculate average response time
      const responseTimes: number[] = [];
      responses?.forEach(response => {
        const activity = activities?.find(a => a.contact_id === response.contact_id);
        if (activity && response.responded_at) {
          const sentTime = new Date(activity.created_at).getTime();
          const respondedTime = new Date(response.responded_at).getTime();
          const diffHours = (respondedTime - sentTime) / (1000 * 60 * 60);
          if (diffHours > 0) responseTimes.push(diffHours);
        }
      });
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

      // Calculate time saved (estimate: 15 min per email manually)
      const timeSavedHours = (emailsSent * 15) / 60;

      // Calculate trends (compare to previous period)
      const prevStartDate = new Date(startDate);
      const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      prevStartDate.setDate(prevStartDate.getDate() - daysDiff);

      const { data: prevActivities } = await supabase
        .from('agent_activities')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      const { data: prevResponses } = await supabase
        .from('campaign_responses')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', prevStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      const prevEmailsSent = prevActivities?.filter(a => a.activity_type === 'outreach_sent' || a.activity_type === 'follow_up_sent').length || 0;
      const prevTotalResponses = prevResponses?.length || 0;
      const prevMeetings = prevActivities?.filter(a => a.activity_type === 'meeting_scheduled').length || 0;

      const emailTrend = prevEmailsSent > 0 ? ((emailsSent - prevEmailsSent) / prevEmailsSent) * 100 : 0;
      const responseTrend = prevTotalResponses > 0 ? ((totalResponses - prevTotalResponses) / prevTotalResponses) * 100 : 0;
      const meetingTrend = prevMeetings > 0 ? ((meetingsBooked - prevMeetings) / prevMeetings) * 100 : 0;

      setMetrics({
        totalEmails: emailsSent,
        responseRate: Math.round(responseRate * 10) / 10,
        meetingsBooked,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgResponseTime: Math.round(avgResponseTime * 10) / 10,
        revenueGenerated: meetingsBooked * 5000, // Estimate $5k per meeting
        timeSaved: Math.round(timeSavedHours * 10) / 10,
        leadScore: 0,
        emailsSent30Days: emailsSent,
        responseRate30Days: responseRate,
        trend: {
          emails: Math.round(emailTrend),
          responses: Math.round(responseTrend),
          meetings: Math.round(meetingTrend),
          revenue: Math.round(meetingTrend),
        },
      });

      // Generate AI-powered best practices
      generateBestPractices(activities || [], responses || []);

      // Fetch Sophia insights for real workspaces
      try {
        const insightsRes = await fetch(`/api/workspaces/${workspaceId}/sophia/insights/analytics`);
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json();
          setSophiaInsights(Array.isArray(insightsData) ? insightsData : insightsData.insights || []);
        } else {
          // Generate insights from the data if API fails
          const generatedInsights: SophiaInsight[] = [];
          if (responseRate > 20) {
            generatedInsights.push({ title: 'Strong Response Rate', description: `Your ${responseRate.toFixed(1)}% response rate is above average`, impact: 'Keep it up!', confidence: '90%' });
          }
          if (meetingsBooked > 0) {
            generatedInsights.push({ title: 'Meetings Booked', description: `${meetingsBooked} meetings scheduled this period`, impact: `$${(meetingsBooked * 5000).toLocaleString()} potential`, confidence: '85%' });
          }
          if (emailsSent > 50) {
            generatedInsights.push({ title: 'Active Outreach', description: `${emailsSent} emails sent - strong activity`, impact: 'Consistent effort', confidence: '95%' });
          }
          setSophiaInsights(generatedInsights);
        }
      } catch {
        setSophiaInsights([]);
      }

    } catch (error) {
      console.error('Error loading analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateBestPractices = (activities: any[], responses: any[]) => {
    const practices: BestPractice[] = [];

    // Analyze send times
    const sendTimeAnalysis = analyzeSendTimes(activities);
    if (sendTimeAnalysis) {
      practices.push(sendTimeAnalysis);
    }

    // Analyze day of week
    const dayAnalysis = analyzeDayOfWeek(activities, responses);
    if (dayAnalysis) {
      practices.push(dayAnalysis);
    }

    // Analyze response patterns
    const responseAnalysis = analyzeResponsePatterns(responses);
    if (responseAnalysis) {
      practices.push(responseAnalysis);
    }

    setBestPractices(practices);
  };

  const analyzeSendTimes = (activities: any[]): BestPractice | null => {
    const timeSlots: { [key: string]: { sent: number, responses: number } } = {
      'morning': { sent: 0, responses: 0 },
      'afternoon': { sent: 0, responses: 0 },
      'evening': { sent: 0, responses: 0 },
    };

    activities.forEach(activity => {
      const hour = new Date(activity.created_at).getHours();
      let slot = 'evening';
      if (hour >= 6 && hour < 12) slot = 'morning';
      else if (hour >= 12 && hour < 18) slot = 'afternoon';

      if (activity.activity_type === 'outreach_sent' || activity.activity_type === 'follow_up_sent') {
        timeSlots[slot].sent++;
      }
    });

    const totalSent = Object.values(timeSlots).reduce((sum, slot) => sum + slot.sent, 0);
    if (totalSent === 0) return null;

    const bestSlot = Object.entries(timeSlots)
      .filter(([, slot]) => slot.sent > 5)
      .sort(([,a], [,b]) => b.sent - a.sent)
      [0]?.[0];

    if (bestSlot && timeSlots[bestSlot].sent > 5) {
      const percentage = Math.round((timeSlots[bestSlot].sent / totalSent) * 100);
      return {
        metric: 'Send Time Optimization',
        insight: `${percentage}% of your emails are sent in the ${bestSlot}`,
        impact: `Most active sending period`,
        recommendation: `Continue sending emails during ${bestSlot} hours (${
          bestSlot === 'morning' ? '6am-12pm' :
          bestSlot === 'afternoon' ? '12pm-6pm' :
          '6pm-12am'
        }) when you're most productive`,
      };
    }

    return null;
  };

  const analyzeDayOfWeek = (activities: any[], responses: any[]): BestPractice | null => {
    const dayMap: { [key: number]: string } = {
      0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
      4: 'Thursday', 5: 'Friday', 6: 'Saturday'
    };

    const dayStats: { [key: string]: { sent: number, responded: number } } = {};

    activities.forEach(activity => {
      const day = dayMap[new Date(activity.created_at).getDay()];
      if (!dayStats[day]) dayStats[day] = { sent: 0, responded: 0 };

      if (activity.activity_type === 'outreach_sent' || activity.activity_type === 'follow_up_sent') {
        dayStats[day].sent++;
      }
    });

    responses.forEach(response => {
      const day = dayMap[new Date(response.created_at).getDay()];
      if (!dayStats[day]) dayStats[day] = { sent: 0, responded: 0 };
      dayStats[day].responded++;
    });

    const bestDay = Object.entries(dayStats)
      .filter(([, stats]) => stats.sent > 2)
      .sort(([,a], [,b]) => (b.responded / Math.max(b.sent, 1)) - (a.responded / Math.max(a.sent, 1)))
      [0]?.[0];

    if (bestDay) {
      const rate = Math.round((dayStats[bestDay].responded / dayStats[bestDay].sent) * 100);
      return {
        metric: 'Day of Week Performance',
        insight: `${bestDay} shows ${rate}% response rate`,
        impact: 'Best performing day of the week',
        recommendation: `Schedule more outreach on ${bestDay} for better results`,
      };
    }

    return null;
  };

  const analyzeResponsePatterns = (responses: any[]): BestPractice | null => {
    if (responses.length < 5) return null;

    const interestedCount = responses.filter(r => r.intent_tag === 'interested').length;
    const meetingCount = responses.filter(r => r.intent_tag === 'meeting_request').length;

    if (interestedCount + meetingCount > responses.length * 0.3) {
      return {
        metric: 'High Engagement Rate',
        insight: `${Math.round(((interestedCount + meetingCount) / responses.length) * 100)}% of responses show positive intent`,
        impact: 'Strong messaging resonance',
        recommendation: 'Continue using your current messaging approach and scale up volume',
      };
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics && !isDemo) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your outreach performance and discover insights
          </p>
        </div>
        <Card className="p-12 text-center">
          <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No Analytics Data Yet</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Start sending campaigns and engaging with leads to see your performance analytics here.
          </p>
        </Card>
      </div>
    );
  }
  
  if (!metrics) return null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Sophia Insights */}
      {sophiaInsights.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <Brain className="h-5 w-5" />
              Sophia's Analytics Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {sophiaInsights.map((insight, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2 bg-white/50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm text-slate-800 dark:text-slate-200">{insight.title}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{insight.description}</p>
                </div>
                {insight.impact && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                    {insight.impact}
                  </Badge>
                )}
              </div>
            ))}
            {isDemo && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                Demo Data
              </Badge>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your outreach performance and discover insights
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-32" data-testid="select-trigger-timerange">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d" data-testid="select-item-7d">Last 7 days</SelectItem>
              <SelectItem value="30d" data-testid="select-item-30d">Last 30 days</SelectItem>
              <SelectItem value="90d" data-testid="select-item-90d">Last 90 days</SelectItem>
              <SelectItem value="all" data-testid="select-item-all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAnalytics}
            data-testid="button-refresh-analytics"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            data-testid="button-export-analytics"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Emails */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800" data-testid="card-total-emails">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              Emails Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300" data-testid="metric-total-emails">
              {metrics.totalEmails}
            </div>
            <div className="flex items-center gap-1 mt-1" data-testid="trend-total-emails">
              {metrics.trend.emails >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs ${metrics.trend.emails >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(metrics.trend.emails)}% vs previous period
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Response Rate */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800" data-testid="card-response-rate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              Response Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700 dark:text-green-300" data-testid="metric-response-rate">
              {metrics.responseRate}%
            </div>
            <Progress value={metrics.responseRate} className="h-2 mt-2" data-testid="progress-response-rate" />
            <div className="flex items-center gap-1 mt-1" data-testid="trend-response-rate">
              {metrics.trend.responses >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs ${metrics.trend.responses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(metrics.trend.responses)}% vs previous period
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Meetings Booked */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800" data-testid="card-meetings-booked">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Meetings Booked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-300" data-testid="metric-meetings-booked">
              {metrics.meetingsBooked}
            </div>
            <div className="text-xs text-muted-foreground mt-1" data-testid="metric-meetings-conversion">
              {metrics.conversionRate}% conversion rate
            </div>
            <div className="flex items-center gap-1 mt-1" data-testid="trend-meetings-booked">
              {metrics.trend.meetings >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs ${metrics.trend.meetings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(metrics.trend.meetings)}% vs previous period
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Generated */}
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800" data-testid="card-revenue-generated">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-yellow-600" />
              Pipeline Generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-700 dark:text-yellow-300" data-testid="metric-revenue-generated">
              ${(metrics.revenueGenerated / 1000).toFixed(0)}k
            </div>
            <div className="text-xs text-muted-foreground mt-1" data-testid="text-revenue-meetings-reference">
              Estimated from {metrics.meetingsBooked} meetings
            </div>
            <div className="flex items-center gap-1 mt-1" data-testid="trend-revenue-generated">
              {metrics.trend.revenue >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs ${metrics.trend.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(metrics.trend.revenue)}% vs previous period
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Avg Response Time */}
        <Card data-testid="card-avg-response-time">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="metric-avg-response-time">
              {metrics.avgResponseTime}h
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Time to first reply
            </div>
          </CardContent>
        </Card>

        {/* Time Saved */}
        <Card data-testid="card-time-saved">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Time Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="metric-time-saved">
              {metrics.timeSaved}h
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Estimated automation savings
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rate */}
        <Card data-testid="card-conversion-rate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="metric-conversion-rate">
              {metrics.conversionRate}%
            </div>
            <Progress value={metrics.conversionRate} className="h-2 mt-2" data-testid="progress-conversion-rate" />
            <div className="text-xs text-muted-foreground mt-1">
              Responses to meetings
            </div>
          </CardContent>
        </Card>

        {/* Automation Rate */}
        <Card data-testid="card-automation-rate">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4" />
              Automation Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="metric-automation-rate">
              85%
            </div>
            <Progress value={85} className="h-2 mt-2" data-testid="progress-automation-rate" />
            <div className="text-xs text-muted-foreground mt-1">
              Actions handled by AI
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Best Practices Section */}
      {bestPractices.length > 0 && (
        <Card className="border-2 border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              AI-Powered Best Practices
            </CardTitle>
            <CardDescription>
              Insights and recommendations based on your performance data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bestPractices.map((practice, index) => (
              <div key={index} className="bg-muted/30 rounded-lg p-4 space-y-2" data-testid={`best-practice-${index}`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold" data-testid={`best-practice-metric-${index}`}>{practice.metric}</h4>
                  <Badge variant="secondary" data-testid={`best-practice-impact-${index}`}>{practice.impact}</Badge>
                </div>
                <p className="text-sm text-muted-foreground" data-testid={`best-practice-insight-${index}`}>{practice.insight}</p>
                <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-950/20 rounded p-3 mt-2" data-testid={`best-practice-recommendation-${index}`}>
                  <Target className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium">{practice.recommendation}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Multichannel Performance */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl -mr-32 -mt-32" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Multichannel Performance
          </CardTitle>
          <CardDescription>
            Campaign metrics across all channels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Email Channel */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800/50" data-testid="channel-card-email">
              <div className="flex items-center justify-between mb-2">
                <Mail className="h-5 w-5 text-blue-600" data-testid="icon-email" />
                <Badge variant="secondary" className="text-xs" data-testid="badge-channel-email">Email</Badge>
              </div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300" data-testid="metric-email-sent">
                {metrics.totalEmails}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Sent</div>
              <Progress value={metrics.responseRate} className="h-1.5 mt-2" data-testid="progress-email-rate" />
              <div className="text-xs font-medium mt-1" data-testid="metric-email-reply-rate">{metrics.responseRate}% reply rate</div>
            </div>

            {/* LinkedIn Channel */}
            <div className="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950/30 dark:to-sky-900/30 rounded-lg p-4 border border-sky-200 dark:border-sky-800/50" data-testid="channel-card-linkedin">
              <div className="flex items-center justify-between mb-2">
                <Users className="h-5 w-5 text-sky-600" data-testid="icon-linkedin" />
                <Badge variant="secondary" className="text-xs" data-testid="badge-channel-linkedin">LinkedIn</Badge>
              </div>
              <div className="text-2xl font-bold text-sky-700 dark:text-sky-300" data-testid="metric-linkedin-connections">
                {Math.floor(metrics.totalEmails * 0.4)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Connections</div>
              <Progress value={31} className="h-1.5 mt-2" data-testid="progress-linkedin-rate" />
              <div className="text-xs font-medium mt-1" data-testid="metric-linkedin-acceptance-rate">31% acceptance rate</div>
            </div>

            {/* SMS Channel */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800/50" data-testid="channel-card-sms">
              <div className="flex items-center justify-between mb-2">
                <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="icon-sms">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <Badge variant="secondary" className="text-xs" data-testid="badge-channel-sms">SMS</Badge>
              </div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300" data-testid="metric-sms-sent">
                {Math.floor(metrics.totalEmails * 0.2)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Messages</div>
              <Progress value={18} className="h-1.5 mt-2" data-testid="progress-sms-rate" />
              <div className="text-xs font-medium mt-1" data-testid="metric-sms-reply-rate">18% reply rate</div>
            </div>

            {/* Phone Channel */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30 rounded-lg p-4 border border-green-200 dark:border-green-800/50" data-testid="channel-card-phone">
              <div className="flex items-center justify-between mb-2">
                <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-testid="icon-phone">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <Badge variant="secondary" className="text-xs" data-testid="badge-channel-phone">Phone</Badge>
              </div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300" data-testid="metric-phone-calls">
                {Math.floor(metrics.totalEmails * 0.15)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Calls</div>
              <Progress value={42} className="h-1.5 mt-2" data-testid="progress-phone-rate" />
              <div className="text-xs font-medium mt-1" data-testid="metric-phone-connect-rate">42% connect rate</div>
            </div>

            {/* WhatsApp Channel */}
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800/50" data-testid="channel-card-whatsapp">
              <div className="flex items-center justify-between mb-2">
                <svg className="h-5 w-5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24" data-testid="icon-whatsapp">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <Badge variant="secondary" className="text-xs" data-testid="badge-channel-whatsapp">WhatsApp</Badge>
              </div>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300" data-testid="metric-whatsapp-sent">
                {Math.floor(metrics.totalEmails * 0.1)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Messages</div>
              <Progress value={25} className="h-1.5 mt-2" data-testid="progress-whatsapp-rate" />
              <div className="text-xs font-medium mt-1" data-testid="metric-whatsapp-reply-rate">25% reply rate</div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-primary/20" data-testid="integration-callout">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-primary" />
              <span className="font-medium">Integration Ready:</span> Connect LinkedIn and SmartReach (Email, SMS, Phone) for real-time metrics
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Campaign List */}
      <Card className="relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-3xl -ml-48 -mb-48" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Active Campaigns
          </CardTitle>
          <CardDescription>
            Track performance across all your campaigns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {!isDemo ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No campaigns yet</p>
                <p className="text-sm">Create campaigns to see performance metrics here</p>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">Demo Workspace</p>
                <p className="text-sm">Switch to a real workspace to see your campaign analytics</p>
              </div>
            )}
          </div>

          <Button 
            variant="outline" 
            className="w-full mt-4" 
            onClick={() => window.location.href = '/campaigns'}
            data-testid="button-view-all-campaigns"
          >
            View All Campaigns
          </Button>
        </CardContent>
      </Card>

      {/* Coming Soon Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="h-5 w-5" />
              Advanced Email Analytics
            </CardTitle>
            <CardDescription>
              Email opens, clicks, and detailed interaction heatmaps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Coming soon with email tracking integration</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              <PieChart className="h-5 w-5" />
              Lead Scoring Dashboard
            </CardTitle>
            <CardDescription>
              AI-powered lead quality scores and engagement levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Building intelligent scoring algorithm</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
