import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Mail, 
  MessageSquare, 
  Linkedin, 
  Clock, 
  Sparkles, 
  Check, 
  Copy,
  RefreshCw,
  Lightbulb,
  TrendingUp,
  BarChart3,
  Zap,
  Target,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Edit3,
  ArrowRight
} from 'lucide-react';

interface MessageOption {
  version: number;
  content: string;
  subject?: string;
  score: number;
  reasoning: string;
}

interface StepInsight {
  type: 'tip' | 'warning' | 'success';
  title: string;
  description: string;
  action?: string;
}

interface WorkflowStepData {
  id: string;
  label: string;
  type: string;
  subject?: string;
  content?: string;
  template?: string;
  messageOptions?: MessageOption[];
  selectedVersion?: number;
  delay?: number;
  delayUnit?: 'hours' | 'days' | 'weeks';
  sendWindowStart?: string;
  sendWindowEnd?: string;
  activeDays?: string[];
  config?: any;
}

interface WorkflowStepEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stepData: WorkflowStepData | null;
  onSave: (data: WorkflowStepData) => void;
  stepIndex: number;
  totalSteps: number;
}

import { Search } from 'lucide-react';

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: Linkedin,
  linkedin_search: Search,
  linkedin_connect: Linkedin,
  linkedin_message: MessageSquare,
  sms: MessageSquare,
  wait: Clock,
};

const CHANNEL_COLORS: Record<string, string> = {
  email: 'bg-blue-500',
  linkedin: 'bg-[#0A66C2]',
  linkedin_search: 'bg-[#0A66C2]',
  linkedin_connect: 'bg-[#0A66C2]',
  linkedin_message: 'bg-[#0A66C2]',
  sms: 'bg-purple-500',
  wait: 'bg-gray-500',
};

