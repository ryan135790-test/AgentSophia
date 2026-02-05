import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Loader2, AlertCircle, Zap, Mail, Calendar, BarChart3 } from 'lucide-react';

interface AutonomousAction {
  id: string;
  type: 'campaign' | 'message' | 'meeting' | 'analysis' | 'optimization';
  status: 'pending' | 'executing' | 'completed' | 'failed';
  description: string;
  expectedOutcome: string;
  startedAt: string;
  completedAt?: string;
  results?: Record<string, any>;
}

const TYPE_ICONS = {
  campaign: <Mail className="w-4 h-4" />,
  message: <Mail className="w-4 h-4" />,
  meeting: <Calendar className="w-4 h-4" />,
  analysis: <BarChart3 className="w-4 h-4" />,
  optimization: <Zap className="w-4 h-4" />,
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  executing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export function AutonomousActionsMonitor() {
  const [actions, setActions] = useState<AutonomousAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        const response = await fetch('/api/sophia/recent-actions?limit=5');
        const data = await response.json();
        setActions(data.actions || []);
      } catch (error) {
        console.error('Failed to fetch actions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
    const interval = setInterval(fetchActions, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-600" />
          Autonomous Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actions.length === 0 ? (
          <p className="text-sm text-slate-500">No autonomous actions yet</p>
        ) : (
          actions.map((action) => (
            <div
              key={action.id}
              className="p-3 border rounded-lg"
              data-testid={`autonomous-action-${action.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  {action.status === 'executing' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 mt-0.5 flex-shrink-0" />
                  ) : action.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{action.description}</p>
                    <p className="text-xs text-slate-600 line-clamp-2">{action.expectedOutcome}</p>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[action.status]}>
                  {action.status}
                </Badge>
              </div>
              {action.results && (
                <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600">
                  <p>{action.results.message}</p>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
