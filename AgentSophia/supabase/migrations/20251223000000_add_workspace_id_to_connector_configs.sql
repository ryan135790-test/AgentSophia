-- Add workspace_id column to connector_configs for workspace-scoped email connections
-- Each user can have separate email connections per workspace

-- Add the workspace_id column (nullable to allow backfill of existing records)
ALTER TABLE connector_configs ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;

-- Create index for faster workspace lookups
CREATE INDEX IF NOT EXISTS idx_connector_configs_workspace_id ON connector_configs(workspace_id);

-- Drop the old unique constraint on user_id only
ALTER TABLE connector_configs DROP CONSTRAINT IF EXISTS connector_configs_user_id_key;

-- Create new unique constraint on user_id + workspace_id (allows one config per user per workspace)
ALTER TABLE connector_configs ADD CONSTRAINT connector_configs_user_workspace_unique UNIQUE(user_id, workspace_id);

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view own connector configs" ON connector_configs;
DROP POLICY IF EXISTS "Users can insert own connector configs" ON connector_configs;
DROP POLICY IF EXISTS "Users can update own connector configs" ON connector_configs;
DROP POLICY IF EXISTS "Users can delete own connector configs" ON connector_configs;

-- Recreate RLS policies with workspace awareness
-- Users can view their own connector configs
CREATE POLICY "Users can view own connector configs"
  ON connector_configs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own connector configs (workspace_id validated at app level)
CREATE POLICY "Users can insert own connector configs"
  ON connector_configs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own connector configs
CREATE POLICY "Users can update own connector configs"
  ON connector_configs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own connector configs
CREATE POLICY "Users can delete own connector configs"
  ON connector_configs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comment for documentation
COMMENT ON COLUMN connector_configs.workspace_id IS 'Workspace this connector config belongs to. Enables workspace-scoped email connections.';
