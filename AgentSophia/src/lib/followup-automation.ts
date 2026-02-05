import { supabase } from "@/integrations/supabase/client";
import { getValidAccessToken } from "@/lib/office365-auth";
import { sendLinkedInMessage } from "@/lib/linkedin-outreach";
import { generateFollowUp } from "@/lib/agent-sophia-api";

export interface FollowUpTask {
  id: string;
  contactId: string;
  channel: 'email' | 'linkedin' | 'sms';
  suggestedMessage: string;
  scheduledFor: Date;
  contact?: {
    id: string;
    name: string;
    email?: string;
    linkedinUrl?: string;
    phone?: string;
  };
}

export interface FollowUpExecutionResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Send an email follow-up via Office 365
 */
async function sendEmailFollowUp(
  contact: { email: string; name: string },
  subject: string,
  message: string
): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      console.error('No Office 365 access token');
      return false;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/office365-send-email`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          to: contact.email,
          subject,
          body: message,
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Error sending email follow-up:', error);
    return false;
  }
}

/**
 * Execute a single follow-up task
 */
async function executeFollowUpTask(task: FollowUpTask): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    if (!task.contact) {
      console.error('No contact information for follow-up');
      return false;
    }

    let success = false;

    // Execute based on channel
    switch (task.channel) {
      case 'email':
        if (task.contact.email) {
          success = await sendEmailFollowUp(
            { email: task.contact.email, name: task.contact.name },
            'Following up',
            task.suggestedMessage
          );
        }
        break;

      case 'linkedin':
        if (task.contact.linkedinUrl) {
          // Extract LinkedIn ID from URL
          const linkedInId = task.contact.linkedinUrl.split('/').pop() || '';
          const result = await sendLinkedInMessage(
            linkedInId,
            task.contact.name,
            task.suggestedMessage
          );
          success = result.success;
        }
        break;

      case 'sms':
        if (task.contact.phone) {
          // SMS implementation would go here
          console.log('SMS follow-up not yet implemented');
          success = false;
        }
        break;
    }

    // Log the activity
    if (success) {
      await supabase.from('agent_activities').insert({
        user_id: user.id,
        activity_type: 'outreach',
        contact_id: task.contactId,
        channel: task.channel,
        outcome: 'sent',
        details: {
          followUpId: task.id,
          message: task.suggestedMessage,
          automated: true,
        },
      });

      // Update follow-up status
      await supabase
        .from('followup_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', task.id);
    } else {
      // Mark as failed
      await supabase
        .from('followup_queue')
        .update({ status: 'failed' })
        .eq('id', task.id);
    }

    return success;
  } catch (error) {
    console.error('Error executing follow-up task:', error);
    return false;
  }
}

/**
 * Execute all pending follow-ups
 */
export async function executePendingFollowUps(): Promise<FollowUpExecutionResult> {
  const result: FollowUpExecutionResult = {
    success: true,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      result.success = false;
      result.errors.push('Not authenticated');
      return result;
    }

    // Get pending follow-ups that are due
    const { data: followUps, error: fetchError } = await supabase
      .from('followup_queue')
      .select('*, contacts(*)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(20); // Process max 20 at a time

    if (fetchError) {
      result.errors.push(fetchError.message);
      return result;
    }

    if (!followUps || followUps.length === 0) {
      return result;
    }

    console.log(`Executing ${followUps.length} follow-up tasks...`);

    // Execute follow-ups one by one (avoid rate limiting)
    for (const followUp of followUps) {
      const task: FollowUpTask = {
        id: followUp.id,
        contactId: followUp.contact_id,
        channel: followUp.channel,
        suggestedMessage: followUp.suggested_message,
        scheduledFor: new Date(followUp.scheduled_for),
        contact: followUp.contacts,
      };

      const success = await executeFollowUpTask(task);
      
      if (success) {
        result.sentCount++;
      } else {
        result.failedCount++;
      }

      // Add a small delay between sends to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }

    console.log(`Follow-ups executed: ${result.sentCount} sent, ${result.failedCount} failed`);
  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message || 'Unknown error');
  }

  return result;
}

/**
 * Generate and queue AI follow-ups for contacts that haven't responded
 */
export async function generateSmartFollowUps(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    // Find contacts with sent outreach but no responses in last 3 days
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const { data: activities } = await supabase
      .from('agent_activities')
      .select('contact_id, channel, created_at, details')
      .eq('user_id', user.id)
      .eq('activity_type', 'outreach')
      .gte('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!activities || activities.length === 0) return 0;

    // Group by contact
    const contactsNeedingFollowUp = new Map<string, any[]>();
    
    for (const activity of activities) {
      if (!activity.contact_id) continue;
      
      if (!contactsNeedingFollowUp.has(activity.contact_id)) {
        contactsNeedingFollowUp.set(activity.contact_id, []);
      }
      contactsNeedingFollowUp.get(activity.contact_id)!.push(activity);
    }

    let followUpsGenerated = 0;

    // Generate follow-ups for each contact
    for (const [contactId, history] of contactsNeedingFollowUp.entries()) {
      try {
        // Check if there's already a pending follow-up
        const { data: existing } = await supabase
          .from('followup_queue')
          .select('id')
          .eq('contact_id', contactId)
          .eq('status', 'pending')
          .limit(1);

        if (existing && existing.length > 0) {
          continue; // Skip if already has pending follow-up
        }

        // Generate AI follow-up
        const followUpResult = await generateFollowUp(contactId, history);
        
        if (followUpResult && followUpResult.content) {
          // Queue the follow-up
          const channel = history[0]?.channel || 'email';
          
          await supabase.from('followup_queue').insert({
            user_id: user.id,
            contact_id: contactId,
            channel: channel,
            suggested_message: followUpResult.content,
            scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
            status: 'pending',
          });

          followUpsGenerated++;
        }
      } catch (error) {
        console.error(`Error generating follow-up for contact ${contactId}:`, error);
      }

      // Rate limit: small delay between AI calls
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Generated ${followUpsGenerated} smart follow-ups`);
    return followUpsGenerated;
  } catch (error) {
    console.error('Error in generateSmartFollowUps:', error);
    return 0;
  }
}
