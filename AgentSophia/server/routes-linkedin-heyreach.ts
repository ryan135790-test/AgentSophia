import { Router } from 'express';
import { linkedInMultiSenderEngine } from './lib/linkedin-multi-sender';
import { linkedInAntiDuplicationEngine, defaultDeduplicationConfig } from './lib/linkedin-anti-duplication';
import { linkedInUnifiedInbox } from './lib/linkedin-unified-inbox';
import { linkedInAdvancedActionsEngine } from './lib/linkedin-advanced-actions';
import { linkedInABTestingEngine } from './lib/linkedin-ab-testing';
import { linkedInTemplateLibrary } from './lib/linkedin-template-library';
import { linkedInSalesNavigatorEngine } from './lib/linkedin-sales-navigator';
import { linkedInWebhookEngine } from './lib/linkedin-webhooks';

const router = Router();

router.get('/multi-sender/stats/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const stats = linkedInMultiSenderEngine.getRotationStats(workspaceId);
  res.json(stats);
});

router.get('/multi-sender/capacity/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const capacity = linkedInMultiSenderEngine.calculateTotalDailyCapacity(workspaceId);
  res.json(capacity);
});

router.post('/multi-sender/distribute-tasks', (req, res) => {
  const { workspaceId, tasks } = req.body;
  const distribution = linkedInMultiSenderEngine.distributeTasksAcrossAccounts(tasks, workspaceId);
  
  const result: Record<string, any[]> = {};
  distribution.forEach((tasks, accountId) => {
    result[accountId] = tasks;
  });
  
  res.json({
    success: true,
    distribution: result,
    accountsUsed: distribution.size,
    totalTasksAssigned: Array.from(distribution.values()).reduce((sum, t) => sum + t.length, 0),
  });
});

router.post('/deduplication/check', (req, res) => {
  const { workspaceId, prospectUrl, actionType, config } = req.body;
  const result = linkedInAntiDuplicationEngine.checkForDuplicate(
    workspaceId,
    prospectUrl,
    actionType,
    config || defaultDeduplicationConfig
  );
  res.json(result);
});

router.post('/deduplication/dedupe-list', (req, res) => {
  const { workspaceId, prospects, config } = req.body;
  const result = linkedInAntiDuplicationEngine.deduplicateProspectList(
    workspaceId,
    prospects,
    config || defaultDeduplicationConfig
  );
  res.json(result);
});

router.post('/deduplication/record', (req, res) => {
  const { record } = req.body;
  linkedInAntiDuplicationEngine.recordOutreach(record);
  res.json({ success: true });
});

router.post('/deduplication/blacklist', (req, res) => {
  const { workspaceId, prospectUrls, global = false } = req.body;
  
  if (global) {
    linkedInAntiDuplicationEngine.addToGlobalBlacklist(prospectUrls);
  } else {
    linkedInAntiDuplicationEngine.addToWorkspaceBlacklist(workspaceId, prospectUrls);
  }
  
  res.json({ success: true, added: prospectUrls.length });
});

router.get('/deduplication/stats/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const stats = linkedInAntiDuplicationEngine.getStats(workspaceId);
  res.json(stats);
});

router.get('/inbox/conversations', (req, res) => {
  const { workspaceId, accountIds, campaignIds, status, isUnread, intent, searchQuery } = req.query;
  
  const filter: any = {
    workspaceId: workspaceId as string,
  };
  
  if (accountIds) filter.accountIds = (accountIds as string).split(',');
  if (campaignIds) filter.campaignIds = (campaignIds as string).split(',');
  if (status) filter.status = (status as string).split(',');
  if (isUnread === 'true') filter.isUnread = true;
  if (intent) filter.intent = (intent as string).split(',');
  if (searchQuery) filter.searchQuery = searchQuery;
  
  const conversations = linkedInUnifiedInbox.getConversations(filter);
  res.json(conversations);
});

router.get('/inbox/conversation/:conversationId/messages', (req, res) => {
  const { conversationId } = req.params;
  const messages = linkedInUnifiedInbox.getConversationMessages(conversationId);
  res.json(messages);
});

