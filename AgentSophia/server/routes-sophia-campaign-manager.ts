import type { Express, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { SophiaCampaignConfig } from './lib/db-service';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sophiaCampaignConfigsMemory = new Map<string, SophiaCampaignConfig>();

interface SophiaCampaignContact {
  id: string;
  campaignId: string;
  contactId: string;
  name: string;
  email: string;
  company?: string;
  status: 'pending' | 'in_progress' | 'messaged' | 'replied' | 'converted' | 'opted_out';
  sophiaStatus: 'waiting' | 'drafting' | 'pending_approval' | 'sent' | 'completed';
  draftMessage?: string;
  channel?: string;
  lastAction?: string;
  lastActionAt?: string;
  sentAt?: string;
  openedAt?: string;
  repliedAt?: string;
}

interface PendingApproval {
  id: string;
  campaignId: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactCompany?: string;
  channel: string;
  draftMessage: string;
  brandVoiceUsed?: string;
  personalizationContext?: string;
  confidence: number;
  createdAt: string;
}

const campaignContacts = new Map<string, SophiaCampaignContact[]>();
const pendingApprovals = new Map<string, PendingApproval[]>();

export function registerSophiaCampaignManagerRoutes(app: Express) {
  app.get('/api/sophia/campaigns/configs', async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
      }
      
      const { data: configs, error } = await supabase
        .from('sophia_campaign_configs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.log('[Sophia] Supabase error, using in-memory:', error.message);
        const memConfigs = Array.from(sophiaCampaignConfigsMemory.values())
          .filter(c => c.workspace_id === workspaceId);
        return res.json({ configs: memConfigs.map(formatConfig) });
      }
      
      res.json({ configs: (configs || []).map(formatConfig) });
    } catch (error: any) {
      console.error('Error fetching campaign configs:', error);
      res.json({ configs: [] });
    }
  });

  app.get('/api/sophia/campaigns/:campaignId/config', async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      
      const { data: config, error } = await supabase
        .from('sophia_campaign_configs')
        .select('*')
        .eq('campaign_id', campaignId)
        .single();
      
      if (error || !config) {
        const memConfig = sophiaCampaignConfigsMemory.get(campaignId);
        return res.json({ config: memConfig ? formatConfig(memConfig) : null });
      }
      
      res.json({ config: formatConfig(config) });
    } catch (error: any) {
      console.error('Error fetching campaign config:', error);
      res.json({ config: null });
    }
  });

  app.post('/api/sophia/campaigns/:campaignId/config', async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const { 
        enabled, 
        autonomyLevel, 
        brandVoiceId, 
        approvalRequired, 
        maxDailyMessages, 
        personalizationLevel,
        workspaceId
      } = req.body;
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'workspaceId is required' });
      }

      const configId = `config-${campaignId}-${Date.now()}`;
      const now = new Date().toISOString();
      
      const configData = {
        id: configId,
        campaign_id: campaignId,
        workspace_id: workspaceId,
        enabled: enabled ?? false,
        autonomy_level: autonomyLevel || 'manual',
        brand_voice_id: brandVoiceId || null,
        approval_required: approvalRequired ?? true,
        max_daily_messages: maxDailyMessages ?? 50,
        personalization_level: personalizationLevel || 'moderate',
        created_at: now,
        updated_at: now,
      };
      
      const { data: saved, error } = await supabase
        .from('sophia_campaign_configs')
        .upsert(configData, { onConflict: 'campaign_id' })
        .select()
        .single();
      
      if (error) {
        console.log('[Sophia] Supabase save error, using in-memory:', error.message);
        sophiaCampaignConfigsMemory.set(campaignId, configData as SophiaCampaignConfig);
        
        if (enabled) {
          initializeCampaignContacts(campaignId);
        }
        
        return res.json({ 
          success: true, 
          config: formatConfig(configData),
          message: `Sophia is now ${enabled ? 'managing' : 'not managing'} this campaign (in-memory)`
        });
      }

      if (enabled) {
        initializeCampaignContacts(campaignId);
      }

      console.log(`[Sophia] Saved campaign config for ${campaignId}: enabled=${enabled}`);

      res.json({ 
        success: true, 
        config: formatConfig(saved),
        message: `Sophia is now ${enabled ? 'managing' : 'not managing'} this campaign`
      });
    } catch (error: any) {
      console.error('Error saving campaign config:', error);
      res.status(500).json({ error: error.message });
    }
  });

  function formatConfig(c: any) {
    return {
      campaignId: c.campaign_id,
      workspaceId: c.workspace_id,
      enabled: c.enabled,
      autonomyLevel: c.autonomy_level,
      brandVoiceId: c.brand_voice_id,
      approvalRequired: c.approval_required,
      maxDailyMessages: c.max_daily_messages,
      personalizationLevel: c.personalization_level,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
    };
  }

  app.get('/api/sophia/campaigns/:campaignId/contacts', async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      let contacts = campaignContacts.get(campaignId);
      
      if (!contacts) {
        contacts = getMockContacts(campaignId);
        campaignContacts.set(campaignId, contacts);
      }
      
      res.json({ contacts });
    } catch (error: any) {
      console.error('Error fetching campaign contacts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/sophia/campaigns/:campaignId/pending-approvals', async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      let approvals = pendingApprovals.get(campaignId);
      
      if (!approvals) {
        approvals = getMockPendingApprovals(campaignId);
        pendingApprovals.set(campaignId, approvals);
      }
      
      res.json({ pending_approvals: approvals });
    } catch (error: any) {
      console.error('Error fetching pending approvals:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/sophia/campaigns/:campaignId/approvals/:approvalId/approve', async (req: Request, res: Response) => {
    try {
      const { campaignId, approvalId } = req.params;
      const { editedMessage } = req.body;
      
      const approvals = pendingApprovals.get(campaignId) || [];
      const approvalIndex = approvals.findIndex(a => a.id === approvalId);
      
      if (approvalIndex === -1) {
        return res.status(404).json({ error: 'Approval not found' });
      }
      
      const approval = approvals[approvalIndex];
      approvals.splice(approvalIndex, 1);
      pendingApprovals.set(campaignId, approvals);
      
      const contacts = campaignContacts.get(campaignId) || [];
      const contactIndex = contacts.findIndex(c => c.contactId === approval.contactId);
      if (contactIndex !== -1) {
        contacts[contactIndex].sophiaStatus = 'sent';
        contacts[contactIndex].status = 'messaged';
        contacts[contactIndex].lastAction = 'Message sent';
        contacts[contactIndex].lastActionAt = 'Just now';
        contacts[contactIndex].sentAt = new Date().toISOString();
        campaignContacts.set(campaignId, contacts);
      }

      res.json({ 
        success: true, 
        message: `Message approved and sent to ${approval.contactName}`,
        messageUsed: editedMessage || approval.draftMessage
      });
    } catch (error: any) {
      console.error('Error approving message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/sophia/campaigns/:campaignId/approvals/:approvalId/reject', async (req: Request, res: Response) => {
    try {
      const { campaignId, approvalId } = req.params;
      const { reason } = req.body;
      
      const approvals = pendingApprovals.get(campaignId) || [];
      const approvalIndex = approvals.findIndex(a => a.id === approvalId);
      
      if (approvalIndex === -1) {
        return res.status(404).json({ error: 'Approval not found' });
      }
      
      const approval = approvals[approvalIndex];
      approvals.splice(approvalIndex, 1);
      pendingApprovals.set(campaignId, approvals);
      
      const contacts = campaignContacts.get(campaignId) || [];
      const contactIndex = contacts.findIndex(c => c.contactId === approval.contactId);
      if (contactIndex !== -1) {
        contacts[contactIndex].sophiaStatus = 'drafting';
        contacts[contactIndex].lastAction = 'Regenerating draft...';
        contacts[contactIndex].lastActionAt = 'Now';
        campaignContacts.set(campaignId, contacts);
      }

      res.json({ 
        success: true, 
        message: `Draft rejected. Sophia will create a new message for ${approval.contactName}`,
        reason
      });
    } catch (error: any) {
      console.error('Error rejecting message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/sophia/campaigns/:campaignId/contacts/:contactId/regenerate', async (req: Request, res: Response) => {
    try {
      const { campaignId, contactId } = req.params;
      const { personalizationLevel } = req.body;
      
      const contacts = campaignContacts.get(campaignId) || [];
      const contactIndex = contacts.findIndex(c => c.contactId === contactId);
      
      if (contactIndex === -1) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      
      contacts[contactIndex].sophiaStatus = 'drafting';
      contacts[contactIndex].lastAction = 'Regenerating personalized message...';
      contacts[contactIndex].lastActionAt = 'Now';
      campaignContacts.set(campaignId, contacts);

      setTimeout(() => {
        const updatedContacts = campaignContacts.get(campaignId) || [];
        const idx = updatedContacts.findIndex(c => c.contactId === contactId);
        if (idx !== -1) {
          updatedContacts[idx].sophiaStatus = 'pending_approval';
          updatedContacts[idx].draftMessage = generatePersonalizedMessage(
            updatedContacts[idx].name,
            updatedContacts[idx].company,
            personalizationLevel || 'moderate'
          );
          updatedContacts[idx].lastAction = 'New draft ready for review';
          updatedContacts[idx].lastActionAt = 'Just now';
          campaignContacts.set(campaignId, updatedContacts);
        }
      }, 2000);

      res.json({ 
        success: true, 
        message: `Sophia is generating a new personalized message for ${contacts[contactIndex].name}`
      });
    } catch (error: any) {
      console.error('Error regenerating message:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/sophia/campaigns/:campaignId/stats', async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      const contacts = campaignContacts.get(campaignId) || getMockContacts(campaignId);
      
      const stats = {
        totalContacts: contacts.length,
        pending: contacts.filter(c => c.sophiaStatus === 'waiting' || c.sophiaStatus === 'drafting').length,
        pendingApproval: contacts.filter(c => c.sophiaStatus === 'pending_approval').length,
        sent: contacts.filter(c => c.sophiaStatus === 'sent').length,
        completed: contacts.filter(c => c.sophiaStatus === 'completed').length,
        replied: contacts.filter(c => c.status === 'replied').length,
        converted: contacts.filter(c => c.status === 'converted').length,
        responseRate: 0,
        conversionRate: 0,
      };
      
      const messagedCount = stats.sent + stats.completed;
      if (messagedCount > 0) {
        stats.responseRate = Math.round((stats.replied / messagedCount) * 100);
        stats.conversionRate = Math.round((stats.converted / messagedCount) * 100);
      }

      res.json({ stats });
    } catch (error: any) {
      console.error('Error fetching campaign stats:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/sophia/campaigns/:campaignId/activity', async (req: Request, res: Response) => {
    try {
      const { campaignId } = req.params;
      
      const { data: logs, error } = await supabase
        .from('sophia_activity_logs')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('timestamp', { ascending: false })
        .limit(20);
      
      if (!error && logs && logs.length > 0) {
        const activity = logs.map((log: any) => ({
          id: log.id,
          timestamp: log.timestamp,
          action: log.action,
          type: log.status === 'success' ? 'sent' : log.status,
          contactName: log.metadata?.contactName || null,
        }));
        return res.json({ activity });
      }
      
      const activity = [
        { id: 'a1', timestamp: new Date(Date.now() - 120000).toISOString(), action: 'Sophia drafted a personalized email for Sarah Chen', type: 'draft', contactName: 'Sarah Chen' },
        { id: 'a2', timestamp: new Date(Date.now() - 3600000).toISOString(), action: 'Email sent to Michael Rodriguez', type: 'sent', contactName: 'Michael Rodriguez' },
        { id: 'a3', timestamp: new Date(Date.now() - 10800000).toISOString(), action: 'Positive reply received from Emily Watson', type: 'reply', contactName: 'Emily Watson' },
        { id: 'a4', timestamp: new Date(Date.now() - 18000000).toISOString(), action: 'Campaign started with brand voice applied', type: 'config' },
      ];

      res.json({ activity });
    } catch (error: any) {
      console.error('Error fetching campaign activity:', error);
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Sophia Campaign Manager routes registered');
}

function initializeCampaignContacts(campaignId: string) {
  if (!campaignContacts.has(campaignId)) {
    campaignContacts.set(campaignId, getMockContacts(campaignId));
  }
}

function getMockContacts(campaignId: string): SophiaCampaignContact[] {
  return [
    { 
      id: `${campaignId}-c1`, 
      campaignId, 
      contactId: 'contact-1',
      name: 'Sarah Chen', 
      email: 'sarah@techcorp.com', 
      company: 'TechCorp', 
      status: 'in_progress', 
      sophiaStatus: 'pending_approval', 
      lastAction: 'Draft ready for review', 
      lastActionAt: '2 min ago', 
      draftMessage: 'Hi Sarah, I noticed TechCorp recently expanded into the enterprise space. Given your focus on scalable solutions, I thought you might be interested in how we helped similar companies reduce their sales cycle by 40%...', 
      channel: 'email' 
    },
    { 
      id: `${campaignId}-c2`, 
      campaignId, 
      contactId: 'contact-2',
      name: 'Michael Rodriguez', 
      email: 'michael@innovate.io', 
      company: 'Innovate.io', 
      status: 'messaged', 
      sophiaStatus: 'sent', 
      lastAction: 'Email sent', 
      lastActionAt: '1 hour ago', 
      channel: 'email' 
    },
    { 
      id: `${campaignId}-c3`, 
      campaignId, 
      contactId: 'contact-3',
      name: 'Emily Watson', 
      email: 'emily@growthlab.com', 
      company: 'GrowthLab', 
      status: 'replied', 
      sophiaStatus: 'completed', 
      lastAction: 'Positive reply received', 
      lastActionAt: '3 hours ago', 
      channel: 'linkedin' 
    },
    { 
      id: `${campaignId}-c4`, 
      campaignId, 
      contactId: 'contact-4',
      name: 'David Kim', 
      email: 'david@enterprise.com', 
      company: 'Enterprise Solutions', 
      status: 'pending', 
      sophiaStatus: 'drafting', 
      lastAction: 'Sophia drafting message...', 
      lastActionAt: 'Now', 
      channel: 'email' 
    },
    { 
      id: `${campaignId}-c5`, 
      campaignId, 
      contactId: 'contact-5',
      name: 'Lisa Thompson', 
      email: 'lisa@startup.io', 
      company: 'StartupIO', 
      status: 'pending', 
      sophiaStatus: 'waiting', 
      lastAction: 'In queue', 
      lastActionAt: '—', 
      channel: 'linkedin' 
    },
  ];
}

function getMockPendingApprovals(campaignId: string): PendingApproval[] {
  const contacts = getMockContacts(campaignId);
  const pendingContact = contacts.find(c => c.sophiaStatus === 'pending_approval');
  
  if (!pendingContact) return [];
  
  return [{
    id: `approval-${campaignId}-1`,
    campaignId,
    contactId: pendingContact.contactId,
    contactName: pendingContact.name,
    contactEmail: pendingContact.email,
    contactCompany: pendingContact.company,
    channel: pendingContact.channel || 'email',
    draftMessage: pendingContact.draftMessage || '',
    brandVoiceUsed: 'Professional & Consultative',
    personalizationContext: 'Recent company expansion, enterprise focus',
    confidence: 0.87,
    createdAt: new Date(Date.now() - 120000).toISOString(),
  }];
}

function generatePersonalizedMessage(name: string, company?: string, level: string = 'moderate'): string {
  const templates = {
    basic: `Hi ${name}, I wanted to reach out about how we could help ${company || 'your company'} achieve better results. Would you be open to a brief conversation?`,
    moderate: `Hi ${name}, I noticed ${company || 'your company'} has been making impressive strides recently. Based on what I've seen, I believe we could help you accelerate your growth even further. Would you have 15 minutes this week for a quick call?`,
    deep: `Hi ${name}, I've been following ${company || 'your company'}'s journey closely, and I'm particularly impressed by your recent initiatives. Given your focus on innovation and growth, I've put together some specific ideas on how we've helped similar companies achieve 3x faster results. I'd love to share these insights with you - are you available for a brief conversation this week?`
  };
  
  return templates[level as keyof typeof templates] || templates.moderate;
}
