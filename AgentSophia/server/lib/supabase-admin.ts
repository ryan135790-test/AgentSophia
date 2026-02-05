import { createClient, SupabaseClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string {
  if (process.env.SUPABASE_URL) return process.env.SUPABASE_URL;
  if (process.env.VITE_SUPABASE_URL) return process.env.VITE_SUPABASE_URL;
  
  const dbUrl = process.env.SUPABASE_DB_URL || '';
  
  // Match patterns like: postgres://...@db.xxxx.supabase.co:...
  const dbMatch = dbUrl.match(/@db\.([a-zA-Z0-9-]+)\.supabase\.co/);
  if (dbMatch) {
    return `https://${dbMatch[1]}.supabase.co`;
  }
  
  // Match patterns like: postgres://...postgres.xxxx:... (older format)
  const postgresMatch = dbUrl.match(/postgres\.([a-zA-Z0-9-]+):/);
  if (postgresMatch) {
    return `https://${postgresMatch[1]}.supabase.co`;
  }
  
  // Match patterns like: postgresql://...@aws-0-us-west-1.pooler.supabase.com:...
  // Extract project ref from pooler URL which has format: xxxx.pooler.supabase.com
  const poolerMatch = dbUrl.match(/@([a-zA-Z0-9-]+)\.pooler\.supabase\.com/);
  if (poolerMatch) {
    return `https://${poolerMatch[1]}.supabase.co`;
  }
  
  // Match patterns like: postgresql://...@aws-0-us-west-1.pooler.supabase.net:...
  // Pooled connections on .supabase.net domain
  const poolerNetMatch = dbUrl.match(/@([a-zA-Z0-9-]+)\.pooler\.supabase\.net/);
  if (poolerNetMatch) {
    return `https://${poolerNetMatch[1]}.supabase.co`;
  }
  
  // Match patterns like: postgresql://postgres.xxxx:password@aws-0-...
  // Where the project ref is after "postgres." in the username part
  const usernameMatch = dbUrl.match(/postgres\.([a-zA-Z0-9-]+):/);
  if (usernameMatch) {
    return `https://${usernameMatch[1]}.supabase.co`;
  }
  
  console.warn('[Supabase Admin] Could not derive URL from SUPABASE_DB_URL:', dbUrl.replace(/:[^:@]+@/, ':***@'));
  return '';
}

const supabaseUrl = getSupabaseUrl();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin: SupabaseClient | null = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

export const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export const supabaseAnon: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

if (!supabaseAdmin) {
  console.warn('[Supabase Admin] Could not initialize - URL:', !!supabaseUrl, 'Key:', !!supabaseServiceKey);
}
