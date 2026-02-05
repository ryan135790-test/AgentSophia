import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Sparkles, Building2, Check, Loader2 } from "lucide-react";

export interface BrandVoice {
  id: string;
  name: string;
  companyName: string;
  industry: string;
  tone: 'professional' | 'friendly' | 'casual' | 'authoritative' | 'empathetic';
  values: string[];
  writingStyle: string;
  avoidWords: string[];
  keyMessages: string[];
  websiteUrls?: string[];
  websiteInsights?: string;
}

interface BrandVoiceSelectorProps {
  onSelect: (brandVoice: BrandVoice | 'default') => void;
  onCancel?: () => void;
}

const DEFAULT_VOICE: BrandVoice = {
  id: 'default',
  name: 'Default Professional',
  companyName: 'Your Company',
  industry: 'General',
  tone: 'professional',
  values: ['Trust', 'Quality', 'Innovation'],
  writingStyle: 'Clear, concise, and professional with a focus on value propositions',
  avoidWords: ['cheap', 'guarantee', 'best in class'],
  keyMessages: ['We help businesses grow', 'Trusted by leading companies']
};

export function BrandVoiceSelector({ onSelect, onCancel }: BrandVoiceSelectorProps) {
  const { toast } = useToast();
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [tone, setTone] = useState<BrandVoice['tone']>('professional');
  const [values, setValues] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [avoidWords, setAvoidWords] = useState('');
  const [keyMessages, setKeyMessages] = useState('');
  const [websiteUrls, setWebsiteUrls] = useState('');

  const { data: brandVoicesData, isLoading } = useQuery<{ brand_voices: BrandVoice[] }>({
    queryKey: ['/api/brand-voices'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/brand-voices', {
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch brand voices');
      return response.json();
    },
  });

  const brandVoices = brandVoicesData?.brand_voices || [];

  const createMutation = useMutation({
    mutationFn: async (brandVoice: Omit<BrandVoice, 'id'>) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/brand-voices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(brandVoice),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to create brand voice');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/brand-voices'] });
      toast({ title: "Brand Voice Created", description: "Your brand voice is now available for campaigns." });
      setShowCreateDialog(false);
      resetForm();
      if (data.brandVoice) {
        onSelect(data.brandVoice);
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setName('');
    setCompanyName('');
    setIndustry('');
    setTone('professional');
    setValues('');
    setWritingStyle('');
    setAvoidWords('');
    setKeyMessages('');
    setWebsiteUrls('');
  };

  const handleCreateSubmit = () => {
    const brandVoiceData = {
      name,
      companyName,
      industry,
      tone,
      values: values.split(',').map(v => v.trim()).filter(Boolean),
      writingStyle,
      avoidWords: avoidWords.split(',').map(v => v.trim()).filter(Boolean),
      keyMessages: keyMessages.split(',').map(v => v.trim()).filter(Boolean),
      websiteUrls: websiteUrls.split('\n').map(v => v.trim()).filter(Boolean),
    };
    createMutation.mutate(brandVoiceData);
  };

  const handleSelectConfirm = () => {
    if (!selectedVoiceId) return;
    
    if (selectedVoiceId === 'default') {
      onSelect('default');
    } else {
      const voice = brandVoices.find(v => v.id === selectedVoiceId);
      if (voice) {
        onSelect(voice);
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
        <CardContent className="p-6 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
          <span>Loading brand voices...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Select Brand Voice
          </CardTitle>
          <CardDescription>
            {brandVoices.length > 0 
              ? "Choose how Sophia should write your campaign content"
              : "Set up your brand voice for personalized campaigns"
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup 
            value={selectedVoiceId || ''} 
            onValueChange={setSelectedVoiceId}
            className="space-y-3"
          >
            {brandVoices.map((voice) => (
              <label
                key={voice.id}
                className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedVoiceId === voice.id 
                    ? 'border-purple-500 bg-purple-100/50 dark:bg-purple-900/30' 
                    : 'border-slate-200 hover:border-purple-300'
                }`}
              >
                <RadioGroupItem value={voice.id} className="mt-1" data-testid={`radio-voice-${voice.id}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{voice.name}</span>
                    <Badge variant="secondary" className="text-xs">{voice.tone}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {voice.companyName} • {voice.industry}
                  </p>
                  {voice.writingStyle && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      Style: {voice.writingStyle}
                    </p>
                  )}
                </div>
              </label>
            ))}

            <label
              className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedVoiceId === 'default' 
                  ? 'border-purple-500 bg-purple-100/50 dark:bg-purple-900/30' 
                  : 'border-slate-200 hover:border-purple-300'
              }`}
            >
              <RadioGroupItem value="default" className="mt-1" data-testid="radio-voice-default" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Default Professional Voice</span>
                  <Badge variant="outline" className="text-xs">Standard</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Clear, professional messaging suitable for most business contexts
                </p>
              </div>
            </label>
          </RadioGroup>

          <div className="border-t pt-4 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCreateDialog(true)}
              data-testid="button-create-brand-voice"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Brand Voice
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              disabled={!selectedVoiceId}
              onClick={handleSelectConfirm}
              data-testid="button-confirm-voice"
            >
              <Check className="h-4 w-4 mr-2" />
              Use This Voice
            </Button>
          </div>

          {onCancel && (
            <Button variant="ghost" className="w-full" onClick={onCancel} data-testid="button-cancel-voice">
              Skip for now
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Create Brand Voice
            </DialogTitle>
            <DialogDescription>
              Define your brand's voice, tone, and messaging style for Sophia to use in campaigns
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Brand Voice Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Tech Startup, Enterprise Division"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="input-new-voice-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  placeholder="e.g., TechCorp Inc"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  data-testid="input-new-company-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry *</Label>
                <Input
                  id="industry"
                  placeholder="e.g., SaaS, Healthcare, Finance"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  data-testid="input-new-industry"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Brand Tone *</Label>
                <Select value={tone} onValueChange={(value: BrandVoice['tone']) => setTone(value)}>
                  <SelectTrigger data-testid="select-new-tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="authoritative">Authoritative</SelectItem>
                    <SelectItem value="empathetic">Empathetic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="writingStyle">Writing Style</Label>
              <Textarea
                id="writingStyle"
                placeholder="Describe how content should be written (e.g., concise bullet points, storytelling, data-driven)"
                value={writingStyle}
                onChange={(e) => setWritingStyle(e.target.value)}
                rows={2}
                data-testid="input-new-writing-style"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="values">Brand Values (comma-separated)</Label>
              <Input
                id="values"
                placeholder="e.g., Innovation, Trust, Customer Success"
                value={values}
                onChange={(e) => setValues(e.target.value)}
                data-testid="input-new-values"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyMessages">Key Messages (comma-separated)</Label>
              <Textarea
                id="keyMessages"
                placeholder="e.g., We help businesses scale, 10x your revenue"
                value={keyMessages}
                onChange={(e) => setKeyMessages(e.target.value)}
                rows={2}
                data-testid="input-new-key-messages"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avoidWords">Words to Avoid (comma-separated)</Label>
              <Input
                id="avoidWords"
                placeholder="e.g., cheap, guarantee, best in class"
                value={avoidWords}
                onChange={(e) => setAvoidWords(e.target.value)}
                data-testid="input-new-avoid-words"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrls">Website URLs for Reference (one per line)</Label>
              <Textarea
                id="websiteUrls"
                placeholder="https://yourcompany.com/about&#10;https://yourcompany.com/products&#10;https://yourcompany.com/blog"
                value={websiteUrls}
                onChange={(e) => setWebsiteUrls(e.target.value)}
                rows={3}
                data-testid="input-new-website-urls"
              />
              <p className="text-xs text-muted-foreground">
                Sophia will reference these pages to better understand your brand and write on-brand content
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setShowCreateDialog(false);
              }}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={!name || !companyName || !industry || createMutation.isPending}
              className="bg-gradient-to-r from-purple-600 to-blue-600"
              data-testid="button-save-new-voice"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create & Use This Voice'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { DEFAULT_VOICE };
