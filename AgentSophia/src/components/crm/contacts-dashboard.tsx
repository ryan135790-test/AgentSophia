import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { useContacts, useCreateContact, useUpdateContact, useDeleteContact } from '@/hooks/use-contacts';
import { Contact, InsertContact } from '../../../shared/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  Mail,
  Phone,
  Linkedin,
  Edit,
  MessageSquare,
  Calendar,
  Star,
  TrendingUp,
  MoreHorizontal,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ContactImportModal } from './contact-import-modal';

interface ContactInteraction {
  id: string;
  type: string;
  channel: string;
  subject: string;
  content: string;
  outcome: string;
  completed_at: string;
  created_at: string;
}

const CONTACT_STAGES = [
  { value: 'lead', label: 'Lead', color: 'bg-gray-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-yellow-500' },
  { value: 'proposal', label: 'Proposal', color: 'bg-orange-500' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-purple-500' },
  { value: 'closed-won', label: 'Closed Won', color: 'bg-green-500' },
  { value: 'closed-lost', label: 'Closed Lost', color: 'bg-red-500' },
];

const INTERACTION_TYPES = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'linkedin_message', label: 'LinkedIn Message', icon: Linkedin },
  { value: 'phone_call', label: 'Phone Call', icon: Phone },
  { value: 'meeting', label: 'Meeting', icon: Calendar },
  { value: 'note', label: 'Note', icon: MessageSquare },
];

