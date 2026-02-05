-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  company TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create user roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create LinkedIn connections table
CREATE TABLE public.linkedin_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_id TEXT UNIQUE,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  profile_data JSONB,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

-- LinkedIn connections policies
CREATE POLICY "Users can manage their own LinkedIn connections" 
ON public.linkedin_connections 
FOR ALL 
USING (auth.uid() = user_id);

-- Create AI configurations table for multi-channel builder
CREATE TABLE public.ai_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  channels TEXT[] DEFAULT '{}', -- linkedin, email, twitter, etc
  config_data JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_configurations ENABLE ROW LEVEL SECURITY;

-- AI configurations policies
CREATE POLICY "Users can manage their own AI configurations" 
ON public.ai_configurations 
FOR ALL 
USING (auth.uid() = user_id);

-- Admin policy for viewing all configs
CREATE POLICY "Admins can view all AI configurations" 
ON public.ai_configurations 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_configurations_updated_at
BEFORE UPDATE ON public.ai_configurations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();-- Add missing RLS policy for user_roles table
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow admins to view all roles
CREATE POLICY "Admins can view all roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));-- Create contacts table for CRM functionality
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  linkedin_url TEXT,
  twitter_handle TEXT,
  source TEXT, -- where they came from (linkedin, email, referral, etc.)
  stage TEXT NOT NULL DEFAULT 'lead', -- lead, contacted, qualified, proposal, negotiation, closed-won, closed-lost
  score INTEGER DEFAULT 0, -- lead scoring 0-100
  tags TEXT[], -- array of tags for categorization
  notes TEXT,
  last_contacted TIMESTAMP WITH TIME ZONE,
  next_follow_up TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for contacts
CREATE POLICY "Users can manage their own contacts"
ON public.contacts
FOR ALL
USING (auth.uid() = user_id);

-- Create contact interactions table to track all touchpoints
CREATE TABLE public.contact_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- email, linkedin_message, call, meeting, note, etc.
  channel TEXT, -- linkedin, email, phone, etc.
  subject TEXT,
  content TEXT,
  outcome TEXT, -- positive, negative, neutral, no_response
  scheduled_for TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for interactions
ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;

-- Create policies for interactions
CREATE POLICY "Users can manage their own contact interactions"
ON public.contact_interactions
FOR ALL
USING (auth.uid() = user_id);

