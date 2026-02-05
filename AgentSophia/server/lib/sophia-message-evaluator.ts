interface MessageIntent {
  primary: 'question' | 'request' | 'command' | 'feedback' | 'greeting' | 'complaint' | 'clarification' | 'confirmation';
  subtype?: string;
}

interface EmotionalTone {
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'urgent' | 'confused';
  intensity: 'low' | 'medium' | 'high';
  signals: string[];
}

interface ConversationContext {
  turnCount: number;
  topicsDiscussed: string[];
  pendingQuestions: string[];
  userPreferences: Record<string, any>;
  lastActionTaken?: string;
  awaitingResponse?: 'yes_no' | 'selection' | 'input' | 'confirmation' | null;
}

interface MessageAnalysis {
  intent: MessageIntent;
  tone: EmotionalTone;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  complexity: 'simple' | 'moderate' | 'complex';
  topics: string[];
  entities: {
    channels: string[];
    features: string[];
    metrics: string[];
    timeframes: string[];
  };
  requiresAction: boolean;
  suggestedResponseStyle: ResponseStyle;
}

interface ResponseStyle {
  tone: 'professional' | 'friendly' | 'empathetic' | 'direct' | 'enthusiastic';
  verbosity: 'concise' | 'moderate' | 'detailed';
  includeExamples: boolean;
  includeOptions: boolean;
  includeMetrics: boolean;
  prioritizeAction: boolean;
  acknowledgeEmotion: boolean;
}

interface ConversationState {
  userId: string;
  sessionId: string;
  context: ConversationContext;
  recentAnalyses: MessageAnalysis[];
  adaptedBehavior: {
    preferredTone: string;
    preferredVerbosity: string;
    topicExpertise: string[];
  };
}

const conversationStates = new Map<string, ConversationState>();

const FRUSTRATION_SIGNALS = [
  'not working', 'doesn\'t work', 'broken', 'frustrated', 'annoying',
  'why isn\'t', 'why doesn\'t', 'still not', 'keeps failing', 'waste of time',
  'terrible', 'horrible', 'useless', 'stuck', 'again', 'same problem',
  'already told you', 'i said', 'wrong', 'incorrect', 'that\'s not what',
  '!!!', '???', 'ugh', 'seriously', 'come on'
];

const URGENCY_SIGNALS = [
  'asap', 'urgent', 'immediately', 'right now', 'quickly', 'hurry',
  'deadline', 'today', 'now', 'emergency', 'critical', 'important',
  'need this', 'must have', 'can\'t wait', 'time sensitive', 'priority'
];

const CONFUSION_SIGNALS = [
  'confused', 'don\'t understand', 'unclear', 'what do you mean',
  'how does', 'what is', 'can you explain', 'i\'m lost', 'help me understand',
  'not sure', 'which one', 'difference between', 'why would'
];

const POSITIVE_SIGNALS = [
  'thanks', 'thank you', 'great', 'awesome', 'perfect', 'love it',
  'excellent', 'amazing', 'wonderful', 'appreciate', 'helpful', 'good job',
  'works great', 'exactly what', 'this is great'
];

const COMMAND_VERBS = [
  'create', 'build', 'make', 'send', 'launch', 'start', 'stop', 'pause',
  'delete', 'remove', 'update', 'change', 'modify', 'set', 'configure',
  'schedule', 'automate', 'generate', 'analyze', 'optimize', 'improve'
];

const CHANNEL_KEYWORDS = ['email', 'linkedin', 'sms', 'phone', 'whatsapp', 'call', 'message', 'voicemail'];
const FEATURE_KEYWORDS = ['campaign', 'workflow', 'automation', 'sequence', 'template', 'inbox', 'analytics', 'report', 'lead', 'contact', 'pipeline', 'deal'];
const METRIC_KEYWORDS = ['rate', 'conversion', 'open', 'click', 'reply', 'engagement', 'roi', 'revenue', 'performance', 'score'];
const TIME_KEYWORDS = ['today', 'yesterday', 'this week', 'last week', 'this month', 'last month', 'quarter', 'year', 'days', 'hours'];

