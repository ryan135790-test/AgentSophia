import { supabase } from "@/integrations/supabase/client";

export interface LinkedInMessage {
  recipientLinkedInId: string;
  recipientName: string;
  message: string;
  connectionRequest?: boolean;
}

export interface LinkedInPost {
  content: string;
  visibility: 'PUBLIC' | 'CONNECTIONS';
}

export interface LinkedInOutreachResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Get LinkedIn access token from local storage
 */
function getLinkedInConfig() {
  const config = localStorage.getItem('linkedin_config');
  if (!config) return null;
  
  try {
    return JSON.parse(config);
  } catch (e) {
    console.error('Failed to parse LinkedIn config:', e);
    return null;
  }
}

/**
 * Send a LinkedIn connection request with a personalized message
 */
export async function sendConnectionRequest(
  recipientLinkedInId: string,
  recipientName: string,
  message: string
): Promise<LinkedInOutreachResult> {
  try {
    const linkedInConfig = getLinkedInConfig();
    if (!linkedInConfig?.accessToken) {
      throw new Error('Not connected to LinkedIn. Please connect your account first.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Call LinkedIn send-connection edge function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/linkedin-send-connection`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: linkedInConfig.accessToken,
          recipientId: recipientLinkedInId,
          message: message,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send connection request');
    }

    const result = await response.json();

    // Log the activity
    await supabase.from('agent_activities').insert({
      user_id: user.id,
      activity_type: 'outreach',
      contact_id: null, // Can link to contact if available
      channel: 'linkedin',
      outcome: 'success',
      details: {
        action: 'connection_request',
        recipient: recipientName,
        message: message,
      },
    });

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: any) {
    console.error('Failed to send connection request:', error);
    return {
      success: false,
      error: error.message || 'Failed to send connection request',
    };
  }
}

/**
 * Send a LinkedIn direct message (InMail or message to connection)
 */
export async function sendLinkedInMessage(
  recipientLinkedInId: string,
  recipientName: string,
  message: string
): Promise<LinkedInOutreachResult> {
  try {
    const linkedInConfig = getLinkedInConfig();
    if (!linkedInConfig?.accessToken) {
      throw new Error('Not connected to LinkedIn. Please connect your account first.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Call LinkedIn send-message edge function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/linkedin-send-message`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: linkedInConfig.accessToken,
          recipientId: recipientLinkedInId,
          message: message,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to send message');
    }

    const result = await response.json();

    // Log the activity
    await supabase.from('agent_activities').insert({
      user_id: user.id,
      activity_type: 'message_sent',
      contact_id: null,
      channel: 'linkedin',
      outcome: 'success',
      details: {
        action: 'direct_message',
        recipient: recipientName,
        message: message,
      },
    });

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: any) {
    console.error('Failed to send LinkedIn message:', error);
    return {
      success: false,
      error: error.message || 'Failed to send message',
    };
  }
}

/**
 * Post content to LinkedIn
 */
export async function postToLinkedIn(post: LinkedInPost): Promise<LinkedInOutreachResult> {
  try {
    const linkedInConfig = getLinkedInConfig();
    if (!linkedInConfig?.accessToken) {
      throw new Error('Not connected to LinkedIn. Please connect your account first.');
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Call LinkedIn post edge function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/linkedin-create-post`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: linkedInConfig.accessToken,
          content: post.content,
          visibility: post.visibility,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to post to LinkedIn');
    }

    const result = await response.json();

    // Log the activity
    await supabase.from('agent_activities').insert({
      user_id: user.id,
      activity_type: 'social_post',
      contact_id: null,
      channel: 'linkedin',
      outcome: 'success',
      details: {
        action: 'create_post',
        content: post.content,
        postId: result.id,
      },
    });

    return {
      success: true,
      messageId: result.id,
    };
  } catch (error: any) {
    console.error('Failed to post to LinkedIn:', error);
    return {
      success: false,
      error: error.message || 'Failed to post',
    };
  }
}

/**
 * Check for new LinkedIn messages and respond automatically
 */
export async function checkLinkedInMessages(): Promise<any[]> {
  try {
    const linkedInConfig = getLinkedInConfig();
    if (!linkedInConfig?.accessToken) return [];

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/linkedin-check-messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: linkedInConfig.accessToken,
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to check LinkedIn messages');
      return [];
    }

    const result = await response.json();
    return result.messages || [];
  } catch (error) {
    console.error('Error checking LinkedIn messages:', error);
    return [];
  }
}
