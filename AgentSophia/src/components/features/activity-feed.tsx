import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Mail, Eye, MousePointer, Phone, AlertCircle, Inbox } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function ActivityFeed() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchActivities();
      const interval = setInterval(fetchActivities, 30000);
      return () => clearInterval(interval);
    }
  }, [currentWorkspace?.id]);

  const fetchActivities = async () => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/activity-feed`);
      if (res.ok) {
        setActivities(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (eventType: string) => {
    switch (eventType) {
      case 'email_opened':
      case 'email_sent':
        return <Mail className="h-4 w-4 text-blue-600" />;
      case 'email_clicked':
        return <Eye className="h-4 w-4 text-green-600" />;
      case 'page_visited':
        return <MousePointer className="h-4 w-4 text-purple-600" />;
      case 'call_scheduled':
        return <Phone className="h-4 w-4 text-orange-600" />;
      case 'linkedin_action':
      case 'linkedin_connection':
      case 'linkedin_message':
        return <Inbox className="h-4 w-4 text-blue-700" />;
      case 'campaign_action':
        return <Clock className="h-4 w-4 text-indigo-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) return <div>Loading activity feed...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Real-Time Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <div key={activity.id} className="border rounded p-3 flex items-start gap-3" data-testid={`activity-item-${activity.id}`}>
                  <div className="mt-1">
                    {getIcon(activity.event_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{activity.contact_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {activity.event_type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <Badge
                    variant={activity.severity === 'high' ? 'destructive' : 'secondary'}
                    data-testid={`severity-${activity.id}`}
                  >
                    {activity.severity}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No activities yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-activity-stats">
        <CardHeader>
          <CardTitle className="text-sm">Today's Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Emails Opened</p>
            <p className="font-bold text-lg mt-1">12</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Links Clicked</p>
            <p className="font-bold text-lg mt-1">7</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">High Priority</p>
            <p className="font-bold text-lg mt-1">3</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
