import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Workflow, WorkflowNode, WorkflowEdge } from '../../shared/schema';
import { Node, Edge } from 'reactflow';

// Helper to get auth token
async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return session.access_token;
}

export function useWorkflows() {
  const { toast } = useToast();

  // Fetch all workflows via backend API (bypasses PostgREST)
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['/api/workflows'],
    queryFn: async () => {
      const token = await getAuthToken();
      const response = await fetch('/api/workflows', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch workflows');
      }
      
      return await response.json() as Workflow[];
    },
  });

  // Create workflow via backend API
  const createWorkflow = useMutation({
    mutationFn: async (workflow: { 
      name: string; 
      description?: string;
      type?: string;
    }) => {
      const token = await getAuthToken();
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(workflow),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create workflow');
      }
      
      return await response.json() as Workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Workflow created',
        description: 'Your workflow has been created successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error creating workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Update workflow via backend API
  const updateWorkflow = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Workflow> }) => {
      const token = await getAuthToken();
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update workflow');
      }
      
      return await response.json() as Workflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Workflow updated',
        description: 'Your workflow has been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error updating workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Delete workflow via backend API
  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const token = await getAuthToken();
      const response = await fetch(`/api/workflows/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete workflow');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: 'Workflow deleted',
        description: 'Your workflow has been deleted successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error deleting workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  return {
    workflows,
    isLoading,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
  };
}

export function useWorkflowDetails(workflowId: string | null) {
  const { toast } = useToast();

  // Fetch workflow with nodes and edges via backend API
  const { data, isLoading } = useQuery({
    queryKey: ['/api/workflows', workflowId],
    enabled: !!workflowId,
    queryFn: async () => {
      const token = await getAuthToken();
      const response = await fetch(`/api/workflows/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch workflow');
      }
      
      const workflowData = await response.json();
      
      return {
        workflow: workflowData as Workflow,
        nodes: workflowData.nodes as WorkflowNode[],
        edges: workflowData.edges as WorkflowEdge[],
      };
    },
  });

  // Save nodes and edges via backend API (bypasses PostgREST)
  const saveWorkflowCanvas = useMutation({
    mutationFn: async ({ 
      workflowId, 
      nodes, 
      edges,
      workspaceId 
    }: { 
      workflowId: string; 
      nodes: Node[]; 
      edges: Edge[];
      workspaceId?: string; 
    }) => {
      const token = await getAuthToken();
      const response = await fetch(`/api/workflows/${workflowId}/canvas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ nodes, edges, workspaceId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save workflow canvas');
      }
      
      return await response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate both the list and the specific workflow
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', variables.workflowId] });
      toast({
        title: 'Workflow saved',
        description: 'Your workflow has been saved successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving workflow',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  return {
    workflow: data?.workflow,
    nodes: data?.nodes,
    edges: data?.edges,
    isLoading,
    saveWorkflowCanvas,
  };
}
