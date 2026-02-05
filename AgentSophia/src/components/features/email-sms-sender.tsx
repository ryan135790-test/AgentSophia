import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Mail, MessageSquare, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function EmailSMSSender() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [recipients, setRecipients] = useState('');

  const sendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim() || !recipients.trim() || !currentWorkspace?.id) {
      toast({ title: 'Error', description: 'All fields required', variant: 'destructive' });
      return;
    }

    const res = await fetch(`/api/workspaces/${currentWorkspace.id}/email-campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: recipients.split(',').map(e => e.trim()),
        subject: emailSubject,
        body: emailBody,
        status: 'sending'
      })
    });

    if (res.ok) {
      toast({ title: 'Success', description: 'Email campaign started' });
      setEmailSubject('');
      setEmailBody('');
      setRecipients('');
    }
  };

  const sendSMS = async () => {
    if (!smsMessage.trim() || !recipients.trim() || !currentWorkspace?.id) {
      toast({ title: 'Error', description: 'All fields required', variant: 'destructive' });
      return;
    }

    const res = await fetch(`/api/workspaces/${currentWorkspace.id}/sms-campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: recipients.split(',').map(p => p.trim()),
        message: smsMessage,
        status: 'sending'
      })
    });

    if (res.ok) {
      toast({ title: 'Success', description: 'SMS campaign started' });
      setSmsMessage('');
      setRecipients('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          Email & SMS Campaigns
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="email">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> SMS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-4">
            <div data-testid="input-recipients">
              <label className="text-sm font-medium">Recipients (comma-separated)</label>
              <Input
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="email@example.com, user@test.com"
                className="mt-1"
              />
            </div>
            <div data-testid="input-subject">
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Email subject"
                className="mt-1"
              />
            </div>
            <div data-testid="textarea-email-body">
              <label className="text-sm font-medium">Body</label>
              <Textarea
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                placeholder="Email content..."
                className="mt-1 h-32"
              />
            </div>
            <Button onClick={sendEmail} className="w-full" data-testid="button-send-email">
              <Mail className="h-4 w-4 mr-2" />
              Send Email Campaign
            </Button>
          </TabsContent>

          <TabsContent value="sms" className="space-y-4">
            <div data-testid="input-sms-recipients">
              <label className="text-sm font-medium">Phone Numbers (comma-separated)</label>
              <Input
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="+1234567890, +9876543210"
                className="mt-1"
              />
            </div>
            <div data-testid="textarea-sms-message">
              <label className="text-sm font-medium">Message ({smsMessage.length}/160)</label>
              <Textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value.substring(0, 160))}
                placeholder="SMS message..."
                className="mt-1 h-24"
              />
            </div>
            <Button onClick={sendSMS} className="w-full" data-testid="button-send-sms">
              <MessageSquare className="h-4 w-4 mr-2" />
              Send SMS Campaign
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
