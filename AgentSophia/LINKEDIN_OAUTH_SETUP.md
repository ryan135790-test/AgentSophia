# LinkedIn OAuth 2.0 Integration Setup Guide

## Overview
This guide will walk you through setting up LinkedIn OAuth 2.0 authentication for your AI Lead Platform. The integration uses OpenID Connect (the modern LinkedIn OAuth standard) to enable per-user LinkedIn authentication, allowing Agent Sophia to perform actions on behalf of each user.

## Prerequisites
- A LinkedIn account
- Admin access to your Supabase project
- Access to environment variables configuration

## Part 1: Create LinkedIn App

### Step 1: Access LinkedIn Developers Portal
1. Go to https://www.linkedin.com/developers/
2. Click "Create app" button
3. Fill in app details:
   - **App name**: Your app name (e.g., "AI Lead Platform")
   - **LinkedIn Page**: You must associate the app with a LinkedIn Page. If you don't have one:
     - Create a company page first at https://www.linkedin.com/company/setup/new/
     - Then return to app creation
   - **Privacy policy URL**: Your privacy policy URL
   - **App logo**: Upload a logo (300x300px minimum)
4. Click "Create app"

### Step 2: Request Product Access

#### For Basic Features (Social Media Posting):
1. In your LinkedIn app, go to the "Products" tab
2. Find "Sign In with LinkedIn using OpenID Connect"
3. Click "Request access"
4. This should be auto-approved instantly

#### For Advanced Features (Connection Requests & Messaging):
**⚠️ LinkedIn Partner Program Required**

To send connection requests and messages programmatically, you need LinkedIn Partner Program access:

1. In your LinkedIn app, go to the "Products" tab
2. Look for these products:
   - "Marketing Developer Platform" (for connection requests)
   - "Messaging API" (for direct messages)
3. Click "Request access" on each
4. Fill out the application form
5. Wait for LinkedIn approval (can take 1-4 weeks)

**Without Partner Program access:**
- ✅ Social media posting works
- ✅ Profile authentication works
- ❌ Connection requests will be queued for manual action
- ❌ Direct messages will be queued for manual action

### Step 3: Configure OAuth Settings
1. In your LinkedIn app, go to the "Auth" tab
2. Under "OAuth 2.0 settings", add your redirect URLs:
   ```
   http://localhost:5000/auth/linkedin/callback
   https://YOUR_DOMAIN/auth/linkedin/callback
   https://YOUR_REPLIT_DOMAIN.replit.app/auth/linkedin/callback
   ```
   Replace `YOUR_DOMAIN` with your actual domain
   
3. Copy the **Client ID** and **Client Secret** - you'll need these next

### Step 4: Verify Scopes
In the "Auth" tab, verify these scopes are enabled:
- ✅ `openid` - Required for OpenID Connect
- ✅ `email` - User's email address
- ✅ `profile` - Basic profile information
- ✅ `w_member_social` - Post content on behalf of user

## Part 2: Configure Environment Variables

### Frontend Environment Variables (.env)
Add these to your `.env` file:

```env
VITE_LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
```

### Supabase Edge Function Secrets
You need to add LinkedIn credentials as Supabase Edge Function secrets:

#### Option 1: Via Supabase Dashboard
1. Go to your Supabase project
2. Navigate to Edge Functions → Manage secrets
3. Add these secrets:
   - `LINKEDIN_CLIENT_ID`: Your LinkedIn app Client ID
   - `LINKEDIN_CLIENT_SECRET`: Your LinkedIn app Client Secret

#### Option 2: Via Supabase CLI
```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
echo "YOUR_CLIENT_ID" | supabase secrets set LINKEDIN_CLIENT_ID
echo "YOUR_CLIENT_SECRET" | supabase secrets set LINKEDIN_CLIENT_SECRET
```

## Part 3: Deploy Edge Function

### Deploy the linkedin-oauth Edge Function
```bash
# Deploy the function
supabase functions deploy linkedin-oauth

# Verify deployment
supabase functions list
```

The edge function should now be available at:
```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/linkedin-oauth
```

## Part 4: Enable Partner API Features (Optional)

If you've been approved for LinkedIn Partner Program:

1. Add this environment variable to Supabase Edge Functions:
   ```bash
   echo "true" | supabase secrets set LINKEDIN_PARTNER_API_ENABLED
   ```

2. This enables:
   - Automated connection requests
   - Automated direct messaging
   - Message reading/monitoring

Without this flag, these features gracefully degrade to "manual action required" mode.

