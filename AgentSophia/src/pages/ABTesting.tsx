import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface TestResult {
  test_id: string;
  test_name: string;
  campaign_name: string;
  variant_a: { name: string; open_rate: number; click_rate: number };
  variant_b: { name: string; open_rate: number; click_rate: number };
  winner: string;
  statistical_significance: number;
  confidence_level: string;
  sophia_recommendation: string;
}

interface Recommendation {
  priority: 'Critical' | 'High' | 'Medium';
  category: string;
  recommended: string;
  expected_impact: string;
  confidence: string;
  revenue_impact: string;
}

const DEMO_TESTS: TestResult[] = [
  {
    test_id: 'test_1',
    test_name: 'Subject Line A/B Test',
    campaign_name: 'Q4 Enterprise Outreach',
    variant_a: { name: 'Personal Touch', open_rate: 45.2, click_rate: 12.3 },
    variant_b: { name: 'ROI Focused', open_rate: 52.8, click_rate: 15.7 },
    winner: 'Variant B',
    statistical_significance: 94,
    confidence_level: 'High',
    sophia_recommendation: 'Apply Variant B to all similar campaigns. ROI-focused messaging resonates with enterprise buyers.'
  },
  {
    test_id: 'test_2',
    test_name: 'CTA Button Test',
    campaign_name: 'Product Demo Series',
    variant_a: { name: 'Schedule Demo', open_rate: 38.5, click_rate: 8.2 },
    variant_b: { name: 'Get Started Free', open_rate: 41.2, click_rate: 11.9 },
    winner: 'Variant B',
    statistical_significance: 87,
    confidence_level: 'Medium',
    sophia_recommendation: 'Low-commitment CTAs perform better. Continue testing to reach 95% significance.'
  }
];

const DEMO_RECOMMENDATIONS: Recommendation[] = [
  {
    priority: 'Critical',
    category: 'Subject Lines',
    recommended: 'Use personalized ROI metrics in subject lines',
    expected_impact: '+24.9% open rate',
    confidence: '92%',
    revenue_impact: '+$127K'
  },
  {
    priority: 'High',
    category: 'Send Timing',
    recommended: 'Shift sends to Tuesday-Thursday 9-11 AM',
    expected_impact: '+18.3% engagement',
    confidence: '89%',
    revenue_impact: '+$95K'
  },
  {
    priority: 'Medium',
    category: 'Email Length',
    recommended: 'Reduce email body to under 150 words',
    expected_impact: '+12.1% click rate',
    confidence: '78%',
    revenue_impact: '+$54K'
  }
];

export default function ABTesting() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  if (!workspaceId) {
    return <div className="p-8 text-center">Loading workspace...</div>;
  }
  
  const [tests, setTests] = useState<TestResult[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setTests(DEMO_TESTS);
      setRecommendations(DEMO_RECOMMENDATIONS);
      setLoading(false);
      return;
    }
    
    const fetchData = async () => {
      try {
        const [testsRes, recsRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/ab-testing/active-tests`),
          fetch(`/api/workspaces/${workspaceId}/ab-testing/optimization-recommendations`)
        ]);

        if (testsRes.ok) {
          const testsData = await testsRes.json();
          setTests(testsData.active_tests || []);
        }

        if (recsRes.ok) {
          const recsData = await recsRes.json();
          setRecommendations(recsData.recommendations || []);
        }
      } catch (error) {
        console.error('Error fetching A/B testing data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspaceId, isDemo]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'High':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    }
  };

  if (loading) return <div className="p-8 text-center">Loading A/B testing data...</div>;

  const hasNoData = tests.length === 0 && recommendations.length === 0 && !isDemo;

  if (hasNoData) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <Zap className="h-8 w-8 text-purple-600" />
              A/B Testing & Optimization
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">Test campaign variants and apply data-driven improvements</p>
          </div>
          <Card className="p-12 text-center">
            <Zap className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No A/B Tests Yet</h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create your first A/B test to optimize your campaigns with data-driven insights.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Zap className="h-8 w-8 text-purple-600" />
            A/B Testing & Optimization
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Test campaign variants and apply data-driven improvements</p>
        </div>

        {tests.length > 0 && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Active A/B Tests
              </CardTitle>
              <CardDescription>Ongoing experiments with statistical significance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tests.map((test) => (
                  <div key={test.test_id} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm">{test.test_name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{test.campaign_name}</p>
                      </div>
                      <Badge className={`${test.winner.includes('A') ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                        {test.winner} Leading
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{test.variant_a.name}</p>
                        <p className="text-sm font-semibold">{test.variant_a.open_rate}% Open</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{test.variant_a.click_rate}% Click</p>
                      </div>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{test.variant_b.name}</p>
                        <p className="text-sm font-semibold">{test.variant_b.open_rate}% Open</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{test.variant_b.click_rate}% Click</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-semibold">{test.statistical_significance}%</span> statistical significance
                      </p>
                      <p className="text-xs font-semibold text-purple-600">{test.confidence_level} confidence</p>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      🤖 {test.sophia_recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {recommendations.length > 0 && (
          <Card className="bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Optimization Recommendations
              </CardTitle>
              <CardDescription>Sophia-powered suggestions to improve campaign performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={getPriorityColor(rec.priority)}>{rec.priority}</Badge>
                          <p className="font-semibold text-sm">{rec.category}</p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">{rec.recommended}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-600">{rec.expected_impact}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">({rec.confidence})</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        💰 {rec.revenue_impact} revenue impact
                      </p>
                      <Badge className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-300">Action Ready</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {(isDemo || tests.length > 0) && (
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                🤖 Sophia's Testing Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isDemo ? (
                <>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <p><strong>24 Completed Tests:</strong> 23 have clear winners (96% success rate)</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <p><strong>Best Optimization:</strong> Subject line testing drives +9.9% improvement (92% confidence)</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <p><strong>Revenue Impact:</strong> A/B testing has driven $187.5K revenue (+18.4% avg improvement)</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <p><strong>Quick Wins:</strong> 5 optimization recommendations can generate +$330K in 2 hours of implementation</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <p><strong>Next Test:</strong> Run SMS message length test (SMS avg +420% ROI, underutilized)</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <p><strong>{tests.length} Tests Created:</strong> Keep testing to optimize your campaigns</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <p><strong>Recommendation:</strong> Subject line tests typically yield the highest improvements</p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
                    <p><strong>Pro Tip:</strong> Run tests for at least 100 recipients for statistically significant results</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
