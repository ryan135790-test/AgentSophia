/**
 * Migration: Add description column to workspaces table
 * 
 * This migration adds a nullable TEXT column for workspace descriptions.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function migrate() {
  console.log('🔄 Starting migration: Add description to workspaces table...');
  
  try {
    // Add description column if it doesn't exist
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'workspaces' AND column_name = 'description'
          ) THEN
            ALTER TABLE workspaces ADD COLUMN description TEXT NULL;
            COMMENT ON COLUMN workspaces.description IS 'Optional workspace description';
          END IF;
        END $$;
      `
    });

    if (error) {
      // If RPC doesn't exist, try direct SQL execution
      console.log('⚠️ RPC method not available, using alternative approach...');
      
      // Use Supabase's SQL editor approach or manual instruction
      console.log('\n📝 Please run this SQL in your Supabase SQL Editor:');
      console.log('----------------------------------------');
      console.log(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT NULL;`);
      console.log('----------------------------------------\n');
      console.log('Once done, the schema cache will automatically refresh.');
      
    } else {
      console.log('✅ Migration completed successfully!');
      console.log('   - Added description column to workspaces table');
      console.log('   - Column type: TEXT (nullable)');
      console.log('   - Existing workspaces will have NULL descriptions');
    }

  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    console.log('\n📝 Manual SQL to run in Supabase SQL Editor:');
    console.log('----------------------------------------');
    console.log(`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS description TEXT NULL;`);
    console.log('----------------------------------------');
  }
}

migrate();
