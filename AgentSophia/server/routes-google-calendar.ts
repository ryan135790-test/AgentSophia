import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { 
  getCalendarOAuthUrl, 
  exchangeCalendarCode, 
  refreshCalendarToken,
  createCalendarEvent,
  getCalendarAvailability,
  generateOAuthState 
} from './lib/integrations';

const router = Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

// Store OAuth states temporarily (in production, use Redis or database)
const oauthStates = new Map<string, { userId: string; timestamp: number }>();

// ============================================
// GOOGLE CALENDAR OAUTH ROUTES
// ============================================

/**
 * GET /api/oauth/google-calendar/connect
 * Initiate Google Calendar OAuth flow - returns JSON with auth URL
 */
router.get('/connect', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    // Generate state for CSRF protection
    const state = generateOAuthState();
    oauthStates.set(state, { userId: user.id, timestamp: Date.now() });
    
    // Clean up old states (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of oauthStates.entries()) {
      if (value.timestamp < tenMinutesAgo) {
        oauthStates.delete(key);
      }
    }
    
    const authUrl = getCalendarOAuthUrl(state);
    res.json({ authUrl, state });
  } catch (error: any) {
    console.error('Calendar OAuth init error:', error);
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ 
      error: error.message || 'Failed to initiate OAuth' 
    });
  }
});

/**
 * GET /api/oauth/google-calendar/callback
 * Handle OAuth callback from Google - closes popup and notifies parent
 */
