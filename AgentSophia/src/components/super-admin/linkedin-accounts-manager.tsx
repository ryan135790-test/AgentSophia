import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Linkedin, 
  Search, 
  MoreHorizontal,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Globe,
  AlertTriangle,
  User,
  ChevronDown,
  ChevronRight,
  Building2,
  Play,
  Settings,
  Plus,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface LinkedInAccount {
  workspace_id: string;
  user_id: string;
  profile_name: string | null;
  is_active: boolean;
  session_source: string | null;
  session_captured_at: string | null;
  proxy_id: string | null;
  error_count: number | null;
  last_error_at: string | null;
  updated_at: string | null;
  workspace_name: string;
  workspace_owner_id: string | null;
}

interface WorkspaceGroup {
  workspace_id: string;
  workspace_name: string;
  accounts: LinkedInAccount[];
  activeCount: number;
}

interface LinkedInAccountsResponse {
  accounts: LinkedInAccount[];
  total: number;
  active: number;
}

interface WorkspaceOption {
  id: string;
  name: string;
}

export function LinkedInAccountsManager() {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<LinkedInAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0 });
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set());
  
  // Add Account Dialog State
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [linkedinEmail, setLinkedinEmail] = useState('');
  const [linkedinPassword, setLinkedinPassword] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);
  const [loginStatus, setLoginStatus] = useState<string>('');

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/super-admin/linkedin-accounts', {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      if (response.ok) {
        const data: LinkedInAccountsResponse = await response.json();
        setAccounts(data.accounts || []);
        setStats({ total: data.total || 0, active: data.active || 0 });
      } else {
        const error = await response.json().catch(() => ({ error: 'Failed to load' }));
        toast({
          title: 'Error',
          description: error.error || 'Failed to load LinkedIn accounts',
          variant: 'destructive'
        });
        setAccounts([]);
        setStats({ total: 0, active: 0 });
      }
    } catch (error) {
      console.error('Error loading LinkedIn accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load LinkedIn accounts',
        variant: 'destructive'
      });
      setAccounts([]);
      setStats({ total: 0, active: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      loadAccounts();
      loadWorkspaces();
    }
  }, [session]);

  const loadWorkspaces = async () => {
    try {
      const response = await fetch('/api/super-admin/workspaces', {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWorkspaces(data.workspaces || []);
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const handleAddAccountClick = () => {
    setShowAddDialog(true);
    setSelectedWorkspaceId('');
    setLinkedinEmail('');
    setLinkedinPassword('');
    setLoginStatus('');
  };

  const handleQuickLogin = async () => {
    if (!selectedWorkspaceId || !linkedinEmail || !linkedinPassword) {
      toast({
        title: 'Missing Information',
        description: 'Please select a workspace and enter LinkedIn credentials',
        variant: 'destructive'
      });
      return;
    }

    setAddingAccount(true);
    setLoginStatus('Initializing browser session...');

    try {
      const response = await fetch('/api/linkedin-automation/auto-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({
          email: linkedinEmail,
          password: linkedinPassword,
          workspace_id: selectedWorkspaceId
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setLoginStatus('');
        setShowAddDialog(false);
        toast({
          title: 'LinkedIn Account Added',
          description: `Successfully connected: ${data.profileName || 'LinkedIn account'}`,
        });
        loadAccounts();
      } else {
        setLoginStatus('');
        toast({
          title: 'Login Failed',
          description: data.error || 'Failed to connect LinkedIn account',
          variant: 'destructive'
        });
      }
    } catch (error) {
      setLoginStatus('');
      toast({
        title: 'Error',
        description: 'Failed to connect LinkedIn account',
        variant: 'destructive'
      });
    } finally {
      setAddingAccount(false);
    }
  };

  const groupAccountsByWorkspace = (accounts: LinkedInAccount[]): WorkspaceGroup[] => {
    const groups = new Map<string, WorkspaceGroup>();
    
    accounts.forEach(account => {
      if (!groups.has(account.workspace_id)) {
        groups.set(account.workspace_id, {
          workspace_id: account.workspace_id,
          workspace_name: account.workspace_name,
          accounts: [],
          activeCount: 0
        });
      }
      const group = groups.get(account.workspace_id)!;
      group.accounts.push(account);
      if (account.is_active) {
        group.activeCount++;
      }
    });
    
    return Array.from(groups.values()).sort((a, b) => 
      a.workspace_name.localeCompare(b.workspace_name)
    );
  };

  const handleUseAccount = (account: LinkedInAccount) => {
    localStorage.setItem('current-workspace-id', account.workspace_id);
    localStorage.setItem('selected-linkedin-user-id', account.user_id);
    toast({
      title: 'Account Selected',
      description: `Using ${account.profile_name || 'LinkedIn account'} in ${account.workspace_name}`,
    });
    navigate(`/linkedin-settings?workspace=${account.workspace_id}&user=${account.user_id}`);
  };

  const handleSwitchToWorkspace = (workspaceId: string, workspaceName: string) => {
    localStorage.setItem('current-workspace-id', workspaceId);
    toast({
      title: 'Workspace Selected',
      description: `Switched to: ${workspaceName}`,
    });
    navigate(`/dashboard?workspace=${workspaceId}`);
  };

  const handleViewSettings = (account: LinkedInAccount) => {
    window.open(`/linkedin-settings?workspace=${account.workspace_id}&user=${account.user_id}`, '_blank');
  };

  const toggleWorkspace = (workspaceId: string) => {
    setExpandedWorkspaces(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workspaceId)) {
        newSet.delete(workspaceId);
      } else {
        newSet.add(workspaceId);
      }
      return newSet;
    });
  };

  const filteredAccounts = accounts.filter(account => 
    account.workspace_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.profile_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.workspace_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const workspaceGroups = groupAccountsByWorkspace(filteredAccounts);

  const getSessionSourceBadge = (source: string | null) => {
    switch (source) {
      case 'quick_login':
        return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 text-xs">Quick Login</Badge>;
      case 'manual_cookies':
        return <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 text-xs">Manual Cookies</Badge>;
      default:
        return <Badge variant="outline" className="text-slate-400 text-xs">Unknown</Badge>;
    }
  };

  const getStatusBadge = (account: LinkedInAccount) => {
    if (!account.is_active) {
      return <Badge variant="destructive" className="bg-red-500/20 text-red-400 text-xs"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>;
    }
    if (account.error_count && account.error_count >= 3) {
      return <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/50 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Unhealthy</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Linkedin className="h-5 w-5 text-blue-500" />
              <span className="text-2xl font-bold text-white">{stats.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold text-white">{stats.active}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Workspaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold text-white">{workspaceGroups.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">LinkedIn Account Manager</CardTitle>
              <CardDescription className="text-slate-400">
                View and manage all LinkedIn connections across workspaces. Expand a workspace to see all connected accounts.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                onClick={handleAddAccountClick}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                data-testid="button-add-linkedin-account"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add LinkedIn Account
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={loadAccounts}
                disabled={loading}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
                data-testid="button-refresh-linkedin-accounts"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by workspace or profile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-slate-700/50 border-slate-600 text-white"
                data-testid="input-search-linkedin-accounts"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-slate-400">Loading accounts...</span>
            </div>
          ) : workspaceGroups.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Linkedin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No LinkedIn accounts connected across any workspace</p>
            </div>
          ) : (
            <div className="space-y-2">
              {workspaceGroups.map((group) => (
                <Collapsible
                  key={group.workspace_id}
                  open={expandedWorkspaces.has(group.workspace_id)}
                  onOpenChange={() => toggleWorkspace(group.workspace_id)}
                >
                  <div className="rounded-lg border border-slate-700 overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 bg-slate-800/30 hover:bg-slate-700/50 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3">
                          {expandedWorkspaces.has(group.workspace_id) ? (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          )}
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                            {group.workspace_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-white">{group.workspace_name}</div>
                            <div className="text-xs text-slate-500 font-mono">{group.workspace_id.slice(0, 8)}...</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-slate-400 border-slate-600">
                              {group.accounts.length} account{group.accounts.length !== 1 ? 's' : ''}
                            </Badge>
                            {group.activeCount > 0 && (
                              <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                                {group.activeCount} active
                              </Badge>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSwitchToWorkspace(group.workspace_id, group.workspace_name);
                                }}
                                className="text-slate-300 focus:bg-slate-700"
                              >
                                <Building2 className="h-4 w-4 mr-2" />
                                Switch to Workspace
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(`/settings/linkedin?workspace=${group.workspace_id}`, '_blank');
                                }}
                                className="text-slate-300 focus:bg-slate-700"
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                LinkedIn Settings
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="border-t border-slate-700">
                        {group.accounts.map((account) => (
                          <div
                            key={`${account.workspace_id}-${account.user_id}`}
                            className="flex items-center justify-between p-4 pl-14 hover:bg-slate-700/20 border-b border-slate-700/50 last:border-b-0"
                            data-testid={`row-linkedin-account-${account.workspace_id}-${account.user_id}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center">
                                <User className="h-5 w-5 text-slate-400" />
                              </div>
                              <div>
                                <div className="font-medium text-white flex items-center gap-2">
                                  {account.profile_name || 'Unknown Profile'}
                                  {getStatusBadge(account)}
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  {getSessionSourceBadge(account.session_source)}
                                  {account.proxy_id && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <Globe className="h-3 w-3 text-green-400" />
                                      <span className="font-mono">{account.proxy_id.slice(0, 8)}...</span>
                                    </div>
                                  )}
                                  {account.session_captured_at && (
                                    <div className="flex items-center gap-1 text-xs text-slate-500">
                                      <Clock className="h-3 w-3" />
                                      {formatDistanceToNow(new Date(account.session_captured_at), { addSuffix: true })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleUseAccount(account)}
                                className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                                data-testid={`button-use-account-${account.user_id}`}
                              >
                                <Play className="h-3 w-3 mr-1" />
                                Use This Account
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                  <DropdownMenuItem 
                                    onClick={() => handleViewSettings(account)}
                                    className="text-slate-300 focus:bg-slate-700"
                                  >
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Settings (New Tab)
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add LinkedIn Account Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Linkedin className="h-5 w-5 text-blue-500" />
              Add LinkedIn Account
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Connect a new LinkedIn account to a workspace using Quick Login.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace" className="text-slate-300">Select Workspace</Label>
              <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Choose a workspace..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id} className="text-white hover:bg-slate-700">
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-300">LinkedIn Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="linkedin@example.com"
                value={linkedinEmail}
                onChange={(e) => setLinkedinEmail(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                disabled={addingAccount}
                data-testid="input-linkedin-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">LinkedIn Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={linkedinPassword}
                onChange={(e) => setLinkedinPassword(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                disabled={addingAccount}
                data-testid="input-linkedin-password"
              />
            </div>

            {loginStatus && (
              <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 p-3 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
                {loginStatus}
              </div>
            )}

            <div className="text-xs text-slate-500 bg-slate-800/50 p-3 rounded-lg">
              <p className="font-medium text-slate-400 mb-1">Note:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Credentials are only used for one-time login</li>
                <li>A proxy will be automatically assigned</li>
                <li>Session will be stored securely for automation</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              disabled={addingAccount}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleQuickLogin}
              disabled={addingAccount || !selectedWorkspaceId || !linkedinEmail || !linkedinPassword}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-connect-linkedin"
            >
              {addingAccount ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Linkedin className="h-4 w-4 mr-2" />
                  Connect Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
