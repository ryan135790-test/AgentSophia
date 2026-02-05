import { z } from "zod";

// ============================================
// SYSTEM INTEGRATIONS (Admin-configured)
// ============================================

export const systemIntegrationSchema = z.object({
  platform: z.enum([
    'smartreach', 'heyreach', 'reply_io', 'sendgrid', 'resend',
    'hubspot', 'pipedrive', 'salesforce',
    'twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'
  ]),
  is_enabled: z.boolean().default(true),
  api_key_configured: z.boolean().default(false),
  description: z.string().optional().nullable(),
});

export type SystemIntegration = z.infer<typeof systemIntegrationSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// CONTACTS
// ============================================

export const insertContactSchema = z.object({
  first_name: z.string().min(1, "First name is required").nullable(),
  last_name: z.string().min(1, "Last name is required").nullable(),
  email: z.string().email("Invalid email").optional().nullable(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  position: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  linkedin_url: z.string().url("Invalid LinkedIn URL").optional().nullable(),
  twitter_handle: z.string().optional().nullable(),
  stage: z.string().default('new'),
  status: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  score: z.number().optional().nullable(),
  tags: z.array(z.string()).default([]).nullable(),
  notes: z.string().optional().nullable(),
  last_contacted: z.string().optional().nullable(),
  next_follow_up: z.string().optional().nullable(),
  is_favorite: z.boolean().default(false).optional(),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertContact = z.infer<typeof insertContactSchema>;

export type Contact = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
  stage: string;
  status: string | null;
  source: string | null;
  score: number | null;
  tags: string[] | null;
  notes: string | null;
  last_contacted: string | null;
  next_follow_up: string | null;
  is_favorite: boolean;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// CONTACT CRM - TASKS
// ============================================

export const insertContactTaskSchema = z.object({
  contact_id: z.string().uuid(),
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']).default('pending'),
  task_type: z.enum(['call', 'email', 'meeting', 'follow_up', 'other']).default('other'),
  assigned_to: z.string().optional().nullable(),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertContactTask = z.infer<typeof insertContactTaskSchema>;

export type ContactTask = {
  id: string;
  user_id: string;
  contact_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  task_type: 'call' | 'email' | 'meeting' | 'follow_up' | 'other';
  assigned_to: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

// ============================================
// CONTACT CRM - NOTES
// ============================================

export const insertContactNoteSchema = z.object({
  contact_id: z.string().uuid(),
  content: z.string().min(1, "Note content is required"),
  note_type: z.enum(['general', 'call', 'meeting', 'email', 'important']).default('general'),
  is_pinned: z.boolean().default(false),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertContactNote = z.infer<typeof insertContactNoteSchema>;

export type ContactNote = {
  id: string;
  user_id: string;
  contact_id: string;
  content: string;
  note_type: 'general' | 'call' | 'meeting' | 'email' | 'important';
  is_pinned: boolean;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// CONTACT CRM - ACTIVITIES
// ============================================

export const insertContactActivitySchema = z.object({
  contact_id: z.string().uuid(),
  activity_type: z.enum(['email_sent', 'email_opened', 'email_replied', 'call', 'meeting', 'linkedin_message', 'linkedin_connection', 'note_added', 'task_completed', 'deal_created', 'deal_updated', 'stage_changed', 'other']),
  title: z.string().min(1, "Activity title is required"),
  description: z.string().optional().nullable(),
  metadata: z.record(z.any()).default({}),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertContactActivity = z.infer<typeof insertContactActivitySchema>;

export type ContactActivity = {
  id: string;
  user_id: string;
  contact_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, any>;
  workspace_id: string | null;
  created_at: string;
};

// ============================================
// CONTACT CRM - MEETINGS
// ============================================

export const insertContactMeetingSchema = z.object({
  contact_id: z.string().uuid(),
  title: z.string().min(1, "Meeting title is required"),
  description: z.string().optional().nullable(),
  start_time: z.string(),
  end_time: z.string(),
  location: z.string().optional().nullable(),
  meeting_type: z.enum(['call', 'video', 'in_person', 'other']).default('video'),
  status: z.enum(['scheduled', 'completed', 'cancelled', 'no_show']).default('scheduled'),
  meeting_link: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertContactMeeting = z.infer<typeof insertContactMeetingSchema>;

export type ContactMeeting = {
  id: string;
  user_id: string;
  contact_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  meeting_type: 'call' | 'video' | 'in_person' | 'other';
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  meeting_link: string | null;
  notes: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// CAMPAIGNS
// ============================================

export const insertCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional().nullable(),
  type: z.enum(['email', 'linkedin', 'multi-channel']).default('email'),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft'),
  target_audience: z.record(z.any()).optional().nullable(),
  settings: z.record(z.any()).default({}),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type Campaign = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  target_audience: Record<string, any> | null;
  settings: Record<string, any>;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
};

// ============================================
// AI CONFIGURATIONS
// ============================================

export const insertAiConfigurationSchema = z.object({
  name: z.string().min(1, "Configuration name is required"),
  description: z.string().optional().nullable(),
  channels: z.array(z.string()).default([]),
  config_data: z.record(z.any()).default({}),
  is_active: z.boolean().default(true),
});

export type InsertAiConfiguration = z.infer<typeof insertAiConfigurationSchema>;

export type AiConfiguration = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  channels: string[];
  config_data: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================
// PROFILES
// ============================================

export const updateProfileSchema = z.object({
  full_name: z.string().min(1, "Name is required").optional(),
  avatar_url: z.string().url("Invalid URL").optional().nullable(),
  company: z.string().optional().nullable(),
});

export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export type Profile = {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  company: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// WORKSPACES
// ============================================

export const insertWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required"),
  description: z.string().optional().nullable(),
  settings: z.record(z.any()).default({}),
  subscription_status: z.enum(['trial', 'active', 'expired', 'cancelled']).default('trial'),
  subscription_tier: z.enum(['growth', 'professional', 'enterprise']).default('growth'),
  seats_limit: z.number().min(1).default(5),
});

export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;

export type Workspace = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  owner_email?: string;
  settings: Record<string, any>;
  subscription_status: 'trial' | 'active' | 'expired' | 'cancelled';
  subscription_tier: 'growth' | 'professional' | 'enterprise';
  seats_limit: number;
  created_at: string;
  updated_at: string;
};

// ============================================
// WORKSPACE MEMBERS
// ============================================

export const insertWorkspaceMemberSchema = z.object({
  workspace_id: z.string().uuid("Invalid workspace ID"),
  user_email: z.string().email("Invalid email"),
  role: z.enum(['owner', 'admin', 'member', 'viewer']).default('member'),
});

export type InsertWorkspaceMember = z.infer<typeof insertWorkspaceMemberSchema>;

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string | null;
  user_email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'declined';
  created_at: string;
  updated_at: string;
};

// ============================================
// WORKSPACE API CREDENTIALS (Per-workspace AI/Email billing)
// ============================================

export const workspaceApiCredentialsSchema = z.object({
  workspace_id: z.string().uuid("Invalid workspace ID"),
  provider: z.enum([
    'openai', 'anthropic',
    'resend', 'sendgrid', 'ses', 'postmark'
  ]),
  encrypted_key: z.string().min(1, "Encrypted key required"),
  key_masked: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  last_tested: z.string().optional().nullable(),
  test_status: z.enum(['valid', 'invalid', 'untested']).default('untested'),
});

export type InsertWorkspaceApiCredential = z.infer<typeof workspaceApiCredentialsSchema>;

export type WorkspaceApiCredential = {
  id: string;
  workspace_id: string;
  provider: 'openai' | 'anthropic' | 'resend' | 'sendgrid' | 'ses' | 'postmark';
  encrypted_key: string;
  key_masked: string | null;
  is_active: boolean;
  last_tested: string | null;
  test_status: 'valid' | 'invalid' | 'untested';
  created_at: string;
  updated_at: string;
};

// ============================================
// WORKSPACE USAGE TRACKING (Per-workspace billing metrics)
// ============================================

export const workspaceUsageSchema = z.object({
  workspace_id: z.string().uuid("Invalid workspace ID"),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM format"),
  ai_requests: z.number().int().min(0).default(0),
  ai_tokens_used: z.number().int().min(0).default(0),
  ai_cost_estimate: z.number().min(0).default(0),
  emails_sent: z.number().int().min(0).default(0),
  emails_delivered: z.number().int().min(0).default(0),
  emails_bounced: z.number().int().min(0).default(0),
  email_cost_estimate: z.number().min(0).default(0),
  total_cost_estimate: z.number().min(0).default(0),
});

export type InsertWorkspaceUsage = z.infer<typeof workspaceUsageSchema>;

export type WorkspaceUsage = {
  id: string;
  workspace_id: string;
  period: string;
  ai_requests: number;
  ai_tokens_used: number;
  ai_cost_estimate: number;
  emails_sent: number;
  emails_delivered: number;
  emails_bounced: number;
  email_cost_estimate: number;
  total_cost_estimate: number;
  created_at: string;
  updated_at: string;
};

// ============================================
// WORKSPACE BILLING
// ============================================

export const workspaceBillingSchema = z.object({
  workspace_id: z.string().uuid("Invalid workspace ID"),
  plan_type: z.enum(['trial', 'growth', 'professional', 'enterprise']).default('trial'),
  seat_limit: z.number().min(1).default(5),
  seats_used: z.number().min(0).default(1),
  price_per_seat: z.number().min(0).default(199),
  billing_email: z.string().email().optional().nullable(),
  stripe_customer_id: z.string().optional().nullable(),
  stripe_subscription_id: z.string().optional().nullable(),
});

export type WorkspaceBilling = z.infer<typeof workspaceBillingSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};

export const insertBillingEventSchema = z.object({
  workspace_id: z.string().uuid("Invalid workspace ID"),
  event_type: z.enum(['seat_added', 'seat_removed', 'plan_upgraded', 'plan_downgraded', 'payment_processed', 'payment_failed']),
  description: z.string().min(1, "Description is required"),
  amount: z.number().optional().nullable(),
  user_email: z.string().email().optional().nullable(),
  metadata: z.record(z.any()).default({}),
});

export type InsertBillingEvent = z.infer<typeof insertBillingEventSchema>;

export type BillingEvent = {
  id: string;
  workspace_id: string;
  event_type: string;
  description: string;
  amount: number | null;
  user_email: string | null;
  metadata: Record<string, any>;
  processed: boolean;
  created_at: string;
};

// ============================================
// CONTACT INTERACTIONS
// ============================================

export const insertContactInteractionSchema = z.object({
  contact_id: z.string().uuid("Invalid contact ID"),
  interaction_type: z.enum(['email', 'call', 'meeting', 'linkedin', 'note']),
  subject: z.string().optional().nullable(),
  content: z.string().min(1, "Content is required"),
  metadata: z.record(z.any()).default({}),
});

export type InsertContactInteraction = z.infer<typeof insertContactInteractionSchema>;

export type ContactInteraction = {
  id: string;
  contact_id: string;
  user_id: string;
  interaction_type: string;
  subject: string | null;
  content: string;
  metadata: Record<string, any>;
  created_at: string;
};

// ============================================
// AUTO-REPLY RULES
// ============================================

export const insertAutoReplyRuleSchema = z.object({
  workspace_id: z.string().uuid("Invalid workspace ID"),
  name: z.string().min(1, "Rule name is required"),
  intent_keywords: z.array(z.string()).min(1, "At least one keyword required"),
  response_template: z.string().min(1, "Response template is required"),
  enabled: z.boolean().default(true),
  requires_approval: z.boolean().default(false),
  channels: z.array(z.enum(['email', 'linkedin', 'sms', 'twitter'])).default(['email']),
  max_uses_per_contact: z.number().int().positive().default(1),
});

export type InsertAutoReplyRule = z.infer<typeof insertAutoReplyRuleSchema>;

export type AutoReplyRule = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  intent_keywords: string[];
  response_template: string;
  enabled: boolean;
  requires_approval: boolean;
  channels: string[];
  max_uses_per_contact: number;
  created_at: string;
  updated_at: string;
};

export type AutoReplyExecution = {
  id: string;
  rule_id: string;
  message_id: string;
  contact_id: string;
  generated_response: string;
  status: 'pending_approval' | 'approved' | 'sent' | 'failed';
  sent_at: string | null;
  created_at: string;
};

// ============================================
// LEAD SCORING
// ============================================

export const leadScoringSchema = z.object({
  contact_id: z.string().uuid(),
  score: z.number().min(0).max(100),
  category: z.enum(['hot', 'warm', 'cold']),
  factors: z.record(z.number()).optional(),
  engagement_score: z.number().min(0).max(100),
  company_score: z.number().min(0).max(100),
  message_score: z.number().min(0).max(100),
});

export type LeadScore = z.infer<typeof leadScoringSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
};

export const insertLeadScoreSchema = leadScoringSchema.omit({ id: true });
export type InsertLeadScore = z.infer<typeof insertLeadScoreSchema>;

// ============================================
// WORKFLOW TRIGGERS & AUTOMATION
// ============================================

export const insertWorkflowTriggerSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1, "Trigger name is required"),
  description: z.string().optional(),
  trigger_condition: z.enum(['no_reply_days', 'email_opened', 'lead_score_hot', 'status_changed', 'tag_added']),
  condition_value: z.string().optional().nullable(), // e.g., "3" for 3 days, "hot" for lead score
  action_type: z.enum(['send_email', 'send_sms', 'move_to_stage', 'add_tag', 'send_followup']),
  action_details: z.record(z.any()), // e.g., { message: "Follow up message", stage: "qualified" }
  enabled: z.boolean().default(true),
  apply_to_all: z.boolean().default(false), // If false, only applies to specific contacts
  contact_ids: z.array(z.string().uuid()).optional().nullable(),
  last_executed: z.string().optional().nullable(),
});

export type InsertWorkflowTrigger = z.infer<typeof insertWorkflowTriggerSchema>;

export type WorkflowTrigger = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  description: string | null;
  trigger_condition: string;
  condition_value: string | null;
  action_type: string;
  action_details: Record<string, any>;
  enabled: boolean;
  apply_to_all: boolean;
  contact_ids: string[] | null;
  last_executed: string | null;
  created_at: string;
  updated_at: string;
};

export type TriggerExecution = {
  id: string;
  trigger_id: string;
  contact_id: string;
  executed_at: string;
  status: 'success' | 'failed' | 'pending';
  result_message: string | null;
};

// ============================================
// NEXT-BEST-ACTION SUGGESTIONS
// ============================================

export const nextBestActionSchema = z.object({
  contact_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  suggestion: z.string().min(1, "Suggestion is required"),
  action_type: z.enum(['send_email', 'send_linkedin', 'schedule_call', 'send_sms', 'add_to_campaign', 'move_stage']),
  confidence_score: z.number().min(0).max(1),
  reasoning: z.string(),
  ai_model: z.string().default('gpt-4o'),
});

export type NextBestAction = {
  id: string;
  contact_id: string;
  workspace_id: string;
  user_id: string;
  suggestion: string;
  action_type: 'send_email' | 'send_linkedin' | 'schedule_call' | 'send_sms' | 'add_to_campaign' | 'move_stage';
  confidence_score: number;
  reasoning: string;
  ai_model: string;
  accepted: boolean;
  executed_at: string | null;
  created_at: string;
};

// ============================================
// RESPONSE ANALYTICS & SELF-LEARNING
// ============================================

export const responseAnalyticsSchema = z.object({
  response_id: z.string().uuid(),
  template_id: z.string().optional().nullable(),
  channel: z.enum(['email', 'linkedin', 'sms', 'phone', 'social']),
  message_sent_at: z.string(),
  response_received: z.boolean(),
  response_received_at: z.string().optional().nullable(),
  response_time_minutes: z.number().optional().nullable(),
  conversion_status: z.enum(['converted', 'not_converted', 'pending']).default('pending'),
  engagement_score: z.number().min(0).max(100),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
});

export type ResponseAnalytics = z.infer<typeof responseAnalyticsSchema> & {
  id: string;
  workspace_id: string;
  contact_id: string;
  created_at: string;
};

export type TemplatePerformance = {
  template_id: string;
  channel: string;
  total_sent: number;
  total_responses: number;
  response_rate: number;
  conversion_rate: number;
  avg_response_time: number;
  top_sentiment: string;
  last_updated: string;
};

// ============================================
// SOCIAL CONNECTIONS
// ============================================

export const insertSocialConnectionSchema = z.object({
  platform: z.enum(['linkedin', 'facebook', 'twitter', 'instagram', 'tiktok']),
  workspace_id: z.string().uuid("Workspace ID is required"),
  account_name: z.string().min(1, "Account name is required"),
  account_id: z.string().min(1, "Account ID is required"),
  access_token: z.string().min(1, "Access token is required"),
  refresh_token: z.string().optional().nullable(),
  token_expires_at: z.string().optional().nullable(),
  profile_data: z.record(z.any()).default({}),
  is_active: z.boolean().default(true),
});

export type InsertSocialConnection = z.infer<typeof insertSocialConnectionSchema>;

export type SocialConnection = {
  id: string;
  user_id: string;
  workspace_id: string;
  platform: 'linkedin' | 'facebook' | 'twitter' | 'instagram' | 'tiktok';
  account_name: string;
  account_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  profile_data: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================
// SOCIAL PLATFORM CREDENTIALS (API Setup)
// ============================================

export const socialPlatformCredentialsSchema = z.object({
  platform: z.enum(['linkedin', 'facebook', 'twitter', 'instagram', 'tiktok']),
  client_id: z.string().min(1, "Client ID is required"),
  client_secret: z.string().min(1, "Client Secret is required"),
  redirect_uri: z.string().url().optional().nullable(),
  additional_config: z.record(z.any()).default({}),
  is_configured: z.boolean().default(false),
});

export type InsertSocialPlatformCredentials = z.infer<typeof socialPlatformCredentialsSchema>;

export type SocialPlatformCredentials = {
  id: string;
  platform: 'linkedin' | 'facebook' | 'twitter' | 'instagram' | 'tiktok';
  client_id: string;
  client_secret: string;
  redirect_uri: string | null;
  additional_config: Record<string, any>;
  is_configured: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================
// CAMPAIGN RESPONSES (UNIFIED INBOX)
// ============================================

export const insertCampaignResponseSchema = z.object({
  campaign_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  channel: z.enum(['linkedin', 'email', 'sms', 'phone', 'social', 'voicemail']),
  sender_name: z.string().min(1, "Sender name is required"),
  sender_identifier: z.string().min(1, "Sender identifier is required"),
  message_content: z.string().min(1, "Message content is required"),
  intent_tag: z.enum([
    'interested',
    'not_interested', 
    'question',
    'objection',
    'meeting_request',
    'out_of_office',
    'other'
  ]).default('other'),
  confidence_score: z.number().min(0).max(1).default(0),
  is_read: z.boolean().default(false),
  responded_at: z.string().optional().nullable(),
});

export type InsertCampaignResponse = z.infer<typeof insertCampaignResponseSchema>;

export type CampaignResponse = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  contact_id: string | null;
  channel: 'linkedin' | 'email' | 'sms' | 'phone' | 'social' | 'voicemail';
  sender_name: string;
  sender_identifier: string;
  message_content: string;
  intent_tag: 'interested' | 'not_interested' | 'question' | 'objection' | 'meeting_request' | 'out_of_office' | 'other';
  confidence_score: number;
  is_read: boolean;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// AI CLASSIFICATION CORRECTIONS (for learning)
// ============================================

export const insertClassificationCorrectionSchema = z.object({
  response_id: z.string().uuid(),
  original_intent: z.enum([
    'interested',
    'not_interested', 
    'question',
    'objection',
    'meeting_request',
    'out_of_office',
    'other'
  ]),
  corrected_intent: z.enum([
    'interested',
    'not_interested', 
    'question',
    'objection',
    'meeting_request',
    'out_of_office',
    'other'
  ]),
  message_content: z.string(),
  channel: z.enum(['linkedin', 'email', 'sms', 'phone', 'social']),
  correction_reason: z.string().optional().nullable(),
});

export type InsertClassificationCorrection = z.infer<typeof insertClassificationCorrectionSchema>;

export type ClassificationCorrection = {
  id: string;
  user_id: string;
  response_id: string;
  original_intent: 'interested' | 'not_interested' | 'question' | 'objection' | 'meeting_request' | 'out_of_office' | 'other';
  corrected_intent: 'interested' | 'not_interested' | 'question' | 'objection' | 'meeting_request' | 'out_of_office' | 'other';
  message_content: string;
  channel: 'linkedin' | 'email' | 'sms' | 'phone' | 'social';
  correction_reason: string | null;
  created_at: string;
};

// ============================================
// AGENT SOPHIA - AI SDR CONFIGURATION
// ============================================

export const insertAgentConfigSchema = z.object({
  agent_name: z.string().default('Sophia'),
  is_active: z.boolean().default(false),
  autonomy_level: z.enum(['manual_approval', 'semi_autonomous', 'fully_autonomous']).default('semi_autonomous'),
  decision_criteria: z.object({
    min_lead_score: z.number().min(0).max(100).default(50),
    auto_respond_intents: z.array(z.string()).default(['question', 'interested']),
    auto_book_meeting_intents: z.array(z.string()).default(['meeting_request']),
    escalate_to_human_intents: z.array(z.string()).default(['objection', 'complex_question']),
    max_follow_ups: z.number().min(1).max(10).default(5),
  }).default({
    min_lead_score: 50,
    auto_respond_intents: ['question', 'interested'],
    auto_book_meeting_intents: ['meeting_request'],
    escalate_to_human_intents: ['objection', 'complex_question'],
    max_follow_ups: 5,
  }),
  activity_schedule: z.object({
    timezone: z.string().default('UTC'),
    working_hours_start: z.string().default('09:00'),
    working_hours_end: z.string().default('17:00'),
    working_days: z.array(z.number()).default([1, 2, 3, 4, 5]),
    daily_activity_limit: z.number().min(1).max(1000).default(100),
  }).default({
    timezone: 'UTC',
    working_hours_start: '09:00',
    working_hours_end: '17:00',
    working_days: [1, 2, 3, 4, 5],
    daily_activity_limit: 100,
  }),
  meeting_settings: z.object({
    calendly_link: z.string().url().optional().nullable(),
    cal_com_link: z.string().url().optional().nullable(),
    booking_instructions: z.string().optional().nullable(),
    default_meeting_duration: z.number().min(15).max(120).default(30),
  }).default({
    default_meeting_duration: 30,
  }),
  personalization_settings: z.object({
    tone: z.enum(['professional', 'friendly', 'casual', 'authoritative']).default('professional'),
    use_brand_voice: z.boolean().default(true),
    include_sender_name: z.boolean().default(true),
    signature: z.string().optional().nullable(),
  }).default({
    tone: 'professional',
    use_brand_voice: true,
    include_sender_name: true,
  }),
  user_profile: z.object({
    full_name: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone: z.string().optional().nullable(),
  }).nullable().default(null),
  company_info: z.object({
    company_name: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    website: z.string().url().optional().nullable(),
    services_description: z.string().optional().nullable(),
    value_propositions: z.array(z.string()).default([]).optional(),
  }).nullable().default(null),
  auto_check_enabled: z.boolean().default(true),
  last_checked_at: z.string().optional().nullable(),
  autonomy_policies: z.object({
    auto_reply_enabled: z.boolean().default(true),
    confidence_threshold: z.number().min(0).max(1).default(0.85),
    max_daily_auto_replies: z.number().min(0).max(100).default(20),
    meeting_auto_accept: z.object({
      internal: z.boolean().default(true),
      external: z.boolean().default(false),
    }).default({ internal: true, external: false }),
    sensitive_keywords: z.array(z.string()).default(['pricing', 'contract', 'NDA', 'budget', 'legal']),
    spam_auto_archive: z.boolean().default(true),
    working_hours_only: z.boolean().default(true),
  }).nullable().default(null),
  auto_replies_today: z.number().default(0).optional(),
  last_auto_reply_reset: z.string().optional().nullable(),
});

export type InsertAgentConfig = z.infer<typeof insertAgentConfigSchema>;

export type AgentConfig = {
  id: string;
  user_id: string;
  agent_name: string;
  is_active: boolean;
  autonomy_level: 'manual_approval' | 'semi_autonomous' | 'fully_autonomous';
  decision_criteria: {
    min_lead_score: number;
    auto_respond_intents: string[];
    auto_book_meeting_intents: string[];
    escalate_to_human_intents: string[];
    max_follow_ups: number;
  };
  activity_schedule: {
    timezone: string;
    working_hours_start: string;
    working_hours_end: string;
    working_days: number[];
    daily_activity_limit: number;
  };
  meeting_settings: {
    calendly_link?: string | null;
    cal_com_link?: string | null;
    booking_instructions?: string | null;
    default_meeting_duration: number;
  };
  personalization_settings: {
    tone: 'professional' | 'friendly' | 'casual' | 'authoritative';
    use_brand_voice: boolean;
    include_sender_name: boolean;
    signature?: string | null;
  };
  user_profile: {
    full_name?: string | null;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  company_info: {
    company_name?: string | null;
    industry?: string | null;
    website?: string | null;
    services_description?: string | null;
    value_propositions?: string[];
  } | null;
  auto_check_enabled: boolean;
  last_checked_at?: string | null;
  autonomy_policies: {
    auto_reply_enabled: boolean;
    confidence_threshold: number;
    max_daily_auto_replies: number;
    meeting_auto_accept: {
      internal: boolean;
      external: boolean;
    };
    sensitive_keywords: string[];
    spam_auto_archive: boolean;
    working_hours_only: boolean;
  } | null;
  auto_replies_today?: number;
  last_auto_reply_reset?: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// AGENT SOPHIA - ACTIVITY LOG
// ============================================

export const insertAgentActivitySchema = z.object({
  contact_id: z.string().uuid().optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  activity_type: z.enum([
    'prospecting',
    'outreach_sent',
    'follow_up_sent',
    'response_analyzed',
    'meeting_scheduled',
    'escalated_to_human',
    'lead_qualified',
    'lead_disqualified',
    'email_auto_replied',
    'email_drafted',
    'email_analyzed',
    'meeting_auto_booked',
    'follow_up_scheduled',
  ]),
  channel: z.enum(['linkedin', 'email', 'sms', 'phone', 'social', 'voicemail']).optional().nullable(),
  action_taken: z.string().min(1, "Action description is required"),
  message_content: z.string().optional().nullable(),
  metadata: z.record(z.any()).default({}),
  outcome: z.enum(['success', 'failed', 'pending']).default('pending'),
  outcome_details: z.string().optional().nullable(),
});

export type InsertAgentActivity = z.infer<typeof insertAgentActivitySchema>;

export type AgentActivity = {
  id: string;
  user_id: string;
  contact_id: string | null;
  campaign_id: string | null;
  activity_type: 'prospecting' | 'outreach_sent' | 'follow_up_sent' | 'response_analyzed' | 'meeting_scheduled' | 'escalated_to_human' | 'lead_qualified' | 'lead_disqualified' | 'email_auto_replied' | 'email_drafted' | 'email_analyzed' | 'meeting_auto_booked' | 'follow_up_scheduled';
  channel: 'linkedin' | 'email' | 'sms' | 'phone' | 'social' | 'voicemail' | null;
  action_taken: string;
  message_content: string | null;
  metadata: Record<string, any>;
  outcome: 'success' | 'failed' | 'pending';
  outcome_details: string | null;
  created_at: string;
};

// ============================================
// AGENT SOPHIA - AI DECISIONS
// ============================================

export const insertAgentDecisionSchema = z.object({
  contact_id: z.string().uuid(),
  response_id: z.string().uuid().optional().nullable(),
  decision_type: z.enum([
    'send_follow_up',
    'schedule_meeting',
    'escalate_to_human',
    'disqualify_lead',
    'continue_nurture',
    'pause_outreach',
  ]),
  reasoning: z.string().min(1, "AI reasoning is required"),
  confidence_score: z.number().min(0).max(1),
  input_data: z.record(z.any()).default({}),
  recommended_action: z.string().min(1, "Recommended action is required"),
  human_override: z.boolean().default(false),
  override_reason: z.string().optional().nullable(),
});

export type InsertAgentDecision = z.infer<typeof insertAgentDecisionSchema>;

export type AgentDecision = {
  id: string;
  user_id: string;
  contact_id: string;
  response_id: string | null;
  decision_type: 'send_follow_up' | 'schedule_meeting' | 'escalate_to_human' | 'disqualify_lead' | 'continue_nurture' | 'pause_outreach';
  reasoning: string;
  confidence_score: number;
  input_data: Record<string, any>;
  recommended_action: string;
  human_override: boolean;
  override_reason: string | null;
  created_at: string;
};

// ============================================
// WORKFLOWS - Visual Sequence Builder
// ============================================

export const insertWorkflowSchema = z.object({
  name: z.string().min(1, "Workflow name is required"),
  description: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft'),
  type: z.enum(['email', 'linkedin', 'sms', 'multi-channel']).default('multi-channel'),
  version: z.number().default(1),
  is_published: z.boolean().default(false),
  ai_generated: z.boolean().default(false),
  settings: z.record(z.any()).default({}),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;

export type Workflow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  type: 'email' | 'linkedin' | 'sms' | 'multi-channel';
  version: number;
  is_published: boolean;
  published_at: string | null;
  ai_generated: boolean;
  settings: Record<string, any>;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// WORKFLOW NODES - Steps in the sequence
// ============================================

export const insertWorkflowNodeSchema = z.object({
  workflow_id: z.string().uuid("Invalid workflow ID"),
  node_type: z.enum(['email', 'linkedin_connect', 'linkedin_message', 'sms', 'wait', 'condition', 'webhook']),
  label: z.string().min(1, "Label is required"),
  position_x: z.number().default(0),
  position_y: z.number().default(0),
  config: z.record(z.any()).default({}),
  ai_recommended: z.boolean().default(false),
});

export type InsertWorkflowNode = z.infer<typeof insertWorkflowNodeSchema>;

export type WorkflowNode = {
  id: string;
  workflow_id: string;
  node_type: 'email' | 'linkedin_connect' | 'linkedin_message' | 'sms' | 'wait' | 'condition' | 'webhook';
  label: string;
  position_x: number;
  position_y: number;
  config: Record<string, any>;
  ai_recommended: boolean;
  created_at: string;
  updated_at: string;
};

// ============================================
// WORKFLOW EDGES - Connections between nodes
// ============================================

export const insertWorkflowEdgeSchema = z.object({
  workflow_id: z.string().uuid("Invalid workflow ID"),
  source_node_id: z.string().uuid("Invalid source node ID"),
  target_node_id: z.string().uuid("Invalid target node ID"),
  condition: z.record(z.any()).optional().nullable(),
  label: z.string().optional().nullable(),
});

export type InsertWorkflowEdge = z.infer<typeof insertWorkflowEdgeSchema>;

export type WorkflowEdge = {
  id: string;
  workflow_id: string;
  source_node_id: string;
  target_node_id: string;
  condition: Record<string, any> | null;
  label: string | null;
  created_at: string;
};

// ============================================
// WORKFLOW RUNS - Contact progression through workflow
// ============================================

export const insertWorkflowRunSchema = z.object({
  workflow_id: z.string().uuid("Invalid workflow ID"),
  contact_id: z.string().uuid("Invalid contact ID"),
  status: z.enum(['active', 'completed', 'paused', 'failed']).default('active'),
  current_node_id: z.string().uuid().optional().nullable(),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  metadata: z.record(z.any()).default({}),
});

export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;

export type WorkflowRun = {
  id: string;
  workflow_id: string;
  contact_id: string;
  user_id: string;
  status: 'active' | 'completed' | 'paused' | 'failed';
  current_node_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

// ============================================
// CONTACT WORKFLOW STEPS - Track step-level progress
// ============================================

export const insertContactWorkflowStepSchema = z.object({
  workflow_run_id: z.string().uuid("Invalid workflow run ID"),
  node_id: z.string().uuid("Invalid node ID"),
  contact_id: z.string().uuid("Invalid contact ID"),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped', 'failed']).default('pending'),
  entered_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  edge_id: z.string().uuid().optional().nullable(),
  condition_result: z.record(z.any()).optional().nullable(),
  metadata: z.record(z.any()).default({}),
});

export type InsertContactWorkflowStep = z.infer<typeof insertContactWorkflowStepSchema>;

export type ContactWorkflowStep = {
  id: string;
  workflow_run_id: string;
  node_id: string;
  contact_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  entered_at: string | null;
  completed_at: string | null;
  edge_id: string | null;
  condition_result: Record<string, any> | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

// ============================================
// WORKFLOW ANALYTICS - Step-level performance
// ============================================

export const insertWorkflowAnalyticsSchema = z.object({
  workflow_id: z.string().uuid("Invalid workflow ID"),
  node_id: z.string().uuid("Invalid node ID"),
  metric_type: z.enum(['entered', 'completed', 'skipped', 'failed', 'opened', 'clicked', 'replied']),
  count: z.number().default(1),
  date: z.string(),
});

export type InsertWorkflowAnalytics = z.infer<typeof insertWorkflowAnalyticsSchema>;

export type WorkflowAnalytics = {
  id: string;
  workflow_id: string;
  node_id: string;
  user_id: string;
  metric_type: 'entered' | 'completed' | 'skipped' | 'failed' | 'opened' | 'clicked' | 'replied';
  count: number;
  date: string;
  created_at: string;
};

// ============================================
// HEYREACH LINKEDIN CONNECTION (Per-user)
// ============================================

export const insertHeyreachLinkedInSchema = z.object({
  linkedin_account_id: z.string().min(1, "LinkedIn account ID is required"),
  linkedin_access_token: z.string().min(1, "LinkedIn access token is required"),
  linkedin_refresh_token: z.string().optional().nullable(),
  heyreach_contact_id: z.string().optional().nullable(),
  profile_data: z.record(z.any()).default({}),
  is_active: z.boolean().default(true),
  token_expires_at: z.string().optional().nullable(),
  last_sync: z.string().optional().nullable(),
});

export type InsertHeyreachLinkedIn = z.infer<typeof insertHeyreachLinkedInSchema>;

export type HeyreachLinkedIn = {
  id: string;
  user_id: string;
  linkedin_account_id: string;
  linkedin_access_token: string;
  linkedin_refresh_token: string | null;
  heyreach_contact_id: string | null;
  profile_data: Record<string, any>;
  is_active: boolean;
  token_expires_at: string | null;
  last_sync: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// INTEGRATION REGISTRY & CONNECTED ACCOUNTS
// ============================================

export const INTEGRATION_TYPES = [
  'linkedin',
  'email_gmail',
  'email_outlook',
  'email_sendgrid',
  'email_resend',
  'email_smtp',
  'sms_twilio',
  'sms_vonage',
  'phone_twilio',
  'phone_elevenLabs',
  'whatsapp_twilio',
  'twitter',
  'facebook',
  'instagram',
  'tiktok'
] as const;

export type IntegrationType = typeof INTEGRATION_TYPES[number];

export const insertConnectedAccountSchema = z.object({
  integration_type: z.enum(INTEGRATION_TYPES),
  provider_account_id: z.string().min(1, "Provider account ID is required"),
  display_name: z.string().optional(),
  credentials: z.record(z.any()).optional(),
  profile_data: z.record(z.any()).default({}),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
  settings: z.record(z.any()).default({}),
  error_message: z.string().optional().nullable(),
});

export type InsertConnectedAccount = z.infer<typeof insertConnectedAccountSchema>;

export type ConnectedAccount = {
  id: string;
  user_id: string;
  integration_type: IntegrationType;
  provider_account_id: string;
  display_name: string | null;
  credentials: Record<string, any> | null;
  profile_data: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  settings: Record<string, any>;
  error_message: string | null;
  last_used: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

// Integration capabilities
export type IntegrationCapability = 
  | 'send_message'
  | 'send_connection_request'
  | 'get_profile'
  | 'get_contacts'
  | 'get_conversations'
  | 'schedule_message'
  | 'analyze_engagement';

export const integrationCapabilities: Record<IntegrationType, IntegrationCapability[]> = {
  linkedin: ['send_message', 'send_connection_request', 'get_profile', 'get_contacts', 'get_conversations', 'analyze_engagement'],
  email_gmail: ['send_message', 'get_conversations', 'schedule_message'],
  email_outlook: ['send_message', 'get_conversations', 'schedule_message'],
  email_sendgrid: ['send_message', 'schedule_message'],
  email_resend: ['send_message', 'schedule_message'],
  email_smtp: ['send_message', 'schedule_message'],
  sms_twilio: ['send_message', 'schedule_message'],
  sms_vonage: ['send_message', 'schedule_message'],
  phone_twilio: ['send_message'],
  phone_elevenLabs: ['send_message'],
  whatsapp_twilio: ['send_message', 'schedule_message'],
  twitter: ['send_message', 'get_contacts', 'send_connection_request'],
  facebook: ['send_message', 'get_contacts'],
  instagram: ['send_message', 'get_contacts'],
  tiktok: ['send_message', 'get_contacts'],
};

// ============================================
// SOCIAL MEDIA & AUTOMATION INTEGRATIONS
// ============================================

export const integrationPlatforms = [
  // Social Media
  { id: 'twitter', name: 'Twitter/X', category: 'social', icon: 'Twitter', color: '#000000' },
  { id: 'facebook', name: 'Facebook', category: 'social', icon: 'Facebook', color: '#1877F2' },
  { id: 'instagram', name: 'Instagram', category: 'social', icon: 'Instagram', color: '#E4405F' },
  { id: 'tiktok', name: 'TikTok', category: 'social', icon: 'Music', color: '#000000' },
  { id: 'youtube', name: 'YouTube', category: 'social', icon: 'Youtube', color: '#FF0000' },
  { id: 'linkedin', name: 'LinkedIn', category: 'social', icon: 'Linkedin', color: '#0A66C2' },
  
  // Email Automation
  { id: 'heyreach', name: 'Heyreach', category: 'email_automation', icon: 'Mail', color: '#7C3AED' },
  { id: 'reply_io', name: 'Reply.io', category: 'email_automation', icon: 'Send', color: '#0EA5E9' },
  { id: 'sendgrid', name: 'SendGrid', category: 'email', icon: 'Mail', color: '#0080FF' },
  { id: 'resend', name: 'Resend', category: 'email', icon: 'Mail', color: '#000000' },
  
  // CRM & Contact Management
  { id: 'hubspot', name: 'HubSpot', category: 'crm', icon: 'Contact', color: '#FF7A59' },
  { id: 'pipedrive', name: 'Pipedrive', category: 'crm', icon: 'Zap', color: '#0D9B6B' },
  { id: 'salesforce', name: 'Salesforce', category: 'crm', icon: 'BarChart3', color: '#00A1DE' },
];

export const insertSocialMediaPostSchema = z.object({
  platform: z.string(),
  content: z.string().min(1, "Content is required"),
  media_urls: z.array(z.string()).optional(),
  scheduled_at: z.string().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).default('draft'),
  engagement_metrics: z.record(z.any()).default({}),
  campaign_id: z.string().optional().nullable(),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertSocialMediaPost = z.infer<typeof insertSocialMediaPostSchema>;

export type SocialMediaPost = {
  id: string;
  user_id: string;
  platform: string;
  content: string;
  media_urls: string[] | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: string;
  platform_post_id: string | null;
  engagement_metrics: Record<string, any>;
  campaign_id: string | null;
  workspace_id: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================
// ADVANCED CONVERSATION ANALYSIS
// ============================================

export const conversationAnalysisSchema = z.object({
  message_id: z.string().uuid(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  sentiment_score: z.number().min(0).max(1),
  intent_category: z.enum(['interested', 'objection', 'question', 'not_interested', 'meeting_request', 'other']),
  tone: z.enum(['professional', 'casual', 'urgent', 'friendly', 'formal']),
  key_topics: z.array(z.string()),
  urgency_score: z.number().min(0).max(100),
  buying_signals: z.array(z.string()).optional(),
});

export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema> & {
  id: string;
  workspace_id: string;
  contact_id: string;
  created_at: string;
};

// ============================================
// DEAL FORECASTING & REVENUE INTELLIGENCE
// ============================================

export const dealForecastSchema = z.object({
  contact_id: z.string().uuid(),
  deal_probability: z.number().min(0).max(100),
  estimated_close_date: z.string(),
  estimated_deal_value: z.number().min(0).optional(),
  pipeline_stage: z.enum(['prospect', 'engaged', 'qualified', 'negotiation', 'closed_won', 'closed_lost']),
  forecast_confidence: z.number().min(0).max(100),
  risk_factors: z.array(z.string()).optional(),
  growth_trajectory: z.enum(['increasing', 'stable', 'declining']),
});

export type DealForecast = z.infer<typeof dealForecastSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// CONTENT GENERATION HUB
// ============================================

export const contentTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  channel: z.enum(['email', 'linkedin', 'sms', 'twitter', 'social']),
  category: z.enum(['outreach', 'followup', 'nurture', 'meeting_request', 'objection_handling', 'cold_outreach', 'warm_intro']),
  template_content: z.string().min(1, "Content is required"),
  variables: z.array(z.string()).optional(),
  performance_score: z.number().min(0).max(100).optional(),
  usage_count: z.number().default(0),
  is_ai_generated: z.boolean().default(false),
  industry: z.string().optional(),
  intent_tags: z.array(z.string()).default([]),
  conversion_rate: z.number().min(0).max(100).optional(),
  variant_of: z.string().optional(),
  a_b_test_id: z.string().optional(),
});

export const abTestSchema = z.object({
  campaign_id: z.string(),
  name: z.string().min(1),
  control_template_id: z.string(),
  variant_template_ids: z.array(z.string()),
  status: z.enum(['running', 'completed', 'paused']).default('running'),
  metric: z.enum(['open_rate', 'click_rate', 'reply_rate', 'conversion_rate']).default('conversion_rate'),
  winning_template_id: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export type ABTest = z.infer<typeof abTestSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

export type ContentTemplate = z.infer<typeof contentTemplateSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// CUSTOM AI FINE-TUNING
// ============================================

export const fineTuningDataSchema = z.object({
  model_name: z.string().min(1, "Model name is required"),
  training_data: z.array(z.object({
    input: z.string(),
    output: z.string()
  })),
  data_category: z.enum(['conversation_style', 'response_generation', 'intent_detection', 'objection_handling']),
  status: z.enum(['collecting', 'ready_to_train', 'training', 'completed', 'failed']).default('collecting'),
  training_samples_count: z.number().default(0),
  accuracy_score: z.number().min(0).max(1).optional(),
  performance_metrics: z.record(z.any()).optional(),
});

export type FineTuningData = z.infer<typeof fineTuningDataSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// EMAIL & SMS SENDING
// ============================================

export const emailCampaignSchema = z.object({
  recipients: z.array(z.string().email()),
  subject: z.string().min(1, "Subject required"),
  body: z.string().min(1, "Body required"),
  template_id: z.string().optional(),
  send_at: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed']).default('draft'),
});

export type EmailCampaign = z.infer<typeof emailCampaignSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

export const smsCampaignSchema = z.object({
  recipients: z.array(z.string()),
  message: z.string().min(1, "Message required"),
  send_at: z.string().optional(),
  status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'failed']).default('draft'),
});

export type SMSCampaign = z.infer<typeof smsCampaignSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

// ============================================
// CRM INTEGRATIONS
// ============================================

export const CRM_PLATFORMS = [
  'hubspot',
  'salesforce', 
  'pipedrive',
  'gohighlevel',
  'zoho',
  'freshsales',
  'closeio',
  'monday',
  'copper',
  'insightly',
  'keap',
  'zendesk_sell',
  'activecampaign',
  'nutshell'
] as const;

export type CRMPlatform = typeof CRM_PLATFORMS[number];

export const CRM_PLATFORM_INFO: Record<CRMPlatform, { name: string; logo: string; description: string; authType: 'api_key' | 'oauth' | 'both'; website: string }> = {
  hubspot: { name: 'HubSpot', logo: 'hubspot', description: 'All-in-one CRM, marketing, and sales platform', authType: 'both', website: 'https://hubspot.com' },
  salesforce: { name: 'Salesforce', logo: 'salesforce', description: 'Enterprise CRM with extensive customization', authType: 'oauth', website: 'https://salesforce.com' },
  pipedrive: { name: 'Pipedrive', logo: 'pipedrive', description: 'Sales-focused CRM with visual pipeline', authType: 'api_key', website: 'https://pipedrive.com' },
  gohighlevel: { name: 'GoHighLevel', logo: 'gohighlevel', description: 'All-in-one marketing platform for agencies', authType: 'api_key', website: 'https://gohighlevel.com' },
  zoho: { name: 'Zoho CRM', logo: 'zoho', description: 'Comprehensive CRM with AI assistant', authType: 'oauth', website: 'https://zoho.com/crm' },
  freshsales: { name: 'Freshsales', logo: 'freshsales', description: 'AI-powered CRM by Freshworks', authType: 'api_key', website: 'https://freshsales.io' },
  closeio: { name: 'Close', logo: 'close', description: 'CRM built for inside sales teams', authType: 'api_key', website: 'https://close.com' },
  monday: { name: 'Monday CRM', logo: 'monday', description: 'Flexible work OS with CRM capabilities', authType: 'api_key', website: 'https://monday.com' },
  copper: { name: 'Copper', logo: 'copper', description: 'Google Workspace-native CRM', authType: 'api_key', website: 'https://copper.com' },
  insightly: { name: 'Insightly', logo: 'insightly', description: 'CRM with project management features', authType: 'api_key', website: 'https://insightly.com' },
  keap: { name: 'Keap', logo: 'keap', description: 'Small business CRM with automation', authType: 'api_key', website: 'https://keap.com' },
  zendesk_sell: { name: 'Zendesk Sell', logo: 'zendesk', description: 'Sales CRM with Zendesk integration', authType: 'api_key', website: 'https://zendesk.com/sell' },
  activecampaign: { name: 'ActiveCampaign', logo: 'activecampaign', description: 'Email marketing with CRM features', authType: 'api_key', website: 'https://activecampaign.com' },
  nutshell: { name: 'Nutshell', logo: 'nutshell', description: 'Simple and powerful CRM for B2B', authType: 'api_key', website: 'https://nutshell.com' },
};

export const crmConnectionSchema = z.object({
  crm_type: z.enum(CRM_PLATFORMS),
  account_name: z.string().min(1, "Account name required"),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
  api_url: z.string().optional(),
  oauth_token: z.string().optional(),
  oauth_refresh_token: z.string().optional(),
  oauth_expires_at: z.string().optional(),
  location_id: z.string().optional(),
  is_active: z.boolean().default(true),
  sync_enabled: z.boolean().default(false),
  sync_direction: z.enum(['push', 'pull', 'bidirectional']).default('bidirectional'),
  sync_frequency: z.enum(['realtime', 'hourly', 'daily', 'manual']).default('hourly'),
  field_mapping: z.record(z.string()).optional(),
  sophia_managed: z.boolean().default(false),
  sophia_auto_sync: z.boolean().default(false),
  sophia_recommendations: z.boolean().default(true),
  last_sync_at: z.string().optional(),
  last_error: z.string().optional(),
});

export type CRMConnection = z.infer<typeof crmConnectionSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export const crmSyncStatusSchema = z.object({
  connection_id: z.string().uuid(),
  total_contacts: z.number(),
  synced_contacts: z.number(),
  failed_contacts: z.number().default(0),
  last_sync_time: z.string(),
  next_sync_time: z.string().optional(),
  sync_status: z.enum(['idle', 'syncing', 'success', 'error', 'partial']),
  error_message: z.string().optional(),
  sync_direction: z.enum(['push', 'pull', 'bidirectional']).default('bidirectional'),
  contacts_created: z.number().default(0),
  contacts_updated: z.number().default(0),
  deals_synced: z.number().default(0),
  activities_synced: z.number().default(0),
});

export type CRMSyncStatus = z.infer<typeof crmSyncStatusSchema> & {
  id: string;
};

export const crmFieldMappingSchema = z.object({
  connection_id: z.string().uuid(),
  source_field: z.string(),
  target_field: z.string(),
  transform: z.enum(['none', 'lowercase', 'uppercase', 'date', 'number', 'boolean']).default('none'),
  is_required: z.boolean().default(false),
});

export type CRMFieldMapping = z.infer<typeof crmFieldMappingSchema> & {
  id: string;
};

export const crmSyncLogSchema = z.object({
  connection_id: z.string().uuid(),
  sync_type: z.enum(['full', 'incremental', 'manual']),
  direction: z.enum(['push', 'pull']),
  status: z.enum(['started', 'completed', 'failed', 'partial']),
  records_processed: z.number(),
  records_created: z.number(),
  records_updated: z.number(),
  records_failed: z.number(),
  error_details: z.array(z.object({
    record_id: z.string(),
    error: z.string(),
    field: z.string().optional()
  })).optional(),
  sophia_initiated: z.boolean().default(false),
  sophia_recommendation: z.string().optional(),
  duration_ms: z.number(),
});

export type CRMSyncLog = z.infer<typeof crmSyncLogSchema> & {
  id: string;
  started_at: string;
  completed_at: string;
};

// ============================================
// ADVANCED ANALYTICS
// ============================================

export const analyticsMetricsSchema = z.object({
  total_contacts: z.number(),
  total_campaigns: z.number(),
  total_responses: z.number(),
  response_rate: z.number(),
  conversion_rate: z.number(),
  avg_deal_value: z.number(),
  pipeline_value: z.number(),
  forecast_revenue: z.number(),
  top_channels: z.array(z.object({ channel: z.string(), count: z.number() })),
  top_intents: z.array(z.object({ intent: z.string(), count: z.number() })),
});

export type AnalyticsMetrics = z.infer<typeof analyticsMetricsSchema> & {
  workspace_id: string;
  date_range: string;
};

// ============================================
// MEETING BOOKING & CALENDAR INTEGRATION
// ============================================

export const calendarConnectionSchema = z.object({
  provider: z.enum(['google', 'outlook', 'calendly']),
  email: z.string().email(),
  access_token: z.string(),
  refresh_token: z.string().optional(),
  is_primary: z.boolean().default(false),
  sync_enabled: z.boolean().default(true),
  last_sync: z.string().optional(),
});

export type CalendarConnection = z.infer<typeof calendarConnectionSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export const availabilityBlockSchema = z.object({
  connection_id: z.string(),
  day_of_week: z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().default('UTC'),
  buffer_before_minutes: z.number().default(0),
  buffer_after_minutes: z.number().default(0),
});

export type AvailabilityBlock = z.infer<typeof availabilityBlockSchema> & {
  id: string;
  workspace_id: string;
};

export const bookingSchema = z.object({
  contact_id: z.string(),
  campaign_id: z.string().optional(),
  meeting_title: z.string().min(1, "Title required"),
  description: z.string().optional(),
  duration_minutes: z.number().min(15).max(240),
  proposed_times: z.array(z.string()),
  contact_email: z.string().email(),
  contact_name: z.string(),
  status: z.enum(['pending', 'scheduled', 'confirmed', 'cancelled', 'completed']).default('pending'),
  calendar_event_id: z.string().optional(),
  meeting_link: z.string().optional(),
  send_confirmation: z.boolean().default(true),
});

export type Booking = z.infer<typeof bookingSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  scheduled_time: string | null;
  created_at: string;
  updated_at: string;
};

export const meetingRecordSchema = z.object({
  booking_id: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  duration_minutes: z.number(),
  notes: z.string().optional(),
  recording_url: z.string().optional(),
  attendees: z.array(z.object({ name: z.string(), email: z.string() })),
});

export type MeetingRecord = z.infer<typeof meetingRecordSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
};

// ============================================
// LEAD ENRICHMENT & INTENT SIGNALS
// ============================================

export const leadEnrichmentSchema = z.object({
  contact_id: z.string(),
  company_name: z.string(),
  company_size: z.string().optional(),
  industry: z.string().optional(),
  website_url: z.string().url().optional(),
  recent_funding: z.string().optional(),
  tech_stack: z.array(z.string()).optional(),
  buying_signals: z.array(z.string()).optional(),
  intent_score: z.number().min(0).max(100),
  job_change_detected: z.boolean().optional(),
  similar_companies: z.array(z.string()).optional(),
});

export type LeadEnrichment = z.infer<typeof leadEnrichmentSchema> & {
  id: string;
  workspace_id: string;
  enriched_at: string;
};

// ============================================
// EMAIL SYNC (Two-Way)
// ============================================

export const emailSyncConfigSchema = z.object({
  provider: z.enum(['gmail', 'outlook']),
  email: z.string().email(),
  access_token: z.string(),
  auto_sync_enabled: z.boolean().default(true),
  sync_interval_minutes: z.number().default(15),
  last_sync: z.string().optional(),
});

export type EmailSyncConfig = z.infer<typeof emailSyncConfigSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
};

export const emailMessageSchema = z.object({
  external_message_id: z.string(),
  contact_id: z.string(),
  subject: z.string(),
  body: z.string(),
  sender_email: z.string().email(),
  recipient_email: z.string().email(),
  received_at: z.string(),
  thread_id: z.string(),
  is_reply: z.boolean(),
  attachments: z.array(z.object({ filename: z.string(), size: z.number() })).optional(),
});

export type EmailMessage = z.infer<typeof emailMessageSchema> & {
  id: string;
  workspace_id: string;
  synced_at: string;
};

// ============================================
// ACTIVITY FEED & REAL-TIME NOTIFICATIONS
// ============================================

export const activityEventSchema = z.object({
  event_type: z.enum(['email_opened', 'email_clicked', 'page_visited', 'form_filled', 'call_scheduled', 'meeting_attended', 'response_received', 'campaign_sent']),
  contact_id: z.string(),
  campaign_id: z.string().optional(),
  details: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
});

export type ActivityEvent = z.infer<typeof activityEventSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
};

export const notificationPreferenceSchema = z.object({
  user_id: z.string(),
  email_opened: z.boolean().default(true),
  high_priority_events: z.boolean().default(true),
  daily_digest: z.boolean().default(false),
  real_time_alerts: z.boolean().default(true),
  notification_channels: z.array(z.enum(['in_app', 'email', 'sms'])).default(['in_app']),
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema> & {
  id: string;
  workspace_id: string;
};

// ============================================
// ACCOUNT-BASED MARKETING (ABM)
// ============================================

export const abmAccountSchema = z.object({
  company_name: z.string(),
  industry: z.string(),
  annual_revenue: z.string().optional(),
  employee_count: z.number().optional(),
  decision_makers: z.array(z.object({ name: z.string(), title: z.string(), email: z.string() })),
  account_health_score: z.number().min(0).max(100),
  engagement_level: z.enum(['low', 'medium', 'high', 'very_high']),
  target_personas: z.array(z.string()),
  campaign_ids: z.array(z.string()).optional(),
});

export type ABMAccount = z.infer<typeof abmAccountSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

export const abmCampaignSchema = z.object({
  account_ids: z.array(z.string()),
  campaign_name: z.string(),
  objectives: z.array(z.string()),
  duration_days: z.number(),
  budget: z.number().optional(),
  personalization_level: z.enum(['basic', 'standard', 'advanced', 'ultra_personalized']),
  multi_threaded: z.boolean().default(true),
});

export type ABMCampaign = z.infer<typeof abmCampaignSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
};

// ============================================
// ADVANCED REPORTING & DATA EXPORT
// ============================================

export const customReportSchema = z.object({
  report_name: z.string(),
  report_type: z.enum(['campaign_performance', 'contact_engagement', 'revenue_forecast', 'channel_comparison', 'intent_analysis', 'custom']),
  metrics: z.array(z.string()),
  filters: z.record(z.any()).optional(),
  date_range: z.object({ start: z.string(), end: z.string() }),
  scheduled: z.boolean().default(false),
  schedule_frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
  email_recipients: z.array(z.string().email()).optional(),
  export_format: z.enum(['pdf', 'csv', 'xlsx']).optional(),
});

export type CustomReport = z.infer<typeof customReportSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  last_generated: string | null;
};

export const dataExportSchema = z.object({
  export_type: z.enum(['contacts', 'campaigns', 'responses', 'activities', 'all']),
  date_range: z.object({ start: z.string(), end: z.string() }),
  format: z.enum(['csv', 'xlsx', 'json']),
  include_metadata: z.boolean().default(true),
});

export type DataExport = z.infer<typeof dataExportSchema> & {
  id: string;
  workspace_id: string;
  user_id: string;
  file_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
};

// ============================================
// AUTO-REPLY ENGINE & WORKFLOW AUTOMATION
// ============================================

export const autoReplyRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  trigger_intent: z.enum(['interested', 'question', 'objection', 'meeting_request', 'approval', 'rejection', 'request_info', 'any']).default('any'),
  trigger_keywords: z.array(z.string()).optional(),
  response_type: z.enum(['template', 'custom_message', 'meeting_link']).default('template'),
  response_template_id: z.string().optional(),
  custom_message: z.string().optional(),
  channels: z.array(z.enum(['email', 'linkedin', 'sms', 'chat'])).default(['email']),
  auto_approval_mode: z.enum(['fully_autonomous', 'semi_autonomous_approval', 'manual_review']).default('semi_autonomous_approval'),
  rate_limit_per_contact: z.number().default(1),
  rate_limit_window_hours: z.number().default(24),
  forward_to_human: z.boolean().default(false),
  forward_email: z.string().email().optional(),
  tags_to_apply: z.array(z.string()).optional(),
  status_to_update: z.string().optional(),
});

export type AutoReplyRule = z.infer<typeof autoReplyRuleSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

export const workflowTriggerSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  trigger_type: z.enum(['no_reply_X_days', 'email_opened', 'link_clicked', 'lead_score_hot', 'status_changed', 'tag_added', 'meeting_booked', 'reply_received']),
  trigger_value: z.string().optional(),
  action_type: z.enum(['send_email', 'send_sms', 'move_stage', 'add_tag', 'update_score', 'notify_team', 'schedule_followup']),
  action_details: z.record(z.any()).optional(),
  apply_to_all_campaigns: z.boolean().default(false),
  campaign_ids: z.array(z.string()).optional(),
});

export type WorkflowTrigger = z.infer<typeof workflowTriggerSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// UNIFIED INBOX & EMAIL MANAGEMENT
// ============================================

export const inboxMessageSchema = z.object({
  from_name: z.string(),
  from_email: z.string().email(),
  subject: z.string(),
  message_body: z.string(),
  channel: z.enum(['email', 'linkedin', 'sms', 'chat']).default('email'),
  sentiment: z.enum(['positive', 'neutral', 'negative']).default('neutral'),
  buyer_signal_score: z.number().min(0).max(100).default(50),
  intent_tag: z.enum(['interested', 'question', 'objection', 'meeting_request', 'approval', 'rejection', 'request_info', 'followup', 'other']).default('other'),
  contact_id: z.string().optional(),
  campaign_id: z.string().optional(),
  is_read: z.boolean().default(false),
  needs_approval: z.boolean().default(false),
  approval_status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  assigned_to: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export type InboxMessage = z.infer<typeof inboxMessageSchema> & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

export const aiResponseSuggestionSchema = z.object({
  message_id: z.string(),
  suggestion_type: z.enum(['quick_reply', 'template_based', 'meeting_proposal', 'escalation']),
  suggested_response: z.string(),
  confidence_score: z.number().min(0).max(100),
  reasoning: z.string().optional(),
  next_action: z.string().optional(),
});

export type AIResponseSuggestion = z.infer<typeof aiResponseSuggestionSchema>;

// ============================================
// DASHBOARD & ANALYTICS
// ============================================

export const dashboardMetricsSchema = z.object({
  total_contacts: z.number().default(0),
  total_campaigns: z.number().default(0),
  hot_leads_count: z.number().default(0),
  warm_leads_count: z.number().default(0),
  cold_leads_count: z.number().default(0),
  inbox_unread: z.number().default(0),
  avg_open_rate: z.number().min(0).max(100).default(0),
  avg_click_rate: z.number().min(0).max(100).default(0),
  avg_conversion_rate: z.number().min(0).max(100).default(0),
  pipeline_total_value: z.number().default(0),
  monthly_revenue_forecast: z.number().default(0),
  meeting_scheduled_this_month: z.number().default(0),
  deals_closed_this_month: z.number().default(0),
});

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;

export const revenueForecastSchema = z.object({
  timeframe: z.enum(['this_week', 'this_month', 'this_quarter', 'this_year']),
  total_pipeline: z.number(),
  weighted_forecast: z.number(),
  best_case: z.number(),
  worst_case: z.number(),
  deal_stages: z.record(z.object({
    stage_name: z.string(),
    deal_count: z.number(),
    avg_deal_value: z.number(),
    probability: z.number().min(0).max(100),
  })),
});

export type RevenueForecast = z.infer<typeof revenueForecastSchema>;

export const contactSegmentSchema = z.object({
  segment_name: z.string(),
  description: z.string().optional(),
  criteria: z.object({
    score_min: z.number().optional(),
    score_max: z.number().optional(),
    intent_tags: z.array(z.string()).optional(),
    industries: z.array(z.string()).optional(),
    company_sizes: z.array(z.string()).optional(),
  }),
  contact_count: z.number().default(0),
});

export type ContactSegment = z.infer<typeof contactSegmentSchema> & { id: string };

// ============================================
// WORKSPACE LEARNING - Performance Metrics (Part 4)
// ============================================

export const performanceMetricsSchema = z.object({
  workspace_id: z.string().uuid(),
  action_type: z.enum(['campaign', 'message', 'meeting', 'follow_up']),
  channel: z.enum(['email', 'linkedin', 'sms', 'phone']),
  metric: z.string(),
  value: z.number(),
});

export type PerformanceMetric = z.infer<typeof performanceMetricsSchema> & {
  id: string;
  created_at: string;
};

// ============================================
// SELF-OPTIMIZATION - Strategies (Part 4)
// ============================================

export const optimizationStrategySchema = z.object({
  workspace_id: z.string().uuid(),
  type: z.enum(['messaging', 'timing', 'channel', 'frequency', 'targeting']),
  title: z.string(),
  description: z.string().optional(),
  current_metric: z.number().optional(),
  expected_improvement: z.number().optional(),
  implementation: z.string().optional(),
  status: z.enum(['proposed', 'testing', 'approved', 'applied', 'rejected']).default('proposed'),
  confidence: z.number().min(0).max(1).optional(),
  test_results: z.record(z.any()).optional(),
});

export type OptimizationStrategy = z.infer<typeof optimizationStrategySchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// SOCIAL MEDIA - Posts & Scheduling
// ============================================

export const insertSocialPostSchema = z.object({
  workspace_id: z.string().uuid().optional().nullable(),
  platform: z.enum(['linkedin', 'facebook', 'twitter', 'instagram', 'tiktok', 'youtube']),
  content: z.string().min(1, "Content is required"),
  hashtags: z.array(z.string()).default([]).optional(),
  scheduled_at: z.string().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'failed']).default('draft'),
  brand_voice_id: z.string().uuid().optional().nullable(),
  media_urls: z.array(z.string()).default([]).optional(),
  engagement_metrics: z.record(z.any()).default({}),
});

export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type SocialPost = InsertSocialPost & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export const insertBrandVoiceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company_name: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  tone: z.enum(['professional', 'friendly', 'casual', 'authoritative', 'empathetic']).default('professional'),
  values: z.array(z.string()).default([]).optional(),
  writing_style: z.string().optional().nullable(),
  avoid_words: z.array(z.string()).default([]).optional(),
  key_messages: z.array(z.string()).default([]).optional(),
  workspace_id: z.string().uuid().optional().nullable(),
});

export type InsertBrandVoice = z.infer<typeof insertBrandVoiceSchema>;
export type BrandVoice = InsertBrandVoice & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// SOPHIA CAMPAIGN OUTCOMES & RECOMMENDATIONS
// ============================================

export const campaignOutcomeSchema = z.object({
  campaign_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  audience_description: z.string(),
  channels: z.array(z.string()),
  messaging_approach: z.string(),
  timing_cadence: z.string(),
  outcome: z.enum(['success', 'partial', 'failure']),
  engagement_rate: z.number().min(0).max(100),
  conversion_rate: z.number().min(0).max(100),
  revenue_generated: z.number().default(0),
  notes: z.string().optional(),
});

export type CampaignOutcome = z.infer<typeof campaignOutcomeSchema> & {
  id: string;
  created_at: string;
};

export const sophiaRecommendationSchema = z.object({
  recommendation_type: z.enum(['audience', 'channel', 'timing', 'messaging', 'overall']),
  title: z.string(),
  description: z.string(),
  action: z.string(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().optional(),
  based_on: z.array(z.string()).default([]),
  impact: z.string().optional(),
});

export type SophiaRecommendation = z.infer<typeof sophiaRecommendationSchema>;

// ============================================
// LEAD SCORING & HOTNESS
// ============================================

export const leadScoreSchema = z.object({
  contact_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  engagement_score: z.number().min(0).max(100),
  intent_score: z.number().min(0).max(100),
  fit_score: z.number().min(0).max(100),
  overall_score: z.number().min(0).max(100),
  hotness: z.enum(['hot', 'warm', 'cold']),
  last_interaction: z.string().optional(),
  interaction_count: z.number().default(0),
});

export type LeadScore = z.infer<typeof leadScoreSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// SCHEDULED SOCIAL POSTS WITH RECURRING SUPPORT
// ============================================

export const insertScheduledSocialPostSchema = z.object({
  workspace_id: z.string().uuid().optional().nullable(),
  platform: z.enum(['linkedin', 'facebook', 'twitter', 'instagram', 'tiktok', 'youtube']),
  content: z.string().optional().nullable(), // AI-generated, may be null initially
  hashtags: z.array(z.string()).default([]).optional(),
  scheduled_date: z.string(), // ISO date string for when to post
  scheduled_time: z.string().optional().nullable(), // Time of day to post (HH:MM)
  status: z.enum(['pending_generation', 'pending_approval', 'approved', 'rejected', 'published', 'failed']).default('pending_generation'),
  approval_status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  approval_notes: z.string().optional().nullable(),
  approved_at: z.string().optional().nullable(),
  approved_by: z.string().uuid().optional().nullable(),
  brand_voice_id: z.string().uuid().optional().nullable(),
  media_urls: z.array(z.string()).default([]).optional(),
  ai_generation_prompt: z.string().optional().nullable(), // Original prompt/topic for AI
  recurring_schedule_id: z.string().uuid().optional().nullable(), // Link to recurring schedule
  account_id: z.string().uuid().optional().nullable(), // Specific connected account to post from
});

export type InsertScheduledSocialPost = z.infer<typeof insertScheduledSocialPostSchema>;
export type ScheduledSocialPost = InsertScheduledSocialPost & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// RECURRING SOCIAL POST SCHEDULES
// ============================================

export const insertRecurringSocialScheduleSchema = z.object({
  workspace_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, "Schedule name is required"),
  platforms: z.array(z.enum(['linkedin', 'facebook', 'twitter', 'instagram', 'tiktok', 'youtube'])),
  account_ids: z.array(z.string().uuid()).default([]), // Specific account IDs to post from
  recurrence_type: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom']),
  recurrence_days: z.array(z.number().min(0).max(6)).default([]), // 0=Sunday, 1=Monday, etc.
  recurrence_dates: z.array(z.number().min(1).max(31)).default([]), // For monthly: specific dates
  post_time: z.string().default('09:00'), // Time to post (HH:MM)
  timezone: z.string().default('America/New_York'),
  is_active: z.boolean().default(true),
  start_date: z.string(), // When the schedule starts
  end_date: z.string().optional().nullable(), // Optional end date
  topic_guidelines: z.string().optional().nullable(), // What Sophia should write about
  content_themes: z.array(z.string()).default([]), // Themes/topics to rotate through
  brand_voice_id: z.string().uuid().optional().nullable(),
  auto_generate: z.boolean().default(true), // Should Sophia auto-generate posts
  require_approval: z.boolean().default(true), // Must user approve before posting
  posts_generated_count: z.number().default(0),
  posts_approved_count: z.number().default(0),
  posts_published_count: z.number().default(0),
});

export type InsertRecurringSocialSchedule = z.infer<typeof insertRecurringSocialScheduleSchema>;
export type RecurringSocialSchedule = InsertRecurringSocialSchedule & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// CONNECTED SOCIAL ACCOUNTS (Multi-Account Support)
// ============================================

export const insertConnectedSocialAccountSchema = z.object({
  workspace_id: z.string().uuid().optional().nullable(),
  platform: z.enum(['linkedin', 'facebook', 'twitter', 'instagram', 'tiktok', 'youtube']),
  account_type: z.enum(['personal', 'page', 'business', 'creator']).default('personal'),
  account_name: z.string().min(1, "Account name is required"),
  account_username: z.string().optional().nullable(),
  account_id: z.string().optional().nullable(), // Platform-specific account ID
  profile_url: z.string().url().optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  access_token: z.string().optional().nullable(), // Encrypted OAuth token
  refresh_token: z.string().optional().nullable(),
  token_expires_at: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false), // Default account for this platform
  connection_status: z.enum(['connected', 'disconnected', 'expired', 'error']).default('connected'),
  last_sync_at: z.string().optional().nullable(),
  permissions: z.array(z.string()).default([]), // e.g., ['post', 'read', 'analytics']
  metadata: z.record(z.any()).default({}), // Platform-specific data
});

export type InsertConnectedSocialAccount = z.infer<typeof insertConnectedSocialAccountSchema>;
export type ConnectedSocialAccount = InsertConnectedSocialAccount & {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

// Update schedule to support specific account selection
export const scheduleAccountSelectionSchema = z.object({
  account_id: z.string().uuid(),
  platform: z.string(),
  account_name: z.string(),
});

export type ScheduleAccountSelection = z.infer<typeof scheduleAccountSelectionSchema>;

// ============================================
// STAY-IN-TOUCH AUTOMATION (Sophia-Powered)
// ============================================

export const stayInTouchRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional().nullable(),
  enabled: z.boolean().default(true),
  
  // Trigger conditions
  days_since_contact: z.number().min(1).default(14), // Days of no contact before triggering
  engagement_threshold: z.enum(['any', 'low', 'medium', 'high']).default('any'), // Only trigger for certain engagement levels
  contact_types: z.array(z.enum(['prospect', 'customer', 'partner', 'vip', 'all'])).default(['all']),
  tags_include: z.array(z.string()).default([]), // Only contacts with these tags
  tags_exclude: z.array(z.string()).default([]), // Exclude contacts with these tags
  
  // Action settings
  action_type: z.enum([
    'send_email', 'send_linkedin', 'send_sms', 'create_task', 'notify_owner', 'sophia_draft'
  ]).default('sophia_draft'),
  message_template_id: z.string().optional().nullable(),
  sophia_generate_message: z.boolean().default(true), // Let Sophia craft personalized message
  sophia_message_tone: z.enum(['friendly', 'professional', 'casual', 'urgent']).default('friendly'),
  sophia_message_purpose: z.enum(['check_in', 'share_value', 'schedule_call', 're_engage', 'custom']).default('check_in'),
  custom_message_prompt: z.string().optional().nullable(), // Custom prompt for Sophia
  
  // Automation settings
  auto_send: z.boolean().default(false), // Send immediately or queue for approval
  approval_required: z.boolean().default(true),
  max_followups_per_contact: z.number().min(1).max(10).default(3),
  followup_interval_days: z.number().min(1).default(7), // Days between subsequent follow-ups
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  
  // Channels
  channels: z.array(z.enum(['email', 'linkedin', 'sms', 'phone'])).default(['email']),
  channel_preference: z.enum(['primary_only', 'fallback_chain', 'all_channels']).default('primary_only'),
  
  // Schedule
  active_hours_start: z.string().default('09:00'),
  active_hours_end: z.string().default('18:00'),
  active_days: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]), // Mon-Fri
  timezone: z.string().default('America/New_York'),
});

