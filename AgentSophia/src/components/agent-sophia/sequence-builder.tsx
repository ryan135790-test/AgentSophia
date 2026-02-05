import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Clock, Zap } from 'lucide-react';

interface SequenceStep {
  id: string;
  type: 'email' | 'sms' | 'linkedin' | 'wait';
  subject?: string;
  body?: string;
  delay_days?: number;
  content: string;
}

interface SequenceBuilderProps {
  onSave?: (steps: SequenceStep[]) => void;
}

export function SequenceBuilder({ onSave }: SequenceBuilderProps) {
  const [steps, setSteps] = useState<SequenceStep[]>([
    { id: '1', type: 'email', subject: 'Initial outreach', content: 'Hi {{name}}...', delay_days: 0 }
  ]);

  const addStep = (type: 'email' | 'sms' | 'linkedin' | 'wait') => {
    setSteps([...steps, { id: Date.now().toString(), type, content: '', delay_days: 1 }]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const typeIcons: Record<string, string> = {
    email: '📧',
    sms: '💬',
    linkedin: '🔗',
    wait: '⏳'
  };

  return (
    <div className="space-y-4">
      {/* Timeline */}
      <div className="relative">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex gap-4 mb-4">
            {/* Timeline Dot */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg">
                {typeIcons[step.type]}
              </div>
              {idx < steps.length - 1 && <div className="w-1 h-12 bg-blue-300 dark:bg-blue-700 my-1" />}
            </div>

            {/* Step Card */}
            <Card className="flex-1 p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white capitalize">
                    Step {idx + 1}: {step.type}
                  </p>
                  {step.delay_days !== undefined && step.delay_days > 0 && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      Send after {step.delay_days} day{step.delay_days > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeStep(step.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {step.type === 'email' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    defaultValue={step.subject}
                    placeholder="Email subject"
                    className="w-full p-2 text-sm rounded border border-slate-300 dark:border-slate-600"
                  />
                  <textarea
                    defaultValue={step.body}
                    placeholder="Email body"
                    className="w-full p-2 text-sm rounded border border-slate-300 dark:border-slate-600 h-20"
                  />
                </div>
              )}

              {step.type === 'wait' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Wait duration (days)</label>
                  <input
                    type="number"
                    defaultValue={step.delay_days}
                    className="w-full p-2 text-sm rounded border border-slate-300 dark:border-slate-600"
                  />
                </div>
              )}

              <p className="text-xs text-slate-500 mt-2">Available variables: {{name}}, {{company}}, {{title}}, {{email}}</p>
            </Card>
          </div>
        ))}
      </div>

      {/* Add Step Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => addStep('email')} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Email
        </Button>
        <Button onClick={() => addStep('wait')} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Wait
        </Button>
        <Button onClick={() => addStep('linkedin')} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add LinkedIn
        </Button>
        <Button onClick={() => addStep('sms')} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add SMS
        </Button>
      </div>

      {/* AI Suggestions */}
      <Card className="p-3 bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
        <p className="text-xs font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Sophia's Optimization
        </p>
        <p className="text-xs text-purple-800 dark:text-purple-400 mt-1">
          Moving the "Let's chat" CTA earlier (step 2) could increase reply rates by 18%. Add wait period after initial email.
        </p>
      </Card>

      {/* Save */}
      <div className="flex gap-2 justify-end">
        <Button variant="outline">Preview</Button>
        <Button onClick={() => onSave?.(steps)}>Save Sequence</Button>
      </div>
    </div>
  );
}
