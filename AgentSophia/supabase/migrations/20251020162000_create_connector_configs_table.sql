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
