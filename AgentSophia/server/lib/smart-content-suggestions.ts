interface ContentPerformance {
  content: string;
  type: 'subject' | 'cta' | 'opening' | 'closing' | 'body';
  channel: string;
  openRate: number;
  clickRate: number;
  replyRate: number;
  usageCount: number;
  lastUsed: string;
}

interface SmartSuggestion {
  id: string;
  type: 'subject' | 'cta' | 'opening' | 'closing' | 'variation';
  content: string;
  confidence: number;
  reasoning: string;
  predictedPerformance: {
    openRate?: string;
    clickRate?: string;
    replyRate?: string;
  };
  basedOn?: string;
}

const performanceHistory: ContentPerformance[] = [];

const PROVEN_SUBJECT_LINES = [
  { pattern: 'Quick question about {{company}}', avgOpenRate: 42, category: 'question' },
  { pattern: '{{first_name}}, quick thought on {{topic}}', avgOpenRate: 38, category: 'personalized' },
  { pattern: 'Idea for {{company}}', avgOpenRate: 35, category: 'value' },
  { pattern: 'Re: {{topic}}', avgOpenRate: 45, category: 'reply_style' },
  { pattern: '{{first_name}} - saw this and thought of you', avgOpenRate: 40, category: 'personal' },
  { pattern: 'Question about {{company}}\'s {{department}}', avgOpenRate: 37, category: 'specific' },
  { pattern: 'Can I get your opinion on something?', avgOpenRate: 44, category: 'engagement' },
  { pattern: '{{mutual_connection}} suggested I reach out', avgOpenRate: 52, category: 'referral' },
];

const PROVEN_CTAS = [
  { pattern: 'Would you be open to a quick 15-minute chat?', avgReplyRate: 8, category: 'soft_ask' },
  { pattern: 'Worth a quick call to discuss?', avgReplyRate: 7, category: 'casual' },
  { pattern: 'Would this be relevant for {{company}}?', avgReplyRate: 9, category: 'question' },
  { pattern: 'Let me know if you\'d like to learn more.', avgReplyRate: 5, category: 'low_pressure' },
  { pattern: 'Happy to share more details if helpful.', avgReplyRate: 6, category: 'helpful' },
  { pattern: 'Would [specific day] work for a quick chat?', avgReplyRate: 11, category: 'specific_time' },
  { pattern: 'Just hit reply and I\'ll send over more info.', avgReplyRate: 8, category: 'easy_action' },
];

const PROVEN_OPENINGS = [
  { pattern: 'I noticed {{company}} is {{observation}}...', avgEngagement: 42, category: 'research' },
  { pattern: 'Congrats on {{recent_news}}!', avgEngagement: 48, category: 'celebration' },
  { pattern: 'I\'ve been following {{company}}\'s work on {{topic}}...', avgEngagement: 38, category: 'interest' },
  { pattern: '{{mutual_connection}} mentioned you might be interested in...', avgEngagement: 55, category: 'referral' },
  { pattern: 'I work with companies like {{similar_company}} and {{similar_company_2}}...', avgEngagement: 35, category: 'credibility' },
  { pattern: 'Quick question - are you still handling {{responsibility}}?', avgEngagement: 40, category: 'direct' },
];

export function logContentPerformance(
  content: string,
  type: ContentPerformance['type'],
  channel: string,
  metrics: { openRate: number; clickRate: number; replyRate: number }
): void {
  const existing = performanceHistory.find(p => 
    p.content === content && p.type === type && p.channel === channel
  );
  
  if (existing) {
    const totalUsage = existing.usageCount + 1;
    existing.openRate = ((existing.openRate * existing.usageCount) + metrics.openRate) / totalUsage;
    existing.clickRate = ((existing.clickRate * existing.usageCount) + metrics.clickRate) / totalUsage;
    existing.replyRate = ((existing.replyRate * existing.usageCount) + metrics.replyRate) / totalUsage;
    existing.usageCount = totalUsage;
    existing.lastUsed = new Date().toISOString();
  } else {
    performanceHistory.push({
      content,
      type,
      channel,
      openRate: metrics.openRate,
      clickRate: metrics.clickRate,
      replyRate: metrics.replyRate,
      usageCount: 1,
      lastUsed: new Date().toISOString()
    });
  }
}

