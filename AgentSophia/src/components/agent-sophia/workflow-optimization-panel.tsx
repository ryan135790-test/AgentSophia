import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp, AlertCircle } from 'lucide-react';

interface OptimizationSuggestion {
  id: string;
  title: string;
  impact: string;
  confidence: number;
  suggestion: string;
}

const suggestions: OptimizationSuggestion[] = [
  {
    id: '1',
    title: 'Add Decision Point',
    impact: '+15% efficiency',
    confidence: 89,
    suggestion: 'Insert a condition between "Check Calendar" and "Send Link" to validate availability'
  },
  {
    id: '2',
    title: 'Reorder Steps',
    impact: '+8% completion',
    confidence: 76,
    suggestion: 'Move "Send Confirmation" to step 2 to reduce abandonment'
  },
  {
    id: '3',
    title: 'Add Retry Logic',
    impact: '+12% success',
    confidence: 82,
    suggestion: 'Add retry node if calendar sync fails'
  }
];

export function WorkflowOptimizationPanel() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-slate-900 dark:text-white">🤖 Sophia's Workflow Optimizations</h3>
      </div>

      {suggestions.map((opt) => (
        <Card key={opt.id} className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800 hover:shadow-md transition cursor-pointer">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <p className="font-semibold text-sm text-slate-900 dark:text-white">{opt.title}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{opt.suggestion}</p>
            </div>
            <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              {opt.impact}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <TrendingUp className="h-3 w-3 text-blue-600" />
            <span className="text-slate-600 dark:text-slate-400">{opt.confidence}% confidence</span>
          </div>
        </Card>
      ))}

      <Card className="p-2 bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
        <p className="text-xs flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
          <span className="text-yellow-800 dark:text-yellow-400">
            Implementing all suggestions could improve workflow efficiency by ~35% based on historical data.
          </span>
        </p>
      </Card>
    </div>
  );
}
