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
