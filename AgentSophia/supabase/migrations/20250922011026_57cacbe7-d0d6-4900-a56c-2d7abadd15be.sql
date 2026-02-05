-- Create contacts table for CRM functionality
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
CREATE INDEX idx_ai_chat_sessions_type ON public.ai_chat_sessions(session_type);