import { createClient } from '@supabase/supabase-js';

// Environment variables are already loaded in Replit

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testDatabaseConnection() {
  console.log('🧪 Testing Supabase database connection...\n');

  try {
    // Test 1: Check if workflows table exists and is accessible
    console.log('Test 1: Checking workflows table access...');
    const { data, error, count } = await supabase
      .from('workflows')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log('❌ Error accessing workflows table:', error.message);
      throw error;
    }
    console.log(`✅ Workflows table accessible (${count} records found)\n`);

    // Test 2: Check workflow_nodes table
    console.log('Test 2: Checking workflow_nodes table access...');
    const { error: nodesError, count: nodesCount } = await supabase
      .from('workflow_nodes')
      .select('*', { count: 'exact', head: true });
    
    if (nodesError) {
      console.log('❌ Error accessing workflow_nodes table:', nodesError.message);
      throw nodesError;
    }
    console.log(`✅ Workflow nodes table accessible (${nodesCount} records found)\n`);

    // Test 3: Check workflow_edges table
    console.log('Test 3: Checking workflow_edges table access...');
    const { error: edgesError, count: edgesCount } = await supabase
      .from('workflow_edges')
      .select('*', { count: 'exact', head: true });
    
    if (edgesError) {
      console.log('❌ Error accessing workflow_edges table:', edgesError.message);
      throw edgesError;
    }
    console.log(`✅ Workflow edges table accessible (${edgesCount} records found)\n`);

    // Test 4: List all existing workflows
    console.log('Test 4: Fetching existing workflows...');
    const { data: workflows, error: fetchError } = await supabase
      .from('workflows')
      .select('id, name, type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (fetchError) {
      console.log('❌ Error fetching workflows:', fetchError.message);
      throw fetchError;
    }
    
    if (workflows && workflows.length > 0) {
      console.log(`✅ Found ${workflows.length} workflow(s):`);
      workflows.forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.name} (${w.type}) - Status: ${w.status}`);
      });
    } else {
      console.log('✅ No workflows found in database (empty table)');
    }

    console.log('\n🎉 All database tests passed!');
    console.log('✅ Supabase client is working correctly');
    console.log('✅ All workflow tables are accessible');
    
  } catch (error: any) {
    console.error('\n❌ Database test failed:', error.message);
    process.exit(1);
  }
}

testDatabaseConnection();
