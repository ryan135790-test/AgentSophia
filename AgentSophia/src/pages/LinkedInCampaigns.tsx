import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Linkedin, Users, MessageSquare, TrendingUp, CheckCircle, ArrowUp, ArrowDown } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

interface LinkedInStats {
  requests_sent: number;
  accepted: number;
  messages_sent: number;
  replies: number;
  meetings: number;
}

interface EngagementData {
  title: string;
  stats: string;
  badge: string;
  badgeColor: string;
}

interface DailyData {
  date: string;
  displayDate: string;
  sent: number;
  accepted: number;
  sentChange: number;
  acceptedChange: number;
}

interface DailyAnalytics {
  chartData: DailyData[];
  summary: {
    totalSent: number;
    totalAccepted: number;
    avgSentPerDay: number;
    avgAcceptedPerDay: number;
    acceptanceRate: number;
    period: string;
  };
}

const DEMO_STATS: LinkedInStats = {
  requests_sent: 245,
  accepted: 142,
  messages_sent: 189,
  replies: 43,
  meetings: 8
};

const DEMO_ENGAGEMENT: EngagementData[] = [
  {
    title: 'VP Sales',
    stats: '68 accepted • 18 replies • 4 meetings (4.7% conversion)',
    badge: 'Top',
    badgeColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  },
  {
    title: 'CMO',
    stats: '48 accepted • 12 replies • 2 meetings (2.2% conversion)',
    badge: 'Active',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  },
  {
    title: 'CEO',
    stats: '52 accepted • 8 replies • 2 meetings (2.6% conversion)',
    badge: 'Engaged',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
  }
];

const DEMO_DAILY_DATA: DailyData[] = [
  { date: '2026-01-27', displayDate: 'Jan 27', sent: 12, accepted: 5, sentChange: 0, acceptedChange: 0 },
  { date: '2026-01-28', displayDate: 'Jan 28', sent: 18, accepted: 8, sentChange: 50, acceptedChange: 60 },
  { date: '2026-01-29', displayDate: 'Jan 29', sent: 15, accepted: 10, sentChange: -17, acceptedChange: 25 },
  { date: '2026-01-30', displayDate: 'Jan 30', sent: 22, accepted: 12, sentChange: 47, acceptedChange: 20 },
  { date: '2026-01-31', displayDate: 'Jan 31', sent: 20, accepted: 15, sentChange: -9, acceptedChange: 25 },
  { date: '2026-02-01', displayDate: 'Feb 1', sent: 25, accepted: 18, sentChange: 25, acceptedChange: 20 },
  { date: '2026-02-02', displayDate: 'Feb 2', sent: 28, accepted: 14, sentChange: 12, acceptedChange: -22 },
];

