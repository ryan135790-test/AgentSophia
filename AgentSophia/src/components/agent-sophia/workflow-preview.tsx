import { useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  NodeTypes,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mail, 
  Linkedin, 
  Phone, 
  MessageSquare, 
  Clock, 
  Play,
  X,
  Voicemail,
  Share2,
  Users,
  Edit,
  Copy,
  Trash2,
  Eye
} from 'lucide-react';

interface WorkflowStep {
  channel: string;
  subject?: string;
  content: string;
  delay?: number;
  template?: string;
  messageOptions?: Array<{
    version: number;
    content: string;
    score: number;
    reasoning: string;
  }>;
}

interface WorkflowPreviewProps {
  campaignName: string;
  channels: string[];
  messages?: Array<WorkflowStep>;
  steps?: Array<WorkflowStep>;
  workflowSteps?: Array<WorkflowStep>;
  contacts?: Array<{
    id: string;
    name: string;
    email?: string;
    stepIndex?: number;
  }>;
  onNodeClick?: (nodeId: string, nodeData: any) => void;
  onEditStep?: (stepIndex: number, stepData: any) => void;
  onDuplicateStep?: (stepIndex: number, stepData: any) => void;
  onClose?: () => void;
}

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  phone: Phone,
  sms: MessageSquare,
  voicemail: Voicemail,
  social: Share2,
};

const CHANNEL_COLORS: Record<string, string> = {
  email: '#3B82F6',
  linkedin: '#0A66C2',
  phone: '#10B981',
  sms: '#8B5CF6',
  voicemail: '#F59E0B',
  social: '#EC4899',
};

function TriggerNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg shadow-lg min-w-[180px] cursor-pointer hover:shadow-xl transition-shadow">
      <Handle type="source" position={Position.Bottom} className="!bg-white" />
      <div className="flex items-center gap-2">
        <Play className="w-4 h-4" />
        <span className="font-semibold text-sm">{data.label}</span>
      </div>
      {data.description && (
        <p className="text-xs mt-1 opacity-90">{data.description}</p>
      )}
    </div>
  );
}

