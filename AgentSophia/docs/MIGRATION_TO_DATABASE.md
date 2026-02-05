# Migration to Database-Backed Multi-Tenant Connectors

## ✅ What's Been Completed

### 1. Database Schema (`supabase/migrations/20251020162000_create_connector_configs_table.sql`)
- Created `connector_configs` table for storing user-specific connector settings
- Added Row Level Security (RLS) policies for multi-tenant isolation
- Set up automatic timestamp updates
- Each user can only see/edit their own connectors

### 2. Service Layer (`src/lib/connector-service.ts`)
- Created `ConnectorService` class for database operations
- Methods: `getUserConfig()`, `saveUserConfig()`, `deleteUserConfig()`
- Maps between database snake_case and TypeScript camelCase
- Fully type-safe with Supabase types

### 3. Type Definitions (`src/integrations/supabase/types.ts`)
- Added `connector_configs` table types
- Full TypeScript support for Insert/Update/Select operations

### 4. OAuth Architecture Documentation (`docs/OAUTH_ARCHITECTURE.md`)
- Complete explanation of multi-tenant OAuth
- Setup instructions for platform owners
- User flow documentation

### 5. OAuth Setup Modal (`src/components/connectors/oauth-setup-modal.tsx`)
- Interactive setup guide for Gmail/Outlook OAuth
- Shows redirect URIs, step-by-step instructions
- Explains both Standard and Enterprise domain-wide OAuth

## 🚧 What Needs Completion

### ChannelConnectors Component Update
The `src/components/connectors/channel-connectors.tsx` file needs to be fully updated to use the new flat `ConnectorConfig` structure. Here's what needs to change:

**Old Structure (Nested):**
```typescript
config.email?.provider
config.email?.apiKey
config.sms?.accountSid
```

**New Structure (Flat):**
```typescript
config.emailProvider
config.emailApiKey
config.smsAccountSid
```

### Changes Needed:

1. **Email Connector Section:**
   - Replace all `config.email?.provider` → `config.emailProvider`
   - Replace all `config.email?.apiKey` → `config.emailApiKey`
   - Replace all `config.email?.fromEmail` → `config.emailFromEmail`
   - etc.

2. **SMS Connector Section:**
   - Replace all `config.sms?.provider` → `config.smsProvider`
   - Replace all `config.sms?.accountSid` → `config.smsAccountSid`
   - etc.

3. **Phone Connector Section:**
   - Replace all `config.phone?.provider` → `config.phoneProvider`
   - Replace all `config.phone?.accountSid` → `config.phoneAccountSid`
   - etc.

4. **LinkedIn & Social Connectors:**
   - Replace all `config.linkedin?.accessToken` → `config.linkedinAccessToken`
   - etc.

5. **Save Functions:**
   - Update all `setConfig()` calls to use flat structure
   - Example:
```typescript
// OLD
setConfig(prev => ({ ...prev, email: { ...prev.email, provider: 'gmail' } }))

// NEW
setConfig(prev => ({ ...prev, emailProvider: 'gmail' }))
```

## 🔄 Database Migration Steps

### Step 1: Run the SQL Migration
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy the contents of `supabase/migrations/20251020162000_create_connector_configs_table.sql`
4. Paste and execute
5. Verify the table was created: `SELECT * FROM connector_configs;`

### Step 2: Test RLS Policies
1. Log in as User A
2. Go to Connectors page
3. Connect an email (e.g., Gmail)
4. Log out and log in as User B
5. Verify you DON'T see User A's connector

### Step 3: Verify Data Persistence
1. Connect an email connector as a user
2. Log out
3. Log back in
4. Verify your connector is still connected

## 🎯 Benefits After Migration

### Before (localStorage):
- ❌ Configs lost on logout
- ❌ Per-device only
- ❌ No multi-user isolation
- ❌ No server-side access

### After (Database):
- ✅ Persistent across sessions
- ✅ Available on all devices
- ✅ Complete user isolation (RLS)
- ✅ Server can use configs for campaigns
- ✅ True SaaS multi-tenancy

## 📋 Quick Reference

### ConnectorConfig Fields (New Flat Structure)

**Email:**
- `emailProvider`: 'sendgrid' | 'resend' | 'smtp' | 'gmail' | 'outlook'
- `emailApiKey`: string
- `emailFromEmail`: string
- `emailFromName`: string
- `emailSmtpHost`: string
- `emailSmtpPort`: string
- `emailSmtpUser`: string
- `emailSmtpPassword`: string
- `emailAccessToken`: string (OAuth)
- `emailRefreshToken`: string (OAuth)
- `emailTokenExpiry`: number (OAuth)
- `emailUserEmail`: string (OAuth - connected email)

**SMS:**
- `smsProvider`: 'twilio' | 'vonage'
- `smsAccountSid`: string
- `smsAuthToken`: string
- `smsFromNumber`: string

**Phone:**
- `phoneProvider`: 'twilio' | 'elevenlabs'
- `phoneAccountSid`: string
- `phoneAuthToken`: string
- `phoneVoiceId`: string

**LinkedIn:**
- `linkedinAccessToken`: string
- `linkedinConnected`: boolean

**Social:**
- `twitterAccessToken`: string
- `twitterConnected`: boolean
- `facebookAccessToken`: string
- `facebookConnected`: boolean
- `instagramAccessToken`: string
- `instagramConnected`: boolean

## 🔐 Security Notes

1. **Row Level Security:** Enforced at database level - users cannot bypass
2. **Encryption:** Supabase encrypts data at rest
3. **HTTPS Only:** All data transmitted over secure connections
4. **Auth Required:** Must be logged in to access connectors
5. **No Token Exposure:** Tokens never sent to browser logs or client-side code

## ✅ Testing Checklist

- [ ] Run database migration successfully
- [ ] Create connector as User A
- [ ] Verify User B cannot see User A's connectors
- [ ] Test OAuth flow (Gmail/Outlook)
- [ ] Test API key connectors (SendGrid, Twilio, etc.)
- [ ] Test disconnect functionality
- [ ] Verify data persists across logout/login
- [ ] Test on multiple devices (same user)

## 🆘 Troubleshooting

**Error: "table connector_configs does not exist"**
- Solution: Run the migration SQL in Supabase dashboard

**Error: "Failed to load connector config"**
- Solution: Check RLS policies are enabled and user is authenticated

**OAuth not saving:**
- Solution: Check `ConnectorService.saveUserConfig()` is being called after OAuth success

**User sees other users' connectors:**
- Solution: Verify RLS policies are active: `ALTER TABLE connector_configs ENABLE ROW LEVEL SECURITY;`

## 📚 Related Documentation

- [OAUTH_ARCHITECTURE.md](./OAUTH_ARCHITECTURE.md) - Complete OAuth explanation
- Supabase Docs: https://supabase.com/docs/guides/auth/row-level-security
- Google OAuth: https://developers.google.com/identity/protocols/oauth2
- Microsoft OAuth: https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow
