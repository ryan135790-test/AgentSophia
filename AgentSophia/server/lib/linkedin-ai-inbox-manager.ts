import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type InboxMode = 'manual' | 'copilot' | 'autopilot';

export interface InboxMessage {
  id: string;
  conversationId: string;
  senderName: string;
  senderProfileUrl: string;
  senderHeadline?: string;
  senderCompany?: string;
  content: string;
  timestamp: Date;
  isRead: boolean;
  isReplied: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intent?: 'interested' | 'not_interested' | 'question' | 'meeting_request' | 'objection' | 'spam' | 'unknown';
  priority?: 'high' | 'medium' | 'low';
}

export interface DraftReply {
  id: string;
  messageId: string;
  conversationId: string;
  content: string;
  tone: 'professional' | 'friendly' | 'casual';
  status: 'pending_review' | 'approved' | 'sent' | 'rejected';
  createdAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  editedContent?: string;
}

export interface InboxSettings {
  workspaceId: string;
  mode: InboxMode;
  autoReplyDelay: number;
  responseStyle: 'professional' | 'friendly' | 'casual';
  includeSignature: boolean;
  signature?: string;
  autoClassify: boolean;
  prioritizeHotLeads: boolean;
  excludeKeywords: string[];
  maxAutoRepliesPerDay: number;
  requireApprovalForNegative: boolean;
  notifyOnHighPriority: boolean;
}

const inboxSettings: Map<string, InboxSettings> = new Map();
const messages: Map<string, InboxMessage[]> = new Map();
const drafts: Map<string, DraftReply[]> = new Map();
const autoReplyCount: Map<string, { date: string; count: number }> = new Map();

const anthropic = new Anthropic();
const openai = new OpenAI();

export function getInboxSettings(workspaceId: string): InboxSettings {
  return inboxSettings.get(workspaceId) || {
    workspaceId,
    mode: 'manual',
    autoReplyDelay: 30,
    responseStyle: 'professional',
    includeSignature: true,
    signature: 'Best regards',
    autoClassify: true,
    prioritizeHotLeads: true,
    excludeKeywords: ['unsubscribe', 'spam', 'automated'],
    maxAutoRepliesPerDay: 50,
    requireApprovalForNegative: true,
    notifyOnHighPriority: true,
  };
}

export function updateInboxSettings(workspaceId: string, settings: Partial<InboxSettings>): InboxSettings {
  const current = getInboxSettings(workspaceId);
  const updated = { ...current, ...settings };
  inboxSettings.set(workspaceId, updated);
  return updated;
}

export function setInboxMode(workspaceId: string, mode: InboxMode): InboxSettings {
  return updateInboxSettings(workspaceId, { mode });
}

async function analyzeMessageWithAI(message: InboxMessage): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative';
  intent: 'interested' | 'not_interested' | 'question' | 'meeting_request' | 'objection' | 'spam' | 'unknown';
  priority: 'high' | 'medium' | 'low';
  suggestedAction: string;
}> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Analyze this LinkedIn message and provide classification:

Message from ${message.senderName} (${message.senderHeadline || 'No headline'}):
"${message.content}"

Respond in JSON format:
{
  "sentiment": "positive" | "neutral" | "negative",
  "intent": "interested" | "not_interested" | "question" | "meeting_request" | "objection" | "spam" | "unknown",
  "priority": "high" | "medium" | "low",
  "suggestedAction": "brief action recommendation"
}

Priority guidelines:
- high: meeting requests, strong interest, decision makers
- medium: questions, general interest
- low: casual messages, not interested responses`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('AI analysis failed:', error);
  }

  return {
    sentiment: 'neutral',
    intent: 'unknown',
    priority: 'medium',
    suggestedAction: 'Review manually'
  };
}

async function generateReplyWithAI(
  message: InboxMessage,
  context: {
    senderInfo: any;
    previousMessages: string[];
    responseStyle: 'professional' | 'friendly' | 'casual';
    objective?: string;
  }
): Promise<string> {
  try {
    const styleGuide = {
      professional: 'formal, business-appropriate tone',
      friendly: 'warm and approachable while remaining professional',
      casual: 'conversational and relaxed'
    };

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Generate a LinkedIn reply to this message.

Incoming message from ${message.senderName}:
"${message.content}"

Sender info: ${message.senderHeadline || 'Unknown'} at ${message.senderCompany || 'Unknown company'}

Previous conversation context:
${context.previousMessages.slice(-3).join('\n') || 'First message'}

Response style: ${styleGuide[context.responseStyle]}
${context.objective ? `Objective: ${context.objective}` : ''}

Requirements:
- Keep it concise (2-4 sentences)
- Be authentic and personalized
- If they're interested, move toward a meeting/call
- If they have objections, address them empathetically
- Don't be pushy or salesy

Generate ONLY the reply text, no explanation.`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    return text.trim();
  } catch (error) {
    console.error('Reply generation failed:', error);
    throw new Error('Failed to generate reply');
  }
}

