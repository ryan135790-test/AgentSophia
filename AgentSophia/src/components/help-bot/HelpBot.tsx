import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { HelpCircle, Send, Bot, User, ExternalLink, Sparkles, X } from 'lucide-react';
import { searchDocs, buildDocsContext, type DocSection } from '@/lib/platform-docs';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  links?: { title: string; path: string; description: string }[];
  timestamp: Date;
}

interface ParsedResponse {
  text: string;
  links: { title: string; path: string; description: string }[];
}

function parseAIResponse(response: string, relevantDocs: DocSection[]): ParsedResponse {
  const links = relevantDocs.slice(0, 3).map(doc => ({
    title: doc.title,
    path: doc.path,
    description: doc.description
  }));
  
  return { text: response, links };
}

export function HelpBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your IntelLead Help Assistant. I can guide you through any feature in the platform. What would you like to learn about?",
      links: [
        { title: 'Dashboard Overview', path: '/dashboard', description: 'Start here to see your metrics' },
        { title: 'Unified Inbox', path: '/unified-inbox', description: 'Manage all conversations' },
        { title: 'Campaigns', path: '/campaigns', description: 'Create outreach sequences' }
      ],
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
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
      const relevantDocs = searchDocs(userMessage.content);
      const docsContext = buildDocsContext();
      
      const systemPrompt = `You are a helpful assistant for IntelLead, an AI-powered lead generation platform. Your job is to help users understand how to use the platform features.

IMPORTANT: Keep responses concise (2-4 sentences max) and actionable. Focus on what the user asked.

Here are the platform features and their navigation paths:
${docsContext}

When answering:
1. Be specific about which page to navigate to
2. Mention the exact path when relevant
3. If the feature has steps, summarize the key ones
4. Always be friendly and encouraging

The user asked: "${userMessage.content}"

${relevantDocs.length > 0 ? `Most relevant features for this query:\n${relevantDocs.slice(0, 3).map(d => `- ${d.title} (${d.path}): ${d.description}`).join('\n')}` : ''}`;

      const response = await fetch('/api/help-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          systemPrompt,
          relevantDocs: relevantDocs.slice(0, 5)
        })
      });

      let assistantContent = '';
      
      if (response.ok) {
        const data = await response.json();
        assistantContent = data.response || '';
      } else {
        if (relevantDocs.length > 0) {
          const doc = relevantDocs[0];
          assistantContent = `I found what you're looking for! Go to **${doc.title}** to ${doc.description.toLowerCase()}. ${doc.steps ? `Here's how: ${doc.steps[0]}` : ''}`;
        } else {
          assistantContent = "I'm not sure about that specific feature. Try asking about campaigns, contacts, inbox, analytics, or settings!";
        }
      }

      const { text, links } = parseAIResponse(assistantContent, relevantDocs);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: text,
        links: links.length > 0 ? links : undefined,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Help bot error:', error);
      const relevantDocs = searchDocs(userMessage.content);
      
      const fallbackMessage: Message = {
        role: 'assistant',
        content: relevantDocs.length > 0 
          ? `Check out ${relevantDocs[0].title} - ${relevantDocs[0].description}`
          : "I can help you with campaigns, contacts, inbox, analytics, and settings. What interests you?",
        links: relevantDocs.slice(0, 3).map(d => ({ title: d.title, path: d.path, description: d.description })),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickLink = (path: string) => {
    setIsOpen(false);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative"
          data-testid="button-help-bot"
        >
          <HelpCircle className="h-5 w-5" />
          <span className="sr-only">Help</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[450px] flex flex-col p-0">
        <SheetHeader className="p-4 border-b bg-gradient-to-r from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20">
          <SheetTitle className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-500 rounded-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span>Platform Help</span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2'
                      : 'space-y-3'
                  }`}
                >
                  {message.role === 'user' ? (
                    <p className="text-sm">{message.content}</p>
                  ) : (
                    <>
                      <div className="bg-muted/50 dark:bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                      {message.links && message.links.length > 0 && (
                        <div className="space-y-2 pl-1">
                          <p className="text-xs text-muted-foreground font-medium">Quick Links:</p>
                          {message.links.map((link, linkIndex) => (
                            <Link
                              key={linkIndex}
                              to={link.path}
                              onClick={() => handleQuickLink(link.path)}
                              className="flex items-start gap-2 p-2 rounded-lg bg-background hover:bg-accent border border-border/50 transition-colors group"
                              data-testid={`link-help-${link.path.replace(/\//g, '-')}`}
                            >
                              <ExternalLink className="h-4 w-4 mt-0.5 text-violet-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium group-hover:text-violet-500 transition-colors">
                                  {link.title}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {link.description}
                                </p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-muted/50 dark:bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-violet-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask about any feature..."
              disabled={isLoading}
              className="flex-1"
              data-testid="input-help-message"
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || isLoading}
              size="icon"
              data-testid="button-send-help"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Try: "How do I create a campaign?" or "Where are my contacts?"
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
