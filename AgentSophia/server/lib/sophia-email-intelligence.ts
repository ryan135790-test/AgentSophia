import OpenAI from 'openai';
import type { 
  EmailThread, SenderProfile, EmailFollowUp, 
  EmailDraftFeedback, UserEmailPreferences, EmailInsight 
} from '../../shared/schema';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// User-scoped in-memory stores (would be database in production)
// Each user has their own isolated data
interface UserDataStore {
  threads: Map<string, EmailThread & { id: string }>;
  senderProfiles: Map<string, SenderProfile & { id: string }>;
  followUps: Map<string, EmailFollowUp & { id: string }>;
  draftFeedback: (EmailDraftFeedback & { id: string })[];
  preferences: (UserEmailPreferences & { id: string }) | null;
  insights: Map<string, EmailInsight & { id: string }>;
}

// Global store keyed by userId
const userStores: Map<string, UserDataStore> = new Map();

function getUserStore(userId: string): UserDataStore {
  if (!userStores.has(userId)) {
    userStores.set(userId, {
      threads: new Map(),
      senderProfiles: new Map(),
      followUps: new Map(),
      draftFeedback: [],
      preferences: null,
      insights: new Map(),
    });
  }
  return userStores.get(userId)!;
}

interface Email {
  id: string;
  from?: { email: string; name?: string };
  to?: { email: string; name?: string }[];
  subject: string;
  body: string;
  receivedAt?: string;
  threadId?: string;
  conversationId?: string;
}

interface ThreadContext {
  thread: EmailThread & { id: string };
  senderProfile: SenderProfile & { id: string };
  previousMessages: { role: 'sent' | 'received'; content: string; date: string }[];
  activeFollowUps: (EmailFollowUp & { id: string })[];
  relatedInsights: (EmailInsight & { id: string })[];
}

interface RequestContext {
  userId: string;
  workspaceId?: string | null;
}

export class SophiaEmailIntelligence {
  // No mutable instance state - all operations require explicit context

  // ============================================
  // THREAD TRACKING
  // ============================================

  private getStore(ctx: RequestContext): UserDataStore {
    if (!ctx.userId) {
      throw new Error('userId is required for email intelligence operations');
    }
    return getUserStore(ctx.userId);
  }

