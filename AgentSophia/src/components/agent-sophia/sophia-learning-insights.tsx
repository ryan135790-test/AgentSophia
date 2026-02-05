import { Card } from '@/components/ui/card';
import { TrendingUp, Brain, Zap, Sparkles } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface LearningInsight {
  pattern: string;
  confidence: number;
  impact: string;
  exampleCount: number;
}

const demoInsights: LearningInsight[] = [
  { pattern: 'Tuesday-Thursday 9-11 AM sends get 2.3x higher reply rates', confidence: 87, impact: '+23%', exampleCount: 145 },
  { pattern: 'Sales VPs respond 1.8x more to ROI-focused messaging', confidence: 81, impact: '+18%', exampleCount: 98 },
  { pattern: 'LinkedIn + Email combo drives 35% better engagement', confidence: 91, impact: '+35%', exampleCount: 267 },
  { pattern: 'First follow-up within 2 hours has 3x completion rate', confidence: 84, impact: '+200%', exampleCount: 156 }
];

export function SophiaLearningInsights() {
  const { currentWorkspace } = useWorkspace();
  const isDemo = currentWorkspace?.id === 'demo';
  const insights = isDemo ? demoInsights : [];

  if (!isDemo && insights.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900 dark:text-white">Sophia's Learning Insights</h3>
        </div>
        <Card className="p-6 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/20 dark:to-slate-800/20 border-slate-200 dark:border-slate-700">
          <div className="text-center space-y-3">
            <Sparkles className="w-10 h-10 mx-auto text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              Sophia is learning from your activity
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              As you run campaigns and engage with leads, Sophia will surface patterns and insights to improve your results.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-slate-900 dark:text-white">Sophia's Learning Insights</h3>
      </div>

      <div className="space-y-2">
        {insights.map((insight, idx) => (
          <Card key={idx} className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                  {insight.pattern}
                </p>
                <span className="text-sm font-bold text-green-600 dark:text-green-400 flex-shrink-0">
                  {insight.impact}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-yellow-600" />
                  <span className="text-slate-600 dark:text-slate-400">{insight.confidence}% confidence</span>
                </div>
                <span className="text-slate-500">•</span>
                <span className="text-slate-600 dark:text-slate-400">{insight.exampleCount} examples</span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  style={{ width: `${insight.confidence}%` }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="text-xs text-slate-500 text-center pt-2">
        These insights improve Sophia's recommendations by ~5-8% each week
      </div>
    </div>
  );
}
