import { Router } from 'express';

const router = Router();

// ============================================
// TEAM COLLABORATION & SHARED CAMPAIGNS
// ============================================

/**
 * GET /api/team/overview
 * Get team overview and member activity
 */
router.get('/overview', async (req, res) => {
  res.json({
    total_members: 8,
    active_members: 7,
    campaigns_in_progress: 12,
    shared_campaigns: 34,
    total_contacts_managed: 3428,
    team_revenue_this_month: '$487500'
  });
});

/**
 * GET /api/team/members
 * Get all team members with roles and permissions
 */
router.get('/members', async (req, res) => {
  res.json({
    members: [
      {
        member_id: 'user_001',
        name: 'Sarah Chen',
        email: 'sarah@company.com',
        role: 'Admin',
        title: 'VP Sales',
        avatar: 'SC',
        status: 'active',
        campaigns_owned: 8,
        campaigns_contributed: 12,
        revenue_generated: '$156000',
        last_active: '5 minutes ago',
        permissions: ['create_campaign', 'manage_team', 'view_analytics', 'manage_approvals']
      },
      {
        member_id: 'user_002',
        name: 'Mike Johnson',
        email: 'mike@company.com',
        role: 'Manager',
        title: 'Sales Manager',
        avatar: 'MJ',
        status: 'active',
        campaigns_owned: 6,
        campaigns_contributed: 15,
        revenue_generated: '$128500',
        last_active: '2 hours ago',
        permissions: ['create_campaign', 'manage_contacts', 'view_analytics']
      },
      {
        member_id: 'user_003',
        name: 'Lisa Park',
        email: 'lisa@company.com',
        role: 'Sales Rep',
        title: 'Account Executive',
        avatar: 'LP',
        status: 'active',
        campaigns_owned: 3,
        campaigns_contributed: 8,
        revenue_generated: '$89200',
        last_active: '30 minutes ago',
        permissions: ['create_campaign', 'manage_contacts']
      },
      {
        member_id: 'user_004',
        name: 'James Wilson',
        email: 'james@company.com',
        role: 'Sales Rep',
        title: 'Account Executive',
        avatar: 'JW',
        status: 'inactive',
        campaigns_owned: 2,
        campaigns_contributed: 5,
        revenue_generated: '$42300',
        last_active: '3 days ago',
        permissions: ['create_campaign']
      }
    ]
  });
});

/**
 * GET /api/team/shared-campaigns
 * Get shared campaigns with collaboration details
 */
router.get('/shared-campaigns', async (req, res) => {
  res.json({
    total_shared: 34,
    campaigns: [
      {
        campaign_id: 'camp_001',
        name: 'Q1 Enterprise Sales Push',
        owner: { name: 'Sarah Chen', id: 'user_001' },
        collaborators: [
          { name: 'Mike Johnson', role: 'co-owner', avatar: 'MJ' },
          { name: 'Lisa Park', role: 'contributor', avatar: 'LP' }
        ],
        status: 'active',
        progress: 65,
        contacts: 1245,
        revenue_generated: '$156000',
        last_updated: '2 hours ago',
        channels: ['Email', 'LinkedIn', 'SMS'],
        tasks_pending: 3,
        next_milestone: 'Launch phase 2'
      },
      {
        campaign_id: 'camp_002',
        name: 'SMB Growth Initiative',
        owner: { name: 'Mike Johnson', id: 'user_002' },
        collaborators: [
          { name: 'Sarah Chen', role: 'reviewer', avatar: 'SC' },
          { name: 'Lisa Park', role: 'contributor', avatar: 'LP' }
        ],
        status: 'active',
        progress: 42,
        contacts: 987,
        revenue_generated: '$128500',
        last_updated: '4 hours ago',
        channels: ['Email', 'SMS'],
        tasks_pending: 5,
        next_milestone: 'Finalize messaging'
      }
    ]
  });
});

/**
 * POST /api/team/assign-campaign
 * Assign campaign to team member
 */
router.post('/assign-campaign', async (req, res) => {
  const { campaign_id, assigned_to, role, message } = req.body;

  res.json({
    success: true,
    campaign_id: campaign_id,
    assigned_to: assigned_to,
    role: role, // 'owner', 'co-owner', 'contributor', 'reviewer'
    notification_sent: true,
    timestamp: new Date().toISOString(),
    message: `✅ Campaign assigned to ${assigned_to} as ${role}`
  });
});

/**
 * POST /api/team/campaign-comment
 * Add comment to shared campaign
 */
router.post('/campaign-comment', async (req, res) => {
  const { campaign_id, author, comment_text } = req.body;

  res.json({
    success: true,
    comment_id: `comment_${Date.now()}`,
    campaign_id: campaign_id,
    author: author,
    text: comment_text,
    timestamp: new Date().toISOString(),
    mentioned_users: [],
    message: '✅ Comment added to campaign'
  });
});

/**
 * GET /api/team/campaign-comments/:campaignId
 * Get all comments on a campaign
 */
router.get('/campaign-comments/:campaignId', async (req, res) => {
  res.json({
    campaign_id: req.params.campaignId,
    total_comments: 12,
    comments: [
      {
        comment_id: 'comment_001',
        author: { name: 'Sarah Chen', avatar: 'SC' },
        text: 'Great results on the enterprise segment! 42% conversion rate is excellent.',
        timestamp: '2 hours ago',
        likes: 3,
        replies: 1
      },
      {
        comment_id: 'comment_002',
        author: { name: 'Mike Johnson', avatar: 'MJ' },
        text: 'Should we A/B test the CTA button text before scaling?',
        timestamp: '1 hour ago',
        likes: 2,
        replies: 2
      },
      {
        comment_id: 'comment_003',
        author: { name: 'Lisa Park', avatar: 'LP' },
        text: '@Sarah Chen - Saw your recommendation about the afternoon send time. Will implement for next batch.',
        timestamp: '30 minutes ago',
        likes: 1,
        replies: 0
      }
    ]
  });
});

/**
 * GET /api/team/activity-feed
 * Get team activity feed
 */
router.get('/activity-feed', async (req, res) => {
  res.json({
    activities: [
      {
        activity_id: 'act_001',
        type: 'campaign_created',
        actor: 'Sarah Chen',
        action: 'Created campaign',
        target: 'Q1 Enterprise Sales Push',
        timestamp: '3 hours ago',
        icon: '📊'
      },
      {
        activity_id: 'act_002',
        type: 'campaign_assigned',
        actor: 'Sarah Chen',
        action: 'Assigned campaign to',
        target: 'Mike Johnson as co-owner',
        timestamp: '2 hours ago',
        icon: '👤'
      },
      {
        activity_id: 'act_003',
        type: 'milestone_reached',
        actor: 'System',
        action: 'Campaign milestone achieved',
        target: 'Q1 Enterprise: 50 leads generated',
        timestamp: '1 hour ago',
        icon: '🎯'
      },
      {
        activity_id: 'act_004',
        type: 'revenue_milestone',
        actor: 'System',
        action: 'Revenue milestone',
        target: '$487.5K generated this month',
        timestamp: '30 minutes ago',
        icon: '💰'
      }
    ]
  });
});

/**
 * POST /api/team/create-task
 * Create task within campaign
 */
router.post('/create-task', async (req, res) => {
  const { campaign_id, title, assigned_to, due_date, description } = req.body;

  res.json({
    success: true,
    task_id: `task_${Date.now()}`,
    campaign_id: campaign_id,
    title: title,
    assigned_to: assigned_to,
    due_date: due_date,
    status: 'pending',
    message: `✅ Task created and assigned to ${assigned_to}`
  });
});

export default router;