function ChannelNode({ data }: { data: any }) {
  const Icon = CHANNEL_ICONS[data.channelType] || MessageSquare;
  const color = CHANNEL_COLORS[data.channelType] || '#6B7280';
  const [showActions, setShowActions] = useState(false);
  
  return (
    <div 
      className="px-3 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg min-w-[240px] cursor-pointer hover:shadow-xl transition-all border-2"
      style={{ borderColor: color }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <Handle type="target" position={Position.Top} style={{ background: color }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
      
      {/* Header */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-1">
          <div className="p-1 rounded" style={{ backgroundColor: `${color}20` }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <span className="font-semibold text-xs text-slate-900 dark:text-white truncate">{data.label}</span>
        </div>
        {showActions && (
          <div className="flex gap-1">
            <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded" title="View" data-testid="btn-view">
              <Eye className="w-3 h-3" />
            </button>
            <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded" title="Edit" data-testid="btn-edit">
              <Edit className="w-3 h-3" />
            </button>
            <button className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded" title="Copy" data-testid="btn-copy">
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
      
      {/* Description */}
      {data.description && (
        <p className="text-xs mt-1.5 text-slate-600 dark:text-slate-400 line-clamp-2">{data.description}</p>
      )}
      
      {/* Badge */}
      {data.hasMessage && (
        <Badge variant="secondary" className="mt-2 text-xs bg-blue-100 dark:bg-blue-900">
          <Eye className="w-2.5 h-2.5 mr-1" />
          Click to view message
        </Badge>
      )}
    </div>
  );
}

function DelayNode({ data }: { data: any }) {
  return (
    <div className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg shadow min-w-[140px] cursor-pointer hover:shadow-md transition-shadow">
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-slate-500" />
        <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{data.label}</span>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  channel: ChannelNode,
  delay: DelayNode,
  email: ChannelNode,
  linkedin: ChannelNode,
  action: ChannelNode,
};

export function WorkflowPreview({ 
  campaignName, 
  channels, 
  messages,
  steps,
  contacts = [],
  onNodeClick,
  onEditStep,
  onDuplicateStep,
  onClose 
}: WorkflowPreviewProps) {
  const [selectedNode, setSelectedNode] = useState<any>(null);
  
  // Demo contacts if none provided
  const demoContacts = [
    { id: '1', name: 'Sarah Johnson', email: 'sarah@company.com', stepIndex: 0 },
    { id: '2', name: 'Mike Chen', email: 'mike@startup.io', stepIndex: 0 },
    { id: '3', name: 'Alex Rodriguez', email: 'alex@enterprise.com', stepIndex: 1 },
    { id: '4', name: 'Emily White', email: 'emily@tech.co', stepIndex: 1 },
  ];
  
  const allContacts = contacts.length > 0 ? contacts : demoContacts;
  
  const nodes: Node[] = [
    {
      id: 'start',
      type: 'trigger',
      position: { x: 250, y: 0 },
      data: { label: 'Start Campaign', description: campaignName },
    },
  ];
  
  const edges: Edge[] = [];
  let yPos = 100;
  let prevNodeId = 'start';
  
  // Use steps if provided (shows ALL steps), otherwise fall back to unique channels
  // This fixes the bug where 5-step campaigns only showed 2 nodes (one per unique channel)
  const workflowSteps: WorkflowStep[] = steps && steps.length > 0 
    ? steps 
    : (messages && messages.length > 0 
        ? messages 
        : channels.map(ch => ({ channel: ch, content: `${ch} outreach`, subject: undefined, delay: 2 })));
  
  workflowSteps.forEach((step, idx) => {
    const channel = step.channel;
    const nodeId = `${channel}_step_${idx}`;
    const contactsAtStep = allContacts.filter(c => c.stepIndex === idx);
    
    nodes.push({
      id: nodeId,
      type: 'channel',
      position: { x: 250, y: yPos },
      data: {
        label: `Step ${idx + 1}: ${channel.charAt(0).toUpperCase() + channel.slice(1)}`,
        channelType: channel,
        description: step.content?.substring(0, 80) + (step.content && step.content.length > 80 ? '...' : '') || `${channel} outreach`,
        hasMessage: !!step.content,
        message: {
          subject: step.subject,
          content: step.content || `Personalized ${channel} message to {{firstName}} at {{company}}`
        },
        contacts: contactsAtStep,
        contactCount: contactsAtStep.length,
      },
    });
    
    edges.push({
      id: `e_${prevNodeId}_${nodeId}`,
      source: prevNodeId,
      target: nodeId,
      animated: true,
      style: { stroke: CHANNEL_COLORS[channel] || '#6B7280' },
    });
    
    prevNodeId = nodeId;
    yPos += 120;
    
    if (idx < workflowSteps.length - 1) {
      const waitId = `wait_${idx}`;
      const nextStep = workflowSteps[idx + 1] as WorkflowStep | undefined;
      const delayDays = (nextStep as any)?.delay ?? 2;
      
      nodes.push({
        id: waitId,
        type: 'delay',
        position: { x: 250, y: yPos },
        data: { label: delayDays === 0 ? 'Immediate' : delayDays === 1 ? 'Wait 1 day' : `Wait ${delayDays} days` },
      });
      
      edges.push({
        id: `e_${prevNodeId}_${waitId}`,
        source: prevNodeId,
        target: waitId,
        style: { stroke: '#94A3B8' },
      });
      
      prevNodeId = waitId;
      yPos += 80;
    }
  });

  const handleNodeClick = useCallback((event: any, node: Node) => {
    setSelectedNode(node);
    if (onNodeClick) {
      onNodeClick(node.id, node.data);
    }
  }, [onNodeClick]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">
          Interactive Workflow Preview
        </h3>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <Card className="overflow-hidden">
        <div className="h-[400px] bg-slate-50 dark:bg-slate-900">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#94A3B8" gap={16} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      </Card>
      
      {selectedNode && selectedNode.id !== 'start' && (
        <Card className="border-2 border-blue-500 animate-in fade-in slide-in-from-bottom-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {(() => {
                  const Icon = CHANNEL_ICONS[selectedNode.data?.channelType];
                  return Icon ? <Icon className="w-4 h-4" /> : null;
                })()}
                {selectedNode.data?.label}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedNode(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Message Content */}
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">MESSAGE CONTENT</p>
              <ScrollArea className="h-[120px] pr-4">
                {selectedNode.data?.message?.subject && (
                  <p className="text-sm font-medium mb-2">
                    <span className="text-slate-500">Subject:</span> {selectedNode.data.message.subject}
                  </p>
                )}
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {selectedNode.data?.message?.content || selectedNode.data?.description || 'No message content'}
                </p>
              </ScrollArea>
            </div>
            
            {/* Insights */}
            {selectedNode.data?.description && (
              <div className="border-t pt-3 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-1">💡 AI INSIGHT</p>
                <p className="text-xs text-blue-800 dark:text-blue-300">{selectedNode.data.description}</p>
              </div>
            )}
            
            {/* Contacts */}
            {selectedNode.data?.contacts?.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  CONTACTS AT THIS STEP ({selectedNode.data.contacts.length})
                </p>
                <ScrollArea className="h-[100px] pr-4">
                  <div className="space-y-2">
                    {selectedNode.data.contacts.map((contact: any) => (
                      <div key={contact.id} className="text-sm bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="font-medium text-slate-900 dark:text-white">{contact.name}</p>
                        {contact.email && <p className="text-xs text-slate-500">{contact.email}</p>}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="border-t pt-3 flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1" 
                data-testid="btn-edit-step"
                onClick={() => {
                  const stepIndex = parseInt(selectedNode.id.split('_').pop() || '0');
                  if (onEditStep) {
                    onEditStep(stepIndex, selectedNode.data);
                  }
                }}
              >
                <Edit className="w-3 h-3 mr-1" />
                Edit
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1" 
                data-testid="btn-duplicate-step"
                onClick={() => {
                  const stepIndex = parseInt(selectedNode.id.split('_').pop() || '0');
                  if (onDuplicateStep) {
                    onDuplicateStep(stepIndex, selectedNode.data);
                  }
                }}
              >
                <Copy className="w-3 h-3 mr-1" />
                Duplicate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
        Click on any step to view details. Drag to pan, scroll to zoom.
      </p>
    </div>
  );
}