export type InsertStayInTouchRule = z.infer<typeof stayInTouchRuleSchema>;
export type StayInTouchRule = InsertStayInTouchRule & {
  id: string;
  workspace_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  contacts_triggered: number;
  messages_sent: number;
  responses_received: number;
  success_rate: number;
};

// Follow-up tasks generated by Stay-in-Touch
export const stayInTouchTaskSchema = z.object({
  rule_id: z.string(),
  contact_id: z.string(),
  contact_name: z.string(),
  contact_email: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  
  days_since_last_contact: z.number(),
  last_interaction_type: z.string().optional().nullable(),
  last_interaction_date: z.string().optional().nullable(),
  
  action_type: z.enum(['send_email', 'send_linkedin', 'send_sms', 'create_task', 'notify_owner', 'sophia_draft']),
  channel: z.enum(['email', 'linkedin', 'sms', 'phone']).optional().nullable(),
  
  sophia_draft_subject: z.string().optional().nullable(),
  sophia_draft_message: z.string().optional().nullable(),
  sophia_confidence: z.number().min(0).max(100).default(85),
  sophia_reasoning: z.string().optional().nullable(),
  
  status: z.enum(['pending', 'approved', 'rejected', 'sent', 'completed', 'failed', 'snoozed']).default('pending'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  scheduled_for: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  
  followup_count: z.number().default(1), // Which follow-up attempt this is
  notes: z.string().optional().nullable(),
});

export type InsertStayInTouchTask = z.infer<typeof stayInTouchTaskSchema>;
export type StayInTouchTask = InsertStayInTouchTask & {
  id: string;
  workspace_id: string;
  created_at: string;
  updated_at: string;
};

// Contact engagement tracking for Stay-in-Touch
export const contactEngagementSchema = z.object({
  contact_id: z.string(),
  
  // Engagement metrics
  engagement_score: z.number().min(0).max(100).default(50),
  engagement_level: z.enum(['cold', 'cooling', 'warm', 'hot', 'champion']).default('warm'),
  
  // Interaction tracking
  total_interactions: z.number().default(0),
  email_interactions: z.number().default(0),
  linkedin_interactions: z.number().default(0),
  phone_interactions: z.number().default(0),
  meeting_interactions: z.number().default(0),
  
  // Timestamps
  first_interaction_date: z.string().optional().nullable(),
  last_interaction_date: z.string().optional().nullable(),
  last_outbound_date: z.string().optional().nullable(),
  last_inbound_date: z.string().optional().nullable(),
  
  // Response patterns
  avg_response_time_hours: z.number().optional().nullable(),
  response_rate: z.number().min(0).max(100).default(0),
  
  // Relationship health
  relationship_health: z.enum(['healthy', 'needs_attention', 'at_risk', 'lost']).default('healthy'),
  days_since_contact: z.number().default(0),
  recommended_action: z.string().optional().nullable(),
  
  // Sophia insights
  sophia_notes: z.string().optional().nullable(),
  sophia_next_best_action: z.string().optional().nullable(),
});

export type ContactEngagement = z.infer<typeof contactEngagementSchema> & {
  id: string;
  workspace_id: string;
  updated_at: string;
};

// ============================================
// USER LINKEDIN AUTOMATION SETTINGS
// ============================================

export const userLinkedInSettingsSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  
  // LinkedIn account info
  linkedin_email: z.string().email().optional().nullable(),
  linkedin_profile_url: z.string().url().optional().nullable(),
  linkedin_profile_name: z.string().optional().nullable(),
  linkedin_account_age_days: z.number().default(0), // Account age affects safe limits
  
  // Encrypted session (cookies/tokens - never plain password)
  session_data_encrypted: z.string().optional().nullable(),
  session_expires_at: z.string().optional().nullable(),
  session_status: z.enum(['active', 'expired', 'needs_verification', 'disconnected', 'paused_safety']).default('disconnected'),
  
  // Sticky Mobile Proxy Configuration (per-user)
  proxy_enabled: z.boolean().default(false),
  proxy_provider: z.enum(['bright_data', 'proxy_empire', 'oxylabs', 'smartproxy', 'custom']).optional().nullable(),
  proxy_host: z.string().optional().nullable(),
  proxy_port: z.number().optional().nullable(),
  proxy_username_encrypted: z.string().optional().nullable(),
  proxy_password_encrypted: z.string().optional().nullable(),
  sticky_session_id: z.string().optional().nullable(),
  current_ip: z.string().optional().nullable(),
  last_ip_rotation: z.string().optional().nullable(),
  
  // ============================================
  // COMPREHENSIVE SAFETY LIMITS
  // ============================================
  
  // Base daily limits (adjusted by warmup/account age)
  daily_connection_limit: z.number().min(0).max(100).default(25),
  daily_message_limit: z.number().min(0).max(100).default(50),
  connections_sent_today: z.number().default(0),
  messages_sent_today: z.number().default(0),
  last_activity_date: z.string().optional().nullable(),
  
  // HOURLY RATE LIMITING (spread actions throughout day)
  hourly_connection_limit: z.number().min(0).max(20).default(5),
  hourly_message_limit: z.number().min(0).max(20).default(8),
  connections_sent_this_hour: z.number().default(0),
  messages_sent_this_hour: z.number().default(0),
  current_hour_start: z.string().optional().nullable(),
  
  // 7-DAY WARMUP PROTOCOL
  is_warming_up: z.boolean().default(true),
  warmup_day: z.number().default(1), // Day 1-7 of warmup period
  warmup_started_at: z.string().optional().nullable(),
  warmup_completed_at: z.string().optional().nullable(),
  warmup_phase: z.enum(['day1_ultra_light', 'day2_light', 'day3_moderate', 'day4_building', 'day5_normal', 'day6_expanded', 'day7_full', 'completed']).default('day1_ultra_light'),
  
  // WARMUP OVERRIDE - User can bypass warmup limits with warning
  warmup_override_enabled: z.boolean().default(false), // If true, use manual limits instead of warmup schedule
  warmup_override_reason: z.string().optional().nullable(), // Why user overrode warmup
  warmup_override_at: z.string().optional().nullable(), // When override was enabled
  warmup_override_by: z.string().optional().nullable(), // User who enabled override
  
  // POST-WARMUP LIMIT PROFILES - Choose risk level after warmup completes
  // safe: Conservative limits, lowest risk of being flagged
  // moderate: Balanced limits (default after warmup)
  // aggressive: Higher output but elevated risk of restrictions
  post_warmup_profile: z.enum(['safe', 'moderate', 'aggressive']).default('moderate'),
  
  // ACCEPTANCE RATE MONITORING
  total_connections_sent: z.number().default(0),
  total_connections_accepted: z.number().default(0),
  acceptance_rate: z.number().min(0).max(100).default(0), // Percentage
  acceptance_rate_7day: z.number().min(0).max(100).default(0), // Rolling 7-day rate
  low_acceptance_warnings: z.number().default(0),
  paused_for_low_acceptance: z.boolean().default(false),
  acceptance_pause_until: z.string().optional().nullable(),
  
  // SMART SCHEDULING (business hours, weekend awareness)
  respect_business_hours: z.boolean().default(true),
  business_hours_start: z.number().min(0).max(23).default(9), // 9 AM
  business_hours_end: z.number().min(0).max(23).default(18), // 6 PM
  timezone: z.string().default('America/New_York'),
  reduce_weekend_activity: z.boolean().default(true),
  weekend_activity_percent: z.number().min(0).max(100).default(30), // 30% of normal
  
  // ACTIVITY RANDOMIZATION
  min_delay_between_actions_seconds: z.number().default(45),
  max_delay_between_actions_seconds: z.number().default(180),
  random_daily_start_offset_minutes: z.number().default(30), // Start time varies +/- 30 min
  random_break_probability: z.number().min(0).max(100).default(15), // 15% chance of random break
  random_break_duration_minutes: z.number().default(15),
  
  // ACCOUNT AGE-BASED LIMITS
  account_age_category: z.enum(['new', 'young', 'established', 'mature']).default('new'),
  // new: < 30 days, young: 30-90 days, established: 90-365 days, mature: > 365 days
  
  // SAFETY SCORE & HEALTH
  safety_score: z.number().min(0).max(100).default(100), // Overall account health
  risk_level: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
  consecutive_success_count: z.number().default(0),
  consecutive_failure_count: z.number().default(0),
  last_linkedin_warning: z.string().optional().nullable(),
  
  // AUTO-PAUSE TRIGGERS
  auto_pause_enabled: z.boolean().default(true),
  auto_pause_on_captcha: z.boolean().default(true),
  auto_pause_on_rate_limit: z.boolean().default(true),
  auto_pause_on_low_acceptance: z.boolean().default(true),
  auto_pause_acceptance_threshold: z.number().min(0).max(100).default(20), // Pause if below 20%
  
  // Status
  is_active: z.boolean().default(false),
  is_paused: z.boolean().default(false),
  pause_reason: z.string().optional().nullable(),
  pause_until: z.string().optional().nullable(),
  last_error: z.string().optional().nullable(),
  error_count: z.number().default(0),
  
  // Session metadata
  total_sessions: z.number().default(0),
  total_actions_lifetime: z.number().default(0),
  last_session_duration_minutes: z.number().default(0),
});

