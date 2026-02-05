/**
 * Workflow Next Steps
 * Clear action buttons showing what to do after workflow is generated
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Play, Edit, Save, Zap, FileText, CheckCircle2, Eye, Trash2
} from 'lucide-react';

interface WorkflowNextStepsProps {
  workflowId: string;
  campaignName: string;
  onPreview?: () => void;
  onCustomize?: () => void;
  onExecute?: () => void;
  onSaveTemplate?: () => void;
  onTestFirst?: () => void;
  onApply?: () => void;
}

export function WorkflowNextSteps({
  workflowId,
  campaignName,
  onPreview,
  onCustomize,
  onExecute,
  onSaveTemplate,
  onTestFirst,
  onApply,
}: WorkflowNextStepsProps) {
  return (
    <Card className="border-2 border-green-500 bg-green-50 dark:bg-green-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          ✅ Workflow Built! What's Next?
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary Actions - Most Important */}
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            👉 Ready to go:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button
              onClick={onExecute}
              className="gap-2 bg-green-600 hover:bg-green-700"
              data-testid="button-execute-workflow"
            >
              <Play className="h-4 w-4" />
              Execute Now
            </Button>
            <Button
              onClick={onTestFirst}
              variant="outline"
              className="gap-2"
              data-testid="button-test-workflow"
            >
              <Eye className="h-4 w-4" />
              Test First (5 contacts)
            </Button>
          </div>
        </div>

        {/* Secondary Actions - Optional */}
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            🛠️ Customize & Save:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Button
              onClick={onPreview}
              variant="outline"
              className="gap-2"
              data-testid="button-preview-workflow"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button
              onClick={onCustomize}
              variant="outline"
              className="gap-2"
              data-testid="button-customize-workflow"
            >
              <Edit className="h-4 w-4" />
              Edit Messages
            </Button>
            <Button
              onClick={onSaveTemplate}
              variant="outline"
              className="gap-2"
              data-testid="button-save-template"
            >
              <Save className="h-4 w-4" />
              Save Template
            </Button>
          </div>
        </div>

        {/* Explanation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t border-green-200 dark:border-green-800">
          <div className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1">
              ⚡ Execute Now
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Launch the workflow immediately to all {campaignName} contacts
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1">
              👁️ Test First
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Send to 5 sample contacts first to verify everything works
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1">
              🎯 Preview
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              See the visual workflow diagram with all channels & timing
            </p>
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-slate-900 dark:text-white mb-1">
              ✏️ Edit
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Customize message content, timing, and channel sequence
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            💡 <strong>Tip:</strong> Start with "Test First" to verify everything works, then "Execute Now" when ready.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
