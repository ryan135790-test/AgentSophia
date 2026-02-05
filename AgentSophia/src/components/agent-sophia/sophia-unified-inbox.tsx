import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SophiaActionControlPanel } from './sophia-action-control-panel';
import {
  Mail, MessageCircle, Zap, CheckCircle2, Clock, Send,
  Heart, MessageSquare, Share2, Eye, AlertCircle
} from 'lucide-react';

type IntentType = 'interested' | 'not_interested' | 'meeting_request' | 'information_needed' | 'price_inquiry' | 'follow_up_needed' | 'meeting_scheduled';

interface SophiaMessage {
  id: string;
  sender: string;
  channel: 'email' | 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'sms';
  content: string;
  timestamp: string;
  status: 'new' | 'viewed' | 'responded' | 'needs_action';
  engagement?: { likes?: number; comments?: number; shares?: number };
  sentiment?: 'positive' | 'neutral' | 'negative';
  sophiaAiAnalysis?: string;
  detectedIntent?: IntentType;
  intentConfidence?: number;
}

export function SophiaUnifiedInbox() {
  const [messages, setMessages] = useState<SophiaMessage[]>([
    {
      id: '1',
      sender: 'john@acme.com',
      channel: 'email',
      content: 'Hi, interested in learning more about your solution.',
      timestamp: new Date().toISOString(),
      status: 'new',
      sentiment: 'positive',
      sophiaAiAnalysis: 'High intent signal. Prospect shows genuine interest. Recommend follow-up with case study.',
      detectedIntent: 'interested',
      intentConfidence: 0.95
    },
    {
      id: '2',
      sender: 'LinkedIn: Sarah Chen',
      channel: 'linkedin',
      content: 'Thanks for connecting! I\'d love to chat about opportunities.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'viewed',
      sentiment: 'positive',
      engagement: { shares: 2 },
      sophiaAiAnalysis: 'Ready to engage. Suggests scheduling call or meeting.',
      detectedIntent: 'meeting_request',
      intentConfidence: 0.88
    }
  ]);

  const [selectedMessage, setSelectedMessage] = useState<SophiaMessage | null>(null);
  const [sophiaReply, setSophiaReply] = useState('');
  const [filter, setFilter] = useState<'all' | 'new' | 'needs_action'>('all');
  const [showActions, setShowActions] = useState(false);

  const filteredMessages = messages.filter(m => {
    if (filter === 'all') return true;
    return m.status === filter;
  });

  const getChannelIcon = (channel: string) => {
    const icons: Record<string, any> = {
      email: Mail,
      linkedin: MessageCircle,
      twitter: Zap,
      instagram: Heart,
      facebook: MessageSquare,
      sms: Send
    };
    return icons[channel] || Mail;
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'negative':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  const handleSendReply = () => {
    if (!selectedMessage || !sophiaReply.trim()) return;

    // In real app, this would send via the selected channel
    setMessages(prev =>
      prev.map(m =>
        m.id === selectedMessage.id ? { ...m, status: 'responded' } : m
      )
    );

    setSophiaReply('');
    setSelectedMessage(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sophia's Unified Inbox</CardTitle>
          <CardDescription>
            All your responses across email, LinkedIn, Twitter, Instagram, Facebook & SMS in one place with AI analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Messages</TabsTrigger>
              <TabsTrigger value="new" className="flex gap-2">
                New <Badge variant="destructive" className="ml-1">{messages.filter(m => m.status === 'new').length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="needs_action" className="flex gap-2">
                Action Needed <Badge variant="secondary" className="ml-1">{messages.filter(m => m.status === 'needs_action').length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Message List */}
                <div className="lg:col-span-1 border rounded-lg">
                  <ScrollArea className="h-96">
                    <div className="p-3 space-y-2">
                      {filteredMessages.map(msg => {
                        const Icon = getChannelIcon(msg.channel);
                        return (
                          <button
                            key={msg.id}
                            onClick={() => setSelectedMessage(msg)}
                            className={`w-full text-left p-3 rounded-lg border transition-colors ${
                              selectedMessage?.id === msg.id
                                ? 'bg-primary/10 border-primary'
                                : 'hover:bg-muted'
                            }`}
                            data-testid={`message-${msg.id}`}
                          >
                            <div className="flex gap-2 items-start">
                              <Icon className="h-4 w-4 mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{msg.sender}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">{msg.content}</p>
                                <div className="flex gap-1 mt-1">
                                  {msg.status === 'new' && (
                                    <Badge variant="destructive" className="text-xs">New</Badge>
                                  )}
                                  {msg.sentiment && (
                                    <Badge className={`text-xs ${getSentimentColor(msg.sentiment)}`}>
                                      {msg.sentiment}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Message Detail & AI Analysis */}
                <div className="lg:col-span-2">
                  {selectedMessage ? (
                    <div className="space-y-4 border rounded-lg p-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          {(() => {
                            const Icon = getChannelIcon(selectedMessage.channel);
                            return <Icon className="h-5 w-5 text-primary" />;
                          })()}
                          <span className="font-medium">{selectedMessage.sender}</span>
                          <Badge variant="outline">{selectedMessage.channel}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {new Date(selectedMessage.timestamp).toLocaleString()}
                        </p>
                        <p className="text-sm bg-muted p-3 rounded-lg mb-4">{selectedMessage.content}</p>
                      </div>

                      {/* Action Control Panel */}
                      {selectedMessage.detectedIntent && (
                        <div className="space-y-3">
                          <SophiaActionControlPanel
                            leadId={selectedMessage.id}
                            messageId={selectedMessage.id}
                            intent={selectedMessage.detectedIntent}
                            confidence={selectedMessage.intentConfidence || 0.85}
                            onClose={() => setShowActions(false)}
                          />
                        </div>
                      )}

                      {/* Sophia AI Analysis */}
                      {selectedMessage.sophiaAiAnalysis && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                          <div className="flex gap-2 mb-2">
                            <Zap className="h-4 w-4 text-purple-600 flex-shrink-0 mt-0.5" />
                            <span className="font-medium text-sm">Sophia's AI Analysis</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{selectedMessage.sophiaAiAnalysis}</p>
                        </div>
                      )}

                      {/* Engagement Metrics */}
                      {selectedMessage.engagement && (
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {selectedMessage.engagement.likes && (
                            <span className="flex items-center gap-1">
                              <Heart className="h-3 w-3" /> {selectedMessage.engagement.likes}
                            </span>
                          )}
                          {selectedMessage.engagement.comments && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> {selectedMessage.engagement.comments}
                            </span>
                          )}
                          {selectedMessage.engagement.shares && (
                            <span className="flex items-center gap-1">
                              <Share2 className="h-3 w-3" /> {selectedMessage.engagement.shares}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Reply Box */}
                      <div className="space-y-3 pt-4 border-t">
                        <label className="text-sm font-medium">Send Reply via {selectedMessage.channel}</label>
                        <Textarea
                          placeholder="Let Sophia craft your response..."
                          value={sophiaReply}
                          onChange={(e) => setSophiaReply(e.target.value)}
                          data-testid="textarea-sophia-reply"
                          className="min-h-20"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={handleSendReply}
                            disabled={!sophiaReply.trim()}
                            data-testid="button-send-reply"
                          >
                            Send Reply
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setSophiaReply('')}
                            data-testid="button-clear-reply"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-lg p-8 text-center text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-3 opacity-20" />
                      <p>Select a message to view details and send a reply</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}