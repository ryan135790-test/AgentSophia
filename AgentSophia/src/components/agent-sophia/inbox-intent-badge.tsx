import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, HelpCircle, Zap, ThumbsUp, ThumbsDown } from 'lucide-react';

interface IntentBadgeProps {
  intent: string;
  score: number;
}

export function InboxIntentBadge({ intent, score }: IntentBadgeProps) {
  const intentMap: Record<string, { icon: any; color: string; label: string }> = {
    interested: { icon: Zap, color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', label: '✨ Interested' },
    question: { icon: HelpCircle, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', label: '❓ Question' },
    objection: { icon: AlertCircle, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', label: '⚠️ Objection' },
    meeting_request: { icon: CheckCircle, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300', label: '📅 Meeting Request' },
    approval: { icon: ThumbsUp, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300', label: '👍 Approval' },
    rejection: { icon: ThumbsDown, color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', label: '👎 Rejection' },
    request_info: { icon: HelpCircle, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', label: '📝 Info Request' },
    other: { icon: AlertCircle, color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300', label: '💬 Other' }
  };

  const config = intentMap[intent] || intentMap.other;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.color} text-sm font-semibold`}>
      <Icon className="h-4 w-4" />
      <span>{config.label}</span>
      <span className="opacity-75 text-xs ml-1">{score}%</span>
    </div>
  );
}
