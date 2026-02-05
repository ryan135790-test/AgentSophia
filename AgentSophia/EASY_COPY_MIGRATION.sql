-- Copy everything below this line (including this comment) --
-- ============================================
-- AGENT SOPHIA - AI SDR TABLES
-- ============================================

-- Create agent_configs table for Agent Sophia configuration
CREATE TABLE IF NOT EXISTS public.agent_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  autonomy_level TEXT NOT NULL DEFAULT 'semi_autonomous' CHECK (autonomy_level IN ('manual', 'semi_autonomous', 'fully_autonomous')),
  working_hours JSONB NOT NULL DEFAULT '{
    "timezone": "America/New_York",
    "start_time": "09:00",
    "end_time": "17:00",
    "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
  }'::jsonb,
  daily_limits JSONB NOT NULL DEFAULT '{
    "max_messages_per_day": 100,
    "max_follow_ups_per_contact": 5,
    "enable_gradual_warmup": true
  }'::jsonb,
  decision_criteria JSONB NOT NULL DEFAULT '{
    "min_lead_score": 50,
    "max_follow_ups": 5,
    "auto_respond_intents": ["interested", "question"],
    "auto_book_meeting_intents": ["meeting_request", "interested"],
    "escalate_to_human_intents": ["objection", "complex_question"]
  }'::jsonb,
  meeting_booking JSONB NOT NULL DEFAULT '{
    "enabled": false,
    "calendar_link": "",
    "auto_book_qualified_leads": true
  }'::jsonb,
  personalization_settings JSONB NOT NULL DEFAULT '{
    "tone": "professional",
    "include_sender_name": true,
    "signature": ""
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create agent_activities table for activity logging
CREATE TABLE IF NOT EXISTS public.agent_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'prospecting',
    'outreach_sent',
    'follow_up_sent',
    'response_analyzed',
    'meeting_scheduled',
    'escalated_to_human',
    'lead_qualified',
    'lead_disqualified'
  )),
  channel TEXT CHECK (channel IN ('linkedin', 'email', 'sms', 'phone', 'social', 'voicemail')),
  action_taken TEXT NOT NULL,
  message_content TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('success', 'failed', 'pending')),
  outcome_details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create agent_decisions table for AI decision logging
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  response_id UUID REFERENCES public.campaign_responses(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'send_follow_up',
    'schedule_meeting',
    'escalate_to_human',
    'disqualify_lead',
    'continue_nurture',
    'pause_outreach'
  )),
  reasoning TEXT NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  input_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_action TEXT NOT NULL,
  human_override BOOLEAN NOT NULL DEFAULT FALSE,
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_agent_configs_user_id ON public.agent_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_configs_is_active ON public.agent_configs(is_active);

CREATE INDEX IF NOT EXISTS idx_agent_activities_user_id ON public.agent_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_contact_id ON public.agent_activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_campaign_id ON public.agent_activities(campaign_id);
CREATE INDEX IF NOT EXISTS idx_agent_activities_type ON public.agent_activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_agent_activities_outcome ON public.agent_activities(outcome);
CREATE INDEX IF NOT EXISTS idx_agent_activities_created_at ON public.agent_activities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_user_id ON public.agent_decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_contact_id ON public.agent_decisions(contact_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_response_id ON public.agent_decisions(response_id);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_decision_type ON public.agent_decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_agent_decisions_created_at ON public.agent_decisions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_configs
CREATE POLICY "Users can view their own agent config"
  ON public.agent_configs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agent config"
  ON public.agent_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent config"
  ON public.agent_configs
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agent config"
  ON public.agent_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for agent_activities
CREATE POLICY "Users can view their own agent activities"
  ON public.agent_activities
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agent activities"
  ON public.agent_activities
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for agent_decisions
CREATE POLICY "Users can view their own agent decisions"
  ON public.agent_decisions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own agent decisions"
  ON public.agent_decisions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent decisions"
  ON public.agent_decisions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates on agent_configs
DROP TRIGGER IF EXISTS update_agent_configs_updated_at ON public.agent_configs;
CREATE TRIGGER update_agent_configs_updated_at
  BEFORE UPDATE ON public.agent_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
