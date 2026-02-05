import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Bot, Mail, MessageSquare, Calendar, CheckCircle2, Zap, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface SophiaNotification {
  id: string;
  activity_type: string;
  action_taken: string;
  outcome: string;
  contact_name?: string;
  contact_id?: string;
  created_at: string;
  is_read: boolean;
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<SophiaNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('agent_activities')
        .select('id, activity_type, action_taken, outcome, contact_id, created_at, metadata')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const notifs = data.map((item: any) => ({
          id: item.id,
          activity_type: item.activity_type,
          action_taken: item.action_taken,
          outcome: item.outcome,
          contact_name: item.metadata?.contact_name || 'Contact',
          contact_id: item.contact_id,
          created_at: item.created_at,
          is_read: item.metadata?.is_read || false
        }));
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('notification-center')
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
              fetchNotifications();
            }
          }
        )
        .subscribe();
    };

    setupRealtime();
    
    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [fetchNotifications]);

  const handleNotificationClick = (notification: SophiaNotification) => {
    setIsOpen(false);
    if (notification.contact_id) {
      navigate(`/contacts/${notification.contact_id}`);
    } else {
      navigate('/sophia?tab=activity');
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/sophia?tab=activity');
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'email_sent':
      case 'outreach_sent':
        return <Mail className="h-4 w-4 text-blue-500" />;
      case 'linkedin_sent':
        return <MessageSquare className="h-4 w-4 text-blue-700" />;
      case 'meeting_scheduled':
        return <Calendar className="h-4 w-4 text-purple-500" />;
      case 'lead_qualified':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default:
        return <Zap className="h-4 w-4 text-amber-500" />;
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'success':
        return 'text-green-500';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-amber-500';
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-notification-center"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary"
              data-testid="badge-unread-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Sophia Activity</h3>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={markAllAsRead}
              data-testid="button-mark-all-read"
            >
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                No autonomous actions yet. Sophia will notify you here when she takes action.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                    !notification.is_read ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {getActionIcon(notification.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${getOutcomeColor(notification.outcome)}`}>
                          {notification.outcome === 'success' ? '✅' : notification.outcome === 'pending' ? '⏳' : '❌'}
                        </span>
                        <span className="text-sm font-medium truncate">
                          {notification.action_taken || notification.activity_type}
                        </span>
                      </div>
                      {notification.contact_name && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.contact_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <Separator />
        <div className="p-2">
          <Button 
            variant="ghost" 
            className="w-full justify-center"
            onClick={handleViewAll}
            data-testid="button-view-all-activity"
          >
            View All Activity
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
