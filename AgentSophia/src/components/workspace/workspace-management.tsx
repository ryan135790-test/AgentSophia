import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trash2, Plus, Users, Calendar, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LinkedInOAuth } from '@/components/auth/linkedin-oauth';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  linkedin_connection_id?: string;
  is_active: boolean;
  settings: any;
  created_at: string;
  updated_at: string;
}

export function WorkspaceManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWorkspaces();
      loadSelectedWorkspace();
    }
  }, [user]);

  const fetchWorkspaces = async () => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkspaces(data || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      toast({
        title: 'Error',
        description: 'Failed to load workspaces',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSelectedWorkspace = () => {
    const saved = localStorage.getItem('selectedWorkspaceId');
    if (saved) {
      setSelectedWorkspace(saved);
    }
  };

  const selectWorkspace = (workspaceId: string) => {
    setSelectedWorkspace(workspaceId);
    localStorage.setItem('selectedWorkspaceId', workspaceId);
    toast({
      title: 'Workspace Selected',
      description: 'Workspace has been set as active',
    });
  };

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const { error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspaceId);

      if (error) throw error;

      setWorkspaces(workspaces.filter(w => w.id !== workspaceId));
      
      if (selectedWorkspace === workspaceId) {
        setSelectedWorkspace(null);
        localStorage.removeItem('selectedWorkspaceId');
      }

      toast({
        title: 'Success',
        description: 'Workspace deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete workspace',
        variant: 'destructive',
      });
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">LinkedIn Workspaces</h2>
          <p className="text-muted-foreground">
            Manage your LinkedIn account integrations and workspaces
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add LinkedIn Account
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Connect LinkedIn Account</DialogTitle>
              <DialogDescription>
                Connect a new LinkedIn account to create a workspace for lead management
              </DialogDescription>
            </DialogHeader>
            <LinkedInOAuth />
          </DialogContent>
        </Dialog>
      </div>

      {workspaces.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No LinkedIn Workspaces</h3>
            <p className="text-muted-foreground text-center mb-4">
              Connect your LinkedIn account to start managing leads and automating outreach
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Connect LinkedIn Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card 
              key={workspace.id}
              className={`cursor-pointer transition-all ${
                selectedWorkspace === workspace.id 
                  ? 'ring-2 ring-primary bg-primary/5' 
                  : 'hover:shadow-md'
              }`}
              onClick={() => selectWorkspace(workspace.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>
                        {workspace.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'WS'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{workspace.name}</CardTitle>
                      <CardDescription className="text-sm">
                        {workspace.description || 'LinkedIn workspace'}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWorkspace(workspace.id);
                    }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge 
                      variant={workspace.is_active ? 'default' : 'secondary'}
                    >
                      {workspace.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">LinkedIn:</span>
                    <Badge variant={workspace.linkedin_connection_id ? 'default' : 'secondary'}>
                      {workspace.linkedin_connection_id ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Created:</span>
                    <span>{formatDate(workspace.created_at)}</span>
                  </div>
                  
                  {selectedWorkspace === workspace.id && (
                    <Badge variant="secondary" className="w-full justify-center mt-2">
                      Active Workspace
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {workspaces.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Workspace Information</CardTitle>
            <CardDescription>
              Each workspace is tied to a specific LinkedIn account and maintains its own:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center">
                <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                LinkedIn authentication tokens and credentials
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                Contact database and lead management
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                AI configurations and automation settings
              </li>
              <li className="flex items-center">
                <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
                Chat sessions and conversation history
              </li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}