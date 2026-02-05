import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, TrendingUp, Lightbulb, Target, BookOpen, Zap } from "lucide-react";
import { Link } from "react-router-dom";

export default function SophiaLearning() {
  const [learning, setLearning] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLearning = async () => {
      try {
        const [learningRes, recsRes] = await Promise.all([
          fetch('/api/sophia/workspace-learning'),
          fetch('/api/sophia/recommendations')
        ]);

        if (learningRes.ok) setLearning(await learningRes.json());
        if (recsRes.ok) setRecommendations(await recsRes.json());
      } catch (error) {
        console.error('Error fetching learning data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLearning();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading Sophia's insights...</div>;
  if (!learning) return <div className="p-8 text-center">Unable to load learning data</div>;

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      high: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100',
      medium: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100',
      low: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100'
    };
    return colors[priority] || colors.low;
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-8 h-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
              Sophia's Learning Center
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Watch me learn from your campaigns and get smarter with every send
          </p>
        </div>

        {/* Progress Overview */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              My Learning Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {learning.total_campaigns}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  campaigns analyzed
                </p>
              </div>

              {learning.total_campaigns > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {learning.avg_open_rate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Avg Open Rate</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {learning.avg_reply_rate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Avg Reply Rate</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {learning.best_channel}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Best Channel</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {learning.best_time_to_send}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Best Send Time</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Learning Insights */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-green-600" />
            My Analysis
          </h2>
          <div className="space-y-3">
            {learning.insights.map((insight: any, i: number) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 dark:text-white mb-1">
                        {insight.metric}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {insight.actionable_tip}
                      </p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {insight.value}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${insight.trend === 'up' ? 'text-green-700' : insight.trend === 'down' ? 'text-red-700' : 'text-slate-700'}`}
                        >
                          {insight.trend === 'up' ? '↑' : insight.trend === 'down' ? '↓' : '→'} vs {insight.benchmark}% benchmark
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-amber-600" />
            My Recommendations
          </h2>
          <div className="space-y-3">
            {recommendations.map((rec: any, i: number) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getPriorityColor(rec.priority)}>
                          {rec.priority.toUpperCase()}
                        </Badge>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {rec.recommendation}
                        </p>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                        {rec.reasoning}
                      </p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Expected Impact:</p>
                          <p className="text-green-600 dark:text-green-400">{rec.expected_impact}</p>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Action:</p>
                          <p className="text-blue-600 dark:text-blue-400">{rec.action}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Next Campaign Suggestion */}
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              My Next Campaign Suggestion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium text-slate-900 dark:text-white mb-4">
              {learning.next_campaign_suggestion}
            </p>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link to="/chat-sophia">Create Campaign with Sophia</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Learning Timeline */}
        {learning.total_campaigns > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Recommendations Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {learning.recommendations.map((rec: string, i: number) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300">{rec}</p>
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
