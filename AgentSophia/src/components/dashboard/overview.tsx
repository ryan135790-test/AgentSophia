import { MetricCard } from "@/components/ui/metric-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { 
  Users, 
  TrendingUp, 
  Bot, 
  Target,
  Linkedin,
  Mail,
  Zap,
  Brain
} from "lucide-react";

export function Overview() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const conversionRate = stats?.conversionRate || 0;
  const openRate = stats?.openRate || 0;

  return (
    <div className="space-y-6">
      {/* AI Insights Banner */}
      <Card className="bg-gradient-hero border-0 text-primary-foreground">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Brain className="h-5 w-5" />
                <span className="text-sm font-medium opacity-90">AI Optimization Score</span>
              </div>
              <div className="text-3xl font-bold">{conversionRate.toFixed(1)}%</div>
              <p className="text-sm opacity-80">
                {conversionRate > 70 ? "Your platform is performing exceptionally well" : 
                 conversionRate > 40 ? "Good performance, room for improvement" : 
                 "Let's optimize your workflows"}
              </p>
            </div>
            <div className="text-right space-y-2">
              <Badge variant="secondary" className="bg-primary-foreground/20 text-primary-foreground">
                {stats?.activeAutomations || 0} active workflows
              </Badge>
              <p className="text-sm opacity-80">AI recommendations active</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Leads"
          value={stats?.totalLeads.toString() || "0"}
          change={stats?.newLeadsThisMonth ? `+${stats.newLeadsThisMonth} this month` : "No new leads"}
          trend="up"
          icon={<Users className="h-6 w-6 text-primary" />}
          data-testid="metric-total-leads"
        />
        <MetricCard
          title="Conversion Rate"
          value={`${conversionRate.toFixed(1)}%`}
          change={`${stats?.convertedLeads || 0} converted`}
          trend={conversionRate > 50 ? "up" : "down"}
          variant="success"
          icon={<Target className="h-6 w-6 text-success-foreground" />}
          data-testid="metric-conversion-rate"
        />
        <MetricCard
          title="Campaign Performance"
          value={`${openRate.toFixed(1)}%`}
          change={`${stats?.activeCampaigns || 0} active campaigns`}
          trend={openRate > 50 ? "up" : "down"}
          variant="insight"
          icon={<Linkedin className="h-6 w-6 text-primary-foreground" />}
          data-testid="metric-campaign-performance"
        />
        <MetricCard
          title="Email Performance"
          value={`${(stats?.clickRate || 0).toFixed(1)}%`}
          change={`${stats?.totalSent || 0} sent`}
          trend={(stats?.clickRate || 0) > 10 ? "up" : "down"}
          variant="gradient"
          icon={<Mail className="h-6 w-6 text-primary-foreground" />}
          data-testid="metric-email-performance"
        />
      </div>

      {/* AI Workflows Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-primary" />
              <span>Active AI Workflows</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats?.activeAutomations === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active AI workflows yet</p>
                <p className="text-sm">Set up your first automation to get started</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-card" data-testid="workflow-lead-scoring">
                  <div>
                    <p className="font-medium">Smart Lead Scoring</p>
                    <p className="text-sm text-muted-foreground">Processing {stats?.totalLeads || 0} leads</p>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    Active
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-card" data-testid="workflow-campaign-optimizer">
                  <div>
                    <p className="font-medium">Campaign Optimizer</p>
                    <p className="text-sm text-muted-foreground">{stats?.activeCampaigns || 0} campaigns running</p>
                  </div>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    Active
                  </Badge>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-accent" />
              <span>Performance Insights</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-lg bg-gradient-insight">
              <div className="flex items-start space-x-3">
                <Zap className="h-5 w-5 text-primary-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-primary-foreground">Peak Performance Window</p>
                  <p className="text-sm text-primary-foreground/80">Your leads are most active between 2-4 PM</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-secondary">
              <div className="flex items-start space-x-3">
                <Brain className="h-5 w-5 text-accent mt-0.5" />
                <div>
                  <p className="font-medium">AI Recommendation</p>
                  <p className="text-sm text-muted-foreground">Increase LinkedIn outreach by 15% for optimal results</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-success">
              <div className="flex items-start space-x-3">
                <Target className="h-5 w-5 text-success-foreground mt-0.5" />
                <div>
                  <p className="font-medium text-success-foreground">Quality Score</p>
                  <p className="text-sm text-success-foreground/80">Your lead quality has improved by 23% this month</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}