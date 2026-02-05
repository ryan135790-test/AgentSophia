// Modal to help users/admins configure OAuth for Gmail/Outlook
// Supports both user-level and domain-level OAuth

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Info, ExternalLink, CheckCircle2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OAuthSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'gmail' | 'outlook';
}

export function OAuthSetupModal({ isOpen, onClose, provider }: OAuthSetupModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const redirectUri = `${window.location.origin}/oauth/${provider}/callback`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: 'Copied!',
      description: 'Redirect URI copied to clipboard',
    });
  };

  const gmailSetupSteps = [
    {
      title: 'Create Google Cloud Project',
      description: 'Go to Google Cloud Console and create a new project or select existing one.',
      link: 'https://console.cloud.google.com',
    },
    {
      title: 'Enable Gmail API',
      description: 'In APIs & Services → Library, search for "Gmail API" and enable it.',
      link: 'https://console.cloud.google.com/apis/library',
    },
    {
      title: 'Configure OAuth Consent Screen',
      description: 'Set up OAuth consent screen with your app name and developer email. Choose "External" for user type.',
      link: 'https://console.cloud.google.com/apis/credentials/consent',
    },
    {
      title: 'Create OAuth Credentials',
      description: 'Go to Credentials → Create Credentials → OAuth client ID → Web application',
      link: 'https://console.cloud.google.com/apis/credentials',
    },
    {
      title: 'Add Redirect URI',
      description: `Add this exact redirect URI to your OAuth client:`,
      copyValue: redirectUri,
    },
    {
      title: 'Copy Client ID',
      description: 'Copy the Client ID and add it to your Replit Secrets as VITE_GMAIL_CLIENT_ID',
    },
  ];

  const outlookSetupSteps = [
    {
      title: 'Register Azure App',
      description: 'Go to Azure Portal → Azure Active Directory → App registrations → New registration',
      link: 'https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade',
    },
    {
      title: 'Configure Authentication',
      description: 'In Authentication → Add a platform → Web',
      link: 'https://portal.azure.com',
    },
    {
      title: 'Add Redirect URI',
      description: 'Add this exact redirect URI:',
      copyValue: redirectUri,
    },
    {
      title: 'Enable Tokens',
      description: 'In the same Authentication section, enable "Access tokens" and "ID tokens" under Implicit grant',
    },
    {
      title: 'Add API Permissions',
      description: 'Go to API permissions → Add permission → Microsoft Graph → Delegated → Add: Mail.Send, User.Read, offline_access',
    },
    {
      title: 'Copy Application ID',
      description: 'Go to Overview tab, copy the Application (client) ID and add it to Replit Secrets as VITE_OUTLOOK_CLIENT_ID',
    },
  ];

  const steps = provider === 'gmail' ? gmailSetupSteps : outlookSetupSteps;
  const providerName = provider === 'gmail' ? 'Gmail' : 'Outlook';

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Configure {providerName} OAuth
          </DialogTitle>
          <DialogDescription>
            Follow these steps to enable {providerName} OAuth for your SaaS platform
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="standard" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="standard">Standard Setup (Recommended)</TabsTrigger>
            <TabsTrigger value="enterprise">Enterprise Domain-Wide</TabsTrigger>
          </TabsList>

          {/* Standard User-Level OAuth */}
          <TabsContent value="standard" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>User-Level OAuth:</strong> Each user connects their own {providerName} account. Perfect for SaaS where users have different email providers.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium">{step.title}</h4>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    {step.link && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(step.link, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  {step.copyValue && (
                    <div className="ml-11 mt-2">
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-md font-mono text-sm">
                        <code className="flex-1 overflow-x-auto">{step.copyValue}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(step.copyValue!)}
                        >
                          {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>What happens next:</strong> After setup, each user will click "Connect {providerName}" and authorize with their own account. Their OAuth tokens are securely stored in your database per-user.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Enterprise Domain-Wide OAuth */}
          <TabsContent value="enterprise" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Domain-Wide OAuth:</strong> For Google Workspace or Microsoft 365 admins. Set up once for the entire organization domain.
              </AlertDescription>
            </Alert>

            {provider === 'gmail' ? (
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Google Workspace Domain-Wide Delegation</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Complete the standard setup first (previous tab)</li>
                    <li>Go to Google Admin Console → Security → API Controls → Domain-wide Delegation</li>
                    <li>Add your Client ID and authorize these scopes:
                      <code className="block ml-4 mt-1 p-2 bg-muted rounded text-xs">
                        https://www.googleapis.com/auth/gmail.send,
                        https://www.googleapis.com/auth/userinfo.email
                      </code>
                    </li>
                    <li>Enable service account and download the JSON key file</li>
                    <li>Upload the service account key to your Replit Secrets as GMAIL_SERVICE_ACCOUNT_KEY</li>
                  </ol>
                </div>

                <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> Domain-wide delegation requires Google Workspace (not available for personal Gmail accounts). Your organization's admin must approve the application.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Microsoft 365 Tenant-Wide Consent</h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Complete the standard setup first (previous tab)</li>
                    <li>In Azure AD → App registrations → Your app → API permissions</li>
                    <li>Click "Grant admin consent for [Your Organization]"</li>
                    <li>All users in your Microsoft 365 tenant will be pre-authorized</li>
                    <li>Configure app as multi-tenant in Authentication settings if needed</li>
                  </ol>
                </div>

                <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> Tenant-wide consent requires Microsoft 365 admin privileges. Users will still need to sign in once, but won't see a consent screen.
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onClose}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
