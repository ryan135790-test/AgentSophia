import { Router } from 'express';

const router = Router();

// ============================================
// DEAL PIPELINE MANAGEMENT
// ============================================

/**
 * GET /api/deals/pipeline-overview
 * Get comprehensive pipeline overview
 */
router.get('/pipeline-overview', async (req, res) => {
  res.json({
    total_pipeline_value: '$2450000',
    weighted_pipeline: '$845000',
    deals_by_stage: {
      prospect: { count: 45, value: '$450000' },
      qualified: { count: 28, value: '$580000' },
      proposal: { count: 18, value: '$675000' },
      negotiation: { count: 12, value: '$420000' },
      won: { count: 34, value: '$1125000' },
      lost: { count: 8, value: '$125000' }
    },
    win_rate: '81.0%',
    avg_deal_value: '$33088',
    sales_cycle_days: 18,
    deals_closing_this_month: 12,
    revenue_expected_this_month: '$487500'
  });
});

/**
 * GET /api/deals/all
 * Get all deals with pipeline view
 */
router.get('/all', async (req, res) => {
  res.json({
    deals: [
      {
        deal_id: 'deal_001',
        company: 'Acme Corp',
        contact: 'John Smith',
        title: 'VP Sales',
        deal_value: '$125000',
        stage: 'proposal',
        probability: '72%',
        days_in_stage: 5,
        next_action: 'Send proposal by Friday',
        last_activity: '2 hours ago',
        sophia_health: {
          score: 'Healthy',
          confidence: '91%',
          recommendation: 'On track to close. Send proposal today for momentum.',
          risk_factors: 'None identified'
        }
      },
      {
        deal_id: 'deal_002',
        company: 'TechCorp Inc',
        contact: 'Sarah Johnson',
        title: 'CMO',
        deal_value: '$98000',
        stage: 'negotiation',
        probability: '65%',
        days_in_stage: 12,
        next_action: 'Address pricing objection',
        last_activity: '4 hours ago',
        sophia_health: {
          score: 'At Risk',
          confidence: '78%',
          recommendation: 'Stuck in negotiation 12 days. Offer discount or alternate plan.',
          risk_factors: 'Stalled communication, pricing sensitivity'
        }
      },
      {
        deal_id: 'deal_003',
        company: 'Startup XYZ',
        contact: 'Mike Chen',
        title: 'CEO',
        deal_value: '$45000',
        stage: 'qualified',
        probability: '55%',
        days_in_stage: 3,
        next_action: 'Schedule demo',
        last_activity: '1 day ago',
        sophia_health: {
          score: 'Good',
          confidence: '84%',
          recommendation: 'Warm lead. Schedule demo within 24 hours to maintain momentum.',
          risk_factors: 'No engagement yet'
        }
      },
      {
        deal_id: 'deal_004',
        company: 'Global Solutions',
        contact: 'Emma Wilson',
        title: 'Sales Director',
        deal_value: '$156000',
        stage: 'won',
        probability: '100%',
        days_in_stage: 2,
        next_action: 'Prepare implementation plan',
        last_activity: '6 hours ago',
        sophia_health: {
          score: 'Won',
          confidence: '100%',
          recommendation: 'Deal closed. Next: implement and ensure satisfaction for upsell.',
          risk_factors: 'None'
        }
      }
    ]
  });
});

/**
 * POST /api/deals/create
 * Create new deal
 */
router.post('/create', async (req, res) => {
  const { company, contact, value, stage, probability } = req.body;

  res.json({
    success: true,
    deal_id: `deal_${Date.now()}`,
    company: company,
    contact: contact,
    deal_value: value,
    stage: stage,
    probability: probability,
    created_at: new Date().toISOString(),
    message: `✅ Deal created: ${company} - ${value}`
  });
});

/**
 * PATCH /api/deals/:dealId/move-stage
 * Move deal to different pipeline stage
 */
