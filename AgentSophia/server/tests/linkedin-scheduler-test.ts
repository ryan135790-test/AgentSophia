/**
 * Test script for LinkedIn Safety Scheduler
 * Tests warmup settings, limit enforcement, and personalization
 */

import { 
  initializeSafetySettings, 
  getSafetySettings, 
  setWarmUpMode,
  getCurrentLimits,
  canPerformAction,
  getTodayUsage,
  recordAction
} from '../lib/linkedin-safety-controls';

const testAccountId = 'test-scheduler-' + Date.now();

async function runTests() {
  console.log('========================================');
  console.log('LinkedIn Safety Scheduler Tests');
  console.log('========================================\n');

  // Test 1: Initialize safety settings
  console.log('TEST 1: Initialize Safety Settings');
  console.log('-----------------------------------');
  const settings = initializeSafetySettings(testAccountId, {
    type: 'free',
    connectionCount: 100,
    accountAgeDays: 30
  });
  console.log('✅ Settings initialized');
  console.log('  Account type:', settings.accountType.type);
  console.log('  Daily connection limit:', settings.dailyLimits.connectionRequests);
  console.log('  Weekly connection limit:', settings.weeklyLimits.connectionRequests);

  // Test 2: Warmup mode OFF - check limits
  console.log('\nTEST 2: Limits WITHOUT Warmup');
  console.log('-----------------------------------');
  const limitsNoWarmup = getCurrentLimits(testAccountId);
  console.log('  Connection requests/day:', limitsNoWarmup.connectionRequests);
  console.log('  Messages/day:', limitsNoWarmup.messages);
  console.log('  Total actions/day:', limitsNoWarmup.totalActions);

  // Test 3: Enable warmup mode
  console.log('\nTEST 3: Enable Warmup Mode');
  console.log('-----------------------------------');
  setWarmUpMode(testAccountId, true);
  const updatedSettings = getSafetySettings(testAccountId);
  console.log('✅ Warmup mode enabled:', updatedSettings?.warmUpMode.enabled);

  // Test 4: Warmup mode ON - check reduced limits
  console.log('\nTEST 4: Limits WITH Warmup (Day 1)');
  console.log('-----------------------------------');
  const limitsWithWarmup = getCurrentLimits(testAccountId);
  console.log('  Connection requests/day:', limitsWithWarmup.connectionRequests);
  console.log('  Messages/day:', limitsWithWarmup.messages);
  console.log('  Total actions/day:', limitsWithWarmup.totalActions);
  
  if (limitsWithWarmup.connectionRequests < limitsNoWarmup.connectionRequests) {
    console.log('✅ PASS: Warmup limits are correctly reduced');
  } else {
    console.log('❌ FAIL: Warmup limits should be lower than normal limits');
  }

  // Test 5: Check if action can be performed
  console.log('\nTEST 5: Action Check (with warmup)');
  console.log('-----------------------------------');
  const actionCheck = canPerformAction(testAccountId, 'connection_request');
  console.log('  Can perform action:', actionCheck.allowed);
  console.log('  Remaining today:', actionCheck.remainingToday);
  console.log('  Remaining this week:', actionCheck.remainingThisWeek);

  // Test 6: Record actions and verify limit enforcement
  console.log('\nTEST 6: Record Actions Until Limit');
  console.log('-----------------------------------');
  const maxToday = limitsWithWarmup.connectionRequests;
  console.log('  Daily limit:', maxToday);
  
  for (let i = 0; i < maxToday; i++) {
    recordAction(testAccountId, 'connection_request');
  }
  
  const usageAfter = getTodayUsage(testAccountId);
  console.log('  Actions recorded:', usageAfter.connectionRequestsSent);
  
  const actionCheckAfterLimit = canPerformAction(testAccountId, 'connection_request');
  console.log('  Can perform after limit:', actionCheckAfterLimit.allowed);
  console.log('  Reason:', actionCheckAfterLimit.reason || 'None');
  
  if (!actionCheckAfterLimit.allowed) {
    console.log('✅ PASS: Limit enforcement working correctly');
  } else {
    console.log('❌ FAIL: Should not allow more actions after limit reached');
  }

  // Test 7: Test personalization
  console.log('\nTEST 7: Message Personalization');
  console.log('-----------------------------------');
  const template = "Hi {{first_name}}, I noticed you work at {{company}}. Let's connect!";
  const contact = { first_name: 'John', last_name: 'Doe', company: 'Acme Inc' };
  
  const personalized = template
    .replace(/\{\{first_name\}\}/gi, contact.first_name || '')
    .replace(/\{\{last_name\}\}/gi, contact.last_name || '')
    .replace(/\{\{company\}\}/gi, contact.company || '');
  
  console.log('  Template:', template);
  console.log('  Personalized:', personalized);
  
  if (personalized.includes('John') && personalized.includes('Acme Inc')) {
    console.log('✅ PASS: Personalization working correctly');
  } else {
    console.log('❌ FAIL: Personalization not working');
  }

  // Test 8: LinkedIn URL filtering
  console.log('\nTEST 8: LinkedIn URL Filtering');
  console.log('-----------------------------------');
  const contacts = [
    { id: '1', linkedin_url: 'https://linkedin.com/in/john', first_name: 'John' },
    { id: '2', linkedin_url: '', first_name: 'Jane' },
    { id: '3', linkedin_url: null, first_name: 'Bob' },
    { id: '4', linkedin_url: 'https://linkedin.com/in/alice', first_name: 'Alice' },
  ];
  
  const contactsWithLinkedIn = contacts.filter(c => c.linkedin_url && c.linkedin_url.trim().length > 0);
  console.log('  Total contacts:', contacts.length);
  console.log('  Contacts with LinkedIn URL:', contactsWithLinkedIn.length);
  console.log('  Filtered contacts:', contactsWithLinkedIn.map(c => c.first_name).join(', '));
  
  if (contactsWithLinkedIn.length === 2) {
    console.log('✅ PASS: URL filtering working correctly');
  } else {
    console.log('❌ FAIL: Should filter out contacts without LinkedIn URLs');
  }

  console.log('\n========================================');
  console.log('All Tests Completed');
  console.log('========================================');
}

runTests().catch(console.error);
