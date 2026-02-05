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
