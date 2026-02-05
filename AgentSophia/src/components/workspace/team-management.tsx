import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Trash2, UserPlus, Mail, Clock, CheckCircle2, AlertCircle, Loader2, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TeamMember {
  id: string;
  user_email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'declined';
}

interface TeamManagementProps {
  workspaceId: string;
}

export function TeamManagement({ workspaceId }: TeamManagementProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'member' | 'admin' | 'viewer'>('member');
  const [loading, setLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(true);
  const [membersError, setMembersError] = useState<string | null>(null);

  useEffect(() => {
    loadMembers();
  }, [workspaceId]);

  const loadMembers = async () => {
    try {
      setMembersLoading(true);
      setMembersError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });

      if (!response.ok) throw new Error('Failed to load members');
      const data = await response.json();
      setMembers(data || []);
    } catch (error) {
      setMembersError('Failed to load team members');
      console.error(error);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!newEmail) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('You must be logged in to add team members. Please refresh and try again.');
      }
      
      console.log('Creating user for workspace:', workspaceId);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          mode: 'credentials',
          user_email: newEmail,
          password: newPassword,
          role: newRole
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to create account';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const newMember = await response.json();
      const emailForMessage = newEmail;
      const roleForMessage = newRole;
      
      setMembers([...members, newMember]);
      setNewEmail('');
      setNewPassword('');
      setNewRole('member');
      
      toast({ 
        title: 'Success', 
        description: `Account created for ${emailForMessage} with role ${roleForMessage}.`,
        duration: 5000
      });
    } catch (error: any) {
      console.error('Error creating user - Full details:');
      console.error('  Name:', error?.name);
      console.error('  Message:', error?.message);
      console.error('  Stack:', error?.stack);
      console.error('  Stringified:', JSON.stringify(error, Object.getOwnPropertyNames(error || {})));
      
      let errorMessage = 'Failed to create account. Please check your connection and try again.';
      if (error?.message) {
        errorMessage = error.message;
      }
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!newEmail) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('You must be logged in to invite team members. Please refresh and try again.');
      }
      
      console.log('Inviting user to workspace:', workspaceId);
      
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          mode: 'invite',
          user_email: newEmail, 
          role: newRole
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to invite member';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const newMember = await response.json();
      const emailForMessage = newEmail;
      
      setMembers([...members, newMember]);
      setNewEmail('');
      setNewRole('member');
      
      toast({ 
        title: 'Success', 
        description: `Invite sent to ${emailForMessage}. They'll appear once they accept.`,
        duration: 5000
      });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to invite member', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });

      if (!response.ok) throw new Error('Failed to remove member');

      setMembers(members.filter(m => m.id !== memberId));
      toast({ title: 'Success', description: 'Member removed' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove member', variant: 'destructive' });
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (!response.ok) throw new Error('Failed to update member');

      const updated = await response.json();
      setMembers(members.map(m => m.id === memberId ? updated : m));
      toast({ title: 'Success', description: 'Role updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update role', variant: 'destructive' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'invited':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'declined':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'invited':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pending Invite</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create" data-testid="tab-create-account">
                <UserPlus className="h-4 w-4 mr-2" />
                Create Account
              </TabsTrigger>
              <TabsTrigger value="invite" data-testid="tab-send-invite">
                <Mail className="h-4 w-4 mr-2" />
                Send Invite
              </TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4 mt-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Email Address</p>
                <Input
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  type="email"
                  data-testid="input-create-email"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Password</p>
                <Input
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  data-testid="input-create-password"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Role</p>
                <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                  <SelectTrigger data-testid="select-create-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleCreateAccount} 
                disabled={loading || !newEmail || !newPassword} 
                data-testid="button-create-account"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Create Account & Add to Workspace
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Creates a new user account and adds them to this workspace immediately.
              </p>
            </TabsContent>

            <TabsContent value="invite" className="space-y-4 mt-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Email Address</p>
                <Input
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleInvite()}
                  type="email"
                  data-testid="input-invite-email"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Role</p>
                <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                  <SelectTrigger data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleInvite} 
                disabled={loading || !newEmail} 
                data-testid="button-invite-member"
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Invite...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email Invitation
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Sends an email invitation. User must accept to join the workspace.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({members.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading team members...</span>
            </div>
          ) : membersError ? (
            <div className="text-center py-4">
              <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-destructive">{membersError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadMembers}
                className="mt-2"
                data-testid="button-retry-load-members"
              >
                Retry
              </Button>
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No team members yet. Invite someone above to get started!
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors" 
                  data-testid={`member-${member.id}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm break-all">{member.user_email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusIcon(member.status)}
                        {getStatusBadge(member.status)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v)} disabled={member.role === 'owner'}>
                      <SelectTrigger className="w-[110px] text-sm" data-testid={`select-role-${member.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleRemove(member.id)} 
                      data-testid={`button-remove-${member.id}`}
                      disabled={member.status === 'active' && member.role === 'owner'}
                      title={member.role === 'owner' ? 'Cannot remove workspace owner' : 'Remove member'}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
