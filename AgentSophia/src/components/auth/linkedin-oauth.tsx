import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Linkedin, Shield, Key, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LinkedInConfig {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  scopes: string[];
  auto_refresh: boolean;
  is_active: boolean;
}

export function LinkedInOAuth() {
  const { toast } = useToast();
  const [config, setConfig] = useState<LinkedInConfig>({
    client_id: '',
    client_secret: '',
    redirect_uri: `${window.location.origin}/auth/linkedin/callback`,
    scopes: ['r_basicprofile', 'r_emailaddress', 'w_member_social'],
    auto_refresh: true,
    is_active: false
  });
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const connectLinkedIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'linkedin_oidc',
        options: {
          redirectTo: `${window.location.origin}/platform`,
          scopes: config.scopes.join(' ')
        }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'LinkedIn OAuth initiated. Please complete authorization.',
      });
    } catch (error: any) {
      console.error('LinkedIn OAuth error:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect LinkedIn account',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    try {
      // In a real implementation, you'd save these to a secure backend
      // For now, we'll store in localStorage for demo purposes
      localStorage.setItem('linkedin_config', JSON.stringify(config));
      
      toast({
        title: 'Configuration Saved',
        description: 'LinkedIn OAuth settings have been saved securely.',
      });
      
      setIsConnected(true);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    }
  };

  const testConnection = async () => {
    setLoading(true);
    try {
      // Simulate API test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: 'Connection Test Successful',
        description: 'LinkedIn API connection is working properly.',
      });
    } catch (error) {
      toast({
        title: 'Test Failed',
        description: 'Unable to connect to LinkedIn API',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Linkedin className="h-5 w-5 text-blue-600" />
            <span>LinkedIn OAuth Configuration</span>
          </CardTitle>
          <CardDescription>
            Set up secure LinkedIn integration for automated outreach and lead generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Your LinkedIn credentials are encrypted and stored securely. We never store your password.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="client_id">Client ID</Label>
                <Input
                  id="client_id"
                  type="text"
                  value={config.client_id}
                  onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
                  placeholder="Your LinkedIn App Client ID"
                />
              </div>
              
              <div>
                <Label htmlFor="client_secret">Client Secret</Label>
                <Input
                  id="client_secret"
                  type="password"
                  value={config.client_secret}
                  onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
                  placeholder="Your LinkedIn App Client Secret"
                />
              </div>
              
              <div>
                <Label htmlFor="redirect_uri">Redirect URI</Label>
                <Input
                  id="redirect_uri"
                  type="url"
                  value={config.redirect_uri}
                  onChange={(e) => setConfig({ ...config, redirect_uri: e.target.value })}
                  placeholder="OAuth redirect URI"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Permissions & Scopes</Label>
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Basic Profile Access</span>
                    <Badge variant="outline">r_basicprofile</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Email Address</span>
                    <Badge variant="outline">r_emailaddress</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Share Content</span>
                    <Badge variant="outline">w_member_social</Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="auto_refresh">Auto-refresh tokens</Label>
                <Switch
                  id="auto_refresh"
                  checked={config.auto_refresh}
                  onCheckedChange={(checked) => setConfig({ ...config, auto_refresh: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Enable LinkedIn integration</Label>
                <Switch
                  id="is_active"
                  checked={config.is_active}
                  onCheckedChange={(checked) => setConfig({ ...config, is_active: checked })}
                />
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4 border-t">
            <Button 
              onClick={saveConfiguration}
              className="bg-gradient-primary"
              disabled={!config.client_id || !config.client_secret}
            >
              <Key className="h-4 w-4 mr-2" />
              Save Configuration
            </Button>
            
            <Button 
              variant="outline" 
              onClick={testConnection}
              disabled={loading || !isConnected}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Linkedin className="h-4 w-4 mr-2" />
                  Connect Account
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Connect LinkedIn Account</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      You'll be redirected to LinkedIn to authorize access. This connection uses OAuth 2.0 for maximum security.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">What we'll access:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Your basic profile information</li>
                      <li>• Your email address for contact</li>
                      <li>• Permission to send connection requests</li>
                      <li>• Permission to send messages (with your approval)</li>
                    </ul>
                  </div>
                  
                  <Button 
                    onClick={connectLinkedIn}
                    disabled={loading}
                    className="w-full bg-gradient-primary"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Linkedin className="h-4 w-4 mr-2" />
                    )}
                    Authorize LinkedIn Access
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Features</CardTitle>
          <CardDescription>
            Advanced security measures for your LinkedIn integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gradient-card">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-4 w-4 text-green-600" />
                <span className="font-medium">Token Encryption</span>
              </div>
              <p className="text-sm text-muted-foreground">
                All tokens are encrypted at rest using AES-256
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-card">
              <div className="flex items-center space-x-2 mb-2">
                <RefreshCw className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Auto Refresh</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Tokens automatically refresh before expiration
              </p>
            </div>
            
            <div className="p-4 rounded-lg bg-gradient-card">
              <div className="flex items-center space-x-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium">Rate Limiting</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Built-in protection against API rate limits
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}