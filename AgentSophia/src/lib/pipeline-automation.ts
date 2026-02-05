import { supabase } from "@/integrations/supabase/client";

export interface PipelineRule {
  id?: string;
  name: string;
  from_stage: string;
  to_stage: string;
  trigger_type: 'time_based' | 'action_based' | 'score_based' | 'manual';
  conditions: {
    // Time-based
    days_in_stage?: number;
    
    // Action-based
    required_actions?: ('email_replied' | 'meeting_booked' | 'email_opened' | 'link_clicked')[];
    
    // Score-based
    score_min?: number;
    score_max?: number;
    
    // Combined
    all_conditions_must_match?: boolean;
  };
  enabled: boolean;
}

/**
 * Check if a contact should be moved to the next stage
 */
export async function evaluateContactPipelineAutomation(
  userId: string,
  contactId: string
): Promise<{ shouldMove: boolean; toStage?: string; reason?: string }> {
  try {
    // Get contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single();

    if (contactError || !contact) return { shouldMove: false };

    // Get active pipeline rules for this stage
    const { data: rules, error: rulesError } = await supabase
      .from('pipeline_stages')
      .select('automation_rules')
      .eq('user_id', userId)
      .eq('name', contact.stage)
      .single();

    if (rulesError || !rules?.automation_rules) return { shouldMove: false };

    const pipelineRules = rules.automation_rules as any[];
    if (!Array.isArray(pipelineRules) || pipelineRules.length === 0) {
      return { shouldMove: false };
    }

    // Evaluate each rule
    for (const rule of pipelineRules) {
      if (!rule.enabled) continue;

      const conditions = rule.conditions || {};
      let rulePassed = true;
      let reasons: string[] = [];

      // Time-based check
      if (conditions.days_in_stage) {
        const contactUpdated = new Date(contact.updated_at);
        const daysSinceUpdate = Math.floor((Date.now() - contactUpdated.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysSinceUpdate >= conditions.days_in_stage) {
          reasons.push(`${daysSinceUpdate} days in ${contact.stage} stage`);
        } else {
          rulePassed = false;
        }
      }

      // Score-based check
      if (conditions.score_min !== undefined || conditions.score_max !== undefined) {
        const score = contact.score || 0;
        
        if (conditions.score_min && score < conditions.score_min) {
          rulePassed = false;
        }
        if (conditions.score_max && score > conditions.score_max) {
          rulePassed = false;
        }
        
        if (rulePassed) {
          reasons.push(`Lead score: ${score}`);
        }
      }

      // Action-based check
      if (conditions.required_actions && conditions.required_actions.length > 0) {
        const { data: responses } = await supabase
          .from('campaign_responses')
          .select('*')
          .eq('contact_id', contactId)
          .eq('user_id', userId);

        const { data: activities } = await supabase
          .from('agent_activities')
          .select('*')
          .eq('contact_id', contactId)
          .eq('user_id', userId);

        const { data: interactions } = await supabase
          .from('contact_interactions')
          .select('*')
          .eq('contact_id', contactId)
          .eq('user_id', userId);

        const { data: emailEvents } = await supabase
          .from('email_events')
          .select('*')
          .eq('contact_id', contactId)
          .eq('user_id', userId);

        const hasReplied = (responses && responses.length > 0) || false;
        const hasMeeting = activities?.some(a => a.activity_type === 'meeting_scheduled') || false;
        const hasEmailOpened = emailEvents?.some(e => e.event_type === 'opened') || false;
        const hasLinkClicked = emailEvents?.some(e => e.event_type === 'clicked') || false;

        for (const action of conditions.required_actions) {
          if (action === 'email_replied' && !hasReplied) rulePassed = false;
          if (action === 'meeting_booked' && !hasMeeting) rulePassed = false;
          if (action === 'email_opened' && !hasEmailOpened) rulePassed = false;
          if (action === 'link_clicked' && !hasLinkClicked) rulePassed = false;
        }

        if (rulePassed) {
          reasons.push('Required actions completed');
        }
      }

      // If all conditions match (or we require all conditions and they all passed)
      if (rulePassed) {
        return {
          shouldMove: true,
          toStage: rule.to_stage,
          reason: reasons.join(', ')
        };
      }
    }

    return { shouldMove: false };
  } catch (error) {
    console.error('Error evaluating pipeline automation:', error);
    return { shouldMove: false };
  }
}

/**
 * Move contact to next stage
 */
export async function moveContactToStage(
  userId: string,
  contactId: string,
  toStage: string,
  reason?: string,
  automated: boolean = true
): Promise<boolean> {
  try {
    // Get current stage
    const { data: contact } = await supabase
      .from('contacts')
      .select('stage')
      .eq('id', contactId)
      .eq('user_id', userId)
      .single();

    if (!contact) return false;

    const fromStage = contact.stage;

    // Update contact stage
    const { error: updateError } = await supabase
      .from('contacts')
      .update({ 
        stage: toStage,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Log to pipeline history
    const { error: historyError } = await supabase
      .from('contact_pipeline_history')
      .insert({
        user_id: userId,
        contact_id: contactId,
        from_stage: fromStage,
        to_stage: toStage,
        reason: reason || (automated ? 'Automated pipeline rule' : 'Manual move'),
        automated
      });

    if (historyError) console.error('Error logging pipeline history:', historyError);

    return true;
  } catch (error) {
    console.error('Error moving contact to stage:', error);
    return false;
  }
}

/**
 * Run pipeline automation for all contacts
 */
export async function runPipelineAutomation(userId: string): Promise<{
  evaluated: number;
  moved: number;
  details: Array<{ contactId: string; fromStage: string; toStage: string; reason: string }>;
}> {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id, stage, first_name, last_name')
      .eq('user_id', userId);

    if (error) throw error;

    const results = {
      evaluated: contacts?.length || 0,
      moved: 0,
      details: [] as Array<{ contactId: string; fromStage: string; toStage: string; reason: string }>
    };

    for (const contact of contacts || []) {
      const evaluation = await evaluateContactPipelineAutomation(userId, contact.id);
      
      if (evaluation.shouldMove && evaluation.toStage) {
        const success = await moveContactToStage(
          userId,
          contact.id,
          evaluation.toStage,
          evaluation.reason,
          true
        );

        if (success) {
          results.moved++;
          results.details.push({
            contactId: contact.id,
            fromStage: contact.stage,
            toStage: evaluation.toStage,
            reason: evaluation.reason || 'Automated'
          });
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Error running pipeline automation:', error);
    return { evaluated: 0, moved: 0, details: [] };
  }
}

/**
 * Create default pipeline automation rules
 */
export function getDefaultPipelineRules(): Record<string, PipelineRule[]> {
  return {
    'New Lead': [
      {
        name: 'Auto-qualify hot leads',
        from_stage: 'New Lead',
        to_stage: 'Contacted',
        trigger_type: 'score_based',
        conditions: {
          score_min: 70
        },
        enabled: true
      }
    ],
    'Contacted': [
      {
        name: 'Move to Engaged after reply',
        from_stage: 'Contacted',
        to_stage: 'Engaged',
        trigger_type: 'action_based',
        conditions: {
          required_actions: ['email_replied']
        },
        enabled: true
      },
      {
        name: 'Move to Cold after 14 days no response',
        from_stage: 'Contacted',
        to_stage: 'Closed Lost',
        trigger_type: 'time_based',
        conditions: {
          days_in_stage: 14,
          score_max: 30
        },
        enabled: false // Disabled by default
      }
    ],
    'Engaged': [
      {
        name: 'Auto-book meeting qualified leads',
        from_stage: 'Engaged',
        to_stage: 'Meeting Scheduled',
        trigger_type: 'action_based',
        conditions: {
          required_actions: ['meeting_booked']
        },
        enabled: true
      }
    ],
    'Meeting Scheduled': [
      {
        name: 'Move to Qualified after meeting',
        from_stage: 'Meeting Scheduled',
        to_stage: 'Qualified',
        trigger_type: 'time_based',
        conditions: {
          days_in_stage: 1 // Day after meeting
        },
        enabled: false // Requires manual qualification
      }
    ]
  };
}
