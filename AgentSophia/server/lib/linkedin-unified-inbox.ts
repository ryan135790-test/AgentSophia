export interface LinkedInMessage {
  id: string;
  conversationId: string;
  accountId: string;
  accountName: string;
  prospectLinkedInUrl: string;
  prospectName: string;
  prospectHeadline: string;
  prospectAvatarUrl: string | null;
  messageContent: string;
  direction: 'inbound' | 'outbound';
  sentAt: Date;
  readAt: Date | null;
  isRead: boolean;
  campaignId: string | null;
  campaignName: string | null;
  workspaceId: string;
  metadata: {
    isConnectionRequest?: boolean;
    isInMail?: boolean;
    hasAttachment?: boolean;
    replyToMessageId?: string;
  };
}

export interface LinkedInConversation {
  id: string;
  accountId: string;
  accountName: string;
  prospectLinkedInUrl: string;
  prospectName: string;
  prospectHeadline: string;
  prospectAvatarUrl: string | null;
  lastMessageContent: string;
  lastMessageAt: Date;
  lastMessageDirection: 'inbound' | 'outbound';
  unreadCount: number;
  totalMessages: number;
  campaignId: string | null;
  campaignName: string | null;
  workspaceId: string;
  status: 'active' | 'archived' | 'snoozed';
  assignedTo: string | null;
  tags: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  connectionStatus: 'pending' | 'connected' | 'not_connected';
  aiClassification: {
    intent: 'interested' | 'not_interested' | 'question' | 'meeting_request' | 'objection' | 'neutral';
    sentiment: 'positive' | 'negative' | 'neutral';
    urgency: 'low' | 'medium' | 'high';
    suggestedAction: string;
  } | null;
}

export interface InboxFilter {
  workspaceId: string;
  accountIds?: string[];
  campaignIds?: string[];
  status?: LinkedInConversation['status'][];
  assignedTo?: string | null;
  isUnread?: boolean;
  intent?: ('interested' | 'not_interested' | 'question' | 'meeting_request' | 'objection' | 'neutral')[];
  priority?: LinkedInConversation['priority'][];
  tags?: string[];
  searchQuery?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface InboxStats {
  totalConversations: number;
  unreadConversations: number;
  activeConversations: number;
  repliesReceived: number;
  avgResponseTime: number;
  byIntent: Record<string, number>;
  byAccount: Array<{ accountId: string; accountName: string; conversations: number; unread: number }>;
  byCampaign: Array<{ campaignId: string; campaignName: string; conversations: number; replies: number }>;
}

class LinkedInUnifiedInbox {
  private conversations: Map<string, LinkedInConversation> = new Map();
  private messages: Map<string, LinkedInMessage[]> = new Map();

  addMessage(message: LinkedInMessage): LinkedInConversation {
    const conversationId = message.conversationId;
    
    const existingMessages = this.messages.get(conversationId) || [];
    existingMessages.push(message);
    existingMessages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    this.messages.set(conversationId, existingMessages);

    const existingConversation = this.conversations.get(conversationId);
    
    if (existingConversation) {
      existingConversation.lastMessageContent = message.messageContent;
      existingConversation.lastMessageAt = message.sentAt;
      existingConversation.lastMessageDirection = message.direction;
      existingConversation.totalMessages = existingMessages.length;
      
      if (message.direction === 'inbound' && !message.isRead) {
        existingConversation.unreadCount++;
      }
      
      return existingConversation;
    }

    const newConversation: LinkedInConversation = {
      id: conversationId,
      accountId: message.accountId,
      accountName: message.accountName,
      prospectLinkedInUrl: message.prospectLinkedInUrl,
      prospectName: message.prospectName,
      prospectHeadline: message.prospectHeadline,
      prospectAvatarUrl: message.prospectAvatarUrl,
      lastMessageContent: message.messageContent,
      lastMessageAt: message.sentAt,
      lastMessageDirection: message.direction,
      unreadCount: message.direction === 'inbound' && !message.isRead ? 1 : 0,
      totalMessages: 1,
      campaignId: message.campaignId,
      campaignName: message.campaignName,
      workspaceId: message.workspaceId,
      status: 'active',
      assignedTo: null,
      tags: [],
      priority: 'medium',
      connectionStatus: 'connected',
      aiClassification: null,
    };

    this.conversations.set(conversationId, newConversation);
    return newConversation;
  }

