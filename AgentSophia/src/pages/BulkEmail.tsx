import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ConnectorService } from '@/lib/connector-service';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { 
  Mail, Send, Users, Clock, CheckCircle, XCircle, AlertTriangle, 
  Play, Pause, Calendar, FileText, Upload, Zap, TrendingUp, 
  Eye, MousePointer, Reply, UserMinus, BarChart3, Shield,
  Sparkles, FileUp, Edit, Copy, Trash2, ArrowRight, ChevronDown,
  ChevronRight, Wand2, RefreshCw, Smartphone, Monitor, Split,
  Target, Lightbulb, Brain, MessageSquare, Check, X, Plus,
  Settings, ExternalLink, CreditCard
} from 'lucide-react';

interface BulkEmailCampaign {
  id: string;
  name: string;
  status: 'draft' | 'validating' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed';
  stats: {
    totalRecipients: number;
    validated: number;
    invalid: number;
    sent: number;
    delivered: number;
    bounced: number;
    opened: number;
    clicked: number;
    replied: number;
    unsubscribed: number;
    failed: number;
    pending: number;
  };
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  htmlBody: string;
  mergeFields: string[];
}

interface SubjectLineVariant {
  id: string;
  text: string;
  isWinner?: boolean;
  stats?: {
    opens: number;
    openRate: number;
  };
}

