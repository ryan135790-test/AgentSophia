import { Mail, Linkedin, Calendar, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  status: 'connected' | 'disconnected' | 'pending';
  setupUrl?: string;
  actions: string[];
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send and receive emails, track opens and clicks',
    icon: <Mail className="w-6 h-6" />,
    status: 'disconnected',
    setupUrl: '/oauth/gmail',
    actions: ['Send emails', 'Receive replies', 'Track opens', 'Sync contacts'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Send connection requests, messages, and posts',
    icon: <Linkedin className="w-6 h-6" />,
    status: 'disconnected',
    setupUrl: '/oauth/linkedin',
    actions: ['Send invites', 'Send messages', 'Post content', 'Track engagement'],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    description: 'Manage meetings and schedule availability',
    icon: <Calendar className="w-6 h-6" />,
    status: 'disconnected',
    setupUrl: '/oauth/calendar',
    actions: ['Book meetings', 'Check availability', 'Send invites', 'Auto-schedule'],
  },
];

export default function IntegrationSetup() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS);
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (id: string) => {
    setConnecting(id);
    // Simulate OAuth flow
    setTimeout(() => {
      setIntegrations((prev) =>
        prev.map((int) =>
          int.id === id ? { ...int, status: 'connected' as const } : int
        )
      );
      setConnecting(null);
    }, 2000);
  };

  const handleDisconnect = (id: string) => {
    setIntegrations((prev) =>
      prev.map((int) =>
        int.id === id ? { ...int, status: 'disconnected' as const } : int
      )
    );
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Integrations</h1>
          <p className="text-slate-600 mt-2">Connect your tools to expand Agent Sophia's capabilities</p>
        </div>

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-900">Secure OAuth connections</h3>
            <p className="text-sm text-blue-800">
              Your credentials are encrypted and never stored. OAuth tokens refresh automatically.
            </p>
          </div>
        </div>

        {/* Integration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration) => (
            <div
              key={integration.id}
              className="bg-white rounded-lg shadow hover:shadow-lg transition"
              data-testid={`integration-card-${integration.id}`}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-3 rounded-lg ${
                    integration.status === 'connected'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {integration.icon}
                  </div>
                  {integration.status === 'connected' && (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">{integration.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{integration.description}</p>
              </div>

              {/* Actions */}
              <div className="p-6 bg-slate-50">
                <p className="text-xs font-semibold text-slate-600 mb-3">CAPABILITIES</p>
                <ul className="space-y-2 mb-4">
                  {integration.actions.map((action) => (
                    <li key={action} className="text-sm text-slate-700 flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-blue-600" />
                      {action}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Buttons */}
              <div className="p-6 border-t border-slate-200">
                {integration.status === 'connected' ? (
                  <div className="space-y-2">
                    <button
                      className="w-full px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg font-medium hover:bg-green-100 transition"
                      data-testid={`button-settings-${integration.id}`}
                    >
                      Connected ✓
                    </button>
                    <button
                      onClick={() => handleDisconnect(integration.id)}
                      className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition"
                      data-testid={`button-disconnect-${integration.id}`}
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleConnect(integration.id)}
                    disabled={connecting === integration.id}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition disabled:opacity-50"
                    data-testid={`button-connect-${integration.id}`}
                  >
                    {connecting === integration.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        Connect
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Connected Services Summary */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Connected Services</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {integrations
              .filter((i) => i.status === 'connected')
              .map((int) => (
                <div key={int.id} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="font-medium text-green-900">{int.name}</p>
                  <p className="text-sm text-green-700 mt-1">Connected and active</p>
                </div>
              ))}
            {integrations.filter((i) => i.status === 'connected').length === 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg col-span-3">
                <p className="text-slate-600">No integrations connected yet. Connect services above to get started.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
