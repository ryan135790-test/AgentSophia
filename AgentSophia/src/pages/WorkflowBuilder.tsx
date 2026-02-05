import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Background,
  Controls,
  MiniMap,
  Connection,
  useNodesState,
  useEdgesState,
  NodeTypes,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  EmailNode,
  LinkedInSearchNode,
  LinkedInConnectNode,
  LinkedInMessageNode,
  SMSNode,
  WaitNode,
  ConditionNode,
  WebhookNode,
  TriggerNode,
  PhoneNode,
  WhatsAppNode,
  DefaultNode,
} from '@/components/workflow/custom-nodes';
import { WorkflowStepEditor } from '@/components/workflow/workflow-step-editor';
import { WorkflowContactsList } from '@/components/workflow/workflow-contacts-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useWorkflows, useWorkflowDetails } from '@/hooks/use-workflows';
import { useSophiaWorkspace } from "@/contexts/SophiaWorkspaceContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MessageEditorModal } from "@/components/message-editor/message-editor-modal";
import {
  Mail,
  Linkedin,
  MessageSquare,
  Clock,
  GitBranch,
  Webhook,
  Play,
  Save,
  Plus,
  Eye,
  Settings,
  Users,
  Trash2,
  ArrowRight,
  ArrowLeft,
  MoveHorizontal,
  Zap,
  Edit3,
  Sparkles,
  Maximize2
} from "lucide-react";

// Node types configuration
const nodeTypes: NodeTypes = {
  email: EmailNode,
  linkedin_search: LinkedInSearchNode,
  linkedin_connect: LinkedInConnectNode,
  linkedin_message: LinkedInMessageNode,
  sms: SMSNode,
  wait: WaitNode,
  condition: ConditionNode,
  webhook: WebhookNode,
  trigger: TriggerNode,
  phone: PhoneNode,
  whatsapp: WhatsAppNode,
  default: DefaultNode,
};

import { Search } from "lucide-react";

const NODE_LIBRARY = [
  {
    type: 'linkedin_search',
    label: 'LinkedIn Search',
    icon: Search,
    description: 'Find new leads on LinkedIn',
    color: 'bg-[#0A66C2]',
    category: 'lead_sourcing'
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
    description: 'Send personalized email',
    color: 'bg-blue-500',
    category: 'messages'
  },
  {
    type: 'linkedin_connect',
    label: 'LinkedIn Connect',
    icon: Linkedin,
    description: 'Send connection request',
    color: 'bg-[#0A66C2]',
    category: 'linkedin'
  },
  {
    type: 'linkedin_message',
    label: 'LinkedIn Message',
    icon: MessageSquare,
    description: 'Send LinkedIn DM',
    color: 'bg-[#0A66C2]',
    category: 'linkedin'
  },
  {
    type: 'sms',
    label: 'SMS',
    icon: MessageSquare,
    description: 'Send text message',
    color: 'bg-purple-500',
    category: 'messages'
  },
  {
    type: 'wait',
    label: 'Wait',
    icon: Clock,
    description: 'Add delay between steps',
    color: 'bg-gray-500',
    category: 'flow'
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: GitBranch,
    description: 'Branch based on behavior',
    color: 'bg-yellow-500',
    category: 'flow'
  },
  {
    type: 'webhook',
    label: 'Webhook',
    icon: Webhook,
    description: 'Trigger external action',
    color: 'bg-green-500',
    category: 'flow'
  },
];

