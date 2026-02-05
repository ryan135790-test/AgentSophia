import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface BranchCondition {
  condition: 'if_opened' | 'if_clicked' | 'if_replied' | 'if_connected' | 'if_no_response' | 'if_opened_not_replied' | 'if_meeting_booked';
  action: 'proceed_to_next' | 'skip_to_step' | 'try_different_channel' | 'move_to_pipeline' | 'end_sequence';
  targetStepId?: string;
  nextChannel?: string;
  waitDays?: number;
  pipelineStage?: string;
}

export interface ContentVariation {
  id: string;
  version: 'A' | 'B' | 'C';
  subject?: string;
  content: string;
  score: number;
  isRecommended: boolean;
  reasoning?: string;
}

export interface LinkedInSearchCriteria {
  keywords?: string;
  jobTitles?: string[];
  locations?: string[];
  industries?: string[];
  maxResults?: number;
  frequency?: 'daily' | 'weekly' | 'once';
}

export interface CampaignStep {
  id: string;
  channel: 'email' | 'linkedin' | 'linkedin_connect' | 'linkedin_search' | 'sms' | 'phone' | 'voicemail' | 'condition' | 'delay';
  label: string;
  subject?: string;
  content: string;
  connectionNote?: string;
  delay: number;
  delayUnit: 'hours' | 'days';
  order: number;
  branches?: BranchCondition[];
  variations?: ContentVariation[];
  selectedVariationId?: string;
  conditionType?: 'if_opened' | 'if_clicked' | 'if_replied' | 'if_connected' | 'if_no_response' | 'if_meeting_booked';
  yesTargetStepId?: string;
  noTargetStepId?: string;
  searchCriteria?: LinkedInSearchCriteria;
  sophiaRecommendation?: {
    suggestedPath: 'yes' | 'no';
    confidence: number;
    reasoning: string;
  };
}

export interface ConditionalLogic {
  description: string;
}

export interface BrandVoice {
  id: string;
  name: string;
  companyName: string;
  industry: string;
  tone: 'professional' | 'friendly' | 'casual' | 'formal' | 'playful' | 'authoritative';
  values?: string[];
  writingStyle?: string;
  avoidWords?: string[];
  keyMessages?: string[];
}

export interface CampaignDraft {
  id: string;
  name: string;
  goal: string;
  audience: string;
  channels: string[];
  stepCount: number;
  steps: CampaignStep[];
  status: 'idle' | 'drafting' | 'previewing' | 'saved';
  createdAt: Date;
  presetUsed?: string;
  brandVoiceId?: string;
  brandVoice?: BrandVoice;
  conditionalLogic?: ConditionalLogic;
  isGenerating?: boolean;
  generationError?: string;
  selectedContactIds?: string[];
}

const DEFAULT_DRAFT: CampaignDraft = {
  id: '',
  name: '',
  goal: '',
  audience: '',
  channels: [],
  stepCount: 5,
  steps: [],
  status: 'idle',
  createdAt: new Date(),
};

interface CampaignDraftContextValue {
  draft: CampaignDraft;
  setDraft: (draft: CampaignDraft) => void;
  updateDraft: (updates: Partial<CampaignDraft>) => void;
  resetDraft: () => void;
  
  addStep: (step: Omit<CampaignStep, 'id' | 'order'>) => void;
  updateStep: (stepId: string, updates: Partial<CampaignStep>) => void;
  removeStep: (stepId: string) => void;
  duplicateStep: (stepId: string) => void;
  reorderSteps: (fromIndex: number, toIndex: number) => void;
  selectVariation: (stepId: string, variationId: string) => void;
  
  applyPreset: (presetId: string, goal?: string, audience?: string, brandVoice?: BrandVoice) => void;
  generateStepsFromChannels: (channels: string[], count: number, goal?: string) => void;
  generateWithAI: (channels: string[], stepCount: number, goal?: string, audience?: string, brandVoice?: BrandVoice) => Promise<void>;
  
  setSelectedContacts: (contactIds: string[]) => void;
  addSelectedContacts: (contactIds: string[]) => void;
  removeSelectedContacts: (contactIds: string[]) => void;
  
  hasDraft: boolean;
  isGenerating: boolean;
}

const CampaignDraftContext = createContext<CampaignDraftContextValue | null>(null);

const STEP_LABELS = [
  'Initial Outreach',
  'Follow-Up',
  'Value Add',
  'Gentle Reminder',
  'Final Touch',
  'Re-engagement',
  'Check-in',
  'Last Attempt',
  'Bonus Touch',
  'Final Offer'
];

