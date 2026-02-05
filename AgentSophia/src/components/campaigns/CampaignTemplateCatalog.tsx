import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, 
  UserPlus, 
  Heart, 
  ListOrdered, 
  GitBranch, 
  Layers, 
  Clock, 
  Zap,
  Mail,
  Linkedin,
  Phone,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Check
} from 'lucide-react';
import { useCampaignDraft } from '@/contexts/CampaignDraftContext';
import { useToast } from '@/hooks/use-toast';

interface CampaignTemplateCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateApplied?: () => void;
}

interface TemplateStep {
  order: number;
  channel: string;
  delay: number;
  delayUnit: 'hours' | 'days';
  subject?: string;
  content: string;
  conditions?: any[];
}

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  channels: string[];
  estimatedDuration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  expectedMetrics?: {
    openRate?: string;
    replyRate?: string;
    conversionRate?: string;
  };
  steps: TemplateStep[];
  tags: string[];
  sophiaRecommendation?: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  description: string;
}

const CATEGORY_ICONS: Record<string, any> = {
  cold_outreach: Mail,
  nurture: Heart,
  re_engagement: Zap,
  event: Clock,
  product_launch: Sparkles,
};

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  linkedin_connect: UserPlus,
  phone: Phone,
  sms: MessageSquare,
  voicemail: Phone,
};

const COMPLEXITY_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  advanced: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

export function CampaignTemplateCatalog({ open, onOpenChange, onTemplateApplied }: CampaignTemplateCatalogProps) {
  const { toast } = useToast();
  const { updateDraft, setDraft, draft } = useCampaignDraft();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/campaign-templates', selectedCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchQuery) params.append('search', searchQuery);
      const res = await fetch(`/api/campaign-templates?${params.toString()}`);
      return res.json();
    },
  });

  const templates: CampaignTemplate[] = data?.templates || [];
  const categories: TemplateCategory[] = data?.categories || [];

  const handleApplyTemplate = (template: CampaignTemplate) => {
    const steps = template.steps.map((step, index) => ({
      id: `step-${Date.now()}-${index}`,
      order: step.order || index + 1,
      channel: step.channel as 'email' | 'linkedin' | 'linkedin_connect' | 'sms' | 'phone' | 'voicemail' | 'condition' | 'delay',
      label: step.subject || `Step ${index + 1}`,
      subject: step.subject,
      content: step.content,
      delay: step.delay,
      delayUnit: step.delayUnit as 'hours' | 'days',
      conditions: step.conditions || [],
    }));

    setDraft({
      ...draft,
      id: `campaign-${Date.now()}`,
      name: template.name,
      goal: template.description || '',
      audience: '',
      channels: template.channels,
      stepCount: template.steps.length,
      steps,
      status: 'previewing',
      presetUsed: template.id,
      createdAt: new Date(),
    });

    toast({
      title: 'Template Applied',
      description: `"${template.name}" template loaded. You can customize all steps.`,
    });

    onOpenChange(false);
    onTemplateApplied?.();
  };

  const renderTemplateCard = (template: CampaignTemplate) => {
    const isSelected = selectedTemplate?.id === template.id;
    
    return (
      <Card 
        key={template.id}
        className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary' : ''}`}
        onClick={() => setSelectedTemplate(isSelected ? null : template)}
        data-testid={`template-card-${template.id}`}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {template.name}
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </CardTitle>
              <CardDescription className="text-sm mt-1 line-clamp-2">
                {template.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 mb-3">
            <Badge className={COMPLEXITY_COLORS[template.difficulty]}>
              {template.difficulty}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ListOrdered className="h-3 w-3" />
              {template.steps.length} steps
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {template.estimatedDuration}
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 mb-3">
            {template.channels.slice(0, 4).map((channel, idx) => {
              const Icon = CHANNEL_ICONS[channel] || Zap;
              return (
                <div 
                  key={idx}
                  className="h-6 w-6 rounded bg-muted flex items-center justify-center"
                  title={channel.replace('_', ' ')}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
              );
            })}
            {template.channels.length > 4 && (
              <span className="text-xs text-muted-foreground">+{template.channels.length - 4}</span>
            )}
          </div>

          {isSelected && (
            <Button 
              className="w-full mt-2" 
              onClick={(e) => {
                e.stopPropagation();
                handleApplyTemplate(template);
              }}
              data-testid={`apply-template-${template.id}`}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Use This Template
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderTemplatePreview = (template: CampaignTemplate) => (
    <Card className="bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="text-sm font-medium">Campaign Flow</div>
          <div className="space-y-2">
            {template.steps.map((step, index) => {
              const Icon = CHANNEL_ICONS[step.channel] || Zap;
              return (
                <div key={index} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    {index < template.steps.length - 1 && (
                      <div className="w-0.5 h-6 bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="font-medium text-sm">{step.subject || `Step ${step.order}`}</div>
                    <div className="text-xs text-muted-foreground">
                      {step.delay > 0 ? `Wait ${step.delay} ${step.delayUnit}` : 'Immediate'}
                      {step.channel === 'linkedin_connect' && ' • Connection request'}
                      {step.conditions && step.conditions.length > 0 && ` • Conditional`}
                    </div>
                    {step.subject && (
                      <div className="text-xs mt-1 text-muted-foreground truncate">
                        Subject: {step.subject}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <Button 
          className="w-full mt-4" 
          onClick={() => handleApplyTemplate(template)}
          data-testid="apply-selected-template"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Use This Template
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Campaign Template Catalog
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="search-templates"
              />
            </div>
          </div>

          <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
            <TabsList className="mb-4 flex-wrap h-auto gap-1">
              <TabsTrigger value="all" className="gap-1.5" data-testid="tab-all">
                <Zap className="h-3.5 w-3.5" />
                All
              </TabsTrigger>
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id] || Zap;
                return (
                  <TabsTrigger 
                    key={cat.id} 
                    value={cat.id} 
                    className="gap-1.5"
                    data-testid={`tab-${cat.id}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {cat.name}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="flex gap-4">
              <ScrollArea className="flex-1 h-[50vh]">
                {isLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Card key={i} className="animate-pulse">
                        <CardHeader>
                          <div className="h-4 bg-muted rounded w-2/3" />
                          <div className="h-3 bg-muted rounded w-full mt-2" />
                        </CardHeader>
                        <CardContent>
                          <div className="h-6 bg-muted rounded w-1/3" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No templates found matching your criteria
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 pr-4">
                    {templates.map(renderTemplateCard)}
                  </div>
                )}
              </ScrollArea>

              {selectedTemplate && (
                <div className="w-80 flex-shrink-0">
                  {renderTemplatePreview(selectedTemplate)}
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CampaignTemplateCatalog;
