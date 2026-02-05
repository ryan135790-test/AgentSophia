# 🚀 Deploy Supabase Edge Functions - Quick Guide

## ⚠️ IMPORTANT: Why You're Getting "Failed to fetch"

The Edge Functions exist in your codebase (`supabase/functions/`) but they're **not deployed to Supabase yet**. They need to run on Supabase's servers, not locally.

---

## 📋 WHAT YOU NEED TO DO

### **Step 1: Deploy Edge Functions to Supabase**

You have **2 options**:

---

### **OPTION A: Via Supabase Dashboard (Easiest - No CLI needed)**

1. **Go to your Supabase project:**
   - https://app.supabase.com/project/YOUR_PROJECT_ID/functions

2. **For EACH function below, do this:**
   
   **Office 365 Functions:**
   - `office365-token-exchange`
   - `office365-send-email`
   - `office365-read-inbox`
   - `office365-book-meeting`
   
   **Social Media Functions:**
   - `linkedin-post`
   - `twitter-post`
   - `facebook-post`
   - `instagram-post`
   
   **Agent Sophia Functions:**
   - `agent-sophia-decision`
   - `agent-sophia-prospect`
   - `agent-sophia-followup`
   - `ai-assistant`
   - `classify-intent`

3. **For each function:**
   - Click **"Create a new function"**
   - Name: `office365-token-exchange` (match folder name exactly)
   - Click **"Create function"**
   - Copy the entire contents from `supabase/functions/office365-token-exchange/index.ts`
   - Paste into the editor
   - Click **"Deploy"**
   
4. **Repeat for all 13 functions** (yes, it's tedious but only once!)

---

### **OPTION B: Via Supabase CLI (Faster - Requires setup)**

#### **Install Supabase CLI:**

**On Mac:**
```bash
brew install supabase/tap/supabase
```

**On Windows (PowerShell):**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**On Linux:**
```bash
curl -fsSL https://github.com/supabase/cli/releases/download/v1.123.4/supabase_1.123.4_linux_amd64.tar.gz | tar xzf - -C /usr/local/bin
```

**Via npm (Alternative):**
```bash
npx supabase --version
```

#### **Login to Supabase:**
```bash
supabase login
```

#### **Link to your project:**
```bash
supabase link --project-ref YOUR_PROJECT_ID
```

Find your project ID: https://app.supabase.com/project/YOUR_PROJECT_ID/settings/general

#### **Deploy ALL functions at once:**
```bash
# Deploy Office 365 functions
supabase functions deploy office365-token-exchange
supabase functions deploy office365-send-email
supabase functions deploy office365-read-inbox
supabase functions deploy office365-book-meeting

# Deploy social media functions
supabase functions deploy linkedin-post
supabase functions deploy twitter-post
supabase functions deploy facebook-post
supabase functions deploy instagram-post

# Deploy Agent Sophia functions
supabase functions deploy agent-sophia-decision
supabase functions deploy agent-sophia-prospect
supabase functions deploy agent-sophia-followup
supabase functions deploy ai-assistant
supabase functions deploy classify-intent
```

**Or deploy everything in one command:**
```bash
supabase functions deploy office365-token-exchange && \
supabase functions deploy office365-send-email && \
supabase functions deploy office365-read-inbox && \
supabase functions deploy office365-book-meeting && \
supabase functions deploy linkedin-post && \
supabase functions deploy twitter-post && \
supabase functions deploy facebook-post && \
supabase functions deploy instagram-post && \
supabase functions deploy agent-sophia-decision && \
supabase functions deploy agent-sophia-prospect && \
supabase functions deploy agent-sophia-followup && \
supabase functions deploy ai-assistant && \
supabase functions deploy classify-intent
```

---

## ⚙️ Step 2: Add Secrets to Supabase

**CRITICAL:** The Edge Functions need access to your API keys. Add them to Supabase:

### **Via CLI (Fastest):**
```bash
supabase secrets set OFFICE365_CLIENT_ID=your-client-id-here
supabase secrets set OFFICE365_CLIENT_SECRET=your-secret-here
supabase secrets set OFFICE365_TENANT_ID=common
supabase secrets set OPENAI_API_KEY=your-openai-key-here
```

### **Via Dashboard:**
1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/settings/functions
2. Scroll to **"Secrets"**
3. Click **"Add new secret"**
4. Add each one:
   - Name: `OFFICE365_CLIENT_ID`, Value: (paste your client ID)
   - Name: `OFFICE365_CLIENT_SECRET`, Value: (paste your secret)
   - Name: `OFFICE365_TENANT_ID`, Value: `common`
   - Name: `OPENAI_API_KEY`, Value: (paste your OpenAI key)

---

## ✅ Step 3: Test the Connection

1. Go back to your app
2. Click **"Connect to Office 365"** in Agent Sophia
3. Complete the OAuth flow
4. You should now see **"Connected"** status

---

## 🔍 Troubleshooting

### **"Failed to fetch" still happening?**
- Check Supabase Edge Functions logs: https://app.supabase.com/project/YOUR_PROJECT_ID/functions
- Click on the function → **"Logs"** tab
- Look for errors

### **"Missing environment variable" error?**
- Make sure you added ALL secrets to Supabase (not just Replit)
- Secrets must match exactly: `OFFICE365_CLIENT_ID` (case-sensitive)

### **"Invalid redirect URI" error?**
- Check Azure redirect URI matches exactly: `https://YOUR_REPLIT_DOMAIN/oauth/office365/callback`
- No trailing slash
- Must be HTTPS

---

## 📊 Quick Status Check

**Check if functions are deployed:**
```bash
supabase functions list
```

**Check if secrets are set:**
```bash
supabase secrets list
```

**View function logs:**
```bash
supabase functions logs office365-token-exchange
```

---

## 🎯 Summary

1. ✅ Deploy 13 Edge Functions to Supabase (via Dashboard or CLI)
2. ✅ Add 4 secrets to Supabase (OFFICE365_CLIENT_ID, OFFICE365_CLIENT_SECRET, OFFICE365_TENANT_ID, OPENAI_API_KEY)
3. ✅ Test Office 365 connection in your app
4. ✅ Done!

---

**Need help?** Check the logs in Supabase Dashboard → Edge Functions → [function name] → Logs
