import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Multi-User Cron Wrapper for Agent Sophia
 * This function runs the orchestrator for ALL active users
 * Designed to be called by pg_cron every 15 minutes
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🤖 Agent Sophia Cron: Starting multi-user orchestration...');

    // Get all users with active agent configs AND auto-check enabled
    const { data: activeAgents, error: agentsError } = await supabaseClient
      .from('agent_configs')
      .select('user_id, id, is_active, auto_check_enabled, autonomy_policies')
      .eq('is_active', true)
      .eq('auto_check_enabled', true);

    if (agentsError) {
      console.error('Failed to fetch active agents:', agentsError);
      throw agentsError;
    }

    if (!activeAgents || activeAgents.length === 0) {
      console.log('ℹ️ No active agents found');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No active agents to process',
          usersProcessed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`📋 Found ${activeAgents.length} active agent(s)`);

    // Process each user sequentially
    // NOTE: Sequential processing prevents overwhelming the system and ensures
    // each user gets proper attention. For 100+ users, consider batching or
    // splitting into multiple cron jobs to avoid timeout.
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const agent of activeAgents) {
      try {
        // Check if within working hours (using new autonomy_policies structure)
        const isWithinWorkingHours = checkWorkingHours(agent.autonomy_policies);

        if (!isWithinWorkingHours) {
          console.log(`⏰ User ${agent.user_id} outside working hours - skipping`);
          results.push({
            userId: agent.user_id,
            status: 'skipped',
            reason: 'Outside working hours',
          });
          continue;
        }

        // Call the orchestrator for this user
        const orchestratorResult = await callOrchestrator(agent.user_id);
        
        // Update last_checked_at timestamp
        await supabaseClient
          .from('agent_configs')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('user_id', agent.user_id);
        
        successCount++;
        results.push({
          userId: agent.user_id,
          status: 'success',
          ...orchestratorResult,
        });

        console.log(`✅ User ${agent.user_id}: ${orchestratorResult.message}`);

      } catch (error) {
        failureCount++;
        console.error(`❌ User ${agent.user_id} failed:`, error);
        results.push({
          userId: agent.user_id,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log(`🎯 Cron job complete: ${successCount} successful, ${failureCount} failed`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `Processed ${activeAgents.length} agent(s)`,
        usersProcessed: activeAgents.length,
        successCount,
        failureCount,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('❌ Cron job error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

/**
 * Call the orchestrator for a specific user
 */
async function callOrchestrator(userId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  const response = await fetch(`${supabaseUrl}/functions/v1/agent-sophia-orchestrator`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
    body: JSON.stringify({
      action: 'run_now',
      userId: userId,
      timeRange: '24h',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Orchestrator call failed');
  }

  return await response.json();
}

/**
 * Check if current time is within working hours
 * Returns true if working_hours_only is false or not set (24/7 operation)
 * Supports timezone-aware checking and day-of-week filtering
 */
function checkWorkingHours(autonomyPolicies: any): boolean {
  // If working_hours_only is not enabled, allow 24/7 operation
  if (!autonomyPolicies || !autonomyPolicies.working_hours_only) {
    console.log('✅ Working hours enforcement disabled - running 24/7');
    return true;
  }

  // Get working hours configuration
  const workingHours = autonomyPolicies.working_hours;
  if (!workingHours || !workingHours.start_time || !workingHours.end_time) {
    console.log('⚠️ Working hours enforcement enabled but no schedule configured - allowing 24/7');
    return true;
  }

  // Get current time in user's timezone
  const timezone = workingHours.timezone || 'UTC';
  const now = new Date();
  
  // Convert to user's timezone (simple approach using UTC offset)
  // Note: Full timezone support would require a library like luxon or date-fns-tz
  const currentTimeString = now.toLocaleString('en-US', { timeZone: timezone });
  const currentTime = new Date(currentTimeString);
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  
  // Get current day of week
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDay = daysOfWeek[currentTime.getDay()];

  // Check if today is a working day
  const workingDays = workingHours.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (!workingDays.includes(currentDay)) {
    console.log(`⏰ Today (${currentDay}) is not a working day`);
    return false;
  }

  // Parse working hours (format: "09:00" or "17:00")
  const [startHour, startMinute] = workingHours.start_time.split(':').map(Number);
  const [endHour, endMinute] = workingHours.end_time.split(':').map(Number);

  // Convert to minutes since midnight for easier comparison
  const currentMinutes = currentHour * 60 + currentMinute;
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Check if within working hours
  const isWithinHours = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  
  if (!isWithinHours) {
    console.log(`⏰ Outside working hours (${workingHours.start_time}-${workingHours.end_time} ${timezone})`);
  }

  return isWithinHours;
}
