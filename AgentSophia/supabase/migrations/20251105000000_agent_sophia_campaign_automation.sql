-- ============================================
-- AGENT SOPHIA - CAMPAIGN AUTOMATION PHASE 1 + 2
-- ============================================

-- Add Sophia tracking columns to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS created_by_sophia BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sophia_metadata JSONB DEFAULT '{}'::jsonb;

-- Create sophia_campaign_rules table for automation rules
CREATE TABLE IF NOT EXISTS public.sophia_campaign_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Trigger conditions
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'new_qualified_leads',
    'lead_segment_match',
    'scheduled_time',
    'manual_trigger'
  )),
  trigger_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Campaign settings
  campaign_template JSONB NOT NULL DEFAULT '{
    "name_template": "Auto Campaign {date}",
    "type": "multi-channel",
    "channels": ["email", "linkedin"],
    "messaging_strategy": "value-first"
  }'::jsonb,
  
  -- Channel selection logic
  channel_priority JSONB NOT NULL DEFAULT '["email", "linkedin", "sms"]'::jsonb,
  
  -- Lead segmentation
  target_criteria JSONB NOT NULL DEFAULT '{
    "min_lead_score": 50,
    "required_fields": ["email"],
    "excluded_tags": [],
    "industry_match": []
  }'::jsonb,
  
  -- Execution limits
  daily_campaign_limit INT DEFAULT 3,
  max_leads_per_campaign INT DEFAULT 100,
  
  -- Metadata
  last_executed_at TIMESTAMPTZ,
  execution_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, rule_name)
);

-- Create sophia_sent_messages table for tracking sent messages
CREATE TABLE IF NOT EXISTS public.sophia_sent_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  
  -- Message details
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'sms', 'phone', 'social', 'voicemail')),
  message_type TEXT NOT NULL CHECK (message_type IN ('initial_outreach', 'follow_up', 'meeting_request', 'breakup')),
  subject TEXT,
  message_content TEXT NOT NULL,
  
  -- Sending status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  failed_reason TEXT,
  
  -- Provider details
  provider TEXT, -- gmail, sendgrid, twilio, etc.
  provider_message_id TEXT, -- External ID from provider
  
  -- Response tracking
  was_opened BOOLEAN DEFAULT FALSE,
  was_clicked BOOLEAN DEFAULT FALSE,
  was_replied BOOLEAN DEFAULT FALSE,
  replied_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_sophia ON public.campaigns(created_by_sophia, user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_sophia_metadata ON public.campaigns USING gin(sophia_metadata);

CREATE INDEX IF NOT EXISTS idx_sophia_campaign_rules_user ON public.sophia_campaign_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_sophia_campaign_rules_active ON public.sophia_campaign_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_sophia_campaign_rules_trigger ON public.sophia_campaign_rules(trigger_type);

CREATE INDEX IF NOT EXISTS idx_sophia_sent_messages_user ON public.sophia_sent_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_sophia_sent_messages_contact ON public.sophia_sent_messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_sophia_sent_messages_campaign ON public.sophia_sent_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sophia_sent_messages_channel ON public.sophia_sent_messages(channel);
CREATE INDEX IF NOT EXISTS idx_sophia_sent_messages_status ON public.sophia_sent_messages(status);
CREATE INDEX IF NOT EXISTS idx_sophia_sent_messages_sent_at ON public.sophia_sent_messages(sent_at DESC);

-- Enable Row Level Security
ALTER TABLE public.sophia_campaign_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sophia_sent_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sophia_campaign_rules
CREATE POLICY "Users can view their own campaign rules"
  ON public.sophia_campaign_rules
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaign rules"
  ON public.sophia_campaign_rules
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaign rules"
  ON public.sophia_campaign_rules
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaign rules"
  ON public.sophia_campaign_rules
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for sophia_sent_messages
CREATE POLICY "Users can view their own sent messages"
  ON public.sophia_sent_messages
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sent messages"
  ON public.sophia_sent_messages
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sent messages"
  ON public.sophia_sent_messages
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create updated_at trigger for sophia_campaign_rules
DROP TRIGGER IF NOT EXISTS update_sophia_campaign_rules_updated_at ON public.sophia_campaign_rules;
CREATE TRIGGER update_sophia_campaign_rules_updated_at
  BEFORE UPDATE ON public.sophia_campaign_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
