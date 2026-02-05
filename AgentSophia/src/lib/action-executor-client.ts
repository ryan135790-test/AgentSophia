/**
 * Client-side action executor
 * Calls backend to execute autonomous actions
 */

import { apiRequest } from './queryClient';

type IntentType = 'interested' | 'not_interested' | 'meeting_request' | 'information_needed' | 'price_inquiry' | 'follow_up_needed' | 'meeting_scheduled';

export async function executeAction(
  actionType: string,
  leadId: string,
  messageId: string,
  intent: IntentType,
  config?: Record<string, any>
) {
  return apiRequest('/api/actions/execute', {
    method: 'POST',
    body: { actionType, leadId, messageId, intent, config }
  });
}

export async function executeIntentActions(
  leadId: string,
  messageId: string,
  intent: IntentType,
  actions?: string[]
) {
  return apiRequest('/api/actions/execute-intent', {
    method: 'POST',
    body: { leadId, messageId, intent, actions }
  });
}

export async function executeActionBatch(actions: any[]) {
  return apiRequest('/api/actions/batch', {
    method: 'POST',
    body: { actions }
  });
}
