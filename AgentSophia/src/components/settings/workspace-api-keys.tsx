import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  Key, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  Loader2, 
  ExternalLink,
  Sparkles,
  Mail,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Shield,
  MessageCircle
} from 'lucide-react';

interface WorkspaceApiKeysProps {
  workspaceId: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  type: 'ai' | 'email' | 'messaging';
  description: string;
  pricing: string;
  signupUrl: string;
  keyPrefix: string;
  recommended?: boolean;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'OPENAI_API_KEY',
    name: 'OpenAI',
    type: 'ai',
    description: 'GPT-4o for AI content generation',
    pricing: '$2.50-$10 per 1M tokens',
    signupUrl: 'https://platform.openai.com/api-keys',
    keyPrefix: 'sk-',
    recommended: true
  },
  {
    id: 'ANTHROPIC_API_KEY',
    name: 'Anthropic',
    type: 'ai',
    description: 'Claude for advanced reasoning',
    pricing: '$3-$15 per 1M tokens',
    signupUrl: 'https://console.anthropic.com',
    keyPrefix: 'sk-ant-'
  },
  {
    id: 'RESEND_API_KEY',
    name: 'Resend',
    type: 'email',
    description: 'Modern email API with React Email support',
    pricing: '$20/mo for 50K emails',
    signupUrl: 'https://resend.com/api-keys',
    keyPrefix: 're_',
    recommended: true
  },
  {
    id: 'SENDGRID_API_KEY',
    name: 'SendGrid',
    type: 'email',
    description: 'Full-featured email platform',
    pricing: 'Free 100/day, then $20+/mo',
    signupUrl: 'https://app.sendgrid.com/settings/api_keys',
    keyPrefix: 'SG.'
  },
  {
    id: 'POSTMARK_API_KEY',
    name: 'Postmark',
    type: 'email',
    description: 'Fast transactional email delivery',
    pricing: '$15/mo for 10K emails',
    signupUrl: 'https://account.postmarkapp.com/api_tokens',
    keyPrefix: ''
  },
  {
    id: 'WHATSAPP_ACCESS_TOKEN',
    name: 'WhatsApp Business',
    type: 'messaging',
    description: 'Meta WhatsApp Business API for 90%+ open rates',
    pricing: 'Free 1K convos/mo, then $0.01-$0.08/convo',
    signupUrl: 'https://developers.facebook.com/apps',
    keyPrefix: 'EAA',
    recommended: true
  }
];

interface UsageData {
  period: string;
  ai: { requests: number; tokens: number; estimatedCost: string };
  email: { sent: number; estimatedCost: string };
}

