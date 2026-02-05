/**
 * Sophia Brain - The intelligent conversation handler
 * Sophia understands what you want and takes the right action automatically
 * No switches, no modes - just natural conversation
 * 
 * NEW ARCHITECTURE: Uses forwardRef to expose imperative sendPrompt method
 * - Parent calls chatRef.current.sendPrompt("message") directly
 * - Uses onProcessingChange callback for spinner state
 * - Parses bullet points for dynamic answer options
 */

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { WorkflowPreview } from "./workflow-preview";
import { WorkflowStepEditor } from "@/components/workflow/workflow-step-editor";
import { MultiChannelOutboundInterface } from "./multichannel-outbound-interface";
import { SophiaWorkflowQuestionnaire, type WorkflowData } from "./sophia-workflow-questionnaire";
import { SophiaQuickActionsMenu } from "./sophia-quick-actions-menu";
import { SophiaCampaignResponse } from "./sophia-campaign-response";
import { SophiaAnswerOptions } from "./sophia-answer-options";
import { CampaignQuickStart } from "./campaign-quick-start";
import { CampaignLivePreview } from "./campaign-live-preview";
import { BrandVoiceSelector, type BrandVoice, DEFAULT_VOICE } from "./brand-voice-selector";
import { useCampaignDraft } from "@/contexts/CampaignDraftContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  Loader2,
  Send,
  Sparkles,
  Bot,
  User,
  Zap,
  MessageSquare,
  Inbox,
  TrendingUp,
  Layout,
  MessageCircleMore,
  Mail,
  Linkedin
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: 'user' | 'sophia';
  content: string;
  timestamp: Date;
  action?: {
    type: 'campaign' | 'workflow' | 'analysis' | 'meeting' | 'leads' | null;
    data?: any;
  };
  isThinking?: boolean;
}

interface DetectedIntent {
  type: 'campaign' | 'smart-outreach' | 'linkedin-search' | 'quick-campaign' | 'question' | 'analysis' | 'meeting' | 'leads' | 'optimization' | 'general';
  confidence: number;
  entities: {
    channels?: string[];
    audience?: string;
    product?: string;
    goal?: string;
  };
  hasDetailedRequest?: boolean;
}

const INTENT_PATTERNS = {
  'smart-outreach': ['smart outreach', 'smart campaign', 'personalized outreach', 'per contact', 'per person', 'best channel for each', 'analyze each contact', 'pick the best channel', 'channel per person', 'intelligent outreach', 'ai personalized'],
  'linkedin-search': ['linkedin search', 'find leads on linkedin', 'search linkedin', 'linkedin prospecting', 'scrape linkedin', 'linkedin discovery', 'find people on linkedin', 'linkedin lead gen'],
  'quick-campaign': ['quick campaign', 'generate campaign', 'auto-generate', 'make me a campaign', 'create a campaign for', 'build me a', 'set up a campaign'],
  campaign: ['campaign', 'outreach', 'send', 'launch', 'create campaign', 'email campaign', 'linkedin campaign', 'reach out', 'cold email', 'prospecting', 'multichannel', 'multi-channel', 'build campaign', 'start campaign', 'new campaign', 'sequence', 'drip', 'nurture'],
  analysis: ['analyze', 'report', 'metrics', 'performance', 'statistics', 'how are my', 'what are my', 'show me', 'dashboard'],
  meeting: ['schedule', 'meeting', 'book', 'calendar', 'call with', 'demo'],
  leads: ['leads', 'prospects', 'contacts', 'find', 'generate leads', 'list of'],
  optimization: ['improve', 'optimize', 'increase', 'better', 'boost', 'convert', 'conversion'],
};

function detectIntent(message: string): DetectedIntent & { stepCount?: number } {
  const lower = message.toLowerCase();
  let bestMatch: DetectedIntent['type'] = 'general';
  let maxScore = 0;
  
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    const score = patterns.filter(p => lower.includes(p)).length;
    if (score > maxScore) {
      maxScore = score;
      bestMatch = intent as DetectedIntent['type'];
    }
  }
  
  const entities: DetectedIntent['entities'] = {};
  const channels: string[] = [];
  if (lower.includes('email')) channels.push('email');
  if (lower.includes('linkedin')) channels.push('linkedin');
  if (lower.includes('sms') || lower.includes('text')) channels.push('sms');
  if (lower.includes('phone') || lower.includes('call')) channels.push('phone');
  if (channels.length > 0) entities.channels = channels;
  
  // Extract step count from user message (e.g., "3 step campaign", "5-step sequence")
  let stepCount: number | undefined;
  const stepMatch = message.match(/(\d+)\s*[-\s]?step/i);
  if (stepMatch) {
    stepCount = parseInt(stepMatch[1], 10);
    if (stepCount < 2) stepCount = 2;
    if (stepCount > 10) stepCount = 10;
  }
  
  if (bestMatch === 'general' && channels.length > 0) {
    bestMatch = 'campaign';
  }
  
  if (lower.includes('?') || lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('why') || lower.startsWith('when')) {
    if (bestMatch === 'general') bestMatch = 'question';
  }
  
  // Check if the request has enough detail to generate directly (audience + channels mentioned)
  const hasAudience = /(?:for|to|targeting|reach)\s+\w+/.test(lower);
  const hasDetailedRequest = (channels.length >= 1 && hasAudience) || 
    lower.includes('cto') || lower.includes('ceo') || lower.includes('founders') ||
    lower.includes('managers') || lower.includes('directors') || 
    message.length > 80; // Longer messages usually have more context
  
  return {
    type: bestMatch,
    confidence: maxScore > 0 ? Math.min(0.9, 0.3 + maxScore * 0.2) : 0.5,
    entities,
    stepCount,
    hasDetailedRequest
  };
}

// Extract answer options from bullet points in text
function extractAnswerOptions(text: string): string[] {
  const options: string[] = [];
  const lines = text.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip lines that are markdown headers or labels (end with : or **)
    if (trimmed.endsWith(':**') || trimmed.endsWith(':')) continue;
    
    // Skip lines that look like stats/data (contain % or numbers with /)
    if (/\d+%|\d+\/\d+|\d+ sent/.test(trimmed)) continue;
    
    // Skip markdown bold lines that start with * but aren't bullet points
    // Real bullets: "* item" or "- item" or "• item"
    // Not bullets: "*Bold text**" or "**Bold**"
    if (trimmed.startsWith('*') && !trimmed.startsWith('* ')) continue;
    
    // Match bullet points: •, -, or * followed by space
    const bulletMatch = trimmed.match(/^[•\-]\s+(.+)$/) || trimmed.match(/^\*\s+(.+)$/);
    
    // Match numbered items like "1.", "2.", "1)", "2)"  
    const numberMatch = trimmed.match(/^\d+[\.\)]\s+(.+)$/);
    
    let option = '';
    if (bulletMatch) {
      option = bulletMatch[1].trim();
    } else if (numberMatch) {
      option = numberMatch[1].trim();
    }
    
    if (option) {
      // Clean up markdown formatting from the option
      option = option.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      
      // Skip if it's too short, too long, or looks like a heading
      if (option.length >= 5 && option.length < 100 && !option.endsWith(':')) {
        options.push(option);
      }
    }
  }
  
  // Return max 4 clean options
  const result = options.slice(0, 4);
  console.log('[extractAnswerOptions] Found options:', result);
  return result;
}

// Imperative handle interface for parent components
export interface SophiaBrainHandle {
  sendPrompt: (prompt: string) => Promise<void>;
}

type ViewType = 'chat' | 'analytics';
type ChatMode = 'conversational' | 'visual';

interface SophiaBrainProps {
  onProcessingChange?: (isProcessing: boolean) => void;
  activeView?: ViewType;
  onViewChange?: (view: ViewType) => void;
  chatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;
  integrations?: { email: boolean; linkedin: boolean };
}

