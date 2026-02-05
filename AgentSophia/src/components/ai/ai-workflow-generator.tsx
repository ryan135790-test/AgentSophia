import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { generateWorkflowWithAI, type WorkflowGenerationRequest, type BrandVoice } from '@/lib/openai';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
  Sparkles, 
  GitBranch,
  Mail,
  Linkedin,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Bot,
  User,
  Clock,
  Zap,
  Target,
  Brain
} from 'lucide-react';

interface Props {
  brandVoice?: BrandVoice;
}

type ConversationStep = 'welcome' | 'goal' | 'audience' | 'channels' | 'steps' | 'smart-timing' | 'personalization' | 'intent-classification' | 'confirm' | 'generating' | 'complete';

interface Message {
  sender: 'sophia' | 'user';
  text: string;
  timestamp: Date;
}

interface UserPreferences {
  goal?: string;
  targetAudience?: string;
  selectedChannels: string[];
  numberOfSteps: number;
  useSmartTiming: boolean;
  usePersonalization: boolean;
  useIntentClassification: boolean;
}

export function AIWorkflowGenerator({ brandVoice }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [conversationStep, setConversationStep] = useState<ConversationStep>('welcome');
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [preferences, setPreferences] = useState<UserPreferences>({
    selectedChannels: [],
    numberOfSteps: 9,
    useSmartTiming: true,
    usePersonalization: true,
    useIntentClassification: true
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedWorkflow, setGeneratedWorkflow] = useState<any>(null);
  const [connectedIntegrations, setConnectedIntegrations] = useState({
    email: true, // Always available via Supabase
    linkedin: false,
    sms: false,
  });

  // Check which integrations are connected
  useEffect(() => {
    const checkIntegrations = async () => {
      if (!user) return;
      
      // Check for LinkedIn OAuth connection
      const { data: linkedinData } = await supabase
        .from('oauth_connections')
        .select('id')
        .eq('user_id', user.id)
        .eq('provider', 'linkedin')
        .eq('is_active', true)
        .single();
      
      // Check for SMS (Twilio) configuration
      const { data: smsData } = await supabase
        .from('channel_connectors')
        .select('id')
        .eq('user_id', user.id)
        .eq('channel', 'sms')
        .eq('is_active', true)
        .single();

      setConnectedIntegrations({
        email: true,
        linkedin: !!linkedinData,
        sms: !!smsData
      });
    };

    checkIntegrations();
  }, [user]);

  // Initialize conversation
  useEffect(() => {
    if (messages.length === 0) {
      addSophiaMessage(
        "Hi! I'm Agent Sophia. I'll help you create a powerful outreach workflow tailored to your goals. Let's get started! 🚀\n\nWhat's the main goal of your campaign? (e.g., 'Book demos with VP of Sales at SaaS companies')"
      );
    }
  }, [messages.length]);

  const addSophiaMessage = (text: string) => {
    setMessages(prev => [...prev, {
      sender: 'sophia',
      text,
      timestamp: new Date()
    }]);
  };

  const addUserMessage = (text: string) => {
    setMessages(prev => [...prev, {
      sender: 'user',
      text,
      timestamp: new Date()
    }]);
  };

  const handleUserResponse = () => {
    if (!userInput.trim()) return;

    addUserMessage(userInput);
    const response = userInput;
    setUserInput('');

    // Process response based on current step
    setTimeout(() => {
      processConversationStep(response);
    }, 500);
  };

  const processConversationStep = (response: string) => {
    switch (conversationStep) {
      case 'welcome':
        setPreferences(prev => ({ ...prev, goal: response }));
        setConversationStep('audience');
        addSophiaMessage(
          `Great! "${response}" - I love it! 🎯\n\nNow, who is your target audience? Be specific about their role, company size, or industry. (e.g., 'VP of Sales at 50-500 employee SaaS companies')`
        );
        break;

      case 'audience':
        setPreferences(prev => ({ ...prev, targetAudience: response }));
        setConversationStep('channels');
        
        const availableChannels = [];
        if (connectedIntegrations.email) availableChannels.push('Email');
        if (connectedIntegrations.linkedin) availableChannels.push('LinkedIn');
        if (connectedIntegrations.sms) availableChannels.push('SMS');
        
        addSophiaMessage(
          `Perfect! Targeting "${response}". 👥\n\nI've detected these connected channels:\n${availableChannels.map(c => `✓ ${c}`).join('\n')}\n\nWhich channels would you like me to use? (Type the numbers separated by commas, e.g., "1,2,3")\n\n1. Email ${connectedIntegrations.email ? '✓' : '(Not connected)'}\n2. LinkedIn ${connectedIntegrations.linkedin ? '✓' : '(Not connected)'}\n3. SMS ${connectedIntegrations.sms ? '✓' : '(Not connected)'}`
        );
        break;

      case 'channels':
        const channelMap: Record<string, string> = {
          '1': 'email',
          '2': 'linkedin_connect',
          '3': 'sms'
        };
        
        const selectedNumbers = response.split(',').map(n => n.trim());
        const channels = selectedNumbers.map(n => channelMap[n]).filter(Boolean);
        
        // Validate that all selected channels are actually connected
        const invalidChannels = [];
        if (channels.includes('email') && !connectedIntegrations.email) invalidChannels.push('Email');
        if ((channels.includes('linkedin_connect') || channels.includes('linkedin_message')) && !connectedIntegrations.linkedin) invalidChannels.push('LinkedIn');
        if (channels.includes('sms') && !connectedIntegrations.sms) invalidChannels.push('SMS');
        
        if (invalidChannels.length > 0) {
          addSophiaMessage(
            `Oops! ${invalidChannels.join(', ')} ${invalidChannels.length === 1 ? 'is' : 'are'} not connected. Please select only from the connected channels listed above.`
          );
          return; // Don't advance, ask again
        }
        
        if (channels.length === 0) {
          addSophiaMessage(
            `I didn't catch that. Please enter the numbers of the channels you want to use, separated by commas (e.g., "1,2")`
          );
          return;
        }
        
        setPreferences(prev => ({ ...prev, selectedChannels: channels }));
        setConversationStep('steps');
        
        addSophiaMessage(
          `Excellent choice! I'll use ${channels.length} channel(s) for maximum reach. 📨\n\nHow many touchpoints (steps) should I create in this workflow?\n\n• 5 steps - Quick campaign (2 weeks)\n• 7 steps - Standard campaign (3 weeks)\n• 9 steps - Recommended for B2B (4 weeks)\n• 12 steps - Extended campaign (6 weeks)\n\nType a number (5, 7, 9, or 12):`
        );
        break;

      case 'steps':
        const steps = parseInt(response) || 9;
        setPreferences(prev => ({ ...prev, numberOfSteps: steps }));
        setConversationStep('smart-timing');
        
        addSophiaMessage(
          `Perfect! I'll create a ${steps}-step workflow. 📊\n\nNow let's configure the AI-powered features:\n\n⏰ **Smart Timing**: Should I optimize send times based on B2B best practices? (Avoids weekends, prefers Tuesday-Thursday 9am-11am and 2pm-4pm)\n\nType yes or no:`
        );
        break;

      case 'smart-timing':
        const useSmartTiming = response.toLowerCase().includes('yes') || response.toLowerCase().includes('y');
        setPreferences(prev => ({ ...prev, useSmartTiming }));
        setConversationStep('personalization');
        
        addSophiaMessage(
          `${useSmartTiming ? '✓ Smart Timing enabled!' : '✗ Smart Timing disabled.'}\n\n🎯 **Personalization Engine**: Should I auto-personalize messages using {{first_name}}, {{company}}, {{role}} variables?\n\nType yes or no:`
        );
        break;

      case 'personalization':
        const usePersonalization = response.toLowerCase().includes('yes') || response.toLowerCase().includes('y');
        setPreferences(prev => ({ ...prev, usePersonalization }));
        setConversationStep('intent-classification');
        
        addSophiaMessage(
          `${usePersonalization ? '✓ Personalization enabled!' : '✗ Personalization disabled.'}\n\n🧠 **Intent Classification**: Should I add conditional logic to categorize responses (interested/not interested/out of office)?\n\nType yes or no:`
        );
        break;

      case 'intent-classification':
        const useIntentClassification = response.toLowerCase().includes('yes') || response.toLowerCase().includes('y');
        setPreferences(prev => ({ ...prev, useIntentClassification }));
        
        // Capture current state for summary (before async state updates)
        const finalSmartTiming = preferences.useSmartTiming;
        const finalPersonalization = preferences.usePersonalization;
        const finalIntentClassification = useIntentClassification;
        
        setConversationStep('confirm');
        
        addSophiaMessage(
          `${useIntentClassification ? '✓ Intent Classification enabled!' : '✗ Intent Classification disabled.'}\n\n📋 **Configuration Summary:**\n• Goal: ${preferences.goal}\n• Audience: ${preferences.targetAudience}\n• Channels: ${preferences.selectedChannels.length} selected\n• Steps: ${preferences.numberOfSteps}\n• AI Features:\n  ${finalSmartTiming ? '✓' : '✗'} Smart Timing\n  ${finalPersonalization ? '✓' : '✗'} Personalization Engine\n  ${finalIntentClassification ? '✓' : '✗'} Intent Classification\n\nReady to generate your workflow? (yes to continue, no to start over)`
        );
        break;

      case 'confirm':
        const confirmed = response.toLowerCase().includes('yes') || response.toLowerCase().includes('y');
        
        if (!confirmed) {
          setConversationStep('welcome');
          setPreferences({
            selectedChannels: [],
            numberOfSteps: 9,
            useSmartTiming: true,
            usePersonalization: true,
            useIntentClassification: true
          });
          addSophiaMessage(
            `No problem! Let's start fresh. 🔄\n\nWhat's the main goal of your campaign?`
          );
          return;
        }
        
        setConversationStep('generating');
        addSophiaMessage(
          `Great! Generating your ${preferences.numberOfSteps}-step workflow now... 🚀`
        );
        
        // Trigger generation
        setTimeout(() => {
          generateWorkflow();
        }, 1000);
        break;
    }
  };

  const generateWorkflow = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to generate workflows',
        variant: 'destructive',
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Create AI generation request with smart features
      const workflow = await generateWorkflowWithAI({
        goal: preferences.goal || '',
        targetAudience: preferences.targetAudience || '',
        numberOfSteps: preferences.numberOfSteps,
        channels: preferences.selectedChannels,
        industry: 'B2B SaaS',
        brandVoice,
        // Add smart features preferences to the generation
        smartTiming: preferences.useSmartTiming,
        personalization: preferences.usePersonalization,
        intentClassification: preferences.useIntentClassification
      });
      
      // Validate AI response
      if (!workflow || !workflow.name || !workflow.nodes || !workflow.edges) {
        throw new Error('AI generated an invalid workflow structure');
      }
      
      if (workflow.nodes.length === 0) {
        throw new Error('AI generated a workflow with no nodes');
      }
      
      // Validate all edges reference existing nodes
      const nodeIds = new Set(workflow.nodes.map((n: any) => n.id));
      const invalidEdges = workflow.edges.filter((e: any) => !nodeIds.has(e.source) || !nodeIds.has(e.target));
      if (invalidEdges.length > 0) {
        throw new Error(`Invalid workflow structure: ${invalidEdges.length} edges reference non-existent nodes`);
      }
      
      setGeneratedWorkflow(workflow);

      // Save to database
      const { data: savedWorkflow, error: workflowError } = await supabase
        .from('workflows')
        .insert({
          name: workflow.name,
          description: workflow.description,
          status: 'draft',
          user_id: user.id,
          ai_generated: true,
          ai_prompt: preferences.goal,
          ai_model: 'gpt-5',
          ai_summary: workflow.reasoning
        })
        .select()
        .single();

      if (workflowError) throw workflowError;

      // Save nodes
      const nodesToInsert = workflow.nodes.map((node: any) => ({
        id: node.id,
        workflow_id: savedWorkflow.id,
        node_type: node.type,
        label: node.label,
        position_x: node.position.x,
        position_y: node.position.y,
        config: node.config,
      }));

      const { error: nodesError } = await supabase
        .from('workflow_nodes')
        .insert(nodesToInsert);

      if (nodesError) throw nodesError;

      // Save edges
      const edgesToInsert = workflow.edges.map((edge: any) => ({
        id: edge.id,
        workflow_id: savedWorkflow.id,
        source_node_id: edge.source,
        target_node_id: edge.target,
        label: edge.label || null,
        condition: edge.condition || null,
      }));

      const { error: edgesError } = await supabase
        .from('workflow_edges')
        .insert(edgesToInsert);

      if (edgesError) throw edgesError;

      setConversationStep('complete');
      addSophiaMessage(
        `🎉 Success! I've created "${workflow.name}" with ${workflow.nodes.length} steps!\n\n**Strategy:** ${workflow.strategy}\n\n**Timeline:** ${workflow.totalDuration} days total\n\n**What's Next?**\n✅ Your workflow is saved and ready to use\n✅ You can now assign contacts to start the outreach\n✅ Monitor performance in the "Performance" tab above\n\nWant to create another workflow? Just type "create workflow" to start fresh!`
      );

      toast({
        title: 'Workflow Generated! 🎉',
        description: `Created "${workflow.name}" with ${workflow.nodes.length} steps`,
      });

    } catch (error) {
      console.error('Error generating workflow:', error);
      setConversationStep('welcome');
      addSophiaMessage(
        `😔 Oops! I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}\n\nLet's try again. What's your campaign goal?`
      );
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Could not generate workflow. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-purple-500" />
          Chat with Agent Sophia
        </CardTitle>
        <CardDescription>
          Have a conversation with Sophia to build your perfect outreach workflow
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conversation Messages */}
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.sender === 'sophia' && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-purple-500 text-white">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              
              <div
                className={`rounded-lg px-4 py-3 max-w-[80%] ${
                  message.sender === 'sophia'
                    ? 'bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                <p className="text-sm whitespace-pre-line">{message.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {message.sender === 'user' && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {isGenerating && (
            <div className="flex gap-3 justify-start">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-purple-500 text-white">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-4 py-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  <p className="text-sm">Creating your workflow...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        {!isGenerating && conversationStep !== 'complete' && conversationStep !== 'generating' && (
          <div className="flex gap-2 pt-4 border-t">
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleUserResponse();
                }
              }}
              placeholder="Type your response..."
              className="flex-1"
              data-testid="input-sophia-chat"
            />
            <Button onClick={handleUserResponse} disabled={!userInput.trim()} data-testid="button-send-message">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* AI Features Info */}
        {conversationStep === 'welcome' && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              Sophia's AI-Powered Capabilities:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-purple-600" />
                  <span className="text-xs font-medium">Smart Timing</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Optimizes send times for maximum engagement
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Target className="h-3 w-3 text-purple-600" />
                  <span className="text-xs font-medium">Personalization</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-personalizes using contact data
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Brain className="h-3 w-3 text-purple-600" />
                  <span className="text-xs font-medium">Intent Classification</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Categorizes responses intelligently
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
