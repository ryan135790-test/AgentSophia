import { Express } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  deployWorkflow, 
  convertWorkflowToCampaignSteps,
  scheduleWorkflowCampaign,
  getWorkflowCampaignId 
} from './lib/workflow-to-campaign';
import { runComplianceCheck } from './lib/campaign-compliance';
import { emitSophiaActivity } from './routes-sophia-control';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

async function getAuthenticatedUser(req: any): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  try {
    const token = authHeader.replace('Bearer ', '');
    if (!supabase) return null;
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    
    return { id: user.id, email: user.email || '' };
  } catch (error) {
    return null;
  }
}

function broadcastSophiaActivity(workspaceId: string, activity: {
  type: string;
  campaignName: string;
  channel: string;
  contactName: string;
  progress: number;
  confidence: number;
  status: string;
}) {
  try {
    emitSophiaActivity(workspaceId, {
      type: activity.type === 'workflow_deployed' ? 'completed' : 
            activity.type === 'workflow_deploy_failed' ? 'failed' : 
            activity.type === 'compliance_failed' ? 'failed' : 'progress',
      actionType: activity.type,
      description: activity.status,
      progress: activity.progress,
      confidence: activity.confidence,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.log('[Workflow Deploy] Could not emit Sophia activity:', e);
  }
}

export function registerWorkflowDeployRoutes(app: Express) {
  app.get('/api/workflows/:id/debug-nodes', async (req, res) => {
    try {
      const { id: workflowId } = req.params;
      
      if (!supabase) {
        return res.json({ error: 'Supabase not configured' });
      }
      
      const { data: nodes, error } = await supabase
        .from('workflow_nodes')
        .select('id, node_type, position_y, config')
        .eq('workflow_id', workflowId);
      
      const { data: edges } = await supabase
        .from('workflow_edges')
        .select('source_node_id, target_node_id')
        .eq('workflow_id', workflowId);
      
      if (error) {
        return res.json({ error: error.message });
      }
      
      // Find first node (no incoming edges)
      const targetNodeIds = new Set((edges || []).map((e: any) => e.target_node_id));
      const startNodes = (nodes || []).filter((n: any) => !targetNodeIds.has(n.id));
      const firstNode = startNodes.length > 0 
        ? startNodes.reduce((a: any, b: any) => (a.position_y || 0) < (b.position_y || 0) ? a : b)
        : (nodes || []).reduce((a: any, b: any) => (a.position_y || 0) < (b.position_y || 0) ? a : b, { position_y: Infinity });
      
      const nodesSummary = nodes?.map((n: any) => ({
        id: n.id,
        type: n.node_type,
        originalType: n.config?.originalType,
        hasLinkedInSearch: n.config?.originalType === 'linkedin_search' || n.node_type === 'linkedin_search',
        isFirstNode: n.id === firstNode?.id,
        configKeys: Object.keys(n.config || {}),
      }));
      
      const wouldDetectAsLinkedInSearch = firstNode?.config?.originalType === 'linkedin_search' || firstNode?.node_type === 'linkedin_search';
      
      res.json({
        workflowId,
        nodeCount: nodes?.length || 0,
        edgeCount: edges?.length || 0,
        nodes: nodesSummary,
        hasLinkedInSearchNode: nodesSummary?.some((n: any) => n.hasLinkedInSearch),
        firstNodeId: firstNode?.id,
        firstNodeType: firstNode?.node_type,
        firstNodeOriginalType: firstNode?.config?.originalType,
        wouldDetectAsLinkedInSearch,
        serverTime: new Date().toISOString(),
      });
    } catch (error: any) {
      res.json({ error: error.message });
    }
  });

  app.post('/api/workflows/:id/deploy', async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      const { id: workflowId } = req.params;
      const { contactIds = [], workspaceId, runComplianceFirst = true } = req.body;

      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }

      let startsWithLinkedInSearch = false;
      if (supabase) {
        // Get all nodes and edges to find the actual first node (no incoming edges)
        const { data: workflowNodes, error: nodeQueryError } = await supabase
          .from('workflow_nodes')
          .select('id, node_type, position_y, config')
          .eq('workflow_id', workflowId);
        
        const { data: workflowEdges } = await supabase
          .from('workflow_edges')
          .select('source_node_id, target_node_id')
          .eq('workflow_id', workflowId);
        
        if (nodeQueryError) {
          console.log('[Workflow Deploy] Error fetching nodes:', nodeQueryError.message);
        }
        
        // Find the first node - the one with no incoming edges
        let firstNode: any = null;
        if (workflowNodes && workflowNodes.length > 0) {
          const targetNodeIds = new Set((workflowEdges || []).map((e: any) => e.target_node_id));
          const startNodes = workflowNodes.filter((n: any) => !targetNodeIds.has(n.id));
          
          // If we found nodes without incoming edges, use the one with lowest Y position
          if (startNodes.length > 0) {
            firstNode = startNodes.reduce((a: any, b: any) => 
              (a.position_y || 0) < (b.position_y || 0) ? a : b
            );
          } else {
            // Fallback: use node with lowest Y position
            firstNode = workflowNodes.reduce((a: any, b: any) => 
              (a.position_y || 0) < (b.position_y || 0) ? a : b
            );
          }
        }
        
        console.log('[Workflow Deploy] First node check:', {
          node_type: firstNode?.node_type,
          originalType: firstNode?.config?.originalType,
          id: firstNode?.id,
          configKeys: firstNode?.config ? Object.keys(firstNode.config) : [],
          allNodesCount: workflowNodes?.length || 0,
          allEdgesCount: workflowEdges?.length || 0,
        });
        
        if (firstNode) {
          // Check both node_type AND config.originalType (since linkedin_search is stored as 'webhook' in DB)
          const originalType = firstNode.config?.originalType;
          startsWithLinkedInSearch = originalType === 'linkedin_search' || firstNode.node_type === 'linkedin_search';
          console.log(`[Workflow Deploy] LinkedIn Search detection: originalType=${originalType}, node_type=${firstNode.node_type}, result=${startsWithLinkedInSearch}`);
        }
      }

      if (!startsWithLinkedInSearch && (!contactIds || contactIds.length === 0)) {
        return res.status(400).json({ error: 'At least one contact is required' });
      }

      const userId = user?.id || 'system';

      broadcastSophiaActivity(workspaceId, {
        type: 'workflow_deploy',
        campaignName: 'Workflow Deployment',
        channel: 'system',
        contactName: startsWithLinkedInSearch ? 'LinkedIn Search' : `${contactIds.length} contacts`,
        progress: 10,
        confidence: 90,
        status: startsWithLinkedInSearch ? 'Starting LinkedIn Search workflow...' : 'Starting workflow deployment...',
      });

      if (runComplianceFirst && supabase && contactIds.length > 0) {
        try {
          const { data: contacts } = await supabase
            .from('contacts')
            .select('*')
            .in('id', contactIds);

          const { data: workflowNodes } = await supabase
            .from('workflow_nodes')
            .select('*')
            .eq('workflow_id', workflowId);

          const steps = workflowNodes?.map((node: any) => ({
            channel: node.node_type === 'linkedin_connect' ? 'linkedin' :
                     node.node_type === 'linkedin_message' ? 'linkedin' :
                     node.node_type === 'email' ? 'email' :
                     node.node_type === 'sms' ? 'sms' : node.node_type,
            content: node.config?.content || '',
          })) || [];

          const complianceResult = await runComplianceCheck(
            userId,
            workflowId,
            contacts || [],
            steps
          );
          
          if (!complianceResult.canProceed) {
            broadcastSophiaActivity(workspaceId, {
              type: 'compliance_failed',
              campaignName: 'Workflow Deployment',
              channel: 'system',
              contactName: 'Compliance Check',
              progress: 100,
              confidence: 0,
              status: `Compliance check failed: ${complianceResult.issues.map(i => i.message).join(', ')}`,
            });

            return res.status(400).json({
              error: 'Compliance check failed',
              issues: complianceResult.issues,
              warnings: complianceResult.warnings,
            });
          }
        } catch (complianceError) {
          console.log('[Workflow Deploy] Compliance check skipped:', complianceError);
        }
      }

      broadcastSophiaActivity(workspaceId, {
        type: 'workflow_deploy',
        campaignName: 'Workflow Deployment',
        channel: 'system',
        contactName: startsWithLinkedInSearch ? 'LinkedIn Search' : `${contactIds.length} contacts`,
        progress: 30,
        confidence: 90,
        status: startsWithLinkedInSearch ? 'Setting up LinkedIn Search campaign...' : 'Converting workflow to campaign steps...',
      });

      const result = await deployWorkflow(workflowId, contactIds, userId, workspaceId, startsWithLinkedInSearch);

      if (!result.success) {
        broadcastSophiaActivity(workspaceId, {
          type: 'workflow_deploy_failed',
          campaignName: 'Workflow Deployment',
          channel: 'system',
          contactName: 'Error',
          progress: 100,
          confidence: 0,
          status: `Deployment failed: ${result.error}`,
        });

        return res.status(500).json({ error: result.error });
      }

      broadcastSophiaActivity(workspaceId, {
        type: 'workflow_deployed',
        campaignName: 'Workflow Deployment',
        channel: 'campaign',
        contactName: startsWithLinkedInSearch ? 'LinkedIn Search' : `${contactIds.length} contacts`,
        progress: 100,
        confidence: 95,
        status: startsWithLinkedInSearch 
          ? 'LinkedIn Search campaign deployed! Searching for leads...' 
          : `Workflow deployed! ${result.scheduledCount} steps scheduled.`,
      });

      res.json({
        success: true,
        campaignId: result.campaignId,
        scheduledCount: result.scheduledCount,
        isLinkedInSearch: startsWithLinkedInSearch,
        message: startsWithLinkedInSearch 
          ? 'LinkedIn Search campaign started - leads will be found automatically'
          : `Workflow deployed with ${result.scheduledCount} scheduled steps for ${contactIds.length} contacts`,
      });

    } catch (error: any) {
      console.error('[Workflow Deploy] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to deploy workflow' });
    }
  });

  app.post('/api/workflows/:id/convert-to-steps', async (req, res) => {
    try {
      const { id: workflowId } = req.params;
      const { campaignId } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: 'Campaign ID is required' });
      }

      const result = await convertWorkflowToCampaignSteps(workflowId, campaignId);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        stepsCreated: result.stepsCreated,
      });

    } catch (error: any) {
      console.error('[Workflow Convert] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to convert workflow' });
    }
  });

  app.post('/api/campaigns/:id/schedule-from-workflow', async (req, res) => {
    try {
      const { id: campaignId } = req.params;
      const { contactIds, startTime } = req.body;

      if (!contactIds || contactIds.length === 0) {
        return res.status(400).json({ error: 'At least one contact is required' });
      }

      const result = await scheduleWorkflowCampaign(
        campaignId, 
        contactIds, 
        startTime ? new Date(startTime) : undefined
      );

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      res.json({
        success: true,
        scheduledCount: result.scheduledCount,
      });

    } catch (error: any) {
      console.error('[Campaign Schedule] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to schedule campaign' });
    }
  });

  app.get('/api/workflows/:id/campaign', async (req, res) => {
    try {
      const { id: workflowId } = req.params;
      
      const campaignId = await getWorkflowCampaignId(workflowId);

      if (!campaignId) {
        return res.status(404).json({ error: 'No campaign found for this workflow' });
      }

      if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      res.json(campaign);

    } catch (error: any) {
      console.error('[Workflow Campaign] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to get campaign' });
    }
  });

  app.get('/api/workflows/:id/execution-status', async (req, res) => {
    try {
      const { id: workflowId } = req.params;
      
      const campaignId = await getWorkflowCampaignId(workflowId);

      if (!campaignId) {
        return res.json({ 
          status: 'not_deployed',
          scheduled: 0,
          pending: 0,
          completed: 0,
          failed: 0,
        });
      }

      if (!supabase) {
        return res.status(500).json({ error: 'Database not configured' });
      }

      const { data: campaign } = await supabase
        .from('campaigns')
        .select('status, sent_count, opened_count, replied_count')
        .eq('id', campaignId)
        .single();

      const { data: scheduledSteps } = await supabase
        .from('campaign_scheduled_steps')
        .select('status')
        .eq('campaign_id', campaignId);

      const statusCounts = {
        pending: 0,
        in_progress: 0,
        completed: 0,
        failed: 0,
        skipped: 0,
      };

      scheduledSteps?.forEach((step: any) => {
        const status = step.status || 'pending';
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status as keyof typeof statusCounts]++;
        }
      });

      res.json({
        status: campaign?.status || 'unknown',
        campaignId,
        scheduled: scheduledSteps?.length || 0,
        ...statusCounts,
        metrics: {
          sent: campaign?.sent_count || 0,
          opened: campaign?.opened_count || 0,
          replied: campaign?.replied_count || 0,
        },
      });

    } catch (error: any) {
      console.error('[Workflow Status] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to get execution status' });
    }
  });

  console.log('✅ Workflow deployment routes registered');
}