  getConversations(filter: InboxFilter): LinkedInConversation[] {
    let results = Array.from(this.conversations.values())
      .filter(c => c.workspaceId === filter.workspaceId);

    if (filter.accountIds?.length) {
      results = results.filter(c => filter.accountIds!.includes(c.accountId));
    }

    if (filter.campaignIds?.length) {
      results = results.filter(c => c.campaignId && filter.campaignIds!.includes(c.campaignId));
    }

    if (filter.status?.length) {
      results = results.filter(c => filter.status!.includes(c.status));
    }

    if (filter.assignedTo !== undefined) {
      results = results.filter(c => c.assignedTo === filter.assignedTo);
    }

    if (filter.isUnread === true) {
      results = results.filter(c => c.unreadCount > 0);
    }

    if (filter.intent?.length && filter.intent.length > 0) {
      results = results.filter(c => 
        c.aiClassification !== null && filter.intent!.includes(c.aiClassification.intent)
      );
    }

    if (filter.priority?.length) {
      results = results.filter(c => filter.priority!.includes(c.priority));
    }

    if (filter.tags?.length) {
      results = results.filter(c => 
        filter.tags!.some(tag => c.tags.includes(tag))
      );
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      results = results.filter(c =>
        c.prospectName.toLowerCase().includes(query) ||
        c.prospectHeadline.toLowerCase().includes(query) ||
        c.lastMessageContent.toLowerCase().includes(query)
      );
    }

    if (filter.dateRange) {
      results = results.filter(c =>
        c.lastMessageAt >= filter.dateRange!.start &&
        c.lastMessageAt <= filter.dateRange!.end
      );
    }

    return results.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  getConversationMessages(conversationId: string): LinkedInMessage[] {
    return this.messages.get(conversationId) || [];
  }

  markConversationAsRead(conversationId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.unreadCount = 0;
    }

    const messages = this.messages.get(conversationId);
    if (messages) {
      messages.forEach(m => {
        if (!m.isRead) {
          m.isRead = true;
          m.readAt = new Date();
        }
      });
    }
  }

  assignConversation(conversationId: string, userId: string | null): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.assignedTo = userId;
    }
  }

  updateConversationStatus(conversationId: string, status: LinkedInConversation['status']): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.status = status;
    }
  }

  updateConversationPriority(conversationId: string, priority: LinkedInConversation['priority']): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.priority = priority;
    }
  }

  addTag(conversationId: string, tag: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation && !conversation.tags.includes(tag)) {
      conversation.tags.push(tag);
    }
  }

  removeTag(conversationId: string, tag: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.tags = conversation.tags.filter(t => t !== tag);
    }
  }

  setAIClassification(
    conversationId: string, 
    classification: LinkedInConversation['aiClassification']
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.aiClassification = classification;
      
      if (classification?.intent === 'meeting_request' || classification?.urgency === 'high') {
        conversation.priority = 'urgent';
      } else if (classification?.intent === 'interested') {
        conversation.priority = 'high';
      }
    }
  }

  getStats(workspaceId: string): InboxStats {
    const conversations = Array.from(this.conversations.values())
      .filter(c => c.workspaceId === workspaceId);

    const byIntent: Record<string, number> = {};
    const accountMap = new Map<string, { accountName: string; conversations: number; unread: number }>();
    const campaignMap = new Map<string, { campaignName: string; conversations: number; replies: number }>();

    let repliesReceived = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const conv of conversations) {
      if (conv.aiClassification?.intent) {
        byIntent[conv.aiClassification.intent] = (byIntent[conv.aiClassification.intent] || 0) + 1;
      }

      const accountStats = accountMap.get(conv.accountId) || { 
        accountName: conv.accountName, 
        conversations: 0, 
        unread: 0 
      };
      accountStats.conversations++;
      accountStats.unread += conv.unreadCount;
      accountMap.set(conv.accountId, accountStats);

      if (conv.campaignId) {
        const campaignStats = campaignMap.get(conv.campaignId) || { 
          campaignName: conv.campaignName || 'Unknown', 
          conversations: 0, 
          replies: 0 
        };
        campaignStats.conversations++;
        if (conv.lastMessageDirection === 'inbound') {
          campaignStats.replies++;
          repliesReceived++;
        }
        campaignMap.set(conv.campaignId, campaignStats);
      }

      const messages = this.messages.get(conv.id) || [];
      for (let i = 1; i < messages.length; i++) {
        if (messages[i].direction === 'inbound' && messages[i-1].direction === 'outbound') {
          const responseTime = messages[i].sentAt.getTime() - messages[i-1].sentAt.getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }
    }

    return {
      totalConversations: conversations.length,
      unreadConversations: conversations.filter(c => c.unreadCount > 0).length,
      activeConversations: conversations.filter(c => c.status === 'active').length,
      repliesReceived,
      avgResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount / 1000 / 60) : 0,
      byIntent,
      byAccount: Array.from(accountMap.entries()).map(([accountId, stats]) => ({
        accountId,
        ...stats,
      })),
      byCampaign: Array.from(campaignMap.entries()).map(([campaignId, stats]) => ({
        campaignId,
        ...stats,
      })),
    };
  }

  bulkAssign(conversationIds: string[], userId: string): void {
    conversationIds.forEach(id => this.assignConversation(id, userId));
  }

  bulkArchive(conversationIds: string[]): void {
    conversationIds.forEach(id => this.updateConversationStatus(id, 'archived'));
  }

  bulkMarkAsRead(conversationIds: string[]): void {
    conversationIds.forEach(id => this.markConversationAsRead(id));
  }

  exportConversations(filter: InboxFilter): Array<{
    prospectName: string;
    prospectLinkedInUrl: string;
    accountName: string;
    campaignName: string;
    lastMessage: string;
    lastMessageAt: string;
    status: string;
    intent: string;
  }> {
    return this.getConversations(filter).map(c => ({
      prospectName: c.prospectName,
      prospectLinkedInUrl: c.prospectLinkedInUrl,
      accountName: c.accountName,
      campaignName: c.campaignName || 'N/A',
      lastMessage: c.lastMessageContent,
      lastMessageAt: c.lastMessageAt.toISOString(),
      status: c.status,
      intent: c.aiClassification?.intent || 'unclassified',
    }));
  }
}

export const linkedInUnifiedInbox = new LinkedInUnifiedInbox();
