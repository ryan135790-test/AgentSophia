# LinkedIn OAuth Setup Guide

This guide walks you through setting up LinkedIn OAuth integration for your AI Lead Platform.

## Overview

LinkedIn OAuth enables users to connect their LinkedIn accounts to:
- Send automated connection requests
- Send personalized messages
- Track engagement metrics
- Run multi-channel campaigns with LinkedIn as a channel

## Prerequisites

- A LinkedIn account
- Access to LinkedIn Developer Portal
- Your Replit project URL

## Step-by-Step Setup

### 1. Create a LinkedIn App

1. Go to [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
2. Click **"Create app"**
3. Fill in the required fields:
   - **App name**: Your platform name (e.g., "AI Lead Platform")
   - **LinkedIn Page**: Select your company's LinkedIn page (or create one)
   - **App logo**: Upload your company logo
   - **Legal agreement**: Check the box to agree to LinkedIn's terms
4. Click **"Create app"**

### 2. Configure OAuth Settings

1. In your app dashboard, go to the **"Auth"** tab
2. Under **"OAuth 2.0 settings"**, add your redirect URLs:
   ```
   https://your-replit-project.replit.app/oauth/linkedin/callback
   http://localhost:5000/oauth/linkedin/callback (for local development)
   ```
3. Under **"OAuth 2.0 scopes"**, request the following scopes:
   - `openid` - Required for authentication
   - `profile` - Access to user's profile information
   - `email` - Access to user's email address
   - `w_member_social` - Post, comment and like on behalf of the user

### 3. Get Your Client Credentials

1. In the **"Auth"** tab, you'll find:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value (keep it secure!)

### 4. Add Credentials to Replit Secrets

1. In your Replit project, click on **"Tools"** → **"Secrets"**
2. Add the following secrets:

   **Secret 1:**
   - Key: `VITE_LINKEDIN_CLIENT_ID`
   - Value: Your LinkedIn Client ID (from step 3)

   **Secret 2:**
   - Key: `LINKEDIN_CLIENT_SECRET`
   - Value: Your LinkedIn Client Secret (from step 3)

3. Click **"Add secret"** for each

### 5. Verify Setup

1. Restart your Replit application
2. Navigate to **Connectors** → **LinkedIn** tab
3. Click **"Connect LinkedIn Account"**
4. Complete the OAuth flow in the popup window
5. You should see a success message with your LinkedIn profile connected

## Important Notes

### Authorization Code Flow

LinkedIn uses the **Authorization Code flow** (not implicit flow) for security:

1. User clicks "Connect LinkedIn"
2. Popup opens to LinkedIn authorization page
3. User grants permissions
4. LinkedIn redirects to callback with authorization code
5. **Backend exchanges code for access token** (requires server-side processing)
6. Access token is saved to database

⚠️ **Backend Configuration Required**: The current implementation requires a backend endpoint to exchange the authorization code for an access token. This is a security requirement from LinkedIn.

### Token Expiration

- LinkedIn access tokens expire after **60 days**
- The platform stores the expiry timestamp
- Implement token refresh logic in production

### Rate Limits

LinkedIn enforces strict rate limits:
- **Connection requests**: Max 100-200 per week per account
- **Messages**: Depends on account type and response rate
- **Profile views**: No official limit, but avoid excessive automation

### Best Practices

1. **Account Warm-up**: Start with low activity and gradually increase
2. **Human-like Delays**: Add random delays between actions (2-10 minutes)
3. **Activity Distribution**: Spread actions throughout the day
4. **Proxy Rotation**: Consider using residential proxies for enhanced safety
5. **Respect Limits**: Never exceed LinkedIn's daily/weekly limits

## Multi-Tenant Architecture

The platform supports multiple users with isolated LinkedIn accounts:

- Each user connects their own LinkedIn account
- Tokens are stored in `connector_configs` table with Row Level Security
- Users can only access their own LinkedIn configuration
- No cross-user data exposure

## Troubleshooting

### "Not Configured" Button

**Problem**: Button shows "Not Configured" instead of "Connect LinkedIn Account"

**Solution**: 
1. Verify `VITE_LINKEDIN_CLIENT_ID` is added to Replit Secrets
2. Restart the application
3. Refresh your browser

### "Backend Configuration Required" Error

**Problem**: OAuth popup shows backend configuration error

**Solution**: 
This is expected! LinkedIn requires server-side token exchange. To implement:

1. Create backend endpoint: `/api/oauth/linkedin/exchange`
2. Exchange authorization code for access token using Client Secret
3. Return access token to frontend
4. See LinkedIn's [OAuth 2.0 documentation](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)

### "Invalid Redirect URI" Error

**Problem**: LinkedIn shows "redirect_uri_mismatch" error

**Solution**:
1. Ensure the redirect URI in your LinkedIn app matches exactly
2. Include the full URL with protocol (https://)
3. No trailing slashes
4. Wait 5-10 minutes for LinkedIn to propagate changes

## Security Considerations

1. **Never expose Client Secret** - Keep it server-side only
2. **Use HTTPS** - Always use secure connections in production
3. **Validate Tokens** - Verify token expiration before use
4. **Row Level Security** - Database policies prevent unauthorized access
5. **Audit Logging** - Track all LinkedIn API usage for compliance

## LinkedIn App Review

For production use, you may need to submit your app for LinkedIn review:

1. Go to your app in LinkedIn Developer Portal
2. Click **"Products"** tab
3. Request access to required products
4. Provide use case documentation
5. Wait for approval (typically 1-2 weeks)

## Support

For LinkedIn OAuth issues:
- [LinkedIn Developer Documentation](https://docs.microsoft.com/en-us/linkedin/)
- [LinkedIn API Support](https://www.linkedin.com/help/linkedin/ask/api)
- Platform admin: Contact your system administrator

## Next Steps

After connecting LinkedIn:

1. ✅ Configure safety limits (daily caps, warm-up)
2. ✅ Build multi-channel campaigns with LinkedIn
3. ✅ Track engagement in Unified Inbox
4. ✅ Monitor activity logs and safety metrics

---

**Note**: This implementation is designed for legitimate business use cases only. Always comply with LinkedIn's [User Agreement](https://www.linkedin.com/legal/user-agreement) and [Professional Community Policies](https://www.linkedin.com/legal/professional-community-policies).
