-- ============================================
-- RECURRING SOCIAL POST SCHEDULING TABLES
-- Run this in your Supabase SQL Editor
-- ============================================

-- 0. Create connected_social_accounts table (Multi-Account Support)
CREATE TABLE IF NOT EXISTS connected_social_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'twitter', 'instagram', 'tiktok', 'youtube')),
  account_type TEXT DEFAULT 'personal' CHECK (account_type IN ('personal', 'page', 'business', 'creator')),
  account_name TEXT NOT NULL,
  account_username TEXT,
  account_id TEXT, -- Platform-specific ID
  profile_url TEXT,
  avatar_url TEXT,
  access_token TEXT, -- Should be encrypted in production
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  connection_status TEXT DEFAULT 'connected' CHECK (connection_status IN ('connected', 'disconnected', 'expired', 'error')),
  last_sync_at TIMESTAMPTZ,
  permissions TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connected_accounts_user ON connected_social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_workspace ON connected_social_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_platform ON connected_social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_active ON connected_social_accounts(is_active);

-- 1. Create recurring_social_schedules table
CREATE TABLE IF NOT EXISTS recurring_social_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID,
  name TEXT NOT NULL,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  account_ids UUID[] DEFAULT '{}', -- Specific account IDs to post from
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'custom')) DEFAULT 'weekly',
  recurrence_days INTEGER[] DEFAULT '{}',
  custom_cron VARCHAR(100),
  post_time TIME NOT NULL DEFAULT '09:00:00',
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  topic_guidelines TEXT,
  content_themes TEXT[] DEFAULT '{}',
  require_approval BOOLEAN DEFAULT true,
  auto_generate BOOLEAN DEFAULT true,
  brand_voice_id UUID,
  posts_generated_count INTEGER DEFAULT 0,
  posts_approved_count INTEGER DEFAULT 0,
  posts_published_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create scheduled_social_posts table
CREATE TABLE IF NOT EXISTS scheduled_social_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID,
  recurring_schedule_id UUID REFERENCES recurring_social_schedules(id) ON DELETE CASCADE,
  account_id UUID REFERENCES connected_social_accounts(id) ON DELETE SET NULL, -- Specific account to post from
  platform TEXT NOT NULL,
  content TEXT,
  hashtags TEXT[] DEFAULT '{}',
  media_urls TEXT[] DEFAULT '{}',
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  status TEXT CHECK (status IN ('pending_generation', 'pending_approval', 'approved', 'rejected', 'published', 'failed')) DEFAULT 'pending_approval',
  approval_status TEXT CHECK (approval_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  approval_notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  published_at TIMESTAMPTZ,
  published_post_id TEXT,
  ai_generation_prompt TEXT,
  brand_voice_id UUID,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_user ON recurring_social_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_workspace ON recurring_social_schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_active ON recurring_social_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_schedules_recurrence ON recurring_social_schedules(recurrence_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user ON scheduled_social_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_workspace ON scheduled_social_posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_schedule ON scheduled_social_posts(recurring_schedule_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_social_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_approval ON scheduled_social_posts(approval_status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_date ON scheduled_social_posts(scheduled_date);

-- 4. Helper function to increment schedule counts
CREATE OR REPLACE FUNCTION increment_schedule_approvals(schedule_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE recurring_social_schedules
  SET posts_approved_count = posts_approved_count + 1,
      updated_at = NOW()
  WHERE id = schedule_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_schedule_published(schedule_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE recurring_social_schedules
  SET posts_published_count = posts_published_count + 1,
      updated_at = NOW()
  WHERE id = schedule_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Enable Row Level Security (optional but recommended)
ALTER TABLE recurring_social_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_social_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_social_schedules
CREATE POLICY "Users can view own schedules" ON recurring_social_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own schedules" ON recurring_social_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedules" ON recurring_social_schedules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedules" ON recurring_social_schedules
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for scheduled_social_posts
CREATE POLICY "Users can view own posts" ON scheduled_social_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own posts" ON scheduled_social_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON scheduled_social_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON scheduled_social_posts
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Enable RLS for connected_social_accounts
ALTER TABLE connected_social_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for connected_social_accounts
CREATE POLICY "Users can view own accounts" ON connected_social_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own accounts" ON connected_social_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts" ON connected_social_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts" ON connected_social_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- 7. Add service role bypass for API operations
CREATE POLICY "Service role full access to schedules" ON recurring_social_schedules
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to connected accounts" ON connected_social_accounts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to posts" ON scheduled_social_posts
  FOR ALL USING (auth.role() = 'service_role');
