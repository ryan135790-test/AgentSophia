# Agent Sophia - Automatic Email Checking Setup

This guide will help you set up automatic email checking for Agent Sophia so it monitors your Office 365 inbox every 15 minutes without manual intervention.

---

## 🎯 What This Does

Once configured, Agent Sophia will:
- ✅ **Auto-check emails** every 15 minutes for ALL active users
- ✅ **Auto-refresh O365 tokens** when they expire
- ✅ **Detect new responses** from prospects
- ✅ **Trigger AI decisions** automatically
- ✅ **Create approval items** for you to review
- ✅ **Respect working hours** if configured (UTC time)
- ✅ **Process multiple users** sequentially (up to ~50 users within 2-minute timeout)

---

## 📋 Prerequisites

Before you begin:
1. Agent Sophia is set up with Office 365 connected
2. You have access to your Supabase Dashboard
3. You have admin access to run SQL commands

---

## 🚀 Step-by-Step Setup

### **Step 1: Deploy the Cron Edge Function**

First, deploy the new multi-user cron wrapper function to Supabase.

**Via Supabase CLI (Recommended):**
```bash
# Deploy the agent-sophia-cron function
supabase functions deploy agent-sophia-cron
```

**Via Supabase Dashboard:**
1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Create Function**
3. Name it: `agent-sophia-cron`
4. Copy the code from `supabase/functions/agent-sophia-cron/index.ts`
5. Click **Deploy**

---

### **Step 2: Get Your Configuration Values**

You'll need these values from your Supabase Dashboard:

1. **Go to:** Settings → API
2. **Copy these values:**
   - **Project URL**: `https://YOUR_PROJECT_REF.supabase.co`
   - **service_role key**: `eyJhbGc...` (the secret key, not anon key)

---

### **Step 3: Run the Setup SQL**

1. **Open:** Supabase Dashboard → SQL Editor
2. **Click:** "New Query"
3. **Copy and paste** the following SQL:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Set your configuration (REPLACE THE VALUES!)
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- Schedule the cron job (runs every 15 minutes)
SELECT cron.schedule(
  'agent-sophia-multi-user-auto-check',
  '*/15 * * * *',
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
      timeout_milliseconds := 120000
    ) AS request_id;
  $$
);
```

4. **Replace:**
   - `YOUR_PROJECT_REF` → Your actual project reference
   - `YOUR_SERVICE_ROLE_KEY` → Your actual service role key

5. **Click:** "Run" or press `Ctrl+Enter`

---

### **Step 4: Verify It's Working**

**Check if the cron job is scheduled:**
```sql
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'agent-sophia-multi-user-auto-check';
```

You should see:
```
jobname: agent-sophia-multi-user-auto-check
schedule: */15 * * * *
active: true
```

**Wait 15 minutes, then check recent runs:**
```sql
SELECT jobid, runid, status, return_message, start_time 
FROM cron.job_run_details 
WHERE jobname = 'agent-sophia-multi-user-auto-check'
ORDER BY start_time DESC 
LIMIT 5;
```

---

## 🔧 Common Adjustments

### **Change Checking Frequency**

**Every 5 minutes (more frequent):**
```sql
SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '*/5 * * * *');
```

**Every 30 minutes (less frequent):**
```sql
SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '*/30 * * * *');
```

**Every hour:**
```sql
SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '0 * * * *');
```

**Business hours only (9 AM - 5 PM, weekdays):**
```sql
SELECT cron.alter_job('agent-sophia-multi-user-auto-check', schedule := '*/15 9-16 * * 1-5');
```

---

### **Pause/Resume Auto-Checking**

**Pause (stop auto-checking):**
```sql
SELECT cron.unschedule('agent-sophia-multi-user-auto-check');
```

**Resume (re-run the schedule command from Step 3)**

---

## ⚠️ Known Limitations

### **Working Hours & Timezone**
- Working hours check uses **UTC server time**, not user timezone
- For timezone-aware checks, you'd need to add a `timezone` field to `agent_configs`
- Currently only checks hour (e.g., 9 AM), ignores minute granularity

### **Scalability**
- Processes users **sequentially** (one after another)
- 2-minute timeout allows ~50 users (assuming 2-3 seconds per user)
- For 100+ users, consider:
  - Multiple cron jobs (split users by ID range)
  - Increase timeout (may hit pg_cron 10-minute max)
  - Move to dedicated background worker

---

## 🐛 Troubleshooting

### **Cron job not running?**

1. **Check if extensions are enabled:**
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
   ```

2. **Check cron job status:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'agent-sophia-multi-user-auto-check';
   ```

3. **View error logs:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobname = 'agent-sophia-multi-user-auto-check'
   AND status = 'failed'
   ORDER BY start_time DESC;
   ```

---

### **Edge Function not deployed?**

Run:
```bash
supabase functions list
```

You should see `agent-sophia-cron` in the list.

If not, deploy it:
```bash
supabase functions deploy agent-sophia-cron
```

---

### **Still having issues?**

1. Check Agent Sophia activity log in the app
2. Verify Office 365 is connected in Agent Sophia → Setup
3. Ensure `is_active = true` in your `agent_configs` table
4. Check working hours settings aren't blocking execution

---

## 📊 Monitoring

### **View recent activity:**
```sql
SELECT * FROM agent_activity 
ORDER BY created_at DESC 
LIMIT 20;
```

### **Check email processing stats:**
```sql
SELECT 
  COUNT(*) as total_responses,
  COUNT(DISTINCT contact_id) as unique_contacts,
  channel
FROM campaign_responses
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY channel;
```

---

## 🔐 Security Notes

- The `service_role` key is stored securely in your database configuration
- Only use the service_role key for backend/cron operations
- Never expose the service_role key in frontend code
- The cron job only processes users with `is_active = true`

---

## 📚 Cron Syntax Reference

Format: `minute hour day-of-month month day-of-week`

Common patterns:
- `*/15 * * * *` = Every 15 minutes
- `*/5 * * * *` = Every 5 minutes  
- `0 * * * *` = Every hour
- `0 9 * * 1-5` = Weekdays at 9 AM
- `0 */2 * * *` = Every 2 hours

**Test your cron expression:** https://crontab.guru

---

## ✅ Success Checklist

- [ ] `agent-sophia-cron` Edge Function deployed
- [ ] pg_cron and pg_net extensions enabled
- [ ] Configuration values set in database
- [ ] Cron job scheduled and active
- [ ] First run completed successfully
- [ ] Agent Sophia showing new activity in the app

---

**Need help?** Check the Supabase documentation:
- [Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [pg_cron Guide](https://supabase.com/docs/guides/cron)