router.patch('/:dealId/move-stage', async (req, res) => {
  const { dealId } = req.params;
  const { new_stage, reason } = req.body;

  res.json({
    success: true,
    deal_id: dealId,
    previous_stage: 'proposal',
    new_stage: new_stage,
    moved_at: new Date().toISOString(),
    message: `✅ Deal moved to ${new_stage}`,
    sophia_notification: `Deal milestone: Moved to ${new_stage}. Next recommended action: Schedule call.`
  });
});

/**
 * GET /api/deals/deal-analytics
 * Get comprehensive deal analytics
 */
router.get('/deal-analytics', async (req, res) => {
  res.json({
    pipeline_health: {
      total_deals: 145,
      total_value: '$2450000',
      weighted_value: '$845000',
      win_rate: '81.0%',
      avg_sales_cycle: 18,
      avg_deal_size: '$33088'
    },
    
    stage_analysis: [
      { stage: 'Prospect', count: 45, value: '$450000', avg_days: 8, close_rate: '62%' },
      { stage: 'Qualified', count: 28, value: '$580000', avg_days: 5, close_rate: '79%' },
      { stage: 'Proposal', count: 18, value: '$675000', avg_days: 7, close_rate: '89%' },
      { stage: 'Negotiation', count: 12, value: '$420000', avg_days: 12, close_rate: '75%' },
      { stage: 'Won', count: 34, value: '$1125000', avg_days: 0, close_rate: '100%' },
      { stage: 'Lost', count: 8, value: '$125000', avg_days: 0, close_rate: '0%' }
    ],
    
    forecasting: {
      expected_revenue_30_days: '$487500',
      expected_revenue_90_days: '$1875000',
      confidence_30: '87%',
      confidence_90: '78%'
    },
    
    deal_health: {
      healthy: 56,
      at_risk: 18,
      stalled: 8
    },
    
    sophia_insights: {
      top_opportunity: 'Deal #004 - $156K just won. Next: Upsell opportunity (Enterprise plan +$50K)',
      urgent_action: '3 deals stalled in negotiation >10 days. Recommend outreach.',
      trend: '+24% pipeline growth this month',
      next_action: 'Focus on proposal stage (18 deals, 89% close rate) - highest ROI stage'
    }
  });
});

/**
 * GET /api/deals/deal-details/:dealId
 * Get detailed deal information
 */
router.get('/deal-details/:dealId', async (req, res) => {
  res.json({
    deal_id: req.params.dealId,
    company: 'Acme Corp',
    contact: 'John Smith',
    title: 'VP Sales',
    deal_value: '$125000',
    stage: 'proposal',
    probability: '72%',
    created_date: '2025-01-10T00:00:00Z',
    
    deal_history: [
      { date: '2025-01-20T10:00:00Z', event: 'Moved to Proposal', user: 'Sarah Chen' },
      { date: '2025-01-18T14:30:00Z', event: 'Moved to Qualified', user: 'System' },
      { date: '2025-01-15T09:00:00Z', event: 'Deal created', user: 'Sarah Chen' }
    ],
    
    activities: [
      { type: 'email_sent', description: 'Proposal email sent', timestamp: '2 hours ago' },
      { type: 'meeting', description: 'Demo call - very interested', timestamp: '1 day ago' },
      { type: 'response', description: 'Replied to initial outreach', timestamp: '3 days ago' }
    ],
    
    next_actions: [
      { action: 'Send proposal', due: '2025-01-22', priority: 'High' },
      { action: 'Schedule follow-up', due: '2025-01-25', priority: 'Medium' }
    ],
    
    sophia_health: {
      status: 'Healthy',
      score: '91%',
      confidence: '91%',
      recommendation: 'On track. Send proposal today to maintain momentum and close by end of month.',
      risk_factors: 'None identified',
      next_step: 'Send proposal and schedule 3-day follow-up call'
    }
  });
});

export default router;
