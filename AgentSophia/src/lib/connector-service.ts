// Service for managing user-specific connector configurations
// Uses Supabase for multi-tenant SaaS storage with RLS
// Now workspace-scoped: each user+workspace combination has its own config

import { supabase } from '@/integrations/supabase/client';

export interface ConnectorConfig {
  // Email
  emailProvider?: 'sendgrid' | 'resend' | 'smtp' | 'gmail' | 'outlook';
  emailApiKey?: string;
  emailFromEmail?: string;
  emailFromName?: string;
  emailSmtpHost?: string;
  emailSmtpPort?: string;
  emailSmtpUser?: string;
  emailSmtpPassword?: string;
  emailAccessToken?: string;
  emailRefreshToken?: string;
  emailTokenExpiry?: number;
  emailUserEmail?: string;
  
  // SMS
  smsProvider?: 'twilio' | 'vonage';
  smsAccountSid?: string;
  smsAuthToken?: string;
  smsFromNumber?: string;
  
  // Phone
  phoneProvider?: 'twilio' | 'elevenlabs';
  phoneAccountSid?: string;
  phoneAuthToken?: string;
  phoneVoiceId?: string;
  
  // LinkedIn
  linkedinAccessToken?: string;
  linkedinConnected?: boolean;
  
  // Social
  twitterAccessToken?: string;
  twitterConnected?: boolean;
  facebookAccessToken?: string;
  facebookConnected?: boolean;
  instagramAccessToken?: string;
  instagramConnected?: boolean;
}

/**
 * Get the current workspace ID from localStorage
 */
function getCurrentWorkspaceId(): string | null {
  return localStorage.getItem('current-workspace-id');
}

