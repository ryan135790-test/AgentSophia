import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ConnectorService } from "@/lib/connector-service";
import { getOffice365Config, disconnectOffice365, saveOffice365ConfigSync } from "@/lib/office365-auth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Linkedin, Mail, Calendar, CheckCircle, XCircle, AlertCircle,
  ExternalLink, Loader2, Shield, Plug, User, Trash2, Settings, Play
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LinkedInSessionCapture, LinkedInSessionHealth } from "@/components/linkedin/linkedin-session-capture";
import { LinkedInAccountSwitcher } from "@/components/linkedin/LinkedInAccountSwitcher";
import { useLinkedInAccount } from "@/contexts/LinkedInAccountContext";
import { LinkedInSafetyStatus, LinkedInSafetyBadge } from "@/components/linkedin/LinkedInSafetyStatus";
import type { UserLinkedInSettings } from "../../shared/schema";

interface ConnectionStatus {
  id: string;
  name: string;
  description: string;
  icon: JSX.Element;
  iconBg: string;
  connected: boolean;
  connectedAs?: string;
  actions: string[];
  onConnect: () => void;
  onDisconnect: () => void;
  loading?: boolean;
}

export default function MyConnections() {
  const { toast } = useToast();
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { refreshAccounts: refreshLinkedInAccounts, currentAccountId } = useLinkedInAccount();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [outlookConfig, setOutlookConfig] = useState<any>(null);
  const [sessionCaptureOpen, setSessionCaptureOpen] = useState(false);
  const [isReauthentication, setIsReauthentication] = useState(false);
  const [showSafetyDetails, setShowSafetyDetails] = useState(false);
  const [testingSession, setTestingSession] = useState(false);
  const [sessionTestResult, setSessionTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  // Handle LinkedIn callback query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const linkedInConnected = params.get('linkedin_connected');
    const linkedInError = params.get('linkedin_error');
    
    if (linkedInConnected === 'true') {
      toast({ title: 'Success', description: 'LinkedIn account connected successfully!' });
      window.history.replaceState({}, '', '/my-connections');
      refetchLinkedIn();
      refreshLinkedInAccounts();
    } else if (linkedInError) {
      toast({ 
        title: 'Connection Failed', 
        description: decodeURIComponent(linkedInError),
        variant: 'destructive' 
      });
      window.history.replaceState({}, '', '/my-connections');
    }
  }, [location.search]);

  // Per-user LinkedIn Puppeteer session (for Agent Sophia automation)
  const { data: linkedInData, refetch: refetchLinkedIn } = useQuery({
    queryKey: ['linkedin-puppeteer-session', workspaceId, currentAccountId],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { connected: false, connection: null };
        if (!workspaceId) return { connected: false, connection: null };
        
        // FIRST: Check linkedin_puppeteer_settings (where auto-login saves cookies)
        const { data: puppeteerSettings, error: puppeteerError } = await supabase
          .from('linkedin_puppeteer_settings')
          .select('session_captured_at, is_active, profile_name, session_cookies_encrypted')
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        
        if (!puppeteerError && puppeteerSettings?.session_cookies_encrypted) {
          const capturedDate = puppeteerSettings.session_captured_at 
            ? new Date(puppeteerSettings.session_captured_at).toLocaleDateString()
            : 'recently';
          return { 
            connected: true, 
            connection: {
              profile_data: {
                name: puppeteerSettings.profile_name || `Session captured ${capturedDate}`,
                captured_at: puppeteerSettings.session_captured_at
              }
            }
          };
        }

        // SECOND: Query user_linkedin_settings for Puppeteer session (scoped to user + workspace)
        const { data: settings, error } = await supabase
          .from('user_linkedin_settings')
          .select('session_captured_at, is_active, profile_name, profile_url, session_cookies_encrypted')
          .eq('user_id', session.user.id)
          .eq('workspace_id', workspaceId)
          .maybeSingle();
        
        if (error) {
          console.error('Error fetching LinkedIn session:', error);
          return { connected: false, connection: null };
        }
        
        // Check if session cookies exist (meaning session was captured)
        if (settings?.session_cookies_encrypted) {
          const capturedDate = settings.session_captured_at 
            ? new Date(settings.session_captured_at).toLocaleDateString()
            : 'recently';
          return { 
            connected: true, 
            connection: {
              profile_data: {
                name: settings.profile_name || `Session captured ${capturedDate}`,
                captured_at: settings.session_captured_at
              }
            }
          };
        }
        return { connected: false, connection: null };
      } catch (error) {
        console.error('Failed to fetch LinkedIn session:', error);
        return { connected: false, connection: null };
      }
    },
    enabled: !!workspaceId,
  });

  const { data: connectorConfig, refetch: refetchConnector } = useQuery({
    queryKey: ['connector-config', workspaceId],
    queryFn: async () => {
      return ConnectorService.getUserConfig(workspaceId);
    },
    enabled: !!workspaceId,
  });

  const { data: linkedInSettings } = useQuery<UserLinkedInSettings | null>({
    queryKey: ['linkedin-safety-settings', workspaceId, currentAccountId],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        
        const params = new URLSearchParams();
        if (workspaceId) params.set('workspace_id', workspaceId);
        if (currentAccountId) params.set('account_id', currentAccountId);
        
        const res = await fetch(`/api/linkedin/safety-status?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.settings || null;
      } catch (error) {
        console.error('Failed to fetch LinkedIn safety settings:', error);
        return null;
      }
    },
    enabled: linkedInData?.connected === true,
  });

  // Check Gmail connection from connected_social_accounts table (where server saves tokens)
  const { data: gmailAccount, refetch: refetchGmailAccount } = useQuery({
    queryKey: ['gmail-connected-account'],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;
        
        // Note: connected_social_accounts table uses 'platform' column, not 'provider'
        // Gmail connections are handled separately through Google OAuth/Calendar integration
        // This query is deprecated - Gmail status comes from calendarStatus/gmailTokens
        return null;
      } catch (error) {
        console.error('Failed to fetch Gmail account:', error);
        return null;
      }
    },
  });

  // Check Google Calendar connection status
  const { data: calendarStatus, refetch: refetchCalendar } = useQuery({
    queryKey: ['google-calendar-status'],
    queryFn: async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return { connected: false };
        
        const res = await fetch('/api/oauth/google-calendar/status', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        if (!res.ok) return { connected: false };
        return await res.json();
      } catch (error) {
        console.error('Failed to fetch calendar status:', error);
        return { connected: false };
      }
    },
  });

  useEffect(() => {
    const loadEmailConfigs = async () => {
      if (!workspaceId) return;
      const outlook = await getOffice365Config(workspaceId);
      setOutlookConfig(outlook);
    };
    loadEmailConfigs();
  }, [workspaceId]);

  useEffect(() => {
    const handleOAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      // Handle Gmail OAuth success
      if (event.data.type === 'gmail_oauth_success') {
        const tokenData = event.data.data;
        setConnectingId(null);
        
        // Convert expiresAt string to Unix timestamp (milliseconds)
        const expiryTimestamp = tokenData.expiresAt 
          ? new Date(tokenData.expiresAt).getTime() 
          : Date.now() + 3600000;
        
        // Save to ConnectorService (workspace-scoped)
        try {
          await ConnectorService.saveUserConfig({
            emailProvider: 'gmail',
            emailAccessToken: tokenData.accessToken,
            emailRefreshToken: tokenData.refreshToken,
            emailTokenExpiry: expiryTimestamp,
            emailUserEmail: tokenData.email,
          }, workspaceId);
        } catch (err) {
          console.error('Failed to save Gmail config:', err);
        }
        
        toast({
          title: 'Gmail Connected!',
          description: `Connected as ${tokenData.email}`,
        });
        
        // Refetch both queries to update UI
        refetchConnector();
        refetchGmailAccount();
        return;
      }
      
      // Handle Gmail OAuth error
      if (event.data.type === 'gmail_oauth_error') {
        setConnectingId(null);
        toast({
          title: 'Gmail Connection Failed',
          description: event.data.error || 'Failed to connect Gmail',
          variant: 'destructive',
        });
        return;
      }
      
      if (event.data.type === 'office365_connected') {
        const tokenData = event.data.data;
        saveOffice365ConfigSync(tokenData, workspaceId);
        
        // Convert expiresAt string to Unix timestamp
        const expiryTimestamp = tokenData.expiresAt 
          ? new Date(tokenData.expiresAt).getTime() 
          : Date.now() + 3600000;
        
        ConnectorService.saveUserConfig({
          emailProvider: 'outlook',
          emailAccessToken: tokenData.accessToken,
          emailRefreshToken: tokenData.refreshToken,
          emailTokenExpiry: expiryTimestamp,
          emailUserEmail: tokenData.email,
        }, workspaceId).catch(console.error);
        
        setOutlookConfig(tokenData);
        toast({ title: 'Connected', description: `Office 365 connected as ${tokenData.email}` });
        refetchConnector();
        setConnectingId(null);
      } else if (event.data.type === 'office365_error') {
        toast({ 
          title: 'Connection Failed', 
          description: event.data.error || 'Failed to connect Office 365',
          variant: 'destructive'
        });
        setConnectingId(null);
      }
      
      // Handle Google Calendar OAuth success
      if (event.data.type === 'calendar_oauth_success') {
        const calendarData = event.data.data;
        setConnectingId(null);
        toast({
          title: 'Google Calendar Connected!',
          description: `Connected as ${calendarData.email}. Sophia can now book real meetings for you.`,
        });
        refetchCalendar();
        return;
      }
      
      // Handle Google Calendar OAuth error
      if (event.data.type === 'calendar_oauth_error') {
        setConnectingId(null);
        toast({
          title: 'Calendar Connection Failed',
          description: event.data.error || 'Failed to connect Google Calendar',
          variant: 'destructive',
        });
        return;
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [toast, refetchConnector, refetchGmailAccount, refetchCalendar]);

  const handleLinkedInDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Not logged in', variant: 'destructive' });
        return;
      }

      // Clear BOTH tables that store LinkedIn session cookies
      
      // 1. Clear linkedin_puppeteer_settings (workspace-scoped, used by auto-login and manual paste)
      const { error: puppeteerError } = await supabase
        .from('linkedin_puppeteer_settings')
        .update({ 
          session_cookies_encrypted: null,
          session_captured_at: null,
          is_active: false,
          profile_name: null
        })
        .eq('workspace_id', workspaceId);
      
      if (puppeteerError) {
        console.error('Error clearing linkedin_puppeteer_settings:', puppeteerError);
      }
      
      // 2. Clear user_linkedin_settings (user + workspace scoped, legacy)
      const { error: userSettingsError } = await supabase
        .from('user_linkedin_settings')
        .update({ 
          session_cookies_encrypted: null,
          session_captured_at: null,
          is_active: false
        })
        .eq('user_id', session.user.id)
        .eq('workspace_id', workspaceId);
      
      if (userSettingsError) {
        console.error('Error clearing user_linkedin_settings:', userSettingsError);
      }
      
      toast({ title: 'Disconnected', description: 'LinkedIn session disconnected' });
      setSessionTestResult(null);
      refetchLinkedIn();
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to disconnect', 
        variant: 'destructive' 
      });
    }
  };

  const handleTestLinkedInSession = async () => {
    if (!workspaceId) {
      toast({ title: 'Error', description: 'No workspace selected', variant: 'destructive' });
      return;
    }
    
    setTestingSession(true);
    setSessionTestResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Error', description: 'Not logged in', variant: 'destructive' });
        return;
      }
      
      const res = await fetch('/api/linkedin-automation/test-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ workspace_id: workspaceId }),
      });
      
      const data = await res.json();
      
      if (data.valid) {
        setSessionTestResult({ valid: true, message: data.message });
        toast({ 
          title: 'Session Valid', 
          description: data.message,
        });
      } else {
        setSessionTestResult({ valid: false, message: data.error });
        toast({ 
          title: 'Session Invalid', 
          description: data.error,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      const message = error.message || 'Failed to test session';
      setSessionTestResult({ valid: false, message });
      toast({ title: 'Test Failed', description: message, variant: 'destructive' });
    } finally {
      setTestingSession(false);
    }
  };

  const handleGmailConnect = async () => {
    setConnectingId('gmail');
    
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast({
        title: 'Configuration Required',
        description: 'Gmail OAuth is not configured. Contact your administrator.',
        variant: 'destructive'
      });
      setConnectingId(null);
      return;
    }

    try {
      // Get auth token for the server endpoint
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Not Logged In',
          description: 'Please log in to connect your Gmail account.',
          variant: 'destructive'
        });
        setConnectingId(null);
        return;
      }

      // Use authorization code flow with server-side token exchange
      const redirectUri = `${window.location.origin}/oauth/gmail/callback`;
      
      // Encode userId and nonce in state for CSRF protection and session persistence
      const statePayload = {
        nonce: crypto.randomUUID(),
        userId: session.user.id,
        timestamp: Date.now()
      };
      const state = btoa(JSON.stringify(statePayload));
      
      // Store state temporarily for validation
      sessionStorage.setItem('gmail_oauth_state', state);

      const scopes = [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ].join(' ');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scopes)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${state}`;

      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      window.open(authUrl, 'Gmail Authorization', `width=${width},height=${height},left=${left},top=${top}`);
    } catch (error) {
      console.error('Gmail connect error:', error);
      toast({
        title: 'Error',
        description: 'Failed to start Gmail connection.',
        variant: 'destructive'
      });
      setConnectingId(null);
    }
  };

  const handleGmailDisconnect = async () => {
    try {
      await ConnectorService.saveUserConfig({
        emailProvider: null as any,
        emailAccessToken: undefined,
        emailRefreshToken: undefined,
        emailTokenExpiry: undefined,
        emailUserEmail: undefined,
      }, workspaceId);
      toast({ title: 'Disconnected', description: 'Gmail account disconnected' });
      refetchConnector();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to disconnect Gmail', variant: 'destructive' });
    }
  };

  const handleOutlookConnect = () => {
    setConnectingId('outlook');
    
    const clientId = import.meta.env.VITE_OFFICE365_CLIENT_ID;
    if (!clientId) {
      toast({
        title: 'Configuration Required',
        description: 'Office 365 OAuth is not configured. Contact your administrator.',
        variant: 'destructive'
      });
      setConnectingId(null);
      return;
    }

    const redirectUri = `${window.location.origin}/oauth/office365/callback`;
    const scopes = [
      'User.Read',
      'Mail.Send',
      'Mail.Read',
      'Calendars.ReadWrite',
      'Contacts.ReadWrite',
      'offline_access'
    ].join(' ');

    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_mode=query`;

    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(authUrl, 'Office 365 Authorization', `width=${width},height=${height},left=${left},top=${top}`);
  };

  const handleOutlookDisconnect = async () => {
    try {
      await disconnectOffice365(workspaceId);
      await ConnectorService.saveUserConfig({
        emailProvider: null as any,
        emailAccessToken: undefined,
        emailRefreshToken: undefined,
        emailTokenExpiry: undefined,
        emailUserEmail: undefined,
      }, workspaceId);
      setOutlookConfig(null);
      toast({ title: 'Disconnected', description: 'Office 365 account disconnected' });
      refetchConnector();
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to disconnect Outlook', variant: 'destructive' });
    }
  };

  const handleCalendarConnect = async () => {
    setConnectingId('calendar');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: 'Not Logged In',
          description: 'Please log in to connect your Google Calendar.',
          variant: 'destructive'
        });
        setConnectingId(null);
        return;
      }

      // Get the OAuth URL from the backend
      const res = await fetch('/api/oauth/google-calendar/connect', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to initiate connection');
      }
      
      const data = await res.json();
      if (!data.authUrl) {
        throw new Error('Failed to get authorization URL');
      }
      
      // Open the Google auth URL in a popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      window.open(data.authUrl, 'Google Calendar Authorization', `width=${width},height=${height},left=${left},top=${top}`);
      
      // Message handler will handle the result and reset connectingId
    } catch (error: any) {
      console.error('Calendar connect error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start calendar connection.',
        variant: 'destructive'
      });
      setConnectingId(null);
    }
  };

  const handleCalendarDisconnect = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/oauth/google-calendar/disconnect', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (res.ok) {
        toast({ title: 'Disconnected', description: 'Google Calendar disconnected' });
        refetchCalendar();
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to disconnect calendar', variant: 'destructive' });
    }
  };

  // Gmail connection from connected_social_accounts table (primary) or connector_configs (fallback)
  const gmailConnected = !!gmailAccount?.access_token || (connectorConfig?.emailProvider === 'gmail' && !!connectorConfig?.emailAccessToken);
  const gmailEmail = gmailAccount?.email || connectorConfig?.emailUserEmail;

  // LinkedIn Puppeteer session connection (for Agent Sophia automation)
  const linkedInConnected = linkedInData?.connected === true;
  const linkedInProfileName = linkedInData?.connection?.profile_data?.name;

  const connections: ConnectionStatus[] = [
    {
      id: 'linkedin',
      name: 'LinkedIn (Agent Sophia)',
      description: 'Connect your LinkedIn for automated outreach, connection requests, and messaging via Agent Sophia',
      icon: <Linkedin className="w-6 h-6 text-sky-600" />,
      iconBg: 'bg-sky-100 dark:bg-sky-900/30',
      connected: linkedInConnected,
      connectedAs: linkedInProfileName,
      actions: ['Send connection requests', 'Send direct messages', 'View profiles', 'Track engagement'],
      onConnect: () => {
        setIsReauthentication(false);
        setSessionCaptureOpen(true);
      },
      onDisconnect: handleLinkedInDisconnect,
      loading: connectingId === 'linkedin',
    },
    {
      id: 'gmail',
      name: 'Gmail',
      description: 'Connect your Gmail account to send and receive campaign emails',
      icon: <Mail className="w-6 h-6 text-red-500" />,
      iconBg: 'bg-red-100 dark:bg-red-900/30',
      connected: gmailConnected,
      connectedAs: gmailEmail,
      actions: ['Send emails', 'Receive replies', 'Track opens and clicks', 'Sync contacts'],
      onConnect: handleGmailConnect,
      onDisconnect: handleGmailDisconnect,
      loading: connectingId === 'gmail',
    },
    {
      id: 'outlook',
      name: 'Office 365 / Outlook',
      description: 'Connect your Microsoft account to send and receive campaign emails',
      icon: <Mail className="w-6 h-6 text-blue-600" />,
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      connected: !!outlookConfig?.accessToken,
      connectedAs: outlookConfig?.email,
      actions: ['Send emails', 'Receive replies', 'Calendar sync', 'Microsoft Teams integration'],
      onConnect: handleOutlookConnect,
      onDisconnect: handleOutlookDisconnect,
      loading: connectingId === 'outlook',
    },
    {
      id: 'calendar',
      name: 'Google Calendar (Sophia Managed)',
      description: 'Let Sophia book real meetings on your calendar - no Calendly needed',
      icon: <Calendar className="w-6 h-6 text-green-600" />,
      iconBg: 'bg-green-100 dark:bg-green-900/30',
      connected: calendarStatus?.connected === true,
      connectedAs: calendarStatus?.email,
      actions: ['Auto-book meetings', 'Check real availability', 'Create Google Meet links', 'Send calendar invites'],
      onConnect: handleCalendarConnect,
      onDisconnect: handleCalendarDisconnect,
      loading: connectingId === 'calendar',
    },
  ];

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Plug className="w-8 h-8 text-primary" />
              </div>
              My Connections
            </h1>
            <p className="text-muted-foreground mt-2">
              Connect your personal accounts to enable multi-channel outreach
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LinkedInAccountSwitcher />
          </div>
        </div>

      <LinkedInSessionHealth 
        onReauthenticate={() => {
          setIsReauthentication(true);
          setSessionCaptureOpen(true);
        }}
        accountId={currentAccountId}
      />

      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>Secure OAuth Connections</strong> - Your credentials are encrypted and we use industry-standard OAuth. 
          We never store your passwords.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {connections.map((connection) => (
          <Card key={connection.id} className={connection.connected ? 'border-green-200 dark:border-green-800' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    connection.connected 
                      ? 'bg-green-100 dark:bg-green-900/30' 
                      : connection.iconBg
                  }`}>
                    {connection.icon}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{connection.name}</h3>
                      {connection.connected ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {connection.description}
                    </p>
                    {connection.connected && connection.connectedAs && (
                      <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Connected as: <strong>{connection.connectedAs}</strong>
                      </p>
                    )}
                    {connection.id === 'linkedin' && connection.connected && sessionTestResult && (
                      <p className={`text-sm flex items-center gap-1 ${sessionTestResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                        {sessionTestResult.valid ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {sessionTestResult.message}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {connection.actions.map((action, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {action}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  {connection.id === 'linkedin' ? (
                    <>
                      <Badge variant="outline" className="text-xs flex items-center">
                        <Shield className="w-3 h-3 mr-1" />
                        Proxy auto-assigned
                      </Badge>
                      {connection.connected ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleTestLinkedInSession}
                            disabled={testingSession}
                            data-testid="btn-test-linkedin-session"
                          >
                            {testingSession ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4 mr-2" />
                            )}
                            {testingSession ? 'Testing...' : 'Test Session'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={connection.onDisconnect}
                            disabled={connection.loading}
                            data-testid="btn-disconnect-linkedin"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => setSessionCaptureOpen(true)}
                          data-testid="btn-connect-linkedin"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Connect
                        </Button>
                      )}
                    </>
                  ) : connection.connected ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={connection.onDisconnect}
                      disabled={connection.loading}
                      data-testid={`btn-disconnect-${connection.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      onClick={connection.onConnect}
                      disabled={connection.loading}
                      data-testid={`btn-connect-${connection.id}`}
                    >
                      {connection.loading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <ExternalLink className="w-4 h-4 mr-2" />
                      )}
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {linkedInConnected && linkedInSettings && (
        <Card data-testid="card-linkedin-safety">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                LinkedIn Safety Controls
              </CardTitle>
              <div className="flex items-center gap-2">
                <LinkedInSafetyBadge settings={linkedInSettings} />
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowSafetyDetails(!showSafetyDetails)}
                  data-testid="btn-toggle-safety-details"
                >
                  {showSafetyDetails ? 'Hide Details' : 'Show Details'}
                </Button>
              </div>
            </div>
            <CardDescription>
              Comprehensive safety features protect your LinkedIn account from restrictions
            </CardDescription>
          </CardHeader>
          {showSafetyDetails && (
            <CardContent>
              <LinkedInSafetyStatus settings={linkedInSettings} />
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Need Help Connecting?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">LinkedIn Connection</h4>
              <p className="text-sm text-muted-foreground">
                Sign in with your LinkedIn credentials. We'll securely connect your account for sending 
                connection requests and messages through your campaigns.
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Email Connection</h4>
              <p className="text-sm text-muted-foreground">
                Connect Gmail or Office 365 to send campaign emails directly from your email address, 
                with full tracking and reply detection.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Having trouble? Contact your administrator or check our help documentation.
          </p>
        </CardContent>
      </Card>
      </div>

      <LinkedInSessionCapture
        open={sessionCaptureOpen}
        onOpenChange={(open) => {
          setSessionCaptureOpen(open);
          if (!open) setIsReauthentication(false);
        }}
        onSessionCaptured={() => {
          refetchLinkedIn();
          toast({
            title: isReauthentication ? "Session Refreshed" : "LinkedIn Connected",
            description: isReauthentication 
              ? "Your LinkedIn session has been refreshed successfully."
              : "Your LinkedIn is now connected for automation."
          });
        }}
        isReauthentication={isReauthentication}
      />
    </div>
  );
}
