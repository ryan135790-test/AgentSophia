import { Pool } from 'pg';

// Use Replit PostgreSQL for reliable persistence
// Priority: SUPABASE_DB_URL (works in both dev and production) > PGHOST (dev only)
let connectionString: string;
let useSSL = false;

if (process.env.SUPABASE_DB_URL) {
  // Use SUPABASE_DB_URL - works in both development and production
  connectionString = process.env.SUPABASE_DB_URL;
  useSSL = true;
  console.log('[db-service] Using SUPABASE_DB_URL for connection');
} else if (process.env.PGHOST && process.env.PGDATABASE) {
  // Development fallback: Use PGHOST environment variables
  const pgUser = process.env.PGUSER || 'postgres';
  const pgPassword = process.env.PGPASSWORD || '';
  const pgHost = process.env.PGHOST;
  const pgPort = process.env.PGPORT || '5432';
  const pgDatabase = process.env.PGDATABASE;
  connectionString = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;
  console.log('[db-service] Using Replit PostgreSQL (PGHOST) for connection');
} else {
  console.error('[db-service] CRITICAL: No valid PostgreSQL connection configured!');
  connectionString = '';
}

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 20,
  connectionTimeoutMillis: 10000
});

export interface DemoContact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  stage: string;
  source: string | null;
  score: number | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface DemoCampaign {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  target_audience: any;
  settings: any;
  channels: string[];
  messages: any[];
  created_at: string;
  updated_at: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  is_demo: boolean;
}

export interface WorkspaceLearning {
  workspace_id: string;
  data: any;
  created_at: string;
  updated_at: string;
}

export interface DemoWorkflow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  nodes: any[];
  edges: any[];
  settings: any;
  created_at: string;
  updated_at: string;
}

