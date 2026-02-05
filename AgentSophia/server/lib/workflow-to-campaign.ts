import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

interface WorkflowNode {
  id: string;
  workflow_id: string;
  node_type: string;
  label: string;
  position_x: number;
  position_y: number;
  config: Record<string, any>;
}

interface WorkflowEdge {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  label?: string;
}

interface CampaignStep {
  campaign_id: string;
  channel: string;
  label: string;
  subject?: string;
  content: string;
  delay: number;
  delay_unit: string;
  order_index: number;
}

interface ScheduledStep {
  campaign_id: string;
  step_id: string;
  contact_id: string;
  channel: string;
  scheduled_at: string;
  status: string;
  content: Record<string, any>;
  sophia_confidence: number;
}

function mapNodeTypeToChannel(nodeType: string): string {
  const mapping: Record<string, string> = {
    'email': 'email',
    'linkedin_connect': 'linkedin_connection',
    'linkedin_message': 'linkedin_message',
    'linkedin_search': 'linkedin_search',
    'sms': 'sms',
    'phone': 'phone',
    'whatsapp': 'whatsapp',
    'wait': 'wait',
    'condition': 'condition',
    'trigger': 'trigger',
    'webhook': 'webhook',
  };
  return mapping[nodeType] || nodeType;
}

function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  });

  edges.forEach(e => {
    if (nodeMap.has(e.source_node_id) && nodeMap.has(e.target_node_id)) {
      adjacency.get(e.source_node_id)?.push(e.target_node_id);
      inDegree.set(e.target_node_id, (inDegree.get(e.target_node_id) || 0) + 1);
    }
  });

  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) queue.push(nodeId);
  });

  const sorted: WorkflowNode[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = nodeMap.get(current);
    if (node) sorted.push(node);

    adjacency.get(current)?.forEach(neighbor => {
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    });
  }

  if (sorted.length !== nodes.length) {
    return nodes.sort((a, b) => a.position_y - b.position_y);
  }

  return sorted;
}

