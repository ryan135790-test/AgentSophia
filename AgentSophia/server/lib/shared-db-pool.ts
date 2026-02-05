import { Pool } from 'pg';

let connectionString: string;
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
} else {
  connectionString = '';
}

console.log(`[Shared DB Pool] Connecting to: ${connectionString ? connectionString.replace(/:[^:@]+@/, ':***@') : 'NO CONNECTION STRING'}`);

export const sharedPool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  max: 10, // Maximum connections in pool
  min: 2, // Minimum connections to keep open
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  allowExitOnIdle: true, // Allow process to exit when pool is idle
});

sharedPool.on('error', (err) => {
  console.error('[Shared DB Pool] Unexpected error on idle client:', err);
});

sharedPool.on('connect', () => {
  console.log('[Shared DB Pool] New client connected');
});

sharedPool.on('remove', () => {
  console.log('[Shared DB Pool] Client removed from pool');
});

export { connectionString };
