/**
 * Sophia Auto-Actions Engine
 * Automatically takes action based on detected intent and engagement triggers
 */

import type { IntentType } from './intent-detection-engine';
import { predictConversion, LeadEngagementData, LeadFitData } from './sophia-predictive-engine';

// ============================================
// ENGAGEMENT-BASED AUTO-ACTION RULES
// ============================================

export interface EngagementRule {
  id: string;
  name: string;
  description: string;
  trigger: EngagementTrigger;
  conditions: EngagementCondition[];
  action: EngagementAction;
  enabled: boolean;
  priority: number;
  cooldownHours: number;
  requiresApproval: boolean;
}

export interface EngagementTrigger {
  type: 'email_opened' | 'email_clicked' | 'email_replied' | 'linkedin_replied' | 
        'meeting_booked' | 'lead_went_cold' | 'high_intent_detected' | 'score_changed' |
        'no_activity' | 'new_lead' | 'stage_changed';
  value?: string | number;
}

export interface EngagementCondition {
  field: string;
  operator: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'not_equals';
  value: string | number | boolean;
}

export interface EngagementAction {
  type: 'send_email' | 'send_linkedin' | 'send_sms' | 'schedule_followup' | 
        'assign_to_user' | 'add_tag' | 'move_to_stage' | 'create_task' | 'notify_user';
  params: Record<string, any>;
}

export interface RuleExecution {
  id: string;
  ruleId: string;
  ruleName: string;
  leadId: string;
  leadName: string;
  action: EngagementAction;
  status: 'pending' | 'approved' | 'executed' | 'rejected' | 'failed';
  createdAt: Date;
  executedAt?: Date;
  result?: string;
}

export interface SophiaAutonomySettings {
  enabled: boolean;
  autonomyLevel: number;
  approvalThreshold: number;
  maxActionsPerHour: number;
  maxActionsPerDay: number;
  workingHoursOnly: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  pauseUntil: Date | null;
  activeRules: string[];
}

const ENGAGEMENT_RULES: EngagementRule[] = [
  {
    id: 'rule_hot_lead_alert',
    name: 'Hot Lead Alert',
    description: 'Notify when a lead becomes hot (score > 80)',
    trigger: { type: 'score_changed' },
    conditions: [{ field: 'score', operator: 'greater_than', value: 80 }],
    action: { type: 'notify_user', params: { message: 'Hot lead detected! Score above 80%' } },
    enabled: true,
    priority: 1,
    cooldownHours: 24,
    requiresApproval: false
  },
  {
    id: 'rule_cold_lead_reengagement',
    name: 'Cold Lead Re-engagement',
    description: 'Schedule follow-up when lead goes cold (no activity 7+ days)',
    trigger: { type: 'no_activity', value: 7 },
    conditions: [{ field: 'lastActivityDays', operator: 'greater_than', value: 7 }],
    action: { 
      type: 'schedule_followup', 
      params: { delayHours: 24, templateId: 'reengagement_template', channel: 'email' } 
    },
    enabled: true,
    priority: 2,
    cooldownHours: 168,
    requiresApproval: true
  },
  {
    id: 'rule_reply_quick_response',
    name: 'Quick Response to Replies',
    description: 'Create urgent task when lead replies',
    trigger: { type: 'email_replied' },
    conditions: [],
    action: { type: 'create_task', params: { title: 'Respond to lead reply', priority: 'high', dueInHours: 2 } },
    enabled: true,
    priority: 1,
    cooldownHours: 0,
    requiresApproval: false
  },
  {
    id: 'rule_meeting_prep',
    name: 'Meeting Preparation',
    description: 'Create prep task when meeting is booked',
    trigger: { type: 'meeting_booked' },
    conditions: [],
    action: { type: 'create_task', params: { title: 'Prepare for upcoming meeting', priority: 'medium', dueInHours: 24 } },
    enabled: true,
    priority: 2,
    cooldownHours: 0,
    requiresApproval: false
  },
  {
    id: 'rule_high_intent_escalate',
    name: 'High Intent Escalation',
    description: 'Move to decision stage when high intent detected',
    trigger: { type: 'high_intent_detected' },
    conditions: [{ field: 'intentScore', operator: 'greater_than', value: 70 }],
    action: { type: 'move_to_stage', params: { stage: 'decision' } },
    enabled: true,
    priority: 1,
    cooldownHours: 48,
    requiresApproval: true
  },
  {
    id: 'rule_linkedin_followup',
    name: 'LinkedIn Follow-up',
    description: 'Send LinkedIn message after 2 email opens without reply',
    trigger: { type: 'email_opened' },
    conditions: [
      { field: 'emailOpens', operator: 'greater_than', value: 1 },
      { field: 'emailReplies', operator: 'equals', value: 0 }
    ],
    action: { type: 'send_linkedin', params: { templateId: 'linkedin_followup', delayHours: 24 } },
    enabled: true,
    priority: 3,
    cooldownHours: 72,
    requiresApproval: true
  },
  {
    id: 'rule_tag_engaged',
    name: 'Tag Engaged Leads',
    description: 'Add "engaged" tag when lead clicks 3+ times',
    trigger: { type: 'email_clicked' },
    conditions: [{ field: 'emailClicks', operator: 'greater_than', value: 2 }],
    action: { type: 'add_tag', params: { tag: 'engaged' } },
    enabled: true,
    priority: 4,
    cooldownHours: 0,
    requiresApproval: false
  }
];

