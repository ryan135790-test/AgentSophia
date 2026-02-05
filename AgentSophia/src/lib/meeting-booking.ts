import { supabase } from "@/integrations/supabase/client";
import { getValidAccessToken } from "@/lib/office365-auth";

export interface MeetingRequest {
  subject: string;
  attendeeEmail: string;
  attendeeName: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  location?: string;
}

export interface MeetingBookingResult {
  success: boolean;
  meetingId?: string;
  meetingLink?: string;
  error?: string;
}

/**
 * Book a meeting in Office 365 calendar
 */
export async function bookMeeting(request: MeetingRequest): Promise<MeetingBookingResult> {
  try {
    // Get valid Office 365 access token
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      throw new Error('Not connected to Office 365. Please reconnect.');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Get authenticated session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    // Call the office365-book-meeting edge function
    const response = await fetch(
      `${supabaseUrl}/functions/v1/office365-book-meeting`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          subject: request.subject,
          body: request.description || `Meeting scheduled by Agent Sophia`,
          startTime: request.startTime.toISOString(),
          endTime: request.endTime.toISOString(),
          location: request.location,
          attendees: [
            {
              email: request.attendeeEmail,
              name: request.attendeeName,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to book meeting');
    }

    const result = await response.json();

    // Log the meeting booking activity
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('agent_activities').insert({
        user_id: user.id,
        activity_type: 'meeting_scheduled',
        contact_id: null, // We can link this to a contact if available
        channel: 'office365',
        outcome: 'success',
        details: {
          subject: request.subject,
          attendee: request.attendeeEmail,
          startTime: request.startTime.toISOString(),
          meetingId: result.event?.id,
        },
      });
    }

    return {
      success: true,
      meetingId: result.event?.id,
      meetingLink: result.event?.onlineMeetingUrl || result.event?.webLink,
    };
  } catch (error: any) {
    console.error('Failed to book meeting:', error);
    return {
      success: false,
      error: error.message || 'Failed to book meeting',
    };
  }
}

/**
 * Check calendar availability for a given time slot
 */
export async function checkAvailability(startTime: Date, endTime: Date): Promise<boolean> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return false;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    // Get authenticated session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/office365-check-availability`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        }),
      }
    );

    if (!response.ok) return false;

    const result = await response.json();
    return result.available === true;
  } catch (error) {
    console.error('Failed to check availability:', error);
    return false;
  }
}

/**
 * Find optimal meeting time slots based on availability
 */
export async function findOptimalMeetingTimes(
  durationMinutes: number = 30,
  daysAhead: number = 7
): Promise<Date[]> {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return [];

    // Business hours: 9 AM - 5 PM
    const businessStart = 9;
    const businessEnd = 17;
    const slots: Date[] = [];

    for (let day = 1; day <= daysAhead; day++) {
      const date = new Date();
      date.setDate(date.getDate() + day);

      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      // Check hourly slots during business hours
      for (let hour = businessStart; hour < businessEnd; hour++) {
        const startTime = new Date(date);
        startTime.setHours(hour, 0, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(startTime.getMinutes() + durationMinutes);

        const available = await checkAvailability(startTime, endTime);
        if (available) {
          slots.push(startTime);
          if (slots.length >= 5) return slots; // Return top 5 slots
        }
      }
    }

    return slots;
  } catch (error) {
    console.error('Failed to find optimal times:', error);
    return [];
  }
}
