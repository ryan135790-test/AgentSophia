import { supabase } from "@/integrations/supabase/client";
import { getValidAccessToken } from "@/lib/office365-auth";
import { checkLinkedInMessages } from "@/lib/linkedin-outreach";
import { makeDecision } from "@/lib/agent-sophia-api";

export interface DetectedResponse {
  id: string;
  channel: 'email' | 'linkedin' | 'sms';
  from: {
    email?: string;
    name: string;
    linkedInId?: string;
    phone?: string;
  };
  subject?: string;
  content: string;
  receivedAt: Date;
  conversationId?: string;
  contactId?: string;
}

export interface ResponseDetectionResult {
  newResponses: DetectedResponse[];
  decisionsTriggered: number;
  errors: string[];
}

/**
 * Check for new email responses from Office 365
 */
async function checkEmailResponses(): Promise<DetectedResponse[]> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      console.log('No Office 365 access token available');
      return [];
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Fetch recent emails (last 1 hour)
    const response = await fetch(
      `${supabaseUrl}/functions/v1/office365-read-inbox`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          maxResults: 50,
          unreadOnly: true, // Only get unread emails
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch emails');
      return [];
    }

    const data = await response.json();
    const emails = data.emails || [];

    // Convert to DetectedResponse format
    const responses: DetectedResponse[] = emails.map((email: any) => ({
      id: email.id,
      channel: 'email' as const,
      from: {
        email: email.from.address,
        name: email.from.name,
      },
      subject: email.subject,
      content: email.bodyPreview || email.body?.content || '',
      receivedAt: new Date(email.receivedDateTime),
      conversationId: email.conversationId,
    }));

    return responses;
  } catch (error) {
    console.error('Error checking email responses:', error);
    return [];
  }
}

/**
 * Check for new LinkedIn message responses
 */
async function checkLinkedInResponses(): Promise<DetectedResponse[]> {
  try {
    const messages = await checkLinkedInMessages();
    
    // Convert to DetectedResponse format
    const responses: DetectedResponse[] = messages.map((msg: any) => ({
      id: msg.id,
      channel: 'linkedin' as const,
      from: {
        linkedInId: msg.from.id,
        name: msg.from.name,
      },
      content: msg.text || '',
      receivedAt: new Date(msg.createdAt),
      conversationId: msg.conversationId,
    }));

    return responses;
  } catch (error) {
    console.error('Error checking LinkedIn responses:', error);
    return [];
  }
}

/**
 * Process a detected response through the AI decision engine
 */
async function processResponse(response: DetectedResponse): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Try to find the contact based on email or LinkedIn ID
    let contactId = response.contactId;
    
    if (!contactId) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, email, linkedin_url')
        .eq('user_id', user.id)
        .or(`email.eq.${response.from.email},linkedin_url.ilike.%${response.from.linkedInId}%`)
        .limit(1);

      if (contacts && contacts.length > 0) {
        contactId = contacts[0].id;
      }
    }

    if (!contactId) {
      console.log('No contact found for response, skipping decision engine');
      return false;
    }

    // Build conversation history
    const conversationHistory = [{
      role: 'user',
      content: response.content,
      timestamp: response.receivedAt,
    }];

    // Call the decision engine
    const decision = await makeDecision(
      contactId,
      response.id,
      conversationHistory,
      {
        channel: response.channel,
        subject: response.subject,
      }
    );

    // Log the response analysis
    await supabase.from('agent_activities').insert({
      user_id: user.id,
      activity_type: 'response_analyzed',
      contact_id: contactId,
      channel: response.channel,
      outcome: decision.decision_type,
      details: {
        responseId: response.id,
        decision: decision,
        from: response.from,
      },
    });

    // If decision requires follow-up, queue it
    if (decision.decision_type === 'send_follow_up' && decision.generated_content) {
      await supabase.from('followup_queue').insert({
        user_id: user.id,
        contact_id: contactId,
        channel: response.channel,
        suggested_message: decision.generated_content,
        scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default 24 hours
        status: 'pending',
      });
    }

    // If decision is to schedule meeting, create meeting approval
    if (decision.decision_type === 'schedule_meeting') {
      await supabase.from('meeting_approvals').insert({
        user_id: user.id,
        contact_id: contactId,
        suggested_subject: decision.metadata?.meetingSubject || 'Meeting Request',
        suggested_time: decision.metadata?.suggestedTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        confidence: decision.confidence_score,
        status: 'pending',
      });
    }

    return true;
  } catch (error) {
    console.error('Error processing response:', error);
    return false;
  }
}

/**
 * Main response detection function - checks all channels
 */
export async function detectNewResponses(): Promise<ResponseDetectionResult> {
  const result: ResponseDetectionResult = {
    newResponses: [],
    decisionsTriggered: 0,
    errors: [],
  };

  try {
    // Check all channels in parallel
    const [emailResponses, linkedInResponses] = await Promise.all([
      checkEmailResponses(),
      checkLinkedInResponses(),
    ]);

    // Combine all responses
    const allResponses = [...emailResponses, ...linkedInResponses];
    result.newResponses = allResponses;

    // Process each response through decision engine
    const processingResults = await Promise.all(
      allResponses.map(response => processResponse(response))
    );

    result.decisionsTriggered = processingResults.filter(r => r === true).length;

    console.log(`Detected ${allResponses.length} new responses, triggered ${result.decisionsTriggered} decisions`);
  } catch (error: any) {
    console.error('Error in response detection:', error);
    result.errors.push(error.message || 'Unknown error');
  }

  return result;
}

/**
 * Get pending follow-ups that need to be sent
 */
export async function getPendingFollowUps(): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: followUps } = await supabase
      .from('followup_queue')
      .select('*, contacts(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(20);

    return followUps || [];
  } catch (error) {
    console.error('Error getting pending follow-ups:', error);
    return [];
  }
}