export function WorkspaceApiKeys({ workspaceId }: WorkspaceApiKeysProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [configuredKeys, setConfiguredKeys] = useState<Record<string, { configured: boolean; masked?: string }>>({});
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [workspaceId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [keysRes, usageRes] = await Promise.all([
        fetch(`/api/workspace/${workspaceId}/api-keys`),
        fetch(`/api/workspace/${workspaceId}/usage`)
      ]);

      if (keysRes.ok) {
        const keysData = await keysRes.json();
        const keyMap: Record<string, { configured: boolean; masked?: string }> = {};
        keysData.keys?.forEach((k: any) => {
          keyMap[k.provider] = { configured: k.configured, masked: k.maskedKey };
        });
        setConfiguredKeys(keyMap);
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
    } catch (error) {
      console.error('Failed to fetch API key data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (provider: string) => {
    if (!keyValue.trim()) {
      toast({ title: 'Error', description: 'Please enter an API key', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: keyValue })
      });

      if (!res.ok) throw new Error('Failed to save key');

      toast({ title: 'Success', description: `${provider} API key saved` });
      setEditingKey(null);
      setKeyValue('');
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save API key', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestKey = async (provider: string) => {
    setTesting(provider);
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/api-keys/${provider}/test`, {
        method: 'POST'
      });

      const data = await res.json();
      if (data.valid) {
        toast({ title: 'Success', description: `${provider} API key is valid!` });
      } else {
        toast({ title: 'Invalid Key', description: data.error || 'Key verification failed', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to test API key', variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    try {
      const res = await fetch(`/api/workspace/${workspaceId}/api-keys/${provider}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete key');

      toast({ title: 'Removed', description: `${provider} API key removed` });
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove API key', variant: 'destructive' });
    }
  };

  const renderProviderCard = (provider: ProviderConfig) => {
    const isConfigured = configuredKeys[provider.id]?.configured;
    const isEditing = editingKey === provider.id;
    const isTesting = testing === provider.id;

    return (
      <Card key={provider.id} className={`relative ${isConfigured ? 'border-green-500/50' : ''}`}>
        {provider.recommended && (
          <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500">
            Recommended
          </Badge>
        )}
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {provider.type === 'ai' ? (
                <Sparkles className="h-5 w-5 text-purple-500" />
              ) : provider.type === 'messaging' ? (
                <MessageCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Mail className="h-5 w-5 text-blue-500" />
              )}
              <CardTitle className="text-lg">{provider.name}</CardTitle>
            </div>
            {isConfigured ? (
              <Badge variant="outline" className="text-green-600 border-green-500">
                <Check className="h-3 w-3 mr-1" /> Connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Not configured
              </Badge>
            )}
          </div>
          <CardDescription>{provider.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pricing:</span>
            <span className="font-medium">{provider.pricing}</span>
          </div>

          {isConfigured && !isEditing && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
              <Key className="h-4 w-4 text-muted-foreground" />
              <code className="text-sm flex-1">{configuredKeys[provider.id]?.masked}</code>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder={`Enter ${provider.name} API key (${provider.keyPrefix}...)`}
                  className="pr-10"
                  data-testid={`input-api-key-${provider.id}`}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleSaveKey(provider.id)}
                  disabled={saving}
                  data-testid={`button-save-key-${provider.id}`}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Save Key
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingKey(null); setKeyValue(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {isConfigured ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestKey(provider.id)}
                    disabled={isTesting}
                    data-testid={`button-test-key-${provider.id}`}
                  >
                    {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Test
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingKey(provider.id)}
                    data-testid={`button-update-key-${provider.id}`}
                  >
                    Update
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteKey(provider.id)}
                    data-testid={`button-delete-key-${provider.id}`}
                  >
                    Remove
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={() => setEditingKey(provider.id)}
                    data-testid={`button-add-key-${provider.id}`}
                  >
                    <Key className="h-4 w-4 mr-1" />
                    Add Key
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(provider.signupUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Get Key
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const aiProviders = PROVIDERS.filter(p => p.type === 'ai');
  const emailProviders = PROVIDERS.filter(p => p.type === 'email');
  const messagingProviders = PROVIDERS.filter(p => p.type === 'messaging');

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-purple-500" />
            <CardTitle>Workspace API Keys</CardTitle>
          </div>
          <CardDescription>
            Configure your own API keys for AI and Email providers. You pay your providers directly - no middleman fees.
          </CardDescription>
        </CardHeader>
        {usage && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-background rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">AI Usage</span>
                </div>
                <div className="text-2xl font-bold">{usage.ai.requests.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{usage.ai.tokens.toLocaleString()} tokens</div>
                <div className="text-sm text-green-600 mt-1">{usage.ai.estimatedCost}</div>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">Emails Sent</span>
                </div>
                <div className="text-2xl font-bold">{usage.email.sent.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">This month</div>
                <div className="text-sm text-green-600 mt-1">{usage.email.estimatedCost}</div>
              </div>
              <div className="p-4 bg-background rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Period</span>
                </div>
                <div className="text-lg font-bold">{usage.period}</div>
                <div className="text-xs text-muted-foreground">Current billing period</div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Providers
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Providers
          </TabsTrigger>
          <TabsTrigger value="messaging" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Messaging
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiProviders.map(renderProviderCard)}
          </div>
          <Card className="mt-4 bg-blue-500/5 border-blue-500/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Note: Agent Sophia Core AI</p>
                  <p className="text-sm text-muted-foreground">
                    Sophia's core functions (intent detection, learning engine) use the platform's AI. 
                    Your workspace keys are used for user-initiated AI operations like content generation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {emailProviders.map(renderProviderCard)}
          </div>
        </TabsContent>

        <TabsContent value="messaging" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {messagingProviders.map(renderProviderCard)}
          </div>
          <Card className="mt-4 bg-green-500/5 border-green-500/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <MessageCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">WhatsApp Business API</p>
                  <p className="text-sm text-muted-foreground">
                    WhatsApp has 90%+ open rates. You'll need a Meta Business account and approved business 
                    phone number. First 1,000 conversations per month are free.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
