import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Target, Clock, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { DashboardHelpOverlay } from '@/components/help-guidance/DashboardHelp';
import { SophiaInsightsPanel } from '@/components/agent-sophia/sophia-insights-panel';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/components/auth/auth-provider';

interface DashboardMetrics {
  total_contacts: number;
  total_campaigns: number;
  hot_leads_count: number;
  warm_leads_count: number;
  cold_leads_count: number;
  inbox_unread: number;
  avg_open_rate: number;
  avg_click_rate: number;
  avg_conversion_rate: number;
  pipeline_total_value: number;
  monthly_revenue_forecast: number;
  meeting_scheduled_this_month: number;
  deals_closed_this_month: number;
  top_performing_channel?: string;
  top_performing_template?: string;
  activity_chart?: Array<{ date: string; emails_sent: number; replies_received: number }>;
}

interface RevenueForecast {
  deal_stages: Record<string, { stage_name: string; deal_count: number; avg_deal_value: number; probability: number }>;
  total_pipeline: number;
  weighted_forecast: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const DEMO_METRICS: DashboardMetrics = {
  total_contacts: 2847,
  total_campaigns: 12,
  hot_leads_count: 127,
  warm_leads_count: 489,
  cold_leads_count: 2231,
  inbox_unread: 23,
  avg_open_rate: 42.5,
  avg_click_rate: 8.7,
  avg_conversion_rate: 3.2,
  pipeline_total_value: 1875000,
  monthly_revenue_forecast: 625000,
  meeting_scheduled_this_month: 18,
  deals_closed_this_month: 7,
  top_performing_channel: 'email',
  top_performing_template: 'Follow-up Sequence',
  activity_chart: [
    { date: 'Mon', emails_sent: 245, replies_received: 32 },
    { date: 'Tue', emails_sent: 312, replies_received: 45 },
    { date: 'Wed', emails_sent: 287, replies_received: 38 },
    { date: 'Thu', emails_sent: 356, replies_received: 52 },
    { date: 'Fri', emails_sent: 198, replies_received: 28 }
  ]
};

const DEMO_FORECAST: RevenueForecast = {
  deal_stages: {
    'new': { stage_name: 'New', deal_count: 45, avg_deal_value: 15000, probability: 0.1 },
    'qualified': { stage_name: 'Qualified', deal_count: 28, avg_deal_value: 25000, probability: 0.25 },
    'demo': { stage_name: 'Demo', deal_count: 18, avg_deal_value: 35000, probability: 0.4 },
    'proposal': { stage_name: 'Proposal', deal_count: 12, avg_deal_value: 45000, probability: 0.6 },
    'negotiation': { stage_name: 'Negotiation', deal_count: 8, avg_deal_value: 55000, probability: 0.8 },
    'closed_won': { stage_name: 'Closed Won', deal_count: 7, avg_deal_value: 65000, probability: 1.0 }
  },
  total_pipeline: 1875000,
  weighted_forecast: 625000
};

const DEMO_INSIGHTS = [
  {
    type: 'opportunity',
    title: 'High-Value Lead Activity',
    description: '15 enterprise leads showing buying signals. Recommend immediate outreach.',
    action: 'View Leads',
    actionUrl: '/contacts',
    impact: '+$450K potential',
    confidence: '92%'
  },
  {
    type: 'recommendation',
    title: 'Optimize Email Timing',
    description: 'Data shows 2-4 PM sends have 35% higher open rates for your audience.',
    action: 'Apply',
    actionUrl: '/campaigns',
    impact: '+12% open rate',
    confidence: '87%'
  }
];

export default function Dashboard() {
  const { currentWorkspace } = useWorkspace();
  const { session } = useAuth();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [sophiaInsights, setSophiaInsights] = useState<any[]>([]);
  const [hotLeadsList, setHotLeadsList] = useState<any[]>([]);

  useEffect(() => {
    // Reset state when workspace changes to prevent stale data
    setMetrics(null);
    setForecast(null);
    setSophiaInsights([]);
    setHotLeadsList([]);
    setLoading(true);
    
    if (isDemo) {
      setMetrics(DEMO_METRICS);
      setForecast(DEMO_FORECAST);
      setSophiaInsights(DEMO_INSIGHTS);
      setLoading(false);
      return;
    }
    
    if (!workspaceId || !session?.access_token) {
      // Add timeout to prevent infinite loading if workspace/session never loads
      const timeout = setTimeout(() => {
        console.log('[Dashboard] Workspace/session timeout - showing empty state');
        setLoading(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
    
    const fetchData = async () => {
      try {
        // Add timeout wrapper to prevent hanging requests
        const authHeaders: HeadersInit = session?.access_token 
          ? { 'Authorization': `Bearer ${session.access_token}` }
          : {};
        
        const fetchWithTimeout = (url: string, timeout = 10000) => {
          return Promise.race([
            fetch(url, { headers: authHeaders }),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ]).catch(() => null);
        };
        
        const [dashboardRes, campaignsRes, contactsRes, dealsRes, insightsRes, recsRes] = await Promise.all([
          fetchWithTimeout(`/api/revenue/dashboard?workspaceId=${workspaceId}`),
          fetchWithTimeout(`/api/campaigns?workspaceId=${workspaceId}`),
          fetchWithTimeout(`/api/contacts?workspaceId=${workspaceId}`),
          fetchWithTimeout(`/api/deals?workspaceId=${workspaceId}`),
          fetchWithTimeout(`/api/sophia/insights?workspaceId=${workspaceId}`),
          fetchWithTimeout(`/api/sophia/recommendations?workspaceId=${workspaceId}`)
        ]) as [Response | null, Response | null, Response | null, Response | null, Response | null, Response | null];
        
        const campaigns = campaignsRes?.ok ? await campaignsRes.json() : [];
        const campaignsList = Array.isArray(campaigns) ? campaigns : campaigns.campaigns || [];
        const contacts = contactsRes?.ok ? await contactsRes.json() : [];
        const contactsList = Array.isArray(contacts) ? contacts : contacts.contacts || [];
        const deals = dealsRes?.ok ? await dealsRes.json() : [];
        const dealsList = Array.isArray(deals) ? deals : deals.deals || [];
        
        const totalSent = campaignsList.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0);
        const totalOpened = campaignsList.reduce((sum: number, c: any) => sum + (c.opened_count || 0), 0);
        const totalClicked = campaignsList.reduce((sum: number, c: any) => sum + (c.clicked_count || 0), 0);
        const totalReplied = campaignsList.reduce((sum: number, c: any) => sum + (c.replied_count || 0), 0);
        
        const hotLeadsFiltered = contactsList.filter((c: any) => c.lead_status === 'hot' || c.stage === 'qualified');
        const warmLeads = contactsList.filter((c: any) => c.lead_status === 'warm' || c.stage === 'prospect').length;
        const coldLeads = contactsList.filter((c: any) => c.lead_status === 'cold' || !c.stage || c.stage === 'new').length;
        
        // Store top 5 hot leads for display (or recent contacts if no hot leads)
        const leadsToShow = hotLeadsFiltered.length > 0 
          ? hotLeadsFiltered.slice(0, 5).map((c: any) => ({ ...c, _isHot: true }))
          : contactsList.slice(0, 5).map((c: any) => ({ ...c, _isHot: false }));
        setHotLeadsList(leadsToShow);
        const hotLeads = hotLeadsFiltered.length;
        
        const pipelineValue = dealsList.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
        const closedWon = dealsList.filter((d: any) => d.stage === 'closed_won');
        const monthlyRevenue = closedWon.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
        
        setMetrics({
          total_contacts: contactsList.length,
          total_campaigns: campaignsList.filter((c: any) => c.status === 'active').length,
          hot_leads_count: hotLeads,
          warm_leads_count: warmLeads,
          cold_leads_count: coldLeads,
          inbox_unread: 0,
          avg_open_rate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 1000) / 10 : 0,
          avg_click_rate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 1000) / 10 : 0,
          avg_conversion_rate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 1000) / 10 : 0,
          pipeline_total_value: pipelineValue,
          monthly_revenue_forecast: monthlyRevenue || Math.round(pipelineValue * 0.3),
          meeting_scheduled_this_month: dealsList.filter((d: any) => d.stage === 'demo' || d.stage === 'meeting').length,
          deals_closed_this_month: closedWon.length,
          top_performing_channel: 'email',
          top_performing_template: 'Follow-up Sequence'
        });
        
        const stageDistribution = dealsList.reduce((acc: any, d: any) => {
          const stage = d.stage || 'new';
          if (!acc[stage]) acc[stage] = { stage_name: stage, deal_count: 0, avg_deal_value: 0, probability: 0.2 };
          acc[stage].deal_count++;
          acc[stage].avg_deal_value += (d.value || 0);
          return acc;
        }, {});
        
        Object.keys(stageDistribution).forEach(key => {
          if (stageDistribution[key].deal_count > 0) {
            stageDistribution[key].avg_deal_value = Math.round(stageDistribution[key].avg_deal_value / stageDistribution[key].deal_count);
          }
          if (key === 'closed_won') stageDistribution[key].probability = 1.0;
          else if (key === 'negotiation') stageDistribution[key].probability = 0.7;
          else if (key === 'proposal') stageDistribution[key].probability = 0.5;
          else if (key === 'demo') stageDistribution[key].probability = 0.3;
        });
        
        setForecast({
          deal_stages: stageDistribution,
          total_pipeline: pipelineValue,
          weighted_forecast: monthlyRevenue || Math.round(pipelineValue * 0.3)
        });
        
        if (insightsRes?.ok) {
          const insightsData = await insightsRes.json();
          setSophiaInsights(Array.isArray(insightsData) ? insightsData : []);
        } else if (recsRes?.ok) {
          const recsData = await recsRes.json();
          const recsList = Array.isArray(recsData) ? recsData : recsData.recommendations || [];
          setSophiaInsights(recsList.slice(0, 2).map((rec: any) => ({
            type: 'recommendation',
            title: rec.title || rec.recommendation,
            description: rec.description || rec.rationale,
            action: rec.action || 'View',
            actionUrl: '/campaigns',
            impact: rec.impact || rec.expected_impact,
            confidence: rec.confidence
          })));
        } else {
          setSophiaInsights([]);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspaceId, isDemo, session]);

  if (loading) return <div className="p-8 text-center">Loading dashboard...</div>;
  
  const emptyMetrics: DashboardMetrics = {
    total_contacts: 0, total_campaigns: 0, hot_leads_count: 0, warm_leads_count: 0, cold_leads_count: 0,
    inbox_unread: 0, avg_open_rate: 0, avg_click_rate: 0, avg_conversion_rate: 0,
    pipeline_total_value: 0, monthly_revenue_forecast: 0, meeting_scheduled_this_month: 0, deals_closed_this_month: 0
  };
  const emptyForecast: RevenueForecast = { deal_stages: {}, total_pipeline: 0, weighted_forecast: 0 };
  
  const displayMetrics = metrics || emptyMetrics;
  const displayForecast = forecast || emptyForecast;

  const leadData = [
    { name: 'Hot', value: displayMetrics.hot_leads_count, color: '#ef4444' },
    { name: 'Warm', value: displayMetrics.warm_leads_count, color: '#f59e0b' },
    { name: 'Cold', value: displayMetrics.cold_leads_count, color: '#9ca3af' }
  ];

  const dealStages = Object.entries(displayForecast.deal_stages).map(([key, stage]) => ({
    name: stage.stage_name,
    deals: stage.deal_count,
    probability: stage.probability
  }));

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <DashboardHelpOverlay />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-2">Real-time campaign & revenue metrics</p>
        </div>

        {/* Main Content with Right Sidebar for Sophia */}
        <div className="flex gap-6">
          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Top Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <MetricCard 
                icon={<Users className="w-6 h-6" />}
                label="Total Contacts"
                value={displayMetrics.total_contacts}
                color="blue"
                href="/contacts"
              />
              <MetricCard 
                icon={<Target className="w-6 h-6" />}
                label="Active Campaigns"
                value={displayMetrics.total_campaigns}
                color="green"
                href="/campaigns"
              />
              <MetricCard 
                icon={<TrendingUp className="w-6 h-6" />}
                label="Pipeline Value"
                value={`$${(displayMetrics.pipeline_total_value / 1000).toFixed(0)}k`}
                color="purple"
                href="/deals"
              />
              <MetricCard 
                icon={<CheckCircle2 className="w-6 h-6" />}
                label="Monthly Forecast"
                value={`$${(displayMetrics.monthly_revenue_forecast / 1000).toFixed(0)}k`}
                color="orange"
                href="/analytics"
              />
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-slate-600 font-semibold">Avg Open Rate</div>
                <div className="text-3xl font-bold text-blue-600 mt-2">{displayMetrics.avg_open_rate.toFixed(1)}%</div>
                <div className="text-xs text-slate-500 mt-2">↑ 0.5% from last week</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-slate-600 font-semibold">Avg Click Rate</div>
                <div className="text-3xl font-bold text-green-600 mt-2">{displayMetrics.avg_click_rate.toFixed(1)}%</div>
                <div className="text-xs text-slate-500 mt-2">↑ 0.3% from last week</div>
              </div>
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-slate-600 font-semibold">Conversion Rate</div>
                <div className="text-3xl font-bold text-orange-600 mt-2">{displayMetrics.avg_conversion_rate.toFixed(1)}%</div>
                <div className="text-xs text-slate-500 mt-2">↑ 0.8% from last week</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Activity Chart */}
              <Link to="/campaigns">
                <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-all duration-200 group" data-testid="chart-activity">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">5-Day Activity</h3>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={displayMetrics.activity_chart || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="emails_sent" fill="#3b82f6" name="Emails Sent" />
                      <Bar dataKey="replies_received" fill="#10b981" name="Replies" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Link>

              {/* Lead Distribution */}
              <Link to="/contacts">
                <div className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-lg transition-all duration-200 group" data-testid="chart-leads">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Lead Distribution</h3>
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={leadData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {leadData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Link>
            </div>

            {/* Deal Pipeline */}
            <Link to="/deals">
              <div className="bg-white rounded-lg shadow p-6 mb-8 cursor-pointer hover:shadow-lg transition-all duration-200 group" data-testid="chart-deals">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900">Deal Pipeline by Stage</h3>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dealStages}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="deals" fill="#3b82f6" name="Deal Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Link>

            {/* Hot Leads / Recent Contacts - Clickable List */}
            {hotLeadsList.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-8" data-testid="hot-leads-list">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    {hotLeadsList[0]?._isHot ? (
                      <><span className="text-orange-500">🔥</span> Hot Leads</>
                    ) : (
                      <><Users className="w-5 h-5 text-blue-500" /> Recent Contacts</>
                    )}
                  </h3>
                  <Link to="/contacts" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    View All <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="space-y-2">
                  {hotLeadsList.map((lead: any) => (
                    <Link 
                      key={lead.id} 
                      to={`/contacts/${lead.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group"
                      data-testid={`hot-lead-${lead.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-semibold">
                          {(lead.first_name?.[0] || lead.name?.[0] || 'L').toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 group-hover:text-blue-700">
                            {lead.first_name && lead.last_name 
                              ? `${lead.first_name} ${lead.last_name}` 
                              : lead.name || lead.email || 'Unknown Contact'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {lead.company || lead.job_title || lead.email || 'No details'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Link to="/calendar">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 cursor-pointer hover:bg-blue-100 hover:shadow-md transition-all duration-200 group" data-testid="action-meetings">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0 mr-3" />
                      <div>
                        <h4 className="font-semibold text-blue-900">Meetings Scheduled</h4>
                        <p className="text-blue-700 text-sm mt-1">{displayMetrics.meeting_scheduled_this_month} meetings scheduled this month</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              </Link>
              <Link to="/deals">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 cursor-pointer hover:bg-green-100 hover:shadow-md transition-all duration-200 group" data-testid="action-deals">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0 mr-3" />
                      <div>
                        <h4 className="font-semibold text-green-900">Deals Closed</h4>
                        <p className="text-green-700 text-sm mt-1">{displayMetrics.deals_closed_this_month} deals closed this month</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-green-400 group-hover:text-green-600 transition-colors" />
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Right Sidebar - Sophia Insights */}
          <div className="hidden xl:block w-80 flex-shrink-0">
            <div className="sticky top-6">
              <SophiaInsightsPanel insights={sophiaInsights} context="dashboard" isLoading={loading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color, href }: { icon: React.ReactNode; label: string; value: any; color: string; href?: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100',
    green: 'bg-green-50 border-green-200 text-green-600 hover:bg-green-100',
    purple: 'bg-purple-50 border-purple-200 text-purple-600 hover:bg-purple-100',
    orange: 'bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100'
  };

  const content = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-2">{value}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="opacity-20">{icon}</div>
        {href && <ChevronRight className="w-4 h-4 text-slate-400" />}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href}>
        <div 
          className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-6 cursor-pointer transition-all duration-200 hover:shadow-md`}
          data-testid={`metric-card-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {content}
        </div>
      </Link>
    );
  }

  return (
    <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-6`}>
      {content}
    </div>
  );
}
