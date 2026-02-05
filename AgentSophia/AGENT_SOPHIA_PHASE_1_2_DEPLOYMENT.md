# 🚀 AGENT SOPHIA - PHASE 1 + 2 DEPLOYMENT GUIDE

## 📋 OVERVIEW

**Phase 1 (Campaign Automation)** + **Phase 2 (Channel Integration)** enables Agent Sophia to:
- ✅ **Auto-create** multi-channel campaigns using GPT-4o
- ✅ **Send emails** via SendGrid/Resend (fully functional)
- ✅ **Send SMS** via Twilio (Edge Function ready)
- ✅ **Track messages** in database with activity logging
- ✅ **Save campaign automation settings** to database

**What Changed:**
1. New database tables: `sophia_campaign_rules`, `sophia_sent_messages`
2. New Edge Functions: `agent-sophia-campaign-creator`, `agent-sophia-messenger`
3. New frontend tab: "Automation" in Agent Sophia page
4. Enhanced email connector setup component

---

## 🗄️ STEP 1: DATABASE MIGRATION

### **Deploy Migration via Supabase Dashboard:**

1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy and paste contents of:
   ```
   supabase/migrations/20251105000000_agent_sophia_campaign_automation.sql
   ```
4. Click "Run"

**What this creates:**
- ✅ `campaigns.created_by_sophia` column (tracks Sophia-created campaigns)
- ✅ `campaigns.sophia_metadata` JSONB column
- ✅ `sophia_campaign_rules` table (automation rules)
- ✅ `sophia_sent_messages` table (message tracking)
- ✅ Indexes for performance
- ✅ RLS policies for security

**Verify Migration:**
```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('sophia_campaign_rules', 'sophia_sent_messages');

-- Check campaigns table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'campaigns' 
  AND column_name IN ('created_by_sophia', 'sophia_metadata');
```

---

## 🔧 STEP 2: DEPLOY EDGE FUNCTIONS

### **Option A: Via Supabase CLI (Recommended)**

```bash
# Deploy campaign creator
supabase functions deploy agent-sophia-campaign-creator

# Deploy messenger
supabase functions deploy agent-sophia-messenger

# Verify deployment
supabase functions list
```

### **Option B: Via Supabase Dashboard**

#### **Deploy agent-sophia-campaign-creator:**
1. Go to Edge Functions → "Deploy a new function" button
2. Select "Via Editor" (not "Deploy new version")
3. Function name: `agent-sophia-campaign-creator`
4. Copy entire contents of `supabase/functions/agent-sophia-campaign-creator/index.ts`
5. Paste into editor
6. Click "Deploy function"

#### **Deploy agent-sophia-messenger:**
1. Repeat above steps for `agent-sophia-messenger`
2. Copy from `supabase/functions/agent-sophia-messenger/index.ts`

**Verify Edge Functions:**
```bash
# Test campaign creator
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/agent-sophia-campaign-creator' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"test": true}'

# Test messenger  
curl -X POST 'https://YOUR_PROJECT.supabase.co/functions/v1/agent-sophia-messenger' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"test": true}'
```

---

## 📧 STEP 3: CONFIGURE EMAIL CONNECTOR

### **Get SendGrid API Key (Recommended - Free 100 emails/day):**

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Go to Settings → API Keys
3. Create API Key named "Agent Sophia"
4. Select "Full Access"
5. **Copy the key immediately** (shown only once!)
6. Verify your sender email address

### **Get Resend API Key (Alternative - Free 3,000 emails/month):**

1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys
3. Create key named "Agent Sophia"
4. Copy the key
5. Add and verify your domain (or use test domain)

### **Configure in Application:**

1. Go to Agent Sophia → **Automation tab**
2. Select provider (SendGrid or Resend)
3. Paste API key
4. Enter "From Email" (must be verified in provider)
5. Enter "From Name" (e.g., "Agent Sophia")
6. Click **"Test Connection"** → Should send test email
7. Click **"Save Configuration"**

**Test Email Sending:**
```javascript
// Via browser console (logged in):
const response = await fetch('/api/connectors/test', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    channel: 'email',
    config: {
      provider: 'sendgrid',
      apiKey: 'YOUR_API_KEY',
      fromEmail: 'your-email@company.com',
      fromName: 'Agent Sophia'
    },
    testRecipient: {
      email: 'test@example.com'
    }
  })
});
console.log(await response.json());
```

---

## ⚙️ STEP 4: CONFIGURE CAMPAIGN AUTOMATION

Go to **Agent Sophia → Automation tab** and configure:

### **Auto-Create Campaigns:**
- ✅ Enable/disable automatic campaign creation
- Agent Sophia will create campaigns for qualified lead segments

### **Default Channels:**
- ☑️ **Email** (recommended - fully functional)
- ☑️ **LinkedIn** (placeholder - requires Sales Navigator)
- ☐ **SMS** (requires Twilio setup)
- ☐ **AI Phone** (requires Twilio Voice setup)

### **Daily Campaign Limit:**
- Default: 3 campaigns/day
- Range: 1-10
- Prevents overwhelming outreach channels

### **Max Leads Per Campaign:**
- Default: 100 leads
- Range: 10-500
- Keeps campaigns focused

Click **"Save All Settings"** at bottom of page.

---

## 🧪 STEP 5: TEST END-TO-END

### **Test 1: Campaign Creator**

```typescript
// Call via frontend (logged in user):
const campaignResult = await fetch('https://YOUR_PROJECT.supabase.co/functions/v1/agent-sophia-campaign-creator', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_USER_JWT',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    leadSegment: {
      industry: 'Technology',
      companySize: '50-200',
      jobTitles: ['CTO', 'VP Engineering'],
      count: 25
    },
    brandVoice: {
      companyName: 'Your Company',
      industry: 'B2B SaaS',
      tone: 'professional',
      brandValues: ['innovation', 'results-driven']
    },
    channels: ['email'],
    autoLaunch: false
  })
});

console.log(await campaignResult.json());
```

