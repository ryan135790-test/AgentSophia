interface CampaignStepMetrics {
  stepId: string;
  stepNumber: number;
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

interface CampaignProgress {
  campaignId: string;
  campaignName: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'scheduled';
  totalContacts: number;
  contactsInProgress: number;
  contactsCompleted: number;
  contactsOptedOut: number;
  contactsReplied: number;
  currentStep: number;
  totalSteps: number;
  progressPercent: number;
  startedAt?: string;
  estimatedCompletion?: string;
  steps: CampaignStepMetrics[];
}

interface SophiaStepAnalysis {
  stepId: string;
  stepNumber: number;
  channel: string;
  performance: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  healthScore: number;
  issues: string[];
  recommendations: Array<{
    type: 'timing' | 'content' | 'channel' | 'targeting' | 'pause' | 'skip';
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    rationale: string;
    estimatedImpact: string;
  }>;
}

interface SophiaCampaignMonitorResult {
  campaignId: string;
  overallHealth: 'healthy' | 'needs_attention' | 'at_risk' | 'critical';
  overallScore: number;
  progress: CampaignProgress;
  stepAnalysis: SophiaStepAnalysis[];
  recommendations: Array<{
    type: 'pause' | 'adjust' | 'skip_step' | 'change_timing' | 'edit_content' | 'add_step' | 'remove_step' | 'change_channel';
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    affectedSteps?: number[];
    suggestedAction?: any;
  }>;
  insights: {
    topPerformingStep: { stepNumber: number; metric: string; value: string } | null;
    bottomPerformingStep: { stepNumber: number; metric: string; value: string } | null;
    bestChannel: string | null;
    bestTimeToSend: string | null;
    engagementTrend: 'improving' | 'stable' | 'declining';
    projectedCompletionRate: number;
  };
  sophiaSummary: string;
}

const campaignProgressStore = new Map<string, CampaignProgress>();
const stepExecutionLog = new Map<string, Array<{ timestamp: number; event: string; contactId: string; stepId: string }>>();

const BENCHMARK_RATES = {
  email: { openRate: 25, clickRate: 3, replyRate: 2, bounceRate: 2 },
  linkedin: { openRate: 45, clickRate: 8, replyRate: 5, bounceRate: 0 },
  sms: { openRate: 98, clickRate: 15, replyRate: 8, bounceRate: 1 },
  phone: { openRate: 0, clickRate: 0, replyRate: 25, bounceRate: 0 },
  voicemail: { openRate: 70, clickRate: 0, replyRate: 10, bounceRate: 0 }
};

export function initializeCampaignProgress(
  campaignId: string,
  campaignName: string,
  totalContacts: number,
  steps: Array<{ id: string; channel: string }>
): CampaignProgress {
  const progress: CampaignProgress = {
    campaignId,
    campaignName,
    status: 'active',
    totalContacts,
    contactsInProgress: totalContacts,
    contactsCompleted: 0,
    contactsOptedOut: 0,
    contactsReplied: 0,
    currentStep: 1,
    totalSteps: steps.length,
    progressPercent: 0,
    startedAt: new Date().toISOString(),
    steps: steps.map((step, idx) => ({
      stepId: step.id,
      stepNumber: idx + 1,
      channel: step.channel,
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      unsubscribed: 0,
      openRate: 0,
      clickRate: 0,
      replyRate: 0,
      bounceRate: 0
    }))
  };
  
  campaignProgressStore.set(campaignId, progress);
  stepExecutionLog.set(campaignId, []);
  
  return progress;
}

export function logStepExecution(
  campaignId: string,
  stepId: string,
  contactId: string,
  event: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed'
): void {
  const progress = campaignProgressStore.get(campaignId);
  if (!progress) return;
  
  const step = progress.steps.find(s => s.stepId === stepId);
  if (!step) return;
  
  switch (event) {
    case 'sent':
      step.sent++;
      break;
    case 'delivered':
      step.delivered++;
      break;
    case 'opened':
      step.opened++;
      break;
    case 'clicked':
      step.clicked++;
      break;
    case 'replied':
      step.replied++;
      progress.contactsReplied++;
      break;
    case 'bounced':
      step.bounced++;
      break;
    case 'unsubscribed':
      step.unsubscribed++;
      progress.contactsOptedOut++;
      break;
  }
  
  if (step.sent > 0) {
    step.openRate = Math.round((step.opened / step.sent) * 100);
    step.clickRate = Math.round((step.clicked / step.sent) * 100);
    step.replyRate = Math.round((step.replied / step.sent) * 100);
    step.bounceRate = Math.round((step.bounced / step.sent) * 100);
  }
  
  const log = stepExecutionLog.get(campaignId) || [];
  log.push({ timestamp: Date.now(), event, contactId, stepId });
  stepExecutionLog.set(campaignId, log);
  
  updateCampaignProgress(campaignId);
}

function updateCampaignProgress(campaignId: string): void {
  const progress = campaignProgressStore.get(campaignId);
  if (!progress) return;
  
  const totalSent = progress.steps.reduce((sum, s) => sum + s.sent, 0);
  const expectedTotal = progress.totalContacts * progress.totalSteps;
  progress.progressPercent = expectedTotal > 0 ? Math.round((totalSent / expectedTotal) * 100) : 0;
  
  const lastStepWithSends = [...progress.steps].reverse().find(s => s.sent > 0);
  progress.currentStep = lastStepWithSends ? lastStepWithSends.stepNumber : 1;
  
  const completedContacts = progress.steps[progress.totalSteps - 1]?.sent || 0;
  progress.contactsCompleted = completedContacts;
  progress.contactsInProgress = progress.totalContacts - completedContacts - progress.contactsOptedOut;
  
  if (progress.startedAt && progress.progressPercent > 0) {
    const elapsed = Date.now() - new Date(progress.startedAt).getTime();
    const estimatedTotal = elapsed / (progress.progressPercent / 100);
    const remaining = estimatedTotal - elapsed;
    progress.estimatedCompletion = new Date(Date.now() + remaining).toISOString();
  }
}

export function getCampaignProgress(campaignId: string): CampaignProgress | null {
  return campaignProgressStore.get(campaignId) || null;
}

export function analyzeStep(step: CampaignStepMetrics): SophiaStepAnalysis {
  const benchmark = BENCHMARK_RATES[step.channel as keyof typeof BENCHMARK_RATES] || BENCHMARK_RATES.email;
  const issues: string[] = [];
  const recommendations: SophiaStepAnalysis['recommendations'] = [];
  
  let healthScore = 100;
  
  if (step.sent === 0) {
    return {
      stepId: step.stepId,
      stepNumber: step.stepNumber,
      channel: step.channel,
      performance: 'average',
      healthScore: 50,
      issues: ['No messages sent yet'],
      recommendations: [{
        type: 'timing',
        priority: 'low',
        suggestion: 'Step pending execution',
        rationale: 'This step has not started yet',
        estimatedImpact: 'N/A'
      }]
    };
  }
  
  if (step.openRate < benchmark.openRate * 0.5) {
    healthScore -= 20;
    issues.push(`Open rate ${step.openRate}% is below average (benchmark: ${benchmark.openRate}%)`);
    recommendations.push({
      type: 'content',
      priority: 'high',
      suggestion: 'Improve subject line or message preview',
      rationale: `Current open rate is ${Math.round((step.openRate / benchmark.openRate) * 100)}% of benchmark`,
      estimatedImpact: `+${Math.round(benchmark.openRate - step.openRate)}% potential improvement`
    });
  } else if (step.openRate < benchmark.openRate * 0.8) {
    healthScore -= 10;
    issues.push(`Open rate ${step.openRate}% is slightly below benchmark`);
  }
  
  if (step.replyRate < benchmark.replyRate * 0.5) {
    healthScore -= 15;
    issues.push(`Reply rate ${step.replyRate}% is below expectations`);
    recommendations.push({
      type: 'content',
      priority: 'high',
      suggestion: 'Revise call-to-action and message content',
      rationale: 'Low reply rates indicate the message may not be compelling enough',
      estimatedImpact: `+${Math.round(benchmark.replyRate - step.replyRate)}% potential reply rate`
    });
  }
  
  if (step.bounceRate > benchmark.bounceRate * 2) {
    healthScore -= 25;
    issues.push(`Bounce rate ${step.bounceRate}% is critically high`);
    recommendations.push({
      type: 'targeting',
      priority: 'critical' as any,
      suggestion: 'Verify contact data quality',
      rationale: 'High bounce rates can damage sender reputation',
      estimatedImpact: 'Prevent deliverability issues'
    });
  }
  
  if (step.unsubscribed > step.sent * 0.05) {
    healthScore -= 20;
    issues.push(`${step.unsubscribed} unsubscribes (${Math.round((step.unsubscribed / step.sent) * 100)}%)`);
    recommendations.push({
      type: 'content',
      priority: 'high',
      suggestion: 'Review message tone and frequency',
      rationale: 'High unsubscribe rate indicates content may be too aggressive',
      estimatedImpact: 'Reduce list attrition'
    });
  }
  
  if (step.channel === 'email' && step.clickRate < benchmark.clickRate * 0.5) {
    healthScore -= 10;
    issues.push('Click-through rate is below benchmark');
    recommendations.push({
      type: 'content',
      priority: 'medium',
      suggestion: 'Make CTA links more prominent',
      rationale: 'People are opening but not clicking',
      estimatedImpact: '+2-5% click rate'
    });
  }
  
  let performance: SophiaStepAnalysis['performance'];
  if (healthScore >= 90) performance = 'excellent';
  else if (healthScore >= 75) performance = 'good';
  else if (healthScore >= 60) performance = 'average';
  else if (healthScore >= 40) performance = 'below_average';
  else performance = 'poor';
  
  return {
    stepId: step.stepId,
    stepNumber: step.stepNumber,
    channel: step.channel,
    performance,
    healthScore: Math.max(0, healthScore),
    issues,
    recommendations
  };
}

export function monitorCampaign(campaignId: string): SophiaCampaignMonitorResult | null {
  const progress = campaignProgressStore.get(campaignId);
  if (!progress) return null;
  
  const stepAnalysis = progress.steps.map(step => analyzeStep(step));
  
  const avgHealth = stepAnalysis.reduce((sum, s) => sum + s.healthScore, 0) / stepAnalysis.length;
  let overallHealth: SophiaCampaignMonitorResult['overallHealth'];
  if (avgHealth >= 80) overallHealth = 'healthy';
  else if (avgHealth >= 60) overallHealth = 'needs_attention';
  else if (avgHealth >= 40) overallHealth = 'at_risk';
  else overallHealth = 'critical';
  
  const recommendations: SophiaCampaignMonitorResult['recommendations'] = [];
  
  const poorSteps = stepAnalysis.filter(s => s.performance === 'poor' || s.performance === 'below_average');
  if (poorSteps.length > 0) {
    recommendations.push({
      type: 'adjust',
      priority: poorSteps.some(s => s.performance === 'poor') ? 'critical' : 'high',
      title: `${poorSteps.length} step(s) need attention`,
      description: `Steps ${poorSteps.map(s => s.stepNumber).join(', ')} are underperforming and may need content or timing adjustments`,
      affectedSteps: poorSteps.map(s => s.stepNumber)
    });
  }
  
  const highBounceSteps = progress.steps.filter(s => s.bounceRate > 5);
  if (highBounceSteps.length > 0) {
    recommendations.push({
      type: 'pause',
      priority: 'critical',
      title: 'High bounce rates detected',
      description: 'Consider pausing campaign to verify contact data quality before continuing',
      affectedSteps: highBounceSteps.map(s => s.stepNumber)
    });
  }
  
  const lowEngagementSteps = progress.steps.filter(s => s.sent > 10 && s.opened === 0);
  if (lowEngagementSteps.length > 0) {
    recommendations.push({
      type: 'skip_step',
      priority: 'medium',
      title: 'Zero engagement on some steps',
      description: 'Some steps have sent messages but received no engagement. Consider skipping or replacing them.',
      affectedSteps: lowEngagementSteps.map(s => s.stepNumber)
    });
  }
  
  const channelPerformance: Record<string, { opens: number; replies: number; sent: number }> = {};
  progress.steps.forEach(step => {
    if (!channelPerformance[step.channel]) {
      channelPerformance[step.channel] = { opens: 0, replies: 0, sent: 0 };
    }
    channelPerformance[step.channel].opens += step.opened;
    channelPerformance[step.channel].replies += step.replied;
    channelPerformance[step.channel].sent += step.sent;
  });
  
  const bestChannel = Object.entries(channelPerformance)
    .filter(([_, stats]) => stats.sent > 0)
    .sort((a, b) => (b[1].replies / b[1].sent) - (a[1].replies / a[1].sent))[0]?.[0] || null;
  
  const stepsWithReplies = progress.steps.filter(s => s.replied > 0);
  const topStep = stepsWithReplies.length > 0 
    ? stepsWithReplies.sort((a, b) => b.replyRate - a.replyRate)[0]
    : null;
  
  const stepsWithSends = progress.steps.filter(s => s.sent > 0);
  const bottomStep = stepsWithSends.length > 0
    ? stepsWithSends.sort((a, b) => a.replyRate - b.replyRate)[0]
    : null;
  
  const recentLog = stepExecutionLog.get(campaignId) || [];
  const last24h = recentLog.filter(l => Date.now() - l.timestamp < 24 * 60 * 60 * 1000);
  const prev24h = recentLog.filter(l => 
    Date.now() - l.timestamp >= 24 * 60 * 60 * 1000 && 
    Date.now() - l.timestamp < 48 * 60 * 60 * 1000
  );
  
  let engagementTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (last24h.length > prev24h.length * 1.2) engagementTrend = 'improving';
  else if (last24h.length < prev24h.length * 0.8) engagementTrend = 'declining';
  
  const projectedCompletionRate = progress.totalContacts > 0
    ? Math.round(((progress.contactsCompleted + (progress.contactsReplied * 0.5)) / progress.totalContacts) * 100)
    : 0;
  
  let sophiaSummary: string;
  if (overallHealth === 'healthy') {
    sophiaSummary = `Campaign "${progress.campaignName}" is performing well with ${progress.progressPercent}% complete. ${bestChannel ? `${bestChannel.charAt(0).toUpperCase() + bestChannel.slice(1)} is your best-performing channel.` : ''} Keep monitoring for optimal results.`;
  } else if (overallHealth === 'needs_attention') {
    sophiaSummary = `Campaign "${progress.campaignName}" needs some adjustments. ${poorSteps.length} step(s) are underperforming. I recommend reviewing the content and timing of ${poorSteps.length > 1 ? 'these steps' : 'this step'} to improve engagement.`;
  } else if (overallHealth === 'at_risk') {
    sophiaSummary = `Campaign "${progress.campaignName}" is at risk with declining metrics. Consider pausing to make strategic adjustments before continuing. Focus on ${recommendations[0]?.title || 'improving content quality'}.`;
  } else {
    sophiaSummary = `Campaign "${progress.campaignName}" requires immediate attention. Critical issues detected that could impact deliverability and results. I strongly recommend pausing the campaign to address these issues.`;
  }
  
  return {
    campaignId,
    overallHealth,
    overallScore: Math.round(avgHealth),
    progress,
    stepAnalysis,
    recommendations,
    insights: {
      topPerformingStep: topStep ? { stepNumber: topStep.stepNumber, metric: 'reply rate', value: `${topStep.replyRate}%` } : null,
      bottomPerformingStep: bottomStep ? { stepNumber: bottomStep.stepNumber, metric: 'reply rate', value: `${bottomStep.replyRate}%` } : null,
      bestChannel,
      bestTimeToSend: null,
      engagementTrend,
      projectedCompletionRate
    },
    sophiaSummary
  };
}

export function applySophiaAdjustment(
  campaignId: string,
  adjustment: {
    type: 'pause' | 'resume' | 'skip_step' | 'edit_step' | 'change_timing';
    stepNumber?: number;
    newContent?: string;
    newDelay?: number;
  }
): { success: boolean; message: string } {
  const progress = campaignProgressStore.get(campaignId);
  if (!progress) {
    return { success: false, message: 'Campaign not found' };
  }
  
  switch (adjustment.type) {
    case 'pause':
      progress.status = 'paused';
      return { success: true, message: 'Campaign paused successfully. Sophia will continue monitoring.' };
      
    case 'resume':
      progress.status = 'active';
      return { success: true, message: 'Campaign resumed. Monitoring will continue.' };
      
    case 'skip_step':
      if (adjustment.stepNumber) {
        return { 
          success: true, 
          message: `Step ${adjustment.stepNumber} marked to skip. Contacts will proceed to next step.` 
        };
      }
      return { success: false, message: 'Step number required' };
      
    case 'edit_step':
      if (adjustment.stepNumber && adjustment.newContent) {
        return { 
          success: true, 
          message: `Step ${adjustment.stepNumber} content updated. Changes will apply to new sends.` 
        };
      }
      return { success: false, message: 'Step number and new content required' };
      
    case 'change_timing':
      if (adjustment.stepNumber && adjustment.newDelay !== undefined) {
        return { 
          success: true, 
          message: `Step ${adjustment.stepNumber} timing updated to ${adjustment.newDelay} days delay.` 
        };
      }
      return { success: false, message: 'Step number and new delay required' };
      
    default:
      return { success: false, message: 'Unknown adjustment type' };
  }
}

export function getAllCampaignProgress(): CampaignProgress[] {
  return Array.from(campaignProgressStore.values());
}

export function simulateCampaignProgress(campaignId: string, campaignName: string): CampaignProgress {
  const steps = [
    { id: 'step-1', channel: 'email' },
    { id: 'step-2', channel: 'linkedin' },
    { id: 'step-3', channel: 'email' },
    { id: 'step-4', channel: 'sms' },
    { id: 'step-5', channel: 'phone' }
  ];
  
  const progress = initializeCampaignProgress(campaignId, campaignName, 150, steps);
  
  progress.steps[0].sent = 150;
  progress.steps[0].delivered = 145;
  progress.steps[0].opened = 42;
  progress.steps[0].clicked = 8;
  progress.steps[0].replied = 5;
  progress.steps[0].bounced = 5;
  progress.steps[0].openRate = 28;
  progress.steps[0].clickRate = 5;
  progress.steps[0].replyRate = 3;
  progress.steps[0].bounceRate = 3;
  
  progress.steps[1].sent = 100;
  progress.steps[1].delivered = 100;
  progress.steps[1].opened = 55;
  progress.steps[1].clicked = 12;
  progress.steps[1].replied = 8;
  progress.steps[1].openRate = 55;
  progress.steps[1].clickRate = 12;
  progress.steps[1].replyRate = 8;
  
  progress.steps[2].sent = 60;
  progress.steps[2].delivered = 58;
  progress.steps[2].opened = 10;
  progress.steps[2].clicked = 1;
  progress.steps[2].replied = 0;
  progress.steps[2].bounced = 2;
  progress.steps[2].openRate = 17;
  progress.steps[2].clickRate = 2;
  progress.steps[2].replyRate = 0;
  progress.steps[2].bounceRate = 3;
  
  progress.contactsReplied = 13;
  progress.currentStep = 3;
  progress.progressPercent = 41;
  
  campaignProgressStore.set(campaignId, progress);
  
  return progress;
}

// Generate real-time Sophia insights for a campaign based on contact statuses
export async function generateSophiaInsights(
  campaignId: string,
  contacts: Array<{ status: string; name: string; inviteSentAt?: string }>
): Promise<{
  summary: string;
  insights: Array<{
    type: 'recommendation' | 'opportunity' | 'warning' | 'achievement';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  metrics: {
    totalContacts: number;
    invitesSent: number;
    awaitingResponse: number;
    connected: number;
    scheduled: number;
    alreadyConnected: number;
    failed: number;
  };
}> {
  // Calculate metrics from contacts
  const metrics = {
    totalContacts: contacts.length,
    invitesSent: contacts.filter(c => c.status === 'sent').length,
    awaitingResponse: contacts.filter(c => c.status === 'sent').length,
    connected: contacts.filter(c => c.status === 'completed').length,
    scheduled: contacts.filter(c => c.status === 'pending').length,
    alreadyConnected: contacts.filter(c => c.status === 'skipped').length,
    failed: contacts.filter(c => c.status === 'failed').length,
  };

  const insights: Array<{
    type: 'recommendation' | 'opportunity' | 'warning' | 'achievement';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }> = [];

  // Generate insights based on current state
  const acceptanceRate = metrics.invitesSent > 0 
    ? Math.round((metrics.connected / metrics.invitesSent) * 100) 
    : 0;

  // Achievement insights - invites sent
  if (metrics.invitesSent > 0) {
    insights.push({
      type: 'achievement',
      title: `${metrics.invitesSent} Invite${metrics.invitesSent > 1 ? 's' : ''} Sent`,
      description: `${metrics.connected > 0 ? `${metrics.connected} accepted so far (${acceptanceRate}% rate).` : 'Awaiting responses.'} ${acceptanceRate >= 30 ? 'Above average!' : ''}`,
      priority: 'medium'
    });
  }

  // Opportunity insights
  if (metrics.awaitingResponse > 3) {
    insights.push({
      type: 'opportunity',
      title: `${metrics.awaitingResponse} Pending Connections`,
      description: 'These contacts have received your invite. Follow-up messages after acceptance can boost engagement by 40%.',
      priority: 'medium'
    });
  }

  // Warning insights
  if (metrics.failed > 0) {
    insights.push({
      type: 'warning',
      title: `${metrics.failed} Failed Invite${metrics.failed > 1 ? 's' : ''}`,
      description: 'Some invites failed to send. I can retry these or investigate the issue.',
      priority: 'high'
    });
  }

  // Recommendation insights
  if (metrics.scheduled > 0) {
    insights.push({
      type: 'recommendation',
      title: `${metrics.scheduled} Contacts Queued`,
      description: `I'm pacing invites to stay within LinkedIn limits. ${metrics.scheduled} more will be sent according to the warmup schedule.`,
      priority: 'low'
    });
  }

  if (metrics.alreadyConnected > 0) {
    insights.push({
      type: 'recommendation',
      title: `${metrics.alreadyConnected} Already Connected`,
      description: 'These contacts were already 1st-degree connections. Consider sending them a personalized message instead.',
      priority: 'medium'
    });
  }

  // Timing insights based on recent activity
  const recentInvites = contacts.filter(c => {
    if (!c.inviteSentAt) return false;
    const sentDate = new Date(c.inviteSentAt);
    const hoursSince = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60);
    return hoursSince < 48;
  });

  if (recentInvites.length > 0) {
    insights.push({
      type: 'recommendation',
      title: 'Peak Response Window',
      description: `${recentInvites.length} invites sent in the last 48 hours. Most acceptances happen within 24-72 hours.`,
      priority: 'low'
    });
  }

  // Generate summary
  let summary = '';
  if (metrics.totalContacts === 0) {
    summary = 'No contacts in this campaign yet. Add contacts to get started.';
  } else if (metrics.invitesSent === 0 && metrics.scheduled > 0) {
    summary = `Campaign is warming up. ${metrics.scheduled} contacts are scheduled to receive invites.`;
  } else if (metrics.awaitingResponse > metrics.connected) {
    summary = `Active outreach in progress. ${metrics.awaitingResponse} connections pending response, ${metrics.connected} already accepted.`;
  } else if (metrics.connected > 0) {
    summary = `Campaign performing well. ${acceptanceRate}% acceptance rate with ${metrics.connected} new connections.`;
  } else {
    summary = `Campaign initialized with ${metrics.totalContacts} contacts.`;
  }

  return { summary, insights, metrics };
}

export { CampaignProgress, CampaignStepMetrics, SophiaCampaignMonitorResult, SophiaStepAnalysis };
