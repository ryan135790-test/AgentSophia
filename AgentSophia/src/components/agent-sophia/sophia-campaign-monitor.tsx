import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Activity, 
  AlertTriangle, 
  ArrowRight, 
  BarChart3, 
  CheckCircle, 
  Clock, 
  Eye, 
  Lightbulb, 
  Loader2, 
  Mail, 
  MessageSquare, 
  Pause, 
  Phone, 
  Play, 
  RefreshCw, 
  Settings, 
  Sparkles, 
  Target, 
  TrendingDown, 
  TrendingUp, 
  Zap,
  SkipForward,
  Edit,
  Users,
  Linkedin,
  UserCheck,
  XCircle,
  Clock3
} from 'lucide-react';

interface StepMetrics {
  stepId: string;
  stepNumber: number;
  channel: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

interface StepAnalysis {
  stepId: string;
  stepNumber: number;
  channel: string;
  performance: 'excellent' | 'good' | 'average' | 'below_average' | 'poor';
  healthScore: number;
  issues: string[];
  recommendations: Array<{
    type: string;
    priority: string;
    suggestion: string;
    rationale: string;
    estimatedImpact: string;
  }>;
}

interface CampaignMonitorData {
  campaignId: string;
  overallHealth: 'healthy' | 'needs_attention' | 'at_risk' | 'critical';
  overallScore: number;
  progress: {
    campaignId: string;
    campaignName: string;
    status: string;
    totalContacts: number;
    contactsInProgress: number;
    contactsCompleted: number;
    contactsOptedOut: number;
    contactsReplied: number;
    currentStep: number;
    totalSteps: number;
    progressPercent: number;
    startedAt?: string;
    estimatedCompletion?: string;
    steps: StepMetrics[];
  };
  stepAnalysis: StepAnalysis[];
  recommendations: Array<{
    type: string;
    priority: string;
    title: string;
    description: string;
    affectedSteps?: number[];
  }>;
  insights: {
    topPerformingStep: { stepNumber: number; metric: string; value: string } | null;
    bottomPerformingStep: { stepNumber: number; metric: string; value: string } | null;
    bestChannel: string | null;
    bestTimeToSend: string | null;
    engagementTrend: 'improving' | 'stable' | 'declining';
    projectedCompletionRate: number;
  };
  sophiaSummary: string;
}

interface StepContact {
  contactId: string;
  firstName: string;
  lastName: string;
  linkedinUrl?: string;
  stepStatus: 'pending' | 'sent' | 'failed';
  connectionStatus: 'none' | 'pending' | 'accepted' | 'withdrawn' | 'pending_withdrawal';
  connectionSentAt?: string;
  connectionAcceptedAt?: string;
  executedAt?: string;
  scheduledAt?: string;
}

interface StepWithContacts {
  stepIndex: number;
  channel: string;
  stats: {
    pending: number;
    sent: number;
    failed: number;
    accepted: number;
  };
  contacts: StepContact[];
}

interface SophiaCampaignMonitorProps {
  campaignId: string;
  campaignName?: string;
  onClose?: () => void;
}

const CHANNEL_ICONS: Record<string, any> = {
  email: Mail,
  linkedin: MessageSquare,
  sms: MessageSquare,
  phone: Phone,
  voicemail: Phone
};

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'bg-green-500',
  needs_attention: 'bg-yellow-500',
  at_risk: 'bg-orange-500',
  critical: 'bg-red-500'
};

const HEALTH_BG: Record<string, string> = {
  healthy: 'bg-green-50 border-green-200',
  needs_attention: 'bg-yellow-50 border-yellow-200',
  at_risk: 'bg-orange-50 border-orange-200',
  critical: 'bg-red-50 border-red-200'
};

const PERFORMANCE_COLORS: Record<string, string> = {
  excellent: 'text-green-600 bg-green-50',
  good: 'text-blue-600 bg-blue-50',
  average: 'text-gray-600 bg-gray-50',
  below_average: 'text-orange-600 bg-orange-50',
  poor: 'text-red-600 bg-red-50'
};