export function analyzeUserMessage(
  message: string,
  conversationHistory: Array<{ role: string; content: string }>,
  sessionId: string
): MessageAnalysis {
  const lowerMessage = message.toLowerCase();
  const words = lowerMessage.split(/\s+/);
  
  const intent = detectIntent(lowerMessage, words);
  const tone = detectEmotionalTone(lowerMessage, words);
  const urgency = detectUrgency(lowerMessage, words, tone);
  const complexity = assessComplexity(message, conversationHistory);
  const topics = extractTopics(lowerMessage);
  const entities = extractEntities(lowerMessage);
  const requiresAction = determineIfActionRequired(intent, lowerMessage);
  
  const suggestedResponseStyle = calibrateResponseStyle(intent, tone, urgency, complexity, conversationHistory, sessionId);
  
  const analysis: MessageAnalysis = {
    intent,
    tone,
    urgency,
    complexity,
    topics,
    entities,
    requiresAction,
    suggestedResponseStyle
  };
  
  updateConversationState(sessionId, analysis, conversationHistory);
  
  return analysis;
}

function detectIntent(message: string, words: string[]): MessageIntent {
  const endsWithQuestion = message.trim().endsWith('?');
  const startsWithQuestion = /^(what|how|why|when|where|who|which|can|could|would|should|is|are|do|does|will)/i.test(message);
  
  if (endsWithQuestion || startsWithQuestion) {
    if (/how (do|can|to|should)/i.test(message)) {
      return { primary: 'question', subtype: 'how_to' };
    }
    if (/what (is|are|does|do)/i.test(message)) {
      return { primary: 'question', subtype: 'definition' };
    }
    if (/why/i.test(message)) {
      return { primary: 'question', subtype: 'explanation' };
    }
    if (/can you|could you|would you/i.test(message)) {
      return { primary: 'request', subtype: 'polite_request' };
    }
    return { primary: 'question', subtype: 'general' };
  }
  
  if (COMMAND_VERBS.some(verb => message.startsWith(verb) || words.includes(verb))) {
    return { primary: 'command', subtype: 'action' };
  }
  
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)/i.test(message)) {
    return { primary: 'greeting' };
  }
  
  if (/^(yes|no|yeah|nope|correct|incorrect|right|wrong|ok|okay|sure|sounds good)/i.test(message)) {
    return { primary: 'confirmation' };
  }
  
  if (FRUSTRATION_SIGNALS.some(signal => message.includes(signal))) {
    return { primary: 'complaint', subtype: 'frustration' };
  }
  
  if (/i meant|what i meant|to clarify|let me clarify|actually/i.test(message)) {
    return { primary: 'clarification' };
  }
  
  if (/looks good|great work|love it|perfect|thanks/i.test(message)) {
    return { primary: 'feedback', subtype: 'positive' };
  }
  
  if (words.length > 3 && COMMAND_VERBS.some(verb => words.includes(verb))) {
    return { primary: 'request', subtype: 'action_request' };
  }
  
  return { primary: 'request', subtype: 'general' };
}

