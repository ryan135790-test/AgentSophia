import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink,
  Mail,
  Calendar,
  Users,
  FileText,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getOffice365Config, disconnectOffice365, getValidAccessToken, saveOffice365ConfigSync } from "@/lib/office365-auth";
import { ConnectorService } from "@/lib/connector-service";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export function Office365Connector() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionEmail, setConnectionEmail] = useState("");
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;

  // Check if Office 365 is already connected (loads from database if needed)
  // Now validates token and auto-refreshes if expired (workspace-scoped)
  const checkConnection = async () => {
    if (!workspaceId) {
      setIsConnected(false);
      return false;
    }
    try {
      const config = await getOffice365Config(workspaceId);
      console.log('Checking connection - has config:', !!config);
      
      if (!config || !config.accessToken || !config.email) {
        setIsConnected(false);
        return false;
      }
      
      // Validate the token by getting a valid access token (auto-refreshes if expired)
      const validToken = await getValidAccessToken(workspaceId);
      
      if (!validToken) {
        console.warn('Token validation failed - marking as disconnected');
        setIsConnected(false);
        setConnectionEmail("");
        return false;
      }
      
      console.log('✅ Office 365 connection valid');
      setIsConnected(true);
      setConnectionEmail(config.email);
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      setIsConnected(false);
      setConnectionEmail("");
      return false;
    }
  };

  useEffect(() => {
    checkConnection();
  }, [workspaceId]);

  const handleConnect = () => {
    // Microsoft Graph OAuth 2.0 flow
    const clientId = import.meta.env.VITE_OFFICE365_CLIENT_ID;
    
    if (!clientId) {
      toast({
        title: "Configuration Required",
        description: "Please configure your Microsoft Azure App in environment variables. See setup guide below.",
        variant: "destructive",
      });
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

    // Set up message listener for OAuth callback
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === 'office365_connected') {
        const tokenData = event.data.data;
        
        // Use synchronous save for immediate localStorage update (workspace-scoped)
        saveOffice365ConfigSync(tokenData, workspaceId);
        console.log('Saved Office 365 config to parent window localStorage');
        
        // Also save to database asynchronously (workspace-scoped)
        if (workspaceId) {
          ConnectorService.saveUserConfig({
            emailProvider: 'outlook',
            emailAccessToken: tokenData.accessToken,
            emailRefreshToken: tokenData.refreshToken,
            emailTokenExpiry: tokenData.expiresAt,
            emailUserEmail: tokenData.email,
          }, workspaceId).then(() => {
            console.log('✅ Successfully saved Office 365 tokens to Supabase database');
          }).catch(error => {
            console.error('Failed to save tokens to Supabase:', error);
            // Continue anyway - tokens are in localStorage
          });
        }
        
        setIsConnected(true);
        setConnectionEmail(tokenData.email);
        checkConnection();
        
        toast({
          title: "Connected!",
          description: `Successfully connected to Office 365 as ${tokenData.displayName}`,
        });
        
        window.removeEventListener('message', handleMessage);
      } else if (event.data.type === 'office365_error') {
        toast({
          title: "Connection Failed",
          description: event.data.error || 'Failed to connect to Office 365',
          variant: "destructive",
        });
        
        window.removeEventListener('message', handleMessage);
      }
    };

    window.addEventListener('message', handleMessage);

    // Open OAuth popup
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      authUrl,
      'Office 365 Authorization',
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  const handleDisconnect = async () => {
    await disconnectOffice365(workspaceId);
    setIsConnected(false);
    setConnectionEmail("");
    
    toast({
      title: "Disconnected",
      description: "Office 365 integration has been disconnected.",
    });
  };

  const testConnection = async () => {
    setIsLoading(true);
    
    try {
      const config = await getOffice365Config();
      console.log('Testing connection - config found:', !!config);
      
      if (!config) {
        throw new Error('No configuration found. Please reconnect your Office 365 account.');
      }

      console.log('Parsed config - has accessToken:', !!config.accessToken);
      
      // Get valid access token (automatically refreshes if expired)
      const accessToken = await getValidAccessToken();
      if (!accessToken) {
        throw new Error('Access token missing or expired. Please reconnect your Office 365 account.');
      }

      // Test by fetching user profile
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Microsoft Graph API error:', response.status, errorText);
        throw new Error('Authentication failed. Please reconnect your Office 365 account.');
      }

      const user = await response.json();

      toast({
        title: "Connection Successful!",
        description: `Connected as ${user.displayName} (${user.mail || user.userPrincipalName})`,
      });

      setConnectionEmail(user.mail || user.userPrincipalName);
    } catch (error) {
      console.error('Test connection error:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to Office 365",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card data-testid="card-office365-connector">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.5 10.5h-11v-11c0-.276-.224-.5-.5-.5h-11c-.276 0-.5.224-.5.5v11c0 .276.224.5.5.5h11v11c0 .276.224.5.5.5h11c.276 0 .5-.224.5-.5v-11c0-.276-.224-.5-.5-.5z" fill="#EA3E23"/>
              </svg>
              <span>Office 365 Integration</span>
            </CardTitle>
            <CardDescription>
              Connect Agent Sophia to your Microsoft 365 account for full automation
            </CardDescription>
          </div>
          {isConnected && (
            <Badge className="bg-green-500 text-white" data-testid="badge-connected">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Status */}
        {isConnected ? (
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">
                  Connected to Office 365
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {connectionEmail}
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={testConnection}
                disabled={isLoading}
                data-testid="button-test-connection"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Test Connection"
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                data-testid="button-disconnect"
              >
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Connect your Microsoft 365 account to enable Agent Sophia to send emails,
                book meetings, and manage your calendar automatically.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleConnect}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
              data-testid="button-connect-office365"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Connect to Office 365
            </Button>
          </div>
        )}

        {!isConnected && (
          <>
            <Separator />

            {/* Setup Instructions - Collapsed when connected */}
            <Accordion type="single" collapsible defaultValue="setup-instructions">
              <AccordionItem value="setup-instructions">
                <AccordionTrigger className="text-sm font-medium">
                  Setup Instructions & Features
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {/* Features */}
                    <div>
                      <h4 className="font-medium mb-3">Agent Sophia will be able to:</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center space-x-2 p-3 border rounded-lg">
                          <Mail className="h-4 w-4 text-primary" />
                          <span className="text-sm">Send Emails via Outlook</span>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg">
                          <Calendar className="h-4 w-4 text-primary" />
                          <span className="text-sm">Book Calendar Meetings</span>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="text-sm">Sync Contacts</span>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-lg">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="text-sm">Read Inbox Responses</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Setup Instructions */}
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center space-x-2">
                        <span>⚙️ Setup Instructions</span>
                      </h4>
                      <div className="text-sm text-muted-foreground space-y-2 bg-muted p-4 rounded-lg">
                        <p className="font-medium">Before connecting, you need to create a Microsoft Azure App:</p>
                        <ol className="list-decimal list-inside space-y-1 ml-2">
                          <li>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Azure App Registrations</a></li>
                          <li>Click "New registration"</li>
                          <li>Name: "Agent Sophia Office 365"</li>
                          <li>Supported account types: "Accounts in any organizational directory and personal Microsoft accounts"</li>
                          <li>Redirect URI: Web → <code className="bg-background px-1 rounded">{window.location.origin}/oauth/office365/callback</code></li>
                          <li>Click "Register"</li>
                          <li>Copy the "Application (client) ID"</li>
                          <li>Go to "Certificates & secrets" → "New client secret" → Copy the value</li>
                          <li>Go to "API permissions" → Add: <code className="bg-background px-1 rounded">Mail.Send, Mail.Read, Calendars.ReadWrite, Contacts.ReadWrite</code></li>
                          <li>Add environment variables in Replit: <code className="bg-background px-1 rounded">VITE_OFFICE365_CLIENT_ID</code> and <code className="bg-background px-1 rounded">OFFICE365_CLIENT_SECRET</code></li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
}
