import type { Express } from 'express';

export async function initializeFullApp(app: Express): Promise<void> {
  console.log('[Index Init] Loading heavy dependencies...');
  
  const [
    { default: path },
    { fileURLToPath },
    { default: OpenAI },
    { default: Anthropic },
    { createClient }
  ] = await Promise.all([
    import('path'),
    import('url'),
    import('openai'),
    import('@anthropic-ai/sdk'),
    import('@supabase/supabase-js')
  ]);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  console.log('✅ Supabase client initialized for authentication');

  const OPENAI_MODEL = "gpt-4o";
  const CLAUDE_MODEL = "claude-sonnet-4-5";

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  let anthropic: InstanceType<typeof Anthropic> | null = null;
  const hasAnthropicIntegration = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY && 
                                   process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (hasAnthropicIntegration) {
    anthropic = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL!,
    });
    console.log('✅ Anthropic Claude client initialized (Replit AI Integrations)');
  } else {
    console.log('⚠️ Anthropic AI Integrations not configured - Claude model unavailable');
  }

  console.log('[Index Init] Loading route modules...');

  const [
    { registerCrudRoutes },
    { registerConnectorRoutes },
    { registerCampaignExecutionRoutes },
    { registerCampaignExecutorRoutes },
    { registerIntegrationRoutes },
    actionRoutes,
    sophiaOptimizationRoutes,
    sophiaBrainAdminRoutes,
    sophiaLearningRoutes,
    sophiaControlModule,
    socialSchedulingRoutes,
    superAdminRoutes,
    { initSettingsRoutes }
  ] = await Promise.all([
    import('./routes-crud.js'),
    import('./routes-connectors.js'),
    import('./routes-campaign-execution.js'),
    import('./routes-campaign-executor.js'),
    import('./routes-integrations.js'),
    import('./routes-actions.js'),
    import('./routes-sophia-optimization.js'),
    import('./routes-sophia-brain-admin.js'),
    import('./routes-sophia-learning.js'),
    import('./routes-sophia-control.js'),
    import('./routes-social-scheduling.js'),
    import('./routes-super-admin.js'),
    import('./routes-settings.js')
  ]);

  console.log('[Index Init] Registering core routes...');
  
  await registerCrudRoutes(app);
  registerConnectorRoutes(app);
  registerCampaignExecutionRoutes(app);
  await registerCampaignExecutorRoutes(app);
  registerIntegrationRoutes(app);
  
  app.use('/api', actionRoutes.default);
  app.use('/api', sophiaOptimizationRoutes.default);
  app.use('/api', sophiaBrainAdminRoutes.default);
  app.use('/api', sophiaLearningRoutes.default);
  app.use('/api', sophiaControlModule.default);
  app.use('/api', socialSchedulingRoutes.default);
  app.use('/api', superAdminRoutes.default);
  await initSettingsRoutes(app);

  console.log('[Index Init] Loading additional modules...');

  const [
    { sophiaReportingRoutes, initReportingTables },
    { registerSophiaCampaignManagerRoutes },
    sophiaAutonomousCampaignRoutes,
    { registerSophiaCampaignMatcherRoutes },
    sophiaMemoryRoutes,
    { executeAutonomousCommand, getActionStatus, getRecentActions },
    { analyzeInboxMessage, getCachedAnalysis, cacheAnalysis }
  ] = await Promise.all([
    import('./routes-sophia-reporting.js'),
    import('./routes-sophia-campaign-manager.js'),
    import('./routes-sophia-autonomous-campaign.js'),
    import('./routes-sophia-campaign-matcher.js'),
    import('./routes-sophia-memory.js'),
    import('./lib/sophia-autonomous-actions.js'),
    import('./lib/sophia-inbox-analyzer.js')
  ]);

  app.use('/api', sophiaReportingRoutes);
  registerSophiaCampaignManagerRoutes(app);
  app.use('/api', sophiaAutonomousCampaignRoutes.default);
  registerSophiaCampaignMatcherRoutes(app);
  app.use('/api', sophiaMemoryRoutes.default);
  app.use('/api/sophia', sophiaControlModule.default);
  
  setImmediate(() => {
    initReportingTables().catch((err: Error) => console.error('[Sophia Reporting] Init error:', err));
  });

  console.log('[Index Init] Registering inline API routes...');

  app.post('/api/sophia/autonomous-command', async (req, res) => {
    try {
      const { message, context } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'Message required' });
      }
      const result = await executeAutonomousCommand(message, context || {});
      res.json(result);
    } catch (error: any) {
      console.error('Autonomous command error:', error);
      res.status(500).json({ error: 'Failed to execute autonomous command' });
    }
  });

  app.get('/api/sophia/action-status/:actionId', (req, res) => {
    try {
      const { actionId } = req.params;
      const action = getActionStatus(actionId);
      if (!action) {
        return res.status(404).json({ error: 'Action not found' });
      }
      res.json({ success: true, action });
    } catch (error: any) {
      console.error('Action status error:', error);
      res.status(500).json({ error: 'Failed to get action status' });
    }
  });

  app.get('/api/sophia/recent-actions', (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const actions = getRecentActions(limit);
      res.json({ success: true, actions });
    } catch (error: any) {
      console.error('Recent actions error:', error);
      res.status(500).json({ error: 'Failed to get recent actions' });
    }
  });

  app.post('/api/sophia/analyze-inbox-message', (req, res) => {
    try {
      const { messageId, messageText, senderName, channel, previousContext } = req.body;
      if (!messageText) {
        return res.status(400).json({ error: 'Message text is required' });
      }
      if (messageId) {
        const cached = getCachedAnalysis(messageId);
        if (cached) {
          return res.json({ success: true, analysis: cached, cached: true });
        }
      }
      const analysis = analyzeInboxMessage(messageText, senderName, channel, previousContext);
      if (messageId) {
        cacheAnalysis(messageId, analysis);
      }
      res.json({ success: true, analysis, cached: false });
    } catch (error: any) {
      console.error('Inbox analysis error:', error);
      res.status(500).json({ error: 'Failed to analyze message' });
    }
  });

  app.post('/api/contacts', async (req, res) => {
    try {
      const { name, email, company, title } = req.body;
      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email required' });
      }
      const newContact = {
        id: `contact_${Date.now()}`,
        name,
        email,
        company: company || '',
        title: title || '',
        lead_score: Math.floor(Math.random() * 100),
        segment: '',
        last_contacted: new Date().toISOString()
      };
      res.status(201).json(newContact);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  console.log('✅ Agent Sophia API routes registered');
  console.log('💳 Using your OpenAI API key (charges billed to your OpenAI account credits)');
  console.log('🤖 Autonomous capabilities enabled: Message analysis, auto-responses, meeting booking');
  console.log('🔗 LinkedIn direct OAuth integration ready');
  console.log('🎯 Integration orchestration ready for all channels');
}