export async function convertWorkflowToCampaignSteps(
  workflowId: string,
  campaignId: string
): Promise<{ success: boolean; stepsCreated: number; error?: string }> {
  try {
    if (!supabase) {
      return { success: false, stepsCreated: 0, error: 'Supabase not configured' };
    }

    console.log(`[Workflow->Campaign] Converting workflow ${workflowId} to campaign ${campaignId}`);

    const { data: nodesData, error: nodesError } = await supabase
      .from('workflow_nodes')
      .select('*')
      .eq('workflow_id', workflowId);

    if (nodesError) {
      console.error('[Workflow->Campaign] Error fetching nodes:', nodesError);
      return { success: false, stepsCreated: 0, error: nodesError.message };
    }

    const { data: edgesData, error: edgesError } = await supabase
      .from('workflow_edges')
      .select('*')
      .eq('workflow_id', workflowId);

    if (edgesError) {
      console.error('[Workflow->Campaign] Error fetching edges:', edgesError);
      return { success: false, stepsCreated: 0, error: edgesError.message };
    }

    const nodes: WorkflowNode[] = (nodesData || []).map((n: any) => ({
      id: n.id,
      workflow_id: n.workflow_id,
      node_type: n.node_type,
      label: n.label,
      position_x: n.position_x,
      position_y: n.position_y,
      config: n.config || {},
    }));
    const edges: WorkflowEdge[] = (edgesData || []).map((e: any) => ({
      id: e.id,
      workflow_id: e.workflow_id,
      source_node_id: e.source_node_id,
      target_node_id: e.target_node_id,
      label: e.label,
    }));

    console.log(`[Workflow->Campaign] Found ${nodes.length} nodes and ${edges.length} edges`);

    if (nodes.length === 0) {
      return { success: false, stepsCreated: 0, error: 'No workflow nodes found' };
    }

    const sortedNodes = topologicalSort(nodes, edges);
    const actionableNodes = sortedNodes.filter(n => 
      !['trigger', 'condition', 'wait'].includes(n.node_type) ||
      n.node_type === 'wait'
    );

    const campaignSteps: CampaignStep[] = actionableNodes.map((node, index) => {
      const config = node.config || {};
      const originalType = config.originalType || node.node_type;
      
      let delay = 0;
      let delayUnit = 'days';
      
      if (node.node_type === 'wait' || originalType === 'wait') {
        delay = config.delay || config.waitDays || 1;
        delayUnit = config.delayUnit || 'days';
      } else if (index > 0) {
        delay = config.delay || 1;
        delayUnit = config.delayUnit || 'days';
      }

      const stepSettings: Record<string, any> = {
        node_id: node.id,
        node_type: node.node_type,
        original_type: originalType,
        send_window_start: config.sendWindowStart || '09:00',
        send_window_end: config.sendWindowEnd || '17:00',
        active_days: config.activeDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        message_options: config.messageOptions || null,
        selected_version: config.selectedVersion || null,
        search_criteria: config.searchCriteria || null,
      };

      // For LinkedIn Search steps, include the full search config
      if (originalType === 'linkedin_search' || node.node_type === 'linkedin_search') {
        stepSettings.config = {
          keywords: config.keywords || '',
          jobTitle: config.jobTitle || '',
          company: config.company || '',
          location: config.location || '',
          industry: config.industry || '',
          connectionDegree: config.connectionDegree || '2nd',
          maxResults: config.maxResults || 25,
        };
      }

      return {
        campaign_id: campaignId,
        channel: mapNodeTypeToChannel(originalType),
        label: node.label || `Step ${index + 1}`,
        subject: config.subject || null,
        content: config.content || config.template || config.messageOptions?.[0]?.content || '',
        delay,
        delay_unit: delayUnit,
        order_index: index,
      };
    });

    if (!supabase) {
      return { success: false, stepsCreated: 0, error: 'Supabase not configured' };
    }

    await supabase.from('campaign_steps').delete().eq('campaign_id', campaignId);

    if (campaignSteps.length > 0) {
      const { error: insertError } = await supabase
        .from('campaign_steps')
        .insert(campaignSteps);

      if (insertError) {
        console.error('[Workflow->Campaign] Error inserting steps:', insertError);
        return { success: false, stepsCreated: 0, error: insertError.message };
      }
    }

    console.log(`[Workflow->Campaign] Created ${campaignSteps.length} campaign steps for campaign ${campaignId}`);
    return { success: true, stepsCreated: campaignSteps.length };

  } catch (error: any) {
    console.error('[Workflow->Campaign] Error:', error);
    return { success: false, stepsCreated: 0, error: error.message };
  }
}

