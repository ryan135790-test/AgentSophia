interface InboxMessageAnalysis {
  intent: {
    primary: string;
    subtype?: string;
    confidence: number;
  };
  sentiment: {
    type: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'urgent' | 'confused';
    intensity: 'low' | 'medium' | 'high';
    signals: string[];
  };
  urgency: 'low' | 'medium' | 'high' | 'critical';
  buyerSignals: {
    score: number;
    signals: string[];
    stage: 'awareness' | 'interest' | 'consideration' | 'decision' | 'unknown';
  };
  recommendations: {
    suggestedReplies: Array<{
      text: string;
      tone: string;
      rationale: string;
    }>;
    nextActions: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      rationale: string;
      actionType: 'reply' | 'call' | 'schedule' | 'escalate' | 'archive' | 'follow_up' | 'add_to_crm';
    }>;
    sophiaInsight: string;
  };
}

const MEETING_SIGNALS = [
  'call', 'meet', 'meeting', 'schedule', 'calendar', 'demo', 'chat', 'talk',
  'discuss', 'available', 'next week', 'tomorrow', 'this week', 'free time',
  'availability', 'book a time', 'zoom', 'teams', 'coffee'
];

const INTEREST_SIGNALS = [
  'interested', 'tell me more', 'learn more', 'sounds good', 'sounds interesting',
  'intrigued', 'curious', 'want to know', 'love to hear', 'would like',
  'please share', 'send me', 'more info', 'more information', 'details'
];

const PRICING_SIGNALS = [
  'price', 'pricing', 'cost', 'how much', 'budget', 'investment', 'spend',
  'roi', 'return', 'affordable', 'discount', 'package', 'plan', 'tier'
];

const OBJECTION_SIGNALS = [
  'not interested', 'no thanks', 'unsubscribe', 'remove me', 'stop',
  'too expensive', 'not now', 'maybe later', 'not a fit', 'not a good fit',
  'already have', 'using another', 'competitor', 'not the right time'
];

const QUESTION_SIGNALS = [
  'how does', 'what is', 'can you', 'do you', 'does it', 'will it',
  'is there', 'are there', 'why', 'when', 'where', 'who'
];

const DECISION_SIGNALS = [
  'ready to', 'let\'s do it', 'sign up', 'get started', 'move forward',
  'proceed', 'next steps', 'how do we start', 'send contract', 'agreement'
];

const FRUSTRATION_SIGNALS = [
  'frustrated', 'annoying', 'not working', 'broken', 'disappointed',
  'unhappy', 'issue', 'problem', 'bug', 'error', 'doesn\'t work', 'won\'t work'
];

const OUT_OF_OFFICE_SIGNALS = [
  'out of office', 'ooo', 'vacation', 'holiday', 'away', 'returning',
  'back on', 'auto-reply', 'automatic reply', 'limited access'
];

export function analyzeInboxMessage(
  messageText: string,
  senderName?: string,
  channel?: string,
  previousContext?: string
): InboxMessageAnalysis {
  const lowerMessage = messageText.toLowerCase();
  const words = lowerMessage.split(/\s+/);
  
  const intent = detectInboxIntent(lowerMessage);
  const sentiment = detectSentiment(lowerMessage, words);
  const urgency = detectUrgency(lowerMessage, sentiment);
  const buyerSignals = analyzeBuyerSignals(lowerMessage);
  const recommendations = generateRecommendations(intent, sentiment, urgency, buyerSignals, senderName, channel);
  
  return {
    intent,
    sentiment,
    urgency,
    buyerSignals,
    recommendations
  };
}

