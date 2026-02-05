import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Clock, Inbox } from 'lucide-react';
import { ApprovalActionCard } from './approval-action-card';
import { Card } from '@/components/ui/card';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';

interface PendingApproval {
  id: string;
  action: string;
  type: 'email' | 'message' | 'lead_score' | 'campaign' | 'auto_reply';
  targetName: string;
  targetEmail?: string;
  reason: string;
  confidence: number;
  expectedImpact: string;
  timestamp: string;
}

export function ApprovalQueuePanel() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = currentWorkspace?.id || '';
  const isDemo = workspaceId === 'demo';

  useEffect(() => {
    const fetchApprovals = async () => {
      if (!workspaceId) {
        setLoading(false);
        return;
      }

      if (isDemo) {
        setApprovals([
          { id: '1', action: 'Send follow-up email', type: 'email', targetName: 'Sarah Chen', targetEmail: 'sarah@techcorp.com', reason: 'No response in 3 days, high-value prospect', confidence: 92, expectedImpact: '+$45k pipeline', timestamp: '2 hours ago' },
          { id: '2', action: 'Schedule LinkedIn outreach', type: 'message', targetName: 'John Miller', targetEmail: 'john@growthco.com', reason: 'Recent engagement on company posts', confidence: 85, expectedImpact: '+18% reply rate', timestamp: '5 hours ago' },
          { id: '3', action: 'Promote lead score', type: 'lead_score', targetName: 'Emily Watson', targetEmail: 'emily@startup.io', reason: 'High engagement indicators detected', confidence: 78, expectedImpact: 'High conversion', timestamp: '1 day ago' }
        ]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/sophia/approvals`);
        if (res.ok) {
          const data = await res.json();
          setApprovals(data || []);
        } else {
          setApprovals([]);
        }
      } catch (error) {
        console.error('Error fetching approvals:', error);
        setApprovals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [workspaceId, isDemo]);

  const handleApprove = async (id: string, _reasoning: string) => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Actions are simulated in demo workspace' });
      setApprovals(approvals.filter(a => a.id !== id));
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sophia/approvals/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setApprovals(approvals.filter(a => a.id !== id));
        toast({ title: 'Approved', description: 'Action has been approved and queued for execution' });
      }
    } catch (error) {
      console.error('Error approving action:', error);
    }
  };

  const handleReject = async (id: string, _reason: string) => {
    if (isDemo) {
      toast({ title: 'Demo Mode', description: 'Actions are simulated in demo workspace' });
      setApprovals(approvals.filter(a => a.id !== id));
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/sophia/approvals/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        setApprovals(approvals.filter(a => a.id !== id));
        toast({ title: 'Rejected', description: 'Action has been rejected' });
      }
    } catch (error) {
      console.error('Error rejecting action:', error);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-slate-500">Loading pending approvals...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Pending Review</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{approvals.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Avg Confidence</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {approvals.length > 0
                  ? Math.round(approvals.reduce((sum, a) => sum + a.confidence, 0) / approvals.length)
                  : 0}%
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">Expected Impact</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {approvals.length > 0 ? 'High' : '-'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Approval Cards */}
      {approvals.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
          <p className="text-slate-600 dark:text-slate-400 font-semibold">All caught up!</p>
          <p className="text-sm text-slate-500">No pending approvals from Sophia</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <ApprovalActionCard
              key={approval.id}
              {...approval}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
