import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, ThumbsUp, ThumbsDown } from 'lucide-react';

interface NextBestActionCardProps {
  suggestion: string;
  actionType: string;
  confidence: number;
  reasoning: string;
  onAccept?: () => void;
  onDismiss?: () => void;
}

const actionTypeLabels: Record<string, string> = {
  send_email: '✉️ Send Email',
  send_linkedin: '💼 Send LinkedIn',
  schedule_call: '📞 Schedule Call',
  send_sms: '💬 Send SMS',
  add_to_campaign: '🚀 Add to Campaign',
  move_stage: '🔄 Move Stage'
};

export function NextBestActionCard({
  suggestion,
  actionType,
  confidence,
  reasoning,
  onAccept,
  onDismiss
}: NextBestActionCardProps) {
  const confidencePercent = Math.round(confidence * 100);
  const confidenceColor = 
    confidencePercent >= 80 ? 'bg-green-100 text-green-800' :
    confidencePercent >= 60 ? 'bg-blue-100 text-blue-800' :
    'bg-yellow-100 text-yellow-800';

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            AI Suggestion
          </CardTitle>
          <Badge className={confidenceColor}>
            {confidencePercent}% confident
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="font-medium text-sm">{suggestion}</p>
          <p className="text-xs text-muted-foreground mt-1">{reasoning}</p>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <Badge variant="outline">{actionTypeLabels[actionType] || actionType}</Badge>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              data-testid="button-dismiss-suggestion"
            >
              <ThumbsDown className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={onAccept}
              data-testid="button-accept-suggestion"
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              Accept
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
