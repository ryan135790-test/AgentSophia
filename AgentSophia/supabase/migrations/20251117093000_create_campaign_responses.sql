-- Create campaign_responses table for unified inbox
CREATE TABLE IF NOT EXISTS campaign_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('linkedin', 'email', 'sms', 'phone', 'social', 'voicemail')),
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
