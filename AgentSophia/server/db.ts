import { Pool, PoolClient } from 'pg';

// Use SUPABASE_DB_URL if available, otherwise fall back to Replit DATABASE_URL
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('⚠️ No DATABASE_URL or SUPABASE_DB_URL configured for direct PostgreSQL connection');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  max: 20,
  connectionTimeoutMillis: 10000
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Direct PostgreSQL connection failed:', err.message);
  } else {
    console.log('✅ Direct PostgreSQL connection established');
  }
});

// Helper: Execute a query with parameters
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  const result = await pool.query(text, params);
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount || 0
  };
}

// Helper: Execute queries in a transaction
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Export pool for advanced use cases
export { pool };