export type InsertUserLinkedInSettings = z.infer<typeof userLinkedInSettingsSchema>;
export type UserLinkedInSettings = InsertUserLinkedInSettings & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// LINKEDIN AUTOMATION ACTIVITY LOG
// ============================================

export const linkedInActivityLogSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  
  action_type: z.enum([
    'connection_request_sent',
    'connection_request_accepted',
    'message_sent',
    'message_received',
    'profile_viewed',
    'post_liked',
    'post_commented',
    'session_started',
    'session_ended',
    'error',
    'rate_limited'
  ]),
  
  target_profile_url: z.string().optional().nullable(),
  target_profile_name: z.string().optional().nullable(),
  message_preview: z.string().optional().nullable(), // First 100 chars
  
  proxy_ip_used: z.string().optional().nullable(),
  success: z.boolean().default(true),
  error_message: z.string().optional().nullable(),
  
  campaign_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
});

export type InsertLinkedInActivityLog = z.infer<typeof linkedInActivityLogSchema>;
export type LinkedInActivityLog = InsertLinkedInActivityLog & {
  id: string;
  created_at: string;
};

// ============================================
// LINKEDIN SCRAPED LEADS (Persisted)
// ============================================

export const linkedInScrapedLeadSchema = z.object({
  workspace_id: z.string().uuid(),
  profile_url: z.string(),
  name: z.string(),
  first_name: z.string().optional().nullable(),
  last_name: z.string().optional().nullable(),
  headline: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  connection_degree: z.string().optional().nullable(),
  mutual_connections: z.number().optional().nullable(),
  profile_image_url: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  email_confidence: z.number().optional().nullable(),
  email_verified: z.boolean().optional().nullable(),
  email_source: z.string().optional().nullable(),
  source_type: z.enum(['group', 'event', 'post_likers', 'post_commenters', 'search', 'url_import']),
  source_id: z.string().optional().nullable(),
  source_name: z.string().optional().nullable(),
  search_job_id: z.string().optional().nullable(),
  is_premium: z.boolean().default(false),
  is_open_to_work: z.boolean().default(false),
  enriched: z.boolean().default(false),
  enriched_at: z.string().optional().nullable(),
  saved_to_contacts: z.boolean().default(false),
  contact_id: z.string().uuid().optional().nullable(),
});

