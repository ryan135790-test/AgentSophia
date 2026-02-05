import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  Mail, Linkedin, MessageSquare, Phone, Zap, RefreshCw, Layers, 
  Sparkles, ArrowRight, Clock, Loader2, Building2
} from 'lucide-react';
import { useCampaignDraft, CAMPAIGN_PRESETS, BrandVoice } from '@/contexts/CampaignDraftContext';
import { supabase } from '@/integrations/supabase/client';

interface CampaignQuickStartProps {
  onPresetSelect?: (presetId: string) => void;
  compact?: boolean;
}

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  sms: MessageSquare,
  phone: Phone,
};

const PRESET_ICONS: Record<string, any> = {
  mail: Mail,
  zap: Zap,
  refresh: RefreshCw,
  layers: Layers,
};

export function CampaignQuickStart({ onPresetSelect, compact = false }: CampaignQuickStartProps) {
  const { applyPreset, draft, isGenerating } = useCampaignDraft();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [offer, setOffer] = useState('');
  const [audience, setAudience] = useState('');
  const [selectedBrandVoiceId, setSelectedBrandVoiceId] = useState<string>('');

  const { data: brandVoicesData } = useQuery<{ brand_voices: BrandVoice[] }>({
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

  const brandVoices = brandVoicesData?.brand_voices || [];

  const handlePresetClick = (presetId: string) => {
    setSelectedPreset(presetId);
    setOffer('');
    setAudience('');
    setSelectedBrandVoiceId(brandVoices.length === 1 ? brandVoices[0].id : '');
    setShowModal(true);
  };

  const handleGenerateCampaign = async () => {
    if (!selectedPreset || !offer.trim()) return;
    
    const selectedVoice = brandVoices.find(v => v.id === selectedBrandVoiceId);
    
    await applyPreset(selectedPreset, offer.trim(), audience.trim(), selectedVoice);
    
    setShowModal(false);
    onPresetSelect?.(selectedPreset);
    setSelectedPreset(null);
    setOffer('');
    setAudience('');
    setSelectedBrandVoiceId('');
  };

  const selectedPresetData = CAMPAIGN_PRESETS.find(p => p.id === selectedPreset);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {CAMPAIGN_PRESETS.map(preset => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => handlePresetClick(preset.id)}
            className="text-xs"
            data-testid={`btn-preset-${preset.id}`}
          >
            {preset.name}
          </Button>
        ))}
        
        <CampaignInfoModal
          open={showModal}
          onOpenChange={setShowModal}
          presetName={selectedPresetData?.name || ''}
          offer={offer}
          setOffer={setOffer}
          audience={audience}
          setAudience={setAudience}
          brandVoices={brandVoices}
          selectedBrandVoiceId={selectedBrandVoiceId}
          setSelectedBrandVoiceId={setSelectedBrandVoiceId}
          onGenerate={handleGenerateCampaign}
          isGenerating={isGenerating}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        <Sparkles className="w-4 h-4 text-purple-500" />
        <span>Quick Start - Choose a template or describe what you need</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CAMPAIGN_PRESETS.map(preset => {
          const PresetIcon = PRESET_ICONS[preset.icon] || Zap;
          const isSelected = draft.presetUsed === preset.id;
          
          return (
            <Card 
              key={preset.id}
              className={`cursor-pointer transition-all hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 ${
                isSelected ? 'border-purple-500 bg-purple-50 dark:bg-purple-950' : ''
              }`}
              onClick={() => handlePresetClick(preset.id)}
              data-testid={`card-preset-${preset.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                      <PresetIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{preset.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{preset.description}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {preset.badge}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1">
                    {preset.channels.slice(0, 4).map((channel, i) => {
                      const ChannelIcon = CHANNEL_ICONS[channel] || Mail;
                      return (
                        <div 
                          key={i} 
                          className="p-1 rounded bg-slate-100 dark:bg-slate-800"
                          title={channel}
                        >
                          <ChannelIcon className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{preset.stepCount} steps</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      <div className="text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Or just type what you need - "Create a 7-step LinkedIn campaign for SaaS founders"
        </p>
      </div>

      <CampaignInfoModal
        open={showModal}
        onOpenChange={setShowModal}
        presetName={selectedPresetData?.name || ''}
        offer={offer}
        setOffer={setOffer}
        audience={audience}
        setAudience={setAudience}
        brandVoices={brandVoices}
        selectedBrandVoiceId={selectedBrandVoiceId}
        setSelectedBrandVoiceId={setSelectedBrandVoiceId}
        onGenerate={handleGenerateCampaign}
        isGenerating={isGenerating}
      />
    </div>
  );
}

interface CampaignInfoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetName: string;
  offer: string;
  setOffer: (value: string) => void;
  audience: string;
  setAudience: (value: string) => void;
  brandVoices: BrandVoice[];
  selectedBrandVoiceId: string;
  setSelectedBrandVoiceId: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

function CampaignInfoModal({
  open,
  onOpenChange,
  presetName,
  offer,
  setOffer,
  audience,
  setAudience,
  brandVoices,
  selectedBrandVoiceId,
  setSelectedBrandVoiceId,
  onGenerate,
  isGenerating,
}: CampaignInfoModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            Personalize Your {presetName} Campaign
          </DialogTitle>
          <DialogDescription>
            Tell me about your offer so I can write compelling, personalized content for each step.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="offer" className="text-sm font-medium">
              What are you selling or offering? <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="offer"
              placeholder="e.g., AI-powered CRM that saves sales teams 10 hours/week, Executive coaching for tech founders, B2B lead generation services..."
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              className="min-h-[80px]"
              data-testid="input-campaign-offer"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="audience" className="text-sm font-medium">
              Who is your target audience?
            </Label>
            <Input
              id="audience"
              placeholder="e.g., VP of Sales at SaaS companies, Series A startup founders..."
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              data-testid="input-campaign-audience"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brandVoice" className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-500" />
              Brand Voice
            </Label>
            <Select
              value={selectedBrandVoiceId}
              onValueChange={setSelectedBrandVoiceId}
            >
              <SelectTrigger id="brandVoice" data-testid="select-brand-voice">
                <SelectValue placeholder="Select a brand voice (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No brand voice - use default professional tone</SelectItem>
                {brandVoices.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex flex-col">
                      <span>{voice.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {voice.companyName} • {voice.tone}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {brandVoices.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No brand voices configured. Go to Settings → Brand Voices to create one.
              </p>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={onGenerate}
            disabled={!offer.trim() || isGenerating}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            data-testid="btn-generate-campaign"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Writing Content...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Campaign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