function detectInboxIntent(message: string): InboxMessageAnalysis['intent'] {
  if (OUT_OF_OFFICE_SIGNALS.some(s => message.includes(s))) {
    return { primary: 'out_of_office', confidence: 0.95 };
  }
  
  if (DECISION_SIGNALS.some(s => message.includes(s))) {
    return { primary: 'ready_to_buy', subtype: 'decision', confidence: 0.9 };
  }
  
  if (MEETING_SIGNALS.filter(s => message.includes(s)).length >= 2) {
    return { primary: 'meeting_request', subtype: 'scheduling', confidence: 0.85 };
  }
  
  if (MEETING_SIGNALS.some(s => message.includes(s)) && /\?/.test(message)) {
    return { primary: 'meeting_request', subtype: 'inquiry', confidence: 0.75 };
  }
  
  if (OBJECTION_SIGNALS.some(s => message.includes(s))) {
    return { primary: 'objection', subtype: 'rejection', confidence: 0.8 };
  }
  
  if (PRICING_SIGNALS.some(s => message.includes(s))) {
    return { primary: 'pricing_inquiry', confidence: 0.85 };
  }
  
  if (INTEREST_SIGNALS.some(s => message.includes(s))) {
    return { primary: 'interest', subtype: 'positive', confidence: 0.8 };
  }
  
  if (FRUSTRATION_SIGNALS.some(s => message.includes(s))) {
    return { primary: 'complaint', subtype: 'frustration', confidence: 0.85 };
  }
  
  if (QUESTION_SIGNALS.some(s => message.startsWith(s)) || message.includes('?')) {
    return { primary: 'question', subtype: 'general', confidence: 0.7 };
  }
  
  if (message.length < 20) {
    if (/^(thanks|thank you|thx|ty)/.test(message)) {
      return { primary: 'acknowledgment', subtype: 'thanks', confidence: 0.9 };
    }
    if (/^(ok|okay|sure|got it|sounds good)/.test(message)) {
      return { primary: 'acknowledgment', subtype: 'confirmation', confidence: 0.85 };
    }
  }
  
  return { primary: 'general', subtype: 'inquiry', confidence: 0.5 };
}

function detectSentiment(message: string, words: string[]): InboxMessageAnalysis['sentiment'] {
  const signals: string[] = [];
  
  const positiveWords = ['thanks', 'thank', 'great', 'awesome', 'love', 'excited', 'happy', 'perfect', 'excellent', 'amazing', 'wonderful', 'appreciate', 'helpful', 'interested'];
  const negativeWords = ['not interested', 'no thanks', 'unsubscribe', 'stop', 'remove', 'disappointed', 'frustrated', 'unhappy', 'annoyed', 'angry'];
  const urgentWords = ['asap', 'urgent', 'immediately', 'right now', 'today', 'deadline', 'critical', 'important', 'rush'];
  
  const positiveCount = positiveWords.filter(w => message.includes(w)).length;
  const negativeCount = negativeWords.filter(w => message.includes(w)).length;
  const urgentCount = urgentWords.filter(w => message.includes(w)).length;
  
  if (FRUSTRATION_SIGNALS.some(s => message.includes(s))) {
    signals.push(...FRUSTRATION_SIGNALS.filter(s => message.includes(s)));
    return { type: 'frustrated', intensity: signals.length >= 2 ? 'high' : 'medium', signals };
  }
  
  if (urgentCount > 0) {
    signals.push(...urgentWords.filter(w => message.includes(w)));
    return { type: 'urgent', intensity: urgentCount >= 2 ? 'high' : 'medium', signals };
  }
  
  if (negativeCount > positiveCount) {
    signals.push(...negativeWords.filter(w => message.includes(w)));
    return { type: 'negative', intensity: negativeCount >= 2 ? 'high' : 'medium', signals };
  }
  
  if (positiveCount > 0) {
    signals.push(...positiveWords.filter(w => message.includes(w)));
    return { type: 'positive', intensity: positiveCount >= 2 ? 'high' : 'medium', signals };
  }
  
  if (message.includes('?') && (message.includes('how') || message.includes('what') || message.includes('why'))) {
    return { type: 'confused', intensity: 'low', signals: ['question_detected'] };
  }
  
  return { type: 'neutral', intensity: 'low', signals: [] };
}

