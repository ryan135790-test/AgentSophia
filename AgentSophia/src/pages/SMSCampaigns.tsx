import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Send, Reply, TrendingUp, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface SMSStats {
  total_sent: number;
  delivered: number;
  replied: number;
  revenue: string;
}

interface SMSReply {
  id: string;
  phone: string;
  contact_name: string;
  message: string;
  sentiment: string;
}

export default function SMSCampaigns() {
  const { currentWorkspace } = useWorkspace();
  const [stats, setStats] = useState<SMSStats | null>(null);
  const [replies, setReplies] = useState<SMSReply[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';

  useEffect(() => {
    const fetchStats = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      
      if (isDemo) {
        setStats({ total_sent: 847, delivered: 812, replied: 307, revenue: '$24,500' });
        setReplies([
          { id: '1', phone: '+1-555-0123', contact_name: 'John', message: 'Yes interested, call me tomorrow', sentiment: 'Positive' },
          { id: '2', phone: '+1-555-0124', contact_name: 'Sarah', message: 'Tell me more about pricing', sentiment: 'Question' },
          { id: '3', phone: '+1-555-0125', contact_name: 'Mike', message: 'Schedule a demo for next week', sentiment: 'Meeting' }
        ]);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/sms-analytics`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats || null);
          setReplies(data.recent_replies || []);
        }
      } catch (error) {
        console.error('Error fetching SMS stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [workspaceId, isDemo]);

  if (loading) return <div className="p-8 text-center">Loading SMS campaigns...</div>;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-green-600" />
            SMS Campaigns
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Real-time SMS delivery & reply analytics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Sent</CardTitle>
              <div className="text-2xl font-bold">{stats?.total_sent}</div>
              <p className="text-xs text-blue-600">via Twilio</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Delivered</CardTitle>
              <div className="text-2xl font-bold">{stats?.delivered}</div>
              <p className="text-xs text-green-600">95.9%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <Reply className="h-4 w-4" /> Replied
              </CardTitle>
              <div className="text-2xl font-bold">{stats?.replied}</div>
              <p className="text-xs text-purple-600">36.3%</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Revenue</CardTitle>
              <div className="text-2xl font-bold">{stats?.revenue}</div>
              <p className="text-xs text-emerald-600">+8.2% conversion</p>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Recent SMS Replies
            </CardTitle>
            <CardDescription>Real-time engagement from SMS campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {replies.length === 0 && !stats ? (
              <div className="text-center py-8 text-slate-500">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No SMS activity yet</p>
                <p className="text-sm">Start an SMS campaign to see replies here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {replies.map((reply) => (
                  <div key={reply.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                    <div>
                      <p className="font-semibold text-sm">{reply.phone} ({reply.contact_name})</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">"{reply.message}"</p>
                    </div>
                    <Badge className={
                      reply.sentiment === 'Positive' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      reply.sentiment === 'Question' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                    }>{reply.sentiment}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sophia SMS Insights - only show for demo workspace */}
        {isDemo && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Sophia's SMS Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p><strong>Best timing:</strong> Monday 9 AM or Tuesday 2 PM shows +24% higher reply rate</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p><strong>Message length:</strong> Keep to 160 characters for single SMS (36.3% reply rate)</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p><strong>Best segment:</strong> VP Sales reply 3x faster than other titles (avg 5 min)</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p><strong>Next action:</strong> Call within 2 hours of reply for 65% conversion to meeting</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
              <p><strong>ROI:</strong> SMS shows 8.2% conversion rate - 2.1x better than email alone</p>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
