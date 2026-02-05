# 🏢 Office 365 Integration Guide for Agent Sophia

## 📋 OVERVIEW

This guide will help you integrate Agent Sophia with your **Microsoft 365 suite** via **Microsoft Graph API**. Once configured, Sophia will be able to:

- ✅ **Send emails** through your Outlook account
- ✅ **Read inbox responses** automatically
- ✅ **Book calendar meetings** when leads are qualified
- ✅ **Sync contacts** between CRM and Office 365
- ✅ **Access OneDrive** for document storage (optional)

**Estimated Setup Time:** 15 minutes

---

## 🎯 STEP 1: Create Microsoft Azure App Registration

###  **1.1 Go to Azure Portal**

Visit: [https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)

*Sign in with your Office 365/Microsoft 365 account*

### **1.2 Register New Application**

1. Click **"+ New registration"** button
2. Fill in the details:
   - **Name:** `Agent Sophia Office 365`
   - **Supported account types:** Select:
     - ✅ **"Accounts in any organizational directory and personal Microsoft accounts (Personal Microsoft account and Azure AD - Multitenant)"**
   - **Redirect URI:**
     - Platform: **Web**
     - URL: `https://YOUR_REPLIT_URL/oauth/office365/callback`
       - Replace with your actual Replit URL (e.g., `https://myapp-username.replit.app/oauth/office365/callback`)

3. Click **"Register"**

### **1.3 Copy Application (Client) ID**

After registration, you'll see the **Overview** page:

1. Copy the **"Application (client) ID"** value
2. Save it for later (you'll need it in Step 3)

Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

## 🔐 STEP 2: Create Client Secret

### **2.1 Navigate to Certificates & Secrets**

1. In your app's left sidebar, click **"Certificates & secrets"**
2. Under **"Client secrets"**, click **"+ New client secret"**

### **2.2 Create Secret**

1. **Description:** `Agent Sophia Secret`
2. **Expires:** Choose based on security needs:
   - 6 months (recommended for testing)
   - 24 months (production)
   - Custom (enterprise)
3. Click **"Add"**

### **2.3 Copy Secret Value**

⚠️ **IMPORTANT:** The secret value is only shown ONCE!

1. Copy the **"Value"** column (NOT the Secret ID)
2. Save it securely (you'll need it in Step 3)

Example: `a1B2c~D3e.F4g5H6-i7J8k9L0m1N2o3P4q5R6s7T`

---

## 🔑 STEP 3: Configure API Permissions

### **3.1 Navigate to API Permissions**

1. In your app's left sidebar, click **"API permissions"**
2. Click **"+ Add a permission"**

### **3.2 Add Microsoft Graph Permissions**

**For each permission below:**
1. Click **"Microsoft Graph"**
2. Click **"Delegated permissions"**
3. Search and check the permission
4. Click **"Add permissions"**

**Required Permissions:**

| Permission | Purpose | Type |
|------------|---------|------|
| `User.Read` | Read user profile | Delegated |
| `Mail.Send` | Send emails as user | Delegated |
| `Mail.Read` | Read inbox responses | Delegated |
| `Mail.ReadWrite` | Manage emails | Delegated |
| `Calendars.ReadWrite` | Book meetings | Delegated |
| `Contacts.ReadWrite` | Sync contacts | Delegated |
| `offline_access` | Refresh tokens | Delegated |

### **3.3 Grant Admin Consent (Optional but Recommended)**

If you're an admin:
1. Click **"Grant admin consent for [Your Organization]"**
2. Click **"Yes"** to confirm

*This prevents users from seeing consent prompts*

---

## ⚙️ STEP 4: Add Secrets to Replit

### **4.1 Open Replit Secrets Manager**

In your Replit project:
1. Click the **"Tools"** button (left sidebar)
2. Select **"Secrets"**
3. Or click the lock icon 🔒

### **4.2 Add Office 365 Credentials**

Add the following secrets:

#### **Secret 1: Client ID**
- **Key:** `VITE_OFFICE365_CLIENT_ID`
- **Value:** Paste your Application (Client) ID from Step 1.3

#### **Secret 2: Client Secret**
- **Key:** `OFFICE365_CLIENT_SECRET`
- **Value:** Paste your Client Secret Value from Step 2.3

#### **Secret 3: Tenant ID (Optional for single-tenant apps)**
- **Key:** `OFFICE365_TENANT_ID`
- **Value:** Your tenant ID (found on Azure app Overview page)
  - Use `common` for multi-tenant
  - Use your tenant GUID for single-tenant

**Example Secrets:**
```
VITE_OFFICE365_CLIENT_ID=a1b2c3d4-e5f6-7890-abcd-ef1234567890
OFFICE365_CLIENT_SECRET=a1B2c~D3e.F4g5H6-i7J8k9L0m1N2o3P4q5R6s7T
OFFICE365_TENANT_ID=common
```

---

## 🔗 STEP 5: Connect Agent Sophia to Office 365

### **5.1 Navigate to Agent Sophia**

1. Go to your AI Lead Platform
2. Click **"Agent Sophia"** in the sidebar
3. Click the **"Automation"** tab

### **5.2 Click Connect to Office 365**

1. Scroll to the **"Office 365 Integration"** card
2. Click **"Connect to Office 365"** button
3. A Microsoft login popup will appear

### **5.3 Authorize Application**

In the Microsoft popup:
1. **Select your account** (the Office 365 account you want to use)
2. **Review permissions** - Click "Accept" to grant access
3. The popup will close automatically on success

### **5.4 Verify Connection**

After connection:
- ✅ Green "Connected" badge appears
- ✅ Your email address is displayed
- ✅ "Test Connection" button becomes available

Click **"Test Connection"** to verify everything works!

---

## 🧪 STEP 6: Test the Integration

### **Test 1: Send Test Email**

```javascript
// Run this in browser console (while logged in):
const testEmail = await fetch('/api/agent-sophia/send-email', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: 'test@example.com',
    subject: 'Test from Agent Sophia',
    body: 'This email was sent via Microsoft Graph API!',
    provider: 'office365'
  })
});

console.log(await testEmail.json());
```

**Expected Result:**
- ✅ Email sent successfully
- ✅ Email appears in your "Sent Items" folder in Outlook
- ✅ Recipient receives the email

### **Test 2: Book Calendar Meeting**

```javascript
// Run this in browser console:
const testMeeting = await fetch('/api/agent-sophia/book-meeting', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    attendees: ['lead@example.com'],
    subject: 'Demo Meeting - Agent Sophia',
    startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    duration: 30, // minutes
    provider: 'office365'
  })
});

console.log(await testMeeting.json());
```

**Expected Result:**
- ✅ Meeting created in your Outlook Calendar
- ✅ Invite sent to attendee
- ✅ You can see it in Outlook/Calendar app

### **Test 3: Read Inbox**

```javascript
// Run this in browser console:
const testInbox = await fetch('/api/agent-sophia/read-inbox?provider=office365');
console.log(await testInbox.json());
```

**Expected Result:**
- ✅ Returns recent emails from your inbox
- ✅ Shows sender, subject, and preview

---

## 🚀 STEP 7: Enable Agent Sophia Automation

### **7.1 Configure Campaign Settings**

In the **Automation tab**:

1. ✅ **Enable "Auto-Create Campaigns"**
2. ✅ **Select "Email" channel** (Office 365)
3. Set **Daily Campaign Limit:** 3-5
4. Set **Max Leads Per Campaign:** 50-100

### **7.2 Set Meeting Booking**

In the **Configuration tab**:

1. ✅ **Enable "Auto-book qualified leads"**
2. Your Office 365 calendar will be used automatically

### **7.3 Activate Agent Sophia**

1. Toggle **"Agent Sophia Active"** to ON
2. Click **"Save All Settings"**

**🎉 Agent Sophia is now live with Office 365!**

---

## 🔍 TROUBLESHOOTING

### **Error: "VITE_OFFICE365_CLIENT_ID not configured"**

**Solution:**
- Add the secret `VITE_OFFICE365_CLIENT_ID` in Replit Secrets
- Restart your Repl (click "Restart" button)

### **Error: "Invalid redirect URI"**

**Solution:**
- Go to Azure Portal → Your App → "Authentication"
- Add your exact callback URL: `https://YOUR_URL/oauth/office365/callback`
- Make sure it matches exactly (including https://)

### **Error: "AADSTS65001: Consent required"**

**Solution:**
- You need to accept permissions
- Disconnect and reconnect in Agent Sophia
- Make sure all permissions are added in Azure Portal

### **Error: "Access token expired"**

**Solution:**
- Token refresh is automatic
- If issues persist, disconnect and reconnect
- Check `offline_access` permission is granted

### **Error: "Insufficient privileges"**

**Solution:**
- Go to Azure Portal → API Permissions
- Make sure all required permissions are added
- Click "Grant admin consent"

### **Emails Not Sending**

**Check:**
1. ✅ Office 365 connected successfully?
2. ✅ `Mail.Send` permission granted?
3. ✅ Email connector status shows "Active"?
4. ✅ Check Outlook "Sent Items" folder
5. ✅ Check browser console for errors

### **Calendar Not Syncing****

Check:**
1. ✅ `Calendars.ReadWrite` permission granted?
2. ✅ Meeting booking enabled in settings?
3. ✅ Check Outlook Calendar for created events

---

## 📊 MONITORING

### **Check Agent Sophia Activity**

```sql
-- View Office 365 activities
SELECT 
  activity_type,
  metadata->>'provider' as provider,
  outcome,
  created_at
FROM agent_activities
WHERE metadata->>'provider' = 'office365'
ORDER BY created_at DESC
LIMIT 20;
```

### **Check Sent Emails**

```sql
-- View emails sent via Office 365
SELECT 
  channel,
  provider,
  status,
  metadata->>'subject' as subject,
  sent_at
FROM sophia_sent_messages
WHERE channel = 'email' 
  AND provider = 'office365'
ORDER BY sent_at DESC;
```

### **Monitor in Office 365**

- **Sent Items:** Check Outlook for sent emails
- **Calendar:** Check created meetings
- **Activity Log:** Azure Portal → App → "Sign-in logs"

---

## 🎯 WHAT AGENT SOPHIA CAN NOW DO

With Office 365 integration, Agent Sophia will automatically:

1. **📧 Email Outreach**
   - Send personalized emails from your Outlook
   - All emails appear in your "Sent Items"
   - Uses your email signature automatically

2. **📨 Inbox Management**
   - Read responses from leads
   - Classify intent (interested/objection/question)
   - Trigger appropriate follow-ups

3. **📅 Meeting Booking**
   - Book meetings when leads are qualified
   - Send calendar invites automatically
   - Check your availability first

4. **👥 Contact Sync**
   - Sync CRM contacts to Office 365 People
   - Keep contact information up to date
   - Two-way synchronization

5. **📊 Activity Tracking**
   - All activities logged to database
   - Viewable in Activity Log tab
   - Exportable to CSV

---

## 🔐 SECURITY BEST PRACTICES

1. **Refresh Tokens**
   - Tokens automatically refresh (no re-authentication needed)
   - Stored securely in localStorage (consider upgrading to database)

2. **Permissions**
   - Only grant minimum required permissions
   - Review permissions periodically
   - Revoke access if no longer needed

3. **Monitoring**
   - Check Azure "Sign-in logs" regularly
   - Monitor sent emails in Outlook
   - Review Agent Sophia activity logs

4. **Disconnect When Not Needed**
   - Click "Disconnect" button to revoke access
   - Re-connect anytime with one click

---

## 📝 DEPLOYMENT CHECKLIST

- [ ] Azure App created successfully
- [ ] Client ID and Secret copied
- [ ] All Microsoft Graph permissions added
- [ ] Admin consent granted (if applicable)
- [ ] Secrets added to Replit
- [ ] Repl restarted after adding secrets
- [ ] Office 365 connected in Agent Sophia
- [ ] Test email sent successfully
- [ ] Test meeting created successfully
- [ ] Inbox reading tested
- [ ] Agent Sophia activated
- [ ] Monitoring set up

**✅ All Done! Agent Sophia is fully integrated with Office 365!**

---

## 🆘 SUPPORT

**Need Help?**

1. Check troubleshooting section above
2. Review Azure Portal activity logs
3. Check browser console for errors
4. Verify all permissions are granted
5. Test connection in Agent Sophia

**Common Resources:**

- [Microsoft Graph API Docs](https://learn.microsoft.com/en-us/graph/overview)
- [Azure App Registration Guide](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
- [OAuth 2.0 Flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)

