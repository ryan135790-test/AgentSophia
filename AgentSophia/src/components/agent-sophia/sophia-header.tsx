import { Bot, Mail, Linkedin, Zap, Pause, Play, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState, useEffect } from 'react';
import { NotificationCenter } from './notification-center';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface SophiaHeaderProps {
  showIntegrations?: boolean;
  showNotifications?: boolean;
}

type AutonomyMode = 'auto' | 'inform' | 'approval' | 'paused';

export function SophiaHeader({ showIntegrations = true, showNotifications = true }: SophiaHeaderProps) {
  const { currentWorkspace } = useWorkspace();
  const [integrations, setIntegrations] = useState({
    email: true,
    linkedin: false,
  });
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('inform');
  const [autonomyLevel, setAutonomyLevel] = useState(50);
  const [isActive, setIsActive] = useState(true);
  const [actionsToday, setActionsToday] = useState(0);

  useEffect(() => {
    // Skip if no workspace is loaded yet - wait for workspace context
    if (!currentWorkspace?.id) {
      return;
    }

    const checkStatus = async () => {
      try {
        const [stateRes, settingsRes] = await Promise.all([
          fetch(`/api/sophia/state?workspace_id=${currentWorkspace.id}`),
          fetch('/api/sophia/predictive/autonomy-settings')
        ]);
        
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          setIsActive(stateData.is_active ?? true);
          setActionsToday(stateData.actions_today ?? 0);
          setIntegrations({
            email: true,
            linkedin: stateData.linkedin_connected ?? false,
          });
        }
        
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          setAutonomyLevel(settings.autonomyLevel ?? 50);
          
          if (!settings.enabled) {
            setAutonomyMode('paused');
          } else if (settings.autonomyLevel >= 80) {
            setAutonomyMode('auto');
          } else if (settings.autonomyLevel >= 40) {
            setAutonomyMode('inform');
          } else {
            setAutonomyMode('approval');
          }
        }
      } catch (error) {
        console.error('Error checking Sophia status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [currentWorkspace?.id]);

  const getModeInfo = () => {
    switch (autonomyMode) {
      case 'auto':
        return { 
          icon: <Zap className="h-2.5 w-2.5" />, 
          label: 'Auto', 
          color: 'bg-green-500 text-white',
          tooltip: 'Sophia acts autonomously and notifies you of actions taken'
        };
      case 'inform':
        return { 
          icon: <Bell className="h-2.5 w-2.5" />, 
          label: 'Inform', 
          color: 'bg-blue-500 text-white',
          tooltip: 'Sophia takes actions and keeps you informed in real-time'
        };
      case 'approval':
        return { 
          icon: <Play className="h-2.5 w-2.5" />, 
          label: 'Approval', 
          color: 'bg-amber-500 text-white',
          tooltip: 'Sophia asks for your approval before taking actions'
        };
      case 'paused':
        return { 
          icon: <Pause className="h-2.5 w-2.5" />, 
          label: 'Paused', 
          color: 'bg-slate-400 text-white',
          tooltip: 'Sophia autonomous actions are paused'
        };
    }
  };

  const modeInfo = getModeInfo();

  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b flex items-center gap-3 px-4 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Bot className="h-5 w-5 text-primary shrink-0" />
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        <h2 className="text-sm font-semibold">Sophia</h2>
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className={`gap-1 text-[10px] h-5 px-1.5 ${modeInfo.color}`} data-testid="sophia-mode-badge">
              {modeInfo.icon}
              <span>{modeInfo.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">{modeInfo.tooltip}</p>
            <p className="text-xs text-muted-foreground mt-1">Autonomy: {autonomyLevel}%</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {actionsToday > 0 && (
        <Badge variant="secondary" className="text-[10px] h-4 px-1.5" data-testid="actions-today-badge">
          {actionsToday} today
        </Badge>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {showNotifications && <NotificationCenter />}
        
        {showIntegrations && (
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant={integrations.email ? "default" : "outline"} className="gap-0.5 text-[10px] h-4 px-1">
                    <Mail className="h-2 w-2" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>Email {integrations.email ? 'Connected' : 'Not Connected'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant={integrations.linkedin ? "default" : "outline"} className="gap-0.5 text-[10px] h-4 px-1">
                    <Linkedin className="h-2 w-2" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>LinkedIn {integrations.linkedin ? 'Connected' : 'Not Connected'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}