router.post('/inbox/conversation/:conversationId/read', (req, res) => {
  const { conversationId } = req.params;
  linkedInUnifiedInbox.markConversationAsRead(conversationId);
  res.json({ success: true });
});

router.post('/inbox/conversation/:conversationId/assign', (req, res) => {
  const { conversationId } = req.params;
  const { userId } = req.body;
  linkedInUnifiedInbox.assignConversation(conversationId, userId);
  res.json({ success: true });
});

router.post('/inbox/conversation/:conversationId/status', (req, res) => {
  const { conversationId } = req.params;
  const { status } = req.body;
  linkedInUnifiedInbox.updateConversationStatus(conversationId, status);
  res.json({ success: true });
});

router.post('/inbox/conversation/:conversationId/priority', (req, res) => {
  const { conversationId } = req.params;
  const { priority } = req.body;
  linkedInUnifiedInbox.updateConversationPriority(conversationId, priority);
  res.json({ success: true });
});

router.post('/inbox/conversation/:conversationId/classify', (req, res) => {
  const { conversationId } = req.params;
  const { classification } = req.body;
  linkedInUnifiedInbox.setAIClassification(conversationId, classification);
  res.json({ success: true });
});

router.get('/inbox/stats/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const stats = linkedInUnifiedInbox.getStats(workspaceId);
  res.json(stats);
});

router.post('/inbox/bulk/assign', (req, res) => {
  const { conversationIds, userId } = req.body;
  linkedInUnifiedInbox.bulkAssign(conversationIds, userId);
  res.json({ success: true, count: conversationIds.length });
});

router.post('/inbox/bulk/archive', (req, res) => {
  const { conversationIds } = req.body;
  linkedInUnifiedInbox.bulkArchive(conversationIds);
  res.json({ success: true, count: conversationIds.length });
});

router.post('/inbox/bulk/read', (req, res) => {
  const { conversationIds } = req.body;
  linkedInUnifiedInbox.bulkMarkAsRead(conversationIds);
  res.json({ success: true, count: conversationIds.length });
});

router.post('/advanced/profile-view', (req, res) => {
  const { campaignId, prospectLinkedInUrl, accountId, scheduledFor, followUpAction, delayBeforeFollowUp } = req.body;
  const action = linkedInAdvancedActionsEngine.scheduleProfileView(
    campaignId,
    prospectLinkedInUrl,
    accountId,
    new Date(scheduledFor),
    followUpAction,
    delayBeforeFollowUp
  );
  res.json(action);
});

router.post('/advanced/post-like', (req, res) => {
  const { campaignId, prospectLinkedInUrl, postUrl, accountId, scheduledFor } = req.body;
  const action = linkedInAdvancedActionsEngine.schedulePostLike(
    campaignId,
    prospectLinkedInUrl,
    postUrl,
    accountId,
    new Date(scheduledFor)
  );
  res.json(action);
});

router.post('/advanced/inmail', (req, res) => {
  const { campaignId, prospectLinkedInUrl, subject, messageContent, accountId, scheduledFor } = req.body;
  const action = linkedInAdvancedActionsEngine.scheduleInMail(
    campaignId,
    prospectLinkedInUrl,
    subject,
    messageContent,
    accountId,
    new Date(scheduledFor)
  );
  res.json(action);
});

router.post('/advanced/subsequence', (req, res) => {
  const { campaignId, name, triggerAfterDays, steps } = req.body;
  const subsequence = linkedInAdvancedActionsEngine.createNotAcceptedSubsequence(
    campaignId,
    name,
    triggerAfterDays,
    steps || linkedInAdvancedActionsEngine.getDefaultNotAcceptedSubsequence()
  );
  res.json(subsequence);
});

router.get('/advanced/pending-actions', (req, res) => {
  const { campaignId } = req.query;
  const actions = linkedInAdvancedActionsEngine.getPendingActions(campaignId as string);
  res.json(actions);
});

router.get('/advanced/stats/:campaignId', (req, res) => {
  const { campaignId } = req.params;
  const stats = linkedInAdvancedActionsEngine.getEngagementStats(campaignId);
  res.json(stats);
});

