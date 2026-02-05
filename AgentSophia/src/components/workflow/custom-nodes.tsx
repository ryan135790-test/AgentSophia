import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Mail,
  Linkedin,
  MessageSquare,
  Clock,
  GitBranch,
  Webhook,
  Edit3,
  Copy,
  Trash2,
  Eye,
  Sparkles,
  Check,
  ArrowUp,
  ArrowDown,
  Search
} from 'lucide-react';

const NODE_CONFIGS: Record<string, { icon: any; color: string; label: string; borderColor: string }> = {
  email: {
    icon: Mail,
    color: 'bg-blue-500',
    label: 'Email',
    borderColor: 'border-blue-500',
  },
  linkedin_search: {
    icon: Search,
    color: 'bg-[#0A66C2]',
    label: 'LinkedIn Search',
    borderColor: 'border-[#0A66C2]',
  },
  linkedin_connect: {
    icon: Linkedin,
    color: 'bg-[#0A66C2]',
    label: 'LinkedIn Connect',
    borderColor: 'border-[#0A66C2]',
  },
  linkedin_message: {
    icon: MessageSquare,
    color: 'bg-[#0A66C2]',
    label: 'LinkedIn Message',
    borderColor: 'border-[#0A66C2]',
  },
  sms: {
    icon: MessageSquare,
    color: 'bg-purple-500',
    label: 'SMS',
    borderColor: 'border-purple-500',
  },
  wait: {
    icon: Clock,
    color: 'bg-gray-500',
    label: 'Wait',
    borderColor: 'border-gray-500',
  },
  condition: {
    icon: GitBranch,
    color: 'bg-yellow-500',
    label: 'Condition',
    borderColor: 'border-yellow-500',
  },
  webhook: {
    icon: Webhook,
    color: 'bg-green-500',
    label: 'Webhook',
    borderColor: 'border-green-500',
  },
  trigger: {
    icon: Sparkles,
    color: 'bg-emerald-500',
    label: 'Trigger',
    borderColor: 'border-emerald-500',
  },
  phone: {
    icon: MessageSquare,
    color: 'bg-orange-500',
    label: 'Phone',
    borderColor: 'border-orange-500',
  },
  whatsapp: {
    icon: MessageSquare,
    color: 'bg-green-600',
    label: 'WhatsApp',
    borderColor: 'border-green-600',
  },
  default: {
    icon: Sparkles,
    color: 'bg-gray-400',
    label: 'Step',
    borderColor: 'border-gray-400',
  },
};

interface MessageOption {
  version: number;
  content: string;
  subject?: string;
  score: number;
  reasoning: string;
}

interface CustomNodeData {
  label: string;
  type: keyof typeof NODE_CONFIGS;
  config?: any;
  contactCount?: number;
  template?: string;
  messageOptions?: MessageOption[];
  selectedVersion?: number;
  subject?: string;
  content?: string;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function CustomNode({ data, selected, id }: NodeProps<CustomNodeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const config = NODE_CONFIGS[data.type] || NODE_CONFIGS.default;
  const Icon = config.icon;
  
  const hasContent = data.template || data.content || (data.messageOptions && data.messageOptions.length > 0);
  const selectedOption = data.messageOptions?.find(o => o.version === data.selectedVersion);
  const displayContent = selectedOption?.content || data.template || data.content;
  const displaySubject = selectedOption?.subject || data.subject;
  const isMessageNode = ['email', 'linkedin_connect', 'linkedin_message', 'sms'].includes(data.type);

  return (
    <TooltipProvider>
      <Card
        className={`min-w-[240px] max-w-[280px] transition-all ${
          selected ? 'ring-2 ring-primary shadow-lg' : 'shadow-md hover:shadow-lg'
        } ${isHovered ? 'border-primary' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        data-testid={`workflow-node-${data.type}`}
      >
        <div className="p-3">
          <div className="flex items-start gap-2 mb-2">
            <div className={`p-1.5 rounded ${config.color} text-white shrink-0`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{data.label}</div>
              <div className="text-xs text-muted-foreground">{config.label}</div>
            </div>
            
            {hasContent && (
              <Badge variant="secondary" className="shrink-0 text-[10px] bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <Check className="h-2.5 w-2.5 mr-0.5" />
                Ready
              </Badge>
            )}
          </div>
          
          {isMessageNode && hasContent && (
            <div className="mb-2 space-y-1">
              {displaySubject && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Subject: </span>
                  <span className="font-medium truncate">{displaySubject.substring(0, 30)}{displaySubject.length > 30 ? '...' : ''}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground bg-muted rounded p-1.5 line-clamp-2">
                {displayContent?.substring(0, 80)}{displayContent && displayContent.length > 80 ? '...' : ''}
              </div>
            </div>
          )}
          
          {data.type === 'wait' && (
            <div className="text-xs text-muted-foreground mb-2">
              Wait {data.config?.delay || 2} {data.config?.delayUnit || 'days'}
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {data.contactCount !== undefined && data.contactCount > 0 && (
                <Badge variant="secondary" className="text-[10px]">
                  {data.contactCount} contacts
                </Badge>
              )}
              
              {data.messageOptions && data.messageOptions.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                  {data.messageOptions.length} versions
                </Badge>
              )}
            </div>
          </div>
          
          {(isHovered || selected) && (
            <div className="flex items-center justify-end gap-0.5 mt-2 pt-2 border-t">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onEdit?.();
                    }}
                    data-testid={`button-edit-node-${id}`}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Edit step</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onDuplicate?.();
                    }}
                    data-testid={`button-duplicate-node-${id}`}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Duplicate</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onMoveUp?.();
                    }}
                    data-testid={`button-move-up-node-${id}`}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Move up</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onMoveDown?.();
                    }}
                    data-testid={`button-move-down-node-${id}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Move down</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      data.onDelete?.();
                    }}
                    data-testid={`button-delete-node-${id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Delete step</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        <Handle
          type="target"
          position={Position.Top}
          className="!bg-primary !w-3 !h-3"
          data-testid={`node-handle-target-${data.type}`}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="!bg-primary !w-3 !h-3"
          data-testid={`node-handle-source-${data.type}`}
        />
      </Card>
    </TooltipProvider>
  );
}

export const EmailNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'email' }} />
));
EmailNode.displayName = 'EmailNode';

export const LinkedInConnectNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'linkedin_connect' }} />
));
LinkedInConnectNode.displayName = 'LinkedInConnectNode';

export const LinkedInMessageNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'linkedin_message' }} />
));
LinkedInMessageNode.displayName = 'LinkedInMessageNode';

export const SMSNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'sms' }} />
));
SMSNode.displayName = 'SMSNode';

export const WaitNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'wait' }} />
));
WaitNode.displayName = 'WaitNode';

export const ConditionNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'condition' }} />
));
ConditionNode.displayName = 'ConditionNode';

export const WebhookNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'webhook' }} />
));
WebhookNode.displayName = 'WebhookNode';

export const LinkedInSearchNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'linkedin_search' }} />
));
LinkedInSearchNode.displayName = 'LinkedInSearchNode';

export const TriggerNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'trigger' }} />
));
TriggerNode.displayName = 'TriggerNode';

export const PhoneNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'phone' }} />
));
PhoneNode.displayName = 'PhoneNode';

export const WhatsAppNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: 'whatsapp' }} />
));
WhatsAppNode.displayName = 'WhatsAppNode';

export const DefaultNode = memo((props: NodeProps) => (
  <CustomNode {...props} data={{ ...props.data, type: props.data?.type || 'default' }} />
));
DefaultNode.displayName = 'DefaultNode';
