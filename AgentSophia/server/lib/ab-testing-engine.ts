export interface ABTestVariant {
  id: string;
  name: string;
  content: string;
  subject?: string;
  isControl: boolean;
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
    unsubscribed: number;
  };
}

export interface ABTest {
  id: string;
  campaignId: string;
  stepId: string;
  name: string;
  status: 'draft' | 'running' | 'completed' | 'paused';
  testType: 'subject' | 'content' | 'cta' | 'timing' | 'channel';
  variants: ABTestVariant[];
  trafficSplit: number[];
  startedAt?: string;
  completedAt?: string;
  winningVariantId?: string;
  confidenceLevel: number;
  minimumSampleSize: number;
  autoOptimize: boolean;
  createdAt: string;
}

export interface StatisticalResult {
  isSignificant: boolean;
  confidenceLevel: number;
  winningVariantId: string | null;
  improvementPercent: number;
  sampleSizeRequired: number;
  currentSampleSize: number;
  recommendation: string;
  pValue: number;
  zScore: number;
}

const activeTests = new Map<string, ABTest>();

export function createABTest(
  campaignId: string,
  stepId: string,
  testType: ABTest['testType'],
  variants: Array<{ name: string; content: string; subject?: string; isControl?: boolean }>,
  options?: {
    autoOptimize?: boolean;
    minimumSampleSize?: number;
    confidenceLevel?: number;
  }
): ABTest {
  const testId = `ab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const variantsWithMetrics: ABTestVariant[] = variants.map((v, idx) => ({
    id: `var-${idx}`,
    name: v.name || `Variant ${String.fromCharCode(65 + idx)}`,
    content: v.content,
    subject: v.subject,
    isControl: v.isControl || idx === 0,
    metrics: { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0, unsubscribed: 0 }
  }));
  
  const splitPerVariant = Math.floor(100 / variants.length);
  const remainder = 100 - (splitPerVariant * variants.length);
  const trafficSplit = variants.map((_, idx) => 
    idx === 0 ? splitPerVariant + remainder : splitPerVariant
  );
  
  const test: ABTest = {
    id: testId,
    campaignId,
    stepId,
    name: `${testType} Test - ${new Date().toLocaleDateString()}`,
    status: 'draft',
    testType,
    variants: variantsWithMetrics,
    trafficSplit,
    confidenceLevel: options?.confidenceLevel || 95,
    minimumSampleSize: options?.minimumSampleSize || 100,
    autoOptimize: options?.autoOptimize ?? true,
    createdAt: new Date().toISOString()
  };
  
  activeTests.set(testId, test);
  return test;
}

export function startABTest(testId: string): ABTest | null {
  const test = activeTests.get(testId);
  if (!test) return null;
  
  test.status = 'running';
  test.startedAt = new Date().toISOString();
  return test;
}

export function recordVariantEvent(
  testId: string,
  variantId: string,
  event: 'sent' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed'
): void {
  const test = activeTests.get(testId);
  if (!test) return;
  
  const variant = test.variants.find(v => v.id === variantId);
  if (!variant) return;
  
  variant.metrics[event]++;
  
  if (test.autoOptimize && test.status === 'running') {
    const result = calculateStatisticalSignificance(test);
    if (result.isSignificant && result.currentSampleSize >= test.minimumSampleSize) {
      test.winningVariantId = result.winningVariantId || undefined;
      test.status = 'completed';
      test.completedAt = new Date().toISOString();
    }
  }
}

export function selectVariantForContact(testId: string, contactId: string): ABTestVariant | null {
  const test = activeTests.get(testId);
  if (!test || test.status !== 'running') return null;
  
  const hash = simpleHash(contactId);
  const bucket = hash % 100;
  
  let cumulative = 0;
  for (let i = 0; i < test.variants.length; i++) {
    cumulative += test.trafficSplit[i];
    if (bucket < cumulative) {
      return test.variants[i];
    }
  }
  
  return test.variants[0];
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function calculateStatisticalSignificance(test: ABTest): StatisticalResult {
  const primaryMetric = test.testType === 'subject' ? 'opened' : 'replied';
  
  const control = test.variants.find(v => v.isControl);
  const treatments = test.variants.filter(v => !v.isControl);
  
  if (!control || treatments.length === 0) {
    return {
      isSignificant: false,
      confidenceLevel: 0,
      winningVariantId: null,
      improvementPercent: 0,
      sampleSizeRequired: test.minimumSampleSize,
      currentSampleSize: 0,
      recommendation: 'Invalid test configuration',
      pValue: 1,
      zScore: 0
    };
  }
  
  const controlRate = control.metrics.sent > 0 
    ? control.metrics[primaryMetric] / control.metrics.sent 
    : 0;
  
  let bestTreatment: ABTestVariant | null = null;
  let bestZScore = 0;
  let bestImprovement = 0;
  
  for (const treatment of treatments) {
    if (treatment.metrics.sent === 0) continue;
    
    const treatmentRate = treatment.metrics[primaryMetric] / treatment.metrics.sent;
    const pooledRate = (control.metrics[primaryMetric] + treatment.metrics[primaryMetric]) / 
                       (control.metrics.sent + treatment.metrics.sent);
    
    const standardError = Math.sqrt(
      pooledRate * (1 - pooledRate) * (1/control.metrics.sent + 1/treatment.metrics.sent)
    );
    
    const zScore = standardError > 0 ? (treatmentRate - controlRate) / standardError : 0;
    
    if (zScore > bestZScore) {
      bestZScore = zScore;
      bestTreatment = treatment;
      bestImprovement = controlRate > 0 ? ((treatmentRate - controlRate) / controlRate) * 100 : 0;
    }
  }
  
  const pValue = zScoreToPValue(bestZScore);
  const isSignificant = pValue < (1 - test.confidenceLevel / 100);
  
  const currentSampleSize = test.variants.reduce((sum, v) => sum + v.metrics.sent, 0);
  
  const baselineRate = controlRate || 0.1;
  const mde = 0.1;
  const sampleSizeRequired = calculateRequiredSampleSize(baselineRate, mde, test.confidenceLevel);
  
  let recommendation: string;
  if (currentSampleSize < test.minimumSampleSize) {
    recommendation = `Need ${test.minimumSampleSize - currentSampleSize} more sends to reach minimum sample size.`;
  } else if (isSignificant && bestTreatment) {
    recommendation = `${bestTreatment.name} is the winner with ${bestImprovement.toFixed(1)}% improvement. Consider ending the test and using this variant.`;
  } else if (currentSampleSize >= sampleSizeRequired) {
    recommendation = 'No significant difference detected. Consider testing more dramatic variations.';
  } else {
    recommendation = `Test is ${Math.round((currentSampleSize / sampleSizeRequired) * 100)}% complete. Continue running for more data.`;
  }
  
  return {
    isSignificant,
    confidenceLevel: isSignificant ? test.confidenceLevel : (1 - pValue) * 100,
    winningVariantId: isSignificant ? (bestTreatment?.id || control.id) : null,
    improvementPercent: bestImprovement,
    sampleSizeRequired,
    currentSampleSize,
    recommendation,
    pValue,
    zScore: bestZScore
  };
}

function zScoreToPValue(zScore: number): number {
  const absZ = Math.abs(zScore);
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;
  
  const t = 1.0 / (1.0 + p * absZ);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ / 2);
  
  return 2 * (1 - y);
}

function calculateRequiredSampleSize(
  baselineRate: number,
  mde: number,
  confidenceLevel: number
): number {
  const alpha = 1 - confidenceLevel / 100;
  const beta = 0.2;
  
  const zAlpha = 1.96;
  const zBeta = 0.84;
  
  const p1 = baselineRate;
  const p2 = baselineRate * (1 + mde);
  const pAvg = (p1 + p2) / 2;
  
  const numerator = 2 * pAvg * (1 - pAvg) * Math.pow(zAlpha + zBeta, 2);
  const denominator = Math.pow(p2 - p1, 2);
  
  return Math.ceil(numerator / denominator) * 2;
}

export function getABTest(testId: string): ABTest | null {
  return activeTests.get(testId) || null;
}

export function getABTestsForCampaign(campaignId: string): ABTest[] {
  return Array.from(activeTests.values()).filter(t => t.campaignId === campaignId);
}

export function pauseABTest(testId: string): ABTest | null {
  const test = activeTests.get(testId);
  if (!test) return null;
  
  test.status = 'paused';
  return test;
}

export function completeABTest(testId: string, winningVariantId: string): ABTest | null {
  const test = activeTests.get(testId);
  if (!test) return null;
  
  test.status = 'completed';
  test.completedAt = new Date().toISOString();
  test.winningVariantId = winningVariantId;
  return test;
}

export function generateABTestSummary(test: ABTest): string {
  const result = calculateStatisticalSignificance(test);
  
  let summary = `## A/B Test: ${test.name}\n\n`;
  summary += `**Status:** ${test.status}\n`;
  summary += `**Test Type:** ${test.testType}\n`;
  summary += `**Variants:** ${test.variants.length}\n\n`;
  
  summary += `### Results\n\n`;
  summary += `| Variant | Sent | Opens | Clicks | Replies | Open Rate | Reply Rate |\n`;
  summary += `|---------|------|-------|--------|---------|-----------|------------|\n`;
  
  for (const variant of test.variants) {
    const openRate = variant.metrics.sent > 0 
      ? ((variant.metrics.opened / variant.metrics.sent) * 100).toFixed(1) 
      : '0.0';
    const replyRate = variant.metrics.sent > 0 
      ? ((variant.metrics.replied / variant.metrics.sent) * 100).toFixed(1) 
      : '0.0';
    
    const winner = variant.id === result.winningVariantId ? ' 🏆' : '';
    const control = variant.isControl ? ' (Control)' : '';
    
    summary += `| ${variant.name}${control}${winner} | ${variant.metrics.sent} | ${variant.metrics.opened} | ${variant.metrics.clicked} | ${variant.metrics.replied} | ${openRate}% | ${replyRate}% |\n`;
  }
  
  summary += `\n### Statistical Analysis\n\n`;
  summary += `- **Confidence Level:** ${result.confidenceLevel.toFixed(1)}%\n`;
  summary += `- **Statistical Significance:** ${result.isSignificant ? 'Yes ✅' : 'Not yet ⏳'}\n`;
  summary += `- **Sample Size:** ${result.currentSampleSize} / ${result.sampleSizeRequired} required\n`;
  summary += `- **Improvement:** ${result.improvementPercent > 0 ? '+' : ''}${result.improvementPercent.toFixed(1)}%\n\n`;
  summary += `**Recommendation:** ${result.recommendation}\n`;
  
  return summary;
}

export function getSophiaABTestRecommendation(test: ABTest): string {
  const result = calculateStatisticalSignificance(test);
  
  if (test.status === 'draft') {
    return "This test hasn't started yet. Once you launch it, I'll analyze the results in real-time.";
  }
  
  if (result.currentSampleSize < 50) {
    return "We need more data before I can make recommendations. Let's wait until we have at least 50 sends per variant.";
  }
  
  if (result.isSignificant && result.winningVariantId) {
    const winner = test.variants.find(v => v.id === result.winningVariantId);
    return `Great news! ${winner?.name || 'Variant'} is performing ${result.improvementPercent.toFixed(0)}% better with ${result.confidenceLevel.toFixed(0)}% confidence. I recommend ending this test and applying the winning variant to all future sends.`;
  }
  
  if (result.currentSampleSize >= result.sampleSizeRequired) {
    return "We've reached the required sample size but haven't found a significant winner. The variants are performing similarly. Consider testing more dramatic differences in your next test.";
  }
  
  const progress = (result.currentSampleSize / result.sampleSizeRequired) * 100;
  return `Test is ${progress.toFixed(0)}% complete. We need about ${result.sampleSizeRequired - result.currentSampleSize} more sends to reach statistical significance. Keep the campaign running!`;
}