**Expected Result:**
- ✅ Campaign created in database
- ✅ Activity logged in `agent_activities`
- ✅ Campaign has AI-generated sequences for email

### **Test 2: Messenger**

```typescript
// Send test email via Sophia:
const messageResult = await fetch('https://YOUR_PROJECT.supabase.co/functions/v1/agent-sophia-messenger', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_USER_JWT',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channel: 'email',
    contactId: 'some-contact-uuid',
    campaignId: 'some-campaign-uuid',
    message: {
      subject: 'Test from Agent Sophia',
      body: 'This is a test email sent via Agent Sophia messenger!'
    },
    messageType: 'initial_outreach'
  })
});

console.log(await messageResult.json());
```

**Expected Result:**
- ✅ Email sent via SendGrid/Resend
- ✅ Message logged in `sophia_sent_messages`
- ✅ Activity logged in `agent_activities`
- ✅ Test recipient receives email

### **Test 3: Frontend Integration**

1. Go to Agent Sophia page
2. Click **"Automation" tab**
3. Verify:
   - ✅ Email connector setup visible
   - ✅ Campaign automation settings visible
   - ✅ Toggle switches work
   - ✅ Checkboxes work
   - ✅ Number inputs work
4. Make changes and click "Save All Settings"
5. Refresh page - settings should persist

---

## 🔍 STEP 6: VERIFY DATABASE

```sql
-- Check campaign automation settings saved
SELECT 
  decision_criteria->>'campaign_automation' as campaign_settings
FROM agent_configs
WHERE user_id = 'YOUR_USER_ID';

-- Check sent messages
SELECT 
  channel,
  status,
  provider,
  created_at
FROM sophia_sent_messages
ORDER BY created_at DESC
LIMIT 10;

-- Check Sophia activities
SELECT 
  activity_type,
  outcome,
  metadata,
  created_at
FROM agent_activities
WHERE activity_type IN ('campaign_created', 'message_sent')
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🐛 TROUBLESHOOTING

### **Email Connector Test Fails:**

**Error: "No email connector configured"**
- Solution: Make sure you clicked "Save Configuration" after entering API key

**Error: "Connection test failed"**
- Check API key is correct (no extra spaces)
- Verify "From Email" is verified in SendGrid/Resend
- Check SendGrid/Resend dashboard for error logs

**Error: "401 Unauthorized"**
- API key expired or invalid
- Generate new API key in provider dashboard

### **Campaign Creator Fails:**

**Error: "OpenAI API key not configured"**
- Edge Function needs OPENAI_API_KEY environment variable
- Set via: `supabase secrets set OPENAI_API_KEY=your-key`

**Error: "Failed to create campaign"**
- Check database permissions (RLS policies)
- Verify user is authenticated
- Check Edge Function logs in Supabase Dashboard

### **Messenger Fails:**

**Error: "No {channel} connector configured"**
- Configure channel in Automation tab first
- Save settings and try again

**Error: "Connector is not active"**
- Email connector exists but not tested/saved properly
- Re-test connection in Automation tab

**Error: "LinkedIn messaging requires Sales Navigator"**
- Expected - LinkedIn is placeholder only
- Use email for now

### **Frontend Settings Don't Persist:**

**Changes reset after refresh**
- Check browser console for errors
- Verify "Save All Settings" button works
- Check RLS policies allow updates to `agent_configs`

**Settings not loading**
- Check user has `agent_configs` record
- Create initial config by toggling Sophia on/off

---

## 📊 MONITORING

### **Check Sophia Activity:**

```sql
-- Today's activity summary
SELECT 
  activity_type,
  COUNT(*) as count,
  COUNT(CASE WHEN outcome = 'success' THEN 1 END) as successful,
  COUNT(CASE WHEN outcome = 'failed' THEN 1 END) as failed
FROM agent_activities
WHERE created_at >= CURRENT_DATE
GROUP BY activity_type;

-- Recent messages
SELECT 
  channel,
  status,
  sent_at,
  failed_reason
FROM sophia_sent_messages
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;
```

### **Check Email Delivery:**

- **SendGrid:** Dashboard → Activity Feed
- **Resend:** Dashboard → Emails → Recent

---

## 🎯 NEXT STEPS

**You now have:**
- ✅ Fully functional email automation
- ✅ Campaign auto-creation capability
- ✅ Message tracking and logging
- ✅ User-friendly configuration UI

**To activate full autonomy:**
1. Configure email connector
2. Set campaign automation settings
3. Enable Agent Sophia (toggle at top)
4. Add qualified leads to CRM
5. Agent Sophia will auto-create campaigns and send emails!

**Future enhancements:**
- Phase 3: Contact auto-import
- Phase 4: Performance learning
- Phase 5: Scheduled automation (cron jobs)
- Phase 6: CRM integration
- Phase 7: Advanced AI features

---

## 📝 DEPLOYMENT CHECKLIST

- [ ] Database migration deployed successfully
- [ ] `agent-sophia-campaign-creator` Edge Function deployed
- [ ] `agent-sophia-messenger` Edge Function deployed
- [ ] Email connector configured (SendGrid or Resend)
- [ ] Test email sent successfully
- [ ] Campaign automation settings configured
- [ ] Settings persist after refresh
- [ ] Test campaign creation works
- [ ] Test message sending works
- [ ] Activity logging verified
- [ ] Agent Sophia activated

**All done! Agent Sophia is now fully autonomous! 🎉**
