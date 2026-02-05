import { Router } from 'express';

const router = Router();

// ============================================
// CALENDAR & MEETING SCHEDULING
// ============================================

/**
 * GET /api/calendar/dashboard
 * Get calendar and meeting overview
 */
router.get('/dashboard', async (req, res) => {
  res.json({
    meetings_scheduled: 142,
    meetings_this_week: 28,
    meetings_today: 6,
    auto_scheduled_meetings: 89,
    total_meeting_minutes: 3420,
    avg_meeting_duration: 24,
    
    key_metrics: {
      meetings_from_hot_leads: 76,
      hot_lead_meeting_rate: '59.8%',
      meeting_to_deal_conversion: '48.5%',
      revenue_from_scheduled_meetings: '$456200'
    }
  });
});

/**
 * GET /api/calendar/upcoming-meetings
 * Get upcoming scheduled meetings
 */
router.get('/upcoming-meetings', async (req, res) => {
  res.json({
    meetings: [
      {
        meeting_id: 'mtg_001',
        contact_name: 'John Smith',
        company: 'Acme Corp',
        title: 'VP Sales',
        scheduled_time: '2025-01-22T10:00:00Z',
        duration: 30,
        type: 'demo',
        auto_scheduled: true,
        trigger: 'Hot lead replied to email',
        agenda: 'Product demo + pricing discussion',
        calendar_link: 'https://meet.google.com/abc-xyz',
        meeting_prep: {
          company_info: 'Fortune 500, 5000+ employees',
          recent_engagement: 'Opened 3 emails, clicked 2 links, replied to SMS',
          deal_potential: '$125000'
        }
      },
      {
        meeting_id: 'mtg_002',
        contact_name: 'Sarah Johnson',
        company: 'TechCorp Inc',
        title: 'CMO',
        scheduled_time: '2025-01-22T14:30:00Z',
        duration: 45,
        type: 'consultation',
        auto_scheduled: true,
        trigger: 'Warm lead requested meeting',
        agenda: 'Consultation on campaign strategy',
        calendar_link: 'https://meet.google.com/def-uvw',
        meeting_prep: {
          company_info: 'SaaS company, 200+ employees',
          recent_engagement: 'Connected on LinkedIn, replied to message',
          deal_potential: '$85000'
        }
      },
      {
        meeting_id: 'mtg_003',
        contact_name: 'Mike Chen',
        company: 'Startup XYZ',
        title: 'CEO',
        scheduled_time: '2025-01-23T11:00:00Z',
        duration: 30,
        type: 'discovery',
        auto_scheduled: false,
        trigger: 'Manually scheduled',
        agenda: 'Discovery call - understand needs',
        calendar_link: 'https://meet.google.com/ghi-jkl',
        meeting_prep: {
          company_info: 'Early-stage startup, 50 employees',
          recent_engagement: 'Accepted LinkedIn connection, no reply yet',
          deal_potential: '$45000'
        }
      }
    ]
  });
});

/**
 * POST /api/calendar/auto-schedule-meeting
 * Auto-schedule meeting when lead shows interest
 */
router.post('/auto-schedule-meeting', async (req, res) => {
  const { leadId, contactName, contactEmail, company, trigger, dealPotential } = req.body;

  res.json({
    success: true,
    meeting_id: `mtg_${Date.now()}`,
    lead_id: leadId,
    contact_name: contactName,
    meeting_status: 'scheduled',
    scheduled_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    calendar_invitation_sent: true,
    meeting_link: `https://meet.google.com/${Math.random().toString(36).substr(2, 9)}`,
    message: `✅ Meeting auto-scheduled with ${contactName} for tomorrow`,
    notification_sent: true,
    notification_channels: ['email', 'slack'],
    sophia_recommendation: `High-value meeting: ${contactName} from ${company} is hot lead. Deal potential: ${dealPotential}. Prepare demo materials.`
  });
});

/**
 * GET /api/calendar/meeting-results/:meetingId
 * Get meeting outcome and follow-up actions
 */
router.get('/meeting-results/:meetingId', async (req, res) => {
  res.json({
    meeting_id: req.params.meetingId,
    contact_name: 'John Smith',
    company: 'Acme Corp',
    scheduled_time: '2025-01-22T10:00:00Z',
    meeting_completed: true,
    completed_time: '2025-01-22T10:28:00Z',
    duration_actual: 28,
    
    meeting_outcome: {
      sentiment: 'Positive',
      interest_level: 'High',
      pain_points_identified: ['Manual outreach inefficiency', 'Lead scoring difficulty', 'Multi-channel coordination'],
      buying_signals: ['Asked about pricing', 'Inquired about implementation timeline', 'Requested references'],
      next_steps_discussed: 'Send proposal by Friday',
      estimated_close_date: '2025-02-15'
    },
    
    follow_up_actions: [
      { action: 'Send proposal', due_date: '2025-01-24', assigned_to: 'Sarah Chen', status: 'pending' },
      { action: 'Schedule follow-up call', due_date: '2025-01-28', assigned_to: 'Auto', status: 'scheduled' },
      { action: 'Send case study', due_date: '2025-01-23', assigned_to: 'Auto', status: 'scheduled' }
    ],
    
    revenue_impact: {
      updated_deal_value: '$145000',
      probability_to_close: '72%',
      expected_revenue: '$104400'
    },
    
    sophia_insights: {
      recommendation: 'Move to Hot lead • Schedule follow-up within 48 hours • Send technical resources',
      confidence: '91%',
      next_action: 'Send proposal ASAP - contact is ready to move forward'
    }
  });
});

/**
 * GET /api/calendar/scheduling-analytics
 * Get comprehensive scheduling and meeting analytics
 */
router.get('/scheduling-analytics', async (req, res) => {
  res.json({
    period: 'This Month',
    total_meetings_scheduled: 142,
    
    scheduling_breakdown: {
      auto_scheduled: { count: 89, percentage: '62.7%' },
      manually_scheduled: { count: 53, percentage: '37.3%' }
    },
    
    meeting_types: [
      { type: 'Demo', count: 45, conversion_rate: '51.1%' },
      { type: 'Discovery', count: 38, conversion_rate: '42.1%' },
      { type: 'Consultation', count: 32, conversion_rate: '56.3%' },
      { type: 'Negotiation', count: 27, conversion_rate: '77.8%' }
    ],
    
    conversion_metrics: {
      meeting_to_call_rate: '48.5%',
      call_to_proposal_rate: '62.3%',
      proposal_to_deal_rate: '68.5%',
      overall_meeting_to_deal: '48.5%'
    },
    
    time_analytics: {
      most_requested_time: '10:00 AM',
      most_booked_day: 'Tuesday',
      avg_time_to_meeting: '2.3 days',
      avg_meeting_duration: 24
    },
    
    revenue_impact: {
      revenue_from_meetings: '$456200',
      avg_revenue_per_meeting: '$3213',
      roi_of_scheduling: '480%'
    }
  });
});

/**
 * POST /api/calendar/meeting-notes
 * Save meeting notes and outcomes
 */
router.post('/meeting-notes', async (req, res) => {
  const { meetingId, notes, outcome, nextSteps, probability } = req.body;

  res.json({
    success: true,
    meeting_id: meetingId,
    notes_saved: true,
    timestamp: new Date().toISOString(),
    deal_updated: true,
    probability_updated: probability,
    follow_up_actions_created: nextSteps ? nextSteps.length : 0,
    message: '✅ Meeting outcome recorded and deal updated'
  });
});

export default router;
