# 🔧 Agent Sophia - Admin One-Time Setup Guide

## 📋 OVERVIEW

This guide is for **platform administrators** only. Complete this setup **once** to enable all your customers to connect their Office 365 and social media accounts with a single click.

**Time Required:** 60-90 minutes (one-time only)  
**Result:** All customers can connect in 30 seconds

---

## ✅ SETUP CHECKLIST

- [ ] Microsoft Azure App (Office 365)
- [ ] LinkedIn Developer App
- [ ] Twitter Developer App  
- [ ] Facebook Developer App (for Facebook + Instagram)
- [ ] Supabase Edge Functions Deployed
- [ ] Environment Variables Configured
- [ ] Test Connections Verified

---

## 🏢 PART 1: Microsoft 365 / Office 365 Setup

### **Step 1.1: Create Azure App Registration**

1. Go to: [https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps)
2. Click **"+ New registration"**
3. Configure:
   - **Name:** `AI Lead Platform - Office 365`
   - **Supported account types:** ✅ **Multitenant + Personal accounts**
   - **Redirect URI:**
     - Platform: **Web**
     - URL: `https://YOUR_DOMAIN/oauth/office365/callback`

4. Click **"Register"**

### **Step 1.2: Copy Credentials**

1. On the Overview page, copy:
   - **Application (client) ID** → Save as `OFFICE365_CLIENT_ID`
   - **Directory (tenant) ID** → Use `common` for multitenant

2. Go to **"Certificates & secrets"**
3. Click **"+ New client secret"**
4. Description: `Production Secret`
5. Expires: **24 months**
6. Click **"Add"** and copy the **Value** → Save as `OFFICE365_CLIENT_SECRET`

### **Step 1.3: Configure API Permissions**

1. Go to **"API permissions"**
2. Click **"+ Add a permission"** → **"Microsoft Graph"** → **"Delegated permissions"**
3. Add these permissions:
   - `User.Read`
   - `Mail.Send`
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `Calendars.ReadWrite`
   - `Contacts.ReadWrite`
   - `offline_access`