export async function processIncomingMessage(
  workspaceId: string,
  message: InboxMessage
): Promise<{
  classified: InboxMessage;
  draft?: DraftReply;
  autoSent?: boolean;
}> {
  const settings = getInboxSettings(workspaceId);
  let classified = { ...message };

  if (settings.autoClassify) {
    const analysis = await analyzeMessageWithAI(message);
    classified = {
      ...message,
      sentiment: analysis.sentiment,
      intent: analysis.intent,
      priority: analysis.priority,
    };
  }

  const workspaceMessages = messages.get(workspaceId) || [];
  workspaceMessages.push(classified);
  messages.set(workspaceId, workspaceMessages);

  if (settings.mode === 'manual') {
    return { classified };
  }

  const shouldSkip = settings.excludeKeywords.some(
    keyword => message.content.toLowerCase().includes(keyword.toLowerCase())
  );
  if (shouldSkip) {
    return { classified };
  }

  const today = new Date().toISOString().split('T')[0];
  const dailyCount = autoReplyCount.get(workspaceId);
  if (dailyCount?.date === today && dailyCount.count >= settings.maxAutoRepliesPerDay) {
    return { classified };
  }

  const conversationMessages = workspaceMessages
    .filter(m => m.conversationId === message.conversationId)
    .map(m => `${m.senderName}: ${m.content}`);

  const replyContent = await generateReplyWithAI(classified, {
    senderInfo: { headline: message.senderHeadline, company: message.senderCompany },
    previousMessages: conversationMessages,
    responseStyle: settings.responseStyle,
  });

  let finalContent = replyContent;
  if (settings.includeSignature && settings.signature) {
    finalContent = `${replyContent}\n\n${settings.signature}`;
  }

  const draft: DraftReply = {
    id: `draft_${Date.now()}`,
    messageId: message.id,
    conversationId: message.conversationId,
    content: finalContent,
    tone: settings.responseStyle,
    status: 'pending_review',
    createdAt: new Date(),
  };

  if (settings.mode === 'copilot') {
    const workspaceDrafts = drafts.get(workspaceId) || [];
    workspaceDrafts.push(draft);
    drafts.set(workspaceId, workspaceDrafts);
    return { classified, draft };
  }

  if (settings.mode === 'autopilot') {
    const needsApproval = 
      settings.requireApprovalForNegative && 
      (classified.sentiment === 'negative' || classified.intent === 'not_interested');

    if (needsApproval) {
      const workspaceDrafts = drafts.get(workspaceId) || [];
      workspaceDrafts.push(draft);
      drafts.set(workspaceId, workspaceDrafts);
      return { classified, draft };
    }

    draft.status = 'sent';
    
    const currentCount = autoReplyCount.get(workspaceId);
    if (currentCount?.date === today) {
      autoReplyCount.set(workspaceId, { date: today, count: currentCount.count + 1 });
    } else {
      autoReplyCount.set(workspaceId, { date: today, count: 1 });
    }

    return { classified, draft, autoSent: true };
  }

  return { classified };
}

export function getPendingDrafts(workspaceId: string): DraftReply[] {
  const workspaceDrafts = drafts.get(workspaceId) || [];
  return workspaceDrafts.filter(d => d.status === 'pending_review');
}

export function approveDraft(
  workspaceId: string,
  draftId: string,
  userId: string,
  editedContent?: string
): DraftReply | null {
  const workspaceDrafts = drafts.get(workspaceId) || [];
  const draft = workspaceDrafts.find(d => d.id === draftId);
  
  if (!draft) return null;

  draft.status = 'approved';
  draft.approvedAt = new Date();
  draft.approvedBy = userId;
  if (editedContent) {
    draft.editedContent = editedContent;
  }

  return draft;
}

