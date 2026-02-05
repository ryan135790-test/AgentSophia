import { Pool } from 'pg';

// Get connection string
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const pool = new Pool({ connectionString });

interface ScraperHealthMetrics {
  lastCanaryRun: string | null;
  lastCanarySuccess: boolean;
  lastCanaryLeadsFound: number;
  successRate24h: number;
  totalSearches24h: number;
  failedSearches24h: number;
  avgLeadsPerSearch: number;
  selectorHealth: { [selector: string]: number };
  lastError: string | null;
  lastErrorTime: string | null;
  status: 'healthy' | 'degraded' | 'failing' | 'unknown';
}

interface HealthCheckResult {
  timestamp: string;
  success: boolean;
  leadsFound: number;
  selectorsWorking: string[];
  selectorsFailing: string[];
  error?: string;
  domSnapshot?: string;
}

// In-memory health metrics (persisted to DB periodically)
let healthMetrics: ScraperHealthMetrics = {
  lastCanaryRun: null,
  lastCanarySuccess: false,
  lastCanaryLeadsFound: 0,
  successRate24h: 100,
  totalSearches24h: 0,
  failedSearches24h: 0,
  avgLeadsPerSearch: 0,
  selectorHealth: {},
  lastError: null,
  lastErrorTime: null,
  status: 'unknown',
};

// Health check history (last 24 hours)
const healthHistory: HealthCheckResult[] = [];
const MAX_HISTORY = 100;

// Alert thresholds
const ALERT_THRESHOLDS = {
  minSuccessRate: 70, // Alert if success rate drops below 70%
  minLeadsPerSearch: 1, // Alert if avg leads per search drops below 1
  maxConsecutiveFailures: 3, // Alert after 3 consecutive failures
};

let consecutiveFailures = 0;
let alertCallbacks: ((alert: ScraperAlert) => void)[] = [];

interface ScraperAlert {
  type: 'selector_failure' | 'low_success_rate' | 'no_leads' | 'consecutive_failures';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: string;
  details?: any;
}

export function registerAlertCallback(callback: (alert: ScraperAlert) => void) {
  alertCallbacks.push(callback);
}

function emitAlert(alert: ScraperAlert) {
  console.log(`[Scraper Health] ALERT [${alert.severity}]: ${alert.message}`);
  alertCallbacks.forEach(cb => {
    try {
      cb(alert);
    } catch (e) {
      console.error('[Scraper Health] Alert callback error:', e);
    }
  });
}

export function recordSearchAttempt(success: boolean, leadsFound: number, error?: string) {
  const now = new Date().toISOString();
  
  healthMetrics.totalSearches24h++;
  
  if (!success) {
    healthMetrics.failedSearches24h++;
    healthMetrics.lastError = error || 'Unknown error';
    healthMetrics.lastErrorTime = now;
    consecutiveFailures++;
    
    if (consecutiveFailures >= ALERT_THRESHOLDS.maxConsecutiveFailures) {
      emitAlert({
        type: 'consecutive_failures',
        severity: 'critical',
        message: `LinkedIn scraper has failed ${consecutiveFailures} times in a row`,
        timestamp: now,
        details: { consecutiveFailures, lastError: error },
      });
    }
  } else {
    consecutiveFailures = 0;
    
    if (leadsFound === 0) {
      emitAlert({
        type: 'no_leads',
        severity: 'warning',
        message: 'LinkedIn search completed but found 0 leads - selectors may need updating',
        timestamp: now,
      });
    }
  }
  
  // Calculate success rate
  healthMetrics.successRate24h = healthMetrics.totalSearches24h > 0
    ? Math.round(((healthMetrics.totalSearches24h - healthMetrics.failedSearches24h) / healthMetrics.totalSearches24h) * 100)
    : 100;
  
  // Update status
  updateHealthStatus();
  
  // Check for alerts
  if (healthMetrics.successRate24h < ALERT_THRESHOLDS.minSuccessRate) {
    emitAlert({
      type: 'low_success_rate',
      severity: 'critical',
      message: `LinkedIn scraper success rate dropped to ${healthMetrics.successRate24h}%`,
      timestamp: now,
      details: { successRate: healthMetrics.successRate24h },
    });
  }
}

export function recordSelectorResult(selectorName: string, found: number) {
  if (!healthMetrics.selectorHealth[selectorName]) {
    healthMetrics.selectorHealth[selectorName] = 0;
  }
  // Rolling average
  healthMetrics.selectorHealth[selectorName] = 
    (healthMetrics.selectorHealth[selectorName] * 0.9) + (found > 0 ? 10 : 0);
}

export function recordCanaryResult(result: HealthCheckResult) {
  healthMetrics.lastCanaryRun = result.timestamp;
  healthMetrics.lastCanarySuccess = result.success;
  healthMetrics.lastCanaryLeadsFound = result.leadsFound;
  
  healthHistory.unshift(result);
  if (healthHistory.length > MAX_HISTORY) {
    healthHistory.pop();
  }
  
  if (!result.success || result.leadsFound === 0) {
    emitAlert({
      type: 'selector_failure',
      severity: result.success ? 'warning' : 'critical',
      message: result.success 
        ? 'Canary search found 0 leads - LinkedIn may have changed their page structure'
        : `Canary search failed: ${result.error}`,
      timestamp: result.timestamp,
      details: {
        selectorsWorking: result.selectorsWorking,
        selectorsFailing: result.selectorsFailing,
      },
    });
  }
  
  updateHealthStatus();
}

function updateHealthStatus() {
  if (healthMetrics.totalSearches24h === 0) {
    healthMetrics.status = 'unknown';
  } else if (healthMetrics.successRate24h >= 90 && consecutiveFailures === 0) {
    healthMetrics.status = 'healthy';
  } else if (healthMetrics.successRate24h >= 70 || consecutiveFailures < 3) {
    healthMetrics.status = 'degraded';
  } else {
    healthMetrics.status = 'failing';
  }
}

export function getHealthMetrics(): ScraperHealthMetrics {
  return { ...healthMetrics };
}

export function getHealthHistory(): HealthCheckResult[] {
  return [...healthHistory];
}

export function resetDailyMetrics() {
  healthMetrics.totalSearches24h = 0;
  healthMetrics.failedSearches24h = 0;
  healthMetrics.successRate24h = 100;
}

// Initialize daily reset timer
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    resetDailyMetrics();
  }
}, 60000); // Check every minute

// Database persistence for health metrics
export async function persistHealthMetrics() {
  try {
    await pool.query(`
      INSERT INTO linkedin_scraper_health (id, metrics, updated_at)
      VALUES ('current', $1, NOW())
      ON CONFLICT (id) DO UPDATE SET
        metrics = $1,
        updated_at = NOW()
    `, [JSON.stringify(healthMetrics)]);
  } catch (error) {
    console.error('[Scraper Health] Failed to persist metrics:', error);
  }
}

export async function loadHealthMetrics() {
  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS linkedin_scraper_health (
        id VARCHAR(50) PRIMARY KEY,
        metrics JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    const result = await pool.query(
      `SELECT metrics FROM linkedin_scraper_health WHERE id = 'current'`
    );
    
    if (result.rows.length > 0) {
      healthMetrics = { ...healthMetrics, ...result.rows[0].metrics };
    }
  } catch (error) {
    console.error('[Scraper Health] Failed to load metrics:', error);
  }
}

// Persist metrics every 5 minutes
setInterval(() => {
  persistHealthMetrics();
}, 300000);

console.log('[Scraper Health] LinkedIn scraper health monitoring initialized');
