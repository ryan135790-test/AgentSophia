import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { useContacts } from '@/hooks/use-contacts';
import { useQuery } from '@tanstack/react-query';
import { generateCampaignVersions, type CampaignVersion, type BrandVoice } from '@/lib/openai';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Sparkles, 
  Send, 
  Mail, 
  Linkedin, 
  MessageSquare,
  Users,
  Zap,
  CheckCircle2,
  Clock,
  TrendingUp,
  Target,
  Play,
  Pause,
  Phone,
  Share2,
  Bot,
  Upload,
  ChevronDown,
  ChevronUp,
  Mic2,
  X,
  Lightbulb,
  Eye,
  ArrowUp,
  BarChart3,
  Brain,
  Edit3,
  Trash2,
  GripVertical,
  Plus,
  Save,
  ArrowDown
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { AutomationHub } from './automation-hub';
import { ContactImportModal } from '../crm/contact-import-modal';

type ChannelType = 'email' | 'linkedin' | 'sms' | 'phone' | 'social' | 'voicemail';

interface CampaignStep {
  channel: ChannelType;
  delay: number;
  content: string;
  subject?: string;
  generated: boolean;
}

interface AICampaign {
  id?: string;
  name: string;
  goal: string;
  targetAudience: string;
  steps: CampaignStep[];
  status: 'draft' | 'generating' | 'ready' | 'active' | 'paused';
  selectedContacts: string[];
}

