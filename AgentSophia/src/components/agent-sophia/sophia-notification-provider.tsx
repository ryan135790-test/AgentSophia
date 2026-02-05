import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Bot, Mail, MessageSquare, Calendar, Zap, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface AutonomySettings {
  enabled: boolean;
  autonomyLevel: number;
  notifyOnActions: boolean;
  informMode: 'silent' | 'inform' | 'full-updates';
}

export function SophiaNotificationProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AutonomySettings>({
    enabled: true,
    autonomyLevel: 50,
    notifyOnActions: true,
    informMode: 'inform'
  });
  const lastActionIdRef = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/sophia/predictive/autonomy-settings');
      if (res.ok) {
        const data = await res.json();
        const newSettings = {
          enabled: data.enabled ?? true,
          autonomyLevel: data.autonomyLevel ?? 50,
          notifyOnActions: data.notifyOnActions ?? true,
          informMode: data.informMode ?? 'inform'
        };
        setSettings(newSettings);
        settingsRef.current = newSettings;
      }
    } catch (error) {
      console.log('Using default notification settings');
    }
  }, []);

  const handleNewAction = useCallback((action: any) => {
    const currentSettings = settingsRef.current;
    
    if (!currentSettings.enabled) return;
    if (!action.is_autonomous) return;
    if (currentSettings.informMode === 'silent') return;
    if (!currentSettings.notifyOnActions) return;

    const contactName = action.contact?.first_name || action.contact_name || 'Contact';

    if (currentSettings.informMode === 'full-updates' || currentSettings.autonomyLevel < 80) {
      toast({
        title: (
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span>{getActionTitle(action.activity_type, action.outcome)}</span>
          </div>
        ) as any,
        description: (
          <div className="flex items-center gap-2 text-sm">
            {getActionIcon(action.activity_type)}
            <span>{action.action_taken || `Action taken for ${contactName}`}</span>
          </div>
        ) as any,
        duration: 5000,
      });
    } else if (currentSettings.informMode === 'inform') {
      toast({
        title: (
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span>Sophia is working</span>
          </div>
        ) as any,
        description: `Autonomous action completed: ${action.action_taken || action.activity_type}`,
        duration: 3000,
      });
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
    
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    
    const setupSubscription = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        channel = supabase
          .channel('sophia-actions')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'agent_activities',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              const action = payload.new as any;
              if (action.is_autonomous) {
                handleNewAction(action);
              }
            }
          )
          .subscribe();

        pollInterval = setInterval(async () => {
          await checkRecentActions();
        }, 30000);
      } catch (error) {
        console.error('Error subscribing to Sophia actions:', error);
      }
    };

    const checkRecentActions = async () => {
      const currentSettings = settingsRef.current;
      if (!currentSettings.enabled || !currentSettings.notifyOnActions) return;
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: actions } = await supabase
          .from('agent_activities')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (actions && actions.length > 0) {
          const latestAction = actions[0];
          if (lastActionIdRef.current !== latestAction.id) {
            const timeDiff = Date.now() - new Date(latestAction.created_at).getTime();
            if (timeDiff < 60000) {
              handleNewAction(latestAction);
            }
            lastActionIdRef.current = latestAction.id;
          }
        }
      } catch (error) {
        console.error('Error checking recent actions:', error);
      }
    };
    
    setupSubscription();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [loadSettings, handleNewAction]);

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email_sent':
      case 'outreach_sent':
        return <Mail className="h-3 w-3 text-blue-500" />;
      case 'linkedin_sent':
        return <MessageSquare className="h-3 w-3 text-blue-700" />;
      case 'meeting_scheduled':
        return <Calendar className="h-3 w-3 text-purple-500" />;
      case 'lead_qualified':
        return <CheckCircle2 className="h-3 w-3 text-green-500" />;
      default:
        return <Zap className="h-3 w-3 text-amber-500" />;
    }
  };

  const getActionTitle = (type: string, outcome: string) => {
    const outcomeEmoji = outcome === 'success' ? '✅' : outcome === 'pending' ? '⏳' : '❌';
    
    switch (type) {
      case 'email_sent':
      case 'outreach_sent':
        return `${outcomeEmoji} Email Sent`;
      case 'linkedin_sent':
        return `${outcomeEmoji} LinkedIn Message`;
      case 'meeting_scheduled':
        return `${outcomeEmoji} Meeting Scheduled`;
      case 'follow_up_sent':
        return `${outcomeEmoji} Follow-up Sent`;
      case 'lead_qualified':
        return `${outcomeEmoji} Lead Qualified`;
      case 'campaign_action':
        return `${outcomeEmoji} Campaign Action`;
      default:
        return `${outcomeEmoji} Sophia Action`;
    }
  };

  return <>{children}</>;
}

export function useSophiaNotifications() {
  const [actionCount, setActionCount] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const { currentWorkspace } = useWorkspace();

  useEffect(() => {
    if (!currentWorkspace?.id) {
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/sophia/state?workspace_id=${currentWorkspace.id}`);
        if (res.ok) {
          const data = await res.json();
          setIsActive(data.is_active ?? false);
        }
      } catch (error) {
        console.error('Error checking Sophia status:', error);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [currentWorkspace?.id]);

  return { actionCount, isActive };
}
