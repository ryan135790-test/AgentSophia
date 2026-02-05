import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, CheckCircle, AlertCircle, Target } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Deal {
  deal_id: string;
  company: string;
  contact: string;
  deal_value: string;
  stage: string;
  probability: string;
  sophia_health: { score: string; confidence: string };
}

interface PipelineStats {
  total_value: string;
  weighted_value: string;
  deals_closing: number;
  win_rate: string;
}

export default function DealPipeline() {
  const { currentWorkspace } = useWorkspace();
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';

  useEffect(() => {
    const fetchData = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }
      
      if (isDemo) {
        setStats({ total_value: '$2,450,000', weighted_value: '$1,127,500', deals_closing: 8, win_rate: '42%' });
        setDeals([
          { deal_id: '1', company: 'TechCorp Inc.', contact: 'Sarah Johnson', deal_value: '$125,000', stage: 'proposal', probability: '60%', sophia_health: { score: 'Healthy', confidence: '92%' } },
          { deal_id: '2', company: 'GrowthCo', contact: 'Michael Chen', deal_value: '$85,000', stage: 'negotiation', probability: '75%', sophia_health: { score: 'At Risk', confidence: '78%' } },
          { deal_id: '3', company: 'StartupHub', contact: 'Emily Watson', deal_value: '$45,000', stage: 'qualified', probability: '40%', sophia_health: { score: 'Healthy', confidence: '88%' } }
        ]);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/deals/pipeline`);
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats || null);
          setDeals(data.deals || []);
        }
      } catch (error) {
        console.error('Error fetching deal data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspaceId, isDemo]);

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'prospect':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'qualified':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'proposal':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'negotiation':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'won':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'lost':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'Healthy':
        return 'text-green-600';
      case 'At Risk':
        return 'text-orange-600';
      case 'Won':
        return 'text-emerald-600';
      default:
        return 'text-slate-600';
    }
  };

  if (loading) return <div className="p-8 text-center">Loading deal pipeline...</div>;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Target className="h-8 w-8 text-purple-600" />
            Deal Pipeline
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Track deals through stages with Sophia health insights</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Pipeline Value</CardTitle>
              <div className="text-2xl font-bold">{stats?.total_value}</div>
              <p className="text-xs text-purple-600">Total</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Weighted Value</CardTitle>
              <div className="text-2xl font-bold">{stats?.weighted_value}</div>
              <p className="text-xs text-blue-600">Forecast</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Closing</CardTitle>
              <div className="text-2xl font-bold">{stats?.deals_closing}</div>
              <p className="text-xs text-emerald-600">This month</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Win Rate</CardTitle>
              <div className="text-2xl font-bold">{stats?.win_rate}</div>
              <p className="text-xs text-green-600">Overall</p>
            </CardHeader>
          </Card>
        </div>

        {/* Active Deals */}
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              Active Deals
            </CardTitle>
            <CardDescription>Pipeline deals with Sophia health assessment</CardDescription>
          </CardHeader>
          <CardContent>
            {deals.length === 0 && !stats ? (
              <div className="text-center py-8 text-slate-500">
                <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">No deals in pipeline yet</p>
                <p className="text-sm">Add deals to track them through stages</p>
              </div>
            ) : (
            <div className="space-y-3">
              {deals.slice(0, 4).map((deal) => (
                <div key={deal.deal_id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{deal.company}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{deal.contact}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge className={getStageColor(deal.stage)}>{deal.stage}</Badge>
                      <Badge className="bg-slate-200 dark:bg-slate-700">{deal.probability}</Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{deal.deal_value}</span>
                    <div className="flex items-center gap-1">
                      {deal.sophia_health.score === 'Healthy' && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                      {deal.sophia_health.score === 'At Risk' && (
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                      )}
                      <span className={`text-xs font-semibold ${getHealthColor(deal.sophia_health.score)}`}>
                        {deal.sophia_health.score} • {deal.sophia_health.confidence}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Sophia Deal Insights - only show for demo workspace */}
        {isDemo && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Sophia's Deal Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Pipeline Health:</strong> $2.45M total • $845K weighted • 81% win rate</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Top Opportunity:</strong> Deal just won - $156K closed • Upsell potential +$50K</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>At Risk:</strong> 1 deal stalled in negotiation 12 days • Recommend discount or alt plan</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Forecast:</strong> $487.5K expected close this month • 12 deals • 87% confidence</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Next Action:</strong> 18 deals in proposal stage (89% close rate) - send proposals today</p>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