export function getSubjectLineSuggestions(
  context: { industry?: string; persona?: string; channel?: string; purpose?: string }
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  
  const topPerformers = performanceHistory
    .filter(p => p.type === 'subject' && p.usageCount >= 3)
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 3);
  
  topPerformers.forEach((perf, idx) => {
    suggestions.push({
      id: `past-winner-${idx}`,
      type: 'subject',
      content: perf.content,
      confidence: 0.9,
      reasoning: `This subject line achieved ${perf.openRate.toFixed(1)}% open rate across ${perf.usageCount} sends.`,
      predictedPerformance: { openRate: `${perf.openRate.toFixed(0)}%` },
      basedOn: 'Your past performance data'
    });
  });
  
  const bestPatterns = PROVEN_SUBJECT_LINES
    .sort((a, b) => b.avgOpenRate - a.avgOpenRate)
    .slice(0, 5);
  
  bestPatterns.forEach((pattern, idx) => {
    suggestions.push({
      id: `pattern-${idx}`,
      type: 'subject',
      content: pattern.pattern,
      confidence: 0.75,
      reasoning: `${pattern.category.replace('_', ' ')} subject lines average ${pattern.avgOpenRate}% open rate across industry benchmarks.`,
      predictedPerformance: { openRate: `${pattern.avgOpenRate}%` }
    });
  });
  
  if (context.purpose === 'cold_outreach') {
    suggestions.unshift({
      id: 'sophia-rec-cold',
      type: 'subject',
      content: 'Quick question about {{company}}',
      confidence: 0.85,
      reasoning: 'Question-based subject lines work best for cold outreach - they create curiosity without being salesy.',
      predictedPerformance: { openRate: '38-45%' }
    });
  }
  
  if (context.purpose === 'follow_up') {
    suggestions.unshift({
      id: 'sophia-rec-followup',
      type: 'subject',
      content: 'Re: {{previous_subject}}',
      confidence: 0.88,
      reasoning: 'Reply-style subjects get 45% higher open rates on follow-ups because they look like ongoing conversations.',
      predictedPerformance: { openRate: '40-50%' }
    });
  }
  
  return suggestions.slice(0, 8);
}

export function getCTASuggestions(
  context: { channel?: string; purpose?: string; sequenceStep?: number }
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  
  const topPerformers = performanceHistory
    .filter(p => p.type === 'cta' && p.usageCount >= 3)
    .sort((a, b) => b.replyRate - a.replyRate)
    .slice(0, 3);
  
  topPerformers.forEach((perf, idx) => {
    suggestions.push({
      id: `past-cta-${idx}`,
      type: 'cta',
      content: perf.content,
      confidence: 0.9,
      reasoning: `This CTA achieved ${perf.replyRate.toFixed(1)}% reply rate across ${perf.usageCount} sends.`,
      predictedPerformance: { replyRate: `${perf.replyRate.toFixed(0)}%` },
      basedOn: 'Your past performance data'
    });
  });
  
  PROVEN_CTAS.forEach((cta, idx) => {
    suggestions.push({
      id: `cta-pattern-${idx}`,
      type: 'cta',
      content: cta.pattern,
      confidence: 0.75,
      reasoning: `${cta.category.replace('_', ' ')} CTAs average ${cta.avgReplyRate}% reply rate.`,
      predictedPerformance: { replyRate: `${cta.avgReplyRate}%` }
    });
  });
  
  if (context.sequenceStep && context.sequenceStep >= 3) {
    suggestions.unshift({
      id: 'sophia-cta-final',
      type: 'cta',
      content: 'Either way, just let me know?',
      confidence: 0.82,
      reasoning: 'Binary close CTAs work well for final emails - they make it easy to respond even with a "no".',
      predictedPerformance: { replyRate: '8-12%' }
    });
  }
  
  return suggestions.slice(0, 6);
}

export function getOpeningSuggestions(
  context: { hasResearch?: boolean; hasReferral?: boolean; industry?: string }
): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  
  if (context.hasReferral) {
    suggestions.push({
      id: 'referral-opening',
      type: 'opening',
      content: '{{mutual_connection}} mentioned you might be interested in...',
      confidence: 0.92,
      reasoning: 'Referral openings get 55% higher engagement - people trust recommendations from their network.',
      predictedPerformance: { openRate: '50-60%', replyRate: '12-18%' }
    });
  }
  
  if (context.hasResearch) {
    suggestions.push({
      id: 'research-opening',
      type: 'opening',
      content: 'I noticed {{company}} is {{specific_observation}}...',
      confidence: 0.88,
      reasoning: 'Personalized research-based openings show effort and get 40% higher response rates.',
      predictedPerformance: { replyRate: '8-12%' }
    });
  }
  
  PROVEN_OPENINGS.forEach((opening, idx) => {
    suggestions.push({
      id: `opening-${idx}`,
      type: 'opening',
      content: opening.pattern,
      confidence: 0.7,
      reasoning: `${opening.category.replace('_', ' ')} openings average ${opening.avgEngagement}% engagement.`,
      predictedPerformance: { replyRate: `${Math.round(opening.avgEngagement * 0.2)}%` }
    });
  });
  
  return suggestions.slice(0, 5);
}

