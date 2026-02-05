export interface ABTestVariant {
  id: string;
  name: string;
  content: string;
  subject?: string;
  weight: number;
  isControl: boolean;
}

export interface ABTest {
  id: string;
  campaignId: string;
  workspaceId: string;
  name: string;
  testType: 'connection_note' | 'message' | 'inmail_subject' | 'inmail_body';
  variants: ABTestVariant[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt: Date | null;
  completedAt: Date | null;
  minSampleSize: number;
  confidenceLevel: number;
  winnerId: string | null;
  createdAt: Date;
}

export interface ABTestResult {
  variantId: string;
  variantName: string;
  sent: number;
  accepted: number;
  replied: number;
  meetings: number;
  acceptanceRate: number;
  replyRate: number;
  meetingRate: number;
  isWinner: boolean;
  isStatisticallySignificant: boolean;
  pValue: number | null;
  uplift: number | null;
}

export interface ABTestStats {
  testId: string;
  testName: string;
  status: string;
  totalSent: number;
  results: ABTestResult[];
  recommendation: string;
  canDeclareWinner: boolean;
  estimatedTimeToSignificance: string;
}

class LinkedInABTestingEngine {
  private tests: Map<string, ABTest> = new Map();
  private variantAssignments: Map<string, { testId: string; variantId: string }> = new Map();
  private variantMetrics: Map<string, {
    sent: number;
    accepted: number;
    replied: number;
    meetings: number;
  }> = new Map();

