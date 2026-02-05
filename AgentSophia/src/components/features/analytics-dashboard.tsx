import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Users, Target, BarChart3 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function AnalyticsDashboard() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchMetrics();
    }
  }, [currentWorkspace?.id]);

  const fetchMetrics = async () => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/analytics-dashboard`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load analytics', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !metrics) return <div>Loading analytics...</div>;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-blue-50" data-testid="card-total-contacts">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{metrics.total_contacts}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50" data-testid="card-response-rate">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Response Rate</p>
                <p className="text-2xl font-bold">{metrics.response_rate.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50" data-testid="card-pipeline-value">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold">${(metrics.pipeline_value / 1000000).toFixed(1)}M</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50" data-testid="card-forecast-revenue">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Forecast Revenue</p>
                <p className="text-2xl font-bold">${(metrics.forecast_revenue / 1000000).toFixed(1)}M</p>
              </div>
              <Target className="h-8 w-8 text-orange-600 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Channel Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={metrics.top_channels}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="channel" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Intent Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={metrics.top_intents}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ intent, count }) => `${intent} (${count})`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
              >
                {metrics.top_intents.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card data-testid="card-key-metrics">
        <CardHeader>
          <CardTitle>Key Metrics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="border rounded p-3">
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
            <p className="text-lg font-bold mt-1">{metrics.conversion_rate.toFixed(1)}%</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-xs text-muted-foreground">Total Campaigns</p>
            <p className="text-lg font-bold mt-1">{metrics.total_campaigns}</p>
          </div>
          <div className="border rounded p-3">
            <p className="text-xs text-muted-foreground">Avg Deal Value</p>
            <p className="text-lg font-bold mt-1">${(metrics.avg_deal_value / 1000).toFixed(0)}K</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
