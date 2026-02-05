let started = false;
let intervalId: NodeJS.Timeout | null = null;

export function startCampaignExecutor(): void {
  if (started) {
    console.log('[Campaign Executor] Already started');
    return;
  }
  
  console.log('[Campaign Executor] Starting background job (interval: 60000ms)');
  
  import('./campaign-executor.js').then(module => {
    module.startCampaignExecutorJob(60000);
  }).catch(error => {
    console.error('[Campaign Executor] Error starting:', error);
  });
  
  started = true;
  console.log('✅ Campaign Executor background job started');
}

export function stopCampaignExecutor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    started = false;
    console.log('[Campaign Executor] Stopped');
  }
}
