import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, X, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WorkflowHelpProps {
  onSelectTemplate?: (template: any) => void;
}

export function WorkflowBuilderHelp({ onSelectTemplate }: WorkflowHelpProps) {
  const [showTemplates, setShowTemplates] = useState(false);

  const templates = [
    {
      name: "3-Email Sequence",
      tip: "🚀 Response rates jump 45% with multi-touch sequences",
      description: "Email → Wait 3 days → Email → Wait 3 days → Email"
    },
    {
      name: "Email + SMS Combo",
      tip: "💥 Email + SMS get 3x conversion vs single channel",
      description: "Email → Wait 2 days → SMS → Wait 2 days → Email"
    },
    {
      name: "Smart Branching",
      tip: "🔀 Personalization by behavior = 26% revenue lift",
      description: "Send Email → Check if opened → Different next steps"
    },
    {
      name: "Multi-Channel Launch",
      tip: "📡 Use all channels together for maximum impact",
      description: "LinkedIn + Email together → Build credibility + close"
    }
  ];

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              data-testid="workflow-help-button"
            >
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </button>
          </TooltipTrigger>
          <TooltipContent>View workflow templates and tips</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-96 overflow-y-auto">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between sticky top-0">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Workflow Templates
                </h3>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
                data-testid="close-templates"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {templates.map((template, i) => (
                <Card key={i} className="p-4 hover:shadow-md transition-shadow border-blue-100 dark:border-blue-800">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm text-slate-900 dark:text-white mb-1">
                        {template.name}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                        {template.description}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {template.tip}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0"
                      onClick={() => {
                        onSelectTemplate?.(template);
                        setShowTemplates(false);
                      }}
                      data-testid={`select-template-${i}`}
                    >
                      Use
                    </Button>
                  </div>
                </Card>
              ))}

              <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                <h4 className="font-medium text-sm text-green-900 dark:text-green-100 mb-2">
                  ⏱️ Timing Best Practices
                </h4>
                <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
                  <li>• Wait 2-3 days between email touches</li>
                  <li>• SMS immediately after if combined</li>
                  <li>• LinkedIn 5+ days (longer relationship building)</li>
                  <li>• Total sequence: 5-7 touches for cold leads</li>
                </ul>
              </Card>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
