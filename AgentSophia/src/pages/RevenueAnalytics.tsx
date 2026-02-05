import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, DollarSign, PieChart, Target, CheckCircle, Brain } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface RevenueStats {
  total_revenue: string;
  trend: string;
  roi: string;
  deals_closed: number;
  pipeline: string;
}

const emptyStats: RevenueStats = {
  total_revenue: '$0',
  trend: '0%',
  roi: '0%',
  deals_closed: 0,
  pipeline: '$0'
};

export default function RevenueAnalytics() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (isDemo) {
        setStats(emptyStats);
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/revenue/dashboard`);
        if (res.ok) {
          const data = await res.json();
          setStats({
            total_revenue: data.total_revenue_generated || '$0',
            trend: data.revenue_trend || '0%',
            roi: data.roi_overall || '0%',
            deals_closed: data.key_metrics?.closed_deals || 0,
            pipeline: data.pipeline_value ? `$${Number(data.pipeline_value).toLocaleString()}` : '$0'
          });
        } else {
          setStats(emptyStats);
        }
      } catch (error) {
        console.error('Error fetching revenue data:', error);
        setStats(emptyStats);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [workspaceId, isDemo]);

  if (loading) return <div className="p-8 text-center">Loading revenue analytics...</div>;
  
  if (!stats && !isDemo) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-6">
            <DollarSign className="h-8 w-8 text-emerald-600" />
            Revenue & ROI Analytics
          </h1>
          <Card className="p-12 text-center">
            <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No Revenue Data Yet</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Start closing deals and running campaigns to see your revenue analytics and ROI metrics here.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Sophia Insights for Demo */}
        {isDemo && (
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
                <Brain className="h-5 w-5" />
                Sophia's Revenue Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Your ROI is <strong>847%</strong> - significantly above the 300% industry benchmark. Email campaigns are your top revenue driver with $195K generated.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  Top Performer
                </Badge>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                  Demo Data
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-emerald-600" />
            Revenue & ROI Analytics
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Business impact metrics and financial performance</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Revenue</CardTitle>
              <div className="text-2xl font-bold">{stats?.total_revenue}</div>
              <p className="text-xs text-emerald-600">{stats?.trend}</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">ROI</CardTitle>
              <div className="text-2xl font-bold">{stats?.roi}</div>
              <p className="text-xs text-blue-600">Overall platform ROI</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Deals Closed</CardTitle>
              <div className="text-2xl font-bold">{stats?.deals_closed}</div>
              <p className="text-xs text-purple-600">This month</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Pipeline</CardTitle>
              <div className="text-2xl font-bold">{stats?.pipeline}</div>
              <p className="text-xs text-orange-600">Next 30 days</p>
            </CardHeader>
          </Card>
        </div>

        {/* Revenue by Channel - Demo Only */}
        {isDemo && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-emerald-600" />
                Revenue by Channel
              </CardTitle>
              <CardDescription>Which channels drive the most business value</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                  <div>
                    <p className="font-semibold text-sm">📧 Email</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">12 deals • 50.6% response rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">$195K</p>
                    <p className="text-xs text-emerald-600">ROI: 380%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                  <div>
                    <p className="font-semibold text-sm">💬 SMS</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">8 deals • 36.3% reply rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">$97.5K</p>
                    <p className="text-xs text-emerald-600">ROI: 420%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                  <div>
                    <p className="font-semibold text-sm">🔗 LinkedIn</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">11 deals • 57.9% acceptance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">$146.2K</p>
                    <p className="text-xs text-emerald-600">ROI: 295%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                  <div>
                    <p className="font-semibold text-sm">☎️ Phone</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">3 deals • 36.3% answer rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">$48.7K</p>
                    <p className="text-xs text-emerald-600">ROI: 250%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Campaigns - Demo Only */}
        {isDemo && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Top Performing Campaigns
              </CardTitle>
              <CardDescription>Highest revenue generators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                  <div>
                    <p className="font-semibold text-sm">Q1 Enterprise Sales Push</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">9 deals • 1,245 contacts</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">$156K</p>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 mt-1">ROI: 420%</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                  <div>
                    <p className="font-semibold text-sm">SMB Growth Initiative</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">12 deals • 987 contacts</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">$128.7K</p>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 mt-1">ROI: 380%</Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded">
                  <div>
                    <p className="font-semibold text-sm">Tech Stack Expansion</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">5 deals • 542 contacts</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">$95K</p>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 mt-1">ROI: 290%</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Revenue Forecast - Demo Only */}
        {isDemo && (
          <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Revenue Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-white dark:bg-slate-900 rounded">
                  <p className="text-xs text-slate-600 dark:text-slate-400">Next 30 Days</p>
                  <p className="text-lg font-bold">$625K</p>
                  <p className="text-xs text-emerald-600">87% confidence</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded">
                  <p className="text-xs text-slate-600 dark:text-slate-400">Next 90 Days</p>
                  <p className="text-lg font-bold">$1.87M</p>
                  <p className="text-xs text-emerald-600">78% confidence</p>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900 rounded">
                  <p className="text-xs text-slate-600 dark:text-slate-400">Next 12 Months</p>
                  <p className="text-lg font-bold">$7.2M</p>
                  <p className="text-xs text-emerald-600">72% confidence • 45% growth</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sophia Revenue Insights - Demo Only */}
        {isDemo && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Sophia's Revenue Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <p><strong>Highest ROI:</strong> SMS delivers 420% ROI • Cost: $900 for $97.5K revenue</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <p><strong>Best Segment:</strong> VP Sales generate $187.5K • 4.7% conversion rate</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <p><strong>Payback Period:</strong> Only 3 days • LTV:CAC ratio of 844:1 (enterprise-level)</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <p><strong>Recommendation:</strong> Scale SMS + Email channels (85% of revenue) + scale VP Sales targeting</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <p><strong>Hot Opportunity:</strong> 127 hot leads worth ~$284K in next 30 days (91% confidence)</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
