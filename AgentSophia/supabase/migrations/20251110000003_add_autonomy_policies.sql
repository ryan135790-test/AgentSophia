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
