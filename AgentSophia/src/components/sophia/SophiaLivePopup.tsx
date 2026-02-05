import { useState, useEffect } from 'react';
import { useSophiaLiveActivity, SophiaLiveActivity } from '@/hooks/useSophiaLiveActivity';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Mail, 
  Linkedin, 
  Phone, 
  MessageSquare,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
  ChevronUp,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const getChannelIcon = (channel?: string) => {
  switch (channel) {
    case 'email': return <Mail className="h-4 w-4" />;
    case 'linkedin': return <Linkedin className="h-4 w-4" />;
    case 'phone': return <Phone className="h-4 w-4" />;
    case 'sms': return <MessageSquare className="h-4 w-4" />;
    default: return <Sparkles className="h-4 w-4" />;
  }
};

const getStatusIcon = (type: SophiaLiveActivity['type']) => {
  switch (type) {
    case 'started':
    case 'progress':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case 'idle':
      return <Clock className="h-4 w-4 text-gray-400" />;
    default:
      return <Brain className="h-4 w-4" />;
  }
};

const getStatusColor = (type: SophiaLiveActivity['type']) => {
  switch (type) {
    case 'started':
    case 'progress':
      return 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/30';
    case 'completed':
      return 'border-green-500/50 bg-green-50/50 dark:bg-green-950/30';
    case 'failed':
      return 'border-red-500/50 bg-red-50/50 dark:bg-red-950/30';
    case 'idle':
      return 'border-gray-300 bg-gray-50/50 dark:bg-gray-900/30';
    default:
      return 'border-purple-500/50 bg-purple-50/50 dark:bg-purple-950/30';
  }
};

export function SophiaLivePopup() {
  const { currentActivity, isConnected, isDemo } = useSophiaLiveActivity();
  const [isMinimized, setIsMinimized] = useState(false);

  const displayActivity: SophiaLiveActivity = currentActivity || {
    type: 'idle',
    actionType: 'idle',
    description: 'Sophia is ready and monitoring',
    timestamp: new Date().toISOString()
  };

  const isActive = displayActivity.type === 'started' || displayActivity.type === 'progress';

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 transition-all duration-300"
      data-testid="sophia-live-popup"
    >
      <Card className={cn(
        "w-80 border-2 shadow-lg transition-all duration-300",
        getStatusColor(displayActivity.type),
        isMinimized ? "h-12" : "h-auto"
      )}>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-full",
                isActive ? "bg-blue-100 dark:bg-blue-900" : "bg-gray-100 dark:bg-gray-800"
              )}>
                <Brain className={cn(
                  "h-4 w-4",
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500"
                )} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">Sophia</span>
                {isDemo && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0">Demo</Badge>
                )}
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
                )} />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsMinimized(!isMinimized)}
                data-testid="button-toggle-popup"
              >
                {isMinimized ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
                          </div>
          </div>

          {!isMinimized && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(displayActivity.type)}
                <span className="text-xs text-muted-foreground capitalize">
                  {displayActivity.type === 'idle' ? 'Standing by' : displayActivity.type}
                </span>
                {displayActivity.channel && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                    {getChannelIcon(displayActivity.channel)}
                    <span className="capitalize">{displayActivity.channel}</span>
                  </Badge>
                )}
              </div>

              <p className="text-sm font-medium leading-tight" data-testid="text-activity-description">
                {displayActivity.description || 'Sophia is ready and monitoring'}
              </p>

              {displayActivity.campaignName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Campaign:</span>
                  <span className="font-medium text-foreground" data-testid="text-campaign-name">{displayActivity.campaignName}</span>
                </div>
              )}

              {displayActivity.contactName && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Contact:</span>
                  <span className="font-medium text-foreground" data-testid="text-contact-name">{displayActivity.contactName}</span>
                </div>
              )}

              {isActive && displayActivity.progress !== undefined && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{displayActivity.progress}%</span>
                  </div>
                  <Progress value={displayActivity.progress} className="h-1.5" />
                </div>
              )}

              {displayActivity.confidence && displayActivity.type !== 'idle' && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Confidence</span>
                  <Badge variant="outline" className="text-[10px]">
                    {displayActivity.confidence}%
                  </Badge>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground text-right">
                {new Date(displayActivity.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