export type InsertLinkedInScrapedLead = z.infer<typeof linkedInScrapedLeadSchema>;
export type LinkedInScrapedLead = InsertLinkedInScrapedLead & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// LINKEDIN SEARCH JOBS (Persisted)
// ============================================

export const linkedInSearchJobSchema = z.object({
  workspace_id: z.string().uuid(),
  account_id: z.string().optional().nullable(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'rate_limited', 'cancelled']).default('pending'),
  search_criteria: z.record(z.any()).optional().nullable(),
  max_results: z.number().default(100),
  total_found: z.number().default(0),
  total_pulled: z.number().default(0),
  credits_used: z.number().default(0),
  progress: z.number().default(0),
  daily_limit_reached: z.boolean().default(false),
  error: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
});

export type InsertLinkedInSearchJob = z.infer<typeof linkedInSearchJobSchema>;
export type LinkedInSearchJob = InsertLinkedInSearchJob & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// SYSTEM PROXY POOL (Super Admin Managed)
// ============================================

export const systemProxySchema = z.object({
  provider: z.enum(['brightdata', 'smartproxy', 'oxylabs', 'iproyal', 'soax', 'other']),
  proxy_type: z.enum(['mobile', 'residential', 'datacenter']).default('mobile'),
  
  host: z.string().min(1, "Host is required"),
  port: z.number().int().positive(),
  username_encrypted: z.string().optional().nullable(),
  password_encrypted: z.string().optional().nullable(),
  
  // Sticky session configuration
  sticky_session_enabled: z.boolean().default(true),
  sticky_session_duration_minutes: z.number().default(30),
  
  // Health and status
  status: z.enum(['available', 'allocated', 'rotating', 'unhealthy', 'disabled']).default('available'),
  health_score: z.number().min(0).max(100).default(100),
  last_health_check: z.string().optional().nullable(),
  last_used_at: z.string().optional().nullable(),
  
  // Usage stats
  total_requests: z.number().default(0),
  failed_requests: z.number().default(0),
  avg_latency_ms: z.number().default(0),
  
  // Rotation settings
  auto_rotate: z.boolean().default(true),
  rotation_interval_hours: z.number().default(24),
  last_rotated_at: z.string().optional().nullable(),
  
  // Metadata
  label: z.string().optional().nullable(), // e.g., "US Mobile 1", "EU Residential 2"
  country_code: z.string().optional().nullable(), // ISO country code
  notes: z.string().optional().nullable(),
});

