import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Users, Search, UserPlus, Upload, Filter, CheckCircle2, 
  Building2, Mail, Linkedin, Sparkles, Bot
} from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useCampaignDraft } from '@/contexts/CampaignDraftContext';
import { LeadSourceSelector } from '@/components/linkedin/LeadSourceSelector';

interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  tags: string[] | null;
}

interface CampaignContactsStepProps {
  onContactsSelected?: (contactIds: string[]) => void;
  showImportOption?: boolean;
}

export function CampaignContactsStep({ onContactsSelected, showImportOption = true }: CampaignContactsStepProps) {
  const { currentWorkspace } = useWorkspace();
  const { draft, setSelectedContacts, addSelectedContacts, removeSelectedContacts } = useCampaignDraft();
  const [searchQuery, setSearchQuery] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const selectedContactIds = draft.selectedContactIds || [];

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts', currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
  });

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter(contact => {
      const matchesSearch = searchQuery === '' || 
        `${contact.first_name} ${contact.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTags = filterTags.length === 0 || 
        filterTags.some(tag => contact.tags?.includes(tag));
      
      return matchesSearch && matchesTags;
    });
  }, [contacts, searchQuery, filterTags]);

  const allTags = useMemo(() => {
    if (!contacts) return [];
    const tagSet = new Set<string>();
    contacts.forEach(c => c.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet);
  }, [contacts]);

  const toggleContact = (contactId: string) => {
    if (selectedContactIds.includes(contactId)) {
      removeSelectedContacts([contactId]);
    } else {
      addSelectedContacts([contactId]);
    }
    onContactsSelected?.(
      selectedContactIds.includes(contactId)
        ? selectedContactIds.filter(id => id !== contactId)
        : [...selectedContactIds, contactId]
    );
  };

  const selectAll = () => {
    const allIds = filteredContacts.map(c => c.id);
    setSelectedContacts(allIds);
    onContactsSelected?.(allIds);
  };

  const deselectAll = () => {
    setSelectedContacts([]);
    onContactsSelected?.([]);
  };

  const handleImportComplete = (importedLeads: any[]) => {
    const newIds = importedLeads.map(l => l.id);
    addSelectedContacts(newIds);
    setShowImportDialog(false);
    onContactsSelected?.([...selectedContactIds, ...newIds]);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Contacts for Campaign
              </CardTitle>
              <CardDescription>
                Choose contacts from your database or import new leads
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {selectedContactIds.length} selected
              </Badge>
              {showImportOption && (
                <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2" data-testid="button-import-leads">
                      <Upload className="h-4 w-4" />
                      Import Leads
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Import Leads to Campaign</DialogTitle>
                    </DialogHeader>
                    <LeadSourceSelector onImportComplete={handleImportComplete} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts by name, email, or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-contacts"
              />
            </div>
            <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={deselectAll} data-testid="button-deselect-all">
              Clear
            </Button>
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filter by tag:</span>
              {allTags.slice(0, 10).map((tag, idx) => (
                <Badge
                  key={tag}
                  variant={filterTags.includes(tag) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setFilterTags(prev => 
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  )}
                  data-testid={`filter-tag-${idx}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <ScrollArea className="h-[400px] border rounded-lg">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {contacts?.length === 0 ? 'No contacts yet. Import leads to get started.' : 'No contacts match your search.'}
                </p>
                {showImportOption && contacts?.length === 0 && (
                  <Button 
                    variant="outline" 
                    className="mt-4 gap-2"
                    onClick={() => setShowImportDialog(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Import Your First Leads
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y">
                {filteredContacts.map(contact => (
                  <div
                    key={contact.id}
                    className={`flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                      selectedContactIds.includes(contact.id) ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleContact(contact.id)}
                    data-testid={`contact-row-${contact.id}`}
                  >
                    <Checkbox 
                      checked={selectedContactIds.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                      data-testid={`checkbox-contact-${contact.id}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {contact.first_name} {contact.last_name}
                        </p>
                        {contact.tags?.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        {contact.job_title && (
                          <span className="truncate">{contact.job_title}</span>
                        )}
                        {contact.company && (
                          <span className="flex items-center gap-1 truncate">
                            <Building2 className="h-3 w-3" />
                            {contact.company}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {contact.email && (
                        <span title={contact.email}>
                          <Mail className="h-4 w-4" />
                        </span>
                      )}
                      {contact.linkedin_url && (
                        <span title="LinkedIn connected">
                          <Linkedin className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedContactIds.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Sophia's Recommendation
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedContactIds.length} contacts selected. 
                    {selectedContactIds.length < 50 
                      ? ' Consider adding more for better A/B testing results.'
                      : ' Great selection size for campaign testing!'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
