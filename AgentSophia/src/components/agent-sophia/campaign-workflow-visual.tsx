import { useCallback, useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  Position,
  MarkerType,
  Handle,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Mail, Linkedin, MessageSquare, Phone, Voicemail,
  GitBranch, Eye, MousePointer, Reply, CheckCircle, AlertCircle,
  ArrowRight, Clock, X, Trash2, GripVertical, Pencil, Save,
  ChevronUp, ChevronDown, Sparkles, Star, Bot, Plus, Play, UserPlus,
  UserCheck, ThumbsUp, Users, Send, MessageCircle, Zap, Target,
  BarChart3, TrendingUp
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCampaignDraft, CampaignStep, BranchCondition, ContentVariation } from '@/contexts/CampaignDraftContext';
import { useToast } from '@/hooks/use-toast';

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  sms: MessageSquare,
  phone: Phone,
  voicemail: Voicemail,
  condition: GitBranch,
  delay: Clock,
};

const CHANNEL_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string; iconBg: string }> = {
  email: { bg: 'bg-white', border: 'border-slate-200', text: 'text-blue-600', gradient: 'from-blue-500 to-blue-600', iconBg: 'bg-blue-500' },
  linkedin: { bg: 'bg-white', border: 'border-slate-200', text: 'text-sky-600', gradient: 'from-sky-500 to-blue-600', iconBg: 'bg-sky-500' },
  sms: { bg: 'bg-white', border: 'border-slate-200', text: 'text-emerald-600', gradient: 'from-emerald-500 to-green-600', iconBg: 'bg-emerald-500' },
  phone: { bg: 'bg-white', border: 'border-slate-200', text: 'text-violet-600', gradient: 'from-violet-500 to-purple-600', iconBg: 'bg-violet-500' },
  voicemail: { bg: 'bg-white', border: 'border-slate-200', text: 'text-orange-600', gradient: 'from-amber-500 to-orange-600', iconBg: 'bg-orange-500' },
  condition: { bg: 'bg-white', border: 'border-slate-200', text: 'text-indigo-600', gradient: 'from-indigo-500 to-purple-600', iconBg: 'bg-indigo-500' },
  delay: { bg: 'bg-white', border: 'border-slate-200', text: 'text-slate-600', gradient: 'from-slate-500 to-slate-600', iconBg: 'bg-slate-500' },
};

const CONDITION_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  if_opened: { label: 'Opened', icon: Eye, color: 'text-green-600' },
  if_clicked: { label: 'Clicked', icon: MousePointer, color: 'text-blue-600' },
  if_replied: { label: 'Replied', icon: Reply, color: 'text-emerald-600' },
  if_connected: { label: 'Connected', icon: CheckCircle, color: 'text-teal-600' },
  if_no_response: { label: 'No Response', icon: AlertCircle, color: 'text-amber-600' },
  if_opened_not_replied: { label: 'Opened, No Reply', icon: Eye, color: 'text-yellow-600' },
  if_meeting_booked: { label: 'Meeting Booked', icon: CheckCircle, color: 'text-purple-600' },
};

const ACTION_PALETTE = [
  { 
    category: 'Messages',
    actions: [
      { type: 'email', label: 'Send Email', icon: Mail, color: 'from-blue-500 to-indigo-600', description: 'Send personalized email' },
      { type: 'linkedin', label: 'LinkedIn Message', icon: MessageCircle, color: 'from-sky-500 to-blue-600', description: 'Send LinkedIn DM' },
      { type: 'sms', label: 'Send SMS', icon: MessageSquare, color: 'from-emerald-500 to-green-600', description: 'Text message' },
    ]
  },
  { 
    category: 'LinkedIn Actions',
    actions: [
      { type: 'linkedin_connect', label: 'Connection Request', icon: UserPlus, color: 'from-sky-500 to-blue-600', description: 'Send connection' },
      { type: 'linkedin_view', label: 'View Profile', icon: Eye, color: 'from-sky-400 to-blue-500', description: 'Visit their profile' },
      { type: 'linkedin_follow', label: 'Follow', icon: UserCheck, color: 'from-sky-500 to-cyan-600', description: 'Follow their activity' },
      { type: 'linkedin_like', label: 'Like Post', icon: ThumbsUp, color: 'from-blue-500 to-sky-600', description: 'Engage with content' },
    ]
  },
  { 
    category: 'Calls',
    actions: [
      { type: 'phone', label: 'Phone Call', icon: Phone, color: 'from-violet-500 to-purple-600', description: 'Schedule call task' },
      { type: 'voicemail', label: 'Voicemail Drop', icon: Voicemail, color: 'from-amber-500 to-orange-600', description: 'Leave voicemail' },
    ]
  },
  { 
    category: 'Flow Control',
    actions: [
      { type: 'delay', label: 'Wait / Delay', icon: Clock, color: 'from-slate-500 to-slate-700', description: 'Pause sequence' },
      { type: 'condition', label: 'If/Then Branch', icon: GitBranch, color: 'from-amber-500 to-orange-600', description: 'Conditional logic' },
    ]
  }
];