  createTest(
    campaignId: string,
    workspaceId: string,
    name: string,
    testType: ABTest['testType'],
    variants: Omit<ABTestVariant, 'id'>[]
  ): ABTest {
    const test: ABTest = {
      id: `abt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      campaignId,
      workspaceId,
      name,
      testType,
      variants: variants.map((v, index) => ({
        ...v,
        id: `var_${index}_${Math.random().toString(36).substr(2, 9)}`,
      })),
      status: 'draft',
      startedAt: null,
      completedAt: null,
      minSampleSize: 100,
      confidenceLevel: 0.95,
      winnerId: null,
      createdAt: new Date(),
    };

    this.tests.set(test.id, test);

    for (const variant of test.variants) {
      this.variantMetrics.set(variant.id, {
        sent: 0,
        accepted: 0,
        replied: 0,
        meetings: 0,
      });
    }

    return test;
  }

  startTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'draft') return false;

    test.status = 'running';
    test.startedAt = new Date();
    return true;
  }

  pauseTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') return false;

    test.status = 'paused';
    return true;
  }

  resumeTest(testId: string): boolean {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'paused') return false;

    test.status = 'running';
    return true;
  }

  assignVariant(testId: string, prospectId: string): ABTestVariant | null {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') return null;

    const existingAssignment = this.variantAssignments.get(`${testId}:${prospectId}`);
    if (existingAssignment) {
      return test.variants.find(v => v.id === existingAssignment.variantId) || null;
    }

    const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const variant of test.variants) {
      random -= variant.weight;
      if (random <= 0) {
        this.variantAssignments.set(`${testId}:${prospectId}`, {
          testId,
          variantId: variant.id,
        });
        
        const metrics = this.variantMetrics.get(variant.id);
        if (metrics) {
          metrics.sent++;
        }
        
        return variant;
      }
    }

    return test.variants[0];
  }

  recordOutcome(
    testId: string,
    prospectId: string,
    outcome: 'accepted' | 'replied' | 'meeting'
  ): void {
    const assignment = this.variantAssignments.get(`${testId}:${prospectId}`);
    if (!assignment) return;

    const metrics = this.variantMetrics.get(assignment.variantId);
    if (!metrics) return;

    if (outcome === 'accepted') metrics.accepted++;
    if (outcome === 'replied') metrics.replied++;
    if (outcome === 'meeting') metrics.meetings++;

    this.checkForWinner(testId);
  }

  private calculatePValue(
    control: { sent: number; successes: number },
    treatment: { sent: number; successes: number }
  ): number {
    if (control.sent === 0 || treatment.sent === 0) return 1;

    const p1 = control.successes / control.sent;
    const p2 = treatment.successes / treatment.sent;
    const pPooled = (control.successes + treatment.successes) / (control.sent + treatment.sent);
    
    if (pPooled === 0 || pPooled === 1) return 1;

    const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / control.sent + 1 / treatment.sent));
    
    if (se === 0) return 1;

    const z = Math.abs(p1 - p2) / se;

    const pValue = 2 * (1 - this.normalCDF(z));
    return pValue;
  }

  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  private checkForWinner(testId: string): void {
    const test = this.tests.get(testId);
    if (!test || test.status !== 'running') return;

    const controlVariant = test.variants.find(v => v.isControl);
    if (!controlVariant) return;

    const controlMetrics = this.variantMetrics.get(controlVariant.id);
    if (!controlMetrics || controlMetrics.sent < test.minSampleSize) return;

    for (const variant of test.variants) {
      if (variant.isControl) continue;

      const metrics = this.variantMetrics.get(variant.id);
      if (!metrics || metrics.sent < test.minSampleSize) continue;

      const pValue = this.calculatePValue(
        { sent: controlMetrics.sent, successes: controlMetrics.accepted },
        { sent: metrics.sent, successes: metrics.accepted }
      );

      if (pValue < (1 - test.confidenceLevel)) {
        const controlRate = controlMetrics.accepted / controlMetrics.sent;
        const variantRate = metrics.accepted / metrics.sent;

        if (variantRate > controlRate) {
          test.winnerId = variant.id;
          test.status = 'completed';
          test.completedAt = new Date();
          return;
        }
      }
    }
  }

  getTestStats(testId: string): ABTestStats | null {
    const test = this.tests.get(testId);
    if (!test) return null;

    const controlVariant = test.variants.find(v => v.isControl);
    const controlMetrics = controlVariant ? this.variantMetrics.get(controlVariant.id) : null;

    const results: ABTestResult[] = test.variants.map(variant => {
      const metrics = this.variantMetrics.get(variant.id) || {
        sent: 0,
        accepted: 0,
        replied: 0,
        meetings: 0,
      };

      const acceptanceRate = metrics.sent > 0 ? (metrics.accepted / metrics.sent) * 100 : 0;
      const replyRate = metrics.sent > 0 ? (metrics.replied / metrics.sent) * 100 : 0;
      const meetingRate = metrics.sent > 0 ? (metrics.meetings / metrics.sent) * 100 : 0;

      let pValue: number | null = null;
      let uplift: number | null = null;

      if (!variant.isControl && controlMetrics && controlMetrics.sent > 0) {
        pValue = this.calculatePValue(
          { sent: controlMetrics.sent, successes: controlMetrics.accepted },
          { sent: metrics.sent, successes: metrics.accepted }
        );

        const controlRate = controlMetrics.accepted / controlMetrics.sent;
        if (controlRate > 0) {
          uplift = ((acceptanceRate / 100 - controlRate) / controlRate) * 100;
        }
      }

      return {
        variantId: variant.id,
        variantName: variant.name,
        sent: metrics.sent,
        accepted: metrics.accepted,
        replied: metrics.replied,
        meetings: metrics.meetings,
        acceptanceRate: Math.round(acceptanceRate * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
        meetingRate: Math.round(meetingRate * 10) / 10,
        isWinner: variant.id === test.winnerId,
        isStatisticallySignificant: pValue !== null && pValue < (1 - test.confidenceLevel),
        pValue,
        uplift: uplift !== null ? Math.round(uplift * 10) / 10 : null,
      };
    });

    const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
    const minSampleNeeded = test.minSampleSize * test.variants.length;
    const currentRate = totalSent > 0 ? totalSent / 7 : 10;
    const daysToSignificance = Math.ceil((minSampleNeeded - totalSent) / currentRate);

    let recommendation = '';
    if (test.winnerId) {
      const winner = results.find(r => r.isWinner);
      recommendation = `Winner declared: "${winner?.variantName}" with ${winner?.acceptanceRate}% acceptance rate`;
    } else if (totalSent < minSampleNeeded) {
      recommendation = `Keep running. Need ${minSampleNeeded - totalSent} more sends for statistical significance.`;
    } else {
      const bestResult = results.reduce((best, r) => 
        r.acceptanceRate > best.acceptanceRate ? r : best
      );
      recommendation = `No clear winner yet. "${bestResult.variantName}" is leading with ${bestResult.acceptanceRate}% acceptance rate.`;
    }

    return {
      testId: test.id,
      testName: test.name,
      status: test.status,
      totalSent,
      results,
      recommendation,
      canDeclareWinner: test.winnerId !== null,
      estimatedTimeToSignificance: totalSent >= minSampleNeeded 
        ? 'Ready for analysis' 
        : `~${daysToSignificance} days`,
    };
  }

  getActiveTests(campaignId: string): ABTest[] {
    return Array.from(this.tests.values())
      .filter(t => t.campaignId === campaignId && (t.status === 'running' || t.status === 'paused'));
  }

  getAllTests(workspaceId: string): ABTest[] {
    return Array.from(this.tests.values())
      .filter(t => t.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  declareWinner(testId: string, variantId: string): boolean {
    const test = this.tests.get(testId);
    if (!test) return false;

    test.winnerId = variantId;
    test.status = 'completed';
    test.completedAt = new Date();
    return true;
  }

  getWinningContent(testId: string): { content: string; subject?: string } | null {
    const test = this.tests.get(testId);
    if (!test || !test.winnerId) return null;

    const winner = test.variants.find(v => v.id === test.winnerId);
    if (!winner) return null;

    return {
      content: winner.content,
      subject: winner.subject,
    };
  }
}

export const linkedInABTestingEngine = new LinkedInABTestingEngine();
