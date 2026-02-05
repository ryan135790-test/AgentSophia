import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Bot, 
  Zap, 
  Settings, 
  Play,
  Pause,
  BarChart3,
  Linkedin,
  Mail,
  Users,
  Brain,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock
} from "lucide-react";

export function AutomationHub() {
  const { toast } = useToast();
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<number | null>(null);
  const [workflows, setWorkflows] = useState([
    {
      id: 1,
      name: "Smart Lead Scoring",
      description: "AI-powered lead qualification with 94.2% accuracy",
      status: "active",
      performance: "94.2%",
      icon: Users,
      type: "Lead Management",
      lastRun: "2 minutes ago"
    },
    {
      id: 2,
      name: "LinkedIn Message Personalization",
      description: "Generate personalized LinkedIn messages using AI",
      status: "active",
      performance: "87.8%",
      icon: Linkedin,
      type: "Social Outreach",
      lastRun: "5 minutes ago"
    },
    {
      id: 3,
      name: "Email Subject Optimizer",
      description: "Optimize email subject lines for maximum open rates",
      status: "active",
      performance: "92.1%",
      icon: Mail,
      type: "Email Marketing",
      lastRun: "8 minutes ago"
    },
    {
      id: 4,
      name: "Timing Optimizer",
      description: "AI determines optimal send times for each contact",
      status: "paused",
      performance: "89.3%",
      icon: Brain,
      type: "Optimization",
      lastRun: "1 hour ago"
    }
  ]);

  const toggleWorkflow = (id: number) => {
    setWorkflows(prev => prev.map(w => 
      w.id === id 
        ? { ...w, status: w.status === "active" ? "paused" : "active" }
        : w
    ));
    
    const workflow = workflows.find(w => w.id === id);
    toast({
      title: workflow?.status === "active" ? "Workflow Paused" : "Workflow Started",
      description: `${workflow?.name} is now ${workflow?.status === "active" ? "paused" : "active"}`,
    });
  };

  const handleCreateWorkflow = () => {
    toast({
      title: "Create Workflow",
      description: "Workflow builder coming soon! For now, use the AI Campaign Builder to create automated campaigns.",
    });
  };

  const handleSettings = (workflowId: number) => {
    const workflow = workflows.find(w => w.id === workflowId);
    toast({
      title: "Workflow Settings",
      description: `Configure settings for ${workflow?.name}`,
    });
  };

  const handleAnalytics = (workflowId: number) => {
    setSelectedWorkflow(workflowId);
    setAnalyticsOpen(true);
  };
  
  const currentWorkflow = workflows.find(w => w.id === selectedWorkflow);
  
  // Generate mock analytics data based on workflow
  const getAnalyticsData = () => {
    if (!currentWorkflow) return null;
    
    const baseMetrics = {
      totalRuns: Math.floor(Math.random() * 500) + 100,
      successRate: parseFloat(currentWorkflow.performance),
      avgDuration: Math.floor(Math.random() * 30) + 5,
      lastWeekRuns: [45, 52, 48, 61, 55, 58, 63]
    };
    
    return baseMetrics;
  };
  
  const analyticsData = getAnalyticsData();

  const handleTemplateClick = (template: string) => {
    toast({
      title: "Template Selected",
      description: `${template} workflow template selected. Use AI Campaign Builder to create this automation.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">AI Automation Hub</h2>
          <p className="text-muted-foreground">Manage and monitor your AI-powered workflows</p>
        </div>
        <Button 
          className="bg-gradient-primary"
          onClick={handleCreateWorkflow}
          data-testid="button-create-workflow"
        >
          <Zap className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {/* Active Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {workflows.map((workflow) => {
          const Icon = workflow.icon;
          return (
            <Card key={workflow.id} className="hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-gradient-primary">
                      <Icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{workflow.type}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={workflow.status === "active" ? "default" : "secondary"}
                    className={workflow.status === "active" ? "bg-success text-success-foreground" : ""}
                  >
                    {workflow.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{workflow.description}</p>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Performance</p>
                    <p className="text-2xl font-bold text-success">{workflow.performance}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm text-muted-foreground">Last Run</p>
                    <p className="text-sm font-medium">{workflow.lastRun}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button 
                    size="sm" 
                    variant={workflow.status === "active" ? "outline" : "default"}
                    className="flex-1"
                    onClick={() => toggleWorkflow(workflow.id)}
                    data-testid={`button-toggle-workflow-${workflow.id}`}
                  >
                    {workflow.status === "active" ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </>
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleSettings(workflow.id)}
                    data-testid={`button-settings-${workflow.id}`}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleAnalytics(workflow.id)}
                    data-testid={`button-analytics-${workflow.id}`}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Workflow Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-primary" />
            <span>AI Workflow Templates</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              className="p-4 rounded-lg border border-dashed border-border hover:border-primary transition-colors cursor-pointer"
              onClick={() => handleTemplateClick("Lead Enrichment")}
              data-testid="template-lead-enrichment"
            >
              <div className="text-center space-y-2">
                <div className="h-12 w-12 mx-auto rounded-lg bg-gradient-insight flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-medium">Lead Enrichment</h3>
                <p className="text-sm text-muted-foreground">Automatically enrich leads with AI-powered data</p>
              </div>
            </div>
            
            <div 
              className="p-4 rounded-lg border border-dashed border-border hover:border-primary transition-colors cursor-pointer"
              onClick={() => handleTemplateClick("Email Sequences")}
              data-testid="template-email-sequences"
            >
              <div className="text-center space-y-2">
                <div className="h-12 w-12 mx-auto rounded-lg bg-gradient-success flex items-center justify-center">
                  <Mail className="h-6 w-6 text-success-foreground" />
                </div>
                <h3 className="font-medium">Email Sequences</h3>
                <p className="text-sm text-muted-foreground">Create AI-driven email sequences</p>
              </div>
            </div>
            
            <div 
              className="p-4 rounded-lg border border-dashed border-border hover:border-primary transition-colors cursor-pointer"
              onClick={() => handleTemplateClick("Social Automation")}
              data-testid="template-social-automation"
            >
              <div className="text-center space-y-2">
                <div className="h-12 w-12 mx-auto rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Linkedin className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="font-medium">Social Automation</h3>
                <p className="text-sm text-muted-foreground">Automate LinkedIn outreach campaigns</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Modal */}
      <Dialog open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <span>{currentWorkflow?.name} - Analytics</span>
            </DialogTitle>
            <DialogDescription>
              Performance metrics and insights for this automation workflow
            </DialogDescription>
          </DialogHeader>

          {analyticsData && (
            <div className="space-y-6 mt-4">
              {/* Key Metrics */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Runs</p>
                        <p className="text-2xl font-bold">{analyticsData.totalRuns}</p>
                      </div>
                      <Activity className="h-8 w-8 text-primary opacity-50" />
                    </div>
                    <div className="flex items-center mt-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-success mr-1" />
                      <span className="text-success">+12% from last week</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Success Rate</p>
                        <p className="text-2xl font-bold">{analyticsData.successRate}%</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-success opacity-50" />
                    </div>
                    <div className="flex items-center mt-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-success mr-1" />
                      <span className="text-success">+2.3% improvement</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Duration</p>
                        <p className="text-2xl font-bold">{analyticsData.avgDuration}s</p>
                      </div>
                      <Clock className="h-8 w-8 text-primary opacity-50" />
                    </div>
                    <div className="flex items-center mt-2 text-sm">
                      <TrendingDown className="h-4 w-4 text-success mr-1" />
                      <span className="text-success">-15% faster</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Weekly Activity Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Last 7 Days Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {analyticsData.lastWeekRuns.map((runs, index) => {
                      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                      const maxRuns = Math.max(...analyticsData.lastWeekRuns);
                      const percentage = (runs / maxRuns) * 100;
                      
                      return (
                        <div key={index} className="flex items-center space-x-3">
                          <span className="text-sm font-medium w-12">{days[index]}</span>
                          <div className="flex-1 bg-secondary rounded-full h-8 relative overflow-hidden">
                            <div 
                              className="bg-gradient-primary h-full flex items-center justify-end pr-3 transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            >
                              <span className="text-xs font-semibold text-primary-foreground">
                                {runs} runs
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Performance Insights */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Performance Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 rounded-lg bg-success/10">
                      <TrendingUp className="h-5 w-5 text-success mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">High Success Rate</p>
                        <p className="text-sm text-muted-foreground">
                          This workflow is performing {analyticsData.successRate}% above average
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-3 rounded-lg bg-primary/10">
                      <Activity className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Consistent Performance</p>
                        <p className="text-sm text-muted-foreground">
                          Workflow runs steadily with {analyticsData.totalRuns} total executions
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3 p-3 rounded-lg bg-blue-500/10">
                      <Clock className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Optimized Timing</p>
                        <p className="text-sm text-muted-foreground">
                          Average execution time of {analyticsData.avgDuration}s is {analyticsData.avgDuration < 15 ? 'excellent' : 'good'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}