export default function WorkflowBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { activeWorkflowId, setActiveWorkflowId } = useSophiaWorkspace();
  const { currentWorkspace } = useWorkspace();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const loadedWorkflowRef = useRef<string | null>(null);
  
  // Message editor state
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [showMessageEditor, setShowMessageEditor] = useState(false);
  
  // Step editor modal state
  const [showStepEditor, setShowStepEditor] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  const { workflows, createWorkflow, updateWorkflow } = useWorkflows();
  const { workflow, nodes: savedNodes, edges: savedEdges, saveWorkflowCanvas } = useWorkflowDetails(currentWorkflowId);

  const createCampaignMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; workflowId: string }) => {
      const workspaceId = currentWorkspace?.id;
      if (!workspaceId) throw new Error('No active workspace');
      return apiRequest('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          name: data.name,
          description: data.description,
          workflowId: data.workflowId,
          status: 'draft',
          type: 'workflow',
          channels: extractChannelsFromNodes(nodes),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
    },
  });

  const extractChannelsFromNodes = (nodes: Node[]): string[] => {
    const channelTypes = ['email', 'linkedin_connect', 'linkedin_message', 'linkedin_search', 'sms'];
    const channels: string[] = [];
    nodes.forEach(node => {
      if (channelTypes.includes(node.type || '')) {
        const channel = node.type?.startsWith('linkedin_') ? 'linkedin' : node.type;
        if (channel && !channels.includes(channel)) {
          channels.push(channel);
        }
      }
    });
    return channels;
  };
  
  const getFirstWorkflowNode = (nodes: Node[], edges: Edge[]): Node | null => {
    if (nodes.length === 0) return null;
    const targetNodeIds = new Set(edges.map(e => e.target));
    const startNodes = nodes.filter(n => !targetNodeIds.has(n.id));
    return startNodes.length > 0 ? startNodes[0] : nodes[0];
  };
  
  const isLinkedInSearchWorkflow = (): boolean => {
    const firstNode = getFirstWorkflowNode(nodes, edges);
    if (!firstNode) return false;
    const nodeType = firstNode.type || firstNode.data?.type || firstNode.data?.originalType;
    return nodeType === 'linkedin_search';
  };

  // Initialize from context or URL on mount
  useEffect(() => {
    if (activeWorkflowId) {
      setCurrentWorkflowId(activeWorkflowId);
      loadedWorkflowRef.current = activeWorkflowId;
    } else {
      const params = new URLSearchParams(window.location.search);
      const workflowId = params.get('id');
      if (workflowId) {
        setCurrentWorkflowId(workflowId);
        setActiveWorkflowId(workflowId);
        loadedWorkflowRef.current = workflowId;
      }
    }
  }, []); // Run only on mount
  
  // Handle new workflow generation from context
  useEffect(() => {
    if (activeWorkflowId && activeWorkflowId !== loadedWorkflowRef.current) {
      setCurrentWorkflowId(activeWorkflowId);
      loadedWorkflowRef.current = activeWorkflowId;
      toast({
        title: 'Workflow Loaded',
        description: 'AI-generated workflow is ready for editing',
      });
    }
  }, [activeWorkflowId, toast]); // Re-run when context activeWorkflowId changes

  // Load workflow when it changes
  useEffect(() => {
    if (savedNodes && savedEdges) {
      // API returns transformed nodes with 'type' and 'position' (React Flow format)
      // or raw nodes with 'node_type' and 'position_x/position_y' (DB format)
      const reactFlowNodes = savedNodes
        .filter((node: any) => {
          // Support both formats: API transformed (type) or raw DB (node_type)
          const nodeType = node.type || node.node_type;
          const label = node.data?.label || node.label;
          return nodeType && nodeType.trim() !== '' && label && label.trim() !== '';
        })
        .map((node: any, index: number) => {
          // Check if already in React Flow format (has type and position object)
          if (node.type && node.position && typeof node.position === 'object') {
            return node; // Already transformed by API
          }
          
          // Transform from DB format
          // Use originalType from config if available (linkedin_search is stored as 'webhook' in DB)
          const originalType = node.config?.originalType || node.node_type;
          return {
            id: node.id,
            type: originalType,
            position: { 
              x: typeof node.position_x === 'number' && !isNaN(node.position_x) ? node.position_x : 250, 
              y: typeof node.position_y === 'number' && !isNaN(node.position_y) ? node.position_y : 100 + index * 150 
            },
            data: {
              label: node.label,
              type: originalType,
              config: node.config,
              messageOptions: node.config?.messageOptions || null,
              selectedVersion: node.config?.bestVersion || node.config?.selectedVersion || null,
              template: node.config?.template || null,
              content: node.config?.content || node.config?.template || null,
              subject: node.config?.subject || null,
              delay: node.config?.delay || 2,
              delayUnit: node.config?.delayUnit || 'days',
              sendWindowStart: node.config?.sendWindowStart || '09:00',
              sendWindowEnd: node.config?.sendWindowEnd || '17:00',
              activeDays: node.config?.activeDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            },
          };
        });

      const reactFlowEdges = savedEdges.map((edge: any) => {
        // Check if already in React Flow format
        if (edge.source && edge.target) {
          return edge; // Already transformed by API
        }
        // Transform from DB format
        return {
          id: edge.id,
          source: edge.source_node_id,
          target: edge.target_node_id,
          label: edge.label || undefined,
          data: edge.condition ? { condition: edge.condition } : undefined,
        };
      });

      setNodes(reactFlowNodes);
      setEdges(reactFlowEdges);
    }
  }, [savedNodes, savedEdges, setNodes, setEdges]);

  // Update name and description when workflow loads
  useEffect(() => {
    if (workflow) {
      setWorkflowName(workflow.name);
      setWorkflowDescription(workflow.description || '');
    }
  }, [workflow]);

  // Handle node connections
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, id: crypto.randomUUID() }, eds)),
    [setEdges]
  );

  // Add node to canvas
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const nodeConfig = NODE_LIBRARY.find(n => n.type === type);

      if (!nodeConfig) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      const newNode: Node = {
        id: crypto.randomUUID(),
        type,
        position,
        data: { 
          label: nodeConfig.label,
          type: nodeConfig.type,
          config: {},
          // Initialize message options fields
          messageOptions: null,
          selectedVersion: null,
          template: null
        },
      };

      setNodes((nds) => {
        const updatedNodes = nds.concat(newNode);
        
        // Auto-connect to the last node if one exists
        if (nds.length > 0) {
          const lastNode = nds[nds.length - 1];
          const newEdge: Edge = {
            id: crypto.randomUUID(),
            source: lastNode.id,
            target: newNode.id,
            type: 'default',
          };
          setEdges((eds) => eds.concat(newEdge));
        }
        
        return updatedNodes;
      });
    },
    [reactFlowInstance, setNodes, setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    // Double-click to edit
    if (event.detail === 2) {
      setEditingNode(node);
      setShowStepEditor(true);
    }
  }, []);

  const saveWorkflow = async () => {
    if (!currentWorkspace?.id) {
      toast({
        title: "No Workspace Selected",
        description: "Please select a workspace before saving the workflow.",
        variant: "destructive",
      });
      return;
    }
    
    if (!currentWorkflowId) {
      // Create new workflow
      createWorkflow.mutate(
        { name: workflowName, description: workflowDescription },
        {
          onSuccess: async (newWorkflow) => {
            setCurrentWorkflowId(newWorkflow.id);
            // Save the canvas after workflow is created
            saveWorkflowCanvas.mutate({
              workflowId: newWorkflow.id,
              nodes,
              edges,
              workspaceId: currentWorkspace?.id,
            });
            
            // Also create a linked campaign
            try {
              await createCampaignMutation.mutateAsync({
                name: workflowName,
                description: workflowDescription || `Campaign from workflow: ${workflowName}`,
                workflowId: newWorkflow.id,
              });
              toast({
                title: "Workflow & Campaign Created",
                description: "Your workflow has been saved and a campaign has been created.",
              });
            } catch (err) {
              console.error('Failed to create campaign:', err);
              toast({
                title: "Workflow Saved",
                description: "Workflow saved, but campaign creation failed.",
                variant: "destructive",
              });
            }
          },
        }
      );
    } else {
      // Update existing workflow
      await updateWorkflow.mutateAsync({
        id: currentWorkflowId,
        updates: { name: workflowName, description: workflowDescription },
      });
      
      // Save the canvas
      saveWorkflowCanvas.mutate({
        workflowId: currentWorkflowId,
        nodes,
        edges,
        workspaceId: currentWorkspace?.id,
      });
      
      toast({
        title: "Workflow Saved",
        description: "Your workflow changes have been saved.",
      });
    }
  };

  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<{
    status: string;
    scheduled: number;
    pending: number;
    completed: number;
    failed: number;
  } | null>(null);

  const { data: contactsData = [] } = useQuery<any[]>({
    queryKey: ['/api/contacts', currentWorkspace?.id],
    enabled: !!currentWorkspace?.id && showRunDialog,
  });
  
  const contacts = Array.isArray(contactsData) ? contactsData : [];

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const selectAllContacts = () => {
    if (Array.isArray(contacts)) {
      setSelectedContactIds(contacts.map((c: any) => c.id));
    }
  };

  const deselectAllContacts = () => {
    setSelectedContactIds([]);
  };

  const runWorkflow = async () => {
    if (!currentWorkflowId) {
      toast({
        title: "Save first",
        description: "Please save your workflow before running it.",
        variant: "destructive",
      });
      return;
    }
    
    setShowRunDialog(true);
  };

  const deployWorkflowWithContacts = async (contactIds: string[]) => {
    console.log('[WorkflowBuilder] Deploy clicked - workflowId:', currentWorkflowId, 'workspaceId:', currentWorkspace?.id, 'contactIds:', contactIds.length);
    
    if (!currentWorkflowId || !currentWorkspace?.id) {
      console.error('[WorkflowBuilder] Missing workflow or workspace');
      toast({
        title: "Error",
        description: "Missing workflow or workspace.",
        variant: "destructive",
      });
      return;
    }

    setIsDeploying(true);
    try {
      // Get auth token for authenticated API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('[WorkflowBuilder] No auth session');
        throw new Error('Not authenticated. Please log in again.');
      }

      // Auto-save canvas before deploying to ensure nodes are in the database
      console.log('[WorkflowBuilder] Auto-saving canvas before deploy - nodes:', nodes.length, 'edges:', edges.length);
      if (nodes.length > 0) {
        const saveResponse = await fetch(`/api/workflows/${currentWorkflowId}/canvas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            nodes, 
            edges, 
            workspaceId: currentWorkspace.id 
          }),
        });
        
        if (!saveResponse.ok) {
          const saveError = await saveResponse.json().catch(() => ({ message: 'Failed to save workflow' }));
          console.error('[WorkflowBuilder] Canvas save failed:', saveError);
          throw new Error(saveError.error || 'Failed to save workflow before deployment');
        }
        console.log('[WorkflowBuilder] Canvas saved successfully before deploy');
      }

      console.log('[WorkflowBuilder] Making deploy request to /api/workflows/' + currentWorkflowId + '/deploy');
      
      const response = await fetch(`/api/workflows/${currentWorkflowId}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          contactIds,
          workspaceId: currentWorkspace.id,
          runComplianceFirst: true,
        }),
      });

      console.log('[WorkflowBuilder] Deploy response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Deployment failed' }));
        console.error('[WorkflowBuilder] Deploy failed:', error);
        throw new Error(error.error || error.message || 'Deployment failed');
      }

      const result = await response.json();
      console.log('[WorkflowBuilder] Deploy result:', result);

      toast({
        title: result.isLinkedInSearch ? "LinkedIn Search Started" : "Workflow Deployed",
        description: result.isLinkedInSearch 
          ? "Searching for leads matching your criteria..."
          : `${result.scheduledCount || 0} steps scheduled for ${contactIds.length} contacts.`,
      });

      setShowRunDialog(false);
      fetchExecutionStatus();
    } catch (error: any) {
      console.error('[WorkflowBuilder] Deploy error:', error);
      toast({
        title: "Deployment Failed",
        description: error.message || "Failed to deploy workflow.",
        variant: "destructive",
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const fetchExecutionStatus = async () => {
    if (!currentWorkflowId) return;

    try {
      const status = await apiRequest(`/api/workflows/${currentWorkflowId}/execution-status`);
      setExecutionStatus(status);
    } catch (error) {
      console.log('[WorkflowBuilder] Could not fetch execution status');
    }
  };

  useEffect(() => {
    if (currentWorkflowId) {
      fetchExecutionStatus();
    }
  }, [currentWorkflowId]);

  // Node action handlers
  const handleEditNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setEditingNode(node);
      setShowStepEditor(true);
    }
  }, [nodes]);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const newNode: Node = {
      ...node,
      id: crypto.randomUUID(),
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      data: { ...node.data },
    };

    setNodes((nds) => [...nds, newNode]);
    toast({
      title: "Step Duplicated",
      description: `${node.data.label} has been duplicated`,
    });
  }, [nodes, setNodes, toast]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter(n => n.id !== nodeId));
    setEdges((eds) => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    toast({
      title: "Step Deleted",
      description: "The step has been removed from your workflow",
    });
  }, [setNodes, setEdges, toast]);

  const handleMoveNode = useCallback((nodeId: string, direction: 'up' | 'down') => {
    const currentNodes = [...nodes];
    const idx = currentNodes.findIndex(n => n.id === nodeId);
    if (idx === -1) return;
    
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= currentNodes.length) return;
    
    const nodeA = currentNodes[idx];
    const nodeB = currentNodes[newIdx];
    
    const tempY = nodeA.position.y;
    currentNodes[idx] = { ...nodeB, position: { ...nodeB.position, y: nodeA.position.y } };
    currentNodes[newIdx] = { ...nodeA, position: { ...nodeA.position, y: tempY } };
    
    setNodes(currentNodes);
    
    const currentEdges = [...edges];
    const updatedEdges = currentEdges.map(edge => {
      let newEdge = { ...edge };
      
      if (edge.source === nodeId) {
        newEdge.source = nodeB.id;
      } else if (edge.source === nodeB.id) {
        newEdge.source = nodeId;
      }
      
      if (edge.target === nodeId) {
        newEdge.target = nodeB.id;
      } else if (edge.target === nodeB.id) {
        newEdge.target = nodeId;
      }
      
      return newEdge;
    });
    
    setEdges(updatedEdges);
  }, [nodes, edges, setNodes, setEdges]);

  const handleSaveStep = useCallback((stepData: any) => {
    if (!editingNode) return;

    setNodes((nds) =>
      nds.map((node) =>
        node.id === editingNode.id
          ? {
              ...node,
              data: {
                ...node.data,
                label: stepData.label,
                subject: stepData.subject,
                content: stepData.content,
                template: stepData.template,
                messageOptions: stepData.messageOptions,
                selectedVersion: stepData.selectedVersion,
                delay: stepData.delay,
                delayUnit: stepData.delayUnit,
                sendWindowStart: stepData.sendWindowStart,
                sendWindowEnd: stepData.sendWindowEnd,
                activeDays: stepData.activeDays,
                config: {
                  ...node.data.config,
                  ...stepData.config,
                  subject: stepData.subject,
                  content: stepData.content,
                  template: stepData.template,
                  messageOptions: stepData.messageOptions,
                  selectedVersion: stepData.selectedVersion,
                  bestVersion: stepData.selectedVersion,
                  delay: stepData.delay,
                  delayUnit: stepData.delayUnit,
                  sendWindowStart: stepData.sendWindowStart,
                  sendWindowEnd: stepData.sendWindowEnd,
                  activeDays: stepData.activeDays,
                },
              },
            }
          : node
      )
    );

    setEditingNode(null);
    toast({
      title: "Step Updated",
      description: `${stepData.label} has been saved`,
    });
  }, [editingNode, setNodes, toast]);

  // Inject action handlers into nodes for the custom node components
  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node, idx) => ({
      ...node,
      data: {
        ...node.data,
        onEdit: () => handleEditNode(node.id),
        onDuplicate: () => handleDuplicateNode(node.id),
        onDelete: () => handleDeleteNode(node.id),
        onMoveUp: () => handleMoveNode(node.id, 'up'),
        onMoveDown: () => handleMoveNode(node.id, 'down'),
      },
    }));
  }, [nodes, handleEditNode, handleDuplicateNode, handleDeleteNode, handleMoveNode]);

  // Get step index for editor
  const getStepIndex = useCallback((nodeId: string) => {
    return nodes.findIndex(n => n.id === nodeId);
  }, [nodes]);

  return (
    <div className="h-screen flex flex-col">
      {/* Top Toolbar */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Select value={currentWorkflowId || ''} onValueChange={(value) => setCurrentWorkflowId(value || null)}>
              <SelectTrigger className="w-64" data-testid="select-workflow">
                <SelectValue placeholder="Select workflow or create new" />
              </SelectTrigger>
              <SelectContent>
                {workflows?.map((wf) => (
                  <SelectItem key={wf.id} value={wf.id}>
                    {wf.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="max-w-md"
              placeholder="Workflow Name"
              data-testid="input-workflow-name"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{workflow?.status || 'Draft'}</Badge>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={saveWorkflow}
              disabled={createWorkflow.isPending || saveWorkflowCanvas.isPending}
              data-testid="button-save-workflow"
            >
              <Save className="h-4 w-4 mr-2" />
              {createWorkflow.isPending || saveWorkflowCanvas.isPending ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" onClick={runWorkflow} data-testid="button-run-workflow">
              <Play className="h-4 w-4 mr-2" />
              Run Workflow
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Node Library */}
        <div className="w-64 border-r bg-muted/30">
          <div className="p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Workflow Steps
            </h3>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-2">
                {NODE_LIBRARY.map((node) => {
                  const Icon = node.icon;
                  return (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/reactflow', node.type);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      className="p-3 bg-background border rounded-lg cursor-move hover:border-primary transition-colors"
                      data-testid={`node-library-${node.type}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`p-1.5 rounded ${node.color} text-white`}>
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{node.label}</div>
                          <div className="text-xs text-muted-foreground">{node.description}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Center - Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodesWithHandlers}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="bg-muted/10"
            deleteKeyCode="Delete"
            elementsSelectable={true}
            edgesUpdatable={true}
          >
            <Background />
            <Controls />
            <MiniMap />
            <Panel position="top-center" className="bg-background/90 backdrop-blur-sm border rounded-lg px-3 py-2">
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Drag steps to build • Hover for controls • Double-click to edit
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* Right Sidebar - Node Details & Contact Management */}
        <div className="w-96 border-l bg-background overflow-y-auto">
          {selectedNode ? (
            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-1">Step Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Configure {selectedNode.data.label}
                </p>
              </div>

              <Tabs defaultValue="config">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="config" data-testid="tab-config">
                    <Settings className="h-4 w-4 mr-2" />
                    Config
                  </TabsTrigger>
                  <TabsTrigger value="messages" data-testid="tab-messages">
                    <Mail className="h-4 w-4 mr-2" />
                    Messages
                  </TabsTrigger>
                  <TabsTrigger value="contacts" data-testid="tab-contacts">
                    <Users className="h-4 w-4 mr-2" />
                    Contacts
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-4">
                  <div>
                    <Label>Step Name</Label>
                    <Input 
                      value={selectedNode.data.label} 
                      onChange={(e) => {
                        setNodes((nds) =>
                          nds.map((node) =>
                            node.id === selectedNode.id
                              ? { ...node, data: { ...node.data, label: e.target.value } }
                              : node
                          )
                        );
                      }}
                      placeholder="e.g., Initial Outreach Email"
                      data-testid="input-step-name"
                    />
                  </div>

                  {selectedNode.data.type === 'email' && (
                    <>
                      <div>
                        <Label>Email Subject</Label>
                        <Input placeholder="{{firstName}}, quick question..." data-testid="input-email-subject" />
                      </div>
                      <div>
                        <Label>Email Body</Label>
                        <textarea
                          className="w-full h-32 p-2 text-sm border rounded-md"
                          placeholder="Hi {{firstName}},&#10;&#10;I noticed..."
                          data-testid="textarea-email-body"
                        />
                      </div>
                    </>
                  )}

                  {selectedNode.data.type === 'wait' && (
                    <>
                      <div>
                        <Label>Wait Duration</Label>
                        <div className="flex gap-2">
                          <Input type="number" defaultValue="3" className="flex-1" data-testid="input-wait-duration" />
                          <Select defaultValue="days">
                            <SelectTrigger className="w-32" data-testid="select-wait-unit">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="days">Days</SelectItem>
                              <SelectItem value="weeks">Weeks</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="messages" className="space-y-4">
                  {selectedNode.data.type === 'email' || selectedNode.data.type === 'linkedin_connect' || selectedNode.data.type === 'linkedin_message' || selectedNode.data.type === 'sms' ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Message Versions</h4>
                        <p className="text-xs text-muted-foreground mb-3">Sophia generated 3 ranked versions. Choose one or customize.</p>
                      </div>
                      {selectedNode.data.messageOptions ? (
                        <div className="space-y-3">
                          {selectedNode.data.messageOptions.map((option: any, idx: number) => (
                            <Card key={idx} className={`cursor-pointer transition-all ${selectedNode.data.selectedVersion === option.version ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
                              onClick={() => {
                                setNodes((nds) =>
                                  nds.map((node) =>
                                    node.id === selectedNode.id
                                      ? { ...node, data: { ...node.data, selectedVersion: option.version, template: option.content } }
                                      : node
                                  )
                                );
                              }}>
                              <CardContent className="p-3">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={selectedNode.data.selectedVersion === option.version ? "default" : "outline"}>v{option.version}</Badge>
                                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200">{option.score}/10</Badge>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingMessageIndex(idx);
                                      setShowMessageEditor(true);
                                    }}
                                    data-testid={`button-edit-message-${idx}`}
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <p className="text-sm font-medium mb-1">Why this version:</p>
                                <p className="text-xs text-muted-foreground mb-2">{option.reasoning}</p>
                                <p className="text-xs line-clamp-2 bg-muted p-1.5 rounded text-foreground">{option.content}</p>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6">
                          <p className="text-sm text-muted-foreground">No message options available for this step type</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-sm text-muted-foreground">Message options only available for email, LinkedIn, and SMS nodes</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="contacts" className="space-y-4">
                  <WorkflowContactsList 
                    workflowId={currentWorkflowId} 
                    workspaceId={currentWorkspace?.id}
                    onContactAction={(action, contactId) => {
                      toast({ title: `Contact ${action}`, description: `Action completed for contact` });
                    }}
                  />

                  <div className="pt-4 border-t space-y-2">
                    <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => toast({ title: 'Contacts Moved', description: 'All contacts moved to next step' })} data-testid="button-move-all-forward">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Move All Forward
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm" onClick={() => toast({ title: 'Change Campaign', description: 'Opening campaign selector...' })} data-testid="button-change-campaign">
                      <MoveHorizontal className="h-4 w-4 mr-2" />
                      Change Campaign
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center p-6 text-center">
              <div>
                <Eye className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">No Step Selected</h3>
                <p className="text-sm text-muted-foreground">
                  Click on a step to configure it or view contacts
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Message Editor Modal */}
        {selectedNode && editingMessageIndex !== null && selectedNode.data.messageOptions && (
          <MessageEditorModal
            open={showMessageEditor}
            onOpenChange={setShowMessageEditor}
            versions={[
              {
                id: 'current',
                text: selectedNode.data.messageOptions[editingMessageIndex]?.content || '',
                reasoning: selectedNode.data.messageOptions[editingMessageIndex]?.reasoning,
                confidence: (selectedNode.data.messageOptions[editingMessageIndex]?.score || 0) * 10,
                isOriginal: true
              }
            ]}
            selectedVersionId="current"
            onSave={(version) => {
              setNodes((nds) =>
                nds.map((node) =>
                  node.id === selectedNode.id
                    ? {
                        ...node,
                        data: {
                          ...node.data,
                          selectedVersion: selectedNode.data.messageOptions[editingMessageIndex]?.version,
                          template: version.text,
                          messageOptions: node.data.messageOptions.map((opt: any, idx: number) =>
                            idx === editingMessageIndex
                              ? { ...opt, content: version.text }
                              : opt
                          )
                        }
                      }
                    : node
                )
              );
              setShowMessageEditor(false);
            }}
            title="Edit Message"
            description="Review and customize your message"
          />
        )}

        {/* Step Editor Modal */}
        <WorkflowStepEditor
          open={showStepEditor}
          onOpenChange={setShowStepEditor}
          stepData={editingNode ? {
            id: editingNode.id,
            label: editingNode.data.label,
            type: editingNode.data.type,
            subject: editingNode.data.subject,
            content: editingNode.data.content,
            template: editingNode.data.template,
            messageOptions: editingNode.data.messageOptions,
            selectedVersion: editingNode.data.selectedVersion,
            delay: editingNode.data.delay ?? editingNode.data.config?.delay ?? 2,
            delayUnit: editingNode.data.delayUnit ?? editingNode.data.config?.delayUnit ?? 'days',
            sendWindowStart: editingNode.data.sendWindowStart ?? editingNode.data.config?.sendWindowStart ?? '09:00',
            sendWindowEnd: editingNode.data.sendWindowEnd ?? editingNode.data.config?.sendWindowEnd ?? '17:00',
            activeDays: editingNode.data.activeDays ?? editingNode.data.config?.activeDays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
            config: editingNode.data.config,
          } : null}
          onSave={handleSaveStep}
          stepIndex={editingNode ? getStepIndex(editingNode.id) : 0}
          totalSteps={nodes.length}
        />

        {/* Run Workflow Dialog */}
        <Dialog open={showRunDialog} onOpenChange={setShowRunDialog}>
          <DialogContent className="sm:max-w-[600px]" data-testid="dialog-run-workflow">
            <DialogHeader>
              <DialogTitle>Run Workflow</DialogTitle>
              <DialogDescription>
                {isLinkedInSearchWorkflow()
                  ? "This workflow starts with a LinkedIn Search that will find contacts automatically."
                  : "Select contacts to include in this workflow execution. Sophia will run compliance checks before deployment."
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {executionStatus && executionStatus.status !== 'not_deployed' && (
                <div className="bg-muted p-3 rounded-lg space-y-2">
                  <div className="text-sm font-medium">Current Execution Status</div>
                  <div className="flex gap-4 text-sm">
                    <span>Status: <Badge variant={executionStatus.status === 'active' ? 'default' : 'secondary'}>{executionStatus.status}</Badge></span>
                    <span>Scheduled: {executionStatus.scheduled}</span>
                    <span className="text-green-600">Completed: {executionStatus.completed}</span>
                    <span className="text-red-600">Failed: {executionStatus.failed}</span>
                  </div>
                </div>
              )}

              {/* Show search info if workflow starts with LinkedIn Search */}
              {isLinkedInSearchWorkflow() && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Search className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-800 dark:text-blue-200">LinkedIn Search Step</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                        Sophia will search LinkedIn for leads matching your criteria and automatically add them to this campaign.
                        {(() => {
                          const firstNode = getFirstWorkflowNode(nodes, edges);
                          const maxResults = firstNode?.data?.config?.maxResults;
                          if (maxResults && maxResults !== 'unlimited') {
                            return <span className="block mt-1">Target: {maxResults} leads</span>;
                          }
                          if (maxResults === 'unlimited') {
                            return <span className="block mt-1">Target: Unlimited (continuous search)</span>;
                          }
                          return null;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Only show contact selection if workflow doesn't start with LinkedIn Search */}
              {!isLinkedInSearchWorkflow() && (
                <>
                  <div className="flex justify-between items-center">
                    <Label>Select Contacts ({selectedContactIds.length} selected)</Label>
                    <div className="space-x-2">
                      <Button variant="outline" size="sm" onClick={selectAllContacts} data-testid="button-select-all-contacts">
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAllContacts} data-testid="button-deselect-all-contacts">
                        Clear
                      </Button>
                    </div>
                  </div>

                  <ScrollArea className="h-[300px] border rounded-md p-2">
                    {contacts.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No contacts found. Import contacts first.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {contacts.map((contact: any) => (
                          <div 
                            key={contact.id} 
                            className="flex items-center space-x-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                            onClick={() => toggleContactSelection(contact.id)}
                            data-testid={`contact-row-${contact.id}`}
                          >
                            <Checkbox 
                              checked={selectedContactIds.includes(contact.id)}
                              onCheckedChange={() => toggleContactSelection(contact.id)}
                              data-testid={`checkbox-contact-${contact.id}`}
                            />
                            <div className="flex-1">
                              <div className="font-medium">
                                {contact.first_name || ''} {contact.last_name || ''}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {contact.email || contact.linkedin_url || 'No contact info'}
                              </div>
                            </div>
                            {contact.company && (
                              <Badge variant="outline">{contact.company}</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRunDialog(false)} data-testid="button-cancel-run">
                Cancel
              </Button>
              <Button 
                onClick={() => deployWorkflowWithContacts(selectedContactIds)}
                disabled={(!isLinkedInSearchWorkflow() && selectedContactIds.length === 0) || isDeploying}
                data-testid="button-deploy-workflow"
              >
                {isDeploying ? (
                  <>Deploying...</>
                ) : isLinkedInSearchWorkflow() ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start LinkedIn Search
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Deploy to {selectedContactIds.length} Contacts
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
