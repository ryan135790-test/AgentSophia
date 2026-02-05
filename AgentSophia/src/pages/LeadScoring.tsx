import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, TrendingUp, Users, Target, BarChart3, CheckCircle } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface LeadScore {
  id: string;
  name: string;
  company: string;
  title: string;
  overall_score: number;
  hotness: string;
  engagement_score: number;
  intent_score: number;
  fit_score: number;
  last_activity: string;
  probability_to_close: string;
}

interface DashboardStats {
  total_leads: number;
  hot_leads: number;
  warm_leads: number;
  cold_leads: number;
  avg_score: number;
  revenue_potential: string;
  hot_percentage?: string;
  warm_percentage?: string;
  cold_percentage?: string;
}

export default function LeadScoring() {
  const { currentWorkspace } = useWorkspace();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [leads, setLeads] = useState<LeadScore[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';

  useEffect(() => {
    const fetchData = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      if (isDemo) {
        setStats({
          total_leads: 48,
          hot_leads: 12,
          warm_leads: 20,
          cold_leads: 16,
          avg_score: 62,
          revenue_potential: '$1.2M'
        });
        setLeads([
          { id: '1', name: 'Sarah Chen', company: 'TechCorp', title: 'VP Sales', overall_score: 92, hotness: 'Hot', engagement_score: 85, intent_score: 95, fit_score: 90, last_activity: '2 hours ago', probability_to_close: '89%' },
          { id: '2', name: 'John Miller', company: 'GrowthCo', title: 'CEO', overall_score: 78, hotness: 'Warm', engagement_score: 70, intent_score: 82, fit_score: 75, last_activity: '1 day ago', probability_to_close: '65%' },
          { id: '3', name: 'Emily Watson', company: 'StartupHub', title: 'Director', overall_score: 45, hotness: 'Cold', engagement_score: 40, intent_score: 50, fit_score: 42, last_activity: '1 week ago', probability_to_close: '28%' }
        ]);
        setLoading(false);
        return;
      }

      try {
        const [dashRes, leadsRes] = await Promise.all([
          fetch(`/api/workspaces/${workspaceId}/lead-scoring/dashboard`),
          fetch(`/api/workspaces/${workspaceId}/lead-scoring/leads`)
        ]);

        if (dashRes.ok) {
          const dashData = await dashRes.json();
          setStats({
            total_leads: dashData.total_leads,
            hot_leads: dashData.lead_distribution?.hot || 0,
            warm_leads: dashData.lead_distribution?.warm || 0,
            cold_leads: dashData.lead_distribution?.cold || 0,
            avg_score: dashData.avg_scores?.overall_score || 0,
            revenue_potential: dashData.quality_metrics?.revenue_potential || '$0',
            hot_percentage: dashData.lead_distribution_percentage?.hot || '0%',
            warm_percentage: dashData.lead_distribution_percentage?.warm || '0%',
            cold_percentage: dashData.lead_distribution_percentage?.cold || '0%'
          });
        }

        if (leadsRes.ok) {
          const leadsData = await leadsRes.json();
          setLeads(leadsData.leads || []);
        }
      } catch (error) {
        console.error('Error fetching lead data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [workspaceId, isDemo]);

  const getHotnessColor = (hotness: string) => {
    switch (hotness) {
      case 'Hot':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'Warm':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'Cold':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  if (loading) return <div className="p-8 text-center">Loading lead scoring...</div>;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Flame className="h-8 w-8 text-red-600" />
            Lead Scoring Dashboard
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">AI-powered lead hotness ranking with predictive analytics</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-1">
                <Flame className="h-4 w-4" /> Hot
              </CardTitle>
              <div className="text-2xl font-bold">{stats?.hot_leads || 0}</div>
              <p className="text-xs text-red-600">{stats?.hot_percentage || '0%'} • Ready to buy</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Warm</CardTitle>
              <div className="text-2xl font-bold">{stats?.warm_leads || 0}</div>
              <p className="text-xs text-orange-600">{stats?.warm_percentage || '0%'} • Nurture needed</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cold</CardTitle>
              <div className="text-2xl font-bold">{stats?.cold_leads || 0}</div>
              <p className="text-xs text-blue-600">{stats?.cold_percentage || '0%'} • Build awareness</p>
            </CardHeader>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Revenue</CardTitle>
              <div className="text-2xl font-bold">{stats?.revenue_potential}</div>
              <p className="text-xs text-emerald-600">All leads potential</p>
            </CardHeader>
          </Card>
        </div>

        {/* Top Leads */}
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-red-600" />
              Top Leads by Score
            </CardTitle>
            <CardDescription>Ready for immediate action</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leads.slice(0, 5).map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                  <div className="flex-1">
                    <p className="font-semibold">{lead.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{lead.title} at {lead.company}</p>
                    <div className="flex gap-2 mt-2 text-xs">
                      <span className="text-slate-600 dark:text-slate-400">📧 {lead.engagement_score}</span>
                      <span className="text-slate-600 dark:text-slate-400">💬 {lead.intent_score}</span>
                      <span className="text-slate-600 dark:text-slate-400">🎯 {lead.fit_score}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{lead.overall_score}</div>
                    <Badge className={getHotnessColor(lead.hotness)}>{lead.hotness}</Badge>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{lead.probability_to_close} close</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scoring Explanation */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              How Scoring Works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold text-sm mb-2">📧 Engagement Score (40% weight)</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">Email opens, clicks, SMS replies, and message interactions</p>
              <div className="mt-1 flex gap-2">
                <Badge className="bg-slate-200 dark:bg-slate-700">+5 per open</Badge>
                <Badge className="bg-slate-200 dark:bg-slate-700">+8 per click</Badge>
                <Badge className="bg-slate-200 dark:bg-slate-700">+15 per SMS reply</Badge>
              </div>
            </div>

            <div>
              <p className="font-semibold text-sm mb-2">💬 Intent Score (35% weight)</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">LinkedIn replies, demo requests, pricing page views</p>
              <div className="mt-1 flex gap-2">
                <Badge className="bg-slate-200 dark:bg-slate-700">+20 LinkedIn reply</Badge>
                <Badge className="bg-slate-200 dark:bg-slate-700">+25 demo request</Badge>
                <Badge className="bg-slate-200 dark:bg-slate-700">+15 pricing view</Badge>
              </div>
            </div>

            <div>
              <p className="font-semibold text-sm mb-2">🎯 Fit Score (25% weight)</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">Title match, company size, industry alignment</p>
              <div className="mt-1 flex gap-2">
                <Badge className="bg-slate-200 dark:bg-slate-700">+15 title match</Badge>
                <Badge className="bg-slate-200 dark:bg-slate-700">+12 enterprise size</Badge>
                <Badge className="bg-slate-200 dark:bg-slate-700">+10 industry fit</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sophia Insights - only show for demo workspace */}
        {isDemo && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🤖 Sophia's Lead Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Hot Lead Focus:</strong> 127 hot leads identified • $4.2M revenue potential</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Best Segment:</strong> VP Sales convert at 38% • 3.2x better than average</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Immediate Actions:</strong> Call top 5 leads today for 68-92% close probability</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Trend:</strong> Hot leads +18% this week • engagement improving rapidly</p>
            </div>
            <div className="flex gap-2 text-sm">
              <CheckCircle className="h-5 w-5 text-purple-600 flex-shrink-0" />
              <p><strong>Next Step:</strong> Auto-schedule calls for top 20 leads (Sophia autonomy enabled)</p>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