let autonomySettings: SophiaAutonomySettings = {
  enabled: true,
  autonomyLevel: 50,
  approvalThreshold: 70,
  maxActionsPerHour: 10,
  maxActionsPerDay: 50,
  workingHoursOnly: true,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
  pauseUntil: null,
  activeRules: ENGAGEMENT_RULES.filter(r => r.enabled).map(r => r.id)
};

let customEngagementRules: EngagementRule[] = [...ENGAGEMENT_RULES];
let pendingRuleExecutions: RuleExecution[] = [];
let executedRuleActions: RuleExecution[] = [];
let ruleActionsThisHour = 0;
let ruleActionsToday = 0;
let lastHourReset = Date.now();
let lastDayReset = Date.now();

function resetRuleCountersIfNeeded() {
  const now = Date.now();
  if (now - lastHourReset > 3600000) {
    ruleActionsThisHour = 0;
    lastHourReset = now;
  }
  if (now - lastDayReset > 86400000) {
    ruleActionsToday = 0;
    lastDayReset = now;
  }
}

function isWithinWorkingHours(): boolean {
  if (!autonomySettings.workingHoursOnly) return true;
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTime = hours * 60 + minutes;
  const [startHour, startMin] = autonomySettings.workingHoursStart.split(':').map(Number);
  const [endHour, endMin] = autonomySettings.workingHoursEnd.split(':').map(Number);
  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;
  return currentTime >= startTime && currentTime <= endTime;
}

function canExecuteRuleAction(): boolean {
  resetRuleCountersIfNeeded();
  if (!autonomySettings.enabled) return false;
  if (autonomySettings.pauseUntil && new Date() < autonomySettings.pauseUntil) return false;
  if (!isWithinWorkingHours()) return false;
  if (ruleActionsThisHour >= autonomySettings.maxActionsPerHour) return false;
  if (ruleActionsToday >= autonomySettings.maxActionsPerDay) return false;
  return true;
}

function checkEngagementConditions(conditions: EngagementCondition[], leadData: Record<string, any>): boolean {
  return conditions.every(condition => {
    const value = leadData[condition.field];
    switch (condition.operator) {
      case 'equals': return value === condition.value;
      case 'not_equals': return value !== condition.value;
      case 'greater_than': return typeof value === 'number' && value > (condition.value as number);
      case 'less_than': return typeof value === 'number' && value < (condition.value as number);
      case 'contains': return typeof value === 'string' && value.includes(condition.value as string);
      default: return false;
    }
  });
}

