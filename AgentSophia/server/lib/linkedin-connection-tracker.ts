import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

export type ConnectionStatusType = 'none' | 'pending' | 'accepted' | 'withdrawn' | 'pending_withdrawal';

export interface ConnectionStatus {
  contactId: string;
  linkedinUrl: string;
  status: ConnectionStatusType;
  sentAt: Date | null;
  acceptedAt: Date | null;
  withdrawnAt: Date | null;
}

export async function markConnectionSent(contactId: string, linkedinUrl: string): Promise<void> {
  await pool.query(`
    UPDATE contacts 
    SET linkedin_connection_status = 'pending',
        linkedin_connection_sent_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
  `, [contactId]);
  
  console.log(`[Connection Tracker] Marked connection as pending for contact ${contactId}`);
}

export async function markConnectionAccepted(contactId: string): Promise<void> {
  // Update the contact record
  const result = await pool.query(`
    UPDATE contacts 
    SET linkedin_connection_status = 'accepted',
        linkedin_connection_accepted_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING workspace_id
  `, [contactId]);
  
  const workspaceId = result.rows[0]?.workspace_id;
  
  // CRITICAL: Also update campaign_scheduled_steps to 'completed' for this contact
  // This is needed for warmup-analytics to show correct acceptance counts
  const stepsResult = await pool.query(`
    UPDATE campaign_scheduled_steps 
    SET status = 'completed',
        updated_at = NOW()
    WHERE contact_id = $1 
      AND status = 'sent'
      AND channel = 'linkedin_connection'
    RETURNING id
  `, [contactId]);
  
  if (stepsResult.rowCount && stepsResult.rowCount > 0) {
    console.log(`[Connection Tracker] Updated ${stepsResult.rowCount} campaign step(s) to completed for contact ${contactId}`);
  }
  
  console.log(`[Connection Tracker] Marked connection as accepted for contact ${contactId}`);
}

export async function markConnectionWithdrawn(contactId: string): Promise<void> {
  await pool.query(`
    UPDATE contacts 
    SET linkedin_connection_status = 'withdrawn',
        linkedin_connection_withdrawn_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
  `, [contactId]);
  
  console.log(`[Connection Tracker] Marked connection as withdrawn for contact ${contactId}`);
}

export async function getPendingConnections(workspaceId: string, olderThanDays: number = 0): Promise<ConnectionStatus[]> {
  const boundedDays = Math.max(0, Math.min(365, olderThanDays));
  const result = await pool.query(`
    SELECT id as contact_id, linkedin_url, linkedin_connection_status as status,
           linkedin_connection_sent_at as sent_at,
           linkedin_connection_accepted_at as accepted_at,
           linkedin_connection_withdrawn_at as withdrawn_at
    FROM contacts
    WHERE workspace_id = $1
      AND linkedin_connection_status = 'pending'
      AND linkedin_connection_sent_at < NOW() - ($2 || ' days')::interval
    ORDER BY linkedin_connection_sent_at ASC
  `, [workspaceId, boundedDays.toString()]);
  
  return result.rows.map(row => ({
    contactId: row.contact_id,
    linkedinUrl: row.linkedin_url,
    status: row.status,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    withdrawnAt: row.withdrawn_at
  }));
}

export async function getStaleConnections(workspaceId: string, staleAfterDays: number = 30): Promise<ConnectionStatus[]> {
  const boundedDays = Math.max(1, Math.min(365, staleAfterDays));
  const result = await pool.query(`
    SELECT id as contact_id, linkedin_url, linkedin_connection_status as status,
           linkedin_connection_sent_at as sent_at,
           linkedin_connection_accepted_at as accepted_at,
           linkedin_connection_withdrawn_at as withdrawn_at
    FROM contacts
    WHERE workspace_id = $1
      AND linkedin_connection_status = 'pending'
      AND linkedin_connection_sent_at < NOW() - ($2 || ' days')::interval
    ORDER BY linkedin_connection_sent_at ASC
  `, [workspaceId, boundedDays.toString()]);
  
  return result.rows.map(row => ({
    contactId: row.contact_id,
    linkedinUrl: row.linkedin_url,
    status: row.status,
    sentAt: row.sent_at,
    acceptedAt: row.accepted_at,
    withdrawnAt: row.withdrawn_at
  }));
}

export async function getConnectionStats(workspaceId: string): Promise<{
  total: number;
  pending: number;
  accepted: number;
  withdrawn: number;
  pendingWithdrawal: number;
  stale: number;
}> {
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE linkedin_connection_status IS NOT NULL AND linkedin_connection_status != 'none') as total,
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending') as pending,
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'accepted') as accepted,
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'withdrawn') as withdrawn,
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending_withdrawal') as pending_withdrawal,
      COUNT(*) FILTER (WHERE linkedin_connection_status = 'pending' 
                       AND linkedin_connection_sent_at < NOW() - INTERVAL '30 days') as stale
    FROM contacts
    WHERE workspace_id = $1
  `, [workspaceId]);
  
  return {
    total: parseInt(result.rows[0].total) || 0,
    pending: parseInt(result.rows[0].pending) || 0,
    accepted: parseInt(result.rows[0].accepted) || 0,
    withdrawn: parseInt(result.rows[0].withdrawn) || 0,
    pendingWithdrawal: parseInt(result.rows[0].pending_withdrawal) || 0,
    stale: parseInt(result.rows[0].stale) || 0
  };
}

export async function getCampaignContactsByStep(campaignId: string): Promise<{
  stepIndex: number;
  channel: string;
  status: string;
  contacts: Array<{
    contactId: string;
    firstName: string;
    lastName: string;
    linkedinUrl: string;
    connectionStatus: string;
    acceptedAt: Date | null;
    executedAt: Date | null;
  }>;
}[]> {
  const result = await pool.query(`
    SELECT 
      css.step_index,
      css.channel,
      css.status as step_status,
      c.id as contact_id,
      c.first_name,
      c.last_name,
      c.linkedin_url,
      c.linkedin_connection_status as connection_status,
      c.linkedin_connection_accepted_at as accepted_at,
      css.executed_at
    FROM campaign_scheduled_steps css
    JOIN contacts c ON c.id::text = css.contact_id::text
    WHERE css.campaign_id = $1
    ORDER BY css.step_index, css.executed_at DESC
  `, [campaignId]);
  
  const stepMap = new Map<number, {
    stepIndex: number;
    channel: string;
    status: string;
    contacts: Array<{
      contactId: string;
      firstName: string;
      lastName: string;
      linkedinUrl: string;
      connectionStatus: string;
      acceptedAt: Date | null;
      executedAt: Date | null;
    }>;
  }>();
  
  for (const row of result.rows) {
    if (!stepMap.has(row.step_index)) {
      stepMap.set(row.step_index, {
        stepIndex: row.step_index,
        channel: row.channel,
        status: row.step_status,
        contacts: []
      });
    }
    
    stepMap.get(row.step_index)!.contacts.push({
      contactId: row.contact_id,
      firstName: row.first_name,
      lastName: row.last_name,
      linkedinUrl: row.linkedin_url,
      connectionStatus: row.connection_status || 'none',
      acceptedAt: row.accepted_at,
      executedAt: row.executed_at
    });
  }
  
  return Array.from(stepMap.values()).sort((a, b) => a.stepIndex - b.stepIndex);
}

export default {
  markConnectionSent,
  markConnectionAccepted,
  markConnectionWithdrawn,
  getPendingConnections,
  getStaleConnections,
  getConnectionStats,
  getCampaignContactsByStep
};