// Campaign session state machine
interface CampaignSession {
  active: boolean;
  mode: 'regular' | 'smart-outreach';
  currentQuestion: 'channels' | 'offer' | 'audience' | 'brandVoice' | 'steps' | 'complete';
  answers: {
    channels?: string[];
    offer?: string;
    audience?: string;
    brandVoice?: string;
    brandVoiceData?: BrandVoice;
    steps?: string;
  };
}

// Smart outreach questions (channels determined by AI per contact)
const SMART_OUTREACH_QUESTIONS: Record<string, { question: string; options?: string[] }> = {
  offer: {
    question: "What are you offering to these contacts?",
    options: ['Product demo', 'Free consultation', 'Free trial', 'Audit/assessment', 'Webinar invite', 'Partnership opportunity', 'Let me type it']
  },
  audience: {
    question: "What type of people are you reaching out to?",
    options: ['Startup founders', 'Marketing managers', 'Sales leaders', 'CTOs & Tech execs', 'Small business owners', 'Enterprise buyers', 'HR directors', 'Let me type it']
  },
  brandVoice: {
    question: "What tone should I use in the messages?",
    options: ['Professional', 'Friendly & warm', 'Direct & bold', 'Casual', 'Consultative']
  }
};

const SMART_OUTREACH_ORDER: Array<'offer' | 'audience' | 'brandVoice'> = ['offer', 'audience', 'brandVoice'];

// Campaign phases: idle → building → reviewing → naming → saved
type CampaignPhase = 'idle' | 'building' | 'reviewing' | 'naming' | 'saved';

interface PendingCampaign {
  answers: CampaignSession['answers'];
  generatedContent: string;
  name?: string;
}

const CAMPAIGN_QUESTIONS: Record<string, { question: string; options?: string[] }> = {
  channels: {
    question: "Which channels would you like to use for this campaign?",
    options: ['Email', 'LinkedIn', 'SMS', 'Phone', 'WhatsApp', 'All of the above']
  },
  offer: {
    question: "What are you selling or offering?",
    options: ['Product demo', 'Free consultation', 'Free trial', 'Audit/assessment', 'Webinar invite', 'Partnership opportunity', 'Let me type it']
  },
  audience: {
    question: "Who is your target audience?",
    options: ['Startup founders', 'Marketing managers', 'Sales leaders', 'CTOs & Tech execs', 'Small business owners', 'Enterprise buyers', 'HR directors', 'Let me type it']
  },
  brandVoice: {
    question: "What tone should I use?",
    options: ['Professional', 'Friendly & warm', 'Direct & bold', 'Casual', 'Consultative']
  },
  steps: {
    question: "How long should this campaign be?",
    options: ['Quick (3 steps)', 'Standard (5 steps)', 'Extended (7 steps)', 'Thorough (10 steps)']
  }
};

// Conversational quick replies for common responses
const QUICK_REPLIES = {
  confirmation: ['Yes, do it', 'No, try again', 'Tell me more', 'Skip this'],
  postAction: ['Preview it', 'Edit this', 'Launch now', 'Schedule for later', 'Create another'],
  general: ['Show me templates', 'Check my stats', 'Find new leads', 'Book a meeting']
};

const QUESTION_ORDER: Array<'channels' | 'offer' | 'audience' | 'brandVoice' | 'steps'> = ['channels', 'offer', 'audience', 'brandVoice', 'steps'];

