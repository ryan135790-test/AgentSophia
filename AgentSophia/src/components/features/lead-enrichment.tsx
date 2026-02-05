import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function LeadEnrichment() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [enriching, setEnriching] = useState(false);

  const enrichLead = async () => {
    if (!currentWorkspace?.id) return;
    setEnriching(true);
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/lead-enrichment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: 'demo-123',
          company_name: 'Acme Corp',
          industry: 'SaaS',
          intent_score: 85,
          buying_signals: ['budget approved', 'decision made']
        })
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Lead enriched with data' });
      }
    } finally {
      setEnriching(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50" data-testid="card-lead-enrichment-demo">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Lead Enrichment & Intent Signals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded p-3 bg-white">
              <p className="text-xs text-muted-foreground">Company Data</p>
              <p className="font-medium text-sm mt-1">Acme Corp</p>
              <p className="text-xs text-muted-foreground">SaaS • 150+ employees</p>
            </div>
            <div className="border rounded p-3 bg-white">
              <p className="text-xs text-muted-foreground">Intent Score</p>
              <p className="font-medium text-lg mt-1">85/100</p>
              <Badge variant="default" className="mt-1">Very High</Badge>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Buying Signals Detected</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" data-testid="badge-signal-budget">Budget Approved</Badge>
              <Badge variant="outline" data-testid="badge-signal-decision">Decision Made</Badge>
              <Badge variant="outline" data-testid="badge-signal-urgent">Urgent</Badge>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Tech Stack</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">Salesforce</Badge>
              <Badge variant="secondary">Slack</Badge>
              <Badge variant="secondary">HubSpot</Badge>
            </div>
          </div>

          <Button onClick={enrichLead} disabled={enriching} className="w-full" data-testid="button-enrich-lead">
            <TrendingUp className="h-4 w-4 mr-2" />
            {enriching ? 'Enriching...' : 'Enrich This Lead'}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-enrichment-features">
        <CardHeader>
          <CardTitle className="text-sm">Features</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-blue-600" />
              <span>Real-time company data enrichment from 50+ sources</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-blue-600" />
              <span>Automated buying signal detection & urgency scoring</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-blue-600" />
              <span>Job change alerts & decision-maker identification</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
