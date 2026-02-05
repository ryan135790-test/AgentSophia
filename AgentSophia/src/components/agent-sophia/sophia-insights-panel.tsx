import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, Zap, AlertCircle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SophiaInsight {
  type: 'recommendation' | 'opportunity' | 'warning' | 'achievement';
  title: string;
  description: string;
  action?: string;
  actionUrl?: string;
  impact?: string;
}

interface SophiaInsightsPanelProps {
  insights: SophiaInsight[];
  context: 'dashboard' | 'campaigns' | 'contacts' | 'inbox';
  isLoading?: boolean;
}

export function SophiaInsightsPanel({ insights, context, isLoading }: SophiaInsightsPanelProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 border-blue-200 dark:border-indigo-500">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <CardTitle>Sophia's Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-white/50 dark:bg-slate-700/50 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights || insights.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-slate-500" />
            <CardTitle>Sophia's Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-400">No urgent recommendations at this time. Keep optimizing!</p>
        </CardContent>
      </Card>
    );
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'recommendation': return <Zap className="w-4 h-4 text-amber-600" />;
      case 'opportunity': return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'achievement': return <CheckCircle className="w-4 h-4 text-blue-600" />;
      default: return <Sparkles className="w-4 h-4 text-blue-600" />;
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case 'recommendation': return 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-700';
      case 'opportunity': return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-700';
      case 'warning': return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-700';
      case 'achievement': return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-700';
      default: return 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 border-blue-200 dark:border-indigo-500">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600 animate-pulse" />
            <div>
              <CardTitle className="text-lg">Sophia's Insights</CardTitle>
              <CardDescription>AI-powered recommendations for {context}</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-blue-600 text-white border-blue-700">
            {insights.length} {insights.length === 1 ? 'insight' : 'insights'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg border ${getBgColor(insight.type)} space-y-2`}
          >
            <div className="flex items-start gap-2">
              {getIconForType(insight.type)}
              <div className="flex-1">
                <p className="font-medium text-sm">{insight.title}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{insight.description}</p>
              </div>
            </div>
            {insight.impact && (
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                💡 Potential impact: {insight.impact}
              </p>
            )}
            {insight.action && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs mt-2"
                onClick={() => insight.actionUrl && navigate(insight.actionUrl)}
              >
                {insight.action}
              </Button>
            )}
          </div>
        ))}
        <Button
          variant="outline"
          className="w-full h-8 text-xs mt-3"
          onClick={() => navigate('/chat-sophia')}
        >
          💬 Chat with Sophia for more insights
        </Button>
      </CardContent>
    </Card>
  );
}