export function WorkflowStepEditor({
  open,
  onOpenChange,
  stepData,
  onSave,
  stepIndex,
  totalSteps,
}: WorkflowStepEditorProps) {
  const [localData, setLocalData] = useState<WorkflowStepData | null>(null);
  const [editingVersion, setEditingVersion] = useState<number | null>(null);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);

  useEffect(() => {
    if (stepData) {
      setLocalData({ 
        ...stepData,
        sendWindowStart: stepData.sendWindowStart || stepData.config?.sendWindowStart || '09:00',
        sendWindowEnd: stepData.sendWindowEnd || stepData.config?.sendWindowEnd || '17:00',
        activeDays: stepData.activeDays || stepData.config?.activeDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      });
    }
  }, [stepData]);

  if (!localData) return null;

  const Icon = CHANNEL_ICONS[localData.type] || Mail;
  const colorClass = CHANNEL_COLORS[localData.type] || 'bg-gray-500';
  const isMessageStep = ['email', 'linkedin', 'linkedin_connect', 'linkedin_message', 'sms'].includes(localData.type);

  const handleSelectVersion = (version: number) => {
    const option = localData.messageOptions?.find(o => o.version === version);
    if (option) {
      setLocalData({
        ...localData,
        selectedVersion: version,
        content: option.content,
        subject: option.subject,
        template: option.content,
      });
    }
  };

  const handleSave = () => {
    if (localData) {
      onSave(localData);
      onOpenChange(false);
    }
  };

  const handleGenerateVariants = async () => {
    setIsGeneratingVariants(true);
    await new Promise(r => setTimeout(r, 1500));
    
    const newOptions: MessageOption[] = [
      {
        version: 1,
        subject: localData.type === 'email' ? `Quick question about {{company}}'s growth` : undefined,
        content: `Hi {{firstName}},\n\nI noticed {{company}} has been expanding rapidly. Many similar companies have found our solution helps them scale their outreach by 3x.\n\nWould you be open to a quick 15-minute call this week?\n\nBest,\n{{senderName}}`,
        score: 9.2,
        reasoning: 'Direct, personalized approach with clear value proposition and specific CTA',
      },
      {
        version: 2,
        subject: localData.type === 'email' ? `Thought you might find this valuable, {{firstName}}` : undefined,
        content: `Hey {{firstName}},\n\nI came across {{company}} and was impressed by what you're building. I work with several companies in your space who've seen great results with our platform.\n\nHappy to share some insights that might be useful - no strings attached.\n\nCheers,\n{{senderName}}`,
        score: 8.7,
        reasoning: 'Softer approach, focuses on providing value first before asking for anything',
      },
      {
        version: 3,
        subject: localData.type === 'email' ? `{{firstName}} - quick thought` : undefined,
        content: `{{firstName}},\n\nI'll keep this brief - I've helped 50+ companies like {{company}} improve their sales efficiency by 40%.\n\nInterested in learning how? Reply with "yes" and I'll send details.\n\n{{senderName}}`,
        score: 8.1,
        reasoning: 'Very direct and concise, works well for busy executives who prefer brevity',
      },
    ];
    
    setLocalData({
      ...localData,
      messageOptions: newOptions,
    });
    setIsGeneratingVariants(false);
  };

  const getInsights = (): StepInsight[] => {
    const insights: StepInsight[] = [];
    
    if (localData.type === 'email') {
      insights.push({
        type: 'tip',
        title: 'Optimal Send Time',
        description: 'Emails sent Tuesday-Thursday 9-11 AM see 23% higher open rates',
        action: 'Schedule for optimal time',
      });
      
      if (!localData.subject?.includes('{{')) {
        insights.push({
          type: 'warning',
          title: 'Add Personalization',
          description: 'Subject lines with {{firstName}} have 26% higher open rates',
          action: 'Add variable',
        });
      }
    }
    
    if (localData.type === 'linkedin_connect') {
      insights.push({
        type: 'success',
        title: 'Connection Rate: 57.9%',
        description: 'Your personalized connection requests are performing above average',
      });
    }
    
    if (stepIndex > 0) {
      insights.push({
        type: 'tip',
        title: 'Follow-up Timing',
        description: `${localData.delay || 2}-day delay is optimal for ${localData.type} follow-ups`,
      });
    }
    
    return insights;
  };

  const insights = getInsights();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${colorClass} text-white`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                Step {stepIndex + 1}: {localData.label}
                <Badge variant="outline" className="ml-2 font-normal">
                  {stepIndex + 1} of {totalSteps}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Configure your {localData.type.replace('_', ' ')} step
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <Tabs defaultValue="content" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
              <TabsTrigger value="content" data-testid="tab-step-content">
                <Edit3 className="h-4 w-4 mr-2" />
                Content
              </TabsTrigger>
              <TabsTrigger value="versions" data-testid="tab-step-versions">
                <Sparkles className="h-4 w-4 mr-2" />
                AI Versions
              </TabsTrigger>
              <TabsTrigger value="insights" data-testid="tab-step-insights">
                <Lightbulb className="h-4 w-4 mr-2" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-step-settings">
                <Clock className="h-4 w-4 mr-2" />
                Timing
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-4 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 220px)' }}>
              <TabsContent value="content" className="space-y-4 m-0 px-1">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="step-label">Step Name</Label>
                    <Input
                      id="step-label"
                      value={localData.label}
                      onChange={(e) => setLocalData({ ...localData, label: e.target.value })}
                      placeholder="e.g., Initial Outreach Email"
                      data-testid="input-step-label"
                    />
                  </div>

                  {localData.type === 'email' && (
                    <div>
                      <Label htmlFor="step-subject">Email Subject</Label>
                      <Input
                        id="step-subject"
                        value={localData.subject || ''}
                        onChange={(e) => setLocalData({ ...localData, subject: e.target.value })}
                        placeholder="{{firstName}}, quick question about {{company}}..."
                        data-testid="input-step-subject"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use {'{{firstName}}'}, {'{{company}}'}, {'{{role}}'} for personalization
                      </p>
                    </div>
                  )}

                  {isMessageStep && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="step-content">Message Content</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={handleGenerateVariants}
                          disabled={isGeneratingVariants}
                          data-testid="button-generate-variants"
                        >
                          {isGeneratingVariants ? (
                            <>
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3 w-3 mr-1" />
                              Generate AI Variants
                            </>
                          )}
                        </Button>
                      </div>
                      <Textarea
                        id="step-content"
                        value={localData.content || localData.template || ''}
                        onChange={(e) => setLocalData({ ...localData, content: e.target.value, template: e.target.value })}
                        placeholder="Hi {{firstName}},\n\nI noticed {{company}} has been..."
                        className="min-h-[200px] font-mono text-sm"
                        data-testid="textarea-step-content"
                      />
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground">
                          {(localData.content || localData.template || '').length} characters
                        </p>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 text-xs" data-testid="button-insert-firstname">
                            + firstName
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" data-testid="button-insert-company">
                            + company
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" data-testid="button-insert-role">
                            + role
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {localData.type === 'wait' && (
                    <div>
                      <Label>Wait Duration</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="number"
                          value={localData.delay || 2}
                          onChange={(e) => setLocalData({ ...localData, delay: parseInt(e.target.value) || 2 })}
                          className="w-24"
                          min={1}
                          data-testid="input-wait-delay"
                        />
                        <Select
                          value={localData.delayUnit || 'days'}
                          onValueChange={(value: 'hours' | 'days' | 'weeks') => 
                            setLocalData({ ...localData, delayUnit: value })
                          }
                        >
                          <SelectTrigger className="w-32" data-testid="select-delay-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                            <SelectItem value="weeks">Weeks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {localData.type === 'linkedin_search' && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">LinkedIn Lead Search</h4>
                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          Configure search criteria to find new leads on LinkedIn matching your target audience.
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="search-keywords">Search Keywords</Label>
                        <Input
                          id="search-keywords"
                          value={localData.config?.keywords || ''}
                          onChange={(e) => setLocalData({ 
                            ...localData, 
                            config: { ...localData.config, keywords: e.target.value }
                          })}
                          placeholder="e.g., software engineer, product manager"
                          data-testid="input-search-keywords"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Keywords to search for in profiles
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="search-title">Job Title</Label>
                        <Input
                          id="search-title"
                          value={localData.config?.jobTitle || ''}
                          onChange={(e) => setLocalData({ 
                            ...localData, 
                            config: { ...localData.config, jobTitle: e.target.value }
                          })}
                          placeholder="e.g., CEO, VP of Sales, Head of Marketing"
                          data-testid="input-search-title"
                        />
                      </div>

                      <div>
                        <Label htmlFor="search-company">Company</Label>
                        <Input
                          id="search-company"
                          value={localData.config?.company || ''}
                          onChange={(e) => setLocalData({ 
                            ...localData, 
                            config: { ...localData.config, company: e.target.value }
                          })}
                          placeholder="e.g., Google, Microsoft, or leave empty for any"
                          data-testid="input-search-company"
                        />
                      </div>

                      <div>
                        <Label htmlFor="search-location">Location</Label>
                        <Input
                          id="search-location"
                          value={localData.config?.location || ''}
                          onChange={(e) => setLocalData({ 
                            ...localData, 
                            config: { ...localData.config, location: e.target.value }
                          })}
                          placeholder="e.g., San Francisco Bay Area, United States"
                          data-testid="input-search-location"
                        />
                      </div>

                      <div>
                        <Label htmlFor="search-industry">Industry</Label>
                        <Select
                          value={localData.config?.industry || ''}
                          onValueChange={(value) => setLocalData({ 
                            ...localData, 
                            config: { ...localData.config, industry: value }
                          })}
                        >
                          <SelectTrigger data-testid="select-search-industry">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any Industry</SelectItem>
                            <SelectItem value="technology">Technology</SelectItem>
                            <SelectItem value="finance">Finance & Banking</SelectItem>
                            <SelectItem value="healthcare">Healthcare</SelectItem>
                            <SelectItem value="retail">Retail & E-commerce</SelectItem>
                            <SelectItem value="manufacturing">Manufacturing</SelectItem>
                            <SelectItem value="professional_services">Professional Services</SelectItem>
                            <SelectItem value="real_estate">Real Estate</SelectItem>
                            <SelectItem value="education">Education</SelectItem>
                            <SelectItem value="media">Media & Entertainment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="search-connection-level">Connection Level</Label>
                        <Select
                          value={localData.config?.connectionDegree || '2nd'}
                          onValueChange={(value) => setLocalData({ 
                            ...localData, 
                            config: { ...localData.config, connectionDegree: value }
                          })}
                        >
                          <SelectTrigger data-testid="select-search-connection-level">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1st">1st Degree (Direct Connections)</SelectItem>
                            <SelectItem value="2nd">2nd Degree (Friends of Friends)</SelectItem>
                            <SelectItem value="3rd">3rd Degree (Extended Network)</SelectItem>
                            <SelectItem value="all">All Connections</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          2nd degree connections typically have higher acceptance rates
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="search-limit">Maximum Leads to Find</Label>
                        <Select
                          value={String(localData.config?.maxResults || 25)}
                          onValueChange={(value) => setLocalData({ 
                            ...localData, 
                            config: { ...localData.config, maxResults: parseInt(value) }
                          })}
                        >
                          <SelectTrigger data-testid="select-search-limit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25 leads</SelectItem>
                            <SelectItem value="50">50 leads</SelectItem>
                            <SelectItem value="100">100 leads</SelectItem>
                            <SelectItem value="250">250 leads</SelectItem>
                            <SelectItem value="500">500 leads</SelectItem>
                            <SelectItem value="1000">1,000 leads</SelectItem>
                            <SelectItem value="2500">2,500 leads</SelectItem>
                            <SelectItem value="5000">5,000 leads</SelectItem>
                            <SelectItem value="unlimited">Unlimited (continuous)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sophia will continue searching daily until target is reached
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="versions" className="space-y-4 m-0 px-1">
                {localData.messageOptions && localData.messageOptions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">AI-Generated Versions</h4>
                        <p className="text-sm text-muted-foreground">
                          Sophia ranked these based on predicted performance
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerateVariants}
                        disabled={isGeneratingVariants}
                        data-testid="button-regenerate-versions"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isGeneratingVariants ? 'animate-spin' : ''}`} />
                        Regenerate
                      </Button>
                    </div>

                    {localData.messageOptions.map((option) => (
                      <Card 
                        key={option.version}
                        className={`transition-all cursor-pointer ${
                          localData.selectedVersion === option.version 
                            ? 'ring-2 ring-primary shadow-md' 
                            : 'hover:border-primary'
                        }`}
                        onClick={() => handleSelectVersion(option.version)}
                        data-testid={`card-version-${option.version}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={localData.selectedVersion === option.version ? "default" : "outline"}
                              >
                                Version {option.version}
                              </Badge>
                              {localData.selectedVersion === option.version && (
                                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  <Check className="h-3 w-3 mr-1" />
                                  Selected
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                                <span className="font-semibold text-green-600">{option.score}/10</span>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(option.content);
                                }}
                                data-testid={`button-copy-version-${option.version}`}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          <div className="mb-3">
                            <p className="text-sm font-medium text-muted-foreground mb-1">
                              <Lightbulb className="h-3.5 w-3.5 inline mr-1" />
                              Why this works:
                            </p>
                            <p className="text-sm">{option.reasoning}</p>
                          </div>

                          {option.subject && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-muted-foreground mb-1">Subject:</p>
                              <p className="text-sm font-medium">{option.subject}</p>
                            </div>
                          )}

                          <div className="bg-muted rounded-lg p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Message Preview:</p>
                            <p className="text-sm whitespace-pre-wrap line-clamp-4">{option.content}</p>
                          </div>

                          <div className="flex items-center justify-end gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              data-testid={`button-thumbs-up-${option.version}`}
                            >
                              <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                              Helpful
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              data-testid={`button-thumbs-down-${option.version}`}
                            >
                              <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                              Not helpful
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                    <h4 className="font-semibold mb-2">No AI versions yet</h4>
                    <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                      Let Sophia generate multiple message variants optimized for engagement
                    </p>
                    <Button onClick={handleGenerateVariants} disabled={isGeneratingVariants} data-testid="button-generate-first-variants">
                      {isGeneratingVariants ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Generate AI Variants
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="insights" className="space-y-4 m-0 px-1">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Predicted Performance
                    </h4>
                    <Card>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">
                              {localData.type === 'email' ? '42.3%' : localData.type === 'linkedin_connect' ? '57.9%' : '36.3%'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {localData.type === 'email' ? 'Open Rate' : localData.type === 'linkedin_connect' ? 'Accept Rate' : 'Reply Rate'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">
                              {localData.type === 'email' ? '18.7%' : localData.type === 'linkedin_connect' ? '22.5%' : '12.4%'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {localData.type === 'email' ? 'Click Rate' : 'Response Rate'}
                            </div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-purple-600">
                              {localData.type === 'email' ? '6.7%' : localData.type === 'linkedin_connect' ? '8.2%' : '4.1%'}
                            </div>
                            <div className="text-xs text-muted-foreground">Conversion Rate</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Sophia's Recommendations
                    </h4>
                    <div className="space-y-3">
                      {insights.map((insight, idx) => (
                        <Card key={idx} className={`border-l-4 ${
                          insight.type === 'tip' ? 'border-l-blue-500' :
                          insight.type === 'warning' ? 'border-l-yellow-500' :
                          'border-l-green-500'
                        }`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  {insight.type === 'tip' && <Lightbulb className="h-4 w-4 text-blue-500" />}
                                  {insight.type === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                                  {insight.type === 'success' && <Check className="h-4 w-4 text-green-500" />}
                                  <span className="font-medium text-sm">{insight.title}</span>
                                </div>
                                <p className="text-sm text-muted-foreground">{insight.description}</p>
                              </div>
                              {insight.action && (
                                <Button size="sm" variant="outline" className="shrink-0 ml-2">
                                  {insight.action}
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Best Practices for {localData.type.replace('_', ' ').charAt(0).toUpperCase() + localData.type.replace('_', ' ').slice(1)}
                    </h4>
                    <Card>
                      <CardContent className="p-4">
                        <ul className="space-y-2 text-sm">
                          {localData.type === 'email' && (
                            <>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Keep subject lines under 50 characters
                              </li>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Use personalization in the first line
                              </li>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Include a clear, single call-to-action
                              </li>
                            </>
                          )}
                          {localData.type === 'linkedin_connect' && (
                            <>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Keep connection notes under 300 characters
                              </li>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Reference something specific about them
                              </li>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Don't pitch in the connection request
                              </li>
                            </>
                          )}
                          {localData.type === 'sms' && (
                            <>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Keep messages under 160 characters
                              </li>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Identify yourself clearly
                              </li>
                              <li className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                Send during business hours only
                              </li>
                            </>
                          )}
                        </ul>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="space-y-4 m-0 px-1">
                <div className="space-y-4">
                  {stepIndex > 0 && (
                    <div>
                      <Label>Delay Before This Step</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        How long to wait after the previous step before executing this one
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={localData.delay || 2}
                          onChange={(e) => setLocalData({ ...localData, delay: parseInt(e.target.value) || 2 })}
                          className="w-24"
                          min={0}
                          data-testid="input-step-delay"
                        />
                        <Select
                          value={localData.delayUnit || 'days'}
                          onValueChange={(value: 'hours' | 'days' | 'weeks') => 
                            setLocalData({ ...localData, delayUnit: value })
                          }
                        >
                          <SelectTrigger className="w-32" data-testid="select-step-delay-unit">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hours">Hours</SelectItem>
                            <SelectItem value="days">Days</SelectItem>
                            <SelectItem value="weeks">Weeks</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label>Send Window</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Only send during these times (in recipient's timezone)
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs">Start Time</Label>
                        <Select 
                          value={localData.sendWindowStart || '09:00'}
                          onValueChange={(value) => setLocalData({ ...localData, sendWindowStart: value })}
                        >
                          <SelectTrigger data-testid="select-send-start">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="08:00">8:00 AM</SelectItem>
                            <SelectItem value="09:00">9:00 AM</SelectItem>
                            <SelectItem value="10:00">10:00 AM</SelectItem>
                            <SelectItem value="11:00">11:00 AM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">End Time</Label>
                        <Select 
                          value={localData.sendWindowEnd || '17:00'}
                          onValueChange={(value) => setLocalData({ ...localData, sendWindowEnd: value })}
                        >
                          <SelectTrigger data-testid="select-send-end">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="16:00">4:00 PM</SelectItem>
                            <SelectItem value="17:00">5:00 PM</SelectItem>
                            <SelectItem value="18:00">6:00 PM</SelectItem>
                            <SelectItem value="19:00">7:00 PM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>Active Days</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Only send on these days
                    </p>
                    <div className="flex gap-1">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                        const isActive = localData.activeDays?.includes(day) ?? false;
                        return (
                          <Button
                            key={day}
                            size="sm"
                            variant={isActive ? 'default' : 'outline'}
                            className="w-12 h-8"
                            onClick={() => {
                              const currentDays = localData.activeDays || [];
                              const newDays = isActive
                                ? currentDays.filter(d => d !== day)
                                : [...currentDays, day];
                              setLocalData({ ...localData, activeDays: newDays });
                            }}
                            data-testid={`button-day-${day.toLowerCase()}`}
                          >
                            {day}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Sophia Auto-Optimization
                    </Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Let Sophia automatically adjust timing based on recipient behavior
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Sophia will optimize send times for each recipient
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-step">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-step">
            <Check className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