export const CAMPAIGN_PRESETS = [
  {
    id: 'linkedin-connect',
    name: 'LinkedIn Connect',
    description: 'Simple connection request with optional note',
    channels: ['linkedin_connect'],
    stepCount: 1,
    badge: 'Quick',
    icon: 'user-plus',
  },
  {
    id: 'email-linkedin',
    name: 'Email + LinkedIn',
    description: 'Most popular combo for B2B outreach',
    channels: ['email', 'linkedin'],
    stepCount: 5,
    badge: 'Popular',
    icon: 'mail',
  },
  {
    id: 'cold-outreach',
    name: 'Cold Outreach',
    description: 'Proven sequence for new prospects',
    channels: ['email', 'linkedin', 'email'],
    stepCount: 6,
    badge: 'High Convert',
    icon: 'zap',
  },
  {
    id: 're-engagement',
    name: 'Re-engagement',
    description: 'Win back dormant leads',
    channels: ['email', 'sms', 'email'],
    stepCount: 4,
    badge: 'Win Back',
    icon: 'refresh',
  },
  {
    id: 'multi-channel',
    name: 'Multi-Channel Blitz',
    description: 'All channels for maximum reach',
    channels: ['email', 'linkedin', 'sms', 'phone'],
    stepCount: 7,
    badge: 'Max Reach',
    icon: 'layers',
  },
];

