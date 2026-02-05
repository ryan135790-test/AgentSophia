import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log startup immediately
console.log(`[Startup] Server initializing at ${new Date().toISOString()}`);
console.log(`[Startup] PORT env: ${process.env.PORT || 'not set, using 3001'}`);
console.log(`[Startup] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);

// STEP 1: Create minimal Express app and start server IMMEDIATELY
const app = express();

// CRITICAL: Health check MUST be first, before any middleware
// This ensures deployment health probes get fast responses
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});
app.get('/', (req, res, next) => {
  // Root path health check for deployment probes
  if (req.headers['user-agent']?.includes('health') || req.query.health === 'check') {
    return res.status(200).send('OK');
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Request logging middleware to debug routing issues
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
  }
  next();
});

// Detailed health check endpoint for API consumers
const serverStartTime = Date.now();
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    service: 'agent-sophia',
    timestamp: new Date().toISOString(),
    ready: (global as any).appReady || false,
    pid: process.pid,
    uptime: Math.round((Date.now() - serverStartTime) / 1000),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  });
});

// Resource status endpoint for monitoring
app.get('/api/resources/status', async (req, res) => {
  try {
    const memUsage = process.memoryUsage();
    res.json({
      memory: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      },
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      cpuUsage: process.cpuUsage(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get resource status' });
  }
});

// Request timeout middleware (30 second default, 120s for long-running operations)
const REQUEST_TIMEOUT_MS = 30000;
const LONG_TIMEOUT_MS = 180000; // 3 minutes for LinkedIn auto-login
const LONG_TIMEOUT_PATHS = [
  '/linkedin-automation/auto-login',
  '/linkedin-automation/test-session',
  '/linkedin-automation/submit-2fa',
  '/linkedin/puppeteer/quick-login'
];
app.use('/api', (req, res, next) => {
  const isLongOperation = LONG_TIMEOUT_PATHS.some(path => req.path.includes(path));
  const timeoutMs = isLongOperation ? LONG_TIMEOUT_MS : REQUEST_TIMEOUT_MS;
  
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.warn(`[Request Timeout] ${req.method} ${req.path} exceeded ${timeoutMs}ms`);
      res.status(504).json({ error: 'Request timeout' });
    }
  }, timeoutMs);
  
  res.on('finish', () => clearTimeout(timeout));
  res.on('close', () => clearTimeout(timeout));
  next();
});

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (error) => {
  console.error('❌ UNCAUGHT EXCEPTION:', error);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

// Memory watchdog - prevent runaway memory consumption
const MAX_MEMORY_MB = 1024; // 1GB limit
const MEMORY_CHECK_INTERVAL = 60000; // Check every minute
setInterval(() => {
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const rssMB = Math.round(memUsage.rss / 1024 / 1024);
  
  if (rssMB > MAX_MEMORY_MB) {
    console.error(`⚠️ MEMORY LIMIT EXCEEDED: ${rssMB}MB > ${MAX_MEMORY_MB}MB - initiating graceful restart`);
    process.emit('SIGTERM' as any);
  } else if (rssMB > MAX_MEMORY_MB * 0.8) {
    console.warn(`⚠️ HIGH MEMORY WARNING: ${rssMB}MB (${Math.round(rssMB/MAX_MEMORY_MB*100)}% of limit)`);
    // Try to free some memory
    if (global.gc) {
      console.log('🧹 Running garbage collection...');
      global.gc();
    }
  }
}, MEMORY_CHECK_INTERVAL).unref(); // Don't keep process alive for this timer

// Uptime watchdog - restart after 24 hours to prevent memory leaks
const MAX_UPTIME_MS = 24 * 60 * 60 * 1000; // 24 hours
setTimeout(() => {
  console.log('🔄 Max uptime reached (24h) - initiating graceful restart for freshness');
  process.emit('SIGTERM' as any);
}, MAX_UPTIME_MS).unref();

// STEP 2: Start listening BEFORE loading any heavy modules
const PORT = parseInt(process.env.PORT || '3001', 10);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server listening on port ${PORT} (PID: ${process.pid}) - health checks responding`);
  console.log(`⏳ Loading application routes...`);
  
  // STEP 3: Load all heavy modules AFTER server is listening
  loadApplication().catch(err => {
    console.error('❌ Failed to load application:', err);
  });
});

