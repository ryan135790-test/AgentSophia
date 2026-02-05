/**
 * Sophia's Autonomy Dashboard
 * Shows learning progress and autonomous decision-making capability
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, TrendingUp, Zap, Target, AlertCircle, CheckCircle2, Clock, RefreshCw
} from 'lucide-react';

interface AutonomyDashboardProps {
  workspaceId: string;
}

export function SophiaAutonomyDashboard({ workspaceId }: AutonomyDashboardProps) {
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutonomyData();
  }, [workspaceId]);

  const fetchAutonomyData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sophia/autonomy-readiness/${workspaceId}`);
      const data = await response.json();
      setReadiness(data.autonomy_readiness);
    } catch (error) {
      console.error('Failed to fetch autonomy data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <p>Sophia is learning...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!readiness) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-sm text-slate-500">No learning data available yet</p>
        </CardContent>
      </Card>
    );
  }

  const levelColors = {
    expert: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    advanced: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    learning: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  };

  return (
    <div className="space-y-4">
      {/* Main Readiness Card */}
      <Card className="border-2 border-purple-500">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Sophia's Autonomy Learning
            </div>
            <Badge className={levelColors[readiness.readiness_level as keyof typeof levelColors]}>
              {readiness.readiness_level.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Readiness */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Overall Autonomy Readiness</span>
              <span className="text-lg font-bold text-purple-600">{readiness.overall_readiness}%</span>
            </div>
            <Progress value={readiness.overall_readiness} className="h-2" />
          </div>

          {/* Recommendation */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              💡 {readiness.recommendation}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Model Performance */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {readiness.models?.map((model: any, idx: number) => (
          <Card key={idx}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{model.action_type}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Success Rate</p>
                <div className="flex items-center gap-2">
                  <Progress value={model.success_rate} className="flex-1 h-1.5" />
                  <span className="text-xs font-bold">{model.success_rate}%</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Auto-Execute Threshold</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {model.min_confidence_for_auto}%
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Decisions Made</p>
                <p className="text-sm font-semibold">{model.total_decisions}</p>
              </div>

              <div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">Recent Accuracy</p>
                <div className="flex items-center gap-2">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    model.recent_accuracy >= 75 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                    model.recent_accuracy >= 50 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' :
                    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                  }`}>
                    {model.recent_accuracy}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Learning Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            What Sophia Learns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { icon: '✅', text: 'Which actions work best for your audience' },
              { icon: '📈', text: 'Optimal timing for maximum engagement' },
              { icon: '🎯', text: 'Best targeting strategies' },
              { icon: '🔄', text: 'Response patterns and behaviors' },
              { icon: '💡', text: 'When to take action vs wait for approval' },
              { icon: '⚡', text: 'Confidence thresholds for autonomy' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <span className="text-lg">{item.icon}</span>
                <span className="text-slate-700 dark:text-slate-300">{item.text}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={fetchAutonomyData} variant="outline" className="flex-1 gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh Learning Data
        </Button>
        <Button className="flex-1 gap-2 bg-purple-600 hover:bg-purple-700">
          <Brain className="h-4 w-4" />
          View Detailed Insights
        </Button>
      </div>
    </div>
  );
}