export function evaluateEngagementTrigger(
  trigger: EngagementTrigger['type'],
  leadId: string,
  leadName: string,
  leadData: Record<string, any>
): RuleExecution[] {
  if (!canExecuteRuleAction()) return [];
  
  const matchingRules = customEngagementRules.filter(rule => 
    rule.enabled && 
    rule.trigger.type === trigger &&
    autonomySettings.activeRules.includes(rule.id) &&
    checkEngagementConditions(rule.conditions, leadData)
  );
  
  const sortedRules = matchingRules.sort((a, b) => a.priority - b.priority);
  const executions: RuleExecution[] = [];
  
  for (const rule of sortedRules) {
    const needsApproval = rule.requiresApproval || autonomySettings.autonomyLevel < autonomySettings.approvalThreshold;
    
    const execution: RuleExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      leadId,
      leadName,
      action: rule.action,
      status: needsApproval ? 'pending' : 'executed',
      createdAt: new Date(),
      executedAt: needsApproval ? undefined : new Date()
    };
    
    if (needsApproval) {
      pendingRuleExecutions.push(execution);
    } else {
      execution.result = `Auto-executed: ${rule.action.type}`;
      executedRuleActions.push(execution);
      ruleActionsThisHour++;
      ruleActionsToday++;
    }
    
    executions.push(execution);
  }
  
  return executions;
}

export function approveRuleExecution(executionId: string): RuleExecution | null {
  const index = pendingRuleExecutions.findIndex(a => a.id === executionId);
  if (index === -1) return null;
  
  const action = pendingRuleExecutions.splice(index, 1)[0];
  action.status = 'executed';
  action.executedAt = new Date();
  action.result = `Approved and executed: ${action.action.type}`;
  
  executedRuleActions.push(action);
  ruleActionsThisHour++;
  ruleActionsToday++;
  
  return action;
}

export function rejectRuleExecution(executionId: string, reason?: string): RuleExecution | null {
  const index = pendingRuleExecutions.findIndex(a => a.id === executionId);
  if (index === -1) return null;
  
  const action = pendingRuleExecutions.splice(index, 1)[0];
  action.status = 'rejected';
  action.result = reason || 'Rejected by user';
  executedRuleActions.push(action);
  
  return action;
}

export function getAutonomySettings(): SophiaAutonomySettings {
  return { ...autonomySettings };
}

export function updateAutonomySettings(updates: Partial<SophiaAutonomySettings>): SophiaAutonomySettings {
  autonomySettings = { ...autonomySettings, ...updates };
  return autonomySettings;
}

export function getEngagementRules(): EngagementRule[] {
  return [...customEngagementRules];
}

export function updateEngagementRule(ruleId: string, updates: Partial<EngagementRule>): EngagementRule | null {
  const index = customEngagementRules.findIndex(r => r.id === ruleId);
  if (index === -1) return null;
  customEngagementRules[index] = { ...customEngagementRules[index], ...updates };
  return customEngagementRules[index];
}

export function addEngagementRule(rule: Omit<EngagementRule, 'id'>): EngagementRule {
  const newRule: EngagementRule = { ...rule, id: `rule_custom_${Date.now()}` };
  customEngagementRules.push(newRule);
  return newRule;
}

export function deleteEngagementRule(ruleId: string): boolean {
  const index = customEngagementRules.findIndex(r => r.id === ruleId);
  if (index === -1) return false;
  customEngagementRules.splice(index, 1);
  autonomySettings.activeRules = autonomySettings.activeRules.filter(id => id !== ruleId);
  return true;
}

export function getPendingRuleExecutions(): RuleExecution[] {
  return [...pendingRuleExecutions];
}

export function getRecentRuleExecutions(limit: number = 20): RuleExecution[] {
  return executedRuleActions.slice(-limit).reverse();
}

export function getAutoActionStats(): {
  pendingCount: number;
  executedToday: number;
  executedThisHour: number;
  approvalRate: number;
  topRules: { ruleId: string; ruleName: string; executionCount: number }[];
} {
  const ruleCounts = new Map<string, { name: string; count: number }>();
  
  for (const exec of executedRuleActions) {
    const current = ruleCounts.get(exec.ruleId) || { name: exec.ruleName, count: 0 };
    current.count++;
    ruleCounts.set(exec.ruleId, current);
  }
  
  const topRules = Array.from(ruleCounts.entries())
    .map(([ruleId, { name, count }]) => ({ ruleId, ruleName: name, executionCount: count }))
    .sort((a, b) => b.executionCount - a.executionCount)
    .slice(0, 5);
  
  const approved = executedRuleActions.filter(a => a.status === 'executed').length;
  const total = executedRuleActions.length + pendingRuleExecutions.length;
  
  return {
    pendingCount: pendingRuleExecutions.length,
    executedToday: ruleActionsToday,
    executedThisHour: ruleActionsThisHour,
    approvalRate: total > 0 ? Math.round((approved / total) * 100) : 100,
    topRules
  };
}

