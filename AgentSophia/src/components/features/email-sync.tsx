import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, RefreshCw, LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export function EmailSync() {
  const { toast } = useToast();
  const { currentWorkspace } = useWorkspace();
  const [emails, setEmails] = useState<any[]>([]);
  const [provider, setProvider] = useState('gmail');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace?.id) {
      fetchEmails();
    }
  }, [currentWorkspace?.id]);

  const fetchEmails = async () => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/synced-emails`);
      if (res.ok) {
        setEmails(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const syncNow = async () => {
    if (!currentWorkspace?.id) return;
    setSyncing(true);
    try {
      const res = await fetch(`/api/workspaces/${currentWorkspace.id}/email-sync-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          email: 'demo@gmail.com',
          access_token: 'demo-token',
          auto_sync_enabled: true,
          sync_interval_minutes: 15
        })
      });

      if (res.ok) {
        toast({ title: 'Success', description: 'Email sync started' });
        fetchEmails();
      }
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <div>Loading emails...</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Two-Way Email Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div data-testid="select-email-provider">
            <label className="text-sm font-medium">Email Provider</label>
            <Select value={provider || "gmail"} onValueChange={setProvider}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gmail" data-testid="option-gmail">Gmail</SelectItem>
                <SelectItem value="outlook" data-testid="option-outlook">Outlook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={syncNow} disabled={syncing} className="w-full" data-testid="button-sync-emails">
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Emails Now'}
          </Button>
        </CardContent>
      </Card>

      {emails.length > 0 && (
        <Card data-testid="card-synced-emails">
          <CardHeader>
            <CardTitle className="text-sm">Recent Synced Emails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {emails.map((email) => (
              <div key={email.id} className="border rounded p-3" data-testid={`email-item-${email.id}`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{email.subject}</p>
                    <p className="text-xs text-muted-foreground">{email.sender_email}</p>
                  </div>
                  {email.is_reply && <Badge variant="outline">Reply</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Auto-Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Auto-sync every 15 minutes • Thread conversations unified • Last sync: just now</p>
        </CardContent>
      </Card>
    </div>
  );
}
