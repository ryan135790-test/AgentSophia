import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Mail, CheckCircle2, XCircle, Loader2, ExternalLink } from 'lucide-react'
import { ConnectorService } from '@/lib/connector-service'
import { useToast } from '@/hooks/use-toast'
import { useWorkspace } from '@/contexts/WorkspaceContext'

export function EmailConnectorSetup() {
  const [provider, setProvider] = useState<'sendgrid' | 'resend'>('sendgrid')
  const [apiKey, setApiKey] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [fromName, setFromName] = useState('Agent Sophia')
  const [isConnected, setIsConnected] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const { currentWorkspace } = useWorkspace()
  const workspaceId = currentWorkspace?.id

  const handleTestConnection = async () => {
    if (!apiKey || !fromEmail) {
      toast({
        title: "Missing Information",
        description: "Please enter your API key and from email address",
        variant: "destructive"
      })
      return
    }

    setIsTesting(true)

    try {
      // Save the configuration first (workspace-scoped)
      if (!workspaceId) {
        toast({ title: "Error", description: "Please select a workspace first", variant: "destructive" })
        setIsTesting(false)
        return
      }
      await ConnectorService.saveUserConfig({
        emailProvider: provider,
        emailApiKey: apiKey,
        emailFromEmail: fromEmail,
        emailFromName: fromName
      }, workspaceId)

      // Test by sending a test email using existing connector test endpoint
      const response = await fetch('/api/connectors/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'email',
          config: {
            provider,
            apiKey,
            fromEmail,
            fromName
          },
          testRecipient: {
            email: fromEmail // Send test email to same address
          }
        })
      })

      if (!response.ok) {
        throw new Error('Connection test failed')
      }

      setIsConnected(true)
      toast({
        title: "✅ Email Connected!",
        description: `Agent Sophia can now send emails via ${provider === 'sendgrid' ? 'SendGrid' : 'Resend'}`,
      })
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Please check your API key and try again",
        variant: "destructive"
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSave = async () => {
    if (!apiKey || !fromEmail) {
      toast({
        title: "Missing Information",
        description: "Please enter your API key and from email address",
        variant: "destructive"
      })
      return
    }

    if (!workspaceId) {
      toast({ title: "Error", description: "Please select a workspace first", variant: "destructive" })
      return
    }

    setIsSaving(true)

    try {
      await ConnectorService.saveUserConfig({
        emailProvider: provider,
        emailApiKey: apiKey,
        emailFromEmail: fromEmail,
        emailFromName: fromName
      }, workspaceId)

      toast({
        title: "Settings Saved",
        description: "Email connector configuration has been saved",
      })
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getSetupInstructions = () => {
    if (provider === 'sendgrid') {
      return {
        title: "Get Your SendGrid API Key (Free 100 emails/day)",
        steps: [
          "1. Sign up at sendgrid.com (free account includes 100 emails/day)",
          "2. Go to Settings → API Keys",
          "3. Click 'Create API Key'",
          "4. Name it 'Agent Sophia' and select 'Full Access'",
          "5. Copy the API key and paste it below",
          "6. Verify your sender email address in SendGrid"
        ],
        link: "https://app.sendgrid.com/settings/api_keys"
      }
    } else {
      return {
        title: "Get Your Resend API Key (Free 3,000 emails/month)",
        steps: [
          "1. Sign up at resend.com (free account includes 3,000 emails/month)",
          "2. Go to API Keys section",
          "3. Click 'Create API Key'",
          "4. Name it 'Agent Sophia'",
          "5. Copy the API key and paste it below",
          "6. Add and verify your domain or use Resend's test domain"
        ],
        link: "https://resend.com/api-keys"
      }
    }
  }

  const instructions = getSetupInstructions()

  return (
    <Card data-testid="card-email-connector">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Email Connector - Easy Setup</CardTitle>
          </div>
          {isConnected && (
            <Badge variant="default" className="gap-1" data-testid="badge-email-connected">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          Connect your email provider in 3 minutes. Agent Sophia will send messages on your behalf.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="provider">Choose Email Provider (Recommended: SendGrid or Resend)</Label>
          <Select value={provider} onValueChange={(value: any) => setProvider(value)}>
            <SelectTrigger id="provider" data-testid="select-email-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sendgrid" data-testid="option-sendgrid">
                SendGrid (Free: 100 emails/day)
              </SelectItem>
              <SelectItem value="resend" data-testid="option-resend">
                Resend (Free: 3,000 emails/month)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Setup Instructions */}
        <Alert data-testid="alert-setup-instructions">
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{instructions.title}</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  onClick={() => window.open(instructions.link, '_blank')}
                  data-testid="button-open-provider"
                >
                  Open {provider === 'sendgrid' ? 'SendGrid' : 'Resend'}
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
              <ol className="text-sm space-y-1 text-muted-foreground">
                {instructions.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key *</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="Paste your API key here..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            data-testid="input-api-key"
          />
        </div>

        {/* From Email */}
        <div className="space-y-2">
          <Label htmlFor="fromEmail">From Email Address *</Label>
          <Input
            id="fromEmail"
            type="email"
            placeholder="your-email@company.com"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            data-testid="input-from-email"
          />
          <p className="text-xs text-muted-foreground">
            This email must be verified in your {provider === 'sendgrid' ? 'SendGrid' : 'Resend'} account
          </p>
        </div>

        {/* From Name */}
        <div className="space-y-2">
          <Label htmlFor="fromName">From Name (Optional)</Label>
          <Input
            id="fromName"
            type="text"
            placeholder="Agent Sophia"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            data-testid="input-from-name"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={handleTestConnection}
            disabled={isTesting || !apiKey || !fromEmail}
            className="flex-1"
            variant="outline"
            data-testid="button-test-connection"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                {isConnected ? <CheckCircle2 className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Test Connection
              </>
            )}
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving || !apiKey || !fromEmail}
            className="flex-1"
            data-testid="button-save-email-config"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </div>

        {isConnected && (
          <Alert className="bg-green-50 border-green-200" data-testid="alert-success">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>🎉 Email Connected!</strong><br />
              Agent Sophia can now send automated emails to your leads.
              Test email sent to {fromEmail}.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
