export type WebhookEventType = 
  | 'connection.sent'
  | 'connection.accepted'
  | 'connection.declined'
  | 'message.sent'
  | 'message.delivered'
  | 'message.replied'
  | 'inmail.sent'
  | 'inmail.opened'
  | 'inmail.replied'
  | 'profile.viewed'
  | 'post.liked'
  | 'campaign.started'
  | 'campaign.paused'
  | 'campaign.completed'
  | 'lead.imported'
  | 'lead.enriched'
  | 'meeting.booked'
  | 'safety.warning'
  | 'safety.paused'
  | 'account.connected'
  | 'account.disconnected';

export interface WebhookEndpoint {
  id: string;
  workspaceId: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  headers: Record<string, string>;
  retryConfig: {
    maxRetries: number;
    retryDelayMs: number;
    exponentialBackoff: boolean;
  };
  createdAt: Date;
  lastTriggeredAt: Date | null;
  successCount: number;
  failureCount: number;
}

export interface WebhookEvent {
  id: string;
  endpointId: string;
  eventType: WebhookEventType;
  payload: Record<string, any>;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
  responseStatus: number | null;
  responseBody: string | null;
  error: string | null;
  createdAt: Date;
}

export interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  workspaceId: string;
  data: Record<string, any>;
}

class LinkedInWebhookEngine {
  private endpoints: Map<string, WebhookEndpoint> = new Map();
  private eventLog: Map<string, WebhookEvent> = new Map();
  private pendingEvents: WebhookEvent[] = [];

  createEndpoint(
    workspaceId: string,
    name: string,
    url: string,
    events: WebhookEventType[],
    headers?: Record<string, string>
  ): WebhookEndpoint {
    const endpoint: WebhookEndpoint = {
      id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      name,
      url,
      secret: this.generateSecret(),
      events,
      isActive: true,
      headers: headers || {},
      retryConfig: {
        maxRetries: 3,
        retryDelayMs: 5000,
        exponentialBackoff: true,
      },
      createdAt: new Date(),
      lastTriggeredAt: null,
      successCount: 0,
      failureCount: 0,
    };

    this.endpoints.set(endpoint.id, endpoint);
    return endpoint;
  }

  private generateSecret(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = 'whsec_';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  updateEndpoint(endpointId: string, updates: Partial<WebhookEndpoint>): WebhookEndpoint | null {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return null;

    Object.assign(endpoint, updates);
    return endpoint;
  }

  deleteEndpoint(endpointId: string): boolean {
    return this.endpoints.delete(endpointId);
  }

  getEndpoints(workspaceId: string): WebhookEndpoint[] {
    return Array.from(this.endpoints.values())
      .filter(e => e.workspaceId === workspaceId);
  }

  async trigger(
    workspaceId: string,
    eventType: WebhookEventType,
    data: Record<string, any>
  ): Promise<void> {
    const endpoints = Array.from(this.endpoints.values())
      .filter(e => 
        e.workspaceId === workspaceId && 
        e.isActive && 
        e.events.includes(eventType)
      );

    for (const endpoint of endpoints) {
      const event = this.createEvent(endpoint.id, eventType, data);
      this.pendingEvents.push(event);
      
      await this.deliverEvent(event, endpoint);
    }
  }

  private createEvent(
    endpointId: string,
    eventType: WebhookEventType,
    data: Record<string, any>
  ): WebhookEvent {
    const event: WebhookEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      endpointId,
      eventType,
      payload: data,
      status: 'pending',
      attempts: 0,
      lastAttemptAt: null,
      nextRetryAt: null,
      responseStatus: null,
      responseBody: null,
      error: null,
      createdAt: new Date(),
    };

    this.eventLog.set(event.id, event);
    return event;
  }

