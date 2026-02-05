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
