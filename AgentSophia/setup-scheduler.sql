-- Agent Sophia Background Scheduler Setup
-- Run this in Supabase SQL Editor after deploying Edge Functions

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Step 2: Create function to call orchestrator for all active users
CREATE OR REPLACE FUNCTION run_agent_sophia_orchestrator()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
  supabase_url TEXT;
  service_role_key TEXT;
BEGIN
  -- Get Supabase credentials from environment
  -- IMPORTANT: Replace these with your actual values before running!
  supabase_url := 'https://fsbwkufvkuetrfimqhdf.supabase.co';
  service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzYndrdWZ2a3VldHJmaW1xaGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI3NzU1NiwiZXhwIjoyMDc0ODUzNTU2fQ.n6rBDi9Ruy6PVC8I0RGDq17Rk-uHB_lQMsmrzB0W80M';
  
  -- Loop through all users with active agent configs
  FOR user_record IN 
    SELECT user_id FROM agent_configs WHERE is_active = true
  LOOP
    -- Call orchestrator for each user
    PERFORM extensions.http_post(
      url := supabase_url || '/functions/v1/agent-sophia-orchestrator',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'action', 'run_now',
        'userId', user_record.user_id::text
      )::text
    );
  END LOOP;
END;
$$;

-- Step 3: Schedule to run every 15 minutes
SELECT cron.schedule(
  'agent-sophia-orchestrator',
  '*/15 * * * *',  -- Every 15 minutes
  $$SELECT run_agent_sophia_orchestrator()$$
);

-- Step 4: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'agent-sophia-orchestrator';

-- To manually test the orchestrator (optional):
-- SELECT run_agent_sophia_orchestrator();

-- To view cron job run history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (
--   SELECT jobid FROM cron.job WHERE jobname = 'agent-sophia-orchestrator'
-- ) ORDER BY start_time DESC LIMIT 10;

-- To disable the scheduler (if needed):
-- SELECT cron.unschedule('agent-sophia-orchestrator');