function detectUrgency(message: string, sentiment: InboxMessageAnalysis['sentiment']): InboxMessageAnalysis['urgency'] {
  if (sentiment.type === 'frustrated' && sentiment.intensity === 'high') {
    return 'critical';
  }
  
  if (sentiment.type === 'urgent') {
    return sentiment.intensity === 'high' ? 'critical' : 'high';
  }
  
  if (DECISION_SIGNALS.some(s => message.includes(s))) {
    return 'high';
  }
  
  if (MEETING_SIGNALS.some(s => message.includes(s))) {
    return 'medium';
  }
  
  if (OUT_OF_OFFICE_SIGNALS.some(s => message.includes(s))) {
    return 'low';
  }
  
  return 'low';
}

function analyzeBuyerSignals(message: string): InboxMessageAnalysis['buyerSignals'] {
  const signals: string[] = [];
  let score = 50;
  let stage: InboxMessageAnalysis['buyerSignals']['stage'] = 'unknown';
  
  if (DECISION_SIGNALS.some(s => message.includes(s))) {
    signals.push('Ready to proceed');
    score += 40;
    stage = 'decision';
  }
  
  if (MEETING_SIGNALS.some(s => message.includes(s))) {
    signals.push('Wants to schedule meeting');
    score += 25;
    if (stage === 'unknown') stage = 'consideration';
  }
  
  if (PRICING_SIGNALS.some(s => message.includes(s))) {
    signals.push('Pricing inquiry');
    score += 20;
    if (stage === 'unknown') stage = 'consideration';
  }
  
  if (INTEREST_SIGNALS.some(s => message.includes(s))) {
    signals.push('Shows interest');
    score += 15;
    if (stage === 'unknown') stage = 'interest';
  }
  
  if (QUESTION_SIGNALS.some(s => message.startsWith(s))) {
    signals.push('Asking questions');
    score += 10;
    if (stage === 'unknown') stage = 'awareness';
  }
  
  if (OBJECTION_SIGNALS.some(s => message.includes(s))) {
    signals.push('Objection raised');
    score -= 30;
    stage = 'unknown';
  }
  
  if (OUT_OF_OFFICE_SIGNALS.some(s => message.includes(s))) {
    signals.push('Out of office');
    score = 20;
  }
  
  return {
    score: Math.max(0, Math.min(100, score)),
    signals,
    stage
  };
}

