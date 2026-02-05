import { EmailConnectorSetup } from "@/components/agent-sophia/email-connector-setup";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Mail, Settings, Plug, ExternalLink, Info } from "lucide-react";
import { Link } from "react-router-dom";

export default function EmailSetup() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Email Setup</h1>
        <p className="text-muted-foreground">Connect your email accounts to enable Sophia's email management features</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Connect your personal email (Gmail/Outlook) for the Email Manager, or configure an email sending service for campaigns and automation.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="personal" data-testid="tab-personal-email">Personal Email</TabsTrigger>
          <TabsTrigger value="sending" data-testid="tab-sending-service">Sending Service</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Personal Email Connection
              </CardTitle>
              <CardDescription>
                Connect your Gmail or Outlook account so Sophia can read your inbox and draft AI-powered replies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your personal email connections are managed in the My Connections page. This allows Sophia to:
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Read and organize your inbox</li>
                <li>Draft AI-powered replies for your approval</li>
                <li>Send emails on your behalf after approval</li>
                <li>Schedule meetings based on email context</li>
              </ul>
              <div className="pt-4">
                <Link to="/my-connections">
                  <Button data-testid="button-go-to-connections">
                    <Plug className="h-4 w-4 mr-2" />
                    Go to My Connections
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Email Sending Service
              </CardTitle>
              <CardDescription>
                Configure an email service provider for bulk emails, campaigns, and automated sequences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailConnectorSetup />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