export interface BrandVoice {
  id: string;
  user_id: string;
  name: string;
  company_name: string | null;
  industry: string | null;
  tone: string;
  values: string[];
  writing_style: string | null;
  avoid_words: string[];
  key_messages: string[];
  website_urls: string[];
  research_insights: any | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignStep {
  id: string;
  campaign_id: string;
  channel: string;
  label: string;
  subject: string | null;
  content: string;
  delay: number;
  delay_unit: string;
  order_index: number;
  variations: any[];
  selected_variation_id: string | null;
  branches: any[];
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: 'queued' | 'active' | 'completed' | 'paused' | 'opted_out';
  current_step: number;
  last_action: string | null;
  last_action_at: string | null;
  assigned_at: string;
  completed_at: string | null;
}

export interface SophiaAutonomousCampaign {
  id: string;
  workspace_id: string;
  name: string;
  goal: string;
  target_audience: {
    jobTitles: string[];
    industries: string[];
    companySize: string;
    location: string;
    keywords: string[];
  };
  brand_voice_id: string | null;
  brand_voice_name: string | null;
  channels: string[];
  approval_mode: 'full' | 'semi' | 'manual';
  status: 'draft' | 'sourcing' | 'enriching' | 'designing' | 'running' | 'paused' | 'completed';
  leads_found: number;
  leads_enriched: number;
  messages_generated: number;
  messages_sent: number;
  responses: number;
  created_at: string;
  last_activity_at: string;
}

export interface SophiaCampaignConfig {
  id: string;
  campaign_id: string;
  workspace_id: string;
  enabled: boolean;
  autonomy_level: 'manual' | 'semi_autonomous' | 'fully_autonomous';
  brand_voice_id: string | null;
  approval_required: boolean;
  max_daily_messages: number;
  personalization_level: 'basic' | 'moderate' | 'deep';
  created_at: string;
  updated_at: string;
}

export interface SophiaActivityLog {
  id: string;
  campaign_id: string;
  timestamp: string;
  action: string;
  details: string;
  status: 'success' | 'pending' | 'in_progress' | 'error';
  metadata: Record<string, any> | null;
}

export const db = {
  async ensureDemoContactsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_contacts (
        id VARCHAR(255) PRIMARY KEY,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        company VARCHAR(255),
        position VARCHAR(255),
        job_title VARCHAR(255),
        linkedin_url TEXT,
        stage VARCHAR(50) DEFAULT 'new',
        source VARCHAR(50),
        score INTEGER DEFAULT 0,
        tags JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  },

  async ensureDemoCampaignsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_campaigns (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'email',
        status VARCHAR(50) DEFAULT 'draft',
        target_audience JSONB DEFAULT '{}',
        settings JSONB DEFAULT '{}',
        channels JSONB DEFAULT '[]',
        messages JSONB DEFAULT '[]',
        sent_count INTEGER DEFAULT 0,
        opened_count INTEGER DEFAULT 0,
        clicked_count INTEGER DEFAULT 0,
        replied_count INTEGER DEFAULT 0,
        is_demo BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add is_demo column if it doesn't exist (for existing tables)
    await pool.query(`
      ALTER TABLE demo_campaigns ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false
    `).catch(() => {});
    
    const demoExists = await pool.query("SELECT COUNT(*) FROM demo_campaigns WHERE id IN ('camp-001', 'camp-002', 'camp-003')");
    if (parseInt(demoExists.rows[0].count) < 3) {
      await pool.query(`
        INSERT INTO demo_campaigns (id, name, description, type, status, target_audience, settings, channels, messages, sent_count, opened_count, clicked_count, replied_count, is_demo)
        VALUES 
          ('camp-001', '[DEMO] Q4 Product Launch', 'Multi-channel campaign for Q4 product announcement - DEMO MODE', 'multi-channel', 'active', 
           '{"industry": "SaaS", "company_size": "50-500", "job_titles": ["CTO", "VP Engineering", "Director of Technology"]}',
           '{"send_times": "9am-5pm", "timezone": "EST"}',
           '["email", "linkedin"]',
           '[]',
           1247, 623, 187, 94, true),
          ('camp-002', '[DEMO] Enterprise Outreach', 'Targeted campaign for enterprise prospects - DEMO MODE', 'email', 'active',
           '{"industry": "Enterprise", "revenue": "$10M+", "employees": "1000+"}',
           '{"cadence": "weekly", "max_touches": 5}',
           '["email"]',
           '[]',
           892, 356, 124, 67, true),
          ('camp-003', '[DEMO] SMB Growth Initiative', 'Campaign targeting small and medium businesses - DEMO MODE', 'linkedin', 'draft',
           '{"company_size": "10-100", "funding": "Series A-B"}',
           '{}',
           '["linkedin", "email"]',
           '[]',
           0, 0, 0, 0, true)
        ON CONFLICT (id) DO NOTHING
      `);
    }
    
    // Mark existing demo campaigns as demo mode
    await pool.query(`UPDATE demo_campaigns SET is_demo = true WHERE id IN ('camp-001', 'camp-002', 'camp-003')`).catch(() => {});
  },

  async getCampaigns(): Promise<DemoCampaign[]> {
    await this.ensureDemoCampaignsTable();
    const result = await pool.query(
      'SELECT * FROM demo_campaigns ORDER BY is_demo ASC, updated_at DESC'
    );
    return result.rows.map(row => ({
      ...row,
      channels: row.channels || [],
      messages: row.messages || [],
      settings: row.settings || {},
      is_demo: row.is_demo || false,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async createCampaign(campaign: DemoCampaign): Promise<DemoCampaign> {
    const result = await pool.query(
      `INSERT INTO demo_campaigns 
       (id, name, description, type, status, target_audience, settings, channels, messages, sent_count, opened_count, clicked_count, replied_count, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        campaign.id,
        campaign.name,
        campaign.description,
        campaign.type,
        campaign.status,
        JSON.stringify(campaign.target_audience),
        JSON.stringify(campaign.settings),
        JSON.stringify(campaign.channels),
        JSON.stringify(campaign.messages),
        campaign.sent_count,
        campaign.opened_count,
        campaign.clicked_count,
        campaign.replied_count,
        campaign.is_demo || false,
      ]
    );
    return {
      ...result.rows[0],
      channels: result.rows[0].channels || [],
      messages: result.rows[0].messages || [],
      settings: result.rows[0].settings || {},
      is_demo: result.rows[0].is_demo || false,
      created_at: result.rows[0].created_at?.toISOString(),
      updated_at: result.rows[0].updated_at?.toISOString(),
    };
  },

  async getContacts(): Promise<DemoContact[]> {
    await this.ensureDemoContactsTable();
    const result = await pool.query(
      'SELECT * FROM demo_contacts ORDER BY created_at DESC'
    );
    return result.rows.map(row => ({
      ...row,
      tags: row.tags || [],
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async createContact(contact: DemoContact): Promise<DemoContact> {
    await this.ensureDemoContactsTable();
    const result = await pool.query(
      `INSERT INTO demo_contacts 
       (id, first_name, last_name, email, phone, company, position, job_title, linkedin_url, stage, source, score, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        contact.id,
        contact.first_name,
        contact.last_name,
        contact.email,
        contact.phone,
        contact.company,
        contact.position,
        contact.job_title,
        contact.linkedin_url,
        contact.stage,
        contact.source,
        contact.score,
        JSON.stringify(contact.tags),
      ]
    );
    return {
      ...result.rows[0],
      tags: result.rows[0].tags || [],
      created_at: result.rows[0].created_at?.toISOString(),
      updated_at: result.rows[0].updated_at?.toISOString(),
    };
  },

  async getWorkspaceLearning(workspaceId: string): Promise<any | null> {
    const result = await pool.query(
      'SELECT data FROM workspace_learning WHERE workspace_id = $1',
      [workspaceId]
    );
    return result.rows[0]?.data || null;
  },

  async saveWorkspaceLearning(workspaceId: string, data: any): Promise<void> {
    await pool.query(
      `INSERT INTO workspace_learning (workspace_id, data, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (workspace_id) 
       DO UPDATE SET data = $2, updated_at = NOW()`,
      [workspaceId, JSON.stringify(data)]
    );
  },

  async getWorkflows(): Promise<DemoWorkflow[]> {
    const result = await pool.query(
      'SELECT * FROM demo_workflows ORDER BY updated_at DESC'
    );
    return result.rows.map(row => ({
      ...row,
      nodes: row.nodes || [],
      edges: row.edges || [],
      settings: row.settings || {},
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async createWorkflow(workflow: DemoWorkflow): Promise<DemoWorkflow> {
    // First ensure the table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS demo_workflows (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) DEFAULT 'multi-channel',
        status VARCHAR(50) DEFAULT 'draft',
        nodes JSONB DEFAULT '[]',
        edges JSONB DEFAULT '[]',
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await pool.query(
      `INSERT INTO demo_workflows 
       (id, name, description, type, status, nodes, edges, settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        workflow.id,
        workflow.name,
        workflow.description,
        workflow.type,
        workflow.status,
        JSON.stringify(workflow.nodes),
        JSON.stringify(workflow.edges),
        JSON.stringify(workflow.settings),
      ]
    );
    return {
      ...result.rows[0],
      nodes: result.rows[0].nodes || [],
      edges: result.rows[0].edges || [],
      settings: result.rows[0].settings || {},
      created_at: result.rows[0].created_at?.toISOString(),
      updated_at: result.rows[0].updated_at?.toISOString(),
    };
  },

  async ensureBrandVoicesTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS brand_voices (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        industry VARCHAR(255),
        tone VARCHAR(50) DEFAULT 'professional',
        values JSONB DEFAULT '[]',
        writing_style TEXT,
        avoid_words JSONB DEFAULT '[]',
        key_messages JSONB DEFAULT '[]',
        website_urls JSONB DEFAULT '[]',
        research_insights JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  },

  async getBrandVoices(userId: string): Promise<BrandVoice[]> {
    await this.ensureBrandVoicesTable();
    const result = await pool.query(
      'SELECT * FROM brand_voices WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map(row => ({
      ...row,
      values: row.values || [],
      avoid_words: row.avoid_words || [],
      key_messages: row.key_messages || [],
      website_urls: row.website_urls || [],
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async getBrandVoiceById(id: string, userId: string): Promise<BrandVoice | null> {
    await this.ensureBrandVoicesTable();
    const result = await pool.query(
      'SELECT * FROM brand_voices WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      values: row.values || [],
      avoid_words: row.avoid_words || [],
      key_messages: row.key_messages || [],
      website_urls: row.website_urls || [],
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  },

  async createBrandVoice(brandVoice: Omit<BrandVoice, 'created_at' | 'updated_at'>): Promise<BrandVoice> {
    await this.ensureBrandVoicesTable();
    const toPgArray = (arr: string[]) => arr && arr.length > 0 ? `{${arr.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',')}}` : '{}';
    const result = await pool.query(
      `INSERT INTO brand_voices 
       (id, user_id, name, company_name, industry, tone, values, writing_style, avoid_words, key_messages, website_urls, research_insights)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        brandVoice.id,
        brandVoice.user_id,
        brandVoice.name,
        brandVoice.company_name,
        brandVoice.industry,
        brandVoice.tone || 'professional',
        toPgArray(brandVoice.values || []),
        brandVoice.writing_style,
        toPgArray(brandVoice.avoid_words || []),
        toPgArray(brandVoice.key_messages || []),
        toPgArray(brandVoice.website_urls || []),
        brandVoice.research_insights ? JSON.stringify(brandVoice.research_insights) : null,
      ]
    );
    const row = result.rows[0];
    return {
      ...row,
      values: row.values || [],
      avoid_words: row.avoid_words || [],
      key_messages: row.key_messages || [],
      website_urls: row.website_urls || [],
      created_at: row.created_at?.toISOString(),
      updated_at: row.updated_at?.toISOString(),
    };
  },

  async updateBrandVoice(id: string, userId: string, updates: Partial<BrandVoice>): Promise<BrandVoice | null> {
    await this.ensureBrandVoicesTable();
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    const toPgArray = (arr: string[]) => arr && arr.length > 0 ? `{${arr.map(s => `"${s.replace(/"/g, '\\"')}"`).join(',')}}` : '{}';
    const arrayFields = ['values', 'avoid_words', 'key_messages', 'website_urls'];

    const allowedFields = ['name', 'company_name', 'industry', 'tone', 'values', 'writing_style', 'avoid_words', 'key_messages', 'website_urls', 'research_insights'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        if (arrayFields.includes(key) && Array.isArray(value)) {
          values.push(toPgArray(value));
        } else if (key === 'research_insights' && typeof value === 'object') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.getBrandVoiceById(id, userId);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id, userId);

    const result = await pool.query(
      `UPDATE brand_voices SET ${setClauses.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      values: row.values || [],
      avoid_words: row.avoid_words || [],
      key_messages: row.key_messages || [],
      website_urls: row.website_urls || [],
      created_at: row.created_at?.toISOString(),
      updated_at: row.updated_at?.toISOString(),
    };
  },

  async deleteBrandVoice(id: string, userId: string): Promise<boolean> {
    await this.ensureBrandVoicesTable();
    const result = await pool.query(
      'DELETE FROM brand_voices WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return (result.rowCount || 0) > 0;
  },

  async ensureCampaignStepsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_steps (
        id VARCHAR(255) PRIMARY KEY,
        campaign_id VARCHAR(255) NOT NULL,
        channel VARCHAR(50) NOT NULL,
        label VARCHAR(255) NOT NULL,
        subject TEXT,
        content TEXT NOT NULL,
        delay INTEGER DEFAULT 0,
        delay_unit VARCHAR(20) DEFAULT 'days',
        order_index INTEGER DEFAULT 0,
        variations JSONB DEFAULT '[]',
        selected_variation_id VARCHAR(255),
        branches JSONB DEFAULT '[]',
        metrics JSONB DEFAULT '{"sent": 0, "opened": 0, "clicked": 0, "replied": 0, "bounced": 0}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  },

  async ensureCampaignContactsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS campaign_contacts (
        id VARCHAR(255) PRIMARY KEY,
        campaign_id VARCHAR(255) NOT NULL,
        contact_id VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'queued',
        current_step INTEGER DEFAULT 0,
        last_action VARCHAR(255),
        last_action_at TIMESTAMP,
        assigned_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        UNIQUE(campaign_id, contact_id)
      )
    `);
  },

  async getCampaignById(id: string): Promise<DemoCampaign | null> {
    await this.ensureDemoCampaignsTable();
    const result = await pool.query(
      'SELECT * FROM demo_campaigns WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      channels: row.channels || [],
      messages: row.messages || [],
      settings: row.settings || {},
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  },

  async updateCampaign(id: string, updates: Partial<DemoCampaign>): Promise<DemoCampaign | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['name', 'description', 'type', 'status', 'target_audience', 'settings', 'channels', 'messages', 'sent_count', 'opened_count', 'clicked_count', 'replied_count'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return this.getCampaignById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE demo_campaigns SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      channels: row.channels || [],
      messages: row.messages || [],
      settings: row.settings || {},
      created_at: row.created_at?.toISOString(),
      updated_at: row.updated_at?.toISOString(),
    };
  },

  async deleteCampaign(id: string): Promise<boolean> {
    await this.ensureDemoCampaignsTable();
    await pool.query('DELETE FROM campaign_steps WHERE campaign_id = $1', [id]);
    await pool.query('DELETE FROM campaign_contacts WHERE campaign_id = $1', [id]);
    const result = await pool.query('DELETE FROM demo_campaigns WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  },

  async getCampaignSteps(campaignId: string): Promise<CampaignStep[]> {
    await this.ensureCampaignStepsTable();
    const result = await pool.query(
      'SELECT * FROM campaign_steps WHERE campaign_id = $1 ORDER BY order_index ASC',
      [campaignId]
    );
    return result.rows.map(row => ({
      ...row,
      variations: row.variations || [],
      branches: row.branches || [],
      metrics: row.metrics || { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 },
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async saveCampaignSteps(campaignId: string, steps: Omit<CampaignStep, 'campaign_id' | 'created_at' | 'updated_at'>[]): Promise<CampaignStep[]> {
    await this.ensureCampaignStepsTable();
    
    await pool.query('DELETE FROM campaign_steps WHERE campaign_id = $1', [campaignId]);
    
    const savedSteps: CampaignStep[] = [];
    for (const step of steps) {
      const result = await pool.query(
        `INSERT INTO campaign_steps 
         (id, campaign_id, channel, label, subject, content, delay, delay_unit, order_index, variations, selected_variation_id, branches, metrics)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          step.id,
          campaignId,
          step.channel,
          step.label,
          step.subject,
          step.content,
          step.delay || 0,
          step.delay_unit || 'days',
          step.order_index,
          JSON.stringify(step.variations || []),
          step.selected_variation_id,
          JSON.stringify(step.branches || []),
          JSON.stringify(step.metrics || { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 }),
        ]
      );
      const row = result.rows[0];
      savedSteps.push({
        ...row,
        variations: row.variations || [],
        branches: row.branches || [],
        metrics: row.metrics || { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 },
        created_at: row.created_at?.toISOString(),
        updated_at: row.updated_at?.toISOString(),
      });
    }
    return savedSteps;
  },

  async getCampaignContacts(campaignId: string): Promise<(CampaignContact & { contact?: Partial<DemoContact> })[]> {
    await this.ensureCampaignContactsTable();
    const result = await pool.query(
      `SELECT cc.*, dc.first_name, dc.last_name, dc.email, dc.company, dc.position, dc.score, dc.tags
       FROM campaign_contacts cc
       LEFT JOIN demo_contacts dc ON cc.contact_id = dc.id
       WHERE cc.campaign_id = $1
       ORDER BY cc.assigned_at DESC`,
      [campaignId]
    );
    return result.rows.map(row => ({
      id: row.id,
      campaign_id: row.campaign_id,
      contact_id: row.contact_id,
      status: row.status,
      current_step: row.current_step || 0,
      last_action: row.last_action,
      last_action_at: row.last_action_at?.toISOString() || null,
      assigned_at: row.assigned_at?.toISOString() || new Date().toISOString(),
      completed_at: row.completed_at?.toISOString() || null,
      contact: row.first_name ? {
        id: row.contact_id,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        company: row.company,
        position: row.position,
        score: row.score,
        tags: row.tags || [],
      } : undefined,
    }));
  },

  async addContactsToCampaign(campaignId: string, contactIds: string[]): Promise<number> {
    await this.ensureCampaignContactsTable();
    let addedCount = 0;
    for (const contactId of contactIds) {
      try {
        await pool.query(
          `INSERT INTO campaign_contacts (id, campaign_id, contact_id, status, current_step)
           VALUES ($1, $2, $3, 'queued', 0)
           ON CONFLICT (campaign_id, contact_id) DO NOTHING`,
          [crypto.randomUUID(), campaignId, contactId]
        );
        addedCount++;
      } catch (e) {
        console.log('Contact already in campaign:', contactId);
      }
    }
    return addedCount;
  },

  async removeContactFromCampaign(campaignId: string, contactId: string): Promise<boolean> {
    await this.ensureCampaignContactsTable();
    const result = await pool.query(
      'DELETE FROM campaign_contacts WHERE campaign_id = $1 AND contact_id = $2',
      [campaignId, contactId]
    );
    return (result.rowCount || 0) > 0;
  },

  async updateCampaignContactStatus(campaignId: string, contactId: string, status: string, currentStep?: number): Promise<boolean> {
    await this.ensureCampaignContactsTable();
    const result = await pool.query(
      `UPDATE campaign_contacts 
       SET status = $3, current_step = COALESCE($4, current_step), last_action_at = NOW()
       WHERE campaign_id = $1 AND contact_id = $2`,
      [campaignId, contactId, status, currentStep]
    );
    return (result.rowCount || 0) > 0;
  },

  async getCampaignStats(campaignId: string): Promise<{
    total_contacts: number;
    active_contacts: number;
    completed_contacts: number;
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    total_replied: number;
  }> {
    await this.ensureCampaignContactsTable();
    await this.ensureCampaignStepsTable();

    const contactStats = await pool.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
       FROM campaign_contacts WHERE campaign_id = $1`,
      [campaignId]
    );

    const stepMetrics = await pool.query(
      `SELECT 
         SUM((metrics->>'sent')::int) as sent,
         SUM((metrics->>'opened')::int) as opened,
         SUM((metrics->>'clicked')::int) as clicked,
         SUM((metrics->>'replied')::int) as replied
       FROM campaign_steps WHERE campaign_id = $1`,
      [campaignId]
    );

    const cs = contactStats.rows[0] || {};
    const sm = stepMetrics.rows[0] || {};

    return {
      total_contacts: parseInt(cs.total) || 0,
      active_contacts: parseInt(cs.active) || 0,
      completed_contacts: parseInt(cs.completed) || 0,
      total_sent: parseInt(sm.sent) || 0,
      total_opened: parseInt(sm.opened) || 0,
      total_clicked: parseInt(sm.clicked) || 0,
      total_replied: parseInt(sm.replied) || 0,
    };
  },

  async ensureSophiaAutonomousCampaignsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_autonomous_campaigns (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
        name VARCHAR(255) NOT NULL,
        goal TEXT,
        target_audience JSONB DEFAULT '{}',
        brand_voice_id VARCHAR(255),
        brand_voice_name VARCHAR(255),
        channels JSONB DEFAULT '[]',
        approval_mode VARCHAR(50) DEFAULT 'semi',
        status VARCHAR(50) DEFAULT 'draft',
        leads_found INTEGER DEFAULT 0,
        leads_enriched INTEGER DEFAULT 0,
        messages_generated INTEGER DEFAULT 0,
        messages_sent INTEGER DEFAULT 0,
        responses INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        last_activity_at TIMESTAMP DEFAULT NOW()
      )
    `);
  },

  async ensureSophiaCampaignConfigsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_campaign_configs (
        id VARCHAR(255) PRIMARY KEY,
        campaign_id VARCHAR(255) NOT NULL UNIQUE,
        workspace_id VARCHAR(255) NOT NULL DEFAULT 'default',
        enabled BOOLEAN DEFAULT false,
        autonomy_level VARCHAR(50) DEFAULT 'manual',
        brand_voice_id VARCHAR(255),
        approval_required BOOLEAN DEFAULT true,
        max_daily_messages INTEGER DEFAULT 50,
        personalization_level VARCHAR(50) DEFAULT 'moderate',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  },

  async ensureSophiaActivityLogsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sophia_activity_logs (
        id VARCHAR(255) PRIMARY KEY,
        campaign_id VARCHAR(255) NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW(),
        action VARCHAR(255) NOT NULL,
        details TEXT,
        status VARCHAR(50) DEFAULT 'success',
        metadata JSONB DEFAULT '{}'
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_sophia_activity_campaign ON sophia_activity_logs(campaign_id)`);
  },

  async getSophiaAutonomousCampaigns(workspaceId: string): Promise<SophiaAutonomousCampaign[]> {
    await this.ensureSophiaAutonomousCampaignsTable();
    const result = await pool.query(
      'SELECT * FROM sophia_autonomous_campaigns WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    );
    return result.rows.map(row => ({
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      goal: row.goal,
      target_audience: row.target_audience || {},
      brand_voice_id: row.brand_voice_id,
      brand_voice_name: row.brand_voice_name,
      channels: row.channels || [],
      approval_mode: row.approval_mode,
      status: row.status,
      leads_found: row.leads_found || 0,
      leads_enriched: row.leads_enriched || 0,
      messages_generated: row.messages_generated || 0,
      messages_sent: row.messages_sent || 0,
      responses: row.responses || 0,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      last_activity_at: row.last_activity_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async getSophiaAutonomousCampaignById(id: string): Promise<SophiaAutonomousCampaign | null> {
    await this.ensureSophiaAutonomousCampaignsTable();
    const result = await pool.query(
      'SELECT * FROM sophia_autonomous_campaigns WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      goal: row.goal,
      target_audience: row.target_audience || {},
      brand_voice_id: row.brand_voice_id,
      brand_voice_name: row.brand_voice_name,
      channels: row.channels || [],
      approval_mode: row.approval_mode,
      status: row.status,
      leads_found: row.leads_found || 0,
      leads_enriched: row.leads_enriched || 0,
      messages_generated: row.messages_generated || 0,
      messages_sent: row.messages_sent || 0,
      responses: row.responses || 0,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      last_activity_at: row.last_activity_at?.toISOString() || new Date().toISOString(),
    };
  },

  async createSophiaAutonomousCampaign(campaign: Omit<SophiaAutonomousCampaign, 'created_at' | 'last_activity_at'>): Promise<SophiaAutonomousCampaign> {
    await this.ensureSophiaAutonomousCampaignsTable();
    const result = await pool.query(
      `INSERT INTO sophia_autonomous_campaigns 
       (id, workspace_id, name, goal, target_audience, brand_voice_id, brand_voice_name, channels, approval_mode, status, leads_found, leads_enriched, messages_generated, messages_sent, responses)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        campaign.id,
        campaign.workspace_id,
        campaign.name,
        campaign.goal,
        JSON.stringify(campaign.target_audience),
        campaign.brand_voice_id,
        campaign.brand_voice_name,
        JSON.stringify(campaign.channels),
        campaign.approval_mode,
        campaign.status,
        campaign.leads_found,
        campaign.leads_enriched,
        campaign.messages_generated,
        campaign.messages_sent,
        campaign.responses,
      ]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      goal: row.goal,
      target_audience: row.target_audience || {},
      brand_voice_id: row.brand_voice_id,
      brand_voice_name: row.brand_voice_name,
      channels: row.channels || [],
      approval_mode: row.approval_mode,
      status: row.status,
      leads_found: row.leads_found || 0,
      leads_enriched: row.leads_enriched || 0,
      messages_generated: row.messages_generated || 0,
      messages_sent: row.messages_sent || 0,
      responses: row.responses || 0,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      last_activity_at: row.last_activity_at?.toISOString() || new Date().toISOString(),
    };
  },

  async updateSophiaAutonomousCampaign(id: string, updates: Partial<SophiaAutonomousCampaign>): Promise<SophiaAutonomousCampaign | null> {
    await this.ensureSophiaAutonomousCampaignsTable();
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    const allowedFields = ['name', 'goal', 'target_audience', 'brand_voice_id', 'brand_voice_name', 'channels', 'approval_mode', 'status', 'leads_found', 'leads_enriched', 'messages_generated', 'messages_sent', 'responses'];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        const dbKey = key;
        if (key === 'target_audience' || key === 'channels') {
          setClauses.push(`${dbKey} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${dbKey} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (setClauses.length === 0) return this.getSophiaAutonomousCampaignById(id);

    setClauses.push(`last_activity_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE sophia_autonomous_campaigns SET ${setClauses.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      workspace_id: row.workspace_id,
      name: row.name,
      goal: row.goal,
      target_audience: row.target_audience || {},
      brand_voice_id: row.brand_voice_id,
      brand_voice_name: row.brand_voice_name,
      channels: row.channels || [],
      approval_mode: row.approval_mode,
      status: row.status,
      leads_found: row.leads_found || 0,
      leads_enriched: row.leads_enriched || 0,
      messages_generated: row.messages_generated || 0,
      messages_sent: row.messages_sent || 0,
      responses: row.responses || 0,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      last_activity_at: row.last_activity_at?.toISOString() || new Date().toISOString(),
    };
  },

  async deleteSophiaAutonomousCampaign(id: string): Promise<boolean> {
    await this.ensureSophiaAutonomousCampaignsTable();
    const result = await pool.query('DELETE FROM sophia_autonomous_campaigns WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  },

  async getSophiaCampaignConfig(campaignId: string): Promise<SophiaCampaignConfig | null> {
    await this.ensureSophiaCampaignConfigsTable();
    const result = await pool.query(
      'SELECT * FROM sophia_campaign_configs WHERE campaign_id = $1',
      [campaignId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      campaign_id: row.campaign_id,
      workspace_id: row.workspace_id,
      enabled: row.enabled,
      autonomy_level: row.autonomy_level,
      brand_voice_id: row.brand_voice_id,
      approval_required: row.approval_required,
      max_daily_messages: row.max_daily_messages,
      personalization_level: row.personalization_level,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  },

  async saveSophiaCampaignConfig(config: Omit<SophiaCampaignConfig, 'created_at' | 'updated_at'>): Promise<SophiaCampaignConfig> {
    await this.ensureSophiaCampaignConfigsTable();
    const result = await pool.query(
      `INSERT INTO sophia_campaign_configs 
       (id, campaign_id, workspace_id, enabled, autonomy_level, brand_voice_id, approval_required, max_daily_messages, personalization_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (campaign_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         autonomy_level = EXCLUDED.autonomy_level,
         brand_voice_id = EXCLUDED.brand_voice_id,
         approval_required = EXCLUDED.approval_required,
         max_daily_messages = EXCLUDED.max_daily_messages,
         personalization_level = EXCLUDED.personalization_level,
         updated_at = NOW()
       RETURNING *`,
      [
        config.id,
        config.campaign_id,
        config.workspace_id,
        config.enabled,
        config.autonomy_level,
        config.brand_voice_id,
        config.approval_required,
        config.max_daily_messages,
        config.personalization_level,
      ]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      campaign_id: row.campaign_id,
      workspace_id: row.workspace_id,
      enabled: row.enabled,
      autonomy_level: row.autonomy_level,
      brand_voice_id: row.brand_voice_id,
      approval_required: row.approval_required,
      max_daily_messages: row.max_daily_messages,
      personalization_level: row.personalization_level,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    };
  },

  async getSophiaCampaignConfigs(workspaceId: string): Promise<SophiaCampaignConfig[]> {
    await this.ensureSophiaCampaignConfigsTable();
    const result = await pool.query(
      'SELECT * FROM sophia_campaign_configs WHERE workspace_id = $1 ORDER BY created_at DESC',
      [workspaceId]
    );
    return result.rows.map(row => ({
      id: row.id,
      campaign_id: row.campaign_id,
      workspace_id: row.workspace_id,
      enabled: row.enabled,
      autonomy_level: row.autonomy_level,
      brand_voice_id: row.brand_voice_id,
      approval_required: row.approval_required,
      max_daily_messages: row.max_daily_messages,
      personalization_level: row.personalization_level,
      created_at: row.created_at?.toISOString() || new Date().toISOString(),
      updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async addSophiaActivityLog(log: Omit<SophiaActivityLog, 'timestamp'>): Promise<SophiaActivityLog> {
    await this.ensureSophiaActivityLogsTable();
    const result = await pool.query(
      `INSERT INTO sophia_activity_logs (id, campaign_id, action, details, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [log.id, log.campaign_id, log.action, log.details, log.status, JSON.stringify(log.metadata || {})]
    );
    const row = result.rows[0];
    return {
      id: row.id,
      campaign_id: row.campaign_id,
      timestamp: row.timestamp?.toISOString() || new Date().toISOString(),
      action: row.action,
      details: row.details,
      status: row.status,
      metadata: row.metadata,
    };
  },

  async getSophiaActivityLogs(campaignId: string, limit: number = 50): Promise<SophiaActivityLog[]> {
    await this.ensureSophiaActivityLogsTable();
    const result = await pool.query(
      'SELECT * FROM sophia_activity_logs WHERE campaign_id = $1 ORDER BY timestamp DESC LIMIT $2',
      [campaignId, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      campaign_id: row.campaign_id,
      timestamp: row.timestamp?.toISOString() || new Date().toISOString(),
      action: row.action,
      details: row.details,
      status: row.status,
      metadata: row.metadata,
    }));
  },

  // ============================================
  // LINKEDIN SCRAPED LEADS - Persistent Storage
  // ============================================

  async ensureLinkedInScrapedLeadsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS linkedin_scraped_leads (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        profile_url TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        headline TEXT,
        company VARCHAR(255),
        location VARCHAR(255),
        connection_degree VARCHAR(50),
        mutual_connections INTEGER,
        profile_image_url TEXT,
        email VARCHAR(255),
        email_confidence DECIMAL(3,2),
        email_verified BOOLEAN DEFAULT false,
        email_source VARCHAR(100),
        phone VARCHAR(50),
        source_type VARCHAR(50) NOT NULL,
        source_id VARCHAR(255),
        source_name VARCHAR(255),
        search_job_id VARCHAR(255),
        is_premium BOOLEAN DEFAULT false,
        is_open_to_work BOOLEAN DEFAULT false,
        enriched BOOLEAN DEFAULT false,
        enriched_at TIMESTAMP,
        saved_to_contacts BOOLEAN DEFAULT false,
        contact_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_workspace_profile UNIQUE (workspace_id, profile_url)
      )
    `);
    
    // Migration: Add missing columns to existing tables
    const columnsToAdd = [
      { name: 'first_name', type: 'VARCHAR(255)' },
      { name: 'last_name', type: 'VARCHAR(255)' },
      { name: 'company', type: 'VARCHAR(255)' },
      { name: 'mutual_connections', type: 'INTEGER' },
      { name: 'profile_image_url', type: 'TEXT' },
      { name: 'email', type: 'VARCHAR(255)' },
      { name: 'email_confidence', type: 'DECIMAL(3,2)' },
      { name: 'email_verified', type: 'BOOLEAN DEFAULT false' },
      { name: 'email_source', type: 'VARCHAR(100)' },
      { name: 'phone', type: 'VARCHAR(50)' },
      { name: 'source_name', type: 'VARCHAR(255)' },
      { name: 'search_job_id', type: 'VARCHAR(255)' },
      { name: 'is_premium', type: 'BOOLEAN DEFAULT false' },
      { name: 'is_open_to_work', type: 'BOOLEAN DEFAULT false' },
      { name: 'enriched', type: 'BOOLEAN DEFAULT false' },
      { name: 'enriched_at', type: 'TIMESTAMP' },
      { name: 'saved_to_contacts', type: 'BOOLEAN DEFAULT false' },
      { name: 'contact_id', type: 'VARCHAR(255)' },
    ];
    
    for (const col of columnsToAdd) {
      await pool.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'linkedin_scraped_leads' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE linkedin_scraped_leads ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `).catch(err => {
        console.log(`[DB Migration] Column ${col.name} may already exist:`, err.message);
      });
    }
    
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_linkedin_leads_workspace ON linkedin_scraped_leads(workspace_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_linkedin_leads_source ON linkedin_scraped_leads(source_type, source_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_linkedin_leads_job ON linkedin_scraped_leads(search_job_id)`);
    // Add unique constraint if not exists (for existing tables)
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_workspace_profile') THEN
          ALTER TABLE linkedin_scraped_leads ADD CONSTRAINT unique_workspace_profile UNIQUE (workspace_id, profile_url);
        END IF;
      END $$;
    `).catch(() => { /* constraint may already exist */ });
  },

  async ensureLinkedInSearchJobsTable(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS linkedin_search_jobs (
        id VARCHAR(255) PRIMARY KEY,
        workspace_id VARCHAR(255) NOT NULL,
        account_id VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        search_criteria JSONB,
        max_results INTEGER DEFAULT 100,
        total_found INTEGER DEFAULT 0,
        total_pulled INTEGER DEFAULT 0,
        credits_used INTEGER DEFAULT 0,
        progress INTEGER DEFAULT 0,
        daily_limit_reached BOOLEAN DEFAULT false,
        error TEXT,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_linkedin_jobs_workspace ON linkedin_search_jobs(workspace_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_linkedin_jobs_status ON linkedin_search_jobs(status)`);
  },

  async saveLinkedInScrapedLead(lead: {
    id: string;
    workspace_id: string;
    profile_url: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    headline?: string | null;
    company?: string | null;
    location?: string | null;
    connection_degree?: string | null;
    mutual_connections?: number | null;
    profile_image_url?: string | null;
    email?: string | null;
    email_confidence?: number | null;
    email_verified?: boolean | null;
    email_source?: string | null;
    phone?: string | null;
    source_type: string;
    source_id?: string | null;
    source_name?: string | null;
    search_job_id?: string | null;
    is_premium?: boolean;
    is_open_to_work?: boolean;
    enriched?: boolean;
  }): Promise<{ isNew: boolean }> {
    await this.ensureLinkedInScrapedLeadsTable();
    const result = await pool.query(`
      INSERT INTO linkedin_scraped_leads 
      (id, workspace_id, profile_url, name, first_name, last_name, headline, company, location, 
       connection_degree, mutual_connections, profile_image_url, email, email_confidence, email_verified,
       email_source, phone, source_type, source_id, source_name, search_job_id, is_premium, is_open_to_work, enriched)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      ON CONFLICT (workspace_id, profile_url) DO UPDATE SET
        name = EXCLUDED.name,
        headline = EXCLUDED.headline,
        company = EXCLUDED.company,
        email = COALESCE(EXCLUDED.email, linkedin_scraped_leads.email),
        email_confidence = COALESCE(EXCLUDED.email_confidence, linkedin_scraped_leads.email_confidence),
        email_verified = COALESCE(EXCLUDED.email_verified, linkedin_scraped_leads.email_verified),
        phone = COALESCE(EXCLUDED.phone, linkedin_scraped_leads.phone),
        enriched = EXCLUDED.enriched OR linkedin_scraped_leads.enriched,
        search_job_id = EXCLUDED.search_job_id,
        updated_at = NOW()
      RETURNING (xmax = 0) as is_new
    `, [
      lead.id,
      lead.workspace_id,
      lead.profile_url,
      lead.name,
      lead.first_name || null,
      lead.last_name || null,
      lead.headline || null,
      lead.company || null,
      lead.location || null,
      lead.connection_degree || null,
      lead.mutual_connections || null,
      lead.profile_image_url || null,
      lead.email || null,
      lead.email_confidence || null,
      lead.email_verified || false,
      lead.email_source || null,
      lead.phone || null,
      lead.source_type,
      lead.source_id || null,
      lead.source_name || null,
      lead.search_job_id || null,
      lead.is_premium || false,
      lead.is_open_to_work || false,
      lead.enriched || false,
    ]);
    return { isNew: result.rows[0]?.is_new ?? true };
  },

  async saveLinkedInScrapedLeadsBulk(leads: Array<{
    id: string;
    workspace_id: string;
    profile_url: string;
    name: string;
    first_name?: string | null;
    last_name?: string | null;
    headline?: string | null;
    company?: string | null;
    location?: string | null;
    connection_degree?: string | null;
    mutual_connections?: number | null;
    email?: string | null;
    email_confidence?: number | null;
    phone?: string | null;
    source_type: string;
    source_id?: string | null;
    source_name?: string | null;
    search_job_id?: string | null;
    is_premium?: boolean;
    is_open_to_work?: boolean;
  }>): Promise<number> {
    if (leads.length === 0) return 0;
    console.log(`[DB] Saving ${leads.length} LinkedIn leads to database for workspace: ${leads[0]?.workspace_id}`);
    await this.ensureLinkedInScrapedLeadsTable();
    
    let newLeadsCount = 0;
    for (const lead of leads) {
      try {
        const result = await this.saveLinkedInScrapedLead(lead);
        if (result.isNew) {
          newLeadsCount++;
        }
      } catch (error) {
        console.error('[DB] Failed to save lead:', lead.profile_url, error);
      }
    }
    return newLeadsCount;
  },

  async getLinkedInScrapedLeads(workspaceId: string, options?: {
    sourceType?: string;
    sourceId?: string;
    searchJobId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    console.log(`[DB] Fetching LinkedIn leads for workspace: ${workspaceId}`);
    await this.ensureLinkedInScrapedLeadsTable();
    
    let query = 'SELECT * FROM linkedin_scraped_leads WHERE workspace_id = $1';
    const params: any[] = [workspaceId];
    let paramIndex = 2;

    if (options?.sourceType) {
      query += ` AND source_type = $${paramIndex++}`;
      params.push(options.sourceType);
    }
    if (options?.sourceId) {
      query += ` AND source_id = $${paramIndex++}`;
      params.push(options.sourceId);
    }
    if (options?.searchJobId) {
      query += ` AND search_job_id = $${paramIndex++}`;
      params.push(options.searchJobId);
    }

    query += ' ORDER BY created_at DESC';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(options.limit);
    }
    if (options?.offset) {
      query += ` OFFSET $${paramIndex++}`;
      params.push(options.offset);
    }

    const result = await pool.query(query, params);
    console.log(`[DB] Query returned ${result.rows.length} leads`);
    return result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      profileUrl: row.profile_url,
      name: row.name,
      firstName: row.first_name,
      lastName: row.last_name,
      headline: row.headline,
      company: row.company,
      location: row.location,
      connectionDegree: row.connection_degree,
      mutualConnections: row.mutual_connections,
      profileImageUrl: row.profile_image_url,
      email: row.email,
      emailConfidence: row.email_confidence,
      emailVerified: row.email_verified,
      emailSource: row.email_source,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceName: row.source_name,
      searchJobId: row.search_job_id,
      isPremium: row.is_premium,
      isOpenToWork: row.is_open_to_work,
      enriched: row.enriched,
      enrichedAt: row.enriched_at?.toISOString(),
      savedToContacts: row.saved_to_contacts,
      contactId: row.contact_id,
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async saveLinkedInSearchJob(job: {
    id: string;
    workspace_id: string;
    account_id?: string | null;
    status: string;
    search_criteria?: Record<string, any> | null;
    max_results?: number;
    total_found?: number;
    total_pulled?: number;
    credits_used?: number;
    progress?: number;
    daily_limit_reached?: boolean;
    error?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  }): Promise<void> {
    await this.ensureLinkedInSearchJobsTable();
    await pool.query(`
      INSERT INTO linkedin_search_jobs 
      (id, workspace_id, account_id, status, search_criteria, max_results, total_found, 
       total_pulled, credits_used, progress, daily_limit_reached, error, started_at, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        total_found = EXCLUDED.total_found,
        total_pulled = EXCLUDED.total_pulled,
        credits_used = EXCLUDED.credits_used,
        progress = EXCLUDED.progress,
        daily_limit_reached = EXCLUDED.daily_limit_reached,
        error = EXCLUDED.error,
        completed_at = EXCLUDED.completed_at,
        updated_at = NOW()
    `, [
      job.id,
      job.workspace_id,
      job.account_id || null,
      job.status,
      JSON.stringify(job.search_criteria || {}),
      job.max_results || 100,
      job.total_found || 0,
      job.total_pulled || 0,
      job.credits_used || 0,
      job.progress || 0,
      job.daily_limit_reached || false,
      job.error || null,
      job.started_at || null,
      job.completed_at || null,
    ]);
  },

  async getLinkedInSearchJob(jobId: string): Promise<any | null> {
    await this.ensureLinkedInSearchJobsTable();
    const result = await pool.query(
      'SELECT * FROM linkedin_search_jobs WHERE id = $1',
      [jobId]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    
    // Get the leads for this job to populate results
    const leadsResult = await pool.query(
      'SELECT * FROM linkedin_scraped_leads WHERE search_job_id = $1 ORDER BY created_at',
      [jobId]
    ).catch(() => ({ rows: [] }));
    
    const results = leadsResult.rows.map(lead => ({
      profileUrl: lead.profile_url,
      name: lead.name,
      firstName: lead.first_name,
      lastName: lead.last_name,
      headline: lead.headline,
      company: lead.company,
      location: lead.location,
      connectionDegree: lead.connection_degree,
      mutualConnections: lead.mutual_connections,
      isPremium: lead.is_premium,
      isOpenToWork: lead.is_open_to_work,
      email: lead.email,
      emailConfidence: lead.email_confidence,
      dataSource: 'linkedin_search',
    }));
    
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      accountId: row.account_id,
      criteria: row.search_criteria || {},
      status: row.status,
      maxResults: row.max_results,
      totalFound: row.total_found,
      totalPulled: row.total_pulled,
      creditsUsed: row.credits_used,
      progress: row.progress,
      dailyLimitReached: row.daily_limit_reached,
      error: row.error,
      startedAt: row.started_at?.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      results,
    };
  },

  async getLinkedInSearchJobs(workspaceId: string, limit: number = 20): Promise<any[]> {
    await this.ensureLinkedInSearchJobsTable();
    const result = await pool.query(
      'SELECT * FROM linkedin_search_jobs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2',
      [workspaceId, limit]
    );
    return result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      accountId: row.account_id,
      status: row.status,
      searchCriteria: row.search_criteria,
      maxResults: row.max_results,
      totalFound: row.total_found,
      totalPulled: row.total_pulled,
      creditsUsed: row.credits_used,
      progress: row.progress,
      dailyLimitReached: row.daily_limit_reached,
      error: row.error,
      startedAt: row.started_at?.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      createdAt: row.created_at?.toISOString() || new Date().toISOString(),
      updatedAt: row.updated_at?.toISOString() || new Date().toISOString(),
    }));
  },

  async updateLinkedInSearchJobStatus(jobId: string, updates: {
    status?: string;
    total_found?: number;
    total_pulled?: number;
    credits_used?: number;
    progress?: number;
    daily_limit_reached?: boolean;
    error?: string | null;
    completed_at?: string | null;
  }): Promise<void> {
    await this.ensureLinkedInSearchJobsTable();
    const setClauses: string[] = ['updated_at = NOW()'];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      params.push(updates.status);
    }
    if (updates.total_found !== undefined) {
      setClauses.push(`total_found = $${paramIndex++}`);
      params.push(updates.total_found);
    }
    if (updates.total_pulled !== undefined) {
      setClauses.push(`total_pulled = $${paramIndex++}`);
      params.push(updates.total_pulled);
    }
    if (updates.credits_used !== undefined) {
      setClauses.push(`credits_used = $${paramIndex++}`);
      params.push(updates.credits_used);
    }
    if (updates.progress !== undefined) {
      setClauses.push(`progress = $${paramIndex++}`);
      params.push(updates.progress);
    }
    if (updates.daily_limit_reached !== undefined) {
      setClauses.push(`daily_limit_reached = $${paramIndex++}`);
      params.push(updates.daily_limit_reached);
    }
    if (updates.error !== undefined) {
      setClauses.push(`error = $${paramIndex++}`);
      params.push(updates.error);
    }
    if (updates.completed_at !== undefined) {
      setClauses.push(`completed_at = $${paramIndex++}`);
      params.push(updates.completed_at);
    }

    params.push(jobId);
    await pool.query(
      `UPDATE linkedin_search_jobs SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      params
    );
  },

  async deleteLinkedInScrapedLeads(workspaceId: string, leadIds: string[]): Promise<number> {
    await this.ensureLinkedInScrapedLeadsTable();
    if (!leadIds || leadIds.length === 0) return 0;
    
    const placeholders = leadIds.map((_, i) => `$${i + 2}`).join(', ');
    const result = await pool.query(
      `DELETE FROM linkedin_scraped_leads WHERE workspace_id = $1 AND id IN (${placeholders}) RETURNING id`,
      [workspaceId, ...leadIds]
    );
    
    console.log(`[DB] Deleted ${result.rowCount} LinkedIn leads for workspace: ${workspaceId}`);
    return result.rowCount || 0;
  },
};
