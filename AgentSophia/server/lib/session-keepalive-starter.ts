let started = false;

export function startSessionKeepAlive(): void {
  if (started) {
    console.log('[Session KeepAlive] Already started');
    return;
  }
  
  console.log(`[Session KeepAlive] Starting session keep-alive service...`);
  console.log(`[Session KeepAlive] Ping interval: 240 minutes`);
  
  import('./linkedin-session-keepalive.js').then(module => {
    module.startSessionKeepAlive();
  }).catch(error => {
    console.error('[Session KeepAlive] Error starting:', error);
  });
  
  started = true;
  console.log('✅ LinkedIn Session Keep-Alive service started (auto-refresh every 4 hours)');
}

export function stopSessionKeepAlive(): void {
  import('./linkedin-session-keepalive.js').then(module => {
    module.stopSessionKeepAlive();
    started = false;
    console.log('[Session KeepAlive] Stopped');
  }).catch(error => {
    console.error('[Session KeepAlive] Error stopping:', error);
  });
}
