import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ArrowRight, Mail, Linkedin, Settings, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  icon: any;
  completed: boolean;
  action?: string;
  link?: string;
}

export function GettingStarted() {
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: "connect-office365",
      title: "Connect Office 365",
      description: "Link your email account for automated outreach and inbox monitoring",
      icon: Mail,
      completed: false,
      action: "Go to Connectors",
      link: "/platform?tab=connectors"
    },
    {
      id: "connect-linkedin",
      title: "Connect LinkedIn (Optional)",
      description: "Enable LinkedIn automation for connection requests and messaging",
      icon: Linkedin,
      completed: false,
      action: "Go to Connectors",
      link: "/platform?tab=connectors"
    },
    {
      id: "configure-agent",
      title: "Configure Agent Settings",
      description: "Set autonomy level, working hours, and qualification criteria",
      icon: Settings,
      completed: false,
      action: "Configure Now",
      link: "#automation"
    },
    {
      id: "add-contacts",
      title: "Import Contacts",
      description: "Add leads to start your AI-powered outreach campaigns",
      icon: Calendar,
      completed: false,
      action: "Import Contacts",
      link: "/platform?tab=contacts"
    }
  ]);

  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    checkSetupStatus();
  }, [currentWorkspace?.id]);

  const checkSetupStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check Office 365 connection
      const office365Config = localStorage.getItem('office365_config');
      const hasOffice365 = !!office365Config;

      // Check LinkedIn connection (workspace-scoped)
      let linkedinConnection = null;
      if (currentWorkspace?.id) {
        const { data } = await supabase
          .from('social_connections')
          .select('*')
          .eq('user_id', user.id)
          .eq('workspace_id', currentWorkspace.id)
          .eq('platform', 'linkedin')
          .eq('is_active', true)
          .maybeSingle();
        linkedinConnection = data;
      }

      // Check Agent config
      const { data: agentConfig } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Check contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      setSteps(prev => prev.map(step => {
        switch(step.id) {
          case "connect-office365":
            return { ...step, completed: hasOffice365 };
          case "connect-linkedin":
            return { ...step, completed: !!linkedinConnection };
          case "configure-agent":
            return { ...step, completed: !!agentConfig };
          case "add-contacts":
            return { ...step, completed: (contacts?.length || 0) > 0 };
          default:
            return step;
        }
      }));
    } catch (error) {
      console.error('Error checking setup status:', error);
    }
  };

  const completedSteps = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const progressPercent = (completedSteps / totalSteps) * 100;

  return (
    <Card className="border-2 border-primary/20" data-testid="card-getting-started">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Getting Started with Agent Sophia</CardTitle>
            <CardDescription>
              Complete these steps to activate your AI sales agent
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{completedSteps}/{totalSteps}</div>
            <div className="text-xs text-muted-foreground">Steps Completed</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {completedSteps === totalSteps && (
          <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Setup Complete!</strong> Agent Sophia is ready to start autonomous operations. 
              Enable automation in the Automation tab to begin.
            </AlertDescription>
          </Alert>
        )}

        {/* Setup Steps */}
        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                  step.completed 
                    ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                    : 'bg-secondary/50 hover:bg-secondary'
                }`}
                data-testid={`setup-step-${step.id}`}
              >
                {/* Step Number/Status */}
                <div className="flex-shrink-0">
                  {step.completed ? (
                    <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-white" />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-full border-2 border-muted-foreground flex items-center justify-center text-muted-foreground font-semibold">
                      {index + 1}
                    </div>
                  )}
                </div>

                {/* Icon */}
                <div className={`flex-shrink-0 p-2 rounded-lg ${
                  step.completed ? 'bg-green-100 dark:bg-green-900' : 'bg-primary/10'
                }`}>
                  <Icon className={`h-5 w-5 ${
                    step.completed ? 'text-green-600' : 'text-primary'
                  }`} />
                </div>

                {/* Content */}
                <div className="flex-grow">
                  <div className="font-semibold">{step.title}</div>
                  <div className="text-sm text-muted-foreground">{step.description}</div>
                </div>

                {/* Action Button */}
                {!step.completed && step.action && (
                  <Link to={step.link || "#"}>
                    <Button variant="outline" size="sm" data-testid={`button-${step.id}`}>
                      {step.action}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick Tips */}
        <Alert>
          <AlertDescription>
            <strong>💡 Quick Tip:</strong> Agent Sophia works best when you complete all setup steps. 
            Start with Office 365 for email automation, then configure your agent's behavior in the Automation tab.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