export function AICampaignBuilder() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: contacts = [] } = useContacts();
  
  const [campaign, setCampaign] = useState<AICampaign>({
    name: '',
    goal: '',
    targetAudience: '',
    steps: [],
    status: 'draft',
    selectedContacts: []
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [campaignPrompt, setCampaignPrompt] = useState('');
  const [selectedChannels, setSelectedChannels] = useState<ChannelType[]>(['email', 'linkedin']);
  const [campaignVersions, setCampaignVersions] = useState<CampaignVersion[]>([]);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBrandVoiceOpen, setIsBrandVoiceOpen] = useState(false);
  const [numberOfSteps, setNumberOfSteps] = useState(5);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [editingStep, setEditingStep] = useState<CampaignStep | null>(null);

  // Step editing functions
  const openStepEditor = (index: number) => {
    setEditingStepIndex(index);
    setEditingStep({ ...campaign.steps[index] });
  };

  const saveStepEdit = () => {
    if (editingStepIndex !== null && editingStep) {
      const newSteps = [...campaign.steps];
      newSteps[editingStepIndex] = editingStep;
      setCampaign(prev => ({ ...prev, steps: newSteps }));
      setEditingStepIndex(null);
      setEditingStep(null);
      toast({ title: 'Step Updated', description: 'Your changes have been saved' });
    }
  };

  const deleteStep = (index: number) => {
    if (campaign.steps.length <= 1) {
      toast({ title: 'Cannot Delete', description: 'Campaign must have at least one step', variant: 'destructive' });
      return;
    }
    const newSteps = campaign.steps.filter((_, i) => i !== index);
    setCampaign(prev => ({ ...prev, steps: newSteps }));
    toast({ title: 'Step Removed', description: 'The step has been removed from your campaign' });
  };

  const moveStepUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...campaign.steps];
    [newSteps[index - 1], newSteps[index]] = [newSteps[index], newSteps[index - 1]];
    setCampaign(prev => ({ ...prev, steps: newSteps }));
  };

  const moveStepDown = (index: number) => {
    if (index === campaign.steps.length - 1) return;
    const newSteps = [...campaign.steps];
    [newSteps[index], newSteps[index + 1]] = [newSteps[index + 1], newSteps[index]];
    setCampaign(prev => ({ ...prev, steps: newSteps }));
  };

  const addNewStep = () => {
    const newStep: CampaignStep = {
      channel: 'email',
      delay: campaign.steps.length > 0 ? 3 : 0,
      content: 'Enter your message here...',
      subject: 'New Step',
      generated: false
    };
    setCampaign(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    toast({ title: 'Step Added', description: 'New step added to your campaign' });
  };
  
  const [brandVoice, setBrandVoice] = useState<BrandVoice>({
    tone: 'professional',
    values: [],
    avoidWords: [],
    keyMessages: []
  });
  const [newValue, setNewValue] = useState('');
  const [newAvoidWord, setNewAvoidWord] = useState('');
  const [newKeyMessage, setNewKeyMessage] = useState('');
  const [selectedBrandVoiceId, setSelectedBrandVoiceId] = useState<string>('');

  // Fetch saved brand voices
  interface SavedBrandVoice {
    id: string;
    name: string;
    companyName: string;
    industry: string;
    tone: string;
    values: string[];
    writingStyle: string;
    avoidWords: string[];
    keyMessages: string[];
  }

  const { data: savedBrandVoicesData } = useQuery<{ brand_voices: SavedBrandVoice[] }>({
    queryKey: ['/api/brand-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/brand-voices', {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) return { brand_voices: [] };
      return response.json();
    },
  });

  const savedBrandVoices = savedBrandVoicesData?.brand_voices || [];

  // When a saved brand voice is selected, populate the inline form
  const handleBrandVoiceSelect = (voiceId: string) => {
    setSelectedBrandVoiceId(voiceId);
    if (voiceId === 'custom') {
      // Reset to empty for custom
      setBrandVoice({
        tone: 'professional',
        values: [],
        avoidWords: [],
        keyMessages: []
      });
      setIsBrandVoiceOpen(true);
    } else if (voiceId) {
      const selectedVoice = savedBrandVoices.find(v => v.id === voiceId);
      if (selectedVoice) {
        setBrandVoice({
          companyName: selectedVoice.companyName,
          industry: selectedVoice.industry,
          tone: selectedVoice.tone,
          values: selectedVoice.values || [],
          writingStyle: selectedVoice.writingStyle,
          avoidWords: selectedVoice.avoidWords || [],
          keyMessages: selectedVoice.keyMessages || []
        });
        setIsBrandVoiceOpen(false);
      }
    }
  };
  
  const availableChannels = [
    { id: 'linkedin' as ChannelType, name: 'LinkedIn', icon: Linkedin, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950' },
    { id: 'email' as ChannelType, name: 'Email', icon: Mail, color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950' },
    { id: 'sms' as ChannelType, name: 'SMS', icon: MessageSquare, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950' },
    { id: 'phone' as ChannelType, name: 'AI Phone Call', icon: Phone, color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950' },
    { id: 'voicemail' as ChannelType, name: 'Voicemail Drop', icon: Bot, color: 'text-cyan-600', bgColor: 'bg-cyan-50 dark:bg-cyan-950' },
    { id: 'social' as ChannelType, name: 'Social Media', icon: Share2, color: 'text-pink-600', bgColor: 'bg-pink-50 dark:bg-pink-950' },
  ];
  
  const toggleChannel = (channelId: ChannelType) => {
    setSelectedChannels(prev => 
      prev.includes(channelId) 
        ? prev.filter(c => c !== channelId)
        : [...prev, channelId]
    );
  };

  const generateCampaignWithAI = async () => {
    if (!campaignPrompt.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please describe your campaign goal',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedChannels.length === 0) {
      toast({
        title: 'No Channels Selected',
        description: 'Please select at least one channel for your campaign',
        variant: 'destructive',
      });
      return;
    }

    // Allow testing without contacts
    const contactCount = contacts.length || 0;

    setIsGenerating(true);
    setCampaign(prev => ({ ...prev, status: 'generating' }));

    try {
      const result = await generateCampaignVersions({
        goal: campaignPrompt,
        channels: selectedChannels,
        contactCount: contactCount,
        numberOfSteps: numberOfSteps,
        brandVoice: brandVoice.companyName || brandVoice.industry || brandVoice.writingStyle ? brandVoice : undefined
      });

      // Store all versions
      setCampaignVersions(result.versions);
      setSelectedVersionIndex(0); // Select the highest-ranked version by default

      // Set the first (best) version as the active campaign
      const bestVersion = result.versions[0];
      const generatedSteps: CampaignStep[] = bestVersion.steps.map(step => ({
        ...step,
        generated: true
      }));

      setCampaign(prev => ({
        ...prev,
        goal: campaignPrompt,
        targetAudience: bestVersion.targetAudience,
        steps: generatedSteps,
        status: 'ready',
        selectedContacts: contacts.map(c => c.id)
      }));

      toast({
        title: 'Campaign Generated! 🎉',
        description: `AI created ${generatedSteps.length} touchpoints for your campaign`,
      });

    } catch (error) {
      console.error('Error generating campaign:', error);
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Could not generate campaign. Please check your OpenAI API key.',
        variant: 'destructive',
      });
      setCampaign(prev => ({ ...prev, status: 'draft' }));
    } finally {
      setIsGenerating(false);
    }
  };

  const selectVersion = (index: number) => {
    const selectedVersion = campaignVersions[index];
    setSelectedVersionIndex(index);
    
    const generatedSteps: CampaignStep[] = selectedVersion.steps.map(step => ({
      ...step,
      generated: true
    }));

    setCampaign(prev => ({
      ...prev,
      targetAudience: selectedVersion.targetAudience,
      steps: generatedSteps
    }));
  };

  const launchCampaign = async () => {
    if (!campaign.steps.length) {
      toast({
        title: 'Cannot Launch',
        description: 'Please generate campaign steps first using the "Generate Campaign with AI" button',
        variant: 'destructive',
      });
      return;
    }
    
    // Allow launching without contacts for testing
    if (!campaign.selectedContacts.length && contacts.length === 0) {
      toast({
        title: 'Test Mode',
        description: 'Campaign will be created in demo mode (no contacts selected)',
      });
    }

    if (!user) {
      toast({
        title: 'Authentication Error',
        description: 'You must be logged in to launch campaigns',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error} = await (supabase as any)
        .from('campaigns')
        .insert({
          name: campaign.name || campaign.goal.slice(0, 100),
          type: 'multi-channel',
          status: 'active',
          target_audience: { description: campaign.targetAudience },
          settings: {
            steps: campaign.steps,
            contacts: campaign.selectedContacts,
            channels: campaign.steps.map(s => s.channel)
          },
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        console.error('Launch error:', error);
        throw error;
      }

      setCampaign(prev => ({ ...prev, status: 'active', id: data.id }));
      
      toast({
        title: 'Campaign Launched! 🚀',
        description: `Your AI-powered campaign is now running for ${campaign.selectedContacts.length} contacts`,
      });

    } catch (error) {
      console.error('Error launching campaign:', error);
      toast({
        title: 'Launch Failed',
        description: 'Could not launch campaign. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const pauseCampaign = async () => {
    if (!campaign.id) return;
    
    try {
      const { error } = await (supabase as any)
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', campaign.id);

      if (error) throw error;

      setCampaign(prev => ({ ...prev, status: 'paused' }));
      toast({
        title: 'Campaign Paused',
        description: 'All outreach has been paused',
      });
    } catch (error) {
      console.error('Error pausing campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to pause campaign',
        variant: 'destructive',
      });
    }
  };

  // Generate Campaign Intelligence insights based on current setup
  const generateCampaignInsights = () => {
    const channelCount = selectedChannels.length;
    const contactCount = contacts.length;
    const hasGoal = campaignPrompt.trim().length > 0;
    
    const insights = [];
    
    if (channelCount >= 3) {
      insights.push({
        icon: TrendingUp,
        title: 'Multi-Channel Advantage',
        description: `Using ${channelCount} channels increases reach by ~45%. Expect better overall conversion.`,
        type: 'positive'
      });
    }
    
    if (selectedChannels.includes('linkedin') && selectedChannels.includes('email')) {
      insights.push({
        icon: ArrowUp,
        title: 'Optimal Combo Detected',
        description: 'LinkedIn + Email combo shows 67% higher conversion. Sophia recommends leading with connection request.',
        type: 'positive'
      });
    }
    
    if (contactCount > 1000) {
      insights.push({
        icon: Eye,
        title: 'High Volume Detected',
        description: `${contactCount}+ contacts: Sophia recommends A/B testing subject lines and personalization.',`,
        type: 'positive'
      });
    }
    
    if (contactCount < 50 && hasGoal) {
      insights.push({
        icon: Users,
        title: 'Expand Your Reach',
        description: 'Import more contacts to maximize campaign effectiveness. Target at least 200+ for statistical significance.',
        type: 'neutral'
      });
    }
    
    if (selectedChannels.length === 0 && hasGoal) {
      insights.push({
        icon: MessageSquare,
        title: 'Ready for Channels',
        description: 'Select 2-4 channels for best results. Sophia recommends Email + LinkedIn for B2B.',
        type: 'neutral'
      });
    }
    
    return insights;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Campaign Builder & Automation</h2>
          <p className="text-muted-foreground">
            Build AI-powered campaigns and manage automation workflows
          </p>
        </div>
        <Sparkles className="h-8 w-8 text-purple-500" />
      </div>

      <Tabs defaultValue="builder" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="builder" className="gap-2" data-testid="tab-campaign-builder">
            <Sparkles className="h-4 w-4" />
            Campaign Builder
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2" data-testid="tab-automation">
            <Bot className="h-4 w-4" />
            Automation Hub
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6 mt-6"  data-testid="content-campaign-builder">

      <Card className="border-purple-200 dark:border-purple-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            AI-Powered Campaign Creation
          </CardTitle>
          <CardDescription>
            Tell me what you want to achieve and I'll build the entire campaign for you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Campaign Name */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                data-testid="input-campaign-name"
                placeholder="e.g., Q1 Lead Generation Campaign"
                value={campaign.name}
                onChange={(e) => setCampaign(prev => ({ ...prev, name: e.target.value }))}
                disabled={campaign.status === 'generating' || campaign.status === 'active'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="step-count">Number of Steps</Label>
              <Select
                value={numberOfSteps.toString()}
                onValueChange={(value) => setNumberOfSteps(parseInt(value))}
                disabled={campaign.status === 'generating' || campaign.status === 'active'}
              >
                <SelectTrigger id="step-count" data-testid="select-step-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Steps</SelectItem>
                  <SelectItem value="4">4 Steps</SelectItem>
                  <SelectItem value="5">5 Steps (Recommended)</SelectItem>
                  <SelectItem value="6">6 Steps</SelectItem>
                  <SelectItem value="7">7 Steps</SelectItem>
                  <SelectItem value="8">8 Steps</SelectItem>
                  <SelectItem value="9">9 Steps</SelectItem>
                  <SelectItem value="10">10 Steps</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact Import Section */}
          <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">Campaign Contacts</h4>
              <p className="text-xs text-muted-foreground">
                {contacts.length > 0 
                  ? `${contacts.length} contact${contacts.length > 1 ? 's' : ''} available in CRM`
                  : 'No contacts available - import contacts to start your campaign'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              data-testid="button-import-contacts-campaign"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Contacts
            </Button>
          </div>

          {/* Brand Voice Configuration */}
          <div className="space-y-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white dark:bg-gray-900 rounded-full">
                <Mic2 className="h-5 w-5 text-purple-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-sm">Brand Voice</h4>
                <p className="text-xs text-muted-foreground">
                  Select a saved brand voice or create custom messaging style
                </p>
              </div>
            </div>

            {/* Brand Voice Selection Dropdown */}
            <div className="space-y-2">
              <Label htmlFor="brand-voice-select">
                {savedBrandVoices.length > 0 ? 'Select Brand Voice' : 'No saved brand voices yet'}
              </Label>
              <Select
                value={selectedBrandVoiceId}
                onValueChange={handleBrandVoiceSelect}
              >
                <SelectTrigger id="brand-voice-select" data-testid="select-brand-voice">
                  <SelectValue placeholder={savedBrandVoices.length > 0 ? "Choose a brand voice..." : "Create custom voice below"} />
                </SelectTrigger>
                <SelectContent>
                  {savedBrandVoices.length > 0 && (
                    <>
                      {savedBrandVoices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{voice.name}</span>
                            <span className="text-xs text-muted-foreground">({voice.tone})</span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-3 w-3" />
                          <span>Create Custom Voice</span>
                        </div>
                      </SelectItem>
                    </>
                  )}
                  {savedBrandVoices.length === 0 && (
                    <SelectItem value="custom">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3" />
                        <span>Create Custom Voice</span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {selectedBrandVoiceId && selectedBrandVoiceId !== 'custom' && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 dark:bg-green-950 rounded text-sm text-green-700 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Using: <strong>{savedBrandVoices.find(v => v.id === selectedBrandVoiceId)?.name}</strong> brand voice</span>
                </div>
              )}
            </div>
          </div>

          {/* Custom Brand Voice Configuration (collapsible) */}
          <Collapsible open={isBrandVoiceOpen} onOpenChange={setIsBrandVoiceOpen}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-sm transition-all">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {selectedBrandVoiceId && selectedBrandVoiceId !== 'custom' 
                      ? 'View/Edit Brand Voice Details'
                      : 'Configure Custom Brand Voice'}
                  </span>
                </div>
                {isBrandVoiceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-4 p-4 border rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Company Name */}
                <div className="space-y-2">
                  <Label htmlFor="brand-company-name">Company Name</Label>
                  <Input
                    id="brand-company-name"
                    placeholder="e.g., Acme Corp"
                    value={brandVoice.companyName || ''}
                    onChange={(e) => setBrandVoice(prev => ({ ...prev, companyName: e.target.value }))}
                    data-testid="input-brand-company-name"
                  />
                </div>

                {/* Industry */}
                <div className="space-y-2">
                  <Label htmlFor="brand-industry">Industry</Label>
                  <Input
                    id="brand-industry"
                    placeholder="e.g., SaaS, Healthcare, Finance"
                    value={brandVoice.industry || ''}
                    onChange={(e) => setBrandVoice(prev => ({ ...prev, industry: e.target.value }))}
                    data-testid="input-brand-industry"
                  />
                </div>
              </div>

              {/* Tone Selection */}
              <div className="space-y-2">
                <Label htmlFor="brand-tone">Brand Tone</Label>
                <Select
                  value={brandVoice.tone}
                  onValueChange={(value) => setBrandVoice(prev => ({ ...prev, tone: value }))}
                >
                  <SelectTrigger id="brand-tone" data-testid="select-brand-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional & Formal</SelectItem>
                    <SelectItem value="friendly">Friendly & Approachable</SelectItem>
                    <SelectItem value="casual">Casual & Conversational</SelectItem>
                    <SelectItem value="authoritative">Authoritative & Expert</SelectItem>
                    <SelectItem value="enthusiastic">Enthusiastic & Energetic</SelectItem>
                    <SelectItem value="empathetic">Empathetic & Understanding</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Writing Style */}
              <div className="space-y-2">
                <Label htmlFor="brand-writing-style">Writing Style (Optional)</Label>
                <Textarea
                  id="brand-writing-style"
                  placeholder="e.g., Use short sentences, avoid jargon, write in active voice, keep it concise..."
                  value={brandVoice.writingStyle || ''}
                  onChange={(e) => setBrandVoice(prev => ({ ...prev, writingStyle: e.target.value }))}
                  rows={2}
                  data-testid="textarea-brand-writing-style"
                />
              </div>

              {/* Brand Values */}
              <div className="space-y-2">
                <Label>Brand Values</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a brand value (e.g., Innovation, Trust)"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newValue.trim()) {
                        setBrandVoice(prev => ({ ...prev, values: [...(prev.values || []), newValue.trim()] }));
                        setNewValue('');
                      }
                    }}
                    data-testid="input-brand-value"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (newValue.trim()) {
                        setBrandVoice(prev => ({ ...prev, values: [...(prev.values || []), newValue.trim()] }));
                        setNewValue('');
                      }
                    }}
                    data-testid="button-add-value"
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandVoice.values?.map((value, index) => (
                    <Badge key={index} variant="secondary" className="gap-1">
                      {value}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setBrandVoice(prev => ({ ...prev, values: prev.values?.filter((_, i) => i !== index) }))}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Words to Avoid */}
              <div className="space-y-2">
                <Label>Words to Avoid</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add words to avoid (e.g., cheap, discount)"
                    value={newAvoidWord}
                    onChange={(e) => setNewAvoidWord(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newAvoidWord.trim()) {
                        setBrandVoice(prev => ({ ...prev, avoidWords: [...(prev.avoidWords || []), newAvoidWord.trim()] }));
                        setNewAvoidWord('');
                      }
                    }}
                    data-testid="input-avoid-word"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (newAvoidWord.trim()) {
                        setBrandVoice(prev => ({ ...prev, avoidWords: [...(prev.avoidWords || []), newAvoidWord.trim()] }));
                        setNewAvoidWord('');
                      }
                    }}
                    data-testid="button-add-avoid-word"
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandVoice.avoidWords?.map((word, index) => (
                    <Badge key={index} variant="destructive" className="gap-1">
                      {word}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setBrandVoice(prev => ({ ...prev, avoidWords: prev.avoidWords?.filter((_, i) => i !== index) }))}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Key Messages */}
              <div className="space-y-2">
                <Label>Key Messages to Emphasize</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add key messages (e.g., We save you time)"
                    value={newKeyMessage}
                    onChange={(e) => setNewKeyMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newKeyMessage.trim()) {
                        setBrandVoice(prev => ({ ...prev, keyMessages: [...(prev.keyMessages || []), newKeyMessage.trim()] }));
                        setNewKeyMessage('');
                      }
                    }}
                    data-testid="input-key-message"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (newKeyMessage.trim()) {
                        setBrandVoice(prev => ({ ...prev, keyMessages: [...(prev.keyMessages || []), newKeyMessage.trim()] }));
                        setNewKeyMessage('');
                      }
                    }}
                    data-testid="button-add-key-message"
                  >
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brandVoice.keyMessages?.map((message, index) => (
                    <Badge key={index} variant="outline" className="gap-1">
                      {message}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => setBrandVoice(prev => ({ ...prev, keyMessages: prev.keyMessages?.filter((_, i) => i !== index) }))}
                      />
                    </Badge>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Channel Selection */}
          <div className="space-y-4">
            <div>
              <Label className="text-base">Select Campaign Channels</Label>
              <p className="text-sm text-muted-foreground mt-1">
                Choose which channels AI should use for this campaign
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {availableChannels.map((channel) => {
                const Icon = channel.icon;
                const isSelected = selectedChannels.includes(channel.id);
                
                return (
                  <div
                    key={channel.id}
                    onClick={() => campaign.status === 'draft' && toggleChannel(channel.id)}
                    className={`
                      relative cursor-pointer p-4 rounded-xl border-2 transition-all duration-200
                      ${isSelected 
                        ? 'border-primary bg-primary/10 shadow-md scale-105' 
                        : 'border-gray-200 dark:border-gray-800 hover:border-primary/50 hover:shadow-sm'
                      }
                      ${campaign.status !== 'draft' ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
                    `}
                    data-testid={`channel-${channel.id}`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-3">
                      <div className={`p-2.5 rounded-lg transition-colors ${isSelected ? channel.bgColor : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <Icon className={`h-5 w-5 ${isSelected ? channel.color : 'text-gray-400'}`} />
                      </div>
                      <span className={`text-xs font-medium text-center leading-tight ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                        {channel.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedChannels.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="gap-1">
                  <Zap className="h-3 w-3" />
                  {selectedChannels.length} channel{selectedChannels.length > 1 ? 's' : ''} selected
                </Badge>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaign-prompt">What's your campaign goal?</Label>
            <Textarea
              id="campaign-prompt"
              data-testid="input-campaign-goal"
              placeholder="Example: I want to generate qualified leads for our SaaS product targeting marketing directors at mid-size companies. Focus on how we help reduce manual work with AI automation."
              value={campaignPrompt}
              onChange={(e) => setCampaignPrompt(e.target.value)}
              rows={4}
              disabled={campaign.status === 'generating' || campaign.status === 'active'}
            />
          </div>

          {/* AI Campaign Intelligence Panel */}
          {(selectedChannels.length > 0 || contacts.length > 0 || campaignPrompt.length > 0) && (
            <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <CardTitle className="text-base">Sophia's Campaign Intelligence</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {generateCampaignInsights().length > 0 ? (
                  generateCampaignInsights().map((insight, idx) => {
                    const InsightIcon = insight.icon;
                    const isPositive = insight.type === 'positive';
                    const bgClass = isPositive 
                      ? 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700' 
                      : 'bg-amber-100 dark:bg-amber-900 border-amber-300 dark:border-amber-700';
                    
                    return (
                      <div key={idx} className={`p-3 rounded-lg border ${bgClass} flex gap-3`}>
                        <InsightIcon className={`h-5 w-5 flex-shrink-0 ${isPositive ? 'text-green-600' : 'text-amber-600'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{insight.title}</p>
                          <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{insight.description}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4" />
                    Configure channels and contacts to see AI recommendations
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            {campaign.status === 'draft' && (
              <Button 
                onClick={generateCampaignWithAI} 
                disabled={isGenerating || !campaignPrompt.trim()}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                data-testid="button-generate-campaign"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Generate Campaign with AI'}
              </Button>
            )}
            
            {campaign.status === 'ready' && (
              <>
                <Button 
                  onClick={launchCampaign}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-launch-campaign"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Launch Campaign
                </Button>
                <Button 
                  onClick={() => setCampaign({ name: '', goal: '', targetAudience: '', steps: [], status: 'draft', selectedContacts: [] })}
                  variant="outline"
                  data-testid="button-reset-campaign"
                >
                  Start Over
                </Button>
              </>
            )}
            
            {campaign.status === 'active' && (
              <Button 
                onClick={pauseCampaign}
                variant="destructive"
                data-testid="button-pause-campaign"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause Campaign
              </Button>
            )}
          </div>

          {campaign.status === 'generating' && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign Version Selection */}
      {(campaign.status === 'ready' || campaign.status === 'active' || campaign.status === 'paused') && campaignVersions.length > 0 && (
        <Card className="border-purple-200 dark:border-purple-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Generated 3 Campaign Versions - Select One
            </CardTitle>
            <CardDescription>
              AI created 3 different approaches and ranked them. Choose the best one for your needs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {campaignVersions.map((version, index) => {
                const isSelected = index === selectedVersionIndex;
                const scoreColor = version.score >= 85 ? 'text-green-600' : version.score >= 70 ? 'text-blue-600' : 'text-orange-600';
                const bgColor = version.score >= 85 ? 'bg-green-50 dark:bg-green-950' : version.score >= 70 ? 'bg-blue-50 dark:bg-blue-950' : 'bg-orange-50 dark:bg-orange-950';
                
                return (
                  <div
                    key={index}
                    onClick={() => campaign.status === 'ready' && selectVersion(index)}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all cursor-pointer
                      ${isSelected 
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950 shadow-lg scale-105' 
                        : 'border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700'
                      }
                      ${campaign.status !== 'ready' ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    data-testid={`version-card-${index}`}
                  >
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 bg-purple-500 text-white rounded-full p-1">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                    
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-sm">{version.name}</h4>
                        <div className={`px-2 py-1 rounded ${bgColor}`}>
                          <span className={`text-xs font-bold ${scoreColor}`}>{version.score}/100</span>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {version.strategy}
                      </p>
                      
                      <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">AI Reasoning:</p>
                        <p className="text-xs italic line-clamp-2">{version.reasoning}</p>
                      </div>
                      
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {version.steps.length} touchpoints
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {(campaign.status === 'ready' || campaign.status === 'active' || campaign.status === 'paused') && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Campaign Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">Goal</Label>
                <p className="mt-1 font-medium">{campaign.goal}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Contacts</p>
                    <p className="text-2xl font-bold">{campaign.selectedContacts.length}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <MessageSquare className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Touchpoints</p>
                    <p className="text-2xl font-bold">{campaign.steps.length}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge className={
                      campaign.status === 'active' ? 'bg-green-600' :
                      campaign.status === 'paused' ? 'bg-yellow-600' :
                      'bg-blue-600'
                    }>
                      {campaign.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Campaign Sequence</CardTitle>
                  <CardDescription>
                    Click on any step to edit it, or use the controls to reorder
                  </CardDescription>
                </div>
                <Button 
                  onClick={addNewStep} 
                  variant="outline" 
                  size="sm"
                  disabled={campaign.status === 'active'}
                  data-testid="button-add-step"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaign.steps.map((step, index) => (
                  <div 
                    key={index} 
                    className="flex gap-4 p-4 border rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition-colors group"
                    data-testid={`campaign-step-${index}`}
                  >
                    {/* Reorder Controls */}
                    <div className="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveStepUp(index)}
                        disabled={index === 0 || campaign.status === 'active'}
                        data-testid={`button-move-up-${index}`}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => moveStepDown(index)}
                        disabled={index === campaign.steps.length - 1 || campaign.status === 'active'}
                        data-testid={`button-move-down-${index}`}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                        {step.channel === 'email' && <Mail className="h-5 w-5 text-purple-600" />}
                        {step.channel === 'linkedin' && <Linkedin className="h-5 w-5 text-blue-600" />}
                        {step.channel === 'sms' && <MessageSquare className="h-5 w-5 text-green-600" />}
                        {step.channel === 'phone' && <Phone className="h-5 w-5 text-orange-600" />}
                        {step.channel === 'social' && <Share2 className="h-5 w-5 text-pink-600" />}
                        {step.channel === 'voicemail' && <Bot className="h-5 w-5 text-cyan-600" />}
                      </div>
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold capitalize">{step.channel} - Step {index + 1}</h4>
                          {step.generated && (
                            <Badge variant="outline" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {step.delay === 0 ? 'Day 0' : `Day ${step.delay}`}
                          </div>
                          {campaign.status !== 'active' && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openStepEditor(index)}
                                data-testid={`button-edit-step-${index}`}
                              >
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                                onClick={() => deleteStep(index)}
                                data-testid={`button-delete-step-${index}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {step.subject && (
                        <p className="text-sm font-medium text-muted-foreground">
                          Subject: {step.subject}
                        </p>
                      )}
                      
                      <div 
                        className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-sm whitespace-pre-wrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => campaign.status !== 'active' && openStepEditor(index)}
                      >
                        {step.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {campaign.status === 'active' && (
        <Card className="border-green-200 dark:border-green-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Campaign Active
            </CardTitle>
            <CardDescription>
              AI is automatically managing outreach across all channels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">LinkedIn Messages Sent</span>
                <span className="font-bold">{campaign.selectedContacts.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Emails Scheduled</span>
                <span className="font-bold">{campaign.selectedContacts.length * 2}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Follow-ups Queued</span>
                <span className="font-bold">{campaign.selectedContacts.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="automation" className="mt-6" data-testid="content-automation">
          <AutomationHub />
        </TabsContent>
      </Tabs>

      {/* Contact Import Modal */}
      <ContactImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />

      {/* Step Editor Dialog */}
      <Dialog open={editingStepIndex !== null} onOpenChange={(open) => !open && setEditingStepIndex(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Edit Step {editingStepIndex !== null ? editingStepIndex + 1 : ''}
            </DialogTitle>
          </DialogHeader>
          
          {editingStep && (
            <div className="space-y-4">
              {/* Channel Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-channel">Channel</Label>
                  <Select
                    value={editingStep.channel}
                    onValueChange={(value: ChannelType) => setEditingStep({ ...editingStep, channel: value })}
                  >
                    <SelectTrigger id="edit-channel" data-testid="select-edit-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-purple-600" />
                          Email
                        </div>
                      </SelectItem>
                      <SelectItem value="linkedin">
                        <div className="flex items-center gap-2">
                          <Linkedin className="h-4 w-4 text-blue-600" />
                          LinkedIn
                        </div>
                      </SelectItem>
                      <SelectItem value="sms">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          SMS
                        </div>
                      </SelectItem>
                      <SelectItem value="phone">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-orange-600" />
                          Phone
                        </div>
                      </SelectItem>
                      <SelectItem value="voicemail">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-cyan-600" />
                          Voicemail
                        </div>
                      </SelectItem>
                      <SelectItem value="social">
                        <div className="flex items-center gap-2">
                          <Share2 className="h-4 w-4 text-pink-600" />
                          Social
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-delay">Delay (Days)</Label>
                  <Select
                    value={editingStep.delay.toString()}
                    onValueChange={(value) => setEditingStep({ ...editingStep, delay: parseInt(value) })}
                  >
                    <SelectTrigger id="edit-delay" data-testid="select-edit-delay">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Day 0 (Immediate)</SelectItem>
                      <SelectItem value="1">Day 1</SelectItem>
                      <SelectItem value="2">Day 2</SelectItem>
                      <SelectItem value="3">Day 3</SelectItem>
                      <SelectItem value="4">Day 4</SelectItem>
                      <SelectItem value="5">Day 5</SelectItem>
                      <SelectItem value="7">Day 7</SelectItem>
                      <SelectItem value="10">Day 10</SelectItem>
                      <SelectItem value="14">Day 14</SelectItem>
                      <SelectItem value="21">Day 21</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subject (for email/linkedin) */}
              {(editingStep.channel === 'email' || editingStep.channel === 'linkedin' || editingStep.channel === 'phone' || editingStep.channel === 'social') && (
                <div className="space-y-2">
                  <Label htmlFor="edit-subject">Subject / Title</Label>
                  <Input
                    id="edit-subject"
                    data-testid="input-edit-subject"
                    placeholder="Enter subject line..."
                    value={editingStep.subject || ''}
                    onChange={(e) => setEditingStep({ ...editingStep, subject: e.target.value })}
                  />
                </div>
              )}

              {/* Message Content */}
              <div className="space-y-2">
                <Label htmlFor="edit-content">Message Content</Label>
                <Textarea
                  id="edit-content"
                  data-testid="input-edit-content"
                  placeholder="Enter your message..."
                  value={editingStep.content}
                  onChange={(e) => setEditingStep({ ...editingStep, content: e.target.value })}
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Available variables: {'{{first_name}}'}, {'{{last_name}}'}, {'{{company}}'}, {'{{sender_name}}'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStepIndex(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button onClick={saveStepEdit} data-testid="button-save-edit">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