function generateRecommendations(
  intent: InboxMessageAnalysis['intent'],
  sentiment: InboxMessageAnalysis['sentiment'],
  urgency: InboxMessageAnalysis['urgency'],
  buyerSignals: InboxMessageAnalysis['buyerSignals'],
  senderName?: string,
  channel?: string
): InboxMessageAnalysis['recommendations'] {
  const name = senderName?.split(' ')[0] || 'there';
  const suggestedReplies: InboxMessageAnalysis['recommendations']['suggestedReplies'] = [];
  const nextActions: InboxMessageAnalysis['recommendations']['nextActions'] = [];
  let sophiaInsight = '';
  
  switch (intent.primary) {
    case 'meeting_request':
      sophiaInsight = `${senderName || 'This prospect'} wants to schedule a meeting - this is a strong buying signal! Respond quickly to maintain momentum.`;
      suggestedReplies.push(
        {
          text: `Hi ${name}, I'd love to connect! Here are a few times that work for me this week: [Insert 2-3 time slots]. Let me know what works best for you.`,
          tone: 'professional',
          rationale: 'Direct response with specific availability options'
        },
        {
          text: `Thanks for your interest, ${name}! I\'ve opened up some time on my calendar just for you. Book a slot here: [Calendar Link]`,
          tone: 'friendly',
          rationale: 'Self-service booking reduces friction'
        },
        {
          text: `Great to hear from you, ${name}! Quick question before we meet - what's the main challenge you're hoping to solve?`,
          tone: 'consultative',
          rationale: 'Qualifies the lead before the meeting'
        }
      );
      nextActions.push(
        { action: 'Send calendar link', priority: 'high', rationale: 'Capture the meeting request immediately', actionType: 'schedule' },
        { action: 'Add to CRM as qualified lead', priority: 'high', rationale: 'Meeting request indicates strong interest', actionType: 'add_to_crm' }
      );
      break;
      
    case 'ready_to_buy':
      sophiaInsight = `${senderName || 'This prospect'} is showing strong decision-stage signals! This is a hot lead ready to convert.`;
      suggestedReplies.push(
        {
          text: `That's great to hear, ${name}! Let me send over the details right away. Is there anything specific you'd like me to include?`,
          tone: 'enthusiastic',
          rationale: 'Confirms intent and asks for specifics'
        },
        {
          text: `Excellent! I'll prepare everything you need. Would you prefer to go over the details on a quick call, or should I send them via email?`,
          tone: 'professional',
          rationale: 'Offers options to accommodate preference'
        }
      );
      nextActions.push(
        { action: 'Call immediately', priority: 'high', rationale: 'Strike while the iron is hot', actionType: 'call' },
        { action: 'Send proposal/contract', priority: 'high', rationale: 'Move to closing stage', actionType: 'follow_up' },
        { action: 'Update deal stage to Negotiation', priority: 'medium', rationale: 'Track in pipeline', actionType: 'add_to_crm' }
      );
      break;
      
    case 'pricing_inquiry':
      sophiaInsight = `${senderName || 'This prospect'} is asking about pricing - a strong consideration-stage signal. Be transparent but focus on value.`;
      suggestedReplies.push(
        {
          text: `Great question, ${name}! Our pricing is based on [key factors]. For your specific needs, I'd recommend [package/tier]. Would you like me to walk you through the options?`,
          tone: 'helpful',
          rationale: 'Provides context while offering to explain more'
        },
        {
          text: `Thanks for asking, ${name}! I'd love to understand your needs better before quoting. What's the main outcome you're hoping to achieve?`,
          tone: 'consultative',
          rationale: 'Qualifies needs before discussing price'
        }
      );
      nextActions.push(
        { action: 'Send pricing sheet', priority: 'high', rationale: 'Answer their question directly', actionType: 'follow_up' },
        { action: 'Schedule value discovery call', priority: 'medium', rationale: 'Understand needs before quoting', actionType: 'schedule' }
      );
      break;
      
    case 'interest':
      sophiaInsight = `${senderName || 'This prospect'} is showing interest! Nurture this lead with helpful information and move them toward a conversation.`;
      suggestedReplies.push(
        {
          text: `Thanks for your interest, ${name}! I'd be happy to share more. What aspect would be most helpful to learn about first?`,
          tone: 'friendly',
          rationale: 'Opens dialogue and qualifies interest'
        },
        {
          text: `Great to hear, ${name}! Here's a quick overview of how we've helped similar companies: [Brief case study]. Want to see how this could work for you?`,
          tone: 'value-focused',
          rationale: 'Provides social proof and calls to action'
        }
      );
      nextActions.push(
        { action: 'Send relevant case study', priority: 'medium', rationale: 'Build credibility with social proof', actionType: 'follow_up' },
        { action: 'Add to nurture sequence', priority: 'medium', rationale: 'Keep them engaged', actionType: 'add_to_crm' }
      );
      break;
      
    case 'objection':
      sophiaInsight = `${senderName || 'This prospect'} has raised an objection. Handle with care - acknowledge their concern and see if there's an opportunity to address it.`;
      suggestedReplies.push(
        {
          text: `I understand, ${name}. Thanks for letting me know. Just curious - is there anything that might change in the future, or is this a definite no?`,
          tone: 'understanding',
          rationale: 'Acknowledges and leaves door open'
        },
        {
          text: `No problem at all, ${name}. I appreciate you being upfront. If you'd like, I can check back in [timeframe]. Would that be okay?`,
          tone: 'respectful',
          rationale: 'Suggests future follow-up opportunity'
        }
      );
      nextActions.push(
        { action: 'Log objection reason', priority: 'medium', rationale: 'Track for pattern analysis', actionType: 'add_to_crm' },
        { action: 'Schedule re-engagement in 3 months', priority: 'low', rationale: 'Circumstances may change', actionType: 'follow_up' }
      );
      break;
      
    case 'complaint':
      sophiaInsight = `${senderName || 'This person'} is frustrated. Prioritize empathy and quick resolution to salvage the relationship.`;
      suggestedReplies.push(
        {
          text: `I'm really sorry to hear about this, ${name}. This isn't the experience we want you to have. Let me look into this right away and get back to you within [timeframe].`,
          tone: 'empathetic',
          rationale: 'Acknowledges frustration and commits to action'
        },
        {
          text: `Thank you for bringing this to my attention, ${name}. I understand how frustrating this must be. Can I call you directly to resolve this?`,
          tone: 'proactive',
          rationale: 'Offers direct, personal resolution'
        }
      );
      nextActions.push(
        { action: 'Escalate to support team', priority: 'high', rationale: 'Ensure quick resolution', actionType: 'escalate' },
        { action: 'Call to apologize', priority: 'high', rationale: 'Personal touch for damage control', actionType: 'call' }
      );
      break;
      
    case 'question':
      sophiaInsight = `${senderName || 'This prospect'} has questions - an opportunity to demonstrate expertise and build trust.`;
      suggestedReplies.push(
        {
          text: `Great question, ${name}! [Answer their question]. Does that help clarify things? Happy to dive deeper if needed.`,
          tone: 'helpful',
          rationale: 'Direct answer with offer to elaborate'
        }
      );
      nextActions.push(
        { action: 'Provide detailed answer', priority: 'medium', rationale: 'Build trust through helpfulness', actionType: 'reply' },
        { action: 'Send relevant resource', priority: 'low', rationale: 'Add value beyond the question', actionType: 'follow_up' }
      );
      break;
      
    case 'out_of_office':
      sophiaInsight = `This is an auto-reply - ${senderName || 'the contact'} is currently unavailable. Note their return date and follow up then.`;
      nextActions.push(
        { action: 'Schedule follow-up for return date', priority: 'low', rationale: 'Reach out when they\'re back', actionType: 'follow_up' },
        { action: 'Archive for now', priority: 'low', rationale: 'No action needed until they return', actionType: 'archive' }
      );
      break;
      
    case 'acknowledgment':
      sophiaInsight = `${senderName || 'The prospect'} acknowledged your message. The ball is in your court for next steps.`;
      suggestedReplies.push(
        {
          text: `Happy to help, ${name}! Let me know if you have any other questions.`,
          tone: 'friendly',
          rationale: 'Keeps the conversation open'
        }
      );
      nextActions.push(
        { action: 'Schedule follow-up in 3 days', priority: 'low', rationale: 'Keep momentum without being pushy', actionType: 'follow_up' }
      );
      break;
      
    default:
      sophiaInsight = `Analyze this message further to determine the best response approach.`;
      suggestedReplies.push(
        {
          text: `Thanks for reaching out, ${name}! How can I help you today?`,
          tone: 'neutral',
          rationale: 'General response to gather more information'
        }
      );
      nextActions.push(
        { action: 'Reply to gather more context', priority: 'medium', rationale: 'Understand their needs', actionType: 'reply' }
      );
  }
  
  if (urgency === 'critical' || urgency === 'high') {
    nextActions.unshift({
      action: 'Respond within 1 hour',
      priority: 'high',
      rationale: 'High urgency detected - fast response increases conversion',
      actionType: 'reply'
    });
  }
  
  return { suggestedReplies, nextActions, sophiaInsight };
}

const analysisCache = new Map<string, { analysis: InboxMessageAnalysis; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

export function getCachedAnalysis(messageId: string): InboxMessageAnalysis | null {
  const cached = analysisCache.get(messageId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.analysis;
  }
  return null;
}

export function cacheAnalysis(messageId: string, analysis: InboxMessageAnalysis): void {
  analysisCache.set(messageId, { analysis, timestamp: Date.now() });
  
  if (analysisCache.size > 1000) {
    const oldest = Array.from(analysisCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 100);
    oldest.forEach(([key]) => analysisCache.delete(key));
  }
}

export { InboxMessageAnalysis };
