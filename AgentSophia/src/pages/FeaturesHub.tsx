import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Zap, Mail, Users, TrendingUp, Settings, Layers, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Feature {
  id: string;
  name: string;
  description: string;
  category: 'communication' | 'analytics' | 'automation' | 'management' | 'integration';
  icon: typeof Zap;
  enabled: boolean;
  tier?: 'free' | 'pro' | 'enterprise';
  component?: string;
}

const ALL_FEATURES: Feature[] = [
  // Communication
  { id: 'auto-reply', name: 'Auto-Reply Configuration', description: 'Configure intelligent auto-responses for different intents', category: 'communication', icon: Mail, enabled: true, tier: 'pro' },
  { id: 'email-sync', name: 'Email Sync (Two-Way)', description: 'Real-time email synchronization and conversation history', category: 'communication', icon: Mail, enabled: true, tier: 'pro' },
  { id: 'email-sms', name: 'Email/SMS Sender', description: 'Direct email and SMS campaign capabilities', category: 'communication', icon: Mail, enabled: true, tier: 'pro' },
  { id: 'social-media', name: 'Social Media Manager', description: 'LinkedIn automation and social post scheduling', category: 'communication', icon: Zap, enabled: true, tier: 'enterprise' },
  { id: 'email-assistant', name: 'Email Assistant', description: 'AI-powered email composition and subject line optimization', category: 'communication', icon: Mail, enabled: true, tier: 'pro' },

  // Analytics & Intelligence
  { id: 'advanced-reporting', name: 'Advanced Reporting', description: 'Custom dashboards, pipeline visualization, ROI tracking', category: 'analytics', icon: TrendingUp, enabled: true, tier: 'enterprise' },
  { id: 'analytics-dashboard', name: 'Analytics Dashboard', description: 'Real-time metrics and comprehensive analytics', category: 'analytics', icon: TrendingUp, enabled: true, tier: 'pro' },
  { id: 'deal-forecasting', name: 'Deal Forecasting', description: 'AI-powered pipeline prediction and revenue forecasting', category: 'analytics', icon: TrendingUp, enabled: true, tier: 'enterprise' },
  { id: 'conversation-analyzer', name: 'Conversation Analyzer', description: 'Sentiment analysis and conversation insights', category: 'analytics', icon: TrendingUp, enabled: true, tier: 'pro' },

  // Automation & Workflow
  { id: 'workflow-triggers', name: 'Workflow Triggers', description: 'Event-based automation and custom workflows', category: 'automation', icon: Zap, enabled: true, tier: 'pro' },
  { id: 'approval-queue', name: 'Approval Workflow', description: 'Multi-stage approval process for campaigns', category: 'automation', icon: Zap, enabled: true, tier: 'enterprise' },
  { id: 'quick-commands', name: 'Quick Commands', description: 'Shortcut commands for Sophia automation', category: 'automation', icon: Zap, enabled: true, tier: 'pro' },
  { id: 'automation-controls', name: 'Automation Controls', description: 'Advanced workflow and trigger management', category: 'automation', icon: Zap, enabled: true, tier: 'enterprise' },

  // Lead Management
  { id: 'lead-enrichment', name: 'Lead Enrichment', description: 'Auto-enrich contact data with company information', category: 'management', icon: Users, enabled: true, tier: 'pro' },
  { id: 'abm', name: 'Account-Based Marketing (ABM)', description: 'High-value account targeting and personalization', category: 'management', icon: Users, enabled: true, tier: 'enterprise' },
  { id: 'content-generator', name: 'Content Generator', description: 'AI-generated content across multiple formats', category: 'management', icon: Layers, enabled: true, tier: 'enterprise' },

  // Configuration & Setup
  { id: 'crm-integrations', name: 'CRM Integrations', description: 'Salesforce, HubSpot, Pipedrive sync', category: 'integration', icon: Settings, enabled: true, tier: 'enterprise' },
  { id: 'brand-voice', name: 'Brand Voice Manager', description: 'Define company tone and messaging guidelines', category: 'integration', icon: Settings, enabled: true, tier: 'pro' },
  { id: 'ai-tuning', name: 'AI Fine-Tuning', description: 'Customize Sophia behavior and learning', category: 'integration', icon: Settings, enabled: true, tier: 'pro' },
  { id: 'calendar-manager', name: 'Calendar Manager', description: 'Meeting management and calendar integration', category: 'integration', icon: Settings, enabled: true, tier: 'pro' },
  { id: 'team-management', name: 'Team Management', description: 'Add/remove team members and assign roles', category: 'integration', icon: Settings, enabled: true, tier: 'pro' },
];

const CATEGORY_CONFIG = {
  communication: { label: 'Communication & Outreach', color: 'bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800' },
  analytics: { label: 'Analytics & Intelligence', color: 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' },
  automation: { label: 'Automation & Workflow', color: 'bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800' },
  management: { label: 'Lead & Contact Management', color: 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800' },
  integration: { label: 'Configuration & Integrations', color: 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800' },
};

export default function FeaturesHub() {
  const { toast } = useToast();
  const [features, setFeatures] = useState<Feature[]>(ALL_FEATURES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/features');
      if (!res.ok) throw new Error('Failed to fetch features');
      const data = await res.json();
      setFeatures(data.features || ALL_FEATURES);
    } catch (error) {
      console.log('Using default features');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (featureId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });

      if (!res.ok) throw new Error('Failed to update feature');

      setFeatures(features.map(f => f.id === featureId ? { ...f, enabled } : f));
      toast({ title: 'Success', description: `Feature ${enabled ? 'enabled' : 'disabled'}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const groupedFeatures = features.reduce((acc, feature) => {
    if (!acc[feature.category]) acc[feature.category] = [];
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Layers className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Features Hub</h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">Manage which features are available for your workspace. Enable or disable features based on your needs.</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{features.filter(f => f.enabled).length}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Features Enabled</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-600">{features.filter(f => f.tier === 'enterprise').length}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Enterprise Features</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">{Object.keys(groupedFeatures).length}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">Categories</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Features by Category */}
      <div className="space-y-8">
        {Object.entries(groupedFeatures).map(([category, cats]) => (
          <div key={category}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.label}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cats.map(feature => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.id} className={`${CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]?.color} border`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <CardTitle className="text-base">{feature.name}</CardTitle>
                            <CardDescription className="text-xs mt-1">{feature.description}</CardDescription>
                          </div>
                        </div>
                        <Switch
                          checked={feature.enabled}
                          onCheckedChange={(enabled) => toggleFeature(feature.id, enabled)}
                          disabled={loading}
                          data-testid={`toggle-feature-${feature.id}`}
                        />
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        {feature.tier && (
                          <Badge variant={feature.tier === 'enterprise' ? 'default' : feature.tier === 'pro' ? 'secondary' : 'outline'}>
                            {feature.tier === 'enterprise' ? (
                              <><Lock className="w-2.5 h-2.5 mr-1" /> Enterprise</>
                            ) : (
                              feature.tier.charAt(0).toUpperCase() + feature.tier.slice(1)
                            )}
                          </Badge>
                        )}
                        <span className={`text-xs font-medium ${feature.enabled ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {feature.enabled ? '✓ Active' : '○ Inactive'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="mt-12 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-900 dark:text-blue-100">
          💡 <strong>Tip:</strong> Disabled features won't appear in the UI or be available to your team. Changes apply immediately to all workspace members.
        </p>
      </div>
    </div>
  );
}