export type InsertSystemProxy = z.infer<typeof systemProxySchema>;
export type SystemProxy = InsertSystemProxy & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// PROXY ALLOCATIONS (Auto-assigned to users)
// ============================================

export const proxyAllocationSchema = z.object({
  proxy_id: z.string().uuid(),
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  
  // Allocation status
  status: z.enum(['active', 'pending', 'rotating', 'revoked']).default('pending'),
  allocated_at: z.string(),
  
  // Rotation tracking
  last_rotated_at: z.string().optional().nullable(),
  next_rotation_at: z.string().optional().nullable(),
  rotation_count: z.number().default(0),
  
  // Usage during allocation
  requests_count: z.number().default(0),
  last_used_at: z.string().optional().nullable(),
  
  // Session info
  current_session_id: z.string().optional().nullable(),
  current_ip: z.string().optional().nullable(),
});

export type InsertProxyAllocation = z.infer<typeof proxyAllocationSchema>;
export type ProxyAllocation = InsertProxyAllocation & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// PROXY AUDIT LOG
// ============================================

export const proxyAuditLogSchema = z.object({
  proxy_id: z.string().uuid().optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  
  action: z.enum([
    'proxy_added',
    'proxy_removed',
    'proxy_updated',
    'proxy_disabled',
    'proxy_enabled',
    'allocated_to_user',
    'revoked_from_user',
    'rotation_triggered',
    'health_check_failed',
    'health_check_passed'
  ]),
  
  details: z.string().optional().nullable(), // JSON details
  performed_by: z.string().uuid(), // Admin who performed action
  ip_address: z.string().optional().nullable(),
});

