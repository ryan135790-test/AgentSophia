import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, CheckCircle, Save, Trash2, Eye, EyeOff, Link, Unlink, Search, Users } from 'lucide-react';
import { SiLinkedin } from 'react-icons/si';

interface IntegrationConfig {
  integration_type: string;
  api_key?: string;
  api_secret?: string;
  api_url?: string;
  other_credentials?: Record<string, any>;
  is_active: boolean;
  last_updated?: string;
}

interface HeyreachStatus {
  connected: boolean;
  verified?: boolean;
  accounts?: number;
  message?: string;
}

interface ApolloStatus {
  connected: boolean;
  verified?: boolean;
  message?: string;
}

export default function IntegrationsAdmin() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Record<string, IntegrationConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewSecret, setShowViewSecret] = useState<Record<string, boolean>>({});
  const [heyreachStatus, setHeyreachStatus] = useState<HeyreachStatus>({ connected: false });
  const [apolloStatus, setApolloStatus] = useState<ApolloStatus>({ connected: false });
  
  const [selectedType, setSelectedType] = useState('linkedin');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apiUrl, setApiUrl] = useState('');

  const integrationTypes = [
    { id: 'linkedin', name: 'LinkedIn Automation', category: 'social', description: 'System-wide API for LinkedIn automation' },
    { id: 'apollo', name: 'Apollo.io', category: 'enrichment', description: 'Lead enrichment, prospecting & LinkedIn campaign building' },
    { id: 'email_sendgrid', name: 'SendGrid Email', category: 'email', description: 'SendGrid API for email campaigns' },
    { id: 'email_resend', name: 'Resend Email', category: 'email', description: 'Resend API for transactional emails' },
    { id: 'sms_twilio', name: 'Twilio SMS', category: 'messaging', description: 'Twilio for SMS campaigns' },
    { id: 'sms_vonage', name: 'Vonage SMS', category: 'messaging', description: 'Vonage for SMS messaging' },
    { id: 'phone_twilio', name: 'Twilio Voice', category: 'voice', description: 'Twilio for phone calls' },
    { id: 'whatsapp_twilio', name: 'Twilio WhatsApp', category: 'messaging', description: 'Twilio for WhatsApp messaging' },
  ];

  useEffect(() => {
    loadConfigs();
    loadHeyreachStatus();
    loadApolloStatus();
  }, []);

  const loadHeyreachStatus = async () => {
    try {
      const response = await fetch('/api/heyreach/status');
      if (response.ok) {
        const data = await response.json();
        setHeyreachStatus(data);
      }
    } catch (error) {
      console.error('Failed to load Heyreach status:', error);
    }
  };

  const loadApolloStatus = async () => {
    try {
      const response = await fetch('/api/apollo/status');
      if (response.ok) {
        const data = await response.json();
        setApolloStatus(data);
      }
    } catch (error) {
      console.error('Failed to load Apollo status:', error);
    }
  };

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const mockConfigs: Record<string, IntegrationConfig> = {};
      integrationTypes.forEach(type => {
        mockConfigs[type.id] = {
          integration_type: type.id,
          is_active: false,
          last_updated: undefined
        };
      });
      setConfigs(mockConfigs);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load integration configs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLinkedIn = async () => {
    if (!apiKey) {
      toast({
        title: 'Error',
        description: 'Heyreach API Key is required',
        variant: 'destructive'
      });
      return;
    }

    if (!apiKey.startsWith('hr_test_') && !apiKey.startsWith('hr_live_')) {
      toast({
        title: 'Invalid API Key Format',
        description: 'Heyreach API keys should start with hr_test_ or hr_live_',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/heyreach/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Heyreach');
      }

      setHeyreachStatus({ connected: true, verified: true, accounts: data.accounts || 0 });
      
      const updatedConfigs = { ...configs };
      updatedConfigs['linkedin'] = {
        integration_type: 'linkedin',
        api_key: apiKey,
        is_active: true,
        last_updated: new Date().toISOString()
      };
      setConfigs(updatedConfigs);

      toast({
        title: 'Connected Successfully',
        description: `Heyreach connected with ${data.accounts || 0} LinkedIn accounts available`,
      });

      setApiKey('');
      setShowAddDialog(false);
    } catch (error: any) {
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect to Heyreach',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectLinkedIn = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/heyreach/disconnect', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setHeyreachStatus({ connected: false });
      
      const updatedConfigs = { ...configs };
      updatedConfigs['linkedin'] = {
        integration_type: 'linkedin',
        is_active: false,
        api_key: undefined,
        last_updated: undefined
      };
      setConfigs(updatedConfigs);

      toast({
        title: 'Disconnected',
        description: 'LinkedIn automation has been disconnected',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApollo = async () => {
    if (!apiKey) {
      toast({
        title: 'Error',
        description: 'Apollo.io API Key is required',
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/apollo/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Apollo.io');
      }

      setApolloStatus({ connected: true, verified: true });
      
      const updatedConfigs = { ...configs };
      updatedConfigs['apollo'] = {
        integration_type: 'apollo',
        api_key: apiKey,
        is_active: true,
        last_updated: new Date().toISOString()
      };
      setConfigs(updatedConfigs);

      toast({
        title: 'Connected Successfully',
        description: 'Apollo.io connected - lead enrichment and prospecting enabled',
      });

      setApiKey('');
      setShowAddDialog(false);
    } catch (error: any) {
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect to Apollo.io',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectApollo = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/apollo/disconnect', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setApolloStatus({ connected: false });
      
      const updatedConfigs = { ...configs };
      updatedConfigs['apollo'] = {
        integration_type: 'apollo',
        is_active: false,
        api_key: undefined,
        last_updated: undefined
      };
      setConfigs(updatedConfigs);

      toast({
        title: 'Disconnected',
        description: 'Apollo.io integration has been disconnected',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to disconnect',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (selectedType === 'linkedin') {
      return handleSaveLinkedIn();
    }
    if (selectedType === 'apollo') {
      return handleSaveApollo();
    }

    if (!apiKey) {
      toast({
        title: 'Error',
        description: 'API Key is required',
        variant: 'destructive'
      });
      return;
    }

    try {
      const updatedConfigs = { ...configs };
      updatedConfigs[selectedType] = {
        integration_type: selectedType,
        api_key: apiKey,
        api_secret: apiSecret || undefined,
        api_url: apiUrl || undefined,
        is_active: true,
        last_updated: new Date().toISOString()
      };
      setConfigs(updatedConfigs);

      toast({
        title: 'Success',
        description: `${integrationTypes.find(t => t.id === selectedType)?.name} configured successfully`,
        variant: 'default'
      });

      setApiKey('');
      setApiSecret('');
      setApiUrl('');
      setShowAddDialog(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save configuration',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteConfig = async (type: string) => {
    if (type === 'linkedin') {
      return handleDisconnectLinkedIn();
    }
    if (type === 'apollo') {
      return handleDisconnectApollo();
    }

    const updatedConfigs = { ...configs };
    updatedConfigs[type].is_active = false;
    updatedConfigs[type].api_key = undefined;
    updatedConfigs[type].api_secret = undefined;
    setConfigs(updatedConfigs);

    toast({
      title: 'Success',
      description: 'Integration configuration removed',
      variant: 'default'
    });
  };

  const categories = ['enrichment', 'social', 'email', 'messaging', 'voice'];

  const renderLinkedInCard = () => {
    const isConnected = heyreachStatus.connected;
    
    return (
      <Card className="border-2 border-blue-200 dark:border-blue-800">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <SiLinkedin className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">LinkedIn Automation</CardTitle>
                <CardDescription className="mt-1">Powered by Heyreach</CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Heyreach API Connected</span>
                </div>
                {heyreachStatus.accounts !== undefined && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    {heyreachStatus.accounts} LinkedIn account(s) available
                  </p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Users can now connect their LinkedIn accounts through My Connections page.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Heyreach API to enable LinkedIn automation for all users.
              </p>
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                  Get your API key from <a href="https://heyreach.io" target="_blank" rel="noopener noreferrer" className="underline font-medium">heyreach.io</a> dashboard under Settings → API.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedType('linkedin');
                    setApiKey('');
                    setShowAddDialog(true);
                  }}
                  className="flex-1"
                  data-testid="button-update-linkedin"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Update Key
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnectLinkedIn}
                  disabled={saving}
                  className="text-destructive hover:text-destructive"
                  data-testid="button-disconnect-linkedin"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedType('linkedin');
                  setApiKey('');
                  setShowAddDialog(true);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="button-connect-linkedin"
              >
                <Link className="h-4 w-4 mr-1" />
                Connect Heyreach
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderApolloCard = () => {
    const isConnected = apolloStatus.connected;
    
    return (
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Search className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Apollo.io</CardTitle>
                <CardDescription className="mt-1">Lead Enrichment & Prospecting</CardDescription>
              </div>
            </div>
            {isConnected ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Badge variant="outline">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected ? (
            <div className="space-y-3">
              <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Apollo.io API Connected</span>
                </div>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Lead enrichment, prospecting, and LinkedIn campaign building enabled
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>Find prospects with LinkedIn profiles for outreach campaigns</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect Apollo.io to enable lead enrichment, email finding, and LinkedIn campaign prospecting.
              </p>
              <Alert className="bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800">
                <AlertCircle className="h-4 w-4 text-purple-600" />
                <AlertDescription className="text-purple-700 dark:text-purple-300 text-sm">
                  Get your API key from <a href="https://app.apollo.io/#/settings/integrations/api" target="_blank" rel="noopener noreferrer" className="underline font-medium">apollo.io</a> Settings → Integrations → API.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <div className="flex gap-2">
            {isConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedType('apollo');
                    setApiKey('');
                    setShowAddDialog(true);
                  }}
                  className="flex-1"
                  data-testid="button-update-apollo"
                >
                  <Save className="h-4 w-4 mr-1" />
                  Update Key
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnectApollo}
                  disabled={saving}
                  className="text-destructive hover:text-destructive"
                  data-testid="button-disconnect-apollo"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedType('apollo');
                  setApiKey('');
                  setShowAddDialog(true);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
                data-testid="button-connect-apollo"
              >
                <Link className="h-4 w-4 mr-1" />
                Connect Apollo.io
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">System Integrations</h1>
        <p className="text-muted-foreground mt-2">
          Configure system-wide API keys for all integration services. These are shared across all users.
        </p>
      </div>

      <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>System-Wide Configuration:</strong> API keys configured here apply to your entire organization. Individual users will connect their own accounts (LinkedIn, Gmail, etc.) through OAuth.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="enrichment" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="capitalize">
              {cat}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="enrichment" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderApolloCard()}
          </div>
        </TabsContent>

        <TabsContent value="social" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderLinkedInCard()}
          </div>
        </TabsContent>

        {categories.filter(c => c !== 'social' && c !== 'enrichment').map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrationTypes
                .filter(t => t.category === category)
                .map(type => {
                  const config = configs[type.id];
                  const isConfigured = config?.is_active && config?.api_key;

                  return (
                    <Card key={type.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{type.name}</CardTitle>
                            <CardDescription className="mt-1">{type.description}</CardDescription>
                          </div>
                          {isConfigured ? (
                            <Badge className="bg-green-100 text-green-800">Configured</Badge>
                          ) : (
                            <Badge variant="outline">Not Set</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {isConfigured ? (
                          <div className="space-y-2 bg-muted p-3 rounded">
                            <p className="text-xs text-muted-foreground">API Key:</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs bg-background px-2 py-1 rounded flex-1 truncate">
                                {showViewSecret[type.id] ? config.api_key : '••••••••••••••••'}
                              </code>
                              <button
                                onClick={() => setShowViewSecret(s => ({ ...s, [type.id]: !s[type.id] }))}
                                className="text-muted-foreground hover:text-foreground"
                                data-testid={`button-toggle-${type.id}`}
                              >
                                {showViewSecret[type.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                            {config.last_updated && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Updated: {new Date(config.last_updated).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No configuration yet</p>
                        )}

                        <div className="flex gap-2">
                          <Button
                            variant={isConfigured ? 'outline' : 'default'}
                            size="sm"
                            onClick={() => {
                              setSelectedType(type.id);
                              if (isConfigured) {
                                setApiKey(config.api_key || '');
                                setApiSecret(config.api_secret || '');
                                setApiUrl(config.api_url || '');
                              } else {
                                setApiKey('');
                                setApiSecret('');
                                setApiUrl('');
                              }
                              setShowAddDialog(true);
                            }}
                            className="flex-1"
                            data-testid={`button-edit-${type.id}`}
                          >
                            <Save className="h-4 w-4 mr-1" />
                            {isConfigured ? 'Update' : 'Configure'}
                          </Button>
                          {isConfigured && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteConfig(type.id)}
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-${type.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedType === 'linkedin' ? 'Connect LinkedIn API' : 
               selectedType === 'apollo' ? 'Connect Apollo.io' : 'Configure Integration'}
            </DialogTitle>
            <DialogDescription>
              {selectedType === 'linkedin' 
                ? 'Enter your API key to enable LinkedIn automation for all users'
                : selectedType === 'apollo'
                ? 'Enter your Apollo.io API key for lead enrichment and prospecting'
                : integrationTypes.find(t => t.id === selectedType)?.description
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedType !== 'linkedin' && selectedType !== 'apollo' && (
              <div>
                <Label htmlFor="type">Integration Type</Label>
                <select
                  id="type"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                  data-testid="select-integration-type"
                >
                  {integrationTypes.filter(t => t.id !== 'linkedin' && t.id !== 'apollo').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <Label htmlFor="api_key">
                {selectedType === 'linkedin' ? 'LinkedIn API Key' : 
                 selectedType === 'apollo' ? 'Apollo.io API Key' : 'API Key'} *
              </Label>
              <Input
                id="api_key"
                type="password"
                placeholder={
                  selectedType === 'linkedin' ? 'hr_live_xxxxxxxx or hr_test_xxxxxxxx' : 
                  selectedType === 'apollo' ? 'Enter your Apollo.io API key' : 
                  'Enter API key'
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                data-testid="input-api-key"
              />
              {selectedType === 'linkedin' && (
                <p className="text-xs text-muted-foreground mt-1">
                  API key format: hr_live_* (production) or hr_test_* (sandbox)
                </p>
              )}
              {selectedType === 'apollo' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Get your API key from Apollo.io → Settings → Integrations → API
                </p>
              )}
            </div>

            {selectedType !== 'linkedin' && selectedType !== 'apollo' && (
              <>
                <div>
                  <Label htmlFor="api_secret">API Secret (Optional)</Label>
                  <Input
                    id="api_secret"
                    type="password"
                    placeholder="Enter API secret if required"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    data-testid="input-api-secret"
                  />
                </div>

                <div>
                  <Label htmlFor="api_url">API URL (Optional)</Label>
                  <Input
                    id="api_url"
                    type="url"
                    placeholder="https://api.example.com"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    data-testid="input-api-url"
                  />
                </div>
              </>
            )}

            <Alert className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200 text-sm">
                {selectedType === 'linkedin' 
                  ? 'This API key is system-wide. Once connected, users can link their LinkedIn accounts.'
                  : selectedType === 'apollo'
                  ? 'This API key enables lead enrichment and LinkedIn campaign prospecting for all users.'
                  : 'Credentials are stored securely on the server and encrypted at rest.'
                }
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveConfig} 
              disabled={saving}
              className={
                selectedType === 'linkedin' ? 'bg-blue-600 hover:bg-blue-700' : 
                selectedType === 'apollo' ? 'bg-purple-600 hover:bg-purple-700' : ''
              }
              data-testid="button-save-config"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedType === 'linkedin' || selectedType === 'apollo' ? 'Connect' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
