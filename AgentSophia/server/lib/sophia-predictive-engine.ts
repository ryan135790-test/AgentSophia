export interface LeadPrediction {
  leadId: string;
  conversionProbability: number;
  predictedCloseDate: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  buyingStage: 'awareness' | 'consideration' | 'decision' | 'ready_to_buy';
  nextBestAction: string;
  confidenceScore: number;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
  description: string;
}

export interface LeadEngagementData {
  emailOpens: number;
  emailClicks: number;
  emailReplies: number;
  linkedinViews: number;
  linkedinReplies: number;
  smsReplies: number;
  meetingsBooked: number;
  websiteVisits: number;
  lastActivityDaysAgo: number;
  totalTouchpoints: number;
  responseRate: number;
  avgResponseTime: number;
}

export interface LeadFitData {
  title: string;
  companySize: 'startup' | 'smb' | 'mid_market' | 'enterprise';
  industry: string;
  budget: number | null;
  decisionMaker: boolean;
  techStack: string[];
}

const TITLE_SCORES: Record<string, number> = {
  'ceo': 100, 'coo': 95, 'cfo': 90, 'cto': 90, 'cmo': 95,
  'founder': 95, 'co-founder': 90, 'owner': 95,
  'vp': 85, 'vice president': 85, 'director': 75,
  'head of': 70, 'manager': 50, 'senior': 45,
  'lead': 40, 'specialist': 30, 'analyst': 25
};

const COMPANY_SIZE_SCORES: Record<string, number> = {
  'startup': 40,
  'smb': 60,
  'mid_market': 80,
  'enterprise': 100
};

const BUYING_STAGE_THRESHOLDS = {
  awareness: { min: 0, max: 25 },
  consideration: { min: 25, max: 50 },
  decision: { min: 50, max: 75 },
  ready_to_buy: { min: 75, max: 100 }
};

export function calculateEngagementScore(data: Partial<LeadEngagementData>): number {
  const weights = {
    emailOpens: 2,
    emailClicks: 5,
    emailReplies: 15,
    linkedinViews: 3,
    linkedinReplies: 20,
    smsReplies: 18,
    meetingsBooked: 30,
    websiteVisits: 4,
    responseRate: 0.5,
    recencyBonus: 20
  };

  let score = 0;
  
  score += Math.min((data.emailOpens || 0) * weights.emailOpens, 20);
  score += Math.min((data.emailClicks || 0) * weights.emailClicks, 25);
  score += Math.min((data.emailReplies || 0) * weights.emailReplies, 30);
  score += Math.min((data.linkedinViews || 0) * weights.linkedinViews, 15);
  score += Math.min((data.linkedinReplies || 0) * weights.linkedinReplies, 40);
  score += Math.min((data.smsReplies || 0) * weights.smsReplies, 36);
  score += Math.min((data.meetingsBooked || 0) * weights.meetingsBooked, 60);
  score += Math.min((data.websiteVisits || 0) * weights.websiteVisits, 20);
  
  score += (data.responseRate || 0) * weights.responseRate;
  
  const daysAgo = data.lastActivityDaysAgo ?? 30;
  if (daysAgo <= 1) score += weights.recencyBonus;
  else if (daysAgo <= 3) score += weights.recencyBonus * 0.8;
  else if (daysAgo <= 7) score += weights.recencyBonus * 0.5;
  else if (daysAgo <= 14) score += weights.recencyBonus * 0.2;
  
  return Math.min(Math.round(score), 100);
}

export function calculateFitScore(data: Partial<LeadFitData>): number {
  let score = 0;
  const factors: string[] = [];
  
  if (data.title) {
    const titleLower = data.title.toLowerCase();
    for (const [keyword, points] of Object.entries(TITLE_SCORES)) {
      if (titleLower.includes(keyword)) {
        score += points * 0.3;
        factors.push(`Title: ${keyword}`);
        break;
      }
    }
  }
  
  if (data.companySize) {
    score += (COMPANY_SIZE_SCORES[data.companySize] || 50) * 0.25;
  }
  
  if (data.decisionMaker) {
    score += 20;
    factors.push('Decision maker');
  }
  
  if (data.budget && data.budget > 10000) {
    score += Math.min(data.budget / 5000, 20);
    factors.push('Has budget');
  }
  
  return Math.min(Math.round(score), 100);
}

export function detectIntentSignals(data: Partial<LeadEngagementData>): { score: number; signals: string[] } {
  const signals: string[] = [];
  let score = 0;
  
  if ((data.emailReplies || 0) >= 2) {
    score += 25;
    signals.push('Multiple email replies');
  } else if ((data.emailReplies || 0) >= 1) {
    score += 15;
    signals.push('Replied to email');
  }
  
  if ((data.linkedinReplies || 0) >= 1) {
    score += 20;
    signals.push('LinkedIn conversation active');
  }
  
  if ((data.meetingsBooked || 0) >= 1) {
    score += 35;
    signals.push('Meeting booked');
  }
  
  if ((data.emailClicks || 0) >= 3) {
    score += 15;
    signals.push('High email engagement');
  }
  
  if ((data.websiteVisits || 0) >= 5) {
    score += 10;
    signals.push('Frequent website visitor');
  }
  
  const responseRate = data.responseRate || 0;
  if (responseRate >= 50) {
    score += 20;
    signals.push('High response rate');
  } else if (responseRate >= 25) {
    score += 10;
    signals.push('Responsive');
  }
  
  return { score: Math.min(score, 100), signals };
}

