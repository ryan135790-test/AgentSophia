import { execSync } from 'child_process';

const PACKAGE_NAME = '@sparticuz/chromium';
const CHECK_INTERVAL_HOURS = 24;

let lastCheckTime: number = 0;
let cachedUpdateInfo: { hasUpdate: boolean; currentVersion: string; latestVersion: string } | null = null;

async function getInstalledVersion(): Promise<string | null> {
  try {
    const result = execSync(`npm list ${PACKAGE_NAME} --json 2>/dev/null`, { encoding: 'utf8' });
    const json = JSON.parse(result);
    const version = json.dependencies?.[PACKAGE_NAME]?.version;
    return version || null;
  } catch (e) {
    return null;
  }
}

async function getLatestVersion(): Promise<string | null> {
  try {
    const result = execSync(`npm view ${PACKAGE_NAME} version 2>/dev/null`, { encoding: 'utf8' });
    return result.trim() || null;
  } catch (e) {
    return null;
  }
}

function compareVersions(current: string, latest: string): boolean {
  const currentParts = current.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
    const c = currentParts[i] || 0;
    const l = latestParts[i] || 0;
    if (l > c) return true;
    if (c > l) return false;
  }
  return false;
}

export async function checkForChromiumUpdates(): Promise<{ hasUpdate: boolean; currentVersion: string; latestVersion: string }> {
  const now = Date.now();
  
  if (cachedUpdateInfo && (now - lastCheckTime) < CHECK_INTERVAL_HOURS * 60 * 60 * 1000) {
    return cachedUpdateInfo;
  }
  
  console.log('[Chromium Updater] Checking for @sparticuz/chromium updates...');
  
  const currentVersion = await getInstalledVersion();
  const latestVersion = await getLatestVersion();
  
  if (!currentVersion || !latestVersion) {
    console.log('[Chromium Updater] Could not determine versions');
    return { hasUpdate: false, currentVersion: currentVersion || 'unknown', latestVersion: latestVersion || 'unknown' };
  }
  
  const hasUpdate = compareVersions(currentVersion, latestVersion);
  
  lastCheckTime = now;
  cachedUpdateInfo = { hasUpdate, currentVersion, latestVersion };
  
  if (hasUpdate) {
    console.warn(`[Chromium Updater] ⚠️ UPDATE AVAILABLE: ${PACKAGE_NAME} ${currentVersion} → ${latestVersion}`);
    console.warn(`[Chromium Updater] Run: npm update ${PACKAGE_NAME}`);
  } else {
    console.log(`[Chromium Updater] ✅ ${PACKAGE_NAME} is up to date (v${currentVersion})`);
  }
  
  return cachedUpdateInfo;
}

export async function autoUpdateChromium(): Promise<boolean> {
  const { hasUpdate, latestVersion } = await checkForChromiumUpdates();
  
  if (!hasUpdate) {
    return false;
  }
  
  console.log(`[Chromium Updater] Auto-updating ${PACKAGE_NAME} to v${latestVersion}...`);
  
  try {
    execSync(`npm update ${PACKAGE_NAME}`, { encoding: 'utf8', stdio: 'inherit' });
    console.log(`[Chromium Updater] ✅ Successfully updated to v${latestVersion}`);
    cachedUpdateInfo = null;
    return true;
  } catch (e: any) {
    console.error(`[Chromium Updater] ❌ Failed to update: ${e.message}`);
    return false;
  }
}

export function getUpdateStatus() {
  return cachedUpdateInfo;
}
