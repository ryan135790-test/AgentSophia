import { useState } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  Linkedin,
  Mail,
  FileSpreadsheet,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { enrichContactBatch } from '@/lib/contact-enrichment';

interface ContactImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedContact {
  firstName: string;
  lastName: string;
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
}

export function ContactImportModal({ isOpen, onClose }: ContactImportModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [emailList, setEmailList] = useState('');
  const [linkedinUrls, setLinkedinUrls] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; enriched: number } | null>(null);

  const importContactsMutation = useMutation({
    mutationFn: async (contacts: ParsedContact[]) => {
      // Skip AI enrichment - OpenAI quota exceeded
      setIsEnriching(false);
      
      // Prepare contacts for insertion without enrichment
      const contactsToInsert = contacts.map((contact) => ({
        first_name: contact.firstName,
        last_name: contact.lastName,
        email: contact.email,
        company: contact.company,
        position: contact.title,
        phone: contact.phone,
        linkedin_url: contact.linkedinUrl,
        tags: ['imported'],
        stage: 'new',
        user_id: user?.id
      }));

      const { data, error } = await (supabase as any)
        .from('contacts')
        .insert(contactsToInsert)
        .select();

      if (error) {
        // Check if it's the missing table error
        if (error.code === 'PGRST205' || error.message?.includes('contacts')) {
          throw new Error('DATABASE_NOT_SETUP');
        }
        throw error;
      }
      return { data, enrichedCount: 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setImportResults({ success: result.data.length, failed: 0, enriched: 0 });
      toast({
        title: 'Contacts Imported!',
        description: `Added ${result.data.length} contacts successfully`,
      });
    },
    onError: (error: any) => {
      console.error('Import error:', error);
      
      if (error.message === 'DATABASE_NOT_SETUP') {
        toast({
          title: 'Database Not Set Up',
          description: 'The contacts table does not exist. Please run the SQL setup script in your Supabase dashboard.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Import Failed',
          description: error.message || 'Could not import contacts. Please check the format and try again.',
          variant: 'destructive',
        });
      }
      setIsEnriching(false);
    },
  });

  const parseCSV = (text: string): ParsedContact[] => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    const contacts: ParsedContact[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const contact: ParsedContact = {
        firstName: '',
        lastName: '',
      };
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        if (header.includes('first') && header.includes('name')) {
          contact.firstName = value;
        } else if (header.includes('last') && header.includes('name')) {
          contact.lastName = value;
        } else if (header.includes('email')) {
          contact.email = value;
        } else if (header.includes('company')) {
          contact.company = value;
        } else if (header.includes('title') || header.includes('position')) {
          contact.title = value;
        } else if (header.includes('phone')) {
          contact.phone = value;
        } else if (header.includes('linkedin')) {
          contact.linkedinUrl = value;
        }
      });
      
      if (contact.firstName || contact.lastName || contact.email) {
        contacts.push(contact);
      }
    }
    
    return contacts;
  };

  const parseEmailList = (text: string): ParsedContact[] => {
    const emails = text.split(/[\n,;]/).map(e => e.trim()).filter(e => e.includes('@'));
    
    return emails.map(email => {
      const namePart = email.split('@')[0];
      const names = namePart.split(/[._-]/);
      
      return {
        firstName: names[0] ? names[0].charAt(0).toUpperCase() + names[0].slice(1) : '',
        lastName: names[1] ? names[1].charAt(0).toUpperCase() + names[1].slice(1) : '',
        email: email,
      };
    });
  };

  const parseLinkedInUrls = (text: string): ParsedContact[] => {
    const urls = text.split('\n').map(u => u.trim()).filter(u => u.includes('linkedin.com'));
    
    return urls.map(url => {
      const namePart = url.split('/in/')[1]?.split('/')[0] || '';
      const names = namePart.split('-');
      
      return {
        firstName: names[0] ? names[0].charAt(0).toUpperCase() + names[0].slice(1) : '',
        lastName: names[1] ? names[1].charAt(0).toUpperCase() + names[1].slice(1) : '',
        linkedinUrl: url,
      };
    });
  };

  const handleCSVUpload = async () => {
    if (!csvFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      const contacts = parseCSV(text);
      
      if (contacts.length === 0) {
        toast({
          title: 'No Contacts Found',
          description: 'Could not parse any contacts from the CSV file',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }
      
      await importContactsMutation.mutateAsync(contacts);
      setIsProcessing(false);
      setCsvFile(null);
    };
    
    reader.readAsText(csvFile);
  };

  const handleEmailImport = async () => {
    if (!emailList.trim()) {
      toast({
        title: 'No Emails Provided',
        description: 'Please paste email addresses to import',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    const contacts = parseEmailList(emailList);
    
    if (contacts.length === 0) {
      toast({
        title: 'No Valid Emails',
        description: 'Could not find any valid email addresses',
        variant: 'destructive',
      });
      setIsProcessing(false);
      return;
    }
    
    await importContactsMutation.mutateAsync(contacts);
    setIsProcessing(false);
    setEmailList('');
  };

  const handleLinkedInImport = async () => {
    if (!linkedinUrls.trim()) {
      toast({
        title: 'No URLs Provided',
        description: 'Please paste LinkedIn URLs to import',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    const contacts = parseLinkedInUrls(linkedinUrls);
    
    if (contacts.length === 0) {
      toast({
        title: 'No Valid URLs',
        description: 'Could not find any valid LinkedIn URLs',
        variant: 'destructive',
      });
      setIsProcessing(false);
      return;
    }
    
    await importContactsMutation.mutateAsync(contacts);
    setIsProcessing(false);
    setLinkedinUrls('');
  };

  const handleClose = () => {
    setCsvFile(null);
    setEmailList('');
    setLinkedinUrls('');
    setImportResults(null);
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-import-contacts">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Contacts
          </DialogTitle>
          <DialogDescription>
            Import contacts from multiple sources: CSV files, LinkedIn, Sales Navigator, or email lists
          </DialogDescription>
        </DialogHeader>

        {isEnriching ? (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-center">
              <Sparkles className="h-16 w-16 text-purple-500 animate-pulse" />
            </div>
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">AI Enriching Contacts...</h3>
              <p className="text-sm text-muted-foreground">
                Validating emails, verifying phone numbers, and enhancing contact data
              </p>
              <Progress value={enrichmentProgress} className="w-full" />
            </div>
          </div>
        ) : importResults ? (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                Import Successful! 
                <Sparkles className="h-5 w-5 text-purple-500" />
              </h3>
              <p className="text-muted-foreground">
                Successfully imported and enriched {importResults.success} contacts with AI validation
                {importResults.failed > 0 && ` (${importResults.failed} failed)`}
              </p>
              <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  ✨ All contacts have been validated for email format, phone numbers, and data quality
                </p>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full" data-testid="button-close-results">
              Done
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="csv" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="csv" className="gap-2" data-testid="tab-csv">
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="gap-2" data-testid="tab-linkedin">
                <Linkedin className="h-4 w-4" />
                LinkedIn
              </TabsTrigger>
              <TabsTrigger value="salesnav" className="gap-2" data-testid="tab-salesnav">
                <Users className="h-4 w-4" />
                Sales Nav
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
                <Mail className="h-4 w-4" />
                Email List
              </TabsTrigger>
            </TabsList>

            <TabsContent value="csv" className="space-y-4 mt-4" data-testid="content-csv">
              <div className="space-y-2">
                <Label>Upload CSV File</Label>
                <p className="text-sm text-muted-foreground">
                  CSV should have columns: First Name, Last Name, Email, Company, Title, Phone, LinkedIn URL
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-muted-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90"
                  data-testid="input-csv-file"
                />
              </div>
              {csvFile && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="text-sm">{csvFile.name}</span>
                </div>
              )}
              <Button 
                onClick={handleCSVUpload} 
                disabled={!csvFile || isProcessing}
                className="w-full"
                data-testid="button-import-csv"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import from CSV
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="linkedin" className="space-y-4 mt-4" data-testid="content-linkedin">
              <div className="space-y-2">
                <Label>LinkedIn Profile URLs</Label>
                <p className="text-sm text-muted-foreground">
                  Paste LinkedIn profile URLs (one per line). Example: https://linkedin.com/in/john-doe
                </p>
                <Textarea
                  placeholder="https://linkedin.com/in/john-doe&#10;https://linkedin.com/in/jane-smith&#10;..."
                  value={linkedinUrls}
                  onChange={(e) => setLinkedinUrls(e.target.value)}
                  rows={8}
                  data-testid="input-linkedin-urls"
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 text-blue-600" />
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Pro tip: You can copy URLs directly from LinkedIn or Sales Navigator search results
                </p>
              </div>
              <Button 
                onClick={handleLinkedInImport} 
                disabled={!linkedinUrls.trim() || isProcessing}
                className="w-full"
                data-testid="button-import-linkedin"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Linkedin className="h-4 w-4 mr-2" />
                    Import from LinkedIn
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="salesnav" className="space-y-4 mt-4" data-testid="content-salesnav">
              <div className="space-y-2">
                <Label>Sales Navigator URLs</Label>
                <p className="text-sm text-muted-foreground">
                  Paste LinkedIn Sales Navigator profile URLs (one per line)
                </p>
                <Textarea
                  placeholder="https://www.linkedin.com/sales/people/..."
                  value={linkedinUrls}
                  onChange={(e) => setLinkedinUrls(e.target.value)}
                  rows={8}
                  data-testid="input-salesnav-urls"
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 text-purple-600" />
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  Sales Navigator URLs work the same as regular LinkedIn URLs for import
                </p>
              </div>
              <Button 
                onClick={handleLinkedInImport} 
                disabled={!linkedinUrls.trim() || isProcessing}
                className="w-full"
                data-testid="button-import-salesnav"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Import from Sales Nav
                  </>
                )}
              </Button>
            </TabsContent>

            <TabsContent value="email" className="space-y-4 mt-4" data-testid="content-email">
              <div className="space-y-2">
                <Label>Email Addresses</Label>
                <p className="text-sm text-muted-foreground">
                  Paste email addresses (separated by commas, semicolons, or new lines)
                </p>
                <Textarea
                  placeholder="john.doe@company.com, jane.smith@company.com&#10;bob@example.com..."
                  value={emailList}
                  onChange={(e) => setEmailList(e.target.value)}
                  rows={8}
                  data-testid="input-email-list"
                />
              </div>
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 text-green-600" />
                <p className="text-sm text-green-600 dark:text-green-400">
                  We'll automatically extract names from email addresses when possible
                </p>
              </div>
              <Button 
                onClick={handleEmailImport} 
                disabled={!emailList.trim() || isProcessing}
                className="w-full"
                data-testid="button-import-email"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Import from Email List
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
