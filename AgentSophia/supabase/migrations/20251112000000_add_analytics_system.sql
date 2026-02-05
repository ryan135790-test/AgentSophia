-- ============================================
-- ANALYTICS & INSIGHTS SYSTEM
-- ============================================

-- Email Event Tracking (opens, clicks, bounces)
CREATE TABLE IF NOT EXISTS email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  email_subject TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'replied', 'unsubscribed')),
  event_data JSONB DEFAULT '{}'::jsonb,
  link_url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_email_events_user ON email_events(user_id);
CREATE INDEX idx_email_events_contact ON email_events(contact_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);
CREATE INDEX idx_email_events_created ON email_events(created_at DESC);

-- Lead Scoring System
CREATE TABLE IF NOT EXISTS lead_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  score_breakdown JSONB DEFAULT '{}'::jsonb,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

CREATE INDEX idx_lead_scores_user ON lead_scores(user_id);
CREATE INDEX idx_lead_scores_contact ON lead_scores(contact_id);
CREATE INDEX idx_lead_scores_score ON lead_scores(score DESC);

-- Pipeline Stages
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  automation_rules JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_pipeline_stages_user ON pipeline_stages(user_id);
CREATE INDEX idx_pipeline_stages_order ON pipeline_stages(order_index);

-- Contact Pipeline History
CREATE TABLE IF NOT EXISTS contact_pipeline_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  reason TEXT,
  automated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contact_pipeline_user ON contact_pipeline_history(user_id);
CREATE INDEX idx_contact_pipeline_contact ON contact_pipeline_history(contact_id);
CREATE INDEX idx_contact_pipeline_created ON contact_pipeline_history(created_at DESC);

-- Best Practices Analytics
CREATE TABLE IF NOT EXISTS best_practices_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('send_time', 'subject_line', 'message_length', 'follow_up_timing', 'day_of_week')),
  metric_value TEXT NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  avg_response_time_hours NUMERIC,
  avg_conversion_rate NUMERIC,
  sample_size INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, metric_type, metric_value)
);

CREATE INDEX idx_best_practices_user ON best_practices_data(user_id);
CREATE INDEX idx_best_practices_type ON best_practices_data(metric_type);

-- AI Sequence Campaigns
CREATE TABLE IF NOT EXISTS ai_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  enrollment_count INTEGER DEFAULT 0,
  active_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  goal_type TEXT,
  goal_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_sequences_user ON ai_sequences(user_id);
CREATE INDEX idx_ai_sequences_status ON ai_sequences(status);

-- Sequence Enrollments
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sequence_id UUID NOT NULL REFERENCES ai_sequences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  current_step INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'exited')),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  exit_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  UNIQUE(sequence_id, contact_id)
);

CREATE INDEX idx_sequence_enrollments_user ON sequence_enrollments(user_id);
CREATE INDEX idx_sequence_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_sequence_enrollments_contact ON sequence_enrollments(contact_id);
CREATE INDEX idx_sequence_enrollments_status ON sequence_enrollments(status);

-- Contact Enrichment Data
CREATE TABLE IF NOT EXISTS contact_enrichment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  enrichment_source TEXT NOT NULL CHECK (enrichment_source IN ('linkedin', 'clearbit', 'hunter', 'manual', 'ai_generated')),
  enrichment_data JSONB DEFAULT '{}'::jsonb,
  confidence_score NUMERIC DEFAULT 0,
  enriched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contact_id, enrichment_source)
);

CREATE INDEX idx_contact_enrichment_user ON contact_enrichment(user_id);
CREATE INDEX idx_contact_enrichment_contact ON contact_enrichment(contact_id);
CREATE INDEX idx_contact_enrichment_source ON contact_enrichment(enrichment_source);

-- Duplicate Contacts Detection
CREATE TABLE IF NOT EXISTS duplicate_contact_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_ids UUID[] NOT NULL,
  similarity_score NUMERIC NOT NULL,
  merge_suggestions JSONB DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'dismissed')),
  merged_into_contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_duplicate_groups_user ON duplicate_contact_groups(user_id);
