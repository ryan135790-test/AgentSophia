import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Shield, AlertTriangle, CheckCircle, Linkedin, Eye, EyeOff, RefreshCw, Zap, Cookie } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';

interface LinkedInSessionCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSessionCaptured: () => void;
  isReauthentication?: boolean;
}

type Step = 'credentials' | 'connecting' | '2fa' | 'success' | 'error';
type LoginMethod = 'auto' | 'manual';

export function LinkedInSessionCapture({ open, onOpenChange, onSessionCaptured, isReauthentication = false }: LinkedInSessionCaptureProps) {
  const [method, setMethod] = useState<LoginMethod>('auto');
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorType, setTwoFactorType] = useState<string>('');
  const [manualCookie, setManualCookie] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (open) {
      setMethod('auto');
      setStep('credentials');
      setEmail('');
      setPassword('');
      setTwoFactorCode('');
      setManualCookie('');
      setError(null);
      setProgress(0);
      setStatusMessage('');
    }
  }, [open]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your LinkedIn email and password');
      return;
    }

    if (!currentWorkspace) {
      setError('No workspace selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStep('connecting');
    setProgress(10);
    setStatusMessage('Starting secure connection...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      setProgress(30);
      setStatusMessage('Connecting to LinkedIn...');

      const response = await fetch('/api/linkedin-automation/auto-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      if (data.requiresTwoFactor) {
        setStep('2fa');
        setTwoFactorType(data.twoFactorType || 'authenticator');
        setProgress(60);
        setStatusMessage('Waiting for verification code...');
        setIsSubmitting(false);
        return;
      }

      if (data.success) {
        setProgress(100);
        setStep('success');
        toast({
          title: isReauthentication ? 'Session Refreshed!' : 'LinkedIn Connected!',
          description: isReauthentication 
            ? 'Your LinkedIn session has been refreshed successfully.'
            : `Connected as ${data.profileName || 'LinkedIn User'}`,
        });

        setTimeout(() => {
          onSessionCaptured();
          onOpenChange(false);
        }, 2000);
      } else {
        throw new Error(data.message || 'Login failed');
      }

    } catch (err: any) {
      console.error('Error during login:', err);
      setError(err.message);
      setStep('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit2FA = async () => {
    if (!twoFactorCode.trim()) {
      setError('Please enter your verification code');
      return;
    }

    if (!currentWorkspace) {
      setError('No workspace selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setProgress(80);
    setStatusMessage('Verifying code...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/linkedin-automation/submit-2fa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          code: twoFactorCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      if (data.requiresTwoFactor) {
        setError(data.message || 'Invalid code. Please try again.');
        setTwoFactorCode('');
        setIsSubmitting(false);
        return;
      }

      if (data.success) {
        setProgress(100);
        setStep('success');
        toast({
          title: isReauthentication ? 'Session Refreshed!' : 'LinkedIn Connected!',
          description: isReauthentication 
            ? 'Your LinkedIn session has been refreshed successfully.'
            : `Connected as ${data.profileName || 'LinkedIn User'}`,
        });

        setTimeout(() => {
          onSessionCaptured();
          onOpenChange(false);
        }, 2000);
      } else {
        throw new Error(data.message || 'Verification failed');
      }

    } catch (err: any) {
      console.error('Error submitting 2FA:', err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (currentWorkspace) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await fetch('/api/linkedin-automation/cancel-login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ workspace_id: currentWorkspace.id }),
          });
        }
      } catch {}
    }
    onOpenChange(false);
  };

  const handleManualSubmit = async () => {
    if (!manualCookie.trim()) {
      setError('Please paste your LinkedIn session token');
      return;
    }

    if (!currentWorkspace) {
      setError('No workspace selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setStep('connecting');
    setProgress(10);
    setStatusMessage('Preparing cookies...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Convert simple li_at token to cookie format, or pass JSON as-is
      let cookiesData = manualCookie.trim();
      
      // Check if it's NOT JSON (just a plain token string)
      if (!cookiesData.startsWith('[') && !cookiesData.startsWith('{')) {
        // It's a simple li_at token - convert to cookie format
        cookiesData = JSON.stringify([{
          name: 'li_at',
          value: cookiesData,
          domain: '.linkedin.com',
          path: '/',
          secure: true,
          httpOnly: true,
        }]);
      }

      setProgress(30);
      setStatusMessage('Validating session through secure proxy...');

      // Use the new proxy-validated endpoint
      const response = await fetch('/api/linkedin-automation/connect-with-cookies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          cookies: cookiesData,
        }),
      });

      setProgress(80);
      setStatusMessage('Processing response...');

      const data = await response.json();

      if (!response.ok || !data.success) {
        setStep('credentials');
        throw new Error(data.error || 'Failed to validate session through proxy');
      }

      setManualCookie('');
      setProgress(100);
      setStep('success');
      
      const proxyMessage = data.proxyUsed 
        ? ` Validated through proxy ${data.proxyUsed.host}:${data.proxyUsed.port}.`
        : '';
      
      toast({
        title: 'LinkedIn Connected!',
        description: `Session validated successfully.${proxyMessage}`,
      });

      setTimeout(() => {
        onSessionCaptured();
        onOpenChange(false);
      }, 2000);

    } catch (err: any) {
      console.error('Error validating manual session:', err);
      
      // Parse structured error codes for better user feedback
      const errorMessage = err.message || 'Validation failed';
      let userFriendlyMessage = errorMessage;
      
      if (errorMessage.includes('PROXY_ALLOCATION_FAILED')) {
        userFriendlyMessage = 'Unable to allocate a secure proxy. Please try again or contact support.';
      } else if (errorMessage.includes('COOKIES_INVALID')) {
        userFriendlyMessage = 'Your cookies appear to be expired or invalid. Please export fresh cookies from LinkedIn.';
      } else if (errorMessage.includes('PROXY_TIMEOUT')) {
        userFriendlyMessage = 'The connection timed out. Please try again.';
      } else if (errorMessage.includes('PROXY_CONNECTION_FAILED')) {
        userFriendlyMessage = 'Could not connect through the secure proxy. Please try again.';
      } else if (errorMessage.includes('VALIDATION_ERROR')) {
        userFriendlyMessage = errorMessage.replace('VALIDATION_ERROR: ', '');
      }
      
      setError(userFriendlyMessage);
      setStep('credentials');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
              <Linkedin className="h-4 w-4 text-white" />
            </div>
            {isReauthentication ? 'Refresh LinkedIn Connection' : 'Connect LinkedIn'}
          </DialogTitle>
          <DialogDescription>
            {isReauthentication 
              ? 'Re-enter your credentials to refresh your session'
              : 'Sign in to connect your LinkedIn account for AI-powered automation'}
          </DialogDescription>
        </DialogHeader>

        {(step === 'connecting' || step === 'success') && (
          <Progress value={progress} className="mb-4" />
        )}

        {step === 'credentials' && (
          <Tabs value={method} onValueChange={(v) => { setMethod(v as LoginMethod); setError(null); }} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="auto" className="gap-2" data-testid="tab-auto-login">
                <Zap className="h-3 w-3" />
                Quick Login
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2" data-testid="tab-manual-login">
                <Cookie className="h-3 w-3" />
                Manual Session
              </TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="linkedin-email">LinkedIn Email</Label>
                <Input
                  id="linkedin-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting}
                  data-testid="input-linkedin-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="linkedin-password">LinkedIn Password</Label>
                <div className="relative">
                  <Input
                    id="linkedin-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    data-testid="input-linkedin-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <Shield className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  Your credentials are used once to log in and are never stored. 
                  We only save an encrypted session token.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleCancel} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button 
                  onClick={handleLogin} 
                  disabled={isSubmitting || !email.trim() || !password.trim()}
                  className="gap-2"
                  data-testid="button-connect-linkedin"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Linkedin className="h-4 w-4" />
                      Connect LinkedIn
                    </>
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="manual" className="space-y-4">
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <Shield className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-1">Maximum Security Option</p>
                  <p>Your credentials never touch our servers. We validate your session through the same secure proxy used for scraping to ensure IP consistency.</p>
                </div>
              </div>

              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium">How to export your LinkedIn cookies:</p>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                  <li>Install <a href="https://chromewebstore.google.com/detail/cookie-getter-for-linkedi/immmieibmckdaddedcnmmbececcdkkga" target="_blank" rel="noopener" className="text-blue-600 underline">Cookie Getter for LinkedIn</a></li>
                  <li>Go to <a href="https://www.linkedin.com" target="_blank" rel="noopener" className="text-blue-600 underline">linkedin.com</a> and make sure you're logged in</li>
                  <li>Click the extension icon</li>
                  <li>Copy the <strong>entire JSON</strong> that appears</li>
                </ol>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-cookies">Session Cookies (JSON)</Label>
                <Textarea
                  id="manual-cookies"
                  placeholder='Paste the JSON from Cookie Getter, e.g. {"li_at":"...","JSESSIONID":"..."}'
                  value={manualCookie}
                  onChange={(e) => setManualCookie(e.target.value)}
                  disabled={isSubmitting}
                  className="font-mono text-xs h-20"
                  data-testid="input-manual-cookies"
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-manual">
                  Cancel
                </Button>
                <Button 
                  onClick={handleManualSubmit} 
                  disabled={isSubmitting || !manualCookie.trim()}
                  className="gap-2"
                  data-testid="button-save-manual-session"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" />
                      Validate & Connect
                    </>
                  )}
                </Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        )}

        {step === 'connecting' && (
          <div className="py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-blue-500" />
            <p className="font-medium">{statusMessage || 'Connecting to LinkedIn...'}</p>
            <p className="text-sm text-muted-foreground mt-1">This may take a few seconds</p>
          </div>
        )}

        {step === '2fa' && (
          <div className="space-y-4 py-2">
            <div className="text-center mb-4">
              <div className="h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3">
                <Shield className="h-6 w-6 text-amber-600" />
              </div>
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground mt-1">
                {twoFactorType === 'sms' && 'Enter the code sent to your phone'}
                {twoFactorType === 'email' && 'Enter the code sent to your email'}
                {twoFactorType === 'authenticator' && 'Enter the code from your authenticator app'}
                {!twoFactorType && 'Enter your verification code'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="2fa-code">Verification Code</Label>
              <Input
                id="2fa-code"
                type="text"
                placeholder="Enter 6-digit code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isSubmitting}
                className="text-center text-lg tracking-widest"
                maxLength={6}
                data-testid="input-2fa-code"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-2fa">
                Cancel
              </Button>
              <Button 
                onClick={handleSubmit2FA} 
                disabled={isSubmitting || twoFactorCode.length < 6}
                className="gap-2"
                data-testid="button-verify-2fa"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'success' && (
          <div className="py-12 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <p className="font-medium text-lg">
              {isReauthentication ? 'Session Refreshed!' : 'LinkedIn Connected!'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {isReauthentication 
                ? 'Your session has been refreshed. Automation can continue.'
                : "You're all set. Agent Sophia can now automate your LinkedIn outreach."}
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="py-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <p className="font-medium text-lg">Connection Failed</p>
            <p className="text-sm text-muted-foreground">{error}</p>
            <DialogFooter className="justify-center">
              <Button variant="outline" onClick={handleCancel} data-testid="button-close-error">
                Close
              </Button>
              <Button onClick={() => setStep('credentials')} className="gap-2" data-testid="button-try-again">
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface LinkedInSessionHealthProps {
  onReauthenticate: () => void;
  accountId?: string | null;
}

export function LinkedInSessionHealth({ onReauthenticate, accountId }: LinkedInSessionHealthProps) {
  const { currentWorkspace } = useWorkspace();
  const [health, setHealth] = useState<{
    status: 'healthy' | 'warning' | 'expired' | 'error' | 'not_connected' | 'loading';
    message: string;
    needsAuthentication: boolean;
    daysUntilExpiry?: number;
  }>({ status: 'loading', message: 'Checking...', needsAuthentication: false });

  useEffect(() => {
    checkHealth();
  }, [currentWorkspace?.id, accountId]);

  const checkHealth = async () => {
    if (!currentWorkspace?.id) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const params = new URLSearchParams({ workspace_id: currentWorkspace.id });
      if (accountId) params.set('account_id', accountId);
      
      const response = await fetch(`/api/linkedin-automation/session-health?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHealth(data);
      }
    } catch (error) {
      console.error('Error checking session health:', error);
    }
  };

  if (health.status === 'loading') {
    return null;
  }

  if (health.status === 'healthy' || health.status === 'not_connected') {
    return null;
  }

  return (
    <Alert 
      className={
        health.status === 'expired' || health.status === 'error'
          ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800'
          : 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800'
      }
    >
      <AlertTriangle className={`h-4 w-4 ${
        health.status === 'expired' || health.status === 'error' ? 'text-red-600' : 'text-amber-600'
      }`} />
      <AlertDescription className="flex items-center justify-between">
        <span className={
          health.status === 'expired' || health.status === 'error' 
            ? 'text-red-800 dark:text-red-200' 
            : 'text-amber-800 dark:text-amber-200'
        }>
          {health.message}
        </span>
        {health.needsAuthentication && (
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onReauthenticate}
            className="ml-4 shrink-0"
            data-testid="button-reauth-linkedin"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh Session
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
