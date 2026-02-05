/**
 * Sophia Admin Brain Control Panel
 * Admin dashboard to view and improve Sophia's capabilities
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3, Brain, Lightbulb, TrendingUp, AlertCircle, CheckCircle2,
  Zap, Target, Activity, Cpu, Lock, RefreshCw
} from 'lucide-react';

interface SophiaBrainPanelProps {
  workspaceId: string;
}

export function SophiaAdminBrainPanel({ workspaceId }: SophiaBrainPanelProps) {
  const [brain, setBrain] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [insights, setInsights] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrainData();
  }, [workspaceId]);

  const fetchBrainData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sophia/brain-summary/${workspaceId}`);
      const data = await response.json();
      
      if (data.sophia_brain) {
        setBrain(data.sophia_brain.state);
        setRecommendations(data.sophia_brain.recommendations);
        setInsights(data.sophia_brain.insights);
        setPerformance(data.sophia_brain.model_performance);
      }
    } catch (error) {
      console.error('Failed to fetch brain data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-purple-500">
        <CardContent className="p-8">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <p>Loading Sophia's brain...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-500 to-pink-500 border-0 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Sophia's Admin Brain Control Panel
          </CardTitle>
          <CardDescription className="text-purple-100">
            View Sophia's inner workings and get recommendations to improve her
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Brain Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Active Campaigns</p>
                <p className="text-2xl font-bold">{brain?.active_campaigns}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Contacts</p>
                <p className="text-2xl font-bold">{brain?.total_contacts}</p>
              </div>
              <Activity className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Optimizations</p>
                <p className="text-2xl font-bold">{brain?.optimization_count}</p>
              </div>
              <Zap className="h-8 w-8 text-yellow-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">AI Accuracy</p>
                <p className="text-2xl font-bold">{brain?.model_performance.consensus_accuracy}%</p>
              </div>
              <Cpu className="h-8 w-8 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Interface */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations">💡 Improvements</TabsTrigger>
          <TabsTrigger value="insights">📊 Insights</TabsTrigger>
          <TabsTrigger value="models">🤖 Models</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Sophia's Brain State
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Top Improvements */}
              <div>
                <p className="font-semibold mb-2">Top Improvements Applied:</p>
                <div className="space-y-2">
                  {brain?.top_improvements.map((imp: string, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm">{imp}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning Patterns */}
              <div>
                <p className="font-semibold mb-2">Learning Patterns:</p>
                <div className="grid grid-cols-2 gap-2">
                  {brain?.learning_patterns.most_common_improvements?.map((pattern: string, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {pattern}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Sophia's Admin Recommendations
              </CardTitle>
              <CardDescription>
                Sophia analyzes your setup and suggests improvements to enhance her capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recommendations && recommendations.length > 0 ? (
                recommendations.map((rec: any, idx: number) => (
                  <div key={idx} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{rec.type}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{rec.recommendation}</p>
                        <p className="text-xs text-blue-600 dark:text-blue-300 mt-2">
                          💰 Impact: <strong>{rec.impact}</strong>
                        </p>
                      </div>
                      <Badge variant="secondary">{rec.priority}</Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No recommendations at this time</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Learning Insights
              </CardTitle>
              <CardDescription>
                What Sophia has learned from campaign optimizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insights && insights.length > 0 ? (
                <div className="space-y-2">
                  {insights.map((insight: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{insight.improvement_type}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            Applied {insight.frequency} times
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Avg improvement: +{insight.avg_improvement?.toFixed(0)}%
                          </p>
                        </div>
                        <TrendingUp className="h-5 w-5 text-green-500 opacity-50" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No insights available yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models">
          <div className="space-y-3">
            {/* GPT-4o */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  OpenAI GPT-4o
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Accuracy</span>
                    <Badge>{performance?.gpt4.accuracy}%</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">Strengths:</p>
                    <div className="flex flex-wrap gap-1">
                      {performance?.gpt4.strengths.map((s: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Claude */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Cpu className="h-4 w-4" />
                  Anthropic Claude
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Accuracy</span>
                    <Badge>{performance?.claude.accuracy}%</Badge>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">Strengths:</p>
                    <div className="flex flex-wrap gap-1">
                      {performance?.claude.strengths.map((s: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Consensus */}
            <Card className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Dual-Model Consensus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Combined Accuracy</span>
                    <Badge className="bg-green-600">{performance?.consensus.accuracy}%</Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    ✅ Decisions: {performance?.consensus.decisions}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    ✅ Improvements Applied: {performance?.consensus.improvements_applied}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Refresh Button */}
      <Button onClick={fetchBrainData} variant="outline" className="w-full gap-2">
        <RefreshCw className="h-4 w-4" />
        Refresh Brain Data
      </Button>
    </div>
  );
}
