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
