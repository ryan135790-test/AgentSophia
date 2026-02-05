import type { 
  WorkspaceCreditBalance, 
  CreditTransaction, 
  LookupUsage,
  CreditPackage,
  SiteCreditPurchase
} from '../../shared/schema';
import { Pool } from 'pg';

let connectionString = '';
let useSSL = false;

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
}

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 5,
  connectionTimeoutMillis: 10000
});

const DEFAULT_DAILY_ALLOCATION = 1000;
const DEFAULT_MAX_CREDITS = 50000;
const DEFAULT_LOW_BALANCE_THRESHOLD = 100;

const balanceCache: Map<string, WorkspaceCreditBalance> = new Map();

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}
const loadingPromises: Map<string, Promise<WorkspaceCreditBalance>> = new Map();
let tablesInitialized = false;
let initPromise: Promise<void> | null = null;

async function ensureTablesExist(): Promise<void> {
  if (tablesInitialized) return;
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS workspace_credit_balances (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL UNIQUE,
          total_credits INTEGER NOT NULL DEFAULT 0,
          used_credits INTEGER NOT NULL DEFAULT 0,
          reserved_credits INTEGER NOT NULL DEFAULT 0,
          monthly_allocation INTEGER NOT NULL DEFAULT 1000,
          daily_allocation INTEGER NOT NULL DEFAULT 1000,
          allocation_reset_date TIMESTAMPTZ,
          last_daily_reset DATE,
          max_credits INTEGER NOT NULL DEFAULT 50000,
          low_balance_threshold INTEGER NOT NULL DEFAULT 100,
          low_balance_notified BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      
      await pool.query(`
        ALTER TABLE workspace_credit_balances 
        ADD COLUMN IF NOT EXISTS daily_allocation INTEGER NOT NULL DEFAULT 1000;
      `);
      
      await pool.query(`
        ALTER TABLE workspace_credit_balances 
        ADD COLUMN IF NOT EXISTS last_daily_reset DATE;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS credit_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID NOT NULL,
          type VARCHAR(50) NOT NULL,
          amount INTEGER NOT NULL,
          balance_after INTEGER NOT NULL,
          description TEXT,
          lookup_type VARCHAR(50),
          contact_id UUID,
          performed_by UUID,
          package_id UUID,
          external_reference VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_credit_transactions_workspace 
        ON credit_transactions(workspace_id);
      `);

      // Fix any existing records that don't have daily_allocation set or have 0 credits
      const today = getTodayDateString();
      await pool.query(`
        UPDATE workspace_credit_balances 
        SET daily_allocation = COALESCE(NULLIF(daily_allocation, 0), 1000),
            total_credits = COALESCE(NULLIF(daily_allocation, 0), 1000),
            used_credits = 0,
            reserved_credits = 0,
            last_daily_reset = $1,
            updated_at = NOW()
        WHERE last_daily_reset IS NULL 
           OR last_daily_reset < $1::date 
           OR daily_allocation IS NULL 
           OR daily_allocation = 0
      `, [today]);
      
      console.log('[Lookup Credits] Daily credit reset applied to all workspaces');
      console.log('[Lookup Credits] Database tables initialized');
      tablesInitialized = true;
    } catch (error) {
      console.error('[Lookup Credits] Failed to initialize tables:', error);
    }
  })();
  
  return initPromise;
}

ensureTablesExist();

function mapDbRowToBalance(row: any): WorkspaceCreditBalance {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    total_credits: row.total_credits,
    used_credits: row.used_credits,
    reserved_credits: row.reserved_credits,
    monthly_allocation: row.monthly_allocation || row.daily_allocation || DEFAULT_DAILY_ALLOCATION,
    daily_allocation: row.daily_allocation || DEFAULT_DAILY_ALLOCATION,
    allocation_reset_date: row.allocation_reset_date?.toISOString() || null,
    last_daily_reset: row.last_daily_reset ? (typeof row.last_daily_reset === 'string' ? row.last_daily_reset : row.last_daily_reset.toISOString().split('T')[0]) : null,
    max_credits: row.max_credits,
    low_balance_threshold: row.low_balance_threshold,
    low_balance_notified: row.low_balance_notified,
    created_at: row.created_at?.toISOString() || new Date().toISOString(),
    updated_at: row.updated_at?.toISOString() || new Date().toISOString(),
  };
}

