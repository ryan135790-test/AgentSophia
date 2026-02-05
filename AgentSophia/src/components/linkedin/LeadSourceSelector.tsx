import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Search, 
  Link2, 
  UserSearch, 
  Compass, 
  Database,
  Coins,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  Users,
  Sparkles,
  Crown,
  Zap,
  Info,
  Plus,
  FolderPlus,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface LeadSourceSelectorProps {
  workspaceId?: string;
  accountId?: string;
  onLeadsImported?: (leads: any[], source: string) => void;
  onImportComplete?: (leads: any[]) => void;
}

interface DataSourceOption {
  id: string;
  name: string;
  description: string;
  icon: any;
  creditsPerLead: number;
  color: string;
  premium?: boolean;
  available: boolean;
}

const dataSourceConfig: Record<string, Omit<DataSourceOption, 'available'>> = {
  linkedin_search: {
    id: 'linkedin_search',
    name: 'LinkedIn Search',
    description: 'Search LinkedIn profiles by keywords, title, company, and location',
    icon: Search,
    creditsPerLead: 1,
    color: 'bg-blue-500',
  },
  sales_navigator: {
    id: 'sales_navigator',
    name: 'Sales Navigator',
    description: 'Advanced search with Sales Navigator filters and spotlights',
    icon: Crown,
    creditsPerLead: 1,
    color: 'bg-amber-500',
    premium: true,
  },
  apollo_search: {
    id: 'apollo_search',
    name: 'Apollo Database',
    description: 'Search Apollo\'s B2B database - leads include email addresses',
    icon: Database,
    creditsPerLead: 1,
    color: 'bg-purple-500',
  },
  url_import: {
    id: 'url_import',
    name: 'Import URLs',
    description: 'Import leads from a list of LinkedIn profile URLs',
    icon: Link2,
    creditsPerLead: 1,
    color: 'bg-green-500',
  },
  name_research: {
    id: 'name_research',
    name: 'Name Research',
    description: 'Find LinkedIn profiles using name, company, or email',
    icon: UserSearch,
    creditsPerLead: 1,
    color: 'bg-orange-500',
  },
};

