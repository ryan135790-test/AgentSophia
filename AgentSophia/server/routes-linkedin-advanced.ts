import { Router, Request, Response } from 'express';
import { LinkedInAIInboxManager } from './lib/linkedin-ai-inbox-manager';
import { LinkedInLeadScraper } from './lib/linkedin-lead-scraper';
import { LinkedInEngagementActions } from './lib/linkedin-engagement-actions';
import { EmailEnrichment } from './lib/email-enrichment';
import * as ReplyDetection from './lib/linkedin-reply-detection';
import { linkedInABTestingEngine } from './lib/linkedin-ab-testing';
import * as Blacklist from './lib/linkedin-blacklist';
import * as SSITracker from './lib/linkedin-ssi-tracker';

const router = Router();

router.get('/inbox/settings/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const settings = LinkedInAIInboxManager.getSettings(workspaceId);
  res.json(settings);
});

router.put('/inbox/settings/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const settings = LinkedInAIInboxManager.updateSettings(workspaceId, req.body);
  res.json(settings);
});

router.put('/inbox/mode/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { mode } = req.body;
  
  if (!['manual', 'copilot', 'autopilot'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Use: manual, copilot, or autopilot' });
  }
  
  const settings = LinkedInAIInboxManager.setMode(workspaceId, mode);
  res.json({ message: `Inbox mode set to ${mode}`, settings });
});

router.post('/inbox/process/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const message = req.body;
    
    if (!message.id || !message.content || !message.senderName) {
      return res.status(400).json({ error: 'Missing required fields: id, content, senderName' });
    }
    
    const result = await LinkedInAIInboxManager.processMessage(workspaceId, {
      ...message,
      timestamp: new Date(message.timestamp || Date.now()),
      isRead: false,
      isReplied: false,
    });
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inbox/messages/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { unreadOnly, priority, intent, sentiment } = req.query;
  
  const messages = LinkedInAIInboxManager.getMessages(workspaceId, {
    unreadOnly: unreadOnly === 'true',
    priority: priority as 'high' | 'medium' | 'low' | undefined,
    intent: intent as string | undefined,
    sentiment: sentiment as string | undefined,
  });
  
  res.json(messages);
});

router.get('/inbox/drafts/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const drafts = LinkedInAIInboxManager.getPendingDrafts(workspaceId);
  res.json(drafts);
});

router.post('/inbox/drafts/:workspaceId/:draftId/approve', (req: Request, res: Response) => {
  const { workspaceId, draftId } = req.params;
  const { userId, editedContent } = req.body;
  
  const draft = LinkedInAIInboxManager.approveDraft(workspaceId, draftId, userId, editedContent);
  
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  
  res.json({ message: 'Draft approved', draft });
});

router.post('/inbox/drafts/:workspaceId/:draftId/reject', (req: Request, res: Response) => {
  const { workspaceId, draftId } = req.params;
  
  const draft = LinkedInAIInboxManager.rejectDraft(workspaceId, draftId);
  
  if (!draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }
  
  res.json({ message: 'Draft rejected', draft });
});

router.post('/inbox/drafts/:workspaceId/:draftId/regenerate', async (req: Request, res: Response) => {
  try {
    const { workspaceId, draftId } = req.params;
    const { tone } = req.body;
    
    const draft = await LinkedInAIInboxManager.regenerateDraft(workspaceId, draftId, tone);
    
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }
    
    res.json({ message: 'Draft regenerated', draft });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/inbox/messages/:workspaceId/:messageId/read', (req: Request, res: Response) => {
  const { workspaceId, messageId } = req.params;
  const success = LinkedInAIInboxManager.markRead(workspaceId, messageId);
  res.json({ success });
});

router.get('/inbox/stats/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const stats = LinkedInAIInboxManager.getStats(workspaceId);
  res.json(stats);
});

router.get('/leads/sources', (_req: Request, res: Response) => {
  res.json({
    sources: [
      {
        id: 'group',
        name: 'LinkedIn Groups',
        description: 'Scrape members from LinkedIn groups',
        icon: 'users',
      },
      {
        id: 'event',
        name: 'Event Attendees',
        description: 'Scrape attendees from LinkedIn events',
        icon: 'calendar',
      },
      {
        id: 'post_likers',
        name: 'Post Likers',
        description: 'Scrape people who liked a post',
        icon: 'thumbs-up',
      },
      {
        id: 'post_commenters',
        name: 'Post Commenters',
        description: 'Scrape people who commented on a post',
        icon: 'message-circle',
      },
    ],
  });
});

router.get('/leads/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { source, sourceId, dateFrom } = req.query;
  
  const leads = LinkedInLeadScraper.getLeads(workspaceId, {
    source: source as 'group' | 'event' | 'post_likers' | 'post_commenters' | undefined,
    sourceId: sourceId as string | undefined,
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
  });
  
  res.json(leads);
});

router.get('/leads/:workspaceId/export', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const leads = LinkedInLeadScraper.getLeads(workspaceId);
  const csv = LinkedInLeadScraper.exportCSV(leads);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
  res.send(csv);
});

router.get('/leads/jobs/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const jobs = LinkedInLeadScraper.getJobs(workspaceId);
  res.json(jobs);
});

router.get('/leads/jobs/:jobId/status', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = LinkedInLeadScraper.getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

router.get('/engagement/settings/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const settings = LinkedInEngagementActions.getSettings(workspaceId);
  res.json(settings);
});

router.put('/engagement/settings/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const settings = LinkedInEngagementActions.updateSettings(workspaceId, req.body);
  res.json(settings);
});

router.get('/engagement/actions/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { actionType, status, dateFrom } = req.query;
  
  const actions = LinkedInEngagementActions.getActions(workspaceId, {
    actionType: actionType as any,
    status: status as any,
    dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
  });
  
  res.json(actions);
});

router.get('/engagement/stats/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const stats = LinkedInEngagementActions.getStats(workspaceId);
  res.json(stats);
});

router.get('/enrichment/status', (_req: Request, res: Response) => {
  const status = EmailEnrichment.getStatus();
  res.json(status);
});

router.get('/enrichment/settings/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const settings = EmailEnrichment.getSettings(workspaceId);
  res.json(settings);
});

router.put('/enrichment/settings/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const settings = EmailEnrichment.updateSettings(workspaceId, req.body);
  res.json(settings);
});

router.get('/enrichment/stats/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const stats = EmailEnrichment.getStats(workspaceId);
  res.json(stats);
});

router.post('/enrichment/enrich', async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, company, linkedInUrl, workspaceId } = req.body;
    
    if (!firstName || !lastName || !company) {
      return res.status(400).json({ error: 'Missing required fields: firstName, lastName, company' });
    }
    
    const result = await EmailEnrichment.enrichFromLinkedIn(
      firstName,
      lastName,
      company,
      linkedInUrl,
      workspaceId
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/enrichment/bulk', async (req: Request, res: Response) => {
  try {
    const { profiles, options } = req.body;
    
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(400).json({ error: 'Profiles array is required' });
    }
    
    const results = await EmailEnrichment.enrichProfiles(profiles, options);
    
    const stats = {
      total: profiles.length,
      enriched: results.filter(r => r.email).length,
      failed: results.filter(r => !r.email).length,
    };
    
    res.json({ results, stats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/inbox/modes', (_req: Request, res: Response) => {
  res.json({
    modes: [
      {
        id: 'manual',
        name: 'Manual Mode',
        description: 'All messages require manual review and response',
        features: ['AI classification', 'Priority sorting', 'Intent detection'],
      },
      {
        id: 'copilot',
        name: 'Copilot Mode',
        description: 'AI drafts replies for your approval before sending',
        features: ['AI-drafted replies', 'Edit before sending', 'Tone customization', 'Regenerate options'],
      },
      {
        id: 'autopilot',
        name: 'Autopilot Mode',
        description: 'AI automatically responds to messages (with safety checks)',
        features: ['Automatic replies', 'Negative sentiment approval', 'Daily limits', 'Full autonomy'],
      },
    ],
  });
});

router.get('/engagement/actions-types', (_req: Request, res: Response) => {
  res.json({
    actionTypes: [
      {
        id: 'like_post',
        name: 'Like Posts',
        description: 'Automatically like recent posts from prospects',
        defaultLimit: 30,
      },
      {
        id: 'comment_post',
        name: 'Comment on Posts',
        description: 'Leave personalized comments on prospect posts',
        defaultLimit: 10,
      },
      {
        id: 'endorse_skill',
        name: 'Endorse Skills',
        description: 'Endorse skills on prospect profiles',
        defaultLimit: 15,
      },
      {
        id: 'follow_profile',
        name: 'Follow Profiles',
        description: 'Follow prospects to show interest',
        defaultLimit: 20,
      },
    ],
  });
});

router.get('/reply-detection/config/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const config = ReplyDetection.getReplyConfig(workspaceId);
  res.json(config);
});

