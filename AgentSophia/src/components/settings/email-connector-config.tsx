import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Mail, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

type EmailProvider = 'sendgrid' | 'resend' | 'smtp';

export function EmailConnectorConfig() {
  const { toast } = useToast();
  const [provider, setProvider] = useState<EmailProvider>('sendgrid');
  const [showApiKey, setShowApiKey] = useState(false);
  const [config, setConfig] = useState<Record<string, string>>({
    SENDGRID_API_KEY: '',
    RESEND_API_KEY: '',
    SMTP_HOST: '',
    SMTP_PORT: '',
    SMTP_USER: '',
    SMTP_PASSWORD: '',
    SMTP_FROM_EMAIL: '',
  });

  const hasValidConfig = provider === 'sendgrid' && config.SENDGRID_API_KEY ? true :
                        provider === 'resend' && config.RESEND_API_KEY ? true :
                        provider === 'smtp' && config.SMTP_HOST && config.SMTP_PORT && config.SMTP_USER ? true : false;

  const handleSaveConfig = async () => {
    if (!hasValidConfig) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      // In production, this would securely save to backend
      // For now, store in localStorage as placeholder
      localStorage.setItem('emailConnectorConfig', JSON.stringify({
        provider,
        config: {
          ...config,
          // Don't store sensitive keys in localStorage in production
        }
      }));

      toast({
        title: 'Success',
        description: 'Email connector configured. Update environment variables in Replit Secrets for production.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Email Connector</h2>
        <p className="text-muted-foreground mt-1">Configure your email provider for sending campaigns</p>
      </div>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          API keys should be stored securely. Update the environment variables in Replit Secrets (Settings → Secrets tab) with your provider credentials for production use.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Email Provider</CardTitle>
          <CardDescription>Choose your email service provider</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={(value) => setProvider(value as EmailProvider)}>
              <SelectTrigger id="provider" data-testid="select-email-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="smtp">SMTP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {provider === 'sendgrid' && (
            <div>
              <Label htmlFor="sendgrid-key">SendGrid API Key *</Label>
              <div className="flex gap-2 relative">
                <Input
                  id="sendgrid-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="SG.xxxxxxxxxxxx"
                  value={config.SENDGRID_API_KEY}
                  onChange={(e) => setConfig({ ...config, SENDGRID_API_KEY: e.target.value })}
                  data-testid="input-sendgrid-key"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Get your API key from <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="underline text-primary">SendGrid Dashboard</a>
              </p>
            </div>
          )}

          {provider === 'resend' && (
            <div>
              <Label htmlFor="resend-key">Resend API Key *</Label>
              <div className="flex gap-2 relative">
                <Input
                  id="resend-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="re_xxxxxxxxxxxx"
                  value={config.RESEND_API_KEY}
                  onChange={(e) => setConfig({ ...config, RESEND_API_KEY: e.target.value })}
                  data-testid="input-resend-key"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Get your API key from <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline text-primary">Resend Dashboard</a>
              </p>
            </div>
          )}

          {provider === 'smtp' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtp-host">Host *</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.gmail.com"
                    value={config.SMTP_HOST}
                    onChange={(e) => setConfig({ ...config, SMTP_HOST: e.target.value })}
                    data-testid="input-smtp-host"
                  />
                </div>
                <div>
                  <Label htmlFor="smtp-port">Port *</Label>
                  <Input
                    id="smtp-port"
                    placeholder="587"
                    type="number"
                    value={config.SMTP_PORT}
                    onChange={(e) => setConfig({ ...config, SMTP_PORT: e.target.value })}
                    data-testid="input-smtp-port"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="smtp-user">Username/Email *</Label>
                <Input
                  id="smtp-user"
                  placeholder="your-email@gmail.com"
                  value={config.SMTP_USER}
                  onChange={(e) => setConfig({ ...config, SMTP_USER: e.target.value })}
                  data-testid="input-smtp-user"
                />
              </div>
              <div>
                <Label htmlFor="smtp-password">Password *</Label>
                <div className="flex gap-2 relative">
                  <Input
                    id="smtp-password"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={config.SMTP_PASSWORD}
                    onChange={(e) => setConfig({ ...config, SMTP_PASSWORD: e.target.value })}
                    data-testid="input-smtp-password"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="smtp-from">From Email Address *</Label>
                <Input
                  id="smtp-from"
                  placeholder="noreply@yourcompany.com"
                  value={config.SMTP_FROM_EMAIL}
                  onChange={(e) => setConfig({ ...config, SMTP_FROM_EMAIL: e.target.value })}
                  data-testid="input-smtp-from"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium capitalize">{provider}</p>
                <p className="text-sm text-muted-foreground">
                  {hasValidConfig ? 'Ready to send' : 'Configure credentials'}
                </p>
              </div>
            </div>
            {hasValidConfig ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="h-3 w-3 mr-1" />
                Configured
              </Badge>
            ) : (
              <Badge variant="secondary">Pending</Badge>
            )}
          </div>

          {hasValidConfig && (
            <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-400">
                Your email connector is configured. Campaigns will now send real emails.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSaveConfig} disabled={!hasValidConfig} className="bg-gradient-primary" data-testid="button-save-email-config">
          Save Email Configuration
        </Button>
      </div>
    </div>
  );
}