export async function scheduleWorkflowCampaign(
  campaignId: string,
  contactIds: string[],
  startTime?: Date
): Promise<{ success: boolean; scheduledCount: number; error?: string }> {
  try {
    if (!supabase) {
      return { success: false, scheduledCount: 0, error: 'Supabase not configured' };
    }

    const { data: steps, error: stepsError } = await supabase
      .from('campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('order_index', { ascending: true });

    if (stepsError || !steps || steps.length === 0) {
      return { success: false, scheduledCount: 0, error: 'No campaign steps found' };
    }

    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name, linkedin_url, phone')
      .in('id', contactIds);

    if (contactsError || !contacts || contacts.length === 0) {
      return { success: false, scheduledCount: 0, error: 'No contacts found' };
    }

    const scheduledSteps: ScheduledStep[] = [];
    const baseTime = startTime || new Date();

    for (const contact of contacts) {
      let cumulativeDelay = 0;

      for (const step of steps) {
        const delayMs = calculateDelayMs(step.delay, step.delay_unit);
        cumulativeDelay += delayMs;

        const scheduledAt = new Date(baseTime.getTime() + cumulativeDelay);

        scheduledSteps.push({
          campaign_id: campaignId,
          step_id: step.id,
          contact_id: contact.id,
          channel: step.channel,
          scheduled_at: scheduledAt.toISOString(),
          status: 'pending',
          content: {
            subject: personalizeContent(step.subject || '', contact),
            body: personalizeContent(step.content || '', contact),
            contact_email: contact.email,
            contact_name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
            linkedin_url: contact.linkedin_url,
            phone: contact.phone,
          },
          sophia_confidence: 85,
        });
      }
    }

    await supabase
      .from('campaign_scheduled_steps')
      .delete()
      .eq('campaign_id', campaignId);

    if (scheduledSteps.length > 0) {
      const { error: insertError } = await supabase
        .from('campaign_scheduled_steps')
        .insert(scheduledSteps);

      if (insertError) {
        console.error('[Workflow->Campaign] Error inserting scheduled steps:', insertError);
        return { success: false, scheduledCount: 0, error: insertError.message };
      }
    }

    await supabase
      .from('campaigns')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', campaignId);

    console.log(`[Workflow->Campaign] Scheduled ${scheduledSteps.length} steps for ${contacts.length} contacts`);
    return { success: true, scheduledCount: scheduledSteps.length };

  } catch (error: any) {
    console.error('[Workflow->Campaign] Scheduling error:', error);
    return { success: false, scheduledCount: 0, error: error.message };
  }
}

function calculateDelayMs(delay: number, unit: string): number {
  const multipliers: Record<string, number> = {
    'minutes': 60 * 1000,
    'hours': 60 * 60 * 1000,
    'days': 24 * 60 * 60 * 1000,
    'weeks': 7 * 24 * 60 * 60 * 1000,
  };
  return delay * (multipliers[unit] || multipliers['days']);
}

function personalizeContent(content: string, contact: any): string {
  if (!content) return '';
  
  return content
    .replace(/\{\{first_name\}\}/gi, contact.first_name || '')
    .replace(/\{\{last_name\}\}/gi, contact.last_name || '')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .replace(/\{\{company\}\}/gi, contact.company || '')
    .replace(/\{\{title\}\}/gi, contact.title || '')
    .replace(/\{\{name\}\}/gi, `${contact.first_name || ''} ${contact.last_name || ''}`.trim());
}

export async function getWorkflowCampaignId(workflowId: string): Promise<string | null> {
  try {
    if (!supabase) return null;

    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('id')
      .contains('settings', { workflow_id: workflowId })
      .limit(1);

    if (error || !campaigns || campaigns.length === 0) {
      return null;
    }

    return campaigns[0].id;
  } catch (error) {
    console.error('[Workflow->Campaign] Error finding campaign:', error);
    return null;
  }
}

export async function deployWorkflow(
  workflowId: string,
  contactIds: string[],
  userId: string,
  workspaceId: string,
  isLinkedInSearchWorkflow: boolean = false
): Promise<{ success: boolean; campaignId?: string; scheduledCount?: number; error?: string }> {
  try {
    let campaignId = await getWorkflowCampaignId(workflowId);

    if (!campaignId && supabase) {
      const { data: workflow } = await supabase
        .from('workflows')
        .select('name, description')
        .eq('id', workflowId)
        .single();

      const { data: newCampaign, error: createError } = await supabase
        .from('campaigns')
        .insert({
          name: workflow?.name || 'Workflow Campaign',
          description: workflow?.description || 'Auto-generated from workflow',
          type: isLinkedInSearchWorkflow ? 'linkedin_search' : 'workflow',
          status: isLinkedInSearchWorkflow ? 'active' : 'draft',
          user_id: userId,
          workspace_id: workspaceId,
          settings: { 
            workflow_id: workflowId,
            is_linkedin_search: isLinkedInSearchWorkflow,
          },
          sent_count: 0,
          opened_count: 0,
          clicked_count: 0,
          replied_count: 0,
        })
        .select()
        .single();

      if (createError) {
        return { success: false, error: createError.message };
      }

      campaignId = newCampaign.id;
    } else if (campaignId && supabase) {
      // Campaign already exists - update status to 'active' when deploying LinkedIn Search workflows
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };
      
      if (isLinkedInSearchWorkflow) {
        updateData.status = 'active';
        updateData.type = 'linkedin_search';
        console.log(`[Workflow Deploy] Updating existing campaign ${campaignId} status to 'active'`);
      }
      
      await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', campaignId);
    }

    if (!campaignId) {
      return { success: false, error: 'Could not create or find campaign' };
    }

    const conversionResult = await convertWorkflowToCampaignSteps(workflowId, campaignId);
    if (!conversionResult.success) {
      return { success: false, error: conversionResult.error };
    }

    if (isLinkedInSearchWorkflow) {
      console.log(`[Workflow Deploy] =======================================================`);
      console.log(`[Workflow Deploy] 🔍 LinkedIn Search workflow ${workflowId} deployed as campaign ${campaignId}`);
      console.log(`[Workflow Deploy] 🔍 User ID: ${userId}, Workspace ID: ${workspaceId}`);
      console.log(`[Workflow Deploy] 🔍 Timestamp: ${new Date().toISOString()}`);
      
      // Get the LinkedIn Search step config and trigger the actual search
      try {
        if (!supabase) {
          console.error(`[Workflow Deploy] ❌ Supabase not configured for LinkedIn search`);
          return { success: false, error: 'Database not configured - cannot run LinkedIn search', campaignId };
        }
        
        // Query all nodes for this workflow and find the linkedin_search node by checking config.originalType
        // since linkedin_search is stored as 'webhook' in the database with originalType in config
        const { data: allNodes, error: nodesError } = await supabase
          .from('workflow_nodes')
          .select('config, node_type')
          .eq('workflow_id', workflowId);
        
        if (nodesError) {
          console.error(`[Workflow Deploy] ❌ Error fetching workflow nodes:`, nodesError.message);
          return { success: false, error: `Failed to fetch workflow nodes: ${nodesError.message}`, campaignId };
        }
        
        console.log(`[Workflow Deploy] 🔍 Found ${allNodes?.length || 0} workflow nodes`);
        allNodes?.forEach((n: any, i: number) => {
          console.log(`[Workflow Deploy]   Node ${i}: type=${n.node_type}, originalType=${n.config?.originalType}`);
        });
        
        const searchNode = allNodes?.find((n: any) => 
          n.config?.originalType === 'linkedin_search' || 
          n.node_type === 'linkedin_search'
        );
        
        if (searchNode?.config) {
          const { executeCampaignStepWithUserAccounts } = await import('./user-channel-apis');
          
          // Handle nested config structure (config.config.keywords) and flat structure (config.keywords)
          const nodeConfig = searchNode.config.config || searchNode.config;
          console.log(`[Workflow Deploy] 🔍 Found search node config:`, JSON.stringify(nodeConfig, null, 2));
          
          const searchConfig = {
            keywords: nodeConfig.keywords || nodeConfig.searchKeywords || '',
            jobTitle: nodeConfig.jobTitle || nodeConfig.title || '',
            company: nodeConfig.company || '',
            location: nodeConfig.location || '',
            industry: nodeConfig.industry || '',
            maxResults: nodeConfig.maxResults || nodeConfig.targetCount || 50,
            connectionDegree: nodeConfig.connectionDegree || '2nd',
          };
          
          console.log(`[Workflow Deploy] 🔍 Triggering LinkedIn search with config:`, JSON.stringify(searchConfig));
          
          const searchResult = await executeCampaignStepWithUserAccounts(
            userId,
            'linkedin_search',
            { email: '' },
            { subject: '', body: '' },
            { searchConfig, workspaceId, campaignId }
          );
          
          if (!searchResult.success) {
            console.error(`[Workflow Deploy] ❌ LinkedIn search failed:`, searchResult.error);
            return { success: false, error: searchResult.error || 'LinkedIn search failed to start', campaignId };
          }
          
          console.log(`[Workflow Deploy] ✅ LinkedIn search started successfully:`, searchResult.messageId);
        } else {
          console.error(`[Workflow Deploy] ❌ No linkedin_search node found in workflow. Node types found:`, 
            allNodes?.map((n: any) => `${n.node_type}/${n.config?.originalType}`).join(', '));
          return { success: false, error: 'No LinkedIn Search node found in workflow', campaignId };
        }
      } catch (searchError: any) {
        console.error(`[Workflow Deploy] ❌ Error triggering LinkedIn search:`, searchError);
        return { success: false, error: `LinkedIn search error: ${searchError.message}`, campaignId };
      }
      
      return { 
        success: true, 
        campaignId, 
        scheduledCount: 0 
      };
    }

    const scheduleResult = await scheduleWorkflowCampaign(campaignId, contactIds);
    if (!scheduleResult.success) {
      return { success: false, error: scheduleResult.error };
    }

    console.log(`[Workflow Deploy] Workflow ${workflowId} deployed as campaign ${campaignId} with ${scheduleResult.scheduledCount} scheduled steps`);

    return { 
      success: true, 
      campaignId, 
      scheduledCount: scheduleResult.scheduledCount 
    };

  } catch (error: any) {
    console.error('[Workflow Deploy] Error:', error);
    return { success: false, error: error.message };
  }
}
