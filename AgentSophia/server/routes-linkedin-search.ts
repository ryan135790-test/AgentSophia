import { Router } from 'express';
import * as searchScraper from './lib/linkedin-search-scraper';
import { searchPeopleViaVoyager, searchPeopleViaVoyagerSimple } from './lib/linkedin-voyager-search';
import { db } from './lib/db-service';

const router = Router();

router.post('/voyager-search', async (req, res) => {
  try {
    const { workspaceId, accountId, keywords, location, maxResults } = req.body;
    
    console.log(`[Voyager Search API] Request - workspaceId: ${workspaceId}, keywords: ${keywords}`);
    
    if (!workspaceId || !accountId || !keywords) {
      return res.status(400).json({ error: 'workspaceId, accountId, and keywords are required' });
    }
    
    const result = await searchPeopleViaVoyager(
      workspaceId,
      accountId,
      keywords,
      location,
      maxResults || 25
    );
    
    if (result.success) {
      res.json({
        success: true,
        results: result.results,
        totalCount: result.totalCount,
        method: 'voyager-api',
      });
    } else {
      console.log('[Voyager Search API] Primary method failed, trying simple method...');
      const simpleResult = await searchPeopleViaVoyagerSimple(
        workspaceId,
        accountId,
        keywords,
        location,
        maxResults || 25
      );
      
      if (simpleResult.success) {
        res.json({
          success: true,
          results: simpleResult.results,
          totalCount: simpleResult.totalCount,
          method: 'voyager-api-simple',
        });
      } else {
        res.json({
          success: false,
          error: result.error || simpleResult.error,
          results: [],
          method: 'voyager-api',
        });
      }
    }
  } catch (error: any) {
    console.error('[Voyager Search API] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/health/:workspaceId/:accountId', (req, res) => {
  try {
    const { workspaceId, accountId } = req.params;
    const health = searchScraper.getAccountHealthStatus(workspaceId, accountId);
    const stats = searchScraper.getSearchStats(workspaceId, accountId);
    
    res.json({
      ...health,
      dailyLimit: stats.dailyUsage.limit,
      dailyUsed: stats.dailyUsage.count,
      dailyRemaining: stats.remainingToday,
      safetyInfo: {
        maxPagesPerHour: health.maxPagesPerHour,
        maxProfilesPerDay: 120,
        cooldownHours: 6,
        message: health.isHealthy 
          ? 'Account is healthy and ready for scraping'
          : health.inCooldown 
            ? `Account in cooldown until ${health.cooldownEndsAt}`
            : 'Account has too many CAPTCHA challenges today',
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/search', (req, res) => {
  try {
    const { workspaceId, accountId, criteria, maxResults } = req.body;
    
    console.log(`[LinkedIn Search API] Received search request - workspaceId: ${workspaceId}, accountId: ${accountId}`);
    
    if (!workspaceId || !accountId) {
      console.log('[LinkedIn Search API] Missing required params');
      return res.status(400).json({ error: 'workspaceId and accountId are required' });
    }
    
    // Check account health before starting
    const health = searchScraper.getAccountHealthStatus(workspaceId, accountId);
    if (!health.isHealthy) {
      return res.status(429).json({ 
        error: health.inCooldown 
          ? `Account in cooldown until ${health.cooldownEndsAt}. Please wait before retrying.`
          : 'Account has too many CAPTCHA challenges today. Please try again tomorrow.',
        health,
      });
    }
    
    // Normalize connectionDegree: UI sends single value, scraper expects array
    const normalizedCriteria = { ...criteria };
    if (criteria?.connectionDegree && typeof criteria.connectionDegree === 'string') {
      // Convert UI value ('2nd', '3rd', 'all') to array format
      if (criteria.connectionDegree === 'all') {
        normalizedCriteria.connectionDegree = ['1st', '2nd', '3rd'];
      } else if (criteria.connectionDegree === '3rd') {
        normalizedCriteria.connectionDegree = ['3rd'];
      } else {
        normalizedCriteria.connectionDegree = [criteria.connectionDegree]; // '2nd' -> ['2nd']
      }
      console.log(`[LinkedIn Search API] Connection degree filter: ${criteria.connectionDegree} -> ${normalizedCriteria.connectionDegree.join(', ')}`);
    }
    
    const result = searchScraper.createSearchJob(
      workspaceId,
      accountId,
      normalizedCriteria || {},
      maxResults || 1000
    );
    
    if ('error' in result) {
      return res.status(429).json({ error: result.error });
    }
    
    res.json({
      success: true,
      job: result,
      stats: searchScraper.getSearchStats(workspaceId, accountId),
      health,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    // First get in-memory jobs
    const memoryJobs = searchScraper.getWorkspaceSearchJobs(workspaceId);
    // Also get from database for persistence across restarts
    const dbJobs = await searchScraper.getSearchJobsFromDB(workspaceId);
    
    // Merge: prefer memory for active jobs, DB for completed ones
    const memoryJobIds = new Set(memoryJobs.map(j => j.id));
    const mergedJobs = [
      ...memoryJobs.map(job => ({
        ...job,
        results: undefined,
        resultCount: job.results.length,
      })),
      ...dbJobs.filter(j => !memoryJobIds.has(j.id)).map(job => ({
        ...job,
        results: undefined,
        resultCount: job.totalPulled || 0,
      })),
    ];
    
    res.json(mergedJobs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:workspaceId/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    // First check memory
    let job = searchScraper.getSearchJob(jobId);
    
    // If not in memory, check database
    if (!job) {
      job = await searchScraper.getSearchJobFromDB(jobId);
    }
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json(job);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs/:jobId/pause', (req, res) => {
  try {
    const { jobId } = req.params;
    const success = searchScraper.pauseSearchJob(jobId);
    
    if (!success) {
      return res.status(400).json({ error: 'Cannot pause job - not running' });
    }
    
    res.json({ success: true, job: searchScraper.getSearchJob(jobId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs/:jobId/resume', (req, res) => {
  try {
    const { jobId } = req.params;
    const success = searchScraper.resumeSearchJob(jobId);
    
    if (!success) {
      const job = searchScraper.getSearchJob(jobId);
      if (job?.dailyLimitReached) {
        return res.status(429).json({ error: 'Daily limit reached. Try again tomorrow.' });
      }
      return res.status(400).json({ error: 'Cannot resume job' });
    }
    
    res.json({ success: true, job: searchScraper.getSearchJob(jobId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs/:jobId/cancel', (req, res) => {
  try {
    const { jobId } = req.params;
    const success = searchScraper.cancelSearchJob(jobId);
    
    if (!success) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/jobs/:jobId/restart', async (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`[LinkedIn Search API] Restart requested for job: ${jobId}`);
    
    const result = await searchScraper.restartInterruptedJob(jobId);
    
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ 
      success: true, 
      job: result,
      message: 'Search job restarted successfully'
    });
  } catch (error: any) {
    console.error('[LinkedIn Search API] Restart error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/jobs/:jobId/export', (req, res) => {
  try {
    const { jobId } = req.params;
    const format = (req.query.format as 'json' | 'csv') || 'json';
    
    const data = searchScraper.exportSearchResults(jobId, format);
    
    if (!data) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=linkedin-search-${jobId}.csv`);
    } else {
      res.setHeader('Content-Type', 'application/json');
    }
    
    res.send(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats/:workspaceId/:accountId', (req, res) => {
  try {
    const { workspaceId, accountId } = req.params;
    const stats = searchScraper.getSearchStats(workspaceId, accountId);
    
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/daily-usage/:workspaceId/:accountId', (req, res) => {
  try {
    const { workspaceId, accountId } = req.params;
    const usage = searchScraper.getDailyUsage(workspaceId, accountId);
    const remaining = searchScraper.getRemainingDailyPulls(workspaceId, accountId);
    
    res.json({
      ...usage,
      remaining,
      percentUsed: Math.round((usage.count / usage.limit) * 100),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all scraped leads from database (persisted across restarts)
router.get('/leads/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { sourceType, searchJobId, limit } = req.query;
    
    console.log(`[LinkedIn Search] Fetching leads for workspace: ${workspaceId}`);
    
    const rawLeads = await searchScraper.getSearchLeadsFromDB(workspaceId, {
      sourceType: sourceType as string | undefined,
      searchJobId: searchJobId as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    // Data is already mapped to camelCase by db-service, pass through with fallbacks
    const leads = rawLeads.map((lead: any) => ({
      id: lead.id,
      workspaceId: lead.workspaceId || lead.workspace_id,
      profileUrl: lead.profileUrl || lead.profile_url || '',
      name: lead.name,
      firstName: lead.firstName || lead.first_name || '',
      lastName: lead.lastName || lead.last_name || '',
      headline: lead.headline,
      location: lead.location,
      connectionDegree: lead.connectionDegree || lead.connection_degree || '3rd',
      sourceType: lead.sourceType || lead.source_type || 'search',
      searchJobId: lead.searchJobId || lead.search_job_id || '',
      createdAt: lead.createdAt || lead.created_at,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      emailConfidence: lead.emailConfidence || lead.email_confidence,
      emailVerified: lead.emailVerified || lead.email_verified,
      enriched: lead.enriched,
    }));
    
    console.log(`[LinkedIn Search] Found ${leads.length} leads in database`);
    
    res.json({
      leads,
      total: leads.length,
    });
  } catch (error: any) {
    console.error(`[LinkedIn Search] Error fetching leads:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Delete leads from staging
router.delete('/leads/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { leadIds } = req.body;
    
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ error: 'leadIds array is required' });
    }
    
    console.log(`[LinkedIn Search] Deleting ${leadIds.length} leads for workspace: ${workspaceId}`);
    
    const deletedCount = await db.deleteLinkedInScrapedLeads(workspaceId, leadIds);
    
    res.json({
      success: true,
      deletedCount,
      message: `Successfully deleted ${deletedCount} leads`,
    });
  } catch (error: any) {
    console.error(`[LinkedIn Search] Error deleting leads:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Import scraped leads to contacts table and optionally to a campaign
router.post('/leads/:workspaceId/import-to-contacts', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const { leadIds, userId, campaignId } = req.body;
    
    console.log(`[LinkedIn Search] Importing leads to contacts for workspace: ${workspaceId}, campaignId: ${campaignId || 'none'}`);
    
    // Get the leads to import
    const allLeads = await searchScraper.getSearchLeadsFromDB(workspaceId, {
      limit: 1000,
    });
    
    // Filter to specific IDs if provided
    const leadsToImport = leadIds && leadIds.length > 0
      ? allLeads.filter((l: any) => leadIds.includes(l.id))
      : allLeads;
    
    if (leadsToImport.length === 0) {
      return res.json({ success: true, imported: 0, message: 'No leads to import' });
    }
    
    console.log(`[LinkedIn Search] Found ${leadsToImport.length} leads to import`);
    
    // Get Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    let imported = 0;
    let skipped = 0;
    let addedToCampaign = 0;
    const importedContactIds: string[] = [];
    
    for (const lead of leadsToImport) {
      try {
        // Get linkedin URL - handle both camelCase (from db-service) and snake_case
        const linkedinUrl = lead.profileUrl || lead.profile_url || '';
        
        if (!linkedinUrl) {
          console.log(`[LinkedIn Search] Skipping ${lead.name} - no LinkedIn URL`);
          skipped++;
          continue;
        }
        
        // Check if contact already exists by linkedin_url
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('linkedin_url', linkedinUrl)
          .single();
        
        let contactId: string;
        
        if (!existingContact) {
          contactId = crypto.randomUUID();
          const { error } = await supabase.from('contacts').insert({
            id: contactId,
            user_id: userId || lead.user_id || workspaceId,
            workspace_id: workspaceId,
            first_name: lead.firstName || lead.first_name || lead.name?.split(' ')[0] || 'Unknown',
            last_name: lead.lastName || lead.last_name || lead.name?.split(' ').slice(1).join(' ') || '',
            email: lead.email || null,
            phone: lead.phone || null,
            company: lead.company || null,
            job_title: lead.headline || null,
            linkedin_url: linkedinUrl,
            source: 'linkedin_search',
            status: 'new',
            tags: ['linkedin-search'],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          
          if (error) {
            console.log(`[LinkedIn Search] Insert error for ${lead.name}:`, error.message);
            if (!error.message?.includes('duplicate')) {
              skipped++;
              continue;
            }
          } else {
            imported++;
            importedContactIds.push(contactId);
          }
        } else {
          contactId = existingContact.id;
          skipped++;
          importedContactIds.push(contactId);
        }
        
        // Add to campaign if campaignId provided
        if (campaignId && contactId) {
          try {
            // Check if already exists
            const { data: existingCC } = await supabase
              .from('campaign_contacts')
              .select('id')
              .eq('campaign_id', campaignId)
              .eq('contact_id', contactId)
              .single();
            
            if (!existingCC) {
              const { error: ccError } = await supabase.from('campaign_contacts').insert({
                id: crypto.randomUUID(),
                campaign_id: campaignId,
                contact_id: contactId,
                status: 'pending',
                current_step: 0,
                assigned_at: new Date().toISOString(),
              });
              
              if (!ccError) {
                addedToCampaign++;
              } else {
                console.log(`[LinkedIn Search] Campaign contact error:`, ccError.message);
              }
            }
          } catch (ccErr: any) {
            // Ignore duplicate errors for campaign_contacts
          }
        }
      } catch (err: any) {
        console.log(`[LinkedIn Search] Error importing ${lead.name}:`, err.message);
        skipped++;
      }
    }
    
    console.log(`[LinkedIn Search] Import complete: ${imported} imported, ${skipped} skipped, ${addedToCampaign} added to campaign`);
    
    res.json({
      success: true,
      imported,
      skipped,
      addedToCampaign,
      total: leadsToImport.length,
      contactIds: importedContactIds,
      message: `Imported ${imported} contacts (${skipped} already existed)${campaignId ? `, ${addedToCampaign} added to campaign` : ''}`,
    });
  } catch (error: any) {
    console.error(`[LinkedIn Search] Error importing leads to contacts:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Get leads for a specific job (from DB)
router.get('/jobs/:jobId/leads', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { workspaceId } = req.query;
    
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId query param is required' });
    }
    
    const leads = await searchScraper.getSearchLeadsFromDB(workspaceId as string, {
      searchJobId: jobId,
    });
    
    res.json({
      leads,
      total: leads.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/safety/:workspaceId', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const config = searchScraper.getSafetyConfig(workspaceId);
    
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/safety/:workspaceId', (req, res) => {
  try {
    const { workspaceId } = req.params;
    const updates = req.body;
    
    const config = searchScraper.updateSafetyConfig(workspaceId, updates);
    
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/warmup-schedule/:daysActive', (req, res) => {
  try {
    const daysActive = parseInt(req.params.daysActive) || 0;
    const schedule = searchScraper.getWarmupSchedule(daysActive);
    
    res.json(schedule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/set-limit/:workspaceId/:accountId', (req, res) => {
  try {
    const { workspaceId, accountId } = req.params;
    const { limit } = req.body;
    
    if (!limit || limit < 1 || limit > 2000) {
      return res.status(400).json({ error: 'Limit must be between 1 and 2000' });
    }
    
    searchScraper.setDailyLimit(workspaceId, accountId, limit);
    
    res.json({
      success: true,
      newLimit: limit,
      usage: searchScraper.getDailyUsage(workspaceId, accountId),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/import-urls', async (req, res) => {
  try {
    const { workspaceId, accountId, urls, enrichWithApollo, verifyConnection, skipDuplicates } = req.body;
    
    if (!workspaceId || !accountId || !urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'workspaceId, accountId, and urls array are required' });
    }
    
    if (urls.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 URLs per import' });
    }
    
    const result = await searchScraper.importFromLinkedInUrls(
      workspaceId,
      accountId,
      urls,
      { enrichWithApollo, verifyConnection, skipDuplicates }
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/research', async (req, res) => {
  try {
    const { workspaceId, accountId, firstName, lastName, company, email, title, location } = req.body;
    
    if (!workspaceId || !accountId || !firstName || !lastName) {
      return res.status(400).json({ error: 'workspaceId, accountId, firstName, and lastName are required' });
    }
    
    const result = await searchScraper.researchAndFindLinkedIn(
      workspaceId,
      accountId,
      { firstName, lastName, company, email, title, location }
    );
    
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('limit') || error.message.includes('credits')) {
      return res.status(429).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/sales-navigator', async (req, res) => {
  try {
    const { workspaceId, accountId, searchUrl, filters, maxResults, enrichWithApollo } = req.body;
    
    if (!workspaceId || !accountId) {
      return res.status(400).json({ error: 'workspaceId and accountId are required' });
    }
    
    const result = await searchScraper.searchWithSalesNavigator(
      workspaceId,
      accountId,
      { searchUrl, filters: filters || {}, maxResults, enrichWithApollo }
    );
    
    if ('error' in result) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      job: result,
      stats: searchScraper.getSearchStats(workspaceId, accountId),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/apollo', async (req, res) => {
  try {
    const { workspaceId, filters, maxResults } = req.body;
    
    if (!workspaceId) {
      return res.status(400).json({ error: 'workspaceId is required' });
    }
    
    const result = await searchScraper.searchWithApollo(workspaceId, { filters: filters || {}, maxResults });
    
    if ('error' in result) {
      return res.status(402).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/enrich', async (req, res) => {
  try {
    const { workspaceId, leads } = req.body;
    
    if (!workspaceId || !leads || !Array.isArray(leads)) {
      return res.status(400).json({ error: 'workspaceId and leads array are required' });
    }
    
    const result = await searchScraper.enrichLeadsWithApollo(workspaceId, leads);
    
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('credits')) {
      return res.status(402).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.get('/data-sources/:accountId', (req, res) => {
  try {
    const { accountId } = req.params;
    const options = searchScraper.getDataSourceOptions(accountId);
    
    res.json(options);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/account/:accountId/capabilities', (req, res) => {
  try {
    const { accountId } = req.params;
    const caps = searchScraper.getAccountCapabilities(accountId);
    
    res.json(caps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/account/:accountId/capabilities', (req, res) => {
  try {
    const { accountId } = req.params;
    const updates = req.body;
    
    const caps = searchScraper.setAccountCapabilities(accountId, updates);
    
    res.json(caps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Debug raw cookie data from database
router.get('/debug/raw-cookies/:workspaceId/:accountId', async (req, res) => {
  try {
    const { workspaceId, accountId } = req.params;
    const { Pool } = await import('pg');
    const { decryptToken } = await import('./lib/encryption');
    
    const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });
    
    const result = await pool.query(
      `SELECT session_cookies_encrypted, session_captured_at, is_active 
       FROM user_linkedin_settings 
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, accountId]
    );
    await pool.end();
    
    if (result.rows.length === 0) {
      return res.json({ error: 'No settings found' });
    }
    
    const row = result.rows[0];
    const encryptedValue = row.session_cookies_encrypted;
    const decrypted = decryptToken(encryptedValue);
    let parsed;
    try {
      parsed = JSON.parse(decrypted);
    } catch {
      parsed = 'PARSE_ERROR';
    }
    
    const cookieNames = Array.isArray(parsed) ? parsed.map((c: any) => c.name) : [];
    const hasLiAt = cookieNames.includes('li_at');
    
    res.json({
      session_captured_at: row.session_captured_at,
      is_active: row.is_active,
      encrypted_length: encryptedValue?.length || 0,
      decrypted_length: decrypted?.length || 0,
      cookie_count: Array.isArray(parsed) ? parsed.length : 0,
      cookie_names: cookieNames,
      diagnosis: !hasLiAt 
        ? 'MISSING li_at cookie - session invalid'
        : 'Session looks valid (has li_at cookie)'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Diagnostic endpoint to check session status in both tables
router.get('/debug/session/:workspaceId', async (req, res) => {
  try {
    const { workspaceId } = req.params;
    const results = await searchScraper.debugSessionStatus(workspaceId);
    res.json({ workspaceId, ...results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Test session lookup (same logic as scraper uses)
router.get('/debug/test-session/:workspaceId/:accountId', async (req, res) => {
  try {
    const { workspaceId, accountId } = req.params;
    const hasSession = await searchScraper.testSessionLookup(workspaceId, accountId);
    res.json({ workspaceId, accountId, hasSession });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Full test search with detailed debugging
router.get('/debug/test-search/:workspaceId/:accountId', async (req, res) => {
  const { workspaceId, accountId } = req.params;
  const keywords = req.query.keywords as string || 'software engineer';
  
  console.log('[DEBUG TEST-SEARCH] Starting test search for', workspaceId, accountId);
  
  const debugLog: string[] = [];
  const log = (msg: string) => {
    console.log('[DEBUG TEST-SEARCH]', msg);
    debugLog.push(`[${new Date().toISOString()}] ${msg}`);
  };
  
  try {
    log('Starting test search');
    
    // Step 1: Get cookies using scraper's internal method
    log('Getting cookies via test session lookup...');
    const hasSession = await searchScraper.testSessionLookup(workspaceId, accountId);
    if (!hasSession) {
      return res.json({ success: false, error: 'No valid session found via testSessionLookup', debugLog });
    }
    log('Session lookup passed, fetching raw cookies...');
    
    // Query database directly for the cookies - check both tables
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });
    const { decryptToken } = await import('./lib/encryption');
    
    // First try linkedin_puppeteer_settings (manual sessions) - table uses workspace_id and user_id
    let result = await pool.query(
      `SELECT session_cookies_encrypted, session_source FROM linkedin_puppeteer_settings 
       WHERE workspace_id = $1 AND user_id = $2 AND session_cookies_encrypted IS NOT NULL AND is_active = true`,
      [workspaceId, accountId]
    );
    
    let cookies: any[] = [];
    let cookieSource = '';
    let isManualSession = false;
    
    if (result.rows.length > 0 && result.rows[0].session_cookies_encrypted) {
      // Puppeteer settings stores encrypted cookies
      const decrypted = decryptToken(result.rows[0].session_cookies_encrypted);
      cookies = JSON.parse(decrypted);
      cookieSource = 'linkedin_puppeteer_settings';
      isManualSession = result.rows[0].session_source === 'manual';
      log(`Found cookies in linkedin_puppeteer_settings (source: ${result.rows[0].session_source})`);
    } else {
      // Fallback to user_linkedin_settings (encrypted)
      result = await pool.query(
        `SELECT session_cookies_encrypted FROM user_linkedin_settings 
         WHERE workspace_id = $1 AND user_id = $2 AND session_cookies_encrypted IS NOT NULL`,
        [workspaceId, accountId]
      );
      
      if (result.rows.length > 0) {
        const decrypted = decryptToken(result.rows[0].session_cookies_encrypted);
        cookies = JSON.parse(decrypted);
        cookieSource = 'user_linkedin_settings';
        log(`Found cookies in user_linkedin_settings`);
      }
    }
    await pool.end();
    
    if (!cookies || cookies.length === 0) {
      return res.json({ success: false, error: 'No cookies found in either table', debugLog });
    }
    log(`Got ${cookies.length} cookies from ${cookieSource}`);
    
    const liAtCookie = cookies.find((c: any) => c.name === 'li_at');
    log(`li_at cookie exists: ${!!liAtCookie}, value length: ${liAtCookie?.value?.length || 0}`);
    log(`li_at first 20 chars: ${liAtCookie?.value?.substring(0, 20) || 'N/A'}`);
    log(`li_at domain: ${liAtCookie?.domain || 'N/A'}, expiry: ${liAtCookie?.expirationDate || liAtCookie?.expires || 'N/A'}`);
    
    // Check for JSESSIONID too
    const jsessionCookie = cookies.find((c: any) => c.name === 'JSESSIONID');
    log(`JSESSIONID exists: ${!!jsessionCookie}, value: ${jsessionCookie?.value?.substring(0, 30) || 'N/A'}`);
    
    // Log all cookie names
    log(`All cookie names: ${cookies.map((c: any) => c.name).join(', ')}`);
    
    // Step 2: Launch browser (using standard puppeteer, consistent with scraper/keep-alive)
    const { execSync } = await import('child_process');
    const chromiumPath = execSync('which chromium', { encoding: 'utf8' }).trim();
    log(`Chromium path: ${chromiumPath}`);
    
    const puppeteer = await import('puppeteer');
    const { getOrAllocateProxy } = await import('./lib/proxy-orchestration');
    
    // Build browser args (matching scraper and keep-alive)
    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
      '--window-size=1920,1080',
    ];
    
    // CRITICAL: Skip proxy for manual sessions to prevent IP binding issues
    // Manual sessions are tied to the user's original IP, using a proxy invalidates the session
    let proxyAuth: { username: string; password: string } | undefined;
    if (isManualSession) {
      log('SKIPPING proxy for manual session - prevents IP binding invalidation');
    } else {
      try {
        const proxyResult = await getOrAllocateProxy(accountId, workspaceId);
        if (proxyResult.success && proxyResult.proxy) {
          args.push(`--proxy-server=http://${proxyResult.proxy.host}:${proxyResult.proxy.port}`);
          proxyAuth = {
            username: proxyResult.proxy.username,
            password: proxyResult.proxy.password,
          };
          log(`Using proxy: ${proxyResult.proxy.host}:${proxyResult.proxy.port}`);
        } else {
          log('No proxy available, proceeding without');
        }
      } catch (proxyErr: any) {
        log(`Proxy allocation failed: ${proxyErr.message}, proceeding without`);
      }
    }
    
    log('Launching browser...');
    
    const browser = await puppeteer.default.launch({
      executablePath: chromiumPath,
      headless: true,
      args,
    });
    log('Browser launched');
    
    const page = await browser.newPage();
    log('Page created');
    
    // Authenticate proxy if configured
    if (proxyAuth) {
      await page.authenticate(proxyAuth);
      log('Proxy authentication set');
    }
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Filter transient cookies (consistent with scraper/keep-alive)
    const transientCookies = ['__cf_bm', 'timezone', 'sdui_ver', '_gcl_au', 'AnalyticsSyncHistory', 'UserMatchHistory'];
    const filteredCookies = cookies.filter((c: any) => !transientCookies.includes(c.name));
    log(`Filtered ${cookies.length - filteredCookies.length} transient cookies`);
    
    // Normalize cookies
    const normalizedCookies = filteredCookies.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain?.startsWith('.') ? c.domain : `.${c.domain?.replace(/^\./, '') || 'linkedin.com'}`,
      path: c.path || '/',
      httpOnly: c.httpOnly ?? true,
      secure: c.secure ?? true,
      sameSite: 'None' as const,
    }));
    
    await page.setCookie(...normalizedCookies);
    log('Cookies set');
    
    // Step 3: First go to LinkedIn feed to test if session is valid
    log('Testing session by navigating to LinkedIn feed first...');
    try {
      await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle2', timeout: 30000 });
      const feedUrl = page.url();
      log(`Feed navigation result URL: ${feedUrl}`);
      
      // Detect network failures (chrome-error://)
      if (feedUrl.includes('chrome-error://') || feedUrl === 'about:blank') {
        log('NETWORK ERROR: Navigation failed with chrome-error or blank page');
        await browser.close();
        return res.json({ 
          success: false, 
          error: 'Network error - navigation failed. Session cookies may be expired.', 
          feedUrl,
          debugLog 
        });
      }
      
      if (feedUrl.includes('/login') || feedUrl.includes('/authwall') || feedUrl.includes('/checkpoint')) {
        log('SESSION INVALID: Redirected to login on feed page');
        await browser.close();
        return res.json({ 
          success: false, 
          error: 'Session invalid - cookies not accepted by LinkedIn', 
          feedUrl,
          debugLog 
        });
      }
      log('Feed navigation successful - session appears valid');
    } catch (feedErr: any) {
      log(`Feed navigation error: ${feedErr.message}`);
    }
    
    // Step 4: Use UI-based search (simulates real user interaction)
    // Direct page.goto to search URLs gets blocked by LinkedIn's SPA
    log(`Using UI-based search with keywords: "${keywords}"`);
    
    // Look for the global search input
    const searchInputSelectors = [
      'input.search-global-typeahead__input',
      'input[aria-label="Search"]',
      'input[placeholder*="Search"]',
      '.search-global-typeahead input',
    ];
    
    let searchInput: Awaited<ReturnType<typeof page.$>> = null;
    for (const selector of searchInputSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        searchInput = await page.$(selector);
        if (searchInput) {
          log(`Found search input with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Try next
      }
    }
    
    if (!searchInput) {
      log('Could not find search input on page');
      const pageHtml = await page.content();
      log(`Page HTML snippet: ${pageHtml.slice(0, 1500)}`);
      await browser.close();
      return res.json({ success: false, error: 'Search input not found', debugLog });
    }
    
    // Click search input and type
    await searchInput.click();
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.type(keywords, { delay: 50 });
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press('Enter');
    log('Typed keywords and pressed Enter');
    
    // Wait for navigation to search results
    const pollStart = Date.now();
    let reachedSearch = false;
    while (Date.now() - pollStart < 30000) {
      await new Promise(r => setTimeout(r, 1500));
      const currentUrl = page.url();
      log(`URL poll: ${currentUrl}`);
      if (currentUrl.includes('search/results')) {
        reachedSearch = true;
        log('Successfully reached search results page');
        break;
      }
      if (currentUrl.includes('/login') || currentUrl.includes('/authwall')) {
        log('Session expired during search');
        await browser.close();
        return res.json({ success: false, error: 'Session expired during search', debugLog, currentUrl });
      }
    }
    
    const pageUrl = page.url();
    log(`Current URL: ${pageUrl}`);
    
    const pageTitle = await page.title();
    log(`Page title: ${pageTitle}`);
    
    // Check for login redirect
    if (pageUrl.includes('/login') || pageUrl.includes('/authwall') || pageUrl.includes('/checkpoint')) {
      log('DETECTED: Redirected to login/auth page - session is invalid');
      await browser.close();
      return res.json({ success: false, error: 'Session invalid - redirected to login', debugLog, pageUrl });
    }
    
    // Get page content info
    const pageInfo = await page.evaluate(() => {
      const selectors = [
        '.reusable-search__result-container',
        '.entity-result',
        'li.reusable-search__result-container',
        '[data-chameleon-result-urn]',
        '.search-results-container li',
      ];
      const found: Record<string, number> = {};
      selectors.forEach(sel => {
        found[sel] = document.querySelectorAll(sel).length;
      });
      
      const bodyText = document.body.innerText.substring(0, 500);
      return { selectors: found, bodyPreview: bodyText };
    });
    
    log(`Page selectors found: ${JSON.stringify(pageInfo.selectors)}`);
    log(`Body preview: ${pageInfo.bodyPreview.substring(0, 200)}...`);
    
    await browser.close();
    log('Browser closed');
    
    res.json({ 
      success: true, 
      pageUrl,
      pageTitle,
      pageInfo,
      debugLog 
    });
    
  } catch (error: any) {
    log(`ERROR: ${error.message}`);
    log(`Stack: ${error.stack}`);
    res.json({ success: false, error: error.message, debugLog });
  }
});

// Chromium diagnostic endpoint - check if browser can launch
router.get('/debug/chromium', async (req, res) => {
  const { execSync } = await import('child_process');
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV || 'not set',
      REPLIT: process.env.REPLIT || 'not set',
      CHROMIUM_PATH: process.env.CHROMIUM_PATH || 'not set',
    },
    pathChecks: {},
    browserLaunch: null,
  };
  
  try {
    diagnostics.pathChecks.whichChromium = execSync('which chromium 2>/dev/null || echo "NOT FOUND"', { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (e: any) {
    diagnostics.pathChecks.whichChromium = `ERROR: ${e.message}`;
  }
  
  try {
    diagnostics.pathChecks.chromiumVersion = execSync('chromium --version 2>&1 | head -1', { encoding: 'utf8', timeout: 10000 }).trim();
  } catch (e: any) {
    diagnostics.pathChecks.chromiumVersion = `ERROR: ${e.message}`;
  }
  
  try {
    diagnostics.pathChecks.lsNixStore = execSync('ls /nix/store 2>/dev/null | grep -i chrom | head -5', { encoding: 'utf8', timeout: 5000 }).trim() || 'no chromium in nix store';
  } catch (e: any) {
    diagnostics.pathChecks.lsNixStore = `ERROR: ${e.message}`;
  }
  
  // Test puppeteer bundled browser (production-compatible)
  try {
    const puppeteer = await import('puppeteer');
    diagnostics.browserLaunch = { attempting: 'puppeteer bundled browser' };
    
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process'],
    });
    const version = await browser.version();
    await browser.close();
    diagnostics.browserLaunch = { success: true, version, method: 'puppeteer-bundled' };
  } catch (e: any) {
    diagnostics.browserLaunch = { success: false, error: e.message, stack: e.stack?.substring(0, 500) };
    
    // Fallback: try with system chromium
    try {
      const puppeteerCore = await import('puppeteer-core');
      const chromiumPath = diagnostics.pathChecks.whichChromium;
      if (chromiumPath && chromiumPath !== 'NOT FOUND' && !chromiumPath.startsWith('ERROR')) {
        const browser = await puppeteerCore.default.launch({
          executablePath: chromiumPath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        const version = await browser.version();
        await browser.close();
        diagnostics.browserLaunchFallback = { success: true, version, method: 'system-chromium' };
      }
    } catch (fallbackErr: any) {
      diagnostics.browserLaunchFallback = { success: false, error: fallbackErr.message };
    }
  }
  
  res.json(diagnostics);
});

// Link existing LinkedIn Search contacts to a campaign
router.post('/link-to-campaign', async (req, res) => {
  try {
    const { workspaceId, campaignId, searchJobId } = req.body;
    
    if (!workspaceId || !campaignId) {
      return res.status(400).json({ error: 'workspaceId and campaignId are required' });
    }
    
    const { supabaseAdmin } = await import('./lib/supabase-admin');
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Database not available' });
    }
    
    // Find contacts from LinkedIn Search for this workspace
    let query = supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name')
      .eq('workspace_id', workspaceId)
      .eq('source', 'linkedin_search');
    
    if (searchJobId) {
      query = query.contains('tags', [searchJobId]);
    }
    
    const { data: contacts, error: fetchError } = await query;
    
    if (fetchError) {
      return res.status(500).json({ error: fetchError.message });
    }
    
    if (!contacts || contacts.length === 0) {
      return res.json({ linked: 0, message: 'No contacts found to link' });
    }
    
    let linked = 0;
    let errors = 0;
    const crypto = await import('crypto');
    
    for (const contact of contacts) {
      try {
        const { data: existingArr } = await supabaseAdmin
          .from('campaign_contacts')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('contact_id', contact.id);
        
        // If no existing record, insert
        if (!existingArr || existingArr.length === 0) {
          const { error: insertError } = await supabaseAdmin.from('campaign_contacts').insert({
            id: crypto.randomUUID(),
            campaign_id: campaignId,
            contact_id: contact.id,
            status: 'pending',
            current_step: 0,
            assigned_at: new Date().toISOString(),
          });
          
          if (!insertError) {
            linked++;
            console.log(`[LinkedIn Search] Linked contact ${contact.first_name} ${contact.last_name} to campaign`);
          } else {
            errors++;
            console.log(`[LinkedIn Search] Error linking contact ${contact.id}: ${insertError.message}`);
          }
        }
      } catch (err: any) {
        errors++;
        console.log(`[LinkedIn Search] Exception linking contact ${contact.id}: ${err.message}`);
      }
    }
    
    console.log(`[LinkedIn Search] Linked ${linked} contacts to campaign ${campaignId}`);
    res.json({ linked, total: contacts.length, message: `Successfully linked ${linked} contacts to campaign` });
  } catch (error: any) {
    console.error('[LinkedIn Search] Link to campaign error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