export function rejectDraft(workspaceId: string, draftId: string): DraftReply | null {
  const workspaceDrafts = drafts.get(workspaceId) || [];
  const draft = workspaceDrafts.find(d => d.id === draftId);
  
  if (!draft) return null;
  draft.status = 'rejected';
  return draft;
}

export function getInboxMessages(
  workspaceId: string,
  filters?: {
    unreadOnly?: boolean;
    priority?: 'high' | 'medium' | 'low';
    intent?: string;
    sentiment?: string;
  }
): InboxMessage[] {
  let workspaceMessages = messages.get(workspaceId) || [];

  if (filters?.unreadOnly) {
    workspaceMessages = workspaceMessages.filter(m => !m.isRead);
  }
  if (filters?.priority) {
    workspaceMessages = workspaceMessages.filter(m => m.priority === filters.priority);
  }
  if (filters?.intent) {
    workspaceMessages = workspaceMessages.filter(m => m.intent === filters.intent);
  }
  if (filters?.sentiment) {
    workspaceMessages = workspaceMessages.filter(m => m.sentiment === filters.sentiment);
  }

  const settings = getInboxSettings(workspaceId);
  if (settings.prioritizeHotLeads) {
    workspaceMessages.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority || 'medium'] || 1) - (priorityOrder[b.priority || 'medium'] || 1);
    });
  }

  return workspaceMessages;
}

export function markMessageRead(workspaceId: string, messageId: string): boolean {
  const workspaceMessages = messages.get(workspaceId) || [];
  const message = workspaceMessages.find(m => m.id === messageId);
  if (message) {
    message.isRead = true;
    return true;
  }
  return false;
}

export async function regenerateDraft(
  workspaceId: string,
  draftId: string,
  newTone?: 'professional' | 'friendly' | 'casual'
): Promise<DraftReply | null> {
  const workspaceDrafts = drafts.get(workspaceId) || [];
  const draft = workspaceDrafts.find(d => d.id === draftId);
  
  if (!draft) return null;

  const workspaceMessages = messages.get(workspaceId) || [];
  const originalMessage = workspaceMessages.find(m => m.id === draft.messageId);
  
  if (!originalMessage) return null;

  const conversationMessages = workspaceMessages
    .filter(m => m.conversationId === draft.conversationId)
    .map(m => `${m.senderName}: ${m.content}`);

  const settings = getInboxSettings(workspaceId);
  const tone = newTone || settings.responseStyle;

  const newContent = await generateReplyWithAI(originalMessage, {
    senderInfo: { headline: originalMessage.senderHeadline, company: originalMessage.senderCompany },
    previousMessages: conversationMessages,
    responseStyle: tone,
  });

  draft.content = settings.includeSignature && settings.signature
    ? `${newContent}\n\n${settings.signature}`
    : newContent;
  draft.tone = tone;

  return draft;
}

export function getInboxStats(workspaceId: string): {
  totalMessages: number;
  unreadCount: number;
  highPriority: number;
  pendingDrafts: number;
  autoRepliedToday: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  intentBreakdown: Record<string, number>;
} {
  const workspaceMessages = messages.get(workspaceId) || [];
  const workspaceDrafts = drafts.get(workspaceId) || [];
  const today = new Date().toISOString().split('T')[0];
  const dailyCount = autoReplyCount.get(workspaceId);

  const sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
  const intentBreakdown: Record<string, number> = {};

  workspaceMessages.forEach(m => {
    if (m.sentiment) {
      sentimentBreakdown[m.sentiment]++;
    }
    if (m.intent) {
      intentBreakdown[m.intent] = (intentBreakdown[m.intent] || 0) + 1;
    }
  });

  return {
    totalMessages: workspaceMessages.length,
    unreadCount: workspaceMessages.filter(m => !m.isRead).length,
    highPriority: workspaceMessages.filter(m => m.priority === 'high').length,
    pendingDrafts: workspaceDrafts.filter(d => d.status === 'pending_review').length,
    autoRepliedToday: dailyCount?.date === today ? dailyCount.count : 0,
    sentimentBreakdown,
    intentBreakdown,
  };
}

export const LinkedInAIInboxManager = {
  getSettings: getInboxSettings,
  updateSettings: updateInboxSettings,
  setMode: setInboxMode,
  processMessage: processIncomingMessage,
  getPendingDrafts,
  approveDraft,
  rejectDraft,
  regenerateDraft,
  getMessages: getInboxMessages,
  markRead: markMessageRead,
  getStats: getInboxStats,
};
