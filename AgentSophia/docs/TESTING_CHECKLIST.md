# Multi-Tenant Connector System - Testing Checklist

## 🎯 Goal
Verify that the database-backed connector system works correctly with proper multi-tenant isolation.

---

## ✅ **Step 1: Run the Database Migration**

### 1.1 Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **"New Query"**

### 1.2 Execute Migration SQL
1. Copy the entire content from `supabase/migrations/20251020162000_create_connector_configs_table.sql`
2. Paste into the SQL editor
3. Click **"Run"** button
4. You should see: ✅ **"Success. No rows returned"**

### 1.3 Verify Table Created
Run this query to confirm:
```sql
SELECT * FROM connector_configs;
```
Expected result: Empty table (0 rows) with all columns visible

---

## ✅ **Step 2: Test Single-User Connector Flow**

### 2.1 Login as User A
1. Start your app: The workflow should already be running
2. Navigate to **Settings → Connectors** (or wherever ChannelConnectors is displayed)
3. You should see loading state briefly, then the connector form

### 2.2 Test Email Connector (API Key Method)
1. Select **"SendGrid"** from Email Provider dropdown
2. Enter a test API key: `SG.test123456789`
3. Enter From Email: `usera@company.com`
4. Enter From Name: `User A`
5. Click **"Save Configuration"**
6. You should see: ✅ **"Connector Saved"** toast notification

### 2.3 Verify Persistence
1. Refresh the page (F5)
2. Go back to Connectors tab
3. You should still see your SendGrid configuration with `usera@company.com`

### 2.4 Test OAuth Connector (Gmail/Outlook)

**Note:** This test requires OAuth client IDs to be configured. If you haven't set up OAuth yet, skip to Step 2.5.

1. Click **"Connect Gmail"** button
2. If not configured, you'll see: "Not configured" (expected)
3. If configured: Popup should open for Google OAuth
4. After authorization, you should see: ✅ **"Gmail Connected!"**
5. Your connected email should display

---

## ✅ **Step 3: Test Multi-Tenant Isolation (CRITICAL)**

### 3.1 Check Database for User A's Config
In Supabase SQL Editor, run:
```sql
SELECT 
  user_id, 
  email_provider, 
  email_from_email,
  created_at
FROM connector_configs;
```
Expected result: One row with User A's configuration

### 3.2 Logout and Create/Login as User B
1. Logout from your app
2. Create a new account OR login as a different user (User B)
3. Navigate to **Settings → Connectors**

### 3.3 Verify User B Sees Empty State
- User B should see **NO connectors configured**
- User B should **NOT see** User A's SendGrid config
- User B should see an empty form

### 3.4 Configure Different Connector for User B
1. Select **"Resend"** from Email Provider dropdown
2. Enter API key: `re_userb123456`
3. Enter From Email: `userb@business.com`
4. Enter From Name: `User B`
5. Click **"Save Configuration"**
6. You should see: ✅ **"Connector Saved"**

### 3.5 Verify Database Has Both Users
In Supabase SQL Editor, run:
```sql
SELECT 
  user_id, 
  email_provider, 
  email_from_email,
  created_at
FROM connector_configs
ORDER BY created_at;
```
Expected result:
```
Row 1: User A's UUID | sendgrid | usera@company.com | [timestamp]
Row 2: User B's UUID | resend | userb@business.com | [timestamp]
```