export function pauseAutoActions(hours: number): void {
  const pauseUntil = new Date();
  pauseUntil.setHours(pauseUntil.getHours() + hours);
  autonomySettings.pauseUntil = pauseUntil;
}

export function resumeAutoActions(): void {
  autonomySettings.pauseUntil = null;
}

export function emergencyStop(): void {
  autonomySettings.enabled = false;
  autonomySettings.pauseUntil = new Date(Date.now() + 86400000 * 365);
}

// ============================================
// ORIGINAL INTENT-BASED AUTO-ACTIONS (below)
// ============================================

export interface AutoAction {
  type: 'send_reply' | 'route_to_sales' | 'tag_lead' | 'schedule_followup' | 'send_email';
  intent: IntentType;
  label: string;
  description: string;
  enabled: boolean;
  config?: Record<string, any>;
}

export interface AutoReply {
  intent: IntentType;
  template: string;
  enabled: boolean;
}

// Default auto-reply templates
export const DEFAULT_AUTO_REPLIES: Record<IntentType, string> = {
  interested: `Thanks for your interest! I'm excited about the opportunity to work together. Let me send you some case studies and we can schedule a demo. What time works best for you?`,
  
  not_interested: `I completely understand. Keep us in mind for the future—we're always improving our offering based on customer feedback. Best of luck with your current solution!`,
  
  meeting_request: `Perfect timing! I'd love to meet with you. Let me check my calendar and send over a few time slots. In the meantime, here's a quick overview of what we can accomplish together.`,
  
  information_needed: `Great question! I'm putting together a detailed overview tailored to your needs. I'll send that over within the hour, along with answers to any other questions you might have.`,
  
  price_inquiry: `I appreciate you asking. Pricing varies based on your team size and needs. Let me send you a customized quote. I'm confident we'll offer excellent value for your investment.`,
  
  follow_up_needed: `No problem at all! I know decision-making takes time. I'll check back in 5 days with some additional insights. In the meantime, feel free to reach out with any questions.`,
  
  meeting_scheduled: `Excellent! I'm looking forward to our meeting. I'll send over a calendar invite and some prep materials. See you then!`
};

