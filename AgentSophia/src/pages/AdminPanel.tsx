import { useState } from 'react';
import { Key, Database, Shield, Brain, Zap, TrendingUp, Building2, Check, X, ExternalLink, Settings, Bot, Mail, Linkedin, Phone, Eye, EyeOff, Copy, Pencil, Share2, ChevronDown, ChevronUp, Facebook, Twitter, Instagram, Info, AlertTriangle } from 'lucide-react';
import { SophiaAdminBrainPanel } from '@/components/agent-sophia/sophia-admin-brain-panel';
import { SophiaAutoActionsPanel } from '@/components/agent-sophia/sophia-auto-actions-panel';
import { SophiaPredictivePanel } from '@/components/agent-sophia/sophia-predictive-panel';
import { WorkspaceAdminManagement } from '@/components/admin/workspace-admin-management';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { SiOpenai, SiGoogle, SiTiktok } from 'react-icons/si';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface SystemIntegration {
  id: string;
  name: string;
  description: string;
  category: 'ai' | 'communication' | 'auth' | 'data';
  icon: any;
  iconColor: string;
  status: 'connected' | 'not_configured' | 'error';
  envVar: string;
  lastUpdated?: string;
  docsUrl?: string;
}

const systemIntegrations: SystemIntegration[] = [
  {
    id: 'openai',
    name: 'OpenAI (GPT-4o)',
    description: 'Powers Sophia\'s AI reasoning, content generation, and lead analysis',
    category: 'ai',
    icon: SiOpenai,
    iconColor: 'text-emerald-600',
    status: 'connected',
    envVar: 'OPENAI_API_KEY',
    lastUpdated: '2025-11-15',
    docsUrl: 'https://platform.openai.com/docs'
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    description: 'Secondary AI model for consensus voting and fallback reasoning',
    category: 'ai',
    icon: Bot,
    iconColor: 'text-orange-500',
    status: 'connected',
    envVar: 'ANTHROPIC_API_KEY',
    lastUpdated: '2025-11-20',
    docsUrl: 'https://docs.anthropic.com'
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'User authentication and session management',
    category: 'auth',
    icon: Database,
    iconColor: 'text-green-600',
    status: 'connected',
    envVar: 'VITE_SUPABASE_URL',
    lastUpdated: '2025-10-01',
    docsUrl: 'https://supabase.com/docs'
  },
  {
    id: 'gmail',
    name: 'Gmail API',
    description: 'Send and receive emails through connected Gmail accounts',
    category: 'communication',
    icon: Mail,
    iconColor: 'text-red-500',
    status: 'connected',
    envVar: 'GMAIL_CLIENT_ID',
    lastUpdated: '2025-11-10',
    docsUrl: 'https://developers.google.com/gmail/api'
  },
  {
    id: 'outlook',
    name: 'Microsoft Outlook / Office 365',
    description: 'Send and receive emails, calendar sync, and Microsoft Teams integration',
    category: 'communication',
    icon: Mail,
    iconColor: 'text-blue-500',
    status: 'connected',
    envVar: 'OUTLOOK_CLIENT_ID',
    lastUpdated: '2025-12-01',
    docsUrl: 'https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview'
  },
  {
    id: 'heyreach',
    name: 'Heyreach (LinkedIn)',
    description: 'LinkedIn automation - connection requests, messages, and engagement',
    category: 'communication',
    icon: Linkedin,
    iconColor: 'text-blue-600',
    status: 'not_configured',
    envVar: 'HEYREACH_API_KEY',
    docsUrl: 'https://heyreach.io/docs'
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS messaging and phone call automation',
    category: 'communication',
    icon: Phone,
    iconColor: 'text-red-600',
    status: 'not_configured',
    envVar: 'TWILIO_AUTH_TOKEN',
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Meeting scheduling and calendar sync',
    category: 'communication',
    icon: SiGoogle,
    iconColor: 'text-blue-500',
    status: 'connected',
    envVar: 'VITE_GOOGLE_CLIENT_ID',
    lastUpdated: '2025-11-10',
    docsUrl: 'https://developers.google.com/calendar'
  },
];

