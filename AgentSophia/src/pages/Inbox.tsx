import { useEffect, useState } from 'react';
import { MessageCircle, Mail, Send, ThumbsUp, AlertCircle, Zap, Loader2, Search, Filter, X, ArrowUpDown, Sparkles, Reply, Forward, Archive, CheckCircle, Clock, Tag, User, Phone, MessageSquare, Inbox as InboxIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IntentBadge } from '@/components/inbox/IntentBadge';
import { SophiaAutoActions } from '@/components/inbox/SophiaAutoActions';
import { SuggestedResponses } from "@/components/agent-sophia/suggested-responses";
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface InboxMessage {
  id: string;
  from: string;
  company: string;
  message: string;
  channel: string;
  sentiment: string;
  buyer_signal_score: number;
  read: boolean;
  timestamp: string;
  campaign_id?: string;
  campaign_name?: string;
  ai_suggestions?: Array<{ option: number; response: string; rationale: string }>;
  intent?: string;
  confidence?: number;
  reasoning?: string;
  status?: 'new' | 'replied' | 'resolved' | 'pending' | 'archived';
  tags?: string[];
  assignedTo?: string;
}

interface SophiaAnalysis {
  intent: { primary: string; subtype?: string; confidence: number };
  sentiment: { type: string; intensity: string; signals: string[] };
  urgency: string;
  buyerSignals: { score: number; signals: string[]; stage: string };
  recommendations: {
    suggestedReplies: Array<{ text: string; tone: string; rationale: string }>;
    nextActions: Array<{ action: string; priority: string; rationale: string; actionType: string }>;
    sophiaInsight: string;
  };
}

