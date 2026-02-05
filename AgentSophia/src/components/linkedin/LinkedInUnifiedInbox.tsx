import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Inbox, 
  Search, 
  Filter, 
  Archive, 
  CheckCircle, 
  Clock, 
  MessageSquare,
  User,
  Building,
  Star,
  MoreHorizontal,
  Send,
  Calendar
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Conversation {
  id: string;
  accountName: string;
  prospectName: string;
  prospectHeadline: string;
  lastMessage: string;
  lastMessageAt: Date;
  lastMessageDirection: 'inbound' | 'outbound';
  unreadCount: number;
  campaignName: string | null;
  status: 'active' | 'archived' | 'snoozed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  intent: 'interested' | 'not_interested' | 'question' | 'meeting_request' | 'neutral';
}

interface InboxStats {
  totalConversations: number;
  unreadConversations: number;
  repliesReceived: number;
  avgResponseTime: number;
}

export function LinkedInUnifiedInbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'interested' | 'meetings'>('all');

  const [stats] = useState<InboxStats>({
    totalConversations: 156,
    unreadConversations: 23,
    repliesReceived: 42,
    avgResponseTime: 45,
  });

  const [conversations] = useState<Conversation[]>([
    {
      id: '1',
      accountName: 'John Smith',
      prospectName: 'Emily Davis',
      prospectHeadline: 'VP of Engineering at TechCorp',
      lastMessage: "That sounds interesting! I'd love to learn more about how you're helping companies like ours.",
      lastMessageAt: new Date(Date.now() - 15 * 60 * 1000),
      lastMessageDirection: 'inbound',
      unreadCount: 1,
      campaignName: 'Q4 Enterprise Outreach',
      status: 'active',
      priority: 'high',
      intent: 'interested',
    },
    {
      id: '2',
      accountName: 'Sarah Johnson',
      prospectName: 'Michael Chen',
      prospectHeadline: 'CEO & Founder at StartupXYZ',
      lastMessage: 'Can we schedule a call for next week? Tuesday or Wednesday would work best.',
      lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      lastMessageDirection: 'inbound',
      unreadCount: 1,
      campaignName: 'Startup Founders Campaign',
      status: 'active',
      priority: 'urgent',
      intent: 'meeting_request',
    },
    {
      id: '3',
      accountName: 'John Smith',
      prospectName: 'Jessica Williams',
      prospectHeadline: 'Director of Sales at GrowthCo',
      lastMessage: 'Thanks for connecting! What exactly does your platform do?',
      lastMessageAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      lastMessageDirection: 'inbound',
      unreadCount: 1,
      campaignName: 'Sales Leaders Outreach',
      status: 'active',
      priority: 'medium',
      intent: 'question',
    },
    {
      id: '4',
      accountName: 'Mike Chen',
      prospectName: 'David Miller',
      prospectHeadline: 'CMO at MarketingPro',
      lastMessage: "Hi David, I noticed we're both connected with Alex from...",
      lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      lastMessageDirection: 'outbound',
      unreadCount: 0,
      campaignName: 'Marketing Leaders',
      status: 'active',
      priority: 'low',
      intent: 'neutral',
    },
  ]);

  const getIntentBadge = (intent: string) => {
    switch (intent) {
      case 'interested':
        return <Badge className="bg-green-100 text-green-800">Interested</Badge>;
      case 'meeting_request':
        return <Badge className="bg-purple-100 text-purple-800">Meeting Request</Badge>;
      case 'question':
        return <Badge className="bg-blue-100 text-blue-800">Question</Badge>;
      case 'not_interested':
        return <Badge className="bg-red-100 text-red-800">Not Interested</Badge>;
      default:
        return <Badge variant="outline">Neutral</Badge>;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Star className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'high':
        return <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />;
      default:
        return null;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const filteredConversations = conversations.filter(c => {
    if (searchQuery && !c.prospectName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (activeFilter === 'unread' && c.unreadCount === 0) return false;
    if (activeFilter === 'interested' && c.intent !== 'interested') return false;
    if (activeFilter === 'meetings' && c.intent !== 'meeting_request') return false;
    return true;
  });

  const selected = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="stat-total-conversations">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Conversations</p>
                <p className="text-2xl font-bold">{stats.totalConversations}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-unread">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold text-orange-600">{stats.unreadConversations}</p>
              </div>
              <Inbox className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-replies">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Replies Today</p>
                <p className="text-2xl font-bold text-green-600">{stats.repliesReceived}</p>
              </div>
              <Send className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-response-time">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
                <p className="text-2xl font-bold">{stats.avgResponseTime}m</p>
              </div>
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-[600px]" data-testid="card-unified-inbox">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="w-5 h-5" />
                Unified LinkedIn Inbox
              </CardTitle>
              <CardDescription>
                All conversations across all connected accounts in one place
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" data-testid="btn-bulk-actions">
                Bulk Actions
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex h-[520px]">
            <div className="w-1/3 border-r">
              <div className="p-3 border-b space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search conversations..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-inbox"
                  />
                </div>
                <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
                    <TabsTrigger value="unread" className="flex-1">Unread</TabsTrigger>
                    <TabsTrigger value="interested" className="flex-1">Hot</TabsTrigger>
                    <TabsTrigger value="meetings" className="flex-1">Meetings</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <ScrollArea className="h-[420px]">
                {filteredConversations.map((conv) => (
                  <div 
                    key={conv.id}
                    className={`p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedConversation === conv.id ? 'bg-muted' : ''
                    } ${conv.unreadCount > 0 ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                    onClick={() => setSelectedConversation(conv.id)}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback>{conv.prospectName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {getPriorityIcon(conv.priority)}
                            <span className="font-medium truncate">{conv.prospectName}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{formatTime(conv.lastMessageAt)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{conv.prospectHeadline}</p>
                        <p className={`text-sm truncate mt-1 ${conv.unreadCount > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                          {conv.lastMessageDirection === 'outbound' && 'You: '}
                          {conv.lastMessage}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">via {conv.accountName}</span>
                          {conv.unreadCount > 0 && (
                            <Badge variant="default" className="h-5 text-xs">{conv.unreadCount}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>

            <div className="flex-1 flex flex-col">
              {selected ? (
                <>
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback>{selected.prospectName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{selected.prospectName}</h3>
                            {getIntentBadge(selected.intent)}
                          </div>
                          <p className="text-sm text-muted-foreground">{selected.prospectHeadline}</p>
                          <p className="text-xs text-muted-foreground">
                            Campaign: {selected.campaignName} | Account: {selected.accountName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" data-testid="btn-view-profile">
                          <User className="w-4 h-4 mr-1" />
                          Profile
                        </Button>
                        <Button variant="outline" size="sm" data-testid="btn-schedule-meeting">
                          <Calendar className="w-4 h-4 mr-1" />
                          Schedule
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem>
                              <Archive className="w-4 h-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark as Read
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Star className="w-4 h-4 mr-2" />
                              Set Priority
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      <div className="flex justify-end">
                        <div className="max-w-[70%] bg-primary text-primary-foreground rounded-lg p-3">
                          <p className="text-sm">Hi {selected.prospectName.split(' ')[0]}, I noticed we're both connected with Alex and thought it would be great to connect. I help companies like yours improve their sales efficiency...</p>
                          <p className="text-xs opacity-70 mt-1">2 days ago</p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="max-w-[70%] bg-muted rounded-lg p-3">
                          <p className="text-sm">{selected.lastMessage}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatTime(selected.lastMessageAt)}</p>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>

                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input 
                        placeholder="Type your reply..." 
                        className="flex-1"
                        data-testid="input-reply"
                      />
                      <Button data-testid="btn-send-reply">
                        <Send className="w-4 h-4 mr-1" />
                        Send
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Select a conversation to view</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