export type InsertProxyAuditLog = z.infer<typeof proxyAuditLogSchema>;
export type ProxyAuditLog = InsertProxyAuditLog & {
  id: string;
  created_at: string;
};

// ============================================
// LOOKUP CREDITS SYSTEM
// ============================================

// Site-level credit packages (managed by super admin)
export const creditPackageSchema = z.object({
  name: z.string().min(1),
  credits: z.number().int().positive(),
  price_cents: z.number().int().min(0), // 0 = free tier
  is_active: z.boolean().default(true),
  description: z.string().optional().nullable(),
});

export type InsertCreditPackage = z.infer<typeof creditPackageSchema>;
export type CreditPackage = InsertCreditPackage & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Workspace credit balance
export const workspaceCreditBalanceSchema = z.object({
  workspace_id: z.string().uuid(),
  
  // Credit balance
  total_credits: z.number().int().default(0),
  used_credits: z.number().int().default(0),
  reserved_credits: z.number().int().default(0), // For in-progress lookups
  
  // Daily allocation (auto-resets each day)
  daily_allocation: z.number().int().default(1000), // Daily credit allocation per workspace
  last_daily_reset: z.string().optional().nullable(), // Date string (YYYY-MM-DD) of last daily reset
  
  // Legacy monthly allocation (kept for backwards compatibility)
  monthly_allocation: z.number().int().default(1000),
  allocation_reset_date: z.string().optional().nullable(),
  
  // Limits
  max_credits: z.number().int().default(10000),
  low_balance_threshold: z.number().int().default(50),
  low_balance_notified: z.boolean().default(false),
});

