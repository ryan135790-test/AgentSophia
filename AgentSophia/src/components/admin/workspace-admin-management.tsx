import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Building2, 
  Plus, 
  Users, 
  Mail, 
  Trash2, 
  Settings, 
  UserPlus,
  Shield,
  Link2,
  Calendar,
  ExternalLink,
  MoreHorizontal,
  CheckCircle,
  Clock,
  XCircle,
  Crown,
  CreditCard
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Workspace {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
  member_count?: number;
  account_count?: number;
}

interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string | null;
  user_email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'declined';
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface ConnectedAccount {
  id: string;
  provider: string;
  email: string;
  is_active: boolean;
  connected_at: string;
}

interface WorkspaceBilling {
  workspace_id: string;
  plan_type: string;
  seat_limit: number;
  seats_used: number;
  price_per_seat: number;
  billing_email: string | null;
  next_billing_date: string | null;
}

export function WorkspaceAdminManagement() {
  const { toast } = useToast();
  const { isSuperAdmin, user } = useAuth();
  const { refreshWorkspaces: refreshGlobalWorkspaces } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [billing, setBilling] = useState<WorkspaceBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [initialInvites, setInitialInvites] = useState<Array<{ email: string; role: 'admin' | 'member' | 'viewer' }>>([]);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  
  // Dual-mode user provisioning state
  const [addUserMode, setAddUserMode] = useState<'invite' | 'credentials'>('invite');
  const [inviteFullName, setInviteFullName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  
  // Workspace edit state
  const [editWorkspaceName, setEditWorkspaceName] = useState('');
  const [editWorkspaceDescription, setEditWorkspaceDescription] = useState('');
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  useEffect(() => {
    fetchAllWorkspaces();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (selectedWorkspace) {
      fetchWorkspaceMembers(selectedWorkspace.id);
      fetchWorkspaceAccounts(selectedWorkspace.id);
      fetchWorkspaceBilling(selectedWorkspace.id);
      setEditWorkspaceName(selectedWorkspace.name);
      setEditWorkspaceDescription(selectedWorkspace.description || '');
    }
  }, [selectedWorkspace]);

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const fetchAllWorkspaces = async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      
      // If no auth token, use demo mode
      if (!token) {
        setWorkspaces([
          {
            id: 'demo',
            name: 'Demo Workspace',
            description: 'Demo workspace for testing',
            owner_id: 'demo-user',
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            member_count: 3,
            account_count: 2
          }
        ]);
        setLoading(false);
        return;
      }
      
      // Super admins should see ALL workspaces across the platform
      if (isSuperAdmin) {
        const response = await fetch('/api/super-admin/workspaces', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setWorkspaces(data || []);
          return;
        }
      }
      
      // Regular admins/users: try admin endpoint first, fall back to user workspaces
      const response = await fetch('/api/admin/workspaces', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const fallbackResponse = await fetch('/api/workspaces', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!fallbackResponse.ok) throw new Error('Failed to fetch workspaces');
        const data = await fallbackResponse.json();
        setWorkspaces(data || []);
        return;
      }

      const data = await response.json();
      setWorkspaces(data || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      setWorkspaces([
        {
          id: 'demo',
          name: 'Demo Workspace',
          description: 'Demo workspace for testing',
          owner_id: 'demo-user',
          settings: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          member_count: 3,
          account_count: 2
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkspaceMembers = async (workspaceId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch members');
      const data = await response.json();
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      if (selectedWorkspace?.id === 'demo') {
        setMembers([
          { id: '1', workspace_id: 'demo', user_id: '1', user_email: 'admin@company.com', role: 'owner', status: 'active', created_at: new Date().toISOString(), profile: { full_name: 'Admin User', avatar_url: null } },
          { id: '2', workspace_id: 'demo', user_id: '2', user_email: 'john@company.com', role: 'admin', status: 'active', created_at: new Date().toISOString(), profile: { full_name: 'John Smith', avatar_url: null } },
          { id: '3', workspace_id: 'demo', user_id: null, user_email: 'pending@company.com', role: 'member', status: 'invited', created_at: new Date().toISOString(), profile: null }
        ]);
      }
    }
  };

  const fetchWorkspaceAccounts = async (workspaceId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/workspaces/${workspaceId}/connected-accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (workspaceId === 'demo') {
          setAccounts([
            { id: '1', provider: 'linkedin', email: 'john@linkedin.com', is_active: true, connected_at: new Date().toISOString() },
            { id: '2', provider: 'gmail', email: 'sales@company.com', is_active: true, connected_at: new Date().toISOString() }
          ]);
        }
        return;
      }
      
      const data = await response.json();
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const fetchWorkspaceBilling = async (workspaceId: string) => {
    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/workspaces/${workspaceId}/billing`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        // Fallback for demo
        setBilling({
          workspace_id: workspaceId,
          plan_type: 'professional',
          seat_limit: 10,
          seats_used: members.length + 1,
          price_per_seat: 29,
          billing_email: null,
          next_billing_date: null
        });
        return;
      }
      
      const data = await response.json();
      setBilling(data);
    } catch (error) {
      console.error('Error fetching billing:', error);
      setBilling({
        workspace_id: workspaceId,
        plan_type: 'free',
        seat_limit: 5,
        seats_used: members.length + 1,
        price_per_seat: 29,
        billing_email: null,
        next_billing_date: null
      });
    }
  };

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast({ title: 'Error', description: 'Workspace name is required', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const token = await getAuthToken();
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newWorkspaceName,
          description: newWorkspaceDescription
        })
      });

      if (!response.ok) throw new Error('Failed to create workspace');

      const newWorkspace = await response.json();
      
      let inviteCount = 0;
      if (initialInvites.length > 0 && newWorkspace?.id) {
        for (const invite of initialInvites) {
          try {
            const inviteResponse = await fetch(`/api/workspaces/${newWorkspace.id}/members`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                email: invite.email,
                role: invite.role
              })
            });
            if (inviteResponse.ok) inviteCount++;
          } catch (e) {
            console.error('Failed to invite:', invite.email, e);
          }
        }
      }

      const inviteMsg = inviteCount > 0 ? ` and invited ${inviteCount} team member${inviteCount !== 1 ? 's' : ''}` : '';
      toast({ title: 'Success', description: `Workspace "${newWorkspaceName}" created${inviteMsg}` });
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
      setInitialInvites([]);
      setNewInviteEmail('');
      setShowCreateDialog(false);
      fetchAllWorkspaces();
      refreshGlobalWorkspaces();
    } catch (error) {
      console.error('Error creating workspace:', error);
      toast({ title: 'Error', description: 'Failed to create workspace', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !selectedWorkspace) {
      toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
      return;
    }

    // Validate password for credentials mode
    if (addUserMode === 'credentials' && (!invitePassword || invitePassword.length < 6)) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    // Check seat limit
    if (billing && billing.seats_used >= billing.seat_limit) {
      toast({ 
        title: 'Seat Limit Reached', 
        description: 'Upgrade your plan to add more users', 
        variant: 'destructive' 
      });
      return;
    }

    setInviting(true);
    try {
      const token = await getAuthToken();
      
      if (!token) {
        throw new Error('You must be logged in to add users. Please refresh the page and try again.');
      }
      
      console.log('Adding user to workspace:', selectedWorkspace.id, 'mode:', addUserMode);
      
      const requestBody: any = {
        user_email: inviteEmail,
        role: inviteRole,
        mode: addUserMode,
        full_name: inviteFullName || undefined
      };
      
      // Add password only for credentials mode
      if (addUserMode === 'credentials') {
        requestBody.password = invitePassword;
      }
      
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      // Handle different response types
      const contentType = response.headers.get('content-type');
      let data;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { error: text || 'Unknown error occurred' };
      }
      
      if (!response.ok) {
        console.error('Server error:', response.status, data);
        throw new Error(data.error || data.message || `Server error: ${response.status}`);
      }

      const actionWord = addUserMode === 'credentials' ? 'created and added' : 'invited';
      toast({ title: 'Success', description: `User ${inviteEmail} ${actionWord} successfully` });
      
      // Reset form
      setInviteEmail('');
      setInviteRole('member');
      setInviteFullName('');
      setInvitePassword('');
      setAddUserMode('invite');
      setShowInviteDialog(false);
      fetchWorkspaceMembers(selectedWorkspace.id);
      fetchWorkspaceBilling(selectedWorkspace.id); // Refresh billing to update seat count
    } catch (error: any) {
      console.error('Error creating user - Full details:');
      console.error('  Name:', error?.name);
      console.error('  Message:', error?.message);
      console.error('  Stack:', error?.stack);
      console.error('  Type:', typeof error);
      console.error('  Keys:', Object.keys(error || {}));
      console.error('  Stringified:', JSON.stringify(error, Object.getOwnPropertyNames(error || {})));
      
      let errorMessage = 'Failed to add user. Please check your connection and try again.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.name === 'TypeError') {
        errorMessage = 'Network error - please check your connection and try again.';
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedWorkspace) return;

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to remove member');

      toast({ title: 'Success', description: 'Member removed from workspace' });
      fetchWorkspaceMembers(selectedWorkspace.id);
      fetchWorkspaceBilling(selectedWorkspace.id); // Refresh billing to update seat count
    } catch (error) {
      console.error('Error removing member:', error);
      toast({ title: 'Error', description: 'Failed to remove member', variant: 'destructive' });
    }
  };

  const deleteWorkspace = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      return;
    }

    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete workspace');

      toast({ title: 'Success', description: 'Workspace deleted successfully' });
      setSelectedWorkspace(null);
      fetchAllWorkspaces();
      refreshGlobalWorkspaces();
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({ title: 'Error', description: 'Failed to delete workspace', variant: 'destructive' });
    }
  };

  const updateWorkspace = async () => {
    if (!selectedWorkspace) return;
    if (!editWorkspaceName.trim()) {
      toast({ title: 'Error', description: 'Workspace name is required', variant: 'destructive' });
      return;
    }

    setSavingWorkspace(true);
    try {
      const token = await getAuthToken();
      const response = await fetch(`/api/workspaces/${selectedWorkspace.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editWorkspaceName.trim(),
          description: editWorkspaceDescription.trim() || null
        })
      });

      if (!response.ok) throw new Error('Failed to update workspace');

      const updatedWorkspace = await response.json();
      toast({ title: 'Success', description: 'Workspace updated successfully' });
      
      // Update local state
      setSelectedWorkspace(updatedWorkspace);
      setWorkspaces(prev => prev.map(ws => ws.id === updatedWorkspace.id ? updatedWorkspace : ws));
    } catch (error) {
      console.error('Error updating workspace:', error);
      toast({ title: 'Error', description: 'Failed to update workspace', variant: 'destructive' });
    } finally {
      setSavingWorkspace(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'invited':
        return <Badge className="bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge className="bg-purple-100 text-purple-700"><Shield className="w-3 h-3 mr-1" />Owner</Badge>;
      case 'admin':
        return <Badge className="bg-blue-100 text-blue-700"><Shield className="w-3 h-3 mr-1" />Admin</Badge>;
      case 'member':
        return <Badge variant="secondary">Member</Badge>;
      case 'viewer':
        return <Badge variant="outline">Viewer</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'linkedin':
        return <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center"><Link2 className="w-4 h-4 text-sky-600" /></div>;
      case 'gmail':
        return <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center"><Mail className="w-4 h-4 text-red-600" /></div>;
      case 'outlook':
        return <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Mail className="w-4 h-4 text-blue-600" /></div>;
      case 'calendar':
        return <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center"><Calendar className="w-4 h-4 text-green-600" /></div>;
      default:
        return <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center"><ExternalLink className="w-4 h-4 text-gray-600" /></div>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Workspace Management</h2>
            {isSuperAdmin && (
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                <Crown className="w-3 h-3 mr-1" />
                Super Admin - All Workspaces
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin 
              ? 'Viewing all workspaces across the platform. You have full system-wide access.'
              : 'Create and manage workspaces for different companies. Each workspace has its own users and connected accounts.'}
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-workspace">
              <Plus className="w-4 h-4 mr-2" />
              Create Workspace
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Workspace</DialogTitle>
              <DialogDescription>
                Create a workspace for a new company. Add team members now or invite them later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Company / Workspace Name</Label>
                <Input
                  id="workspace-name"
                  placeholder="e.g., Acme Corp"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  data-testid="input-new-workspace-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workspace-description">Description (Optional)</Label>
                <Input
                  id="workspace-description"
                  placeholder="Brief description of this workspace"
                  value={newWorkspaceDescription}
                  onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                  data-testid="input-new-workspace-description"
                />
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4" />
                  Invite Team Members (Optional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="team@company.com"
                    value={newInviteEmail}
                    onChange={(e) => setNewInviteEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newInviteEmail.trim()) {
                        e.preventDefault();
                        if (!initialInvites.some(inv => inv.email === newInviteEmail.trim())) {
                          setInitialInvites([...initialInvites, { email: newInviteEmail.trim(), role: newInviteRole }]);
                          setNewInviteEmail('');
                        }
                      }
                    }}
                    data-testid="input-invite-email"
                  />
                  <Select value={newInviteRole} onValueChange={(v: 'admin' | 'member' | 'viewer') => setNewInviteRole(v)}>
                    <SelectTrigger className="w-[120px]" data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (newInviteEmail.trim() && !initialInvites.some(inv => inv.email === newInviteEmail.trim())) {
                        setInitialInvites([...initialInvites, { email: newInviteEmail.trim(), role: newInviteRole }]);
                        setNewInviteEmail('');
                      }
                    }}
                    data-testid="button-add-invite"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {initialInvites.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <p className="text-xs text-muted-foreground">
                      {initialInvites.length} team member{initialInvites.length !== 1 ? 's' : ''} will be invited:
                    </p>
                    <div className="space-y-1">
                      {initialInvites.map((invite, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-muted/50 rounded-md px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Mail className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm">{invite.email}</span>
                            <Badge variant="outline" className="text-xs">{invite.role}</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => setInitialInvites(initialInvites.filter((_, i) => i !== idx))}
                            data-testid={`button-remove-invite-${idx}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateDialog(false);
                setNewWorkspaceName('');
                setNewWorkspaceDescription('');
                setInitialInvites([]);
                setNewInviteEmail('');
              }}>
                Cancel
              </Button>
              <Button onClick={createWorkspace} disabled={creating} data-testid="button-confirm-create-workspace">
                {creating ? 'Creating...' : `Create Workspace${initialInvites.length > 0 ? ` & Invite ${initialInvites.length}` : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Workspaces ({workspaces.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workspaces.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No workspaces yet</p>
                  <p className="text-sm">Create your first workspace above</p>
                </div>
              ) : (
                workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    onClick={() => setSelectedWorkspace(workspace)}
                    className={`p-3 rounded-lg border cursor-pointer transition hover:border-primary ${
                      selectedWorkspace?.id === workspace.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                    data-testid={`workspace-item-${workspace.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-semibold">
                          {workspace.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-medium">{workspace.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            {workspace.description || 'No description'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {workspace.member_count || 0} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        {workspace.account_count || 0} accounts
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedWorkspace ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                      {selectedWorkspace.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <CardTitle>{selectedWorkspace.name}</CardTitle>
                      <CardDescription>
                        {selectedWorkspace.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Seat Usage Badge */}
                    {billing && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {billing.seats_used}/{billing.seat_limit} seats
                        </span>
                        {billing.seats_used >= billing.seat_limit && (
                          <Badge variant="destructive" className="text-xs">Full</Badge>
                        )}
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => deleteWorkspace(selectedWorkspace.id)} data-testid="button-delete-workspace">
                      <Trash2 className="w-4 h-4 mr-1 text-red-500" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="members">
                  <TabsList className="mb-4">
                    <TabsTrigger value="members" className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Members ({members.length})
                    </TabsTrigger>
                    <TabsTrigger value="accounts" className="flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      Connected Accounts ({accounts.length})
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      Settings
                    </TabsTrigger>
                    <TabsTrigger value="billing" className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Billing
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="members" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Manage team members and their access levels
                      </p>
                      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
                        <DialogTrigger asChild>
                          <Button size="sm" data-testid="button-invite-member">
                            <UserPlus className="w-4 h-4 mr-2" />
                            Invite Member
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Add Team Member</DialogTitle>
                            <DialogDescription>
                              Add a new user to {selectedWorkspace.name}
                            </DialogDescription>
                          </DialogHeader>
                          
                          {/* Seat Usage Info */}
                          {billing && (
                            <div className="rounded-lg border bg-muted/50 p-4 mb-2">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Seat Usage</span>
                                <Badge variant={billing.seats_used >= billing.seat_limit ? "destructive" : "secondary"}>
                                  {billing.seats_used} / {billing.seat_limit} seats
                                </Badge>
                              </div>
                              <div className="w-full bg-secondary rounded-full h-2 mb-2">
                                <div 
                                  className={`h-2 rounded-full ${billing.seats_used >= billing.seat_limit ? 'bg-destructive' : 'bg-primary'}`}
                                  style={{ width: `${Math.min((billing.seats_used / billing.seat_limit) * 100, 100)}%` }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {billing.seats_used >= billing.seat_limit 
                                  ? 'Seat limit reached. Upgrade plan to add more users.'
                                  : `${billing.seat_limit - billing.seats_used} seat(s) remaining`}
                              </p>
                            </div>
                          )}

                          {/* Billing Notice - hidden until billing is configured */}
                          
                          <div className="space-y-4 py-2">
                            {/* Mode Selection */}
                            <div className="space-y-2">
                              <Label>Add User Method</Label>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  type="button"
                                  variant={addUserMode === 'invite' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setAddUserMode('invite')}
                                  className="w-full"
                                  data-testid="button-mode-invite"
                                >
                                  <Mail className="w-4 h-4 mr-2" />
                                  Send Email Invite
                                </Button>
                                <Button
                                  type="button"
                                  variant={addUserMode === 'credentials' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setAddUserMode('credentials')}
                                  className="w-full"
                                  data-testid="button-mode-credentials"
                                >
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  Set Username & Password
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {addUserMode === 'invite' 
                                  ? 'User will receive an email to set up their account'
                                  : 'Create account directly with email and password'}
                              </p>
                            </div>
                            
                            <Separator />
                            
                            <div className="space-y-2">
                              <Label htmlFor="invite-email">Email Address</Label>
                              <Input
                                id="invite-email"
                                type="email"
                                placeholder="colleague@company.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                data-testid="input-invite-email"
                              />
                            </div>
                            
                            {/* Full Name (optional) */}
                            <div className="space-y-2">
                              <Label htmlFor="invite-fullname">Full Name (optional)</Label>
                              <Input
                                id="invite-fullname"
                                type="text"
                                placeholder="John Smith"
                                value={inviteFullName}
                                onChange={(e) => setInviteFullName(e.target.value)}
                                data-testid="input-invite-fullname"
                              />
                            </div>
                            
                            {/* Password field - only shown for credentials mode */}
                            {addUserMode === 'credentials' && (
                              <div className="space-y-2">
                                <Label htmlFor="invite-password">Password</Label>
                                <Input
                                  id="invite-password"
                                  type="password"
                                  placeholder="Min 6 characters"
                                  value={invitePassword}
                                  onChange={(e) => setInvitePassword(e.target.value)}
                                  data-testid="input-invite-password"
                                />
                                <p className="text-xs text-muted-foreground">
                                  User can log in immediately with this password
                                </p>
                              </div>
                            )}
                            
                            <div className="space-y-2">
                              <Label htmlFor="invite-role">Role</Label>
                              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as any)}>
                                <SelectTrigger data-testid="select-invite-role">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin - Full access</SelectItem>
                                  <SelectItem value="member">Member - Create & edit</SelectItem>
                                  <SelectItem value="viewer">Viewer - Read only</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => {
                              setShowInviteDialog(false);
                              setInviteEmail('');
                              setInviteFullName('');
                              setInvitePassword('');
                              setAddUserMode('invite');
                            }}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={inviteMember} 
                              disabled={inviting || (billing && billing.seats_used >= billing.seat_limit)} 
                              data-testid="button-send-invite"
                            >
                              {inviting ? 'Adding...' : addUserMode === 'credentials' 
                                ? 'Create User'
                                : 'Send Invite'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <Separator />

                    {members.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No team members yet</p>
                        <p className="text-sm">Invite your first team member above</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                            data-testid={`member-item-${member.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback>
                                  {member.profile?.full_name?.charAt(0) || member.user_email.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {member.profile?.full_name || member.user_email}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {member.user_email}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {getStatusBadge(member.status)}
                              {getRoleBadge(member.role)}
                              {member.role !== 'owner' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMember(member.id)}
                                  data-testid={`button-remove-member-${member.id}`}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="accounts" className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Connected accounts for sending campaigns from this workspace
                      </p>
                      <Button size="sm" variant="outline" asChild>
                        <a href="/my-connections" data-testid="button-manage-connections">
                          <Plus className="w-4 h-4 mr-2" />
                          Connect Account
                        </a>
                      </Button>
                    </div>

                    <Separator />

                    {accounts.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Link2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No connected accounts</p>
                        <p className="text-sm">Connect LinkedIn, Gmail, or other accounts to send campaigns</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {accounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex items-center justify-between p-3 rounded-lg border"
                            data-testid={`account-item-${account.id}`}
                          >
                            <div className="flex items-center gap-3">
                              {getProviderIcon(account.provider)}
                              <div>
                                <div className="font-medium capitalize">{account.provider}</div>
                                <div className="text-sm text-muted-foreground">{account.email}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {account.is_active ? (
                                <Badge className="bg-green-100 text-green-700">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Connected
                                </Badge>
                              ) : (
                                <Badge variant="destructive">Disconnected</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="settings" className="space-y-4">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Workspace Name</Label>
                        <Input 
                          value={editWorkspaceName} 
                          onChange={(e) => setEditWorkspaceName(e.target.value)}
                          data-testid="input-edit-workspace-name" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input 
                          value={editWorkspaceDescription} 
                          onChange={(e) => setEditWorkspaceDescription(e.target.value)}
                          data-testid="input-edit-workspace-description" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Created</Label>
                        <Input value={new Date(selectedWorkspace.created_at).toLocaleDateString()} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Owner</Label>
                        <Input value={selectedWorkspace.owner_id === user?.id ? 'You' : selectedWorkspace.owner_id} disabled />
                      </div>
                      <div className="flex gap-3">
                        <Button 
                          onClick={updateWorkspace} 
                          disabled={savingWorkspace}
                          data-testid="button-save-workspace-settings"
                        >
                          {savingWorkspace ? 'Saving...' : 'Save Changes'}
                        </Button>
                        {selectedWorkspace.owner_id === user?.id && (
                          <Button 
                            variant="destructive" 
                            onClick={() => deleteWorkspace(selectedWorkspace.id)}
                            data-testid="button-delete-workspace-settings"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Workspace
                          </Button>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="billing" className="space-y-4">
                    <div className="space-y-6">
                      <div className="rounded-lg border bg-gradient-to-r from-green-50 to-emerald-50 p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">Current Plan</h3>
                            <p className="text-sm text-muted-foreground">Your workspace subscription details</p>
                          </div>
                          <Badge className="text-lg px-4 py-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white">
                            Early Access - Free
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                          <div className="bg-white/80 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-green-600">{members.length || 1}</div>
                            <div className="text-sm text-muted-foreground">Team Members</div>
                          </div>
                          <div className="bg-white/80 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-emerald-600">Unlimited</div>
                            <div className="text-sm text-muted-foreground">Seat Limit</div>
                          </div>
                          <div className="bg-white/80 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-green-600">$0</div>
                            <div className="text-sm text-muted-foreground">Per Seat/Mo</div>
                          </div>
                          <div className="bg-white/80 rounded-lg p-4 text-center">
                            <div className="text-2xl font-bold text-emerald-600">$0</div>
                            <div className="text-sm text-muted-foreground">Monthly Cost</div>
                          </div>
                        </div>
                      </div>

                      <Card className="border-green-200 bg-green-50/50">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <CardTitle className="text-base text-green-800">Early Access Benefits</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-green-700 mb-4">
                            You're part of our early access program! Enjoy all premium features at no cost during this period.
                          </p>
                          <div className="grid gap-2 md:grid-cols-2">
                            <div className="flex items-center gap-2 text-sm text-green-700">
                              <CheckCircle className="w-4 h-4" />
                              Unlimited team members
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-700">
                              <CheckCircle className="w-4 h-4" />
                              Full AI capabilities
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-700">
                              <CheckCircle className="w-4 h-4" />
                              All integrations included
                            </div>
                            <div className="flex items-center gap-2 text-sm text-green-700">
                              <CheckCircle className="w-4 h-4" />
                              Priority support
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Account Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Account Email</span>
                            <span className="font-medium">{user?.email || 'Not set'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Plan Status</span>
                            <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Billing</span>
                            <span className="font-medium text-green-600">No charges during early access</span>
                          </div>
                        </CardContent>
                      </Card>

                      <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
                        <h4 className="font-medium text-slate-700 mb-2">Paid Plans Coming Soon</h4>
                        <p className="text-sm text-muted-foreground">
                          We'll notify you before any billing changes. Early access users will receive special pricing.
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Building2 className="w-16 h-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium mb-2">Select a Workspace</h3>
                <p className="text-sm text-center max-w-md">
                  Choose a workspace from the list to manage its members, connected accounts, and settings.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
