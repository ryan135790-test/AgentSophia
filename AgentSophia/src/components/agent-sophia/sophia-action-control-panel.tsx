/**
 * Enhanced Sophia Action Control Panel
 * UI for approving, customizing, and executing autonomous actions
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertCircle, CheckCircle2, Zap, X, Loader2, RotateCcw,
  MessageSquare, Tag, Users, Clock, Phone, Lightbulb
} from 'lucide-react';
import { executeIntentActions } from '@/lib/action-executor-client';
import type { IntentType } from '@/lib/action-executor-client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActionControlPanelProps {
  leadId: string;
  messageId: string;
  intent: IntentType;
  confidence: number;
  onClose?: () => void;
  consensusData?: {
    agreement: boolean;
    claudeConfidence?: number;
    gpt4oConfidence?: number;
  };
}

interface ActionItem {
  id: string;
  action: string;
  label: string;
  description: string;
  icon: any;
  enabled: boolean;
}

interface ExecutionResult {
  action: string;
  success: boolean;
  message: string;
  details?: any;
  timestamp: number;
}

export function SophiaActionControlPanel({
  leadId,
  messageId,
  intent,
  confidence,
  onClose,
  consensusData
}: ActionControlPanelProps) {
  const [executing, setExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [results, setResults] = useState<ExecutionResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState(false);

  const actionDescriptions: Record<string, string> = {
    send_reply: 'Send an automated reply to this prospect across their preferred channel',
    tag_lead: 'Tag and score this lead based on their engagement and intent signals',
    route_to_sales: 'Route this prospect to your sales team for immediate follow-up',
    schedule_followup: 'Schedule an automatic follow-up task to continue engagement',
    book_meeting: 'Find available time slots and book a meeting automatically'
  };

  const actionIcons: Record<string, any> = {
    send_reply: MessageSquare,
    tag_lead: Tag,
    route_to_sales: Users,
    schedule_followup: Clock,
    book_meeting: Phone
  };

  const getIntentLabel = (intent: IntentType) => {
    const labels: Record<IntentType, string> = {
      interested: '✅ Interested in Solution',
      not_interested: '❌ Not Interested',
      meeting_request: '📅 Meeting Request',
      information_needed: '❓ Needs Information',
      price_inquiry: '💰 Price Inquiry',
      follow_up_needed: '⏰ Needs Follow-up',
      meeting_scheduled: '✓ Meeting Scheduled'
    };
    return labels[intent];
  };

  const getIntentColor = (intent: IntentType) => {
    const colors: Record<IntentType, string> = {
      interested: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
      not_interested: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
      meeting_request: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
      information_needed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
      price_inquiry: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
      follow_up_needed: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
      meeting_scheduled: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-100'
    };
    return colors[intent];
  };

  const getRecommendedActions = (intent: IntentType): string[] => {
    const actionMap: Record<IntentType, string[]> = {
      interested: ['send_reply', 'tag_lead', 'route_to_sales'],
      not_interested: ['send_reply', 'tag_lead'],
      meeting_request: ['send_reply', 'route_to_sales', 'tag_lead'],
      information_needed: ['send_reply', 'tag_lead'],
      price_inquiry: ['send_reply', 'tag_lead'],
      follow_up_needed: ['schedule_followup', 'tag_lead'],
      meeting_scheduled: ['send_reply', 'tag_lead', 'route_to_sales']
    };
    return actionMap[intent] || [];
  };

  const [actions, setActions] = useState<ActionItem[]>(() => {
    const recommended = getRecommendedActions(intent);
    return recommended.map(actionId => ({
      id: actionId,
      action: actionId,
      label: {
        send_reply: '📧 Send Auto-Reply',
        tag_lead: '🏷️ Tag Lead',
        route_to_sales: '👥 Route to Sales',
        schedule_followup: '📅 Schedule Follow-up',
        book_meeting: '📞 Book Meeting'
      }[actionId] || actionId,
      description: actionDescriptions[actionId] || '',
      icon: actionIcons[actionId] || Lightbulb,
      enabled: true
    }));
  });

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    setResults([]);

    try {
      const selectedActions = actions.filter(a => a.enabled).map(a => a.action);
      
      if (selectedActions.length === 0) {
        setError('Please select at least one action to execute');
        setExecuting(false);
        return;
      }

      const result = await executeIntentActions(leadId, messageId, intent, selectedActions);
      const executionResults = (result.results || []).map((r: any, idx: number) => ({
        ...r,
        timestamp: Date.now() + (idx * 100)
      }));
      
      setResults(executionResults);
      setExecutionProgress(100);
    } catch (err: any) {
      setError(err.message || 'Failed to execute actions');
    } finally {
      setExecuting(false);
    }
  };

  const handleUndo = () => {
    setUndone(true);
    setResults(null);
    setExecutionProgress(0);
  };

  const toggleAction = (actionId: string) => {
    setActions(actions.map(a => 
      a.id === actionId ? { ...a, enabled: !a.enabled } : a
    ));
  };

  const enableAll = () => {
    setActions(actions.map(a => ({ ...a, enabled: true })));
  };

  const disableAll = () => {
    setActions(actions.map(a => ({ ...a, enabled: false })));
  };

  if (results) {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return (
      <Card className={`border-2 ${successCount > 0 && failureCount === 0 ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {failureCount === 0 ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Actions Executed Successfully
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  Actions Executed ({successCount} succeeded, {failureCount} failed)
                </>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScrollArea className="h-64">
            <div className="space-y-2 pr-4">
              {results.map((result, idx) => (
                <div key={idx} className={`p-3 rounded-lg border flex items-start gap-3 ${
                  result.success
                    ? 'bg-white dark:bg-slate-800 border-green-200 dark:border-green-800'
                    : 'bg-white dark:bg-slate-800 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex-shrink-0 mt-0.5">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {actions.find(a => a.action === result.action)?.label || result.action}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{result.message}</p>
                    {result.details && (
                      <details className="text-xs mt-2 p-2 bg-slate-100 dark:bg-slate-900 rounded">
                        <summary className="cursor-pointer font-medium">Details</summary>
                        <pre className="mt-1 overflow-auto max-h-32">
                          {JSON.stringify(result.details, null, 2)}
                        </pre>
                      </details>
                    )}
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-2 border-t">
            <Button
              onClick={handleUndo}
              disabled={undone}
              variant="outline"
              className="flex-1 gap-2"
              data-testid="button-undo-actions"
            >
              <RotateCcw className="h-4 w-4" />
              {undone ? 'Undone' : 'Undo'}
            </Button>
            {onClose && (
              <Button onClick={onClose} data-testid="button-close-results">
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const enabledCount = actions.filter(a => a.enabled).length;

  return (
    <Card className="border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/20 dark:to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-600" />
          Sophia Autonomous Actions
        </CardTitle>
        <CardDescription>Customize and execute recommended actions for this lead</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Intent Detection with Multi-Model Consensus */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Intent Detected</span>
            <Badge className={getIntentColor(intent)}>
              {(confidence * 100).toFixed(0)}% confident
            </Badge>
          </div>
          <p className="font-semibold text-base text-slate-900 dark:text-slate-100">{getIntentLabel(intent)}</p>
          
          {/* Multi-Model Consensus Display */}
          {consensusData && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-2 w-2 bg-blue-500 rounded-full" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {consensusData.agreement ? '✅ Multi-Model Agreement' : '⚠️ Models Diverged'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <p className="font-medium">Claude: {consensusData.claudeConfidence || 0}%</p>
                </div>
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <p className="font-medium">GPT-4o: {consensusData.gpt4oConfidence || 0}%</p>
                </div>
              </div>
            </div>
          )}
          
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Based on AI analysis {consensusData?.agreement ? 'with model consensus' : 'across multiple models'}
          </p>
        </div>

        {/* Actions Selection */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Select Actions ({enabledCount}/{actions.length})
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={enableAll}
                className="text-xs"
                data-testid="button-enable-all"
              >
                All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={disableAll}
                className="text-xs"
                data-testid="button-disable-all"
              >
                None
              </Button>
            </div>
          </div>

          <ScrollArea className="h-48 pr-4">
            <div className="space-y-3">
              {actions.map((actionItem) => (
                <TooltipProvider key={actionItem.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="p-3 bg-white dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                        onClick={() => toggleAction(actionItem.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={actionItem.enabled}
                            onChange={() => toggleAction(actionItem.id)}
                            data-testid={`checkbox-action-${actionItem.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                              {actionItem.label}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {actionItem.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{actionItem.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Progress Bar */}
        {executing && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Executing {enabledCount} action{enabledCount !== 1 ? 's' : ''}...
            </p>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300"
                style={{ width: `${executionProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm font-medium text-red-800 dark:text-red-200 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <Button
            onClick={handleExecute}
            disabled={executing || enabledCount === 0}
            className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
            data-testid="button-execute-actions"
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Execute {enabledCount > 0 ? `(${enabledCount})` : ''}
              </>
            )}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-actions">
              Cancel
            </Button>
          )}
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          ✨ Sophia will execute selected actions automatically based on detected intent.
        </p>
      </CardContent>
    </Card>
  );
}
