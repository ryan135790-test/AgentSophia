import { Mail, Users, Zap, MessageSquare, TrendingUp, Settings, CheckCircle2, AlertCircle, Bot, RefreshCw, Inbox } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ActivityDecisionCard } from '@/components/agent-sophia/activity-decision-card';
import { SophiaLearningInsights } from '@/components/agent-sophia/sophia-learning-insights';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ActivityLog {
  id: string;
  type: string;
  action: string;
  status: string;
  confidence?: number;
  outcome?: string;
  impact?: string;
  timestamp: string;
  details?: string;
  contactName?: string;
  campaignName?: string;
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  email: { icon: Mail, color: 'bg-blue-100 text-blue-700', label: 'Email' },
  contact: { icon: Users, color: 'bg-purple-100 text-purple-700', label: 'Contact' },
  campaign: { icon: Zap, color: 'bg-amber-100 text-amber-700', label: 'Campaign' },
  message: { icon: MessageSquare, color: 'bg-green-100 text-green-700', label: 'Message' },
  lead_score: { icon: TrendingUp, color: 'bg-cyan-100 text-cyan-700', label: 'Lead Score' },
  lead: { icon: TrendingUp, color: 'bg-cyan-100 text-cyan-700', label: 'Lead' },
  settings: { icon: Settings, color: 'bg-slate-100 text-slate-700', label: 'Settings' },
  success: { icon: CheckCircle2, color: 'bg-green-100 text-green-700', label: 'Success' },
  error: { icon: AlertCircle, color: 'bg-red-100 text-red-700', label: 'Error' },
  system: { icon: Bot, color: 'bg-indigo-100 text-indigo-700', label: 'System' },
  action: { icon: Zap, color: 'bg-orange-100 text-orange-700', label: 'Action' },
  meeting: { icon: Users, color: 'bg-emerald-100 text-emerald-700', label: 'Meeting' },
};

export default function ActivityFeed() {
  const { currentWorkspace } = useWorkspace();
  const [filter, setFilter] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivityLog = async () => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }
    
    try {
      setRefreshing(true);
      const res = await fetch(`/api/sophia/activity-log/${currentWorkspace.id}`);
      if (res.ok) {
        const data = await res.json();
        setActivityLog(data);
      }
    } catch (error) {
      console.error('Error fetching activity log:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchActivityLog();
      const interval = setInterval(fetchActivityLog, 30000);
      return () => clearInterval(interval);
    }
  }, [currentWorkspace?.id]);

  const filteredLogs = filter 
    ? activityLog.filter((log) => log.type === filter) 
    : activityLog;

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Activity Feed</h1>
            <p className="text-slate-600 mt-2">Real-time workspace events powered by Sophia</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchActivityLog}
            disabled={refreshing}
            data-testid="button-refresh-activity"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="mb-8">
          <SophiaLearningInsights />
        </div>

        {!loading && activityLog.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-600" />
              Sophia's Recent Activity
              <span className="text-sm font-normal text-slate-500 ml-2">
                (Real-time data)
              </span>
            </h2>
            <div className="space-y-3">
              {activityLog.slice(0, 5).map((activity) => (
                <ActivityDecisionCard 
                  key={activity.id} 
                  id={activity.id}
                  action={activity.action}
                  type={activity.type as 'email' | 'message' | 'campaign' | 'lead_score' | 'recommendation'}
                  status={activity.status as 'success' | 'pending' | 'failed' | 'learning'}
                  confidence={activity.confidence || 0}
                  outcome={activity.outcome as 'positive' | 'neutral' | 'negative' | undefined}
                  impact={activity.impact}
                  timestamp={activity.timestamp}
                  details={activity.details || ''}
                  contactName={activity.contactName}
                  campaignName={activity.campaignName}
                />
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter(null)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                !filter
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              data-testid="button-filter-all"
            >
              All Events
            </button>
            {Object.entries(TYPE_CONFIG).slice(0, 6).map(([type, config]) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  filter === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                data-testid={`button-filter-${type}`}
              >
                {config.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
              <p className="text-slate-600">Loading real activity data...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-slate-500">
              <Bot className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="font-medium">No activity found</p>
              <p className="text-sm mt-2">Add contacts and campaigns to see real activity data here</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => {
              const config = TYPE_CONFIG[log.type] || TYPE_CONFIG.action;
              const Icon = config.icon;
              return (
                <div
                  key={log.id}
                  className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
                  data-testid={`activity-log-${log.id}`}
                >
                  <div className="flex gap-4">
                    <div className={`w-10 h-10 rounded-full ${config.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-slate-900">{log.action}</h3>
                          {log.details && (
                            <p className="text-slate-600 text-sm">{log.details}</p>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap ml-4">
                          {formatTimestamp(log.timestamp)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {log.confidence && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            {log.confidence}% confidence
                          </span>
                        )}
                        {log.impact && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {log.impact}
                          </span>
                        )}
                        {log.contactName && log.contactName !== 'System' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            {log.contactName}
                          </span>
                        )}
                        {log.campaignName && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            {log.campaignName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