-- Create AI chat sessions table for interactive workflow/campaign setup
CREATE TABLE public.ai_chat_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_type TEXT NOT NULL, -- workflow, campaign, analysis
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  context_data JSONB DEFAULT '{}'::jsonb,
  result_configuration_id UUID REFERENCES public.ai_configurations(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for chat sessions
ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for chat sessions
CREATE POLICY "Users can manage their own AI chat sessions"
ON public.ai_chat_sessions
FOR ALL
USING (auth.uid() = user_id);

-- Create trigger for updating timestamps
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_chat_sessions_updated_at
BEFORE UPDATE ON public.ai_chat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_stage ON public.contacts(stage);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_contact_interactions_contact_id ON public.contact_interactions(contact_id);
CREATE INDEX idx_contact_interactions_user_id ON public.contact_interactions(user_id);
CREATE INDEX idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_type ON public.ai_chat_sessions(session_type);-- Create workspaces table for LinkedIn accounts
CREATE TABLE public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  linkedin_connection_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own workspaces" 
ON public.workspaces 
FOR ALL 
USING (auth.uid() = user_id);

-- Create trigger for timestamps
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key constraint to link workspaces with LinkedIn connections
ALTER TABLE public.workspaces 
ADD CONSTRAINT fk_workspace_linkedin_connection 
FOREIGN KEY (linkedin_connection_id) 
REFERENCES public.linkedin_connections(id) 
ON DELETE SET NULL;

-- Add workspace_id to existing tables to support multi-workspace functionality
ALTER TABLE public.contacts ADD COLUMN workspace_id UUID;
ALTER TABLE public.ai_configurations ADD COLUMN workspace_id UUID;
ALTER TABLE public.ai_chat_sessions ADD COLUMN workspace_id UUID;

-- Add foreign key constraints
ALTER TABLE public.contacts 
ADD CONSTRAINT fk_contact_workspace 
FOREIGN KEY (workspace_id) 
REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

ALTER TABLE public.ai_configurations 
ADD CONSTRAINT fk_ai_config_workspace 
FOREIGN KEY (workspace_id) 
REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

ALTER TABLE public.ai_chat_sessions 
ADD CONSTRAINT fk_ai_chat_workspace 
FOREIGN KEY (workspace_id) 
REFERENCES public.workspaces(id) 
ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_workspaces_user_id ON public.workspaces(user_id);
CREATE INDEX idx_workspaces_linkedin_connection ON public.workspaces(linkedin_connection_id);
CREATE INDEX idx_contacts_workspace_id ON public.contacts(workspace_id);
CREATE INDEX idx_ai_configurations_workspace_id ON public.ai_configurations(workspace_id);
CREATE INDEX idx_ai_chat_sessions_workspace_id ON public.ai_chat_sessions(workspace_id);-- Update user to admin role
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = '9753c42e-1679-4e20-aad6-be9e9b490a2e';-- First, enable RLS on user_roles table if not already enabled
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Block direct inserts" ON user_roles;
DROP POLICY IF EXISTS "Block direct updates" ON user_roles;
DROP POLICY IF EXISTS "Block direct deletes" ON user_roles;

-- Allow users to view their own role
CREATE POLICY "Users can view their own role" ON user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow admins to view all roles
CREATE POLICY "Admins can view all roles" ON user_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Block all direct INSERT operations (only RPC can insert)
CREATE POLICY "Block direct inserts" ON user_roles
  FOR INSERT
  WITH CHECK (false);

-- Block all direct UPDATE operations
CREATE POLICY "Block direct updates" ON user_roles
  FOR UPDATE
  USING (false);

-- Block all direct DELETE operations (only admins via backend should delete)
CREATE POLICY "Block direct deletes" ON user_roles
  FOR DELETE
  USING (false);

-- Create a secure function to claim admin role
-- This function atomically checks if an admin exists and grants admin role if not
CREATE OR REPLACE FUNCTION claim_admin_role()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
  current_user_id uuid;
BEGIN
  -- Get the current authenticated user
  current_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Not authenticated'
    );
  END IF;
  
  -- Lock the table to prevent race conditions
  LOCK TABLE user_roles IN EXCLUSIVE MODE;
  
  -- Count existing admins
  SELECT COUNT(*) INTO admin_count
  FROM user_roles
  WHERE role = 'admin';
  
  -- If admin already exists, return error
  IF admin_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Admin user already exists'
    );
  END IF;
  
  -- Check if user already has a role
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = current_user_id) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User already has a role assigned'
    );
  END IF;
  
  -- Grant admin role (bypasses RLS because of SECURITY DEFINER)
  INSERT INTO user_roles (user_id, role)
  VALUES (current_user_id, 'admin');
  
  RETURN json_build_object(
    'success', true,
    'message', 'Admin role granted successfully'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION claim_admin_role() TO authenticated;

-- Add comment explaining the security model
COMMENT ON FUNCTION claim_admin_role() IS 
  'Securely grants admin role to the first user. Prevents privilege escalation by blocking direct table inserts via RLS policies.';
-- Create campaigns table for marketing campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('email', 'linkedin', 'multi-channel')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  target_audience JSONB,
  settings JSONB NOT NULL DEFAULT '{}',
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  opened_count INTEGER NOT NULL DEFAULT 0,
  clicked_count INTEGER NOT NULL DEFAULT 0,
  replied_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for campaigns
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own campaigns" ON public.campaigns;
  CREATE POLICY "Users can view their own campaigns" 
  ON public.campaigns 
  FOR SELECT 
  USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can create their own campaigns" ON public.campaigns;
  CREATE POLICY "Users can create their own campaigns" 
  ON public.campaigns 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can update their own campaigns" ON public.campaigns;
  CREATE POLICY "Users can update their own campaigns" 
  ON public.campaigns 
  FOR UPDATE 
  USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Users can delete their own campaigns" ON public.campaigns;
  CREATE POLICY "Users can delete their own campaigns" 
  ON public.campaigns 
  FOR DELETE 
  USING (auth.uid() = user_id);

  DROP POLICY IF EXISTS "Admins can view all campaigns" ON public.campaigns;
  CREATE POLICY "Admins can view all campaigns" 
  ON public.campaigns 
  FOR SELECT 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
END $$;

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
-- Create table for user-specific connector configurations
-- This enables SaaS multi-tenancy where each user/company configures their own API credentials

CREATE TABLE IF NOT EXISTS connector_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email connector configuration
  email_provider TEXT CHECK (email_provider IN ('sendgrid', 'resend', 'smtp', 'gmail', 'outlook')),
  email_api_key TEXT,
  email_from_email TEXT,
  email_from_name TEXT,
  email_smtp_host TEXT,
  email_smtp_port TEXT,
  email_smtp_user TEXT,
  email_smtp_password TEXT,
  email_access_token TEXT,
  email_refresh_token TEXT,
  email_token_expiry BIGINT,
  email_user_email TEXT,
  
  -- SMS connector configuration
  sms_provider TEXT CHECK (sms_provider IN ('twilio', 'vonage')),
  sms_account_sid TEXT,
  sms_auth_token TEXT,
  sms_from_number TEXT,
  
  -- Phone/Voice connector configuration
  phone_provider TEXT CHECK (phone_provider IN ('twilio', 'elevenlabs')),
  phone_account_sid TEXT,
  phone_auth_token TEXT,
  phone_voice_id TEXT,
  
  -- LinkedIn connector configuration
  linkedin_access_token TEXT,
  linkedin_connected BOOLEAN DEFAULT FALSE,
  
  -- Social media connectors
  twitter_access_token TEXT,
  twitter_connected BOOLEAN DEFAULT FALSE,
  facebook_access_token TEXT,
  facebook_connected BOOLEAN DEFAULT FALSE,
  instagram_access_token TEXT,
  instagram_connected BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one config per user
  UNIQUE(user_id)
);

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_connector_configs_user_id ON connector_configs(user_id);

