import { useState } from "react";
import { EmailAssistant } from "@/components/agent-sophia/email-assistant";
import { SophiaEmailInsights } from "@/components/agent-sophia/sophia-email-insights";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function EmailManager() {
  const [selectedEmail, setSelectedEmail] = useState<any>(null);
  const [autonomyLevel, setAutonomyLevel] = useState<'manual' | 'semi' | 'full'>('manual');
  const { toast } = useToast();

  const handleActionExecute = (action: any) => {
    if (action.type === 'reply') {
      toast({ title: "Generate Reply", description: "Use the Generate Reply button on the email to create an AI response" });
    } else if (action.type === 'schedule_meeting') {
      toast({ title: "Meeting Scheduler", description: "Opening meeting scheduler..." });
    } else if (action.type === 'add_to_crm') {
      toast({ title: "Adding to CRM", description: `Adding ${selectedEmail?.from?.name || 'contact'} to contacts` });
    } else if (action.type === 'follow_up') {
      toast({ title: "Follow-up Scheduled", description: "Reminder set for follow-up" });
    } else {
      toast({ title: "Action Executed", description: action.label });
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            Email Manager
          </h1>
          <p className="text-muted-foreground">Sophia manages your personal email with AI-powered insights and automation</p>
        </div>
        <Badge variant={autonomyLevel === 'full' ? 'default' : 'secondary'} className="text-xs" data-testid="badge-autonomy-level">
          {autonomyLevel === 'manual' ? 'Manual Mode' : autonomyLevel === 'semi' ? 'Semi-Auto' : 'Fully Autonomous'}
        </Badge>
      </div>

      <ResizablePanelGroup direction="horizontal" className="flex-1 rounded-lg border min-h-[600px]">
        <ResizablePanel defaultSize={70} minSize={50}>
          <div className="h-full overflow-auto p-4">
            <EmailAssistant onEmailSelect={setSelectedEmail} />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={30} minSize={20}>
          <SophiaEmailInsights
            email={selectedEmail}
            onActionExecute={handleActionExecute}
            autonomyLevel={autonomyLevel}
            onAutonomyChange={setAutonomyLevel}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
