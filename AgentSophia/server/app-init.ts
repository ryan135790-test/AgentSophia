import type { Express } from 'express';

let initialized = false;
let backgroundServicesStarted = false;

export async function initializeApp(app: Express): Promise<void> {
  if (initialized) {
    console.log('[App Init] Already initialized, skipping');
    return;
  }
  
  console.log('[App Init] Starting lazy initialization...');
  const startTime = Date.now();
  
  try {
    const { initializeFullApp } = await import('./index-init.js');
    await initializeFullApp(app);
    
    initialized = true;
    const elapsed = Date.now() - startTime;
    console.log(`[App Init] ✅ Application initialized in ${elapsed}ms`);
    
    setTimeout(() => {
      startBackgroundServices();
    }, 5000);
    
  } catch (error) {
    console.error('[App Init] ❌ Failed to initialize:', error);
    throw error;
  }
}

async function startBackgroundServices(): Promise<void> {
  if (backgroundServicesStarted) {
    console.log('[Background Services] Already started, skipping');
    return;
  }
  
  console.log('[Background Services] Starting deferred background services...');
  
  try {
    const { startCampaignExecutor } = await import('./lib/campaign-executor-starter.js');
    startCampaignExecutor();
    
    // DISABLED: Session keep-alive was causing SIGHUP crashes and server stability issues
    // const { startSessionKeepAlive } = await import('./lib/session-keepalive-starter.js');
    // startSessionKeepAlive();
    console.log('[Background Services] Session keep-alive disabled (stability fix)');
    
    const { startChromiumUpdater } = await import('./lib/chromium-updater-starter.js');
    startChromiumUpdater();
    
    backgroundServicesStarted = true;
    console.log('[Background Services] ✅ All background services started');
  } catch (error) {
    console.error('[Background Services] ❌ Failed to start:', error);
  }
}