export default function LinkedInCampaigns() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  const [stats, setStats] = useState<LinkedInStats | null>(null);
  const [engagement, setEngagement] = useState<EngagementData[]>([]);
  const [dailyAnalytics, setDailyAnalytics] = useState<DailyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspaceId) {
      return;
    }
    if (isDemo) {
      setStats(DEMO_STATS);
      setEngagement(DEMO_ENGAGEMENT);
      setDailyAnalytics({
        chartData: DEMO_DAILY_DATA,
        summary: {
          totalSent: 140,
          totalAccepted: 82,
          avgSentPerDay: 20,
          avgAcceptedPerDay: 12,
          acceptanceRate: 59,
          period: '7 days'
        }
      });
      setLoading(false);
      return;
    }
    
    const fetchStats = async () => {
      try {
        const dailyRes = await fetch(`/api/linkedin/daily-analytics?workspace_id=${workspaceId}&days=30`);
        
        if (dailyRes.ok) {
          const dailyData = await dailyRes.json();
          if (dailyData.success) {
            setDailyAnalytics(dailyData);
            setStats({
              requests_sent: dailyData.summary.totalSent || 0,
              accepted: dailyData.summary.totalAccepted || 0,
              messages_sent: 0,
              replies: 0,
              meetings: 0
            });
          }
        }
      } catch (error) {
        console.error('Error fetching LinkedIn stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [workspaceId, isDemo]);

  if (!workspaceId || loading) {
    return <div className="p-8 text-center">Loading LinkedIn campaigns...</div>;
  }

  const hasNoData = !stats && !dailyAnalytics && !isDemo;

  if (hasNoData) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Linkedin className="h-8 w-8 text-blue-600" />
              LinkedIn Campaigns
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Connection requests, messages & engagement tracking</p>
          </div>
          <Card className="p-12 text-center">
            <Linkedin className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No LinkedIn Data Yet</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Connect your LinkedIn account and start campaigns to see engagement analytics here.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const displayStats = stats || { requests_sent: 0, accepted: 0, messages_sent: 0, replies: 0, meetings: 0 };
  const acceptRate = displayStats.requests_sent > 0 ? ((displayStats.accepted / displayStats.requests_sent) * 100).toFixed(1) : '0';
  const replyRate = displayStats.messages_sent > 0 ? ((displayStats.replies / displayStats.messages_sent) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Linkedin className="h-8 w-8 text-blue-600" />
            LinkedIn Campaigns
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Connection requests, messages & engagement tracking</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Sent</CardTitle>
              <div className="text-2xl font-bold">{displayStats.requests_sent}</div>
              <p className="text-xs text-blue-600">Requests</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Accepted</CardTitle>
              <div className="text-2xl font-bold">{displayStats.accepted}</div>
              <p className="text-xs text-green-600">{acceptRate}%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <MessageSquare className="h-4 w-4" /> Messages
              </CardTitle>
              <div className="text-2xl font-bold">{displayStats.messages_sent}</div>
              <p className="text-xs text-purple-600">Sent</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Replies</CardTitle>
              <div className="text-2xl font-bold">{displayStats.replies}</div>
              <p className="text-xs text-orange-600">{replyRate}%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Meetings</CardTitle>
              <div className="text-2xl font-bold">{displayStats.meetings}</div>
              <p className="text-xs text-emerald-600">Booked</p>
            </CardHeader>
          </Card>
        </div>

        {dailyAnalytics && dailyAnalytics.chartData.length > 0 && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Daily Connections
                  </CardTitle>
                  <CardDescription>
                    Connections sent vs accepted over the last {dailyAnalytics.summary.period}
                  </CardDescription>
                </div>
                <div className="flex gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{dailyAnalytics.summary.avgSentPerDay}</div>
                    <div className="text-xs text-muted-foreground">Avg Sent/Day</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">{dailyAnalytics.summary.avgAcceptedPerDay}</div>
                    <div className="text-xs text-muted-foreground">Avg Accepted/Day</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{dailyAnalytics.summary.acceptanceRate}%</div>
                    <div className="text-xs text-muted-foreground">Accept Rate</div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyAnalytics.chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis 
                      dataKey="displayDate" 
                      tick={{ fontSize: 12 }}
                      className="text-slate-600 dark:text-slate-400"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-slate-600 dark:text-slate-400"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'rgba(255,255,255,0.95)', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                      }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const sent = payload.find(p => p.dataKey === 'sent');
                          const accepted = payload.find(p => p.dataKey === 'accepted');
                          const data = payload[0]?.payload;
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                              <p className="font-semibold text-sm mb-2">{label}</p>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-sm bg-blue-500" />
                                  <span className="text-sm">Sent: {sent?.value}</span>
                                  {data?.sentChange !== 0 && (
                                    <span className={`text-xs flex items-center ${data?.sentChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {data?.sentChange > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                      {Math.abs(data?.sentChange)}%
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-sm bg-green-500" />
                                  <span className="text-sm">Accepted: {accepted?.value}</span>
                                  {data?.acceptedChange !== 0 && (
                                    <span className={`text-xs flex items-center ${data?.acceptedChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {data?.acceptedChange > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                      {Math.abs(data?.acceptedChange)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '10px' }}
                      formatter={(value) => (
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {value === 'sent' ? 'Connections Sent' : 'Connections Accepted'}
                        </span>
                      )}
                    />
                    <Bar 
                      dataKey="sent" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]}
                      name="sent"
                    />
                    <Bar 
                      dataKey="accepted" 
                      fill="#22c55e" 
                      radius={[4, 4, 0, 0]}
                      name="accepted"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {engagement.length > 0 && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                Engagement by Buyer Title
              </CardTitle>
              <CardDescription>Highest performing segments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {engagement.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <div>
                      <p className="font-semibold text-sm">{item.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{item.stats}</p>
                    </div>
                    <Badge className={item.badgeColor}>{item.badge}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(isDemo || (stats && stats.requests_sent > 0)) && (
          <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Sophia's LinkedIn Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isDemo ? (
                <>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Best strategy:</strong> Send connection request first, then message 24 hours after acceptance (57.9% acceptance)</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Top segment:</strong> VP Sales show 4.7% conversion - 2.1x better than average</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Message timing:</strong> Send within 24 hours of connection acceptance (22.5% reply rate)</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Message length:</strong> Keep to 100-150 characters for highest engagement</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Revenue:</strong> LinkedIn generates $125K - highest revenue per contact</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Acceptance Rate:</strong> {stats && stats.requests_sent > 0 ? ((stats.accepted / stats.requests_sent) * 100).toFixed(1) : 0}% of connection requests accepted</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Reply Rate:</strong> {stats && stats.messages_sent > 0 ? ((stats.replies / stats.messages_sent) * 100).toFixed(1) : 0}% of messages received replies</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Best Practice:</strong> Message within 24 hours of connection for highest engagement</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                    <p><strong>Pro Tip:</strong> Keep messages under 150 characters for better response rates</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
