# PostgREST Schema Cache Issue - Resolution Guide

## Problem Summary
The workflow tables (`workflows`, `workflow_nodes`, `workflow_edges`) exist in the Supabase PostgreSQL database but PostgREST's schema cache doesn't recognize them. This causes `PGRST205` errors:

```
Could not find the table 'public.workflows' in the schema cache
```

## Root Cause
The workflow tables were created via raw SQL scripts (`database_workflows.sql`) outside of Supabase's migration system. PostgREST's listener was never triggered to refresh its schema metadata, so it doesn't know these tables exist.

## Solution: Force PostgREST Schema Cache Reload

### Option 1: Execute NOTIFY Command (Recommended)
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Project fsbwkufvkuetrfimqhdf** → **SQL Editor**
3. Run this command:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```
4. The schema cache will reload immediately

### Option 2: Restart Supabase Project
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **Project Settings** → **General**
3. Click **"Pause Project"** then **"Resume Project"**
4. This forces a complete schema cache reload

## Verification Steps
After reloading the schema cache, test the backend API:

```bash
curl http://localhost:3001/api/test/db-connection
```

**Expected response:**
```json
{
  "success": true,
  "workflowCount": 0,
  "sampleWorkflow": null,
  "message": "Database connection is working!"
}
```

## Long-term Solution
Move schema definitions into Supabase migrations so future changes automatically notify PostgREST:

```bash
# Create migration from existing schema
supabase db diff -f create_workflow_tables

# Push to remote
supabase db push
```

This ensures PostgREST is always aware of schema changes.

## Current Status
- ✅ Backend server running successfully
- ✅ Supabase client initialized with SERVICE_ROLE_KEY
- ✅ All workflow API routes implemented correctly
- ⏳ **Waiting for PostgREST schema cache reload**
- ⏳ Once reloaded, workflow generation will work end-to-end

## Technical Details
- **Error Code:** PGRST205
- **Affected Tables:** `workflows`, `workflow_nodes`, `workflow_edges`
- **API Endpoint:** All `/api/workflows/*` routes
- **Supabase Project:** fsbwkufvkuetrfimqhdf
