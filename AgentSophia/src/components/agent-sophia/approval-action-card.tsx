import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import { useState } from 'react';

interface ApprovalActionProps {
  id: string;
  action: string;
  type: 'email' | 'message' | 'lead_score' | 'campaign' | 'auto_reply';
  targetName: string;
  targetEmail?: string;
  reason: string;
  confidence: number;
  expectedImpact: string;
  timestamp: string;
  onApprove?: (id: string, reasoning: string) => void;
  onReject?: (id: string, reason: string) => void;
}

export function ApprovalActionCard({
  id,
  action,
  type,
  targetName,
  targetEmail,
  reason,
  confidence,
  expectedImpact,
  timestamp,
  onApprove,
  onReject
}: ApprovalActionProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const typeIcons: Record<string, string> = {
    email: '📧',
    message: '💬',
    lead_score: '🔥',
    campaign: '🚀',
    auto_reply: '⚡'
  };

  const handleApprove = () => {
    setIsApproving(true);
    onApprove?.(id, 'Admin approved');
    setIsApproving(false);
  };

  const handleReject = () => {
    if (!rejectReason) return;
    onReject?.(id, rejectReason);
    setShowRejectForm(false);
    setRejectReason('');
  };

  return (
    <Card className="p-4 border-l-4 border-l-yellow-500">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{typeIcons[type]}</span>
              <span>{action}</span>
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {targetName} {targetEmail ? `(${targetEmail})` : ''}
            </p>
          </div>
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            ⏳ Pending Review
          </Badge>
        </div>

        {/* Details */}
        <div className="bg-slate-50 dark:bg-slate-900/30 p-3 rounded space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Reasoning:</strong> {reason}</p>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Confidence:</strong> {confidence}%</p>
          </div>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-green-500" />
            <p className="text-sm text-slate-700 dark:text-slate-300"><strong>Expected Impact:</strong> {expectedImpact}</p>
          </div>
        </div>

        {/* Reject Form */}
        {showRejectForm && (
          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Rejection Reason
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why are you rejecting this action?"
              className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 text-sm"
              rows={2}
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!showRejectForm ? (
            <>
              <Button
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                data-testid={`button-approve-${id}`}
              >
                <CheckCircle className="h-4 w-4" />
                {isApproving ? 'Approving...' : 'Approve'}
              </Button>
              <Button
                onClick={() => setShowRejectForm(true)}
                variant="outline"
                className="flex-1 gap-2"
                data-testid={`button-reject-${id}`}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={handleReject}
                disabled={!rejectReason}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                Confirm Rejection
              </Button>
              <Button
                onClick={() => setShowRejectForm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-xs text-slate-500 pt-2 border-t">
          Requested {new Date(timestamp).toLocaleString()}
        </div>
      </div>
    </Card>
  );
}
