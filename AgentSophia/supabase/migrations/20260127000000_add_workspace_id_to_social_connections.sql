-- Add workspace_id column to social_connections table
-- This allows different workspaces to have their own LinkedIn connections

-- Add the workspace_id column (nullable initially for migration)
ALTER TABLE social_connections 
ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Create index for workspace-based lookups
CREATE INDEX IF NOT EXISTS idx_social_connections_workspace 
ON social_connections(workspace_id);

CREATE INDEX IF NOT EXISTS idx_social_connections_user_workspace_platform 
ON social_connections(user_id, workspace_id, platform);

-- Drop the old unique constraint (one connection per user per platform)
ALTER TABLE social_connections 
DROP CONSTRAINT IF EXISTS social_connections_user_id_platform_key;

-- Add new unique constraint (one connection per user per workspace per platform)
ALTER TABLE social_connections 
ADD CONSTRAINT social_connections_user_workspace_platform_key 
UNIQUE(user_id, workspace_id, platform);

-- Update RLS policies to include workspace membership check
-- Users can only access connections in workspaces they are members of
DROP POLICY IF EXISTS "Users can view own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can insert own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can update own social connections" ON social_connections;
DROP POLICY IF EXISTS "Users can delete own social connections" ON social_connections;

-- SELECT: User must own the connection AND be a member of the workspace
CREATE POLICY "Users can view own social connections"
ON social_connections FOR SELECT
USING (
  auth.uid() = user_id 
  AND (
    workspace_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = social_connections.workspace_id 
      AND workspace_members.user_id = auth.uid()
    )
  )
);

-- INSERT: User must own the connection AND be a member of the workspace
CREATE POLICY "Users can insert own social connections"
ON social_connections FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (
    workspace_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = social_connections.workspace_id 
      AND workspace_members.user_id = auth.uid()
    )
  )
);

-- UPDATE: User must own the connection AND be a member of the workspace
CREATE POLICY "Users can update own social connections"
ON social_connections FOR UPDATE
USING (
  auth.uid() = user_id 
  AND (
    workspace_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = social_connections.workspace_id 
      AND workspace_members.user_id = auth.uid()
    )
  )
);

-- DELETE: User must own the connection AND be a member of the workspace
CREATE POLICY "Users can delete own social connections"
ON social_connections FOR DELETE
USING (
  auth.uid() = user_id 
  AND (
    workspace_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM workspace_members 
      WHERE workspace_members.workspace_id = social_connections.workspace_id 
      AND workspace_members.user_id = auth.uid()
    )
  )
);
