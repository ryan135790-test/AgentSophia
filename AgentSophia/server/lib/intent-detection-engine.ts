/**
 * Intent Detection Engine
 * Analyzes messages to determine prospect intent
 */

export type IntentType = 
  | 'interested' 
  | 'not_interested' 
  | 'meeting_request' 
  | 'information_needed' 
  | 'price_inquiry' 
  | 'follow_up_needed' 
  | 'meeting_scheduled';

export interface DetectedIntent {
  intent: IntentType;
  confidence: number; // 0-100
  keywords: string[];
  reasoning: string;
  suggested_action: string;
}

const INTENT_PATTERNS: Record<IntentType, {keywords: string[], patterns: RegExp[]}> = {
  interested: {
    keywords: ['interested', 'love', 'great', 'perfect', 'exactly what', 'sounds good', 'let\s+me', 'tell me more'],
    patterns: [
      /interested|love\s+(this|it)|sounds\s+great|that\s+sounds\s+perfect|exactly\s+what|sounds\s+good|tell\s+me\s+more/i,
      /let\s+me\s+learn|want\s+to\s+know/i
    ]
  },
  not_interested: {
    keywords: ['not interested', 'not for us', 'wrong time', 'not a fit', 'not applicable', 'unsubscribe', 'remove'],
    patterns: [
      /not\s+interested|not\s+for\s+us|wrong\s+time|not\s+a\s+(fit|match)|not\s+applicable/i,
      /unsubscribe|remove\s+me|stop\s+emailing|no\s+thanks|pass/i
    ]
  },
  meeting_request: {
    keywords: ['meeting', 'call', 'demo', 'chat', 'discuss', 'walk through', 'show you', 'calendar', 'schedule'],
    patterns: [
      /let'?s\s+(meet|call|chat|discuss)|would\s+(love|like)\s+to\s+(meet|call)/i,
      /schedule\s+a|book\s+a|set\s+up\s+a|let'?s\s+do\s+a|(demo|call|meeting|chat)/i,
      /what'?s\s+your\s+(availability|calendar|schedule)/i
    ]
  },
  information_needed: {
    keywords: ['price', 'cost', 'details', 'information', 'features', 'how does', 'more info', 'learn'],
    patterns: [
      /what'?s\s+(the\s+)?(price|cost|pricing)|how\s+much|details|more\s+information|more\s+info/i,
      /what\s+are\s+the\s+(features|capabilities)|how\s+does\s+it\s+work|tell\s+me\s+about/i
    ]
  },
  price_inquiry: {
    keywords: ['price', 'pricing', 'cost', 'rate', 'budget', 'investment', 'fee'],
    patterns: [
      /price|pricing|cost|how\s+much|what'?s\s+the\s+rate|budget|investment|fee\s+/i
    ]
  },
  follow_up_needed: {
    keywords: ['later', 'next week', 'next month', 'will review', 'will get back', 'thinking'],
    patterns: [
      /let\s+me\s+(think|review|consider)|will\s+(get\s+)?back\s+to\s+you|think\s+about\s+it/i,
      /next\s+(week|month)|in\s+a\s+few\s+(days|weeks)/i
    ]
  },
  meeting_scheduled: {
    keywords: ['confirmed', 'scheduled', 'on calendar', 'tuesday', 'wednesday', 'thursday', 'friday', '@'],
    patterns: [
      /confirmed|scheduled|on\s+calendar|thanks\s+for\s+(scheduling|the\s+meeting)/i,
      /(mon|tue|wed|thu|fri|saturday|sunday).{0,20}(at|@).{0,20}(am|pm)/i
    ]
  }
};

const CONFIDENCE_MULTIPLIERS = {
  keyword_match: 20,
  pattern_match: 50,
  multiple_keywords: 15,
  urgency_words: 10
};

/**
 * Detect intent from message content
 */
export function detectIntent(message: string): DetectedIntent {
  const lowerMessage = message.toLowerCase();
  const scores: Record<IntentType, number> = {} as Record<IntentType, number>;
  const matchedKeywords: Record<IntentType, string[]> = {} as Record<IntentType, string[]>;

  // Calculate scores for each intent
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    const keywords: string[] = [];

    // Check keywords
    for (const keyword of patterns.keywords) {
      if (lowerMessage.includes(keyword)) {
        score += CONFIDENCE_MULTIPLIERS.keyword_match;
        keywords.push(keyword);
      }
    }

    // Bonus for multiple keywords
    if (keywords.length > 1) {
      score += CONFIDENCE_MULTIPLIERS.multiple_keywords;
    }

    // Check patterns
    for (const pattern of patterns.patterns) {
      if (pattern.test(message)) {
        score += CONFIDENCE_MULTIPLIERS.pattern_match;
      }
    }

    scores[intent as IntentType] = Math.min(score, 100);
    matchedKeywords[intent as IntentType] = keywords;
  }

  // Get best match
  let bestIntent: IntentType = 'information_needed';
  let bestScore = 0;

  for (const [intent, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent as IntentType;
    }
  }

  // Generate reasoning
  const keywords = matchedKeywords[bestIntent];
  let reasoning = `Detected based on keywords: ${keywords.join(', ')}`;

  // Generate suggested action
  const actionMap: Record<IntentType, string> = {
    interested: '💬 Follow up with demo or meeting details',
    not_interested: '✋ Respect their decision, keep for later nurture',
    meeting_request: '📅 Send calendar link or schedule meeting',
    information_needed: '📧 Send detailed info packet or FAQ',
    price_inquiry: '💰 Send pricing and ROI information',
    follow_up_needed: '⏰ Add to follow-up sequence in 5-7 days',
    meeting_scheduled: '✅ Send meeting prep materials'
  };

  return {
    intent: bestIntent,
    confidence: bestScore,
    keywords,
    reasoning,
    suggested_action: actionMap[bestIntent]
  };
}

/**
 * Batch detect intent for multiple messages
 */
export function batchDetectIntent(messages: string[]): DetectedIntent[] {
  return messages.map(msg => detectIntent(msg));
}

/**
 * Get intent color for UI
 */
export function getIntentColor(intent: IntentType): string {
  const colors: Record<IntentType, string> = {
    interested: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
    not_interested: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    meeting_request: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    information_needed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
    price_inquiry: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
    follow_up_needed: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    meeting_scheduled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
  };
  return colors[intent];
}

/**
 * Get intent emoji icon
 */
export function getIntentIcon(intent: IntentType): string {
  const icons: Record<IntentType, string> = {
    interested: '🎉',
    not_interested: '👋',
    meeting_request: '📅',
    information_needed: '❓',
    price_inquiry: '💰',
    follow_up_needed: '⏰',
    meeting_scheduled: '✅'
  };
  return icons[intent];
}
