import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Target, AlertTriangle, CheckCircle, TrendingDown, Brain } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ForecastData {
  current_month_forecast: string;
  forecast_accuracy: string;
  next_90_days: {
    revenue_forecast: string;
    confidence: string;
    growth_rate: string;
  };
}

const emptyForecast: ForecastData = {
  current_month_forecast: '$0',
  forecast_accuracy: '0%',
  next_90_days: {
    revenue_forecast: '$0',
    confidence: '0%',
    growth_rate: '0%'
  }
};

export default function RevenueForecast() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (isDemo) {
        setForecast(emptyForecast);
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/workspaces/${workspaceId}/forecasting/dashboard`);
        if (response.ok) {
          const data = await response.json();
          setForecast(data);
        } else {
          setForecast(emptyForecast);
        }
      } catch (error) {
        console.error('Error fetching forecast:', error);
        setForecast(emptyForecast);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspaceId, isDemo]);

  if (loading) return <div className="p-8 text-center">Loading forecast...</div>;
  
  if (!forecast && !isDemo) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-6">
            <TrendingUp className="h-8 w-8 text-green-600" />
            Revenue Forecasting
          </h1>
          <Card className="p-12 text-center">
            <Target className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No Forecast Data Yet</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              As you close deals and run campaigns, Sophia will generate revenue forecasts and predictions here.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-600" />
            Revenue Forecasting
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">ML-powered predictions for revenue, deals, and optimal timing</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">This Month</CardTitle>
              <div className="text-2xl font-bold">{forecast?.current_month_forecast}</div>
              <p className="text-xs text-green-600">Forecast</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Accuracy</CardTitle>
              <div className="text-2xl font-bold">{forecast?.forecast_accuracy}</div>
              <p className="text-xs text-blue-600">Model accuracy</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">90-Day Revenue</CardTitle>
              <div className="text-2xl font-bold">{forecast?.next_90_days.revenue_forecast}</div>
              <p className="text-xs text-purple-600">{forecast?.next_90_days.growth_rate} growth</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Confidence</CardTitle>
              <div className="text-2xl font-bold">{forecast?.next_90_days.confidence}</div>
              <p className="text-xs text-emerald-600">Prediction confidence</p>
            </CardHeader>
          </Card>
        </div>

        {/* Forecasting Insights - Demo Only */}
        {isDemo && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Sophia's Forecasting Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p><strong>Revenue Prediction:</strong> $512.4K expected this month (96.2% model accuracy)</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p><strong>90-Day Forecast:</strong> $1.875M revenue predicted (+24% growth) with 87% confidence</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p><strong>Optimal Timing:</strong> Send campaigns Tuesday 10 AM (58.3% open rate) for best results</p>
              </div>
              <div className="flex gap-2 text-sm">
                <TrendingDown className="h-5 w-5 text-orange-600 flex-shrink-0" />
                <p><strong>At-Risk Deals:</strong> $245K revenue at risk from 8 stalled deals - recommend immediate outreach</p>
              </div>
              <div className="flex gap-2 text-sm">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p><strong>Top Channel ROI:</strong> SMS campaigns delivering 32,400% ROI - scale to warm leads immediately</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Channel Performance Predictions - Demo Only */}
        {isDemo && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Channel Performance Predictions
              </CardTitle>
              <CardDescription>Expected performance by channel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { channel: 'Email', open: '42.3%', conversion: '6.7%', trend: 'stable' },
                  { channel: 'SMS', open: '97.1%', conversion: '9.2%', trend: 'up' },
                  { channel: 'LinkedIn', open: '57.9%', conversion: '8.3%', trend: 'up' },
                  { channel: 'Phone', open: '36.3%', conversion: '7.8%', trend: 'stable' }
                ].map((item) => (
                  <div key={item.channel} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{item.channel}</p>
                      <Badge className={item.trend === 'up' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'}>
                        {item.trend === 'up' ? '📈 Trending Up' : '➡️ Stable'}
                      </Badge>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span>Performance: <strong>{item.open}</strong></span>
                      <span>Conversion: <strong>{item.conversion}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign ROI Predictions - Demo Only */}
        {isDemo && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                Campaign ROI Predictions
              </CardTitle>
              <CardDescription>Recommended next actions by campaign</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'SMS Follow-ups', roi: '32,400%', action: 'Scale to warm leads' },
                  { name: 'Product Demo Series', roi: '19,600%', action: 'Continue scaling' },
                  { name: 'LinkedIn Outreach', roi: '12,167%', action: 'Increase budget +30%' },
                  { name: 'Re-engagement Campaign', roi: '9,725%', action: 'Optimize copy' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm">
                    <div>
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{item.action}</p>
                    </div>
                    <span className="font-bold text-emerald-600">{item.roi}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
