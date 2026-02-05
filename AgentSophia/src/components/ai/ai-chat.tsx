import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, 
  Send, 
  User, 
  MessageSquare,
  Settings,
  Workflow,
  Target,
  Sparkles,
  CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
}

interface AIChatSession {
  id: string;
  title: string;
  session_type: 'workflow' | 'campaign' | 'analysis';
  messages: Message[];
  context_data: any;
  result_configuration_id?: string;
  is_active: boolean;
}

interface AIChatProps {
  isOpen: boolean;
  onClose: () => void;
  sessionType: 'workflow' | 'campaign' | 'analysis';
  onComplete?: (configurationId: string) => void;
}

const SESSION_TYPE_CONFIG = {
  workflow: {
    title: 'AI Workflow Builder',
    icon: Workflow,
    description: 'Let AI help you create automated workflows',
    startMessage: "Hi! I'm here to help you create an automated workflow. What kind of automation are you looking to set up? For example:\n\n• LinkedIn outreach sequences\n• Email nurturing campaigns\n• Multi-channel follow-ups\n• Lead qualification flows",
  },
  campaign: {
    title: 'AI Campaign Creator',
    icon: Target,
    description: 'Design effective campaigns with AI assistance',
    startMessage: "Let's create a powerful campaign together! I can help you with:\n\n• Target audience definition\n• Message personalization\n• Channel strategy\n• Timeline optimization\n\nWhat's your campaign goal?",
  },
  analysis: {
    title: 'AI Performance Analyst',
    icon: Sparkles,
    description: 'Get insights and optimization recommendations',
    startMessage: "I'll help you analyze your campaigns and workflows. What would you like to review?\n\n• Campaign performance\n• Contact engagement rates\n• Workflow effectiveness\n• Channel optimization",
  }
};