// Connection tracking for graceful shutdown
const connections = new Set<any>();
server.on('connection', (conn) => {
  connections.add(conn);
  conn.on('close', () => connections.delete(conn));
});

// Set server timeouts to prevent zombie connections
server.keepAliveTimeout = 65000; // 65 seconds (slightly more than typical load balancer timeout)
server.headersTimeout = 66000; // Must be greater than keepAliveTimeout

// Graceful shutdown handler
let isShuttingDown = false;
function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\n🛑 ${signal} received - starting graceful shutdown (PID: ${process.pid})`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed, no longer accepting connections');
    process.exit(0);
  });
  
  // Force-close all existing connections after a grace period
  const forceCloseTimeout = setTimeout(() => {
    console.log(`⚠️ Force closing ${connections.size} remaining connections`);
    connections.forEach((conn) => {
      try { conn.destroy(); } catch (e) {}
    });
    process.exit(0);
  }, 10000); // 10 second grace period
  
  forceCloseTimeout.unref(); // Don't keep process alive for this timer
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Async function to load all heavy dependencies after server starts
async function loadApplication() {
  const startTime = Date.now();
  
  try {
    // Import heavy modules dynamically
    const [
      { default: OpenAI },
      { default: Anthropic },
      { createClient },
      { registerCrudRoutes },
      { registerConnectorRoutes },
      { registerCampaignExecutionRoutes },
      { registerCampaignExecutorRoutes },
      { registerIntegrationRoutes },
      { default: actionRoutes },
      { default: sophiaOptimizationRoutes },
      { default: sophiaBrainAdminRoutes },
      { default: sophiaLearningRoutes },
      sophiaControlModule,
      { default: socialSchedulingRoutes },
      { default: superAdminRoutes },
      { initSettingsRoutes },
      { SOPHIA_SYSTEM_PROMPT },
      autonomousActionsModule,
      workspaceLearningModule,
      { getSophiaSystemPromptWithContext },
      sophiaOptimizerModule,
      { db },
      { analyzeUserMessage, generateDynamicSystemPromptAddition },
      { analyzeInboxMessage, getCachedAnalysis, cacheAnalysis },
      sophiaCampaignMonitorModule,
      workflowSynthesisRoutesModule,
      lookupCreditsRoutesModule
    ] = await Promise.all([
      import('openai'),
      import('@anthropic-ai/sdk'),
      import('@supabase/supabase-js'),
      import('./routes-crud'),
      import('./routes-connectors'),
      import('./routes-campaign-execution'),
      import('./routes-campaign-executor'),
      import('./routes-integrations'),
      import('./routes-actions'),
      import('./routes-sophia-optimization'),
      import('./routes-sophia-brain-admin'),
      import('./routes-sophia-learning'),
      import('./routes-sophia-control'),
      import('./routes-social-scheduling'),
      import('./routes-super-admin'),
      import('./routes-settings'),
      import('./lib/sophia-system-prompt'),
      import('./lib/sophia-autonomous-actions'),
      import('./lib/workspace-learning'),
      import('./lib/sophia-with-context'),
      import('./lib/sophia-optimizer'),
      import('./lib/db-service'),
      import('./lib/sophia-message-evaluator'),
      import('./lib/sophia-inbox-analyzer'),
      import('./lib/sophia-campaign-monitor'),
      import('./routes-workflow-synthesis'),
      import('./routes-lookup-credits'),
      import('./routes-workflow-deploy'),
      import('./routes-linkedin-search')
    ]);

    const workflowSynthesisRoutes = workflowSynthesisRoutesModule.default;
    const lookupCreditsRoutes = lookupCreditsRoutesModule.default;
    const sophiaControlRoutes = sophiaControlModule.default;
    const { registerWorkflowDeployRoutes } = await import('./routes-workflow-deploy');
    const linkedInSearchRoutes = (await import('./routes-linkedin-search')).default;
    const linkedInSendingRoutes = (await import('./routes-linkedin-sending')).default;
    const emitSophiaActivity = sophiaControlModule.emitSophiaActivity;
    const { executeAutonomousCommand, getActionStatus, getRecentActions } = autonomousActionsModule;
    const { logPerformanceMetric, getWorkspacePerformance, getPerformanceRecommendations, generateSophiaContextForWorkspace } = workspaceLearningModule;
    const { generateOptimizationStrategies, applyOptimizationStrategy, getApprovedStrategies, applyWinningStrategies, getOptimizationStatus, generateOptimizationSummaryForSophia } = sophiaOptimizerModule;
    const { monitorCampaign, getCampaignProgress, getAllCampaignProgress, applySophiaAdjustment, logStepExecution, initializeCampaignProgress, simulateCampaignProgress } = sophiaCampaignMonitorModule;

    console.log(`📦 Core modules loaded (${Date.now() - startTime}ms)`);

    // Initialize Supabase client
    let supabase: ReturnType<typeof createClient> | null = null;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        supabase = createClient(supabaseUrl, supabaseServiceKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });
        console.log('✅ Supabase client initialized for authentication');
      } catch (error) {
        console.warn('⚠️ Failed to initialize Supabase client:', error);
      }
    } else {
      console.warn('⚠️ Supabase environment variables missing - auth features will be unavailable');
    }

    function getSupabaseClient() {
      if (!supabase) {
        throw new Error('Supabase client not initialized - missing environment variables');
      }
      return supabase;
    }

    // Multi-LLM Support
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
    }

    // Register all route handlers
    registerCrudRoutes(app);
    console.log('✅ CRUD routes registered');

    app.use('/api/actions', actionRoutes);
    app.use('/api/sophia/optimization', sophiaOptimizationRoutes);
    app.use('/api/sophia/brain', sophiaBrainAdminRoutes);
    app.use('/api/sophia/learning', sophiaLearningRoutes);
    app.use('/api/sophia/control', sophiaControlRoutes);
    app.use('/api/social-scheduling', socialSchedulingRoutes);
    app.use('/api/super-admin', superAdminRoutes);
    app.use('/api/lookup-credits', lookupCreditsRoutes);
    app.use('/api/linkedin-search', linkedInSearchRoutes);
    app.use('/api/linkedin', linkedInSendingRoutes);
    app.use(workflowSynthesisRoutes);
    
    const leadScoringRoutes = (await import('./routes-lead-scoring-dashboard')).default;
    app.use('/api', leadScoringRoutes);
    console.log('✅ Lead Scoring Dashboard routes registered');
    console.log('✅ Super Admin management routes registered');

    registerConnectorRoutes(app);
    registerCampaignExecutionRoutes(app);
    registerCampaignExecutorRoutes(app);
    registerIntegrationRoutes(app);
    registerWorkflowDeployRoutes(app);
    initSettingsRoutes(app);
    console.log('✅ All route modules registered');

    // Recover any stale LinkedIn search jobs that were running when server restarted
    const { recoverStaleSearchJobs } = await import('./lib/linkedin-search-scraper');
    recoverStaleSearchJobs().then(result => {
      if (result.marked.length > 0) {
        console.log(`🔄 Recovered ${result.marked.length} stale LinkedIn search jobs - marked as interrupted`);
      }
    }).catch(err => {
      console.error('Failed to recover stale search jobs:', err?.message || err);
    });

    // DIAGNOSTIC: Log all LinkedIn accounts on startup
    const logLinkedInAccountsOnStartup = async () => {
      try {
        const { data: sessions } = await supabase
          .from('linkedin_puppeteer_settings')
          .select('workspace_id, profile_name, is_active, session_cookies_encrypted, session_source, updated_at');
        
        const { data: workspaces } = await supabase
          .from('workspaces')
          .select('id, name');
        
        const wsMap = new Map(workspaces?.map(w => [w.id, w.name]) || []);
        
        console.log('📊 [STARTUP DIAGNOSTIC] LinkedIn Accounts Status:');
        if (sessions && sessions.length > 0) {
          sessions.forEach(s => {
            const hasCookies = s.session_cookies_encrypted !== null && s.session_cookies_encrypted !== '';
            console.log(`   - ${wsMap.get(s.workspace_id) || 'Unknown'} (${s.workspace_id.substring(0,8)}...): profile="${s.profile_name}", active=${s.is_active}, has_cookies=${hasCookies}, source=${s.session_source}`);
          });
        } else {
          console.log('   No LinkedIn accounts found');
        }
        
        // Also log active campaigns
        const { data: activeCampaigns } = await supabase
          .from('campaigns')
          .select('id, name, status, workspace_id')
          .eq('status', 'active');
        
        console.log('📊 [STARTUP DIAGNOSTIC] Active Campaigns:');
        if (activeCampaigns && activeCampaigns.length > 0) {
          activeCampaigns.forEach(c => {
            console.log(`   - "${c.name || 'Unnamed'}" (${c.id.substring(0,8)}...) in workspace ${wsMap.get(c.workspace_id) || c.workspace_id.substring(0,8)}`);
          });
        } else {
          console.log('   No active campaigns found');
        }
      } catch (err: any) {
        console.error('Failed to log LinkedIn accounts diagnostic:', err?.message);
      }
    };
    logLinkedInAccountsOnStartup();

    // LinkedIn connection acceptance checker - now data-optimized (blocks images/fonts/CSS)
    // Runs every 6 hours instead of 2 hours, saving significant proxy data
    const { startAcceptanceChecker, triggerAcceptanceCheck } = await import('./lib/linkedin-acceptance-checker');
    startAcceptanceChecker();
    console.log('✅ LinkedIn acceptance checker started (data-optimized, 6h interval, 5 profiles/batch)');

    // API endpoint to manually trigger acceptance check
    app.post('/api/linkedin/check-acceptances', async (req, res) => {
      try {
        const result = await triggerAcceptanceCheck();
        res.json({ success: true, ...result });
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Data usage monitoring API
    app.get('/api/linkedin/data-usage', async (req, res) => {
      try {
        const { getAllUsageSummaries, getDailyLimitStatus } = await import('./lib/data-saver');
        const workspaceId = req.query.workspaceId as string;
        
        if (workspaceId) {
          const status = getDailyLimitStatus(workspaceId);
          res.json({ success: true, workspace: workspaceId, ...status });
        } else {
          const allUsage = getAllUsageSummaries();
          res.json({ success: true, usage: allUsage });
        }
      } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Chat interface types
    interface ChatMessage {
      role: 'system' | 'user' | 'assistant';
      content: string;
    }

    // Sophia Chat endpoint
    app.post('/api/sophia/chat', async (req, res) => {
      try {
        const { 
          message, 
          conversationHistory = [], 
          model = 'openai',
          workspaceId,
          userId,
          contactId,
          contactName,
          conversationType 
        } = req.body;

        if (!message) {
          return res.status(400).json({ error: 'Message is required' });
        }

        const messages: ChatMessage[] = conversationHistory.length > 0 
          ? conversationHistory.map((msg: any) => ({
              role: msg.role as 'system' | 'user' | 'assistant',
              content: msg.content
            }))
          : [];

        messages.push({ role: 'user', content: message });

        let response: string;

        if (model === 'claude' && anthropic) {
          const claudeResponse = await anthropic.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 4096,
            system: SOPHIA_SYSTEM_PROMPT,
            messages: messages.map(m => ({
              role: m.role === 'system' ? 'user' : m.role,
              content: m.content
            }))
          });
          response = claudeResponse.content[0].type === 'text' 
            ? claudeResponse.content[0].text 
            : '';
        } else {
          const openaiResponse = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
              { role: 'system', content: SOPHIA_SYSTEM_PROMPT },
              ...messages
            ],
            temperature: 0.7,
            max_tokens: 4096
          });
          response = openaiResponse.choices[0]?.message?.content || '';
        }

        res.json({
          response,
          model: model === 'claude' && anthropic ? 'claude' : 'openai',
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        console.error('Sophia chat error:', error);
        res.status(500).json({ 
          error: 'Failed to process chat request',
          details: error.message 
        });
      }
    });

    // Autonomous action endpoints
    app.post('/api/sophia/autonomous/command', async (req, res) => {
      try {
        const { command, workspaceId, userId, pageContext, availableData } = req.body;
        const result = await executeAutonomousCommand(command, { 
          userId: userId || 'unknown', 
          workspaceId, 
          pageContext, 
          availableData 
        });
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/sophia/autonomous/actions/:workspaceId', async (req, res) => {
      try {
        const limit = parseInt(req.query.limit as string) || 10;
        const actions = getRecentActions(limit);
        res.json(actions);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Workspace learning endpoints
    app.get('/api/sophia/learning/performance/:workspaceId', async (req, res) => {
      try {
        const performance = await getWorkspacePerformance(req.params.workspaceId);
        res.json(performance);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/sophia/learning/recommendations/:workspaceId', async (req, res) => {
      try {
        const recommendations = await getPerformanceRecommendations(req.params.workspaceId);
        res.json(recommendations);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Optimization endpoints
    app.post('/api/sophia/optimizer/generate/:workspaceId', async (req, res) => {
      try {
        const strategies = await generateOptimizationStrategies(req.params.workspaceId);
        res.json(strategies);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/sophia/optimizer/apply', async (req, res) => {
      try {
        const { strategyId, workspaceId } = req.body;
        const result = await applyOptimizationStrategy(strategyId, workspaceId);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/sophia/optimizer/status/:workspaceId', async (req, res) => {
      try {
        const status = await getOptimizationStatus(req.params.workspaceId);
        res.json(status);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Campaign monitoring endpoints
    app.get('/api/sophia/campaigns/progress/:campaignId', async (req, res) => {
      try {
        const progress = await getCampaignProgress(req.params.campaignId);
        res.json(progress);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/sophia/campaigns/progress', async (req, res) => {
      try {
        const allProgress = getAllCampaignProgress();
        res.json(allProgress);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Inbox analysis endpoints
    app.post('/api/sophia/inbox/analyze', async (req, res) => {
      try {
        const { message, contactId, workspaceId } = req.body;
        const messageId = `${contactId}_${Buffer.from(message).toString('base64').slice(0, 20)}`;
        const cached = getCachedAnalysis(messageId);
        if (cached) {
          return res.json(cached);
        }
        const analysis = analyzeInboxMessage(message, contactId);
        cacheAnalysis(messageId, analysis);
        res.json(analysis);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Message evaluation endpoint
    app.post('/api/sophia/evaluate-message', async (req, res) => {
      try {
        const { message, conversationHistory, sessionId } = req.body;
        const evaluation = analyzeUserMessage(message, conversationHistory || [], sessionId || 'unknown');
        res.json(evaluation);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Context-aware system prompt endpoint
    app.get('/api/sophia/context/:workspaceId', async (req, res) => {
      try {
        const context = await generateSophiaContextForWorkspace(req.params.workspaceId);
        res.json({ context });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Campaigns endpoint
    app.get('/api/campaigns/:id/stats', async (req, res) => {
      try {
        const { id } = req.params;
        const stats = await db.getCampaignStats(id);
        res.json(stats);
      } catch (error: any) {
        console.error('Error fetching campaign stats:', error);
        res.status(500).json({ error: error.message || 'Failed to fetch campaign stats' });
      }
    });

    // Serve static files in production
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));

    // Handle client-side routing
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      if (req.method === 'GET' && !req.path.includes('.')) {
        return res.sendFile(path.join(distPath, 'index.html'));
      }
      next();
    });

    // Mark app as fully ready
    (global as any).appReady = true;
    
    const totalTime = Date.now() - startTime;
    console.log(`\n✅ Agent Sophia API fully initialized (${totalTime}ms)`);
    console.log(`💳 Using your OpenAI API key (charges billed to your OpenAI account credits)`);
    console.log(`🤖 Autonomous capabilities enabled: Message analysis, auto-responses, meeting booking`);
    console.log(`🔗 LinkedIn direct OAuth integration ready`);
    console.log(`🎯 Integration orchestration ready for all channels`);

  } catch (error) {
    console.error('❌ Application loading failed:', error);
    throw error;
  }
}