export function generateVariations(
  originalContent: string,
  type: 'subject' | 'cta' | 'body'
): SmartSuggestion[] {
  const variations: SmartSuggestion[] = [];
  
  if (type === 'subject') {
    if (originalContent.includes('?')) {
      variations.push({
        id: 'var-statement',
        type: 'variation',
        content: originalContent.replace('?', '.').replace(/^(Can|Could|Would|Will|Do|Does|Are|Is)/i, 'A thought on'),
        confidence: 0.7,
        reasoning: 'Statement version of your question - some audiences prefer direct statements.',
        predictedPerformance: { openRate: '±3%' }
      });
    } else {
      variations.push({
        id: 'var-question',
        type: 'variation',
        content: `Quick thought - ${originalContent}?`,
        confidence: 0.7,
        reasoning: 'Question version creates curiosity and increases open rates.',
        predictedPerformance: { openRate: '+5-10%' }
      });
    }
    
    variations.push({
      id: 'var-personalized',
      type: 'variation',
      content: `{{first_name}} - ${originalContent.toLowerCase()}`,
      confidence: 0.75,
      reasoning: 'Adding first name increases open rates by 10-15% on average.',
      predictedPerformance: { openRate: '+10-15%' }
    });
    
    if (!originalContent.includes('Re:')) {
      variations.push({
        id: 'var-reply-style',
        type: 'variation',
        content: `Re: ${originalContent}`,
        confidence: 0.8,
        reasoning: 'Reply-style subjects look like ongoing conversations - highest open rates.',
        predictedPerformance: { openRate: '+15-20%' }
      });
    }
  }
  
  if (type === 'cta') {
    variations.push({
      id: 'var-specific-time',
      type: 'variation',
      content: originalContent.replace(/a (quick )?(call|chat|meeting)/i, 'a quick chat Tuesday or Wednesday'),
      confidence: 0.8,
      reasoning: 'Specific time options get 25% more responses than open-ended asks.',
      predictedPerformance: { replyRate: '+3-5%' }
    });
    
    variations.push({
      id: 'var-low-pressure',
      type: 'variation',
      content: `${originalContent} (No pressure if not - just thought it might be relevant.)`,
      confidence: 0.7,
      reasoning: 'Low-pressure variant reduces friction for hesitant prospects.',
      predictedPerformance: { replyRate: '+2-4%' }
    });
  }
  
  return variations;
}

export function getSophiaContentRecommendation(
  campaignType: string,
  channel: string,
  step: number
): string {
  const recommendations: Record<string, Record<string, string[]>> = {
    cold_outreach: {
      email: [
        'For step 1, lead with value - mention a specific pain point they likely have.',
        'For follow-ups, reference your previous email but add new information.',
        'Final emails should use a "closing the loop" approach - make it easy to say no.'
      ],
      linkedin: [
        'Keep connection requests under 300 characters - short and personal works best.',
        'After connecting, wait 1-2 days before sending a message.',
        'LinkedIn messages should feel conversational, not salesy.'
      ]
    },
    nurture: {
      email: [
        'Educational content should provide immediate value - no hard sell.',
        'Include case studies or social proof in middle sequence emails.',
        'Save the direct ask for the final 1-2 emails after providing value.'
      ]
    }
  };
  
  const typeRecs = recommendations[campaignType]?.[channel];
  if (typeRecs && step <= typeRecs.length) {
    return typeRecs[step - 1];
  }
  
  return 'Focus on being helpful and specific. Generic messages get ignored.';
}

export function analyzeContentForImprovements(content: string): Array<{
  issue: string;
  suggestion: string;
  impact: string;
}> {
  const improvements: Array<{ issue: string; suggestion: string; impact: string }> = [];
  
  if (content.length > 300) {
    improvements.push({
      issue: 'Email is too long',
      suggestion: 'Keep emails under 200 words for 2x higher response rates',
      impact: '+50% reply rate'
    });
  }
  
  if (!content.includes('{{first_name}}') && !content.includes('{{company}}')) {
    improvements.push({
      issue: 'Missing personalization',
      suggestion: 'Add {{first_name}} or {{company}} tokens for personalization',
      impact: '+15% open rate'
    });
  }
  
  if (content.toLowerCase().includes('i hope this email finds you')) {
    improvements.push({
      issue: 'Generic opening detected',
      suggestion: 'Replace with a personalized observation about their company or role',
      impact: '+20% engagement'
    });
  }
  
  if (!content.includes('?')) {
    improvements.push({
      issue: 'No questions asked',
      suggestion: 'End with a clear question to prompt a response',
      impact: '+25% reply rate'
    });
  }
  
  const sentences = content.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.some(s => s.split(' ').length > 30)) {
    improvements.push({
      issue: 'Sentences too long',
      suggestion: 'Break up long sentences for better readability',
      impact: '+10% engagement'
    });
  }
  
  if (/we are|we have|we offer|our company|our product/i.test(content)) {
    improvements.push({
      issue: 'Too focused on "we"',
      suggestion: 'Reframe to focus on "you" and their benefits',
      impact: '+30% response rate'
    });
  }
  
  return improvements;
}
