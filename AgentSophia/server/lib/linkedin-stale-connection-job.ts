import { Pool } from 'pg';
import { markConnectionWithdrawn, markConnectionAccepted } from './linkedin-connection-tracker';

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

const STALE_CONNECTION_DAYS = 30;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface StaleConnection {
  contactId: string;
  firstName: string;
  lastName: string;
  linkedinUrl: string;
  sentAt: Date;
  daysPending: number;
  workspaceId: string;
}

export async function getStaleConnectionsForWithdrawal(): Promise<StaleConnection[]> {
  const result = await pool.query(`
    SELECT 
      c.id as contact_id,
      c.first_name,
      c.last_name,
      c.linkedin_url,
      c.linkedin_connection_sent_at as sent_at,
      c.workspace_id,
      EXTRACT(DAY FROM NOW() - c.linkedin_connection_sent_at)::int as days_pending
    FROM contacts c
    WHERE c.linkedin_connection_status = 'pending'
      AND c.linkedin_connection_sent_at < NOW() - ($1 || ' days')::interval
      AND c.linkedin_url IS NOT NULL
    ORDER BY c.linkedin_connection_sent_at ASC
    LIMIT 10
  `, [STALE_CONNECTION_DAYS.toString()]);
  
  return result.rows.map(row => ({
    contactId: row.contact_id,
    firstName: row.first_name,
    lastName: row.last_name,
    linkedinUrl: row.linkedin_url,
    sentAt: row.sent_at,
    daysPending: row.days_pending,
    workspaceId: row.workspace_id
  }));
}

export async function markForWithdrawal(contactId: string): Promise<void> {
  await pool.query(`
    UPDATE contacts 
    SET linkedin_connection_status = 'pending_withdrawal',
        updated_at = NOW()
    WHERE id = $1
      AND linkedin_connection_status = 'pending'
  `, [contactId]);
}

export async function processStaleConnections(): Promise<{
  checked: number;
  markedForWithdrawal: number;
  errors: number;
}> {
  console.log('[Stale Connection Job] Checking for stale connections (>' + STALE_CONNECTION_DAYS + ' days)...');
  
  const staleConnections = await getStaleConnectionsForWithdrawal();
  
  if (staleConnections.length === 0) {
    console.log('[Stale Connection Job] No stale connections found');
    return { checked: 0, markedForWithdrawal: 0, errors: 0 };
  }
  
  console.log(`[Stale Connection Job] Found ${staleConnections.length} stale connections - marking for withdrawal`);
  
  let markedForWithdrawal = 0;
  let errors = 0;
  
  for (const conn of staleConnections) {
    try {
      await markForWithdrawal(conn.contactId);
      markedForWithdrawal++;
      console.log(`[Stale Connection Job] Marked for withdrawal: ${conn.firstName} ${conn.lastName} (${conn.daysPending} days pending)`);
    } catch (error) {
      console.error(`[Stale Connection Job] Error marking ${conn.firstName}:`, error);
      errors++;
    }
  }
  
  console.log(`[Stale Connection Job] Complete: ${markedForWithdrawal} marked for withdrawal, ${errors} errors`);
  console.log('[Stale Connection Job] Note: Actual withdrawal will occur when user starts a LinkedIn session');
  
  return { checked: staleConnections.length, markedForWithdrawal, errors };
}

export async function getPendingWithdrawals(workspaceId: string): Promise<StaleConnection[]> {
  const result = await pool.query(`
    SELECT 
      c.id as contact_id,
      c.first_name,
      c.last_name,
      c.linkedin_url,
      c.linkedin_connection_sent_at as sent_at,
      c.workspace_id,
      EXTRACT(DAY FROM NOW() - c.linkedin_connection_sent_at)::int as days_pending
    FROM contacts c
    WHERE c.workspace_id = $1
      AND c.linkedin_connection_status = 'pending_withdrawal'
      AND c.linkedin_url IS NOT NULL
    ORDER BY c.linkedin_connection_sent_at ASC
    LIMIT 5
  `, [workspaceId]);
  
  return result.rows.map(row => ({
    contactId: row.contact_id,
    firstName: row.first_name,
    lastName: row.last_name,
    linkedinUrl: row.linkedin_url,
    sentAt: row.sent_at,
    daysPending: row.days_pending,
    workspaceId: row.workspace_id
  }));
}

let jobIntervalId: NodeJS.Timeout | null = null;

export function startStaleConnectionJob(): void {
  if (jobIntervalId) {
    console.log('[Stale Connection Job] Already running');
    return;
  }
  
  console.log(`[Stale Connection Job] Starting background job (interval: ${CHECK_INTERVAL_MS / 1000 / 60} minutes)`);
  
  // Run immediately on startup
  setTimeout(() => {
    processStaleConnections().catch(err => 
      console.error('[Stale Connection Job] Error:', err)
    );
  }, 30000); // Wait 30 seconds after server start
  
  // Then run periodically
  jobIntervalId = setInterval(() => {
    processStaleConnections().catch(err => 
      console.error('[Stale Connection Job] Error:', err)
    );
  }, CHECK_INTERVAL_MS);
}

export function stopStaleConnectionJob(): void {
  if (jobIntervalId) {
    clearInterval(jobIntervalId);
    jobIntervalId = null;
    console.log('[Stale Connection Job] Stopped');
  }
}

export async function getStaleConnectionStats(): Promise<{
  totalPending: number;
  stale30Days: number;
  stale60Days: number;
  stale90Days: number;
}> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending') as total_pending,
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending' 
                       AND linkedin_connection_sent_at < NOW() - INTERVAL '30 days') as stale_30,
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending' 
                       AND linkedin_connection_sent_at < NOW() - INTERVAL '60 days') as stale_60,
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending' 
                       AND linkedin_connection_sent_at < NOW() - INTERVAL '90 days') as stale_90
    FROM contacts
    WHERE linkedin_connection_status IS NOT NULL
  `);
  
  return {
    totalPending: parseInt(result.rows[0].total_pending) || 0,
    stale30Days: parseInt(result.rows[0].stale_30) || 0,
    stale60Days: parseInt(result.rows[0].stale_60) || 0,
    stale90Days: parseInt(result.rows[0].stale_90) || 0
  };
}

export default {
  startStaleConnectionJob,
  stopStaleConnectionJob,
  processStaleConnections,
  getStaleConnectionsForWithdrawal,
  getStaleConnectionStats
};
