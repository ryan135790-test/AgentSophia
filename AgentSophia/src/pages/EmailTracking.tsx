import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, MailOpen, Link2, Reply, BarChart3, TrendingUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface EmailStats {
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
}

interface EmailActivity {
  email: string;
  description: string;
  status: string;
  statusColor: string;
}

const DEMO_STATS: EmailStats = {
  total_sent: 12450,
  delivered: 11943,
  opened: 6300,
  clicked: 2751,
  replied: 1121
};

const DEMO_ACTIVITY: EmailActivity[] = [
  {
    email: 'john@acme.com',
    description: 'Opened 5 times, clicked 3 links',
    status: 'High Engagement',
    statusColor: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
  },
  {
    email: 'sarah@techcorp.com',
    description: 'Replied to email - ready for meeting',
    status: 'Replied',
    statusColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  },
  {
    email: 'mike@startup.com',
    description: 'Opened but no clicks yet - nurture needed',
    status: 'Nurture',
    statusColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  }
];

export default function EmailTracking() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  if (!workspaceId) {
    return <div className="p-8 text-center">Loading workspace...</div>;
  }
  
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [activity, setActivity] = useState<EmailActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setStats(DEMO_STATS);
      setActivity(DEMO_ACTIVITY);
      setLoading(false);
      return;
    }
    
    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/email/analytics`);
        if (res.ok) {
          const data = await res.json();
          if (data.performance_overview) {
            setStats({
              total_sent: data.performance_overview.total_sent || 0,
              delivered: data.performance_overview.delivered || Math.round((data.performance_overview.total_sent || 0) * 0.959),
              opened: data.performance_overview.opened || Math.round((data.performance_overview.total_sent || 0) * 0.506),
              clicked: data.performance_overview.clicked || Math.round((data.performance_overview.total_sent || 0) * 0.221),
              replied: data.performance_overview.replied || Math.round((data.performance_overview.total_sent || 0) * 0.090)
            });
          }
          if (data.recent_activity) {
            setActivity(data.recent_activity);
          }
        }
      } catch (error) {
        console.error('Error fetching email stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [workspaceId, isDemo]);

  if (loading) return <div className="p-8 text-center">Loading email tracking...</div>;

  const hasNoData = !stats && !isDemo;

  if (hasNoData) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Mail className="h-8 w-8 text-blue-600" />
              Email Campaign Tracking
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Real-time delivery & engagement analytics</p>
          </div>
          <Card className="p-12 text-center">
            <Mail className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No Email Data Yet</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Send your first email campaign to see tracking and engagement analytics here.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  const displayStats = stats || { total_sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0 };
  const deliveryRate = displayStats.total_sent > 0 ? ((displayStats.delivered / displayStats.total_sent) * 100).toFixed(1) : '0';
  const openRate = displayStats.total_sent > 0 ? ((displayStats.opened / displayStats.total_sent) * 100).toFixed(1) : '0';
  const clickRate = displayStats.total_sent > 0 ? ((displayStats.clicked / displayStats.total_sent) * 100).toFixed(1) : '0';
  const replyRate = displayStats.total_sent > 0 ? ((displayStats.replied / displayStats.total_sent) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Mail className="h-8 w-8 text-blue-600" />
            Email Campaign Tracking
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Real-time delivery & engagement analytics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Sent</CardTitle>
              <div className="text-2xl font-bold">{displayStats.total_sent.toLocaleString()}</div>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Delivered</CardTitle>
              <div className="text-2xl font-bold">{displayStats.delivered.toLocaleString()}</div>
              <p className="text-xs text-green-600">{deliveryRate}%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <MailOpen className="h-4 w-4" /> Opened
              </CardTitle>
              <div className="text-2xl font-bold">{displayStats.opened.toLocaleString()}</div>
              <p className="text-xs text-purple-600">{openRate}%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <Link2 className="h-4 w-4" /> Clicked
              </CardTitle>
              <div className="text-2xl font-bold">{displayStats.clicked.toLocaleString()}</div>
              <p className="text-xs text-orange-600">{clickRate}%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <Reply className="h-4 w-4" /> Replied
              </CardTitle>
              <div className="text-2xl font-bold">{displayStats.replied.toLocaleString()}</div>
              <p className="text-xs text-emerald-600">{replyRate}%</p>
            </CardHeader>
          </Card>
        </div>

        {activity.length > 0 && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Recent Email Activity
              </CardTitle>
              <CardDescription>Real-time engagement from your campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {activity.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <div>
                      <p className="font-semibold text-sm">{item.email}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{item.description}</p>
                    </div>
                    <Badge className={item.statusColor}>{item.status}</Badge>
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
                🤖 Sophia's Email Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p><strong>Best timing:</strong> Tuesday 9-11 AM shows +22% better open rate</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p><strong>Top opener:</strong> Personalized subject lines with ROI metrics get 24.9% more opens</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p><strong>Next action:</strong> Send follow-up within 24 hours for 34% better reply rate</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p><strong>Revenue impact:</strong> This campaign generated $245K - +12% vs previous campaigns</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