function StartNode({ data }: { data: { contactCount: number; campaignName?: string } }) {
  return (
    <div className="w-[240px] bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="p-4 text-center">
        <div className="w-12 h-12 mx-auto rounded-xl bg-emerald-500 flex items-center justify-center mb-3">
          <Play className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-800">Campaign Start</p>
        <p className="text-xs text-slate-500 mt-0.5">{data.campaignName || 'Untitled Campaign'}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-xs font-medium text-slate-600">{data.contactCount || 0} contacts</span>
        </div>
      </div>
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
    </div>
  );
}

function AddStepNode({ data }: { data: { onAdd: (afterIndex: number) => void; afterIndex: number } }) {
  return (
    <div 
      className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-150"
      onClick={() => data.onAdd(data.afterIndex)}
      data-testid={`btn-add-step-${data.afterIndex}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Plus className="w-4 h-4 text-slate-400 hover:text-indigo-500" />
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
}

interface StepMetrics {
  sent: number;
  opened: number;
  replied: number;
  openRate: number;
  replyRate: number;
}

interface StepNodeData {
  step: CampaignStep;
  stepIndex: number;
  isSelected: boolean;
  onSelect: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  totalSteps: number;
  metrics?: StepMetrics;
}

function StepNode({ data }: { data: StepNodeData }) {
  const { step, stepIndex, isSelected, onSelect, onDelete, onMoveUp, onMoveDown, totalSteps, metrics } = data;
  const colors = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.email;
  const Icon = CHANNEL_ICONS[step.channel] || Mail;
  
  return (
    <div 
      className={`w-[280px] bg-white rounded-2xl border shadow-sm cursor-pointer transition-all duration-200 group ${
        isSelected 
          ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-lg' 
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
      onClick={() => onSelect(step.id)}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {step.channel.charAt(0).toUpperCase() + step.channel.slice(1)}
              </p>
              <p className="text-xs text-slate-500">{step.label}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              onClick={(e) => { e.stopPropagation(); onMoveUp(stepIndex); }}
              disabled={stepIndex === 0}
              data-testid={`btn-move-up-${step.id}`}
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              onClick={(e) => { e.stopPropagation(); onMoveDown(stepIndex); }}
              disabled={stepIndex === totalSteps - 1}
              data-testid={`btn-move-down-${step.id}`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
              onClick={(e) => { e.stopPropagation(); onDelete(step.id); }}
              data-testid={`btn-delete-step-${step.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {step.subject && (
          <div className="mb-2 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-700 truncate font-medium">
              {step.subject}
            </p>
          </div>
        )}
        
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
          {step.content.substring(0, 80)}...
        </p>
        
        {step.variations && step.variations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Bot className="w-3.5 h-3.5" />
              <span className="font-medium">{step.variations.length} versions</span>
            </div>
            {step.selectedVariationId && (
              <Badge variant="secondary" className="text-[10px] h-5 px-2 bg-indigo-50 text-indigo-700">
                {step.variations.find(v => v.id === step.selectedVariationId)?.version || 'A'}
              </Badge>
            )}
            {!step.selectedVariationId && step.variations.some(v => v.isRecommended) && (
              <Badge className="text-[10px] h-5 px-2 bg-indigo-500 text-white">
                <Sparkles className="w-2.5 h-2.5 mr-1" />
                AI Pick
              </Badge>
            )}
          </div>
        )}

        {step.branches && step.branches.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs text-indigo-600 px-2 py-1.5 bg-indigo-50 rounded-lg">
              <GitBranch className="w-3.5 h-3.5" />
              <span className="font-medium">{step.branches.length} routing rules</span>
            </div>
          </div>
        )}
        
        {metrics && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1 text-slate-500">
                <Send className="w-3 h-3" />
                <span className="font-medium">{metrics.sent}</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600">
                <Eye className="w-3 h-3" />
                <span className="font-medium">{metrics.openRate}%</span>
              </div>
              <div className="flex items-center gap-1 text-blue-600">
                <Reply className="w-3 h-3" />
                <span className="font-medium">{metrics.replyRate}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
    </div>
  );
}

function BranchNode({ data }: { data: { branch: BranchCondition } }) {
  const branch = data.branch;
  const conditionInfo = CONDITION_LABELS[branch.condition] || CONDITION_LABELS.if_no_response;
  const Icon = conditionInfo.icon;
  
  return (
    <div className="w-[160px] bg-white rounded-2xl border border-slate-200 shadow-sm transition-all duration-150 hover:shadow-md">
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
      
      <div className="p-3 text-center">
        <div className="w-8 h-8 mx-auto rounded-lg bg-indigo-500 flex items-center justify-center mb-2">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          {conditionInfo.label}
        </p>
        {branch.waitDays && (
          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-600">{branch.waitDays}d</span>
          </div>
        )}
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
    </div>
  );
}

function WaitNode({ data }: { data: { delay: number; delayUnit: string } }) {
  return (
    <div className="w-[140px] bg-white rounded-2xl border border-slate-200 shadow-sm transition-all duration-150 hover:shadow-md">
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
      
      <div className="p-3 text-center">
        <div className="w-8 h-8 mx-auto rounded-lg bg-slate-500 flex items-center justify-center mb-2">
          <Clock className="w-4 h-4 text-white" />
        </div>
        <p className="text-sm font-semibold text-slate-700">
          Wait {data.delay} {data.delayUnit}
        </p>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom} 
        className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
    </div>
  );
}

interface ConditionNodeData {
  step: CampaignStep;
  stepIndex: number;
  isSelected: boolean;
  onSelect: (stepId: string) => void;
  onDelete: (stepId: string) => void;
}

function ConditionNode({ data }: { data: ConditionNodeData }) {
  const { step, stepIndex, isSelected, onSelect, onDelete } = data;
  const conditionType = step.conditionType || 'if_opened';
  const conditionInfo = CONDITION_LABELS[conditionType] || CONDITION_LABELS.if_opened;
  const ConditionIcon = conditionInfo.icon;
  
  const sophiaRec = step.sophiaRecommendation;
  
  return (
    <div 
      className={`w-[300px] bg-white rounded-2xl border shadow-sm cursor-pointer transition-all duration-200 group ${
        isSelected 
          ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-lg' 
          : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
      }`}
      onClick={() => onSelect(step.id)}
      data-testid={`node-condition-${step.id}`}
    >
      <Handle 
        type="target" 
        position={Position.Top} 
        className="!bg-indigo-500 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Condition</p>
              <div className="flex items-center gap-1.5">
                <ConditionIcon className="w-3 h-3 text-slate-500" />
                <p className="text-xs text-slate-500">{conditionInfo.label}</p>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onDelete(step.id); }}
            data-testid={`btn-delete-condition-${step.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Sophia Recommendation */}
      {sophiaRec && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
              <Bot className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-medium text-indigo-700">Sophia's Insight</span>
            <span className="text-[10px] text-indigo-500 ml-auto">{Math.round(sophiaRec.confidence * 100)}%</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
            {sophiaRec.reasoning}
          </p>
        </div>
      )}
      
      {/* Branch Options */}
      <div className="p-4 pt-3">
        <div className="flex gap-2">
          <div className={`flex-1 p-3 rounded-xl transition-all ${
            sophiaRec?.suggestedPath === 'yes' 
              ? 'bg-emerald-50 border-2 border-emerald-300' 
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-semibold text-emerald-700">Yes</span>
            </div>
            {sophiaRec?.suggestedPath === 'yes' && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span className="text-[10px] font-medium text-indigo-600">Recommended</span>
              </div>
            )}
          </div>
          
          <div className={`flex-1 p-3 rounded-xl transition-all ${
            sophiaRec?.suggestedPath === 'no' 
              ? 'bg-rose-50 border-2 border-rose-300' 
              : 'bg-slate-50 border border-slate-200'
          }`}>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center">
                <X className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-semibold text-rose-700">No</span>
            </div>
            {sophiaRec?.suggestedPath === 'no' && (
              <div className="flex items-center justify-center gap-1 mt-1.5">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span className="text-[10px] font-medium text-indigo-600">Recommended</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <Handle 
        type="source" 
        position={Position.Bottom}
        id="yes"
        style={{ left: '25%' }}
        className="!bg-emerald-500 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
      <Handle 
        type="source" 
        position={Position.Bottom}
        id="no"
        style={{ left: '75%' }}
        className="!bg-rose-500 !w-3 !h-3 !border-2 !border-white !shadow-sm" 
      />
    </div>
  );
}

const nodeTypes = {
  step: StepNode,
  branch: BranchNode,
  wait: WaitNode,
  start: StartNode,
  addStep: AddStepNode,
  condition: ConditionNode,
};

interface StepEditorPanelProps {
  step: CampaignStep;
  onUpdate: (updates: Partial<CampaignStep>) => void;
  onClose: () => void;
  onSelectVariation?: (variationId: string) => void;
}

function StepEditorPanel({ step, onUpdate, onClose, onSelectVariation }: StepEditorPanelProps) {
  const [editedStep, setEditedStep] = useState<Partial<CampaignStep>>({
    subject: step.subject || '',
    content: step.content,
    delay: step.delay,
    delayUnit: step.delayUnit,
    label: step.label,
    channel: step.channel,
  });
  const [showVariations, setShowVariations] = useState(true);
  
  // Sync editedStep when switching to a different step or when step data changes externally
  useEffect(() => {
    setEditedStep({
      subject: step.subject || '',
      content: step.content,
      delay: step.delay,
      delayUnit: step.delayUnit,
      label: step.label,
      channel: step.channel,
    });
  }, [step.id, step.subject, step.content, step.delay, step.delayUnit, step.label, step.channel]);

  const handleVariationSelect = (variation: ContentVariation) => {
    setEditedStep(prev => ({
      ...prev,
      subject: variation.subject || prev.subject,
      content: variation.content,
    }));
    if (onSelectVariation) {
      onSelectVariation(variation.id);
    }
  };
  
  const handleSave = () => {
    onUpdate(editedStep);
  };
  
  const Icon = CHANNEL_ICONS[step.channel] || Mail;
  const colors = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.email;
  
  return (
    <div className="w-80 bg-white border-l border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded ${colors.bg} ${colors.text}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Edit Step</h3>
            <p className="text-xs text-slate-500">{step.channel}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="label" className="text-xs font-medium">Step Label</Label>
          <Input
            id="label"
            value={editedStep.label || ''}
            onChange={(e) => setEditedStep(prev => ({ ...prev, label: e.target.value }))}
            placeholder="e.g., Initial Outreach"
            className="text-sm"
            data-testid="input-step-label"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="channel" className="text-xs font-medium">Channel</Label>
          <Select
            value={editedStep.channel}
            onValueChange={(value) => setEditedStep(prev => ({ ...prev, channel: value as CampaignStep['channel'] }))}
          >
            <SelectTrigger className="text-sm" data-testid="select-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="voicemail">Voicemail</SelectItem>
              <SelectItem value="condition">If/Then Branch</SelectItem>
              <SelectItem value="delay">Wait/Delay</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {step.channel === 'condition' && (
          <div className="space-y-3 p-3 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="w-4 h-4 text-amber-600" />
              <span className="font-semibold text-sm text-amber-700">Branch Condition</span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="conditionType" className="text-xs font-medium">Trigger When Contact:</Label>
              <Select
                value={step.conditionType || 'if_opened'}
                onValueChange={(value) => onUpdate({ conditionType: value as CampaignStep['conditionType'] })}
              >
                <SelectTrigger className="text-sm bg-white" data-testid="select-condition-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="if_opened">Opened Email</SelectItem>
                  <SelectItem value="if_clicked">Clicked Link</SelectItem>
                  <SelectItem value="if_replied">Replied</SelectItem>
                  <SelectItem value="if_connected">Connected on LinkedIn</SelectItem>
                  <SelectItem value="if_no_response">No Response</SelectItem>
                  <SelectItem value="if_meeting_booked">Meeting Booked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {step.sophiaRecommendation && (
              <div className="p-2.5 rounded-lg bg-white border border-purple-200">
                <div className="flex items-center gap-2 mb-1.5">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-semibold text-purple-700">Sophia's Recommendation</span>
                </div>
                <p className="text-xs text-slate-600">{step.sophiaRecommendation.reasoning}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge className={`text-[10px] ${step.sophiaRecommendation.suggestedPath === 'yes' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    Suggests: {step.sophiaRecommendation.suggestedPath.toUpperCase()} path
                  </Badge>
                  <Badge className="text-[10px] bg-purple-100 text-purple-700">
                    {Math.round(step.sophiaRecommendation.confidence * 100)}% confident
                  </Badge>
                </div>
              </div>
            )}
          </div>
        )}

        {step.variations && step.variations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-purple-600" />
                Sophia's Versions
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setShowVariations(!showVariations)}
              >
                {showVariations ? 'Hide' : 'Show'}
              </Button>
            </div>
            {showVariations && (
              <div className="space-y-2">
                {step.variations.map((variation) => {
                  const isSelected = step.selectedVariationId === variation.id || 
                    (variation.isRecommended && !step.selectedVariationId);
                  return (
                    <button
                      key={variation.id}
                      onClick={() => handleVariationSelect(variation)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        isSelected 
                          ? 'border-purple-400 bg-purple-50 dark:bg-purple-950/30 ring-1 ring-purple-400' 
                          : 'border-slate-200 hover:border-slate-300 bg-white dark:bg-slate-900'
                      }`}
                      data-testid={`btn-select-variation-${variation.version}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${isSelected ? 'text-purple-700' : 'text-slate-700'}`}>
                            Version {variation.version}
                          </span>
                          {variation.isRecommended && (
                            <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-[10px] px-1.5 py-0">
                              <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className={`w-3.5 h-3.5 ${variation.score >= 85 ? 'text-yellow-500 fill-yellow-500' : 'text-slate-300'}`} />
                          <span className={`text-xs font-medium ${
                            variation.score >= 90 ? 'text-green-600' : 
                            variation.score >= 80 ? 'text-blue-600' : 
                            'text-slate-500'
                          }`}>
                            {variation.score}
                          </span>
                        </div>
                      </div>
                      {variation.subject && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-1 truncate">
                          <span className="font-medium">Subject:</span> {variation.subject}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {variation.content.substring(0, 100)}...
                      </p>
                      {variation.reasoning && (
                        <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1.5 italic">
                          {variation.reasoning}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        
        {(editedStep.channel === 'email') && (
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-xs font-medium">Subject Line</Label>
            <Input
              id="subject"
              value={editedStep.subject || ''}
              onChange={(e) => setEditedStep(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Email subject..."
              className="text-sm"
              data-testid="input-step-subject"
            />
          </div>
        )}
        
        {step.channel !== 'condition' && step.channel !== 'delay' && (
          <div className="space-y-2">
            <Label htmlFor="content" className="text-xs font-medium">Message Content</Label>
            <Textarea
              id="content"
              value={editedStep.content || ''}
              onChange={(e) => setEditedStep(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Write your message..."
              className="text-sm min-h-[200px]"
              data-testid="input-step-content"
            />
          </div>
        )}
        
        {step.channel !== 'condition' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="delay" className="text-xs font-medium">Wait Time</Label>
              <Input
                id="delay"
                type="number"
                min={0}
                value={editedStep.delay || 0}
                onChange={(e) => setEditedStep(prev => ({ ...prev, delay: parseInt(e.target.value) || 0 }))}
                className="text-sm"
                data-testid="input-step-delay"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delayUnit" className="text-xs font-medium">Unit</Label>
              <Select
                value={editedStep.delayUnit || 'days'}
                onValueChange={(value) => setEditedStep(prev => ({ ...prev, delayUnit: value as 'hours' | 'days' }))}
              >
                <SelectTrigger className="text-sm" data-testid="select-delay-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-200">
        <Button 
          onClick={handleSave} 
          className="w-full bg-purple-600 hover:bg-purple-700"
          data-testid="btn-save-step"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}

interface CampaignWorkflowVisualProps {
  open: boolean;
  onClose: () => void;
}

export function CampaignWorkflowVisual({ open, onClose }: CampaignWorkflowVisualProps) {
  const { draft, updateStep, removeStep, reorderSteps, selectVariation, addStep } = useCampaignDraft();
  const { toast } = useToast();
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  
  const selectedStep = useMemo(() => {
    return draft.steps.find(s => s.id === selectedStepId);
  }, [draft.steps, selectedStepId]);
  
  const handleSelectStep = useCallback((stepId: string) => {
    setSelectedStepId(stepId);
  }, []);
  
  const handleDeleteStep = useCallback((stepId: string) => {
    if (draft.steps.length <= 1) {
      toast({ title: 'Cannot Delete', description: 'Campaigns must have at least one step.', variant: 'destructive' });
      return;
    }
    const confirmDelete = window.confirm('Are you sure you want to delete this step? This action cannot be undone.');
    if (!confirmDelete) return;
    
    removeStep(stepId);
    if (selectedStepId === stepId) {
      setSelectedStepId(null);
    }
    toast({ title: 'Step Deleted', description: 'The step has been removed from your workflow.' });
  }, [removeStep, selectedStepId, draft.steps.length, toast]);
  
  const handleMoveUp = useCallback((index: number) => {
    if (index > 0) {
      reorderSteps(index, index - 1);
      toast({ title: 'Step Moved', description: 'Step moved up in the sequence.' });
    }
  }, [reorderSteps, toast]);
  
  const handleMoveDown = useCallback((index: number) => {
    if (index < draft.steps.length - 1) {
      reorderSteps(index, index + 1);
      toast({ title: 'Step Moved', description: 'Step moved down in the sequence.' });
    }
  }, [reorderSteps, draft.steps.length, toast]);
  
  const handleUpdateStep = useCallback((updates: Partial<CampaignStep>) => {
    if (selectedStepId) {
      updateStep(selectedStepId, updates);
      toast({ title: 'Step Updated', description: 'Your changes have been saved.' });
    }
  }, [updateStep, selectedStepId, toast]);
  
  // Track node positions for drag reorder
  const [nodePositions, setNodePositions] = useState<Record<string, number>>({});
  
  const handleNodeDrag = useCallback((event: any, node: Node) => {
    if (node.id.startsWith('step_')) {
      setNodePositions(prev => ({ ...prev, [node.id]: node.position.y }));
    }
  }, []);
  
  const handleNodeDragStop = useCallback((event: any, node: Node) => {
    // Only handle step nodes, ignore branch/wait nodes
    if (!node.id.startsWith('step_')) return;
    
    const draggedIndex = parseInt(node.id.replace('step_', ''));
    const draggedY = node.position.y;
    
    // Get all step nodes and their y positions
    const stepPositions: Array<{ index: number; y: number }> = [];
    for (let i = 0; i < draft.steps.length; i++) {
      if (i === draggedIndex) {
        stepPositions.push({ index: i, y: draggedY });
      } else {
        // Use stored position or estimate from original layout
        const storedY = nodePositions[`step_${i}`];
        stepPositions.push({ index: i, y: storedY ?? (50 + i * 140) });
      }
    }
    
    // Sort by y position to determine new order
    stepPositions.sort((a, b) => a.y - b.y);
    
    // Find new index for dragged step
    const newIndex = stepPositions.findIndex(p => p.index === draggedIndex);
    
    // Only reorder if position changed
    if (newIndex !== draggedIndex && newIndex >= 0 && newIndex < draft.steps.length) {
      reorderSteps(draggedIndex, newIndex);
      toast({ title: 'Step Reordered', description: 'Step moved to new position.' });
    }
    
    // Clear tracked positions
    setNodePositions({});
  }, [draft.steps.length, nodePositions, reorderSteps, toast]);
  
  const handleAddStepAt = useCallback((afterIndex: number) => {
    addStep({
      channel: 'email',
      label: `Step ${draft.steps.length + 1}`,
      subject: 'New email subject',
      content: 'Write your message content here...',
      delay: 1,
      delayUnit: 'days',
    });
    
    const newStepIndex = draft.steps.length;
    const targetIndex = afterIndex + 1;
    
    if (targetIndex < newStepIndex) {
      setTimeout(() => {
        reorderSteps(newStepIndex, targetIndex);
      }, 50);
    }
    
    toast({ title: 'Step Added', description: 'New step added to workflow.' });
  }, [draft.steps.length, addStep, reorderSteps, toast]);

  const handleAddActionFromPalette = useCallback((actionType: string) => {
    const stepNumber = draft.steps.length + 1;
    
    if (actionType === 'condition') {
      addStep({
        channel: 'condition',
        label: `Branch ${stepNumber}: If Opened`,
        content: 'Route contacts based on their engagement',
        delay: 0,
        delayUnit: 'days',
        conditionType: 'if_opened',
        sophiaRecommendation: {
          suggestedPath: 'yes',
          confidence: 0.78,
          reasoning: 'Based on your campaign history, contacts who open tend to convert 3x higher. Recommend following up with engaged leads.'
        }
      });
      toast({ title: 'If/Then Branch Added', description: 'Sophia will help route contacts dynamically.' });
    } else if (actionType === 'delay') {
      addStep({
        channel: 'delay',
        label: `Wait ${stepNumber}`,
        content: 'Pause before next action',
        delay: 2,
        delayUnit: 'days',
      });
      toast({ title: 'Delay Added', description: 'Wait step added to workflow.' });
    } else if (actionType.startsWith('linkedin_')) {
      const linkedinActions: Record<string, string> = {
        linkedin_connect: 'Connection Request',
        linkedin_view: 'View Profile',
        linkedin_follow: 'Follow User',
        linkedin_like: 'Like Recent Post',
      };
      addStep({
        channel: 'linkedin',
        label: linkedinActions[actionType] || 'LinkedIn Action',
        content: `Perform ${linkedinActions[actionType] || 'LinkedIn engagement action'}`,
        delay: 1,
        delayUnit: 'days',
      });
      toast({ title: 'LinkedIn Action Added', description: `${linkedinActions[actionType]} added to workflow.` });
    } else {
      const channelLabels: Record<string, string> = {
        email: 'Send Email',
        linkedin: 'LinkedIn Message',
        sms: 'Send SMS',
        phone: 'Phone Call',
        voicemail: 'Voicemail Drop',
      };
      addStep({
        channel: actionType as any,
        label: channelLabels[actionType] || `Step ${stepNumber}`,
        subject: actionType === 'email' ? 'New email subject' : undefined,
        content: 'Write your message content here...',
        delay: 1,
        delayUnit: 'days',
      });
      toast({ title: 'Step Added', description: `${channelLabels[actionType] || 'New step'} added to workflow.` });
    }
  }, [draft.steps.length, addStep, toast]);
  
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    
    let yOffset = 50;
    const xCenter = 350;
    
    nodes.push({
      id: 'start',
      type: 'start',
      position: { x: xCenter - 100, y: yOffset },
      data: { contactCount: draft.name ? 150 : 0 },
      draggable: false,
    });
    
    yOffset += 100;
    
    if (draft.steps.length === 0) {
      nodes.push({
        id: 'add_first',
        type: 'addStep',
        position: { x: xCenter - 20, y: yOffset },
        data: { onAdd: handleAddStepAt, afterIndex: -1 },
        draggable: false,
      });
      
      edges.push({
        id: 'edge_start_to_add',
        source: 'start',
        target: 'add_first',
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
      });
    }
    
    draft.steps.forEach((step, index) => {
      if (index === 0) {
        edges.push({
          id: 'edge_start_to_step_0',
          source: 'start',
          target: 'step_0',
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#10b981', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
        });
      }
      
      if (index > 0 && step.delay > 0) {
        const waitNodeId = `wait_${index}`;
        nodes.push({
          id: waitNodeId,
          type: 'wait',
          position: { x: xCenter - 60, y: yOffset },
          data: { delay: step.delay, delayUnit: step.delayUnit },
          draggable: false,
        });
        
        edges.push({
          id: `edge_add_${index - 1}_to_wait`,
          source: `add_${index - 1}`,
          target: waitNodeId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
        });
        
        yOffset += 80;
        
        edges.push({
          id: `edge_from_wait_${index}`,
          source: waitNodeId,
          target: `step_${index}`,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
        });
      } else if (index > 0) {
        edges.push({
          id: `edge_add_${index - 1}_to_step`,
          source: `add_${index - 1}`,
          target: `step_${index}`,
          type: 'smoothstep',
          animated: true,
          style: { stroke: 'url(#edge-gradient)', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
        });
      }
      
      const isConditionStep = step.channel === 'condition';
      
      nodes.push({
        id: `step_${index}`,
        type: isConditionStep ? 'condition' : 'step',
        position: { x: xCenter - (isConditionStep ? 140 : 160), y: yOffset },
        data: isConditionStep ? { 
          step,
          stepIndex: index,
          isSelected: step.id === selectedStepId,
          onSelect: handleSelectStep,
          onDelete: handleDeleteStep,
        } : { 
          step,
          stepIndex: index,
          isSelected: step.id === selectedStepId,
          onSelect: handleSelectStep,
          onDelete: handleDeleteStep,
          onMoveUp: handleMoveUp,
          onMoveDown: handleMoveDown,
          totalSteps: draft.steps.length,
          metrics: draft.steps.length > 1 ? {
            sent: Math.max(0, 150 - (index * 30)),
            opened: Math.max(0, 95 - (index * 25)),
            replied: Math.max(0, 25 - (index * 8)),
            openRate: Math.round((Math.max(0, 95 - (index * 25)) / Math.max(1, 150 - (index * 30))) * 100),
            replyRate: Math.round((Math.max(0, 25 - (index * 8)) / Math.max(1, 95 - (index * 25))) * 100),
          } : undefined,
        },
      });
      
      yOffset += 160;
      
      nodes.push({
        id: `add_${index}`,
        type: 'addStep',
        position: { x: xCenter - 20, y: yOffset - 40 },
        data: { onAdd: handleAddStepAt, afterIndex: index },
        draggable: false,
      });
      
      edges.push({
        id: `edge_step_${index}_to_add`,
        source: `step_${index}`,
        target: `add_${index}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '5,5' },
      });
      
      yOffset += 40;
      
      if (step.branches && step.branches.length > 0) {
        const branchStartX = xCenter + 150;
        
        step.branches.forEach((branch, branchIndex) => {
          const branchNodeId = `branch_${index}_${branchIndex}`;
          nodes.push({
            id: branchNodeId,
            type: 'branch',
            position: { x: branchStartX + (branchIndex * 160), y: yOffset - 80 },
            data: { branch },
            draggable: false,
          });
          
          edges.push({
            id: `edge_step_${index}_to_branch_${branchIndex}`,
            source: `step_${index}`,
            target: branchNodeId,
            type: 'smoothstep',
            style: { stroke: '#f59e0b', strokeDasharray: '5,5' },
            label: CONDITION_LABELS[branch.condition]?.label || branch.condition,
            labelStyle: { fontSize: 10, fill: '#92400e' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
          });
          
          let targetStepId: string | null = null;
          if (branch.action === 'proceed_to_next' && index < draft.steps.length - 1) {
            targetStepId = `step_${index + 1}`;
          } else if (branch.action === 'skip_to_step' && branch.targetStepId) {
            const targetIndex = draft.steps.findIndex(s => s.id === branch.targetStepId);
            if (targetIndex !== -1) {
              targetStepId = `step_${targetIndex}`;
            }
          } else if (branch.action === 'try_different_channel' && branch.nextChannel) {
            const nextChannelIndex = draft.steps.findIndex((s, i) => i > index && s.channel === branch.nextChannel);
            if (nextChannelIndex !== -1) {
              targetStepId = `step_${nextChannelIndex}`;
            } else if (index < draft.steps.length - 1) {
              targetStepId = `step_${index + 1}`;
            }
          } else if (branch.action === 'move_to_pipeline') {
          } else if (index < draft.steps.length - 1) {
            targetStepId = `step_${index + 1}`;
          }
          
          if (targetStepId) {
            edges.push({
              id: `edge_branch_${index}_${branchIndex}_to_target`,
              source: branchNodeId,
              target: targetStepId,
              type: 'smoothstep',
              style: { stroke: '#22c55e' },
              label: branch.action === 'move_to_pipeline' ? '→ Pipeline' : '',
              labelStyle: { fontSize: 9, fill: '#166534' },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' },
            });
          }
        });
        
        yOffset += 60;
      }
    });
    
    return { nodes, edges };
  }, [draft.steps, draft.name, selectedStepId, handleSelectStep, handleDeleteStep, handleMoveUp, handleMoveDown, handleAddStepAt]);
  
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-6xl h-[85vh] flex flex-col">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-500" />
            Visual Workflow Editor - {draft.name || 'Untitled Campaign'}
            <Badge variant="secondary">{draft.steps.length} steps</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">Click to edit • Use arrows to reorder steps</p>
            <Button variant="ghost" size="sm" onClick={onClose} data-testid="btn-close-workflow">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 flex">
          <div className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col">
            <div className="p-3 border-b border-slate-200">
              <h3 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                <Zap className="w-4 h-4 text-purple-500" />
                Action Palette
              </h3>
              <p className="text-xs text-slate-500 mt-1">Click to add actions to workflow</p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-4">
                {ACTION_PALETTE.map((category) => (
                  <div key={category.category}>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {category.category}
                    </h4>
                    <div className="space-y-1.5">
                      {category.actions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <div
                            key={action.type}
                            className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-slate-200 hover:border-purple-300 hover:shadow-sm cursor-pointer transition-all group"
                            data-testid={`action-${action.type}`}
                            onClick={() => handleAddActionFromPalette(action.type)}
                          >
                            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${action.color} shadow-sm group-hover:shadow-md transition-shadow`}>
                              <Icon className="w-3.5 h-3.5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-slate-700 truncate">{action.label}</p>
                              <p className="text-[10px] text-slate-400 truncate">{action.description}</p>
                            </div>
                            <Plus className="w-4 h-4 text-slate-300 group-hover:text-purple-500 transition-colors" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-slate-200 bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center gap-2 text-xs text-purple-600">
                <Bot className="w-4 h-4" />
                <span className="font-medium">Sophia can auto-optimize your flow</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-left"
              className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20"
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              defaultEdgeOptions={{
                type: 'smoothstep',
                animated: true,
              }}
            >
              <svg>
                <defs>
                  <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <Background 
                color="#cbd5e1" 
                gap={24} 
                size={1}
                style={{ opacity: 0.5 }}
              />
              <Controls className="!bg-white !border-slate-200 !shadow-lg !rounded-lg" />
              <MiniMap 
                nodeColor={(n) => {
                  if (n.type === 'step') return '#6366f1';
                  if (n.type === 'branch') return '#f59e0b';
                  return '#94a3b8';
                }}
                maskColor="rgba(255, 255, 255, 0.8)"
                className="!bg-white/80 !border-slate-200 !shadow-lg !rounded-lg"
              />
            </ReactFlow>
          </div>
          
          {selectedStep && (
            <StepEditorPanel
              step={selectedStep}
              onUpdate={handleUpdateStep}
              onClose={() => setSelectedStepId(null)}
              onSelectVariation={(variationId) => {
                selectVariation(selectedStep.id, variationId);
                toast({ title: 'Version Selected', description: 'Content updated to selected version.' });
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
