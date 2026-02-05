# Office 365 OAuth Troubleshooting - Fix "Connection Failed"

## 🎯 Most Common Issues (Fix These First)

### Issue 1: Client Secret Mismatch (60% of cases)

**Problem:** The secret in Supabase doesn't exactly match Azure.

**Fix:**
1. **Azure Portal** → App registrations → Your app → Certificates & secrets
2. **Delete the old secret** and **create a new one**
3. **Copy the VALUE** (not the Secret ID!)
4. **Update in TWO places:**
   - **Replit Secrets:** `OFFICE365_CLIENT_SECRET` = [paste new secret]
   - **Supabase Dashboard** → Project Settings → Edge Functions → Secrets:
     - Delete `OFFICE365_CLIENT_SECRET`
     - Add new `OFFICE365_CLIENT_SECRET` = [paste new secret]
5. **Wait 1 minute** for secrets to propagate
6. **Test again**

---

### Issue 2: Redirect URI Exact Match (25% of cases)

**Problem:** Even a tiny difference breaks OAuth.

**Fix:**
1. **Get your EXACT Replit URL:**
   ```
   https://[your-repl-name].[your-username].repl.co/oauth/office365/callback
   ```
   
2. **Azure Portal** → App registrations → Your app → Authentication → Platform configurations → Web

3. **Verify EXACT match (including):**
   - ✅ HTTPS (not HTTP)
   - ✅ No trailing slash
   - ✅ Exact subdomain
   - ✅ `/oauth/office365/callback` path

4. **If different, UPDATE it in Azure** to match EXACTLY

5. **Save** and test again

---

### Issue 3: Scopes vs Permissions Mismatch (10% of cases)

**Problem:** Your code requests scopes that aren't granted in Azure.

**Fix:**
1. **Check what scopes are in your code:**
   - Open: `src/components/agent-sophia/office365-connector.tsx`
   - Look for the `scope` parameter in the authorization URL
   - Should be: `openid profile email offline_access Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite`

2. **Azure Portal** → App registrations → Your app → API permissions

3. **Verify these permissions are granted:**
   - ✅ User.Read (Delegated)
   - ✅ Mail.ReadWrite (Delegated)
   - ✅ Mail.Send (Delegated)
   - ✅ Calendars.ReadWrite (Delegated)
   - ✅ Contacts.ReadWrite (Delegated)
   - ✅ offline_access (Delegated)

4. **If missing, add them** and click "Grant admin consent"

---

### Issue 4: Tenant ID Issue (5% of cases)

**Problem:** "common" tenant not working for this app type.

**Fix:**
1. **Azure Portal** → Home → Tenant properties
2. **Copy your Tenant ID** (UUID like: 12345678-1234-1234-1234-123456789abc)

3. **Update secrets:**
   - **Replit:** Change `OFFICE365_TENANT_ID` from "common" to your actual tenant ID
   - **Supabase:** Change `OFFICE365_TENANT_ID` to your actual tenant ID

4. **Test again**

---

## 🔧 Quick Diagnostic Checklist

Run through this checklist:

- [ ] **Client Secret** - Regenerated in Azure and updated in both Replit + Supabase
- [ ] **Redirect URI** - EXACTLY matches in Azure (no trailing slash, correct HTTPS URL)
- [ ] **API Permissions** - All 6 permissions granted with admin consent in Azure
- [ ] **Tenant ID** - Either "common" OR your specific tenant ID (not both)
- [ ] **Secrets Synced** - All 3 secrets match in Replit AND Supabase:
  - OFFICE365_CLIENT_ID
  - OFFICE365_CLIENT_SECRET
  - OFFICE365_TENANT_ID

---

## 🚀 After Each Fix:

1. **Wait 30-60 seconds** for secrets to propagate
2. **Hard refresh** your app (Ctrl+Shift+R or Cmd+Shift+R)
3. **Click "Connect to Office 365"** again
4. **Check if error changes**

---

## 💡 Pro Tips:

**Best Practice: Start Fresh**
If you've tried multiple things, sometimes it's best to:
1. Generate a NEW client secret in Azure
2. Update BOTH Replit and Supabase with the new secret
3. Verify redirect URI is EXACT
4. Test with a clean slate

**Check Supabase Edge Function Secrets:**
Make sure all 3 secrets are in Supabase:
```
OFFICE365_CLIENT_ID = 97179d0d-ffd1-44e5-b75f-3f4d5b0554be
OFFICE365_CLIENT_SECRET = [your secret value]
OFFICE365_TENANT_ID = common (or your tenant ID)
```

---

## 📊 Success Indicators:

You'll know it's working when:
- ✅ No "Failed to exchange authorization code" error
- ✅ See "Successfully connected to Office 365!"
- ✅ Your email address appears in the connected account status
- ✅ Can send test emails

---

## 🆘 Still Not Working?

If you've tried all 4 fixes above and still get the error, then we need to see Microsoft's specific error code. Follow **Path B in OFFICE365_NEXT_STEPS.md** to check the Supabase logs for the AADSTS error code.

The error code will look like: `AADSTS70002` or `AADSTS50011` and will tell us exactly what's wrong.
