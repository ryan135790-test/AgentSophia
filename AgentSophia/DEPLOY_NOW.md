# 🚀 DEPLOY AGENT SOPHIA NOW

## ✅ ALL FILES READY - Let's Deploy!

---

## 📊 **STEP 1: Deploy Database Migration (2 minutes)**

### Open Your Supabase Dashboard:
1. Go to: https://supabase.com/dashboard
2. Select your AI Lead Platform project
3. Click **SQL Editor** in the left sidebar

### Run the Migration:
1. Click **New Query** button (top right)
2. Go back to this Replit project
3. Open file: `supabase/migrations/20251104000000_create_agent_sophia_tables.sql`
4. **Copy ALL the contents** (it's 172 lines)
5. **Paste into Supabase SQL Editor**
6. Click **Run** button (or press Cmd/Ctrl + Enter)

### ✅ Expected Result:
You should see: **"Success. No rows returned"**

### Verify It Worked:
1. Click **Table Editor** in left sidebar
2. You should see 3 new tables:
   - ✅ `agent_configs`
   - ✅ `agent_activities`
   - ✅ `agent_decisions`

**🎯 Once you see these 3 tables, STEP 1 is complete!**

---

## 🔧 **STEP 2: Deploy Edge Functions (3 minutes)**

We need to deploy 3 AI-powered Edge Functions to Supabase.

### Option A: Manual Deployment via Dashboard (Easier)

For each function, follow this process:

#### **Function 1: agent-sophia-decision**
1. In Supabase Dashboard, click **Edge Functions** (left sidebar)
2. Click **Create Function** button
3. Name: `agent-sophia-decision`
4. Open in Replit: `supabase/functions/agent-sophia-decision/index.ts`
5. Copy ALL 340 lines
6. Paste into the function editor in Supabase
7. Click **Deploy Function**

#### **Function 2: agent-sophia-prospect**
1. Click **Create Function** again
2. Name: `agent-sophia-prospect`
3. Open in Replit: `supabase/functions/agent-sophia-prospect/index.ts`
4. Copy ALL 211 lines
5. Paste into the function editor
6. Click **Deploy Function**

#### **Function 3: agent-sophia-followup**
1. Click **Create Function** again
2. Name: `agent-sophia-followup`
3. Open in Replit: `supabase/functions/agent-sophia-followup/index.ts`
4. Copy ALL 177 lines
5. Paste into the function editor
6. Click **Deploy Function**

### ✅ Verify All Functions Deployed:
In Edge Functions page, you should see 3 functions with "Active" status

---

## 🧪 **STEP 3: Test Agent Sophia (1 minute)**

1. **Go to your AI Lead Platform** (this Replit app)
2. **Sign in** with your account
3. In the navigation, click **Agent Sophia** (you'll see it in the menu)
4. **Configure your settings:**
   - Choose autonomy level (try "Semi-Autonomous" first)
   - Set your working hours
   - Set daily limits (start with 50/day)
   - Add your meeting link if you have one
   - Choose communication tone
5. **Click Save Configuration**
6. **Toggle Activation ON**
7. **Check Activity Log tab** - you should see a "Configuration updated" entry

---

## 🎉 **SUCCESS!**

If you see:
- ✅ 3 tables in Supabase Table Editor
- ✅ 3 functions in Edge Functions (Active status)
- ✅ Configuration saves successfully
- ✅ Activity shows in the log

**Agent Sophia is LIVE and ready to work!**

---

## 🚨 **Troubleshooting**

### "Permission denied" when running migration:
- Make sure you're signed in to the correct Supabase project
- Check you have owner/admin access to the project

### Edge Functions won't deploy:
- Make sure function names are exact: `agent-sophia-decision`, `agent-sophia-prospect`, `agent-sophia-followup`
- Check that you copied the ENTIRE file contents

### Configuration won't save:
- Check browser console (F12) for errors
- Verify tables were created correctly
- Make sure you're signed in to the app

### Need help?
- Check Supabase Dashboard logs
- Look at browser console for frontend errors
- Verify OPENAI_API_KEY is set in your Supabase Edge Functions settings

---

**Ready to deploy? Let me know when you complete STEP 1 (database migration) and I'll help you with the next steps!**
