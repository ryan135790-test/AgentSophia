import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Users, Settings, Activity, Database, Crown, User, Calendar, Plus, Pencil, Trash2, Plug } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LinkedInOAuth } from '@/components/auth/linkedin-oauth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import IntegrationsAdmin from './admin/IntegrationsAdmin';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  company: string;
  created_at: string;
  user_roles: { role: string }[];
}

interface AIConfiguration {
  id: string;
  name: string;
  description: string;
  channels: string[];
  is_active: boolean;
  created_at: string;
  profiles: { full_name: string; email: string };
}

export default function Admin() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [aiConfigurations, setAIConfigurations] = useState<AIConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkedInConfig, setShowLinkedInConfig] = useState(false);
  
  // Add User Dialog
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserCompany, setNewUserCompany] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  
  // Edit User Dialog
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserFullName, setEditUserFullName] = useState('');
  const [editUserCompany, setEditUserCompany] = useState('');
  const [editUserRole, setEditUserRole] = useState('user');
  
  // Delete User Dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch users with roles - separate queries to avoid relation issues
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersData) {
        // Fetch roles for each user
        const usersWithRoles = await Promise.all(
          usersData.map(async (user) => {
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', user.user_id);
            
            return {
              ...user,
              user_roles: roleData || []
            };
          })
        );
        setUsers(usersWithRoles);
      }

      // Fetch AI configurations
      const { data: aiConfigsData } = await supabase
        .from('ai_configurations')
        .select('*')
        .order('created_at', { ascending: false });

      if (aiConfigsData) {
        // Fetch profile data for each config
        const configsWithProfiles = await Promise.all(
          aiConfigsData.map(async (config) => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('user_id', config.user_id)
              .single();
            
            return {
              ...config,
              profiles: profileData || { full_name: 'Unknown', email: 'Unknown' }
            };
          })
        );
        setAIConfigurations(configsWithProfiles);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load admin data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const makeAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User promoted to admin',
      });
      
      fetchData();
    } catch (error) {
      console.error('Error making admin:', error);
      toast({
        title: 'Error',
        description: 'Failed to promote user',
        variant: 'destructive',
      });
    }
  };

  const removeAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: 'user' })
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Admin privileges removed',
      });
      
      fetchData();
    } catch (error) {
      console.error('Error removing admin:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove admin privileges',
        variant: 'destructive',
      });
    }
  };

  // Add new user
  const handleAddUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create',
            email: newUserEmail,
            fullName: newUserFullName,
            company: newUserCompany,
            role: newUserRole,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      toast({
        title: 'Success',
        description: `User created successfully. An invite email has been sent to ${newUserEmail}.`,
      });

      // Reset form
      setNewUserEmail('');
      setNewUserFullName('');
      setNewUserCompany('');
      setNewUserRole('user');
      setShowAddUser(false);
      
      fetchData();
    } catch (error: any) {
      console.error('Error creating user - Full details:');
      console.error('  Name:', error?.name);
      console.error('  Message:', error?.message);
      console.error('  Stack:', error?.stack);
      console.error('  Stringified:', JSON.stringify(error, Object.getOwnPropertyNames(error || {})));
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create user',
        variant: 'destructive',
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (user: UserProfile) => {
    setEditingUser(user);
    setEditUserEmail(user.email);
    setEditUserFullName(user.full_name);
    setEditUserCompany(user.company || '');
    setEditUserRole(user.user_roles[0]?.role || 'user');
    setShowEditUser(true);
  };

  // Edit existing user
  const handleEditUser = async () => {
    if (!editingUser) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'update',
            userId: editingUser.user_id,
            email: editUserEmail,
            fullName: editUserFullName,
            company: editUserCompany,
            role: editUserRole,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update user');
      }

      toast({
        title: 'Success',
        description: 'User updated successfully',
      });

      setShowEditUser(false);
      setEditingUser(null);
      
      fetchData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update user',
        variant: 'destructive',
      });
    }
  };

  // Open delete confirmation
  const openDeleteDialog = (user: UserProfile) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  // Delete user
  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-management`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'delete',
            userId: userToDelete.user_id,
          }),
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete user');
      }

      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });

      setShowDeleteConfirm(false);
      setUserToDelete(null);
      
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Database className="h-8 w-8 animate-pulse mx-auto mb-4" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      <div className="border-b bg-gradient-card">
        <div className="p-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-gradient-primary">
              <Crown className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back, {profile?.full_name || 'Admin'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">
                Registered users on platform
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active AI Configs</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {aiConfigurations.filter(c => c.is_active).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Currently running configurations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Crown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.user_roles.some(r => r.role === 'admin')).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Users with admin privileges
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">User Management</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="ai-configs">AI Configurations</TabsTrigger>
            <TabsTrigger value="settings">System Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="h-5 w-5" />
                      <span>User Management</span>
                    </CardTitle>
                    <CardDescription>
                      Manage user accounts and permissions
                    </CardDescription>
                  </div>
                  <Button 
                    data-testid="button-add-user"
                    onClick={() => setShowAddUser(true)}
                    className="bg-gradient-primary"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || 'No name'}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.company || 'N/A'}</TableCell>
                        <TableCell>
                          {user.user_roles.map((role) => (
                            <Badge
                              key={role.role}
                              variant={role.role === 'admin' ? 'default' : 'secondary'}
                              className="mr-1"
                            >
                              <Crown className="h-3 w-3 mr-1" />
                              {role.role}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{new Date(user.created_at).toLocaleDateString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              data-testid={`button-edit-user-${user.id}`}
                              onClick={() => openEditDialog(user)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              data-testid={`button-delete-user-${user.id}`}
                              onClick={() => openDeleteDialog(user)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsAdmin />
          </TabsContent>

          <TabsContent value="ai-configs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>AI Configurations</span>
                </CardTitle>
                <CardDescription>
                  Monitor and manage AI automation configurations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiConfigurations.map((config) => (
                      <TableRow key={config.id}>
                        <TableCell className="font-medium">{config.name}</TableCell>
                        <TableCell>{config.profiles?.full_name || 'Unknown'}</TableCell>
                        <TableCell>
                          <div className="flex space-x-1">
                            {config.channels.map((channel) => (
                              <Badge key={channel} variant="outline" className="text-xs">
                                {channel}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={config.is_active ? 'default' : 'secondary'}>
                            {config.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(config.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>System Settings</span>
                </CardTitle>
                <CardDescription>
                  Configure platform-wide settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-card">
                    <h3 className="font-medium text-foreground mb-2">LinkedIn Integration</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure LinkedIn OAuth settings for secure account connections
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => setShowLinkedInConfig(true)}
                    >
                      Configure LinkedIn OAuth
                    </Button>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-gradient-card">
                    <h3 className="font-medium text-foreground mb-2">AI Model Settings</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure AI model parameters and API integrations
                    </p>
                    <Button variant="outline">Manage AI Models</Button>
                  </div>
                  
                  <div className="p-4 rounded-lg bg-gradient-card">
                    <h3 className="font-medium text-foreground mb-2">Security Settings</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure authentication and security policies
                    </p>
                    <Button variant="outline">Security Settings</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showLinkedInConfig} onOpenChange={setShowLinkedInConfig}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>LinkedIn OAuth Configuration</DialogTitle>
          </DialogHeader>
          <LinkedInOAuth />
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. An invite email will be sent to set up their password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                data-testid="input-new-user-email"
                type="email"
                placeholder="user@company.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-fullname">Full Name</Label>
              <Input
                id="new-fullname"
                data-testid="input-new-user-fullname"
                placeholder="John Doe"
                value={newUserFullName}
                onChange={(e) => setNewUserFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company">Company (Optional)</Label>
              <Input
                id="new-company"
                data-testid="input-new-user-company"
                placeholder="Acme Inc"
                value={newUserCompany}
                onChange={(e) => setNewUserCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-role">Role</Label>
              <Select value={newUserRole} onValueChange={setNewUserRole}>
                <SelectTrigger id="new-role" data-testid="select-new-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAddUser(false)}
              data-testid="button-cancel-add-user"
            >
              Cancel
            </Button>
            <Button 
              className="bg-gradient-primary"
              onClick={handleAddUser}
              data-testid="button-confirm-add-user"
              disabled={!newUserEmail || !newUserFullName}
            >
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditUser} onOpenChange={setShowEditUser}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user account information and role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                data-testid="input-edit-user-email"
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-fullname">Full Name</Label>
              <Input
                id="edit-fullname"
                data-testid="input-edit-user-fullname"
                value={editUserFullName}
                onChange={(e) => setEditUserFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">Company</Label>
              <Input
                id="edit-company"
                data-testid="input-edit-user-company"
                value={editUserCompany}
                onChange={(e) => setEditUserCompany(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={editUserRole} onValueChange={setEditUserRole}>
                <SelectTrigger id="edit-role" data-testid="select-edit-user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowEditUser(false)}
              data-testid="button-cancel-edit-user"
            >
              Cancel
            </Button>
            <Button 
              className="bg-gradient-primary"
              onClick={handleEditUser}
              data-testid="button-confirm-edit-user"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account for{' '}
              <strong>{userToDelete?.full_name}</strong> ({userToDelete?.email}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-user">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteUser}
              data-testid="button-confirm-delete-user"
            >
              Delete User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}