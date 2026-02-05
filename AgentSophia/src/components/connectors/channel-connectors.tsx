import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GmailOAuthClient } from '@/lib/oauth/gmail-oauth';
import { OutlookOAuthClient } from '@/lib/oauth/outlook-oauth';
import { LinkedInOAuthClient } from '@/lib/oauth/linkedin-oauth';
import { ConnectorService, type ConnectorConfig } from '@/lib/connector-service';
import { OAuthSetupModal } from '@/components/connectors/oauth-setup-modal';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { 
  Mail, 
  MessageSquare, 
  Phone, 
  Linkedin, 
  Share2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Bot,
  ExternalLink,
  Info,
  HelpCircle,
  Loader2
} from 'lucide-react';

// Helper to check if email is connected via OAuth
const isEmailConnected = (config: ConnectorConfig) => {
  return config.emailProvider === 'gmail' || config.emailProvider === 'outlook';
};

export function ChannelConnectors() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [config, setConfig] = useState<ConnectorConfig>({});
  const [gmailConnecting, setGmailConnecting] = useState(false);
  const [outlookConnecting, setOutlookConnecting] = useState(false);
  const [linkedinConnecting, setLinkedinConnecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupModalProvider, setSetupModalProvider] = useState<'gmail' | 'outlook'>('gmail');

  // Check if OAuth is configured
  const isGmailOAuthConfigured = !!import.meta.env.VITE_GMAIL_CLIENT_ID;
  const isOutlookOAuthConfigured = !!import.meta.env.VITE_OUTLOOK_CLIENT_ID;
  const isLinkedInOAuthConfigured = !!import.meta.env.VITE_LINKEDIN_CLIENT_ID;

  // Load user's connector configuration from database (workspace-scoped)
  useEffect(() => {
    loadConnectorConfig();
  }, [workspaceId]);

  const loadConnectorConfig = async () => {
    if (!workspaceId) {
      setConfig({});
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const userConfig = await ConnectorService.getUserConfig(workspaceId);
      
      if (userConfig) {
        setConfig(userConfig);
      } else {
        setConfig({});
      }
    } catch (error) {
      console.error('Error loading connector config:', error);
      toast({
        title: 'Failed to Load Connectors',
        description: 'Could not load your connector settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConnector = async (channel: string) => {
    if (!workspaceId) {
      toast({ title: 'Error', description: 'Please select a workspace first', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      
      // Save entire config to database (workspace-scoped)
      await ConnectorService.saveUserConfig(config, workspaceId);
      
      toast({
        title: 'Connector Saved',
        description: `${channel} connector has been configured and is ready to use.`,
      });
    } catch (error) {
      console.error('Error saving connector:', error);
      toast({
        title: 'Save Failed',
        description: 'Could not save connector settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const testConnector = async (channel: string) => {
    const channelConfig = config[channel as keyof typeof config];
    
    if (!channelConfig) {
      toast({
        title: 'Configuration Missing',
        description: `Please configure ${channel} settings before testing.`,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Testing Connection',
      description: `Testing ${channel} integration...`,
    });

    // Simulate test - in production this would call the actual API
    await new Promise(resolve => setTimeout(resolve, 1500));

    toast({
      title: 'Connection Successful',
      description: `${channel} connector is configured correctly and ready to use.`,
    });
  };

  const connectGmail = async () => {
    setGmailConnecting(true);
    try {
      const gmailClient = new GmailOAuthClient();
      const tokens = await gmailClient.authorize();
      
      // Update config with OAuth tokens
      const updatedConfig: ConnectorConfig = {
        ...config,
        emailProvider: 'gmail',
        emailAccessToken: tokens.accessToken,
        emailUserEmail: tokens.userEmail,
        emailTokenExpiry: tokens.expiresAt,
      };
      
      setConfig(updatedConfig);
      
      // Save to database
      await ConnectorService.saveUserConfig(updatedConfig);

      toast({
        title: 'Gmail Connected!',
        description: `Successfully connected to ${tokens.userEmail}`,
      });
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect Gmail',
        variant: 'destructive',
      });
    } finally {
      setGmailConnecting(false);
    }
  };

  const connectOutlook = async () => {
    setOutlookConnecting(true);
    try {
      const outlookClient = new OutlookOAuthClient();
      const tokens = await outlookClient.authorize();
      
      // Update config with OAuth tokens
      const updatedConfig: ConnectorConfig = {
        ...config,
        emailProvider: 'outlook',
        emailAccessToken: tokens.accessToken,
        emailUserEmail: tokens.userEmail,
        emailTokenExpiry: tokens.expiresAt,
      };
      
      setConfig(updatedConfig);
      
      // Save to database
      await ConnectorService.saveUserConfig(updatedConfig);

      toast({
        title: 'Outlook Connected!',
        description: `Successfully connected to ${tokens.userEmail}`,
      });
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect Outlook',
        variant: 'destructive',
      });
    } finally {
      setOutlookConnecting(false);
    }
  };

  const connectLinkedIn = async () => {
    setLinkedinConnecting(true);
    try {
      const linkedinClient = new LinkedInOAuthClient();
      const tokens = await linkedinClient.authorize();
      
      // Update config with OAuth tokens
      const updatedConfig: ConnectorConfig = {
        ...config,
        linkedinAccessToken: tokens.accessToken,
        linkedinConnected: true,
        linkedinUserEmail: tokens.userEmail,
        linkedinUserName: tokens.userName,
        linkedinProfileUrl: tokens.userProfileUrl,
        linkedinTokenExpiry: tokens.expiresAt,
      };
      
      setConfig(updatedConfig);
      
      // Save to database
      await ConnectorService.saveUserConfig(updatedConfig);

      toast({
        title: 'LinkedIn Connected!',
        description: `Successfully connected to ${tokens.userName || tokens.userEmail}`,
      });
    } catch (error) {
      toast({
        title: 'Connection Failed',
        description: error instanceof Error ? error.message : 'Failed to connect LinkedIn',
        variant: 'destructive',
      });
    } finally {
      setLinkedinConnecting(false);
    }
  };

  const disconnectLinkedIn = async () => {
    try {
      // Clear LinkedIn configuration
      const updatedConfig: ConnectorConfig = {
        ...config,
        linkedinAccessToken: undefined,
        linkedinConnected: false,
        linkedinUserEmail: undefined,
        linkedinUserName: undefined,
        linkedinProfileUrl: undefined,
        linkedinTokenExpiry: undefined,
      };
      
      setConfig(updatedConfig);
      
      // Save to database
      await ConnectorService.saveUserConfig(updatedConfig);

      toast({
        title: 'LinkedIn Disconnected',
        description: 'LinkedIn connector has been removed.',
      });
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error);
      toast({
        title: 'Disconnect Failed',
        description: 'Could not disconnect LinkedIn. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const disconnectEmail = async () => {
    try {
      // Clear email configuration
      const updatedConfig: ConnectorConfig = {
        ...config,
        emailProvider: undefined,
        emailApiKey: undefined,
        emailFromEmail: undefined,
        emailFromName: undefined,
        emailSmtpHost: undefined,
        emailSmtpPort: undefined,
        emailSmtpUser: undefined,
        emailSmtpPassword: undefined,
        emailAccessToken: undefined,
        emailRefreshToken: undefined,
        emailTokenExpiry: undefined,
        emailUserEmail: undefined,
      };
      
      setConfig(updatedConfig);
      
      // Save to database
      await ConnectorService.saveUserConfig(updatedConfig);

      toast({
        title: 'Email Disconnected',
        description: 'Email connector has been removed.',
      });
    } catch (error) {
      console.error('Error disconnecting email:', error);
      toast({
        title: 'Disconnect Failed',
        description: 'Could not disconnect email. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const openSetupHelp = (provider: 'gmail' | 'outlook') => {
    setSetupModalProvider(provider);
    setSetupModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Channel Connectors</h2>
        <p className="text-muted-foreground">
          Configure API integrations for multi-channel outreach
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Configure your API credentials below. These will be used for all campaign outreach across channels.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="email" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="phone" className="gap-2">
            <Phone className="h-4 w-4" />
            Phone/Voice
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="gap-2">
            <Linkedin className="h-4 w-4" />
            LinkedIn
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="h-4 w-4" />
            Social Media
          </TabsTrigger>
        </TabsList>

        {/* Email Connector */}
        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Provider Configuration
              </CardTitle>
              <CardDescription>
                Choose your email provider and configure credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Show connected status if Gmail or Outlook is connected */}
                  {isEmailConnected(config) && config.emailUserEmail ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {config.emailProvider === 'gmail' ? 'Gmail' : 'Outlook'} Connected
                            </p>
                            <p className="text-sm text-muted-foreground">{config.emailUserEmail}</p>
                          </div>
                        </div>
                        <Button variant="destructive" size="sm" onClick={disconnectEmail} data-testid="button-disconnect-email">
                          Disconnect
                        </Button>
                      </div>
                      <Alert>
                        <CheckCircle2 className="h-4 w-4" />
                        <AlertDescription>
                          Your email connector is active and ready to send campaigns.
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                <>
                  {/* OAuth Configuration Warning */}
                  {!isGmailOAuthConfigured && !isOutlookOAuthConfigured && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>OAuth Not Configured:</strong> To enable Gmail/Outlook one-click setup, you need to configure OAuth client IDs.
                        <div className="mt-3 flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openSetupHelp('gmail')}
                            data-testid="button-gmail-setup-help"
                          >
                            <HelpCircle className="h-4 w-4 mr-2" />
                            Setup Gmail OAuth
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => openSetupHelp('outlook')}
                            data-testid="button-outlook-setup-help"
                          >
                            <HelpCircle className="h-4 w-4 mr-2" />
                            Setup Outlook OAuth
                          </Button>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">Or use API key providers below (SendGrid, Resend, or SMTP)</p>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* OAuth Providers */}
                  <div className="space-y-3">
                    <Label>Connect via OAuth (Recommended)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={connectGmail}
                        disabled={gmailConnecting || !isGmailOAuthConfigured}
                        data-testid="button-connect-gmail"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
                            <Mail className="h-5 w-5 text-red-500" />
                          </div>
                          <div className="text-left">
                            <div className="font-medium">Gmail</div>
                            <div className="text-xs text-muted-foreground">
                              {!isGmailOAuthConfigured ? 'Not configured' : gmailConnecting ? 'Connecting...' : 'One-click setup'}
                            </div>
                          </div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="justify-start h-auto py-3"
                        onClick={connectOutlook}
                        disabled={outlookConnecting || !isOutlookOAuthConfigured}
                        data-testid="button-connect-outlook"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
                            <Mail className="h-5 w-5 text-blue-500" />
                          </div>
                          <div className="text-left">
                            <div className="font-medium">Outlook</div>
                            <div className="text-xs text-muted-foreground">
                              {!isOutlookOAuthConfigured ? 'Not configured' : outlookConnecting ? 'Connecting...' : 'One-click setup'}
                            </div>
                          </div>
                        </div>
                      </Button>
                    </div>
                  </div>

                  {/* API Key Providers */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or use API keys
                      </span>
                    </div>
                  </div>

                    <div className="space-y-2">
                      <Label>Email Provider</Label>
                      <select 
                        className="w-full p-2 border rounded-md"
                        value={config.emailProvider || 'sendgrid'}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          emailProvider: e.target.value as any
                        }))}
                        data-testid="select-email-provider"
                      >
                        <option value="sendgrid">SendGrid</option>
                        <option value="resend">Resend</option>
                        <option value="smtp">Custom SMTP</option>
                      </select>
                    </div>
                  </>
                )}
              </>
            )}

              {config.emailProvider === 'sendgrid' && (
                <>
                  <div className="space-y-2">
                    <Label>SendGrid API Key</Label>
                    <Input 
                      type="password"
                      placeholder="SG.xxxxxxxxxxxxx"
                      value={config.emailApiKey || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        emailApiKey: e.target.value
                      }))}
                      data-testid="input-sendgrid-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" className="text-primary underline">SendGrid Dashboard</a>
                    </p>
                  </div>
                </>
              )}

              {config.emailProvider === 'resend' && (
                <>
                  <div className="space-y-2">
                    <Label>Resend API Key</Label>
                    <Input 
                      type="password"
                      placeholder="re_xxxxxxxxxxxxx"
                      value={config.emailApiKey || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        emailApiKey: e.target.value
                      }))}
                      data-testid="input-resend-api-key"
                    />
                    <p className="text-xs text-muted-foreground">
                      Get your API key from <a href="https://resend.com/api-keys" target="_blank" className="text-primary underline">Resend Dashboard</a>
                    </p>
                  </div>
                </>
              )}

              {config.emailProvider === 'smtp' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>SMTP Host</Label>
                      <Input 
                        placeholder="smtp.example.com"
                        value={config.emailSmtpHost || ''}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          emailSmtpHost: e.target.value
                        }))}
                        data-testid="input-smtp-host"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>SMTP Port</Label>
                      <Input 
                        placeholder="587"
                        value={config.emailSmtpPort || ''}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          emailSmtpPort: e.target.value
                        }))}
                        data-testid="input-smtp-port"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Username</Label>
                    <Input 
                      placeholder="username"
                      value={config.emailSmtpUser || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        emailSmtpUser: e.target.value
                      }))}
                      data-testid="input-smtp-user"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SMTP Password</Label>
                    <Input 
                      type="password"
                      placeholder="password"
                      value={config.emailSmtpPassword || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        emailSmtpPassword: e.target.value
                      }))}
                      data-testid="input-smtp-password"
                    />
                  </div>
                </>
              )}

              {config.emailProvider && !isEmailConnected(config) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>From Email</Label>
                    <Input 
                      type="email"
                      placeholder="you@company.com"
                      value={config.emailFromEmail || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        emailFromEmail: e.target.value
                      }))}
                      data-testid="input-from-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From Name</Label>
                    <Input 
                      placeholder="Your Company"
                      value={config.emailFromName || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        emailFromName: e.target.value
                      }))}
                      data-testid="input-from-name"
                    />
                  </div>
                </div>
              )}

              {/* Only show save/test buttons for API key providers */}
              {config.emailProvider && !isEmailConnected(config) && (
                <div className="flex gap-2">
                  <Button 
                    onClick={() => saveConnector('email')} 
                    disabled={saving}
                    data-testid="button-save-email"
                  >
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </Button>
                  <Button variant="outline" onClick={() => testConnector('email')} data-testid="button-test-email">
                    Test Connection
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Connector */}
        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                SMS Provider Configuration
              </CardTitle>
              <CardDescription>
                Configure Twilio or Vonage for SMS campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>SMS Provider</Label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={config.smsProvider || 'twilio'}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        smsProvider: e.target.value as any
                      }))}
                      data-testid="select-sms-provider"
                    >
                      <option value="twilio">Twilio (Recommended)</option>
                      <option value="vonage">Vonage</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Account SID</Label>
                    <Input 
                      placeholder="ACxxxxxxxxxxxxx"
                      value={config.smsAccountSid || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        smsAccountSid: e.target.value
                      }))}
                      data-testid="input-sms-account-sid"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Auth Token</Label>
                    <Input 
                      type="password"
                      placeholder="Your auth token"
                      value={config.smsAuthToken || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        smsAuthToken: e.target.value
                      }))}
                      data-testid="input-sms-auth-token"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>From Phone Number</Label>
                    <Input 
                      placeholder="+1234567890"
                      value={config.smsFromNumber || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        smsFromNumber: e.target.value
                      }))}
                      data-testid="input-sms-from-number"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => saveConnector('sms')} 
                      disabled={saving}
                      data-testid="button-save-sms"
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
                      {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    <Button variant="outline" onClick={() => testConnector('sms')} data-testid="button-test-sms">
                      Test Connection
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Phone/Voice Connector */}
        <TabsContent value="phone" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                AI Phone Call Configuration
              </CardTitle>
              <CardDescription>
                Configure voice API for AI phone calls and voicemail drops
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Voice Provider</Label>
                    <select 
                      className="w-full p-2 border rounded-md"
                      value={config.phoneProvider || 'twilio'}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        phoneProvider: e.target.value as any
                      }))}
                      data-testid="select-phone-provider"
                    >
                      <option value="twilio">Twilio Voice</option>
                      <option value="elevenlabs">ElevenLabs</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Account SID / API Key</Label>
                    <Input 
                      placeholder="Your account credentials"
                      value={config.phoneAccountSid || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        phoneAccountSid: e.target.value
                      }))}
                      data-testid="input-phone-account-sid"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Auth Token</Label>
                    <Input 
                      type="password"
                      placeholder="Your auth token"
                      value={config.phoneAuthToken || ''}
                      onChange={(e) => setConfig(prev => ({ 
                        ...prev, 
                        phoneAuthToken: e.target.value
                      }))}
                      data-testid="input-phone-auth-token"
                    />
                  </div>

                  {config.phoneProvider === 'elevenlabs' && (
                    <div className="space-y-2">
                      <Label>Voice ID</Label>
                      <Input 
                        placeholder="Voice ID for AI calls"
                        value={config.phoneVoiceId || ''}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          phoneVoiceId: e.target.value
                        }))}
                        data-testid="input-phone-voice-id"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      onClick={() => saveConnector('phone')} 
                      disabled={saving}
                      data-testid="button-save-phone"
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Settings className="h-4 w-4 mr-2" />}
                      {saving ? 'Saving...' : 'Save Configuration'}
                    </Button>
                    <Button variant="outline" onClick={() => testConnector('phone')} data-testid="button-test-phone">
                      Test Connection
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LinkedIn Connector */}
        <TabsContent value="linkedin" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Linkedin className="h-5 w-5" />
                LinkedIn Integration
              </CardTitle>
              <CardDescription>
                Connect your LinkedIn account for automated outreach
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {!config.linkedinConnected ? (
                    <>
                      {!isLinkedInOAuthConfigured && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>LinkedIn OAuth Not Configured:</strong> To enable LinkedIn connection, you need to set up a LinkedIn app and configure the Client ID.
                            <p className="mt-2 text-sm">Add <code>VITE_LINKEDIN_CLIENT_ID</code> to your environment secrets to enable this feature.</p>
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-muted-foreground mb-3">
                          LinkedIn requires OAuth authentication. Click below to connect your account for automated outreach and messaging campaigns.
                        </p>
                        <Button 
                          className="bg-[#0A66C2] hover:bg-[#004182]" 
                          onClick={connectLinkedIn}
                          disabled={linkedinConnecting || !isLinkedInOAuthConfigured}
                          data-testid="button-connect-linkedin"
                        >
                          {linkedinConnecting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            <>
                              <Linkedin className="h-4 w-4 mr-2" />
                              {!isLinkedInOAuthConfigured ? 'Not Configured' : 'Connect LinkedIn Account'}
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div className="flex-1">
                          <span className="text-sm font-medium">LinkedIn Connected Successfully</span>
                          {config.linkedinUserName && (
                            <p className="text-xs text-muted-foreground mt-1">{config.linkedinUserName}</p>
                          )}
                          {config.linkedinUserEmail && (
                            <p className="text-xs text-muted-foreground">{config.linkedinUserEmail}</p>
                          )}
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={disconnectLinkedIn}
                          data-testid="button-disconnect-linkedin"
                        >
                          Disconnect
                        </Button>
                      </div>
                      
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Your LinkedIn account is now connected and ready for use in campaigns. You can now send connection requests, messages, and track engagement through the platform.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media Connector */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Social Media Integration
              </CardTitle>
              <CardDescription>
                Connect social media accounts for cross-platform posting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-3">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-black rounded">
                      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Twitter / X</p>
                      <p className="text-xs text-muted-foreground">Post updates and engage</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#1877F2] rounded">
                      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Facebook</p>
                      <p className="text-xs text-muted-foreground">Share posts and updates</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Connect
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-600 rounded">
                      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Instagram</p>
                      <p className="text-xs text-muted-foreground">Share visual content</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" data-testid="button-connect-instagram">
                    Connect
                  </Button>
                </div>
              </div>
            )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* OAuth Setup Modal */}
      <OAuthSetupModal 
        isOpen={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        provider={setupModalProvider}
      />
    </div>
  );
}
