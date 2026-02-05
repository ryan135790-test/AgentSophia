import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, TrendingUp } from 'lucide-react';

interface CampaignOutcomeLoggerProps {
  campaignId: string;
  campaignName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (outcome: any) => void;
}

export function CampaignOutcomeLogger({ campaignId, campaignName, open, onOpenChange, onSubmit }: CampaignOutcomeLoggerProps) {
  const [outcome, setOutcome] = useState<'success' | 'partial' | 'failure'>('success');
  const [engagement, setEngagement] = useState('42');
  const [conversion, setConversion] = useState('8');
  const [revenue, setRevenue] = useState('5000');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sophia/log-campaign-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaignId,
          audience: 'B2B SaaS Decision Makers',
          channels: ['email', 'linkedin'],
          messaging: 'ROI-focused',
          timing: 'Tuesday-Thursday',
          outcome,
          engagement_rate: parseFloat(engagement),
          conversion_rate: parseFloat(conversion),
          revenue: parseFloat(revenue)
        })
      });

      if (res.ok) {
        onOpenChange(false);
        onSubmit?.({ outcome, engagement, conversion, revenue });
      }
    } catch (error) {
      console.error('Error logging outcome:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            Log Campaign Outcome
          </DialogTitle>
          <DialogDescription>
            Help Sophia learn from: <span className="font-semibold">{campaignName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Outcome Status */}
          <div className="space-y-2">
            <Label>How did this campaign perform?</Label>
            <Select value={outcome} onValueChange={(v: any) => setOutcome(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">✅ Success - Exceeded expectations</SelectItem>
                <SelectItem value="partial">⚡ Partial - Some traction</SelectItem>
                <SelectItem value="failure">❌ Failure - Didn't convert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Engagement Rate */}
          <div className="space-y-2">
            <Label htmlFor="engagement">Engagement Rate (%)</Label>
            <Input
              id="engagement"
              type="number"
              value={engagement}
              onChange={(e) => setEngagement(e.target.value)}
              placeholder="e.g., 42"
              min="0"
              max="100"
            />
          </div>

          {/* Conversion Rate */}
          <div className="space-y-2">
            <Label htmlFor="conversion">Conversion Rate (%)</Label>
            <Input
              id="conversion"
              type="number"
              value={conversion}
              onChange={(e) => setConversion(e.target.value)}
              placeholder="e.g., 8"
              min="0"
              max="100"
            />
          </div>

          {/* Revenue Generated */}
          <div className="space-y-2">
            <Label htmlFor="revenue">Revenue Generated ($)</Label>
            <Input
              id="revenue"
              type="number"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              placeholder="e.g., 5000"
              min="0"
            />
          </div>

          {/* Learning Insight */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <p className="font-semibold">Sophia will learn:</p>
                <p className="text-xs mt-1">This {outcome} campaign helps improve future campaign recommendations by 5-8%</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? 'Logging...' : '📚 Log Outcome'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