CREATE INDEX idx_duplicate_groups_status ON duplicate_contact_groups(status);

-- Slack Notifications Queue
CREATE TABLE IF NOT EXISTS slack_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('high_priority_reply', 'meeting_booked', 'hot_lead', 'goal_achieved', 'error_alert')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  related_contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_slack_notifications_user ON slack_notifications(user_id);
CREATE INDEX idx_slack_notifications_status ON slack_notifications(status);
CREATE INDEX idx_slack_notifications_urgency ON slack_notifications(urgency);

-- ROI Tracking
CREATE TABLE IF NOT EXISTS roi_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  total_emails_sent INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  total_meetings_booked INTEGER DEFAULT 0,
  total_deals_created INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  time_saved_hours NUMERIC DEFAULT 0,
  automation_rate NUMERIC DEFAULT 0,
  avg_response_time_hours NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, metric_date)
);

CREATE INDEX idx_roi_metrics_user ON roi_metrics(user_id);
CREATE INDEX idx_roi_metrics_date ON roi_metrics(metric_date DESC);

-- Enable Row Level Security
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_pipeline_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practices_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_enrichment ENABLE ROW LEVEL SECURITY;
ALTER TABLE duplicate_contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE roi_metrics ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies
CREATE POLICY "Users can manage their own email events"
  ON email_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own lead scores"
  ON lead_scores FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own pipeline stages"
  ON pipeline_stages FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own pipeline history"
  ON contact_pipeline_history FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own best practices data"
  ON best_practices_data FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sequences"
  ON ai_sequences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sequence enrollments"
  ON sequence_enrollments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own contact enrichment"
  ON contact_enrichment FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own duplicate groups"
  ON duplicate_contact_groups FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own slack notifications"
  ON slack_notifications FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own ROI metrics"
  ON roi_metrics FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Insert default pipeline stages for all existing users (with deduplication)
INSERT INTO pipeline_stages (user_id, name, description, order_index, color)
SELECT 
  id,
  'New Lead',
  'Newly identified prospects',
  1,
  '#3b82f6'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages WHERE pipeline_stages.user_id = auth.users.id AND pipeline_stages.name = 'New Lead'
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (user_id, name, description, order_index, color)
SELECT 
  id,
  'Contacted',
  'Initial outreach sent',
  2,
  '#8b5cf6'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages WHERE pipeline_stages.user_id = auth.users.id AND pipeline_stages.name = 'Contacted'
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (user_id, name, description, order_index, color)
SELECT 
  id,
  'Engaged',
  'Actively communicating',
  3,
  '#f59e0b'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages WHERE pipeline_stages.user_id = auth.users.id AND pipeline_stages.name = 'Engaged'
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (user_id, name, description, order_index, color)
SELECT 
  id,
  'Meeting Scheduled',
  'Meeting on calendar',
  4,
  '#10b981'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages WHERE pipeline_stages.user_id = auth.users.id AND pipeline_stages.name = 'Meeting Scheduled'
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (user_id, name, description, order_index, color)
SELECT 
  id,
  'Qualified',
  'Ready for sales',
  5,
  '#059669'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages WHERE pipeline_stages.user_id = auth.users.id AND pipeline_stages.name = 'Qualified'
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (user_id, name, description, order_index, color)
SELECT 
  id,
  'Closed Won',
  'Deal completed',
  6,
  '#22c55e'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages WHERE pipeline_stages.user_id = auth.users.id AND pipeline_stages.name = 'Closed Won'
)
ON CONFLICT DO NOTHING;

INSERT INTO pipeline_stages (user_id, name, description, order_index, color)
SELECT 
  id,
  'Closed Lost',
  'Opportunity lost',
  7,
  '#ef4444'
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages WHERE pipeline_stages.user_id = auth.users.id AND pipeline_stages.name = 'Closed Lost'
)
ON CONFLICT DO NOTHING;
