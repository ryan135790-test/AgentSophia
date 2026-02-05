import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { 
  Users, 
  Brain, 
  Target, 
  TrendingUp,
  Filter,
  Download,
  Plus,
  Star,
  Clock,
  CheckCircle
} from "lucide-react";

export function LeadsDashboard() {
  const leads = [
    {
      id: 1,
      name: "Sarah Johnson",
      company: "TechCorp Inc.",
      title: "VP of Marketing",
      score: 92,
      source: "LinkedIn",
      status: "Hot",
      aiInsight: "High engagement, optimal timing for outreach",
      lastActivity: "2 hours ago"
    },
    {
      id: 2,
      name: "Michael Chen",
      company: "StartupX",
      title: "CEO",
      score: 87,
      source: "Website",
      status: "Warm",
      aiInsight: "Strong interest in AI solutions, decision maker",
      lastActivity: "1 day ago"
    },
    {
      id: 3,
      name: "Emily Rodriguez",
      company: "Enterprise Solutions",
      title: "Head of Sales",
      score: 94,
      source: "Email Campaign",
      status: "Hot",
      aiInsight: "Previous buyer behavior, high conversion probability",
      lastActivity: "30 minutes ago"
    },
    {
      id: 4,
      name: "David Kim",
      company: "Growth Ventures",
      title: "Marketing Director",
      score: 78,
      source: "Social Media",
      status: "Warm",
      aiInsight: "Active on LinkedIn, prefers video content",
      lastActivity: "4 hours ago"
    }
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-success";
    if (score >= 80) return "text-ai-insight";
    if (score >= 70) return "text-warning";
    return "text-muted-foreground";
  };

  const getStatusVariant = (status: string) => {
    if (status === "Hot") return "destructive";
    if (status === "Warm") return "default";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Lead Intelligence</h2>
          <p className="text-muted-foreground">AI-powered lead detection and scoring across all channels</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      {/* Lead Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Qualified Leads"
          value="1,247"
          change="+18.2%"
          trend="up"
          icon={<Users className="h-6 w-6 text-primary" />}
        />
        <MetricCard
          title="AI Detection Rate"
          value="96.8%"
          change="+5.1%"
          trend="up"
          variant="success"
          icon={<Brain className="h-6 w-6 text-success-foreground" />}
        />
        <MetricCard
          title="Avg Lead Score"
          value="84.3"
          change="+12.5%"
          trend="up"
          variant="insight"
          icon={<Target className="h-6 w-6 text-primary-foreground" />}
        />
        <MetricCard
          title="Conversion Rate"
          value="23.7%"
          change="+8.9%"
          trend="up"
          variant="gradient"
          icon={<TrendingUp className="h-6 w-6 text-primary-foreground" />}
        />
      </div>

      {/* Lead Sources & Quality Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <span>Lead Sources</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
              <span className="font-medium">LinkedIn</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-success/10 text-success">
                  547 leads
                </Badge>
                <span className="text-sm text-muted-foreground">43.8%</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
              <span className="font-medium">Website Forms</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-ai-insight/10 text-ai-insight">
                  312 leads
                </Badge>
                <span className="text-sm text-muted-foreground">25.0%</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
              <span className="font-medium">Email Campaigns</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-accent/10 text-accent">
                  248 leads
                </Badge>
                <span className="text-sm text-muted-foreground">19.9%</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-card">
              <span className="font-medium">Social Media</span>
              <div className="flex items-center space-x-2">
                <Badge variant="outline">
                  140 leads
                </Badge>
                <span className="text-sm text-muted-foreground">11.2%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-accent" />
              <span>AI Quality Distribution</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-success"></div>
                  <span className="text-sm font-medium">High Quality (90-100)</span>
                </div>
                <span className="text-sm text-muted-foreground">342 leads (27.4%)</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-ai-insight"></div>
                  <span className="text-sm font-medium">Good Quality (80-89)</span>
                </div>
                <span className="text-sm text-muted-foreground">485 leads (38.9%)</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-warning"></div>
                  <span className="text-sm font-medium">Medium Quality (70-79)</span>
                </div>
                <span className="text-sm text-muted-foreground">298 leads (23.9%)</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="h-3 w-3 rounded-full bg-muted"></div>
                  <span className="text-sm font-medium">Low Quality (60-69)</span>
                </div>
                <span className="text-sm text-muted-foreground">122 leads (9.8%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent High-Quality Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Star className="h-5 w-5 text-warning" />
            <span>High-Priority AI Leads</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leads.map((lead) => (
              <div key={lead.id} className="p-4 rounded-lg border bg-gradient-card hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{lead.name}</h3>
                        <Badge variant={getStatusVariant(lead.status)} className="text-xs">
                          {lead.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{lead.title} at {lead.company}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>Source: {lead.source}</span>
                        <span className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>{lead.lastActivity}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getScoreColor(lead.score)}`}>
                        {lead.score}
                      </div>
                      <div className="text-xs text-muted-foreground">AI Score</div>
                    </div>
                    
                    <div className="max-w-xs">
                      <div className="flex items-center space-x-2 mb-2">
                        <Brain className="h-4 w-4 text-accent" />
                        <span className="text-sm font-medium">AI Insight</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{lead.aiInsight}</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline">
                        View Profile
                      </Button>
                      <Button size="sm" className="bg-gradient-primary">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Qualify
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}