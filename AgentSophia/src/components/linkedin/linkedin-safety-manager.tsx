import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Linkedin, ArrowRight, Info } from 'lucide-react';

export function LinkedInSafetyManager() {
  const handleNavigateToConnectors = () => {
    // Navigate to connectors page
    window.dispatchEvent(new CustomEvent('navigate', { detail: 'connectors' }));
  };

  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Linkedin className="h-6 w-6 text-[#0A66C2]" />
            LinkedIn Integration
          </CardTitle>
          <CardDescription>
            Manage your LinkedIn account connections and automation settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>LinkedIn settings have moved!</strong>
              <p className="mt-2">
                All LinkedIn connection and configuration settings are now centrally managed in the Connectors section, 
                along with all other channel integrations (Email, SMS, Phone, Social Media).
              </p>
            </AlertDescription>
          </Alert>

          <div className="p-6 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold mb-2">Set Up LinkedIn</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your LinkedIn account to enable automated outreach, connection requests, 
              and messaging campaigns through the Connectors page.
            </p>
            <Button 
              className="bg-[#0A66C2] hover:bg-[#004182]"
              onClick={handleNavigateToConnectors}
            >
              Go to Connectors
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">OAuth Connection</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Securely connect your LinkedIn account with one-click OAuth authentication
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Safety Limits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Configure daily activity limits and warm-up schedules to protect your account
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Use LinkedIn in multi-channel campaigns with AI-generated personalized messages
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
