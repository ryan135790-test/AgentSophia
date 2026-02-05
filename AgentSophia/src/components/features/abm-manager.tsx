import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function ABMManager() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchAccounts();
    }
  }, [currentWorkspace?.id]);

  const fetchAccounts = async () => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/abm-accounts`);
      if (res.ok) {
        setAccounts(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const createABMCampaign = async () => {
    if (!currentWorkspace?.id) return;
    const res = await fetch(`/api/workspaces/${currentWorkspace.id}/abm-campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_ids: accounts.map((a) => a.id),
        campaign_name: 'Q1 2025 ABM Initiative',
        objectives: ['increase brand awareness', 'drive pipeline'],
        duration_days: 90,
        personalization_level: 'ultra_personalized',
        multi_threaded: true
      })
    });

    if (res.ok) {
      toast({ title: 'Success', description: 'ABM campaign created' });
    }
  };

  if (loading) return <div>Loading ABM accounts...</div>;

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50" data-testid="card-abm-overview">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Account-Based Marketing (ABM)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Orchestrate personalized, multi-threaded campaigns across target accounts
          </p>
          <Button onClick={createABMCampaign} className="w-full" data-testid="button-create-abm-campaign">
            <Users className="h-4 w-4 mr-2" />
            Create ABM Campaign
          </Button>
        </CardContent>
      </Card>

      {accounts.length > 0 && (
        <Card data-testid="card-target-accounts">
          <CardHeader>
            <CardTitle className="text-sm">Target Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="border rounded p-3" data-testid={`account-card-${account.id}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-sm">{account.company_name}</p>
                    <p className="text-xs text-muted-foreground">{account.industry}</p>
                  </div>
                  <Badge variant={account.engagement_level === 'very_high' ? 'default' : 'secondary'}>
                    {account.engagement_level}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-blue-600" />
                  <p className="text-xs">Health Score: {account.account_health_score}/100</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-abm-benefits">
        <CardHeader>
          <CardTitle className="text-sm">ABM Benefits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>✓ Multi-threaded campaigns across decision makers</p>
          <p>✓ Ultra-personalized messaging per account</p>
          <p>✓ Coordinated touchpoints across all channels</p>
          <p>✓ Account health scoring & engagement tracking</p>
        </CardContent>
      </Card>
    </div>
  );
}