export function predictConversion(
  engagementData: Partial<LeadEngagementData>,
  fitData: Partial<LeadFitData>
): LeadPrediction {
  const engagementScore = calculateEngagementScore(engagementData);
  const fitScore = calculateFitScore(fitData);
  const { score: intentScore, signals: intentSignals } = detectIntentSignals(engagementData);
  
  const weights = { engagement: 0.4, fit: 0.25, intent: 0.35 };
  const overallScore = Math.round(
    engagementScore * weights.engagement +
    fitScore * weights.fit +
    intentScore * weights.intent
  );
  
  const conversionProbability = Math.round(overallScore * 0.85);
  
  let buyingStage: LeadPrediction['buyingStage'] = 'awareness';
  for (const [stage, thresholds] of Object.entries(BUYING_STAGE_THRESHOLDS)) {
    if (overallScore >= thresholds.min && overallScore < thresholds.max) {
      buyingStage = stage as LeadPrediction['buyingStage'];
    }
  }
  if (overallScore >= 75) buyingStage = 'ready_to_buy';
  
  let riskLevel: LeadPrediction['riskLevel'] = 'low';
  const daysAgo = engagementData.lastActivityDaysAgo ?? 30;
  if (daysAgo > 14 || (engagementData.totalTouchpoints || 0) < 2) {
    riskLevel = 'high';
  } else if (daysAgo > 7 || overallScore < 40) {
    riskLevel = 'medium';
  }
  
  const factors: PredictionFactor[] = [];
  
  if (engagementScore >= 70) {
    factors.push({ name: 'High Engagement', impact: 'positive', weight: 0.4, description: 'Active across multiple channels' });
  } else if (engagementScore < 30) {
    factors.push({ name: 'Low Engagement', impact: 'negative', weight: 0.4, description: 'Limited interaction with outreach' });
  }
  
  if (fitScore >= 60) {
    factors.push({ name: 'Strong ICP Fit', impact: 'positive', weight: 0.25, description: 'Matches ideal customer profile' });
  }
  
  intentSignals.forEach(signal => {
    factors.push({ name: signal, impact: 'positive', weight: 0.1, description: 'Buying intent indicator' });
  });
  
  if (riskLevel === 'high') {
    factors.push({ name: 'At Risk', impact: 'negative', weight: 0.2, description: 'No recent activity or engagement' });
  }
  
  const nextBestAction = determineNextAction(buyingStage, riskLevel, engagementData);
  
  let predictedCloseDate: string | null = null;
  if (conversionProbability >= 50) {
    const daysToClose = Math.round(30 - (conversionProbability - 50) * 0.5);
    const closeDate = new Date();
    closeDate.setDate(closeDate.getDate() + Math.max(daysToClose, 7));
    predictedCloseDate = closeDate.toISOString().split('T')[0];
  }
  
  return {
    leadId: '',
    conversionProbability,
    predictedCloseDate,
    riskLevel,
    buyingStage,
    nextBestAction,
    confidenceScore: Math.min(60 + (engagementData.totalTouchpoints || 0) * 5, 95),
    factors
  };
}

function determineNextAction(
  stage: LeadPrediction['buyingStage'],
  risk: LeadPrediction['riskLevel'],
  engagement: Partial<LeadEngagementData>
): string {
  if (risk === 'high') {
    return 'Send re-engagement email with new value proposition';
  }
  
  switch (stage) {
    case 'ready_to_buy':
      return 'Schedule closing call immediately';
    case 'decision':
      if ((engagement.meetingsBooked || 0) === 0) {
        return 'Book a discovery call';
      }
      return 'Send proposal or case study';
    case 'consideration':
      if ((engagement.emailReplies || 0) === 0) {
        return 'Try different channel (LinkedIn or phone)';
      }
      return 'Share customer success story';
    case 'awareness':
    default:
      return 'Continue nurture sequence';
  }
}

export function batchPredictLeads(
  leads: Array<{
    id: string;
    engagement: Partial<LeadEngagementData>;
    fit: Partial<LeadFitData>;
  }>
): LeadPrediction[] {
  return leads.map(lead => ({
    ...predictConversion(lead.engagement, lead.fit),
    leadId: lead.id
  }));
}

export function getLeadPriorityQueue(predictions: LeadPrediction[]): LeadPrediction[] {
  return [...predictions].sort((a, b) => {
    if (a.riskLevel === 'high' && b.riskLevel !== 'high') return -1;
    if (b.riskLevel === 'high' && a.riskLevel !== 'high') return 1;
    
    if (a.buyingStage === 'ready_to_buy' && b.buyingStage !== 'ready_to_buy') return -1;
    if (b.buyingStage === 'ready_to_buy' && a.buyingStage !== 'ready_to_buy') return 1;
    
    return b.conversionProbability - a.conversionProbability;
  });
}
