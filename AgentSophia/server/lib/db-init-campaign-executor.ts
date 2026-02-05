import { Pool } from 'pg';

let connectionString: string;
let useSSL = false;

// Priority: SUPABASE_DB_URL (works in both dev and production) > PGHOST (dev only)
if (process.env.SUPABASE_DB_URL) {
  connectionString = process.env.SUPABASE_DB_URL;
  useSSL = true;
} else if (process.env.PGHOST && process.env.PGDATABASE) {
  const pgUser = process.env.PGUSER || 'postgres';
  const pgPassword = process.env.PGPASSWORD || '';
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  connectionString = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
} else {
  connectionString = '';
}

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
});

export async function initCampaignExecutorTables(): Promise<void> {
  console.log('[DB Init] Creating campaign executor tables if needed...');
  
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_scheduled_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL,
        contact_id UUID NOT NULL,
        workspace_id UUID,
        step_index INTEGER NOT NULL DEFAULT 0,
        channel VARCHAR(50) NOT NULL,
        subject TEXT,
        content TEXT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        requires_approval BOOLEAN DEFAULT false,
        approved_by UUID,
        approved_at TIMESTAMPTZ,
        executed_at TIMESTAMPTZ,
        message_id VARCHAR(255),
        error_message TEXT,
        personalization_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Init] campaign_scheduled_steps table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_approval_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID,
        user_id UUID,
        action_type VARCHAR(50) NOT NULL,
        action_data JSONB NOT NULL,
        campaign_id UUID,
        contact_id UUID,
        scheduled_step_id UUID,
        sophia_confidence NUMERIC,
        sophia_reasoning TEXT,
        preview_subject TEXT,
        preview_content TEXT,
        preview_recipient TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        resolved_by UUID,
        resolved_at TIMESTAMPTZ,
        resolution_notes TEXT,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Init] sophia_approval_items table ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_execution_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL,
        workspace_id UUID,
        execution_type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        total_steps INTEGER DEFAULT 0,
        completed_steps INTEGER DEFAULT 0,
        failed_steps INTEGER DEFAULT 0,
        pending_approval_steps INTEGER DEFAULT 0,
        started_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ,
        error_message TEXT,
        autonomy_level_used VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Init] campaign_execution_logs table ready');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_css_campaign_status 
      ON campaign_scheduled_steps(campaign_id, status);
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_css_scheduled_at 
      ON campaign_scheduled_steps(scheduled_at) 
      WHERE status = 'pending';
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_approval_status 
      ON sophia_approval_items(status) 
      WHERE status = 'pending';
    `);

    // Create agent_configs table for autonomy settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID UNIQUE,
        autonomy_level VARCHAR(50) NOT NULL DEFAULT 'semi_autonomous',
        autonomy_policies JSONB DEFAULT '{"confidence_threshold": 80}'::jsonb,
        learning_enabled BOOLEAN DEFAULT true,
        auto_response_enabled BOOLEAN DEFAULT false,
        approval_required_channels TEXT[] DEFAULT ARRAY['linkedin', 'phone', 'voicemail'],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Init] agent_configs table ready');

    // Create sophia_settings table for brain control panel
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id VARCHAR(255) NOT NULL,
        autonomy_level INTEGER DEFAULT 65,
        is_autonomous BOOLEAN DEFAULT true,
        learning_mode BOOLEAN DEFAULT true,
        approval_threshold INTEGER DEFAULT 75,
        auto_actions_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(workspace_id)
      );
    `);
    console.log('[DB Init] sophia_settings table ready');

    // Create autonomous_decisions table for tracking Sophia decisions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS autonomous_decisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id VARCHAR(255) NOT NULL,
        decision_type VARCHAR(100) NOT NULL,
        action_data JSONB,
        will_execute_autonomously BOOLEAN DEFAULT false,
        confidence_score NUMERIC,
        reasoning TEXT,
        executed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Init] autonomous_decisions table ready');

    // Create sophia_performance table for model accuracy tracking
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_performance (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id VARCHAR(255) NOT NULL,
        consensus_accuracy NUMERIC DEFAULT 87,
        gpt4o_accuracy NUMERIC DEFAULT 85,
        claude_accuracy NUMERIC DEFAULT 89,
        total_decisions INTEGER DEFAULT 0,
        correct_predictions INTEGER DEFAULT 0,
        last_updated TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('[DB Init] sophia_performance table ready');

    // Create indexes for sophia tables
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sophia_settings_workspace 
      ON sophia_settings(workspace_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_workspace 
      ON autonomous_decisions(workspace_id);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sophia_performance_workspace 
      ON sophia_performance(workspace_id);
    `);

    console.log('[DB Init] Campaign executor tables initialized successfully');
  } catch (error) {
    console.error('[DB Init] Error creating campaign executor tables:', error);
  }
}
