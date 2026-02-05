/**
 * Campaign Controls Component
 * Add More Leads, Volume/Pacing Controls, Multi-Search Management
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  UserPlus, Settings2, Search, Link2, Users, Clock, Calendar,
  Gauge, Plus, Check, X, RefreshCw, Linkedin, Mail, AlertCircle,
  ChevronRight, ExternalLink, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CampaignControlsProps {
  campaignId: string;
  workspaceId: string;
  onContactsAdded?: () => void;
}

interface PacingSettings {
  dailyLimit: number;
  weeklyLimit: number;
  sendingHours: { start: number; end: number };
  timezone: string;
  pauseOnWeekends: boolean;
  delayBetweenActions: number;
  batchSize: number;
}

interface AvailableContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  linkedin_url?: string;
  company?: string;
  title?: string;
  source?: string;
}

interface LinkedSearch {
  id: string;
  search_url: string;
  search_filters: any;
  status: string;
  results_count: number;
  leads_scraped: number;
  leads_imported: number;
  created_at: string;
}

interface UnlinkedSearch {
  id: string;
  search_url: string;
  search_filters: any;
  status: string;
  results_count: number;
  leads_count: number;
  created_at: string;
}

export function CampaignControls({ campaignId, workspaceId, onContactsAdded }: CampaignControlsProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('add-leads');
  
  // Pacing state
  const [pacing, setPacing] = useState<PacingSettings>({
    dailyLimit: 25,
    weeklyLimit: 100,
    sendingHours: { start: 9, end: 17 },
    timezone: 'America/New_York',
    pauseOnWeekends: true,
    delayBetweenActions: 60,
    batchSize: 10
  });
  const [pacingLoading, setPacingLoading] = useState(false);
  const [pacingSaving, setPacingSaving] = useState(false);
  const [stats, setStats] = useState({ totalContacts: 0, pendingSteps: 0, completedSteps: 0 });

  // Contacts state
  const [availableContacts, setAvailableContacts] = useState<AvailableContact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [contactsLoading, setContactsLoading] = useState(false);
  const [addingContacts, setAddingContacts] = useState(false);
  const [totalAvailable, setTotalAvailable] = useState(0);

  // Searches state
  const [linkedSearches, setLinkedSearches] = useState<LinkedSearch[]>([]);
  const [unlinkedSearches, setUnlinkedSearches] = useState<UnlinkedSearch[]>([]);
  const [searchesLoading, setSearchesLoading] = useState(false);
  const [linkingSearch, setLinkingSearch] = useState<string | null>(null);

  // Load data when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadPacingSettings();
      loadAvailableContacts();
      loadSearches();
    }
  }, [isOpen, campaignId]);

  // Debounced contact search
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        loadAvailableContacts();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [contactSearch]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token 
      ? { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  };

  const loadPacingSettings = async () => {
    setPacingLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/campaigns/${campaignId}/pacing`, { headers });
      if (res.ok) {
        const data = await res.json();
        setPacing(data.pacing);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load pacing:', error);
    } finally {
      setPacingLoading(false);
    }
  };

  const savePacingSettings = async () => {
    setPacingSaving(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/campaigns/${campaignId}/pacing`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(pacing)
      });
      if (res.ok) {
        toast({ title: 'Settings saved', description: 'Pacing controls updated successfully' });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save pacing settings', variant: 'destructive' });
    } finally {
      setPacingSaving(false);
    }
  };

  const loadAvailableContacts = async () => {
    setContactsLoading(true);
    try {
      const headers = await getAuthHeaders();
      const searchParam = contactSearch ? `&search=${encodeURIComponent(contactSearch)}` : '';
      const res = await fetch(`/api/campaigns/${campaignId}/available-contacts?limit=100${searchParam}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setAvailableContacts(data.contacts || []);
        setTotalAvailable(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setContactsLoading(false);
    }
  };

  const loadSearches = async () => {
    setSearchesLoading(true);
    try {
      const headers = await getAuthHeaders();
      const [linkedRes, unlinkedRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/linkedin-searches`, { headers }),
        fetch(`/api/workspaces/${workspaceId}/unlinked-searches`, { headers })
      ]);

      if (linkedRes.ok) {
        const data = await linkedRes.json();
        setLinkedSearches(data.searches || []);
      }

      if (unlinkedRes.ok) {
        const data = await unlinkedRes.json();
        setUnlinkedSearches(data.searches || []);
      }
    } catch (error) {
      console.error('Failed to load searches:', error);
    } finally {
      setSearchesLoading(false);
    }
  };

  const addSelectedContacts = async () => {
    if (selectedContacts.size === 0) return;
    
    setAddingContacts(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/campaigns/${campaignId}/add-contacts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contactIds: Array.from(selectedContacts),
          scheduleImmediately: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Contacts added',
          description: data.message
        });
        setSelectedContacts(new Set());
        loadAvailableContacts();
        loadPacingSettings(); // Refresh stats
        onContactsAdded?.();
      } else {
        throw new Error('Failed to add contacts');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add contacts', variant: 'destructive' });
    } finally {
      setAddingContacts(false);
    }
  };

  const linkSearchToCampaign = async (searchJobId: string) => {
    setLinkingSearch(searchJobId);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/campaigns/${campaignId}/link-search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ searchJobId })
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Search linked',
          description: data.message
        });
        loadSearches();
        loadPacingSettings(); // Refresh stats
        onContactsAdded?.();
      } else {
        throw new Error('Failed to link search');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to link search', variant: 'destructive' });
    } finally {
      setLinkingSearch(null);
    }
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllContacts = () => {
    setSelectedContacts(new Set(availableContacts.map(c => c.id)));
  };

  const formatSearchFilters = (filters: any) => {
    if (!filters) return 'LinkedIn Search';
    const parts: string[] = [];
    if (filters.keywords) parts.push(filters.keywords);
    if (filters.title) parts.push(`Title: ${filters.title}`);
    if (filters.company) parts.push(`Company: ${filters.company}`);
    if (filters.location) parts.push(`Location: ${filters.location}`);
    return parts.length > 0 ? parts.join(' | ') : 'LinkedIn Search';
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" data-testid="button-campaign-controls">
          <Settings2 className="h-4 w-4" />
          Campaign Controls
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Campaign Controls
          </DialogTitle>
          <DialogDescription>
            Add more leads, adjust pacing, and manage LinkedIn searches
          </DialogDescription>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border text-center">
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalContacts}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">Total Contacts</p>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border text-center">
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{stats.pendingSteps}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Pending Steps</p>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border text-center">
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.completedSteps}</p>
            <p className="text-xs text-green-600 dark:text-green-400">Completed</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="add-leads" className="gap-1.5" data-testid="tab-add-leads">
              <UserPlus className="h-4 w-4" />
              Add Leads
            </TabsTrigger>
            <TabsTrigger value="pacing" className="gap-1.5" data-testid="tab-pacing">
              <Gauge className="h-4 w-4" />
              Volume
            </TabsTrigger>
            <TabsTrigger value="searches" className="gap-1.5" data-testid="tab-searches">
              <Search className="h-4 w-4" />
              Searches
            </TabsTrigger>
          </TabsList>

          {/* Add Leads Tab */}
          <TabsContent value="add-leads" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search contacts by name, email, or company..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-contact-search"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllContacts}
                disabled={availableContacts.length === 0}
                data-testid="button-select-all"
              >
                Select All
              </Button>
            </div>

            <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              {totalAvailable} contacts available to add
              {selectedContacts.size > 0 && (
                <Badge variant="secondary" className="ml-2">{selectedContacts.size} selected</Badge>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
              {contactsLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-500">Loading contacts...</p>
                </div>
              ) : availableContacts.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-500">
                    {contactSearch ? 'No matching contacts found' : 'All contacts are already in this campaign'}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {availableContacts.map(contact => (
                    <div
                      key={contact.id}
                      className={`p-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                        selectedContacts.has(contact.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                      }`}
                      onClick={() => toggleContact(contact.id)}
                      data-testid={`contact-row-${contact.id}`}
                    >
                      <Checkbox
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {contact.first_name} {contact.last_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {contact.email || contact.title || 'No email'}
                          {contact.company && ` at ${contact.company}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {contact.linkedin_url && (
                          <Linkedin className="h-4 w-4 text-blue-600" />
                        )}
                        {contact.email && (
                          <Mail className="h-4 w-4 text-purple-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-end gap-2 mt-3 pt-3 border-t">
              <Button
                onClick={addSelectedContacts}
                disabled={selectedContacts.size === 0 || addingContacts}
                data-testid="button-add-contacts"
              >
                {addingContacts ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add {selectedContacts.size} Contact{selectedContacts.size !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* Pacing/Volume Tab */}
          <TabsContent value="pacing" className="flex-1 overflow-auto mt-4">
            {pacingLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-500">Loading settings...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Daily Limit */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Daily Limit
                    </Label>
                    <Badge variant="outline">{pacing.dailyLimit} contacts/day</Badge>
                  </div>
                  <Slider
                    value={[pacing.dailyLimit]}
                    onValueChange={([value]) => setPacing({ ...pacing, dailyLimit: value })}
                    min={5}
                    max={100}
                    step={5}
                    className="w-full"
                    data-testid="slider-daily-limit"
                  />
                  <p className="text-xs text-slate-500">
                    Maximum contacts processed per day. Lower values are safer for LinkedIn.
                  </p>
                </div>

                {/* Weekly Limit */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Weekly Limit
                    </Label>
                    <Badge variant="outline">{pacing.weeklyLimit} contacts/week</Badge>
                  </div>
                  <Slider
                    value={[pacing.weeklyLimit]}
                    onValueChange={([value]) => setPacing({ ...pacing, weeklyLimit: value })}
                    min={25}
                    max={500}
                    step={25}
                    className="w-full"
                    data-testid="slider-weekly-limit"
                  />
                </div>

                {/* Sending Hours */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Sending Hours
                  </Label>
                  <div className="flex items-center gap-4">
                    <Select
                      value={pacing.sendingHours.start.toString()}
                      onValueChange={(value) => setPacing({
                        ...pacing,
                        sendingHours: { ...pacing.sendingHours, start: parseInt(value) }
                      })}
                    >
                      <SelectTrigger className="w-[120px]" data-testid="select-start-hour">
                        <SelectValue placeholder="Start" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-slate-500">to</span>
                    <Select
                      value={pacing.sendingHours.end.toString()}
                      onValueChange={(value) => setPacing({
                        ...pacing,
                        sendingHours: { ...pacing.sendingHours, end: parseInt(value) }
                      })}
                    >
                      <SelectTrigger className="w-[120px]" data-testid="select-end-hour">
                        <SelectValue placeholder="End" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => (
                          <SelectItem key={i} value={i.toString()}>
                            {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Pause on Weekends */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Pause on Weekends
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Stop sending on Saturday and Sunday
                    </p>
                  </div>
                  <Switch
                    checked={pacing.pauseOnWeekends}
                    onCheckedChange={(checked) => setPacing({ ...pacing, pauseOnWeekends: checked })}
                    data-testid="switch-pause-weekends"
                  />
                </div>

                {/* Delay Between Actions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Gauge className="h-4 w-4" />
                      Delay Between Actions
                    </Label>
                    <Badge variant="outline">{pacing.delayBetweenActions} seconds</Badge>
                  </div>
                  <Slider
                    value={[pacing.delayBetweenActions]}
                    onValueChange={([value]) => setPacing({ ...pacing, delayBetweenActions: value })}
                    min={30}
                    max={300}
                    step={15}
                    className="w-full"
                    data-testid="slider-delay"
                  />
                  <p className="text-xs text-slate-500">
                    Time to wait between each action. Longer delays appear more human-like.
                  </p>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={savePacingSettings} disabled={pacingSaving} data-testid="button-save-pacing">
                    {pacingSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Save Settings
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Searches Tab */}
          <TabsContent value="searches" className="flex-1 overflow-auto mt-4">
            {searchesLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-slate-400" />
                <p className="text-sm text-slate-500">Loading searches...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Linked Searches */}
                <div>
                  <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-green-600" />
                    Linked Searches ({linkedSearches.length})
                  </h3>
                  {linkedSearches.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
                      <p className="text-sm text-slate-500">No LinkedIn searches linked to this campaign yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {linkedSearches.map(search => (
                        <Card key={search.id} className="p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {formatSearchFilters(search.search_filters)}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {search.leads_scraped} scraped
                                </span>
                                <span className="flex items-center gap-1">
                                  <Check className="h-3 w-3 text-green-600" />
                                  {search.leads_imported} imported
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant={search.status === 'completed' ? 'default' : 'secondary'}
                              className="ml-2"
                            >
                              {search.status}
                            </Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Searches to Link */}
                {unlinkedSearches.length > 0 && (
                  <div>
                    <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <Search className="h-4 w-4 text-blue-600" />
                      Available Searches ({unlinkedSearches.length})
                    </h3>
                    <p className="text-xs text-slate-500 mb-3">
                      Link completed searches to import their leads into this campaign
                    </p>
                    <div className="space-y-2">
                      {unlinkedSearches.map(search => (
                        <Card key={search.id} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {formatSearchFilters(search.search_filters)}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {search.leads_count} leads
                                </span>
                                <span>
                                  {new Date(search.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => linkSearchToCampaign(search.id)}
                              disabled={linkingSearch === search.id}
                              data-testid={`button-link-search-${search.id}`}
                            >
                              {linkingSearch === search.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Link2 className="h-4 w-4 mr-1" />
                                  Link
                                </>
                              )}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="pt-4 border-t">
                  <h3 className="font-medium text-sm mb-3">Quick Actions</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = '/linkedin-search'}
                      data-testid="button-new-search"
                    >
                      <Search className="h-4 w-4 mr-1" />
                      New LinkedIn Search
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadSearches}
                      data-testid="button-refresh-searches"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default CampaignControls;