async function loadBalanceFromDb(workspaceId: string): Promise<WorkspaceCreditBalance> {
  await ensureTablesExist();
  
  const today = getTodayDateString();
  
  const result = await pool.query(
    'SELECT * FROM workspace_credit_balances WHERE workspace_id = $1',
    [workspaceId]
  );
  
  if (result.rows.length > 0) {
    let balance = mapDbRowToBalance(result.rows[0]);
    const lastReset = balance.last_daily_reset;
    
    // Check if we need to perform daily reset
    if (!lastReset || lastReset !== today) {
      const dailyAllocation = balance.daily_allocation || DEFAULT_DAILY_ALLOCATION;
      console.log(`[Lookup Credits] Daily reset for workspace ${workspaceId}: ${dailyAllocation} credits (last reset: ${lastReset || 'never'})`);
      
      const updateResult = await pool.query(`
        UPDATE workspace_credit_balances 
        SET total_credits = $1, 
            used_credits = 0, 
            reserved_credits = 0,
            daily_allocation = $1,
            last_daily_reset = $2,
            updated_at = NOW()
        WHERE workspace_id = $3 
          AND (last_daily_reset IS NULL OR last_daily_reset < $2::date)
        RETURNING *
      `, [dailyAllocation, today, workspaceId]);
      
      if (updateResult.rowCount && updateResult.rowCount > 0) {
        balance = mapDbRowToBalance(updateResult.rows[0]);
        
        await recordTransactionToDb(workspaceId, {
          type: 'allocation',
          amount: dailyAllocation,
          balance_after: dailyAllocation,
          description: `Daily credit reset (${today})`,
        });
      } else {
        // Concurrent request already reset - re-query to get updated balance
        const refreshResult = await pool.query(
          'SELECT * FROM workspace_credit_balances WHERE workspace_id = $1',
          [workspaceId]
        );
        if (refreshResult.rows.length > 0) {
          balance = mapDbRowToBalance(refreshResult.rows[0]);
        }
      }
    }
    
    balanceCache.set(workspaceId, balance);
    return balance;
  }

  // New workspace - create with daily allocation
  const insertResult = await pool.query(`
    INSERT INTO workspace_credit_balances 
    (workspace_id, total_credits, used_credits, reserved_credits, monthly_allocation, daily_allocation,
     last_daily_reset, max_credits, low_balance_threshold, low_balance_notified)
    VALUES ($1, $2, 0, 0, $2, $2, $3, $4, $5, false)
    RETURNING *
  `, [workspaceId, DEFAULT_DAILY_ALLOCATION, today, DEFAULT_MAX_CREDITS, DEFAULT_LOW_BALANCE_THRESHOLD]);

  const balance = mapDbRowToBalance(insertResult.rows[0]);
  balanceCache.set(workspaceId, balance);
  
  await recordTransactionToDb(workspaceId, {
    type: 'allocation',
    amount: DEFAULT_DAILY_ALLOCATION,
    balance_after: DEFAULT_DAILY_ALLOCATION,
    description: `Initial daily allocation (${today})`,
  });

  return balance;
}

async function getBalanceWithCache(workspaceId: string): Promise<WorkspaceCreditBalance> {
  const today = getTodayDateString();
  
  if (balanceCache.has(workspaceId)) {
    const cached = balanceCache.get(workspaceId)!;
    // Check if cached balance needs daily reset
    if (cached.last_daily_reset === today) {
      return cached;
    }
    // Cache is stale (from previous day), reload from DB
    balanceCache.delete(workspaceId);
  }
  
  if (loadingPromises.has(workspaceId)) {
    return loadingPromises.get(workspaceId)!;
  }
  
  const promise = loadBalanceFromDb(workspaceId);
  loadingPromises.set(workspaceId, promise);
  
  try {
    const balance = await promise;
    return balance;
  } finally {
    loadingPromises.delete(workspaceId);
  }
}