router.get('/callback', async (req: Request, res: Response) => {
  const sendResponse = (success: boolean, data: any = {}) => {
    const message = success 
      ? { type: 'calendar_oauth_success', data }
      : { type: 'calendar_oauth_error', error: data.error || 'Connection failed' };
    
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Calendar ${success ? 'Connected' : 'Error'}</title>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8fafc; }
            .container { text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .icon { font-size: 48px; margin-bottom: 1rem; }
            h2 { margin: 0 0 0.5rem; color: ${success ? '#16a34a' : '#dc2626'}; }
            p { color: #64748b; margin: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">${success ? '✅' : '❌'}</div>
            <h2>${success ? 'Calendar Connected!' : 'Connection Failed'}</h2>
            <p>${success ? `Connected as ${data.email}` : data.error || 'Please try again'}</p>
            <p style="margin-top: 1rem; font-size: 0.875rem;">This window will close automatically...</p>
          </div>
          <script>
            try {
              window.opener?.postMessage(${JSON.stringify(message)}, '*');
            } catch (e) {
              console.error('Failed to post message:', e);
            }
            setTimeout(() => window.close(), 1500);
          </script>
        </body>
      </html>
    `);
  };

  try {
    const { code, state, error: oauthError } = req.query;
    
    if (oauthError) {
      console.error('OAuth error from Google:', oauthError);
      return sendResponse(false, { error: 'Access denied by user' });
    }
    
    if (!code || !state) {
      return sendResponse(false, { error: 'Missing required parameters' });
    }
    
    // Verify state
    const stateData = oauthStates.get(state as string);
    if (!stateData) {
      return sendResponse(false, { error: 'Invalid or expired state' });
    }
    
    const userId = stateData.userId;
    oauthStates.delete(state as string);
    
    // Exchange code for tokens
    const tokens = await exchangeCalendarCode(code as string);
    
    // Get user's email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const userInfo = await userInfoResponse.json();
    
    // Store connection in database
    const { error: dbError } = await supabase
      .from('connected_accounts')
      .upsert({
        user_id: userId,
        provider: 'google_calendar',
        account_id: userInfo.email,
        account_name: userInfo.name || userInfo.email,
        account_email: userInfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        is_active: true,
        connected_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider,account_id'
      });
    
    if (dbError) {
      console.error('Error saving calendar connection:', dbError);
      return sendResponse(false, { error: 'Failed to save connection' });
    }
    
    console.log(`✅ Google Calendar connected for user ${userId}: ${userInfo.email}`);
    sendResponse(true, { email: userInfo.email, name: userInfo.name });
  } catch (error: any) {
    console.error('Calendar OAuth callback error:', error);
    sendResponse(false, { error: error.message || 'Connection failed' });
  }
});

/**
 * GET /api/oauth/google-calendar/status
 * Check if user has Google Calendar connected
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    const { data: connection, error } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar')
      .eq('is_active', true)
      .single();
    
    if (error || !connection) {
      return res.json({ connected: false });
    }
    
    res.json({
      connected: true,
      email: connection.account_email,
      connectedAt: connection.connected_at
    });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ 
      error: error.message || 'Failed to check status' 
    });
  }
});

/**
 * DELETE /api/oauth/google-calendar/disconnect
 * Disconnect Google Calendar
 */
router.delete('/disconnect', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    
    const { error } = await supabase
      .from('connected_accounts')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('provider', 'google_calendar');
    
    if (error) {
      throw new Error('Failed to disconnect');
    }
    
    res.json({ success: true, message: 'Google Calendar disconnected' });
  } catch (error: any) {
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ 
      error: error.message || 'Failed to disconnect' 
    });
  }
});

// ============================================
// CALENDAR API ROUTES (Real Operations)
// ============================================

/**
 * Helper: Get valid access token (refresh if needed)
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: connection, error } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google_calendar')
    .eq('is_active', true)
    .single();
  
  if (error || !connection) {
    return null;
  }
  
  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(connection.token_expires_at).getTime();
  const now = Date.now();
  
  if (expiresAt - now < 5 * 60 * 1000) {
    // Token expired or about to expire, refresh it
    try {
      const newTokens = await refreshCalendarToken(connection.refresh_token);
      
      await supabase
        .from('connected_accounts')
        .update({
          access_token: newTokens.access_token,
          token_expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
        })
        .eq('id', connection.id);
      
      return newTokens.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }
  
  return connection.access_token;
}

/**
 * GET /api/calendar/availability
 * Get user's calendar availability for next 7 days
 */
router.get('/availability', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    const accessToken = await getValidAccessToken(user.id);
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Google Calendar not connected',
        needsConnection: true 
      });
    }
    
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await getCalendarAvailability(accessToken, startTime, endTime);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Find available slots (30-minute increments during business hours)
    const busySlots = result.busy || [];
    const availableSlots = findAvailableSlots(busySlots, 30);
    
    res.json({
      success: true,
      busy: busySlots,
      availableSlots: availableSlots.slice(0, 10) // Return first 10 available slots
    });
  } catch (error: any) {
    console.error('Get availability error:', error);
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ 
      error: error.message || 'Failed to get availability' 
    });
  }
});

/**
 * POST /api/calendar/book-meeting
 * Book a meeting on user's calendar
 */
router.post('/book-meeting', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    const { 
      title, 
      description, 
      startTime, 
      endTime, 
      attendeeEmail, 
      attendeeName,
      contactId,
      campaignId 
    } = req.body;
    
    if (!title || !startTime || !endTime || !attendeeEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const accessToken = await getValidAccessToken(user.id);
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Google Calendar not connected',
        needsConnection: true 
      });
    }
    
    // Create the calendar event with Google Meet
    const eventResult = await createCalendarEvent({
      title,
      description: description || `Meeting with ${attendeeName || attendeeEmail}`,
      startTime,
      endTime,
      attendees: [attendeeEmail],
    }, accessToken);
    
    if (!eventResult.success) {
      throw new Error(eventResult.error);
    }
    
    // Log the meeting in database
    const { error: logError } = await supabase
      .from('scheduled_meetings')
      .insert({
        user_id: user.id,
        contact_id: contactId,
        campaign_id: campaignId,
        title,
        description,
        start_time: startTime,
        end_time: endTime,
        attendee_email: attendeeEmail,
        attendee_name: attendeeName,
        google_event_id: eventResult.eventId,
        meet_link: eventResult.meetLink,
        status: 'scheduled',
        created_at: new Date().toISOString(),
      });
    
    if (logError) {
      console.warn('Failed to log meeting to database:', logError);
    }
    
    console.log(`📅 Meeting booked: "${title}" with ${attendeeEmail} at ${startTime}`);
    
    res.json({
      success: true,
      eventId: eventResult.eventId,
      meetLink: eventResult.meetLink,
      message: `Meeting scheduled with ${attendeeName || attendeeEmail}`,
      startTime,
      endTime
    });
  } catch (error: any) {
    console.error('Book meeting error:', error);
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ 
      error: error.message || 'Failed to book meeting' 
    });
  }
});

/**
 * GET /api/calendar/upcoming
 * Get upcoming meetings from Google Calendar
 */
router.get('/upcoming', async (req: Request, res: Response) => {
  try {
    const user = await getAuthenticatedUser(req);
    const accessToken = await getValidAccessToken(user.id);
    
    if (!accessToken) {
      return res.status(400).json({ 
        error: 'Google Calendar not connected',
        needsConnection: true 
      });
    }
    
    const now = new Date().toISOString();
    const oneWeekLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(now)}&timeMax=${encodeURIComponent(oneWeekLater)}` +
      `&singleEvents=true&orderBy=startTime`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch calendar events');
    }
    
    const data = await response.json();
    
    const meetings = (data.items || []).map((event: any) => ({
      id: event.id,
      title: event.summary,
      description: event.description,
      startTime: event.start?.dateTime || event.start?.date,
      endTime: event.end?.dateTime || event.end?.date,
      attendees: event.attendees?.map((a: any) => ({
        email: a.email,
        name: a.displayName,
        responseStatus: a.responseStatus
      })) || [],
      meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri,
      status: event.status
    }));
    
    res.json({ success: true, meetings });
  } catch (error: any) {
    console.error('Get upcoming meetings error:', error);
    res.status(error.message === 'Unauthorized' ? 401 : 500).json({ 
      error: error.message || 'Failed to get meetings' 
    });
  }
});

/**
 * Helper: Find available slots based on busy times
 */
function findAvailableSlots(busySlots: any[], durationMinutes: number = 30): any[] {
  const slots: any[] = [];
  const now = new Date();
  
  for (let day = 1; day <= 7 && slots.length < 20; day++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + day);
    
    // Skip weekends
    if (checkDate.getDay() === 0 || checkDate.getDay() === 6) continue;
    
    // Check business hours (9 AM - 5 PM)
    for (let hour = 9; hour < 17 && slots.length < 20; hour++) {
      const startTime = new Date(checkDate);
      startTime.setHours(hour, 0, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + durationMinutes);
      
      // Check if this slot overlaps with any busy time
      const isBusy = busySlots.some(busy => {
        const busyStart = new Date(busy.start);
        const busyEnd = new Date(busy.end);
        return (startTime < busyEnd && endTime > busyStart);
      });
      
      if (!isBusy) {
        slots.push({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          formatted: startTime.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
          })
        });
      }
    }
  }
  
  return slots;
}

export default router;
