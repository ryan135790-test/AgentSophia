import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface IntentBadgeProps {
  intent?: string;
  confidence?: number;
  reasoning?: string;
}

export function IntentBadge({ intent = 'unknown', confidence = 0, reasoning }: IntentBadgeProps) {
  const colorMap: Record<string, string> = {
    interested: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
    not_interested: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    meeting_request: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    information_needed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200',
    price_inquiry: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200',
    follow_up_needed: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200',
    meeting_scheduled: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
  };

  const emojiMap: Record<string, string> = {
    interested: '🎉',
    not_interested: '👋',
    meeting_request: '📅',
    information_needed: '❓',
    price_inquiry: '💰',
    follow_up_needed: '⏰',
    meeting_scheduled: '✅'
  };

  const color = colorMap[intent] || colorMap.information_needed;
  const emoji = emojiMap[intent] || '❓';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${color} cursor-help text-xs`} data-testid={`intent-${intent}`}>
            {emoji} {intent.replace(/_/g, ' ')}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <p className="font-semibold">Intent: {intent.replace(/_/g, ' ')}</p>
            <p>Confidence: {confidence}%</p>
            {reasoning && <p>{reasoning}</p>}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
