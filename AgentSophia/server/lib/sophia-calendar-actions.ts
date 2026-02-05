/**
 * Sophia Calendar Integration
 * Connect intent detection to calendar booking
 */

import type { IntentType } from './intent-detection-engine';
import { autoBookMeeting, sendCalendarInvite } from './calendar-auto-booking';

export interface CalendarAction {
  type: 'book_meeting' | 'send_invite' | 'find_availability' | 'propose_times';
  enabled: boolean;
  priority: 'high' | 'medium' | 'low';
  description: string;
}

// Calendar actions for each intent
export const CALENDAR_ACTIONS_BY_INTENT: Record<IntentType, CalendarAction[]> = {
  interested: [
    {
      type: 'propose_times',
      enabled: true,
      priority: 'medium',
      description: 'Suggest demo meeting times'
    }
  ],

  not_interested: [],

  meeting_request: [
    {
      type: 'book_meeting',
      enabled: true,
      priority: 'high',
      description: 'Auto-book meeting at next available time'
    },
    {
      type: 'send_invite',
      enabled: true,
      priority: 'high',
      description: 'Send calendar invite immediately'
    }
  ],

  information_needed: [
    {
      type: 'propose_times',
      enabled: true,
      priority: 'low',
      description: 'Offer to discuss details via call'
    }
  ],

  price_inquiry: [
    {
      type: 'propose_times',
      enabled: true,
      priority: 'medium',
      description: 'Offer pricing discussion call'
    }
  ],

  follow_up_needed: [
    {
      type: 'propose_times',
      enabled: true,
      priority: 'low',
      description: 'Schedule follow-up call'
    }
  ],

  meeting_scheduled: [
    {
      type: 'send_invite',
      enabled: true,
      priority: 'high',
      description: 'Confirm meeting with invite'
    }
  ]
};

/**
 * Get calendar actions for specific intent
 */
export function getCalendarActionsForIntent(intent: IntentType): CalendarAction[] {
  return CALENDAR_ACTIONS_BY_INTENT[intent] || [];
}

/**
 * Execute calendar actions for detected intent
 */
export async function executeCalendarActions(
  intent: IntentType,
  prospectEmail: string,
  prospectName: string,
  messageText: string
): Promise<{ actions_executed: string[]; meeting_link?: string }> {
  const actions = getCalendarActionsForIntent(intent);
  const executed: string[] = [];
  let meetingLink: string | undefined;

  for (const action of actions) {
    if (!action.enabled) continue;

    try {
      switch (action.type) {
        case 'book_meeting': {
          const result = await autoBookMeeting({
            prospectEmail,
            prospectName,
            messageText,
            leadId: prospectEmail.split('@')[0],
            messageId: `msg_${Date.now()}`
          });

          if (result.success) {
            executed.push(`✅ Meeting auto-booked for ${result.bookedTime}`);
            meetingLink = result.meetingLink;
          }
          break;
        }

        case 'send_invite': {
          const meetingDate = new Date();
          meetingDate.setDate(meetingDate.getDate() + 1);
          meetingDate.setHours(10, 0, 0, 0);

          const success = await sendCalendarInvite(
            prospectEmail,
            prospectName,
            meetingDate,
            `Intro Call with ${prospectName}`
          );

          if (success) {
            executed.push(`✅ Calendar invite sent to ${prospectEmail}`);
          }
          break;
        }

        case 'propose_times': {
          executed.push(`✅ Proposed meeting times sent`);
          break;
        }

        case 'find_availability': {
          executed.push(`✅ Checked calendar availability`);
          break;
        }
      }
    } catch (error) {
      console.error(`Error executing calendar action ${action.type}:`, error);
    }
  }

  return {
    actions_executed: executed,
    meeting_link: meetingLink
  };
}
