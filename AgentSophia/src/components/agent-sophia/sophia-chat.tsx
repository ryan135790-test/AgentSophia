import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Bot, 
  User, 
  Send, 
  Loader2,
  Zap,
  Mail,
  Calendar,
  TrendingUp,
  Linkedin,
  MessageSquare,
  Phone,
  Workflow,
  ExternalLink,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Settings,
  Brain,
  History,
  Lightbulb
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useWorkflows, useWorkflowDetails } from "@/hooks/use-workflows";
import { useSophiaWorkspace } from "@/contexts/SophiaWorkspaceContext";
import { QuickCommands } from "@/components/agent-sophia/quick-commands";
import { AgentRoleSelector, AGENT_ROLES } from "@/components/agent-sophia/agent-role-selector";
import { MultiChannelOutboundInterface } from "@/components/agent-sophia/multichannel-outbound-interface";
import { WorkflowNextSteps } from "@/components/agent-sophia/workflow-next-steps";
import { SophiaAnswerOptions } from "@/components/agent-sophia/sophia-answer-options";
import { useSophiaMemory } from "@/hooks/use-sophia-memory";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  answerOptions?: string[]; // Clickable answer options for questions
  workflowId?: string; // Track generated workflow
  showWorkflowButton?: boolean; // Show "Build Workflow" button
}

interface SophiaChatProps {
  quickActionPrompt?: string;
  onPromptUsed?: () => void;
  onWorkflowReady?: (workflowId: string) => void;
}

// Helper function to extract answer options from bullet points and clean content
const extractAnswerOptions = (content: string): { options: string[] | undefined; cleanContent: string } => {
  let answerOptions: string[] | undefined;
  let cleanContent = content;
  
  // First try to find JSON blocks (legacy format) and remove them
  const jsonMatch = cleanContent.match(/```(?:json)?\s*\{[\s\S]*?\}\s*```/);
  if (jsonMatch) {
    try {
      const jsonStr = jsonMatch[0].replace(/```json\s*/, '').replace(/```\s*/, '').replace(/^```/, '').replace(/```$/, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.answerOptions && Array.isArray(parsed.answerOptions)) {
        answerOptions = parsed.answerOptions;
      }
    } catch (e) {
      // JSON parse failed
    }
  }
  
  // Extract bullet point options (new format: • Option text)
  if (!answerOptions) {
    const bulletLines = content.split('\n').filter(line => line.trim().startsWith('•'));
    if (bulletLines.length >= 2) {
      answerOptions = bulletLines.map(line => line.replace(/^[\s•]+/, '').trim()).filter(opt => opt.length > 0);
    }
  }
  
  // Clean the content - remove JSON blocks and standalone bullet option lists at the end
  cleanContent = content
    .replace(/```[\s\S]*?answerOptions[\s\S]*?```/gi, '')
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .filter(line => !line.includes('```') && !line.trim().startsWith('{') && !line.trim().startsWith('}'))
    .join('\n')
    .trim();
  
  return { options: answerOptions, cleanContent };
};

// Direct message preprocessor - strips all JSON code blocks before display
const stripJsonCodeBlocks = (content: string): string => {
  // Remove any line that's just backticks or JSON
  return content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('```') && 
             !trimmed.startsWith('{') && 
             !trimmed.startsWith('}') &&
             !trimmed.includes('answerOptions') &&
             !trimmed.endsWith('```');
    })
    .join('\n')
    .replace(/```[\s\S]*?```/g, '') // Final cleanup for any remaining blocks
    .trim();
};

// Helper function to parse numbered list items and smart bold extraction from message content
const parseNumberedListOptions = (content: string): string[] => {
  const lines = content.split('\n');
  const options: string[] = [];
  let hasNumberedItems = false;
  
  // First pass: look for numbered list items
  for (const line of lines) {
    const numberedMatch = line.match(/^\d+\.\s+([^-\n]+)(?:\s*-\s*[^\n]*)?/);
    if (numberedMatch) {
      const title = numberedMatch[1].trim();
      if (title && !title.endsWith('?')) {
        options.push(title);
        hasNumberedItems = true;
      }
    }
  }
  
  // If we found numbered items, return them
  if (hasNumberedItems) {
    return options;
  }
  
  // Second pass: extract bold text as options (only if not in welcome/feature list context)
  // This handles cases where Sophia lists options like "**Option 1**" or "**Budget range**"
  const isFeaturesContext = content.includes('Build campaigns') && content.includes('Manage your inbox');
  
  if (!isFeaturesContext) {
    for (const line of lines) {
      const boldMatch = line.match(/\*\*([^*]+)\*\*/);
      if (boldMatch) {
        const title = boldMatch[1].trim();
        // Only add if it looks like an option (reasonable length, not a question, not "Examples:")
        if (title && 
            title.length > 3 && 
            title.length < 100 &&
            !title.endsWith('?') && 
            !title.includes('**') && 
            !title.includes('Examples') &&
            !title.includes('Here') &&
            !line.includes('checkmark')) {
          options.push(title);
        }
      }
    }
  }
  
  return options;
};