export default function Inbox() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [executingActions, setExecutingActions] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterIntent, setFilterIntent] = useState('all');
  const [sortBy, setSortBy] = useState('date-newest');
  const [messageStatuses, setMessageStatuses] = useState<Record<string, InboxMessage['status']>>({});
  const [messageTags, setMessageTags] = useState<Record<string, string[]>>({});
  const [replyModal, setReplyModal] = useState<{ messageId: string; text: string } | null>(null);
  const [sophiaAnalysis, setSophiaAnalysis] = useState<Record<string, SophiaAnalysis>>({});
  const [analyzingMessage, setAnalyzingMessage] = useState<string | null>(null);

  const fetchSophiaAnalysis = async (msg: InboxMessage) => {
    if (sophiaAnalysis[msg.id]) return;
    
    setAnalyzingMessage(msg.id);
    try {
      const res = await fetch('/api/sophia/analyze-inbox-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.id,
          messageText: msg.message,
          senderName: msg.from,
          channel: msg.channel
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.analysis) {
          setSophiaAnalysis(prev => ({ ...prev, [msg.id]: data.analysis }));
        }
      }
    } catch (error) {
      console.error('Error fetching Sophia analysis:', error);
    } finally {
      setAnalyzingMessage(null);
    }
  };

  const handleSelectMessage = (msgId: string) => {
    setSelectedMessage(msgId);
    const msg = messages.find(m => m.id === msgId);
    if (msg) {
      fetchSophiaAnalysis(msg);
    }
  };

  const handleQuickReply = (msg: InboxMessage) => {
    setReplyModal({ messageId: msg.id, text: '' });
    toast({ title: 'Reply', description: `Opening reply for ${msg.from}` });
  };

  const handleUseSuggestedReply = (text: string, msgId: string) => {
    setReplyModal({ messageId: msgId, text });
    toast({ title: 'Reply Loaded', description: 'Sophia\'s suggested reply has been loaded' });
  };

  const handleCallLead = (msg: InboxMessage) => {
    toast({ title: 'Calling Lead', description: `Initiating call to ${msg.from} at ${msg.company}` });
  };

  const handleSendEmail = (msg: InboxMessage) => {
    toast({ title: 'New Email', description: `Opening email composer for ${msg.from}` });
  };

  const handleScheduleFollowup = (msg: InboxMessage) => {
    toast({ title: 'Schedule Follow-up', description: `Opening scheduler for ${msg.from}` });
  };

  useEffect(() => {
    const fetchMessages = async () => {
      if (!currentWorkspace?.id) {
        setLoading(false);
        return;
      }
      
      try {
        const res = await fetch(`/api/workspaces/${currentWorkspace.id}/inbox`);
        if (res.ok) {
          const data = await res.json();
          const rawMsgs = Array.isArray(data) ? data : data.messages || [];
          
          // Map API response to component interface
          const mappedMsgs = rawMsgs.map((msg: any) => ({
            id: msg.id,
            from: msg.from_name || msg.from || 'Unknown Sender',
            company: msg.from_email?.split('@')[1]?.split('.')[0] || '',
            message: msg.message_body || msg.message || '',
            channel: msg.channel || 'email',
            sentiment: msg.sentiment || 'neutral',
            buyer_signal_score: msg.buyer_signal_score || 0,
            read: msg.is_read ?? false,
            timestamp: msg.created_at || new Date().toISOString(),
            campaign_id: msg.campaign_id,
            campaign_name: msg.campaign_name,
            intent: msg.intent_tag,
            confidence: msg.buyer_signal_score,
          }));
          
          // Detect intent for each message
          const messagesWithIntent = await Promise.all(
            mappedMsgs.map(async (msg: InboxMessage) => {
              try {
                const intentRes = await fetch('/api/intent/detect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message: msg.message })
                });
                if (intentRes.ok) {
                  const intentData = await intentRes.json();
                  return { ...msg, ...intentData };
                }
              } catch (error) {
                console.error('Error detecting intent:', error);
              }
              return msg;
            })
          );
          
          setMessages(messagesWithIntent);
        }
      } catch (error) {
        console.error('Error fetching inbox:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [currentWorkspace?.id]);

  const handleExecuteActions = async (msg: InboxMessage) => {
    setExecutingActions(msg.id);
    try {
      const res = await fetch('/api/sophia/auto-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.id,
          intent: msg.intent || 'unknown',
          leadId: msg.from,
          messageText: msg.message
        })
      });
      
      if (res.ok) {
        const result = await res.json();
        console.log('Actions executed:', result);
        setMessageStatuses({...messageStatuses, [msg.id]: 'replied'});
      }
    } catch (error) {
      console.error('Error executing actions:', error);
    } finally {
      setExecutingActions(null);
    }
  };

  const updateMessageStatus = (msgId: string, status: InboxMessage['status']) => {
    setMessageStatuses({...messageStatuses, [msgId]: status});
  };

  const getStatusColor = (status?: InboxMessage['status']) => {
    switch(status) {
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'replied': return 'bg-blue-100 text-blue-800';
      case 'archived': return 'bg-gray-100 text-gray-800';
      default: return 'bg-red-100 text-red-800';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return 'bg-green-50 border-green-200 text-green-700';
      case 'neutral':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'negative':
        return 'bg-red-50 border-red-200 text-red-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel?.toLowerCase()) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'linkedin':
        return <MessageCircle className="w-4 h-4" />;
      case 'sms':
        return <Send className="w-4 h-4" />;
      default:
        return <MessageCircle className="w-4 h-4" />;
    }
  };

  if (loading) return <div className="p-8 text-center">Loading inbox...</div>;

  // Filter messages
  const filteredMessages = messages.filter(msg => {
    const matchesSearch = !searchQuery || 
      msg.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      msg.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = filterChannel === 'all' || msg.channel === filterChannel;
    const matchesIntent = filterIntent === 'all' || msg.intent === filterIntent;
    return matchesSearch && matchesChannel && matchesIntent;
  });

  // Sort messages
  const sortedMessages = [...filteredMessages].sort((a, b) => {
    switch (sortBy) {
      case 'date-newest':
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      case 'date-oldest':
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      case 'score-highest':
        return b.buyer_signal_score - a.buyer_signal_score;
      case 'score-lowest':
        return a.buyer_signal_score - b.buyer_signal_score;
      case 'name-a-z':
        return a.from.localeCompare(b.from);
      case 'name-z-a':
        return b.from.localeCompare(a.from);
      case 'campaign':
        return (a.campaign_name || 'Unassigned').localeCompare(b.campaign_name || 'Unassigned');
      case 'intent':
        return (a.intent || 'unknown').localeCompare(b.intent || 'unknown');
      default:
        return 0;
    }
  });

  const uniqueIntents = Array.from(new Set(messages.map(m => m.intent).filter(Boolean)));

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Unified Inbox</h1>
          <p className="text-slate-600 mt-2">Monitor responses across all channels</p>
        </div>

        {/* Search & Filter Controls */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-64 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or message..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-inbox"
              />
            </div>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-40" data-testid="select-channel-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterIntent} onValueChange={setFilterIntent}>
              <SelectTrigger className="w-40" data-testid="select-intent-filter">
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48" data-testid="select-sort">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-newest">Newest First</SelectItem>
                <SelectItem value="date-oldest">Oldest First</SelectItem>
                <SelectItem value="score-highest">Highest Score</SelectItem>
                <SelectItem value="score-lowest">Lowest Score</SelectItem>
                <SelectItem value="name-a-z">Name (A-Z)</SelectItem>
                <SelectItem value="name-z-a">Name (Z-A)</SelectItem>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="intent">Intent Type</SelectItem>
              </SelectContent>
            </Select>
            {(searchQuery || filterChannel !== 'all' || filterIntent !== 'all') && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setFilterChannel('all');
                  setFilterIntent('all');
                }}
                data-testid="button-clear-all-filters"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
          <div className="text-xs text-slate-600 mt-2">
            Showing {sortedMessages.length} of {messages.length} messages • Sorted by {sortBy.replace('-', ' ')}
          </div>
        </div>

        <div className="flex h-96 border rounded-lg bg-white shadow overflow-hidden">
          {/* Left: Messages List */}
          <div className="w-80 border-r overflow-y-auto">
            {sortedMessages.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <InboxIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="font-medium mb-2">No messages yet</p>
                <p className="text-xs">Run campaigns and engage with leads to see messages here</p>
              </div>
            ) : (
              <div className="divide-y">
                {sortedMessages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg.id)}
                    className={`p-4 cursor-pointer hover:bg-slate-50 transition border-l-4 ${
                      selectedMessage === msg.id ? 'bg-blue-50 border-l-blue-600' : 'border-l-transparent'
                    }`}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {msg?.from?.charAt?.(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{msg?.from || 'Unknown Sender'}</p>
                          <p className="text-xs text-slate-600 truncate">{msg?.message?.substring(0, 40) || msg?.company || 'No preview'}</p>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {getChannelIcon(msg.channel)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {msg.intent && (
                        <IntentBadge 
                          intent={msg.intent} 
                          confidence={msg.confidence}
                        />
                      )}
                      <span className="text-xs text-slate-600">Score: {msg.buyer_signal_score}/100</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center: Message Details Only */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            {selectedMessage ? (
              (() => {
                const msg = messages.find((m) => m.id === selectedMessage);
                return msg ? (
                  <div className="flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="px-6 pt-4 pb-3 border-b bg-white">
                      <h3 className="font-semibold text-lg text-slate-900 mb-1">{msg.from}</h3>
                      <p className="text-sm text-slate-500 mb-3">{msg.company || 'Company unknown'}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{msg.channel}</Badge>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Score: {msg.buyer_signal_score}</span>
                        <span className="text-xs text-slate-500">{new Date(msg.timestamp).toLocaleDateString()}</span>
                      </div>
                      {msg.campaign_name && <div className="text-xs text-slate-600 mt-2">📋 {msg.campaign_name}</div>}
                    </div>

                    {/* Message Content */}
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">{msg.message}</p>
                    </div>
                  </div>
                ) : null;
              })()
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 opacity-30 mx-auto mb-2" />
                  <p className="text-sm">Select a message to view</p>
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions & AI Insights */}
          <div className="w-96 border-l overflow-y-auto bg-white p-4 space-y-4">
            {selectedMessage ? (
              (() => {
                const msg = messages.find((m) => m.id === selectedMessage);
                const currentStatus = messageStatuses[msg?.id || ''] || 'new';
                return msg ? (
                  <div className="space-y-4">
                    {/* Status & Management */}
                    <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">Manage</p>
                      
                      <div className="space-y-2">
                        <Select defaultValue={currentStatus} onValueChange={(status: any) => updateMessageStatus(msg.id, status)}>
                          <SelectTrigger className="w-full h-8 text-xs" data-testid="select-status">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">🟡 New</SelectItem>
                            <SelectItem value="pending">⏳ Pending</SelectItem>
                            <SelectItem value="replied">✉️ Replied</SelectItem>
                            <SelectItem value="resolved">✅ Resolved</SelectItem>
                            <SelectItem value="archived">📦 Archived</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select>
                          <SelectTrigger className="w-full h-8 text-xs" data-testid="select-assign">
                            <SelectValue placeholder="Assign to..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="me">👤 Assign to Me</SelectItem>
                            <SelectItem value="sales">👥 Sales Team</SelectItem>
                            <SelectItem value="support">🎧 Support</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input placeholder="Add tags..." className="h-8 text-xs" data-testid="input-tags" />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => updateMessageStatus(msg.id, 'resolved')} data-testid="button-resolve">
                          <CheckCircle className="w-3 h-3 mr-1" /> Resolve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => updateMessageStatus(msg.id, 'archived')} data-testid="button-archive">
                          <Archive className="w-3 h-3 mr-1" /> Archive
                        </Button>
                      </div>
                    </div>

                    {/* Sophia Insights */}
                    {analyzingMessage === msg.id ? (
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                          <p className="text-xs font-semibold text-purple-900">Sophia is analyzing...</p>
                        </div>
                      </div>
                    ) : sophiaAnalysis[msg.id] ? (
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <p className="text-xs font-semibold text-purple-900">Sophia's Analysis</p>
                        </div>
                        
                        {/* Insight Summary */}
                        <p className="text-xs text-purple-800 bg-white/60 p-2 rounded border border-purple-100">
                          {sophiaAnalysis[msg.id].recommendations.sophiaInsight}
                        </p>
                        
                        {/* Intent & Urgency Badges */}
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="outline" className="text-xs bg-purple-100 border-purple-300 text-purple-800">
                            {sophiaAnalysis[msg.id].intent.primary.replace('_', ' ')}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              sophiaAnalysis[msg.id].urgency === 'critical' ? 'bg-red-100 border-red-300 text-red-800' :
                              sophiaAnalysis[msg.id].urgency === 'high' ? 'bg-orange-100 border-orange-300 text-orange-800' :
                              sophiaAnalysis[msg.id].urgency === 'medium' ? 'bg-yellow-100 border-yellow-300 text-yellow-800' :
                              'bg-green-100 border-green-300 text-green-800'
                            }`}
                          >
                            {sophiaAnalysis[msg.id].urgency} urgency
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${
                              sophiaAnalysis[msg.id].sentiment.type === 'positive' ? 'bg-green-100 border-green-300 text-green-800' :
                              sophiaAnalysis[msg.id].sentiment.type === 'negative' || sophiaAnalysis[msg.id].sentiment.type === 'frustrated' ? 'bg-red-100 border-red-300 text-red-800' :
                              'bg-blue-100 border-blue-300 text-blue-800'
                            }`}
                          >
                            {sophiaAnalysis[msg.id].sentiment.type}
                          </Badge>
                        </div>
                        
                        {/* Buyer Score */}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                sophiaAnalysis[msg.id].buyerSignals.score >= 70 ? 'bg-green-500' :
                                sophiaAnalysis[msg.id].buyerSignals.score >= 40 ? 'bg-yellow-500' : 'bg-gray-400'
                              }`}
                              style={{ width: `${sophiaAnalysis[msg.id].buyerSignals.score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-purple-800">
                            {sophiaAnalysis[msg.id].buyerSignals.score}/100
                          </span>
                        </div>
                        
                        {/* Buyer Signals */}
                        {sophiaAnalysis[msg.id].buyerSignals.signals.length > 0 && (
                          <div className="text-xs text-purple-700">
                            <span className="font-medium">Signals: </span>
                            {sophiaAnalysis[msg.id].buyerSignals.signals.join(', ')}
                          </div>
                        )}
                      </div>
                    ) : msg.intent ? (
                      <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-purple-900 mb-2">🎯 Intent Detected</p>
                        <div className="flex items-center gap-2 mb-2">
                          <IntentBadge 
                            intent={msg.intent} 
                            confidence={msg.confidence} 
                            reasoning={msg.reasoning}
                          />
                        </div>
                        <p className="text-xs text-purple-700">{msg.confidence}% confidence</p>
                      </div>
                    ) : null}
                    
                    {/* Suggested Replies from Sophia */}
                    {sophiaAnalysis[msg.id]?.recommendations.suggestedReplies.length > 0 && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-green-900 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Suggested Replies
                        </p>
                        {sophiaAnalysis[msg.id].recommendations.suggestedReplies.map((reply, idx) => (
                          <div key={idx} className="bg-white/70 rounded p-2 border border-green-100">
                            <p className="text-xs text-gray-700 mb-2 line-clamp-3">{reply.text}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-green-600 italic">{reply.tone}</span>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-6 text-xs bg-green-100 hover:bg-green-200 border-green-300"
                                onClick={() => handleUseSuggestedReply(reply.text, msg.id)}
                                data-testid={`button-use-reply-${idx}`}
                              >
                                Use this
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Sophia's Recommended Actions */}
                    {sophiaAnalysis[msg.id]?.recommendations.nextActions.length > 0 && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-semibold text-amber-900 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Sophia's Recommendations
                        </p>
                        {sophiaAnalysis[msg.id].recommendations.nextActions.slice(0, 3).map((action, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-start gap-2 p-2 rounded text-xs ${
                              action.priority === 'high' ? 'bg-red-50 border border-red-100' :
                              action.priority === 'medium' ? 'bg-yellow-50 border border-yellow-100' :
                              'bg-gray-50 border border-gray-100'
                            }`}
                          >
                            <span className={`text-xs font-bold ${
                              action.priority === 'high' ? 'text-red-600' :
                              action.priority === 'medium' ? 'text-yellow-600' : 'text-gray-600'
                            }`}>
                              {action.priority === 'high' ? '!' : action.priority === 'medium' ? '•' : '○'}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">{action.action}</p>
                              <p className="text-gray-500 text-xs">{action.rationale}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-semibold text-blue-900 mb-2">⚡ Actions</p>
                      <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 h-8 text-xs" onClick={() => handleQuickReply(msg)} data-testid="button-reply">
                        <Reply className="w-3 h-3 mr-1" /> Reply
                      </Button>
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => handleCallLead(msg)} data-testid="button-call">
                        <Phone className="w-3 h-3 mr-1" /> Call Lead
                      </Button>
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => handleSendEmail(msg)} data-testid="button-email">
                        <Mail className="w-3 h-3 mr-1" /> Send Email
                      </Button>
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => handleScheduleFollowup(msg)} data-testid="button-schedule">
                        <Clock className="w-3 h-3 mr-1" /> Schedule Follow-up
                      </Button>
                    </div>

                    {/* Sophia Auto-Actions */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-slate-900 mb-3">🤖 Sophia Suggests</p>
                      <SophiaAutoActions 
                        intent={msg.intent}
                        actions={[
                          msg.intent === 'interested' ? '💬 Send demo offer' : null,
                          msg.intent === 'interested' ? '🏷️ Tag as hot lead' : null,
                          msg.intent === 'interested' ? '👥 Route to sales' : null,
                          msg.intent === 'meeting_request' ? '📅 Book meeting' : null,
                          msg.intent === 'price_inquiry' ? '💰 Send pricing' : null,
                        ].filter(Boolean) as string[]}
                        isExecuting={executingActions === msg.id}
                        onExecute={() => handleExecuteActions(msg)}
                      />
                    </div>

                    {/* AI Response Templates */}
                    {msg.ai_suggestions && msg.ai_suggestions.length > 0 ? (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-blue-900 mb-2">✍️ Response Templates</p>
                        <div className="space-y-2">
                          {msg.ai_suggestions.map((suggestion) => (
                            <div
                              key={suggestion.option}
                              className="p-2 bg-white border border-blue-100 rounded text-xs cursor-pointer hover:bg-blue-100 transition"
                              data-testid={`suggestion-${suggestion.option}`}
                            >
                              <p className="font-medium text-blue-900 mb-1">Option {suggestion.option}</p>
                              <p className="text-blue-700 text-xs line-clamp-2">{suggestion.response}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-amber-700">Generating response ideas...</span>
                      </div>
                    )}
                  </div>
                ) : null;
              })()
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Sparkles className="w-8 h-8 opacity-30 mx-auto mb-2" />
                  <p className="text-xs">Select a message to manage & act</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
