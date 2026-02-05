import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Mail, Linkedin, MessageSquare, Phone, Voicemail,
  Edit, Copy, Trash2, GripVertical, Clock, Plus,
  Save, X, ChevronDown, ChevronUp, Sparkles, Play, RotateCcw,
  GitBranch, Loader2, AlertCircle, CheckCircle, Eye, MousePointer, Reply,
  Workflow, Maximize2
} from 'lucide-react';
import { useCampaignDraft, CampaignStep, BranchCondition } from '@/contexts/CampaignDraftContext';
import { CampaignWorkflowVisual } from './campaign-workflow-visual';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const CHANNEL_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  email: { icon: Mail, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900' },
  linkedin: { icon: Linkedin, color: 'text-blue-800', bg: 'bg-blue-200 dark:bg-blue-800' },
  sms: { icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900' },
  phone: { icon: Phone, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900' },
  voicemail: { icon: Voicemail, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900' },
};

interface StepEditorProps {
  step: CampaignStep;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<CampaignStep>) => void;
}

function StepEditor({ step, open, onClose, onSave }: StepEditorProps) {
  const [subject, setSubject] = useState(step.subject || '');
  const [content, setContent] = useState(step.content);
  const [delay, setDelay] = useState(step.delay);

  const handleSave = () => {
    onSave({ subject, content, delay });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit Step: {step.label}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {step.channel === 'email' && (
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Subject Line</label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Email subject..."
                className="mt-1"
                data-testid="input-step-subject"
              />
            </div>
          )}
          
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Message Content</label>
            <Textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Your message..."
              rows={8}
              className="mt-1"
              data-testid="input-step-content"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Wait Before Sending</label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="number"
                value={delay}
                onChange={e => setDelay(parseInt(e.target.value) || 0)}
                className="w-20"
                min={0}
                data-testid="input-step-delay"
              />
              <span className="text-sm text-slate-500">days after previous step</span>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose} data-testid="btn-cancel-edit">
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="btn-save-step">
              <Save className="w-4 h-4 mr-1" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface CampaignLivePreviewProps {
  onActivate?: () => void;
  showActivateButton?: boolean;
}

const BRANCH_ICONS: Record<string, any> = {
  if_opened: Eye,
  if_clicked: MousePointer,
  if_replied: Reply,
  if_connected: CheckCircle,
  if_no_response: AlertCircle,
  if_opened_not_replied: Eye,
  if_meeting_booked: CheckCircle,
};

const BRANCH_LABELS: Record<string, string> = {
  if_opened: 'If Opened',
  if_clicked: 'If Clicked',
  if_replied: 'If Replied',
  if_connected: 'If Connected',
  if_no_response: 'No Response',
  if_opened_not_replied: 'Opened, Not Replied',
  if_meeting_booked: 'Meeting Booked',
};

const ACTION_LABELS: Record<string, string> = {
  proceed_to_next: 'Continue to next step',
  skip_to_step: 'Skip to step',
  try_different_channel: 'Try different channel',
  move_to_pipeline: 'Move to pipeline',
  end_sequence: 'End sequence',
};

export function CampaignLivePreview({ onActivate, showActivateButton = true }: CampaignLivePreviewProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { draft, updateStep, removeStep, duplicateStep, addStep, updateDraft, resetDraft, isGenerating } = useCampaignDraft();
  const [editingStep, setEditingStep] = useState<CampaignStep | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [showVisualWorkflow, setShowVisualWorkflow] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [savedCampaignDbId, setSavedCampaignDbId] = useState<string | null>(null);
  
  const saveCampaignMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const campaignData = {
        name: draft.name || 'Untitled Campaign',
        description: `AI-generated ${draft.steps.length}-step multichannel campaign`,
        type: 'multi-channel',
        status: 'draft',
        channels: draft.channels,
        messages: [],
        steps: draft.steps.map((step, index) => ({
          order: index + 1,
          channel: step.channel,
          label: step.label,
          subject: step.subject || null,
          content: step.content,
          delay: step.delay,
          delay_unit: step.delayUnit || 'days',
          branches: step.branches || [],
        })),
        settings: {
          conditionalLogic: draft.conditionalLogic,
          generatedBySophia: true,
        },
      };
      
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify(campaignData),
        headers: { 
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save campaign');
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      setIsSaved(true);
      if (data?.id) {
        setSavedCampaignDbId(data.id);
        updateDraft({ id: data.id });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({
        title: 'Campaign Saved!',
        description: data?.id 
          ? `Campaign "${draft.name}" saved successfully.`
          : 'Your campaign has been saved and can be found on the Campaigns page.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Could not save the campaign. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Reset saved state when draft changes significantly (not just after we saved it)
  const prevDraftRef = useRef<string>('');
  useEffect(() => {
    const draftHash = JSON.stringify({ name: draft.name, stepsCount: draft.steps.length, channels: draft.channels });
    if (prevDraftRef.current && prevDraftRef.current !== draftHash && !savedCampaignDbId) {
      setIsSaved(false);
    }
    prevDraftRef.current = draftHash;
  }, [draft.name, draft.steps.length, draft.channels, savedCampaignDbId]);
  
  // If draft already has an ID (from database), mark as saved
  useEffect(() => {
    if (draft.id && !savedCampaignDbId) {
      setSavedCampaignDbId(draft.id);
      setIsSaved(true);
    }
  }, [draft.id, savedCampaignDbId]);

  const toggleExpand = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const handleAddStep = () => {
    const lastStep = draft.steps[draft.steps.length - 1];
    const nextChannel = lastStep 
      ? draft.channels[(draft.channels.indexOf(lastStep.channel) + 1) % draft.channels.length]
      : draft.channels[0] || 'email';
    
    addStep({
      channel: nextChannel as CampaignStep['channel'],
      label: `Step ${draft.steps.length + 1}`,
      content: 'New message content...',
      delay: 2,
      delayUnit: 'days',
    });
  };

  if (isGenerating) {
    return (
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
              <Sparkles className="w-5 h-5 text-purple-600 absolute -top-1 -right-1 animate-pulse" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
              Sophia is writing your campaign...
            </h3>
            <p className="mt-2 text-sm text-slate-500 max-w-sm">
              Generating personalized content with intelligent branching logic for maximum engagement.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              AI Content Generation in Progress
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (draft.steps.length === 0) {
    return null;
  }

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI-Generated Campaign
            <Badge variant="secondary" className="ml-2">
              {draft.steps.length} steps
            </Badge>
            {draft.conditionalLogic && (
              <Badge variant="outline" className="ml-1 text-xs bg-amber-50 text-amber-700 border-amber-200">
                <GitBranch className="w-3 h-3 mr-1" />
                Smart Routing
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setShowVisualWorkflow(true)}
              data-testid="btn-view-workflow"
            >
              <Workflow className="w-4 h-4 mr-1" />
              View Flow
            </Button>
            
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate('/workflow-builder')}
              data-testid="btn-open-full-editor"
            >
              <Maximize2 className="w-4 h-4 mr-1" />
              Workflow Builder
            </Button>
            
            <Button 
              variant="outline"
              size="sm"
              onClick={resetDraft}
              data-testid="btn-reset-campaign"
            >
              <RotateCcw className="w-4 h-4 mr-1" />
              Start Over
            </Button>
            
            <Button 
              variant="outline"
              size="sm"
              onClick={() => saveCampaignMutation.mutate()}
              disabled={saveCampaignMutation.isPending || isSaved}
              className={isSaved ? 'text-green-600 border-green-300' : ''}
              data-testid="btn-save-campaign"
            >
              {saveCampaignMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : isSaved ? (
                <CheckCircle className="w-4 h-4 mr-1" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              {isSaved ? 'Saved' : 'Save Campaign'}
            </Button>
            
            {showActivateButton && (
              <Button 
                onClick={onActivate}
                className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                data-testid="btn-activate-campaign"
              >
                <Play className="w-4 h-4 mr-1" />
                Activate
              </Button>
            )}
          </div>
        </div>
        
        <Input
          value={draft.name}
          onChange={e => updateDraft({ name: e.target.value })}
          placeholder="Name your campaign..."
          className="mt-2 font-medium"
          data-testid="input-campaign-name"
        />
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {draft.steps.map((step, index) => {
              const config = CHANNEL_CONFIG[step.channel] || CHANNEL_CONFIG.email;
              const Icon = config.icon;
              const isExpanded = expandedSteps.has(step.id);
              
              return (
                <div key={step.id} className="relative">
                  {index > 0 && (
                    <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>Wait {step.delay} {step.delayUnit}</span>
                      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-700" />
                    </div>
                  )}
                  
                  <Card 
                    className={`transition-all ${isExpanded ? 'ring-2 ring-purple-300' : 'hover:shadow-md'}`}
                    data-testid={`card-step-${index}`}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="cursor-move text-slate-400 hover:text-slate-600 pt-1">
                          <GripVertical className="w-4 h-4" />
                        </div>
                        
                        <div className={`p-2 rounded-lg ${config.bg}`}>
                          <Icon className={`w-4 h-4 ${config.color}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 dark:text-white">
                              Step {index + 1}: {step.channel.charAt(0).toUpperCase() + step.channel.slice(1)}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {step.label}
                            </Badge>
                          </div>
                          
                          {step.subject && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 truncate">
                              Subject: {step.subject}
                            </p>
                          )}
                          
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {step.content}
                          </p>
                          
                          {isExpanded && (
                            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                {step.content}
                              </pre>
                            </div>
                          )}
                          
                          {step.branches && step.branches.length > 0 && (
                            <div className="mt-3 border-t pt-3 border-slate-100 dark:border-slate-700">
                              <div className="flex items-center gap-1 mb-2">
                                <GitBranch className="w-3 h-3 text-amber-600" />
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                  Smart Routing Rules
                                </span>
                              </div>
                              <div className="space-y-1">
                                {step.branches.map((branch, branchIndex) => {
                                  const BranchIcon = BRANCH_ICONS[branch.condition] || AlertCircle;
                                  return (
                                    <div 
                                      key={branchIndex}
                                      className="flex items-center gap-2 text-xs bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded"
                                    >
                                      <BranchIcon className="w-3 h-3 text-amber-600" />
                                      <span className="font-medium text-amber-700 dark:text-amber-400">
                                        {BRANCH_LABELS[branch.condition] || branch.condition}:
                                      </span>
                                      <span className="text-amber-600 dark:text-amber-300">
                                        {ACTION_LABELS[branch.action] || branch.action}
                                        {branch.waitDays && ` (${branch.waitDays}d)`}
                                        {branch.nextChannel && ` → ${branch.nextChannel}`}
                                        {branch.pipelineStage && ` → ${branch.pipelineStage}`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(step.id)}
                            data-testid={`btn-expand-step-${index}`}
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingStep(step)}
                            data-testid={`btn-edit-step-${index}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateStep(step.id)}
                            data-testid={`btn-duplicate-step-${index}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeStep(step.id)}
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            data-testid={`btn-delete-step-${index}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
            
            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={handleAddStep}
              data-testid="btn-add-step"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
          </div>
        </ScrollArea>
      </CardContent>
      
      {editingStep && (
        <StepEditor
          step={editingStep}
          open={!!editingStep}
          onClose={() => setEditingStep(null)}
          onSave={(updates) => updateStep(editingStep.id, updates)}
        />
      )}
      
      <CampaignWorkflowVisual 
        open={showVisualWorkflow} 
        onClose={() => setShowVisualWorkflow(false)} 
      />
    </Card>
  );
}