export function ContactsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: contacts = [], isLoading: loading } = useContacts();
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<ContactInteraction[]>([]);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isAddInteractionOpen, setIsAddInteractionOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  const filteredContacts = useMemo(() => {
    let filtered = contacts.slice();

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contact =>
        contact.first_name?.toLowerCase().includes(query) ||
        contact.last_name?.toLowerCase().includes(query) ||
        contact.email?.toLowerCase().includes(query) ||
        contact.company?.toLowerCase().includes(query)
      );
    }

    if (stageFilter !== 'all') {
      filtered = filtered.filter(contact => contact.stage === stageFilter);
    }

    return filtered;
  }, [contacts, searchQuery, stageFilter]);

  const fetchContactInteractions = async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from('contact_interactions')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInteractions(data || []);
    } catch (error) {
      console.error('Error fetching interactions:', error);
    }
  };

  const addContact = async (contactData: InsertContact) => {
    try {
      await createContact.mutateAsync(contactData);
      setIsAddContactOpen(false);
    } catch (error) {
      // Error toast already shown by the hook
    }
  };

  const handleUpdateContact = async (id: string, contactData: Partial<InsertContact>) => {
    try {
      await updateContact.mutateAsync({ id, data: contactData });
    } catch (error) {
      // Error toast already shown by the hook
    }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await deleteContact.mutateAsync(id);
      if (selectedContact?.id === id) {
        setSelectedContact(null);
      }
    } catch (error) {
      // Error toast already shown by the hook
    }
  };

  const oldAddContact = async (contactData: Partial<Contact>) => {
    try {
      const insertData: InsertContact = {
        first_name: contactData.first_name || null,
        last_name: contactData.last_name || null,
        email: contactData.email,
        phone: contactData.phone,
        company: contactData.company,
        position: contactData.position,
        linkedin_url: contactData.linkedin_url,
        stage: contactData.stage || 'new',
        source: contactData.source,
        tags: contactData.tags || [],
        notes: contactData.notes,
      };
      
      await addContact(insertData);
      toast({
        title: 'Success',
        description: 'Contact added successfully',
      });
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: 'Error',
        description: 'Failed to add contact',
        variant: 'destructive',
      });
    }
  };

  const updateContactStage = async (contactId: string, newStage: string) => {
    try {
      await handleUpdateContact(contactId, { stage: newStage });
      
      if (selectedContact?.id === contactId) {
        setSelectedContact(prev => prev ? { ...prev, stage: newStage } : null);
      }
    } catch (error) {
      console.error('Error updating contact stage:', error);
    }
  };

  const addInteraction = async (interactionData: Partial<ContactInteraction>) => {
    if (!selectedContact) return;

    try {
      const { data, error } = await supabase
        .from('contact_interactions')
        .insert({
          type: interactionData.type || 'note',
          channel: interactionData.channel,
          subject: interactionData.subject,
          content: interactionData.content || '',
          outcome: interactionData.outcome,
          contact_id: selectedContact.id,
          user_id: user!.id,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update last_contacted on the contact
      await supabase
        .from('contacts')
        .update({ 
          last_contacted: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedContact.id);

      setInteractions(prev => [data, ...prev]);
      setIsAddInteractionOpen(false);
      toast({
        title: 'Success',
        description: 'Interaction recorded successfully',
      });
    } catch (error) {
      console.error('Error adding interaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to record interaction',
        variant: 'destructive',
      });
    }
  };

  const getStageColor = (stage: string) => {
    const stageConfig = CONTACT_STAGES.find(s => s.value === stage);
    return stageConfig ? stageConfig.color : 'bg-gray-500';
  };

  const getStageLabel = (stage: string) => {
    const stageConfig = CONTACT_STAGES.find(s => s.value === stage);
    return stageConfig ? stageConfig.label : stage;
  };

  const stageStats = CONTACT_STAGES.map(stage => ({
    ...stage,
    count: contacts.filter(c => c.stage === stage.value).length
  }));

  if (loading) {
    return <div className="p-6">Loading contacts...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">CRM Dashboard</h2>
          <p className="text-muted-foreground">Manage your contacts and track interactions</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsImportModalOpen(true)}
            data-testid="button-import-contacts"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Contacts
          </Button>
          <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary" data-testid="button-add-contact">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Contact</DialogTitle>
              </DialogHeader>
              <AddContactForm onSubmit={addContact} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contact Import Modal */}
      <ContactImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                <p className="text-2xl font-bold">{contacts.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Qualified Leads</p>
                <p className="text-2xl font-bold text-success">
                  {contacts.filter(c => c.stage === 'qualified').length}
                </p>
              </div>
              <Star className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">In Pipeline</p>
                <p className="text-2xl font-bold text-primary">
                  {contacts.filter(c => ['proposal', 'negotiation'].includes(c.stage)).length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Closed Won</p>
                <p className="text-2xl font-bold text-success">
                  {contacts.filter(c => c.stage === 'closed-won').length}
                </p>
              </div>
              <Users className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
          <CardDescription>Track contacts through your sales stages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {stageStats.map((stage) => (
              <div key={stage.value} className="text-center">
                <div className={`w-12 h-12 rounded-full ${stage.color} mx-auto mb-2 flex items-center justify-center text-white font-bold`}>
                  {stage.count}
                </div>
                <p className="text-sm font-medium">{stage.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {CONTACT_STAGES.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contacts ({filteredContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => {
                  setSelectedContact(contact);
                  fetchContactInteractions(contact.id);
                }}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="font-medium text-primary">
                      {contact.first_name?.[0]}{contact.last_name?.[0]}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium">
                      {contact.first_name} {contact.last_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {contact.position} {contact.company && `at ${contact.company}`}
                    </p>
                    <p className="text-sm text-muted-foreground">{contact.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={`${getStageColor(contact.stage)} text-white`}>
                    {getStageLabel(contact.stage)}
                  </Badge>
                  {contact.score > 0 && (
                    <Badge variant="outline">{contact.score}/100</Badge>
                  )}
                </div>
              </div>
            ))}

            {filteredContacts.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No contacts found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Detail Dialog */}
      {selectedContact && (
        <ContactDetailDialog
          contact={selectedContact}
          interactions={interactions}
          isOpen={!!selectedContact}
          onClose={() => setSelectedContact(null)}
          onUpdateStage={updateContactStage}
          onAddInteraction={() => setIsAddInteractionOpen(true)}
        />
      )}

      {/* Add Interaction Dialog */}
      <Dialog open={isAddInteractionOpen} onOpenChange={setIsAddInteractionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Interaction</DialogTitle>
          </DialogHeader>
          <AddInteractionForm onSubmit={addInteraction} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddContactForm({ onSubmit }: { onSubmit: (data: Partial<Contact>) => void }) {
  const [formData, setFormData] = useState<Partial<Contact>>({
    stage: 'lead',
    score: 0,
    tags: []
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first_name">First Name</Label>
          <Input
            id="first_name"
            value={formData.first_name || ''}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="last_name">Last Name</Label>
          <Input
            id="last_name"
            value={formData.last_name || ''}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email || ''}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={formData.company || ''}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="position">Position</Label>
          <Input
            id="position"
            value={formData.position || ''}
            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="stage">Stage</Label>
        <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTACT_STAGES.map((stage) => (
              <SelectItem key={stage.value} value={stage.value}>
                {stage.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" className="bg-gradient-primary">Add Contact</Button>
      </div>
    </form>
  );
}

function ContactDetailDialog({ 
  contact, 
  interactions, 
  isOpen, 
  onClose, 
  onUpdateStage, 
  onAddInteraction 
}: {
  contact: Contact;
  interactions: ContactInteraction[];
  isOpen: boolean;
  onClose: () => void;
  onUpdateStage: (contactId: string, stage: string) => void;
  onAddInteraction: () => void;
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            {contact.first_name} {contact.last_name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="h-[70vh]">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="interactions">Interactions ({interactions.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">Contact Information</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Email:</strong> {contact.email}</p>
                  <p><strong>Phone:</strong> {contact.phone || 'Not provided'}</p>
                  <p><strong>Company:</strong> {contact.company || 'Not provided'}</p>
                  <p><strong>Position:</strong> {contact.position || 'Not provided'}</p>
                  <p><strong>Source:</strong> {contact.source || 'Unknown'}</p>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-3">Sales Information</h3>
                <div className="space-y-2">
                  <div>
                    <Label>Stage</Label>
                    <Select value={contact.stage} onValueChange={(value) => onUpdateStage(contact.id, value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONTACT_STAGES.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm"><strong>Score:</strong> {contact.score}/100</p>
                  <p className="text-sm"><strong>Last Contacted:</strong> {contact.last_contacted ? new Date(contact.last_contacted).toLocaleDateString() : 'Never'}</p>
                </div>
              </div>
            </div>
            
            {contact.notes && (
              <div>
                <h3 className="font-medium mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{contact.notes}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="interactions" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Interaction History</h3>
              <Button size="sm" onClick={onAddInteraction}>
                <Plus className="h-4 w-4 mr-2" />
                Add Interaction
              </Button>
            </div>
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {interactions.map((interaction) => (
                <div key={interaction.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{interaction.type}</Badge>
                      {interaction.channel && (
                        <Badge variant="secondary">{interaction.channel}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(interaction.completed_at || interaction.created_at).toLocaleString()}
                    </span>
                  </div>
                  {interaction.subject && (
                    <h4 className="font-medium text-sm mb-1">{interaction.subject}</h4>
                  )}
                  <p className="text-sm text-muted-foreground">{interaction.content}</p>
                  {interaction.outcome && (
                    <Badge className="mt-2" variant={interaction.outcome === 'positive' ? 'default' : 'secondary'}>
                      {interaction.outcome}
                    </Badge>
                  )}
                </div>
              ))}
              
              {interactions.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No interactions recorded yet</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AddInteractionForm({ onSubmit }: { onSubmit: (data: Partial<ContactInteraction>) => void }) {
  const [formData, setFormData] = useState<Partial<ContactInteraction>>({
    type: 'email',
    outcome: 'neutral'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="type">Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERACTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="outcome">Outcome</Label>
          <Select value={formData.outcome} onValueChange={(value) => setFormData({ ...formData, outcome: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
              <SelectItem value="no_response">No Response</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={formData.subject || ''}
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={formData.content || ''}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={4}
          required
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="submit" className="bg-gradient-primary">Record Interaction</Button>
      </div>
    </form>
  );
}