export function SophiaCampaignMonitor({ campaignId, campaignName, onClose }: SophiaCampaignMonitorProps) {
  const { toast } = useToast();
  const [monitorData, setMonitorData] = useState<CampaignMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingAdjustment, setApplyingAdjustment] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [stepContacts, setStepContacts] = useState<StepWithContacts[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const fetchMonitorData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    try {
      const res = await fetch(`/api/sophia/campaign-monitor/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMonitorData(data);
        }
      }
    } catch (error) {
      console.error('Error fetching campaign monitor:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchStepContacts = async () => {
    setContactsLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/contacts-by-step`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.steps) {
          setStepContacts(data.steps);
        }
      }
    } catch (error) {
      console.error('Error fetching step contacts:', error);
    } finally {
      setContactsLoading(false);
    }
  };

  useEffect(() => {
    fetchMonitorData();
    const interval = setInterval(() => fetchMonitorData(), 30000);
    return () => clearInterval(interval);
  }, [campaignId]);

  useEffect(() => {
    if (activeTab === 'contacts') {
      fetchStepContacts();
    }
  }, [activeTab, campaignId]);

  const handleApplyAdjustment = async (type: string, stepNumber?: number) => {
    setApplyingAdjustment(type);
    try {
      const res = await fetch('/api/sophia/campaign-adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          adjustment: { type, stepNumber }
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Adjustment Applied',
          description: data.message
        });
        fetchMonitorData(true);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply adjustment',
        variant: 'destructive'
      });
    } finally {
      setApplyingAdjustment(null);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-600" />
          <p className="mt-2 text-slate-600">Sophia is analyzing campaign...</p>
        </CardContent>
      </Card>
    );
  }

  if (!monitorData) {
    return (
      <Card className="w-full">
        <CardContent className="py-8 text-center text-slate-600">
          No monitoring data available
        </CardContent>
      </Card>
    );
  }

  const { progress, stepAnalysis, recommendations, insights, sophiaSummary, overallHealth, overallScore } = monitorData;

  return (
    <Card className="w-full border-purple-200 shadow-lg">
      <CardHeader className="pb-3 border-b bg-gradient-to-r from-purple-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Sophia Campaign Monitor
                {refreshing && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
              </CardTitle>
              <CardDescription>{campaignName || progress.campaignName}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchMonitorData(true)}
              disabled={refreshing}
              data-testid="button-refresh-monitor"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <div className={`rounded-lg p-4 mb-4 border ${HEALTH_BG[overallHealth]}`}>
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-full ${HEALTH_COLORS[overallHealth]} flex items-center justify-center text-white font-bold text-lg`}>
              {overallScore}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge className={`${
                  overallHealth === 'healthy' ? 'bg-green-100 text-green-800' :
                  overallHealth === 'needs_attention' ? 'bg-yellow-100 text-yellow-800' :
                  overallHealth === 'at_risk' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {overallHealth.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {insights.engagementTrend === 'improving' ? (
                    <><TrendingUp className="w-3 h-3 mr-1" /> Improving</>
                  ) : insights.engagementTrend === 'declining' ? (
                    <><TrendingDown className="w-3 h-3 mr-1" /> Declining</>
                  ) : (
                    <><Activity className="w-3 h-3 mr-1" /> Stable</>
                  )}
                </Badge>
              </div>
              <p className="text-sm text-slate-700">{sophiaSummary}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-slate-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-slate-900">{progress.totalContacts}</p>
            <p className="text-xs text-slate-600">Total Contacts</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{progress.contactsInProgress}</p>
            <p className="text-xs text-slate-600">In Progress</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{progress.contactsReplied}</p>
            <p className="text-xs text-slate-600">Replied</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-purple-600">{progress.contactsCompleted}</p>
            <p className="text-xs text-slate-600">Completed</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{progress.contactsOptedOut}</p>
            <p className="text-xs text-slate-600">Opted Out</p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Campaign Progress</span>
            <span className="text-sm text-slate-600">{progress.progressPercent}%</span>
          </div>
          <Progress value={progress.progressPercent} className="h-2" />
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>Step {progress.currentStep} of {progress.totalSteps}</span>
            {progress.estimatedCompletion && (
              <span>Est. completion: {new Date(progress.estimatedCompletion).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="overview" className="text-xs" data-testid="tab-overview">
              <BarChart3 className="w-3 h-3 mr-1" /> Steps
            </TabsTrigger>
            <TabsTrigger value="contacts" className="text-xs" data-testid="tab-contacts">
              <Users className="w-3 h-3 mr-1" /> Contacts
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="text-xs" data-testid="tab-recommendations">
              <Lightbulb className="w-3 h-3 mr-1" /> Recommendations
              {recommendations.length > 0 && (
                <Badge className="ml-1 h-4 px-1 text-xs bg-orange-500">{recommendations.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs" data-testid="tab-actions">
              <Zap className="w-3 h-3 mr-1" /> Actions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {stepAnalysis.map((step, idx) => {
                  const metrics = progress.steps[idx];
                  const ChannelIcon = CHANNEL_ICONS[step.channel] || MessageSquare;
                  
                  return (
                    <div 
                      key={step.stepId} 
                      className={`border rounded-lg p-3 ${step.performance === 'poor' ? 'border-red-200 bg-red-50/50' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                            {step.stepNumber}
                          </div>
                          <ChannelIcon className="w-4 h-4 text-slate-600" />
                          <span className="text-sm font-medium capitalize">{step.channel}</span>
                          <Badge className={`text-xs ${PERFORMANCE_COLORS[step.performance]}`}>
                            {step.performance.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">Health:</span>
                          <span className={`text-sm font-bold ${
                            step.healthScore >= 70 ? 'text-green-600' :
                            step.healthScore >= 40 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {step.healthScore}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2 text-xs mb-2">
                        <div className="text-center">
                          <p className="font-bold text-slate-700">{metrics?.sent || 0}</p>
                          <p className="text-slate-500">Sent</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-blue-600">{metrics?.openRate || 0}%</p>
                          <p className="text-slate-500">Open Rate</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-purple-600">{metrics?.clickRate || 0}%</p>
                          <p className="text-slate-500">Click Rate</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-green-600">{metrics?.replyRate || 0}%</p>
                          <p className="text-slate-500">Reply Rate</p>
                        </div>
                      </div>
                      
                      {step.issues.length > 0 && (
                        <div className="mt-2 pt-2 border-t">
                          {step.issues.map((issue, i) => (
                            <p key={i} className="text-xs text-red-600 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {issue}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="contacts">
            <ScrollArea className="h-64">
              {contactsLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600" />
                  <p className="text-sm text-slate-500 mt-2">Loading contacts...</p>
                </div>
              ) : stepContacts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p>No contacts scheduled for this campaign</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stepContacts.map((step) => (
                    <div key={step.stepIndex} className="border rounded-lg overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer hover:bg-slate-100"
                        onClick={() => setExpandedStep(expandedStep === step.stepIndex ? null : step.stepIndex)}
                        data-testid={`step-header-${step.stepIndex}`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">
                            {step.stepIndex + 1}
                          </div>
                          {step.channel.toLowerCase().includes('linkedin') ? (
                            <Linkedin className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Mail className="w-4 h-4 text-slate-600" />
                          )}
                          <span className="text-sm font-medium capitalize">{step.channel.replace(/_/g, ' ')}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {step.stats.pending > 0 && (
                            <span className="text-slate-500">{step.stats.pending} pending</span>
                          )}
                          {step.channel.toLowerCase().includes('linkedin') ? (
                            <>
                              {step.stats.sent > 0 && step.stats.accepted < step.stats.sent && (
                                <span className="text-blue-600">{step.stats.sent - step.stats.accepted} monitoring</span>
                              )}
                              {step.stats.accepted > 0 && (
                                <span className="text-green-600">{step.stats.accepted} connected</span>
                              )}
                            </>
                          ) : (
                            step.stats.sent > 0 && (
                              <span className="text-green-600">{step.stats.sent} sent</span>
                            )
                          )}
                          {step.stats.failed > 0 && (
                            <span className="text-red-600">{step.stats.failed} failed</span>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {step.contacts.length} contacts
                          </Badge>
                        </div>
                      </div>
                      
                      {expandedStep === step.stepIndex && (
                        <div className="border-t">
                          <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                            {step.contacts.map((contact) => (
                              <div 
                                key={contact.contactId}
                                className="flex items-center justify-between p-2 rounded bg-white hover:bg-slate-50 text-xs"
                                data-testid={`contact-row-${contact.contactId}`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                                    {contact.firstName?.charAt(0) || '?'}
                                  </div>
                                  <span className="font-medium">
                                    {contact.firstName} {contact.lastName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* For LinkedIn steps, show connection-aware status */}
                                  {step.channel.toLowerCase().includes('linkedin') ? (
                                    contact.connectionStatus === 'accepted' ? (
                                      <Badge className="bg-green-100 text-green-700 text-xs">
                                        <UserCheck className="w-3 h-3 mr-1" /> Connected
                                      </Badge>
                                    ) : contact.stepStatus === 'sent' && contact.connectionStatus === 'pending' ? (
                                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                                        <Eye className="w-3 h-3 mr-1" /> Monitoring
                                      </Badge>
                                    ) : contact.stepStatus === 'sent' ? (
                                      <Badge className="bg-blue-100 text-blue-700 text-xs">
                                        <Eye className="w-3 h-3 mr-1" /> Invite Sent
                                      </Badge>
                                    ) : contact.stepStatus === 'failed' ? (
                                      <Badge className="bg-red-100 text-red-700 text-xs">
                                        <XCircle className="w-3 h-3 mr-1" /> Failed
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-slate-100 text-slate-600 text-xs">
                                        <Clock3 className="w-3 h-3 mr-1" /> Pending
                                      </Badge>
                                    )
                                  ) : (
                                    /* For non-LinkedIn steps, show standard status */
                                    contact.stepStatus === 'sent' ? (
                                      <Badge className="bg-green-100 text-green-700 text-xs">
                                        <CheckCircle className="w-3 h-3 mr-1" /> Sent
                                      </Badge>
                                    ) : contact.stepStatus === 'failed' ? (
                                      <Badge className="bg-red-100 text-red-700 text-xs">
                                        <XCircle className="w-3 h-3 mr-1" /> Failed
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-slate-100 text-slate-600 text-xs">
                                        <Clock3 className="w-3 h-3 mr-1" /> Pending
                                      </Badge>
                                    )
                                  )}
                                  
                                  {contact.executedAt && (
                                    <span className="text-slate-400">
                                      {new Date(contact.executedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="recommendations">
            <ScrollArea className="h-64">
              {recommendations.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p>No recommendations - campaign is performing well!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec, idx) => (
                    <div 
                      key={idx} 
                      className={`border rounded-lg p-3 ${
                        rec.priority === 'critical' ? 'border-red-300 bg-red-50' :
                        rec.priority === 'high' ? 'border-orange-300 bg-orange-50' :
                        'border-yellow-300 bg-yellow-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Lightbulb className={`w-4 h-4 mt-0.5 ${
                          rec.priority === 'critical' ? 'text-red-600' :
                          rec.priority === 'high' ? 'text-orange-600' : 'text-yellow-600'
                        }`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{rec.title}</span>
                            <Badge variant="outline" className="text-xs">{rec.priority}</Badge>
                          </div>
                          <p className="text-xs text-slate-600 mb-2">{rec.description}</p>
                          {rec.affectedSteps && rec.affectedSteps.length > 0 && (
                            <p className="text-xs text-slate-500">
                              Affects: Steps {rec.affectedSteps.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="actions">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {progress.status === 'active' ? (
                  <Button 
                    variant="outline" 
                    className="h-auto py-3 flex-col"
                    onClick={() => handleApplyAdjustment('pause')}
                    disabled={applyingAdjustment === 'pause'}
                    data-testid="button-pause-campaign"
                  >
                    {applyingAdjustment === 'pause' ? (
                      <Loader2 className="w-5 h-5 animate-spin mb-1" />
                    ) : (
                      <Pause className="w-5 h-5 mb-1 text-orange-600" />
                    )}
                    <span className="text-xs">Pause Campaign</span>
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    className="h-auto py-3 flex-col"
                    onClick={() => handleApplyAdjustment('resume')}
                    disabled={applyingAdjustment === 'resume'}
                    data-testid="button-resume-campaign"
                  >
                    {applyingAdjustment === 'resume' ? (
                      <Loader2 className="w-5 h-5 animate-spin mb-1" />
                    ) : (
                      <Play className="w-5 h-5 mb-1 text-green-600" />
                    )}
                    <span className="text-xs">Resume Campaign</span>
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  className="h-auto py-3 flex-col"
                  onClick={() => handleApplyAdjustment('skip_step', progress.currentStep)}
                  disabled={applyingAdjustment === 'skip_step'}
                  data-testid="button-skip-step"
                >
                  {applyingAdjustment === 'skip_step' ? (
                    <Loader2 className="w-5 h-5 animate-spin mb-1" />
                  ) : (
                    <SkipForward className="w-5 h-5 mb-1 text-blue-600" />
                  )}
                  <span className="text-xs">Skip Current Step</span>
                </Button>
              </div>
              
              {insights.bestChannel && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Best Performing Channel</span>
                  </div>
                  <p className="text-xs text-green-700 mt-1 capitalize">
                    {insights.bestChannel} is generating the most engagement
                  </p>
                </div>
              )}
              
              {insights.topPerformingStep && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Top Step</span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Step {insights.topPerformingStep.stepNumber}: {insights.topPerformingStep.value} {insights.topPerformingStep.metric}
                  </p>
                </div>
              )}
              
              {insights.bottomPerformingStep && insights.bottomPerformingStep.stepNumber !== insights.topPerformingStep?.stepNumber && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium text-orange-800">Needs Improvement</span>
                  </div>
                  <p className="text-xs text-orange-700 mt-1">
                    Step {insights.bottomPerformingStep.stepNumber}: {insights.bottomPerformingStep.value} {insights.bottomPerformingStep.metric}
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2 h-7 text-xs"
                    onClick={() => toast({ title: 'Edit Step', description: 'Opening step editor...' })}
                    data-testid="button-edit-step"
                  >
                    <Edit className="w-3 h-3 mr-1" /> Edit Step Content
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default SophiaCampaignMonitor;
