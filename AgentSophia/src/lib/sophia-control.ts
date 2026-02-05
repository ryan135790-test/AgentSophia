/**
 * Sophia Control API
 * Client-side interface for controlling and monitoring Sophia
 */

export interface SophiaSettings {
  autonomy_level: number;
  is_autonomous: boolean;
  learning_mode: boolean;
  approval_threshold: number;
}

export interface SophiaMemory {
  total_decisions: number;
  autonomous_actions: number;
  approval_queue_count: number;
  success_rate: number;
  learning_insights: string[];
}

export class SophiaController {
  /**
   * Get Sophia's current state and configuration
   */
  static async getState(workspaceId?: string) {
    const url = workspaceId ? `/api/sophia/state?workspace_id=${workspaceId}` : '/api/sophia/state';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to get Sophia state');
    return res.json();
  }

  /**
   * Update Sophia's autonomy settings
   */
  static async updateSettings(settings: Partial<SophiaSettings>) {
    const res = await fetch('/api/sophia/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error('Failed to update Sophia settings');
    return res.json();
  }

  /**
   * Get Sophia's memory and learning insights
   */
  static async getMemory() {
    const res = await fetch('/api/sophia/memory');
    if (!res.ok) throw new Error('Failed to get Sophia memory');
    return res.json();
  }

  /**
   * Make Sophia perform an autonomous action
   */
  static async executeAction(
    action: string,
    contactId: string,
    campaignId: string,
    confidence: number
  ) {
    const res = await fetch('/api/sophia/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        contact_id: contactId,
        campaign_id: campaignId,
        confidence
      })
    });
    if (!res.ok) throw new Error('Failed to execute action');
    return res.json();
  }

  /**
   * Get pending actions awaiting approval
   */
  static async getPendingApprovals() {
    const res = await fetch('/api/sophia/pending-approvals');
    if (!res.ok) throw new Error('Failed to get pending approvals');
    return res.json();
  }

  /**
   * Approve a pending action
   */
  static async approveAction(actionId: string) {
    const res = await fetch(`/api/sophia/approve/${actionId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to approve action');
    return res.json();
  }

  /**
   * Reject a pending action
   */
  static async rejectAction(actionId: string, reason: string) {
    const res = await fetch(`/api/sophia/reject/${actionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Failed to reject action');
    return res.json();
  }
}
