import { Router, Request, Response } from 'express';
import { pool } from './db';

const router = Router();

router.post('/api/data-export', async (req: Request, res: Response) => {
  try {
    const { workspace_id, type, format, fields, date_range } = req.body;
    
    if (!workspace_id) {
      return res.status(400).json({ error: 'Workspace ID required' });
    }

    const allowedTypes = ['contacts', 'campaigns', 'deals', 'analytics', 'emails', 'all'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid export type' });
    }

    const allowedDateRanges = ['all', '30', '90', '365'];
    if (!allowedDateRanges.includes(date_range)) {
      return res.status(400).json({ error: 'Invalid date range' });
    }

    let data: any[] = [];
    const daysNum = date_range !== 'all' ? parseInt(date_range, 10) : null;

    switch (type) {
      case 'contacts':
        const contactsResult = daysNum
          ? await pool.query(
              `SELECT * FROM contacts WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2 ORDER BY created_at DESC`,
              [workspace_id, daysNum]
            )
          : await pool.query(
              `SELECT * FROM contacts WHERE workspace_id = $1 ORDER BY created_at DESC`,
              [workspace_id]
            );
        data = contactsResult.rows;
        break;
      case 'campaigns':
        const campaignsResult = daysNum
          ? await pool.query(
              `SELECT * FROM campaigns WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2 ORDER BY created_at DESC`,
              [workspace_id, daysNum]
            )
          : await pool.query(
              `SELECT * FROM campaigns WHERE workspace_id = $1 ORDER BY created_at DESC`,
              [workspace_id]
            );
        data = campaignsResult.rows;
        break;
      case 'deals':
        const dealsResult = daysNum
          ? await pool.query(
              `SELECT * FROM deals WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '1 day' * $2 ORDER BY created_at DESC`,
              [workspace_id, daysNum]
            )
          : await pool.query(
              `SELECT * FROM deals WHERE workspace_id = $1 ORDER BY created_at DESC`,
              [workspace_id]
            );
        data = dealsResult.rows;
        break;
      default:
        data = [];
    }

    if (fields && fields.length > 0) {
      data = data.map(row => {
        const filtered: Record<string, any> = {};
        fields.forEach((field: string) => {
          if (row[field] !== undefined) {
            filtered[field] = row[field];
          }
        });
        return filtered;
      });
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${type}_export.json"`);
      return res.json(data);
    }

    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
    ];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}_export.csv"`);
    return res.send(csvRows.join('\n'));

  } catch (error) {
    console.error('Data export error:', error);
    res.status(500).json({ error: 'Export failed' });
  }
});

