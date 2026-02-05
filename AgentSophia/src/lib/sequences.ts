import { supabase } from "@/integrations/supabase/client";

export interface SequenceStep {
  id: string;
  type: 'email' | 'linkedin' | 'sms' | 'wait' | 'condition';
  delay: number; // hours
  content?: {
    subject?: string;
    body: string;
    personalization?: Record<string, any>;
  };
  condition?: {
    type: 'opened' | 'clicked' | 'replied' | 'not_replied' | 'score_above' | 'score_below';
    value?: any;
    trueBranch?: string; // next step ID
    falseBranch?: string; // next step ID
  };
}

export interface AISequence {
  id?: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  trigger_conditions: {
    source?: string[];
    stage?: string[];
    tags?: string[];
    score_min?: number;
    score_max?: number;
    auto_enroll?: boolean;
  };
  steps: SequenceStep[];
  goal_type?: 'meeting' | 'reply' | 'conversion' | 'engagement';
  goal_value?: number;
}

/**
 * Create a new AI sequence
 */
export async function createSequence(userId: string, sequence: AISequence): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('ai_sequences')
      .insert({
        user_id: userId,
        name: sequence.name,
        description: sequence.description,
        status: sequence.status,
        trigger_conditions: sequence.trigger_conditions,
        steps: sequence.steps,
        goal_type: sequence.goal_type,
        goal_value: sequence.goal_value
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error creating sequence:', error);
    return null;
  }
}

/**
 * Enroll a contact in a sequence
 */
export async function enrollContactInSequence(
  userId: string,
  sequenceId: string,
  contactId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sequence_enrollments')
      .insert({
        user_id: userId,
        sequence_id: sequenceId,
        contact_id: contactId,
        current_step: 0,
        status: 'active',
        enrolled_at: new Date().toISOString()
      });

    if (error) throw error;

    // Update sequence enrollment count
    const { error: updateError } = await supabase.rpc('increment_sequence_enrollment', {
      sequence_id: sequenceId
    });

    return true;
  } catch (error) {
    console.error('Error enrolling contact in sequence:', error);
    return false;
  }
}

/**
 * Generate AI sequence template based on goal
 */
export function generateSequenceTemplate(goal: 'cold_outreach' | 'follow_up' | 'nurture' | 'reengagement'): AISequence {
  const templates: Record<typeof goal, AISequence> = {
    cold_outreach: {
      name: 'Cold Outreach Sequence',
      description: 'Initial outreach campaign for new leads',
      status: 'draft',
      trigger_conditions: {
        stage: ['new', 'lead'],
        score_min: 0,
        auto_enroll: false
      },
      steps: [
        {
          id: 'step-1',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Quick question about [Company]',
            body: 'Hi {{first_name}},\n\nI noticed [specific observation about their company].\n\n[Value proposition]\n\nWould you be open to a quick 15-minute call next week?\n\nBest,\n{{sender_name}}'
          }
        },
        {
          id: 'step-2',
          type: 'wait',
          delay: 72 // 3 days
        },
        {
          id: 'step-3',
          type: 'condition',
          delay: 0,
          condition: {
            type: 'replied',
            trueBranch: 'exit', // Exit sequence if they replied
            falseBranch: 'step-4'
          }
        },
        {
          id: 'step-4',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Re: Quick question about [Company]',
            body: 'Hi {{first_name}},\n\nJust following up on my previous email.\n\n[Case study or social proof]\n\nWould love to share how we helped [similar company].\n\nBest,\n{{sender_name}}'
          }
        },
        {
          id: 'step-5',
          type: 'wait',
          delay: 96 // 4 days
        },
        {
          id: 'step-6',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Last try - [Specific value]',
            body: 'Hi {{first_name}},\n\nI know inboxes get busy. This is my last attempt to reach you.\n\n[One-line value prop]\n\nLet me know if you\'d like to chat.\n\nBest,\n{{sender_name}}'
          }
        }
      ],
      goal_type: 'reply',
      goal_value: 1
    },
    follow_up: {
      name: 'Meeting Follow-Up',
      description: 'Follow up after meetings',
      status: 'draft',
      trigger_conditions: {
        stage: ['meeting_scheduled', 'engaged'],
        auto_enroll: true
      },
      steps: [
        {
          id: 'step-1',
          type: 'wait',
          delay: 24 // 1 day after meeting
        },
        {
          id: 'step-2',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Great connecting yesterday',
            body: 'Hi {{first_name}},\n\nThanks for taking the time to chat yesterday.\n\n[Meeting recap and next steps]\n\nLet me know if you have any questions!\n\nBest,\n{{sender_name}}'
          }
        }
      ],
      goal_type: 'conversion'
    },
    nurture: {
      name: 'Lead Nurture Campaign',
      description: 'Long-term nurture for warm leads',
      status: 'draft',
      trigger_conditions: {
        stage: ['engaged', 'qualified'],
        score_min: 40,
        auto_enroll: false
      },
      steps: [
        {
          id: 'step-1',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Resource: [Topic they showed interest in]',
            body: 'Hi {{first_name}},\n\nThought you might find this helpful: [Resource link]\n\n[Brief description of value]\n\nBest,\n{{sender_name}}'
          }
        },
        {
          id: 'step-2',
          type: 'wait',
          delay: 168 // 1 week
        },
        {
          id: 'step-3',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Case Study: [Relevant result]',
            body: 'Hi {{first_name}},\n\n[Case study about similar customer]\n\nWould love to chat about how we could help you achieve similar results.\n\nBest,\n{{sender_name}}'
          }
        }
      ],
      goal_type: 'engagement'
    },
    reengagement: {
      name: 'Re-engagement Campaign',
      description: 'Re-engage cold leads',
      status: 'draft',
      trigger_conditions: {
        stage: ['contacted'],
        score_max: 30,
        auto_enroll: false
      },
      steps: [
        {
          id: 'step-1',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Still interested in [Topic]?',
            body: 'Hi {{first_name}},\n\nIt\'s been a while since we last connected.\n\n[New development or update]\n\nLet me know if you\'d like to reconnect!\n\nBest,\n{{sender_name}}'
          }
        }
      ],
      goal_type: 'reply'
    }
  };

  return templates[goal];
}