export function SophiaChat({ quickActionPrompt, onPromptUsed, onWorkflowReady }: SophiaChatProps = {}) {
  const { toast } = useToast();
  const { createWorkflow } = useWorkflows();
  const { chatTranscript, setChatTranscript, addChatMessage, activeWorkflowId, clearWorkspace } = useSophiaWorkspace();
  const { saveWorkflowCanvas } = useWorkflowDetails(activeWorkflowId);
  const { applyPreset } = useCampaignDraft();
  
  // Get current user for memory
  const [userId, setUserId] = useState<string | null>(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });
  }, []);
  
  // Sophia's enhanced memory system
  const {
    conversations: recentConversations,
    memoryContext,
    memoryPrompt,
    saveMessage,
    learnFact,
    startNewConversation,
    currentConversationId,
  } = useSophiaMemory(userId);
  
  // Brand voice state
  const [selectedBrandVoiceId, setSelectedBrandVoiceId] = useState<string | null>(null);
  
  // Stable session ID for conversation state tracking (persists across page reloads via localStorage)
  const [sessionId] = useState(() => {
    const storageKey = 'sophia-session-id';
    const existingId = localStorage.getItem(storageKey);
    if (existingId) {
      return existingId;
    }
    const newId = `sophia-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(storageKey, newId);
    return newId;
  });
  
  // Agent role and knowledge base state (Multi-agent system)
  const [selectedRole, setSelectedRole] = useState('sales');
  const [knowledgeBase, setKnowledgeBase] = useState<string[]>([]);
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  // Multichannel outbound workflow interface
  const [showMultichannelInterface, setShowMultichannelInterface] = useState(false);
  const [detectedOutboundIntent, setDetectedOutboundIntent] = useState(false);

  // Conversation state tracking - eliminates repeat questions
  const [conversationState, setConversationState] = useState({
    goal: '',
    audience: '',
    channels: [] as string[],
    tone: '',
  });
  
  // Multi-select state for channels and options
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const [lastAssistantMessageId, setLastAssistantMessageId] = useState<string | null>(null);
  
  // Helper to detect if a question is multi-select (channels, etc)
  const isMultiSelectQuestion = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    // Only show channel selector if it's actually asking a question (has ?)
    // and mentions channels with selection keywords
    const hasQuestion = content.includes('?');
    const mentionsChannels = lowerContent.includes('channels');
    const hasSelectionKeyword = 
      lowerContent.includes('which') || 
      lowerContent.includes('select') || 
      lowerContent.includes('prefer') ||
      lowerContent.includes('would you');
    
    return hasQuestion && mentionsChannels && hasSelectionKeyword;
  };
  
  // Fetch brand voices
  const { data: brandVoicesData } = useQuery<{ brand_voices: Array<{ id: string; name: string; companyName: string }> }>({
    queryKey: ['/api/brand-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/brand-voices', {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) {
        // Return empty array if no brands configured instead of throwing
        if (response.status === 404) return { brand_voices: [] };
        throw new Error('Failed to fetch brand voices');
      }
      return response.json();
    },
  });
  
  const brandVoices = brandVoicesData?.brand_voices || [];
  
  // Auto-select brand voice if only one exists
  useEffect(() => {
    if (brandVoices.length === 1 && !selectedBrandVoiceId) {
      setSelectedBrandVoiceId(brandVoices[0].id);
    }
  }, [brandVoices, selectedBrandVoiceId]);
  
  // Initialize messages from context or default welcome message
  const initialMessages: Message[] = chatTranscript.length > 0 ? chatTranscript : [
    {
      role: 'assistant',
      content: "I'm **Agent Sophia**, your autonomous AI agent.\n\nI help you build multichannel campaigns, analyze performance, manage your inbox, and automate your sales workflow across Email, LinkedIn, SMS, Phone, and social media.\n\n**What can I help you with?**",
      timestamp: new Date(),
      suggestions: [
        "Build a multichannel campaign",
        "Create social media content",
        "Analyze campaign performance",
        "Set up automation"
      ]
    }
  ];

  const [messages, setMessages] = useState<Message[]>(initialMessages);

  // Sync messages to context whenever they change
  useEffect(() => {
    setChatTranscript(messages);
  }, [messages, setChatTranscript]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChannelButtons, setShowChannelButtons] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Detect when Sophia asks for channels and show buttons
  // Also detect multichannel outbound intent
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        const content = lastMessage.content.toLowerCase();
        
        // Show channel buttons for any channel discussion
        if (content.includes('channels') || content.includes('channel')) {
          setShowChannelButtons(true);
        }

        // Detect multichannel outbound intent
        if (
          (content.includes('multichannel') && content.includes('outbound')) ||
          (content.includes('multi-channel') && content.includes('outreach')) ||
          (content.includes('build') && content.includes('workflow') && content.includes('channel'))
        ) {
          setDetectedOutboundIntent(true);
          setShowMultichannelInterface(true);
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle quick action prompts
  useEffect(() => {
    if (quickActionPrompt && quickActionPrompt.trim() && !isLoading) {
      // Immediately send without delay to prevent race conditions
      const sendQuickAction = async () => {
        setIsLoading(true);
        setInput(quickActionPrompt);
        
        const userContent = quickActionPrompt.trim();
        
        // Update conversation state from user input BEFORE sending
        updateConversationState(userContent, true);

        const userMessage: Message = {
          role: 'user',
          content: userContent,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');

        try {
          // Get messages for streaming
          let messagesToSend: Message[] = [];
          setMessages(prev => {
            messagesToSend = prev;
            return prev;
          });

          // Create placeholder for streaming message
          const streamingMessage: Message = {
            role: 'assistant',
            content: '',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, streamingMessage]);

          // Use streaming handler for real-time response
          await handleStreamingResponse(messagesToSend, (fullContent) => {
            updateConversationState(fullContent);
            
            setMessages(prev => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg?.role === 'assistant') {
                const { options: answerOptions, cleanContent: messageContent } = extractAnswerOptions(fullContent);
                lastMsg.content = messageContent;
                lastMsg.answerOptions = answerOptions;
                lastMsg.suggestions = generateSuggestionsFromContent(messageContent);
              }
              return updated;
            });
          });
        } catch (error: any) {
          console.error('Error sending message:', error);
          const errorDescription = error?.message || 'Failed to process your message. Please try again.';
          toast({
            title: 'Error',
            description: errorDescription,
            variant: 'destructive'
          });
          
          const errorMessage: Message = {
            role: 'assistant',
            content: `I encountered an error: ${errorDescription}. Let's try again or choose a different action.`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setIsLoading(false);
          // Clear the prompt AFTER request completes to keep buttons disabled during fetch
          if (onPromptUsed) {
            onPromptUsed();
          }
        }
      };

      sendQuickAction();
    }
  }, [quickActionPrompt, onPromptUsed, isLoading, toast]);

  const handleMultichannelWorkflowCreate = async (workflowData: any) => {
    try {
      setIsLoading(true);
      
      // Generate workflow using AI with the selected channels
      const conversationContext = `Create a multichannel outbound campaign named "${workflowData.name}" using these channels: ${workflowData.channels.join(', ')}. 
      
      Create a professional B2B outreach sequence that:
      1. Starts with a compelling introduction on the primary channel
      2. Follows up with value-add content
      3. Uses multi-touch approach across the selected channels
      4. Includes appropriate wait periods between touchpoints`;

      const response = await fetch('/api/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: conversationContext,
          campaignName: workflowData.name,
          numberOfSteps: workflowData.channels.length >= 3 ? 8 : 6,
          channels: workflowData.channels.join(','),
        }),
      });

      // Parse response - may fail if AI generation had issues
      let data: any = null;
      if (response.ok) {
        try {
          const responseData = await response.json();
          data = responseData.data;
        } catch (parseError) {
          console.warn('Failed to parse workflow response:', parseError);
        }
      }

      // Always create the workflow in Supabase - even if AI generation failed
      const workflowDescription = data?.workflow?.description || 
        `Multichannel campaign with ${workflowData.channels.join(', ')}`;
      
      const workflowResult = await createWorkflow.mutateAsync({
        name: workflowData.name,
        description: workflowDescription,
        type: 'multichannel',
      });

      // Process nodes/edges with defensive checks
      let nodeRows: any[] = [];
      let edgeRows: any[] = [];
      
      if (data && data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
        const idMapping: Record<string, string> = {};
        
        // First pass: Filter valid nodes and build ID mapping
        // Only include nodes that have an id (required for edge mapping)
        const validNodes = data.nodes.filter((node: any) => 
          node && typeof node === 'object' && node.type && node.id
        );
        
        // Transform nodes and build ID mapping
        nodeRows = validNodes.map((node: any, idx: number) => {
          const newId = crypto.randomUUID();
          idMapping[node.id] = newId;  // node.id is guaranteed to exist
          const nodeConfig = node.config || {};
          
          return {
            id: newId,
            type: node.type || 'email',
            position: node.position || { x: 100, y: 100 + idx * 150 },
            data: {
              label: node.label || `Step ${idx + 1}`,
              type: node.type || 'email',
              config: nodeConfig,
              messageOptions: nodeConfig.messageOptions,
              selectedVersion: nodeConfig.bestVersion || 1,
              template: nodeConfig.template || '',
            },
          };
        });

        // Filter and transform valid edges only - ensure both source and target exist in our mapping
        edgeRows = (data.edges || [])
          .filter((edge: any) => {
            if (!edge || !edge.source || !edge.target) return false;
            // Only include edges where both endpoints were successfully mapped
            return idMapping[edge.source] && idMapping[edge.target];
          })
          .map((edge: any) => ({
            id: crypto.randomUUID(),
            source: idMapping[edge.source],
            target: idMapping[edge.target],
            label: edge.label || '',
          }));
      }
      
      // Fallback: Create default sequence if AI generation failed or returned empty
      if (nodeRows.length === 0) {
        const defaultChannels = workflowData.channels.length > 0 ? workflowData.channels : ['email'];
        // Map to valid database node types
        const channelNodeTypes: Record<string, string> = {
          'email': 'email',
          'linkedin': 'linkedin_connect',
          'sms': 'sms',
          'phone': 'phone',
          'whatsapp': 'whatsapp'
        };
        
        // Create start trigger node
        const startId = crypto.randomUUID();
        nodeRows = [{
          id: startId,
          type: 'trigger',
          position: { x: 100, y: 50 },
          data: {
            label: 'Start Campaign',
            type: 'trigger',
            config: { triggerType: 'manual' },
          },
        }];
        
        let prevId = startId;
        defaultChannels.forEach((channel: string, idx: number) => {
          const nodeId = crypto.randomUUID();
          const nodeType = channelNodeTypes[channel.toLowerCase()] || 'email';
          
          nodeRows.push({
            id: nodeId,
            type: nodeType,
            position: { x: 100, y: 200 + idx * 150 },
            data: {
              label: `${channel.charAt(0).toUpperCase() + channel.slice(1)} Outreach`,
              type: nodeType,
              config: { template: '' },
            },
          });
          
          edgeRows.push({
            id: crypto.randomUUID(),
            source: prevId,
            target: nodeId,
            label: idx === 0 ? '' : 'Wait 2 days',
          });
          
          prevId = nodeId;
        });
      }

      // Save nodes and edges to Supabase
      await saveWorkflowCanvas.mutateAsync({
        workflowId: workflowResult.id,
        nodes: nodeRows,
        edges: edgeRows,
      });

      // Success message - no button needed since we auto-open the builder
      const linkedMessage: Message = {
        role: 'assistant',
        content: `✅ **Campaign Created!** Your "${workflowData.name}" campaign has been saved.\n\n**Channels:** ${workflowData.channels.map((c: string) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')}\n\nOpening the Workflow Builder now...`,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, linkedMessage]);
      setShowMultichannelInterface(false);

      // Trigger callback to open workflow builder
      if (onWorkflowReady) {
        onWorkflowReady(workflowResult.id);
      }

      toast({
        title: 'Campaign Saved',
        description: `Opening "${workflowData.name}" in the Workflow Builder`
      });
    } catch (error: any) {
      console.error('Multichannel workflow creation error:', error);
      toast({
        title: 'Error creating workflow',
        description: error.message || 'Failed to create workflow',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Detect if we should show the "Build Workflow" button
  // Show it after Sophia has gathered enough discovery info (audience, channels, tone, etc.)
  const shouldShowWorkflowButton = (content: string): boolean => {
    const lowerContent = content.toLowerCase();
    
    // First check: Does Sophia explicitly say she's ready to build?
    if (lowerContent.includes('ready to build') || 
        lowerContent.includes('ready to generate') ||
        lowerContent.includes('🎯')) {
      return true;
    }
    
    const discoveryKeywords = [
      'audience', 'target', 'personas', 'decision maker',
      'channels', 'email', 'linkedin', 'sms',
      'tone', 'voice', 'style', 'professional', 'casual',
      'benefit', 'solution', 'offering', 'product',
      'goal', 'objective', 'campaign'
    ];
    
    // Show button if message contains multiple discovery-related keywords
    const matchCount = discoveryKeywords.filter(keyword => lowerContent.includes(keyword)).length;
    return matchCount >= 3;
  };

  // Extract campaign name from conversation history
  const extractCampaignName = (conversationText: string): string => {
    // Look for patterns like "name it" or "call it" or direct responses after asking for a name
    const namePatterns = [
      /(?:name|call)\s+(?:it|this|the campaign)\s+["']?([^"'\n]+)["']?/i,
      /(?:campaign|workflow)\s+(?:name|title):\s*["']?([^"'\n]+)["']?/i,
      /(?:let's call it|I'll name it)\s+["']?([^"'\n]+)["']?/i,
      // After "What would you like to name" question, extract user's response
      /(?:name it|campaign)\?.*?User:\s*["']?([^"'\n]+)["']?/is,
    ];
    
    for (const pattern of namePatterns) {
      const match = conversationText.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    
    // Fallback: Look for the last user message after "name" was mentioned
    const lines = conversationText.split('\n');
    let foundNameQuestion = false;
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('User:') && foundNameQuestion) {
        const userName = line.replace('User:', '').trim();
        if (userName && userName.length > 0 && userName.length < 100) {
          return userName;
        }
      }
      if (line.toLowerCase().includes('what would you like to name') || 
          line.toLowerCase().includes('name this campaign')) {
        foundNameQuestion = true;
      }
    }
    
    return 'Untitled Campaign';
  };

  // Extract number of steps from conversation history
  const extractNumberOfSteps = (conversationText: string): number => {
    const lowerText = conversationText.toLowerCase();
    
    // Keyword group for step-related terms (singular and plural)
    const keywordGroup = '(?:steps?|touchpoints?|messages?|outreach(?:es)?)';
    
    // Look for explicit numeric step count mentions (most common patterns)
    const numericPatterns = [
      // Direct number + keyword: "8 steps", "10 messages"
      new RegExp(`(\\d+)\\s*${keywordGroup}`, 'i'),
      // Keyword + number: "steps: 10"
      new RegExp(`${keywordGroup}[:\\s]+?(\\d+)`, 'i'),
      // Create/want/need + number + optional words + keyword
      new RegExp(`(?:create|build|make|want|need|give me|generate)\\s+(\\d+)(?:\\s+\\w+)*\\s+${keywordGroup}`, 'i'),
      // Number + keyword + campaign/workflow
      new RegExp(`(\\d+)\\s*-?\\s*${keywordGroup}\\s+(?:campaign|workflow|sequence|cadence)`, 'i'),
      // With/using/have + number + optional words + keyword
      new RegExp(`(?:with|using|have|include)\\s+(\\d+)(?:\\s+\\w+)*\\s+${keywordGroup}`, 'i'),
      // Number + adjective + keyword: "10 total steps", "8 different messages"
      new RegExp(`(\\d+)\\s+(?:total|different|unique|separate|follow[\\s-]?up)\\s+${keywordGroup}`, 'i'),
      // Approximate: "about 10 steps", "around 8 messages"
      new RegExp(`(?:at least|about|around|approximately)\\s+(\\d+)(?:\\s+\\w+)*\\s+${keywordGroup}`, 'i'),
    ];
    
    for (const pattern of numericPatterns) {
      const match = conversationText.match(pattern);
      if (match && match[1]) {
        const count = parseInt(match[1], 10);
        if (count >= 3 && count <= 15) {
          return count;
        }
      }
    }
    
    // Look for word-based numbers (e.g., "seven steps", "twelve messages")
    const wordNumbers: Record<string, number> = {
      'three': 3, 'four': 4, 'five': 5, 'six': 6, 'seven': 7,
      'eight': 8, 'nine': 9, 'ten': 10, 'eleven': 11, 'twelve': 12,
      'thirteen': 13, 'fourteen': 14, 'fifteen': 15
    };
    
    for (const [word, num] of Object.entries(wordNumbers)) {
      // Flexible regex: word number + optional words + keyword (plural or singular)
      const wordPattern = new RegExp(`${word}(?:\\s+\\w+)*\\s+${keywordGroup}`, 'i');
      const hyphenPattern = new RegExp(`${word}-step`, 'i');
      
      if (wordPattern.test(lowerText) || hyphenPattern.test(lowerText)) {
        return num;
      }
    }
    
    // Default to 9 steps for a good B2B campaign
    return 9;
  };

  // Extract channels from conversation history
  const extractChannels = (conversationText: string): string[] => {
    const lowerText = conversationText.toLowerCase();
    const channels: string[] = [];
    
    if (lowerText.includes('email')) channels.push('email');
    if (lowerText.includes('linkedin')) channels.push('linkedin');
    if (lowerText.includes('sms') || lowerText.includes('text message')) channels.push('sms');
    if (lowerText.includes('phone') || lowerText.includes('call')) channels.push('phone');
    
    // Default to email + linkedin if no channels detected
    return channels.length > 0 ? channels : ['email', 'linkedin'];
  };

  // Generate workflow using AI
  const generateWorkflow = async (conversationContext: string) => {
    try {
      // Extract campaign details from conversation
      const campaignName = extractCampaignName(conversationContext);
      const numberOfSteps = extractNumberOfSteps(conversationContext);
      const channels = extractChannels(conversationContext);
      
      console.log(`[Sophia] Generating workflow: ${numberOfSteps} steps, channels: ${channels.join(', ')}`);
      
      // Call workflow generation API with all extracted parameters
      const response = await fetch('/api/generate-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: conversationContext,
          campaignName: campaignName,
          numberOfSteps: numberOfSteps,
          channels: channels.join(','),
        }),
      });

      // Parse response - may fail if AI generation had issues
      let data: any = null;
      if (response.ok) {
        try {
          const responseData = await response.json();
          data = responseData.data;
        } catch (parseError) {
          console.warn('Failed to parse workflow response:', parseError);
        }
      }
      
      // Always create workflow in Supabase (even if AI generation failed)
      const workflowDescription = data?.workflow?.description || `Multichannel campaign created by Agent Sophia`;
      const workflowType = data?.workflow?.type || 'multichannel';
      
      const workflowResult = await createWorkflow.mutateAsync({
        name: campaignName,
        description: workflowDescription,
        type: workflowType,
      });

      // Process nodes/edges with defensive checks
      let nodeRows: any[] = [];
      let edgeRows: any[] = [];
      
      if (data && data.nodes && Array.isArray(data.nodes) && data.nodes.length > 0) {
        const idMapping: Record<string, string> = {};
        
        // First pass: Filter valid nodes (must have id and type)
        const validNodes = data.nodes.filter((node: any) => 
          node && typeof node === 'object' && node.type && node.id
        );
        
        // Transform nodes and build ID mapping
        nodeRows = validNodes.map((node: any, idx: number) => {
          const newId = crypto.randomUUID();
          idMapping[node.id] = newId;  // node.id is guaranteed to exist
          const nodeConfig = node.config || {};
          
          return {
            id: newId,
            type: node.type || 'email',
            position: node.position || { x: 100, y: 100 + idx * 150 },
            data: {
              label: node.label || `Step ${idx + 1}`,
              type: node.type || 'email',
              config: nodeConfig,
              messageOptions: nodeConfig.messageOptions,
              selectedVersion: nodeConfig.bestVersion || 1,
              template: nodeConfig.template || '',
            },
          };
        });

        // Filter and transform valid edges only - ensure both source and target exist in mapping
        edgeRows = (data.edges || [])
          .filter((edge: any) => {
            if (!edge || !edge.source || !edge.target) return false;
            return idMapping[edge.source] && idMapping[edge.target];
          })
          .map((edge: any) => ({
            id: crypto.randomUUID(),
            source: idMapping[edge.source],
            target: idMapping[edge.target],
            label: edge.label || '',
          }));
      }
      
      // Fallback: Create default sequence if AI generation failed or returned empty
      if (nodeRows.length === 0) {
        // Map to valid database node types
        const channelNodeTypes: Record<string, string> = {
          'email': 'email',
          'linkedin': 'linkedin_connect',
          'sms': 'sms',
          'phone': 'phone',
          'whatsapp': 'whatsapp'
        };
        
        // Create start trigger node
        const startId = crypto.randomUUID();
        nodeRows = [{
          id: startId,
          type: 'trigger',
          position: { x: 100, y: 50 },
          data: {
            label: 'Start Campaign',
            type: 'trigger',
            config: { triggerType: 'manual' },
          },
        }];
        
        let prevId = startId;
        channels.forEach((channel: string, idx: number) => {
          const nodeId = crypto.randomUUID();
          const nodeType = channelNodeTypes[channel.toLowerCase()] || 'email';
          
          nodeRows.push({
            id: nodeId,
            type: nodeType,
            position: { x: 100, y: 200 + idx * 150 },
            data: {
              label: `${channel.charAt(0).toUpperCase() + channel.slice(1)} Outreach`,
              type: nodeType,
              config: { template: '' },
            },
          });
          
          edgeRows.push({
            id: crypto.randomUUID(),
            source: prevId,
            target: nodeId,
            label: idx === 0 ? '' : 'Wait 2 days',
          });
          
          prevId = nodeId;
        });
      }

      // Save nodes and edges
      await saveWorkflowCanvas.mutateAsync({
        workflowId: workflowResult.id,
        nodes: nodeRows,
        edges: edgeRows,
      });

      return workflowResult.id;
    } catch (error) {
      console.error('Workflow generation error:', error);
      throw error;
    }
  };

  // Streaming handler - receives response word-by-word
  const handleStreamingResponse = async (
    updatedMessages: Message[],
    onStreamComplete: (content: string) => void
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    let fullContent = '';

    try {
      const response = await fetch('/api/chat/sophia/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          messages: updatedMessages.slice(-10).map(m => ({ 
            role: m.role, 
            content: m.content 
          })),
          context: {
            page: 'agent-sophia',
            agentRole: selectedRole,
            knowledgeBase: knowledgeBase,
            persona: 'sophia',
            brandVoiceId: selectedBrandVoiceId || undefined,
            selectedChannels: Array.from(selectedOptions),
            conversationState: conversationState,
            sessionId: sessionId,
            capabilities: [
              'build_campaigns',
              'create_workflows',
              'schedule_outreach',
              'analyze_performance',
              'book_meetings',
              'qualify_leads'
            ]
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} ${errorText || 'Unknown error'}`);
      }

      if (!response.body) {
        throw new Error('No response body from streaming endpoint');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        try {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  // Update message in real-time with extraction applied
                  setMessages(prev => {
                    const updated = [...prev];
                    const lastMsg = updated[updated.length - 1];
                    if (lastMsg?.role === 'assistant') {
                      const { cleanContent } = extractAnswerOptions(fullContent);
                      lastMsg.content = cleanContent;
                    }
                    return updated;
                  });
                }
                if (data.done) {
                  onStreamComplete(fullContent);
                  return;
                }
              } catch (e) {
                // Skip parsing errors for non-JSON lines
              }
            }
          }
        } catch (readError) {
          console.error('Stream read error:', readError);
          break;
        }
      }
      
      // If we got here with content, complete successfully
      if (fullContent) {
        onStreamComplete(fullContent);
      } else {
        throw new Error('No content received from streaming endpoint');
      }
    } catch (error: any) {
      console.error('Streaming error:', error);
      throw new Error(error.message || 'Failed to get response from Sophia');
    }
  };

  // Extract and update conversation state from user input and responses
  const updateConversationState = (content: string, isUserMessage: boolean = false) => {
    const state = { ...conversationState };
    const lowerContent = content.toLowerCase();
    
    // Always sync channels from UI selection
    if (selectedOptions.size > 0) {
      state.channels = Array.from(selectedOptions);
    }
    
    if (isUserMessage) {
      // Parse user input for goals - common patterns
      if (!state.goal) {
        // "I want to generate leads" / "build a campaign" / "increase sales"
        const goalPatterns = [
          /(?:i want to|i need to|help me|looking to|trying to|would like to)\s+(.+?)(?:\.|$|for)/i,
          /(?:goal is to|objective is to)\s+(.+?)(?:\.|$)/i,
          /(?:build|create|generate|increase|boost|improve)\s+(.+?)(?:\.|$|for)/i
        ];
        for (const pattern of goalPatterns) {
          const match = content.match(pattern);
          if (match) {
            state.goal = match[1].trim().substring(0, 100);
            break;
          }
        }
      }
      
      // Parse user input for audience - common patterns
      if (!state.audience) {
        // "targeting SaaS founders" / "for enterprise companies" / "reaching CTOs"
        const audiencePatterns = [
          /(?:targeting|target|reaching|for)\s+(.+?)(?:\.|$|using|via|through)/i,
          /(?:audience is|selling to|focusing on)\s+(.+?)(?:\.|$)/i,
          /(?:saas|b2b|b2c|enterprise|startup|smb|small business|mid-market)[\s\w]*/i
        ];
        for (const pattern of audiencePatterns) {
          const match = content.match(pattern);
          if (match) {
            state.audience = match[1] ? match[1].trim().substring(0, 100) : match[0].trim();
            break;
          }
        }
      }
      
      // Parse user input for tone preferences
      if (!state.tone) {
        const tonePatterns = [
          /(?:professional|casual|friendly|formal|direct|warm|conversational|personalized)/i
        ];
        for (const pattern of tonePatterns) {
          const match = content.match(pattern);
          if (match) {
            state.tone = match[0].toLowerCase();
            break;
          }
        }
      }
    }
    
    setConversationState(state);
    return state;
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    const lowerContent = userContent.toLowerCase();
    
    // FAST PATH: Detect LinkedIn Connect campaign intent and create immediately
    // Patterns: "connect campaign", "connection campaign", "linkedin connect", "just connect", "connection requests"
    const isLinkedInConnectIntent = (
      (lowerContent.includes('connect') && lowerContent.includes('campaign')) ||
      (lowerContent.includes('connection') && lowerContent.includes('campaign')) ||
      (lowerContent.includes('linkedin') && lowerContent.includes('connect')) ||
      (lowerContent.includes('just') && lowerContent.includes('connect')) ||
      (lowerContent.includes('connection') && lowerContent.includes('request'))
    );
    
    if (isLinkedInConnectIntent && applyPreset) {
      // Add user message
      const userMessage: Message = {
        role: 'user',
        content: userContent,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      
      // Apply LinkedIn Connect preset directly - it's a 1-step campaign
      applyPreset('linkedin-connect');
      
      // Respond with confirmation
      const assistantMessage: Message = {
        role: 'assistant',
        content: `✅ **LinkedIn Connect Campaign Created!**\n\nI've set up a simple 1-step connection request campaign for you. This is perfect for:\n- Building your network\n- Reaching new prospects\n- Starting conversations\n\nYour campaign includes:\n- **1 step**: Connection Request with personalized note\n- No messaging required - just a friendly connection note\n\nYou can customize the connection note and add contacts, then launch when ready.\n\n*Opening the workflow builder now...*`,
        timestamp: new Date(),
        showWorkflowButton: true
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      toast({
        title: 'LinkedIn Connect Campaign Ready!',
        description: 'Simple 1-step connection request campaign created.',
      });
      
      // Navigate to workflow builder
      if (onWorkflowReady) {
        setTimeout(() => {
          onWorkflowReady('draft');
        }, 1000);
      }
      return;
    }
    
    // Update conversation state from user input BEFORE sending
    updateConversationState(userContent, true);

    const userMessage: Message = {
      role: 'user',
      content: userContent,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    // Save user message to persistent memory (async, non-blocking)
    if (userId) {
      saveMessage('user', userContent).catch(err => {
        console.warn('Failed to save user message to memory:', err);
      });
    }

    try {
      let workflowId: string | undefined;

      // Create placeholder for streaming message
      const streamingMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, streamingMessage]);

      // Use streaming handler
      let finalAssistantContent = '';
      await handleStreamingResponse(updatedMessages, (fullContent) => {
        // Also extract state from assistant response
        updateConversationState(fullContent, false);
        finalAssistantContent = fullContent;
        
        // Update the message with final content
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            const { options: answerOptions, cleanContent: messageContent } = extractAnswerOptions(fullContent);
            lastMsg.content = messageContent;
            lastMsg.answerOptions = answerOptions;
            lastMsg.suggestions = generateSuggestionsFromContent(messageContent);
            lastMsg.showWorkflowButton = shouldShowWorkflowButton(messageContent);
          }
          return updated;
        });
      });
      
      // Save assistant response to persistent memory (async, non-blocking)
      if (userId && finalAssistantContent) {
        saveMessage('assistant', finalAssistantContent).catch(err => {
          console.warn('Failed to save assistant message to memory:', err);
        });
      }
      
      // Check if the MOST RECENT assistant message was asking for workflow confirmation
      // Sophia is programmed to ask exactly: "Ready for me to generate the workflow?"
      const lastAssistantMessage = messages[messages.length - 1]?.role === 'assistant' 
        ? messages[messages.length - 1]?.content 
        : '';
      
      const sophiaAskedForConfirmation = lastAssistantMessage && 
        /ready\s+(for\s+me\s+)?to\s+(generate|build|create)\s+(the\s+)?workflow\?/i.test(lastAssistantMessage);

      // Detect if user confirmed with a positive response
      const userConfirmed = /^(yes|sure|yeah|yep|ok|okay|go ahead|let'?s do it|ready|confirm|please|do it)/i.test(userMessage.content.trim());

      // Only generate if user confirmed immediately after Sophia asked for confirmation
      const shouldGenerateWorkflow = userConfirmed && sophiaAskedForConfirmation;

      // If user confirmed, trigger workflow generation
      if (shouldGenerateWorkflow) {
        // Show immediate feedback BEFORE starting generation
        const generatingMessage: Message = {
          role: 'assistant',
          content: 'Great! Generating your workflow now... 🚀\n\n*This will take 10-15 seconds...*',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, generatingMessage]);
        setIsLoading(true);
        
        try {
          // Build better context: include both questions and answers for clarity
          // Take last 20 messages (conversation pairs) for full context
          const conversationContext = updatedMessages
            .slice(-20)
            .map((m, i) => `${m.role === 'user' ? 'User' : 'Sophia'}: ${m.content}`)
            .join('\n\n');
          
          workflowId = await generateWorkflow(conversationContext);
          const campaignName = extractCampaignName(conversationContext);
          
          // Success! Remove the "generating" message and add success message with preview
          setMessages(prev => prev.filter(m => m.content !== generatingMessage.content));
          
          // Show success message with campaign details
          const successMessage: Message = {
            role: 'assistant',
            content: `✅ **Campaign Created Successfully!**\n\n**"${campaignName}"** is ready to go.\n\nI've built a complete multichannel workflow with all the touchpoints we discussed. You can now view and customize it in the visual workflow builder.\n\n*Opening the canvas now...*`,
            timestamp: new Date(),
            workflowId
          };
          setMessages(prev => [...prev, successMessage]);
          
          // Notify success with campaign name
          toast({
            title: `"${campaignName}" Created!`,
            description: 'Opening in visual workflow builder...',
          });
          
          // Auto-switch to visual workflow mode immediately
          if (onWorkflowReady && workflowId) {
            // Small delay to let user see the success message
            setTimeout(() => {
              onWorkflowReady(workflowId);
            }, 1000);
          }
        } catch (error: any) {
          console.error('Failed to generate workflow:', error);
          
          // Remove the "generating" message and replace with error
          setMessages(prev => prev.filter(m => m.content !== generatingMessage.content));
          
          // Show error message in chat
          const errorMessage: Message = {
            role: 'assistant',
            content: `❌ **Workflow Generation Failed**\n\nI encountered an error: ${error.message}\n\nWould you like me to try again?`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
          
          toast({
            title: 'Workflow Generation Failed',
            description: error.message || 'Could not generate workflow. Please try again.',
            variant: 'destructive',
          });
          
          // Don't proceed with showing success message
          setIsLoading(false);
          return;
        }
      }
      
      // Message is already handled by streaming callback, no need to add again
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: `I apologize, but I encountered an error: ${error.message}. Please try again or contact support if the issue persists.`,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
      
      toast({
        title: "Communication Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    if (isLoading) return;

    const userContent = suggestion.trim();
    
    // Update conversation state from user input BEFORE sending
    updateConversationState(userContent, true);

    const userMessage: Message = {
      role: 'user',
      content: userContent,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Create placeholder for streaming message
      const streamingMessage: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, streamingMessage]);

      // Use streaming handler for real-time response
      await handleStreamingResponse(updatedMessages, (fullContent) => {
        updateConversationState(fullContent);
        
        setMessages(prev => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg?.role === 'assistant') {
            const { options: answerOptions, cleanContent: messageContent } = extractAnswerOptions(fullContent);
            lastMsg.content = messageContent;
            lastMsg.answerOptions = answerOptions;
            lastMsg.suggestions = generateSuggestionsFromContent(messageContent);
            lastMsg.showWorkflowButton = shouldShowWorkflowButton(messageContent);
          }
          return updated;
        });
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive'
      });
      
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
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
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    clearWorkspace();
    // Reset session ID for fresh conversation context
    const newSessionId = `sophia-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('sophia-session-id', newSessionId);
    // Reset to initial welcome message
    const welcomeMessage: Message = {
      role: 'assistant',
      content: "**Hello, I'm Agent Sophia** – your Autonomous AI Agent.\n\nI'm a software program capable of reasoning, planning, and executing complex tasks and workflows on my own. I autonomously manage your entire multichannel outreach operation:\n\n✅ **Build campaigns** across Email, LinkedIn, WhatsApp, SMS, and Phone\n✅ **Analyze performance** with real-time metrics and optimization recommendations\n✅ **Manage your inbox** with AI sentiment analysis and auto-responses\n✅ **Schedule meetings** automatically with prospects\n✅ **Sync with your CRM** (Salesforce, HubSpot, Pipedrive)\n\nWhat would you like to accomplish today?",
      timestamp: new Date(),
      suggestions: [
        "Build a multichannel campaign",
        "Analyze campaign performance",
        "Set up LinkedIn automation",
        "Configure meeting scheduler"
      ]
    };
    setMessages([welcomeMessage]);
    setChatTranscript([welcomeMessage]);
    toast({
      title: "New Chat Started",
      description: "Previous conversation cleared",
    });
  };

  // Show startup screen only when there's just the welcome message
  const showStartupScreen = messages.length === 1 && messages[0].role === 'assistant';
  const [showQuickActions, setShowQuickActions] = useState(false);

  return (
    <div className="flex flex-col h-full">
      {/* Multichannel Outbound Interface - Conditionally Show */}
      {showMultichannelInterface && (
        <div className="border-b p-4 bg-muted/50 max-h-[40vh] overflow-y-auto">
          <MultiChannelOutboundInterface
            isActive={showMultichannelInterface}
            isLoading={isLoading}
            onWorkflowCreate={handleMultichannelWorkflowCreate}
            onDismiss={() => {
              setShowMultichannelInterface(false);
              setDetectedOutboundIntent(false);
            }}
          />
        </div>
      )}

      {/* Quick Actions - Collapsible at top */}
      {showStartupScreen && (
        <div className="border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
          <button
            onClick={() => setShowQuickActions(!showQuickActions)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
            data-testid="toggle-quick-actions"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold">Quick Actions & Templates</h3>
                <p className="text-xs text-muted-foreground">Click for campaign ideas and prompts</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {showQuickActions ? '▲ Hide' : '▼ Show'}
            </span>
          </button>
          
          {showQuickActions && (
            <div className="px-4 pb-4 max-h-[60vh] overflow-y-auto">
              <div className="w-full max-w-5xl mx-auto">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Column 1: Campaign Types */}
                <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-gradient-to-b from-blue-50/50 to-transparent dark:from-blue-950/20 p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200 dark:border-blue-900">
                    <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <h3 className="text-xs font-semibold text-blue-700 dark:text-blue-300">Campaign Types</h3>
                  </div>
                  <div className="space-y-1">
                    {[
                      { icon: Mail, title: "Cold Outreach", prompt: "Build a cold outreach campaign for B2B SaaS prospects" },
                      { icon: Zap, title: "Warm Follow-up", prompt: "Create a warm lead follow-up sequence for engaged prospects" },
                      { icon: TrendingUp, title: "Re-engagement", prompt: "Build a re-engagement campaign for dormant leads" },
                      { icon: Calendar, title: "Event Promo", prompt: "Create a webinar invitation campaign with automated reminders" },
                      { icon: Mail, title: "Product Launch", prompt: "Build a product launch campaign with multi-touch sequences" }
                    ].map((item, idx) => (
                      <Button
                        key={idx}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 hover:bg-blue-100 dark:hover:bg-blue-950 text-left"
                        onClick={() => handleSuggestionClick(item.prompt)}
                        data-testid={`campaign-${idx}`}
                      >
                        <item.icon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mr-2 flex-shrink-0" />
                        <span className="text-xs font-medium">{item.title}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Column 2: Industry Templates */}
                <div className="rounded-lg border border-purple-200 dark:border-purple-900 bg-gradient-to-b from-purple-50/50 to-transparent dark:from-purple-950/20 p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-purple-200 dark:border-purple-900">
                    <Zap className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    <h3 className="text-xs font-semibold text-purple-700 dark:text-purple-300">Industry Templates</h3>
                  </div>
                  <div className="space-y-1">
                    {[
                      { icon: Zap, title: "SaaS Sales", prompt: "Build a SaaS sales campaign targeting CTOs and VP Engineering" },
                      { icon: TrendingUp, title: "Real Estate", prompt: "Create a real estate outreach campaign for property investors" },
                      { icon: Mail, title: "Recruiting", prompt: "Build a recruiting campaign to source software engineers" },
                      { icon: Calendar, title: "Consulting", prompt: "Create a consulting lead gen campaign for CFOs and finance leaders" },
                      { icon: Zap, title: "E-commerce", prompt: "Build an e-commerce outreach campaign for online retailers" }
                    ].map((item, idx) => (
                      <Button
                        key={idx}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 hover:bg-purple-100 dark:hover:bg-purple-950 text-left"
                        onClick={() => handleSuggestionClick(item.prompt)}
                        data-testid={`industry-${idx}`}
                      >
                        <item.icon className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 mr-2 flex-shrink-0" />
                        <span className="text-xs font-medium">{item.title}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Column 3: Channels & Automation */}
                <div className="rounded-lg border border-green-200 dark:border-green-900 bg-gradient-to-b from-green-50/50 to-transparent dark:from-green-950/20 p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-green-200 dark:border-green-900">
                    <Linkedin className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <h3 className="text-xs font-semibold text-green-700 dark:text-green-300">Channels</h3>
                  </div>
                  <div className="space-y-1">
                    {[
                      { icon: Linkedin, title: "LinkedIn Only", prompt: "Build a LinkedIn-only campaign with connection requests and InMails" },
                      { icon: Mail, title: "Email Only", prompt: "Create an email-only drip campaign with smart timing" },
                      { icon: Mail, title: "Email + LinkedIn", prompt: "Create a coordinated Email + LinkedIn multichannel sequence" },
                      { icon: Phone, title: "Power Dialer", prompt: "Set up a power dialer campaign with call scripts and disposition tracking" },
                      { icon: MessageSquare, title: "SMS Follow-up", prompt: "Build an SMS follow-up campaign for meeting no-shows" }
                    ].map((item, idx) => (
                      <Button
                        key={idx}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 hover:bg-green-100 dark:hover:bg-green-950 text-left"
                        onClick={() => handleSuggestionClick(item.prompt)}
                        data-testid={`channel-${idx}`}
                      >
                        <item.icon className="h-3.5 w-3.5 text-green-600 dark:text-green-400 mr-2 flex-shrink-0" />
                        <span className="text-xs font-medium">{item.title}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Column 4: Analytics & Tools */}
                <div className="rounded-lg border border-orange-200 dark:border-orange-900 bg-gradient-to-b from-orange-50/50 to-transparent dark:from-orange-950/20 p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-orange-200 dark:border-orange-900">
                    <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <h3 className="text-xs font-semibold text-orange-700 dark:text-orange-300">Analytics & Tools</h3>
                  </div>
                  <div className="space-y-1">
                    {[
                      { icon: TrendingUp, title: "Performance", prompt: "Show me campaign performance metrics and optimization recommendations" },
                      { icon: Zap, title: "A/B Testing", prompt: "Set up an A/B test for email subject lines and content variations" },
                      { icon: Calendar, title: "Meeting Scheduler", prompt: "Configure automated meeting scheduling with calendar sync" },
                      { icon: Mail, title: "Lead Scoring", prompt: "Analyze my leads and create a lead scoring model based on engagement" },
                      { icon: TrendingUp, title: "CRM Sync", prompt: "Set up CRM integration with Salesforce or HubSpot" }
                    ].map((item, idx) => (
                      <Button
                        key={idx}
                        variant="ghost"
                        className="w-full justify-start h-auto p-2 hover:bg-orange-100 dark:hover:bg-orange-950 text-left"
                        onClick={() => handleSuggestionClick(item.prompt)}
                        data-testid={`analytics-${idx}`}
                      >
                        <item.icon className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400 mr-2 flex-shrink-0" />
                        <span className="text-xs font-medium">{item.title}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      )}
      
      {/* Memory Panel */}
      {showMemoryPanel && (
        <div className="border-b bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 p-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <h3 className="font-semibold text-purple-900 dark:text-purple-200">Sophia's Memory</h3>
              <Badge variant="outline" className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                {memoryContext.userMemories.length} facts remembered
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMemoryPanel(false)}
              className="text-purple-600 hover:text-purple-800 dark:text-purple-400"
              data-testid="button-close-memory-panel"
            >
              Close
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent Conversations */}
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <History className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-200">Recent Conversations</span>
              </div>
              {recentConversations.length > 0 ? (
                <div className="space-y-2">
                  {recentConversations.slice(0, 3).map((conv, idx) => (
                    <div key={conv.id || idx} className="text-xs p-2 bg-purple-50 dark:bg-purple-950/50 rounded" data-testid={`memory-conversation-${idx}`}>
                      <p className="font-medium truncate">{conv.title || 'Conversation'}</p>
                      {conv.summary && <p className="text-slate-500 dark:text-slate-400 truncate mt-1">{conv.summary}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">No conversations saved yet. Start chatting and I'll remember!</p>
              )}
            </div>

            {/* What I Know About You */}
            <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-200">What I Know About You</span>
              </div>
              {memoryContext.userMemories.length > 0 ? (
                <div className="space-y-1">
                  {memoryContext.userMemories.slice(0, 5).map((mem: any, idx) => (
                    <div key={mem.id || idx} className="text-xs p-2 bg-amber-50 dark:bg-amber-950/30 rounded flex items-start gap-2" data-testid={`memory-fact-${idx}`}>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{mem.category}</Badge>
                      <span className="text-slate-700 dark:text-slate-300">{mem.key}: {mem.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">As we talk, I'll learn your preferences, goals, and how you work.</p>
              )}
            </div>
          </div>
          
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-3 italic">
            I remember our conversations and learn about you over time to provide better, personalized assistance.
          </p>
        </div>
      )}
      
      {/* Messages Area */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4 pb-32 bg-gradient-to-br from-slate-50/50 to-blue-50/30 dark:from-slate-950/30 dark:to-slate-900/20">
        <div className="space-y-4 pt-6">
            {messages.map((message, index) => (
              <div key={index}>
                <div
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                      <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div
                    className={cn(
                      "rounded-xl px-4 py-3 max-w-2xl",
                      message.role === 'user'
                        ? "bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-2xl"
                        : "bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700"
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => (
                              <h1 className="text-lg font-bold mt-4 mb-2 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1">{children}</h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-base font-semibold mt-4 mb-2 text-slate-900 dark:text-white">{children}</h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm font-semibold mt-3 mb-1.5 text-slate-800 dark:text-slate-200">{children}</h3>
                            ),
                            p: ({ children }) => (
                              <p className="text-sm my-3 leading-relaxed text-slate-700 dark:text-slate-300">{children}</p>
                            ),
                            ul: ({ children }) => (
                              <ul className="text-sm space-y-2 my-3 pl-0 list-none">{children}</ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="text-sm space-y-2 my-3 pl-0 list-none counter-reset-item">{children}</ol>
                            ),
                            li: ({ children, ...props }) => {
                              const isOrdered = (props as any).ordered;
                              return (
                                <li className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2 pl-0">
                                  {!isOrdered && (
                                    <span className="text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0">•</span>
                                  )}
                                  <span className="flex-1">{children}</span>
                                </li>
                              );
                            },
                            strong: ({ children }) => (
                              <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>
                            ),
                            em: ({ children }) => (
                              <em className="italic text-slate-600 dark:text-slate-400">{children}</em>
                            ),
                            code: ({ children, className }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-blue-600 dark:text-blue-400">{children}</code>
                              ) : (
                                <code className={className}>{children}</code>
                              );
                            },
                            pre: ({ children }) => (
                              <pre className="bg-slate-900 dark:bg-slate-950 p-4 rounded-lg text-xs overflow-x-auto text-slate-100 my-3 border border-slate-700">{children}</pre>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-3 bg-blue-50 dark:bg-blue-950/30 rounded-r-lg text-slate-600 dark:text-slate-400 italic">{children}</blockquote>
                            ),
                            a: ({ children, href }) => (
                              <a href={href} className="text-blue-600 dark:text-blue-400 hover:underline font-medium" target="_blank" rel="noopener noreferrer">{children}</a>
                            ),
                            hr: () => (
                              <hr className="my-4 border-slate-200 dark:border-slate-700" />
                            ),
                          }}
                        >
                          {stripJsonCodeBlocks(message.content)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap text-white leading-relaxed">{message.content}</p>
                    )}
                    <span className="text-xs opacity-70 mt-2 block">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>

                  {message.role === 'user' && (
                    <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>

                {/* Build Workflow Button - Show when ready to create workflow */}
                {message.role === 'assistant' && message.showWorkflowButton && !message.workflowId && onWorkflowReady && (
                  <div className="ml-11 mt-3">
                    <Button
                      onClick={async () => {
                        try {
                          setIsLoading(true);
                          const conversationText = messages.slice(-20).map(m => 
                            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`
                          ).join('\n\n');
                          
                          const workflowId = await generateWorkflow(conversationText);
                          
                          // Add a new message with the workflow
                          const workflowMessage: Message = {
                            role: 'assistant',
                            content: '✨ Your workflow is ready! Click the button below to open it in the Workflow Builder.',
                            timestamp: new Date(),
                            workflowId
                          };
                          setMessages(prev => [...prev, workflowMessage]);
                          
                          // Switch to workflow builder
                          setTimeout(() => {
                            onWorkflowReady(workflowId);
                          }, 500);
                        } catch (error: any) {
                          toast({
                            title: 'Error',
                            description: error.message || 'Failed to generate workflow',
                            variant: 'destructive'
                          });
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      data-testid="button-build-workflow"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Building...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Build Workflow
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* View Generated Workflow Button */}
                {message.role === 'assistant' && message.workflowId && onWorkflowReady && (
                  <div className="ml-11 mt-3">
                    <Button
                      onClick={() => {
                        onWorkflowReady(message.workflowId!);
                        toast({
                          title: "Workflow Builder Opened",
                          description: "Your campaign is ready to customize and launch",
                        });
                      }}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      data-testid="button-view-workflow"
                    >
                      <Workflow className="h-4 w-4 mr-2" />
                      View in Workflow Builder
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                  </div>
                )}

                {/* Answer Options - Clickable question responses */}
                {message.role === 'assistant' && message.answerOptions && message.answerOptions.length > 0 && (
                  <div className="ml-11 mt-3 max-w-xl">
                    <SophiaAnswerOptions 
                      options={message.answerOptions}
                      onSelectOption={handleSuggestionClick}
                      isLoading={isLoading}
                    />
                  </div>
                )}

                {/* Quick Commands - Show as initial greeting */}
                {message.role === 'assistant' && messages.length === 1 && message.content.includes('What would you like to accomplish') && (
                  <div className="ml-11 mt-4 mb-4">
                    <QuickCommands 
                      onCommandClick={(prompt) => {
                        setInput(prompt);
                        // Auto-send after a brief delay
                        setTimeout(() => {
                          handleSendMessage();
                        }, 100);
                      }}
                      isLoading={isLoading}
                    />
                  </div>
                )}

                {/* Numbered List Options - Parse from message content - Hide when Quick Commands are shown */}
                {message.role === 'assistant' && !message.answerOptions && (() => {
                  const listOptions = parseNumberedListOptions(message.content);
                  return listOptions.length > 0 ? (
                    <div className="ml-11 mt-3 max-w-xl">
                      <SophiaAnswerOptions 
                        options={listOptions}
                        onSelectOption={handleSuggestionClick}
                        isLoading={isLoading}
                      />
                    </div>
                  ) : null;
                })()}

                {/* Channel Selection Buttons - Multi-select mode */}
                {message.role === 'assistant' && showChannelButtons &&
                 (message.content.includes('channels') || message.content.includes('channel')) && 
                 isMultiSelectQuestion(message.content) && (
                  <div className="ml-11 mt-3">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Select one or more channels:</p>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'Email', emoji: '📧' },
                          { label: 'LinkedIn', emoji: '🔗' },
                          { label: 'SMS', emoji: '💬' },
                          { label: 'Phone', emoji: '☎️' },
                          { label: 'WhatsApp', emoji: '💭' },
                        ].map((channel) => {
                          const isSelected = selectedOptions.has(channel.label);
                          return (
                            <Button
                              key={channel.label}
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                const newSelected = new Set(selectedOptions);
                                if (isSelected) {
                                  newSelected.delete(channel.label);
                                } else {
                                  newSelected.add(channel.label);
                                }
                                setSelectedOptions(newSelected);
                                setLastAssistantMessageId(message.content);
                              }}
                              className="text-xs"
                              data-testid={`channel-${channel.label.toLowerCase()}`}
                            >
                              <span className="mr-1">{channel.emoji}</span>
                              {channel.label}
                              {isSelected && <span className="ml-1">✓</span>}
                            </Button>
                          );
                        })}
                      </div>
                      {selectedOptions.size > 0 && (
                        <Button
                          onClick={() => {
                            const selectedList = Array.from(selectedOptions).join(' + ');
                            handleSuggestionClick(selectedList);
                            setSelectedOptions(new Set());
                            setShowChannelButtons(false);
                          }}
                          className="w-full text-xs mt-2"
                          size="sm"
                          data-testid="confirm-channels-button"
                        >
                          Confirm ({selectedOptions.size} selected)
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Channel Selection Buttons - Single-select mode (fallback) */}
                {message.role === 'assistant' && showChannelButtons &&
                 (message.content.includes('channels') || message.content.includes('channel')) && 
                 !isMultiSelectQuestion(message.content) && (
                  <div className="ml-11 mt-3">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Quick select:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: 'Email', emoji: '📧' },
                        { label: 'LinkedIn', emoji: '🔗' },
                        { label: 'SMS', emoji: '💬' },
                        { label: 'Phone', emoji: '☎️' },
                        { label: 'WhatsApp', emoji: '💭' },
                      ].map((channel) => (
                        <Button
                          key={channel.label}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleSuggestionClick(channel.label);
                            setShowChannelButtons(false);
                          }}
                          className="text-xs"
                          data-testid={`channel-${channel.label.toLowerCase()}`}
                        >
                          <span className="mr-1">{channel.emoji}</span>
                          {channel.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Contextual Suggestions */}
                {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && (
                  <div className="ml-11 mt-2 flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="text-xs"
                        data-testid={`suggestion-${idx}`}
                      >
                        <Zap className="h-3 w-3 mr-1" />
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-secondary rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">Sophia is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
      </ScrollArea>

      {/* Input Area - Floating */}
      <div className="sticky bottom-0 border-t bg-gradient-to-t from-background via-background to-transparent dark:from-background dark:via-background dark:to-transparent backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 space-y-3 z-10 pt-4">
        <div className="px-4 pb-4 space-y-3">
          {/* Brand Voice Selector - Only show if multiple voices exist */}
          {brandVoices.length > 1 && (
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-3 rounded-xl border border-purple-200 dark:border-purple-800/50">
              <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <span className="text-sm font-medium text-purple-900 dark:text-purple-300">Brand Voice:</span>
              <Select value={selectedBrandVoiceId || ''} onValueChange={setSelectedBrandVoiceId}>
                <SelectTrigger className="w-[250px] h-9 bg-white dark:bg-slate-800" data-testid="select-brand-voice">
                  <SelectValue placeholder="Select a brand voice" />
                </SelectTrigger>
                <SelectContent>
                  {brandVoices.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id} data-testid={`brand-voice-option-${voice.id}`}>
                      {voice.name} ({voice.companyName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedBrandVoiceId && (
                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">← Choose to continue</span>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            <Button
              onClick={handleNewChat}
              variant="outline"
              size="icon"
              title="Start new chat"
              className="rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              data-testid="button-new-chat"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setShowMemoryPanel(!showMemoryPanel)}
              variant={showMemoryPanel ? "default" : "outline"}
              size="icon"
              title="Sophia's Memory"
              className={cn(
                "rounded-lg transition-colors",
                showMemoryPanel 
                  ? "bg-purple-600 text-white hover:bg-purple-700" 
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              data-testid="button-show-memory"
            >
              <Brain className="h-4 w-4" />
            </Button>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Sophia anything... (e.g., 'Build a LinkedIn campaign for tech CEOs')"
              disabled={isLoading}
              className="flex-1 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="input-sophia-chat"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
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
      </div>
    </div>
  );
}

// Helper function to generate contextual suggestions from AI response
function generateSuggestionsFromContent(assistantResponse: string): string[] {
  const suggestions: string[] = [];

  // Analyze the assistant response to provide relevant suggestions
  const lowerResponse = assistantResponse.toLowerCase();

  if (lowerResponse.includes('campaign')) {
    suggestions.push("Show me campaign templates");
    suggestions.push("Set up A/B testing");
  }

  if (lowerResponse.includes('email')) {
    suggestions.push("Generate email copy");
    suggestions.push("Check email deliverability");
  }

  if (lowerResponse.includes('meeting')) {
    suggestions.push("Set meeting availability");
    suggestions.push("View upcoming meetings");
  }

  if (lowerResponse.includes('linkedin')) {
    suggestions.push("Connect LinkedIn account");
    suggestions.push("Write LinkedIn message template");
  }

  // Default suggestions if none match
  if (suggestions.length === 0) {
    suggestions.push("What else can you help me with?");
    suggestions.push("Show me best practices");
  }

  return suggestions.slice(0, 3); // Limit to 3 suggestions
}
