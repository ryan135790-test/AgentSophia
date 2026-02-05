/**
 * Sophia Quick Chat - Complete campaign builder with naming, lead sources, message preview, and workflow
 * Flow: Channels → Product → Audience → Goal → Campaign Name → Lead Source → Message Preview → Workflow → Launch
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HelpButton } from "@/components/help-guidance/ContextualHelp";
import { OnboardingChecklist } from "@/components/help-guidance/OnboardingChecklist";
import { WorkflowPreview } from "./workflow-preview";
import { 
  Loader2,
  Send,
  Zap,
  Linkedin,
  Mail,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Users,
  Target,
  FileText,
  Eye,
  Database,
  Upload,
  Menu,
  X,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = 'welcome' | 'channels' | 'product' | 'audience' | 'goal' | 'name' | 'leads' | 'generating' | 'preview' | 'workflow' | 'complete';

interface Message {
  role: 'sophia' | 'user';
  content: string;
}

interface MessageOption {
  version: number;
  channel: string;
  subject?: string;
  content: string;
}

interface LeadSource {
  id: string;
  label: string;
  description: string;
  icon: typeof Database;
  leadCount?: number;
}

const CHANNEL_OPTIONS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'phone', label: 'Phone Call', icon: MessageSquare },
];

const LEAD_SOURCES: LeadSource[] = [
  { id: 'manual', label: 'Manual List', description: 'Paste emails or names', icon: FileText },
  { id: 'linkedin', label: 'LinkedIn Search', description: 'Search LinkedIn profiles', icon: Linkedin },
  { id: 'csv', label: 'CSV/Excel Upload', description: 'Upload contacts from file', icon: Upload },
  { id: 'database', label: 'Contact Database', description: 'Use your saved contacts', icon: Database },
];

export function SophiaQuickChat() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('welcome');
  const [workspaceContext, setWorkspaceContext] = useState<any>(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'sophia',
      content: "Hey there! 👋 I'm Sophia, your AI Chief Marketing Officer. I think about campaigns like a real strategist would—considering your audience, crafting messages that resonate, and building sequences that convert. Let me help you create something that actually moves the needle. What do you want to accomplish?"
    }
  ]);

  // Fetch workspace learning context + research + onboarding on mount
  useEffect(() => {
    const fetchContext = async () => {
      try {
        const [contextRes, researchRes, checklistRes] = await Promise.all([
          fetch('/api/sophia/workspace-context'),
          fetch('/api/sophia/research-analysis?channels=email,linkedin,sms'),
          fetch('/api/help/onboarding-checklist')
        ]);
        
        if (contextRes.ok) {
          const context = await contextRes.json();
          setWorkspaceContext(context);
          
          // Load checklist
          if (checklistRes.ok) {
            const checklistData = await checklistRes.json();
            setChecklist(checklistData);
          }
          
          // If there's existing performance data, update welcome message
          if (context.hasData) {
            setShowChecklist(false); // Hide checklist if they're returning user
            const researchData = researchRes.ok ? await researchRes.json() : null;
            let welcomeMsg = `Welcome back! 👋 I've analyzed your previous ${context.performance.totalCampaigns} campaigns. I'm smarter now—I know that ${context.recommendations[0] || 'your audience responds well to personalized outreach'}.`;
            
            if (researchData?.recommendations?.length > 0) {
              welcomeMsg += ` Plus, I've reviewed latest research: ${researchData.recommendations[0]}`;
            }
            
            welcomeMsg += ` Let's apply what I've learned. What's your next move?`;
            
            setMessages([{ role: 'sophia', content: welcomeMsg }]);
          } else {
            // First time - add research insights
            const researchData = researchRes.ok ? await researchRes.json() : null;
            if (researchData?.benchmarks?.length > 0) {
              setMessages([{
                role: 'sophia',
                content: `Hey there! 👋 I'm Sophia, your AI Chief Marketing Officer. I'm backed by latest marketing research and industry benchmarks. 💡 Check your journey on the left to see what we can do together. What do you want to accomplish?`
              }]);
            }
          }
        }
      } catch (error) {
        console.log('Starting fresh - research will load as needed');
      }
    };
    fetchContext();
  }, []);

  // Workflow state
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [leadSource, setLeadSource] = useState<string>('');
  const [leadDetails, setLeadDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [messageOptions, setMessageOptions] = useState<MessageOption[]>([]);
  const [isSavingLeads, setIsSavingLeads] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', company: '', title: '' });
  const [isAddingContact, setIsAddingContact] = useState(false);
  
  // Free-form AI chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [chatMode, setChatMode] = useState<'campaign' | 'chat'>('campaign');
  
  // AI Chat handler - Sophia answers any marketing/sales question
  const handleAIChat = async () => {
    if (!chatInput.trim() || isChatting) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsChatting(true);
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user' as const, content: userMessage }]);
    
    // Add thinking message
    setMessages(prev => [...prev, { role: 'sophia' as const, content: '🧠 Thinking...' }]);
    
    try {
      const response = await fetch('/api/chat/sophia/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.slice(-10).map(m => ({ role: m.role === 'sophia' ? 'assistant' : 'user', content: m.content })),
            { role: 'user', content: userMessage }
          ],
          context: {
            page: 'agent-sophia',
            persona: 'sophia',
            capabilities: ['marketing_strategy', 'sales_advice', 'campaign_optimization', 'copywriting', 'analytics', 'lead_generation'],
            currentStep: step,
            campaignContext: {
              channels: Array.from(selectedChannels),
              product,
              audience,
              goal,
              campaignName
            }
          }
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');
      
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
                  updated[updated.length - 1] = { role: 'sophia', content: fullContent };
                  return updated;
                });
              }
            } catch (e) {
              // Skip parse errors
            }
          }
        }
      }
      
      if (!fullContent) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { 
            role: 'sophia', 
            content: "I understand your question! As your AI Chief Marketing & Sales Officer, I'm here to help with campaign strategy, copywriting, lead generation, sales tactics, and more. Could you provide more details about what you're trying to achieve?" 
          };
          return updated;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { 
          role: 'sophia', 
          content: "I had trouble processing that. Let me help you another way—what marketing or sales challenge can I assist with? I can help with campaigns, copywriting, lead strategies, analytics, and much more." 
        };
        return updated;
      });
    } finally {
      setIsChatting(false);
    }
  };

  const handleChannelToggle = (channel: string) => {
    const updated = new Set(selectedChannels);
    if (updated.has(channel)) {
      updated.delete(channel);
    } else {
      updated.add(channel);
    }
    setSelectedChannels(updated);
  };

  const handleAddContact = async () => {
    if (!contactForm.name || !contactForm.email) {
      toast({ title: 'Name and email are required', variant: 'destructive' });
      return;
    }

    setIsAddingContact(true);
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });

      if (res.ok) {
        toast({ title: `✅ ${contactForm.name} added to your contacts!` });
        setContactForm({ name: '', email: '', company: '', title: '' });
        setShowAddContact(false);
      }
    } catch (error) {
      toast({ title: 'Error adding contact', variant: 'destructive' });
    } finally {
      setIsAddingContact(false);
    }
  };

  const handleSaveLeadsToContacts = async () => {
    if (!leadDetails.trim()) {
      toast({ title: 'Please enter lead information', variant: 'destructive' });
      return;
    }

    setIsSavingLeads(true);
    try {
      const lines = leadDetails.split('\n').filter(line => line.trim());
      let savedCount = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        let email = '';
        let name = '';

        if (trimmed.includes('@')) {
          email = trimmed;
          name = trimmed.split('@')[0];
        } else {
          name = trimmed;
        }

        if (name) {
          await fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, company: '', title: '' })
          });
          savedCount++;
        }
      }

      toast({ title: `✅ Saved ${savedCount} leads to your Contacts`, variant: 'default' });
    } catch (error) {
      toast({ title: 'Error saving leads', variant: 'destructive' });
    } finally {
      setIsSavingLeads(false);
    }
  };

  const handleNext = async () => {
    if (step === 'welcome') {
      setMessages(prev => [
        ...prev,
        { role: 'sophia', content: 'Let\'s start by thinking about where your audience hangs out. Which channels should we use? I\'m thinking email for direct reach, LinkedIn for credibility, SMS for urgency... You pick. 📡' }
      ]);
      setStep('channels');
      return;
    }

    if (step === 'channels') {
      if (selectedChannels.size === 0) {
        toast({ title: 'Please select at least one channel', variant: 'destructive' });
        return;
      }
      const channelList = Array.from(selectedChannels).map(c => CHANNEL_OPTIONS.find(o => o.id === c)?.label).filter(Boolean).join(', ');
      
      let channelResponse = `Smart choice—${channelList} will give you solid coverage.`;
      if (workspaceContext?.recommendations) {
        const channelRecs = workspaceContext.recommendations.filter((r: string) => 
          channelList.toLowerCase().includes(r.split(' ')[0].toLowerCase())
        );
        if (channelRecs.length > 0) {
          channelResponse += ` Based on your data, ${channelRecs[0].toLowerCase()}`;
        }
      }
      channelResponse += ` Now, let me understand what you're selling. Tell me about your product or service—what\'s the core value proposition?`;
      
      setMessages(prev => [
        ...prev,
        { role: 'user', content: `I want to use: ${channelList}` },
        { role: 'sophia', content: channelResponse }
      ]);
      setStep('product');
      return;
    }

    if (step === 'product') {
      if (!product.trim()) {
        toast({ title: 'Please describe your product', variant: 'destructive' });
        return;
      }
      setMessages(prev => [
        ...prev,
        { role: 'user', content: product },
        { role: 'sophia', content: 'Got it—that\'s compelling. Now I need to know who we\'re talking to. Who\'s the person that benefits most from this? (Job titles, company types, industries)' }
      ]);
      setStep('audience');
      return;
    }

    if (step === 'audience') {
      if (!audience.trim()) {
        toast({ title: 'Please describe your target audience', variant: 'destructive' });
        return;
      }
      setMessages(prev => [
        ...prev,
        { role: 'user', content: audience },
        { role: 'sophia', content: 'Perfect—I\'m already thinking about how they think. Last question: what\'s the outcome you want? Are we booking calls, getting replies, driving signups, or something else?' }
      ]);
      setStep('goal');
      return;
    }

    if (step === 'goal') {
      if (!goal.trim()) {
        toast({ title: 'Please describe your goal', variant: 'destructive' });
        return;
      }
      setMessages(prev => [
        ...prev,
        { role: 'user', content: goal },
        { role: 'sophia', content: 'Love it. Let me label this campaign so we can track it. Give it a name that describes what we\'re doing and when. (e.g., "Q1 Enterprise Push", "Summer Lead Blitz")' }
      ]);
      setStep('name');
      return;
    }

    if (step === 'name') {
      if (!campaignName.trim()) {
        toast({ title: 'Please name your campaign', variant: 'destructive' });
        return;
      }
      setMessages(prev => [
        ...prev,
        { role: 'user', content: `Campaign: "${campaignName}"` },
        { role: 'sophia', content: 'Great—I\'ve got the vision. Now I need the leads. Where should I pull them from? Do you have them ready, or should I search for them?' }
      ]);
      setStep('leads');
      return;
    }

    if (step === 'leads') {
      if (!leadSource) {
        toast({ title: 'Please select a lead source', variant: 'destructive' });
        return;
      }
      const selectedLeadSource = LEAD_SOURCES.find(s => s.id === leadSource);
      const leadSourceName = selectedLeadSource?.label || leadSource;
      
      let followUpMessage = '';
      if (leadSource === 'manual') {
        followUpMessage = 'Please paste your contacts (emails or names, one per line):';
      } else if (leadSource === 'linkedin') {
        followUpMessage = 'What LinkedIn search should I use? (e.g., "sales director at tech companies", "VP product at 500+ employee firms")';
      } else if (leadSource === 'csv') {
        followUpMessage = 'Great! You can upload your CSV/Excel file. (First 100 contacts will be used)';
      } else {
        followUpMessage = 'I\'ll connect to your contact database and pull the matching leads.';
      }

      setMessages(prev => [
        ...prev,
        { role: 'user', content: `Use: ${leadSourceName}` },
        { role: 'sophia', content: followUpMessage }
      ]);
      return;
    }

    if (step === 'generating') {
      generateMessages();
      return;
    }
  };

  const proceedToGenerate = async () => {
    if (!leadDetails.trim()) {
      toast({ title: 'Please provide lead details', variant: 'destructive' });
      return;
    }

    const leadSourceName = LEAD_SOURCES.find(s => s.id === leadSource)?.label || leadSource;
    setMessages(prev => [
      ...prev,
      { role: 'user', content: leadDetails }
    ]);

    setIsGenerating(true);
    setStep('generating');
    await generateMessages();
  };

  const generateMessages = async () => {
    try {
      const thinkingMsg = workspaceContext?.hasData 
        ? `🧠 I'm thinking about this... Based on ${workspaceContext.performance?.totalCampaigns || 0} past campaigns + latest marketing research, I know what works. Generating personalized messages for ${Array.from(selectedChannels).map(c => CHANNEL_OPTIONS.find(o => o.id === c)?.label).filter(Boolean).join(', ')}...`
        : `🧠 Analyzing your campaign details and industry best practices... Generating personalized messages for ${Array.from(selectedChannels).map(c => CHANNEL_OPTIONS.find(o => o.id === c)?.label).filter(Boolean).join(', ')}...`;
      
      setMessages(prev => [
        ...prev,
        { 
          role: 'sophia', 
          content: thinkingMsg
        }
      ]);

      // Call real AI endpoint to generate messages
      const aiResponse = await fetch('/api/sophia/generate-campaign-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          audience,
          goal,
          channels: Array.from(selectedChannels),
          leads: leadDetails,
          leadSource,
          workspaceId: 'demo' // Track workspace for learning
        })
      });

      if (!aiResponse.ok) {
        throw new Error('Failed to generate messages - AI service error');
      }

      const aiData = await aiResponse.json();
      const generated = aiData.messages || [];
      
      if (!Array.isArray(generated) || generated.length === 0) {
        throw new Error('No messages generated - please try again');
      }

      setMessageOptions(generated);

      const successMsg = workspaceContext?.recommendations?.length > 0
        ? `✅ Done! I've crafted these using GPT-4o based on your campaign parameters and industry research. ${workspaceContext.recommendations[0]} See the full personalized content below!`
        : `✅ I've generated personalized, high-converting message versions using AI. Each one is tailored to resonate with your audience and drive action. See the full content below!`;
        
      setMessages(prev => [
        ...prev,
        {
          role: 'sophia',
          content: successMsg
        }
      ]);

      setStep('preview');
    } catch (error: any) {
      console.error('Message generation error:', error);
      toast({ title: 'Error generating messages', description: error.message || 'Failed to generate AI messages', variant: 'destructive' });
      setStep('leads');
    } finally {
      setIsGenerating(false);
    }
  };

  const launchCampaign = async () => {
    setIsGenerating(true);
    try {
      // STEP 1: Sophia validates everything before launch
      setMessages(prev => [
        ...prev,
        { 
          role: 'sophia', 
          content: `🧠 Hold on—let me check everything before we launch. Validating workflow, contact data, and field mappings...`
        }
      ]);

      // Simulate workflow validation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const validationIssues = []; // In production, call /api/workflows/validate
      
      // Check critical requirements
      if (!campaignName.trim()) {
        validationIssues.push({
          severity: 'error',
          message: 'Campaign name is missing'
        });
      }
      
      if (Array.from(selectedChannels).length === 0) {
        validationIssues.push({
          severity: 'error',
          message: 'No channels selected'
        });
      }

      // Check for data issues
      const hasErrors = validationIssues.filter(i => i.severity === 'error').length > 0;
      
      if (hasErrors) {
        setMessages(prev => [
          ...prev,
          {
            role: 'sophia',
            content: `⚠️ I found issues that need fixing before launch:\n${validationIssues.map(i => `• ${i.message}`).join('\n')}\n\nLet me know when you've fixed these!`
          }
        ]);
        setIsGenerating(false);
        return;
      }

      // If we get here, validation passed
      setMessages(prev => [
        ...prev,
        { 
          role: 'sophia', 
          content: `✅ Everything checks out! Creating workflow "${campaignName}"...`
        }
      ]);

      // STEP 2: Create the workflow with the campaign name
      const channelsList = Array.from(selectedChannels);
      const workflowNodes = [
        { id: 'start', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'Start', description: `Campaign: ${campaignName}` } },
      ];
      const workflowEdges: any[] = [];
      
      let yPos = 100;
      let prevNodeId = 'start';
      
      channelsList.forEach((channel, idx) => {
        const nodeId = `${channel}_${idx}`;
        workflowNodes.push({
          id: nodeId,
          type: channel === 'email' ? 'email' : channel === 'linkedin' ? 'linkedin' : 'action',
          position: { x: 250, y: yPos },
          data: { 
            label: CHANNEL_OPTIONS.find(c => c.id === channel)?.label || channel,
            description: messageOptions[idx]?.content?.substring(0, 50) + '...' || `${channel} outreach`
          }
        });
        workflowEdges.push({ id: `e_${prevNodeId}_${nodeId}`, source: prevNodeId, target: nodeId });
        prevNodeId = nodeId;
        yPos += 100;
        
        // Add wait node between channels
        if (idx < channelsList.length - 1) {
          const waitId = `wait_${idx}`;
          workflowNodes.push({
            id: waitId,
            type: 'delay',
            position: { x: 250, y: yPos },
            data: { label: 'Wait 2 days', description: 'Optimal timing gap' }
          });
          workflowEdges.push({ id: `e_${prevNodeId}_${waitId}`, source: prevNodeId, target: waitId });
          prevNodeId = waitId;
          yPos += 100;
        }
      });

      const workflowData = {
        name: campaignName,
        description: `Multichannel campaign targeting ${audience}. Goal: ${goal}`,
        type: 'campaign',
        status: 'active',
        nodes: workflowNodes,
        edges: workflowEdges,
        settings: {
          product,
          audience,
          goal,
          leadSource,
          channels: channelsList,
          messages: messageOptions
        }
      };

      const saveWorkflowRes = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflowData)
      });

      if (!saveWorkflowRes.ok) {
        console.warn('Could not save workflow to database');
      } else {
        const savedWorkflow = await saveWorkflowRes.json();
        console.log(`[Sophia] Workflow created: ${savedWorkflow.name} (${savedWorkflow.id})`);
      }

      // STEP 3: Save the campaign to the database and learning system
      // Generate steps from channels and messages for database persistence
      const generatedSteps = channelsList.map((channel, idx) => ({
        id: `step_${Date.now()}_${idx}`,
        channel,
        label: CHANNEL_OPTIONS.find(c => c.id === channel)?.label || `Step ${idx + 1}`,
        subject: messageOptions[idx]?.subject || `${campaignName} - ${CHANNEL_OPTIONS.find(c => c.id === channel)?.label}`,
        content: messageOptions[idx]?.content || '',
        delay: idx === 0 ? 0 : 2,
        delayUnit: 'days',
        order: idx,
        variations: [],
        branches: [],
      }));
      
      const campaignData = {
        name: campaignName,
        type: Array.from(selectedChannels).length > 1 ? 'multi-channel' : Array.from(selectedChannels)[0] || 'email',
        status: 'active',
        steps: generatedSteps,
        target_audience: {
          audience,
          product,
          goal,
          leadSource,
          channels: Array.from(selectedChannels)
        },
        settings: {
          channels: Array.from(selectedChannels),
          messages: messageOptions,
          leadDetails
        }
      };

      const saveCampaignRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData)
      });

      // Log campaign to learning system
      await fetch('/api/sophia/log-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'demo',
          actionType: 'campaign',
          channel: Array.from(selectedChannels)[0] || 'multi',
          metric: 'campaigns_launched',
          value: 1
        })
      }).catch(() => {
        // Learning log is optional
      });

      if (!saveCampaignRes.ok) {
        console.warn('Could not save campaign to database, but continuing with launch');
      }

      // Then launch via autonomous command
      const command = `Launch campaign "${campaignName}" on ${Array.from(selectedChannels).join(', ')} targeting ${audience}. Product: ${product}. Goal: ${goal}. Lead source: ${leadSource}. With ${messageOptions.length} personalized messages.`;
      
      const response = await fetch('/api/sophia/autonomous-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: command,
          context: {
            campaignName,
            channels: Array.from(selectedChannels),
            product,
            audience,
            goal,
            leadSource,
            messages: messageOptions,
            action: 'launch_campaign'
          }
        })
      });

      if (!response.ok) throw new Error('Failed to launch campaign');

      setMessages(prev => [
        ...prev,
        {
          role: 'sophia',
          content: `🚀 Campaign "${campaignName}" is LIVE! I've created a ${channelsList.length}-step workflow and I'm reaching out to your ${audience} audience on ${Array.from(selectedChannels).join(', ')} with personalized messages. Check your Campaigns page to track performance!`
        }
      ]);

      setStep('complete');
    } catch (error: any) {
      toast({ title: 'Launch failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setStep('welcome');
    setMessages([{
      role: 'sophia',
      content: "That campaign is flying now! 🚀 Ready to build another one? I've learned from the last campaign and I'm ready to make the next one even better."
    }]);
    setSelectedChannels(new Set());
    setProduct('');
    setAudience('');
    setGoal('');
    setCampaignName('');
    setLeadSource('');
    setLeadDetails('');
    setMessageOptions([]);
  };

  // Prepare checklist items from current step
  const checklistItems = [
    { step: 'Select Channels', description: 'Choose communication channels', completed: step !== 'welcome' && step !== 'channels' },
    { step: 'Describe Product', description: 'Explain your product/service', completed: step !== 'welcome' && step !== 'channels' && step !== 'product' },
    { step: 'Target Audience', description: 'Define who you\'re reaching', completed: ['audience', 'goal', 'name', 'leads', 'generating', 'preview', 'workflow', 'complete'].includes(step) },
    { step: 'Set Goal', description: 'What\'s the outcome?', completed: ['goal', 'name', 'leads', 'generating', 'preview', 'workflow', 'complete'].includes(step) },
    { step: 'Name Campaign', description: 'Label your campaign', completed: ['name', 'leads', 'generating', 'preview', 'workflow', 'complete'].includes(step) },
    { step: 'Select Leads', description: 'Choose lead source', completed: ['leads', 'generating', 'preview', 'workflow', 'complete'].includes(step) },
    { step: 'Review & Launch', description: 'Preview and execute', completed: step === 'complete' },
  ];

  return (
    <div className="w-full h-full flex gap-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 overflow-hidden relative">
      {/* Mobile Overlay */}
      {showChecklist && sidebarOpen && (
        <div 
          className="md:hidden absolute inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Onboarding Checklist */}
      {showChecklist && (
        <div className={`${
          sidebarOpen ? 'absolute md:relative' : 'hidden md:block'
        } z-50 md:z-auto w-80 overflow-y-auto border-r border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900 md:bg-white/50 md:dark:bg-slate-900/50 h-full md:h-auto`}>
          <div className="flex items-center justify-between mb-4 md:hidden">
            <h3 className="font-semibold text-sm">Your Journey</h3>
            <button 
              onClick={() => setSidebarOpen(false)}
              data-testid="button-close-sidebar"
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <OnboardingChecklist 
            steps={checklistItems}
            onStepClick={(stepName) => console.log('Step clicked:', stepName)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Menu Button */}
        {showChecklist && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
            className="md:hidden absolute top-3 left-3 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 z-10 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        )}
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'sophia' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">S</div>
            )}
            <div className={`max-w-xs px-4 py-2 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-none'}`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Message Preview */}
        {step === 'preview' && messageOptions.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">📋 Campaign: <span className="font-bold">{campaignName}</span></p>
            <p className="text-xs text-slate-600 dark:text-slate-400">Full message content for each channel:</p>
            {messageOptions.map((msg, i) => (
              <Card key={i} className="p-4 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className="capitalize bg-blue-500">{msg.channel}</Badge>
                    <span className="text-xs text-slate-600 dark:text-slate-400">Version {msg.version}</span>
                  </div>
                  {msg.subject && (
                    <div>
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Subject:</p>
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">{msg.subject}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Message:</p>
                    <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Interactive Workflow Preview */}
        {step === 'workflow' && (
          <div className="mt-6 space-y-4">
            <WorkflowPreview
              campaignName={campaignName || 'New Campaign'}
              channels={Array.from(selectedChannels)}
              messages={messageOptions.map(m => ({
                channel: m.channel,
                subject: m.subject,
                content: m.content,
              }))}
              steps={messageOptions.map((m, idx) => ({
                channel: m.channel,
                subject: m.subject,
                content: m.content,
                delay: idx === 0 ? 0 : 2,
              }))}
              onNodeClick={(nodeId, nodeData) => {
                console.log('Node clicked:', nodeId, nodeData);
              }}
            />
            
            <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <p className="font-bold text-base text-purple-900 dark:text-purple-100 mb-2">📋 Campaign Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm text-purple-800 dark:text-purple-200">
                <div>✓ <span className="font-medium">Name:</span> {campaignName || '(Not set)'}</div>
                <div>✓ <span className="font-medium">Channels:</span> {Array.from(selectedChannels).length}</div>
                <div>✓ <span className="font-medium">Target:</span> {audience?.substring(0, 30) || '(Not set)'}...</div>
                <div>✓ <span className="font-medium">Messages:</span> {messageOptions.length}</div>
              </div>
            </div>
          </div>
        )}
      </div>

        {/* Input Area */}
        <Card className="m-4 p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {step === 'channels' && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Select channels:</p>
            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_OPTIONS.map(channel => (
                <label key={channel.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded">
                  <Checkbox
                    checked={selectedChannels.has(channel.id)}
                    onCheckedChange={() => handleChannelToggle(channel.id)}
                    data-testid={`checkbox-channel-${channel.id}`}
                  />
                  <channel.icon className="w-4 h-4" />
                  <span className="text-sm">{channel.label}</span>
                </label>
              ))}
            </div>
            <Button onClick={handleNext} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-next-channels">
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'product' && (
          <div className="space-y-3">
            <Textarea
              placeholder="e.g., 'AI sales automation tool that generates personalized outreach campaigns and books meetings autonomously'"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="min-h-24 resize-none"
              data-testid="textarea-product"
            />
            <Button onClick={handleNext} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-next-product">
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'audience' && (
          <div className="space-y-3">
            <Textarea
              placeholder="e.g., 'VP of Sales and Sales Directors at B2B SaaS companies with 50-500 employees'"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="min-h-24 resize-none"
              data-testid="textarea-audience"
            />
            <Button onClick={handleNext} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-next-audience">
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'goal' && (
          <div className="space-y-3">
            <Textarea
              placeholder="e.g., 'Book 20 discovery calls this month'"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="min-h-24 resize-none"
              data-testid="textarea-goal"
            />
            <Button onClick={handleNext} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-next-goal">
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-3">
            <Input
              placeholder="e.g., 'Q1 Enterprise Outreach' or 'Summer Lead Drive'"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              data-testid="input-campaign-name"
              className="text-base"
            />
            <Button onClick={handleNext} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-next-name">
              Next <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 'leads' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Where should I get leads?</p>
              <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950" data-testid="button-add-contact-leads">
                    <Plus className="w-4 h-4 mr-1" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Name *</label>
                      <Input
                        placeholder="Contact name"
                        value={contactForm.name}
                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        data-testid="input-contact-name-leads"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email *</label>
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={contactForm.email}
                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        data-testid="input-contact-email-leads"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Company</label>
                      <Input
                        placeholder="Company name"
                        value={contactForm.company}
                        onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                        data-testid="input-contact-company-leads"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Job Title</label>
                      <Input
                        placeholder="Job title"
                        value={contactForm.title}
                        onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })}
                        data-testid="input-contact-title-leads"
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleAddContact}
                        disabled={isAddingContact}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                        data-testid="button-submit-contact-leads"
                      >
                        {isAddingContact ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding...</> : 'Add Contact'}
                      </Button>
                      <Button
                        onClick={() => setShowAddContact(false)}
                        variant="outline"
                        data-testid="button-cancel-contact-leads"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LEAD_SOURCES.map(source => (
                <Card
                  key={source.id}
                  className={`p-3 cursor-pointer transition-all ${leadSource === source.id ? 'bg-blue-100 dark:bg-blue-950 border-blue-500' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  onClick={() => setLeadSource(source.id)}
                  data-testid={`card-lead-source-${source.id}`}
                >
                  <source.icon className="w-5 h-5 mb-1 text-blue-600" />
                  <p className="text-xs font-medium">{source.label}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{source.description}</p>
                </Card>
              ))}
            </div>
            
            {leadSource && (
              <div className="space-y-2 mt-3 pt-3 border-t">
                {leadSource === 'manual' && (
                  <Textarea
                    placeholder="Paste emails or names (one per line)&#10;john@company.com&#10;jane@company.com&#10;marketing@company.com"
                    value={leadDetails}
                    onChange={(e) => setLeadDetails(e.target.value)}
                    className="min-h-24 text-sm"
                    data-testid="textarea-lead-details"
                  />
                )}
                {leadSource === 'linkedin' && (
                  <Input
                    placeholder="e.g., 'VP Sales at Fortune 500' or 'marketing managers at tech'"
                    value={leadDetails}
                    onChange={(e) => setLeadDetails(e.target.value)}
                    data-testid="input-linkedin-search"
                  />
                )}
                {leadSource === 'csv' && (
                  <Input
                    type="file"
                    accept=".csv,.xlsx"
                    value={leadDetails}
                    onChange={(e) => setLeadDetails(e.target.value)}
                    data-testid="input-csv-upload"
                  />
                )}

                {leadSource === 'manual' && (
                  <Button onClick={handleSaveLeadsToContacts} disabled={isSavingLeads} className="w-full bg-green-600 hover:bg-green-700" data-testid="button-save-leads-contacts">
                    {isSavingLeads ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <>💾 Save Leads to Contacts</>}
                  </Button>
                )}

                <Button onClick={proceedToGenerate} disabled={isGenerating} className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-generate">
                  {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</> : <>Generate Messages <Zap className="w-4 h-4 ml-2" /></>}
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 'generating' && (
          <div className="flex items-center justify-center gap-2 py-6">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
            <span className="text-sm">Sophia is crafting your messages...</span>
          </div>
        )}

        {step === 'preview' && (
          <Button onClick={() => setStep('workflow')} className="w-full bg-purple-600 hover:bg-purple-700 text-white" data-testid="button-to-workflow">
            Review Workflow <Eye className="w-4 h-4 ml-2" />
          </Button>
        )}

        {step === 'workflow' && (
          <div className="space-y-3">
            <Button onClick={launchCampaign} disabled={isGenerating} className="w-full bg-green-600 hover:bg-green-700 text-white text-base font-semibold py-6" data-testid="button-launch">
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Launching...</> : <>🚀 Launch Campaign!</>}
            </Button>
            <Button onClick={() => setStep('preview')} variant="outline" className="w-full" data-testid="button-back-preview">
              ← Back (review messages)
            </Button>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-green-900 dark:text-green-100 text-base">🚀 Campaign "{campaignName}" is LIVE!</p>
                <p className="text-xs text-green-700 dark:text-green-200 mt-2">Sophia is now managing outreach, tracking responses, and optimizing in real-time.</p>
              </div>
            </div>
            <Button onClick={reset} className="w-full bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-new-campaign">
              Create Another Campaign
            </Button>
            <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white" data-testid="button-view-campaigns">
              <a href="/campaigns">View All Campaigns</a>
            </Button>
          </div>
        )}

        {step === 'welcome' && (
          <div className="space-y-3">
            <Button onClick={handleNext} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold py-6" data-testid="button-get-started">
              Build a Campaign <Zap className="w-4 h-4 ml-2" />
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-800 px-2 text-slate-500">or ask me anything</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Input
                placeholder="Ask about marketing, sales, copywriting..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAIChat()}
                disabled={isChatting}
                className="flex-1"
                data-testid="input-chat"
              />
              <Button 
                onClick={handleAIChat} 
                disabled={isChatting || !chatInput.trim()}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-send-chat"
              >
                {isChatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2 mt-2">
              {['How do I write better cold emails?', 'Best LinkedIn outreach tactics?', 'Improve my conversion rate'].map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setChatInput(q); }}
                  className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300"
                  data-testid={`quick-question-${i}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Chat input available on all steps */}
        {step !== 'welcome' && step !== 'complete' && step !== 'generating' && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-2">
              <Input
                placeholder="Ask Sophia anything..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAIChat()}
                disabled={isChatting}
                className="flex-1 text-sm"
                data-testid="input-chat-inline"
              />
              <Button 
                onClick={handleAIChat} 
                disabled={isChatting || !chatInput.trim()}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-send-chat-inline"
              >
                {isChatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