export function AIChat({ isOpen, onClose, sessionType, onComplete }: AIChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentSession, setCurrentSession] = useState<AIChatSession | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const config = SESSION_TYPE_CONFIG[sessionType];

  useEffect(() => {
    if (isOpen && user) {
      initializeSession();
    }
  }, [isOpen, user, sessionType]);

  useEffect(() => {
    scrollToBottom();
  }, [currentSession?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSession = async () => {
    try {
      // Create a new chat session
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .insert({
          user_id: user!.id,
          session_type: sessionType,
          title: `${config.title} - ${new Date().toLocaleDateString()}`,
          messages: [{
            id: 'welcome',
            role: 'assistant',
            content: config.startMessage,
            timestamp: new Date().toISOString(),
            suggestions: getSuggestionsForType(sessionType)
          }]
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentSession({
        ...data,
        session_type: data.session_type as 'workflow' | 'campaign' | 'analysis',
        messages: data.messages as unknown as Message[]
      });
    } catch (error) {
      console.error('Error initializing session:', error);
      toast({
        title: 'Error',
        description: 'Failed to start AI chat session',
        variant: 'destructive',
      });
    }
  };

  const getSuggestionsForType = (type: string): string[] => {
    switch (type) {
      case 'workflow':
        return [
          'Create LinkedIn outreach sequence',
          'Set up email nurturing campaign',
          'Build multi-channel follow-up',
          'Design lead qualification flow'
        ];
      case 'campaign':
        return [
          'Generate leads from LinkedIn',
          'Launch email marketing campaign',
          'Create social media outreach',
          'Build referral program'
        ];
      case 'analysis':
        return [
          'Analyze campaign performance',
          'Review contact engagement',
          'Optimize message timing',
          'Improve conversion rates'
        ];
      default:
        return [];
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !currentSession || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString()
    };

    const updatedMessages = [...currentSession.messages, userMessage];
    setCurrentSession(prev => prev ? { ...prev, messages: updatedMessages } : null);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Call AI Assistant Edge Function
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content
          })),
          sessionType,
          context: currentSession.context_data
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const aiData = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiData.message,
        timestamp: new Date().toISOString(),
        suggestions: getSuggestionsBasedOnContent(aiData.message, sessionType)
      };

      const finalMessages = [...updatedMessages, assistantMessage];

      // Update the session in the database
      await supabase
        .from('ai_chat_sessions')
        .update({ 
          messages: finalMessages as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSession.id);

      setCurrentSession(prev => prev ? { ...prev, messages: finalMessages } : null);

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSuggestionsBasedOnContent = (content: string, type: string): string[] => {
    // Generate contextual suggestions based on AI response
    if (type === 'workflow') {
      return ['Customize workflow', 'Set timing', 'Add channels', 'Create now'];
    } else if (type === 'campaign') {
      return ['Refine targeting', 'Adjust messaging', 'Set budget', 'Launch campaign'];
    } else {
      return ['Show details', 'Export report', 'Apply recommendations'];
    }
  };

  const generateAIResponse = async (message: string, type: string, messages: Message[]) => {
    // In a real implementation, this would call OpenAI or another AI service
    // For now, we'll simulate intelligent responses based on the message content
    
    const messageCount = messages.filter(m => m.role === 'user').length;
    
    if (type === 'workflow') {
      if (message.toLowerCase().includes('linkedin')) {
        return {
          content: "Great choice! LinkedIn workflows are highly effective. I'll help you create a LinkedIn outreach sequence. Here's what I recommend:\n\n**Step 1**: Profile research and targeting\n**Step 2**: Personalized connection request\n**Step 3**: Follow-up message (2-3 days later)\n**Step 4**: Value-driven second follow-up\n**Step 5**: Call-to-action message\n\nWould you like me to customize the messaging for your specific industry or target audience?",
          suggestions: ['Yes, customize for my industry', 'Set up automatic timing', 'Add email backup sequence', 'Create this workflow now'],
          shouldCreateConfig: messageCount >= 3
        };
      } else if (message.toLowerCase().includes('email')) {
        return {
          content: "Perfect! Email nurturing is essential for lead conversion. Let me design an email sequence for you:\n\n**Day 1**: Welcome & value introduction\n**Day 3**: Educational content\n**Day 7**: Social proof & case studies\n**Day 14**: Soft pitch with clear CTA\n**Day 21**: Final opportunity\n\nWhat's your target audience and what value do you provide?",
          suggestions: ['B2B software sales', 'Consulting services', 'E-commerce products', 'Create workflow now'],
          shouldCreateConfig: messageCount >= 2
        };
      }
      
      return {
        content: "I can help you create various types of workflows. Could you be more specific about:\n\n• What channels do you want to use? (LinkedIn, Email, SMS)\n• Who is your target audience?\n• What's your main goal? (Lead generation, nurturing, sales)\n• How many steps do you envision?",
        suggestions: ['LinkedIn outreach', 'Email sequences', 'Multi-channel approach', 'Lead nurturing'],
        shouldCreateConfig: false
      };
    }

    if (type === 'campaign') {
      if (messageCount >= 2) {
        return {
          content: "Based on our conversation, I'll create a comprehensive campaign for you. Here's what I've designed:\n\n✅ **Target Audience**: Defined based on your requirements\n✅ **Channel Strategy**: Multi-channel approach\n✅ **Message Templates**: Personalized for maximum engagement\n✅ **Timeline**: Optimized for best results\n\nShall I create this campaign configuration for you?",
          suggestions: ['Yes, create it now', 'Modify targeting', 'Add more channels', 'Review timeline'],
          shouldCreateConfig: true
        };
      }
      
      return {
        content: "I'm gathering information to create the perfect campaign for you. Tell me more about:\n\n• Your ideal customer profile\n• Your unique value proposition\n• Your preferred communication style\n• Your timeline and goals",
        suggestions: ['Generate B2B leads', 'Increase brand awareness', 'Drive sales conversions', 'Build partnerships'],
        shouldCreateConfig: false
      };
    }

    // Analysis type
    return {
      content: "I'll analyze your current performance and provide actionable insights. Based on typical patterns, I recommend:\n\n📊 **Engagement Analysis**: Your LinkedIn response rate could improve by 23%\n📈 **Timing Optimization**: Send messages on Tuesday-Thursday, 10-11 AM\n🎯 **Message Personalization**: Add industry-specific references\n\nWhat specific metrics would you like me to dive deeper into?",
      suggestions: ['Response rates', 'Conversion metrics', 'Channel performance', 'Best sending times'],
      shouldCreateConfig: false
    };
  };

  const createConfigurationFromChat = async (messages: Message[]) => {
    try {
      const configData = extractConfigFromMessages(messages, sessionType);
      
      const { data, error } = await supabase
        .from('ai_configurations')
        .insert({
          user_id: user!.id,
          name: configData.name,
          description: configData.description,
          channels: configData.channels,
          config_data: configData.config,
          is_active: false
        })
        .select()
        .single();

      if (error) throw error;

      // Update session with result
      await supabase
        .from('ai_chat_sessions')
        .update({ result_configuration_id: data.id })
        .eq('id', currentSession!.id);

      toast({
        title: 'Success',
        description: `${sessionType === 'workflow' ? 'Workflow' : 'Campaign'} created successfully!`,
      });

      if (onComplete) {
        onComplete(data.id);
      }

    } catch (error) {
      console.error('Error creating configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to create configuration',
        variant: 'destructive',
      });
    }
  };

  const extractConfigFromMessages = (messages: Message[], type: string) => {
    // Extract configuration data from the conversation
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content).join(' ');
    
    const hasLinkedIn = userMessages.toLowerCase().includes('linkedin');
    const hasEmail = userMessages.toLowerCase().includes('email');
    const hasSMS = userMessages.toLowerCase().includes('sms');
    
    const channels = [];
    if (hasLinkedIn) channels.push('linkedin');
    if (hasEmail) channels.push('email');
    if (hasSMS) channels.push('sms');
    if (channels.length === 0) channels.push('email'); // Default

    return {
      name: `AI-Generated ${type === 'workflow' ? 'Workflow' : 'Campaign'} - ${new Date().toLocaleDateString()}`,
      description: `Created through AI chat session focusing on ${channels.join(', ')} outreach`,
      channels,
      config: {
        aiGenerated: true,
        sessionId: currentSession?.id,
        sequence: generateDefaultSequence(type, channels),
        personalization: {
          enabled: true,
          fields: ['first_name', 'company', 'position']
        },
        timing: {
          delays: ['1d', '3d', '7d'],
          optimal_hours: [10, 11, 14, 15]
        }
      }
    };
  };

  const generateDefaultSequence = (type: string, channels: string[]) => {
    if (type === 'workflow' && channels.includes('linkedin')) {
      return [
        {
          type: 'message',
          channel: 'linkedin',
          content: 'Hi {{first_name}}, I noticed your work at {{company}} and would love to connect!',
          delay: '0'
        },
        {
          type: 'delay',
          delay: '2d'
        },
        {
          type: 'message',
          channel: 'linkedin',
          content: 'Thanks for connecting! I saw your background in {{position}} and thought you might be interested in...',
          delay: '0'
        }
      ];
    }
    
    return [
      {
        type: 'message',
        channel: channels[0],
        content: 'Hello {{first_name}}, reaching out regarding...',
        delay: '0'
      }
    ];
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
  };

  if (!isOpen) return null;

  const IconComponent = config.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <IconComponent className="h-5 w-5 text-primary" />
            <span>{config.title}</span>
            {currentSession?.result_configuration_id && (
              <Badge className="bg-success text-success-foreground">
                <CheckCircle className="h-3 w-3 mr-1" />
                Created
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-[70vh]">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {currentSession?.messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                    <div className={`flex items-start space-x-2 ${message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`p-2 rounded-full ${message.role === 'user' ? 'bg-primary' : 'bg-muted'}`}>
                        {message.role === 'user' ? (
                          <User className="h-4 w-4 text-primary-foreground" />
                        ) : (
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className={`p-3 rounded-lg ${
                        message.role === 'user' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}>
                        <div className="whitespace-pre-wrap">{message.content}</div>
                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="text-xs text-muted-foreground">Suggestions:</div>
                            <div className="flex flex-wrap gap-2">
                              {message.suggestions.map((suggestion, index) => (
                                <Button
                                  key={index}
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleSuggestionClick(suggestion)}
                                  className="text-xs"
                                >
                                  {suggestion}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={`text-xs text-muted-foreground mt-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 rounded-full bg-muted">
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <Input
                placeholder="Type your message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                disabled={isLoading}
              />
              <Button onClick={sendMessage} disabled={isLoading || !inputMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}