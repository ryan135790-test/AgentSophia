import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  Send, 
  X, 
  Sparkles, 
  User, 
  Loader2,
  MessageSquare,
  Minimize2,
  Maximize2
} from 'lucide-react';
// Removed OpenAI import - now using Supabase Edge Function with RAG

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface AIAssistantChatProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string; // Current page context (e.g., "campaigns", "contacts", "inbox")
}

export function AIAssistantChat({ isOpen, onClose, context }: AIAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI assistant. I can help you with anything on this platform - building campaigns, managing contacts, analyzing data, or answering questions. What would you like to do?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getSystemPrompt = () => {
    const basePrompt = `You are an AI assistant embedded in an AI Lead Platform. You help users with:

1. Building multi-channel campaigns (LinkedIn, Email, SMS, AI Phone Calls, Voicemail, Social Media)
2. Managing contacts and CRM activities
3. Analyzing campaign performance
4. Setting up automation workflows
5. Configuring brand voice and messaging
6. Understanding the unified inbox and AI intent classification
7. General platform navigation and best practices

Current context: ${context || 'general platform'}

Be helpful, concise, and actionable. When suggesting actions:
- Guide users step-by-step
- Mention specific features they can use
- Provide best practices for lead generation and outreach
- Be encouraging and supportive

Keep responses clear and to the point. If a user wants to build something complex, break it down into simple steps.`;

    return basePrompt;
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // **NEW: Call our RAG-enabled Supabase Edge Function**
      // This searches internal data FIRST before using OpenAI
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }

      // Get auth token from localStorage (if user is logged in)
      const session = localStorage.getItem('supabase.auth.token');
      let authToken = '';
      
      if (session) {
        try {
          const sessionData = JSON.parse(session);
          authToken = sessionData?.access_token || '';
        } catch (e) {
          console.error('Could not parse session:', e);
        }
      }

      // Determine session type based on context
      let sessionType: 'workflow' | 'campaign' | 'analysis' = 'workflow';
      if (context?.includes('campaign')) {
        sessionType = 'campaign';
      } else if (context?.includes('inbox') || context?.includes('contact') || context?.includes('analytics')) {
        sessionType = 'analysis';
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken || supabaseKey}`,
        },
        body: JSON.stringify({
          messages: messages.slice(-10).map(m => ({ 
            role: m.role, 
            content: m.content 
          })),
          sessionType,
          context: { page: context }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const data = await response.json();
      
      // Show source badge if from internal data
      let content = data.message;
      if (data.source === 'database') {
        content = `💾 *Answered from your platform data*\n\n${content}`;
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('AI Assistant error:', error);
      
      let errorContent = "I'm having trouble connecting to OpenAI right now, but I can still help guide you! ";
      
      // Check for specific error types
      if (error?.code === 'insufficient_quota' || error?.status === 429) {
        errorContent = "⚠️ **OpenAI API Quota Exceeded** - Your OpenAI API key has reached its usage limit. But I can still help you! ";
      } else if (error?.message?.includes('API key')) {
        errorContent = "⚠️ **API Key Issue** - There's a problem with the OpenAI API key. But I can still help you! ";
      }
      
      // Provide helpful guidance based on their question
      const question = input.toLowerCase();
      if (question.includes('campaign')) {
        errorContent += "\n\n**To build a campaign:**\n1. Go to **AI Campaigns** → **Campaign Builder**\n2. Name your campaign\n3. Select channels (LinkedIn, Email, SMS, etc.)\n4. Describe your goal\n5. Click **Generate with AI**\n\nThe campaign builder has its own AI that will create your entire campaign!";
      } else if (question.includes('contact') || question.includes('import')) {
        errorContent += "\n\n**To import contacts:**\n1. Go to **CRM** section\n2. Click **Import Contacts**\n3. Choose your method:\n   - Upload CSV file\n   - Paste LinkedIn URLs\n   - Paste email list\n4. Map fields and import!";
      } else if (question.includes('inbox') || question.includes('response')) {
        errorContent += "\n\n**To check responses:**\n1. Go to **Unified Inbox**\n2. View all campaign responses in one place\n3. AI automatically classifies intent\n4. Edit contact info inline\n5. Generate AI responses with one click!";
      } else {
        errorContent += "\n\n**Here's what you can do:**\n• **Build Campaign** - AI Campaigns → Campaign Builder\n• **Import Contacts** - CRM → Import Contacts\n• **Check Responses** - Unified Inbox\n• **Set Brand Voice** - In Campaign Builder settings\n\nWhat would you like to do?";
      }
      
      const errorMessage: Message = {
        role: 'assistant',
        content: errorContent,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Chat cleared! How can I help you today?",
        timestamp: new Date()
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 shadow-2xl rounded-lg overflow-hidden">
      <Card className="border-2 border-purple-200 dark:border-purple-800">
        <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-white/20 rounded-full">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-white text-base">AI Assistant</CardTitle>
                <p className="text-xs text-white/80 mt-0.5">
                  {context ? `Helping with ${context}` : 'Ready to help'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMinimized(!isMinimized)}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
                data-testid="button-minimize-chat"
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
                data-testid="button-close-chat"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {!isMinimized && (
          <CardContent className="p-0">
            <ScrollArea className="h-96 p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div className={`flex-shrink-0 ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                      {message.role === 'user' ? (
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full">
                          <User className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                      ) : (
                        <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-full">
                          <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                      )}
                    </div>
                    <div
                      className={`flex-1 ${message.role === 'user' ? 'order-1' : 'order-2'}`}
                    >
                      <div
                        className={`rounded-lg p-3 ${
                          message.role === 'user'
                            ? 'bg-purple-500 text-white ml-8'
                            : 'bg-gray-100 dark:bg-gray-800 mr-8'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.role === 'user' 
                            ? 'text-purple-200' 
                            : 'text-muted-foreground'
                        }`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-full">
                      <Loader2 className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-spin" />
                    </div>
                    <div className="flex-1">
                      <div className="rounded-lg p-3 bg-gray-100 dark:bg-gray-800">
                        <p className="text-sm text-muted-foreground">Thinking...</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t bg-gray-50 dark:bg-gray-900">
              <div className="flex gap-2 mb-2">
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800" onClick={clearChat}>
                  Clear Chat
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {messages.length} messages
                </Badge>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ask me anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1"
                  data-testid="input-ai-assistant-message"
                />
                <Button
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  size="icon"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  data-testid="button-send-message"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
