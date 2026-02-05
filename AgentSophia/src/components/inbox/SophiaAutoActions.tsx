import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Check } from "lucide-react";

interface SophiaAutoActionsProps {
  intent?: string;
  actions?: string[];
  isExecuting?: boolean;
  onExecute?: () => void;
}

export function SophiaAutoActions({ 
  intent = 'unknown', 
  actions = [], 
  isExecuting = false,
  onExecute 
}: SophiaAutoActionsProps) {
  return (
    <div className="space-y-2" data-testid="sophia-auto-actions">
      {actions.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-2 mb-2">
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-300 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Sophia's Suggested Actions
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Based on detected intent: <span className="font-semibold">{intent}</span>
              </p>
            </div>
          </div>
          
          <div className="space-y-1 ml-6">
            {actions.map((action, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                <span className="text-blue-800 dark:text-blue-200">{action}</span>
              </div>
            ))}
          </div>

          {onExecute && (
            <Button 
              size="sm" 
              variant="outline" 
              onClick={onExecute}
              disabled={isExecuting}
              className="mt-3 w-full text-xs"
              data-testid="button-execute-actions"
            >
              {isExecuting ? 'Executing...' : '⚡ Execute All Actions'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
