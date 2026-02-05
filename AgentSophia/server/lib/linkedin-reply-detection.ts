export interface ReplyDetectionConfig {
  workspaceId: string;
  enabled: boolean;
  stopSequenceOnReply: boolean;
  notifyOnReply: boolean;
  autoTagReplied: boolean;
  replyWindow: number; // hours to check for replies
}

export interface ConversationState {
  contactId: string;
  campaignId: string;
  sequenceStepIndex: number;
  lastMessageSentAt: Date;
  lastMessageContent: string;
  replied: boolean;
  repliedAt?: Date;
  replyContent?: string;
  sequencePaused: boolean;
}

export interface ReplyDetectionResult {
  hasReply: boolean;
  replyContent?: string;
  replyTimestamp?: Date;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intent?: string;
  shouldStopSequence: boolean;
}

const conversationStates = new Map<string, ConversationState>();
const replyConfigs = new Map<string, ReplyDetectionConfig>();

export function getReplyConfig(workspaceId: string): ReplyDetectionConfig {
  return replyConfigs.get(workspaceId) || {
    workspaceId,
    enabled: true,
    stopSequenceOnReply: true,
    notifyOnReply: true,
    autoTagReplied: true,
    replyWindow: 72,
  };
}

export function updateReplyConfig(config: Partial<ReplyDetectionConfig> & { workspaceId: string }): ReplyDetectionConfig {
  const existing = getReplyConfig(config.workspaceId);
  const updated = { ...existing, ...config };
  replyConfigs.set(config.workspaceId, updated);
  return updated;
}

export function trackOutboundMessage(
  contactId: string,
  campaignId: string,
  sequenceStepIndex: number,
  messageContent: string
): ConversationState {
  const key = `${contactId}-${campaignId}`;
  const state: ConversationState = {
    contactId,
    campaignId,
    sequenceStepIndex,
    lastMessageSentAt: new Date(),
    lastMessageContent: messageContent,
    replied: false,
    sequencePaused: false,
  };
  conversationStates.set(key, state);
  return state;
}

export function checkForReply(
  contactId: string,
  campaignId: string,
  inboxMessages: Array<{ content: string; timestamp: Date; isInbound: boolean }>
): ReplyDetectionResult {
  const key = `${contactId}-${campaignId}`;
  const state = conversationStates.get(key);

  if (!state) {
    return { hasReply: false, shouldStopSequence: false };
  }

  const replyMessages = inboxMessages.filter(
    (msg) => msg.isInbound && msg.timestamp > state.lastMessageSentAt
  );

  if (replyMessages.length === 0) {
    return { hasReply: false, shouldStopSequence: false };
  }

  const latestReply = replyMessages[replyMessages.length - 1];
  const sentiment = analyzeSentiment(latestReply.content);
  const intent = detectIntent(latestReply.content);

  state.replied = true;
  state.repliedAt = latestReply.timestamp;
  state.replyContent = latestReply.content;
  state.sequencePaused = true;
  conversationStates.set(key, state);

  return {
    hasReply: true,
    replyContent: latestReply.content,
    replyTimestamp: latestReply.timestamp,
    sentiment,
    intent,
    shouldStopSequence: true,
  };
}

function analyzeSentiment(content: string): 'positive' | 'neutral' | 'negative' {
  const lowerContent = content.toLowerCase();

  const positiveKeywords = [
    'yes', 'sure', 'interested', 'great', 'love', 'sounds good', 'let\'s',
    'excited', 'absolutely', 'perfect', 'thanks', 'thank you', 'appreciate',
    'looking forward', 'happy to', 'definitely', 'would love'
  ];

  const negativeKeywords = [
    'no', 'not interested', 'stop', 'unsubscribe', 'remove', 'spam',
    'don\'t contact', 'leave me alone', 'busy', 'not now', 'pass',
    'no thanks', 'not looking', 'already have', 'not a fit'
  ];

  const positiveCount = positiveKeywords.filter(kw => lowerContent.includes(kw)).length;
  const negativeCount = negativeKeywords.filter(kw => lowerContent.includes(kw)).length;

  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function detectIntent(content: string): string {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('meeting') || lowerContent.includes('call') || lowerContent.includes('schedule')) {
    return 'meeting_request';
  }
  if (lowerContent.includes('price') || lowerContent.includes('cost') || lowerContent.includes('pricing')) {
    return 'pricing_inquiry';
  }
  if (lowerContent.includes('demo') || lowerContent.includes('trial') || lowerContent.includes('show me')) {
    return 'demo_request';
  }
  if (lowerContent.includes('not interested') || lowerContent.includes('no thanks')) {
    return 'rejection';
  }
  if (lowerContent.includes('later') || lowerContent.includes('next month') || lowerContent.includes('reach out')) {
    return 'timing_objection';
  }
  if (lowerContent.includes('?')) {
    return 'question';
  }
  return 'general_response';
}

export function getConversationState(contactId: string, campaignId: string): ConversationState | null {
  const key = `${contactId}-${campaignId}`;
  return conversationStates.get(key) || null;
}

export function resumeSequence(contactId: string, campaignId: string): boolean {
  const key = `${contactId}-${campaignId}`;
  const state = conversationStates.get(key);
  if (state) {
    state.sequencePaused = false;
    conversationStates.set(key, state);
    return true;
  }
  return false;
}

export function getActiveConversations(workspaceId: string): ConversationState[] {
  return Array.from(conversationStates.values()).filter(
    (state) => !state.sequencePaused
  );
}

export function getRepliedConversations(workspaceId: string): ConversationState[] {
  return Array.from(conversationStates.values()).filter(
    (state) => state.replied
  );
}

export function getReplyStats(workspaceId: string): {
  totalTracked: number;
  replied: number;
  replyRate: number;
  positiveReplies: number;
  negativeReplies: number;
  neutralReplies: number;
} {
  const all = Array.from(conversationStates.values());
  const replied = all.filter((s) => s.replied);

  let positive = 0, negative = 0, neutral = 0;
  replied.forEach((r) => {
    if (r.replyContent) {
      const sentiment = analyzeSentiment(r.replyContent);
      if (sentiment === 'positive') positive++;
      else if (sentiment === 'negative') negative++;
      else neutral++;
    }
  });

  return {
    totalTracked: all.length,
    replied: replied.length,
    replyRate: all.length > 0 ? (replied.length / all.length) * 100 : 0,
    positiveReplies: positive,
    negativeReplies: negative,
    neutralReplies: neutral,
  };
}
