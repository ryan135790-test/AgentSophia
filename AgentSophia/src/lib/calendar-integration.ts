import { supabase } from "@/integrations/supabase/client";

export interface CalendarAvailability {
  date: string; // YYYY-MM-DD
  slots: Array<{
    start: string; // HH:MM
    end: string; // HH:MM
    available: boolean;
  }>;
}

export interface CalendarSettings {
  timezone: string;
  working_hours: {
    start: string; // HH:MM
    end: string; // HH:MM
    days: number[]; // 0-6 (Sunday-Saturday)
  };
  meeting_duration: number; // minutes
  buffer_time: number; // minutes between meetings
  calendar_link?: string; // Calendly, Cal.com, etc.
}

/**
 * Generate availability text for email templates
 */
export function generateAvailabilityText(settings: CalendarSettings): string {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const workingDays = settings.working_hours.days.map(d => daysOfWeek[d]).join(', ');

  if (settings.calendar_link) {
    return `📅 Book a ${settings.meeting_duration}-minute meeting: ${settings.calendar_link}

Available ${workingDays}, ${settings.working_hours.start}-${settings.working_hours.end} ${settings.timezone}`;
  }

  return `📅 I'm available for a ${settings.meeting_duration}-minute call:
${workingDays}, ${settings.working_hours.start}-${settings.working_hours.end} ${settings.timezone}

Let me know what works best for you!`;
}

/**
 * Get next available time slots
 */
export async function getNextAvailableSlots(
  userId: string,
  days: number = 7
): Promise<CalendarAvailability[]> {
  try {
    // Get user's calendar settings
    const { data: agentConfig } = await supabase
      .from('agent_configs')
      .select('activity_schedule, meeting_settings')
      .eq('user_id', userId)
      .single();

    if (!agentConfig) return [];

    const schedule = agentConfig.activity_schedule || {};
    const meetingSettings = agentConfig.meeting_settings || {};

    const workingHours = {
      start: schedule.working_hours_start || '09:00',
      end: schedule.working_hours_end || '17:00',
      days: schedule.working_days || [1, 2, 3, 4, 5] // Mon-Fri
    };

    const meetingDuration = meetingSettings.default_meeting_duration || 30;
    const bufferTime = 15; // 15 minutes buffer

    // Generate slots for next N days
    const availability: CalendarAvailability[] = [];
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayOfWeek = date.getDay();
      
      // Skip non-working days
      if (!workingHours.days.includes(dayOfWeek)) {
        continue;
      }

      const slots: CalendarAvailability['slots'] = [];
      const [startHour, startMin] = workingHours.start.split(':').map(Number);
      const [endHour, endMin] = workingHours.end.split(':').map(Number);

      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      // Generate 30-minute slots
      for (let time = startTime; time < endTime; time += (meetingDuration + bufferTime)) {
        const slotStart = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
        const slotEnd = `${String(Math.floor((time + meetingDuration) / 60)).padStart(2, '0')}:${String((time + meetingDuration) % 60).padStart(2, '0')}`;

        slots.push({
          start: slotStart,
          end: slotEnd,
          available: true // In production, check against actual calendar
        });
      }

      if (slots.length > 0) {
        availability.push({
          date: date.toISOString().split('T')[0],
          slots
        });
      }
    }

    return availability;
  } catch (error) {
    console.error('Error getting available slots:', error);
    return [];
  }
}

/**
 * Generate calendar embed code for emails
 */
export function generateCalendarEmbed(calendarLink: string, meetingDuration: number = 30): string {
  // For Calendly, Cal.com, or similar services
  if (calendarLink.includes('calendly.com')) {
    return `
<div style="text-align: center; margin: 20px 0;">
  <a href="${calendarLink}" 
     style="display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
    📅 Schedule ${meetingDuration}-Minute Meeting
  </a>
</div>`;
  }

  if (calendarLink.includes('cal.com')) {
    return `
<div style="text-align: center; margin: 20px 0;">
  <a href="${calendarLink}" 
     style="display: inline-block; padding: 12px 24px; background: #000000; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
    📅 Book a Time
  </a>
</div>`;
  }

  // Generic calendar link
  return `
<div style="text-align: center; margin: 20px 0;">
  <a href="${calendarLink}" 
     style="display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
    📅 View My Calendar
  </a>
</div>`;
}

/**
 * Insert calendar availability into email template
 */
export function injectCalendarIntoEmail(emailBody: string, calendarLink: string, meetingDuration: number = 30): string {
  const calendarEmbed = generateCalendarEmbed(calendarLink, meetingDuration);
  
  // If email has a signature, insert before it
  if (emailBody.includes('Best,') || emailBody.includes('Regards,')) {
    const parts = emailBody.split(/(?=Best,|Regards,)/);
    return parts[0] + '\n\n' + calendarEmbed + '\n\n' + parts[1];
  }

  // Otherwise append at the end
  return emailBody + '\n\n' + calendarEmbed;
}
