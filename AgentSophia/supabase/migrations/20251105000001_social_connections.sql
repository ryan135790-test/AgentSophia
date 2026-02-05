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