-- Enable Row Level Security
ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own connector configs
CREATE POLICY "Users can view own connector configs"
  ON connector_configs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own connector configs
CREATE POLICY "Users can insert own connector configs"
  ON connector_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own connector configs
CREATE POLICY "Users can update own connector configs"
  ON connector_configs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own connector configs
CREATE POLICY "Users can delete own connector configs"
  ON connector_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_connector_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_connector_configs_timestamp
  BEFORE UPDATE ON connector_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_connector_configs_updated_at();

-- Comment for documentation
COMMENT ON TABLE connector_configs IS 'Stores user-specific API connector configurations for multi-tenant SaaS. Each user configures their own email, SMS, phone, and social media API credentials.';
-- Add additional LinkedIn connector fields for OAuth data
-- This extends the connector_configs table with LinkedIn user information

ALTER TABLE connector_configs
  ADD COLUMN IF NOT EXISTS linkedin_user_email TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_user_name TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_profile_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_token_expiry BIGINT;

-- Comment for documentation
COMMENT ON COLUMN connector_configs.linkedin_user_email IS 'Email address of the connected LinkedIn user';
COMMENT ON COLUMN connector_configs.linkedin_user_name IS 'Display name of the connected LinkedIn user';
COMMENT ON COLUMN connector_configs.linkedin_profile_url IS 'LinkedIn profile URL of the connected user';
COMMENT ON COLUMN connector_configs.linkedin_token_expiry IS 'Unix timestamp when the LinkedIn access token expires';
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
-- NOTE: contact_id and campaign_id are optional UUIDs without foreign key constraints
CREATE TABLE IF NOT EXISTS public.agent_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID,
  campaign_id UUID,
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
-- NOTE: contact_id and response_id are UUIDs without foreign key constraints
CREATE TABLE IF NOT EXISTS public.agent_decisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  response_id UUID,
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
-- Create social_connections table for LinkedIn and other social platforms
-- This stores OAuth tokens and connection status for each user

CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  account_id VARCHAR(255),
  account_name VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  profile_data JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one connection per platform per user
  UNIQUE(user_id, platform)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_social_connections_user_platform 
ON social_connections(user_id, platform);

CREATE INDEX IF NOT EXISTS idx_social_connections_active 
ON social_connections(user_id, is_active);

-- Enable Row Level Security
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own connections
CREATE POLICY "Users can view own social connections"
ON social_connections FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own social connections"
ON social_connections FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own social connections"
ON social_connections FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own social connections"
ON social_connections FOR DELETE
USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON social_connections TO authenticated;
GRANT ALL ON social_connections TO service_role;
-- ============================================
-- AGENT SOPHIA - AUTONOMOUS OPERATIONS TABLES
-- For follow-up automation and meeting approvals
-- ============================================