  async trackThread(ctx: RequestContext, email: Email): Promise<EmailThread & { id: string }> {
    const store = this.getStore(ctx);
    const threadId = email.threadId || email.conversationId || `thread-${email.id}`;
    const senderEmail = email.from?.email || 'unknown';
    
    let thread = store.threads.get(threadId);
    
    if (thread) {
      // Update existing thread
      thread.message_count += 1;
      thread.last_message_at = email.receivedAt || new Date().toISOString();
      thread.their_last_reply_at = email.receivedAt || new Date().toISOString();
      thread.status = 'active';
      
      // Add participant if new
      if (!thread.participants.includes(senderEmail)) {
        thread.participants.push(senderEmail);
      }
    } else {
      // Create new thread
      thread = {
        id: threadId,
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId || null,
        thread_id: threadId,
        subject: email.subject,
        participants: [senderEmail],
        message_count: 1,
        last_message_at: email.receivedAt || new Date().toISOString(),
        first_message_at: email.receivedAt || new Date().toISOString(),
        status: 'active',
        auto_follow_up_enabled: false,
        follow_up_count: 0,
        is_negotiation: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.threads.set(threadId, thread);
    }

    return thread;
  }

  async updateThreadStatus(ctx: RequestContext, threadId: string, status: EmailThread['status']): Promise<void> {
    const store = this.getStore(ctx);
    const thread = store.threads.get(threadId);
    if (thread) {
      thread.status = status;
      thread.updated_at = new Date().toISOString();
    }
  }

  async analyzeThread(ctx: RequestContext, threadId: string, messages: { role: 'sent' | 'received'; content: string }[]): Promise<void> {
    const store = this.getStore(ctx);
    const thread = store.threads.get(threadId);
    if (!thread) return;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze this email thread and provide:
1. A brief summary (2-3 sentences)
2. Current intent (sales, support, meeting, negotiation, etc.)
3. Sentiment trend (improving, stable, declining)
4. Whether this is a negotiation
5. If negotiation, what stage (initial, discussing, objections, closing)

Respond in JSON format:
{
  "summary": "...",
  "intent": "...",
  "sentiment_trend": "improving|stable|declining",
  "is_negotiation": true|false,
  "negotiation_stage": "initial|discussing|objections|closing|null"
}`
          },
          {
            role: 'user',
            content: messages.map(m => `[${m.role.toUpperCase()}]: ${m.content}`).join('\n\n')
          }
        ],
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      thread.thread_summary = analysis.summary;
      thread.current_intent = analysis.intent;
      thread.sentiment_trend = analysis.sentiment_trend;
      thread.is_negotiation = analysis.is_negotiation;
      thread.negotiation_stage = analysis.negotiation_stage;
      thread.updated_at = new Date().toISOString();
    } catch (error) {
      console.error('Thread analysis error:', error);
    }
  }

  // ============================================
  // SENDER PROFILES
  // ============================================

  async getOrCreateSenderProfile(ctx: RequestContext, email: string, name?: string): Promise<SenderProfile & { id: string }> {
    const store = this.getStore(ctx);
    let profile = store.senderProfiles.get(email);
    
    if (!profile) {
      profile = {
        id: `profile-${Date.now()}`,
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId || null,
        email_address: email,
        display_name: name || null,
        emails_received: 0,
        emails_sent: 0,
        first_contact_at: new Date().toISOString(),
        last_contact_at: new Date().toISOString(),
        typical_response_days: [],
        typical_response_hours: [],
        relationship_strength: 'new',
        sentiment_history: [],
        key_topics: [],
        is_vip: false,
        priority_level: 'normal',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.senderProfiles.set(email, profile);
    }

    return profile;
  }

  async updateSenderProfile(ctx: RequestContext, email: string, updates: Partial<SenderProfile>): Promise<void> {
    const store = this.getStore(ctx);
    const profile = store.senderProfiles.get(email);
    if (profile) {
      Object.assign(profile, updates, { updated_at: new Date().toISOString() });
    }
  }

  async recordInteraction(ctx: RequestContext, senderEmail: string, type: 'received' | 'sent', sentiment?: 'positive' | 'neutral' | 'negative'): Promise<void> {
    const profile = await this.getOrCreateSenderProfile(ctx, senderEmail);
    
    if (type === 'received') {
      profile.emails_received += 1;
    } else {
      profile.emails_sent += 1;
    }
    
    profile.last_contact_at = new Date().toISOString();
    
    if (sentiment) {
      profile.sentiment_history.push({
        date: new Date().toISOString(),
        sentiment
      });
      // Keep last 20 sentiment records
      if (profile.sentiment_history.length > 20) {
        profile.sentiment_history = profile.sentiment_history.slice(-20);
      }
    }

    // Update relationship strength based on interaction count
    const totalInteractions = profile.emails_received + profile.emails_sent;
    if (totalInteractions >= 20) {
      profile.relationship_strength = 'strong';
    } else if (totalInteractions >= 10) {
      profile.relationship_strength = 'established';
    } else if (totalInteractions >= 3) {
      profile.relationship_strength = 'developing';
    }

    profile.updated_at = new Date().toISOString();
  }

  async analyzeSenderPersonality(ctx: RequestContext, senderEmail: string, emailContent: string): Promise<void> {
    const store = this.getStore(ctx);
    const profile = store.senderProfiles.get(senderEmail);
    if (!profile) return;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze this email to understand the sender's communication style. Provide:
1. Communication style (formal, casual, brief, detailed)
2. Personality notes (professional, friendly, direct, etc.)
3. Key topics they discuss
4. Communication preferences

Respond in JSON:
{
  "style": "formal|casual|brief|detailed",
  "personality_notes": "...",
  "key_topics": ["topic1", "topic2"],
  "communication_preferences": "..."
}`
          },
          { role: 'user', content: emailContent }
        ],
        response_format: { type: 'json_object' }
      });

      const analysis = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      profile.preferred_communication_style = analysis.style;
      profile.personality_notes = analysis.personality_notes;
      profile.communication_preferences = analysis.communication_preferences;
      
      // Merge key topics
      for (const topic of (analysis.key_topics || [])) {
        if (!profile.key_topics.includes(topic)) {
          profile.key_topics.push(topic);
        }
      }
      // Keep last 10 topics
      if (profile.key_topics.length > 10) {
        profile.key_topics = profile.key_topics.slice(-10);
      }

      profile.updated_at = new Date().toISOString();
    } catch (error) {
      console.error('Personality analysis error:', error);
    }
  }

  // ============================================
  // FOLLOW-UP SYSTEM
  // ============================================

  async scheduleFollowUp(ctx: RequestContext, params: {
    emailId: string;
    threadId?: string;
    contactId?: string;
    reminderType: EmailFollowUp['reminder_type'];
    dueAt: Date;
    autoSend?: boolean;
    suggestedMessage?: string;
  }): Promise<EmailFollowUp & { id: string }> {
    const followUp: EmailFollowUp & { id: string } = {
      id: `followup-${Date.now()}`,
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId || null,
      email_id: params.emailId,
      thread_id: params.threadId || null,
      contact_id: params.contactId || null,
      reminder_type: params.reminderType,
      due_at: params.dueAt.toISOString(),
      status: 'pending',
      auto_send: params.autoSend || false,
      suggested_message: params.suggestedMessage || null,
      escalation_level: 1,
      snooze_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const store = this.getStore(ctx);
    store.followUps.set(followUp.id, followUp);
    return followUp;
  }

  async getOverdueFollowUps(ctx: RequestContext): Promise<(EmailFollowUp & { id: string })[]> {
    const store = this.getStore(ctx);
    const now = new Date();
    return Array.from(store.followUps.values()).filter(f => 
      f.status === 'pending' && new Date(f.due_at) <= now
    );
  }

  async snoozeFollowUp(ctx: RequestContext, followUpId: string, until: Date): Promise<void> {
    const store = this.getStore(ctx);
    const followUp = store.followUps.get(followUpId);
    if (followUp) {
      followUp.snoozed_until = until.toISOString();
      followUp.snooze_count += 1;
      followUp.status = 'snoozed';
      followUp.updated_at = new Date().toISOString();
    }
  }

  async completeFollowUp(ctx: RequestContext, followUpId: string): Promise<void> {
    const store = this.getStore(ctx);
    const followUp = store.followUps.get(followUpId);
    if (followUp) {
      followUp.status = 'completed';
      followUp.updated_at = new Date().toISOString();
    }
  }

  async generateFollowUpMessage(threadContext: ThreadContext, escalationLevel: number): Promise<string> {
    const { thread, senderProfile, previousMessages } = threadContext;
    
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Generate a follow-up email for this conversation. This is follow-up attempt #${escalationLevel}.

Sender info:
- Name: ${senderProfile.display_name || 'Unknown'}
- Relationship: ${senderProfile.relationship_strength}
- Communication style: ${senderProfile.preferred_communication_style || 'professional'}

Thread context:
- Subject: ${thread.subject}
- Last interaction: ${thread.last_message_at}
- Intent: ${thread.current_intent || 'unknown'}

Guidelines:
- Keep it brief and professional
- Reference the previous conversation
- Include a clear call to action
- ${escalationLevel > 1 ? 'Add gentle urgency' : 'Be patient and friendly'}
- ${escalationLevel > 2 ? 'Mention this is a final follow-up' : ''}

Return ONLY the email body text, no subject line.`
          },
          {
            role: 'user',
            content: previousMessages.slice(-3).map(m => `[${m.role}]: ${m.content}`).join('\n\n')
          }
        ]
      });

      return response.choices[0]?.message?.content || 'Just following up on my previous email. Please let me know if you have any questions.';
    } catch (error) {
      console.error('Follow-up generation error:', error);
      return 'Just following up on my previous email. Please let me know if you have any questions.';
    }
  }

  // ============================================
  // LEARNING SYSTEM
  // ============================================

  async recordDraftFeedback(ctx: RequestContext, params: {
    originalDraft: string;
    finalVersion: string;
    feedbackType: 'approved' | 'edited' | 'rejected';
    recipientEmail?: string;
    emailType?: string;
  }): Promise<void> {
    // Calculate edit distance (simple version)
    const editDistance = params.feedbackType === 'approved' ? 0 :
      params.feedbackType === 'rejected' ? 100 :
      Math.round((1 - this.similarity(params.originalDraft, params.finalVersion)) * 100);

    const feedback: EmailDraftFeedback & { id: string } = {
      id: `feedback-${Date.now()}`,
      user_id: ctx.userId,
      workspace_id: ctx.workspaceId || null,
      original_draft: params.originalDraft,
      final_version: params.finalVersion,
      feedback_type: params.feedbackType,
      edit_distance: editDistance,
      changes_made: [],
      recipient_email: params.recipientEmail || null,
      email_type: params.emailType || null,
      created_at: new Date().toISOString(),
    };

    // Analyze changes if edited
    if (params.feedbackType === 'edited') {
      feedback.changes_made = await this.analyzeChanges(params.originalDraft, params.finalVersion);
      feedback.learning_extracted = await this.extractLearning(feedback.changes_made);
    }

    const store = this.getStore(ctx);
    store.draftFeedback.push(feedback);

    // Update user preferences based on feedback
    await this.updatePreferencesFromFeedback(ctx, feedback);
  }

  private similarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    return (longer.length - this.editDistanceCalc(longer, shorter)) / longer.length;
  }

  private editDistanceCalc(s1: string, s2: string): number {
    const costs: number[] = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  private async analyzeChanges(original: string, final: string): Promise<EmailDraftFeedback['changes_made']> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze the differences between an original draft and the user's edited version. 
Identify what types of changes were made.

Return JSON array:
[
  { "type": "tone|length|formality|content|structure|greeting|closing", "description": "..." }
]`
          },
          {
            role: 'user',
            content: `ORIGINAL:\n${original}\n\nFINAL:\n${final}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"changes":[]}');
      return result.changes || [];
    } catch (error) {
      return [];
    }
  }

  private async extractLearning(changes: EmailDraftFeedback['changes_made']): Promise<string> {
    if (changes.length === 0) return '';
    
    const learnings = changes.map(c => `User prefers ${c.type} changes: ${c.description}`);
    return learnings.join('; ');
  }

  private async updatePreferencesFromFeedback(ctx: RequestContext, feedback: EmailDraftFeedback & { id: string }): Promise<void> {
    const store = this.getStore(ctx);
    let prefs = store.preferences;
    
    if (!prefs) {
      prefs = {
        id: `prefs-${ctx.userId}`,
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId || null,
        preferred_tone: 'professional',
        preferred_length: 'moderate',
        working_hours_start: 9,
        working_hours_end: 17,
        working_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timezone: 'America/New_York',
        auto_response_enabled: false,
        vacation_mode: false,
        default_follow_up_days: 3,
        max_follow_ups: 3,
        avoid_words: [],
        preferred_phrases: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      store.preferences = prefs;
    }

    // Analyze changes to update preferences
    for (const change of feedback.changes_made) {
      if (change.type === 'tone') {
        // Extract tone preference from description
        if (change.description.toLowerCase().includes('formal')) {
          prefs.preferred_tone = 'formal';
        } else if (change.description.toLowerCase().includes('casual')) {
          prefs.preferred_tone = 'casual';
        } else if (change.description.toLowerCase().includes('friendly')) {
          prefs.preferred_tone = 'friendly';
        }
      }
      if (change.type === 'length') {
        if (change.description.toLowerCase().includes('shorter') || change.description.toLowerCase().includes('brief')) {
          prefs.preferred_length = 'brief';
        } else if (change.description.toLowerCase().includes('longer') || change.description.toLowerCase().includes('detail')) {
          prefs.preferred_length = 'detailed';
        }
      }
    }

    prefs.updated_at = new Date().toISOString();
  }

  getUserPreferences(ctx: RequestContext): (UserEmailPreferences & { id: string }) | null {
    return this.getStore(ctx).preferences;
  }

  // ============================================
  // PROACTIVE INSIGHTS
  // ============================================

  async generateInsights(ctx: RequestContext): Promise<(EmailInsight & { id: string })[]> {
    const store = this.getStore(ctx);
    const insights: (EmailInsight & { id: string })[] = [];
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Check for stale threads
    for (const thread of store.threads.values()) {
      if (thread.status === 'awaiting_reply' && new Date(thread.our_last_reply_at || thread.last_message_at) < threeDaysAgo) {
        const insight: EmailInsight & { id: string } = {
          id: `insight-stale-${thread.id}`,
          user_id: ctx.userId,
          workspace_id: ctx.workspaceId || null,
          insight_type: 'stale_thread',
          title: 'No response received',
          description: `Thread "${thread.subject}" has been waiting for a response for ${Math.round((now.getTime() - new Date(thread.our_last_reply_at || thread.last_message_at).getTime()) / (24 * 60 * 60 * 1000))} days.`,
          severity: 'warning',
          thread_id: thread.thread_id,
          suggested_action: 'Send a follow-up email',
          action_type: 'follow_up',
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        insights.push(insight);
        store.insights.set(insight.id, insight);
      }

      // Check for declining sentiment
      if (thread.sentiment_trend === 'declining') {
        const insight: EmailInsight & { id: string } = {
          id: `insight-sentiment-${thread.id}`,
          user_id: ctx.userId,
          workspace_id: ctx.workspaceId || null,
          insight_type: 'sentiment_drop',
          title: 'Sentiment declining',
          description: `Conversation with "${thread.participants[0]}" shows declining sentiment. May need attention.`,
          severity: 'warning',
          thread_id: thread.thread_id,
          suggested_action: 'Review conversation and consider a personalized outreach',
          action_type: 'reply',
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        insights.push(insight);
        store.insights.set(insight.id, insight);
      }
    }

    // Check for VIPs needing attention
    for (const profile of store.senderProfiles.values()) {
      if (profile.is_vip && new Date(profile.last_contact_at) < sevenDaysAgo) {
        const insight: EmailInsight & { id: string } = {
          id: `insight-vip-${profile.id}`,
          user_id: ctx.userId,
          workspace_id: ctx.workspaceId || null,
          insight_type: 'vip_waiting',
          title: 'VIP needs attention',
          description: `VIP contact ${profile.display_name || profile.email_address} hasn't been contacted in ${Math.round((now.getTime() - new Date(profile.last_contact_at).getTime()) / (24 * 60 * 60 * 1000))} days.`,
          severity: 'urgent',
          sender_email: profile.email_address,
          suggested_action: 'Reach out to maintain relationship',
          action_type: 'reply',
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        insights.push(insight);
        store.insights.set(insight.id, insight);
      }
    }

    // Check for overdue follow-ups
    const overdue = await this.getOverdueFollowUps(ctx);
    for (const followUp of overdue) {
      const insight: EmailInsight & { id: string } = {
        id: `insight-followup-${followUp.id}`,
        user_id: ctx.userId,
        workspace_id: ctx.workspaceId || null,
        insight_type: 'follow_up_overdue',
        title: 'Follow-up overdue',
        description: `A ${followUp.reminder_type} follow-up was due ${Math.round((now.getTime() - new Date(followUp.due_at).getTime()) / (60 * 60 * 1000))} hours ago.`,
        severity: 'warning',
        thread_id: followUp.thread_id || null,
        suggested_action: followUp.suggested_message || 'Send the scheduled follow-up',
        action_type: 'follow_up',
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      insights.push(insight);
      store.insights.set(insight.id, insight);
    }

    return insights;
  }

  async detectFrustration(ctx: RequestContext, emailContent: string, senderEmail: string): Promise<boolean> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Analyze if this email shows signs of frustration, annoyance, or dissatisfaction. Respond with JSON: { "frustrated": true|false, "indicators": ["..."], "severity": "low|medium|high" }'
          },
          { role: 'user', content: emailContent }
        ],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      if (result.frustrated && (result.severity === 'medium' || result.severity === 'high')) {
        // Create insight for frustrated customer
        const insight: EmailInsight & { id: string } = {
          id: `insight-frustrated-${Date.now()}`,
          user_id: ctx.userId,
          workspace_id: ctx.workspaceId || null,
          insight_type: 'frustrated_customer',
          title: 'Customer may be frustrated',
          description: `Detected frustration in email from ${senderEmail}. Indicators: ${result.indicators?.join(', ') || 'tone analysis'}`,
          severity: result.severity === 'high' ? 'urgent' : 'warning',
          sender_email: senderEmail,
          suggested_action: 'Prioritize this response and address concerns directly',
          action_type: 'reply',
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.getStore(ctx).insights.set(insight.id, insight);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async detectOpportunity(ctx: RequestContext, emailContent: string, senderEmail: string): Promise<boolean> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Analyze if this email indicates a sales opportunity (budget discussion, decision timeline, buying signals, expansion interest). Respond with JSON: { "opportunity": true|false, "signals": ["..."], "potential_value": "low|medium|high" }'
          },
          { role: 'user', content: emailContent }
        ],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      if (result.opportunity) {
        const insight: EmailInsight & { id: string } = {
          id: `insight-opportunity-${Date.now()}`,
          user_id: ctx.userId,
          workspace_id: ctx.workspaceId || null,
          insight_type: 'opportunity',
          title: 'Opportunity detected',
          description: `Buying signals detected from ${senderEmail}. Signals: ${result.signals?.join(', ') || 'engagement patterns'}`,
          severity: result.potential_value === 'high' ? 'urgent' : 'info',
          sender_email: senderEmail,
          suggested_action: 'Follow up promptly and consider scheduling a call',
          action_type: 'meeting',
          status: 'new',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.getStore(ctx).insights.set(insight.id, insight);
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  getActiveInsights(ctx: RequestContext): (EmailInsight & { id: string })[] {
    const store = this.getStore(ctx);
    return Array.from(store.insights.values()).filter(i => i.status === 'new' || i.status === 'viewed');
  }

  async dismissInsight(ctx: RequestContext, insightId: string): Promise<void> {
    const store = this.getStore(ctx);
    const insight = store.insights.get(insightId);
    if (insight) {
      insight.status = 'dismissed';
      insight.updated_at = new Date().toISOString();
    }
  }

  async actionInsight(ctx: RequestContext, insightId: string): Promise<void> {
    const store = this.getStore(ctx);
    const insight = store.insights.get(insightId);
    if (insight) {
      insight.status = 'actioned';
      insight.actioned_at = new Date().toISOString();
      insight.updated_at = new Date().toISOString();
    }
  }

  // ============================================
  // CONTEXT-AWARE REPLY GENERATION
  // ============================================

  async generateContextAwareReply(ctx: RequestContext, email: Email): Promise<{
    reply: string;
    context: ThreadContext;
    suggestions: string[];
  }> {
    // Get thread context
    const thread = await this.trackThread(ctx, email);
    const senderProfile = await this.getOrCreateSenderProfile(ctx, email.from?.email || 'unknown', email.from?.name);
    const userPrefs = this.getUserPreferences(ctx);
    
    // Record the interaction
    await this.recordInteraction(ctx, email.from?.email || 'unknown', 'received');

    // Detect frustration and opportunity
    await this.detectFrustration(ctx, email.body, email.from?.email || 'unknown');
    await this.detectOpportunity(ctx, email.body, email.from?.email || 'unknown');

    // Build context
    const store = this.getStore(ctx);
    const context: ThreadContext = {
      thread,
      senderProfile,
      previousMessages: [], // Would be populated from email history
      activeFollowUps: Array.from(store.followUps.values()).filter(f => 
        f.thread_id === thread.thread_id && f.status === 'pending'
      ),
      relatedInsights: Array.from(store.insights.values()).filter(i =>
        i.thread_id === thread.thread_id || i.sender_email === email.from?.email
      ),
    };

    // Generate reply with full context
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional email assistant. Generate a reply based on this context:

SENDER PROFILE:
- Name: ${senderProfile.display_name || 'Unknown'}
- Relationship: ${senderProfile.relationship_strength}
- Communication style: ${senderProfile.preferred_communication_style || 'unknown'}
- Personality: ${senderProfile.personality_notes || 'unknown'}
- Past topics: ${senderProfile.key_topics.join(', ') || 'none'}

THREAD CONTEXT:
- Subject: ${thread.subject}
- Message count: ${thread.message_count}
- Current intent: ${thread.current_intent || 'unknown'}
- Sentiment trend: ${thread.sentiment_trend || 'unknown'}
- Is negotiation: ${thread.is_negotiation}
${thread.is_negotiation ? `- Negotiation stage: ${thread.negotiation_stage}` : ''}

USER PREFERENCES:
- Preferred tone: ${userPrefs?.preferred_tone || 'professional'}
- Preferred length: ${userPrefs?.preferred_length || 'moderate'}
- Signature: ${userPrefs?.signature || 'Best regards'}
${userPrefs?.brand_voice_description ? `- Brand voice: ${userPrefs.brand_voice_description}` : ''}
${userPrefs?.avoid_words?.length ? `- Avoid words: ${userPrefs.avoid_words.join(', ')}` : ''}

ACTIVE INSIGHTS:
${context.relatedInsights.map(i => `- ${i.insight_type}: ${i.title}`).join('\n') || 'None'}

Generate a contextually appropriate reply. Also suggest 2-3 alternative approaches.

Return JSON:
{
  "reply": "The email reply text",
  "suggestions": ["Alternative 1", "Alternative 2"]
}`
          },
          {
            role: 'user',
            content: `Subject: ${email.subject}\n\nFrom: ${email.from?.name || email.from?.email}\n\n${email.body}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        reply: result.reply || 'Thank you for your email. I will review and respond shortly.',
        context,
        suggestions: result.suggestions || []
      };
    } catch (error) {
      console.error('Context-aware reply generation error:', error);
      return {
        reply: 'Thank you for your email. I will review and respond shortly.',
        context,
        suggestions: []
      };
    }
  }

  // ============================================
  // STATS & REPORTING
  // ============================================

  getStats(ctx: RequestContext) {
    const store = this.getStore(ctx);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return {
      threads: {
        total: store.threads.size,
        active: Array.from(store.threads.values()).filter(t => t.status === 'active').length,
        awaiting_reply: Array.from(store.threads.values()).filter(t => t.status === 'awaiting_reply').length,
        stale: Array.from(store.threads.values()).filter(t => t.status === 'stale').length,
      },
      senders: {
        total: store.senderProfiles.size,
        vips: Array.from(store.senderProfiles.values()).filter(p => p.is_vip).length,
        new_this_week: Array.from(store.senderProfiles.values()).filter(p => new Date(p.first_contact_at) > oneWeekAgo).length,
      },
      followUps: {
        pending: Array.from(store.followUps.values()).filter(f => f.status === 'pending').length,
        overdue: Array.from(store.followUps.values()).filter(f => f.status === 'pending' && new Date(f.due_at) < now).length,
        completed_today: Array.from(store.followUps.values()).filter(f => 
          f.status === 'completed' && new Date(f.updated_at || f.created_at) > oneDayAgo
        ).length,
      },
      insights: {
        active: Array.from(store.insights.values()).filter(i => i.status === 'new').length,
        urgent: Array.from(store.insights.values()).filter(i => i.status === 'new' && i.severity === 'urgent').length,
      },
      learning: {
        feedback_count: store.draftFeedback.length,
        approval_rate: store.draftFeedback.length > 0 
          ? Math.round(store.draftFeedback.filter(f => f.feedback_type === 'approved').length / store.draftFeedback.length * 100)
          : 0,
      }
    };
  }
}

export const sophiaEmailIntelligence = new SophiaEmailIntelligence();
