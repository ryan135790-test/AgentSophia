import { getWorkspaceApiKey } from './workspace-api-keys';

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
}

interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'image' | 'document';
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: string[];
  mediaUrl?: string;
  caption?: string;
}

interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp?: string;
}

interface WhatsAppTemplate {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: any[];
}

const workspaceWhatsAppClients = new Map<string, WhatsAppConfig>();

export async function getWhatsAppConfig(workspaceId: string): Promise<WhatsAppConfig | null> {
  if (workspaceWhatsAppClients.has(workspaceId)) {
    return workspaceWhatsAppClients.get(workspaceId)!;
  }

  const accessToken = await getWorkspaceApiKey(workspaceId, 'whatsapp_access_token');
  const phoneNumberId = await getWorkspaceApiKey(workspaceId, 'whatsapp_phone_number_id');
  const businessAccountId = await getWorkspaceApiKey(workspaceId, 'whatsapp_business_account_id');

  if (!accessToken || !phoneNumberId) {
    return null;
  }

  const config: WhatsAppConfig = {
    accessToken,
    phoneNumberId,
    businessAccountId: businessAccountId || ''
  };

  workspaceWhatsAppClients.set(workspaceId, config);
  return config;
}

export async function sendWhatsAppMessage(
  workspaceId: string,
  message: WhatsAppMessage
): Promise<WhatsAppSendResult> {
  const config = await getWhatsAppConfig(workspaceId);
  if (!config) {
    return { success: false, error: 'WhatsApp not configured for this workspace' };
  }

  try {
    const phoneNumber = message.to.replace(/[^0-9]/g, '');
    
    let payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber
    };

    switch (message.type) {
      case 'text':
        payload.type = 'text';
        payload.text = { 
          preview_url: true,
          body: message.text 
        };
        break;

      case 'template':
        payload.type = 'template';
        payload.template = {
          name: message.templateName,
          language: { code: message.templateLanguage || 'en' },
          components: message.templateParams?.length ? [{
            type: 'body',
            parameters: message.templateParams.map(p => ({ type: 'text', text: p }))
          }] : []
        };
        break;

      case 'image':
        payload.type = 'image';
        payload.image = {
          link: message.mediaUrl,
          caption: message.caption || ''
        };
        break;

      case 'document':
        payload.type = 'document';
        payload.document = {
          link: message.mediaUrl,
          caption: message.caption || ''
        };
        break;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || 'Failed to send WhatsApp message'
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function sendBulkWhatsAppMessages(
  workspaceId: string,
  messages: WhatsAppMessage[],
  delayMs: number = 1000
): Promise<{ sent: number; failed: number; results: WhatsAppSendResult[] }> {
  const results: WhatsAppSendResult[] = [];
  let sent = 0;
  let failed = 0;

  for (const message of messages) {
    const result = await sendWhatsAppMessage(workspaceId, message);
    results.push(result);
    
    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return { sent, failed, results };
}

export async function getWhatsAppTemplates(workspaceId: string): Promise<WhatsAppTemplate[]> {
  const config = await getWhatsAppConfig(workspaceId);
  if (!config || !config.businessAccountId) {
    return [];
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.businessAccountId}/message_templates`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`
        }
      }
    );

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('Failed to fetch WhatsApp templates:', error);
    return [];
  }
}

export async function verifyWhatsAppWebhook(
  mode: string,
  token: string,
  challenge: string,
  verifyToken: string
): Promise<{ valid: boolean; challenge?: string }> {
  if (mode === 'subscribe' && token === verifyToken) {
    return { valid: true, challenge };
  }
  return { valid: false };
}

interface WhatsAppWebhookEvent {
  type: 'message_received' | 'message_delivered' | 'message_read' | 'message_failed';
  messageId: string;
  from?: string;
  text?: string;
  timestamp: string;
  status?: string;
}