-- Create followup_queue table for automated follow-up scheduling
CREATE TABLE IF NOT EXISTS public.followup_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  
  -- Channel and message details
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'sms', 'phone', 'social')),
  suggested_message TEXT NOT NULL,
  
  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  
  -- Failure tracking
  failure_reason TEXT,
  retry_count INT DEFAULT 0,
  
  -- AI context
  ai_context JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create meeting_approvals table for AI-detected meeting opportunities
CREATE TABLE IF NOT EXISTS public.meeting_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID,
  
  -- Email/message context
  source_email_id TEXT,
  source_channel TEXT CHECK (source_channel IN ('email', 'linkedin', 'sms')),
  
  -- Meeting details
  suggested_subject TEXT NOT NULL,
  suggested_time TIMESTAMPTZ NOT NULL,
  suggested_duration INT DEFAULT 30, -- in minutes
  suggested_attendees JSONB DEFAULT '[]'::jsonb,
  suggested_description TEXT,
  
  -- AI analysis
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  ai_reasoning TEXT,
  detected_intent TEXT,
  
  -- Approval status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'booked')),
  
  -- Booking details (if approved and booked)
  booked_meeting_id TEXT,
  booked_at TIMESTAMPTZ,
  meeting_link TEXT,
  
  -- User edits
  edited_subject TEXT,
  edited_time TIMESTAMPTZ,
  edited_duration INT,
  edited_description TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_followup_queue_user_id ON public.followup_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_followup_queue_contact_id ON public.followup_queue(contact_id);