async function recordTransactionToDb(
  workspaceId: string,
  data: Partial<CreditTransaction>
): Promise<void> {
  await pool.query(`
    INSERT INTO credit_transactions 
    (workspace_id, type, amount, balance_after, description, lookup_type, contact_id, performed_by, package_id, external_reference)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    workspaceId,
    data.type || 'usage',
    data.amount || 0,
    data.balance_after || 0,
    data.description || null,
    data.lookup_type || null,
    data.contact_id || null,
    data.performed_by || null,
    data.package_id || null,
    data.external_reference || null,
  ]);
}

export function initializeWorkspaceCredits(workspaceId: string): WorkspaceCreditBalance {
  const today = getTodayDateString();
  const cached = balanceCache.get(workspaceId);
  
  // Check if cache is stale (from previous day)
  if (cached && cached.last_daily_reset === today) {
    return cached;
  }
  
  // Cache is stale - use cached daily_allocation for placeholder but reset credits
  const dailyAllocation = cached?.daily_allocation || DEFAULT_DAILY_ALLOCATION;
  
  // Delete stale cache and trigger async refresh
  if (cached) {
    balanceCache.delete(workspaceId);
  }
  
  getBalanceWithCache(workspaceId).catch(err => 
    console.error('[Lookup Credits] Failed to load balance:', err)
  );
  
  const now = new Date().toISOString();

  // Return placeholder with reset credits based on cached/default daily allocation
  const placeholder: WorkspaceCreditBalance = {
    id: cached?.id || workspaceId,
    workspace_id: workspaceId,
    total_credits: dailyAllocation,
    used_credits: 0,
    reserved_credits: 0,
    daily_allocation: dailyAllocation,
    last_daily_reset: today,
    monthly_allocation: dailyAllocation,
    allocation_reset_date: null,
    max_credits: cached?.max_credits || DEFAULT_MAX_CREDITS,
    low_balance_threshold: cached?.low_balance_threshold || DEFAULT_LOW_BALANCE_THRESHOLD,
    low_balance_notified: false,
    created_at: cached?.created_at || now,
    updated_at: now,
  };
  
  // Cache the placeholder immediately so subsequent calls use consistent values
  balanceCache.set(workspaceId, placeholder);
  
  return placeholder;
}

export function getWorkspaceBalance(workspaceId: string): WorkspaceCreditBalance {
  const today = getTodayDateString();
  const cached = balanceCache.get(workspaceId);
  
  // Check if cache is stale (from previous day) 
  if (cached && cached.last_daily_reset === today) {
    return cached;
  }
  
  // Cache is stale or missing - return fresh default and trigger async refresh
  return initializeWorkspaceCredits(workspaceId);
}

export function getAvailableCredits(workspaceId: string): number {
  const balance = getWorkspaceBalance(workspaceId);
  return balance.total_credits - balance.used_credits - balance.reserved_credits;
}

export function hasEnoughCredits(workspaceId: string, required: number = 1): boolean {
  return getAvailableCredits(workspaceId) >= required;
}

export function reserveCredits(workspaceId: string, amount: number = 1): boolean {
  if (!hasEnoughCredits(workspaceId, amount)) {
    return false;
  }

  const balance = getWorkspaceBalance(workspaceId);
  balance.reserved_credits += amount;
  balance.updated_at = new Date().toISOString();
  
  pool.query(`
    UPDATE workspace_credit_balances 
    SET reserved_credits = reserved_credits + $1, updated_at = NOW()
    WHERE workspace_id = $2
  `, [amount, workspaceId]).catch(err => 
    console.error('[Lookup Credits] Failed to reserve credits:', err)
  );
  
  return true;
}

export function useCredits(
  workspaceId: string, 
  amount: number = 1,
  options: {
    lookupType?: 'email' | 'phone' | 'company' | 'linkedin' | 'enrichment';
    contactId?: string;
    description?: string;
  } = {}
): { success: boolean; newBalance: number; error?: string } {
  const balance = getWorkspaceBalance(workspaceId);
  
  const reservedToRelease = Math.min(balance.reserved_credits, amount);
  const available = balance.total_credits - balance.used_credits;
  
  if (available < amount) {
    return { 
      success: false, 
      newBalance: available,
      error: 'Insufficient credits' 
    };
  }

  balance.used_credits += amount;
  balance.reserved_credits = Math.max(0, balance.reserved_credits - reservedToRelease);
  balance.updated_at = new Date().toISOString();
  
  const newBalance = balance.total_credits - balance.used_credits;
  
  pool.query(`
    UPDATE workspace_credit_balances 
    SET used_credits = used_credits + $1,
        reserved_credits = GREATEST(0, reserved_credits - $2),
        updated_at = NOW()
    WHERE workspace_id = $3
  `, [amount, reservedToRelease, workspaceId]).catch(err => 
    console.error('[Lookup Credits] Failed to use credits:', err)
  );

  recordTransactionToDb(workspaceId, {
    type: 'usage',
    amount: -amount,
    balance_after: newBalance,
    lookup_type: options.lookupType,
    contact_id: options.contactId,
    description: options.description || `Lookup: ${options.lookupType || 'general'}`,
  }).catch(err => console.error('[Lookup Credits] Failed to record transaction:', err));

  return { success: true, newBalance };
}

export function refundCredits(
  workspaceId: string, 
  amount: number = 1,
  reason?: string
): { success: boolean; newBalance: number } {
  const balance = getWorkspaceBalance(workspaceId);
  
  balance.used_credits = Math.max(0, balance.used_credits - amount);
  balance.updated_at = new Date().toISOString();
  
  const newBalance = balance.total_credits - balance.used_credits;

  pool.query(`
    UPDATE workspace_credit_balances 
    SET used_credits = GREATEST(0, used_credits - $1), updated_at = NOW()
    WHERE workspace_id = $2
  `, [amount, workspaceId]).catch(err => 
    console.error('[Lookup Credits] Failed to refund credits:', err)
  );

  recordTransactionToDb(workspaceId, {
    type: 'refund',
    amount: amount,
    balance_after: newBalance,
    description: reason || 'Lookup failed - credits refunded',
  }).catch(err => console.error('[Lookup Credits] Failed to record refund:', err));

  return { success: true, newBalance };
}

export function releaseReservedCredits(workspaceId: string, amount: number = 1): void {
  const balance = getWorkspaceBalance(workspaceId);
  balance.reserved_credits = Math.max(0, balance.reserved_credits - amount);
  balance.updated_at = new Date().toISOString();
  
  pool.query(`
    UPDATE workspace_credit_balances 
    SET reserved_credits = GREATEST(0, reserved_credits - $1), updated_at = NOW()
    WHERE workspace_id = $2
  `, [amount, workspaceId]).catch(err => 
    console.error('[Lookup Credits] Failed to release reserved credits:', err)
  );
}

export function getTransactionHistory(
  workspaceId: string,
  limit: number = 50
): CreditTransaction[] {
  return [];
}

export async function getTransactionHistoryAsync(
  workspaceId: string,
  limit: number = 50
): Promise<CreditTransaction[]> {
  const result = await pool.query(`
    SELECT * FROM credit_transactions 
    WHERE workspace_id = $1 
    ORDER BY created_at DESC 
    LIMIT $2
  `, [workspaceId, limit]);
  
  return result.rows.map(row => ({
    id: row.id,
    workspace_id: row.workspace_id,
    type: row.type,
    amount: row.amount,
    balance_after: row.balance_after,
    description: row.description,
    lookup_type: row.lookup_type,
    contact_id: row.contact_id,
    performed_by: row.performed_by,
    package_id: row.package_id,
    external_reference: row.external_reference,
    created_at: row.created_at?.toISOString() || new Date().toISOString(),
  }));
}

export function addCredits(
  workspaceId: string,
  amount: number,
  performedBy?: string,
  description?: string
): { success: boolean; newBalance: number } {
  const balance = getWorkspaceBalance(workspaceId);
  
  // Add credits for today only - these are bonus credits that disappear at next daily reset
  // To permanently increase daily allocation, use setDailyAllocation instead
  balance.total_credits += amount;
  balance.low_balance_notified = false;
  balance.updated_at = new Date().toISOString();
  
  const newBalance = balance.total_credits - balance.used_credits;

  pool.query(`
    UPDATE workspace_credit_balances 
    SET total_credits = total_credits + $1, 
        low_balance_notified = false,
        updated_at = NOW()
    WHERE workspace_id = $2
  `, [amount, workspaceId]).catch(err => 
    console.error('[Lookup Credits] Failed to add credits:', err)
  );

  recordTransactionToDb(workspaceId, {
    type: 'purchase',
    amount: amount,
    balance_after: newBalance,
    performed_by: performedBy,
    description: description || `Added ${amount} bonus credits (expires at next daily reset)`,
  }).catch(err => console.error('[Lookup Credits] Failed to record add credits:', err));

  return { success: true, newBalance };
}

export function recordLookupUsage(
  workspaceId: string,
  data: {
    lookup_type: 'email' | 'phone' | 'company' | 'linkedin' | 'enrichment';
    provider: string;
    input_data: any;
    result_data?: any;
    status: 'pending' | 'success' | 'failed' | 'cached';
    credits_used?: number;
    contact_id?: string;
    campaign_id?: string;
    user_id?: string;
  }
): LookupUsage {
  const now = new Date().toISOString();
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    workspace_id: workspaceId,
    lookup_type: data.lookup_type,
    provider: data.provider,
    input_data: JSON.stringify(data.input_data),
    result_data: data.result_data ? JSON.stringify(data.result_data) : null,
    status: data.status,
    credits_used: data.credits_used || 1,
    contact_id: data.contact_id,
    campaign_id: data.campaign_id,
    user_id: data.user_id,
    created_at: now,
  };
}

export function getUsageHistory(
  workspaceId: string,
  options: {
    limit?: number;
    lookupType?: string;
    status?: string;
  } = {}
): LookupUsage[] {
  return [];
}

export function getAvailablePackages(): CreditPackage[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'starter',
      name: 'Starter Pack',
      credits: 500,
      price_cents: 4900,
      is_active: true,
      description: 'Get started with 500 lookup credits',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'professional',
      name: 'Professional Pack',
      credits: 2000,
      price_cents: 14900,
      is_active: true,
      description: 'Best value - 25% savings',
      created_at: now,
      updated_at: now,
    },
    {
      id: 'enterprise',
      name: 'Enterprise Pack',
      credits: 10000,
      price_cents: 49900,
      is_active: true,
      description: 'Maximum savings - 50% off',
      created_at: now,
      updated_at: now,
    },
  ];
}

export function getAllWorkspaceBalances(): WorkspaceCreditBalance[] {
  return Array.from(balanceCache.values());
}

export async function getAllWorkspaceBalancesFromDb(): Promise<WorkspaceCreditBalance[]> {
  await ensureTablesExist();
  
  try {
    const result = await pool.query(`
      SELECT * FROM workspace_credit_balances 
      ORDER BY created_at DESC
    `);
    
    const balances = result.rows.map(mapDbRowToBalance);
    
    for (const balance of balances) {
      balanceCache.set(balance.workspace_id, balance);
    }
    
    return balances;
  } catch (error) {
    console.error('[Lookup Credits] Error fetching all balances:', error);
    return [];
  }
}

export function getSitePurchaseHistory(limit: number = 50): SiteCreditPurchase[] {
  return [];
}

export async function preloadWorkspaceCredits(workspaceId: string): Promise<WorkspaceCreditBalance> {
  return getBalanceWithCache(workspaceId);
}

export async function getWorkspaceBalanceAsync(workspaceId: string): Promise<WorkspaceCreditBalance> {
  return getBalanceWithCache(workspaceId);
}

export async function getAvailableCreditsAsync(workspaceId: string): Promise<number> {
  const balance = await getBalanceWithCache(workspaceId);
  return balance.total_credits - balance.used_credits - balance.reserved_credits;
}

export function getLookupUsageStats(workspaceId: string): any {
  return {
    total_lookups: 0,
    successful_lookups: 0,
    failed_lookups: 0,
    credits_used: 0,
    by_type: {},
    by_provider: {},
  };
}

export function getAllCreditPackages(): CreditPackage[] {
  return getAvailablePackages();
}

export function createCreditPackage(data: Partial<CreditPackage>): CreditPackage {
  const now = new Date().toISOString();
  return {
    id: `pkg-${Date.now()}`,
    name: data.name || 'New Package',
    credits: data.credits || 100,
    price_cents: data.price_cents || 1000,
    is_active: true,
    description: data.description || '',
    created_at: now,
    updated_at: now,
  };
}

export function updateCreditPackage(id: string, data: Partial<CreditPackage>): CreditPackage | null {
  const packages = getAvailablePackages();
  const pkg = packages.find(p => p.id === id);
  if (!pkg) return null;
  return { ...pkg, ...data, updated_at: new Date().toISOString() };
}

export function addCreditsToWorkspace(
  workspaceId: string,
  amount: number,
  performedBy?: string
): { success: boolean; newBalance: number } {
  return addCredits(workspaceId, amount, performedBy);
}

export function adjustCredits(
  workspaceId: string,
  amount: number,
  reason?: string,
  performedBy?: string
): { success: boolean; newBalance: number } {
  if (amount > 0) {
    return addCredits(workspaceId, amount, performedBy, reason);
  } else {
    return useCredits(workspaceId, Math.abs(amount), { description: reason });
  }
}

export function setDailyAllocation(
  workspaceId: string,
  allocation: number
): { success: boolean } {
  const balance = getWorkspaceBalance(workspaceId);
  balance.daily_allocation = allocation;
  balance.monthly_allocation = allocation; // Keep legacy field in sync
  
  pool.query(`
    UPDATE workspace_credit_balances 
    SET daily_allocation = $1, monthly_allocation = $1, updated_at = NOW()
    WHERE workspace_id = $2
  `, [allocation, workspaceId]).catch(err => 
    console.error('[Lookup Credits] Failed to set daily allocation:', err)
  );
  
  return { success: true };
}

export function setMonthlyAllocation(
  workspaceId: string,
  allocation: number
): { success: boolean } {
  // Now just calls setDailyAllocation for backwards compatibility
  return setDailyAllocation(workspaceId, allocation);
}

export function resetMonthlyAllocation(workspaceId: string): { success: boolean; newBalance: number } {
  const balance = getWorkspaceBalance(workspaceId);
  balance.total_credits += balance.monthly_allocation;
  balance.updated_at = new Date().toISOString();
  
  const newBalance = balance.total_credits - balance.used_credits;
  
  pool.query(`
    UPDATE workspace_credit_balances 
    SET total_credits = total_credits + monthly_allocation, updated_at = NOW()
    WHERE workspace_id = $1
  `, [workspaceId]).catch(err => 
    console.error('[Lookup Credits] Failed to reset allocation:', err)
  );
  
  return { success: true, newBalance };
}

export function getPendingPurchases(): SiteCreditPurchase[] {
  return [];
}

export function approvePurchase(purchaseId: string, performedBy: string): { success: boolean } {
  return { success: true };
}

export function rejectPurchase(purchaseId: string, performedBy: string, reason?: string): { success: boolean } {
  return { success: true };
}
