# Agent Sophia Autonomous Operations - Setup Guide

## Overview
Agent Sophia's autonomous operations system allows the AI SDR to automatically handle sales operations including:
- Detecting and processing email/LinkedIn responses
- Executing scheduled follow-ups
- Generating smart AI follow-ups for non-responsive contacts
- Auto-booking meetings (when enabled)

## Architecture

### Core Components
1. **Supabase Edge Functions** - Backend serverless functions for autonomous operations
2. **Database Tables** - followup_queue and meeting_approvals for task management
3. **Background Scheduler** - Periodic execution of the orchestrator function
4. **Client Libraries** - Frontend integration for manual controls and monitoring

## Setup Instructions

### Step 1: Apply Database Migration

The migration file has been created at `supabase/migrations/20251106000000_autonomous_agent_tables.sql`

**Option A: Via Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of the migration file
4. Run the SQL in the editor

**Option B: Via Supabase CLI**
```bash
npx supabase db push
```

### Step 2: Deploy Edge Functions

Deploy all Edge Functions to your Supabase project:

```bash
# Deploy all functions
npx supabase functions deploy agent-sophia-orchestrator
npx supabase functions deploy office365-book-meeting
npx supabase functions deploy office365-check-availability
npx supabase functions deploy linkedin-send-connection
npx supabase functions deploy linkedin-send-message
npx supabase functions deploy linkedin-check-messages
npx supabase functions deploy linkedin-create-post
```

### Step 3: Configure Environment Variables (Optional)

For LinkedIn Partner API access (if you have it):

```bash
# In Supabase Dashboard > Project Settings > Edge Functions > Secrets
LINKEDIN_PARTNER_API_ENABLED=true
```

**Note**: Without LinkedIn Partner API access, LinkedIn functions will queue actions for manual completion instead of automating them.

### Step 4: Set Up Background Scheduler

Agent Sophia's orchestrator needs to run periodically (every 15-30 minutes) to:
- Check for new responses
- Execute pending follow-ups
- Generate smart follow-ups
- Process meeting approvals

**Option A: Supabase pg_cron (Recommended)**

Add this SQL function and cron job via Supabase SQL Editor:

```sql
-- Create function to call orchestrator
CREATE OR REPLACE FUNCTION run_agent_sophia_orchestrator()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Loop through all users with active agent configs
  FOR user_record IN 
    SELECT user_id FROM agent_configs WHERE is_active = true
  LOOP
    -- Call orchestrator for each user
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/agent-sophia-orchestrator',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'action', 'run_now',
        'userId', user_record.user_id
      )
    );
  END LOOP;
END;
$$;

-- Schedule to run every 15 minutes
SELECT cron.schedule(
  'agent-sophia-orchestrator',
  '*/15 * * * *',  -- Every 15 minutes
  $$SELECT run_agent_sophia_orchestrator()$$
);
```

**Option B: External Cron Service (Alternative)**

If pg_cron is not available, use an external service like:
- **GitHub Actions** with workflow schedules
- **AWS EventBridge / Lambda** 
- **Vercel Cron Jobs**
- **Zapier / Make.com** scheduled webhooks

Example GitHub Actions workflow:

```yaml
name: Agent Sophia Orchestrator
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:

jobs:
  run-orchestrator:
    runs-on: ubuntu-latest
    steps:
      - name: Call Orchestrator
        run: |
          curl -X POST \
            ${{ secrets.SUPABASE_URL }}/functions/v1/agent-sophia-orchestrator \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"action": "run_now", "userId": "${{ secrets.USER_ID }}"}'
```

### Step 5: Verify Setup

1. **Check Agent Config**: Navigate to Agent Sophia settings and ensure configuration is saved
2. **Test Manual Run**: Click "Run Now" in the Autonomous Engine UI to test execution
3. **Monitor Activity Log**: Check the activity log for autonomous operations
4. **Verify Database**: Confirm followup_queue and meeting_approvals tables exist

## Usage

### Starting the Autonomous Agent

1. Go to Agent Sophia → Overview → Autonomous Engine
2. Configure autonomy level:
   - **Manual**: All actions require approval
   - **Semi-Autonomous**: Some actions auto-execute, others need approval
   - **Fully Autonomous**: Agent operates independently within configured limits
3. Click "Start Agent"

### Monitoring Operations

The Autonomous Engine dashboard shows:
- Real-time status (Running/Stopped)
- Recent activity counts
- Pending tasks
- Success/failure rates

### Stopping the Agent

Click "Stop Agent" in the Autonomous Engine UI to pause all autonomous operations.

## LinkedIn Integration Notes

### Standard OAuth (Default)
- LinkedIn Posts: ✅ Fully supported
- Connection Requests: ⚠️ Queued for manual action
- Direct Messages: ⚠️ Queued for manual action
- Message Reading: ⚠️ Not available

### LinkedIn Partner Program (Enterprise)
To enable full LinkedIn automation:

1. Apply for LinkedIn Partner Program:
   https://business.linkedin.com/marketing-solutions/marketing-partners

2. Request access to:
   - Invitations API (connection requests)
   - Messaging API (direct messages)
   - Conversations API (message reading)

3. Set environment variable: `LINKEDIN_PARTNER_API_ENABLED=true`

**Alternative**: Use LinkedIn Sales Navigator API (requires enterprise license)

## Office 365 Integration

Office 365 features are fully supported:
- ✅ Email sending/reading
- ✅ Calendar availability checking
- ✅ Meeting booking with Teams links
- ✅ Automatic token refresh

## Troubleshooting

### Agent not executing tasks
1. Check if agent is active in database: `SELECT * FROM agent_configs WHERE is_active = true`
2. Verify orchestrator is being called (check logs)
3. Confirm Office 365 connection is active

### Follow-ups not sending
1. Check `followup_queue` table for pending tasks
2. Verify channel configurations (email/LinkedIn tokens)
3. Review activity log for errors

### Meetings not booking
1. Confirm Office 365 access token is valid
2. Check `meeting_approvals` table status
3. Verify meeting_booking settings in agent config

## Security & Safety

The autonomous system includes multiple safety measures:
- **Activity Limits**: Daily caps on outreach volume
- **Working Hours**: Only operates during configured business hours
- **Human Approval**: Semi-autonomous mode requires approval for key actions
- **Pause Controls**: Can be stopped instantly via UI
- **Audit Logging**: All actions logged in agent_activities table

## API Reference

### Orchestrator API

```typescript
POST /functions/v1/agent-sophia-orchestrator
{
  "action": "start" | "stop" | "run_now",
  "userId": "user-uuid"
}
```

### Response Detection
Automatically runs via orchestrator to:
- Fetch unread Office 365 emails
- Check LinkedIn messages (if Partner API enabled)
- Match responses to contacts
- Trigger AI decision engine

### Follow-up Execution
Automatically runs via orchestrator to:
- Query pending follow-ups from followup_queue
- Send via appropriate channel
- Log outcomes
- Update task status

## Performance & Costs

### Expected Volumes (per 15-min run)
- Email checking: ~50 emails scanned
- Follow-ups sent: ~10 messages
- AI decisions: ~5 decisions
- Meeting bookings: ~2 meetings

### Cost Optimization
- Adjust cron frequency (15-30 minutes recommended)
- Set daily activity limits in agent config
- Use working hours to prevent off-hours execution
- Monitor Edge Function invocations in Supabase dashboard

## Support

For issues or questions:
1. Check activity log in Agent Sophia dashboard
2. Review Supabase Edge Function logs
3. Verify database table contents
4. Check this documentation for setup steps