## Part 5: Test the Integration

### Step 1: Connect LinkedIn Account
1. Log into your AI Lead Platform
2. Go to Platform → Connectors tab
3. Find the "Social Media Integration" section
4. Click "Connect LinkedIn"
5. You'll be redirected to LinkedIn
6. Authorize the app
7. You'll be redirected back and see "Connected" status

### Step 2: Verify Connection
Check your `social_connections` table in Supabase:
- Should have a new row with `platform = 'linkedin'`
- `access_token` should be populated
- `token_expires_at` should be ~60 days in the future
- `profile_data` should contain your LinkedIn profile info

### Step 3: Test Posting
1. Go to Agent Sophia → Schedule
2. Create a test post
3. Select LinkedIn as the channel
4. Schedule or send immediately
5. Check your LinkedIn profile to verify the post appeared

## Part 6: Token Management

### Token Expiration
LinkedIn access tokens expire after **60 days**. The system handles this automatically:

1. **Token expiration warnings**: Users see a warning when tokens expire in < 7 days
2. **Reconnection flow**: Users can click "Reconnect" to refresh their token
3. **Automatic detection**: The system checks token expiration before operations

### Manual Token Refresh
If needed, users can manually refresh their connection:
1. Click "Disconnect"
2. Click "Connect LinkedIn" again
3. Re-authorize the app

## Troubleshooting

### "LinkedIn OAuth credentials not configured"
- **Cause**: Missing `LINKEDIN_CLIENT_ID` or `LINKEDIN_CLIENT_SECRET` in Edge Function secrets
- **Fix**: Add secrets via Supabase dashboard or CLI (see Part 2)

### "Failed to exchange code for token"
- **Cause**: Incorrect redirect URI or client secret
- **Fix**: 
  1. Verify redirect URI in LinkedIn app matches exactly
  2. Verify client secret is correct
  3. Check Edge Function logs in Supabase

### "Invalid state parameter - possible CSRF attack"
- **Cause**: State parameter mismatch (usually from session expiration)
- **Fix**: Clear browser session storage and try again

### "Not authenticated. Please log in first"
- **Cause**: User's Supabase session expired
- **Fix**: Log out and log back in

### Connection requests/messages not working
- **Cause**: LinkedIn Partner API not enabled
- **Fix**: 
  1. Apply for Partner Program (see Part 1, Step 2)
  2. Once approved, set `LINKEDIN_PARTNER_API_ENABLED=true`
  3. Until then, tasks will be marked "manual_required"

### Tokens expiring too quickly
- **Cause**: This is normal - LinkedIn tokens last 60 days
- **Fix**: Users need to reconnect every ~60 days (or when prompted)

## Security Best Practices

1. **Never expose credentials**: Client ID is safe for frontend, but Client Secret must ONLY be in Edge Functions
2. **Use HTTPS**: Always use HTTPS in production for OAuth callbacks
3. **CSRF protection**: The integration uses state parameters to prevent CSRF attacks
4. **Token storage**: Tokens are stored securely in Supabase with RLS policies

## Architecture Notes

### Why OpenID Connect?
LinkedIn deprecated their old OAuth 2.0 flow and now requires OpenID Connect for new apps. Benefits:
- More secure with standardized flows
- Better profile data access
- Future-proof implementation

### Token Storage
Tokens are stored in the `social_connections` table:
```sql
CREATE TABLE social_connections (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  platform VARCHAR NOT NULL,
  account_id VARCHAR,
  account_name VARCHAR,
  access_token TEXT,
  token_expires_at TIMESTAMP,
  profile_data JSONB,
  is_active BOOLEAN DEFAULT true
);
```

### Per-User Authentication
Each user connects their own LinkedIn account, allowing:
- Personalized posting (appears from their account)
- Individual rate limits
- Compliance with LinkedIn's terms of service

## Next Steps

After successful LinkedIn integration:
1. ✅ Test social media posting
2. ✅ Configure Agent Sophia automation
3. ✅ Set up autonomous operations (see `AUTONOMOUS_AGENT_SETUP.md`)
4. ⏳ Apply for LinkedIn Partner Program (if not done)
5. ⏳ Enable full automation once Partner access approved

## Support

If you encounter issues:
1. Check Edge Function logs in Supabase
2. Check browser console for errors
3. Verify all environment variables are set
4. Review LinkedIn app settings
5. Check this guide's troubleshooting section

## References

- [LinkedIn OAuth 2.0 Documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [LinkedIn OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