router.post('/ab-test', (req, res) => {
  const { campaignId, workspaceId, name, testType, variants } = req.body;
  const test = linkedInABTestingEngine.createTest(campaignId, workspaceId, name, testType, variants);
  res.json(test);
});

router.post('/ab-test/:testId/start', (req, res) => {
  const { testId } = req.params;
  const success = linkedInABTestingEngine.startTest(testId);
  res.json({ success });
});

router.post('/ab-test/:testId/pause', (req, res) => {
  const { testId } = req.params;
  const success = linkedInABTestingEngine.pauseTest(testId);
  res.json({ success });
});

router.post('/ab-test/:testId/resume', (req, res) => {
  const { testId } = req.params;
  const success = linkedInABTestingEngine.resumeTest(testId);
  res.json({ success });
});

router.post('/ab-test/:testId/assign', (req, res) => {
  const { testId } = req.params;
  const { prospectId } = req.body;
  const variant = linkedInABTestingEngine.assignVariant(testId, prospectId);
  res.json(variant);
});

router.post('/ab-test/:testId/outcome', (req, res) => {
  const { testId } = req.params;
  const { prospectId, outcome } = req.body;
  linkedInABTestingEngine.recordOutcome(testId, prospectId, outcome);
  res.json({ success: true });
});

router.get('/ab-test/:testId/stats', (req, res) => {
  const { testId } = req.params;
  const stats = linkedInABTestingEngine.getTestStats(testId);
  res.json(stats);
});

router.get('/ab-tests/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const tests = linkedInABTestingEngine.getAllTests(workspaceId);
  res.json(tests);
});

router.post('/ab-test/:testId/declare-winner', (req, res) => {
  const { testId } = req.params;
  const { variantId } = req.body;
  const success = linkedInABTestingEngine.declareWinner(testId, variantId);
  res.json({ success });
});

router.get('/templates', (req, res) => {
  const { workspaceId, category, tags, search } = req.query;
  const templates = linkedInTemplateLibrary.getTemplates(
    workspaceId as string,
    {
      category: category as any,
      tags: tags ? (tags as string).split(',') : undefined,
      search: search as string,
    }
  );
  res.json(templates);
});

router.post('/templates', (req, res) => {
  const template = linkedInTemplateLibrary.createTemplate(req.body);
  res.json(template);
});

router.put('/templates/:templateId', (req, res) => {
  const { templateId } = req.params;
  const template = linkedInTemplateLibrary.updateTemplate(templateId, req.body);
  res.json(template);
});

router.delete('/templates/:templateId', (req, res) => {
  const { templateId } = req.params;
  const success = linkedInTemplateLibrary.deleteTemplate(templateId);
  res.json({ success });
});

router.post('/templates/:templateId/clone', (req, res) => {
  const { templateId } = req.params;
  const { workspaceId, createdBy } = req.body;
  const template = linkedInTemplateLibrary.cloneTemplate(templateId, workspaceId, createdBy);
  res.json(template);
});

router.post('/templates/:templateId/render', (req, res) => {
  const { templateId } = req.params;
  const { data } = req.body;
  const rendered = linkedInTemplateLibrary.renderTemplate(templateId, data);
  res.json({ content: rendered });
});

router.get('/templates/top-performing/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const { category, limit } = req.query;
  const templates = linkedInTemplateLibrary.getTopPerformingTemplates(
    workspaceId,
    category as any,
    limit ? parseInt(limit as string) : 5
  );
  res.json(templates);
});

router.get('/sequences/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const sequences = linkedInTemplateLibrary.getSequences(workspaceId);
  res.json(sequences);
});

router.post('/sequences', (req, res) => {
  const sequence = linkedInTemplateLibrary.createSequence(req.body);
  res.json(sequence);
});

router.post('/sequences/:sequenceId/clone', (req, res) => {
  const { sequenceId } = req.params;
  const { workspaceId, createdBy } = req.body;
  const sequence = linkedInTemplateLibrary.cloneSequence(sequenceId, workspaceId, createdBy);
  res.json(sequence);
});