CREATE INDEX IF NOT EXISTS idx_followup_queue_status ON public.followup_queue(status);
CREATE INDEX IF NOT EXISTS idx_followup_queue_scheduled_for ON public.followup_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_followup_queue_channel ON public.followup_queue(channel);
CREATE INDEX IF NOT EXISTS idx_followup_queue_created_at ON public.followup_queue(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_approvals_user_id ON public.meeting_approvals(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_approvals_contact_id ON public.meeting_approvals(contact_id);
CREATE INDEX IF NOT EXISTS idx_meeting_approvals_status ON public.meeting_approvals(status);
CREATE INDEX IF NOT EXISTS idx_meeting_approvals_suggested_time ON public.meeting_approvals(suggested_time);
CREATE INDEX IF NOT EXISTS idx_meeting_approvals_created_at ON public.meeting_approvals(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.followup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for followup_queue
CREATE POLICY "Users can view their own followup queue"
  ON public.followup_queue
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own followup tasks"
  ON public.followup_queue
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own followup tasks"
  ON public.followup_queue
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own followup tasks"
  ON public.followup_queue
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for meeting_approvals
CREATE POLICY "Users can view their own meeting approvals"
  ON public.meeting_approvals
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meeting approvals"
  ON public.meeting_approvals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meeting approvals"
  ON public.meeting_approvals
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meeting approvals"
  ON public.meeting_approvals
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_followup_queue_updated_at ON public.followup_queue;
CREATE TRIGGER update_followup_queue_updated_at
  BEFORE UPDATE ON public.followup_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_meeting_approvals_updated_at ON public.meeting_approvals;
CREATE TRIGGER update_meeting_approvals_updated_at
  BEFORE UPDATE ON public.meeting_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE public.followup_queue IS 'Queue for automated follow-up messages scheduled by Agent Sophia';
COMMENT ON TABLE public.meeting_approvals IS 'AI-detected meeting opportunities awaiting human approval';

COMMENT ON COLUMN public.followup_queue.scheduled_for IS 'When the follow-up should be sent';
COMMENT ON COLUMN public.followup_queue.ai_context IS 'AI reasoning and context for this follow-up';

COMMENT ON COLUMN public.meeting_approvals.confidence IS 'AI confidence score (0.0 to 1.0) for the meeting suggestion';
COMMENT ON COLUMN public.meeting_approvals.ai_reasoning IS 'Explanation of why AI suggested this meeting';
COMMENT ON COLUMN public.meeting_approvals.status IS 'pending = awaiting review, approved = user approved, rejected = user declined, booked = meeting created in calendar';
-- ============================================
-- AGENT SOPHIA - Allow Processing Unknown Contacts
-- Makes contact_id nullable and adds prospect fields for unknown senders
-- ============================================

-- Make contact_id nullable in followup_queue to support unknown senders
ALTER TABLE public.followup_queue
  ALTER COLUMN contact_id DROP NOT NULL;

-- Add prospect fields for unknown senders in followup_queue
ALTER TABLE public.followup_queue
  ADD COLUMN IF NOT EXISTS prospect_email TEXT,
  ADD COLUMN IF NOT EXISTS prospect_name TEXT;

-- Add prospect fields for unknown senders in meeting_approvals (if not exists)
ALTER TABLE public.meeting_approvals
  ADD COLUMN IF NOT EXISTS prospect_email TEXT,
  ADD COLUMN IF NOT EXISTS prospect_name TEXT;

-- Add prospect fields for unknown senders in campaign_responses (if not exists)
ALTER TABLE public.campaign_responses
  ADD COLUMN IF NOT EXISTS prospect_email TEXT,
  ADD COLUMN IF NOT EXISTS prospect_name TEXT;

-- Add index for prospect_email lookups (deduplication)
CREATE INDEX IF NOT EXISTS idx_followup_queue_prospect_email 
  ON public.followup_queue(prospect_email) 
  WHERE prospect_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_meeting_approvals_prospect_email 
  ON public.meeting_approvals(prospect_email) 
  WHERE prospect_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_responses_prospect_email 
  ON public.campaign_responses(prospect_email) 
  WHERE prospect_email IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN public.followup_queue.prospect_email IS 'Email of unknown sender (when contact_id is null)';
COMMENT ON COLUMN public.followup_queue.prospect_name IS 'Name of unknown sender (when contact_id is null)';
COMMENT ON COLUMN public.meeting_approvals.prospect_email IS 'Email of unknown sender (when contact_id is null)';
COMMENT ON COLUMN public.meeting_approvals.prospect_name IS 'Name of unknown sender (when contact_id is null)';
COMMENT ON COLUMN public.campaign_responses.prospect_email IS 'Email of unknown sender (when contact_id is null)';
COMMENT ON COLUMN public.campaign_responses.prospect_name IS 'Name of unknown sender (when contact_id is null)';
-- Add user profile and company information to agent_configs
-- This enables personalized email generation with real user details

-- Add user_profile JSONB column
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS user_profile JSONB DEFAULT '{}'::jsonb;

-- Add company_info JSONB column
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS company_info JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.agent_configs.user_profile IS 'User profile information: full_name, title, email, phone';
COMMENT ON COLUMN public.agent_configs.company_info IS 'Company information: company_name, industry, website, services_description, value_propositions';
-- =====================================================
-- Agent Sophia - Multi-User Auto-Check Cron Setup
-- =====================================================
-- This script sets up automatic email checking for ALL users
-- Run this in your Supabase SQL Editor to enable auto-polling
-- =====================================================

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Grant permissions to cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Step 3: Set the required configuration FIRST (CRITICAL - must be done before scheduling)
-- Replace YOUR_PROJECT_REF with your project reference from Settings → API → Project URL
-- Replace YOUR_SERVICE_ROLE_KEY with your service_role key from Settings → API → service_role

-- IMPORTANT: Uncomment and modify these lines with your actual values, then run them:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- Step 4: Schedule Agent Sophia to run every 15 minutes for ALL active users
-- NOTE: Only run this AFTER setting the configuration values above!

SELECT cron.schedule(
  'agent-sophia-multi-user-auto-check',  -- Job name
  '*/15 * * * *',                         -- Every 15 minutes (cron syntax)
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/agent-sophia-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'timestamp', now()
      ),
      timeout_milliseconds := 120000  -- 2 minute timeout (processes users sequentially)
    ) AS request_id;
  $$
);

-- =====================================================
-- Verification Queries
-- =====================================================

-- View all scheduled cron jobs
-- SELECT jobname, schedule, command, active FROM cron.job;

-- Check recent cron job runs
-- SELECT * FROM cron.job_run_details 
-- WHERE jobname = 'agent-sophia-multi-user-auto-check'
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- View HTTP request queue (for debugging)
-- SELECT * FROM net.http_request_queue 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- =====================================================
-- Management Commands (Uncomment to use)
-- =====================================================

-- Pause auto-checking (unschedule the job)
-- SELECT cron.unschedule('agent-sophia-multi-user-auto-check');

-- Resume auto-checking (re-run the SELECT cron.schedule command above)

-- Change frequency to every 5 minutes (more frequent)
-- SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '*/5 * * * *');

-- Change frequency to every 30 minutes (less frequent)
-- SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '*/30 * * * *');

-- Change frequency to every hour
-- SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '0 * * * *');

-- Delete the job completely
-- SELECT cron.unschedule('agent-sophia-multi-user-auto-check');