function detectEmotionalTone(message: string, words: string[]): EmotionalTone {
  const signals: string[] = [];
  let sentiment: EmotionalTone['sentiment'] = 'neutral';
  let intensity: EmotionalTone['intensity'] = 'low';
  
  const frustrationCount = FRUSTRATION_SIGNALS.filter(s => message.includes(s)).length;
  if (frustrationCount > 0) {
    signals.push(...FRUSTRATION_SIGNALS.filter(s => message.includes(s)));
    sentiment = 'frustrated';
    intensity = frustrationCount >= 2 ? 'high' : 'medium';
  }
  
  const urgencyCount = URGENCY_SIGNALS.filter(s => message.includes(s)).length;
  if (urgencyCount > 0 && sentiment !== 'frustrated') {
    signals.push(...URGENCY_SIGNALS.filter(s => message.includes(s)));
    sentiment = 'urgent';
    intensity = urgencyCount >= 2 ? 'high' : 'medium';
  }
  
  const confusionCount = CONFUSION_SIGNALS.filter(s => message.includes(s)).length;
  if (confusionCount > 0 && sentiment === 'neutral') {
    signals.push(...CONFUSION_SIGNALS.filter(s => message.includes(s)));
    sentiment = 'confused';
    intensity = 'medium';
  }
  
  const positiveCount = POSITIVE_SIGNALS.filter(s => message.includes(s)).length;
  if (positiveCount > 0 && sentiment === 'neutral') {
    signals.push(...POSITIVE_SIGNALS.filter(s => message.includes(s)));
    sentiment = 'positive';
    intensity = positiveCount >= 2 ? 'high' : 'medium';
  }
  
  const exclamationCount = (message.match(/!/g) || []).length;
  const capsRatio = (message.match(/[A-Z]/g) || []).length / message.length;
  if (exclamationCount >= 2 || capsRatio > 0.5) {
    intensity = 'high';
    if (sentiment === 'neutral') {
      signals.push('emphasis_detected');
    }
  }
  
  return { sentiment, intensity, signals };
}

function detectUrgency(message: string, words: string[], tone: EmotionalTone): MessageAnalysis['urgency'] {
  if (tone.sentiment === 'frustrated' && tone.intensity === 'high') {
    return 'critical';
  }
  
  const urgencySignalCount = URGENCY_SIGNALS.filter(s => message.includes(s)).length;
  
  if (urgencySignalCount >= 2 || /asap|emergency|critical/i.test(message)) {
    return 'critical';
  }
  if (urgencySignalCount >= 1 || tone.sentiment === 'urgent') {
    return 'high';
  }
  if (/soon|quickly|when possible/i.test(message)) {
    return 'medium';
  }
  
  return 'low';
}

function assessComplexity(message: string, history: Array<{ role: string; content: string }>): MessageAnalysis['complexity'] {
  const wordCount = message.split(/\s+/).length;
  const hasMultipleRequests = (message.match(/\band\b|\balso\b|\bplus\b|\badditionally\b/gi) || []).length;
  const hasConditionals = /if|when|unless|depending/i.test(message);
  const hasMultipleChannels = CHANNEL_KEYWORDS.filter(ch => message.toLowerCase().includes(ch)).length;
  
  let complexityScore = 0;
  if (wordCount > 50) complexityScore += 2;
  else if (wordCount > 20) complexityScore += 1;
  if (hasMultipleRequests >= 2) complexityScore += 2;
  if (hasConditionals) complexityScore += 1;
  if (hasMultipleChannels >= 2) complexityScore += 1;
  
  if (complexityScore >= 4) return 'complex';
  if (complexityScore >= 2) return 'moderate';
  return 'simple';
}

function extractTopics(message: string): string[] {
  const topics: string[] = [];
  
  if (CHANNEL_KEYWORDS.some(ch => message.includes(ch))) topics.push('channels');
  if (/campaign|sequence|workflow/i.test(message)) topics.push('campaigns');
  if (/lead|contact|prospect/i.test(message)) topics.push('leads');
  if (/inbox|message|reply|response/i.test(message)) topics.push('inbox');
  if (/analytics|report|metric|performance/i.test(message)) topics.push('analytics');
  if (/schedule|meeting|calendar|book/i.test(message)) topics.push('scheduling');
  if (/automate|automation|workflow/i.test(message)) topics.push('automation');
  if (/template|copy|content/i.test(message)) topics.push('content');
  if (/integration|connect|sync/i.test(message)) topics.push('integrations');
  if (/setting|config|preference/i.test(message)) topics.push('settings');
  
  return topics;
}

