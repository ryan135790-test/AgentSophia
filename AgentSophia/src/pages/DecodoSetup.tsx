import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  ExternalLink, Copy, CheckCircle, Smartphone, Globe, Shield, 
  Zap, ArrowRight, AlertCircle, Loader2, Play, Settings
} from 'lucide-react';

export default function DecodoSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [currentStep, setCurrentStep] = useState(1);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; ip?: string; error?: string } | null>(null);
  
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
    country: 'us',
    sessionDuration: '60',
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: `${label} copied to clipboard` });
  };

  const buildProxyString = () => {
    const session = `session-${Date.now()}`;
    return `${credentials.username}-country-${credentials.country}-sessionduration-${credentials.sessionDuration}-${session}`;
  };

  const handleTestProxy = async () => {
    if (!credentials.username || !credentials.password) {
      toast({ title: 'Missing Credentials', description: 'Please enter your Decodo username and password', variant: 'destructive' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/test-proxy', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          host: 'gate.decodo.com',
          port: 7000,
          username: buildProxyString(),
          password: credentials.password,
        }),
      });

      const data = await res.json();
      setTestResult(data);
      
      if (data.success) {
        toast({ title: 'Proxy Working!', description: `Connected via IP: ${data.ip}` });
      } else {
        toast({ title: 'Test Failed', description: data.error || 'Could not connect', variant: 'destructive' });
      }
    } catch (error: any) {
      setTestResult({ success: false, error: error.message });
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveToLinkedIn = async () => {
    if (!currentWorkspace?.id) {
      toast({ title: 'No Workspace', description: 'Please select a workspace first', variant: 'destructive' });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      await apiRequest('/api/linkedin-automation/settings', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          proxy_enabled: true,
          proxy_provider: 'decodo',
          proxy_host: 'gate.decodo.com',
          proxy_port: 7000,
          proxy_username: buildProxyString(),
          proxy_password: credentials.password,
        }),
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      queryClient.invalidateQueries({ queryKey: ['linkedin-automation-settings'] });
      toast({ title: 'Saved!', description: 'Decodo proxy configured for LinkedIn automation' });
      navigate('/linkedin-automation');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Smartphone className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold">Decodo Mobile Proxy Setup</h1>
        </div>
        <p className="text-muted-foreground">
          Configure mobile proxy IPs for safe LinkedIn automation. Decodo provides real 4G/5G mobile IPs from carriers worldwide.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {currentStep > step ? <CheckCircle className="h-4 w-4" /> : step}
            </div>
            {step < 4 && (
              <div className={`w-12 h-1 mx-1 ${currentStep > step ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      <Tabs value={`step${currentStep}`} className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="step1" onClick={() => setCurrentStep(1)}>1. Create Account</TabsTrigger>
          <TabsTrigger value="step2" onClick={() => setCurrentStep(2)}>2. Get Credentials</TabsTrigger>
          <TabsTrigger value="step3" onClick={() => setCurrentStep(3)}>3. Configure</TabsTrigger>
          <TabsTrigger value="step4" onClick={() => setCurrentStep(4)}>4. Test & Save</TabsTrigger>
        </TabsList>

        <TabsContent value="step1" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Step 1: Create Your Decodo Account
              </CardTitle>
              <CardDescription>
                Sign up for Decodo mobile proxies (formerly Smartproxy)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  Use code <Badge variant="secondary" className="mx-1">MOBILE50</Badge> for 50% off your first purchase!
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="p-4 border rounded-lg space-y-3">
                  <h3 className="font-semibold">How to Sign Up:</h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Click the button below to open Decodo's mobile proxy page</li>
                    <li>Click "Start now" or "Get started"</li>
                    <li>Create an account with your email</li>
                    <li>Choose a mobile proxy plan (start with Pay-as-you-go at $2.25/GB)</li>
                    <li>Apply code <strong>MOBILE50</strong> at checkout for 50% off</li>
                    <li>Complete payment to activate your account</li>
                  </ol>
                </div>

                <div className="flex flex-col gap-3">
                  <Button 
                    size="lg" 
                    className="w-full"
                    onClick={() => window.open('https://decodo.com/proxies/mobile', '_blank')}
                    data-testid="button-open-decodo"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Decodo Mobile Proxies
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="outline"
                      onClick={() => copyToClipboard('MOBILE50', 'Discount code')}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Discount Code
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.open('https://help.decodo.com/docs/mobile-proxy-quick-start', '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Decodo Docs
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-end">
                <Button onClick={() => setCurrentStep(2)} data-testid="button-next-step1">
                  I've Created My Account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="step2" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Step 2: Get Your Proxy Credentials
              </CardTitle>
              <CardDescription>
                Find your username and password in the Decodo dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg space-y-3">
                <h3 className="font-semibold">Where to Find Your Credentials:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                  <li>Log in to <a href="https://dashboard.decodo.com" target="_blank" rel="noopener" className="text-primary underline">dashboard.decodo.com</a></li>
                  <li>Navigate to <strong>Residential</strong> → <strong>Mobile</strong> in the sidebar</li>
                  <li>Click on <strong>Proxy setup</strong> tab</li>
                  <li>Under "Authentication", you'll see your <strong>Username</strong> and <strong>Password</strong></li>
                  <li>Copy these credentials - you'll need them in the next step</li>
                </ol>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your username is usually in the format: <code className="bg-muted px-1 rounded">spXXXXXXXX</code> (starts with "sp")
                </AlertDescription>
              </Alert>

              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Quick Access:</h4>
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open('https://dashboard.decodo.com/residential/mobile/proxy-setup', '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Decodo Proxy Setup Page
                </Button>
              </div>

              <Separator />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Back
                </Button>
                <Button onClick={() => setCurrentStep(3)} data-testid="button-next-step2">
                  I Have My Credentials
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="step3" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Step 3: Enter Your Credentials
              </CardTitle>
              <CardDescription>
                Configure your Decodo proxy settings for IntelLead
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Decodo Username</Label>
                  <Input
                    id="username"
                    placeholder="spXXXXXXXX"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                    data-testid="input-decodo-username"
                  />
                  <p className="text-xs text-muted-foreground">Found in Dashboard → Mobile → Proxy setup</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Decodo Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Your proxy password"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                    data-testid="input-decodo-password"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="country">Target Country</Label>
                    <select
                      id="country"
                      className="w-full h-10 px-3 rounded-md border bg-background"
                      value={credentials.country}
                      onChange={(e) => setCredentials({ ...credentials, country: e.target.value })}
                      data-testid="select-decodo-country"
                    >
                      <option value="us">United States</option>
                      <option value="gb">United Kingdom</option>
                      <option value="ca">Canada</option>
                      <option value="au">Australia</option>
                      <option value="de">Germany</option>
                      <option value="fr">France</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="session">Sticky Session Duration</Label>
                    <select
                      id="session"
                      className="w-full h-10 px-3 rounded-md border bg-background"
                      value={credentials.sessionDuration}
                      onChange={(e) => setCredentials({ ...credentials, sessionDuration: e.target.value })}
                      data-testid="select-decodo-session"
                    >
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour (Recommended)</option>
                      <option value="120">2 hours</option>
                      <option value="480">8 hours</option>
                      <option value="1440">24 hours</option>
                    </select>
                    <p className="text-xs text-muted-foreground">Keeps the same IP for this duration</p>
                  </div>
                </div>
              </div>

              {credentials.username && (
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-2">
                  <h4 className="font-medium text-sm">Generated Proxy Configuration:</h4>
                  <div className="font-mono text-xs bg-background p-2 rounded border overflow-x-auto">
                    <p><strong>Host:</strong> gate.decodo.com</p>
                    <p><strong>Port:</strong> 7000</p>
                    <p><strong>Username:</strong> {buildProxyString()}</p>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  Back
                </Button>
                <Button 
                  onClick={() => setCurrentStep(4)} 
                  disabled={!credentials.username || !credentials.password}
                  data-testid="button-next-step3"
                >
                  Continue to Test
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="step4" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Step 4: Test & Save Configuration
              </CardTitle>
              <CardDescription>
                Verify your proxy works and save it for LinkedIn automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Test Proxy Connection</h3>
                    <p className="text-sm text-muted-foreground">
                      Verify your Decodo proxy is working before saving
                    </p>
                  </div>
                  <Button 
                    onClick={handleTestProxy} 
                    disabled={testing || !credentials.username || !credentials.password}
                    data-testid="button-test-proxy"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </Button>
                </div>

                {testResult && (
                  <Alert variant={testResult.success ? 'default' : 'destructive'}>
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <AlertDescription>
                      {testResult.success 
                        ? `Proxy working! Connected via IP: ${testResult.ip}`
                        : `Connection failed: ${testResult.error}`
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-semibold">Save to LinkedIn Automation</h3>
                <p className="text-sm text-muted-foreground">
                  Save this configuration to use with LinkedIn automation. Your credentials will be encrypted.
                </p>
                
                <Button 
                  size="lg"
                  className="w-full"
                  onClick={handleSaveToLinkedIn}
                  disabled={!credentials.username || !credentials.password}
                  data-testid="button-save-decodo"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Save & Enable for LinkedIn
                </Button>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setCurrentStep(3)}>
                  Back
                </Button>
                <Button variant="ghost" onClick={() => navigate('/linkedin-automation')}>
                  Skip for Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg">Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <a 
              href="https://help.decodo.com/docs/mobile-proxy-quick-start" 
              target="_blank" 
              rel="noopener"
              className="flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              <span>Decodo Quick Start Guide</span>
            </a>
            <a 
              href="https://help.decodo.com/docs/mobile-proxy-userpassword-authentication" 
              target="_blank" 
              rel="noopener"
              className="flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              <span>Authentication Guide</span>
            </a>
            <a 
              href="https://decodo.com/faq" 
              target="_blank" 
              rel="noopener"
              className="flex items-center gap-2 p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              <span>Decodo FAQ</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
