import { Router } from 'express';
import { 
  synthesizeWorkflow, 
  synthesizeFromTemplate, 
  parseIntentToWorkflowBrief,
  type WorkflowBrief,
  type SynthesizedWorkflow 
} from './lib/workflow-synthesis';
import { getAllTemplates, getTemplateById, searchTemplates } from './lib/campaign-templates';

const router = Router();

router.post('/api/sophia/synthesize-workflow', async (req, res) => {
  try {
    const { brief, templateId, customizations } = req.body as {
      brief?: WorkflowBrief;
      templateId?: string;
      customizations?: Partial<WorkflowBrief>;
    };
    
    let workflow: SynthesizedWorkflow | null = null;
    
    if (templateId) {
      workflow = synthesizeFromTemplate(templateId, customizations);
      if (!workflow) {
        return res.status(404).json({ 
          success: false, 
          error: `Template '${templateId}' not found` 
        });
      }
    } else if (brief) {
      workflow = synthesizeWorkflow(brief);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Either brief or templateId is required' 
      });
    }
    
    res.json({
      success: true,
      workflow,
      message: `Generated ${workflow.steps.length}-step workflow targeting ${workflow.channels.join(', ')}`
    });
  } catch (error: any) {
    console.error('[Workflow Synthesis] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to synthesize workflow' 
    });
  }
});

router.post('/api/sophia/parse-workflow-intent', async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Message is required' 
      });
    }
    
    const brief = parseIntentToWorkflowBrief(message, context);
    
    if (!brief) {
      return res.json({
        success: false,
        hasWorkflowIntent: false,
        message: 'No workflow creation intent detected'
      });
    }
    
    const workflow = synthesizeWorkflow(brief);
    
    const matchingTemplates = searchTemplates(brief.goal);
    
    res.json({
      success: true,
      hasWorkflowIntent: true,
      brief,
      workflow,
      suggestedTemplates: matchingTemplates.slice(0, 3).map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        channels: t.channels,
        stepCount: t.steps.length
      }))
    });
  } catch (error: any) {
    console.error('[Parse Workflow Intent] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to parse workflow intent' 
    });
  }
});

router.get('/api/sophia/workflow-templates', async (req, res) => {
  try {
    const { category, search, includeLinkedInSearch } = req.query;
    
    let templates = getAllTemplates();
    
    if (category && category !== 'all') {
      templates = templates.filter(t => t.category === category);
    }
    
    if (search) {
      templates = searchTemplates(search as string);
    }
    
    if (includeLinkedInSearch === 'true') {
      templates = templates.filter(t => t.channels.includes('linkedin_search'));
    }
    
    res.json({
      success: true,
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        channels: t.channels,
        estimatedDuration: t.estimatedDuration,
        difficulty: t.difficulty,
        stepCount: t.steps.length,
        tags: t.tags,
        sophiaRecommendation: t.sophiaRecommendation
      })),
      total: templates.length
    });
  } catch (error: any) {
    console.error('[Workflow Templates] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch templates' 
    });
  }
});

router.get('/api/sophia/workflow-templates/:id', async (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ 
        success: false, 
        error: 'Template not found' 
      });
    }
    
    res.json({
      success: true,
      template
    });
  } catch (error: any) {
    console.error('[Get Template] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch template' 
    });
  }
});

router.post('/api/sophia/generate-campaign-from-chat', async (req, res) => {
  try {
    const { 
      userMessage, 
      conversationContext,
      workspaceId,
      userId 
    } = req.body;
    
    if (!userMessage) {
      return res.status(400).json({ 
        success: false, 
        error: 'User message is required' 
      });
    }
    
    const brief = parseIntentToWorkflowBrief(userMessage, conversationContext);
    
    if (!brief) {
      return res.json({
        success: false,
        shouldCreateWorkflow: false,
        response: "I can help you create a campaign! Just tell me:\n\n1. **What channels** you want to use (email, LinkedIn, SMS, phone)\n2. **Who you're targeting** (audience description)\n3. **What you're offering** (your value proposition)\n\nOr I can suggest a template based on your goal!"
      });
    }
    
    const workflow = synthesizeWorkflow(brief);
    
    const channelList = workflow.channels.join(', ');
    const stepCount = workflow.steps.length;
    const hasLinkedInSearch = workflow.channels.includes('linkedin_search');
    
    let responseMessage = `I've created a ${stepCount}-step ${channelList} campaign for you!\n\n`;
    
    if (hasLinkedInSearch) {
      responseMessage += "**Step 1: Lead Discovery**\nI'll search LinkedIn to find your ideal prospects matching your criteria.\n\n";
    }
    
    responseMessage += "**Campaign Overview:**\n";
    workflow.steps.forEach((step, i) => {
      const channelName = step.channel.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
      responseMessage += `• Step ${step.order}: ${channelName}${step.delay > 0 ? ` (after ${step.delay} ${step.delayUnit})` : ''}\n`;
    });
    
    responseMessage += `\n**Duration:** ${workflow.metadata.estimatedDuration}\n`;
    responseMessage += `**Difficulty:** ${workflow.metadata.difficulty}\n\n`;
    responseMessage += "Would you like me to:\n• **Load this into the workflow builder** for editing\n• **Apply a different template**\n• **Adjust the messaging style or timing**";
    
    res.json({
      success: true,
      shouldCreateWorkflow: true,
      workflow,
      response: responseMessage,
      actions: [
        { id: 'load_builder', label: 'Load in Workflow Builder', primary: true },
        { id: 'choose_template', label: 'Choose a Template' },
        { id: 'adjust', label: 'Adjust Settings' }
      ]
    });
  } catch (error: any) {
    console.error('[Generate Campaign from Chat] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate campaign' 
    });
  }
});

export default router;