export default function AdminPanel() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'workspaces' | 'api' | 'social-apis' | 'data' | 'sophia-brain' | 'auto-actions' | 'predictive'>('workspaces');

  const handleConfigureIntegration = (integration: SystemIntegration) => {
    if (integration.status === 'connected') {
      toast({ 
        title: 'Update Credentials', 
        description: `To update ${integration.name} credentials, go to the Secrets panel and modify ${integration.envVar}.` 
      });
    } else {
      toast({ 
        title: 'Configure Integration', 
        description: `Add ${integration.envVar} to your Secrets panel to enable ${integration.name}.` 
      });
    }
  };

  const handleExportData = () => {
    toast({ title: 'Export Started', description: 'Your data export is being prepared. You will be notified when ready.' });
  };

  const handleDeleteWorkspace = () => {
    if (confirm('Are you sure you want to delete this workspace? This action cannot be undone and will permanently remove all data.')) {
      toast({ title: 'Workspace Deletion', description: 'Workspace deletion has been initiated', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
          <p className="text-slate-600 mt-2">Manage workspace, members, and integrations</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="flex border-b border-slate-200 overflow-x-auto">
            {[
              { id: 'workspaces', label: 'Workspaces', icon: Building2 },
              { id: 'sophia-brain', label: 'Sophia\'s Brain', icon: Brain },
              { id: 'auto-actions', label: 'Auto-Actions', icon: Zap },
              { id: 'predictive', label: 'Predictive AI', icon: TrendingUp },
              { id: 'api', label: 'Platform Integrations', icon: Settings },
              { id: 'social-apis', label: 'Social Media APIs', icon: Share2 },
              { id: 'data', label: 'Data & Export', icon: Database },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`px-6 py-4 flex items-center gap-2 font-medium transition ${
                  activeTab === id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                data-testid={`tab-${id}`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Workspaces Management */}
            {activeTab === 'workspaces' && (
              <WorkspaceAdminManagement />
            )}

            {/* Platform Integrations */}
            {activeTab === 'api' && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-slate-900">Platform Integrations</h3>
                  <p className="text-sm text-slate-600 mt-1">System-wide API connections that power Agent Sophia</p>
                </div>

                {/* AI Services */}
                <div>
                  <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">AI Services</h4>
                  <div className="grid gap-3">
                    {systemIntegrations.filter(i => i.category === 'ai').map((integration) => {
                      const IconComponent = integration.icon;
                      return (
                        <div
                          key={integration.id}
                          className="border border-slate-200 rounded-lg p-4"
                          data-testid={`integration-${integration.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg bg-slate-100 ${integration.iconColor}`}>
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-slate-900">{integration.name}</h4>
                                {integration.status === 'connected' ? (
                                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" /> Connected
                                  </span>
                                ) : integration.status === 'error' ? (
                                  <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                    <X className="w-3 h-3" /> Error
                                  </span>
                                ) : (
                                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Not Configured</span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600">{integration.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {integration.docsUrl && (
                                <a
                                  href={integration.docsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded transition"
                                  title="View Documentation"
                                  data-testid={`link-docs-${integration.id}`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                onClick={() => handleConfigureIntegration(integration)}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                                  integration.status === 'connected' 
                                    ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' 
                                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                }`}
                                data-testid={`button-configure-${integration.id}`}
                              >
                                {integration.status === 'connected' ? 'Manage' : 'Configure'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                            <span>Secret: <code className="bg-slate-50 px-1.5 py-0.5 rounded">{integration.envVar}</code></span>
                            {integration.lastUpdated && (
                              <span>Last updated: {integration.lastUpdated}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Communication Services */}
                <div>
                  <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Communication Channels</h4>
                  <div className="grid gap-3">
                    {systemIntegrations.filter(i => i.category === 'communication').map((integration) => {
                      const IconComponent = integration.icon;
                      return (
                        <div
                          key={integration.id}
                          className="border border-slate-200 rounded-lg p-4"
                          data-testid={`integration-${integration.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg bg-slate-100 ${integration.iconColor}`}>
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-slate-900">{integration.name}</h4>
                                {integration.status === 'connected' ? (
                                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" /> Connected
                                  </span>
                                ) : integration.status === 'error' ? (
                                  <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                    <X className="w-3 h-3" /> Error
                                  </span>
                                ) : (
                                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Not Configured</span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600">{integration.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {integration.docsUrl && (
                                <a
                                  href={integration.docsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded transition"
                                  title="View Documentation"
                                  data-testid={`link-docs-${integration.id}`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                onClick={() => handleConfigureIntegration(integration)}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                                  integration.status === 'connected' 
                                    ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' 
                                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                }`}
                                data-testid={`button-configure-${integration.id}`}
                              >
                                {integration.status === 'connected' ? 'Manage' : 'Configure'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                            <span>Secret: <code className="bg-slate-50 px-1.5 py-0.5 rounded">{integration.envVar}</code></span>
                            {integration.lastUpdated && (
                              <span>Last updated: {integration.lastUpdated}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Authentication Services */}
                <div>
                  <h4 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Authentication & Data</h4>
                  <div className="grid gap-3">
                    {systemIntegrations.filter(i => i.category === 'auth' || i.category === 'data').map((integration) => {
                      const IconComponent = integration.icon;
                      return (
                        <div
                          key={integration.id}
                          className="border border-slate-200 rounded-lg p-4"
                          data-testid={`integration-${integration.id}`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg bg-slate-100 ${integration.iconColor}`}>
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-slate-900">{integration.name}</h4>
                                {integration.status === 'connected' ? (
                                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    <Check className="w-3 h-3" /> Connected
                                  </span>
                                ) : integration.status === 'error' ? (
                                  <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                    <X className="w-3 h-3" /> Error
                                  </span>
                                ) : (
                                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Not Configured</span>
                                )}
                              </div>
                              <p className="text-sm text-slate-600">{integration.description}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {integration.docsUrl && (
                                <a
                                  href={integration.docsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded transition"
                                  title="View Documentation"
                                  data-testid={`link-docs-${integration.id}`}
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                onClick={() => handleConfigureIntegration(integration)}
                                className={`px-3 py-1.5 text-xs font-medium rounded transition ${
                                  integration.status === 'connected' 
                                    ? 'text-slate-600 bg-slate-100 hover:bg-slate-200' 
                                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                }`}
                                data-testid={`button-configure-${integration.id}`}
                              >
                                {integration.status === 'connected' ? 'Manage' : 'Configure'}
                              </button>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                            <span>Secret: <code className="bg-slate-50 px-1.5 py-0.5 rounded">{integration.envVar}</code></span>
                            {integration.lastUpdated && (
                              <span>Last updated: {integration.lastUpdated}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                  <div className="flex items-start gap-3">
                    <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-blue-900">Secure Configuration</h4>
                      <p className="text-sm text-blue-800 mt-1">
                        API keys are stored as encrypted environment variables and never exposed in the UI. 
                        To update credentials, use the Secrets panel in your project settings.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data & Export */}
            {activeTab === 'data' && (
              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 mb-6">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-amber-900">Caution</h4>
                    <p className="text-sm text-amber-800">These actions cannot be undone</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-lg p-4">
                    <h4 className="font-medium text-slate-900 mb-2">Export Workspace Data</h4>
                    <p className="text-sm text-slate-600 mb-4">Download all contacts, campaigns, and analytics</p>
                    <button
                      onClick={handleExportData}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition"
                      data-testid="button-export-data"
                    >
                      Export as CSV
                    </button>
                  </div>
                  <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <h4 className="font-medium text-red-900 mb-2">Delete Workspace</h4>
                    <p className="text-sm text-red-700 mb-4">Permanently delete all workspace data</p>
                    <button
                      onClick={handleDeleteWorkspace}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition"
                      data-testid="button-delete-workspace"
                    >
                      Delete Workspace
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sophia's Brain Control Panel */}
            {activeTab === 'sophia-brain' && (
              <SophiaAdminBrainPanel workspaceId={currentWorkspace?.id || ''} />
            )}

            {/* Auto-Actions Panel */}
            {activeTab === 'auto-actions' && (
              <SophiaAutoActionsPanel />
            )}

            {/* Predictive AI Panel */}
            {activeTab === 'predictive' && (
              <SophiaPredictivePanel />
            )}

            {/* Social Media APIs */}
            {activeTab === 'social-apis' && (
              <div className="space-y-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-slate-900">Social Media API Configuration</h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Configure OAuth credentials to enable user social media connections. Once set up, users can connect their personal accounts via My Connections.
                  </p>
                </div>

                {/* Important Notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-amber-900">Developer Account Required</h4>
                      <p className="text-sm text-amber-800 mt-1">
                        Each platform requires you to register as a developer and create an app. This is free for LinkedIn and Twitter, 
                        but Facebook/Instagram and TikTok may require business verification. Approval times vary from instant to several weeks.
                      </p>
                    </div>
                  </div>
                </div>

                {/* How to Add Secrets */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-blue-900">How to Add Credentials Securely</h4>
                      <ol className="text-sm text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                        <li>Get your Client ID and Client Secret from the platform's developer portal</li>
                        <li>In Replit, click the <strong>"Secrets"</strong> tab (lock icon) in the left sidebar</li>
                        <li>Add each credential as a new secret with the exact key names shown below</li>
                        <li>Secrets are encrypted and never exposed in code or logs</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Platform Setup Instructions */}
                <Accordion type="single" collapsible className="space-y-3">
                  {/* LinkedIn */}
                  <AccordionItem value="linkedin" className="border border-slate-200 rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100">
                          <Linkedin className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium text-slate-900">LinkedIn</h4>
                          <p className="text-xs text-slate-500">Connection requests, messages, profile views</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                        <div>
                          <h5 className="font-medium text-slate-800 mb-2">Step-by-Step Setup</h5>
                          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>Go to <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">linkedin.com/developers/apps</a></li>
                            <li>Click "Create App" and fill in your app details</li>
                            <li>Associate the app with a LinkedIn Company Page (required)</li>
                            <li>Go to the "Auth" tab and copy your <strong>Client ID</strong> and <strong>Client Secret</strong></li>
                            <li>Add your redirect URL: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">https://YOUR_DOMAIN/auth/linkedin/callback</code></li>
                            <li>Request the "Sign In with LinkedIn using OpenID Connect" product</li>
                          </ol>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <h5 className="font-medium text-slate-800 mb-2">Required Secrets</h5>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-200 px-2 py-1 rounded text-xs font-mono">VITE_LINKEDIN_CLIENT_ID</code>
                              <span className="text-xs text-slate-500">→ Your LinkedIn Client ID</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-200 px-2 py-1 rounded text-xs font-mono">LINKEDIN_CLIENT_SECRET</code>
                              <span className="text-xs text-slate-500">→ Your LinkedIn Client Secret</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                          Approval time: Usually instant after associating with a Company Page
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Twitter/X */}
                  <AccordionItem value="twitter" className="border border-slate-200 rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-sky-100">
                          <Twitter className="w-5 h-5 text-sky-500" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium text-slate-900">Twitter / X</h4>
                          <p className="text-xs text-slate-500">Tweet posting, engagement, DMs</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                        <div>
                          <h5 className="font-medium text-slate-800 mb-2">Step-by-Step Setup</h5>
                          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>Go to <a href="https://developer.twitter.com/en/portal/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developer.twitter.com</a></li>
                            <li>Sign up for a Developer account (Free tier available)</li>
                            <li>Create a new Project and App</li>
                            <li>Go to "Keys and Tokens" and generate your API keys</li>
                            <li>Enable OAuth 2.0 in "User authentication settings"</li>
                            <li>Add callback URL: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">https://YOUR_DOMAIN/auth/twitter/callback</code></li>
                          </ol>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <h5 className="font-medium text-slate-800 mb-2">Required Secrets</h5>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-200 px-2 py-1 rounded text-xs font-mono">TWITTER_CLIENT_ID</code>
                              <span className="text-xs text-slate-500">→ OAuth 2.0 Client ID</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-200 px-2 py-1 rounded text-xs font-mono">TWITTER_CLIENT_SECRET</code>
                              <span className="text-xs text-slate-500">→ OAuth 2.0 Client Secret</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                          Approval time: Instant for Free tier, 1-2 days for elevated access
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Facebook */}
                  <AccordionItem value="facebook" className="border border-slate-200 rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100">
                          <Facebook className="w-5 h-5 text-blue-700" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium text-slate-900">Facebook</h4>
                          <p className="text-xs text-slate-500">Page posting, engagement, insights</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                        <div>
                          <h5 className="font-medium text-slate-800 mb-2">Step-by-Step Setup</h5>
                          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>Go to <a href="https://developers.facebook.com/apps/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developers.facebook.com</a></li>
                            <li>Create a new app (select "Business" type)</li>
                            <li>Add "Facebook Login" product to your app</li>
                            <li>Go to Settings → Basic to get App ID and App Secret</li>
                            <li>Add OAuth redirect: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">https://YOUR_DOMAIN/auth/facebook/callback</code></li>
                            <li>Submit for App Review to go live (required for production)</li>
                          </ol>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <h5 className="font-medium text-slate-800 mb-2">Required Secrets</h5>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-200 px-2 py-1 rounded text-xs font-mono">FACEBOOK_APP_ID</code>
                              <span className="text-xs text-slate-500">→ Your Facebook App ID</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-200 px-2 py-1 rounded text-xs font-mono">FACEBOOK_APP_SECRET</code>
                              <span className="text-xs text-slate-500">→ Your Facebook App Secret</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                          Approval time: Development mode works immediately. App Review for production can take 1-4 weeks.
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Instagram */}
                  <AccordionItem value="instagram" className="border border-slate-200 rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-pink-100">
                          <Instagram className="w-5 h-5 text-pink-600" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium text-slate-900">Instagram</h4>
                          <p className="text-xs text-slate-500">Business account posting (via Facebook API)</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                        <div className="text-sm text-slate-600 bg-blue-50 p-3 rounded border border-blue-200">
                          <strong>Note:</strong> Instagram API requires a Facebook App. Instagram posting only works for Instagram Business or Creator accounts linked to a Facebook Page.
                        </div>
                        <div>
                          <h5 className="font-medium text-slate-800 mb-2">Step-by-Step Setup</h5>
                          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>First, set up a Facebook App (see Facebook instructions above)</li>
                            <li>Add "Instagram Graph API" product to your Facebook app</li>
                            <li>Link your Instagram Business account to a Facebook Page</li>
                            <li>Request <code className="bg-slate-200 px-1 rounded text-xs">instagram_basic</code> and <code className="bg-slate-200 px-1 rounded text-xs">instagram_content_publish</code> permissions</li>
                            <li>Submit for App Review</li>
                          </ol>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <h5 className="font-medium text-slate-800 mb-2">Required Secrets</h5>
                          <p className="text-sm text-slate-500">Uses the same Facebook App credentials (FACEBOOK_APP_ID, FACEBOOK_APP_SECRET)</p>
                        </div>
                        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                          Approval time: Requires business verification. Can take 2-6 weeks for full approval.
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* TikTok */}
                  <AccordionItem value="tiktok" className="border border-slate-200 rounded-lg overflow-hidden">
                    <AccordionTrigger className="px-4 py-3 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-900">
                          <SiTiktok className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                          <h4 className="font-medium text-slate-900">TikTok</h4>
                          <p className="text-xs text-slate-500">Video posting, engagement tracking</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="bg-slate-50 rounded-lg p-4 space-y-4">
                        <div>
                          <h5 className="font-medium text-slate-800 mb-2">Step-by-Step Setup</h5>
                          <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                            <li>Go to <a href="https://developers.tiktok.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developers.tiktok.com</a></li>
                            <li>Register as a TikTok developer</li>
                            <li>Create a new app under "Manage Apps"</li>
                            <li>Request access to "Content Posting API" (requires approval)</li>
                            <li>Once approved, get your Client Key and Client Secret</li>
                            <li>Add redirect: <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">https://YOUR_DOMAIN/auth/tiktok/callback</code></li>
                          </ol>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <h5 className="font-medium text-slate-800 mb-2">Required Secrets</h5>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-200 px-2 py-1 rounded text-xs font-mono">TIKTOK_CLIENT_KEY</code>
                              <span className="text-xs text-slate-500">→ Your TikTok Client Key</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <code className="bg-slate-200 px-2 py-1 rounded text-xs font-mono">TIKTOK_CLIENT_SECRET</code>
                              <span className="text-xs text-slate-500">→ Your TikTok Client Secret</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                          Approval time: Content Posting API requires business approval. Can take 2-8 weeks.
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Summary Table */}
                <div className="mt-6">
                  <h4 className="font-medium text-slate-800 mb-3">Quick Reference: All Required Secrets</h4>
                  <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-slate-700">Platform</th>
                          <th className="text-left px-4 py-2 font-medium text-slate-700">Secret Key</th>
                          <th className="text-left px-4 py-2 font-medium text-slate-700">Difficulty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="px-4 py-2 text-slate-600">LinkedIn</td>
                          <td className="px-4 py-2"><code className="text-xs bg-slate-200 px-1 rounded">VITE_LINKEDIN_CLIENT_ID</code>, <code className="text-xs bg-slate-200 px-1 rounded">LINKEDIN_CLIENT_SECRET</code></td>
                          <td className="px-4 py-2"><span className="text-green-600 text-xs font-medium">Easy</span></td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-600">Twitter/X</td>
                          <td className="px-4 py-2"><code className="text-xs bg-slate-200 px-1 rounded">TWITTER_CLIENT_ID</code>, <code className="text-xs bg-slate-200 px-1 rounded">TWITTER_CLIENT_SECRET</code></td>
                          <td className="px-4 py-2"><span className="text-green-600 text-xs font-medium">Easy</span></td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-600">Facebook</td>
                          <td className="px-4 py-2"><code className="text-xs bg-slate-200 px-1 rounded">FACEBOOK_APP_ID</code>, <code className="text-xs bg-slate-200 px-1 rounded">FACEBOOK_APP_SECRET</code></td>
                          <td className="px-4 py-2"><span className="text-amber-600 text-xs font-medium">Moderate</span></td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-600">Instagram</td>
                          <td className="px-4 py-2 text-slate-500 italic">Uses Facebook credentials</td>
                          <td className="px-4 py-2"><span className="text-amber-600 text-xs font-medium">Moderate</span></td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-slate-600">TikTok</td>
                          <td className="px-4 py-2"><code className="text-xs bg-slate-200 px-1 rounded">TIKTOK_CLIENT_KEY</code>, <code className="text-xs bg-slate-200 px-1 rounded">TIKTOK_CLIENT_SECRET</code></td>
                          <td className="px-4 py-2"><span className="text-red-600 text-xs font-medium">Hard</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
                  <div className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium text-green-900">Recommendation: Start with LinkedIn</h4>
                      <p className="text-sm text-green-800 mt-1">
                        LinkedIn is the easiest to set up and most valuable for B2B outreach. Twitter is also quick. 
                        Facebook/Instagram and TikTok require more extensive approval processes.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