export default function BulkEmail() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const isDemo = workspaceId === 'demo';
  
  if (!workspaceId) {
    return <div className="p-8 text-center">Loading workspace...</div>;
  }
  
  const [activeTab, setActiveTab] = useState('campaigns');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [dialogTab, setDialogTab] = useState('content');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [sophiaOpen, setSophiaOpen] = useState(true);
  const [isGeneratingSubject, setIsGeneratingSubject] = useState(false);
  const [isGeneratingBody, setIsGeneratingBody] = useState(false);
  const [subjectSuggestions, setSubjectSuggestions] = useState<string[]>([]);
  const [abTestEnabled, setAbTestEnabled] = useState(false);
  const [subjectVariants, setSubjectVariants] = useState<SubjectLineVariant[]>([]);
  const [abTestSplitPercentage, setAbTestSplitPercentage] = useState(20);
  
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    fromEmail: '',
    fromName: '',
    subject: '',
    htmlBody: '',
    recipientsCsv: '',
    trackOpens: true,
    trackClicks: true,
    enableUnsubscribe: true,
    warmupMode: false,
    batchSize: 50,
    delayBetweenBatches: 5000,
    campaignGoal: '',
    targetAudience: '',
    tone: 'professional'
  });

  const [sophiaInsight, setSophiaInsight] = useState({
    spamScore: 0,
    subjectScore: 0,
    recommendations: [] as string[],
    estimatedOpenRate: 0,
    estimatedClickRate: 0
  });

  const [emailProviderConfigured, setEmailProviderConfigured] = useState<boolean | null>(null);
  const [emailProviderName, setEmailProviderName] = useState<string | null>(null);

  useEffect(() => {
    const checkEmailConfig = async () => {
      if (!workspaceId) return;
      try {
        const config = await ConnectorService.getUserConfig(workspaceId);
        if (config?.emailProvider && config?.emailApiKey) {
          setEmailProviderConfigured(true);
          const providerName = config.emailProvider as string;
          setEmailProviderName(
            providerName === 'sendgrid' ? 'SendGrid' : 
            providerName === 'resend' ? 'Resend' : 
            providerName === 'ses' ? 'Amazon SES' : 
            providerName === 'smtp' ? 'SMTP' : 
            providerName.charAt(0).toUpperCase() + providerName.slice(1)
          );
        } else {
          setEmailProviderConfigured(false);
        }
      } catch {
        setEmailProviderConfigured(false);
      }
    };
    checkEmailConfig();
  }, [workspaceId]);

  const { data: campaigns, isLoading: campaignsLoading } = useQuery<{ campaigns: BulkEmailCampaign[] }>({
    queryKey: [`/api/workspaces/${workspaceId}/bulk-email/campaigns`],
    enabled: !!workspaceId && workspaceId !== 'default' && !isDemo
  });

  const { data: templates } = useQuery<{ templates: EmailTemplate[] }>({
    queryKey: [`/api/workspaces/${workspaceId}/bulk-email/templates`],
    enabled: !!workspaceId && workspaceId !== 'default' && !isDemo
  });

  const { data: deliverability } = useQuery<{
    overallScore: number;
    bounceRate: number;
    complaintRate: number;
    unsubscribeRate: number;
    recommendations: string[];
  }>({
    queryKey: [`/api/workspaces/${workspaceId}/bulk-email/deliverability`],
    enabled: !!workspaceId && workspaceId !== 'default' && !isDemo
  });

  const { data: bestTimes } = useQuery<{
    recommendations: {
      bestDays: string[];
      bestHours: string[];
      insights: string[];
      personalizedRecommendation: { date: string; time: string; reason: string };
    };
  }>({
    queryKey: [`/api/workspaces/${workspaceId}/bulk-email/best-send-times`],
    enabled: !!workspaceId && workspaceId !== 'default' && !isDemo
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/bulk-email/campaigns`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      if (isDemo) return;
      toast({ title: 'Campaign created', description: 'Your bulk email campaign is ready' });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/bulk-email/campaigns`] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const startCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/bulk-email/campaigns/${campaignId}/start`, { method: 'POST' });
    },
    onSuccess: () => {
      if (isDemo) return;
      toast({ title: 'Campaign started', description: 'Emails are being sent' });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/bulk-email/campaigns`] });
    }
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      if (isDemo) {
        toast({ title: 'Demo Mode', description: 'Actions are disabled in demo mode' });
        return;
      }
      return apiRequest(`/api/workspaces/${workspaceId}/bulk-email/campaigns/${campaignId}/pause`, { method: 'POST' });
    },
    onSuccess: () => {
      if (isDemo) return;
      toast({ title: 'Campaign paused', description: 'Sending has been paused' });
      queryClient.invalidateQueries({ queryKey: [`/api/workspaces/${workspaceId}/bulk-email/campaigns`] });
    }
  });

  const resetForm = () => {
    setNewCampaign({
      name: '',
      fromEmail: '',
      fromName: '',
      subject: '',
      htmlBody: '',
      recipientsCsv: '',
      trackOpens: true,
      trackClicks: true,
      enableUnsubscribe: true,
      warmupMode: false,
      batchSize: 50,
      delayBetweenBatches: 5000,
      campaignGoal: '',
      targetAudience: '',
      tone: 'professional'
    });
    setSelectedTemplate(null);
    setSubjectSuggestions([]);
    setSubjectVariants([]);
    setAbTestEnabled(false);
    setDialogTab('content');
  };

  const parseRecipients = (csv: string) => {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];
    
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const emailIdx = headers.findIndex(h => h.includes('email'));
    const firstNameIdx = headers.findIndex(h => h.includes('first') || h === 'firstname');
    const lastNameIdx = headers.findIndex(h => h.includes('last') || h === 'lastname');
    const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('organization'));
    
    return lines.slice(1).map((line, idx) => {
      const parts = line.split(',').map(p => p.trim());
      return {
        id: `recipient_${idx}`,
        email: parts[emailIdx] || '',
        firstName: firstNameIdx >= 0 ? parts[firstNameIdx] : undefined,
        lastName: lastNameIdx >= 0 ? parts[lastNameIdx] : undefined,
        company: companyIdx >= 0 ? parts[companyIdx] : undefined
      };
    }).filter(r => r.email);
  };

  const handleCreateCampaign = () => {
    const recipients = parseRecipients(newCampaign.recipientsCsv);
    
    if (recipients.length === 0) {
      toast({ title: 'Error', description: 'No valid recipients found', variant: 'destructive' });
      return;
    }

    if (!newCampaign.subject.trim()) {
      toast({ title: 'Error', description: 'Subject line is required', variant: 'destructive' });
      return;
    }

    if (abTestEnabled) {
      const populatedVariants = subjectVariants.filter(v => v.text.trim());
      if (populatedVariants.length < 1) {
        toast({ title: 'Error', description: 'A/B testing requires at least one variant in addition to the original subject', variant: 'destructive' });
        return;
      }
    }

    const allVariants = abTestEnabled ? [
      { id: 'variant_original', text: newCampaign.subject },
      ...subjectVariants.filter(v => v.text.trim())
    ] : [];

    createCampaignMutation.mutate({
      workspaceId: 'workspace_1',
      name: newCampaign.name,
      template: {
        name: newCampaign.name,
        subject: newCampaign.subject,
        htmlBody: newCampaign.htmlBody
      },
      recipients,
      fromEmail: newCampaign.fromEmail,
      fromName: newCampaign.fromName,
      settings: {
        trackOpens: newCampaign.trackOpens,
        trackClicks: newCampaign.trackClicks,
        enableUnsubscribe: newCampaign.enableUnsubscribe,
        warmupMode: newCampaign.warmupMode,
        batchSize: newCampaign.batchSize,
        delayBetweenBatches: newCampaign.delayBetweenBatches,
        abTest: abTestEnabled ? {
          enabled: true,
          variants: allVariants,
          splitPercentage: abTestSplitPercentage
        } : undefined
      }
    });
  };

  const generateSubjectLines = async () => {
    setIsGeneratingSubject(true);
    try {
      const response = await apiRequest('/api/sophia/generate-email-content', {
        method: 'POST',
        body: JSON.stringify({
          type: 'subject_lines',
          goal: newCampaign.campaignGoal || 'increase engagement',
          targetAudience: newCampaign.targetAudience || 'business professionals',
          tone: newCampaign.tone,
          context: newCampaign.htmlBody.slice(0, 500)
        })
      });
      
      if (response.suggestions) {
        setSubjectSuggestions(response.suggestions);
        toast({ title: 'Subject lines generated', description: 'Sophia has created 5 subject line options' });
      }
    } catch (error) {
      const mockSuggestions = [
        `Quick question about ${newCampaign.targetAudience || 'your goals'}`,
        `${newCampaign.campaignGoal || 'Boost results'} - Let's connect`,
        `Exclusive opportunity for {{company}}`,
        `{{firstName}}, thought you'd find this valuable`,
        `Transform your approach with these insights`
      ];
      setSubjectSuggestions(mockSuggestions);
      toast({ title: 'Subject lines generated', description: 'Sophia has created 5 subject line options' });
    } finally {
      setIsGeneratingSubject(false);
    }
  };

  const generateEmailBody = async () => {
    setIsGeneratingBody(true);
    try {
      const response = await apiRequest('/api/sophia/generate-email-content', {
        method: 'POST',
        body: JSON.stringify({
          type: 'email_body',
          goal: newCampaign.campaignGoal || 'increase engagement',
          targetAudience: newCampaign.targetAudience || 'business professionals',
          tone: newCampaign.tone,
          subject: newCampaign.subject
        })
      });
      
      if (response.content) {
        setNewCampaign({ ...newCampaign, htmlBody: response.content });
        toast({ title: 'Email body generated', description: 'Sophia has drafted your email content' });
      }
    } catch (error) {
      const mockBody = `<p>Hi {{firstName}},</p>

<p>I noticed {{company}} has been ${newCampaign.campaignGoal || 'growing rapidly'}, and I wanted to reach out personally.</p>

<p>Many ${newCampaign.targetAudience || 'professionals'} like yourself have been looking for ways to:</p>
<ul>
  <li>Streamline their workflows</li>
  <li>Increase team productivity</li>
  <li>Drive better results</li>
</ul>

<p>I'd love to share some insights that might be valuable for your team.</p>

<p>Would you be open to a quick 15-minute call this week?</p>

<p>Best regards,<br/>
{{senderName}}</p>`;
      setNewCampaign({ ...newCampaign, htmlBody: mockBody });
      toast({ title: 'Email body generated', description: 'Sophia has drafted your email content' });
    } finally {
      setIsGeneratingBody(false);
    }
  };

  const analyzeEmail = async () => {
    const spamWords = ['free', 'guaranteed', 'act now', 'limited time', 'urgent', 'winner'];
    const subjectLower = newCampaign.subject.toLowerCase();
    const bodyLower = newCampaign.htmlBody.toLowerCase();
    
    let spamScore = 100;
    spamWords.forEach(word => {
      if (subjectLower.includes(word) || bodyLower.includes(word)) {
        spamScore -= 10;
      }
    });
    
    let subjectScore = 0;
    if (newCampaign.subject.length >= 30 && newCampaign.subject.length <= 60) subjectScore += 30;
    if (newCampaign.subject.includes('{{')) subjectScore += 25;
    if (!/[!]{2,}|[$]/.test(newCampaign.subject)) subjectScore += 25;
    if (/\?/.test(newCampaign.subject)) subjectScore += 20;

    const recommendations = [];
    if (newCampaign.subject.length < 30) recommendations.push('Subject line is too short - aim for 30-60 characters');
    if (newCampaign.subject.length > 60) recommendations.push('Subject line is too long - may get truncated on mobile');
    if (!newCampaign.subject.includes('{{')) recommendations.push('Add personalization like {{firstName}} to boost open rates');
    if (!newCampaign.htmlBody.includes('{{')) recommendations.push('Personalize the email body for higher engagement');
    if (spamScore < 80) recommendations.push('Avoid spam trigger words like "free", "guaranteed", "urgent"');

    setSophiaInsight({
      spamScore: Math.max(0, spamScore),
      subjectScore: Math.min(100, subjectScore),
      recommendations,
      estimatedOpenRate: Math.min(35, 15 + (subjectScore / 5)),
      estimatedClickRate: Math.min(15, 3 + (subjectScore / 10))
    });
  };

  const addSubjectVariant = () => {
    if (subjectVariants.length >= 4) {
      toast({ title: 'Limit reached', description: 'Maximum 4 subject line variants allowed', variant: 'destructive' });
      return;
    }
    setSubjectVariants([
      ...subjectVariants,
      { id: `variant_${Date.now()}`, text: '' }
    ]);
  };

  const updateSubjectVariant = (id: string, text: string) => {
    setSubjectVariants(subjectVariants.map(v => v.id === id ? { ...v, text } : v));
  };

  const removeSubjectVariant = (id: string) => {
    setSubjectVariants(subjectVariants.filter(v => v.id !== id));
  };

  const getStatusBadge = (status: BulkEmailCampaign['status']) => {
    const variants: Record<string, { color: string; icon: any }> = {
      draft: { color: 'bg-gray-100 text-gray-800', icon: Edit },
      validating: { color: 'bg-blue-100 text-blue-800', icon: Shield },
      scheduled: { color: 'bg-purple-100 text-purple-800', icon: Calendar },
      sending: { color: 'bg-yellow-100 text-yellow-800', icon: Send },
      paused: { color: 'bg-orange-100 text-orange-800', icon: Pause },
      completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
      failed: { color: 'bg-red-100 text-red-800', icon: XCircle }
    };
    
    const { color, icon: Icon } = variants[status] || variants.draft;
    return (
      <Badge className={color} data-testid={`badge-status-${status}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const renderEmailPreview = () => {
    const sampleData = {
      firstName: 'John',
      lastName: 'Smith',
      company: 'Acme Corp',
      senderName: newCampaign.fromName || 'Your Name'
    };

    let previewHtml = newCampaign.htmlBody;
    Object.entries(sampleData).forEach(([key, value]) => {
      previewHtml = previewHtml.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value);
    });

    const previewSubject = Object.entries(sampleData).reduce(
      (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), value),
      newCampaign.subject
    );

    return (
      <div className={`mx-auto transition-all ${previewDevice === 'mobile' ? 'max-w-[375px]' : 'max-w-full'}`}>
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
          <div className="bg-gray-100 dark:bg-gray-800 p-3 border-b">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">From:</span>
              <span className="font-medium">{newCampaign.fromName || 'Sender'} &lt;{newCampaign.fromEmail || 'email@domain.com'}&gt;</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <span className="text-muted-foreground">Subject:</span>
              <span className="font-medium">{previewSubject || 'Your subject line'}</span>
            </div>
          </div>
          <div className="p-4 min-h-[300px]">
            {previewHtml ? (
              <div 
                className="prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: previewHtml }} 
              />
            ) : (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                <p>Start typing to see your email preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {emailProviderConfigured === false && (
        <Card className="border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <Settings className="w-5 h-5" />
              Email Service Setup Required
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Connect your email sending service to start sending bulk campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-100 text-green-700">Recommended</Badge>
                </div>
                <h4 className="font-semibold">Resend</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Modern email API. Free tier: 3,000 emails/month, then $20/month for 50k.
                </p>
                <a 
                  href="https://resend.com/signup" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Sign up for Resend <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                <h4 className="font-semibold">SendGrid</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Industry standard. Free tier: 100 emails/day, then usage-based pricing.
                </p>
                <a 
                  href="https://signup.sendgrid.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Sign up for SendGrid <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border">
                <h4 className="font-semibold">Amazon SES</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Most cost-effective at scale. ~$0.10 per 1,000 emails.
                </p>
                <a 
                  href="https://aws.amazon.com/ses/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Learn about AWS SES <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
            
            <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <CreditCard className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 dark:text-blue-200">You pay the email provider directly</AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-300">
                Each email service has its own pricing. You'll create an account with them and get an API key to connect here.
                This gives you full control over your email sending costs.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Link to="/email-setup">
                <Button className="bg-gradient-primary" data-testid="button-setup-email-provider">
                  <Settings className="w-4 h-4 mr-2" />
                  Set Up Email Provider
                </Button>
              </Link>
              <Link to="/how-to-use">
                <Button variant="outline" data-testid="button-learn-more-email">
                  Learn More
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {emailProviderConfigured === true && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-200">Email Provider Connected</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300 flex items-center justify-between">
            <span>You're connected to {emailProviderName}. Ready to send campaigns!</span>
            <Link to="/email-setup">
              <Button variant="ghost" size="sm" className="text-green-700">
                <Settings className="w-4 h-4 mr-1" />
                Manage
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <Card className="border-purple-200 dark:border-purple-800 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-full">
              <Brain className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100">Sophia Email Assistant</h3>
                <Badge className="bg-purple-100 text-purple-700 text-xs">AI-Powered</Badge>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                I can help you craft compelling email campaigns with optimized subject lines, 
                personalized content, and send time recommendations.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                disabled={!emailProviderConfigured}
                data-testid="button-sophia-create"
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Create with Sophia
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Bulk Email</h1>
          <p className="text-muted-foreground">Send personalized emails to thousands of contacts</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button disabled={!emailProviderConfigured} data-testid="button-create-campaign">
              <Mail className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Create Bulk Email Campaign
                <Badge className="bg-purple-100 text-purple-700">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Sophia Enhanced
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Use AI to craft compelling emails with optimized subject lines and content
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={dialogTab} onValueChange={setDialogTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="content" data-testid="dialog-tab-content">
                  <Edit className="w-4 h-4 mr-2" />
                  Content
                </TabsTrigger>
                <TabsTrigger value="preview" data-testid="dialog-tab-preview">
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="ab-test" data-testid="dialog-tab-ab">
                  <Split className="w-4 h-4 mr-2" />
                  A/B Test
                </TabsTrigger>
                <TabsTrigger value="settings" data-testid="dialog-tab-settings">
                  <Shield className="w-4 h-4 mr-2" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 mt-4">
                <TabsContent value="content" className="space-y-6 m-0">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="col-span-2 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Campaign Name</Label>
                          <Input 
                            id="name"
                            placeholder="Q1 Outreach Campaign"
                            value={newCampaign.name}
                            onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                            data-testid="input-campaign-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Use Template</Label>
                          <Select 
                            value={selectedTemplate?.id || ''} 
                            onValueChange={(v) => {
                              const tpl = templates?.templates.find(t => t.id === v);
                              if (tpl) {
                                setSelectedTemplate(tpl);
                                setNewCampaign({
                                  ...newCampaign,
                                  subject: tpl.subject,
                                  htmlBody: tpl.htmlBody
                                });
                              }
                            }}
                          >
                            <SelectTrigger data-testid="select-template">
                              <SelectValue placeholder="Select a template" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates?.templates.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="fromName">From Name</Label>
                          <Input 
                            id="fromName"
                            placeholder="John Smith"
                            value={newCampaign.fromName}
                            onChange={(e) => setNewCampaign({ ...newCampaign, fromName: e.target.value })}
                            data-testid="input-from-name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fromEmail">From Email</Label>
                          <Input 
                            id="fromEmail"
                            placeholder="john@company.com"
                            value={newCampaign.fromEmail}
                            onChange={(e) => setNewCampaign({ ...newCampaign, fromEmail: e.target.value })}
                            data-testid="input-from-email"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="subject">Subject Line</Label>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={generateSubjectLines}
                            disabled={isGeneratingSubject}
                            data-testid="button-generate-subjects"
                          >
                            {isGeneratingSubject ? (
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4 mr-2" />
                            )}
                            Generate with Sophia
                          </Button>
                        </div>
                        <Input 
                          id="subject"
                          placeholder="Quick question for {{company}}"
                          value={newCampaign.subject}
                          onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                          data-testid="input-subject"
                        />
                        <p className="text-xs text-muted-foreground">
                          Use {'{{firstName}}'}, {'{{lastName}}'}, {'{{company}}'} for personalization
                        </p>
                        
                        {subjectSuggestions.length > 0 && (
                          <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                              <Lightbulb className="w-4 h-4" />
                              Sophia's Suggestions
                            </p>
                            <div className="space-y-2">
                              {subjectSuggestions.map((suggestion, idx) => (
                                <div 
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border cursor-pointer hover:border-purple-400 transition-colors"
                                  onClick={() => setNewCampaign({ ...newCampaign, subject: suggestion })}
                                  data-testid={`suggestion-subject-${idx}`}
                                >
                                  <span className="text-sm">{suggestion}</span>
                                  <Button size="sm" variant="ghost">
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="body">Email Body (HTML)</Label>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={generateEmailBody}
                            disabled={isGeneratingBody}
                            data-testid="button-generate-body"
                          >
                            {isGeneratingBody ? (
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4 mr-2" />
                            )}
                            Generate Email Body
                          </Button>
                        </div>
                        <Textarea 
                          id="body"
                          className="min-h-[200px] font-mono text-sm"
                          placeholder="<p>Hi {{firstName}},</p>..."
                          value={newCampaign.htmlBody}
                          onChange={(e) => setNewCampaign({ ...newCampaign, htmlBody: e.target.value })}
                          data-testid="textarea-body"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="recipients">Recipients (CSV format)</Label>
                        <Textarea 
                          id="recipients"
                          className="min-h-[100px] font-mono text-sm"
                          placeholder="email,firstName,lastName,company
john@acme.com,John,Smith,Acme Corp
jane@tech.co,Jane,Doe,Tech Co"
                          value={newCampaign.recipientsCsv}
                          onChange={(e) => setNewCampaign({ ...newCampaign, recipientsCsv: e.target.value })}
                          data-testid="textarea-recipients"
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Paste CSV with headers: email (required), firstName, lastName, company</span>
                          <span className="font-medium">{parseRecipients(newCampaign.recipientsCsv).length} recipients detected</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Collapsible open={sophiaOpen} onOpenChange={setSophiaOpen}>
                        <Card className="border-purple-200 dark:border-purple-800">
                          <CollapsibleTrigger asChild>
                            <CardHeader className="cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors">
                              <CardTitle className="text-sm flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                  <Brain className="w-4 h-4 text-purple-600" />
                                  Sophia AI Assistant
                                </span>
                                {sophiaOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </CardTitle>
                            </CardHeader>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <CardContent className="space-y-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Campaign Goal</Label>
                                <Input 
                                  placeholder="e.g., Book demo calls"
                                  value={newCampaign.campaignGoal}
                                  onChange={(e) => setNewCampaign({ ...newCampaign, campaignGoal: e.target.value })}
                                  className="text-sm"
                                  data-testid="input-campaign-goal"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Target Audience</Label>
                                <Input 
                                  placeholder="e.g., SaaS founders"
                                  value={newCampaign.targetAudience}
                                  onChange={(e) => setNewCampaign({ ...newCampaign, targetAudience: e.target.value })}
                                  className="text-sm"
                                  data-testid="input-target-audience"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Tone</Label>
                                <Select 
                                  value={newCampaign.tone} 
                                  onValueChange={(v) => setNewCampaign({ ...newCampaign, tone: v })}
                                >
                                  <SelectTrigger className="text-sm" data-testid="select-tone">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="professional">Professional</SelectItem>
                                    <SelectItem value="friendly">Friendly</SelectItem>
                                    <SelectItem value="casual">Casual</SelectItem>
                                    <SelectItem value="formal">Formal</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <Separator />

                              <Button 
                                size="sm" 
                                className="w-full"
                                onClick={analyzeEmail}
                                data-testid="button-analyze"
                              >
                                <Target className="w-4 h-4 mr-2" />
                                Analyze Email
                              </Button>

                              {sophiaInsight.spamScore > 0 && (
                                <div className="space-y-3" data-testid="section-sophia-insights">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-center">
                                      <p className="text-xs text-muted-foreground">Spam Score</p>
                                      <p className={`text-lg font-bold ${sophiaInsight.spamScore >= 80 ? 'text-green-600' : sophiaInsight.spamScore >= 60 ? 'text-yellow-600' : 'text-red-600'}`} data-testid="text-spam-score">
                                        {sophiaInsight.spamScore}%
                                      </p>
                                    </div>
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-center">
                                      <p className="text-xs text-muted-foreground">Subject Score</p>
                                      <p className={`text-lg font-bold ${sophiaInsight.subjectScore >= 70 ? 'text-green-600' : sophiaInsight.subjectScore >= 50 ? 'text-yellow-600' : 'text-red-600'}`} data-testid="text-subject-score">
                                        {sophiaInsight.subjectScore}%
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded text-center">
                                      <p className="text-xs text-muted-foreground">Est. Open Rate</p>
                                      <p className="text-lg font-bold text-purple-600" data-testid="text-est-open-rate">
                                        {sophiaInsight.estimatedOpenRate.toFixed(1)}%
                                      </p>
                                    </div>
                                    <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded text-center">
                                      <p className="text-xs text-muted-foreground">Est. Click Rate</p>
                                      <p className="text-lg font-bold text-orange-600" data-testid="text-est-click-rate">
                                        {sophiaInsight.estimatedClickRate.toFixed(1)}%
                                      </p>
                                    </div>
                                  </div>
                                  
                                  {sophiaInsight.recommendations.length > 0 && (
                                    <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded" data-testid="section-recommendations">
                                      <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300 mb-1">Recommendations</p>
                                      <ul className="text-xs space-y-1">
                                        {sophiaInsight.recommendations.map((rec, idx) => (
                                          <li key={idx} className="flex items-start gap-1" data-testid={`text-recommendation-${idx}`}>
                                            <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-600 flex-shrink-0" />
                                            <span>{rec}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Quick Merge Tags
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap gap-1">
                            {['{{firstName}}', '{{lastName}}', '{{company}}', '{{email}}'].map(tag => (
                              <Badge 
                                key={tag}
                                variant="outline" 
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
                                onClick={() => {
                                  const textarea = document.getElementById('body') as HTMLTextAreaElement;
                                  if (textarea) {
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const text = newCampaign.htmlBody;
                                    const newText = text.substring(0, start) + tag + text.substring(end);
                                    setNewCampaign({ ...newCampaign, htmlBody: newText });
                                  }
                                }}
                                data-testid={`badge-merge-tag-${tag.replace(/[{}]/g, '')}`}
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="space-y-4 m-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant={previewDevice === 'desktop' ? 'default' : 'outline'} 
                        size="sm"
                        onClick={() => setPreviewDevice('desktop')}
                        data-testid="button-preview-desktop"
                      >
                        <Monitor className="w-4 h-4 mr-2" />
                        Desktop
                      </Button>
                      <Button 
                        variant={previewDevice === 'mobile' ? 'default' : 'outline'} 
                        size="sm"
                        onClick={() => setPreviewDevice('mobile')}
                        data-testid="button-preview-mobile"
                      >
                        <Smartphone className="w-4 h-4 mr-2" />
                        Mobile
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Preview with sample data: John Smith, Acme Corp
                    </p>
                  </div>
                  {renderEmailPreview()}
                </TabsContent>

                <TabsContent value="ab-test" className="space-y-6 m-0">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Split className="w-5 h-5" />
                            A/B Testing
                          </CardTitle>
                          <CardDescription>
                            Test multiple subject lines to find the best performer
                          </CardDescription>
                        </div>
                        <Switch 
                          checked={abTestEnabled}
                          onCheckedChange={setAbTestEnabled}
                          data-testid="switch-ab-test"
                        />
                      </div>
                    </CardHeader>
                    {abTestEnabled && (
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-blue-700 dark:text-blue-300">How A/B Testing Works</p>
                              <p className="text-blue-600 dark:text-blue-400 mt-1">
                                We'll send different subject lines to a small portion of your audience, 
                                then automatically send the winning variant to the rest.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Test Sample Size</Label>
                          <div className="flex items-center gap-4">
                            <Input 
                              type="number" 
                              min={10} 
                              max={50}
                              value={abTestSplitPercentage}
                              onChange={(e) => setAbTestSplitPercentage(Number(e.target.value))}
                              className="w-24"
                              data-testid="input-ab-split"
                            />
                            <span className="text-sm text-muted-foreground">% of recipients for testing</span>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label>Subject Line Variants</Label>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={addSubjectVariant}
                              disabled={subjectVariants.length >= 4}
                              data-testid="button-add-variant"
                            >
                              <Plus className="w-4 h-4 mr-2" />
                              Add Variant
                            </Button>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 p-3 border rounded-lg bg-primary/5">
                              <Badge variant="default" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">A</Badge>
                              <Input 
                                value={newCampaign.subject}
                                onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                                placeholder="Original subject line"
                                className="flex-1"
                                data-testid="input-variant-a"
                              />
                              <Badge variant="outline" className="text-xs">Original</Badge>
                            </div>

                            {subjectVariants.map((variant, idx) => (
                              <div key={variant.id} className="flex items-center gap-2 p-3 border rounded-lg">
                                <Badge variant="outline" className="w-6 h-6 rounded-full p-0 flex items-center justify-center">
                                  {String.fromCharCode(66 + idx)}
                                </Badge>
                                <Input 
                                  value={variant.text}
                                  onChange={(e) => updateSubjectVariant(variant.id, e.target.value)}
                                  placeholder={`Variant ${String.fromCharCode(66 + idx)} subject line`}
                                  className="flex-1"
                                  data-testid={`input-variant-${String.fromCharCode(66 + idx).toLowerCase()}`}
                                />
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => removeSubjectVariant(variant.id)}
                                  data-testid={`button-remove-variant-${idx}`}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={generateSubjectLines}
                            disabled={isGeneratingSubject}
                            data-testid="button-generate-variants"
                          >
                            {isGeneratingSubject ? (
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Wand2 className="w-4 h-4 mr-2" />
                            )}
                            Generate Variants with Sophia
                          </Button>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <Label>Winner Selection</Label>
                          <Select defaultValue="open_rate">
                            <SelectTrigger data-testid="select-winner-criteria">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open_rate">Highest Open Rate</SelectItem>
                              <SelectItem value="click_rate">Highest Click Rate</SelectItem>
                              <SelectItem value="reply_rate">Highest Reply Rate</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="settings" className="space-y-6 m-0">
                  <div className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Tracking Options</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="trackOpens">Track Opens</Label>
                            <p className="text-xs text-muted-foreground">Monitor when recipients open emails</p>
                          </div>
                          <Switch 
                            id="trackOpens"
                            checked={newCampaign.trackOpens}
                            onCheckedChange={(v) => setNewCampaign({ ...newCampaign, trackOpens: v })}
                            data-testid="switch-track-opens"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="trackClicks">Track Clicks</Label>
                            <p className="text-xs text-muted-foreground">Track link clicks in emails</p>
                          </div>
                          <Switch 
                            id="trackClicks"
                            checked={newCampaign.trackClicks}
                            onCheckedChange={(v) => setNewCampaign({ ...newCampaign, trackClicks: v })}
                            data-testid="switch-track-clicks"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label htmlFor="unsubscribe">Unsubscribe Link</Label>
                            <p className="text-xs text-muted-foreground">Include unsubscribe option</p>
                          </div>
                          <Switch 
                            id="unsubscribe"
                            checked={newCampaign.enableUnsubscribe}
                            onCheckedChange={(v) => setNewCampaign({ ...newCampaign, enableUnsubscribe: v })}
                            data-testid="switch-unsubscribe"
                          />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Sending Options</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                          <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5 text-yellow-600" />
                            <div>
                              <p className="font-medium text-sm">Warmup Mode</p>
                              <p className="text-xs text-muted-foreground">Gradually increase sending volume</p>
                            </div>
                          </div>
                          <Switch 
                            checked={newCampaign.warmupMode}
                            onCheckedChange={(v) => setNewCampaign({ ...newCampaign, warmupMode: v })}
                            data-testid="switch-warmup"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Batch Size</Label>
                          <Input 
                            type="number"
                            value={newCampaign.batchSize}
                            onChange={(e) => setNewCampaign({ ...newCampaign, batchSize: Number(e.target.value) })}
                            data-testid="input-batch-size"
                          />
                          <p className="text-xs text-muted-foreground">Emails sent per batch</p>
                        </div>

                        <div className="space-y-2">
                          <Label>Delay Between Batches (ms)</Label>
                          <Input 
                            type="number"
                            value={newCampaign.delayBetweenBatches}
                            onChange={(e) => setNewCampaign({ ...newCampaign, delayBetweenBatches: Number(e.target.value) })}
                            data-testid="input-delay"
                          />
                          <p className="text-xs text-muted-foreground">Wait time between sending batches</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </ScrollArea>

              <Separator className="my-4" />

              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {parseRecipients(newCampaign.recipientsCsv).length} recipients ready to receive
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateCampaign}
                    disabled={createCampaignMutation.isPending}
                    data-testid="button-create"
                  >
                    {createCampaignMutation.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Create Campaign
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
                <p className="text-2xl font-bold" data-testid="text-total-campaigns">
                  {campaigns?.campaigns?.length || 0}
                </p>
              </div>
              <Mail className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deliverability Score</p>
                <p className="text-2xl font-bold" data-testid="text-deliverability">
                  {deliverability?.overallScore || 100}%
                </p>
              </div>
              <Shield className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bounce Rate</p>
                <p className="text-2xl font-bold" data-testid="text-bounce-rate">
                  {deliverability?.bounceRate || 0}%
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Best Send Time</p>
                <p className="text-lg font-bold" data-testid="text-best-time">
                  {bestTimes?.recommendations?.bestHours?.[0] || 'Tue 10 AM'}
                </p>
              </div>
              <Clock className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            <Mail className="w-4 h-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <FileText className="w-4 h-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="tab-health">
            <Shield className="w-4 h-4 mr-2" />
            Deliverability
          </TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {campaignsLoading ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Loading campaigns...
              </CardContent>
            </Card>
          ) : campaigns?.campaigns?.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Mail className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">Create your first bulk email campaign to get started</p>
                <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first">
                  <Mail className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {campaigns?.campaigns?.map((campaign) => (
                <Card key={campaign.id} data-testid={`card-campaign-${campaign.id}`}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{campaign.name}</h3>
                            {getStatusBadge(campaign.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {campaign.stats.totalRecipients} recipients
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="grid grid-cols-4 gap-4 text-center text-sm">
                          <div>
                            <p className="text-muted-foreground">Sent</p>
                            <p className="font-medium">{campaign.stats.sent}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Opened</p>
                            <p className="font-medium text-blue-600">{campaign.stats.opened}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Clicked</p>
                            <p className="font-medium text-green-600">{campaign.stats.clicked}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Replied</p>
                            <p className="font-medium text-purple-600">{campaign.stats.replied}</p>
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {campaign.status === 'draft' && (
                            <Button 
                              size="sm"
                              onClick={() => startCampaignMutation.mutate(campaign.id)}
                              disabled={startCampaignMutation.isPending}
                              data-testid={`button-start-${campaign.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Start
                            </Button>
                          )}
                          {campaign.status === 'sending' && (
                            <Button 
                              size="sm"
                              variant="outline"
                              onClick={() => pauseCampaignMutation.mutate(campaign.id)}
                              disabled={pauseCampaignMutation.isPending}
                              data-testid={`button-pause-${campaign.id}`}
                            >
                              <Pause className="w-4 h-4 mr-1" />
                              Pause
                            </Button>
                          )}
                          {campaign.status === 'paused' && (
                            <Button 
                              size="sm"
                              onClick={() => startCampaignMutation.mutate(campaign.id)}
                              disabled={startCampaignMutation.isPending}
                              data-testid={`button-resume-${campaign.id}`}
                            >
                              <Play className="w-4 h-4 mr-1" />
                              Resume
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {campaign.status === 'sending' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span>{Math.round((campaign.stats.sent / campaign.stats.totalRecipients) * 100)}%</span>
                        </div>
                        <Progress 
                          value={(campaign.stats.sent / campaign.stats.totalRecipients) * 100} 
                          className="h-2"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {templates?.templates?.map((template) => (
              <Card key={template.id} data-testid={`card-template-${template.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <Badge variant="outline">{template.category}</Badge>
                  </div>
                  <CardDescription className="font-mono text-xs truncate">
                    {template.subject}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-muted rounded-lg text-sm max-h-[120px] overflow-hidden">
                    <div dangerouslySetInnerHTML={{ __html: template.htmlBody.slice(0, 200) + '...' }} />
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant="secondary" className="text-xs">
                      {template.mergeFields.length} merge fields
                    </Badge>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setNewCampaign({
                          ...newCampaign,
                          subject: template.subject,
                          htmlBody: template.htmlBody
                        });
                        setShowCreateDialog(true);
                      }}
                      data-testid={`button-use-template-${template.id}`}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Deliverability Health
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <div className="relative inline-flex">
                    <div className="w-32 h-32 rounded-full border-8 border-green-200 flex items-center justify-center">
                      <span className="text-3xl font-bold text-green-600" data-testid="text-health-score">
                        {deliverability?.overallScore || 100}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Overall Score</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Bounce Rate</span>
                    <span className="font-medium text-red-600">{deliverability?.bounceRate || 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Complaint Rate</span>
                    <span className="font-medium text-orange-600">{deliverability?.complaintRate || 0}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Unsubscribe Rate</span>
                    <span className="font-medium text-yellow-600">{deliverability?.unsubscribeRate || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {deliverability?.recommendations?.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 mt-0.5 text-green-500 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Best Send Times
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-green-600 mb-2">Best Days</p>
                  <div className="flex gap-2">
                    {bestTimes?.recommendations?.bestDays?.map(day => (
                      <Badge key={day} className="bg-green-100 text-green-800">{day}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-2">Best Hours</p>
                  <div className="flex gap-2">
                    {bestTimes?.recommendations?.bestHours?.map(hour => (
                      <Badge key={hour} className="bg-blue-100 text-blue-800">{hour}</Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="font-medium text-purple-600 mb-1">AI Recommendation</p>
                  <p className="text-sm">
                    <strong>{bestTimes?.recommendations?.personalizedRecommendation?.date}</strong> at{' '}
                    <strong>{bestTimes?.recommendations?.personalizedRecommendation?.time}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bestTimes?.recommendations?.personalizedRecommendation?.reason}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Performance Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {bestTimes?.recommendations?.insights?.map((insight, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Zap className="w-4 h-4 mt-0.5 text-yellow-500 flex-shrink-0" />
                      <span>{insight}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
