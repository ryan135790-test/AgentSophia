import { Router } from 'express';
import { db, SophiaAutonomousCampaign } from './lib/db-service';

const router = Router();

interface ActivityLogEntry {
  id: string;
  campaignId: string;
  timestamp: string;
  action: string;
  details: string;
  status: 'success' | 'pending' | 'in_progress' | 'error';
  metadata?: Record<string, any>;
}

function generateId(): string {
  return `sophia-auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function addActivity(campaignId: string, action: string, details: string, status: ActivityLogEntry['status'] = 'success') {
  try {
    await db.addSophiaActivityLog({
      id: generateId(),
      campaign_id: campaignId,
      action,
      details,
      status,
      metadata: null,
    });
  } catch (error) {
    console.error('Error adding activity log:', error);
  }
}

async function simulateLeadSourcing(campaign: SophiaAutonomousCampaign) {
  await addActivity(campaign.id, 'Campaign started', 'Sophia is analyzing target audience criteria', 'in_progress');
  
  setTimeout(async () => {
    const leadCount = Math.floor(Math.random() * 100) + 50;
    await db.updateSophiaAutonomousCampaign(campaign.id, {
      leads_found: leadCount,
      status: 'enriching',
    });
    
    await addActivity(campaign.id, 'LinkedIn search completed', 
      `Found ${leadCount} leads matching: ${campaign.target_audience.jobTitles?.join(', ') || 'all titles'} in ${campaign.target_audience.industries?.join(', ') || 'all industries'}`,
      'success'
    );
    
    const updatedCampaign = await db.getSophiaAutonomousCampaignById(campaign.id);
    if (updatedCampaign) {
      simulateEnrichment(updatedCampaign);
    }
  }, 3000);
}

async function simulateEnrichment(campaign: SophiaAutonomousCampaign) {
  await addActivity(campaign.id, 'Starting enrichment', 'Looking up contact emails and company data via Hunter.io', 'in_progress');
  
  setTimeout(async () => {
    const enrichedCount = Math.floor(campaign.leads_found * (0.8 + Math.random() * 0.15));
    await db.updateSophiaAutonomousCampaign(campaign.id, {
      leads_enriched: enrichedCount,
      status: 'designing',
    });
    
    await addActivity(campaign.id, 'Enrichment completed', 
      `Found verified emails for ${enrichedCount} contacts (${Math.round(enrichedCount / campaign.leads_found * 100)}% match rate)`,
      'success'
    );
    
    const updatedCampaign = await db.getSophiaAutonomousCampaignById(campaign.id);
    if (updatedCampaign) {
      simulateWorkflowDesign(updatedCampaign);
    }
  }, 4000);
}

async function simulateWorkflowDesign(campaign: SophiaAutonomousCampaign) {
  await addActivity(campaign.id, 'Designing campaign workflow', 'Creating personalized outreach sequence based on your brand voice', 'in_progress');
  
  setTimeout(async () => {
    await db.updateSophiaAutonomousCampaign(campaign.id, {
      messages_generated: campaign.leads_enriched,
      status: 'running',
    });
    
    const channelText = campaign.channels.join(' + ');
    await addActivity(campaign.id, 'Workflow designed', 
      `Created 4-step ${channelText} sequence with personalized content for each lead`,
      'success'
    );
    
    await addActivity(campaign.id, 'Campaign is now running', 
      'Sophia will send messages according to optimal timing and rate limits',
      'success'
    );
    
    const updatedCampaign = await db.getSophiaAutonomousCampaignById(campaign.id);
    if (updatedCampaign) {
      simulateOutreach(updatedCampaign);
    }
  }, 3000);
}

async function simulateOutreach(campaign: SophiaAutonomousCampaign) {
  const checkAndUpdate = async () => {
    const current = await db.getSophiaAutonomousCampaignById(campaign.id);
    if (!current || current.status !== 'running') {
      return false;
    }
    
    if (current.messages_sent < current.leads_enriched) {
      const batchSize = Math.floor(Math.random() * 3) + 1;
      const newSent = Math.min(current.messages_sent + batchSize, current.leads_enriched);
      let newResponses = current.responses;
      
      if (Math.random() > 0.7) {
        newResponses += 1;
        await addActivity(current.id, 'Received response!', 
          `Lead replied to your outreach - moving to hot leads`,
          'success'
        );
      } else {
        const channel = current.channels[Math.floor(Math.random() * current.channels.length)];
        await addActivity(current.id, `Sent ${channel} message`, 
          `Sent personalized ${channel} outreach to a ${current.target_audience.jobTitles?.[0] || 'lead'}`,
          'success'
        );
      }
      
      await db.updateSophiaAutonomousCampaign(current.id, {
        messages_sent: newSent,
        responses: newResponses,
      });
      return true;
    } else {
      await db.updateSophiaAutonomousCampaign(current.id, { status: 'completed' });
      await addActivity(current.id, 'Campaign completed', 
        `Finished outreach to all ${current.leads_enriched} enriched leads. ${current.responses} responses received.`,
        'success'
      );
      return false;
    }
  };
  
  const interval = setInterval(async () => {
    const shouldContinue = await checkAndUpdate();
    if (!shouldContinue) {
      clearInterval(interval);
    }
  }, 8000);
}

router.get('/api/sophia/autonomous-campaigns', async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    const campaigns = await db.getSophiaAutonomousCampaigns(workspaceId);
    
    const formattedCampaigns = campaigns.map(c => ({
      id: c.id,
      workspaceId: c.workspace_id,
      name: c.name,
      goal: c.goal,
      targetAudience: c.target_audience,
      brandVoiceId: c.brand_voice_id,
      brandVoiceName: c.brand_voice_name,
      channels: c.channels,
      approvalMode: c.approval_mode,
      status: c.status,
      leadsFound: c.leads_found,
      leadsEnriched: c.leads_enriched,
      messagesGenerated: c.messages_generated,
      messagesSent: c.messages_sent,
      responses: c.responses,
      createdAt: c.created_at,
      lastActivityAt: c.last_activity_at,
    }));
    
    res.json({ campaigns: formattedCampaigns });
  } catch (error: any) {
    console.error('Error fetching autonomous campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/sophia/autonomous-campaigns', async (req, res) => {
  try {
    const { 
      workspaceId,
      name,
      goal,
      targetAudience,
      brandVoiceId,
      brandVoiceName,
      channels,
      approvalMode = 'semi'
    } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    if (!name || !goal) {
      return res.status(400).json({ error: 'Name and goal are required' });
    }

    const campaignData = {
      id: generateId(),
      workspace_id: workspaceId,
      name,
      goal,
      target_audience: targetAudience || {
        jobTitles: [],
        industries: [],
        companySize: 'any',
        location: '',
        keywords: []
      },
      brand_voice_id: brandVoiceId || null,
      brand_voice_name: brandVoiceName || null,
      channels: channels || ['linkedin', 'email'],
      approval_mode: approvalMode as 'full' | 'semi' | 'manual',
      status: 'sourcing' as const,
      leads_found: 0,
      leads_enriched: 0,
      messages_generated: 0,
      messages_sent: 0,
      responses: 0,
    };

    const saved = await db.createSophiaAutonomousCampaign(campaignData);
    
    simulateLeadSourcing(saved);

    const campaign = {
      id: saved.id,
      workspaceId: saved.workspace_id,
      name: saved.name,
      goal: saved.goal,
      targetAudience: saved.target_audience,
      brandVoiceId: saved.brand_voice_id,
      brandVoiceName: saved.brand_voice_name,
      channels: saved.channels,
      approvalMode: saved.approval_mode,
      status: saved.status,
      leadsFound: saved.leads_found,
      leadsEnriched: saved.leads_enriched,
      messagesGenerated: saved.messages_generated,
      messagesSent: saved.messages_sent,
      responses: saved.responses,
      createdAt: saved.created_at,
      lastActivityAt: saved.last_activity_at,
    };

    console.log(`[Sophia] Created autonomous campaign: ${saved.name} (${saved.id})`);
    res.json({ campaign });
  } catch (error: any) {
    console.error('Error creating autonomous campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/sophia/autonomous-campaigns/:id', async (req, res) => {
  try {
    const campaign = await db.getSophiaAutonomousCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const formatted = {
      id: campaign.id,
      workspaceId: campaign.workspace_id,
      name: campaign.name,
      goal: campaign.goal,
      targetAudience: campaign.target_audience,
      brandVoiceId: campaign.brand_voice_id,
      brandVoiceName: campaign.brand_voice_name,
      channels: campaign.channels,
      approvalMode: campaign.approval_mode,
      status: campaign.status,
      leadsFound: campaign.leads_found,
      leadsEnriched: campaign.leads_enriched,
      messagesGenerated: campaign.messages_generated,
      messagesSent: campaign.messages_sent,
      responses: campaign.responses,
      createdAt: campaign.created_at,
      lastActivityAt: campaign.last_activity_at,
    };
    
    res.json({ campaign: formatted });
  } catch (error: any) {
    console.error('Error fetching autonomous campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/api/sophia/autonomous-campaigns/:id/activity', async (req, res) => {
  try {
    const logs = await db.getSophiaActivityLogs(req.params.id);
    const activities = logs.map(log => ({
      id: log.id,
      campaignId: log.campaign_id,
      timestamp: log.timestamp,
      action: log.action,
      details: log.details,
      status: log.status,
      metadata: log.metadata,
    }));
    res.json({ activities });
  } catch (error: any) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/sophia/autonomous-campaigns/:id/start', async (req, res) => {
  try {
    const campaign = await db.getSophiaAutonomousCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    if (campaign.status === 'paused' || campaign.status === 'draft') {
      const updated = await db.updateSophiaAutonomousCampaign(campaign.id, { status: 'running' });
      await addActivity(campaign.id, 'Campaign resumed', 'Sophia is continuing outreach', 'success');
      
      if (updated) {
        simulateOutreach(updated);
      }
      
      const formatted = {
        id: updated?.id || campaign.id,
        workspaceId: updated?.workspace_id || campaign.workspace_id,
        name: updated?.name || campaign.name,
        goal: updated?.goal || campaign.goal,
        targetAudience: updated?.target_audience || campaign.target_audience,
        brandVoiceId: updated?.brand_voice_id,
        channels: updated?.channels || campaign.channels,
        approvalMode: updated?.approval_mode || campaign.approval_mode,
        status: updated?.status || 'running',
        leadsFound: updated?.leads_found || campaign.leads_found,
        leadsEnriched: updated?.leads_enriched || campaign.leads_enriched,
        messagesGenerated: updated?.messages_generated || campaign.messages_generated,
        messagesSent: updated?.messages_sent || campaign.messages_sent,
        responses: updated?.responses || campaign.responses,
        createdAt: updated?.created_at || campaign.created_at,
        lastActivityAt: updated?.last_activity_at || campaign.last_activity_at,
      };
      
      res.json({ campaign: formatted });
    } else {
      res.json({ campaign });
    }
  } catch (error: any) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/sophia/autonomous-campaigns/:id/pause', async (req, res) => {
  try {
    const campaign = await db.getSophiaAutonomousCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    const updated = await db.updateSophiaAutonomousCampaign(campaign.id, { status: 'paused' });
    await addActivity(campaign.id, 'Campaign paused', 'Sophia will wait until you resume the campaign', 'success');
    
    const formatted = {
      id: updated?.id || campaign.id,
      workspaceId: updated?.workspace_id || campaign.workspace_id,
      name: updated?.name || campaign.name,
      goal: updated?.goal || campaign.goal,
      targetAudience: updated?.target_audience || campaign.target_audience,
      brandVoiceId: updated?.brand_voice_id,
      channels: updated?.channels || campaign.channels,
      approvalMode: updated?.approval_mode || campaign.approval_mode,
      status: updated?.status || 'paused',
      leadsFound: updated?.leads_found || campaign.leads_found,
      leadsEnriched: updated?.leads_enriched || campaign.leads_enriched,
      messagesGenerated: updated?.messages_generated || campaign.messages_generated,
      messagesSent: updated?.messages_sent || campaign.messages_sent,
      responses: updated?.responses || campaign.responses,
      createdAt: updated?.created_at || campaign.created_at,
      lastActivityAt: updated?.last_activity_at || campaign.last_activity_at,
    };
    
    res.json({ campaign: formatted });
  } catch (error: any) {
    console.error('Error pausing campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/api/sophia/autonomous-campaigns/:id', async (req, res) => {
  try {
    const deleted = await db.deleteSophiaAutonomousCampaign(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
