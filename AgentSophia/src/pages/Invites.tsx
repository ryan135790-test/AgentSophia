import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle, XCircle, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/auth/auth-provider';

interface Invite {
  id: string;
  workspace_id: string;
  user_email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'invited' | 'active' | 'declined';
  created_at: string;
  workspaces: { id: string; name: string; description: string | null };
}

export default function Invites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchInvites();
    }
  }, [user]);

  const fetchInvites = async () => {
    try {
      const response = await fetch('/api/invites', {
        headers: {
          'Authorization': `Bearer ${(user as any)?.access_token || ''}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch invites');

      const data = await response.json();
      setInvites(data);
    } catch (error) {
      console.error('Error fetching invites:', error);
      toast({ title: 'Error', description: 'Failed to load invites', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invite: Invite) => {
    setActionInProgress(invite.id);
    try {
      const response = await fetch(
        `/api/workspaces/${invite.workspace_id}/members/${invite.id}/accept`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(user as any)?.access_token || ''}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to accept invite');

      toast({
        title: 'Success',
        description: `You've joined ${invite.workspaces.name} as ${invite.role}`
      });

      // Remove from list
      setInvites(invites.filter(i => i.id !== invite.id));
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to accept invite', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDecline = async (invite: Invite) => {
    setActionInProgress(invite.id);
    try {
      const response = await fetch(
        `/api/workspaces/${invite.workspace_id}/members/${invite.id}/decline`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${(user as any)?.access_token || ''}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to decline invite');

      toast({
        title: 'Declined',
        description: `You've declined the invite to ${invite.workspaces.name}`
      });

      // Remove from list
      setInvites(invites.filter(i => i.id !== invite.id));
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to decline invite', variant: 'destructive' });
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Workspace Invitations
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your pending workspace invitations
          </p>
        </div>

        {/* Invites List */}
        <div className="space-y-4">
          {invites.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No pending invitations</p>
              </CardContent>
            </Card>
          ) : (
            invites.map((invite) => (
              <Card key={invite.id} className="overflow-hidden" data-testid={`invite-${invite.id}`}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">{invite.workspaces.name}</h3>
                        <Badge variant="secondary">{invite.role}</Badge>
                      </div>

                      {invite.workspaces.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {invite.workspaces.description}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground">
                        Invited to: {invite.user_email}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleAccept(invite)}
                        disabled={actionInProgress === invite.id}
                        className="gap-2"
                        data-testid={`button-accept-${invite.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleDecline(invite)}
                        disabled={actionInProgress === invite.id}
                        className="gap-2"
                        data-testid={`button-decline-${invite.id}`}
                      >
                        <XCircle className="h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
