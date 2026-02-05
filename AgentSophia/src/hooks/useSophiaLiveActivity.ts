import { useState, useEffect, useCallback, useRef } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface SophiaLiveActivity {
  type: 'started' | 'progress' | 'completed' | 'failed' | 'idle';
  actionId?: string;
  actionType: string;
  description: string;
  campaignId?: string;
  campaignName?: string;
  channel?: string;
  contactName?: string;
  progress?: number;
  confidence?: number;
  timestamp: string;
}

const DEMO_ACTIVITIES: SophiaLiveActivity[] = [
  {
    type: 'started',
    actionId: 'demo-1',
    actionType: 'send_email',
    description: 'Sending personalized outreach email',
    campaignId: 'camp-demo-1',
    campaignName: 'Q4 Enterprise Outreach',
    channel: 'email',
    contactName: 'Sarah Johnson',
    progress: 0,
    confidence: 92,
    timestamp: new Date().toISOString()
  },
  {
    type: 'progress',
    actionId: 'demo-1',
    actionType: 'send_email',
    description: 'Personalizing email content for contact',
    campaignId: 'camp-demo-1',
    campaignName: 'Q4 Enterprise Outreach',
    channel: 'email',
    contactName: 'Sarah Johnson',
    progress: 50,
    confidence: 92,
    timestamp: new Date().toISOString()
  },
  {
    type: 'completed',
    actionId: 'demo-1',
    actionType: 'send_email',
    description: 'Email sent successfully',
    campaignId: 'camp-demo-1',
    campaignName: 'Q4 Enterprise Outreach',
    channel: 'email',
    contactName: 'Sarah Johnson',
    progress: 100,
    confidence: 92,
    timestamp: new Date().toISOString()
  },
  {
    type: 'started',
    actionId: 'demo-2',
    actionType: 'linkedin_connection',
    description: 'Sending LinkedIn connection request',
    campaignId: 'camp-demo-2',
    campaignName: 'Tech Leads Campaign',
    channel: 'linkedin',
    contactName: 'Mike Chen',
    progress: 0,
    confidence: 88,
    timestamp: new Date().toISOString()
  },
  {
    type: 'idle',
    actionType: 'idle',
    description: 'Waiting for next scheduled action',
    timestamp: new Date().toISOString()
  }
];

export function useSophiaLiveActivity() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  const [currentActivity, setCurrentActivity] = useState<SophiaLiveActivity | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const demoIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCurrentTask = useCallback(async () => {
    if (!workspaceId || isDemo) return;
    
    try {
      const response = await fetch(`/api/sophia/workspaces/${workspaceId}/current-task`);
      if (response.ok) {
        const data = await response.json();
        if (data.task) {
          setCurrentActivity({
            type: data.task.status === 'in_progress' ? 'progress' : 'started',
            actionId: data.task.id,
            actionType: data.task.action_type || 'campaign_action',
            description: data.task.description || 'Processing campaign action',
            campaignId: data.task.campaign_id,
            campaignName: data.task.campaign_name,
            channel: data.task.channel,
            contactName: data.task.contact_name,
            progress: data.task.progress || 50,
            confidence: data.task.confidence || 85,
            timestamp: data.task.started_at || new Date().toISOString()
          });
        } else {
          setCurrentActivity({
            type: 'idle',
            actionType: 'idle',
            description: 'Sophia is ready and monitoring campaigns',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error('Error fetching current task:', err);
    }
  }, [workspaceId, isDemo]);

  useEffect(() => {
    if (isDemo) {
      let demoIndex = 0;
      setCurrentActivity(DEMO_ACTIVITIES[0]);
      setIsConnected(true);
      
      demoIntervalRef.current = setInterval(() => {
        demoIndex = (demoIndex + 1) % DEMO_ACTIVITIES.length;
        setCurrentActivity({
          ...DEMO_ACTIVITIES[demoIndex],
          timestamp: new Date().toISOString()
        });
      }, 5000);
      
      return () => {
        if (demoIntervalRef.current) {
          clearInterval(demoIntervalRef.current);
        }
      };
    }
    
    if (!workspaceId) return;

    const connectSSE = () => {
      try {
        const eventSource = new EventSource(`/api/sophia/workspaces/${workspaceId}/activity/stream`);
        eventSourceRef.current = eventSource;
        
        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
        };
        
        eventSource.onmessage = (event) => {
          try {
            const activity = JSON.parse(event.data) as SophiaLiveActivity;
            setCurrentActivity(activity);
          } catch (err) {
            console.error('Error parsing SSE message:', err);
          }
        };
        
        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource.close();
          setTimeout(connectSSE, 5000);
        };
      } catch (err) {
        setError('SSE not supported, using polling');
        setIsConnected(false);
      }
    };

    connectSSE();
    
    fetchCurrentTask();
    pollIntervalRef.current = setInterval(fetchCurrentTask, 30000);
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [workspaceId, isDemo, fetchCurrentTask]);

  return {
    currentActivity,
    isConnected,
    error,
    isDemo
  };
}