export function parseWhatsAppWebhook(body: any): WhatsAppWebhookEvent[] {
  const events: WhatsAppWebhookEvent[] = [];

  try {
    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        
        const messages = value.messages || [];
        for (const msg of messages) {
          events.push({
            type: 'message_received',
            messageId: msg.id,
            from: msg.from,
            text: msg.text?.body || msg.button?.text || '',
            timestamp: new Date(parseInt(msg.timestamp) * 1000).toISOString()
          });
        }

        const statuses = value.statuses || [];
        for (const status of statuses) {
          let eventType: WhatsAppWebhookEvent['type'] = 'message_delivered';
          if (status.status === 'read') eventType = 'message_read';
          if (status.status === 'failed') eventType = 'message_failed';
          
          events.push({
            type: eventType,
            messageId: status.id,
            timestamp: new Date(parseInt(status.timestamp) * 1000).toISOString(),
            status: status.status
          });
        }
      }
    }
  } catch (error) {
    console.error('Error parsing WhatsApp webhook:', error);
  }

  return events;
}

interface WhatsAppConversation {
  phoneNumber: string;
  name?: string;
  messages: {
    id: string;
    direction: 'inbound' | 'outbound';
    text: string;
    timestamp: string;
    status?: string;
  }[];
  lastMessageAt: string;
}

const conversationStore = new Map<string, Map<string, WhatsAppConversation>>();

export function getConversations(workspaceId: string): WhatsAppConversation[] {
  const workspaceConvos = conversationStore.get(workspaceId);
  if (!workspaceConvos) return [];
  
  return Array.from(workspaceConvos.values())
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export function addMessageToConversation(
  workspaceId: string,
  phoneNumber: string,
  message: { id: string; direction: 'inbound' | 'outbound'; text: string; timestamp: string }
) {
  if (!conversationStore.has(workspaceId)) {
    conversationStore.set(workspaceId, new Map());
  }
  
  const workspaceConvos = conversationStore.get(workspaceId)!;
  
  if (!workspaceConvos.has(phoneNumber)) {
    workspaceConvos.set(phoneNumber, {
      phoneNumber,
      messages: [],
      lastMessageAt: message.timestamp
    });
  }
  
  const convo = workspaceConvos.get(phoneNumber)!;
  convo.messages.push(message);
  convo.lastMessageAt = message.timestamp;
}

export async function getWhatsAppBusinessProfile(workspaceId: string): Promise<any> {
  const config = await getWhatsAppConfig(workspaceId);
  if (!config) return null;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${config.phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`
        }
      }
    );

    const data = await response.json();
    return data.data?.[0] || null;
  } catch (error) {
    console.error('Failed to fetch WhatsApp business profile:', error);
    return null;
  }
}

export async function validateWhatsAppCredentials(
  accessToken: string,
  phoneNumberId: string
): Promise<{ valid: boolean; error?: string; phoneNumber?: string }> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return { valid: false, error: data.error?.message || 'Invalid credentials' };
    }

    return {
      valid: true,
      phoneNumber: data.display_phone_number
    };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}

interface WhatsAppAnalytics {
  messagesSent: number;
  messagesDelivered: number;
  messagesRead: number;
  messagesFailed: number;
  deliveryRate: number;
  readRate: number;
  responseRate: number;
  avgResponseTime: string;
}

const analyticsStore = new Map<string, WhatsAppAnalytics>();

export function getWhatsAppAnalytics(workspaceId: string): WhatsAppAnalytics {
  return analyticsStore.get(workspaceId) || {
    messagesSent: 0,
    messagesDelivered: 0,
    messagesRead: 0,
    messagesFailed: 0,
    deliveryRate: 0,
    readRate: 0,
    responseRate: 0,
    avgResponseTime: '0m'
  };
}

export function recordWhatsAppEvent(
  workspaceId: string,
  event: 'sent' | 'delivered' | 'read' | 'failed' | 'response'
) {
  if (!analyticsStore.has(workspaceId)) {
    analyticsStore.set(workspaceId, {
      messagesSent: 0,
      messagesDelivered: 0,
      messagesRead: 0,
      messagesFailed: 0,
      deliveryRate: 0,
      readRate: 0,
      responseRate: 0,
      avgResponseTime: '0m'
    });
  }

  const analytics = analyticsStore.get(workspaceId)!;

  switch (event) {
    case 'sent':
      analytics.messagesSent++;
      break;
    case 'delivered':
      analytics.messagesDelivered++;
      break;
    case 'read':
      analytics.messagesRead++;
      break;
    case 'failed':
      analytics.messagesFailed++;
      break;
  }

  if (analytics.messagesSent > 0) {
    analytics.deliveryRate = Math.round((analytics.messagesDelivered / analytics.messagesSent) * 100);
    analytics.readRate = Math.round((analytics.messagesRead / analytics.messagesSent) * 100);
  }
}
