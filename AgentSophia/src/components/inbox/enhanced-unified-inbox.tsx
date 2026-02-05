import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Mail, 
  Sparkles, 
  Settings,
  Inbox,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Zap,
  Eye,
  Search,
  Filter,
  Archive,
  Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UnifiedInbox } from "./unified-inbox";
import { PendingApprovalsPanel } from "./pending-approvals-panel";
import { SophiaResponseControls } from "./sophia-response-controls";
import { useInboxResponses } from "@/hooks/use-inbox";

interface InboxStats {
  total: number;
  unread: number;
  pending: number;
}

export function EnhancedUnifiedInbox() {
  const [activeTab, setActiveTab] = useState<'messages' | 'approvals' | 'settings'>('messages');
  const [responseMode, setResponseMode] = useState<'autonomous' | 'semi-autonomous' | 'manual'>('semi-autonomous');
  const [isSavingMode, setIsSavingMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterIntent, setFilterIntent] = useState<string>('all');
  const [filterCampaign, setFilterCampaign] = useState<string>('all');
  const { data: responses = [], isLoading, error, refetch } = useInboxResponses();
  const { toast } = useToast();
  
  // Get unique campaigns and intents for filters
  const uniqueCampaigns = Array.from(new Set(responses.map(r => r.campaign_id).filter(Boolean)));
  const uniqueIntents = Array.from(new Set(responses.map(r => r.intent_tag).filter(Boolean)));
  
  // Filter and search responses
  const filteredResponses = responses.filter(r => {
    const matchesSearch = !searchQuery || 
      r.sender_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.message_content?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = filterChannel === 'all' || r.channel === filterChannel;
    const matchesStatus = filterStatus === 'all' || (filterStatus === 'read' ? r.is_read : !r.is_read);
    const matchesIntent = filterIntent === 'all' || r.intent_tag === filterIntent;
    const matchesCampaign = filterCampaign === 'all' || r.campaign_id === filterCampaign;
    return matchesSearch && matchesChannel && matchesStatus && matchesIntent && matchesCampaign;
  });
  
  const stats: InboxStats = {
    total: responses.length,
    unread: responses.filter(r => !r.is_read).length,
    pending: 0,
  };

  useEffect(() => {
    loadResponseMode();
  }, []);

  const loadResponseMode = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('agent_configs')
        .select('response_mode')
        .eq('user_id', user.id)
        .single();

      if (data?.response_mode) {
        setResponseMode(data.response_mode);
      }
    } catch (error) {
      console.error('Error loading response mode:', error);
    }
  };

  const toggleResponseMode = async () => {
    const newMode = responseMode === 'autonomous' ? 'semi-autonomous' : 'autonomous';
    setIsSavingMode(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('agent_configs')
        .update({ response_mode: newMode })
        .eq('user_id', user.id);

      setResponseMode(newMode);
      toast({
        title: "Mode Updated",
        description: `Switched to ${newMode === 'autonomous' ? 'Fully Autonomous' : 'Semi-Autonomous'} mode`,
      });
    } catch (error) {
      console.error('Error updating response mode:', error);
      toast({
        title: "Error",
        description: "Failed to update response mode",
        variant: "destructive",
      });
    } finally {
      setIsSavingMode(false);
    }
  };

  if (error) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center p-6">
        <div className="max-w-md w-full space-y-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load inbox. This could be due to a connection issue or the inbox tables not being set up yet.
            </AlertDescription>
          </Alert>
          <Button onClick={() => refetch()} className="w-full" data-testid="button-retry">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Inbox className="h-6 w-6" />
                <h1 className="text-xl font-semibold">Inbox</h1>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" data-testid="badge-total">
                  {stats.total} total
                </Badge>
                {stats.unread > 0 && (
                  <Badge variant="default" data-testid="badge-unread">
                    {stats.unread} unread
                  </Badge>
                )}
              </div>
            </div>

            <Button
              onClick={toggleResponseMode}
              disabled={isSavingMode}
              variant={responseMode === 'autonomous' ? 'default' : 'outline'}
              className="gap-2"
              data-testid="button-toggle-mode"
              title={`Switch to ${responseMode === 'autonomous' ? 'Semi-Autonomous' : 'Fully Autonomous'} mode`}
            >
              {responseMode === 'autonomous' ? (
                <>
                  <Zap className="h-4 w-4" />
                  Auto
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Review
                </>
              )}
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList>
              <TabsTrigger value="messages" className="gap-2" data-testid="tab-messages">
                <Mail className="h-4 w-4" />
                Messages
              </TabsTrigger>
              <TabsTrigger value="approvals" className="gap-2" data-testid="tab-approvals">
                <Sparkles className="h-4 w-4" />
                Approvals
                {stats.pending > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {stats.pending}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
                <Settings className="h-4 w-4" />
                Controls
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {activeTab === 'messages' && (
          <>
            {/* Search & Filter Controls */}
            <div className="border-b bg-background p-4 space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-64 relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, or content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
                <Select value={filterChannel} onValueChange={setFilterChannel}>
                  <SelectTrigger className="w-40" data-testid="select-channel">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Channels</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="social">Social</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Messages</SelectItem>
                    <SelectItem value="unread">Unread Only</SelectItem>
                    <SelectItem value="read">Read Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterIntent} onValueChange={setFilterIntent}>
                  <SelectTrigger className="w-40" data-testid="select-intent">
                    <SelectValue placeholder="Intent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Intents</SelectItem>
                    {uniqueIntents.map(intent => (
                      <SelectItem key={intent} value={intent || 'unknown'}>
                        {(intent || 'unknown').replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterChannel('all');
                    setFilterStatus('all');
                    setFilterIntent('all');
                    setFilterCampaign('all');
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear All
                </Button>
              </div>
              <div className="text-xs text-muted-foreground">
                Showing {filteredResponses.length} of {stats.total} messages
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-auto">
              <UnifiedInbox />
            </div>
          </>
        )}
        
        {activeTab === 'approvals' && (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Pending Approvals</h2>
                <p className="text-sm text-muted-foreground">
                  Review and approve AI-generated responses before they're sent
                </p>
              </div>
              <PendingApprovalsPanel />
            </div>
          </div>
        )}
        
        {activeTab === 'settings' && (
          <div className="h-full overflow-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-2">Sophia Response Controls</h2>
                <p className="text-sm text-muted-foreground">
                  Configure how Agent Sophia handles incoming messages and automates responses
                </p>
              </div>
              <SophiaResponseControls />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