router.put('/reply-detection/config/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const config = ReplyDetection.updateReplyConfig({ workspaceId, ...req.body });
  res.json(config);
});

router.post('/reply-detection/track/:workspaceId', (req: Request, res: Response) => {
  const { contactId, campaignId, sequenceStepIndex, messageContent } = req.body;
  const state = ReplyDetection.trackOutboundMessage(contactId, campaignId, sequenceStepIndex, messageContent);
  res.json(state);
});

router.post('/reply-detection/check/:workspaceId', (req: Request, res: Response) => {
  const { contactId, campaignId, inboxMessages } = req.body;
  const result = ReplyDetection.checkForReply(contactId, campaignId, inboxMessages);
  res.json(result);
});

router.get('/reply-detection/stats/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const stats = ReplyDetection.getReplyStats(workspaceId);
  res.json(stats);
});

router.get('/reply-detection/conversations/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const replied = ReplyDetection.getRepliedConversations(workspaceId);
  res.json(replied);
});

router.post('/reply-detection/resume/:workspaceId', (req: Request, res: Response) => {
  const { contactId, campaignId } = req.body;
  const success = ReplyDetection.resumeSequence(contactId, campaignId);
  res.json({ success });
});

router.get('/ab-tests/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const tests = linkedInABTestingEngine.getAllTests(workspaceId);
  res.json(tests);
});

router.post('/ab-tests/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { campaignId, name, testType, variants } = req.body;
  const test = linkedInABTestingEngine.createTest(campaignId, workspaceId, name, testType, variants);
  res.json(test);
});

router.get('/ab-tests/:workspaceId/:testId', (req: Request, res: Response) => {
  const { testId } = req.params;
  const stats = linkedInABTestingEngine.getTestStats(testId);
  if (!stats) {
    return res.status(404).json({ error: 'Test not found' });
  }
  res.json(stats);
});

router.post('/ab-tests/:workspaceId/:testId/start', (req: Request, res: Response) => {
  const { testId } = req.params;
  const success = linkedInABTestingEngine.startTest(testId);
  res.json({ success });
});

router.post('/ab-tests/:workspaceId/:testId/pause', (req: Request, res: Response) => {
  const { testId } = req.params;
  const success = linkedInABTestingEngine.pauseTest(testId);
  res.json({ success });
});

router.post('/ab-tests/:workspaceId/:testId/resume', (req: Request, res: Response) => {
  const { testId } = req.params;
  const success = linkedInABTestingEngine.resumeTest(testId);
  res.json({ success });
});

router.post('/ab-tests/:workspaceId/:testId/declare-winner', (req: Request, res: Response) => {
  const { testId } = req.params;
  const { variantId } = req.body;
  const success = linkedInABTestingEngine.declareWinner(testId, variantId);
  res.json({ success });
});

router.post('/ab-tests/:workspaceId/:testId/assign', (req: Request, res: Response) => {
  const { testId } = req.params;
  const { prospectId } = req.body;
  const variant = linkedInABTestingEngine.assignVariant(testId, prospectId);
  res.json(variant);
});