router.get('/api/audit-logs', async (req: Request, res: Response) => {
  try {
    const { workspace_id, page = 1, limit = 20, action, resource_type } = req.query;

    const allowedActions = ['all', 'create', 'update', 'delete', 'login', 'export', 'view'];
    const allowedResources = ['all', 'user', 'campaign', 'settings', 'data', 'security'];

    const actionFilter = action && action !== 'all' && allowedActions.includes(action as string) ? action as string : null;
    const resourceFilter = resource_type && resource_type !== 'all' && allowedResources.includes(resource_type as string) ? resource_type as string : null;

    let paramIndex = 1;
    const params: any[] = [workspace_id];
    let query = `
      SELECT 
        al.*,
        p.email as user_email,
        p.full_name as user_name
      FROM audit_logs al
      LEFT JOIN profiles p ON al.user_id::text = p.id::text
      WHERE al.workspace_id = $${paramIndex++}
    `;

    if (actionFilter) {
      params.push(actionFilter);
      query += ` AND al.action = $${paramIndex++}`;
    }
    if (resourceFilter) {
      params.push(resourceFilter);
      query += ` AND al.resource_type = $${paramIndex++}`;
    }

    params.push(Number(limit));
    params.push((Number(page) - 1) * Number(limit));
    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM audit_logs WHERE workspace_id = $1',
      [workspace_id]
    );

    res.json({
      logs: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Audit log fetch error:', error);
    res.json({ logs: [], total: 0 });
  }
});

router.post('/api/audit-logs', async (req: Request, res: Response) => {
  try {
    const { workspace_id, user_id, action, resource_type, resource_id, details } = req.body;

    await pool.query(`
      INSERT INTO audit_logs (workspace_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      workspace_id,
      user_id,
      action,
      resource_type,
      resource_id,
      JSON.stringify(details || {}),
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown'
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('Audit log create error:', error);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
});

router.post('/api/notification-settings', async (req: Request, res: Response) => {
  try {
    const { workspace_id, notifications, slack_webhook, teams_webhook } = req.body;

    await pool.query(`
      INSERT INTO notification_settings (workspace_id, notifications, slack_webhook, teams_webhook, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (workspace_id) DO UPDATE SET
        notifications = $2,
        slack_webhook = $3,
        teams_webhook = $4,
        updated_at = NOW()
    `, [workspace_id, JSON.stringify(notifications), slack_webhook, teams_webhook]);

    res.json({ success: true });
  } catch (error) {
    console.error('Notification settings error:', error);
    res.status(500).json({ error: 'Failed to save notification settings' });
  }
});

router.get('/api/notification-settings/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const result = await pool.query(
      'SELECT * FROM notification_settings WHERE workspace_id = $1',
      [workspaceId]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.json(null);
  }
});

router.post('/api/test-webhook', async (req: Request, res: Response) => {
  try {
    const { type, webhook_url } = req.body;

    if (!webhook_url || typeof webhook_url !== 'string') {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    const allowedTypes = ['slack', 'teams'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid webhook type' });
    }

    try {
      const url = new URL(webhook_url);
      const validSlackHosts = ['hooks.slack.com'];
      const validTeamsHosts = ['outlook.office.com', 'outlook.webhook.office.com'];
      
      if (type === 'slack' && !validSlackHosts.some(h => url.host.endsWith(h))) {
        return res.status(400).json({ error: 'Invalid Slack webhook URL' });
      }
      if (type === 'teams' && !validTeamsHosts.some(h => url.host.endsWith(h))) {
        return res.status(400).json({ error: 'Invalid Teams webhook URL' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid webhook URL format' });
    }

    console.log(`[Webhook Test] Testing ${type} webhook: ${webhook_url.substring(0, 50)}...`);

    const message = type === 'slack' 
      ? { text: '✅ IntelLead notification test successful!' }
      : {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          summary: 'IntelLead Test',
          themeColor: '0076D7',
          title: 'IntelLead Notification Test',
          text: '✅ Your webhook is connected successfully!'
        };

    const response = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      res.json({ success: true });
    } else {
      res.status(400).json({ error: 'Webhook test failed' });
    }
  } catch (error) {
    console.error('Webhook test error:', error);
    res.status(500).json({ error: 'Webhook test failed' });
  }
});

router.post('/api/rate-limits', async (req: Request, res: Response) => {
  try {
    const { workspace_id, global_enabled, configs } = req.body;

    await pool.query(`
      INSERT INTO rate_limit_settings (workspace_id, global_enabled, configs, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (workspace_id) DO UPDATE SET
        global_enabled = $2,
        configs = $3,
        updated_at = NOW()
    `, [workspace_id, global_enabled, JSON.stringify(configs)]);

    res.json({ success: true });
  } catch (error) {
    console.error('Rate limits error:', error);
    res.status(500).json({ error: 'Failed to save rate limits' });
  }
});

router.get('/api/rate-limits/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const result = await pool.query(
      'SELECT * FROM rate_limit_settings WHERE workspace_id = $1',
      [workspaceId]
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    res.json(null);
  }
});

router.post('/api/help-assistant', async (req: Request, res: Response) => {
  try {
    const { message, systemPrompt, relevantDocs } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    const response = completion.choices[0]?.message?.content || '';

    res.json({ 
      response,
      relevantDocs: relevantDocs || []
    });
  } catch (error: any) {
    console.error('Help assistant error:', error);
    res.status(500).json({ 
      error: 'Help assistant unavailable',
      fallback: true
    });
  }
});

router.get('/api/linkedin-automation/location-sync/status', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspace_id as string;
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspace_id required' });
    }

    const result = await pool.query(
      `SELECT * FROM linkedin_location_sync WHERE workspace_id = $1`,
      [workspaceId]
    );

    if (result.rows.length === 0) {
      return res.json({
        enabled: false,
        current_location: null,
        proxy_country: null,
        last_sync_at: null,
        next_sync_at: null,
        sync_frequency: 4,
        auto_detect_enabled: true,
        detected_location: null,
        sync_count_today: 0
      });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Location sync status error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/linkedin-automation/location-sync/detect', async (req: Request, res: Response) => {
  try {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = Array.isArray(clientIp) ? clientIp[0] : clientIp.split(',')[0].trim();
    
    const geoResponse = await fetch(`http://ip-api.com/json/${ip}`);
    const geoData = await geoResponse.json() as { country: string; countryCode: string; city: string; query: string };
    
    res.json({
      country: geoData.country || 'United States',
      countryCode: (geoData.countryCode || 'US').toLowerCase(),
      city: geoData.city || 'Unknown',
      ip: geoData.query || ip
    });
  } catch (error: any) {
    console.error('Location detection error:', error);
    res.json({
      country: 'United States',
      countryCode: 'us',
      city: 'Unknown',
      ip: 'Unknown'
    });
  }
});

router.post('/api/linkedin-automation/location-sync/sync-now', async (req: Request, res: Response) => {
  try {
    const { workspace_id, target_country } = req.body;
    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id required' });
    }

    const countryCode = target_country?.toLowerCase() || 'us';
    
    const now = new Date();
    const nextSync = new Date(now.getTime() + 6 * 60 * 60 * 1000);

    await pool.query(`
      INSERT INTO linkedin_location_sync (workspace_id, enabled, proxy_country, last_sync_at, next_sync_at, sync_count_today, detected_location)
      VALUES ($1, true, $2, $3, $4, 1, $5)
      ON CONFLICT (workspace_id) 
      DO UPDATE SET 
        proxy_country = $2,
        last_sync_at = $3,
        next_sync_at = $4,
        sync_count_today = CASE 
          WHEN DATE(linkedin_location_sync.last_sync_at) = CURRENT_DATE 
          THEN linkedin_location_sync.sync_count_today + 1 
          ELSE 1 
        END,
        detected_location = $5
    `, [workspace_id, countryCode, now.toISOString(), nextSync.toISOString(), target_country || 'United States']);

    res.json({
      success: true,
      country: countryCode.toUpperCase(),
      ip: 'Proxy rotated',
      next_sync: nextSync.toISOString()
    });
  } catch (error: any) {
    console.error('Location sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/api/linkedin-automation/location-sync/settings', async (req: Request, res: Response) => {
  try {
    const { workspace_id, location_sync_enabled, sync_frequency, auto_detect_enabled, manual_country } = req.body;
    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id required' });
    }

    const updates: string[] = [];
    const values: any[] = [workspace_id];
    let paramIndex = 2;

    if (location_sync_enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(location_sync_enabled);
    }
    if (sync_frequency !== undefined) {
      updates.push(`sync_frequency = $${paramIndex++}`);
      values.push(sync_frequency);
      
      const hoursInterval = Math.floor(24 / sync_frequency);
      const nextSync = new Date(Date.now() + hoursInterval * 60 * 60 * 1000);
      updates.push(`next_sync_at = $${paramIndex++}`);
      values.push(nextSync.toISOString());
    }
    if (auto_detect_enabled !== undefined) {
      updates.push(`auto_detect_enabled = $${paramIndex++}`);
      values.push(auto_detect_enabled);
    }
    if (manual_country !== undefined) {
      updates.push(`proxy_country = $${paramIndex++}`);
      values.push(manual_country);
    }

    if (updates.length === 0) {
      return res.json({ success: true });
    }

    await pool.query(`
      INSERT INTO linkedin_location_sync (workspace_id, enabled, sync_frequency, auto_detect_enabled, proxy_country)
      VALUES ($1, COALESCE($2, false), COALESCE($3, 4), COALESCE($4, true), $5)
      ON CONFLICT (workspace_id) 
      DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()
    `, [
      workspace_id,
      location_sync_enabled ?? false,
      sync_frequency ?? 4,
      auto_detect_enabled ?? true,
      manual_country ?? 'us'
    ]);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Location sync settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

export async function initSettingsRoutes(app: any) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      workspace_id UUID NOT NULL,
      user_id UUID,
      action VARCHAR(50) NOT NULL,
      resource_type VARCHAR(50) NOT NULL,
      resource_id VARCHAR(255),
      details JSONB DEFAULT '{}',
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      workspace_id UUID PRIMARY KEY,
      notifications JSONB DEFAULT '[]',
      slack_webhook TEXT,
      teams_webhook TEXT,
      push_enabled BOOLEAN DEFAULT true,
      email_enabled BOOLEAN DEFAULT true,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limit_settings (
      workspace_id UUID PRIMARY KEY,
      global_enabled BOOLEAN DEFAULT true,
      configs JSONB DEFAULT '[]',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS linkedin_location_sync (
      workspace_id UUID PRIMARY KEY,
      enabled BOOLEAN DEFAULT false,
      proxy_country VARCHAR(10) DEFAULT 'us',
      current_location VARCHAR(100),
      detected_location VARCHAR(100),
      last_sync_at TIMESTAMP,
      next_sync_at TIMESTAMP,
      sync_frequency INT DEFAULT 4,
      auto_detect_enabled BOOLEAN DEFAULT true,
      sync_count_today INT DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  app.use(router);
  console.log('✅ Settings routes registered (data export, audit log, notifications, rate limits, location sync)');
}

export default router;
