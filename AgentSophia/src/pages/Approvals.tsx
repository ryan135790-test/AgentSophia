import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { ApprovalQueuePanel } from "@/components/agent-sophia/approval-queue-panel";

export default function Approvals() {
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-orange-600" />
            Approval Queue
          </h1>
          <p className="text-slate-600 mt-2">Review and manage pending Sophia AI actions</p>
        </div>

        {/* Main Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <ApprovalQueuePanel />
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300">About Sophia Approvals</h3>
              <p className="text-sm text-blue-800 dark:text-blue-400 mt-1">
                Sophia identifies high-impact actions (emails, lead scores, auto-replies) that require your approval. Review each decision's reasoning and confidence level before approving or rejecting. Outcomes feed back into Sophia's learning system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
