import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

const pgUser = process.env.PGUSER || 'postgres';
const pgPassword = process.env.PGPASSWORD || '';
const pgHost = process.env.PGHOST;
const pgPort = process.env.PGPORT || '5432';
const pgDatabase = process.env.PGDATABASE;
const connectionString = `postgresql://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`;

const pool = new Pool({ connectionString });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n========================================');
console.log('  CAMPAIGN EXECUTOR E2E SIMULATION');
console.log('========================================\n');

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSimulation() {
  // Step 1: Load real contacts from Supabase
  console.log('📋 STEP 1: Loading contacts from Supabase...');
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, email, company, linkedin_url')
    .limit(3);

  if (contactsError) {
    console.log('❌ Error loading contacts:', contactsError.message);
    console.log('   Creating mock contacts for simulation...');
  }

  const testContacts = contacts && contacts.length > 0 ? contacts : [
    { id: randomUUID(), first_name: 'John', last_name: 'Smith', email: 'john@example.com', company: 'Acme Corp', linkedin_url: 'linkedin.com/in/johnsmith' },
    { id: randomUUID(), first_name: 'Sarah', last_name: 'Johnson', email: 'sarah@example.com', company: 'TechStart', linkedin_url: 'linkedin.com/in/sarahjohnson' },
    { id: randomUUID(), first_name: 'Mike', last_name: 'Davis', email: 'mike@example.com', company: 'DataFlow', linkedin_url: 'linkedin.com/in/mikedavis' },
  ];

  console.log(`   ✅ Loaded ${testContacts.length} contacts:`);
  testContacts.forEach((c, i) => {
    console.log(`      ${i + 1}. ${c.first_name} ${c.last_name} (${c.email}) @ ${c.company}`);
  });

  // Step 2: Load real campaign from Supabase
  console.log('\n📋 STEP 2: Loading campaign from Supabase...');
  const { data: campaigns, error: campaignsError } = await supabase
    .from('campaigns')
    .select('id, name, status, user_id, workspace_id, type')
    .eq('status', 'active')
    .limit(1);

  let campaign: any;
  if (campaignsError || !campaigns || campaigns.length === 0) {
    console.log('   ⚠️ No active campaigns found, using simulated campaign');
    campaign = {
      id: randomUUID(),
      name: 'Simulation Test Campaign',
      status: 'active',
      user_id: randomUUID(),
      workspace_id: null,
      type: 'outreach'
    };
  } else {
    campaign = campaigns[0];
    console.log(`   ✅ Loaded campaign: "${campaign.name}" (${campaign.type})`);
  }

  // Step 3: Check workspace autonomy settings
  console.log('\n📋 STEP 3: Loading autonomy configuration...');
  const configResult = await pool.query(
    `SELECT * FROM agent_configs WHERE workspace_id = $1 OR workspace_id IS NULL LIMIT 1`,
    [campaign.workspace_id]
  );
  
  let autonomyLevel = 'semi_autonomous';
  let confidenceThreshold = 80;
  
  if (configResult.rows.length > 0) {
    const config = configResult.rows[0];
    autonomyLevel = config.autonomy_level || 'semi_autonomous';
    confidenceThreshold = config.autonomy_policies?.confidence_threshold || 80;
    console.log(`   ✅ Found config: ${autonomyLevel} mode, ${confidenceThreshold}% threshold`);
  } else {
    console.log(`   ⚠️ No config found, using defaults: ${autonomyLevel} mode, ${confidenceThreshold}% threshold`);
  }

  // Step 4: Define multi-step campaign workflow
  console.log('\n📋 STEP 4: Defining campaign workflow steps...');
  const workflowSteps = [
    { channel: 'email', subject: 'Introduction to {{company}}', content: 'Hi {{first_name}}, I noticed you work at {{company}}...', delay: 0 },
    { channel: 'linkedin_connection', subject: null, content: 'Hi {{first_name}}, I\'d love to connect!', delay: 2 },
    { channel: 'email', subject: 'Following up', content: 'Hi {{first_name}}, just wanted to follow up on my previous message...', delay: 3 },
    { channel: 'linkedin_message', subject: null, content: 'Thanks for connecting {{first_name}}! I wanted to share...', delay: 5 },
    { channel: 'phone', subject: null, content: 'Call script: Introduce yourself and ask about their needs at {{company}}', delay: 7 },
  ];
  console.log(`   ✅ Defined ${workflowSteps.length} workflow steps:`);
  workflowSteps.forEach((s, i) => {
    console.log(`      Step ${i + 1}: ${s.channel} - "${s.subject || s.content.substring(0, 40)}..."`);
  });

  // Step 5: Schedule steps for all contacts
  console.log('\n📋 STEP 5: Scheduling campaign steps for contacts...');
  const scheduledStepIds: string[] = [];
  
  for (const contact of testContacts) {
    for (let i = 0; i < workflowSteps.length; i++) {
      const step = workflowSteps[i];
      const scheduledAt = new Date(Date.now() + step.delay * 60 * 1000); // delay in minutes
      
      const personalizedContent = step.content
        .replace(/\{\{first_name\}\}/g, contact.first_name || '')
        .replace(/\{\{last_name\}\}/g, contact.last_name || '')
        .replace(/\{\{company\}\}/g, contact.company || '');
      
      const personalizedSubject = step.subject
        ?.replace(/\{\{first_name\}\}/g, contact.first_name || '')
        .replace(/\{\{company\}\}/g, contact.company || '');
      
      const result = await pool.query(`
        INSERT INTO campaign_scheduled_steps 
        (campaign_id, workspace_id, contact_id, step_index, channel, subject, content, 
         status, scheduled_at, personalization_data)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [
        campaign.id, campaign.workspace_id, contact.id, i + 1, step.channel,
        personalizedSubject, personalizedContent, 'pending', scheduledAt,
        JSON.stringify({ first_name: contact.first_name, company: contact.company })
      ]);
      
      scheduledStepIds.push(result.rows[0].id);
    }
  }
  
  console.log(`   ✅ Scheduled ${scheduledStepIds.length} steps (${testContacts.length} contacts × ${workflowSteps.length} steps)`);

  // Step 6: Simulate autonomy checks and execution
  console.log('\n📋 STEP 6: Running autonomy checks and execution simulation...');
  
  const getChannelConfidence = (channel: string): number => {
    switch (channel) {
      case 'email': return 90;
      case 'sms': return 85;
      case 'linkedin': case 'linkedin_message': return 75;
      case 'linkedin_connection': return 70;
      case 'phone': case 'voicemail': return 65;
      default: return 75;
    }
  };
  
  const alwaysApprovalChannels = ['linkedin', 'linkedin_message', 'linkedin_connection', 'phone', 'voicemail'];
  
  let autoExecuted = 0;
  let sentToApproval = 0;
  
  // Process first step for each contact (simulate immediate execution)
  const stepsToProcess = await pool.query(`
    SELECT * FROM campaign_scheduled_steps 
    WHERE campaign_id = $1 AND step_index = 1
    ORDER BY created_at
  `, [campaign.id]);
  
  console.log(`\n   Processing ${stepsToProcess.rows.length} Step 1 items (immediate execution)...`);
  
  for (const step of stepsToProcess.rows) {
    const confidence = getChannelConfidence(step.channel);
    const requiresApproval = 
      autonomyLevel === 'manual_approval' ||
      (autonomyLevel === 'semi_autonomous' && (
        alwaysApprovalChannels.includes(step.channel) ||
        confidence < confidenceThreshold
      ));
    
    if (requiresApproval) {
      // Route to approval queue
      await pool.query(
        `UPDATE campaign_scheduled_steps SET status = 'requires_approval', requires_approval = true WHERE id = $1`,
        [step.id]
      );
      await pool.query(`
        INSERT INTO sophia_approval_items 
        (scheduled_step_id, campaign_id, contact_id, workspace_id, action_type, 
         action_data, preview_content, sophia_reasoning, sophia_confidence, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        step.id, campaign.id, step.contact_id, step.workspace_id, 'send_message',
        JSON.stringify({ channel: step.channel, subject: step.subject }),
        step.content.substring(0, 200), 
        `${step.channel} requires approval in ${autonomyLevel} mode`,
        confidence, 'pending'
      ]);
      sentToApproval++;
      console.log(`      📋 ${step.channel}: Sent to approval queue (confidence: ${confidence}%)`);
    } else {
      // Auto-execute
      const messageId = 'sim-' + randomUUID().substring(0, 8);
      await pool.query(
        `UPDATE campaign_scheduled_steps SET status = 'sent', executed_at = NOW(), message_id = $1 WHERE id = $2`,
        [messageId, step.id]
      );
      autoExecuted++;
      console.log(`      ✅ ${step.channel}: Auto-executed (confidence: ${confidence}% >= ${confidenceThreshold}%)`);
    }
  }
  
  console.log(`\n   Summary: ${autoExecuted} auto-executed, ${sentToApproval} sent to approval queue`);

  // Step 7: Simulate approval workflow
  console.log('\n📋 STEP 7: Simulating approval workflow...');
  
  const pendingApprovals = await pool.query(`
    SELECT sai.*, css.channel, css.content 
    FROM sophia_approval_items sai
    JOIN campaign_scheduled_steps css ON sai.scheduled_step_id = css.id
    WHERE sai.campaign_id = $1 AND sai.status = 'pending'
  `, [campaign.id]);
  
  console.log(`   Found ${pendingApprovals.rows.length} pending approvals`);
  
  // Approve half, reject one
  let approved = 0;
  let rejected = 0;
  
  for (let i = 0; i < pendingApprovals.rows.length; i++) {
    const approval = pendingApprovals.rows[i];
    const approverId = randomUUID();
    
    if (i === 0) {
      // Reject first one as demo
      await pool.query(
        `UPDATE sophia_approval_items SET status = 'rejected', resolved_at = NOW(), resolved_by = $1, resolution_notes = $2 WHERE id = $3`,
        [approverId, 'Content needs revision', approval.id]
      );
      await pool.query(
        `UPDATE campaign_scheduled_steps SET status = 'rejected' WHERE id = $1`,
        [approval.scheduled_step_id]
      );
      rejected++;
      console.log(`      ❌ Rejected: ${approval.channel} - "Content needs revision"`);
    } else {
      // Approve the rest
      await pool.query(
        `UPDATE sophia_approval_items SET status = 'approved', resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
        [approverId, approval.id]
      );
      await pool.query(
        `UPDATE campaign_scheduled_steps SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2`,
        [approverId, approval.scheduled_step_id]
      );
      approved++;
      console.log(`      ✅ Approved: ${approval.channel}`);
    }
  }
  
  console.log(`\n   Approval summary: ${approved} approved, ${rejected} rejected`);

  // Step 8: Execute approved steps
  console.log('\n📋 STEP 8: Executing approved steps...');
  
  const approvedSteps = await pool.query(`
    SELECT * FROM campaign_scheduled_steps 
    WHERE campaign_id = $1 AND status = 'approved'
  `, [campaign.id]);
  
  console.log(`   Found ${approvedSteps.rows.length} approved steps to execute`);
  
  for (const step of approvedSteps.rows) {
    const messageId = 'exec-' + randomUUID().substring(0, 8);
    await pool.query(
      `UPDATE campaign_scheduled_steps SET status = 'sent', executed_at = NOW(), message_id = $1 WHERE id = $2`,
      [messageId, step.id]
    );
    console.log(`      ✅ Executed: ${step.channel} → ${step.content.substring(0, 50)}...`);
  }

  // Step 9: Advance contacts to next step
  console.log('\n📋 STEP 9: Advancing contacts to next workflow step...');
  
  // Get contacts who completed step 1
  const completedStep1 = await pool.query(`
    SELECT DISTINCT contact_id FROM campaign_scheduled_steps 
    WHERE campaign_id = $1 AND step_index = 1 AND status = 'sent'
  `, [campaign.id]);
  
  console.log(`   ${completedStep1.rows.length} contacts completed Step 1, advancing to Step 2...`);
  
  // Mark step 2 as ready (update scheduled_at to now)
  for (const row of completedStep1.rows) {
    await pool.query(`
      UPDATE campaign_scheduled_steps 
      SET scheduled_at = NOW() 
      WHERE campaign_id = $1 AND contact_id = $2 AND step_index = 2 AND status = 'pending'
    `, [campaign.id, row.contact_id]);
  }
  
  const step2Ready = await pool.query(`
    SELECT * FROM campaign_scheduled_steps 
    WHERE campaign_id = $1 AND step_index = 2 AND scheduled_at <= NOW() AND status = 'pending'
  `, [campaign.id]);
  
  console.log(`   ✅ ${step2Ready.rows.length} Step 2 items ready for next execution cycle`);

  // Step 9b: Process Step 2 (LinkedIn - requires approval in semi-auto)
  console.log('\n📋 STEP 9b: Processing Step 2 (LinkedIn connection requests)...');
  
  let step2AutoExecuted = 0;
  let step2SentToApproval = 0;
  
  for (const step of step2Ready.rows) {
    const confidence = getChannelConfidence(step.channel);
    const requiresApproval = 
      autonomyLevel === 'manual_approval' ||
      (autonomyLevel === 'semi_autonomous' && (
        alwaysApprovalChannels.includes(step.channel) ||
        confidence < confidenceThreshold
      ));
    
    if (requiresApproval) {
      await pool.query(
        `UPDATE campaign_scheduled_steps SET status = 'requires_approval', requires_approval = true WHERE id = $1`,
        [step.id]
      );
      await pool.query(`
        INSERT INTO sophia_approval_items 
        (scheduled_step_id, campaign_id, contact_id, workspace_id, action_type, 
         action_data, preview_content, sophia_reasoning, sophia_confidence, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        step.id, campaign.id, step.contact_id, step.workspace_id, 'send_message',
        JSON.stringify({ channel: step.channel }),
        step.content.substring(0, 200), 
        `${step.channel} ALWAYS requires approval in semi_autonomous mode`,
        confidence, 'pending'
      ]);
      step2SentToApproval++;
      console.log(`      📋 ${step.channel}: Sent to approval (confidence: ${confidence}% - ALWAYS requires approval)`);
    } else {
      const messageId = 'sim2-' + randomUUID().substring(0, 8);
      await pool.query(
        `UPDATE campaign_scheduled_steps SET status = 'sent', executed_at = NOW(), message_id = $1 WHERE id = $2`,
        [messageId, step.id]
      );
      step2AutoExecuted++;
      console.log(`      ✅ ${step.channel}: Auto-executed (confidence: ${confidence}%)`);
    }
  }
  
  console.log(`\n   Step 2 summary: ${step2AutoExecuted} auto-executed, ${step2SentToApproval} sent to approval`);

  // Step 9c: Approve all Step 2 items and execute
  console.log('\n📋 STEP 9c: Approving and executing Step 2 LinkedIn requests...');
  
  const step2Approvals = await pool.query(`
    SELECT sai.*, css.channel, css.content 
    FROM sophia_approval_items sai
    JOIN campaign_scheduled_steps css ON sai.scheduled_step_id = css.id
    WHERE sai.campaign_id = $1 AND sai.status = 'pending' AND css.step_index = 2
  `, [campaign.id]);
  
  console.log(`   Processing ${step2Approvals.rows.length} Step 2 approvals...`);
  
  for (const approval of step2Approvals.rows) {
    const approverId = randomUUID();
    
    // Approve
    await pool.query(
      `UPDATE sophia_approval_items SET status = 'approved', resolved_at = NOW(), resolved_by = $1 WHERE id = $2`,
      [approverId, approval.id]
    );
    await pool.query(
      `UPDATE campaign_scheduled_steps SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2`,
      [approverId, approval.scheduled_step_id]
    );
    
    // Execute immediately
    const messageId = 'li-' + randomUUID().substring(0, 8);
    await pool.query(
      `UPDATE campaign_scheduled_steps SET status = 'sent', executed_at = NOW(), message_id = $1 WHERE id = $2`,
      [messageId, approval.scheduled_step_id]
    );
    console.log(`      ✅ Approved & sent: ${approval.channel} → ${approval.content.substring(0, 40)}...`);
  }

  // Step 10: Create execution log
  console.log('\n📋 STEP 10: Creating execution log...');
  
  const stats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'requires_approval') as pending_approval,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'approved') as approved
    FROM campaign_scheduled_steps 
    WHERE campaign_id = $1
  `, [campaign.id]);
  
  const s = stats.rows[0];
  
  await pool.query(`
    INSERT INTO campaign_execution_logs 
    (campaign_id, workspace_id, execution_type, status, total_steps, completed_steps, 
     failed_steps, pending_approval_steps, started_at, completed_at, autonomy_level_used)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9)
  `, [
    campaign.id, campaign.workspace_id, 'full_run', 'completed',
    Number(s.total), Number(s.sent), Number(s.failed), 
    Number(s.pending_approval), autonomyLevel
  ]);
  
  console.log(`   ✅ Execution log created`);

  // Final Summary
  console.log('\n========================================');
  console.log('  SIMULATION COMPLETE - FINAL SUMMARY');
  console.log('========================================\n');
  console.log(`   Campaign: ${campaign.name}`);
  console.log(`   Autonomy: ${autonomyLevel} (${confidenceThreshold}% threshold)`);
  console.log(`   Contacts: ${testContacts.length}`);
  console.log(`   Workflow Steps: ${workflowSteps.length}`);
  console.log('\n   Step Status Breakdown:');
  console.log(`      📤 Sent: ${s.sent}`);
  console.log(`      ⏳ Pending: ${s.pending}`);
  console.log(`      ✅ Approved: ${s.approved}`);
  console.log(`      📋 Awaiting Approval: ${s.pending_approval}`);
  console.log(`      ❌ Rejected: ${s.rejected}`);
  console.log(`      ⚠️ Failed: ${s.failed}`);
  console.log(`      📊 Total: ${s.total}`);

  // Cleanup
  console.log('\n📋 Cleaning up simulation data...');
  await pool.query(`DELETE FROM sophia_approval_items WHERE campaign_id = $1`, [campaign.id]);
  await pool.query(`DELETE FROM campaign_scheduled_steps WHERE campaign_id = $1`, [campaign.id]);
  await pool.query(`DELETE FROM campaign_execution_logs WHERE campaign_id = $1`, [campaign.id]);
  console.log('   ✅ Simulation data cleaned up');

  console.log('\n========================================');
  console.log('  ✅ END-TO-END SIMULATION SUCCESSFUL');
  console.log('========================================\n');

  await pool.end();
}

runSimulation()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Simulation failed:', err);
    process.exit(1);
  });
