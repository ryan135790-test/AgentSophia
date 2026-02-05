import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, Mail, MessageSquare, Phone, Linkedin, Users, 
  Play, Pause, Settings, BarChart3, GitBranch, Plus, Trash2,
  Edit2, Save, X, ChevronRight, Clock, Target, TrendingUp,
  CheckCircle, AlertCircle, Send, Eye, MousePointer, Reply,
  UserPlus, Search, Filter, MoreVertical, Zap, Bot
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";

function LinkedInContactImport({ campaignId, onImportComplete }: { campaignId: string; onImportComplete: () => void }) {
  const { toast } = useToast();
  const [selectedLinkedIn, setSelectedLinkedIn] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<'connections' | 'search'>('search');
  const [searchParams, setSearchParams] = useState({
    keywords: '',
    company: '',
    title: '',
    location: '',
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  const { data: heyreachStatus } = useQuery({
    queryKey: ['/api/heyreach/status'],
    queryFn: async () => {
      const res = await fetch('/api/heyreach/status');
      if (!res.ok) return { connected: false };
      return res.json();
    },
  });

  const { data: linkedInContacts = [], isLoading: loadingContacts, refetch } = useQuery({
    queryKey: ['/api/heyreach/import-contacts'],
    queryFn: async () => {
      const res = await fetch('/api/heyreach/import-contacts');
      if (!res.ok) return [];
      const data = await res.json();
      return data.contacts || [];
    },
    enabled: heyreachStatus?.connected && importMode === 'connections',
  });

  const searchMutation = useMutation({
    mutationFn: async (params: typeof searchParams) => {
      const res = await apiRequest('/api/heyreach/search-profiles', {
        method: 'POST',
        body: JSON.stringify({ ...params, limit: 25 }),
      });
      return res;
    },
    onSuccess: (data: any) => {
      setSearchResults(data.profiles || []);
      setHasSearched(true);
      setSelectedLinkedIn([]);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Search Failed', 
        description: error.message || 'Failed to search LinkedIn profiles', 
        variant: 'destructive' 
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async (contacts: any[]) => {
      const res = await apiRequest('/api/contacts/import-linkedin', {
        method: 'POST',
        body: JSON.stringify({ contacts, campaignId }),
      });
      return res;
    },
    onSuccess: (data: any) => {
      toast({ 
        title: 'Contacts Imported', 
        description: `${data.imported || selectedLinkedIn.length} LinkedIn contacts added to campaign` 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'contacts'] });
      onImportComplete();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Import Failed', 
        description: error.message || 'Failed to import contacts', 
        variant: 'destructive' 
      });
    },
  });

  const handleSearch = () => {
    if (!searchParams.keywords && !searchParams.company && !searchParams.title) {
      toast({ title: 'Search Required', description: 'Enter at least one search criteria', variant: 'destructive' });
      return;
    }
    searchMutation.mutate(searchParams);
  };

  const handleImport = () => {
    const sourceContacts = importMode === 'search' ? searchResults : linkedInContacts;
    const contactsToImport = sourceContacts.filter((c: any) => selectedLinkedIn.includes(c.id || c.linkedin_url));
    importMutation.mutate(contactsToImport);
  };

  const displayContacts = importMode === 'search' ? searchResults : linkedInContacts;
  const isLoading = importMode === 'search' ? searchMutation.isPending : loadingContacts;

  const isConnected = heyreachStatus?.connected;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b pb-2">
        <Button 
          variant={importMode === 'search' ? 'default' : 'ghost'} 
          size="sm"
          onClick={() => { setImportMode('search'); setSelectedLinkedIn([]); }}
          data-testid="btn-linkedin-search-mode"
        >
          <Search className="w-4 h-4 mr-1" />
          Search LinkedIn
        </Button>
        <Button 
          variant={importMode === 'connections' ? 'default' : 'ghost'} 
          size="sm"
          onClick={() => { setImportMode('connections'); setSelectedLinkedIn([]); }}
          disabled={!isConnected}
          data-testid="btn-linkedin-connections-mode"
        >
          <Users className="w-4 h-4 mr-1" />
          My Connections
          {!isConnected && <span className="ml-1 text-xs opacity-60">(Not connected)</span>}
        </Button>
      </div>

      {!isConnected && importMode === 'search' && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            Demo mode: Search returns sample profiles.{' '}
            <a href="/linkedin-settings" className="underline font-medium">Connect LinkedIn</a>
            {' '}for live LinkedIn data.
          </AlertDescription>
        </Alert>
      )}

      {importMode === 'search' && (
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Keywords</Label>
              <Input 
                placeholder="e.g. sales, marketing..."
                value={searchParams.keywords}
                onChange={(e) => setSearchParams(p => ({ ...p, keywords: e.target.value }))}
                data-testid="input-linkedin-keywords"
              />
            </div>
            <div>
              <Label className="text-xs">Company</Label>
              <Input 
                placeholder="e.g. Google, Salesforce..."
                value={searchParams.company}
                onChange={(e) => setSearchParams(p => ({ ...p, company: e.target.value }))}
                data-testid="input-linkedin-company"
              />
            </div>
            <div>
              <Label className="text-xs">Job Title</Label>
              <Input 
                placeholder="e.g. VP Sales, CMO..."
                value={searchParams.title}
                onChange={(e) => setSearchParams(p => ({ ...p, title: e.target.value }))}
                data-testid="input-linkedin-title"
              />
            </div>
            <div>
              <Label className="text-xs">Location</Label>
              <Input 
                placeholder="e.g. San Francisco, USA..."
                value={searchParams.location}
                onChange={(e) => setSearchParams(p => ({ ...p, location: e.target.value }))}
                data-testid="input-linkedin-location"
              />
            </div>
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={searchMutation.isPending}
            className="w-full"
            data-testid="btn-linkedin-search"
          >
            {searchMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Search LinkedIn Profiles
              </>
            )}
          </Button>
        </div>
      )}

      {importMode === 'connections' && (
        <div className="flex items-center justify-between">
          <Label>Your LinkedIn Connections</Label>
          <Button variant="ghost" size="sm" onClick={() => refetch()} data-testid="btn-refresh-linkedin">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      )}

      <ScrollArea className="h-[220px] border rounded-lg">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : displayContacts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {importMode === 'search' 
              ? (hasSearched ? 'No profiles found. Try different search criteria.' : 'Search for LinkedIn profiles above')
              : 'No LinkedIn connections available'
            }
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {displayContacts.map((contact: any) => {
              const contactId = contact.id || contact.linkedin_url;
              const emailConfidence = contact.email_confidence || 0;
              const hasEmail = !!contact.email;
              
              return (
                <div 
                  key={contactId} 
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                  onClick={() => {
                    setSelectedLinkedIn(prev => 
                      prev.includes(contactId) 
                        ? prev.filter(id => id !== contactId)
                        : [...prev, contactId]
                    );
                  }}
                >
                  <Checkbox 
                    checked={selectedLinkedIn.includes(contactId)}
                    data-testid={`checkbox-linkedin-${contactId}`}
                  />
                  <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
                    <Linkedin className="w-5 h-5 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {contact.first_name || contact.name?.split(' ')[0]} {contact.last_name || contact.name?.split(' ').slice(1).join(' ')}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {contact.position || contact.title} at {contact.company}
                    </p>
                    {hasEmail && (
                      <div className="flex items-center gap-2 mt-1">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground truncate">{contact.email}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-1 py-0 ${
                            emailConfidence >= 80 
                              ? 'bg-green-50 text-green-700 border-green-200' 
                              : emailConfidence >= 50 
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-gray-50 text-gray-600 border-gray-200'
                          }`}
                        >
                          {emailConfidence}%
                        </Badge>
                        {contact.email_source && (
                          <span className={`text-[10px] italic ${
                            contact.email_source.includes('demo') ? 'text-muted-foreground' : 'text-blue-600'
                          }`}>
                            ({contact.email_source.replace('-demo', ' demo').replace('hunter', 'Hunter').replace('apollo', 'Apollo')})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {contact.connection_status && (
                    <Badge variant="outline" className="text-xs">
                      {contact.connection_status}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {selectedLinkedIn.length} contacts selected
        </p>
        <Button 
          onClick={handleImport}
          disabled={selectedLinkedIn.length === 0 || importMutation.isPending}
          data-testid="btn-import-linkedin"
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Import {selectedLinkedIn.length} Contacts
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  sms: MessageSquare,
  phone: Phone,
  linkedin: Linkedin,
  voicemail: Phone,
};

const CHANNEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  email: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  sms: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  phone: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  linkedin: { bg: 'bg-sky-50', text: 'text-sky-600', border: 'border-sky-200' },
  voicemail: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
};

interface CampaignStep {
  id: string;
  channel: string;
  label: string;
  subject: string | null;
  content: string;
  delay: number;
  delay_unit: string;
  order_index: number;
  variations: any[];
  selected_variation_id: string | null;
  branches: any[];
  metrics: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    bounced: number;
  };
}

interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: string;
  current_step: number;
  assigned_at: string;
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    company: string;
    position: string;
    score: number;
  };
}

interface CampaignData {
  id: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  channels: string[];
  settings: any;
  created_at: string;
  updated_at: string;
  sent_count: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  steps: CampaignStep[];
  stats: {
    total_contacts: number;
    active_contacts: number;
    completed_contacts: number;
    total_sent: number;
    total_opened: number;
    total_clicked: number;
    total_replied: number;
  };
}

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [addContactsOpen, setAddContactsOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editStepOpen, setEditStepOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<CampaignStep | null>(null);
  const [expandedStepIndex, setExpandedStepIndex] = useState<number | null>(null);
  const [stepFormData, setStepFormData] = useState({
    label: '',
    subject: '',
    content: '',
    delay: 0,
    delay_unit: 'days',
    channel: 'email',
    config: {
      keywords: '',
      jobTitle: '',
      company: '',
      location: '',
      industry: '',
      connectionDegree: '2nd',
      maxResults: 25 as number | string
    }
  });

  useEffect(() => {
    if (searchParams.get('edit') === 'true') {
      setIsEditing(true);
    }
  }, [searchParams]);

  const { data: campaign, isLoading, error: campaignError } = useQuery<CampaignData>({
    queryKey: ['/api/campaigns', id, workspaceId],
    queryFn: async () => {
      // Always require workspaceId for security
      if (!workspaceId) {
        throw new Error('Workspace context not loaded');
      }
      const url = `/api/campaigns/${id}?workspaceId=${workspaceId}`;
      const res = await fetch(url);
      if (res.status === 403) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'This campaign belongs to a different workspace');
      }
      if (!res.ok) throw new Error('Failed to fetch campaign');
      return res.json();
    },
    // Only fetch when BOTH id AND workspaceId are available
    enabled: !!id && !!workspaceId,
    retry: false,
  });

  useEffect(() => {
    if (campaignError) {
      toast({
        title: "Access Denied",
        description: campaignError.message || "This campaign belongs to a different workspace. Please switch to the correct workspace.",
        variant: "destructive",
      });
      navigate('/campaigns');
    }
  }, [campaignError, toast, navigate]);

  const { data: campaignContacts = [] } = useQuery<CampaignContact[]>({
    queryKey: ['/api/campaigns', id, 'contacts'],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${id}/contacts`);
      if (!res.ok) throw new Error('Failed to fetch campaign contacts');
      return res.json();
    },
    enabled: !!id && activeTab === 'contacts',
  });

  const { data: allContacts = [] } = useQuery<any[]>({
    queryKey: ['/api/contacts'],
    queryFn: async () => {
      const res = await fetch('/api/contacts');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.contacts || []);
    },
    enabled: addContactsOpen,
  });

  // Fetch contacts grouped by step for the Steps tab
  interface StepContactData {
    stepIndex: number;
    channel: string;
    stats: { pending: number; sent: number; failed: number; accepted: number };
    contacts: Array<{
      contactId: string;
      firstName: string;
      lastName: string;
      linkedinUrl?: string;
      stepStatus: 'pending' | 'sent' | 'failed';
      connectionStatus: 'none' | 'pending' | 'accepted' | 'withdrawn';
      connectionSentAt?: string;
      connectionAcceptedAt?: string;
      executedAt?: string;
    }>;
  }
  
  const { data: stepContactsData = [] } = useQuery<StepContactData[]>({
    queryKey: ['/api/campaigns', id, 'contacts-by-step'],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${id}/contacts-by-step`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.success ? data.steps : [];
    },
    enabled: !!id && activeTab === 'steps',
    refetchInterval: 30000,
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async (updates: Partial<CampaignData>) => {
      return apiRequest(`/api/campaigns/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: 'Campaign Updated', description: 'Your changes have been saved.' });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addContactsMutation = useMutation({
    mutationFn: async (contactIds: string[]) => {
      return apiRequest(`/api/campaigns/${id}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contactIds }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id, 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
      toast({ title: 'Contacts Added', description: `${data.addedCount} contacts added to campaign.` });
      setAddContactsOpen(false);
      setSelectedContacts([]);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const removeContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      return apiRequest(`/api/campaigns/${id}/contacts/${contactId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id, 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
      toast({ title: 'Contact Removed', description: 'Contact has been removed from the campaign.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest(`/api/campaigns/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: 'Status Updated' });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/campaigns/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({ title: 'Campaign Deleted', description: 'The campaign has been permanently deleted.' });
      navigate('/campaigns');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to delete campaign', variant: 'destructive' });
    },
  });

  const updateStepsMutation = useMutation({
    mutationFn: async (steps: CampaignStep[]) => {
      return apiRequest(`/api/campaigns/${id}/steps`, {
        method: 'PUT',
        body: JSON.stringify({ steps }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id] });
      toast({ title: 'Steps Updated', description: 'Campaign steps have been saved.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const selectVariation = (stepId: string, variationId: string) => {
    if (!campaign) return;
    const updatedSteps = campaign.steps.map(step => {
      if (step.id === stepId) {
        const variation = step.variations.find(v => v.id === variationId);
        return {
          ...step,
          selected_variation_id: variationId,
          content: variation?.content || step.content,
          subject: variation?.subject || step.subject,
        };
      }
      return step;
    });
    updateStepsMutation.mutate(updatedSteps as CampaignStep[]);
  };

  const openEditStep = (step: CampaignStep) => {
    setEditingStep(step);
    // Config can be in step.config, step.settings.config, or step.content (as JSON for linkedin_search)
    const stepSettings = (step as any).settings || {};
    let stepConfig = (step as any).config || stepSettings.config || {};
    
    // For linkedin_search, the config is stored as JSON in the content field
    if (step.channel === 'linkedin_search' && step.content) {
      try {
        const parsedConfig = JSON.parse(step.content);
        stepConfig = { ...stepConfig, ...parsedConfig };
      } catch (e) {
        // Not valid JSON, use existing config
      }
    }
    
    setStepFormData({
      label: step.label || '',
      subject: step.subject || '',
      content: step.channel === 'linkedin_search' ? '' : (step.content || ''),
      delay: step.delay || 0,
      delay_unit: step.delay_unit || 'days',
      channel: step.channel || 'email',
      config: {
        keywords: stepConfig.keywords || '',
        jobTitle: stepConfig.jobTitle || '',
        company: stepConfig.company || '',
        location: stepConfig.location || '',
        industry: stepConfig.industry || '',
        connectionDegree: stepConfig.connectionDegree || '2nd',
        maxResults: stepConfig.maxResults || 25
      }
    });
    setEditStepOpen(true);
  };

  const saveStep = () => {
    if (!campaign || !editingStep) return;
    
    const updatedSteps = campaign.steps.map(step => {
      if (step.id === editingStep.id) {
        const updatedStep: any = {
          ...step,
          label: stepFormData.label,
          subject: stepFormData.subject || null,
          content: stepFormData.channel === 'linkedin_search' 
            ? JSON.stringify(stepFormData.config)
            : stepFormData.content,
          delay: stepFormData.delay,
          delay_unit: stepFormData.delay_unit,
          channel: stepFormData.channel,
        };
        return updatedStep;
      }
      return step;
    });
    
    updateStepsMutation.mutate(updatedSteps as CampaignStep[], {
      onSuccess: () => {
        setEditStepOpen(false);
        setEditingStep(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Campaign Not Found</h2>
          <p className="text-muted-foreground mb-4">The campaign you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/campaigns')} data-testid="btn-back-campaigns">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Campaigns
          </Button>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800 border-green-200',
      draft: 'bg-slate-100 text-slate-800 border-slate-200',
      paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-blue-100 text-blue-800 border-blue-200',
    };
    return colors[status] || colors.draft;
  };

  const openRate = campaign.stats.total_sent > 0 
    ? ((campaign.stats.total_opened / campaign.stats.total_sent) * 100).toFixed(1)
    : '0';
  const clickRate = campaign.stats.total_opened > 0 
    ? ((campaign.stats.total_clicked / campaign.stats.total_opened) * 100).toFixed(1)
    : '0';
  const replyRate = campaign.stats.total_sent > 0 
    ? ((campaign.stats.total_replied / campaign.stats.total_sent) * 100).toFixed(1)
    : '0';

  const contactsArray = Array.isArray(allContacts) ? allContacts : [];
  const filteredContacts = contactsArray.filter((c: any) => {
    const searchLower = contactSearch.toLowerCase();
    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
    return fullName.includes(searchLower) || c.email?.toLowerCase().includes(searchLower);
  });

  const existingContactIds = campaignContacts.map(cc => cc.contact_id);
  const availableContacts = filteredContacts.filter((c: any) => !existingContactIds.includes(c.id));

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/campaigns')} data-testid="btn-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Separator orientation="vertical" className="h-6" />
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-xl font-bold h-9 w-64"
                    data-testid="input-campaign-name"
                  />
                  <Button size="sm" onClick={() => updateCampaignMutation.mutate({ name: editName, description: editDescription })} data-testid="btn-save-name">
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} data-testid="btn-cancel-edit">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{campaign.name}</h1>
                  <Button variant="ghost" size="sm" onClick={() => { setEditName(campaign.name); setEditDescription(campaign.description || ''); setIsEditing(true); }} data-testid="btn-edit-campaign">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {campaign.status === 'draft' && (
                <Button onClick={() => updateStatusMutation.mutate('active')} data-testid="btn-activate">
                  <Play className="w-4 h-4 mr-2" />
                  Activate Campaign
                </Button>
              )}
              {campaign.status === 'active' && (
                <Button variant="outline" onClick={() => updateStatusMutation.mutate('paused')} data-testid="btn-pause">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}
              {campaign.status === 'paused' && (
                <Button onClick={() => updateStatusMutation.mutate('active')} data-testid="btn-resume">
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate(`/workflow-builder?campaignId=${id}`)} data-testid="btn-edit-workflow">
                <GitBranch className="w-4 h-4 mr-2" />
                Edit Workflow
              </Button>
              <Button 
                variant="outline" 
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setDeleteDialogOpen(true)} 
                data-testid="btn-delete-campaign"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="steps" data-testid="tab-steps">
              <GitBranch className="w-4 h-4 mr-2" />
              Steps
            </TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">
              <Users className="w-4 h-4 mr-2" />
              Contacts
            </TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">
              <TrendingUp className="w-4 h-4 mr-2" />
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Contacts</p>
                      <p className="text-3xl font-bold">{campaign.stats.total_contacts}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Open Rate</p>
                      <p className="text-3xl font-bold">{openRate}%</p>
                    </div>
                    <Eye className="w-8 h-8 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Click Rate</p>
                      <p className="text-3xl font-bold">{clickRate}%</p>
                    </div>
                    <MousePointer className="w-8 h-8 text-purple-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Reply Rate</p>
                      <p className="text-3xl font-bold">{replyRate}%</p>
                    </div>
                    <Reply className="w-8 h-8 text-orange-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5" />
                    Campaign Workflow
                  </CardTitle>
                  <CardDescription>
                    {campaign.steps.length} steps across {campaign.channels.length} channels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {campaign.steps.length === 0 ? (
                    <div className="text-center py-8">
                      <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <p className="text-muted-foreground mb-4">No steps defined yet</p>
                      <Button onClick={() => navigate(`/chat-sophia?action=build-campaign&campaignId=${id}`)} data-testid="btn-add-steps">
                        <Bot className="w-4 h-4 mr-2" />
                        Build with Sophia
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {campaign.steps.slice(0, 5).map((step, index) => {
                        const Icon = CHANNEL_ICONS[step.channel] || Mail;
                        const colors = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.email;
                        return (
                          <div key={step.id} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${colors.bg} ${colors.text}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{step.label}</p>
                              <p className="text-sm text-muted-foreground truncate">{step.subject || step.content.substring(0, 50)}...</p>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              {step.delay > 0 && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {step.delay} {step.delay_unit}
                                </span>
                              )}
                            </div>
                            {index < campaign.steps.length - 1 && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        );
                      })}
                      {campaign.steps.length > 5 && (
                        <Button variant="ghost" className="w-full" onClick={() => setActiveTab('steps')} data-testid="btn-view-all-steps">
                          View all {campaign.steps.length} steps
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-500" />
                    Sophia Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900">
                    <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Recommendation</p>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                      Consider adding a LinkedIn follow-up after email opens for 23% higher response rates.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Optimization</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Best send times for your audience: Tuesday 10am, Thursday 2pm.
                    </p>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => navigate(`/chat-sophia?context=campaign&id=${id}`)} data-testid="btn-ask-sophia">
                    <Bot className="w-4 h-4 mr-2" />
                    Ask Sophia
                  </Button>
                </CardContent>
              </Card>
            </div>

            {isEditing && (
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Description</label>
                      <Textarea 
                        value={editDescription} 
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Campaign description..."
                        className="mt-1"
                        data-testid="input-campaign-description"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="steps" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Campaign Steps</h2>
                <p className="text-muted-foreground">Review and edit your campaign workflow</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate(`/workflow-builder?campaignId=${id}`)} data-testid="btn-visual-editor">
                  <GitBranch className="w-4 h-4 mr-2" />
                  Visual Editor
                </Button>
                <Button onClick={() => navigate(`/chat-sophia?action=improve-campaign&campaignId=${id}`)} data-testid="btn-improve-steps">
                  <Bot className="w-4 h-4 mr-2" />
                  Improve with AI
                </Button>
              </div>
            </div>

            {campaign.steps.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No steps yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add steps to your campaign workflow
                  </p>
                  <Button onClick={() => navigate(`/chat-sophia?action=build-campaign&campaignId=${id}`)} data-testid="btn-create-steps">
                    <Bot className="w-4 h-4 mr-2" />
                    Build with Sophia
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {campaign.steps.map((step, index) => {
                  const Icon = CHANNEL_ICONS[step.channel] || Mail;
                  const colors = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.email;
                  const stepOpenRate = step.metrics.sent > 0 ? ((step.metrics.opened / step.metrics.sent) * 100).toFixed(1) : '0';
                  const stepReplyRate = step.metrics.sent > 0 ? ((step.metrics.replied / step.metrics.sent) * 100).toFixed(1) : '0';
                  const currentVariation = step.variations.find(v => v.id === step.selected_variation_id);
                  const isLinkedIn = step.channel.toLowerCase().includes('linkedin');
                  const stepData = stepContactsData.find(s => s.stepIndex === index);
                  const isExpanded = expandedStepIndex === index;
                  
                  // LinkedIn-specific metrics from real data
                  const linkedInSent = stepData?.stats.sent || 0;
                  const linkedInMonitoring = stepData ? (stepData.stats.sent - stepData.stats.accepted) : 0;
                  const linkedInConnected = stepData?.stats.accepted || 0;
                  const linkedInPending = stepData?.stats.pending || 0;
                  
                  return (
                    <Card key={step.id} className={`border-l-4 ${colors.border}`}>
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colors.bg} ${colors.text}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm text-muted-foreground">Step {index + 1}</span>
                              <Badge variant="outline" className="capitalize">{step.channel}</Badge>
                              {step.variations.length > 0 && (
                                <Select
                                  value={step.selected_variation_id || 'original'}
                                  onValueChange={(value) => selectVariation(step.id, value)}
                                >
                                  <SelectTrigger className="h-7 w-auto text-xs" data-testid={`select-variation-${step.id}`}>
                                    <SelectValue placeholder="Select version" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="original">Original</SelectItem>
                                    {step.variations.map((v: any, vi: number) => (
                                      <SelectItem key={v.id} value={v.id}>
                                        Version {vi + 1} {v.score && `(${v.score}% score)`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {index > 0 && step.delay > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <Clock className="w-3 h-3 mr-1" />
                                  Wait {step.delay} {step.delay_unit}
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold text-lg">{step.label}</h3>
                            {(currentVariation?.subject || step.subject) && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <strong>Subject:</strong> {currentVariation?.subject || step.subject}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {currentVariation?.content || step.content}
                            </p>
                          </div>
                          <div className="flex flex-col gap-4 items-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditStep(step)}
                              data-testid={`btn-edit-step-${step.id}`}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            {isLinkedIn ? (
                              <div className="grid grid-cols-4 gap-4 text-center">
                                <div>
                                  <p className="text-2xl font-bold">{linkedInSent}</p>
                                  <p className="text-xs text-muted-foreground">Invites Sent</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-blue-600">{linkedInMonitoring > 0 ? linkedInMonitoring : 0}</p>
                                  <p className="text-xs text-muted-foreground">Monitoring</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-green-600">{linkedInConnected}</p>
                                  <p className="text-xs text-muted-foreground">Connected</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-slate-500">{linkedInPending}</p>
                                  <p className="text-xs text-muted-foreground">Pending</p>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-4 gap-4 text-center">
                                <div>
                                  <p className="text-2xl font-bold">{step.metrics.sent}</p>
                                  <p className="text-xs text-muted-foreground">Sent</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-green-600">{stepOpenRate}%</p>
                                  <p className="text-xs text-muted-foreground">Opened</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-blue-600">{step.metrics.clicked}</p>
                                  <p className="text-xs text-muted-foreground">Clicked</p>
                                </div>
                                <div>
                                  <p className="text-2xl font-bold text-orange-600">{stepReplyRate}%</p>
                                  <p className="text-xs text-muted-foreground">Replied</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Expandable Contacts Section */}
                        <div className="mt-4 border-t pt-4">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-between"
                            onClick={() => setExpandedStepIndex(isExpanded ? null : index)}
                            data-testid={`btn-expand-step-${index}`}
                          >
                            <span className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              {stepData?.contacts.length || 0} contacts at this step
                            </span>
                            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </Button>
                          
                          {isExpanded && stepData && (
                            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                              {stepData.contacts.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">No contacts at this step yet</p>
                              ) : (
                                stepData.contacts.map((contact) => (
                                  <div 
                                    key={contact.contactId}
                                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-sm"
                                    data-testid={`step-contact-${contact.contactId}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-xs font-medium">
                                        {contact.firstName?.charAt(0) || '?'}
                                      </div>
                                      <span className="font-medium">{contact.firstName} {contact.lastName}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isLinkedIn ? (
                                        contact.connectionStatus === 'accepted' ? (
                                          <Badge className="bg-green-100 text-green-700 text-xs">
                                            <CheckCircle className="w-3 h-3 mr-1" /> Connected
                                          </Badge>
                                        ) : contact.stepStatus === 'sent' ? (
                                          <Badge className="bg-blue-100 text-blue-700 text-xs">
                                            <Eye className="w-3 h-3 mr-1" /> Monitoring
                                          </Badge>
                                        ) : contact.stepStatus === 'failed' ? (
                                          <Badge className="bg-red-100 text-red-700 text-xs">
                                            <AlertCircle className="w-3 h-3 mr-1" /> Failed
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-slate-100 text-slate-600 text-xs">
                                            <Clock className="w-3 h-3 mr-1" /> Pending
                                          </Badge>
                                        )
                                      ) : (
                                        contact.stepStatus === 'sent' ? (
                                          <Badge className="bg-green-100 text-green-700 text-xs">
                                            <CheckCircle className="w-3 h-3 mr-1" /> Sent
                                          </Badge>
                                        ) : contact.stepStatus === 'failed' ? (
                                          <Badge className="bg-red-100 text-red-700 text-xs">
                                            <AlertCircle className="w-3 h-3 mr-1" /> Failed
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-slate-100 text-slate-600 text-xs">
                                            <Clock className="w-3 h-3 mr-1" /> Pending
                                          </Badge>
                                        )
                                      )}
                                      {contact.executedAt && (
                                        <span className="text-xs text-muted-foreground">
                                          {formatDistanceToNow(new Date(contact.executedAt), { addSuffix: true })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="contacts" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Campaign Contacts</h2>
                <p className="text-muted-foreground">{campaignContacts.length} contacts assigned</p>
              </div>
              <Dialog open={addContactsOpen} onOpenChange={setAddContactsOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="btn-add-contacts">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Contacts
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Contacts to Campaign</DialogTitle>
                    <DialogDescription>
                      Select contacts from your database or import from LinkedIn
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="existing" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="existing" data-testid="tab-existing-contacts">
                        <Users className="w-4 h-4 mr-2" />
                        Existing Contacts
                      </TabsTrigger>
                      <TabsTrigger value="linkedin" data-testid="tab-linkedin-contacts">
                        <Linkedin className="w-4 h-4 mr-2" />
                        LinkedIn
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="existing" className="space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Search contacts..."
                          value={contactSearch}
                          onChange={(e) => setContactSearch(e.target.value)}
                          className="pl-9"
                          data-testid="input-search-contacts"
                        />
                      </div>
                      <ScrollArea className="h-[300px] border rounded-lg">
                        {availableContacts.length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground">
                            {allContacts.length === 0 ? 'No contacts available' : 'All contacts are already in this campaign'}
                          </div>
                        ) : (
                          <div className="p-2 space-y-1">
                            {availableContacts.map((contact: any) => (
                              <div 
                                key={contact.id} 
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer"
                                onClick={() => {
                                  setSelectedContacts(prev => 
                                    prev.includes(contact.id) 
                                      ? prev.filter(id => id !== contact.id)
                                      : [...prev, contact.id]
                                  );
                                }}
                              >
                                <Checkbox 
                                  checked={selectedContacts.includes(contact.id)}
                                  data-testid={`checkbox-contact-${contact.id}`}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">
                                    {contact.first_name} {contact.last_name}
                                  </p>
                                  <p className="text-sm text-muted-foreground truncate">
                                    {contact.email} • {contact.company}
                                  </p>
                                </div>
                                {contact.score && (
                                  <Badge variant="outline">{contact.score} pts</Badge>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                      <div className="flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">
                          {selectedContacts.length} contacts selected
                        </p>
                        <Button 
                          onClick={() => addContactsMutation.mutate(selectedContacts)}
                          disabled={selectedContacts.length === 0 || addContactsMutation.isPending}
                          data-testid="btn-confirm-add-contacts"
                        >
                          {addContactsMutation.isPending ? 'Adding...' : `Add ${selectedContacts.length} Contacts`}
                        </Button>
                      </div>
                    </TabsContent>
                    <TabsContent value="linkedin" className="space-y-4">
                      <LinkedInContactImport 
                        campaignId={id!}
                        onImportComplete={() => {
                          setAddContactsOpen(false);
                          queryClient.invalidateQueries({ queryKey: ['/api/campaigns', id, 'contacts'] });
                        }}
                      />
                    </TabsContent>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>

            {campaignContacts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No contacts yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add contacts to start reaching out
                  </p>
                  <Button onClick={() => setAddContactsOpen(true)} data-testid="btn-add-first-contacts">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Contacts
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-4 font-medium">Contact</th>
                          <th className="text-left p-4 font-medium">Company</th>
                          <th className="text-left p-4 font-medium">Status</th>
                          <th className="text-left p-4 font-medium">Current Step</th>
                          <th className="text-left p-4 font-medium">Added</th>
                          <th className="text-right p-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {campaignContacts.map((cc) => (
                          <tr key={cc.id} className="hover:bg-muted/30">
                            <td className="p-4">
                              <div>
                                <p className="font-medium">
                                  {cc.contact?.first_name} {cc.contact?.last_name}
                                </p>
                                <p className="text-sm text-muted-foreground">{cc.contact?.email}</p>
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {cc.contact?.company || '-'}
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className="capitalize">{cc.status}</Badge>
                            </td>
                            <td className="p-4">
                              Step {cc.current_step + 1} of {campaign.steps.length}
                            </td>
                            <td className="p-4 text-muted-foreground text-sm">
                              {formatDistanceToNow(new Date(cc.assigned_at), { addSuffix: true })}
                            </td>
                            <td className="p-4 text-right">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeContactMutation.mutate(cc.contact_id)}
                                data-testid={`btn-remove-contact-${cc.contact_id}`}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                      <Send className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{campaign.stats.total_sent}</p>
                      <p className="text-sm text-muted-foreground">Total Sent</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                      <Eye className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{campaign.stats.total_opened}</p>
                      <p className="text-sm text-muted-foreground">Opens ({openRate}%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                      <MousePointer className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{campaign.stats.total_clicked}</p>
                      <p className="text-sm text-muted-foreground">Clicks ({clickRate}%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                      <Reply className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{campaign.stats.total_replied}</p>
                      <p className="text-sm text-muted-foreground">Replies ({replyRate}%)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Step-by-Step Performance</CardTitle>
                <CardDescription>See how each step is performing</CardDescription>
              </CardHeader>
              <CardContent>
                {campaign.steps.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No steps to analyze yet
                  </div>
                ) : (
                  <div className="space-y-6">
                    {campaign.steps.map((step, index) => {
                      const Icon = CHANNEL_ICONS[step.channel] || Mail;
                      const colors = CHANNEL_COLORS[step.channel] || CHANNEL_COLORS.email;
                      const stepOpenRate = step.metrics.sent > 0 ? (step.metrics.opened / step.metrics.sent) * 100 : 0;
                      const stepClickRate = step.metrics.opened > 0 ? (step.metrics.clicked / step.metrics.opened) * 100 : 0;
                      const stepReplyRate = step.metrics.sent > 0 ? (step.metrics.replied / step.metrics.sent) * 100 : 0;
                      
                      return (
                        <div key={step.id} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded flex items-center justify-center ${colors.bg} ${colors.text}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{step.label}</p>
                              <p className="text-sm text-muted-foreground">Step {index + 1}</p>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {step.metrics.sent} sent
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Opens</span>
                                <span>{stepOpenRate.toFixed(1)}%</span>
                              </div>
                              <Progress value={stepOpenRate} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Clicks</span>
                                <span>{stepClickRate.toFixed(1)}%</span>
                              </div>
                              <Progress value={stepClickRate} className="h-2" />
                            </div>
                            <div>
                              <div className="flex justify-between text-sm mb-1">
                                <span>Replies</span>
                                <span>{stepReplyRate.toFixed(1)}%</span>
                              </div>
                              <Progress value={stepReplyRate} className="h-2" />
                            </div>
                          </div>
                          {index < campaign.steps.length - 1 && <Separator />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Queued</span>
                    <span className="font-medium">
                      {campaign.stats.total_contacts - campaign.stats.active_contacts - campaign.stats.completed_contacts}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active</span>
                    <span className="font-medium text-green-600">{campaign.stats.active_contacts}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Completed</span>
                    <span className="font-medium text-blue-600">{campaign.stats.completed_contacts}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between font-medium">
                    <span>Total</span>
                    <span>{campaign.stats.total_contacts}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-purple-500" />
                    AI Optimization Tips
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Strong open rates</p>
                      <p className="text-sm text-muted-foreground">Your subject lines are performing above industry average</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                    <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Consider A/B testing</p>
                      <p className="text-sm text-muted-foreground">Try different CTAs to improve click-through rates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Step Dialog */}
      <Dialog open={editStepOpen} onOpenChange={setEditStepOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Step</DialogTitle>
            <DialogDescription>
              Modify the content and settings for this campaign step
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Step Label</label>
                <Input
                  value={stepFormData.label}
                  onChange={(e) => setStepFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="e.g., Initial Outreach"
                  data-testid="input-step-label"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <Select
                  value={stepFormData.channel}
                  onValueChange={(value) => setStepFormData(prev => ({ ...prev, channel: value }))}
                >
                  <SelectTrigger data-testid="select-step-channel">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="linkedin">LinkedIn Message</SelectItem>
                    <SelectItem value="linkedin_search">LinkedIn Search</SelectItem>
                    <SelectItem value="linkedin_connect">LinkedIn Connect</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(stepFormData.channel === 'email' || stepFormData.channel === 'linkedin') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject Line</label>
                <Input
                  value={stepFormData.subject}
                  onChange={(e) => setStepFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Enter subject line"
                  data-testid="input-step-subject"
                />
              </div>
            )}
            
            {stepFormData.channel === 'linkedin_search' ? (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">LinkedIn Lead Search</h4>
                  <p className="text-sm text-blue-600 dark:text-blue-300">
                    Configure search criteria to find new leads on LinkedIn matching your target audience.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Search Keywords</label>
                  <Input
                    value={stepFormData.config.keywords}
                    onChange={(e) => setStepFormData(prev => ({ 
                      ...prev, 
                      config: { ...prev.config, keywords: e.target.value }
                    }))}
                    placeholder="e.g., software engineer, product manager"
                    data-testid="input-search-keywords"
                  />
                  <p className="text-xs text-muted-foreground">Keywords to search for in profiles</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Job Title</label>
                    <Input
                      value={stepFormData.config.jobTitle}
                      onChange={(e) => setStepFormData(prev => ({ 
                        ...prev, 
                        config: { ...prev.config, jobTitle: e.target.value }
                      }))}
                      placeholder="e.g., CEO, VP of Sales"
                      data-testid="input-search-job-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Company</label>
                    <Input
                      value={stepFormData.config.company}
                      onChange={(e) => setStepFormData(prev => ({ 
                        ...prev, 
                        config: { ...prev.config, company: e.target.value }
                      }))}
                      placeholder="e.g., Google, Microsoft"
                      data-testid="input-search-company"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Location</label>
                    <Input
                      value={stepFormData.config.location}
                      onChange={(e) => setStepFormData(prev => ({ 
                        ...prev, 
                        config: { ...prev.config, location: e.target.value }
                      }))}
                      placeholder="e.g., San Francisco, United States"
                      data-testid="input-search-location"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Industry</label>
                    <Select
                      value={stepFormData.config.industry}
                      onValueChange={(value) => setStepFormData(prev => ({ 
                        ...prev, 
                        config: { ...prev.config, industry: value }
                      }))}
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Connection Level</label>
                    <Select
                      value={stepFormData.config.connectionDegree}
                      onValueChange={(value) => setStepFormData(prev => ({ 
                        ...prev, 
                        config: { ...prev.config, connectionDegree: value }
                      }))}
                    >
                      <SelectTrigger data-testid="select-search-connection">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1st">1st Degree (Direct Connections)</SelectItem>
                        <SelectItem value="2nd">2nd Degree (Friends of Friends)</SelectItem>
                        <SelectItem value="3rd">3rd Degree (Extended Network)</SelectItem>
                        <SelectItem value="all">All Connections</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Maximum Leads</label>
                    <Select
                      value={String(stepFormData.config.maxResults)}
                      onValueChange={(value) => setStepFormData(prev => ({ 
                        ...prev, 
                        config: { ...prev.config, maxResults: value === 'unlimited' ? 'unlimited' : parseInt(value) }
                      }))}
                    >
                      <SelectTrigger data-testid="select-search-max-leads">
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
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium">Content</label>
                <Textarea
                  value={stepFormData.content}
                  onChange={(e) => setStepFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter your message content..."
                  rows={8}
                  data-testid="input-step-content"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Delay Before Step</label>
                <Input
                  type="number"
                  min="0"
                  value={stepFormData.delay}
                  onChange={(e) => setStepFormData(prev => ({ ...prev, delay: parseInt(e.target.value) || 0 }))}
                  data-testid="input-step-delay"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Delay Unit</label>
                <Select
                  value={stepFormData.delay_unit}
                  onValueChange={(value) => setStepFormData(prev => ({ ...prev, delay_unit: value }))}
                >
                  <SelectTrigger data-testid="select-step-delay-unit">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setEditStepOpen(false)}
              data-testid="btn-cancel-edit-step"
            >
              Cancel
            </Button>
            <Button
              onClick={saveStep}
              disabled={updateStepsMutation.isPending}
              data-testid="btn-save-step"
            >
              {updateStepsMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{campaign.name}"? This action cannot be undone and will permanently remove the campaign along with all its steps, contacts, and performance data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteCampaignMutation.mutate()}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={deleteCampaignMutation.isPending}
              data-testid="btn-confirm-delete"
            >
              {deleteCampaignMutation.isPending ? 'Deleting...' : 'Delete Campaign'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