4. Click **"Grant admin consent"** (if you're admin)

---

## 💼 PART 2: LinkedIn Developer App Setup

### **Step 2.1: Create LinkedIn App**

1. Go to: [https://www.linkedin.com/developers/apps](https://www.linkedin.com/developers/apps)
2. Click **"Create app"**
3. Configure:
   - **App name:** `AI Lead Platform`
   - **LinkedIn Page:** Select your company page
   - **App logo:** Upload your logo
   - **Legal agreement:** Accept

4. Click **"Create app"**

### **Step 2.2: Configure OAuth Settings**

1. On the app page, go to **"Auth"** tab
2. Copy:
   - **Client ID** → Save as `LINKEDIN_CLIENT_ID`
   - **Client Secret** → Save as `LINKEDIN_CLIENT_SECRET`

3. Add **Redirect URLs:**
   - `https://YOUR_DOMAIN/oauth/linkedin/callback`

4. Go to **"Products"** tab
5. Request access to:
   - ✅ **"Share on LinkedIn"**
   - ✅ **"Sign In with LinkedIn using OpenID Connect"**

---

## 🐦 PART 3: Twitter/X Developer App Setup

### **Step 3.1: Create Twitter App**

1. Go to: [https://developer.twitter.com/en/portal/dashboard](https://developer.twitter.com/en/portal/dashboard)
2. Apply for **Elevated access** (free, required for posting)
3. Click **"+ Create Project"**
4. Project name: `AI Lead Platform`
5. Click **"+ Add App"** → **"Production"**
6. App name: `ai-lead-platform`

### **Step 3.2: Configure OAuth 2.0**

1. Click on your app → **"Keys and tokens"** tab
2. Scroll to **"OAuth 2.0 Client ID and Client Secret"**
3. Copy:
   - **Client ID** → Save as `TWITTER_CLIENT_ID`
   - **Client Secret** → Save as `TWITTER_CLIENT_SECRET`

4. Go to **"User authentication settings"** → **"Edit"**
5. Configure:
   - **App permissions:** ✅ **Read and write**
   - **Type of App:** **Web App**
   - **Callback URI:** `https://YOUR_DOMAIN/oauth/twitter/callback`
   - **Website URL:** `https://YOUR_DOMAIN`

6. Save

---

## 📘 PART 4: Facebook + Instagram Setup

### **Step 4.1: Create Facebook App**

1. Go to: [https://developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click **"Create App"**
3. Use case: **"Other"** → **"Business"**
4. App name: `AI Lead Platform`
5. Contact email: Your email
6. Click **"Create app"**

### **Step 4.2: Configure Facebook Login**

1. Click **"Add Product"** → **"Facebook Login"** → **"Set up"**
2. Platform: **Web**
3. Site URL: `https://YOUR_DOMAIN`

4. Go to **"Facebook Login"** → **"Settings"**
5. Add **Valid OAuth Redirect URIs:**
   - `https://YOUR_DOMAIN/oauth/facebook/callback`
   - `https://YOUR_DOMAIN/oauth/instagram/callback`

### **Step 4.3: Add Instagram Graph API**

1. Click **"Add Product"** → **"Instagram Graph API"**
2. This enables Instagram posting via Facebook

### **Step 4.4: Copy Credentials**

1. Go to **"Settings"** → **"Basic"**
2. Copy:
   - **App ID** → Save as `FACEBOOK_APP_ID`
   - **App Secret** → Save as `FACEBOOK_APP_SECRET`

### **Step 4.5: Set App to Live**

1. Top of page, switch from **"Development"** to **"Live"**
2. Add **Privacy Policy URL** and **Terms of Service URL**
3. Submit for **App Review** (for production use with users outside your organization)

---

## 🚀 PART 5: Deploy Supabase Edge Functions

### **Option A: Via Supabase CLI (Recommended)**

```bash
# Deploy all Office 365 functions
supabase functions deploy office365-token-exchange
supabase functions deploy office365-send-email
supabase functions deploy office365-read-inbox
supabase functions deploy office365-book-meeting

# Deploy all social media functions
supabase functions deploy linkedin-post
supabase functions deploy twitter-post
supabase functions deploy facebook-post
supabase functions deploy instagram-post
```

### **Option B: Via Supabase Dashboard**

1. Go to your Supabase Dashboard → **Edge Functions**
2. For each function:
   - Click **"Deploy a new function"**
   - Copy contents from `supabase/functions/[function-name]/index.ts`
   - Paste into editor
   - Click **"Deploy function"**

---

## ⚙️ PART 6: Configure Environment Variables

### **Replit Secrets**

Add these secrets in Replit (🔒 Secrets panel):

```bash
# Office 365
OFFICE365_CLIENT_ID=your-azure-client-id
OFFICE365_CLIENT_SECRET=your-azure-client-secret
OFFICE365_TENANT_ID=common

# Frontend (VITE_ prefix required)
VITE_OFFICE365_CLIENT_ID=your-azure-client-id

# LinkedIn
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
VITE_LINKEDIN_CLIENT_ID=your-linkedin-client-id

# Twitter
TWITTER_CLIENT_ID=your-twitter-client-id
TWITTER_CLIENT_SECRET=your-twitter-client-secret
VITE_TWITTER_CLIENT_ID=your-twitter-client-id

# Facebook/Instagram
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
VITE_FACEBOOK_APP_ID=your-facebook-app-id
```

### **Supabase Environment Variables**

Add these in Supabase Dashboard → Settings → Edge Functions → Secrets:

```bash
supabase secrets set OFFICE365_CLIENT_ID=your-value
supabase secrets set OFFICE365_CLIENT_SECRET=your-value
supabase secrets set LINKEDIN_CLIENT_ID=your-value
supabase secrets set LINKEDIN_CLIENT_SECRET=your-value
supabase secrets set TWITTER_CLIENT_ID=your-value
supabase secrets set TWITTER_CLIENT_SECRET=your-value
supabase secrets set FACEBOOK_APP_ID=your-value
supabase secrets set FACEBOOK_APP_SECRET=your-value
```

---

## 🧪 PART 7: Test All Integrations

### **Test Office 365**

1. Log into your platform
2. Go to Agent Sophia → Automation tab
3. Click **"Connect to Office 365"**
4. Sign in with your Microsoft account
5. Verify connection successful
6. Click **"Test Connection"**

### **Test LinkedIn**

1. Click **"Connect"** on LinkedIn card
2. Sign in with LinkedIn
3. Verify connection successful

### **Test Twitter**

1. Click **"Connect"** on Twitter card
2. Authorize with Twitter
3. Verify connection successful

### **Test Facebook/Instagram**

1. Click **"Connect"** on Facebook/Instagram card
2. Sign in with Facebook
3. Select your Pages and Instagram accounts
4. Verify connection successful

---

## 📊 PART 8: Monitor Usage & Limits

### **API Rate Limits**

| Platform | Free Tier | Rate Limit |
|----------|-----------|------------|
| Office 365 | ✅ Included | 10,000 requests/day |
| LinkedIn | ✅ Free | 100 posts/day per user |
| Twitter | ✅ Free (Elevated) | 1,500 tweets/month |
| Facebook | ✅ Free | 200 API calls/hour |
| Instagram | ✅ Free | 200 posts/day |

### **Monitor in Dashboards**

- **Azure:** portal.azure.com → Your App → Metrics
- **LinkedIn:** LinkedIn Developers → Your App → Analytics
- **Twitter:** developer.twitter.com → Dashboard
- **Facebook:** developers.facebook.com → Your App → Dashboard

---

## 🎉 DONE! Your Platform is Ready

✅ Customers can now connect in **30 seconds**:
1. Click "Connect to Office 365/LinkedIn/Twitter/Facebook/Instagram"
2. Sign in
3. Done!

✅ Agent Sophia has **full automation** across:
- 📧 Email (Office 365)
- 📅 Calendar (Office 365)
- 👥 Contacts (Office 365)
- 💼 LinkedIn posting
- 🐦 Twitter posting
- 📘 Facebook posting
- 📸 Instagram posting

---

## 🆘 TROUBLESHOOTING

### **"Invalid redirect URI" errors**

- Make sure redirect URIs exactly match in all developer portals
- Include `https://` prefix
- No trailing slashes

### **"Missing permissions" errors**

- Verify all API permissions are granted
- Click "Grant admin consent" in Azure
- Wait 5-10 minutes for changes to propagate

### **Edge Functions not working**

- Check Supabase logs: Dashboard → Edge Functions → Logs
- Verify environment variables set correctly
- Redeploy functions

### **OAuth popup blocked**

- Allow popups in browser settings
- Test in incognito mode
- Try different browser

---

## 🔒 SECURITY BEST PRACTICES

1. **Never commit secrets to Git**
2. **Use environment variables only**
3. **Rotate secrets quarterly**
4. **Monitor API usage daily**
5. **Review connected accounts weekly**
6. **Enable 2FA on all developer accounts**

---

## 📝 MAINTENANCE

### **Quarterly Tasks**

- [ ] Rotate all client secrets
- [ ] Review API usage and limits
- [ ] Check for deprecated API versions
- [ ] Update Edge Functions if needed

### **Annual Tasks**

- [ ] Renew Azure client secret (if 1-year expiry)
- [ ] Review Facebook App submission status
- [ ] Update privacy policy and terms
- [ ] Audit connected accounts

---

**Setup Complete!** 🎉

Your customers can now connect all platforms in seconds, and Agent Sophia has full automation capabilities across Office 365 and all social media platforms.
