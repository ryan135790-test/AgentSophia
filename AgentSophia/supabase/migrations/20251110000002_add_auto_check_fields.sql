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
