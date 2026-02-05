/**
 * Office 365 Token Management
 * Handles automatic token refresh to keep users connected
 * Syncs tokens between localStorage (fast) and database (persistent)
 * Now workspace-scoped: each workspace has its own email connection
 */

import { supabase } from "@/integrations/supabase/client";
import { ConnectorService } from "./connector-service";

export interface Office365Config {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
  displayName: string;
}

const STORAGE_KEY_PREFIX = 'office365_config';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

/**
 * Get the workspace-scoped storage key
 * Requires workspaceId to ensure proper isolation between workspaces
 */
function getStorageKey(workspaceId: string | undefined): string | null {
  if (!workspaceId) {
    console.warn('Office365: No workspaceId provided, cannot get storage key');
    return null;
  }
  return `${STORAGE_KEY_PREFIX}_${workspaceId}`;
}

/**
 * Get the stored Office 365 config for a specific workspace
 * Checks localStorage first, then database if not found
 * Returns null if no workspaceId provided or no config found
 */
export async function getOffice365Config(workspaceId?: string): Promise<Office365Config | null> {
  const storageKey = getStorageKey(workspaceId);
  if (!storageKey) return null; // No workspace context
  
  // Try localStorage first (fast)
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      // Invalid JSON, clear it
      localStorage.removeItem(storageKey);
    }
  }
  
  // If not in localStorage, try loading from database
  try {
    const config = await ConnectorService.getUserConfig(workspaceId);
    if (config?.emailProvider === 'outlook' && 
        config.emailAccessToken && 
        config.emailRefreshToken && 
        config.emailTokenExpiry &&
        config.emailUserEmail) {
      
      // Reconstruct Office365Config from database
      const office365Config: Office365Config = {
        accessToken: config.emailAccessToken,
        refreshToken: config.emailRefreshToken,
        expiresAt: config.emailTokenExpiry,
        email: config.emailUserEmail,
        displayName: config.emailUserEmail.split('@')[0], // Extract name from email
      };
      
      // Save to localStorage for faster future access
      saveOffice365ConfigToLocalStorage(office365Config, workspaceId);
      console.log('✅ Loaded Office 365 config from database for workspace');
      
      return office365Config;
    }
  } catch (error) {
    console.error('Failed to load Office 365 config from database:', error);
  }
  
  return null;
}

/**
 * Synchronous version for compatibility (checks localStorage only)
 * Returns null if no workspaceId provided
 */
export function getOffice365ConfigSync(workspaceId?: string): Office365Config | null {
  const storageKey = getStorageKey(workspaceId);
  if (!storageKey) return null; // No workspace context
  
  const saved = localStorage.getItem(storageKey);
  if (!saved) return null;
  
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

/**
 * Save Office 365 config to localStorage only (internal helper)
 * Does nothing if workspaceId is not provided
 */
function saveOffice365ConfigToLocalStorage(config: Office365Config, workspaceId?: string): void {
  const storageKey = getStorageKey(workspaceId);
  if (!storageKey) {
    console.warn('Office365: Cannot save config without workspaceId');
    return;
  }
  localStorage.setItem(storageKey, JSON.stringify(config));
}

/**
 * Save Office 365 config to both localStorage and database
 */
export async function saveOffice365Config(config: Office365Config, workspaceId?: string): Promise<void> {
  // Save to localStorage (immediate access)
  saveOffice365ConfigToLocalStorage(config, workspaceId);
  
  // Also save to database (persistent storage)
  try {
    await ConnectorService.saveUserConfig({
      emailProvider: 'outlook',
      emailAccessToken: config.accessToken,
      emailRefreshToken: config.refreshToken,
      emailTokenExpiry: config.expiresAt,
      emailUserEmail: config.email,
    }, workspaceId);
    console.log('✅ Saved Office 365 tokens to database for workspace');
  } catch (error) {
    console.error('Failed to save Office 365 tokens to database:', error);
    // Continue anyway - tokens are in localStorage
  }
}

/**
 * Synchronous version for localStorage only (for backwards compatibility)
 */
export function saveOffice365ConfigSync(config: Office365Config, workspaceId?: string): void {
  saveOffice365ConfigToLocalStorage(config, workspaceId);
}

/**
 * Check if the access token is expired or about to expire
 */
export function isTokenExpired(config: Office365Config): boolean {
  return Date.now() + REFRESH_BUFFER_MS >= config.expiresAt;
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(config: Office365Config, workspaceId?: string): Promise<Office365Config> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(`${supabaseUrl}/functions/v1/office365-refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({
        refreshToken: config.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to refresh token');
    }

    const data = await response.json();

    // Update config with new tokens
    const newConfig: Office365Config = {
      ...config,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || config.refreshToken, // Use new refresh token if provided
      expiresAt: Date.now() + (data.expires_in * 1000),
    };

    // Save updated config
    await saveOffice365Config(newConfig, workspaceId);

    console.log('✅ Office 365 token refreshed successfully');
    return newConfig;
  } catch (error) {
    console.error('Failed to refresh Office 365 token:', error);
    throw error;
  }
}

/**
 * Get a valid access token, automatically refreshing if needed
 */
export async function getValidAccessToken(workspaceId?: string): Promise<string | null> {
  const config = await getOffice365Config(workspaceId);
  
  if (!config) {
    return null;
  }

  // If token is expired or about to expire, refresh it
  if (isTokenExpired(config)) {
    console.log('🔄 Access token expired, refreshing...');
    try {
      const newConfig = await refreshAccessToken(config, workspaceId);
      return newConfig.accessToken;
    } catch (error) {
      console.error('Token refresh failed, user needs to reconnect:', error);
      // Clear invalid config from both sources
      disconnectOffice365(workspaceId);
      return null;
    }
  }

  return config.accessToken;
}

/**
 * Disconnect Office 365 for a specific workspace
 * Does nothing if workspaceId is not provided
 */
export async function disconnectOffice365(workspaceId?: string): Promise<void> {
  const storageKey = getStorageKey(workspaceId);
  if (!storageKey) {
    console.warn('Office365: Cannot disconnect without workspaceId');
    return;
  }
  localStorage.removeItem(storageKey);
  
  // Also clear from database
  try {
    await ConnectorService.saveUserConfig({
      emailProvider: undefined as any,
      emailAccessToken: undefined,
      emailRefreshToken: undefined,
      emailTokenExpiry: undefined,
      emailUserEmail: undefined,
    }, workspaceId);
  } catch (error) {
    console.error('Failed to clear Office 365 config from database:', error);
  }
}

/**
 * Clear all workspace email configs from localStorage (for logout)
 */
export function clearAllOffice365Configs(): void {
  // Get all localStorage keys that start with the prefix
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
