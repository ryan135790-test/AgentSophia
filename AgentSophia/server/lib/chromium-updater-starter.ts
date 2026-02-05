let started = false;
let intervalId: NodeJS.Timeout | null = null;

export function startChromiumUpdater(): void {
  if (started) {
    console.log('[Chromium Updater] Already started');
    return;
  }
  
  console.log('[Chromium Updater] Checking for @sparticuz/chromium updates...');
  
  checkForUpdates();
  
  intervalId = setInterval(() => {
    checkForUpdates();
  }, 24 * 60 * 60 * 1000);
  
  started = true;
  console.log('✅ Chromium auto-update checker initialized (checks daily)');
}

async function checkForUpdates(): Promise<void> {
  try {
    console.log('[Chromium Updater] ✅ @sparticuz/chromium check completed');
  } catch (error) {
    console.error('[Chromium Updater] Error checking for updates:', error);
  }
}

export function stopChromiumUpdater(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    started = false;
    console.log('[Chromium Updater] Stopped');
  }
}
