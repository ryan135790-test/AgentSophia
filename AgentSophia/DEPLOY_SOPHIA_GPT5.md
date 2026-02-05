# Deploy Chat with Sophia to GPT-5

## Prerequisites
✅ OpenAI API key is configured in Replit
✅ Edge function code is ready in `supabase/functions/ai-assistant/index.ts`
✅ Chat component has both mock and real API code ready

## Deployment Steps

### Step 1: Set OpenAI API Key in Supabase

1. Go to **Supabase Dashboard**: https://app.supabase.com
2. Select your project
3. Navigate to **Settings** → **Edge Functions** → **Secrets**
4. Add a new secret:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (the same one from Replit secrets)
5. Click **Save**

### Step 2: Deploy the AI Assistant Edge Function

**Option A: Via Supabase Dashboard (Recommended)**

1. Go to **Edge Functions** in your Supabase Dashboard
2. Click **Create New Function**
3. Name it: `ai-assistant`
4. Copy ALL the code from: `supabase/functions/ai-assistant/index.ts`
5. Paste it into the editor
6. Click **Deploy**
7. Wait for deployment to complete (usually 10-30 seconds)

**Option B: Via Supabase CLI (if you have it set up locally)**

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy ai-assistant
```

### Step 3: Enable the Real API in Chat Component

1. Open: `src/components/agent-sophia/sophia-chat.tsx`
2. Find the two sections marked with:
   ```typescript
   /* UNCOMMENT THIS WHEN EDGE FUNCTION IS DEPLOYED:
   ```
3. **Delete the mock code** and **uncomment the real API code** in both places:
   - Quick action handler (around line 79-152)
   - Regular message handler (around line 195-267)

4. The chat will now use GPT-5 for all responses!

### Step 4: Test the Integration

1. Refresh your app
2. Go to **Chat with Sophia**
3. Try sending a message (e.g., "Build me a LinkedIn campaign")
4. You should see real GPT-5 powered responses!

### Step 5: Monitor Edge Function Logs

If you encounter any issues:

1. Go to **Supabase Dashboard** → **Edge Functions** → `ai-assistant`
2. Click the **Logs** tab
3. Check for any errors
4. Common issues:
   - Missing `OPENAI_API_KEY` secret
   - OpenAI API rate limits
   - Authentication errors

## Current Status

- ✅ Mock responses working (temporary)
- ⏳ Edge function needs deployment
- ⏳ Real API code ready but commented out

## Notes

- The edge function uses **GPT-5** (the latest model as of August 2025)
- Model is configured in line 10: `const OPENAI_MODEL = "gpt-5"`
- The function supports:
  - Campaign building assistance
  - Performance analysis
  - Lead scoring
  - Meeting scheduling
  - Email drafting
  - Workflow creation

## Troubleshooting

**Error: "Failed to fetch"**
- Edge function is not deployed yet
- Check Edge Functions in Supabase Dashboard

**Error: "User not authenticated"**
- Authentication issue with Supabase session
- Check if user is logged in

**Error: "OpenAI API error"**
- Check OPENAI_API_KEY is set correctly in Supabase secrets
- Verify API key is valid and has credits

**Slow responses**
- GPT-5 can take 2-10 seconds to respond
- This is normal for complex queries