export function LeadSourceSelector({ workspaceId, accountId, onLeadsImported }: LeadSourceSelectorProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [selectedSource, setSelectedSource] = useState<string>('linkedin_search');
  const [enrichWithApollo, setEnrichWithApollo] = useState(false);
  const [verifyConnection, setVerifyConnection] = useState(true);

  const [searchKeywords, setSearchKeywords] = useState('');
  const [searchTitle, setSearchTitle] = useState('');
  const [searchCompany, setSearchCompany] = useState('');
  const [searchLocation, setSearchLocation] = useState('');
  const [maxResults, setMaxResults] = useState(25);

  const [urlList, setUrlList] = useState('');

  const [researchFirstName, setResearchFirstName] = useState('');
  const [researchLastName, setResearchLastName] = useState('');
  const [researchCompany, setResearchCompany] = useState('');
  const [researchEmail, setResearchEmail] = useState('');
  const [researchTitle, setResearchTitle] = useState('');

  const [snIndustries, setSnIndustries] = useState<string[]>([]);
  const [snCompanyHeadcount, setSnCompanyHeadcount] = useState<string[]>([]);
  const [snSeniorityLevel, setSnSeniorityLevel] = useState<string[]>([]);
  const [snFunction, setSnFunction] = useState<string[]>([]);
  const [snYearsInCurrentPosition, setSnYearsInCurrentPosition] = useState('');
  const [snYearsInCurrentCompany, setSnYearsInCurrentCompany] = useState('');
  const [snYearsOfExperience, setSnYearsOfExperience] = useState('');
  const [snConnectionLevel, setSnConnectionLevel] = useState<string[]>([]);
  const [snSpotlightFilters, setSnSpotlightFilters] = useState<string[]>([]);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [showPostImportDialog, setShowPostImportDialog] = useState(false);
  const [lastImportedLeads, setLastImportedLeads] = useState<any[]>([]);
  const [postImportCampaignId, setPostImportCampaignId] = useState<string>('');

  const { data: campaigns } = useQuery({
    queryKey: ['/api/campaigns', workspaceId],
    queryFn: () => fetch(`/api/campaigns?workspaceId=${workspaceId}`).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const addToCampaignMutation = useMutation({
    mutationFn: async ({ campaignId, contactIds }: { campaignId: string; contactIds: string[] }) => {
      const res = await apiRequest(`/api/campaigns/${campaignId}/contacts`, {
        method: 'POST',
        body: JSON.stringify({ contactIds }),
      });
      return res;
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Leads Added to Campaign',
        description: `Successfully added ${lastImportedLeads.length} leads to the campaign.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', variables.campaignId, 'contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', variables.campaignId] });
      setShowPostImportDialog(false);
      setLastImportedLeads([]);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Add Leads',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const { data: dataSources } = useQuery({
    queryKey: ['/api/linkedin/search/data-sources', accountId],
    queryFn: () => fetch(`/api/linkedin/search/data-sources/${accountId}`).then(r => r.json()),
    enabled: !!accountId,
  });

  const { data: dailyStats } = useQuery({
    queryKey: ['/api/linkedin/search/stats', workspaceId, accountId],
    queryFn: () => fetch(`/api/linkedin/search/stats/${workspaceId}/${accountId}`).then(r => r.json()),
    enabled: !!workspaceId && !!accountId,
  });

  const { data: creditBalance } = useQuery({
    queryKey: ['/api/lookup-credits/balance', workspaceId],
    queryFn: () => fetch(`/api/lookup-credits/balance/${workspaceId}`).then(r => r.json()),
    enabled: !!workspaceId,
  });

  const linkedInSearchMutation = useMutation({
    mutationFn: async (criteria: any) => {
      console.log('[LeadSourceSelector] LinkedIn search mutation called with:', criteria);
      const res = await apiRequest('/api/linkedin/search/search', {
        method: 'POST',
        body: JSON.stringify(criteria),
      });
      console.log('[LeadSourceSelector] LinkedIn search response:', res);
      return res;
    },
    onSuccess: (data) => {
      if (data.job) {
        toast({
          title: 'Search Started',
          description: `Pulling up to ${maxResults} leads. Check progress in search jobs.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Search Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const urlImportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('/api/linkedin/search/import-urls', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res;
    },
    onSuccess: (data) => {
      toast({
        title: 'Import Complete',
        description: `Imported ${data.imported?.length || 0} leads. ${data.duplicatesSkipped || 0} duplicates skipped.`,
      });
      if (data.imported && onLeadsImported) {
        onLeadsImported(data.imported, 'url_import');
      }
      if (data.imported?.length > 0) {
        setLastImportedLeads(data.imported);
        if (selectedCampaignId) {
          addToCampaignMutation.mutate({
            campaignId: selectedCampaignId,
            contactIds: data.imported.map((l: any) => l.id),
          });
        } else {
          setShowPostImportDialog(true);
        }
      }
      setUrlList('');
    },
    onError: (error: any) => {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const nameResearchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('/api/linkedin/search/research', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res;
    },
    onSuccess: (data) => {
      if (data.found && data.profile) {
        toast({
          title: 'Profile Found',
          description: `Found ${data.profile.name} with ${data.confidence}% confidence`,
        });
        if (onLeadsImported) {
          onLeadsImported([data.profile], 'name_research');
        }
        setLastImportedLeads([data.profile]);
        if (selectedCampaignId) {
          addToCampaignMutation.mutate({
            campaignId: selectedCampaignId,
            contactIds: [data.profile.id],
          });
        } else {
          setShowPostImportDialog(true);
        }
      } else {
        toast({
          title: 'No Match Found',
          description: 'Could not find a LinkedIn profile matching the criteria',
          variant: 'destructive',
        });
      }
      setResearchFirstName('');
      setResearchLastName('');
      setResearchCompany('');
      setResearchEmail('');
      setResearchTitle('');
    },
    onError: (error: any) => {
      toast({
        title: 'Research Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const apolloSearchMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('/api/linkedin/search/apollo', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res;
    },
    onSuccess: (data) => {
      toast({
        title: 'Apollo Search Complete',
        description: `Found ${data.results?.length || 0} leads. Used ${data.creditsUsed} credits.`,
      });
      if (data.results && onLeadsImported) {
        onLeadsImported(data.results, 'apollo_search');
      }
      if (data.results?.length > 0) {
        setLastImportedLeads(data.results);
        if (selectedCampaignId) {
          addToCampaignMutation.mutate({
            campaignId: selectedCampaignId,
            contactIds: data.results.map((l: any) => l.id),
          });
        } else {
          setShowPostImportDialog(true);
        }
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Apollo Search Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const salesNavMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('/api/linkedin/search/sales-navigator', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return res;
    },
    onSuccess: (data) => {
      if (data.job) {
        toast({
          title: 'Sales Navigator Search Started',
          description: 'Your search is running. Check progress in search jobs.',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Sales Navigator Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const availableSources: DataSourceOption[] = Object.entries(dataSourceConfig).map(([id, config]) => ({
    ...config,
    available: dataSources?.available?.includes(id) ?? (id === 'linkedin_search' || id === 'url_import' || id === 'name_research'),
  }));

  const selectedSourceConfig = dataSourceConfig[selectedSource];
  const estimatedCredits = selectedSource === 'url_import' 
    ? (urlList.split('\n').filter(u => u.trim()).length * (enrichWithApollo ? 2 : 1))
    : maxResults * (enrichWithApollo ? 2 : 1);

  const hasEnoughCredits = (creditBalance?.available_credits || 0) >= estimatedCredits;
  const dailyRemaining = dailyStats?.remaining || 1000;
  const canProceed = hasEnoughCredits && dailyRemaining > 0;

  const handleSearch = () => {
    console.log('[LeadSourceSelector] handleSearch called - source:', selectedSource, 'workspaceId:', workspaceId, 'accountId:', accountId);
    switch (selectedSource) {
      case 'linkedin_search':
        console.log('[LeadSourceSelector] Calling linkedInSearchMutation.mutate');
        linkedInSearchMutation.mutate({
          workspaceId,
          accountId,
          criteria: {
            keywords: searchKeywords,
            title: searchTitle,
            company: searchCompany,
            location: searchLocation,
          },
          maxResults,
        });
        break;
      case 'sales_navigator':
        salesNavMutation.mutate({
          workspaceId,
          accountId,
          filters: {
            keywords: searchKeywords,
            titles: searchTitle ? [searchTitle] : undefined,
            companies: searchCompany ? [searchCompany] : undefined,
            geography: searchLocation ? [searchLocation] : undefined,
            industries: snIndustries.length > 0 ? snIndustries : undefined,
            companyHeadcount: snCompanyHeadcount.length > 0 ? snCompanyHeadcount : undefined,
            seniorityLevel: snSeniorityLevel.length > 0 ? snSeniorityLevel : undefined,
            function: snFunction.length > 0 ? snFunction : undefined,
            yearsInCurrentPosition: snYearsInCurrentPosition || undefined,
            yearsInCurrentCompany: snYearsInCurrentCompany || undefined,
            yearsOfExperience: snYearsOfExperience || undefined,
            connectionLevel: snConnectionLevel.length > 0 ? snConnectionLevel : undefined,
            spotlightFilters: snSpotlightFilters.length > 0 ? snSpotlightFilters : undefined,
          },
          maxResults,
        });
        break;
      case 'apollo_search':
        apolloSearchMutation.mutate({
          workspaceId,
          filters: {
            personTitles: searchTitle ? [searchTitle] : undefined,
            personLocations: searchLocation ? [searchLocation] : undefined,
          },
          maxResults,
        });
        break;
      case 'url_import':
        const urls = urlList.split('\n').map(u => u.trim()).filter(Boolean);
        if (urls.length === 0) {
          toast({
            title: 'No URLs',
            description: 'Please enter at least one LinkedIn profile URL',
            variant: 'destructive',
          });
          return;
        }
        urlImportMutation.mutate({
          workspaceId,
          accountId,
          urls,
          enrichWithApollo,
          verifyConnection,
          skipDuplicates: true,
        });
        break;
      case 'name_research':
        if (!researchFirstName || !researchLastName) {
          toast({
            title: 'Missing Information',
            description: 'Please enter at least first and last name',
            variant: 'destructive',
          });
          return;
        }
        nameResearchMutation.mutate({
          workspaceId,
          accountId,
          firstName: researchFirstName,
          lastName: researchLastName,
          company: researchCompany,
          email: researchEmail,
          title: researchTitle,
        });
        break;
    }
  };

  const isLoading = linkedInSearchMutation.isPending || urlImportMutation.isPending || 
    nameResearchMutation.isPending || apolloSearchMutation.isPending || salesNavMutation.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Import Leads
              </CardTitle>
              <CardDescription>
                Choose your data source and import LinkedIn leads
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Coins className="h-4 w-4" />
                  Credits Available
                </div>
                <div className="text-2xl font-bold text-primary">
                  {creditBalance?.available_credits?.toLocaleString() || 0}
                </div>
              </div>
              <Separator orientation="vertical" className="h-12" />
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Zap className="h-4 w-4" />
                  Daily Pulls Left
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {dailyRemaining?.toLocaleString() || 1000}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-3 mb-6" data-testid="data-source-grid">
            {availableSources.map((source) => {
              const Icon = source.icon;
              const isSelected = selectedSource === source.id;
              return (
                <TooltipProvider key={source.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => source.available && setSelectedSource(source.id)}
                        disabled={!source.available}
                        className={`
                          relative p-4 rounded-xl border-2 transition-all text-left
                          ${isSelected 
                            ? 'border-primary bg-primary/5 shadow-md' 
                            : source.available 
                              ? 'border-border hover:border-primary/50 hover:bg-muted/50'
                              : 'border-dashed border-muted opacity-50 cursor-not-allowed'
                          }
                        `}
                        data-testid={`source-${source.id}`}
                      >
                        {source.premium && (
                          <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs bg-amber-100 text-amber-700">
                            Premium
                          </Badge>
                        )}
                        <div className={`w-10 h-10 rounded-lg ${source.color} flex items-center justify-center mb-3`}>
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="font-medium text-sm mb-1">{source.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Coins className="h-3 w-3" />
                          {source.creditsPerLead} credit/lead
                        </div>
                        {!source.available && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl">
                            <Badge variant="outline" className="text-xs">
                              Not Available
                            </Badge>
                          </div>
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p>{source.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>

          <Card className="bg-muted/30 border-dashed">
            <CardContent className="pt-6">
              {(selectedSource === 'linkedin_search' || selectedSource === 'sales_navigator' || selectedSource === 'apollo_search') && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="keywords">Keywords</Label>
                      <Input
                        id="keywords"
                        placeholder="e.g., AI, SaaS, marketing"
                        value={searchKeywords}
                        onChange={(e) => setSearchKeywords(e.target.value)}
                        data-testid="input-keywords"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">Job Title</Label>
                      <Input
                        id="title"
                        placeholder="e.g., CEO, VP Sales, Director"
                        value={searchTitle}
                        onChange={(e) => setSearchTitle(e.target.value)}
                        data-testid="input-title"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        placeholder="e.g., Google, Microsoft"
                        value={searchCompany}
                        onChange={(e) => setSearchCompany(e.target.value)}
                        data-testid="input-company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="e.g., San Francisco, CA"
                        value={searchLocation}
                        onChange={(e) => setSearchLocation(e.target.value)}
                        data-testid="input-location"
                      />
                    </div>
                  </div>
                  {selectedSource === 'sales_navigator' && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-amber-500" />
                          <Label className="font-medium text-amber-600">Sales Navigator Advanced Filters</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="snSeniority">Seniority Level</Label>
                            <Select
                              value={snSeniorityLevel[0] || ''}
                              onValueChange={(val) => setSnSeniorityLevel(val ? [val] : [])}
                            >
                              <SelectTrigger data-testid="select-sn-seniority">
                                <SelectValue placeholder="Any seniority" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Any</SelectItem>
                                <SelectItem value="Owner">Owner</SelectItem>
                                <SelectItem value="Partner">Partner</SelectItem>
                                <SelectItem value="CXO">CXO (C-Suite)</SelectItem>
                                <SelectItem value="VP">VP</SelectItem>
                                <SelectItem value="Director">Director</SelectItem>
                                <SelectItem value="Manager">Manager</SelectItem>
                                <SelectItem value="Senior">Senior</SelectItem>
                                <SelectItem value="Entry">Entry Level</SelectItem>
                                <SelectItem value="Training">Training/Intern</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="snFunction">Function</Label>
                            <Select
                              value={snFunction[0] || ''}
                              onValueChange={(val) => setSnFunction(val ? [val] : [])}
                            >
                              <SelectTrigger data-testid="select-sn-function">
                                <SelectValue placeholder="Any function" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Any</SelectItem>
                                <SelectItem value="Accounting">Accounting</SelectItem>
                                <SelectItem value="Administrative">Administrative</SelectItem>
                                <SelectItem value="Business Development">Business Development</SelectItem>
                                <SelectItem value="Consulting">Consulting</SelectItem>
                                <SelectItem value="Engineering">Engineering</SelectItem>
                                <SelectItem value="Entrepreneurship">Entrepreneurship</SelectItem>
                                <SelectItem value="Finance">Finance</SelectItem>
                                <SelectItem value="Human Resources">Human Resources</SelectItem>
                                <SelectItem value="Information Technology">Information Technology</SelectItem>
                                <SelectItem value="Legal">Legal</SelectItem>
                                <SelectItem value="Marketing">Marketing</SelectItem>
                                <SelectItem value="Operations">Operations</SelectItem>
                                <SelectItem value="Product Management">Product Management</SelectItem>
                                <SelectItem value="Sales">Sales</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="snIndustry">Industry</Label>
                            <Select
                              value={snIndustries[0] || ''}
                              onValueChange={(val) => setSnIndustries(val ? [val] : [])}
                            >
                              <SelectTrigger data-testid="select-sn-industry">
                                <SelectValue placeholder="Any industry" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Any</SelectItem>
                                <SelectItem value="Technology">Technology</SelectItem>
                                <SelectItem value="Computer Software">Computer Software</SelectItem>
                                <SelectItem value="Internet">Internet</SelectItem>
                                <SelectItem value="Financial Services">Financial Services</SelectItem>
                                <SelectItem value="Banking">Banking</SelectItem>
                                <SelectItem value="Insurance">Insurance</SelectItem>
                                <SelectItem value="Real Estate">Real Estate</SelectItem>
                                <SelectItem value="Healthcare">Healthcare</SelectItem>
                                <SelectItem value="Hospital & Health Care">Hospital & Health Care</SelectItem>
                                <SelectItem value="Pharmaceuticals">Pharmaceuticals</SelectItem>
                                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                                <SelectItem value="Retail">Retail</SelectItem>
                                <SelectItem value="Marketing & Advertising">Marketing & Advertising</SelectItem>
                                <SelectItem value="Professional Services">Professional Services</SelectItem>
                                <SelectItem value="Consulting">Consulting</SelectItem>
                                <SelectItem value="Education">Education</SelectItem>
                                <SelectItem value="Oil & Energy">Oil & Energy</SelectItem>
                                <SelectItem value="Construction">Construction</SelectItem>
                                <SelectItem value="Telecommunications">Telecommunications</SelectItem>
                                <SelectItem value="Media">Media</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="snHeadcount">Company Size</Label>
                            <Select
                              value={snCompanyHeadcount[0] || ''}
                              onValueChange={(val) => setSnCompanyHeadcount(val ? [val] : [])}
                            >
                              <SelectTrigger data-testid="select-sn-headcount">
                                <SelectValue placeholder="Any size" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Any</SelectItem>
                                <SelectItem value="1-10">Self-employed (1)</SelectItem>
                                <SelectItem value="2-10">2-10 employees</SelectItem>
                                <SelectItem value="11-50">11-50 employees</SelectItem>
                                <SelectItem value="51-200">51-200 employees</SelectItem>
                                <SelectItem value="201-500">201-500 employees</SelectItem>
                                <SelectItem value="501-1000">501-1,000 employees</SelectItem>
                                <SelectItem value="1001-5000">1,001-5,000 employees</SelectItem>
                                <SelectItem value="5001-10000">5,001-10,000 employees</SelectItem>
                                <SelectItem value="10001+">10,001+ employees</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="snConnection">Connection Level</Label>
                            <Select
                              value={snConnectionLevel[0] || ''}
                              onValueChange={(val) => setSnConnectionLevel(val ? [val] : [])}
                            >
                              <SelectTrigger data-testid="select-sn-connection">
                                <SelectValue placeholder="Any connection" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Any</SelectItem>
                                <SelectItem value="1st">1st Degree</SelectItem>
                                <SelectItem value="2nd">2nd Degree</SelectItem>
                                <SelectItem value="3rd+">3rd+ Degree</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="snSpotlight">Spotlight Filters</Label>
                            <Select
                              value={snSpotlightFilters[0] || ''}
                              onValueChange={(val) => setSnSpotlightFilters(val ? [val] : [])}
                            >
                              <SelectTrigger data-testid="select-sn-spotlight">
                                <SelectValue placeholder="No spotlight" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">None</SelectItem>
                                <SelectItem value="changed_jobs">Changed Jobs (90 days)</SelectItem>
                                <SelectItem value="posted_recently">Posted on LinkedIn (30 days)</SelectItem>
                                <SelectItem value="mentioned_in_news">Mentioned in News</SelectItem>
                                <SelectItem value="share_experiences">Share Experiences</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="snYearsPosition">Years in Position</Label>
                            <Select
                              value={snYearsInCurrentPosition}
                              onValueChange={setSnYearsInCurrentPosition}
                            >
                              <SelectTrigger data-testid="select-sn-years-position">
                                <SelectValue placeholder="Any" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Any</SelectItem>
                                <SelectItem value="0-1">Less than 1 year</SelectItem>
                                <SelectItem value="1-2">1-2 years</SelectItem>
                                <SelectItem value="3-5">3-5 years</SelectItem>
                                <SelectItem value="6-10">6-10 years</SelectItem>
                                <SelectItem value="10+">More than 10 years</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="snYearsCompany">Years at Company</Label>
                            <Select
                              value={snYearsInCurrentCompany}
                              onValueChange={setSnYearsInCurrentCompany}
                            >
                              <SelectTrigger data-testid="select-sn-years-company">
                                <SelectValue placeholder="Any" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Any</SelectItem>
                                <SelectItem value="0-1">Less than 1 year</SelectItem>
                                <SelectItem value="1-2">1-2 years</SelectItem>
                                <SelectItem value="3-5">3-5 years</SelectItem>
                                <SelectItem value="6-10">6-10 years</SelectItem>
                                <SelectItem value="10+">More than 10 years</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="snExperience">Total Experience</Label>
                            <Select
                              value={snYearsOfExperience}
                              onValueChange={setSnYearsOfExperience}
                            >
                              <SelectTrigger data-testid="select-sn-experience">
                                <SelectValue placeholder="Any" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="">Any</SelectItem>
                                <SelectItem value="0-2">0-2 years</SelectItem>
                                <SelectItem value="3-5">3-5 years</SelectItem>
                                <SelectItem value="6-10">6-10 years</SelectItem>
                                <SelectItem value="11-15">11-15 years</SelectItem>
                                <SelectItem value="15+">More than 15 years</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="maxResults" className="text-sm">Max Results</Label>
                        <Input
                          id="maxResults"
                          type="number"
                          min={1}
                          max={1000}
                          value={maxResults}
                          onChange={(e) => setMaxResults(parseInt(e.target.value) || 25)}
                          className="w-24"
                          data-testid="input-max-results"
                        />
                      </div>
                      {selectedSource !== 'apollo_search' && (
                        <div className="flex items-center gap-2">
                          <Switch
                            id="enrich"
                            checked={enrichWithApollo}
                            onCheckedChange={setEnrichWithApollo}
                            data-testid="switch-enrich"
                          />
                          <Label htmlFor="enrich" className="flex items-center gap-1 text-sm cursor-pointer">
                            <Sparkles className="h-4 w-4 text-purple-500" />
                            Enrich with emails (+1 credit/lead)
                          </Label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {selectedSource === 'url_import' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="urls">LinkedIn Profile URLs</Label>
                    <Textarea
                      id="urls"
                      placeholder="Paste LinkedIn profile URLs (one per line)&#10;https://linkedin.com/in/john-doe&#10;https://linkedin.com/in/jane-smith"
                      value={urlList}
                      onChange={(e) => setUrlList(e.target.value)}
                      className="min-h-[120px] font-mono text-sm"
                      data-testid="textarea-urls"
                    />
                    <p className="text-xs text-muted-foreground">
                      {urlList.split('\n').filter(u => u.trim()).length} URLs entered (max 100 per import)
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="verify"
                        checked={verifyConnection}
                        onCheckedChange={setVerifyConnection}
                        data-testid="switch-verify"
                      />
                      <Label htmlFor="verify" className="text-sm cursor-pointer">
                        Verify connection degree
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="enrichUrls"
                        checked={enrichWithApollo}
                        onCheckedChange={setEnrichWithApollo}
                        data-testid="switch-enrich-urls"
                      />
                      <Label htmlFor="enrichUrls" className="flex items-center gap-1 text-sm cursor-pointer">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        Enrich with emails (+1 credit/lead)
                      </Label>
                    </div>
                  </div>
                </div>
              )}

              {selectedSource === 'name_research' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={researchFirstName}
                        onChange={(e) => setResearchFirstName(e.target.value)}
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        placeholder="Smith"
                        value={researchLastName}
                        onChange={(e) => setResearchLastName(e.target.value)}
                        data-testid="input-last-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="researchCompany">Company (optional)</Label>
                      <Input
                        id="researchCompany"
                        placeholder="TechCorp"
                        value={researchCompany}
                        onChange={(e) => setResearchCompany(e.target.value)}
                        data-testid="input-research-company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="researchEmail">Email (optional)</Label>
                      <Input
                        id="researchEmail"
                        placeholder="john@techcorp.com"
                        value={researchEmail}
                        onChange={(e) => setResearchEmail(e.target.value)}
                        data-testid="input-research-email"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Adding company or email significantly improves match accuracy
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-primary" />
              <Label className="font-medium">Add to Campaign (Optional)</Label>
            </div>
            <Select value={selectedCampaignId || "none"} onValueChange={(val) => setSelectedCampaignId(val === "none" ? "" : val)}>
              <SelectTrigger className="w-full" data-testid="select-campaign">
                <SelectValue placeholder="Select a campaign to add leads to..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No campaign - import to contacts only</SelectItem>
                {campaigns?.map((campaign: any) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Pre-select a campaign to automatically add imported leads, or choose after import.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  Estimated: {estimatedCredits} credits
                </span>
              </div>
              {!hasEnoughCredits && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Insufficient credits
                </div>
              )}
              {dailyRemaining === 0 && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Daily limit reached
                </div>
              )}
            </div>
            <Button
              onClick={handleSearch}
              disabled={!canProceed || isLoading}
              size="lg"
              className="gap-2"
              data-testid="button-import-leads"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  {selectedSource === 'url_import' ? 'Import Leads' : 
                   selectedSource === 'name_research' ? 'Find Profile' : 'Start Search'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Data Source Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-1">
                <Search className="h-3 w-3 text-blue-500" />
                LinkedIn Search
              </div>
              <p className="text-xs text-muted-foreground">Best for broad searches. Up to 1,000/day with warmup.</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-1">
                <Crown className="h-3 w-3 text-amber-500" />
                Sales Navigator
              </div>
              <p className="text-xs text-muted-foreground">Premium filters like "changed jobs" and seniority.</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-1">
                <Database className="h-3 w-3 text-purple-500" />
                Apollo Database
              </div>
              <p className="text-xs text-muted-foreground">Leads come with verified emails included.</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-1">
                <Link2 className="h-3 w-3 text-green-500" />
                URL Import
              </div>
              <p className="text-xs text-muted-foreground">Already have profile URLs? Import them directly.</p>
            </div>
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-1">
                <UserSearch className="h-3 w-3 text-orange-500" />
                Name Research
              </div>
              <p className="text-xs text-muted-foreground">Find profiles from contact names and companies.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPostImportDialog} onOpenChange={setShowPostImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              {lastImportedLeads.length} Leads Imported Successfully
            </DialogTitle>
            <DialogDescription>
              What would you like to do with these leads?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Add to Existing Campaign
              </Label>
              <Select value={postImportCampaignId} onValueChange={setPostImportCampaignId}>
                <SelectTrigger data-testid="select-post-import-campaign">
                  <SelectValue placeholder="Select a campaign..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns?.map((campaign: any) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full mt-2"
                disabled={!postImportCampaignId || addToCampaignMutation.isPending}
                onClick={() => {
                  if (postImportCampaignId && lastImportedLeads.length > 0) {
                    addToCampaignMutation.mutate({
                      campaignId: postImportCampaignId,
                      contactIds: lastImportedLeads.map(l => l.id),
                    });
                  }
                }}
                data-testid="button-add-to-campaign"
              >
                {addToCampaignMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Campaign
                  </>
                )}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowPostImportDialog(false);
                navigate(`/campaigns/new?leads=${lastImportedLeads.map(l => l.id).join(',')}`);
              }}
              data-testid="button-create-campaign-with-leads"
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              Create New Campaign with These Leads
            </Button>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setShowPostImportDialog(false);
                setLastImportedLeads([]);
              }}
              data-testid="button-skip-campaign"
            >
              Skip - Keep in Contacts Only
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
