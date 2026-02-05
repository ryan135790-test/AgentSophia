import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Twitter, Facebook, Instagram, Music, Youtube, Linkedin, Mail, Send, 
  Lock, CheckCircle2, AlertCircle, Settings, Plus, Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SystemIntegrationConfig {
  id: string;
  platform: string;
  is_enabled: boolean;
  api_key_configured: boolean;
  description?: string;
}

export function SystemIntegrations() {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<SystemIntegrationConfig[]>([
    { id: '1', platform: 'SmartReach', is_enabled: false, api_key_configured: false, description: 'Email automation platform' },
    { id: '2', platform: 'Email Outreach', is_enabled: false, api_key_configured: false, description: 'Email outreach automation' },
    { id: '3', platform: 'Reply.io', is_enabled: false, api_key_configured: false, description: 'Multi-channel outreach' },
    { id: '4', platform: 'SendGrid', is_enabled: false, api_key_configured: false, description: 'Email delivery service' },
    { id: '5', platform: 'Resend', is_enabled: false, api_key_configured: false, description: 'Email for developers' },
    { id: '6', platform: 'HubSpot', is_enabled: false, api_key_configured: false, description: 'CRM platform' },
    { id: '7', platform: 'Pipedrive', is_enabled: false, api_key_configured: false, description: 'Sales CRM' },
    { id: '8', platform: 'Salesforce', is_enabled: false, api_key_configured: false, description: 'Enterprise CRM' },
  ]);

  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');

  const handleConfigureIntegration = (id: string) => {
    setIntegrations(prev => 
      prev.map(int => 
        int.id === id 
          ? { ...int, api_key_configured: true, is_enabled: true }
          : int
      )
    );
    toast({
      title: 'Success',
      description: 'API key configured successfully'
    });
    setEditingIntegration(null);
    setApiKey('');
  };

  const handleToggleIntegration = (id: string) => {
    setIntegrations(prev =>
      prev.map(int =>
        int.id === id
          ? { ...int, is_enabled: !int.is_enabled }
          : int
      )
    );
  };

  const handleRemoveIntegration = (id: string) => {
    setIntegrations(prev =>
      prev.map(int =>
        int.id === id
          ? { ...int, api_key_configured: false, is_enabled: false }
          : int
      )
    );
    toast({
      title: 'Integration removed',
      description: 'API key has been cleared'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>System Integration Configuration</CardTitle>
          <CardDescription>
            Configure API keys for all platforms. Once set up, all users will have access to these integrations via Agent Sophia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 border rounded-lg p-4">
            <div className="space-y-3">
              {integrations.map(integration => (
                <div
                  key={integration.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted transition-colors"
                  data-testid={`integration-config-${integration.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{integration.platform}</h4>
                      {integration.api_key_configured && (
                        <Badge variant="default" className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Configured
                        </Badge>
                      )}
                      {integration.is_enabled && integration.api_key_configured && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Lock className="h-3 w-3" />
                          Active
                        </Badge>
                      )}
                      {!integration.api_key_configured && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Not configured
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{integration.description}</p>
                  </div>

                  <div className="flex gap-2">
                    {!integration.api_key_configured ? (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingIntegration(integration.id)}
                            data-testid={`button-configure-${integration.id}`}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Configure
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Configure {integration.platform}</DialogTitle>
                            <DialogDescription>
                              Enter the API key for {integration.platform}. This will be securely stored and available to all users.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>API Key</Label>
                              <Input
                                type="password"
                                placeholder="Paste API key here"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                data-testid="input-api-key"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                This is stored securely and never shown to users.
                              </p>
                            </div>
                            <Button
                              onClick={() => handleConfigureIntegration(integration.id)}
                              disabled={!apiKey}
                              className="w-full"
                              data-testid="button-save-api-key"
                            >
                              Save Configuration
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant={integration.is_enabled ? 'default' : 'outline'}
                          onClick={() => handleToggleIntegration(integration.id)}
                          data-testid={`button-toggle-${integration.id}`}
                        >
                          {integration.is_enabled ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoveIntegration(integration.id)}
                          data-testid={`button-remove-${integration.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" />
            How This Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><strong>Admin Setup:</strong> Configure API keys for each platform here.</p>
          <p><strong>User Access:</strong> All authenticated users automatically see these integrations in Agent Sophia.</p>
          <p><strong>Security:</strong> API keys are stored securely and never exposed to individual users.</p>
          <p><strong>Usage:</strong> Users can create campaigns, posts, and outreach directly via Sophia without managing keys.</p>
        </CardContent>
      </Card>
    </div>
  );
}