export type InsertWorkspaceCreditBalance = z.infer<typeof workspaceCreditBalanceSchema>;
export type WorkspaceCreditBalance = InsertWorkspaceCreditBalance & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Credit transactions (audit log)
export const creditTransactionSchema = z.object({
  workspace_id: z.string().uuid(),
  
  // Transaction details
  type: z.enum([
    'allocation', // Monthly/initial allocation
    'purchase', // Admin purchased credits for workspace
    'usage', // Credit used for lookup
    'refund', // Credit refunded for failed lookup
    'adjustment', // Manual admin adjustment
    'expiration' // Credits expired
  ]),
  
  amount: z.number().int(), // Positive or negative
  balance_after: z.number().int(),
  
  // Context
  description: z.string().optional().nullable(),
  lookup_type: z.enum(['email', 'phone', 'company', 'linkedin', 'enrichment']).optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  performed_by: z.string().uuid().optional().nullable(), // Admin for adjustments
  
  // Reference
  package_id: z.string().uuid().optional().nullable(), // For purchases
  external_reference: z.string().optional().nullable(), // Payment reference
});

export type InsertCreditTransaction = z.infer<typeof creditTransactionSchema>;
export type CreditTransaction = InsertCreditTransaction & {
  id: string;
  created_at: string;
};

// Site-level credit purchases (super admin managed)
export const siteCreditPurchaseSchema = z.object({
  workspace_id: z.string().uuid(),
  package_id: z.string().uuid(),
  
  // Purchase details
  credits_purchased: z.number().int().positive(),
  amount_paid_cents: z.number().int().min(0),
  
  // Status
  status: z.enum(['pending', 'completed', 'failed', 'refunded']).default('pending'),
  
  // Admin info
  approved_by: z.string().uuid().optional().nullable(),
  approved_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type InsertSiteCreditPurchase = z.infer<typeof siteCreditPurchaseSchema>;
export type SiteCreditPurchase = InsertSiteCreditPurchase & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Lookup usage tracking (per workspace)
export const lookupUsageSchema = z.object({
  workspace_id: z.string().uuid(),
  
  // Lookup details
  lookup_type: z.enum(['email', 'phone', 'company', 'linkedin', 'enrichment']),
  provider: z.string(), // hunter.io, apollo, etc.
  
  // Input/Output
  input_data: z.string(), // JSON of lookup input
  result_data: z.string().optional().nullable(), // JSON of result (if successful)
  
  // Status
  status: z.enum(['pending', 'success', 'failed', 'cached']).default('pending'),
  credits_used: z.number().int().default(1),
  
  // Context
  contact_id: z.string().uuid().optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  
  // Performance
  response_time_ms: z.number().int().optional().nullable(),
  error_message: z.string().optional().nullable(),
});

export type InsertLookupUsage = z.infer<typeof lookupUsageSchema>;
export type LookupUsage = InsertLookupUsage & {
  id: string;
  created_at: string;
};

// ============================================
// CAMPAIGN EXECUTION - SCHEDULED STEPS
// ============================================

export const campaignScheduledStepSchema = z.object({
  campaign_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  
  // Step details
  step_index: z.number().int().min(0),
  channel: z.enum(['email', 'linkedin', 'linkedin_message', 'linkedin_connection', 'sms', 'phone', 'voicemail']),
  subject: z.string().optional().nullable(),
  content: z.string(),
  
  // Scheduling
  scheduled_at: z.string(), // ISO timestamp when to execute
  
  // Execution status
  status: z.enum(['pending', 'approved', 'executing', 'sent', 'failed', 'cancelled', 'requires_approval']).default('pending'),
  
  // Autonomy tracking
  requires_approval: z.boolean().default(false),
  approved_by: z.string().uuid().optional().nullable(),
  approved_at: z.string().optional().nullable(),
  
  // Execution results
  executed_at: z.string().optional().nullable(),
  message_id: z.string().optional().nullable(),
  error_message: z.string().optional().nullable(),
  
  // Metadata
  personalization_data: z.record(z.any()).optional().nullable(),
});

export type InsertCampaignScheduledStep = z.infer<typeof campaignScheduledStepSchema>;
export type CampaignScheduledStep = InsertCampaignScheduledStep & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// SOPHIA APPROVAL QUEUE
// ============================================

export const sophiaApprovalItemSchema = z.object({
  workspace_id: z.string().uuid().optional().nullable(),
  user_id: z.string().uuid().optional().nullable(),
  
  // What needs approval
  action_type: z.enum(['campaign_step', 'auto_reply', 'meeting_booking', 'lead_action', 'social_post']),
  action_data: z.record(z.any()), // JSON with action-specific data
  
  // Context
  campaign_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  scheduled_step_id: z.string().uuid().optional().nullable(),
  
  // Sophia's reasoning
  sophia_confidence: z.number().min(0).max(100).optional().nullable(),
  sophia_reasoning: z.string().optional().nullable(),
  
  // Preview
  preview_subject: z.string().optional().nullable(),
  preview_content: z.string().optional().nullable(),
  preview_recipient: z.string().optional().nullable(),
  
  // Status
  status: z.enum(['pending', 'approved', 'rejected', 'expired', 'auto_approved']).default('pending'),
  
  // Resolution
  resolved_by: z.string().uuid().optional().nullable(),
  resolved_at: z.string().optional().nullable(),
  resolution_notes: z.string().optional().nullable(),
  
  // Expiry (auto-expire old items)
  expires_at: z.string().optional().nullable(),
});

export type InsertSophiaApprovalItem = z.infer<typeof sophiaApprovalItemSchema>;
export type SophiaApprovalItem = InsertSophiaApprovalItem & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// CAMPAIGN EXECUTION LOG
// ============================================

export const campaignExecutionLogSchema = z.object({
  campaign_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  
  // Execution details
  execution_type: z.enum(['full_run', 'single_step', 'batch', 'retry']),
  status: z.enum(['started', 'in_progress', 'completed', 'failed', 'cancelled']),
  
  // Stats
  total_steps: z.number().int().min(0).default(0),
  completed_steps: z.number().int().min(0).default(0),
  failed_steps: z.number().int().min(0).default(0),
  pending_approval_steps: z.number().int().min(0).default(0),
  
  // Timing
  started_at: z.string(),
  completed_at: z.string().optional().nullable(),
  
  // Error info
  error_message: z.string().optional().nullable(),
  
  // Autonomy context
  autonomy_level_used: z.enum(['manual_approval', 'semi_autonomous', 'fully_autonomous']).optional().nullable(),
});

export type InsertCampaignExecutionLog = z.infer<typeof campaignExecutionLogSchema>;
export type CampaignExecutionLog = InsertCampaignExecutionLog & {
  id: string;
  created_at: string;
};

// ============================================
// SOPHIA MEMORY SYSTEM
// ============================================

// Conversation sessions
export const sophiaConversationSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  title: z.string().optional().nullable(), // Auto-generated from first message
  context: z.string().optional().nullable(), // Page context when started
  summary: z.string().optional().nullable(), // AI-generated summary
  message_count: z.number().int().default(0),
  last_message_at: z.string().optional().nullable(),
  is_archived: z.boolean().default(false),
});