function extractEntities(message: string): MessageAnalysis['entities'] {
  return {
    channels: CHANNEL_KEYWORDS.filter(ch => message.includes(ch)),
    features: FEATURE_KEYWORDS.filter(f => message.includes(f)),
    metrics: METRIC_KEYWORDS.filter(m => message.includes(m)),
    timeframes: TIME_KEYWORDS.filter(t => message.includes(t))
  };
}

function determineIfActionRequired(intent: MessageIntent, message: string): boolean {
  if (intent.primary === 'command') return true;
  if (intent.primary === 'request' && intent.subtype === 'action_request') return true;
  if (COMMAND_VERBS.some(verb => message.includes(verb))) return true;
  return false;
}

function calibrateResponseStyle(
  intent: MessageIntent,
  tone: EmotionalTone,
  urgency: MessageAnalysis['urgency'],
  complexity: MessageAnalysis['complexity'],
  history: Array<{ role: string; content: string }>,
  sessionId: string
): ResponseStyle {
  const state = conversationStates.get(sessionId);
  
  let responseTone: ResponseStyle['tone'] = 'professional';
  let verbosity: ResponseStyle['verbosity'] = 'moderate';
  let includeExamples = false;
  let includeOptions = false;
  let includeMetrics = false;
  let prioritizeAction = false;
  let acknowledgeEmotion = false;
  
  if (tone.sentiment === 'frustrated') {
    responseTone = 'empathetic';
    acknowledgeEmotion = true;
    prioritizeAction = true;
    verbosity = 'concise';
  } else if (tone.sentiment === 'confused') {
    responseTone = 'friendly';
    includeExamples = true;
    verbosity = 'detailed';
  } else if (tone.sentiment === 'positive') {
    responseTone = 'enthusiastic';
  } else if (tone.sentiment === 'urgent') {
    responseTone = 'direct';
    prioritizeAction = true;
    verbosity = 'concise';
  }
  
  if (urgency === 'critical' || urgency === 'high') {
    prioritizeAction = true;
    verbosity = 'concise';
  }
  
  if (intent.primary === 'question') {
    if (intent.subtype === 'how_to') {
      includeExamples = true;
      verbosity = 'detailed';
    } else if (intent.subtype === 'definition') {
      verbosity = 'moderate';
    }
  }
  
  if (intent.primary === 'command') {
    prioritizeAction = true;
    verbosity = 'concise';
  }
  
  if (complexity === 'complex') {
    includeOptions = true;
    verbosity = 'detailed';
  }
  
  if (state?.adaptedBehavior) {
    if (state.adaptedBehavior.preferredTone) {
      responseTone = state.adaptedBehavior.preferredTone as ResponseStyle['tone'];
    }
    if (state.adaptedBehavior.preferredVerbosity) {
      verbosity = state.adaptedBehavior.preferredVerbosity as ResponseStyle['verbosity'];
    }
  }
  
  return {
    tone: responseTone,
    verbosity,
    includeExamples,
    includeOptions,
    includeMetrics,
    prioritizeAction,
    acknowledgeEmotion
  };
}