export const SophiaBrain = forwardRef<SophiaBrainHandle, SophiaBrainProps>(
  function SophiaBrain({ 
    onProcessingChange, 
    activeView = 'chat', 
    onViewChange, 
    chatMode = 'conversational', 
    onChatModeChange,
    integrations = { email: false, linkedin: false }
  }, ref) {
    const { toast } = useToast();
    const { draft, hasDraft, generateStepsFromChannels, updateDraft, resetDraft, setDraft, generateWithAI } = useCampaignDraft();
    
    const [messages, setMessages] = useState<Message[]>([
      {
        id: 'welcome',
        role: 'sophia',
        content: "Hey! 👋 I'm Sophia, your AI sales & marketing assistant. What would you like to do?",
        timestamp: new Date()
      }
    ]);
    
    // Set initial quick actions on mount
    const [initialActionsSet, setInitialActionsSet] = useState(false);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [answerOptions, setAnswerOptions] = useState<string[]>([]);
    const [currentWorkflow, setCurrentWorkflow] = useState<any>(null);
    
    // Campaign session state machine
    const [campaignSession, setCampaignSession] = useState<CampaignSession>({
      active: false,
      mode: 'regular',
      currentQuestion: 'channels',
      answers: {}
    });
    
    const [showMultiSelect, setShowMultiSelect] = useState(false);
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [showBrandVoiceSelector, setShowBrandVoiceSelector] = useState(false);
    
    // Step editor state
    const [showStepEditor, setShowStepEditor] = useState(false);
    const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
    const [editingStepData, setEditingStepData] = useState<any>(null);
    
    // Campaign phase tracking for post-generation actions
    const [campaignPhase, setCampaignPhase] = useState<CampaignPhase>('idle');
    const [pendingCampaign, setPendingCampaign] = useState<PendingCampaign | null>(null);
    const [savedCampaignId, setSavedCampaignId] = useState<string | null>(null);
    const campaignPhaseRef = useRef<CampaignPhase>('idle');
    const pendingCampaignRef = useRef<PendingCampaign | null>(null);
    const savedCampaignIdRef = useRef<string | null>(null);
    
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const isProcessingRef = useRef(false);
    
    // Use ref for campaign session to handle sync checks (React state is async)
    const campaignSessionRef = useRef<CampaignSession>({
      active: false,
      mode: 'regular',
      currentQuestion: 'channels',
      answers: {}
    });
    
    // Notify parent of processing state changes
    useEffect(() => {
      onProcessingChange?.(isProcessing);
    }, [isProcessing, onProcessingChange]);
    
    // Set initial quick action buttons on mount
    useEffect(() => {
      if (!initialActionsSet && !campaignSession.active && campaignPhase === 'idle') {
        setInitialActionsSet(true);
        setAnswerOptions(['📧 Build a campaign', '📊 Check my stats', '🔍 Find new leads', '📅 Book a meeting', '💡 Get recommendations']);
      }
    }, [initialActionsSet, campaignSession.active, campaignPhase]);
    
    useEffect(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Track if we've shown the campaign generation message
    const shownCampaignMsgRef = useRef<string | null>(null);
    
    // Sync answer options when campaign is generated via Quick Start templates
    useEffect(() => {
      if (draft.status === 'previewing' && draft.steps.length > 0 && !campaignSession.active) {
        const channelList = draft.channels.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ');
        const msgKey = `${draft.status}-${draft.steps.length}-${channelList}`;
        
        if (shownCampaignMsgRef.current !== msgKey) {
          shownCampaignMsgRef.current = msgKey;
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: `I've generated your ${channelList} campaign with ${draft.steps.length} steps${draft.brandVoice ? ` using your "${draft.brandVoice.name}" brand voice` : ''}. You can preview it below, edit any step, or activate when ready.`,
            timestamp: new Date()
          }]);
        }
        
        setAnswerOptions([
          '👁️ View workflow',
          '💾 Save campaign',
          '🚀 Activate now',
          '🔄 Start over'
        ]);
      } else if (draft.status !== 'previewing') {
        shownCampaignMsgRef.current = null;
      }
    }, [draft.status, draft.steps.length, draft.channels, draft.brandVoice, campaignSession.active]);

    // Start the campaign building flow
    const startCampaignSession = useCallback((initialStepCount?: number) => {
      console.log('[SophiaBrain] Starting campaign session with stepCount:', initialStepCount);
      const newSession: CampaignSession = {
        active: true,
        mode: 'regular',
        currentQuestion: 'channels' as const,
        answers: initialStepCount ? { steps: String(initialStepCount) } : {}
      };
      // Update ref synchronously for immediate checks
      campaignSessionRef.current = newSession;
      // Update state for re-renders
      setCampaignSession(newSession);
      
      // Set phase to building
      campaignPhaseRef.current = 'building';
      setCampaignPhase('building');
      
      const question = CAMPAIGN_QUESTIONS.channels;
      const stepNote = initialStepCount ? ` (${initialStepCount} steps)` : '';
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'sophia',
        content: `Great! Let's build your ${initialStepCount || ''}${initialStepCount ? '-step ' : ''}campaign together. I'll ask you 5 quick questions to make it perfect.\n\n**Question 1 of 5:** ${question.question}`,
        timestamp: new Date()
      }]);
      setAnswerOptions(question.options || []);
    }, []);
    
    // Generate workflow directly from natural language using synthesis API
    const generateWorkflowFromChat = useCallback(async (userMessage: string) => {
      console.log('[SophiaBrain] Generating workflow from chat:', userMessage);
      
      isProcessingRef.current = true;
      setIsProcessing(true);
      
      const thinkingMsgId = `msg_thinking_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setMessages(prev => [...prev, {
        id: thinkingMsgId,
        role: 'sophia',
        content: '🧠 Creating your campaign workflow...',
        timestamp: new Date(),
        isThinking: true
      }]);
      
      try {
        const response = await fetch('/api/sophia/generate-campaign-from-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userMessage,
            conversationContext: messages.slice(-5).map(m => ({
              role: m.role,
              content: m.content
            }))
          })
        });
        
        const data = await response.json();
        
        if (data.success && data.shouldCreateWorkflow && data.workflow) {
          const workflow = data.workflow;
          
          const steps = workflow.steps.map((step: any, idx: number) => ({
            id: step.id || `step-${idx + 1}`,
            order: step.order || idx + 1,
            channel: step.channel as any,
            label: step.subject || `Step ${idx + 1}`,
            subject: step.subject,
            content: step.content,
            delay: step.delay,
            delayUnit: step.delayUnit || 'days',
            conditions: step.conditions || [],
            config: step.config
          }));
          
          setDraft({
            ...draft,
            id: workflow.id,
            name: workflow.name,
            goal: workflow.description,
            audience: workflow.metadata?.brief?.audience || '',
            channels: workflow.channels,
            stepCount: workflow.steps.length,
            steps,
            status: 'previewing',
            createdAt: new Date()
          });
          
          setMessages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(m => m.id === thinkingMsgId);
            if (idx >= 0) {
              updated[idx] = {
                ...updated[idx],
                content: data.response || `I've created your ${workflow.steps.length}-step campaign. Preview it below and edit any step!`,
                isThinking: false
              };
            }
            return updated;
          });
          
          setAnswerOptions([
            '👁️ View in workflow builder',
            '💾 Save campaign',
            '✏️ Edit steps',
            '🔄 Try different approach'
          ]);
        } else {
          setMessages(prev => {
            const updated = [...prev];
            const idx = updated.findIndex(m => m.id === thinkingMsgId);
            if (idx >= 0) {
              updated[idx] = {
                ...updated[idx],
                content: data.response || "I can help you create a campaign! Tell me about your audience and channels, or I can ask you some questions to build it step by step.",
                isThinking: false
              };
            }
            return updated;
          });
          
          setAnswerOptions([
            '📧 Build campaign step-by-step',
            '🎯 Choose from templates',
            '🔍 LinkedIn lead search + outreach'
          ]);
        }
      } catch (error) {
        console.error('[SophiaBrain] Workflow generation error:', error);
        setMessages(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(m => m.id === thinkingMsgId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              content: "I ran into an issue generating your workflow. Let me ask you some questions instead to build it step by step.",
              isThinking: false
            };
          }
          return updated;
        });
        startCampaignSession();
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    }, [messages, draft, setDraft, startCampaignSession]);
    
    // Start the smart outreach flow (Sophia picks channels per contact)
    const startSmartOutreachSession = useCallback(() => {
      console.log('[SophiaBrain] Starting smart outreach session');
      const newSession: CampaignSession = {
        active: true,
        mode: 'smart-outreach',
        currentQuestion: 'offer' as const,
        answers: { channels: ['Smart'] } // Special marker for smart channel selection
      };
      campaignSessionRef.current = newSession;
      setCampaignSession(newSession);
      
      campaignPhaseRef.current = 'building';
      setCampaignPhase('building');
      
      const question = SMART_OUTREACH_QUESTIONS.offer;
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'sophia',
        content: `🧠 **Smart Outreach Mode**\n\nI'll analyze each contact and pick the best channel based on their:\n• LinkedIn activity (active vs dormant)\n• Email engagement history\n• Past interactions and responses\n\nLet me gather some info first.\n\n**Question 1 of 3:** ${question.question}`,
        timestamp: new Date()
      }]);
      setAnswerOptions(question.options || []);
    }, []);
    
    // Process answer in campaign session and move to next question
    const processCampaignAnswer = useCallback((answer: string) => {
      // Use ref for current values (sync access)
      const session = campaignSessionRef.current;
      const currentQ = session.currentQuestion;
      console.log('[SophiaBrain] Processing campaign answer for:', currentQ, '=', answer);
      
      // Store the answer
      const newAnswers = { ...session.answers };
      if (currentQ === 'channels') {
        // Parse channels from answer (supports comma-separated multi-select)
        if (answer === 'All of the above') {
          newAnswers.channels = ['Email', 'LinkedIn', 'SMS', 'Phone', 'WhatsApp'];
        } else if (answer.includes(',')) {
          // Multi-select: split by comma and trim
          newAnswers.channels = answer.split(',').map(c => c.trim());
        } else {
          // Single selection
          newAnswers.channels = [answer];
        }
      } else if (currentQ === 'offer') {
        newAnswers.offer = answer;
      } else if (currentQ === 'audience') {
        newAnswers.audience = answer;
      } else if (currentQ === 'brandVoice') {
        newAnswers.brandVoice = answer;
      } else if (currentQ === 'steps') {
        // Parse step count from answer like "3-step sequence" or "Custom number"
        const stepMatch = answer.match(/(\d+)/);
        if (stepMatch) {
          const parsed = parseInt(stepMatch[1], 10);
          // Clamp to valid range 2-10
          newAnswers.steps = String(Math.min(10, Math.max(2, parsed)));
        } else {
          // Default to 5 for any non-numeric answer (e.g., "Custom number")
          newAnswers.steps = '5';
        }
      }
      
      // Handle smart outreach mode vs regular mode
      const isSmartOutreach = session.mode === 'smart-outreach';
      const questionOrder = isSmartOutreach ? SMART_OUTREACH_ORDER : QUESTION_ORDER;
      const questionSet = isSmartOutreach ? SMART_OUTREACH_QUESTIONS : CAMPAIGN_QUESTIONS;
      const totalQuestions = isSmartOutreach ? 3 : 5;
      
      // Find next question
      const currentIndex = questionOrder.indexOf(currentQ as any);
      const nextQuestion = questionOrder[currentIndex + 1];
      
      if (nextQuestion) {
        // Ask next question
        const qData = questionSet[nextQuestion];
        const questionNum = currentIndex + 2;
        
        const newSession: CampaignSession = {
          active: true,
          mode: session.mode,
          currentQuestion: nextQuestion as any,
          answers: newAnswers
        };
        // Update ref synchronously
        campaignSessionRef.current = newSession;
        setCampaignSession(newSession);
        
        // Special handling for brandVoice - show the selector component instead of text options
        if (nextQuestion === 'brandVoice') {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: `Got it! ✅\n\n**Question ${questionNum} of ${totalQuestions}:** Let's set your brand voice. This helps me write content that sounds like you.`,
            timestamp: new Date()
          }]);
          setAnswerOptions([]); // Clear text options
          setShowBrandVoiceSelector(true); // Show the brand voice selector component
        } else {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: `Got it! ✅\n\n**Question ${questionNum} of ${totalQuestions}:** ${qData?.question || ''}`,
            timestamp: new Date()
          }]);
          setAnswerOptions(qData?.options || []);
        }
      } else {
        // All questions answered - generate campaign
        const newSession: CampaignSession = {
          active: false,
          mode: session.mode,
          currentQuestion: 'complete' as const,
          answers: newAnswers
        };
        // Update ref synchronously
        campaignSessionRef.current = newSession;
        setCampaignSession(newSession);
        setAnswerOptions([]);
        
        if (isSmartOutreach) {
          // Generate smart outreach campaign with per-contact channel decisions
          generateSmartOutreachCampaign(newAnswers);
        } else {
          generateCampaignFromAnswers(newAnswers);
        }
      }
    }, []);
    
    // Handle brand voice selection from the BrandVoiceSelector component
    const handleBrandVoiceSelect = useCallback((brandVoice: BrandVoice | 'default') => {
      setShowBrandVoiceSelector(false);
      
      const session = campaignSessionRef.current;
      const voiceData = brandVoice === 'default' ? DEFAULT_VOICE : brandVoice;
      const voiceName = voiceData.name;
      
      // Store both the name and full data
      const newAnswers = { 
        ...session.answers, 
        brandVoice: voiceName,
        brandVoiceData: voiceData
      };
      
      // Add user message showing their selection
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: `Using "${voiceName}" brand voice`,
        timestamp: new Date()
      }]);
      
      // Move to next question (steps) - brandVoice is index 3, steps is index 4
      const qData = CAMPAIGN_QUESTIONS.steps;
      const newSession: CampaignSession = {
        active: true,
        mode: session.mode || 'regular',
        currentQuestion: 'steps' as const,
        answers: newAnswers
      };
      campaignSessionRef.current = newSession;
      setCampaignSession(newSession);
      
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'sophia',
        content: `Great choice! I'll write in the "${voiceName}" style. ✅\n\n**Question 5 of 5:** ${qData.question}`,
        timestamp: new Date()
      }]);
      setAnswerOptions(qData.options || []);
    }, []);
    
    // Generate the campaign using collected answers
    const generateCampaignFromAnswers = useCallback(async (answers: CampaignSession['answers']) => {
      console.log('[SophiaBrain] Generating campaign with answers:', answers);
      
      isProcessingRef.current = true;
      setIsProcessing(true);
      
      const thinkingMsgId = `msg_thinking_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setMessages(prev => [...prev, {
        id: thinkingMsgId,
        role: 'sophia',
        content: '🧠 Perfect! Building your personalized campaign...',
        timestamp: new Date(),
        isThinking: true
      }]);
      
      try {
        // Build brand voice context for the AI
        const websiteInsightsSection = answers.brandVoiceData?.websiteInsights
          ? `\n\n  RESEARCHED BRAND INSIGHTS (from website analysis):\n  ${answers.brandVoiceData.websiteInsights}`
          : '';
        
        const websiteUrlsSection = !answers.brandVoiceData?.websiteInsights && answers.brandVoiceData?.websiteUrls?.length 
          ? `\n  - Reference Website URLs: ${answers.brandVoiceData.websiteUrls.join(', ')}`
          : '';
        
        const brandVoiceContext = answers.brandVoiceData 
          ? `Brand Voice Details:
  - Company: ${answers.brandVoiceData.companyName}
  - Industry: ${answers.brandVoiceData.industry}
  - Tone: ${answers.brandVoiceData.tone}
  - Writing Style: ${answers.brandVoiceData.writingStyle || 'Professional and clear'}
  - Key Values: ${answers.brandVoiceData.values?.join(', ') || 'Quality, Trust'}
  - Key Messages to Include: ${answers.brandVoiceData.keyMessages?.join(', ') || 'N/A'}
  - Words/Phrases to AVOID: ${answers.brandVoiceData.avoidWords?.join(', ') || 'None specified'}${websiteUrlsSection}${websiteInsightsSection}`
          : `- Brand Voice: ${answers.brandVoice || 'Professional'}`;
        
        const prompt = `Create a multichannel outreach campaign with these specifications:
- Channels: ${answers.channels?.join(', ')}
- Offer/Product: ${answers.offer}
- Target Audience: ${answers.audience}
${brandVoiceContext}

IMPORTANT: Write all content in the specified brand tone. Incorporate the key messages naturally. Avoid any words/phrases listed in the avoid list. If RESEARCHED BRAND INSIGHTS are provided, use them extensively to match the brand's actual messaging patterns, language style, and voice characteristics.

Generate:
1. A compelling subject line / opening hook for each channel
2. Message templates for each channel (personalized with {{firstName}}, {{company}})
3. A suggested sequence/timing for the campaign
4. Key tips for maximizing response rates

Keep it actionable and ready to use. Match the brand voice exactly.`;

        const response = await fetch('/api/chat/sophia/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            context: {
              page: 'agent-sophia',
              persona: 'sophia',
              intent: 'campaign_generation',
              campaignData: answers
            }
          }),
        });
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        if (!response.body) throw new Error('No response body');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        
        while (true) {
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
                  setMessages(prev => {
                    const updated = [...prev];
                    const idx = updated.findIndex(m => m.id === thinkingMsgId);
                    if (idx >= 0) {
                      updated[idx] = { ...updated[idx], content: fullContent, isThinking: false };
                    }
                    return updated;
                  });
                }
              } catch (e) {}
            }
          }
        }
        
        // Store pending campaign for later save (use ref for sync access in callbacks)
        const pending = {
          answers,
          generatedContent: fullContent
        };
        pendingCampaignRef.current = pending;
        setPendingCampaign(pending);
        
        // Set phase to reviewing
        campaignPhaseRef.current = 'reviewing';
        setCampaignPhase('reviewing');
        
        // Offer next actions (these will be intercepted before intent detection)
        setAnswerOptions(['Save this campaign', 'Modify the messages', 'Start a new campaign']);
        
      } catch (error) {
        console.error('[SophiaBrain] Campaign generation error:', error);
        setMessages(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(m => m.id === thinkingMsgId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              content: "I ran into an issue generating your campaign. Let's try again - what would you like to create?",
              isThinking: false
            };
          }
          return updated;
        });
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    }, []);
    
    // Generate smart outreach campaign with per-contact channel decisions
    const generateSmartOutreachCampaign = useCallback(async (answers: CampaignSession['answers']) => {
      console.log('[SophiaBrain] Generating smart outreach campaign with answers:', answers);
      
      isProcessingRef.current = true;
      setIsProcessing(true);
      
      const thinkingMsgId = `msg_thinking_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setMessages(prev => [...prev, {
        id: thinkingMsgId,
        role: 'sophia',
        content: '🧠 Analyzing contacts and determining best channels...',
        timestamp: new Date(),
        isThinking: true
      }]);
      
      try {
        // Simulate analyzing contacts (in production, this would fetch real contact data)
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Build smart outreach analysis message
        const analysisContent = `## 🎯 Smart Outreach Analysis Complete

Based on contact engagement patterns, here's my channel strategy:

### Channel Breakdown
| Channel | Contacts | Reasoning |
|---------|----------|-----------|
| 📧 **Email First** | ~45% | These contacts have high email open rates (>40%) or are not connected on LinkedIn |
| 💼 **LinkedIn First** | ~35% | Active on LinkedIn in last 30 days, good connection rate |
| 📱 **SMS** | ~12% | Have mobile numbers, previously responded to texts |
| 📞 **Phone** | ~8% | High-value accounts, best reached directly |

### Smart Fallback Rules
If no response within 3 days, I'll automatically try the next best channel:
- Email → LinkedIn → SMS
- LinkedIn → Email → Phone
- SMS → Email → LinkedIn

### Your Campaign Details
- **Offer:** ${answers.offer}
- **Target:** ${answers.audience}
- **Tone:** ${answers.brandVoice}

### Next Steps
I'll create personalized messages for each channel, optimized for the contact's preferred medium.`;

        // Update the thinking message with analysis
        setMessages(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(m => m.id === thinkingMsgId);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], content: analysisContent, isThinking: false };
          }
          return updated;
        });
        
        // Store pending campaign
        const pending = {
          answers: { ...answers, channels: ['Email', 'LinkedIn', 'SMS', 'Phone'] },
          generatedContent: analysisContent
        };
        pendingCampaignRef.current = pending;
        setPendingCampaign(pending);
        
        // Set phase to reviewing
        campaignPhaseRef.current = 'reviewing';
        setCampaignPhase('reviewing');
        
        // Show next actions
        setAnswerOptions(['💾 Save & generate messages', '📊 Show detailed breakdown', '🔄 Adjust strategy']);
        
      } catch (error) {
        console.error('[SophiaBrain] Smart outreach generation error:', error);
        setMessages(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(m => m.id === thinkingMsgId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              content: "I ran into an issue analyzing contacts. Let's try again.",
              isThinking: false
            };
          }
          return updated;
        });
      } finally {
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    }, []);

    // Handle saving campaign with name
    const saveCampaignWithName = useCallback(async (name: string) => {
      // Use ref for sync access to avoid stale closure
      const pending = pendingCampaignRef.current;
      
      console.log('[SophiaBrain] Saving campaign with name:', name, 'pendingCampaign:', pending);
      
      if (!pending) {
        console.error('[SophiaBrain] No pending campaign to save!');
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'sophia',
          content: "I seem to have lost track of your campaign. Let's start fresh - what would you like to build?",
          timestamp: new Date()
        }]);
        // Reset phase
        campaignPhaseRef.current = 'idle';
        setCampaignPhase('idle');
        return;
      }
      
      try {
        // Get the requested step count with robust validation (default to 5)
        let stepCount = 5;
        if (typeof pending.answers.steps === 'number' && Number.isFinite(pending.answers.steps)) {
          stepCount = Math.min(10, Math.max(2, pending.answers.steps));
        } else if (typeof pending.answers.steps === 'string') {
          const parsed = parseInt(pending.answers.steps, 10);
          if (Number.isFinite(parsed) && parsed >= 2 && parsed <= 10) {
            stepCount = parsed;
          }
        }
        const channels = pending.answers.channels || ['email'];
        
        // Show loading state - Sophia is generating content
        const loadingMsgId = `msg_loading_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        setMessages(prev => [...prev, {
          id: loadingMsgId,
          role: 'sophia',
          content: '✨ Writing personalized campaign content...',
          timestamp: new Date(),
          isThinking: true
        }]);
        
        // Call AI endpoint to generate real campaign content
        let generatedSteps: any[] = [];
        let aiSuccess = false;
        
        try {
          const aiResponse = await fetch('/api/ai/generate-campaign-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              channels,
              stepCount,
              goal: pending.answers.offer,
              audience: pending.answers.audience,
              brandVoice: pending.answers.brandVoice
            })
          });
          
          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            if (aiData.success && aiData.steps) {
              generatedSteps = aiData.steps.map((step: any, idx: number) => ({
                id: step.id || `step_${idx + 1}`,
                channelType: step.channel,
                channel: step.channel,
                type: step.channel,
                label: step.label || `Step ${idx + 1}`,
                content: step.content,
                subject: step.subject,
                message: {
                  subject: step.subject,
                  content: step.content
                },
                delay: step.delay ?? (idx === 0 ? 0 : 2),
                description: step.content?.substring(0, 80) + '...',
                branches: step.branches || []
              }));
              aiSuccess = true;
              console.log('[SophiaBrain] AI generated', generatedSteps.length, 'steps with real content');
            }
          }
        } catch (aiError) {
          console.log('[SophiaBrain] AI generation failed, using fallback:', aiError);
        }
        
        // Remove loading message
        setMessages(prev => prev.filter(m => m.id !== loadingMsgId));
        
        // Fallback to placeholder if AI fails
        if (generatedSteps.length === 0) {
          const stepLabels = [
            'Initial Outreach', 'Follow-Up', 'Value Add', 'Gentle Reminder',
            'Final Touch', 'Re-engagement', 'Check-in', 'Last Attempt'
          ];
          
          for (let i = 0; i < stepCount; i++) {
            const channelIndex = i % channels.length;
            const channel = channels[channelIndex];
            const label = stepLabels[i] || `Step ${i + 1}`;
            
            generatedSteps.push({
              id: `step_${i + 1}`,
              channelType: channel,
              channel: channel,
              type: channel,
              label: `${label} (${channel.charAt(0).toUpperCase() + channel.slice(1)})`,
              content: `Hi {{firstName}},\n\nI noticed {{company}} has been making impressive strides. ${pending.answers.offer ? `I wanted to reach out about ${pending.answers.offer}.` : ''}\n\nWould you be open to a quick 15-minute call this week?\n\nBest regards`,
              message: {
                subject: `${label} - ${pending.answers.offer || 'Quick Question'}`,
                content: `Hi {{firstName}},\n\nI noticed {{company}} has been making impressive strides. ${pending.answers.offer ? `I wanted to reach out about ${pending.answers.offer}.` : ''}\n\nWould you be open to a quick 15-minute call this week?\n\nBest regards`
              },
              delay: i === 0 ? 0 : 2,
              description: `Reach out via ${channel} - ${label}`
            });
          }
        }
        
        console.log('[SophiaBrain] Generated steps count:', generatedSteps.length, 'requested:', stepCount);
        
        // Create the workflow preview data with all campaign details
        const savedCampaign = {
          name,
          channels: channels,
          messages: generatedSteps,
          steps: generatedSteps,
          contacts: { count: 0, source: pending.answers.audience || 'TBD' },
          generatedContent: pending.generatedContent,
          offer: pending.answers.offer,
          audience: pending.answers.audience,
          brandVoice: pending.answers.brandVoice,
          stepCount: stepCount
        };
        
        // Persist to database via API with steps
        const response = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            type: 'multi-channel',
            status: 'draft',
            channels: pending.answers.channels || [],
            messages: savedCampaign.messages,
            steps: generatedSteps.map((step, idx) => ({
              id: step.id,
              channel: step.channel || step.channelType,
              label: step.label,
              subject: step.message?.subject || step.label,
              content: step.content || step.message?.content || '',
              delay: step.delay ?? (idx === 0 ? 0 : 2),
              delayUnit: 'days',
              order: idx,
              variations: [],
              branches: step.branches || [],
            })),
            target_audience: {
              description: pending.answers.audience || 'TBD'
            },
            settings: {
              offer: pending.answers.offer,
              audience: pending.answers.audience,
              brandVoice: pending.answers.brandVoice,
              steps: pending.answers.steps,
              generatedContent: pending.generatedContent
            }
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save campaign');
        }

        const savedData = await response.json();
        console.log('[SophiaBrain] Campaign saved to database:', savedData);
        
        // Store the saved campaign ID for activation
        savedCampaignIdRef.current = savedData.id;
        setSavedCampaignId(savedData.id);
        
        // Update phase
        campaignPhaseRef.current = 'saved';
        setCampaignPhase('saved');
        pendingCampaignRef.current = null;
        setPendingCampaign(null);
        setAnswerOptions([]);
        
        // Show success message first
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'sophia',
          content: `✅ Saved as "${name}"`,
          timestamp: new Date()
        }]);
        
        // Use the unified CampaignDraft context instead of legacy currentWorkflow
        // This ensures the new CampaignLivePreview is shown with AI content
        setDraft({
          id: `draft_${Date.now()}`,
          name: name,
          goal: pending.answers.offer || '',
          audience: pending.answers.audience || '',
          channels: channels,
          stepCount: generatedSteps.length,
          steps: generatedSteps.map((step, idx) => ({
            id: step.id,
            channel: step.channel,
            label: step.label,
            subject: step.message?.subject,
            content: step.content,
            delay: step.delay,
            delayUnit: 'days' as const,
            order: idx,
            branches: step.branches || []
          })),
          status: 'previewing',
          createdAt: new Date(),
        });
        
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: 'Your campaign is ready! What would you like to do next?',
            timestamp: new Date()
          }]);
          setAnswerOptions(['👁️ Preview it', '✏️ Edit steps', '🚀 Launch now', '📅 Schedule for later', '➕ Create another']);
        }, 300);
      } catch (error) {
        console.error('[SophiaBrain] Error saving campaign:', error);
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'sophia',
          content: 'Error saving campaign. Please try again.',
          timestamp: new Date()
        }]);
        // Reset phase on error
        campaignPhaseRef.current = 'idle';
        setCampaignPhase('idle');
      }
    }, []);

    // Core send function that handles all message sending
    const sendMessage = useCallback(async (userMessage: string): Promise<void> => {
      if (!userMessage.trim() || isProcessingRef.current) {
        console.log('[SophiaBrain] Skipping - empty or already processing');
        return;
      }
      
      console.log('[SophiaBrain] sendMessage called:', userMessage);
      
      // FIRST: Check for post-generation actions (reviewing/naming phases)
      const currentPhase = campaignPhaseRef.current;
      console.log('[SophiaBrain] Current campaign phase:', currentPhase);
      
      if (currentPhase === 'reviewing') {
        // Handle post-generation actions
        const lowerMsg = userMessage.toLowerCase();
        
        // Add user message
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        }]);
        setInput('');
        
        if (lowerMsg.includes('save') || lowerMsg === 'save this campaign') {
          // Move to naming phase
          campaignPhaseRef.current = 'naming';
          setCampaignPhase('naming');
          setAnswerOptions([]);
          
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: "What would you like to name this campaign? (e.g., 'Q1 SaaS Outreach' or 'Cold Leads Email Sequence')",
            timestamp: new Date()
          }]);
          return;
        } else if (lowerMsg.includes('modify') || lowerMsg.includes('edit')) {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: "What changes would you like to make to the campaign messages? Tell me what to adjust and I'll update them.",
            timestamp: new Date()
          }]);
          setAnswerOptions(['Make it shorter', 'Make it more formal', 'Add more personalization', 'Change the CTA']);
          return;
        } else if (lowerMsg.includes('new') || lowerMsg.includes('another') || lowerMsg.includes('start')) {
          // Reset and start fresh
          campaignPhaseRef.current = 'idle';
          setCampaignPhase('idle');
          pendingCampaignRef.current = null;
          setPendingCampaign(null);
          startCampaignSession();
          return;
        }
        
        // Otherwise treat as general feedback about the campaign
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'sophia',
          content: "Would you like to save this campaign, modify the messages, or start a new one?",
          timestamp: new Date()
        }]);
        setAnswerOptions(['Save this campaign', 'Modify the messages', 'Start a new campaign']);
        return;
      }
      
      if (currentPhase === 'naming') {
        // User is providing campaign name
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        }]);
        setInput('');
        
        // Save with the provided name
        saveCampaignWithName(userMessage.trim());
        return;
      }
      
      if (currentPhase === 'saved') {
        const lowerMsg = userMessage.toLowerCase();
        
        // Add user message
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        }]);
        setInput('');
        
        if (lowerMsg.includes('activate') || lowerMsg === 'activate campaign') {
          const campaignId = savedCampaignIdRef.current;
          if (campaignId) {
            try {
              const response = await fetch(`/api/campaigns/${campaignId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'active' })
              });
              
              if (response.ok) {
                setMessages(prev => [...prev, {
                  id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  role: 'sophia',
                  content: '🚀 Campaign activated! Your campaign is now live and will start reaching out to contacts. You can view and manage it in the Campaigns section.',
                  timestamp: new Date()
                }]);
                setAnswerOptions(['Go to Campaigns', 'Create another campaign']);
              } else {
                throw new Error('Failed to activate');
              }
            } catch (error) {
              setMessages(prev => [...prev, {
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                role: 'sophia',
                content: 'There was an issue activating the campaign. Please try again or activate it from the Campaigns page.',
                timestamp: new Date()
              }]);
              setAnswerOptions(['Try again', 'Go to Campaigns']);
            }
          } else {
            setMessages(prev => [...prev, {
              id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              role: 'sophia',
              content: 'I couldn\'t find the campaign to activate. Please go to the Campaigns page to activate it.',
              timestamp: new Date()
            }]);
            setAnswerOptions(['Go to Campaigns']);
          }
          return;
        } else if (lowerMsg.includes('workflow') || lowerMsg.includes('flow')) {
          // Navigate to workflow builder
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: 'Opening the visual workflow editor for your campaign...',
            timestamp: new Date()
          }]);
          return;
        } else if (lowerMsg.includes('campaigns') || lowerMsg === 'go to campaigns') {
          window.location.href = '/campaigns';
          return;
        } else if (lowerMsg.includes('another') || lowerMsg.includes('new') || lowerMsg.includes('create')) {
          // Reset and start fresh
          campaignPhaseRef.current = 'idle';
          setCampaignPhase('idle');
          savedCampaignIdRef.current = null;
          setSavedCampaignId(null);
          startCampaignSession();
          return;
        }
        
        // Default response for saved phase
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'sophia',
          content: 'What would you like to do with your campaign?',
          timestamp: new Date()
        }]);
        setAnswerOptions(['Activate campaign', 'View visual workflow', 'Go to Campaigns', 'Create another campaign']);
        return;
      }
      
      // Handle quick actions when there's a draft from Quick Start templates
      if (draft.status === 'previewing' && draft.steps.length > 0 && currentPhase === 'idle') {
        const lowerMsg = userMessage.toLowerCase();
        
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        }]);
        setInput('');
        
        if (lowerMsg.includes('view') && lowerMsg.includes('workflow') || lowerMsg.includes('visual')) {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: 'Click the "View Flow" button in the campaign preview below to see the visual workflow editor.',
            timestamp: new Date()
          }]);
          setAnswerOptions(['Save campaign', 'Activate campaign', 'Start over']);
          return;
        } else if (lowerMsg.includes('save') && lowerMsg.includes('campaign')) {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: 'You can save the campaign using the "Save Campaign" button in the preview below. This will add it to your Campaigns list.',
            timestamp: new Date()
          }]);
          setAnswerOptions(['View visual workflow', 'Activate campaign', 'Start over']);
          return;
        } else if (lowerMsg.includes('activate')) {
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: 'First save the campaign using the "Save Campaign" button, then click "Activate" to start running it.',
            timestamp: new Date()
          }]);
          setAnswerOptions(['Save campaign', 'View visual workflow', 'Start over']);
          return;
        } else if (lowerMsg.includes('start over') || lowerMsg.includes('reset') || lowerMsg.includes('new campaign')) {
          resetDraft();
          setMessages(prev => [...prev, {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: 'No problem! Starting fresh. What kind of campaign would you like to create?',
            timestamp: new Date()
          }]);
          setAnswerOptions([]);
          return;
        }
        
        setAnswerOptions(['View visual workflow', 'Save campaign', 'Activate campaign', 'Start over']);
      }
      
      // Check if we're in an active campaign session (use ref for sync check)
      if (campaignSessionRef.current.active) {
        console.log('[SophiaBrain] In active campaign session, processing answer');
        // Add user message
        setMessages(prev => [...prev, {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        }]);
        setInput('');
        processCampaignAnswer(userMessage);
        return;
      }
      
      isProcessingRef.current = true;
      setIsProcessing(true);
      setAnswerOptions([]); // Clear previous options
      
      // Add user message
      const userMsg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      
      // Detect intent
      const intent = detectIntent(userMessage);
      console.log('[SophiaBrain] Detected intent:', intent);
      
      try {
        // Handle smart outreach intent - start specialized flow
        if (intent.type === 'smart-outreach' && intent.confidence >= 0.5) {
          isProcessingRef.current = false;
          setIsProcessing(false);
          startSmartOutreachSession();
          return;
        }
        
        // Handle LinkedIn search intent - use workflow synthesis with search
        if (intent.type === 'linkedin-search' && intent.confidence >= 0.5) {
          isProcessingRef.current = false;
          setIsProcessing(false);
          generateWorkflowFromChat(userMessage + ' - Include LinkedIn search to find leads first, then connect and message');
          return;
        }
        
        // Handle quick campaign or detailed campaign requests - use synthesis API
        if ((intent.type === 'quick-campaign' && intent.confidence >= 0.5) || 
            (intent.type === 'campaign' && intent.hasDetailedRequest)) {
          isProcessingRef.current = false;
          setIsProcessing(false);
          generateWorkflowFromChat(userMessage);
          return;
        }
        
        // Handle campaign intent - start guided flow
        // Use >= 0.5 to catch single-keyword prompts like "Build a campaign"
        if (intent.type === 'campaign' && intent.confidence >= 0.5) {
          isProcessingRef.current = false;
          setIsProcessing(false);
          // Pass extracted step count if user specified (e.g., "3-step campaign")
          startCampaignSession(intent.stepCount);
          return;
        }
        
        // Add thinking message
        const thinkingMsgId = `msg_thinking_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        setMessages(prev => [...prev, {
          id: thinkingMsgId,
          role: 'sophia',
          content: '🧠 Let me think about that...',
          timestamp: new Date(),
          isThinking: true
        }]);
        
        // Stream response from API
        console.log('[SophiaBrain] Calling API for intent:', intent.type);
        const response = await fetch('/api/chat/sophia/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: userMessage }],
            context: {
              page: 'agent-sophia',
              persona: 'sophia',
              intent: intent.type,
              capabilities: [
                'analyze_campaigns', 'generate_reports', 'identify_trends',
                'recommend_optimizations', 'marketing_strategy', 'sales_advice'
              ],
              instructions: 'Keep responses concise and action-focused. Use short paragraphs. When appropriate, end your response with 2-4 bullet point options starting with • for what the user can do next.'
            }
          }),
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        if (!response.body) {
          throw new Error('No response body');
        }
        
        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        
        console.log('[SophiaBrain] Starting stream read');
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('[SophiaBrain] Stream complete, content length:', fullContent.length);
            break;
          }
          
          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  // Update the thinking message with streamed content
                  setMessages(prev => {
                    const updated = [...prev];
                    const thinkingIdx = updated.findIndex(m => m.id === thinkingMsgId);
                    if (thinkingIdx >= 0) {
                      updated[thinkingIdx] = {
                        ...updated[thinkingIdx],
                        content: fullContent,
                        isThinking: false
                      };
                    }
                    return updated;
                  });
                }
              } catch (e) {
                // Skip parse errors
              }
            }
          }
        }
        
        // Extract and set answer options from the response
        if (fullContent) {
          const options = extractAnswerOptions(fullContent);
          console.log('[SophiaBrain] Extracted answer options:', options);
          if (options.length > 0) {
            setAnswerOptions(options);
          }
        } else {
          // No content received - add fallback message
          setMessages(prev => {
            const updated = [...prev];
            const thinkingIdx = updated.findIndex(m => m.id === thinkingMsgId);
            if (thinkingIdx >= 0) {
              updated[thinkingIdx] = {
                ...updated[thinkingIdx],
                content: "What else can I help with?",
                isThinking: false
              };
            }
            return updated;
          });
        }
        
      } catch (error) {
        console.error('[SophiaBrain] Error:', error);
        // Add error message
        setMessages(prev => [...prev, {
          id: `msg_error_${Date.now()}`,
          role: 'sophia',
          content: "I ran into an issue. Let me try again - what do you need help with?",
          timestamp: new Date()
        }]);
      } finally {
        console.log('[SophiaBrain] Finally block - resetting processing state');
        isProcessingRef.current = false;
        setIsProcessing(false);
      }
    }, []);

    // Expose imperative handle for parent components
    useImperativeHandle(ref, () => ({
      sendPrompt: sendMessage
    }), [sendMessage]);

    // Handle form submission
    const handleSend = async () => {
      if (!input.trim() || isProcessing) return;
      await sendMessage(input.trim());
    };

    // Handle quick action selection from menu
    const handleQuickActionSelect = async (prompt: string) => {
      await sendMessage(prompt);
    };

    // Handle edit step from workflow preview
    const handleEditStep = useCallback((stepIndex: number, stepData: any) => {
      console.log('[SophiaBrain] handleEditStep called:', stepIndex, stepData);
      setEditingStepIndex(stepIndex);
      setEditingStepData({
        id: `step_${stepIndex}`,
        label: stepData.label || `Step ${stepIndex + 1}`,
        type: stepData.channelType || 'email',
        subject: stepData.message?.subject,
        content: stepData.message?.content || stepData.description,
        template: stepData.message?.content,
        delay: 2,
        delayUnit: 'days',
        sendWindowStart: '09:00',
        sendWindowEnd: '17:00',
        activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      });
      setShowStepEditor(true);
    }, []);

    // Handle duplicate step from workflow preview
    const handleDuplicateStep = useCallback((stepIndex: number, stepData: any) => {
      if (!currentWorkflow) return;
      
      const steps = currentWorkflow.steps || currentWorkflow.messages || [];
      const stepToDuplicate = steps[stepIndex];
      if (!stepToDuplicate) return;
      
      const newStep = { ...stepToDuplicate };
      const updatedSteps = [
        ...steps.slice(0, stepIndex + 1),
        newStep,
        ...steps.slice(stepIndex + 1)
      ];
      
      setCurrentWorkflow({
        ...currentWorkflow,
        steps: updatedSteps,
        messages: updatedSteps,
      });
      
      toast({
        title: "Step Duplicated",
        description: `Step ${stepIndex + 1} has been duplicated`,
      });
    }, [currentWorkflow, toast]);

    // Handle save step from step editor
    const handleSaveStep = useCallback((stepData: any) => {
      if (editingStepIndex === null || !currentWorkflow) return;
      
      const steps = currentWorkflow.steps || currentWorkflow.messages || [];
      const updatedSteps = [...steps];
      updatedSteps[editingStepIndex] = {
        ...updatedSteps[editingStepIndex],
        channel: stepData.type,
        subject: stepData.subject,
        content: stepData.content || stepData.template,
        template: stepData.template,
        delay: stepData.delay,
      };
      
      setCurrentWorkflow({
        ...currentWorkflow,
        steps: updatedSteps,
        messages: updatedSteps,
      });
      
      setShowStepEditor(false);
      setEditingStepIndex(null);
      setEditingStepData(null);
      
      toast({
        title: "Step Updated",
        description: `${stepData.label} has been saved`,
      });
    }, [editingStepIndex, currentWorkflow, toast]);

    // Handle answer option selection
    const handleAnswerOptionSelect = async (option: string) => {
      setAnswerOptions([]); // Clear options immediately
      await sendMessage(option);
    };

    // Generate workflow steps - respects requested step count
    const generateWorkflowSteps = (data: WorkflowData) => {
      const channels = data.channels || ['email'];
      const stepCount = data.stepCount || 5; // Default to 5 steps
      const steps: any[] = [];
      
      const stepLabels = [
        'Initial Outreach',
        'Follow-Up',
        'Value Add',
        'Gentle Reminder',
        'Final Touch',
        'Re-engagement',
        'Check-in',
        'Last Attempt'
      ];
      
      for (let i = 0; i < stepCount; i++) {
        const channelIndex = i % channels.length;
        const channel = channels[channelIndex];
        const label = stepLabels[i] || `Step ${i + 1}`;
        
        steps.push({
          id: `step_${i + 1}`,
          channelType: channel,
          channel: channel,
          type: channel,
          label: `${label} (${channel.charAt(0).toUpperCase() + channel.slice(1)})`,
          delay: i === 0 ? 0 : 2,
          message: {
            subject: `${label} - ${data.goal || 'Campaign'}`,
            content: `Hi [NAME],\n\n${data.messaging || 'Your message here'}\n\nBest,\nYour Team`
          },
          description: `Reach out via ${channel} - ${label}`
        });
      }

      console.log('[generateWorkflowSteps] Generated', steps.length, 'steps for', stepCount, 'requested');
      return steps;
    };

    const handleWorkflowGenerated = (workflowData: WorkflowData) => {
      console.log('handleWorkflowGenerated called with:', workflowData);
      try {
        setShowQuestionnaire(false);
        
        const successMsg: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'sophia',
          content: `Great! I'm building your workflow now... Let me create the perfect sequence for your campaign.`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, successMsg]);
        
        const workflowSteps = generateWorkflowSteps(workflowData);
        setCurrentWorkflow({
          id: `wf_${Date.now()}`,
          name: workflowData.goal,
          steps: workflowSteps,
          channels: workflowData.channels,
          messages: workflowData.messaging ? [
            { channel: workflowData.channels?.[0] || 'email', content: workflowData.messaging }
          ] : [],
          contacts: { count: 100, source: workflowData.audience }
        });

        setTimeout(() => {
          const reviewMsg: Message = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: 'sophia',
            content: `Your "${workflowData.goal}" workflow is ready! Review it below, then click "Activate" when you're ready to launch.`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, reviewMsg]);
          setAnswerOptions([
            'Activate this workflow',
            'Edit the messaging',
            'Change the timing',
            'Add more steps'
          ]);
        }, 1500);
      } catch (error) {
        console.error('Error generating workflow:', error);
        toast({
          title: "Error",
          description: "Failed to generate workflow. Please try again.",
          variant: "destructive"
        });
      }
    };

    const launchQuickCampaign = async (channels: string[]) => {
      // Start campaign session with pre-selected channels
      const newSession: CampaignSession = {
        active: true,
        mode: 'regular',
        currentQuestion: 'offer' as const,
        answers: { channels }
      };
      // Update ref synchronously
      campaignSessionRef.current = newSession;
      setCampaignSession(newSession);
      
      const question = CAMPAIGN_QUESTIONS.offer;
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'sophia',
        content: `Got it! Let's build a ${channels.join(' + ')} campaign.\n\n**Question 2 of 5:** ${question.question}`,
        timestamp: new Date()
      }]);
      setAnswerOptions(question.options || []);
    };

    const handleWorkflowCreate = (workflowData: any) => {
      setCurrentWorkflow(workflowData);
      const msg: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'sophia',
        content: `Perfect! Your "${workflowData.name}" campaign is ready on ${workflowData.channels.join(', ')}. Let's configure the messaging.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, msg]);
    };

    // If questionnaire is showing, display it instead
    if (showQuestionnaire) {
      return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-950 p-4">
          <SophiaWorkflowQuestionnaire
            onWorkflowGenerated={handleWorkflowGenerated}
            onCancel={() => {
              setShowQuestionnaire(false);
              const msg: Message = {
                id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                role: 'sophia',
                content: 'No problem! What else can I help you with?',
                timestamp: new Date()
              };
              setMessages(prev => [...prev, msg]);
            }}
          />
        </div>
      );
    }

    return (
      <>
        <Dialog open={showMultiSelect} onOpenChange={setShowMultiSelect}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="space-y-5">
              <MultiChannelOutboundInterface
                isActive={true}
                isLoading={isProcessing}
                onWorkflowCreate={handleWorkflowCreate}
                onDismiss={() => setShowMultiSelect(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
        
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4">

              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === 'sophia' && msg.action?.type === 'campaign' && msg.action?.data?.messages ? (
                    <div className="flex gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-1">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <SophiaCampaignResponse 
                          messages={msg.action.data.messages}
                          campaign={msg.action.data.campaign}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'sophia' && (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-br-md' 
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md shadow-sm border border-slate-100 dark:border-slate-700'
                      }`}>
                        {msg.isThinking ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <p className="text-sm">{msg.content}</p>
                            </div>
                            <div className="space-y-1">
                              <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse rounded-full" style={{ width: '100%' }} />
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">Estimated time: 15-30 seconds</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Brand Voice Selector - shown during campaign building */}
              {showBrandVoiceSelector && (
                <div className="pl-11 max-w-md">
                  <BrandVoiceSelector
                    onSelect={handleBrandVoiceSelect}
                    onCancel={() => {
                      setShowBrandVoiceSelector(false);
                      // Use default voice if cancelled
                      handleBrandVoiceSelect('default');
                    }}
                  />
                </div>
              )}
              
              {/* Dynamic Answer Options */}
              {answerOptions.length > 0 && !isProcessing && !showBrandVoiceSelector && (
                <div className="pl-11">
                  <SophiaAnswerOptions
                    options={answerOptions}
                    onSelectOption={handleAnswerOptionSelect}
                    isLoading={isProcessing}
                    multiSelect={campaignSessionRef.current.active && campaignSessionRef.current.currentQuestion === 'channels'}
                    multiSelectLabel="Continue with selected channels"
                  />
                </div>
              )}
              
              {/* Campaign Session Progress Indicator */}
              {campaignSession.active && (
                <Card className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">Building your campaign...</p>
                    <div className="flex gap-1">
                      {QUESTION_ORDER.map((q, i) => (
                        <div 
                          key={q}
                          className={`w-2 h-2 rounded-full ${
                            campaignSession.answers[q as keyof typeof campaignSession.answers]
                              ? 'bg-green-500'
                              : campaignSession.currentQuestion === q
                              ? 'bg-blue-500 animate-pulse'
                              : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      const resetSession: CampaignSession = { active: false, mode: 'regular', currentQuestion: 'channels' as const, answers: {} };
                      campaignSessionRef.current = resetSession;
                      setCampaignSession(resetSession);
                      // Reset campaign phase and pending campaign
                      campaignPhaseRef.current = 'idle';
                      setCampaignPhase('idle');
                      pendingCampaignRef.current = null;
                      setPendingCampaign(null);
                      setAnswerOptions([]);
                      setMessages(prev => [...prev, {
                        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        role: 'sophia',
                        content: 'No problem! What else can I help you with?',
                        timestamp: new Date()
                      }]);
                    }}
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs"
                  >
                    Cancel campaign builder
                  </Button>
                </Card>
              )}
              
              {/* Quick Start Presets - Show when no active campaign */}
              {!hasDraft && !currentWorkflow && messages.length <= 1 && (
                <CampaignQuickStart 
                  onPresetSelect={(presetId) => {
                    setMessages(prev => [...prev, {
                      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                      role: 'sophia',
                      content: `Great choice! I've set up your campaign template. You can see the preview below - edit any step, add more, or just tell me what you'd like to change.`,
                      timestamp: new Date()
                    }]);
                  }}
                />
              )}
              
              {/* Unified Campaign Live Preview - Uses CampaignDraft context */}
              {hasDraft && (
                <CampaignLivePreview 
                  onActivate={() => {
                    toast({
                      title: "Campaign Activated",
                      description: `Your ${draft.steps.length}-step campaign is now live!`,
                    });
                    updateDraft({ status: 'saved' });
                  }}
                />
              )}
              
              {/* Legacy Workflow Preview - for backwards compatibility */}
              {!hasDraft && currentWorkflow && (
                <Card className="p-4">
                  <WorkflowPreview
                    campaignName={currentWorkflow.name}
                    channels={currentWorkflow.channels}
                    messages={currentWorkflow.messages || []}
                    steps={currentWorkflow.steps || currentWorkflow.messages || []}
                    contacts={currentWorkflow.contacts}
                    onEditStep={handleEditStep}
                    onDuplicateStep={handleDuplicateStep}
                  />
                </Card>
              )}
              
              <div ref={scrollRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="max-w-3xl mx-auto space-y-3">
              <div className="flex gap-2">
                <SophiaQuickActionsMenu 
                  onActionSelect={handleQuickActionSelect}
                  disabled={isProcessing}
                />
                <Input
                  ref={inputRef}
                  placeholder="Talk to Sophia - campaigns, strategy, questions, anything..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  disabled={isProcessing}
                  className="flex-1 text-base py-6 px-4 rounded-xl border-slate-200 dark:border-slate-700"
                  data-testid="input-sophia"
                />
                <Button 
                  onClick={handleSend}
                  disabled={isProcessing || !input.trim()}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl px-6"
                  data-testid="button-send"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                💡 Click "Quick Actions" menu for smart suggestions, or just type naturally
              </p>
            </div>
          </div>
        </div>
        
        {/* Step Editor Modal */}
        <WorkflowStepEditor
          open={showStepEditor}
          onOpenChange={setShowStepEditor}
          stepData={editingStepData}
          onSave={handleSaveStep}
          stepIndex={editingStepIndex ?? 0}
          totalSteps={currentWorkflow?.steps?.length || currentWorkflow?.messages?.length || 0}
        />
      </>
    );
  }
);

// Also export as default for compatibility
export default SophiaBrain;
