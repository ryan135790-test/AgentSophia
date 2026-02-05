import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Sparkles, CheckCircle2, Circle, ArrowRight, ArrowLeft,
  Linkedin, Mail, Calendar, Users, Megaphone, Brain,
  Shield, BarChart3, MessageSquare, Zap, Target, Rocket,
  ChevronRight, ExternalLink, PlayCircle, BookOpen
} from "lucide-react";
import { Link } from "react-router-dom";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  link?: string;
  completed: boolean;
  tasks: {
    id: string;
    label: string;
    completed: boolean;
    link?: string;
  }[];
}

const STORAGE_KEY = 'intellead_onboarding_progress';

export default function GettingStartedWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      id: 'welcome',
      title: 'Welcome to IntelLead',
      description: 'Meet Sophia, your autonomous AI sales agent',
      icon: Sparkles,
      completed: false,
      tasks: [
        { id: 'intro', label: 'Understand what Sophia can do', completed: false },
        { id: 'dashboard', label: 'Explore the dashboard', completed: false, link: '/dashboard' },
      ]
    },
    {
      id: 'connections',
      title: 'Connect Your Accounts',
      description: 'Link your email, LinkedIn, and calendar',
      icon: Zap,
      link: '/connections',
      completed: false,
      tasks: [
        { id: 'linkedin', label: 'Connect LinkedIn account', completed: false, link: '/connections' },
        { id: 'email', label: 'Configure email provider (Resend/SendGrid)', completed: false, link: '/settings' },
        { id: 'calendar', label: 'Connect Google Calendar (optional)', completed: false, link: '/connections' },
      ]
    },
    {
      id: 'contacts',
      title: 'Import Your Contacts',
      description: 'Add leads to your CRM',
      icon: Users,
      link: '/contacts',
      completed: false,
      tasks: [
        { id: 'import-csv', label: 'Import contacts via CSV', completed: false, link: '/contacts' },
        { id: 'enrich', label: 'Enrich contacts with email/phone data', completed: false, link: '/contacts' },
      ]
    },
    {
      id: 'campaign',
      title: 'Create Your First Campaign',
      description: 'Build a multichannel outreach sequence',
      icon: Megaphone,
      link: '/campaigns',
      completed: false,
      tasks: [
        { id: 'create-campaign', label: 'Create a new campaign', completed: false, link: '/campaigns' },
        { id: 'add-steps', label: 'Add email and LinkedIn steps', completed: false },
        { id: 'add-contacts', label: 'Add contacts to campaign', completed: false },
        { id: 'launch', label: 'Launch your campaign', completed: false },
      ]
    },
    {
      id: 'sophia',
      title: 'Configure Sophia',
      description: 'Set autonomy levels and preferences',
      icon: Brain,
      link: '/sophia-brain',
      completed: false,
      tasks: [
        { id: 'autonomy', label: 'Set Sophia autonomy level', completed: false, link: '/sophia-brain' },
        { id: 'brand-voice', label: 'Define your brand voice', completed: false, link: '/templates' },
        { id: 'approval-threshold', label: 'Configure approval thresholds', completed: false, link: '/sophia-brain' },
      ]
    },
    {
      id: 'safety',
      title: 'Review Safety Settings',
      description: 'Protect your accounts with smart limits',
      icon: Shield,
      link: '/linkedin-settings',
      completed: false,
      tasks: [
        { id: 'linkedin-limits', label: 'Review LinkedIn daily limits', completed: false, link: '/linkedin-settings' },
        { id: 'compliance', label: 'Understand compliance guidelines', completed: false, link: '/linkedin-settings' },
      ]
    },
  ]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSteps(parsed.steps || steps);
        setCurrentStep(parsed.currentStep || 0);
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ steps, currentStep }));
  }, [steps, currentStep]);

  const toggleTask = (stepIndex: number, taskId: string) => {
    setSteps(prev => {
      const updated = [...prev];
      const step = { ...updated[stepIndex] };
      step.tasks = step.tasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      step.completed = step.tasks.every(t => t.completed);
      updated[stepIndex] = step;
      return updated;
    });
  };

  const completedSteps = steps.filter(s => s.completed).length;
  const totalTasks = steps.reduce((acc, s) => acc + s.tasks.length, 0);
  const completedTasks = steps.reduce((acc, s) => acc + s.tasks.filter(t => t.completed).length, 0);
  const progressPercent = Math.round((completedTasks / totalTasks) * 100);

  const currentStepData = steps[currentStep];

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950 p-6 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl text-white">
                <Rocket className="w-8 h-8" />
              </div>
              Getting Started
            </h1>
            <p className="text-muted-foreground mt-2">
              Complete these steps to set up your AI-powered lead generation platform
            </p>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {completedSteps}/{steps.length} Complete
          </Badge>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4 mb-2">
              <Progress value={progressPercent} className="flex-1 h-3" />
              <span className="text-sm font-medium text-muted-foreground w-12">{progressPercent}%</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Steps</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                {steps.map((step, index) => (
                  <button
                    key={step.id}
                    onClick={() => setCurrentStep(index)}
                    className={`w-full text-left p-4 border-b transition-colors ${
                      currentStep === index 
                        ? 'bg-primary/5 border-l-4 border-l-primary' 
                        : 'hover:bg-muted/50'
                    }`}
                    data-testid={`btn-step-${step.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        step.completed 
                          ? 'bg-green-100 text-green-600 dark:bg-green-900/30' 
                          : currentStep === index
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {step.completed ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <step.icon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium truncate ${step.completed ? 'text-green-700 dark:text-green-400' : ''}`}>
                          {step.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {step.tasks.filter(t => t.completed).length}/{step.tasks.length} tasks
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${
                  currentStepData.completed 
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30' 
                    : 'bg-primary/10 text-primary'
                }`}>
                  <currentStepData.icon className="w-8 h-8" />
                </div>
                <div>
                  <CardTitle className="text-xl">{currentStepData.title}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {currentStepData.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {currentStep === 0 && (
                <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-xl p-6 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl text-white">
                      <Brain className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Meet Agent Sophia</h3>
                      <p className="text-muted-foreground mb-4">
                        Sophia is your <strong>Autonomous AI Agent</strong> - a software program capable of reasoning, 
                        planning, and executing complex sales and marketing tasks on its own.
                      </p>
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>Writes personalized outreach</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>Responds to leads automatically</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>Books meetings on your calendar</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span>Learns from your preferences</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                  Tasks to Complete
                </h4>
                {currentStepData.tasks.map((task) => (
                  <div 
                    key={task.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
                      task.completed 
                        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                        : 'bg-card hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox 
                      checked={task.completed}
                      onCheckedChange={() => toggleTask(currentStep, task.id)}
                      data-testid={`checkbox-${task.id}`}
                    />
                    <span className={`flex-1 ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                      {task.label}
                    </span>
                    {task.link && (
                      <Link to={task.link}>
                        <Button size="sm" variant="ghost" data-testid={`btn-go-${task.id}`}>
                          Go <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>

              <Separator />

              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                  disabled={currentStep === 0}
                  data-testid="btn-prev-step"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                {currentStep < steps.length - 1 ? (
                  <Button
                    onClick={() => setCurrentStep(prev => prev + 1)}
                    data-testid="btn-next-step"
                  >
                    Next Step
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Link to="/dashboard">
                    <Button className="bg-gradient-to-r from-violet-600 to-indigo-600" data-testid="btn-finish">
                      <Sparkles className="w-4 h-4 mr-2" />
                      Go to Dashboard
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Quick Links
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link to="/how-to-use" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-4" data-testid="btn-how-to-use">
                  <PlayCircle className="w-5 h-5 mr-3 text-violet-500" />
                  <div className="text-left">
                    <p className="font-medium">How to Use</p>
                    <p className="text-xs text-muted-foreground">Feature guide & tutorials</p>
                  </div>
                </Button>
              </Link>
              <Link to="/campaigns" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-4" data-testid="btn-quick-campaigns">
                  <Megaphone className="w-5 h-5 mr-3 text-blue-500" />
                  <div className="text-left">
                    <p className="font-medium">Campaigns</p>
                    <p className="text-xs text-muted-foreground">Create outreach sequences</p>
                  </div>
                </Button>
              </Link>
              <Link to="/unified-inbox" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-4" data-testid="btn-quick-inbox">
                  <MessageSquare className="w-5 h-5 mr-3 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">Unified Inbox</p>
                    <p className="text-xs text-muted-foreground">All messages in one place</p>
                  </div>
                </Button>
              </Link>
              <Link to="/analytics" className="block">
                <Button variant="outline" className="w-full justify-start h-auto py-4" data-testid="btn-quick-analytics">
                  <BarChart3 className="w-5 h-5 mr-3 text-orange-500" />
                  <div className="text-left">
                    <p className="font-medium">Analytics</p>
                    <p className="text-xs text-muted-foreground">Track performance</p>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