export type InsertSophiaConversation = z.infer<typeof sophiaConversationSchema>;
export type SophiaConversation = InsertSophiaConversation & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Individual messages within conversations
export const sophiaMessageSchema = z.object({
  conversation_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  
  // Context enrichment
  context_page: z.string().optional().nullable(), // What page user was on
  contact_id: z.string().uuid().optional().nullable(), // If discussing a contact
  campaign_id: z.string().uuid().optional().nullable(), // If discussing a campaign
  
  // AI metadata
  model_used: z.string().optional().nullable(), // 'gpt-4o' | 'claude-sonnet'
  tokens_used: z.number().int().optional().nullable(),
  confidence_score: z.number().optional().nullable(),
  
  // Response quality tracking
  was_helpful: z.boolean().optional().nullable(), // User feedback
  feedback_notes: z.string().optional().nullable(),
});

export type InsertSophiaMessage = z.infer<typeof sophiaMessageSchema>;
export type SophiaMessage = InsertSophiaMessage & {
  id: string;
  created_at: string;
};

// Learned facts and user preferences
export const sophiaMemorySchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  
  // What Sophia learned
  memory_type: z.enum([
    'preference', // User prefers X over Y
    'fact', // User works at X, manages Y contacts
    'pattern', // User often asks about X in morning
    'skill_level', // User is advanced/beginner in X
    'communication_style', // User prefers brief/detailed responses
    'goal', // User's stated goals
    'context' // General context about user's work
  ]),
  
  category: z.string(), // e.g., 'campaigns', 'contacts', 'scheduling'
  key: z.string(), // What this memory is about
  value: z.string(), // The learned information
  
  // How confident Sophia is in this memory
  confidence: z.number().min(0).max(100).default(70),
  
  // Source tracking
  source_conversation_id: z.string().uuid().optional().nullable(),
  source_message_id: z.string().uuid().optional().nullable(),
  
  // Validity
  is_active: z.boolean().default(true),
  expires_at: z.string().optional().nullable(),
  last_validated_at: z.string().optional().nullable(),
});

export type InsertSophiaMemory = z.infer<typeof sophiaMemorySchema>;
export type SophiaMemory = InsertSophiaMemory & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Contact-specific memories
export const sophiaContactMemorySchema = z.object({
  user_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  
  // What Sophia knows about this contact
  memory_type: z.enum([
    'preference', // Contact prefers email over LinkedIn
    'interaction', // Last discussed on X date
    'insight', // Contact mentioned Y in conversation
    'timing', // Best time to reach contact
    'sentiment', // Contact's sentiment trend
    'relationship', // User's relationship with contact
    'next_action' // Suggested next action
  ]),
  
  key: z.string(),
  value: z.string(),
  
  confidence: z.number().min(0).max(100).default(70),
  is_active: z.boolean().default(true),
  
  // Source
  source_type: z.enum(['conversation', 'email', 'campaign', 'manual']).optional().nullable(),
  source_id: z.string().uuid().optional().nullable(),
});

export type InsertSophiaContactMemory = z.infer<typeof sophiaContactMemorySchema>;
export type SophiaContactMemory = InsertSophiaContactMemory & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// SOPHIA EMAIL AUTOMATION SYSTEM
// ============================================

// Email Thread Tracking - tracks conversation threads
export const emailThreadSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  thread_id: z.string(), // Email thread/conversation ID from email provider
  subject: z.string(),
  participants: z.array(z.string()).default([]), // Email addresses
  contact_id: z.string().uuid().optional().nullable(), // Linked contact if known
  message_count: z.number().int().default(1),
  last_message_at: z.string(),
  first_message_at: z.string(),
  
  // Thread state
  status: z.enum(['active', 'awaiting_reply', 'needs_follow_up', 'resolved', 'stale']).default('active'),
  our_last_reply_at: z.string().optional().nullable(),
  their_last_reply_at: z.string().optional().nullable(),
  
  // AI Analysis
  thread_summary: z.string().optional().nullable(),
  current_intent: z.string().optional().nullable(), // Current conversation intent
  sentiment_trend: z.enum(['improving', 'stable', 'declining']).optional().nullable(),
  urgency: z.enum(['high', 'medium', 'low']).optional().nullable(),
  
  // Follow-up tracking
  follow_up_due: z.string().optional().nullable(),
  auto_follow_up_enabled: z.boolean().default(false),
  follow_up_count: z.number().int().default(0),
  
  // Negotiation/Deal tracking
  is_negotiation: z.boolean().default(false),
  negotiation_stage: z.enum(['initial', 'discussing', 'objections', 'closing', 'won', 'lost']).optional().nullable(),
  deal_id: z.string().uuid().optional().nullable(),
});

export type InsertEmailThread = z.infer<typeof emailThreadSchema>;
export type EmailThread = InsertEmailThread & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Sender Profile/Dossier - tracks information about email senders
export const senderProfileSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  email_address: z.string().email(),
  contact_id: z.string().uuid().optional().nullable(),
  
  // Sender info
  display_name: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  job_title: z.string().optional().nullable(),
  
  // Interaction stats
  emails_received: z.number().int().default(0),
  emails_sent: z.number().int().default(0),
  avg_response_time_hours: z.number().optional().nullable(),
  first_contact_at: z.string(),
  last_contact_at: z.string(),
  
  // Behavioral patterns
  typical_response_days: z.array(z.string()).default([]), // ['Monday', 'Wednesday']
  typical_response_hours: z.array(z.number()).default([]), // [9, 10, 14, 15]
  preferred_communication_style: z.enum(['formal', 'casual', 'brief', 'detailed']).optional().nullable(),
  
  // Relationship
  relationship_strength: z.enum(['new', 'developing', 'established', 'strong']).default('new'),
  sentiment_history: z.array(z.object({
    date: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
  })).default([]),
  
  // AI insights
  personality_notes: z.string().optional().nullable(),
  communication_preferences: z.string().optional().nullable(),
  key_topics: z.array(z.string()).default([]),
  
  // VIP/Priority
  is_vip: z.boolean().default(false),
  priority_level: z.enum(['normal', 'high', 'critical']).default('normal'),
});

export type InsertSenderProfile = z.infer<typeof senderProfileSchema>;
export type SenderProfile = InsertSenderProfile & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Email Follow-up Reminders
export const emailFollowUpSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  email_id: z.string(), // Original email ID
  thread_id: z.string().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  
  // Follow-up details
  reminder_type: z.enum(['no_response', 'check_in', 'meeting_follow_up', 'quote_follow_up', 'custom']),
  due_at: z.string(),
  status: z.enum(['pending', 'sent', 'snoozed', 'completed', 'cancelled']).default('pending'),
  
  // Auto-action
  auto_send: z.boolean().default(false),
  suggested_message: z.string().optional().nullable(),
  escalation_level: z.number().int().default(1), // 1st, 2nd, 3rd follow-up
  
  // Snooze functionality
  snoozed_until: z.string().optional().nullable(),
  snooze_count: z.number().int().default(0),
});

export type InsertEmailFollowUp = z.infer<typeof emailFollowUpSchema>;
export type EmailFollowUp = InsertEmailFollowUp & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Email Draft Feedback - learns from user corrections
export const emailDraftFeedbackSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  
  // Original draft
  original_draft: z.string(),
  original_subject: z.string().optional().nullable(),
  original_intent: z.string().optional().nullable(),
  
  // User's correction
  final_version: z.string(),
  final_subject: z.string().optional().nullable(),
  
  // Feedback type
  feedback_type: z.enum(['approved', 'edited', 'rejected']),
  edit_distance: z.number().optional().nullable(), // How much was changed (0-100%)
  
  // What was changed
  changes_made: z.array(z.object({
    type: z.enum(['tone', 'length', 'formality', 'content', 'structure', 'greeting', 'closing']),
    description: z.string(),
  })).default([]),
  
  // Context
  recipient_email: z.string().optional().nullable(),
  email_type: z.string().optional().nullable(),
  
  // Learning applied
  learning_extracted: z.string().optional().nullable(),
});

export type InsertEmailDraftFeedback = z.infer<typeof emailDraftFeedbackSchema>;
export type EmailDraftFeedback = InsertEmailDraftFeedback & {
  id: string;
  created_at: string;
};

// User Email Preferences - stores learned preferences
export const userEmailPreferencesSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  
  // Tone preferences
  preferred_tone: z.enum(['formal', 'professional', 'friendly', 'casual']).default('professional'),
  preferred_length: z.enum(['brief', 'moderate', 'detailed']).default('moderate'),
  preferred_greeting_style: z.string().optional().nullable(),
  preferred_closing_style: z.string().optional().nullable(),
  signature: z.string().optional().nullable(),
  
  // Response patterns
  typical_response_time_hours: z.number().optional().nullable(),
  working_hours_start: z.number().default(9), // 9 AM
  working_hours_end: z.number().default(17), // 5 PM
  working_days: z.array(z.string()).default(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  timezone: z.string().default('America/New_York'),
  
  // Auto-response rules
  auto_response_enabled: z.boolean().default(false),
  out_of_office_message: z.string().optional().nullable(),
  vacation_mode: z.boolean().default(false),
  
  // Follow-up defaults
  default_follow_up_days: z.number().int().default(3),
  max_follow_ups: z.number().int().default(3),
  
  // Brand voice
  brand_voice_description: z.string().optional().nullable(),
  avoid_words: z.array(z.string()).default([]),
  preferred_phrases: z.array(z.string()).default([]),
});

export type InsertUserEmailPreferences = z.infer<typeof userEmailPreferencesSchema>;
export type UserEmailPreferences = InsertUserEmailPreferences & {
  id: string;
  created_at: string;
  updated_at: string;
};

// Proactive Email Insights
export const emailInsightSchema = z.object({
  user_id: z.string().uuid(),
  workspace_id: z.string().uuid().optional().nullable(),
  
  insight_type: z.enum([
    'cold_lead', // Lead went cold
    'frustrated_customer', // Detected frustration
    'hot_prospect', // High engagement detected
    'stale_thread', // No response in X days
    'meeting_conflict', // Calendar conflict
    'follow_up_overdue', // Missed follow-up
    'vip_waiting', // VIP hasn't been responded to
    'sentiment_drop', // Sentiment declining
    'opportunity', // Detected opportunity
    'risk', // Detected risk
  ]),
  
  title: z.string(),
  description: z.string(),
  severity: z.enum(['info', 'warning', 'urgent']).default('info'),
  
  // Related entities
  email_id: z.string().optional().nullable(),
  thread_id: z.string().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  sender_email: z.string().optional().nullable(),
  
  // Suggested action
  suggested_action: z.string().optional().nullable(),
  action_type: z.enum(['reply', 'follow_up', 'call', 'meeting', 'escalate', 'archive', 'none']).optional().nullable(),
  
  // Status
  status: z.enum(['new', 'viewed', 'actioned', 'dismissed']).default('new'),
  actioned_at: z.string().optional().nullable(),
});

export type InsertEmailInsight = z.infer<typeof emailInsightSchema>;
export type EmailInsight = InsertEmailInsight & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ============================================
// SOPHIA CAMPAIGN MATCHER - Autonomous Lead Assignment
// ============================================

export const sophiaCampaignMatchSchema = z.object({
  workspace_id: z.string().uuid(),
  lead_contact_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  
  match_score: z.number().min(0).max(100),
  rationale: z.string(),
  
  match_factors: z.object({
    job_title_match: z.number().min(0).max(100).optional(),
    industry_match: z.number().min(0).max(100).optional(),
    company_size_match: z.number().min(0).max(100).optional(),
    location_match: z.number().min(0).max(100).optional(),
    engagement_potential: z.number().min(0).max(100).optional(),
  }).optional().nullable(),
  
  autonomy_mode: z.enum(['manual_approval', 'semi_autonomous', 'fully_autonomous']),
  status: z.enum(['pending', 'approved', 'rejected', 'auto_applied', 'expired']).default('pending'),
  
  approved_by: z.string().uuid().optional().nullable(),
  rejected_reason: z.string().optional().nullable(),
  applied_at: z.string().optional().nullable(),
});

export type InsertSophiaCampaignMatch = z.infer<typeof sophiaCampaignMatchSchema>;
export type SophiaCampaignMatch = InsertSophiaCampaignMatch & {
  id: string;
  created_at: string;
  updated_at: string;
};

export const sophiaCampaignAssignmentLogSchema = z.object({
  workspace_id: z.string().uuid(),
  match_id: z.string().uuid().optional().nullable(),
  lead_contact_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  
  action: z.enum(['suggested', 'auto_assigned', 'approved', 'rejected', 'overridden', 'removed']),
  performed_by: z.enum(['sophia', 'user']),
  user_id: z.string().uuid().optional().nullable(),
  
  previous_status: z.string().optional().nullable(),
  new_status: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  
  confidence_at_action: z.number().min(0).max(100).optional().nullable(),
});

export type InsertSophiaCampaignAssignmentLog = z.infer<typeof sophiaCampaignAssignmentLogSchema>;
export type SophiaCampaignAssignmentLog = InsertSophiaCampaignAssignmentLog & {
  id: string;
  created_at: string;
};

export const sophiaAutonomySettingsSchema = z.object({
  workspace_id: z.string().uuid(),
  
  campaign_assignment_mode: z.enum(['manual_approval', 'semi_autonomous', 'fully_autonomous']).default('manual_approval'),
  min_confidence_for_auto: z.number().min(0).max(100).default(75),
  
  enabled_channels: z.object({
    email: z.boolean().default(true),
    linkedin: z.boolean().default(true),
    sms: z.boolean().default(false),
    phone: z.boolean().default(false),
  }).optional().nullable(),
  
  notify_on_auto_assign: z.boolean().default(true),
  max_auto_assigns_per_day: z.number().int().default(50),
  
  learning_enabled: z.boolean().default(true),
});

export type InsertSophiaAutonomySettings = z.infer<typeof sophiaAutonomySettingsSchema>;
export type SophiaAutonomySettings = InsertSophiaAutonomySettings & {
  id: string;
  created_at: string;
  updated_at: string;
};