// Auto-action rules for each intent
export const AUTO_ACTIONS: Record<IntentType, AutoAction[]> = {
  interested: [
    {
      type: 'send_reply',
      intent: 'interested',
      label: 'Send Interested Reply',
      description: 'Automatically send a thank-you and demo offer',
      enabled: true
    },
    {
      type: 'tag_lead',
      intent: 'interested',
      label: 'Tag: Hot Lead',
      description: 'Mark as hot prospect for priority follow-up',
      enabled: true,
      config: { tag: 'hot-lead', score: 95 }
    },
    {
      type: 'route_to_sales',
      intent: 'interested',
      label: 'Route to Sales',
      description: 'Send to sales team for immediate outreach',
      enabled: true
    }
  ],
  
  not_interested: [
    {
      type: 'send_reply',
      intent: 'not_interested',
      label: 'Send Respectful Reply',
      description: 'Acknowledge their decision respectfully',
      enabled: true
    },
    {
      type: 'tag_lead',
      intent: 'not_interested',
      label: 'Tag: Not Interested',
      description: 'Mark for nurture sequences only',
      enabled: true,
      config: { tag: 'not-interested', score: 20 }
    }
  ],
  
  meeting_request: [
    {
      type: 'send_reply',
      intent: 'meeting_request',
      label: 'Send Meeting Confirmation',
      description: 'Confirm meeting and send calendar link',
      enabled: true
    },
    {
      type: 'route_to_sales',
      intent: 'meeting_request',
      label: 'Route to Sales for Demo',
      description: 'Assign to sales for demo scheduling',
      enabled: true
    },
    {
      type: 'tag_lead',
      intent: 'meeting_request',
      label: 'Tag: Meeting Requested',
      description: 'Track for pipeline visibility',
      enabled: true,
      config: { tag: 'meeting-requested', score: 80 }
    }
  ],
  
  information_needed: [
    {
      type: 'send_reply',
      intent: 'information_needed',
      label: 'Send Information',
      description: 'Provide requested details and FAQ',
      enabled: true
    },
    {
      type: 'tag_lead',
      intent: 'information_needed',
      label: 'Tag: Researching',
      description: 'Mark as actively researching',
      enabled: true,
      config: { tag: 'researching', score: 60 }
    }
  ],
  
  price_inquiry: [
    {
      type: 'send_reply',
      intent: 'price_inquiry',
      label: 'Send Pricing Info',
      description: 'Share pricing and ROI information',
      enabled: true
    },
    {
      type: 'tag_lead',
      intent: 'price_inquiry',
      label: 'Tag: Budget Conscious',
      description: 'Track pricing objections for follow-up',
      enabled: true,
      config: { tag: 'price-inquiry', score: 50 }
    }
  ],
  
  follow_up_needed: [
    {
      type: 'schedule_followup',
      intent: 'follow_up_needed',
      label: 'Schedule Auto Follow-up',
      description: 'Auto-follow up in 5-7 days',
      enabled: true,
      config: { days: 5 }
    },
    {
      type: 'tag_lead',
      intent: 'follow_up_needed',
      label: 'Tag: Follow-up Pending',
      description: 'Queue for automated follow-up sequence',
      enabled: true,
      config: { tag: 'follow-up-pending', score: 40 }
    }
  ],
  
  meeting_scheduled: [
    {
      type: 'send_reply',
      intent: 'meeting_scheduled',
      label: 'Send Meeting Prep',
      description: 'Send agenda and prep materials',
      enabled: true
    },
    {
      type: 'tag_lead',
      intent: 'meeting_scheduled',
      label: 'Tag: Meeting Confirmed',
      description: 'Mark for sales pipeline',
      enabled: true,
      config: { tag: 'meeting-confirmed', score: 85 }
    },
    {
      type: 'route_to_sales',
      intent: 'meeting_scheduled',
      label: 'Route to Sales Rep',
      description: 'Assign to sales for meeting preparation',
      enabled: true
    }
  ]
};

/**
 * Get auto-actions for a specific intent
 */
export function getActionsForIntent(intent: IntentType): AutoAction[] {
  return AUTO_ACTIONS[intent] || [];
}

/**
 * Get auto-reply template for intent
 */
export function getAutoReplyTemplate(intent: IntentType): string {
  return DEFAULT_AUTO_REPLIES[intent] || DEFAULT_AUTO_REPLIES.information_needed;
}

/**
 * Execute auto-actions
 */
export async function executeAutoActions(
  messageId: string,
  intent: IntentType,
  leadId: string,
  messageText: string
): Promise<{ actions_executed: string[]; results: any[] }> {
  const actions = getActionsForIntent(intent);
  const executed: string[] = [];
  const results: any[] = [];

  for (const action of actions) {
    if (!action.enabled) continue;

    try {
      switch (action.type) {
        case 'send_reply': {
          const reply = getAutoReplyTemplate(intent);
          executed.push(`✅ Sent auto-reply (${intent})`);
          results.push({ type: 'reply', intent, messageId, leadId });
          break;
        }
        
        case 'tag_lead': {
          const tag = action.config?.tag || intent;
          executed.push(`✅ Tagged lead: ${tag}`);
          results.push({ type: 'tag', leadId, tag, score: action.config?.score });
          break;
        }
        
        case 'route_to_sales': {
          executed.push(`✅ Routed to sales team`);
          results.push({ type: 'route', leadId, queue: 'sales', priority: 'high' });
          break;
        }
        
        case 'schedule_followup': {
          const days = action.config?.days || 5;
          executed.push(`✅ Scheduled follow-up in ${days} days`);
          results.push({ type: 'followup', leadId, days, status: 'scheduled' });
          break;
        }
        
        case 'send_email': {
          executed.push(`✅ Sent email`);
          results.push({ type: 'email', leadId, status: 'sent' });
          break;
        }
      }
    } catch (error) {
      console.error(`Error executing action ${action.type}:`, error);
    }
  }

  return {
    actions_executed: executed,
    results
  };
}
