import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, X, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HelpContent {
  title: string;
  steps: string[];
  tips: string[];
}

interface ContextualHelpProps {
  topic?: string;
  tooltip?: string;
  position?: "top" | "right" | "bottom" | "left";
  onClose?: () => void;
}

export function HelpButton({ topic, tooltip }: ContextualHelpProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-button"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        {tooltip && <TooltipContent>{tooltip}</TooltipContent>}
      </Tooltip>

      {showHelp && topic && (
        <ContextualHelpPanel topic={topic} onClose={() => setShowHelp(false)} />
      )}
    </TooltipProvider>
  );
}

interface ContextualHelpPanelProps {
  topic: string;
  onClose: () => void;
}

export function ContextualHelpPanel({ topic, onClose }: ContextualHelpPanelProps) {
  const helpContent: Record<string, HelpContent> = {
    "campaign-creation": {
      title: "Creating Your First Campaign",
      steps: [
        "1. Select channels (Email, LinkedIn, SMS)",
        "2. Describe your product and audience",
        "3. Define your campaign goal",
        "4. Name your campaign",
        "5. Choose lead source",
        "6. Review generated messages",
        "7. Launch campaign"
      ],
      tips: [
        "💡 Multi-channel campaigns get 3x higher conversion",
        "💡 Use research-backed best practices",
        "💡 Test different message versions"
      ]
    },
    "workflow-builder": {
      title: "Building Visual Workflows",
      steps: [
        "1. Create or launch a campaign",
        "2. Click 'Convert to Workflow'",
        "3. Drag nodes onto canvas",
        "4. Connect nodes with edges",
        "5. Configure each node",
        "6. Add conditions and timing"
      ],
      tips: [
        "🔄 Multi-touch sequences increase response 2.5x",
        "⏱️ Wait 2-3 days between touches",
        "🔀 Add conditions to branch based on responses"
      ]
    }
  };

  const content = helpContent[topic];
  if (!content) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-80 shadow-lg border-blue-200 dark:border-blue-800">
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
          💡 {content.title}
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
          data-testid="close-help"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
            📋 Steps
          </h4>
          <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
            {content.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2">
                <ChevronRight className="w-3 h-3 flex-shrink-0 mt-0.5 text-blue-600" />
                {step}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-blue-200 dark:border-blue-800 pt-3">
          <h4 className="text-xs font-semibold text-slate-900 dark:text-white mb-2">
            ✨ Pro Tips
          </h4>
          <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300">
            {content.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>

        <Button
          size="sm"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          onClick={onClose}
          data-testid="got-it-button"
        >
          Got it!
        </Button>
      </div>
    </Card>
  );
}