router.post('/ab-tests/:workspaceId/:testId/record', (req: Request, res: Response) => {
  const { testId } = req.params;
  const { prospectId, outcome } = req.body;
  linkedInABTestingEngine.recordOutcome(testId, prospectId, outcome);
  res.json({ success: true });
});

router.get('/blacklist/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { search, type } = req.query;
  
  if (search) {
    const results = Blacklist.searchBlacklist(workspaceId, search as string, type as any);
    return res.json(results);
  }
  
  const list = Blacklist.getBlacklist(workspaceId);
  res.json(list);
});

router.post('/blacklist/:workspaceId', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { type, value, reason, source } = req.body;
  const entry = Blacklist.addToBlacklist(workspaceId, type, value, 'system', reason, source);
  res.json(entry);
});

router.delete('/blacklist/:workspaceId/:entryId', (req: Request, res: Response) => {
  const { workspaceId, entryId } = req.params;
  const success = Blacklist.removeFromBlacklist(workspaceId, entryId);
  res.json({ success });
});

router.post('/blacklist/:workspaceId/bulk', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { entries, source } = req.body;
  const result = Blacklist.bulkAddToBlacklist(workspaceId, entries, 'system', source);
  res.json(result);
});

router.post('/blacklist/:workspaceId/check', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const profile = req.body;
  const result = Blacklist.isBlacklisted(workspaceId, profile);
  res.json(result);
});

router.get('/blacklist/:workspaceId/stats', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const stats = Blacklist.getBlacklistStats(workspaceId);
  res.json(stats);
});

router.get('/deduplication/:workspaceId/config', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const config = Blacklist.getDeduplicationConfig(workspaceId);
  res.json(config);
});

router.put('/deduplication/:workspaceId/config', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const config = Blacklist.updateDeduplicationConfig({ workspaceId, ...req.body });
  res.json(config);
});

router.post('/deduplication/:workspaceId/check', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const { campaignId, profile } = req.body;
  const result = Blacklist.checkDuplicate(workspaceId, campaignId, profile);
  res.json(result);
});

router.get('/deduplication/:workspaceId/stats', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const stats = Blacklist.getContactHistoryStats(workspaceId);
  res.json(stats);
});

router.get('/ssi/:workspaceId/:linkedInAccountId', (req: Request, res: Response) => {
  const { workspaceId, linkedInAccountId } = req.params;
  const data = SSITracker.getSSIDashboardData(workspaceId, linkedInAccountId);
  res.json(data);
});

router.post('/ssi/:workspaceId/:linkedInAccountId', (req: Request, res: Response) => {
  const { workspaceId, linkedInAccountId } = req.params;
  const { score, industryRank, networkRank } = req.body;
  const recorded = SSITracker.recordSSIScore(workspaceId, linkedInAccountId, score, industryRank, networkRank);
  res.json(recorded);
});

router.get('/ssi/:workspaceId/:linkedInAccountId/history', (req: Request, res: Response) => {
  const { workspaceId, linkedInAccountId } = req.params;
  const { days } = req.query;
  const history = SSITracker.getSSIHistory(workspaceId, linkedInAccountId, days ? parseInt(days as string) : 30);
  res.json(history);
});

router.get('/ssi/:workspaceId/:linkedInAccountId/trend', (req: Request, res: Response) => {
  const { workspaceId, linkedInAccountId } = req.params;
  const { period } = req.query;
  const trend = SSITracker.calculateSSITrend(workspaceId, linkedInAccountId, (period as '7d' | '30d' | '90d') || '30d');
  res.json(trend);
});

router.post('/ssi/:workspaceId/estimate', (req: Request, res: Response) => {
  const metrics = req.body;
  const estimated = SSITracker.estimateSSI(metrics);
  res.json(estimated);
});

router.get('/ssi/:workspaceId/all', (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const all = SSITracker.getAllSSIScores(workspaceId);
  res.json(all);
});

export default router;