function updateConversationState(
  sessionId: string,
  analysis: MessageAnalysis,
  history: Array<{ role: string; content: string }>
): void {
  let state = conversationStates.get(sessionId);
  
  if (!state) {
    state = {
      userId: '',
      sessionId,
      context: {
        turnCount: 0,
        topicsDiscussed: [],
        pendingQuestions: [],
        userPreferences: {}
      },
      recentAnalyses: [],
      adaptedBehavior: {
        preferredTone: 'professional',
        preferredVerbosity: 'moderate',
        topicExpertise: []
      }
    };
  }
  
  state.context.turnCount++;
  state.context.topicsDiscussed = [...new Set([...state.context.topicsDiscussed, ...analysis.topics])];
  state.recentAnalyses = [...state.recentAnalyses.slice(-4), analysis];
  
  const recentTones = state.recentAnalyses.map(a => a.suggestedResponseStyle.tone);
  const toneCounts = recentTones.reduce((acc, tone) => {
    acc[tone] = (acc[tone] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const mostCommonTone = Object.entries(toneCounts).sort((a, b) => b[1] - a[1])[0];
  if (mostCommonTone && mostCommonTone[1] >= 2) {
    state.adaptedBehavior.preferredTone = mostCommonTone[0];
  }
  
  conversationStates.set(sessionId, state);
}

export function generateDynamicSystemPromptAddition(analysis: MessageAnalysis): string {
  const additions: string[] = [];
  
  additions.push(`\n\n## CURRENT MESSAGE CONTEXT:`);
  additions.push(`- User intent: ${analysis.intent.primary}${analysis.intent.subtype ? ` (${analysis.intent.subtype})` : ''}`);
  additions.push(`- Emotional tone: ${analysis.tone.sentiment} (intensity: ${analysis.tone.intensity})`);
  additions.push(`- Urgency level: ${analysis.urgency}`);
  additions.push(`- Complexity: ${analysis.complexity}`);
  
  if (analysis.topics.length > 0) {
    additions.push(`- Topics being discussed: ${analysis.topics.join(', ')}`);
  }
  
  additions.push(`\n## RESPONSE CALIBRATION (MANDATORY):`);
  
  if (analysis.suggestedResponseStyle.acknowledgeEmotion) {
    additions.push(`- FIRST: Acknowledge the user's ${analysis.tone.sentiment} tone with empathy before addressing their request`);
  }
  
  if (analysis.suggestedResponseStyle.prioritizeAction) {
    additions.push(`- PRIORITIZE: Lead with the action/solution, then explain`);
  }
  
  switch (analysis.suggestedResponseStyle.tone) {
    case 'empathetic':
      additions.push(`- TONE: Be understanding and supportive. Acknowledge their frustration. Focus on resolution.`);
      break;
    case 'direct':
      additions.push(`- TONE: Be concise and action-focused. Skip pleasantries. Get straight to the point.`);
      break;
    case 'friendly':
      additions.push(`- TONE: Be warm and approachable. Use conversational language.`);
      break;
    case 'enthusiastic':
      additions.push(`- TONE: Be positive and encouraging. Celebrate their progress.`);
      break;
    default:
      additions.push(`- TONE: Maintain professional but approachable demeanor.`);
  }
  
  switch (analysis.suggestedResponseStyle.verbosity) {
    case 'concise':
      additions.push(`- LENGTH: Keep response brief and focused. Maximum 2-3 short paragraphs.`);
      break;
    case 'detailed':
      additions.push(`- LENGTH: Provide thorough explanation with context. Include step-by-step guidance if needed.`);
      break;
    default:
      additions.push(`- LENGTH: Moderate detail - enough to be helpful without overwhelming.`);
  }
  
  if (analysis.suggestedResponseStyle.includeExamples) {
    additions.push(`- EXAMPLES: Include concrete examples to illustrate your points.`);
  }
  
  if (analysis.suggestedResponseStyle.includeOptions) {
    additions.push(`- OPTIONS: Present clear choices/options for the user to select from.`);
  }
  
  if (analysis.requiresAction) {
    additions.push(`- ACTION REQUIRED: User expects you to DO something, not just explain. Take action or clearly state what you're doing.`);
  }
  
  if (analysis.intent.primary === 'clarification') {
    additions.push(`- CLARIFICATION: User is correcting or clarifying something. Acknowledge the correction gracefully and adjust accordingly.`);
  }
  
  if (analysis.intent.primary === 'confirmation') {
    additions.push(`- CONFIRMATION: User is responding to a previous question. Process their answer and move forward.`);
  }
  
  return additions.join('\n');
}

export function getConversationState(sessionId: string): ConversationState | undefined {
  return conversationStates.get(sessionId);
}

export function clearConversationState(sessionId: string): void {
  conversationStates.delete(sessionId);
}

export { MessageAnalysis, ResponseStyle, ConversationState };
