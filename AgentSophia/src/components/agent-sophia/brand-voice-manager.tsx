import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Edit2, Trash2, Building2, Sparkles, Link, Globe, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface BrandVoice {
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
  createdAt?: string;
  updatedAt?: string;
}

export function BrandVoiceManager() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVoice, setEditingVoice] = useState<BrandVoice | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [tone, setTone] = useState<BrandVoice['tone']>('professional');
  const [values, setValues] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [avoidWords, setAvoidWords] = useState('');
  const [keyMessages, setKeyMessages] = useState('');
  const [websiteUrls, setWebsiteUrls] = useState('');
  const [websiteInsights, setWebsiteInsights] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [researchStatus, setResearchStatus] = useState<'idle' | 'researching' | 'success' | 'error'>('idle');

  // Fetch brand voices
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

  // Create brand voice mutation
  const createMutation = useMutation({
    mutationFn: async (brandVoice: Omit<BrandVoice, 'id' | 'createdAt' | 'updatedAt'>) => {
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brand-voices'] });
      toast({ title: "Brand Voice Created", description: "Your brand voice has been saved successfully." });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update brand voice mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...brandVoice }: Partial<BrandVoice> & { id: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/brand-voices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify(brandVoice),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to update brand voice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brand-voices'] });
      toast({ title: "Brand Voice Updated", description: "Your changes have been saved." });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Delete brand voice mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/brand-voices/${id}`, {
        method: 'DELETE',
        headers: {
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete brand voice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/brand-voices'] });
      toast({ title: "Brand Voice Deleted", description: "The brand voice has been removed." });
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
    setWebsiteInsights('');
    setResearchStatus('idle');
    setEditingVoice(null);
  };
  
  // Research website URLs to extract brand insights
  const researchWebsites = async () => {
    const urls = websiteUrls.split('\n').map(v => v.trim()).filter(Boolean);
    if (urls.length === 0) return;
    
    setIsResearching(true);
    setResearchStatus('researching');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/brand-voices/research', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ urls }),
        credentials: 'include',
      });
      
      const data = await response.json();
      
      if (data.success && data.insights) {
        setWebsiteInsights(data.insights);
        setResearchStatus('success');
        toast({
          title: "Website Research Complete",
          description: `Analyzed ${data.analyzedUrls?.length || 0} page(s) and extracted brand insights.`
        });
      } else {
        setResearchStatus('error');
        toast({
          title: "Research Issue",
          description: data.error || "Could not analyze some websites.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      setResearchStatus('error');
      toast({
        title: "Research Failed",
        description: error.message || "Failed to research websites.",
        variant: "destructive"
      });
    } finally {
      setIsResearching(false);
    }
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (voice: BrandVoice) => {
    setEditingVoice(voice);
    setName(voice.name);
    setCompanyName(voice.companyName);
    setIndustry(voice.industry);
    setTone(voice.tone);
    setValues(voice.values?.join(', ') || '');
    setWritingStyle(voice.writingStyle || '');
    setAvoidWords(voice.avoidWords?.join(', ') || '');
    setKeyMessages(voice.keyMessages?.join(', ') || '');
    setWebsiteUrls(voice.websiteUrls?.join('\n') || '');
    setWebsiteInsights(voice.websiteInsights || '');
    setResearchStatus(voice.websiteInsights ? 'success' : 'idle');
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
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
      websiteInsights: websiteInsights || undefined,
    };

    if (editingVoice) {
      updateMutation.mutate({ id: editingVoice.id, ...brandVoiceData });
    } else {
      createMutation.mutate(brandVoiceData);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Brand Voices
              </CardTitle>
              <CardDescription>
                Manage multiple brand voices for Sophia to use in campaigns
              </CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} data-testid="button-add-brand-voice">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Brand Voice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingVoice ? 'Edit Brand Voice' : 'Create Brand Voice'}
                  </DialogTitle>
                  <DialogDescription>
                    Define your brand's voice, tone, and messaging for Sophia to use
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
                        data-testid="input-voice-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        placeholder="e.g., TechCorp Inc"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        data-testid="input-company-name"
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
                        data-testid="input-industry"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tone">Brand Tone *</Label>
                      <Select value={tone} onValueChange={(value: BrandVoice['tone']) => setTone(value)}>
                        <SelectTrigger data-testid="select-tone">
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
                      rows={3}
                      data-testid="input-writing-style"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="values">Brand Values (comma-separated)</Label>
                    <Input
                      id="values"
                      placeholder="e.g., Innovation, Trust, Customer Success"
                      value={values}
                      onChange={(e) => setValues(e.target.value)}
                      data-testid="input-values"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keyMessages">Key Messages (comma-separated)</Label>
                    <Textarea
                      id="keyMessages"
                      placeholder="e.g., We help businesses scale, 10x your revenue, Trusted by Fortune 500"
                      value={keyMessages}
                      onChange={(e) => setKeyMessages(e.target.value)}
                      rows={2}
                      data-testid="input-key-messages"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="avoidWords">Words to Avoid (comma-separated)</Label>
                    <Input
                      id="avoidWords"
                      placeholder="e.g., cheap, sales, buy now"
                      value={avoidWords}
                      onChange={(e) => setAvoidWords(e.target.value)}
                      data-testid="input-avoid-words"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="websiteUrls">Website URLs for Reference (one per line)</Label>
                    <Textarea
                      id="websiteUrls"
                      placeholder="https://yourcompany.com/about&#10;https://yourcompany.com/products&#10;https://yourcompany.com/blog"
                      value={websiteUrls}
                      onChange={(e) => {
                        setWebsiteUrls(e.target.value);
                        setResearchStatus('idle');
                      }}
                      rows={3}
                      data-testid="input-website-urls"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={researchWebsites}
                        disabled={!websiteUrls.trim() || isResearching}
                        data-testid="button-research-websites"
                      >
                        {isResearching ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Researching...
                          </>
                        ) : (
                          <>
                            <Globe className="h-4 w-4 mr-2" />
                            Research Websites
                          </>
                        )}
                      </Button>
                      {researchStatus === 'success' && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Insights extracted
                        </span>
                      )}
                      {researchStatus === 'error' && (
                        <span className="text-sm text-destructive flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          Research failed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click "Research Websites" to have Sophia analyze your pages and extract brand voice insights
                    </p>
                  </div>

                  {websiteInsights && (
                    <div className="space-y-2 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                      <Label className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-600" />
                        Extracted Brand Insights
                      </Label>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {websiteInsights}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm();
                      setIsDialogOpen(false);
                    }}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!name || !companyName || !industry || createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-brand-voice"
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Brand Voice'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading brand voices...</div>
          ) : brandVoices.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Brand Voices Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first brand voice to help Sophia understand your company's messaging
              </p>
              <Button onClick={openCreateDialog} data-testid="button-create-first-voice">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Brand Voice
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {brandVoices.map((voice: BrandVoice) => (
                <Card key={voice.id} className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold" data-testid={`text-voice-name-${voice.id}`}>{voice.name}</h3>
                          <Badge variant="secondary">{voice.tone}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          <span className="font-medium">{voice.companyName}</span> • {voice.industry}
                        </p>
                        {voice.writingStyle && (
                          <p className="text-sm mb-2">
                            <span className="font-medium">Style:</span> {voice.writingStyle}
                          </p>
                        )}
                        {voice.values && voice.values.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className="text-sm font-medium">Values:</span>
                            {voice.values.map((value, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {voice.keyMessages && voice.keyMessages.length > 0 && (
                          <div className="text-sm">
                            <span className="font-medium">Key Messages:</span>
                            <ul className="list-disc list-inside text-muted-foreground mt-1">
                              {voice.keyMessages.slice(0, 3).map((msg, idx) => (
                                <li key={idx}>{msg}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {voice.websiteUrls && voice.websiteUrls.length > 0 && (
                          <div className="text-sm mt-2 flex items-start gap-1">
                            <Link className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span className="text-muted-foreground">
                              {voice.websiteUrls.length} reference URL{voice.websiteUrls.length > 1 ? 's' : ''} configured
                            </span>
                            {voice.websiteInsights && (
                              <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Researched
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(voice)}
                          data-testid={`button-edit-${voice.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${voice.name}"?`)) {
                              deleteMutation.mutate(voice.id);
                            }
                          }}
                          data-testid={`button-delete-${voice.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {brandVoices.length > 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-1 text-blue-900 dark:text-blue-100">
                  How Sophia Uses Brand Voices
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  When you ask Sophia to build a campaign, she'll ask which brand voice to use. She'll then craft all messaging 
                  in that brand's tone, referencing your key messages and avoiding specified words.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
