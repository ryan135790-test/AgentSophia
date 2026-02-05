# OAuth Architecture for SaaS Multi-Tenancy

## 🎯 How OAuth Works in Your SaaS Application

### The Correct Architecture (What We're Building)

```
Platform Owner (You)
  ↓
Creates ONE OAuth App in Google/Microsoft
  ↓
Gets Client ID (stored as VITE_GMAIL_CLIENT_ID / VITE_OUTLOOK_CLIENT_ID)
  ↓
Each User Connects THEIR Email Account
  ↓
User's OAuth Tokens Stored in Database (Per-User)
  ↓
Campaigns Send from User's Email Using Their Tokens
```

### Key Concepts

#### 1. **Platform-Wide OAuth Client IDs** ✅
- **What:** Your app's credentials with Google/Microsoft
- **Who Sets Up:** You (the platform owner) - ONE TIME
- **Where Stored:** Replit Secrets (environment variables)
- **Example:** `VITE_GMAIL_CLIENT_ID=123456.apps.googleusercontent.com`

#### 2. **User-Specific OAuth Tokens** ✅
- **What:** Access tokens allowing your app to send emails AS the user
- **Who Sets Up:** Each individual user clicks "Connect Gmail"
- **Where Stored:** Database `connector_configs` table (per user_id)
- **Isolation:** User A cannot see or use User B's tokens (Row Level Security)

## 🔐 Security & Isolation

### Row Level Security (RLS)
```sql
-- Users can only access their own connector configs
CREATE POLICY "Users can view own connector configs"
  ON connector_configs
  FOR SELECT
  USING (auth.uid() = user_id);
```

### What Each User Sees
- **User A**: Sees only their Gmail connection (user_a@company.com)
- **User B**: Sees only their Outlook connection (user_b@business.com)
- **User C**: Sees only their SendGrid API key

## 📊 Two OAuth Models Supported

### Model 1: Standard User-Level OAuth (Recommended for Most)

**Use Case:** SaaS platform where users have different email providers

**Flow:**
1. User clicks "Connect Gmail" in their account
2. Popup opens → User logs into THEIR Google account
3. User authorizes YOUR app to send emails on their behalf
4. OAuth tokens saved to database tied to their user_id
5. When user sends campaign → Your app uses THEIR tokens → Email sent from THEIR address

**Benefits:**
- ✅ Works with any email provider
- ✅ Users maintain full control
- ✅ No admin setup required per user
- ✅ Perfect for SMBs and individual users

### Model 2: Enterprise Domain-Wide OAuth

**Use Case:** Enterprise clients with Google Workspace or Microsoft 365

**Flow:**
1. Admin sets up domain-wide delegation once
2. All users in organization@company.com can use without individual auth
3. Single service account manages all organization emails

**Benefits:**
- ✅ Centralized control for IT admins
- ✅ Users don't need to authorize individually
- ✅ Compliance and governance built-in
- ✅ Perfect for enterprise clients

**Setup Required:**
- Google Workspace Admin privileges
- Domain-wide delegation configuration
- Service account key
- Additional scopes approval

## 🛠️ Implementation Details

### Database Schema
```sql
connector_configs table:
  - user_id (FK to auth.users) - Ensures per-user isolation
  - email_provider (gmail/outlook/sendgrid/etc)
  - email_access_token (OAuth token - encrypted at rest)
  - email_refresh_token (For token renewal)
  - email_token_expiry (When token expires)
  - email_user_email (Connected email address)
  + RLS policies enforce user_id = auth.uid()
```

### Frontend Service
```typescript
// Each user's connectors are fetched/saved per their user_id
ConnectorService.getUserConfig()  // Gets current user's config only
ConnectorService.saveUserConfig() // Saves to current user's row only
```

## 🚀 Setup Instructions

### For Platform Owner (One-Time Setup)

**Gmail:**
1. Create Google Cloud project
2. Enable Gmail API
3. Create OAuth Client ID
4. Add redirect URI: `https://yourapp.repl.co/oauth/gmail/callback`
5. Add Client ID to Replit Secrets: `VITE_GMAIL_CLIENT_ID`

**Outlook:**
1. Register Azure AD application
2. Add API permissions (Mail.Send, User.Read)
3. Add redirect URI: `https://yourapp.repl.co/oauth/outlook/callback`
4. Add Client ID to Replit Secrets: `VITE_OUTLOOK_CLIENT_ID`

### For Each User (Self-Service)

**Standard Users:**
1. Log into your account
2. Go to Settings → Connectors
3. Click "Connect Gmail" or "Connect Outlook"
4. Authorize with your email account
5. Done! Your campaigns will send from your email

**Enterprise Admins:**
1. Follow domain-wide delegation setup (see OAuth Setup Modal)
2. Configure service account
3. All users in domain can send without individual auth

## 🔄 Token Management

### Automatic Token Refresh
- OAuth tokens expire (typically after 1 hour)
- Refresh tokens allow getting new access tokens
- System automatically refreshes before expiry
- No user intervention needed

### Token Storage
- Encrypted in database at rest
- Never exposed in frontend code
- Transmitted over HTTPS only
- Deleted when user disconnects

## ❓ FAQ

**Q: Do I need to create a Google/Microsoft account for each user?**
A: No! You create ONE OAuth app. Each user connects THEIR OWN Google/Microsoft account.

**Q: Can users connect multiple email accounts?**
A: Currently one per user. Can be extended to support multiple by changing the unique constraint.

**Q: What if a user's token expires?**
A: We store refresh tokens to automatically get new access tokens without user re-auth.

**Q: Is this secure?**
A: Yes! Row Level Security ensures users can only access their own tokens. Tokens are encrypted at rest in Supabase.

**Q: Can admins see user tokens?**
A: No. Even admins can't see the actual token values (encrypted). Admins can see IF a user is connected.

**Q: What about GDPR/compliance?**
A: Users can disconnect anytime (deletes their tokens). Database follows Supabase's SOC2/GDPR compliance.

## 📝 Next Steps

1. ✅ Run database migration to create `connector_configs` table
2. ✅ Update `ChannelConnectors` component to use `ConnectorService`
3. ✅ Test multi-user isolation
4. ✅ Add token refresh logic
5. ✅ Deploy and let users connect their accounts!

## 🎯 Summary

**The Magic of OAuth in SaaS:**
- ONE OAuth app (yours) serves ALL users
- Each user authorizes YOUR app to access THEIR account
- Tokens are stored per-user in database
- Each user's campaigns send from THEIR email
- Perfect isolation and security via RLS

This is the standard architecture used by Mailchimp, HubSpot, and all major SaaS email platforms!
