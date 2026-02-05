import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Circle } from "lucide-react";

interface OnboardingStep {
  step: string;
  completed?: boolean;
  description: string;
}

interface OnboardingChecklistProps {
  steps: OnboardingStep[];
  onStepClick?: (step: string) => void;
}

export function OnboardingChecklist({ steps, onStepClick }: OnboardingChecklistProps) {
  const completedCount = steps.filter(s => s.completed).length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
            Your Journey
          </h3>
          <span className="text-xs font-medium text-blue-600 dark:text-blue-300">
            {progress}% Complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step) => (
            <button
              key={step.step}
              onClick={() => onStepClick?.(step.step)}
              className="w-full text-left p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              data-testid={`onboarding-step-${step.step}`}
            >
              <div className="flex items-start gap-2">
                {step.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium ${step.completed ? 'text-slate-600 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                    {step.step}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {step.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