router.get('/sales-navigator/searches/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const searches = linkedInSalesNavigatorEngine.getSearches(workspaceId);
  res.json(searches);
});

router.post('/sales-navigator/searches', (req, res) => {
  const { workspaceId, name, searchUrl, filters, autoImport, autoImportFrequency } = req.body;
  const search = linkedInSalesNavigatorEngine.createSearch(
    workspaceId,
    name,
    searchUrl,
    filters,
    autoImport,
    autoImportFrequency
  );
  res.json(search);
});

router.post('/sales-navigator/searches/:searchId/import', async (req, res) => {
  const { searchId } = req.params;
  try {
    const result = await linkedInSalesNavigatorEngine.importFromSearch(searchId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/sales-navigator/searches/:searchId', (req, res) => {
  const { searchId } = req.params;
  const success = linkedInSalesNavigatorEngine.deleteSearch(searchId);
  res.json({ success });
});

router.get('/sales-navigator/leads/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const { search, companies, titles, connectionDegree, tags } = req.query;
  
  const leads = linkedInSalesNavigatorEngine.getLeads(workspaceId, {
    search: search as string,
    companies: companies ? (companies as string).split(',') : undefined,
    titles: titles ? (titles as string).split(',') : undefined,
    connectionDegree: connectionDegree ? (connectionDegree as string).split(',') as any : undefined,
    tags: tags ? (tags as string).split(',') : undefined,
  });
  
  res.json(leads);
});

router.post('/sales-navigator/leads/tag', (req, res) => {
  const { workspaceId, linkedInUrls, tag } = req.body;
  const count = linkedInSalesNavigatorEngine.tagLeads(workspaceId, linkedInUrls, tag);
  res.json({ success: true, count });
});

router.get('/sales-navigator/leads/:workspaceId/export', (req, res) => {
  const { workspaceId } = req.params;
  const { format = 'csv' } = req.query;
  const data = linkedInSalesNavigatorEngine.exportLeads(workspaceId, format as 'csv' | 'json');
  
  if (format === 'json') {
    res.json(JSON.parse(data));
  } else {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(data);
  }
});

router.get('/sales-navigator/stats/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const stats = linkedInSalesNavigatorEngine.getStats(workspaceId);
  res.json(stats);
});

router.get('/webhooks/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const endpoints = linkedInWebhookEngine.getEndpoints(workspaceId);
  res.json(endpoints);
});

router.post('/webhooks', (req, res) => {
  const { workspaceId, name, url, events, headers } = req.body;
  const endpoint = linkedInWebhookEngine.createEndpoint(workspaceId, name, url, events, headers);
  res.json(endpoint);
});

router.put('/webhooks/:endpointId', (req, res) => {
  const { endpointId } = req.params;
  const endpoint = linkedInWebhookEngine.updateEndpoint(endpointId, req.body);
  res.json(endpoint);
});

router.delete('/webhooks/:endpointId', (req, res) => {
  const { endpointId } = req.params;
  const success = linkedInWebhookEngine.deleteEndpoint(endpointId);
  res.json({ success });
});

router.post('/webhooks/:endpointId/test', async (req, res) => {
  const { endpointId } = req.params;
  const success = await linkedInWebhookEngine.testEndpoint(endpointId);
  res.json({ success });
});

router.post('/webhooks/:endpointId/regenerate-secret', (req, res) => {
  const { endpointId } = req.params;
  const secret = linkedInWebhookEngine.regenerateSecret(endpointId);
  res.json({ success: !!secret, secret });
});

router.get('/webhooks/:endpointId/events', (req, res) => {
  const { endpointId } = req.params;
  const { limit } = req.query;
  const events = linkedInWebhookEngine.getEventLog(endpointId, limit ? parseInt(limit as string) : 50);
  res.json(events);
});

router.get('/webhooks/stats/:workspaceId', (req, res) => {
  const { workspaceId } = req.params;
  const stats = linkedInWebhookEngine.getStats(workspaceId);
  res.json(stats);
});

router.get('/webhooks/supported-events', (req, res) => {
  const events = linkedInWebhookEngine.getSupportedEvents();
  res.json(events);
});

export default router;
