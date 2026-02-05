/**
 * Sophia Self-Optimization Panel
 * Shows Sophia autonomously optimizing campaigns
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Zap, Loader2, CheckCircle2, TrendingUp, Lightbulb, BarChart3, AlertCircle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OptimizationSuggestion {
  type: 'subject_line' | 'message_body' | 'timing' | 'targeting' | 'frequency';
  original: string;
  suggested: string;
  reasoning: string;
  estimated_improvement: number;
  confidence: number;
}

interface SelfOptimizationPanelProps {
  campaignId?: string;
  workspaceId: string;
  onOptimize?: (results: any) => void;
}

export function SophiaSelfOptimizationPanel({
  campaignId,
  workspaceId,
  onOptimize
}: SelfOptimizationPanelProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'suggestions' | 'insights'>('overview');

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const endpoint = campaignId
        ? `/api/sophia/optimize-campaign`
        : `/api/sophia/optimize-all`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          workspaceId,
          autoApply: true,
        }),
      });

      const data = await response.json();
      setResults(data);
      onOptimize?.(data);
    } catch (error) {
      console.error('Optimization error:', error);
    } finally {
      setOptimizing(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      subject_line: '✉️',
      message_body: '📝',
      timing: '⏰',
      targeting: '🎯',
      frequency: '📊',
    };
    return icons[type] || '💡';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      subject_line: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      message_body: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      timing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      targeting: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
      frequency: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
    };
    return colors[type] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
  };

  if (results) {
    return (
      <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Sophia's Optimizations Applied
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
              <p className="text-xs text-slate-600 dark:text-slate-400">Changes Applied</p>
              <p className="text-2xl font-bold text-green-600">
                {results.optimization?.applied_changes?.length || 0}
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
              <p className="text-xs text-slate-600 dark:text-slate-400">Confidence</p>
              <p className="text-2xl font-bold text-blue-600">
                {Math.round(results.optimization?.confidence || 0)}%
              </p>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border">
              <p className="text-xs text-slate-600 dark:text-slate-400">Est. Improvement</p>
              <p className="text-2xl font-bold text-purple-600">
                +{Math.round(
                  (results.optimization?.suggestions || []).reduce(
                    (sum: number, s: any) => sum + s.estimated_improvement,
                    0
                  ) / (results.optimization?.suggestions?.length || 1)
                )}%
              </p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-2">Applied Changes:</p>
            <ScrollArea className="h-32">
              <div className="space-y-1 pr-4">
                {results.optimization?.applied_changes?.map((change: string, idx: number) => (
                  <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded text-xs">
                    ✅ {change}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex gap-2 pt-2 border-t border-green-200 dark:border-green-800">
            <Button onClick={() => setResults(null)} variant="outline" className="flex-1">
              View Suggestions
            </Button>
            <Button onClick={handleOptimize} className="flex-1 gap-2">
              <Zap className="h-4 w-4" />
              Optimize Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-transparent dark:from-purple-950/20 dark:to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-purple-600" />
          Sophia's Self-Optimization
        </CardTitle>
        <CardDescription>
          Sophia autonomously analyzes campaigns and applies improvements based on performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium">Performance</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Analyzes metrics</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium">Suggestions</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">AI-powered ideas</p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium">Auto-Apply</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">Autonomous action</p>
          </div>
        </div>

        {/* Features List */}
        <div className="space-y-2">
          <p className="text-sm font-semibold">What Sophia Optimizes:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: '✉️', name: 'Subject Lines', desc: 'Better open rates' },
              { icon: '📝', name: 'Message Body', desc: 'Clearer messaging' },
              { icon: '⏰', name: 'Send Timing', desc: 'Optimal hours' },
              { icon: '🎯', name: 'Targeting', desc: 'Better segments' },
            ].map((feature, idx) => (
              <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium">{feature.icon} {feature.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Learning Section */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">Autonomous Learning</p>
              <p className="text-xs text-blue-700 dark:text-blue-200">
                Sophia tracks what works and applies learnings to all your campaigns automatically
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <Button
          onClick={handleOptimize}
          disabled={optimizing}
          className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
          data-testid="button-optimize-now"
        >
          {optimizing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Sophia is optimizing...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              {campaignId ? 'Optimize This Campaign' : 'Optimize All Campaigns'}
            </>
          )}
        </Button>

        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          ✨ Sophia will analyze performance and automatically apply improvements
        </p>
      </CardContent>
    </Card>
  );
}
