-- =====================================================
-- Agent Sophia - Multi-User Auto-Check Cron Setup
-- =====================================================
-- This script sets up automatic email checking for ALL users
-- Run this in your Supabase SQL Editor to enable auto-polling
-- =====================================================

-- Step 1: Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Grant permissions to cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Step 3: Set the required configuration FIRST (CRITICAL - must be done before scheduling)
-- Replace YOUR_PROJECT_REF with your project reference from Settings → API → Project URL
-- Replace YOUR_SERVICE_ROLE_KEY with your service_role key from Settings → API → service_role

-- IMPORTANT: Uncomment and modify these lines with your actual values, then run them:
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- Step 4: Schedule Agent Sophia to run every 15 minutes for ALL active users
-- NOTE: Only run this AFTER setting the configuration values above!

SELECT cron.schedule(
  'agent-sophia-multi-user-auto-check',  -- Job name
  '*/15 * * * *',                         -- Every 15 minutes (cron syntax)
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/agent-sophia-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'source', 'pg_cron',
        'timestamp', now()
      ),
      timeout_milliseconds := 120000  -- 2 minute timeout (processes users sequentially)
    ) AS request_id;
  $$
);

-- =====================================================
-- Verification Queries
-- =====================================================

-- View all scheduled cron jobs
-- SELECT jobname, schedule, command, active FROM cron.job;

-- Check recent cron job runs
-- SELECT * FROM cron.job_run_details 
-- WHERE jobname = 'agent-sophia-multi-user-auto-check'
-- ORDER BY start_time DESC 
-- LIMIT 10;

-- View HTTP request queue (for debugging)
-- SELECT * FROM net.http_request_queue 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- =====================================================
-- Management Commands (Uncomment to use)
-- =====================================================

-- Pause auto-checking (unschedule the job)
-- SELECT cron.unschedule('agent-sophia-multi-user-auto-check');

-- Resume auto-checking (re-run the SELECT cron.schedule command above)

-- Change frequency to every 5 minutes (more frequent)
-- SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '*/5 * * * *');

-- Change frequency to every 30 minutes (less frequent)
-- SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '*/30 * * * *');

-- Change frequency to every hour
-- SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '0 * * * *');

-- Delete the job completely
-- SELECT cron.unschedule('agent-sophia-multi-user-auto-check');

-- =====================================================
-- Cron Syntax Quick Reference
-- =====================================================
-- Format: minute hour day-of-month month day-of-week
--
-- */15 * * * *   = Every 15 minutes
-- */5 * * * *    = Every 5 minutes
-- */30 * * * *   = Every 30 minutes
-- 0 * * * *      = Every hour (on the hour)
-- 0 */2 * * *    = Every 2 hours
-- 0 9 * * *      = Every day at 9 AM
-- 0 9 * * 1-5    = Every weekday at 9 AM
-- 0 0 * * 0      = Every Sunday at midnight
--
-- Use https://crontab.guru to test expressions
-- =====================================================
