# Agent Sophia - Supabase Deployment Guide

## 🚀 Quick Start

Follow these steps in order to get Agent Sophia fully operational:

---

## Step 1: Deploy Edge Functions

### Option A: Automated Script (Recommended)

```bash
# Make the script executable
chmod +x deploy-to-supabase.sh

# Run the deployment script
./deploy-to-supabase.sh
```

The script will:
- Login to Supabase
- Link your project
- Deploy all 17 Edge Functions automatically
- Show deployment summary

### Option B: Manual Deployment

If the script doesn't work, deploy manually:

```bash
# Login and link
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF

# Deploy each function
npx supabase functions deploy agent-sophia-orchestrator --no-verify-jwt
npx supabase functions deploy agent-sophia-decision --no-verify-jwt
npx supabase functions deploy agent-sophia-followup --no-verify-jwt
npx supabase functions deploy agent-sophia-prospect --no-verify-jwt
npx supabase functions deploy office365-send-email --no-verify-jwt
npx supabase functions deploy office365-read-inbox --no-verify-jwt
npx supabase functions deploy office365-book-meeting --no-verify-jwt
npx supabase functions deploy office365-check-availability --no-verify-jwt
npx supabase functions deploy office365-refresh-token --no-verify-jwt
npx supabase functions deploy office365-token-exchange --no-verify-jwt
npx supabase functions deploy linkedin-oauth --no-verify-jwt
npx supabase functions deploy linkedin-send-connection --no-verify-jwt
npx supabase functions deploy linkedin-send-message --no-verify-jwt
npx supabase functions deploy linkedin-check-messages --no-verify-jwt
npx supabase functions deploy linkedin-create-post --no-verify-jwt
```

---

## Step 2: Apply Database Migration

### Create Autonomous Agent Tables

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Navigate to **SQL Editor**

2. **Copy Migration SQL**
   - Open `supabase/migrations/20251106000000_autonomous_agent_tables.sql`
   - Copy all contents

3. **Run Migration**
   - Paste into SQL Editor
   - Click "Run" button
   - Verify success message

**What this creates:**
- `followup_queue` table - Stores scheduled follow-up tasks
- `meeting_approvals` table - Stores AI-detected meeting suggestions
- Proper indexes and foreign keys

---

## Step 3: Configure Edge Function Secrets

### Required Secrets

Add these in **Supabase Dashboard → Project Settings → Edge Functions → Secrets**:

#### LinkedIn OAuth (Required)
```
LINKEDIN_CLIENT_ID=your_linkedin_app_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_app_client_secret
```

#### LinkedIn Partner API (Optional - only if approved)
```
LINKEDIN_PARTNER_API_ENABLED=true
```

#### Office 365 (If using email automation)
```
OFFICE365_CLIENT_ID=your_azure_app_client_id
OFFICE365_CLIENT_SECRET=your_azure_app_client_secret
OFFICE365_TENANT_ID=your_azure_tenant_id
```

### How to Add Secrets

**Via Supabase Dashboard:**
1. Go to Project Settings → Edge Functions
2. Scroll to "Secrets" section
3. Click "Add secret"
4. Enter name and value
5. Click "Save"

**Via Supabase CLI:**
```bash
echo "YOUR_CLIENT_ID" | npx supabase secrets set LINKEDIN_CLIENT_ID
echo "YOUR_CLIENT_SECRET" | npx supabase secrets set LINKEDIN_CLIENT_SECRET
```

---

## Step 4: Set Up Background Scheduler

### Configure pg_cron

1. **Open Supabase SQL Editor**

2. **Edit the scheduler SQL**
   - Open `setup-scheduler.sql`
   - Replace `YOUR_PROJECT_REF` with your actual project ref
   - Replace `YOUR_SERVICE_ROLE_KEY` with your service role key
     - Find in: Supabase Dashboard → Project Settings → API → service_role key

3. **Run the SQL**
   - Copy modified SQL to Supabase SQL Editor
   - Execute

4. **Verify Cron Job**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'agent-sophia-orchestrator';
   ```
   
   You should see one row with the schedule `*/15 * * * *`

**What this does:**
- Runs Agent Sophia orchestrator every 15 minutes
- Checks for responses, executes follow-ups, processes meetings
- Loops through all users with active Agent Sophia configs

---

## Step 5: Configure Frontend Environment Variables

Add to your `.env` file:

```env
# LinkedIn OAuth
VITE_LINKEDIN_CLIENT_ID=your_linkedin_app_client_id

# Supabase (should already be set)
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## Step 6: Test the Deployment

### 1. Test Edge Functions

Go to **Supabase Dashboard → Edge Functions** and verify all functions show "Deployed"

### 2. Test LinkedIn Connection

1. Open your app
2. Go to **Platform → Connectors**
3. Click **Connect LinkedIn**
4. Complete OAuth flow
5. Verify "Connected" status appears

### 3. Test Agent Sophia

1. Go to **Platform → Agent Sophia → Overview**
2. Check that dashboard loads without errors
3. Enable Agent Sophia automation
4. Monitor activity log for events

### 4. Test Background Scheduler

Wait 15 minutes, then check:
```sql
-- View recent cron runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'agent-sophia-orchestrator')
ORDER BY start_time DESC 
LIMIT 5;
```

---

## Troubleshooting

### Edge Functions Not Deploying

**Error: "Project not linked"**
```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

**Error: "Authentication required"**
```bash
npx supabase login
```

### Database Migration Fails

**Error: "Table already exists"**
- The tables were already created
- No action needed

**Error: "Permission denied"**
- Make sure you're using a user with sufficient permissions
- Try running as the postgres user

### Scheduler Not Running

**Check if pg_cron is enabled:**
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

If not found:
```sql
CREATE EXTENSION pg_cron;
```

**Check scheduler logs:**
```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### LinkedIn Connection Failing

1. Verify Client ID is correct in `.env`
2. Check redirect URI in LinkedIn app matches: `https://YOUR_DOMAIN/auth/linkedin/callback`
3. Verify secrets are set in Supabase Edge Functions
4. Check Edge Function logs in Supabase Dashboard

---

## Verification Checklist

- [ ] All 17 Edge Functions deployed
- [ ] Database migration applied (followup_queue, meeting_approvals exist)
- [ ] LinkedIn secrets configured in Supabase
- [ ] Background scheduler running every 15 minutes
- [ ] Frontend .env has VITE_LINKEDIN_CLIENT_ID
- [ ] LinkedIn OAuth connection works
- [ ] Agent Sophia dashboard loads
- [ ] Activity log shows events

---

## Next Steps After Deployment

1. **Connect Office 365** - For email automation
2. **Configure Agent Sophia** - Set autonomy level and rules
3. **Import Contacts** - Add leads to start outreach
4. **Monitor Activities** - Watch Agent Sophia → Activity Log
5. **Apply for LinkedIn Partner Program** - For full automation

---

## Support

If you encounter issues:

1. **Check Edge Function logs** - Supabase Dashboard → Edge Functions → Select function → Logs
2. **Check browser console** - For frontend errors
3. **Check SQL logs** - For database/scheduler errors
4. **Review setup guides** - `LINKEDIN_OAUTH_SETUP.md`, `AUTONOMOUS_AGENT_SETUP.md`

Need help? Check the troubleshooting sections in each guide.
