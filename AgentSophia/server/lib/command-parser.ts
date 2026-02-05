export interface ParsedCommand {
  intent: 'campaign' | 'message' | 'meeting' | 'analysis' | 'optimization' | 'workflow' | 'action' | null;
  action: string;
  targets: string[];
  parameters: Record<string, any>;
  confidence: number;
  isAutonomous: boolean;
}

const ACTION_KEYWORDS = {
  campaign: ['send', 'launch', 'create', 'deploy', 'run', 'campaign', 'batch', 'multi-channel', 'outreach'],
  message: ['reply', 'respond', 'send', 'message', 'email', 'text', 'sms', 'whatsapp', 'contact'],
  meeting: ['schedule', 'book', 'meeting', 'call', 'calendar', 'availability', 'appointment'],
  analysis: ['analyze', 'analyze', 'show', 'report', 'health', 'metrics', 'performance', 'forecast', 'predict'],
  optimization: ['optimize', 'improve', 'increase', 'boost', 'enhance', 'better', 'upgrade', 'convert'],
  workflow: ['automate', 'workflow', 'process', 'nurture', 'sequence', 'automation', 'trigger'],
  action: ['execute', 'do', 'run', 'perform', 'start', 'begin', 'go', 'make']
};

const TARGET_KEYWORDS = {
  leads: ['leads', 'prospects', 'contacts', 'people', 'accounts', 'opportunities'],
  segments: ['segment', 'group', 'list', 'tier', 'cohort', 'hot', 'warm', 'cold', 'mql', 'sql', 'won', 'lost'],
  campaigns: ['campaign', 'campaigns', 'initiative', 'outreach', 'blast', 'sequence'],
  messages: ['messages', 'emails', 'inbox', 'responses', 'replies', 'engagement'],
  channels: ['email', 'linkedin', 'sms', 'phone', 'whatsapp', 'social', 'multi-channel'],
  time: ['today', 'tomorrow', 'week', 'month', 'quarter', 'asap', 'urgent', 'schedule', 'timing']
};

export function parseCommand(userMessage: string): ParsedCommand {
  const lowerMessage = userMessage.toLowerCase();
  let detectedIntent: ParsedCommand['intent'] = null;
  let maxKeywordCount = 0;

  // Detect intent by counting action keywords
  for (const [intent, keywords] of Object.entries(ACTION_KEYWORDS)) {
    const matchCount = keywords.filter(kw => lowerMessage.includes(kw)).length;
    if (matchCount > maxKeywordCount) {
      maxKeywordCount = matchCount;
      detectedIntent = intent as any;
    }
  }

  // Extract targets
  const targets: string[] = [];
  for (const [target, keywords] of Object.entries(TARGET_KEYWORDS)) {
    if (keywords.some(kw => lowerMessage.includes(kw))) {
      targets.push(target);
    }
  }

  // Determine if autonomous
  const autonomousKeywords = ['send', 'launch', 'create', 'run', 'schedule', 'book', 'optimize', 'reply', 'automate'];
  const isAutonomous = autonomousKeywords.some(kw => lowerMessage.includes(kw));

  // Calculate confidence based on keyword matches
  const confidence = Math.min(100, Math.max(0, (maxKeywordCount * 20) + (targets.length * 10)));

  return {
    intent: detectedIntent,
    action: extractMainVerb(userMessage),
    targets,
    parameters: extractParameters(userMessage),
    confidence: confidence / 100,
    isAutonomous
  };
}

function extractMainVerb(message: string): string {
  const verbs = ['send', 'launch', 'create', 'schedule', 'analyze', 'optimize', 'reply', 'generate', 'improve', 'run', 'book', 'automate'];
  const lowerMessage = message.toLowerCase();
  
  for (const verb of verbs) {
    if (lowerMessage.includes(verb)) {
      return verb;
    }
  }
  
  return 'execute';
}

function extractParameters(message: string): Record<string, any> {
  const params: Record<string, any> = {};

  // Extract numbers (quantities, percentages, etc.)
  const numberMatch = message.match(/(\d+)/);
  if (numberMatch) {
    params.quantity = parseInt(numberMatch[1]);
  }

  // Extract date references
  const dateKeywords = ['today', 'tomorrow', 'this week', 'next week', 'this month', 'next month', 'asap', 'urgent'];
  for (const keyword of dateKeywords) {
    if (message.toLowerCase().includes(keyword)) {
      params.timing = keyword;
      break;
    }
  }

  // Extract channel preferences
  const channels = ['email', 'linkedin', 'sms', 'phone', 'whatsapp', 'social'];
  const detectedChannels = channels.filter(ch => message.toLowerCase().includes(ch));
  if (detectedChannels.length > 0) {
    params.channels = detectedChannels;
  }

  // Extract segment preferences
  const segments = ['hot', 'warm', 'cold', 'mql', 'sql', 'won', 'lost', 'vip', 'enterprise'];
  const detectedSegments = segments.filter(seg => message.toLowerCase().includes(seg));
  if (detectedSegments.length > 0) {
    params.segments = detectedSegments;
  }

  // Extract topic/subject
  const topicMatch = message.match(/about\s+([^,\.]+)/i);
  if (topicMatch) {
    params.topic = topicMatch[1].trim();
  }

  return params;
}

export function generateExecutionPlan(command: ParsedCommand, context: any): string {
  const { action, targets, parameters, confidence } = command;
  
  let plan = `🤖 **Execution Plan** (Confidence: ${Math.round(confidence * 100)}%)\n\n`;
  
  plan += `**Action**: ${action}\n`;
  plan += `**Targets**: ${targets.join(', ')}\n\n`;
  
  plan += `**Steps**:\n`;
  
  // Generate steps based on action
  const steps = getActionSteps(action, parameters, context);
  steps.forEach((step, idx) => {
    plan += `${idx + 1}. ${step}\n`;
  });
  
  if (parameters.quantity) {
    plan += `\n**Expected Volume**: ${parameters.quantity} ${targets.join('/')}`;
  }
  
  return plan;
}

function getActionSteps(action: string, parameters: any, context: any): string[] {
  const steps: string[] = [];
  
  switch (action) {
    case 'send':
    case 'launch':
      steps.push('Identify target audience based on criteria');
      steps.push('Generate personalized content for each recipient');
      steps.push('Select optimal sending time');
      steps.push('Execute delivery across channels');
      steps.push('Monitor delivery and engagement');
      break;
      
    case 'schedule':
    case 'book':
      steps.push('Check calendar availability');
      steps.push('Identify best time slots');
      steps.push('Send meeting invitations');
      steps.push('Set up reminders and follow-ups');
      break;
      
    case 'optimize':
    case 'improve':
      steps.push('Analyze current performance metrics');
      steps.push('Identify optimization opportunities');
      steps.push('Run A/B tests');
      steps.push('Apply winning variations');
      break;
      
    case 'analyze':
      steps.push('Gather relevant data');
      steps.push('Calculate key metrics');
      steps.push('Generate insights');
      steps.push('Produce actionable recommendations');
      break;
      
    case 'automate':
      steps.push('Map the workflow');
      steps.push('Set up triggers and conditions');
      steps.push('Configure automations');
      steps.push('Test and monitor');
      break;
      
    default:
      steps.push('Understand requirement');
      steps.push('Plan approach');
      steps.push('Execute action');
      steps.push('Verify results');
  }
  
  return steps;
}
