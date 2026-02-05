import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mail, 
  Linkedin, 
  MessageSquare, 
  Phone, 
  Sparkles, 
  Clock, 
  Target, 
  TrendingUp,
  ChevronRight,
  Search,
  Zap,
  Users,
  RefreshCw,
  Calendar,
  Rocket
} from 'lucide-react';

interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  category: 'cold_outreach' | 'nurture' | 're_engagement' | 'event' | 'product_launch';
  channels: string[];
  estimatedDuration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  expectedMetrics: {
    openRate: string;
    replyRate: string;
    conversionRate: string;
  };
  steps: Array<{
    order: number;
    channel: string;
    delay: number;
    delayUnit: 'hours' | 'days';
    subject?: string;
    content: string;
  }>;
  tags: string[];
  sophiaRecommendation?: string;
}

interface CampaignTemplateSelectorProps {
  onSelectTemplate: (template: CampaignTemplate) => void;
  onSkip: () => void;
}

const categoryIcons: Record<string, any> = {
  cold_outreach: Zap,
  nurture: Users,
  re_engagement: RefreshCw,
  event: Calendar,
  product_launch: Rocket
};

const channelIcons: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  sms: MessageSquare,
  phone: Phone
};

const difficultyColors: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intermediate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  advanced: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
};

export function CampaignTemplateSelector({ onSelectTemplate, onSkip }: CampaignTemplateSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewTemplate, setPreviewTemplate] = useState<CampaignTemplate | null>(null);

  const { data: templatesData, isLoading } = useQuery<{ templates: CampaignTemplate[] }>({
    queryKey: ['/api/campaign-templates']
  });

  const { data: categoriesData } = useQuery<{ categories: Array<{ id: string; name: string; description: string }> }>({
    queryKey: ['/api/campaign-templates/categories']
  });

  const templates: CampaignTemplate[] = templatesData?.templates || [];
  const categories = categoriesData?.categories || [];

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchQuery === '' || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (previewTemplate) {
    return (
      <div className="space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => setPreviewTemplate(null)}
          className="mb-2"
          data-testid="button-back-to-templates"
        >
          ← Back to templates
        </Button>
        
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold">{previewTemplate.name}</h3>
            <p className="text-muted-foreground">{previewTemplate.description}</p>
          </div>
          <Badge className={difficultyColors[previewTemplate.difficulty]}>
            {previewTemplate.difficulty}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 py-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{previewTemplate.expectedMetrics.openRate}</div>
            <div className="text-sm text-muted-foreground">Expected Open Rate</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{previewTemplate.expectedMetrics.replyRate}</div>
            <div className="text-sm text-muted-foreground">Expected Reply Rate</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{previewTemplate.expectedMetrics.conversionRate}</div>
            <div className="text-sm text-muted-foreground">Conversion Rate</div>
          </div>
        </div>

        {previewTemplate.sophiaRecommendation && (
          <Card className="border-purple-200 bg-purple-50 dark:bg-purple-900/20">
            <CardContent className="pt-4">
              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-purple-900 dark:text-purple-100">Sophia's Tip</div>
                  <p className="text-sm text-purple-700 dark:text-purple-300">{previewTemplate.sophiaRecommendation}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sequence Steps ({previewTemplate.steps.length} steps, {previewTemplate.estimatedDuration})
          </h4>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {previewTemplate.steps.map((step, idx) => {
                const ChannelIcon = channelIcons[step.channel] || Mail;
                return (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium">
                      {step.order}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <ChannelIcon className="h-4 w-4" />
                        <span className="font-medium capitalize">{step.channel}</span>
                        {step.delay > 0 && (
                          <span className="text-xs text-muted-foreground">
                            (wait {step.delay} {step.delayUnit})
                          </span>
                        )}
                      </div>
                      {step.subject && (
                        <div className="text-sm text-muted-foreground mt-1">
                          Subject: {step.subject}
                        </div>
                      )}
                      <div className="text-sm mt-1 line-clamp-2">{step.content.substring(0, 100)}...</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setPreviewTemplate(null)} data-testid="button-cancel-preview">
            Cancel
          </Button>
          <Button 
            onClick={() => onSelectTemplate(previewTemplate)}
            className="gap-2"
            data-testid="button-use-template"
          >
            <Sparkles className="h-4 w-4" />
            Use This Template
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Choose a Template</h3>
          <p className="text-sm text-muted-foreground">Start with a proven campaign flow or build from scratch</p>
        </div>
        <Button variant="ghost" onClick={onSkip} data-testid="button-skip-template">
          Skip & Build from Scratch
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-templates"
        />
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all" data-testid="tab-all-templates">All</TabsTrigger>
          {categories.map((cat: any) => {
            const Icon = categoryIcons[cat.id] || Target;
            return (
              <TabsTrigger key={cat.id} value={cat.id} className="gap-1" data-testid={`tab-${cat.id}`}>
                <Icon className="h-3 w-3" />
                {cat.name}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-4">
          <ScrollArea className="h-[300px]">
            <div className="grid gap-3">
              {filteredTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No templates found matching your search
                </div>
              ) : (
                filteredTemplates.map((template) => {
                  const CategoryIcon = categoryIcons[template.category] || Target;
                  return (
                    <Card 
                      key={template.id}
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setPreviewTemplate(template)}
                      data-testid={`card-template-${template.id}`}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CategoryIcon className="h-4 w-4 text-primary" />
                              <h4 className="font-medium">{template.name}</h4>
                              <Badge variant="outline" className="text-xs">
                                {template.steps.length} steps
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {template.description}
                            </p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center gap-1">
                                {template.channels.map((channel) => {
                                  const ChannelIcon = channelIcons[channel] || Mail;
                                  return <ChannelIcon key={channel} className="h-3 w-3 text-muted-foreground" />;
                                })}
                              </div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {template.estimatedDuration}
                              </span>
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                {template.expectedMetrics.replyRate} replies
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