export function CampaignDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraftState] = useState<CampaignDraft>({ ...DEFAULT_DRAFT, id: `draft_${Date.now()}` });

  const setDraft = useCallback((newDraft: CampaignDraft) => {
    setDraftState(newDraft);
  }, []);

  const updateDraft = useCallback((updates: Partial<CampaignDraft>) => {
    setDraftState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraftState({ ...DEFAULT_DRAFT, id: `draft_${Date.now()}` });
  }, []);

  const generateStepsFromChannels = useCallback((channels: string[], count: number, goal?: string) => {
    const steps: CampaignStep[] = [];
    
    // Special handling for LinkedIn Connect campaigns - simple 1-step with connection note
    if (channels.length === 1 && channels[0] === 'linkedin_connect') {
      steps.push({
        id: `step_${Date.now()}_0`,
        channel: 'linkedin_connect',
        label: 'Connection Request',
        content: '',
        connectionNote: `Hi {{firstName}}, I'd love to connect with you.`,
        delay: 0,
        delayUnit: 'days',
        order: 0,
      });
      
      setDraftState(prev => ({
        ...prev,
        name: prev.name || 'LinkedIn Connect Campaign',
        channels,
        stepCount: 1,
        steps,
        status: 'previewing',
      }));
      
      console.log('[CampaignDraft] Generated LinkedIn Connect campaign (1 step)');
      return;
    }
    
    for (let i = 0; i < count; i++) {
      const channelIndex = i % channels.length;
      const channel = channels[channelIndex] as CampaignStep['channel'];
      const label = STEP_LABELS[i] || `Step ${i + 1}`;
      
      steps.push({
        id: `step_${Date.now()}_${i}`,
        channel,
        label: `${label}`,
        subject: channel === 'email' ? `${label} - ${goal || 'Your Campaign'}` : undefined,
        content: `Hi [NAME],\n\nThis is your ${label.toLowerCase()} message via ${channel}.\n\n${goal ? `Regarding: ${goal}` : ''}\n\nBest regards`,
        delay: i === 0 ? 0 : 2,
        delayUnit: 'days',
        order: i,
      });
    }
    
    setDraftState(prev => ({
      ...prev,
      channels,
      stepCount: count,
      steps,
      status: 'previewing',
    }));
    
    console.log('[CampaignDraft] Generated', steps.length, 'steps from channels:', channels);
  }, []);

  const addStep = useCallback((step: Omit<CampaignStep, 'id' | 'order'>) => {
    setDraftState(prev => {
      const newStep: CampaignStep = {
        ...step,
        id: `step_${Date.now()}`,
        order: prev.steps.length,
      };
      return {
        ...prev,
        steps: [...prev.steps, newStep],
        stepCount: prev.steps.length + 1,
      };
    });
  }, []);

  const updateStep = useCallback((stepId: string, updates: Partial<CampaignStep>) => {
    setDraftState(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
    }));
  }, []);

  const removeStep = useCallback((stepId: string) => {
    setDraftState(prev => {
      const newSteps = prev.steps.filter(s => s.id !== stepId).map((s, i) => ({ ...s, order: i }));
      return {
        ...prev,
        steps: newSteps,
        stepCount: newSteps.length,
      };
    });
  }, []);

  const duplicateStep = useCallback((stepId: string) => {
    setDraftState(prev => {
      const stepIndex = prev.steps.findIndex(s => s.id === stepId);
      if (stepIndex === -1) return prev;
      
      const stepToDuplicate = prev.steps[stepIndex];
      const newStep: CampaignStep = {
        ...stepToDuplicate,
        id: `step_${Date.now()}`,
        label: `${stepToDuplicate.label} (Copy)`,
        order: stepIndex + 1,
      };
      
      const newSteps = [
        ...prev.steps.slice(0, stepIndex + 1),
        newStep,
        ...prev.steps.slice(stepIndex + 1),
      ].map((s, i) => ({ ...s, order: i }));
      
      return {
        ...prev,
        steps: newSteps,
        stepCount: newSteps.length,
      };
    });
  }, []);

  const reorderSteps = useCallback((fromIndex: number, toIndex: number) => {
    setDraftState(prev => {
      const newSteps = [...prev.steps];
      const [removed] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, removed);
      return {
        ...prev,
        steps: newSteps.map((s, i) => ({ ...s, order: i })),
      };
    });
  }, []);

  const selectVariation = useCallback((stepId: string, variationId: string) => {
    setDraftState(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        if (step.id !== stepId) return step;
        const variation = step.variations?.find(v => v.id === variationId);
        if (!variation) return step;
        return {
          ...step,
          selectedVariationId: variationId,
          content: variation.content,
          subject: variation.subject || step.subject,
        };
      }),
    }));
  }, []);

  const generateWithAI = useCallback(async (channels: string[], stepCount: number, goal?: string, audience?: string, brandVoice?: BrandVoice) => {
    setDraftState(prev => ({ ...prev, isGenerating: true, generationError: undefined, brandVoice, brandVoiceId: brandVoice?.id }));
    
    try {
      const brandVoiceContext = brandVoice ? 
        `Company: ${brandVoice.companyName}, Industry: ${brandVoice.industry}, Tone: ${brandVoice.tone}${brandVoice.values?.length ? `, Values: ${brandVoice.values.join(', ')}` : ''}${brandVoice.writingStyle ? `, Style: ${brandVoice.writingStyle}` : ''}` 
        : undefined;
      
      const response = await fetch('/api/ai/generate-campaign-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channels, stepCount, goal, audience, brandVoice: brandVoiceContext }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate campaign content');
      }

      const data = await response.json();
      
      if (data.success && data.steps) {
        setDraftState(prev => ({
          ...prev,
          name: data.campaignName || prev.name,
          steps: data.steps.map((step: CampaignStep, index: number) => ({
            ...step,
            id: step.id || `step_${Date.now()}_${index}`,
            order: index,
          })),
          stepCount: data.steps.length,
          conditionalLogic: data.conditionalLogic,
          status: 'previewing',
          isGenerating: false,
        }));
        console.log('[CampaignDraft] AI generated', data.steps.length, 'steps with content');
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (error: any) {
      console.error('[CampaignDraft] AI generation error:', error);
      setDraftState(prev => ({
        ...prev,
        isGenerating: false,
        generationError: error.message,
      }));
      generateStepsFromChannels(channels, stepCount, goal);
    }
  }, [generateStepsFromChannels]);

  const applyPreset = useCallback((presetId: string, goal?: string, audience?: string, brandVoice?: BrandVoice) => {
    const preset = CAMPAIGN_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    
    const newDraft: CampaignDraft = {
      id: `draft_${Date.now()}`,
      name: '',
      goal: goal || '',
      audience: audience || '',
      channels: preset.channels,
      stepCount: preset.stepCount,
      steps: [],
      status: 'drafting',
      createdAt: new Date(),
      presetUsed: presetId,
      brandVoiceId: brandVoice?.id,
      brandVoice: brandVoice,
      isGenerating: true,
    };
    
    setDraftState(newDraft);
    
    generateWithAI(preset.channels, preset.stepCount, goal, audience, brandVoice);
    
    console.log('[CampaignDraft] Applied preset with AI:', presetId, 'Brand voice:', brandVoice?.name);
  }, [generateWithAI]);

  const setSelectedContacts = useCallback((contactIds: string[]) => {
    setDraftState(prev => ({ ...prev, selectedContactIds: contactIds }));
  }, []);

  const addSelectedContacts = useCallback((contactIds: string[]) => {
    setDraftState(prev => {
      const existing = prev.selectedContactIds || [];
      const newIds = contactIds.filter(id => !existing.includes(id));
      return { ...prev, selectedContactIds: [...existing, ...newIds] };
    });
  }, []);

  const removeSelectedContacts = useCallback((contactIds: string[]) => {
    setDraftState(prev => ({
      ...prev,
      selectedContactIds: (prev.selectedContactIds || []).filter(id => !contactIds.includes(id)),
    }));
  }, []);

  const hasDraft = draft.status !== 'idle' && (draft.steps.length > 0 || draft.goal.length > 0 || draft.isGenerating);
  const isGenerating = draft.isGenerating || false;

  return (
    <CampaignDraftContext.Provider value={{
      draft,
      setDraft,
      updateDraft,
      resetDraft,
      addStep,
      updateStep,
      removeStep,
      duplicateStep,
      reorderSteps,
      selectVariation,
      applyPreset,
      generateStepsFromChannels,
      generateWithAI,
      setSelectedContacts,
      addSelectedContacts,
      removeSelectedContacts,
      hasDraft,
      isGenerating,
    }}>
      {children}
    </CampaignDraftContext.Provider>
  );
}

export function useCampaignDraft() {
  const context = useContext(CampaignDraftContext);
  if (!context) {
    throw new Error('useCampaignDraft must be used within a CampaignDraftProvider');
  }
  return context;
}