export class ConnectorService {
  /**
   * Get the current user's connector configuration for a specific workspace
   * Returns null if no config exists, user is not authenticated, or no workspace
   * Gracefully falls back to user-only query if workspace_id column doesn't exist yet
   */
  static async getUserConfig(workspaceId?: string): Promise<ConnectorConfig | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn('ConnectorService: User not authenticated');
      return null;
    }

    const wsId = workspaceId || getCurrentWorkspaceId();
    if (!wsId) {
      console.warn('ConnectorService: No workspace context available');
      return null;
    }
    
    // Build query - try workspace-scoped first, fallback to user-only
    let data: any = null;
    let error: any = null;
    
    // Try workspace-scoped query first
    const result = await supabase
      .from('connector_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', wsId)
      .maybeSingle();
    
    data = result.data;
    error = result.error;
    
    // If workspace_id column doesn't exist (42703 = column not found), fall back to user-only query
    if (error?.code === '42703' || (error?.message && error.message.includes('workspace_id'))) {
      console.warn('ConnectorService: workspace_id column not found, falling back to user-only query');
      const fallbackResult = await supabase
        .from('connector_configs')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      data = fallbackResult.data;
      error = fallbackResult.error;
    }

    if (error && error.code !== 'PGRST116' && error.code !== '42703') {
      // PGRST116 = no rows found (expected for new users)
      console.error('Error fetching connector config:', error);
      return null; // Gracefully return null instead of throwing
    }

    if (!data) return null;

    // Map database columns to camelCase
    return {
      emailProvider: data.email_provider as any,
      emailApiKey: data.email_api_key || undefined,
      emailFromEmail: data.email_from_email || undefined,
      emailFromName: data.email_from_name || undefined,
      emailSmtpHost: data.email_smtp_host || undefined,
      emailSmtpPort: data.email_smtp_port || undefined,
      emailSmtpUser: data.email_smtp_user || undefined,
      emailSmtpPassword: data.email_smtp_password || undefined,
      emailAccessToken: data.email_access_token || undefined,
      emailRefreshToken: data.email_refresh_token || undefined,
      emailTokenExpiry: data.email_token_expiry || undefined,
      emailUserEmail: data.email_user_email || undefined,
      
      smsProvider: data.sms_provider as any,
      smsAccountSid: data.sms_account_sid || undefined,
      smsAuthToken: data.sms_auth_token || undefined,
      smsFromNumber: data.sms_from_number || undefined,
      
      phoneProvider: data.phone_provider as any,
      phoneAccountSid: data.phone_account_sid || undefined,
      phoneAuthToken: data.phone_auth_token || undefined,
      phoneVoiceId: data.phone_voice_id || undefined,
      
      linkedinAccessToken: data.linkedin_access_token || undefined,
      linkedinConnected: data.linkedin_connected || false,
      
      twitterAccessToken: data.twitter_access_token || undefined,
      twitterConnected: data.twitter_connected || false,
      facebookAccessToken: data.facebook_access_token || undefined,
      facebookConnected: data.facebook_connected || false,
      instagramAccessToken: data.instagram_access_token || undefined,
      instagramConnected: data.instagram_connected || false,
    };
  }

  /**
   * Save or update the user's connector configuration for a specific workspace
   * Uses upsert to create or update as needed
   * Falls back to user-only upsert if workspace_id column doesn't exist
   * Throws if user not authenticated or no workspace available
   */
  static async saveUserConfig(config: ConnectorConfig, workspaceId?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const wsId = workspaceId || getCurrentWorkspaceId();
    if (!wsId) throw new Error('No workspace context available');

    // Map camelCase to database snake_case (with workspace_id)
    const dbConfigWithWorkspace: Record<string, any> = {
      user_id: user.id,
      workspace_id: wsId,
      email_provider: config.emailProvider || null,
      email_api_key: config.emailApiKey || null,
      email_from_email: config.emailFromEmail || null,
      email_from_name: config.emailFromName || null,
      email_smtp_host: config.emailSmtpHost || null,
      email_smtp_port: config.emailSmtpPort || null,
      email_smtp_user: config.emailSmtpUser || null,
      email_smtp_password: config.emailSmtpPassword || null,
      email_access_token: config.emailAccessToken || null,
      email_refresh_token: config.emailRefreshToken || null,
      email_token_expiry: config.emailTokenExpiry || null,
      email_user_email: config.emailUserEmail || null,
      
      sms_provider: config.smsProvider || null,
      sms_account_sid: config.smsAccountSid || null,
      sms_auth_token: config.smsAuthToken || null,
      sms_from_number: config.smsFromNumber || null,
      
      phone_provider: config.phoneProvider || null,
      phone_account_sid: config.phoneAccountSid || null,
      phone_auth_token: config.phoneAuthToken || null,
      phone_voice_id: config.phoneVoiceId || null,
      
      linkedin_access_token: config.linkedinAccessToken || null,
      linkedin_connected: config.linkedinConnected || false,
      
      twitter_access_token: config.twitterAccessToken || null,
      twitter_connected: config.twitterConnected || false,
      facebook_access_token: config.facebookAccessToken || null,
      facebook_connected: config.facebookConnected || false,
      instagram_access_token: config.instagramAccessToken || null,
      instagram_connected: config.instagramConnected || false,
    };

    // Try workspace-scoped upsert first
    let { error } = await supabase
      .from('connector_configs')
      .upsert(dbConfigWithWorkspace, {
        onConflict: 'user_id,workspace_id',
      });

    // If workspace_id column doesn't exist (42703 = column not found), fall back to user-only upsert
    if (error?.code === '42703' || (error?.message && error.message.includes('workspace_id'))) {
      console.warn('ConnectorService: workspace_id column not found, falling back to user-only upsert');
      const dbConfigUserOnly = { ...dbConfigWithWorkspace };
      delete dbConfigUserOnly.workspace_id;
      
      const fallbackResult = await supabase
        .from('connector_configs')
        .upsert(dbConfigUserOnly, {
          onConflict: 'user_id',
        });
      error = fallbackResult.error;
    }

    if (error && error.code !== '42703') {
      console.error('Error saving connector config:', error);
      throw error;
    }
  }

  /**
   * Delete the user's connector configuration for a specific workspace
   * Falls back to user-only delete if workspace_id column doesn't exist
   * Throws if user not authenticated or no workspace available
   */
  static async deleteUserConfig(workspaceId?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const wsId = workspaceId || getCurrentWorkspaceId();
    if (!wsId) throw new Error('No workspace context available');
    
    // Try workspace-scoped delete first
    let { error } = await supabase
      .from('connector_configs')
      .delete()
      .eq('user_id', user.id)
      .eq('workspace_id', wsId);

    // If workspace_id column doesn't exist (42703 = column not found), fall back to user-only delete
    if (error?.code === '42703' || (error?.message && error.message.includes('workspace_id'))) {
      console.warn('ConnectorService: workspace_id column not found, falling back to user-only delete');
      const fallbackResult = await supabase
        .from('connector_configs')
        .delete()
        .eq('user_id', user.id);
      error = fallbackResult.error;
    }

    if (error) {
      console.error('Error deleting connector config:', error);
      throw error;
    }
  }
}