-- =====================================================
-- Cron Syntax Quick Reference
-- =====================================================
-- Format: minute hour day-of-month month day-of-week
--
-- */15 * * * *   = Every 15 minutes
-- */5 * * * *    = Every 5 minutes
-- */30 * * * *   = Every 30 minutes
-- 0 * * * *      = Every hour (on the hour)
-- 0 */2 * * *    = Every 2 hours
-- 0 9 * * *      = Every day at 9 AM
-- 0 9 * * 1-5    = Every weekday at 9 AM
-- 0 0 * * 0      = Every Sunday at midnight
--
-- Use https://crontab.guru to test expressions
-- =====================================================
-- Add automatic email checking toggle and timestamp tracking
-- Enables users to turn on/off automatic inbox monitoring and see when Sophia last ran

-- Add auto_check_enabled boolean column (defaults to true for existing users)
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS auto_check_enabled BOOLEAN DEFAULT true NOT NULL;

-- Add last_checked_at timestamp column (nullable - null means never checked)
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN public.agent_configs.auto_check_enabled IS 'Whether automatic email checking is enabled for this user (pg_cron respects this flag)';
COMMENT ON COLUMN public.agent_configs.last_checked_at IS 'Timestamp of when Sophia last checked this user''s inbox (updated by cron job and manual runs)';
-- Add autonomous policies for Agent Sophia 2.0
-- Enables confidence-based auto-reply, meeting intelligence, and policy-based automation

-- Add autonomy_policies JSONB column
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS autonomy_policies JSONB DEFAULT '{
  "auto_reply_enabled": true,
  "confidence_threshold": 0.85,
  "max_daily_auto_replies": 20,
  "meeting_auto_accept": {
    "internal": true,
    "external": false
  },
  "sensitive_keywords": ["pricing", "contract", "NDA", "budget", "legal"],
  "spam_auto_archive": true,
  "working_hours_only": true
}'::jsonb;

-- Add daily auto-reply counter tracking
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS auto_replies_today INTEGER DEFAULT 0;

-- Add last_auto_reply_reset timestamp
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS last_auto_reply_reset TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- Add comments for documentation
COMMENT ON COLUMN public.agent_configs.autonomy_policies IS 'Advanced autonomous behavior policies: auto-reply thresholds, meeting rules, sensitive keywords, spam handling';
COMMENT ON COLUMN public.agent_configs.auto_replies_today IS 'Counter for auto-replies sent today (resets daily based on last_auto_reply_reset)';
COMMENT ON COLUMN public.agent_configs.last_auto_reply_reset IS 'Timestamp of last daily counter reset for auto-reply limits';
-- ============================================
-- O365 CONTACT SYNC SUPPORT
-- ============================================

-- Add o365_contact_id to contacts table to track synced contacts
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS o365_contact_id TEXT,
ADD COLUMN IF NOT EXISTS o365_synced_at TIMESTAMPTZ;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contacts_o365_contact_id 
ON public.contacts(o365_contact_id) 
WHERE o365_contact_id IS NOT NULL;

-- Add contact sync settings to agent_configs
ALTER TABLE public.agent_configs
ADD COLUMN IF NOT EXISTS sync_o365_contacts BOOLEAN NOT NULL DEFAULT TRUE;

