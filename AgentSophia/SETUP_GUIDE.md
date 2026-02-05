# AI Lead Platform - Setup Guide

## Overview
This is a production-ready AI Lead Platform built with:
- **Frontend**: Vite + React + TypeScript + shadcn-ui + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: OpenAI GPT-5 (via Supabase Edge Functions)
- **Integrations**: LinkedIn OAuth, Real-time data sync

## Quick Start

### 1. Database Setup
Run the following SQL in your Supabase SQL Editor:

```sql
-- Execute supabase_complete_setup.sql
-- This creates the campaigns table and adds missing columns
```

The file `supabase_complete_setup.sql` contains:
- Campaigns table creation
- Missing contact columns (status, job_title)
- Row Level Security policies
- Triggers for timestamps

### 2. Environment Variables
Required secrets (already configured in Replit):
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `OPENAI_API_KEY` - OpenAI API key (required for AI features)

### 3. Edge Functions Setup
The platform uses Supabase Edge Functions for:

**AI Assistant** (`supabase/functions/ai-assistant/`)
- Handles AI chat interactions
- Uses GPT-5 for intelligent responses
- Saves chat sessions to database

**LinkedIn OAuth** (`supabase/functions/linkedin-oauth/`)
- Manages LinkedIn authentication
- Creates/updates workspaces
- Stores LinkedIn tokens securely

To deploy Edge Functions:
```bash
supabase functions deploy ai-assistant
supabase functions deploy linkedin-oauth
```

### 4. Admin Setup
First user can claim admin privileges:
1. Sign up at `/auth`
2. Navigate to `/setup-admin`
3. Click "Claim Admin Role"
4. Access admin panel at `/admin`

## Architecture

### Data Flow
```
Frontend (React) 
  ↓ 
TanStack Query (hooks) 
  ↓
Supabase Client
  ↓
PostgreSQL Database + Edge Functions
  ↓
OpenAI API (via Edge Functions)
```

### Key Files

**Data Layer**
- `shared/schema.ts` - TypeScript types & Zod schemas
- `src/hooks/use-contacts.ts` - Contact CRUD operations
- `src/hooks/use-campaigns.ts` - Campaign CRUD operations
- `src/hooks/use-dashboard-stats.ts` - Real-time analytics
- `src/lib/queryClient.ts` - TanStack Query configuration

**Components**
- `src/components/dashboard/overview.tsx` - Real-time dashboard with metrics
- `src/components/crm/contacts-dashboard.tsx` - Contact management
- `src/components/ai/ai-chat.tsx` - AI assistant (connected to OpenAI)

**Edge Functions**
- `supabase/functions/ai-assistant/index.ts` - OpenAI integration
- `supabase/functions/linkedin-oauth/index.ts` - LinkedIn OAuth

## Database Schema

### Core Tables
- **contacts** - Lead/contact information with stages and scoring
- **campaigns** - Multi-channel campaign management
- **ai_chat_sessions** - AI conversation history
- **ai_configurations** - AI workflow configurations
- **workspaces** - LinkedIn workspace management
- **profiles** - User profiles
- **user_roles** - Role-based access control

## Features Implemented

### ✅ Real Data Integration
- Replaced all mock data with live Supabase queries
- Real-time dashboard metrics from database
- Contact CRUD with proper validation
- Campaign tracking with analytics

### ✅ AI Integration
- OpenAI GPT-5 integration via Edge Functions
- Intelligent workflow builder
- Campaign creator assistant
- Performance analysis AI

### ✅ Authentication & Security
- Supabase Auth with email/password
- Row Level Security (RLS) policies
- Secure admin claim system
- LinkedIn OAuth integration

### ✅ Data Architecture
- Type-safe schemas with Zod validation
- TanStack Query for state management
- Optimistic updates and cache invalidation
- Loading states and error handling

## Known Limitations

### Requires Manual Steps
1. **SQL Migration** - User must run `supabase_complete_setup.sql` in Supabase dashboard
2. **OpenAI API Key** - Must be configured as environment variable for Edge Functions
3. **LinkedIn Credentials** - Optional, for LinkedIn OAuth features

### Type Assertions
Some queries use `as any` type assertions for:
- Campaigns table (until migration is run and types regenerated)
- This is temporary and will be fixed once Supabase types are updated

## Testing

### Manual Testing Checklist
- [ ] Sign up and claim admin role at `/setup-admin`
- [ ] View dashboard with real metrics at `/`
- [ ] Add/edit/delete contacts in CRM
- [ ] Test AI chat (requires OPENAI_API_KEY)
- [ ] LinkedIn OAuth (requires LINKEDIN_CLIENT_ID/SECRET)

### Expected Behavior
- Dashboard shows 0 for all metrics initially (no data yet)
- Adding contacts updates dashboard metrics in real-time
- AI chat requires OpenAI API key environment variable
- All loading states and error handling work properly

## Deployment

This app is configured for Replit Autoscale deployment:
```json
{
  "deployment_target": "autoscale",
  "build": ["npm", "run", "build"],
  "run": ["npm", "run", "preview", "--", "--port", "5000", "--host", "0.0.0.0"]
}
```

## Troubleshooting

### Dashboard shows 0 for all metrics
- **Cause**: No data in database yet
- **Fix**: Add contacts via CRM to see metrics update

### AI Chat not working
- **Cause**: Missing OPENAI_API_KEY
- **Fix**: Set OPENAI_API_KEY in Replit Secrets or Supabase Edge Function secrets

### Campaigns table errors
- **Cause**: Migration not run
- **Fix**: Execute `supabase_complete_setup.sql` in Supabase SQL Editor

### Type errors in development
- **Cause**: Supabase types not regenerated after schema changes
- **Fix**: Run `npx supabase gen types typescript --project-id [project-id] > src/integrations/supabase/types.ts`

## Next Steps

### Week 1 Priorities
1. ✅ Real data integration - COMPLETE
2. ✅ Data architecture - COMPLETE  
3. ✅ AI integration setup - COMPLETE
4. ⏳ Full testing and bug fixes
5. ⏳ Campaign builder UI enhancement

### Future Enhancements
- Automated email sequences
- LinkedIn message automation
- Advanced AI lead scoring
- Multi-workspace support
- Analytics dashboards
- Export/import functionality

## Support

For issues or questions:
1. Check this guide first
2. Review Supabase logs for Edge Function errors
3. Check browser console for frontend errors
4. Verify all environment variables are set correctly
