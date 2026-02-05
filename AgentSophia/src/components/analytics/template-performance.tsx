import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TemplatePerformanceProps {
  workspaceId: string;
}

export function TemplatePerformance({ workspaceId }: TemplatePerformanceProps) {
  const { toast } = useToast();
  const [performance, setPerformance] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [workspaceId]);

  const fetchAnalytics = async () => {
    try {
      const [perfRes, patternsRes] = await Promise.all([
        fetch(`/api/workspaces/${workspaceId}/template-performance`),
        fetch(`/api/workspaces/${workspaceId}/winning-patterns`)
      ]);

      if (!perfRes.ok || !patternsRes.ok) throw new Error('Failed to fetch analytics');

      const [perfData, patternsData] = await Promise.all([
        perfRes.json(),
        patternsRes.json()
      ]);

      setPerformance(perfData);
      setPatterns(patternsData);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load analytics', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Template Performance by Channel
          </CardTitle>
          <CardDescription>Response rates and conversion metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {performance.length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="channel" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="response_rate" fill="#3b82f6" name="Response Rate %" />
                  <Bar dataKey="conversion_rate" fill="#10b981" name="Conversion Rate %" />
                </BarChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-4">
                {performance.map((perf: any) => (
                  <div key={perf.channel} className="border rounded-lg p-3" data-testid={`perf-${perf.channel}`}>
                    <p className="font-medium text-sm capitalize">{perf.channel}</p>
                    <div className="space-y-1 mt-2 text-xs text-muted-foreground">
                      <p>Sent: {perf.total_sent}</p>
                      <p>Responses: {perf.total_responses}</p>
                      <p className="font-semibold text-green-600">Response: {perf.response_rate}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No response data yet</p>
          )}
        </CardContent>
      </Card>

      {patterns && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-600" />
              Winning Patterns & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium">Best Performing Channel</p>
              <Badge className="mt-1">{patterns.best_channel?.toUpperCase()}</Badge>
              <p className="text-xs text-muted-foreground mt-2">Use {patterns.best_channel} for highest engagement</p>
            </div>

            {patterns.high_conversion_intents?.length > 0 && (
              <div>
                <p className="text-sm font-medium">High Conversion Intents</p>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {patterns.high_conversion_intents.map((intent: string) => (
                    <Badge key={intent} variant="secondary" className="text-xs">
                      {intent.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-white rounded border border-green-200">
              <p className="text-sm font-semibold text-green-800">💡 AI Insight</p>
              <p className="text-xs text-green-700 mt-1">
                Your {patterns.best_channel} campaigns show the highest conversion rates. Consider increasing outreach through this channel.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