-- Add comment for documentation
COMMENT ON COLUMN public.contacts.o365_contact_id IS 'Microsoft Graph Contact ID for O365 sync';
COMMENT ON COLUMN public.contacts.o365_synced_at IS 'Last time contact was synced to O365';
COMMENT ON COLUMN public.agent_configs.sync_o365_contacts IS 'Enable automatic O365 contact sync when processing emails';
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
-- Create campaign_responses table for unified inbox
CREATE TABLE IF NOT EXISTS campaign_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('linkedin', 'email', 'sms', 'phone', 'social')),
  sender_name TEXT NOT NULL,
  sender_identifier TEXT NOT NULL,
  message_content TEXT NOT NULL,
  intent_tag TEXT NOT NULL DEFAULT 'other' CHECK (intent_tag IN ('interested', 'not_interested', 'question', 'objection', 'meeting_request', 'out_of_office', 'other')),
  confidence_score DECIMAL(3,2) DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  is_read BOOLEAN DEFAULT FALSE,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_responses_user_id ON campaign_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_responses_campaign_id ON campaign_responses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_responses_contact_id ON campaign_responses(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_responses_channel ON campaign_responses(channel);
CREATE INDEX IF NOT EXISTS idx_campaign_responses_intent_tag ON campaign_responses(intent_tag);
CREATE INDEX IF NOT EXISTS idx_campaign_responses_is_read ON campaign_responses(is_read);
CREATE INDEX IF NOT EXISTS idx_campaign_responses_responded_at ON campaign_responses(responded_at DESC);

-- Enable Row Level Security
ALTER TABLE campaign_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see their own responses
CREATE POLICY "Users can view their own campaign responses"
  ON campaign_responses
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaign responses"
  ON campaign_responses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaign responses"
  ON campaign_responses
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaign responses"
  ON campaign_responses
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_campaign_responses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_campaign_responses_updated_at
  BEFORE UPDATE ON campaign_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_campaign_responses_updated_at();
-- LinkedIn Safety Configuration Table
CREATE TABLE IF NOT EXISTS linkedin_safety_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_limit integer NOT NULL DEFAULT 50,
  warm_up_enabled boolean NOT NULL DEFAULT true,
  warm_up_day integer NOT NULL DEFAULT 1,
  proxy_enabled boolean NOT NULL DEFAULT false,
  proxy_url text,
  proxy_rotation_minutes integer NOT NULL DEFAULT 6,
  geo_location text NOT NULL DEFAULT 'US',
  activity_distribution boolean NOT NULL DEFAULT true,
  human_delays boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- LinkedIn Activity Log Table
CREATE TABLE IF NOT EXISTS linkedin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  connection_requests integer NOT NULL DEFAULT 0,
  messages_sent integer NOT NULL DEFAULT 0,
  profile_views integer NOT NULL DEFAULT 0,
  total_actions integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- RLS Policies for linkedin_safety_config
ALTER TABLE linkedin_safety_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own safety config"
  ON linkedin_safety_config
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own safety config"
  ON linkedin_safety_config
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own safety config"
  ON linkedin_safety_config
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for linkedin_activity_log
ALTER TABLE linkedin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity log"
  ON linkedin_activity_log
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity log"
  ON linkedin_activity_log
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own activity log"
  ON linkedin_activity_log
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to increment activity count (with auth check)
CREATE OR REPLACE FUNCTION increment_linkedin_activity(
  p_activity_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_date date := CURRENT_DATE;
  v_user_id uuid := auth.uid();
BEGIN
  -- Ensure user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert or update today's activity for the authenticated user
  INSERT INTO linkedin_activity_log (user_id, date, connection_requests, messages_sent, profile_views, total_actions)
  VALUES (
    v_user_id,
    v_date,
    CASE WHEN p_activity_type = 'connection_request' THEN 1 ELSE 0 END,
    CASE WHEN p_activity_type = 'message' THEN 1 ELSE 0 END,
    CASE WHEN p_activity_type = 'profile_view' THEN 1 ELSE 0 END,
    1
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    connection_requests = linkedin_activity_log.connection_requests + CASE WHEN p_activity_type = 'connection_request' THEN 1 ELSE 0 END,
    messages_sent = linkedin_activity_log.messages_sent + CASE WHEN p_activity_type = 'message' THEN 1 ELSE 0 END,
    profile_views = linkedin_activity_log.profile_views + CASE WHEN p_activity_type = 'profile_view' THEN 1 ELSE 0 END,
    total_actions = linkedin_activity_log.total_actions + 1,
    updated_at = now();
END;
$$;

-- Indexes for performance
CREATE INDEX idx_linkedin_safety_config_user_id ON linkedin_safety_config(user_id);
CREATE INDEX idx_linkedin_activity_log_user_date ON linkedin_activity_log(user_id, date);
-- Create social_connections table for managing OAuth connections to social platforms
CREATE TABLE IF NOT EXISTS social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'twitter', 'instagram', 'tiktok')),
  account_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  profile_data JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, platform, account_id)
);

-- Enable RLS
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own social connections"
  ON social_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own social connections"
  ON social_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social connections"
  ON social_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social connections"
  ON social_connections FOR DELETE
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_social_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER social_connections_updated_at
  BEFORE UPDATE ON social_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_social_connections_updated_at();

-- Create index for faster lookups
CREATE INDEX idx_social_connections_user_id ON social_connections(user_id);
CREATE INDEX idx_social_connections_platform ON social_connections(platform);
CREATE INDEX idx_social_connections_is_active ON social_connections(is_active);
