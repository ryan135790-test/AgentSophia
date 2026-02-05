import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, TrendingUp, Zap } from 'lucide-react';

interface ActivityDecisionProps {
  id: string;
  action: string;
  type: string;
  status: string;
  confidence: number;
  outcome?: string;
  impact?: string;
  timestamp: string;
  details: string;
  contactName?: string;
  campaignName?: string;
}

export function ActivityDecisionCard({
  id, action, type, status, confidence, outcome, impact, timestamp, details, contactName, campaignName
}: ActivityDecisionProps) {
  const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
    success: { icon: CheckCircle, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: '✅ Executed' },
    pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', label: '⏳ Pending' },
    failed: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: '❌ Failed' },
    error: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: '❌ Error' },
    learning: { icon: TrendingUp, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: '📚 Learning' }
  };

  const defaultConfig = { icon: Clock, color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300', label: '❓ Unknown' };

  const typeConfig: Record<string, string> = {
    email: '📧 Email',
    message: '💬 Message',
    campaign: '🚀 Campaign',
    lead_score: '🔥 Lead Scoring',
    recommendation: '💡 Recommendation'
  };

  const outcomeConfig: Record<string, string> = {
    positive: '✨ Positive',
    neutral: '➖ Neutral',
    negative: '❌ Negative'
  };

  const config = statusConfig[status] || defaultConfig;
  const StatusIcon = config.icon;

  return (
    <Card className="p-4 hover:shadow-md transition border-l-4" style={{ borderLeftColor: status === 'success' ? '#10b981' : (status === 'failed' || status === 'error') ? '#ef4444' : '#f59e0b' }}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{typeConfig[type] || `📋 ${type || 'Activity'}`}</span>
              <Badge variant="outline" className="text-xs">Sophia</Badge>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{details}</p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-sm font-semibold ${config.color}`}>
            <StatusIcon className="h-4 w-4" />
            <span>{config.label}</span>
          </div>
        </div>

        {/* Context */}
        {(contactName || campaignName) && (
          <div className="flex gap-2 flex-wrap text-xs">
            {contactName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                👤 {contactName}
              </Badge>
            )}
            {campaignName && (
              <Badge variant="secondary" className="flex items-center gap-1">
                🎯 {campaignName}
              </Badge>
            )}
          </div>
        )}

        {/* Metrics */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-600" />
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{confidence}%</span>
              <span className="text-xs text-slate-500">confidence</span>
            </div>
          </div>

          {outcome && (
            <Badge variant="outline" className="text-xs">
              {outcomeConfig[outcome] || outcome}
            </Badge>
          )}

          {impact && (
            <div className="text-xs text-green-600 dark:text-green-400 font-semibold">
              {impact}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-xs text-slate-500 pt-2 border-t">
          {new Date(timestamp).toLocaleString()}
        </div>
      </div>
    </Card>
  );
}