  private async deliverEvent(event: WebhookEvent, endpoint: WebhookEndpoint): Promise<boolean> {
    event.attempts++;
    event.lastAttemptAt = new Date();
    event.status = 'pending';

    const payload: WebhookPayload = {
      event: event.eventType,
      timestamp: new Date().toISOString(),
      workspaceId: endpoint.workspaceId,
      data: event.payload,
    };

    try {
      const signature = this.generateSignature(JSON.stringify(payload), endpoint.secret);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event.eventType,
          'X-Webhook-ID': event.id,
          ...endpoint.headers,
        },
        body: JSON.stringify(payload),
      });

      event.responseStatus = response.status;
      
      try {
        event.responseBody = await response.text();
      } catch {
        event.responseBody = null;
      }

      if (response.ok) {
        event.status = 'delivered';
        endpoint.successCount++;
        endpoint.lastTriggeredAt = new Date();
        return true;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      event.error = error.message;
      
      if (event.attempts < endpoint.retryConfig.maxRetries) {
        event.status = 'retrying';
        const delay = endpoint.retryConfig.exponentialBackoff
          ? endpoint.retryConfig.retryDelayMs * Math.pow(2, event.attempts - 1)
          : endpoint.retryConfig.retryDelayMs;
        event.nextRetryAt = new Date(Date.now() + delay);
      } else {
        event.status = 'failed';
        endpoint.failureCount++;
      }
      
      return false;
    }
  }

  private generateSignature(payload: string, secret: string): string {
    let hash = 0;
    const str = payload + secret;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sha256=${Math.abs(hash).toString(16).padStart(16, '0')}`;
  }

  async retryFailedEvents(): Promise<number> {
    let retried = 0;
    const now = new Date();

    for (const event of this.pendingEvents) {
      if (event.status === 'retrying' && event.nextRetryAt && event.nextRetryAt <= now) {
        const endpoint = this.endpoints.get(event.endpointId);
        if (endpoint) {
          await this.deliverEvent(event, endpoint);
          retried++;
        }
      }
    }

    return retried;
  }

  getEventLog(endpointId: string, limit: number = 50): WebhookEvent[] {
    return Array.from(this.eventLog.values())
      .filter(e => e.endpointId === endpointId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  testEndpoint(endpointId: string): Promise<boolean> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return Promise.resolve(false);

    const testEvent = this.createEvent(endpointId, 'connection.sent', {
      test: true,
      message: 'This is a test webhook event',
      timestamp: new Date().toISOString(),
    });

    return this.deliverEvent(testEvent, endpoint);
  }

  regenerateSecret(endpointId: string): string | null {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return null;

    endpoint.secret = this.generateSecret();
    return endpoint.secret;
  }

  getStats(workspaceId: string): {
    totalEndpoints: number;
    activeEndpoints: number;
    totalEventsDelivered: number;
    totalEventsFailed: number;
    eventsByType: Record<string, number>;
    recentEvents: WebhookEvent[];
  } {
    const workspaceEndpoints = Array.from(this.endpoints.values())
      .filter(e => e.workspaceId === workspaceId);

    const endpointIds = new Set(workspaceEndpoints.map(e => e.id));
    const events = Array.from(this.eventLog.values())
      .filter(e => endpointIds.has(e.endpointId));

    const eventsByType: Record<string, number> = {};
    for (const event of events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
    }

    return {
      totalEndpoints: workspaceEndpoints.length,
      activeEndpoints: workspaceEndpoints.filter(e => e.isActive).length,
      totalEventsDelivered: events.filter(e => e.status === 'delivered').length,
      totalEventsFailed: events.filter(e => e.status === 'failed').length,
      eventsByType,
      recentEvents: events
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10),
    };
  }

  getSupportedEvents(): { type: WebhookEventType; description: string; category: string }[] {
    return [
      { type: 'connection.sent', description: 'Connection request sent', category: 'Connections' },
      { type: 'connection.accepted', description: 'Connection request accepted', category: 'Connections' },
      { type: 'connection.declined', description: 'Connection request declined', category: 'Connections' },
      { type: 'message.sent', description: 'Message sent to connection', category: 'Messages' },
      { type: 'message.delivered', description: 'Message delivered', category: 'Messages' },
      { type: 'message.replied', description: 'Received reply to message', category: 'Messages' },
      { type: 'inmail.sent', description: 'InMail sent', category: 'InMails' },
      { type: 'inmail.opened', description: 'InMail opened', category: 'InMails' },
      { type: 'inmail.replied', description: 'InMail replied', category: 'InMails' },
      { type: 'profile.viewed', description: 'Profile viewed', category: 'Engagement' },
      { type: 'post.liked', description: 'Post liked', category: 'Engagement' },
      { type: 'campaign.started', description: 'Campaign started', category: 'Campaigns' },
      { type: 'campaign.paused', description: 'Campaign paused', category: 'Campaigns' },
      { type: 'campaign.completed', description: 'Campaign completed', category: 'Campaigns' },
      { type: 'lead.imported', description: 'Lead imported', category: 'Leads' },
      { type: 'lead.enriched', description: 'Lead data enriched', category: 'Leads' },
      { type: 'meeting.booked', description: 'Meeting booked', category: 'Conversions' },
      { type: 'safety.warning', description: 'Safety warning triggered', category: 'Safety' },
      { type: 'safety.paused', description: 'Account paused for safety', category: 'Safety' },
      { type: 'account.connected', description: 'LinkedIn account connected', category: 'Accounts' },
      { type: 'account.disconnected', description: 'LinkedIn account disconnected', category: 'Accounts' },
    ];
  }
}

export const linkedInWebhookEngine = new LinkedInWebhookEngine();
