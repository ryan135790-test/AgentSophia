import nodemailer from 'nodemailer';

// ============================================
// EMAIL SERVICE (SendGrid via SMTP)
// ============================================

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export async function sendEmail(options: EmailOptions) {
  // Using SendGrid SMTP relay - requires SENDGRID_API_KEY env var
  const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    auth: {
      user: 'apikey',
      pass: process.env.SENDGRID_API_KEY || '',
    },
  });

  try {
    const result = await transporter.sendMail({
      from: options.from || 'noreply@sophiaai.com',
      to: Array.isArray(options.to) ? options.to.join(',') : options.to,
      subject: options.subject,
      html: options.html || '',
      text: options.text || '',
    });

    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: (error as any).message };
  }
}

// ============================================
// SMS SERVICE (Twilio)
// ============================================

interface SMSOptions {
  to: string;
  message: string;
  from?: string;
}

export async function sendSMS(options: SMSOptions) {
  // Using Twilio - requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !twilioPhone) {
    return {
      success: false,
      error: 'Twilio credentials not configured',
    };
  }

  try {
    const client = require('twilio')(accountSid, authToken);
    const result = await client.messages.create({
      body: options.message,
      from: twilioPhone,
      to: options.to,
    });

    return { success: true, messageSid: result.sid };
  } catch (error) {
    console.error('SMS send error:', error);
    return { success: false, error: (error as any).message };
  }
}

// ============================================
// OAUTH HELPERS
// ============================================

export function generateOAuthState() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function getGmailOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID || '',
    redirect_uri: `${process.env.APP_URL || 'http://localhost:3001'}/oauth/gmail/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export function getLinkedInOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.LINKEDIN_CLIENT_ID || '',
    redirect_uri: `${process.env.APP_URL || 'http://localhost:3001'}/oauth/linkedin/callback`,
    response_type: 'code',
    scope: 'r_liteprofile r_emailaddress w_member_social',
    state,
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

export function getCalendarOAuthUrl(state: string, redirectUri?: string) {
  // Use GMAIL_CLIENT_ID since it's the same Google OAuth credentials
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : (process.env.APP_URL || 'http://localhost:5000');
  
  const params = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID || '',
    redirect_uri: redirectUri || `${baseUrl}/api/oauth/google-calendar/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCalendarCode(code: string, redirectUri?: string) {
  const baseUrl = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
    : (process.env.APP_URL || 'http://localhost:5000');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID || '',
      client_secret: process.env.GMAIL_CLIENT_SECRET || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri || `${baseUrl}/api/oauth/google-calendar/callback`,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }
  
  return response.json();
}

export async function refreshCalendarToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID || '',
      client_secret: process.env.GMAIL_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) {
    throw new Error('Token refresh failed');
  }
  
  return response.json();
}

// ============================================
// CALENDAR SERVICE
// ============================================

interface CalendarEvent {
  title: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  attendees: string[];
  calendarId?: string;
}

export async function createCalendarEvent(event: CalendarEvent, accessToken: string) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${event.calendarId || 'primary'}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.title,
          description: event.description || '',
          start: { dateTime: event.startTime },
          end: { dateTime: event.endTime },
          attendees: event.attendees.map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: Math.random().toString(36).substring(7),
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, eventId: data.id, meetLink: data.conferenceData?.entryPoints?.[0]?.uri };
  } catch (error) {
    console.error('Calendar create error:', error);
    return { success: false, error: (error as any).message };
  }
}

export async function getCalendarAvailability(accessToken: string, startTime: string, endTime: string) {
  try {
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/freebusy',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeMin: startTime,
          timeMax: endTime,
          items: [{ id: 'primary' }],
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Calendar API error: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, busy: data.calendars.primary.busy };
  } catch (error) {
    console.error('Calendar availability error:', error);
    return { success: false, error: (error as any).message };
  }
}