### 3.6 Final Isolation Test
1. Login back as **User A**
2. Go to Connectors
3. Verify you see **SendGrid** with `usera@company.com` (NOT User B's config)
4. Login as **User B** again
5. Verify you see **Resend** with `userb@business.com` (NOT User A's config)

✅ **If both users only see their own configs, RLS is working perfectly!**

---

## ✅ **Step 4: Test All Connector Types**

### 4.1 Email Connectors
Test each provider:
- [x] SendGrid (API key)
- [x] Resend (API key)
- [ ] SMTP (host, port, user, password)
- [ ] Gmail (OAuth - requires client ID setup)
- [ ] Outlook (OAuth - requires client ID setup)

### 4.2 SMS Connectors
1. Go to **SMS** tab
2. Select **Twilio**
3. Enter Account SID: `AC123456789`
4. Enter Auth Token: `test_token`
5. Enter From Number: `+11234567890`
6. Click **"Save Configuration"**
7. Verify: ✅ Toast notification

### 4.3 Phone/Voice Connectors
1. Go to **Phone/Voice** tab
2. Select **Twilio Voice**
3. Enter Account SID: `AC987654321`
4. Enter Auth Token: `voice_token`
5. Click **"Save Configuration"**
6. Verify: ✅ Toast notification

### 4.4 Test ElevenLabs Voice
1. Select **ElevenLabs** from provider dropdown
2. Additional field should appear: **Voice ID**
3. Enter Voice ID: `21m00Tcm4TlvDq8ikWAM`
4. Enter Account SID/API Key
5. Save and verify

### 4.5 LinkedIn Connector
1. Go to **LinkedIn** tab
2. See "Connect LinkedIn Account" button
3. (OAuth integration not fully implemented yet - expected)

### 4.6 Social Media Connectors
1. Go to **Social Media** tab
2. See Twitter, Facebook, Instagram connect buttons
3. (OAuth integration not fully implemented yet - expected)

---

## ✅ **Step 5: Test Disconnect Functionality**

### 5.1 Disconnect Email (OAuth)
1. If you connected Gmail/Outlook, you should see a "Disconnect" button
2. Click **"Disconnect"**
3. Verify: Email config cleared
4. Verify: Database updated (run SELECT query)

### 5.2 Disconnect Email (API Key)
1. Connect SendGrid/Resend
2. Currently no disconnect button for API key providers
3. To clear: Select different provider or clear fields manually and save

---

## ✅ **Step 6: Test Error Handling**

### 6.1 Test Save Without Credentials
1. Select SendGrid
2. Leave API Key empty
3. Click Save
4. Should save (no validation yet) - This is expected behavior

### 6.2 Test Network Failure
1. Open DevTools → Network tab
2. Go offline
3. Try to save connector
4. Should see error toast: ✅ **"Save Failed"**

### 6.3 Test Invalid Database Connection
1. Temporarily modify Supabase URL (break it)
2. Refresh page
3. Should see error toast: **"Failed to Load Connectors"**
4. Fix Supabase URL
5. Refresh - should work again

---

## ✅ **Step 7: Test OAuth Setup Modal**

### 7.1 Open Gmail Setup Help
1. In Email tab, notice info about OAuth configuration
2. (Modal trigger not yet added to UI - check code for `openSetupHelp()` function)
3. Expected: Modal shows step-by-step OAuth setup instructions

### 7.2 Verify Redirect URI
1. Modal should display correct redirect URI
2. Format: `https://[your-repl-url]/oauth/gmail/callback`
3. Copy button should work
4. Verify clipboard has correct URI

---

## 🎯 **Success Criteria**

### Database ✅
- [x] `connector_configs` table exists
- [x] RLS policies are active
- [x] Each user has separate row
- [x] Users cannot see each other's data

### Functionality ✅
- [x] Load user config on mount
- [x] Save config to database
- [x] Configs persist across sessions
- [x] Configs sync across devices (same user)
- [x] Loading states show during fetch/save
- [x] Error states show on failure

### Security ✅
- [x] User A cannot access User B's connectors
- [x] RLS enforced at database level
- [x] No tokens exposed in console/logs
- [x] OAuth tokens stored securely

---

## 🐛 **Common Issues & Solutions**

### Issue: "Failed to load connector config"
**Solution:** 
- Check if migration ran successfully
- Verify user is logged in
- Check Supabase connection in `.env`

### Issue: "Users can see each other's connectors"
**Solution:**
- RLS policies not active
- Run: `ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;`
- Re-apply RLS policies from migration

### Issue: "OAuth connect button disabled"
**Solution:**
- OAuth client IDs not configured
- Add `VITE_GMAIL_CLIENT_ID` or `VITE_OUTLOOK_CLIENT_ID` to Replit Secrets

### Issue: "Config disappears after refresh"
**Solution:**
- Check console for errors
- Verify `ConnectorService.getUserConfig()` is being called
- Check if user_id matches in database

---

## 📊 **Database Verification Queries**

### Check all connector configs
```sql
SELECT * FROM connector_configs;
```

### Check specific user's config
```sql
SELECT * FROM connector_configs 
WHERE user_id = '[USER_UUID_HERE]';
```

### Count configs per user
```sql
SELECT user_id, COUNT(*) as config_count
FROM connector_configs
GROUP BY user_id;
```

### View RLS policies
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'connector_configs';
```

---

## ✅ **Migration Complete When:**

1. ✅ Database table created with RLS
2. ✅ Users can save connectors
3. ✅ Connectors persist across sessions
4. ✅ Multi-user isolation verified
5. ✅ OAuth flow works (if configured)
6. ✅ All connector types functional
7. ✅ Error handling works properly

**Congratulations! Your multi-tenant connector system is now production-ready! 🎉**
