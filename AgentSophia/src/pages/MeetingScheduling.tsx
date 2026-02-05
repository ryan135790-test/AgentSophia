import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, TrendingUp, Clock, Zap } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Meeting {
  meeting_id: string;
  contact_name: string;
  company: string;
  title: string;
  scheduled_time: string;
  duration: number;
  type: string;
  auto_scheduled: boolean;
  deal_potential: string;
}

interface SchedulingStats {
  meetings_scheduled: number;
  meetings_this_week: number;
  auto_scheduled: number;
  meeting_to_deal_conversion: string;
  revenue_from_meetings: string;
}

const DEMO_STATS: SchedulingStats = {
  meetings_scheduled: 47,
  meetings_this_week: 28,
  auto_scheduled: 29,
  meeting_to_deal_conversion: '38.7%',
  revenue_from_meetings: '$312.5K'
};

const DEMO_MEETINGS: Meeting[] = [
  {
    meeting_id: 'mtg_1',
    contact_name: 'John Smith',
    company: 'Acme Corp',
    title: 'VP of Sales',
    scheduled_time: new Date(Date.now() + 86400000).toISOString(),
    duration: 30,
    type: 'demo',
    auto_scheduled: true,
    deal_potential: '$45K'
  },
  {
    meeting_id: 'mtg_2',
    contact_name: 'Sarah Johnson',
    company: 'TechCorp',
    title: 'CMO',
    scheduled_time: new Date(Date.now() + 172800000).toISOString(),
    duration: 45,
    type: 'consultation',
    auto_scheduled: true,
    deal_potential: '$85K'
  },
  {
    meeting_id: 'mtg_3',
    contact_name: 'Mike Wilson',
    company: 'StartupXYZ',
    title: 'CEO',
    scheduled_time: new Date(Date.now() + 259200000).toISOString(),
    duration: 30,
    type: 'discovery',
    auto_scheduled: false,
    deal_potential: '$25K'
  }
];

export default function MeetingScheduling() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  if (!workspaceId) {
    return <div className="p-8 text-center">Loading workspace...</div>;
  }
  
  const [stats, setStats] = useState<SchedulingStats | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setStats(DEMO_STATS);
      setMeetings(DEMO_MEETINGS);
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        const [dashRes, meetingsRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/calendar/dashboard`),
          fetch(`/api/workspaces/${workspaceId}/calendar/upcoming-meetings`)
        ]);

        if (dashRes.ok) {
          const data = await dashRes.json();
          setStats({
            meetings_scheduled: data.meetings_scheduled || 0,
            meetings_this_week: data.meetings_this_week || 0,
            auto_scheduled: data.auto_scheduled_meetings || 0,
            meeting_to_deal_conversion: data.key_metrics?.meeting_to_deal_conversion || '0%',
            revenue_from_meetings: data.key_metrics?.revenue_from_scheduled_meetings || '$0'
          });
        }

        if (meetingsRes.ok) {
          const data = await meetingsRes.json();
          setMeetings(data.meetings || []);
        }
      } catch (error) {
        console.error('Error fetching meeting data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspaceId, isDemo]);

  if (loading) return <div className="p-8 text-center">Loading meeting schedule...</div>;

  const hasNoData = !stats && meetings.length === 0 && !isDemo;

  if (hasNoData) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Calendar className="h-8 w-8 text-blue-600" />
              Meeting Scheduling
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Auto-schedule meetings when leads show interest</p>
          </div>
          <Card className="p-12 text-center">
            <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No Meetings Scheduled</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Connect your calendar and enable auto-scheduling to start booking meetings automatically.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const displayStats = stats || { meetings_scheduled: 0, meetings_this_week: 0, auto_scheduled: 0, meeting_to_deal_conversion: '0%', revenue_from_meetings: '$0' };
  const autoRate = displayStats.meetings_scheduled > 0 
    ? ((displayStats.auto_scheduled / displayStats.meetings_scheduled) * 100).toFixed(1)
    : '0';

  const getMeetingTypeColor = (type: string) => {
    switch (type) {
      case 'demo':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'consultation':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'discovery':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            Meeting Scheduling
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Auto-schedule meetings when leads show interest</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Scheduled</CardTitle>
              <div className="text-2xl font-bold">{displayStats.meetings_scheduled}</div>
              <p className="text-xs text-blue-600">This month</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <Zap className="h-4 w-4" /> Auto-Scheduled
              </CardTitle>
              <div className="text-2xl font-bold">{displayStats.auto_scheduled}</div>
              <p className="text-xs text-green-600">{autoRate}%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Conversion</CardTitle>
              <div className="text-2xl font-bold">{displayStats.meeting_to_deal_conversion}</div>
              <p className="text-xs text-purple-600">Meeting to deal</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Revenue</CardTitle>
              <div className="text-2xl font-bold">{displayStats.revenue_from_meetings}</div>
              <p className="text-xs text-emerald-600">From meetings</p>
            </CardHeader>
          </Card>
        </div>

        {meetings.length > 0 && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Upcoming Meetings
              </CardTitle>
              <CardDescription>{displayStats.meetings_this_week} meetings this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div key={meeting.meeting_id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{meeting.contact_name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{meeting.title} at {meeting.company}</p>
                      </div>
                      <div className="flex gap-2">
                        <Badge className={getMeetingTypeColor(meeting.type)}>{meeting.type}</Badge>
                        {meeting.auto_scheduled && (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">Auto</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex gap-2 text-slate-600 dark:text-slate-400">
                        <span>📅 {new Date(meeting.scheduled_time).toLocaleDateString()}</span>
                        <span>⏱️ {meeting.duration} min</span>
                        <span className="font-semibold text-emerald-600">💰 {meeting.deal_potential}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isDemo && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Sophia's Scheduling Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <p><strong>Best times:</strong> Tuesday-Thursday 10-11 AM have 34% higher conversion rate</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <p><strong>Auto-scheduling:</strong> 62.7% of meetings auto-scheduled by Sophia (saving 12 hours/week)</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <p><strong>Hot lead response:</strong> Scheduling within 5 minutes of reply increases conversion by 42%</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <p><strong>Revenue impact:</strong> $312.5K revenue from 47 scheduled meetings this month</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
