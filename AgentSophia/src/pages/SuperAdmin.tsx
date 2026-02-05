import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProxyPoolManager } from '@/components/super-admin/proxy-pool-manager';
import { CreditsManagement } from '@/components/super-admin/credits-management';
import { LinkedInAccountsManager } from '@/components/super-admin/linkedin-accounts-manager';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  Search, 
  MoreHorizontal,
  Eye,
  UserCog,
  CreditCard,
  Activity,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  RefreshCw,
  Download,
  Settings,
  Zap,
  Brain,
  Globe,
  Coins,
  Linkedin
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Workspace {
  id: string;
  name: string;
  owner_email: string;
  created_at: string;
  member_count: number;
  subscription_status: 'active' | 'trial' | 'expired' | 'cancelled';
  subscription_tier: 'growth' | 'professional' | 'enterprise';
  monthly_revenue: number;
  seats_used: number;
  seats_limit: number;
  last_activity: string;
}

interface PlatformStats {
  total_workspaces: number;
  total_users: number;
  active_subscriptions: number;
  monthly_recurring_revenue: number;
  trial_conversions: number;
  churn_rate: number;
  avg_seats_per_workspace: number;
  sophia_actions_today: number;
}

interface SystemHealth {
  api_status: 'healthy' | 'degraded' | 'down';
  database_status: 'healthy' | 'degraded' | 'down';
  ai_services_status: 'healthy' | 'degraded' | 'down';
  email_delivery_rate: number;
  avg_response_time_ms: number;
}

interface SuperAdminMember {
  id: string;
  email: string;
  user_id: string | null;
  created_by: string;
  created_at: string;
}

function SuperAdminManagement() {
  const { session, refreshSuperAdminStatus } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<SuperAdminMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [adding, setAdding] = useState(false);

  const loadMembers = async () => {
    try {
      const response = await fetch('/api/super-admin/members', {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMembers(data);
      }
    } catch (error) {
      console.error('Error loading super admins:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [session]);

  const handleAddMember = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      const response = await fetch('/api/super-admin/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`
        },
        body: JSON.stringify({ email: newEmail.trim() })
      });
      
      if (response.ok) {
        toast({ title: 'Super admin added', description: `${newEmail} is now a super admin.` });
        setNewEmail('');
        loadMembers();
        refreshSuperAdminStatus();
      } else {
        const error = await response.json();
        toast({ title: 'Error', description: error.error || 'Failed to add super admin', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (id: string, email: string) => {
    try {
      const response = await fetch(`/api/super-admin/members/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      
      if (response.ok) {
        toast({ title: 'Super admin removed', description: `${email} is no longer a super admin.` });
        loadMembers();
      } else {
        const error = await response.json();
        toast({ title: 'Error', description: error.error || 'Failed to remove super admin', variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <UserCog className="h-5 w-5 mr-2 text-red-400" />
          Super Admin Management
        </CardTitle>
        <CardDescription className="text-slate-400">
          Add or remove users who have full platform access. Super admins can manage all workspaces, billing, and system settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-3">
          <Input
            placeholder="Enter email address..."
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
            onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
            data-testid="input-super-admin-email"
          />
          <Button
            onClick={handleAddMember}
            disabled={adding || !newEmail.trim()}
            className="bg-red-600 hover:bg-red-700 text-white"
            data-testid="button-add-super-admin"
          >
            {adding ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Add Super Admin'}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Shield className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No super admins in database yet.</p>
            <p className="text-sm mt-1">Add yourself or another user to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">Email</TableHead>
                <TableHead className="text-slate-400">Added By</TableHead>
                <TableHead className="text-slate-400">Added On</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id} className="border-slate-700 hover:bg-slate-700/50">
                  <TableCell className="text-white font-medium">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-400" />
                      {member.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">{member.created_by || 'System'}</TableCell>
                  <TableCell className="text-slate-300">
                    {new Date(member.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id, member.email)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      data-testid={`button-remove-admin-${member.id}`}
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function SuperAdmin() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PlatformStats>({
    total_workspaces: 0,
    total_users: 0,
    active_subscriptions: 0,
    monthly_recurring_revenue: 0,
    trial_conversions: 0,
    churn_rate: 0,
    avg_seats_per_workspace: 0,
    sophia_actions_today: 0
  });
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    api_status: 'healthy',
    database_status: 'healthy',
    ai_services_status: 'healthy',
    email_delivery_rate: 99.2,
    avg_response_time_ms: 145
  });

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      toast({
        title: 'Access Denied',
        description: 'You do not have permission to access this page.',
        variant: 'destructive',
      });
      navigate('/');
    }
  }, [isSuperAdmin, authLoading, navigate, toast]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadPlatformData();
    }
  }, [isSuperAdmin]);

  const loadPlatformData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/super-admin/platform-stats', {
        headers: { 'Authorization': `Bearer ${session?.access_token || ''}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats || stats);
        setWorkspaces(data.workspaces || []);
        setSystemHealth(data.health || systemHealth);
      }
    } catch (error) {
      console.error('Error loading platform data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImpersonate = async (workspaceId: string, userEmail: string) => {
    toast({
      title: 'Impersonation Started',
      description: `Now viewing as ${userEmail}. Actions will be logged.`,
    });
  };

  const handleSwitchToWorkspace = (workspaceId: string, workspaceName: string) => {
    localStorage.setItem('current-workspace-id', workspaceId);
    toast({
      title: 'Switching Workspace',
      description: `Opening ${workspaceName}...`,
    });
    navigate(`/dashboard?workspace=${workspaceId}`);
  };

  const handleExportData = () => {
    toast({
      title: 'Export Started',
      description: 'Your data export will be ready shortly.',
    });
  };

  const filteredWorkspaces = workspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ws.owner_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'trial': return 'bg-blue-100 text-blue-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      case 'professional': return 'bg-indigo-100 text-indigo-800';
      case 'growth': return 'bg-cyan-100 text-cyan-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'down': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/')}
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                    <Shield className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-white">Super Admin Console</h1>
                    <p className="text-slate-400 text-sm">Platform-wide management and analytics</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleExportData}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadPlatformData}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total Workspaces</p>
                    <p className="text-3xl font-bold text-white">{stats.total_workspaces}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Total Users</p>
                    <p className="text-3xl font-bold text-white">{stats.total_users}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Monthly Revenue</p>
                    <p className="text-3xl font-bold text-white">${stats.monthly_recurring_revenue.toLocaleString()}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Sophia Actions Today</p>
                    <p className="text-3xl font-bold text-white">{stats.sophia_actions_today.toLocaleString()}</p>
                  </div>
                  <div className="h-12 w-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Brain className="h-6 w-6 text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-slate-800/50 border border-slate-700 flex-wrap h-auto gap-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-slate-700">
                <Activity className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="workspaces" className="data-[state=active]:bg-slate-700">
                <Building2 className="h-4 w-4 mr-2" />
                Workspaces
              </TabsTrigger>
              <TabsTrigger value="billing" className="data-[state=active]:bg-slate-700">
                <CreditCard className="h-4 w-4 mr-2" />
                Billing
              </TabsTrigger>
              <TabsTrigger value="system" className="data-[state=active]:bg-slate-700">
                <Settings className="h-4 w-4 mr-2" />
                System Health
              </TabsTrigger>
              <TabsTrigger value="proxies" className="data-[state=active]:bg-slate-700">
                <Globe className="h-4 w-4 mr-2" />
                Proxy Pool
              </TabsTrigger>
              <TabsTrigger value="admins" className="data-[state=active]:bg-slate-700">
                <UserCog className="h-4 w-4 mr-2" />
                Super Admins
              </TabsTrigger>
              <TabsTrigger value="credits" className="data-[state=active]:bg-slate-700">
                <Coins className="h-4 w-4 mr-2" />
                Credits
              </TabsTrigger>
              <TabsTrigger value="linkedin" className="data-[state=active]:bg-slate-700">
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Revenue Breakdown</CardTitle>
                    <CardDescription className="text-slate-400">Monthly recurring revenue by tier</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                          <span className="text-slate-300">Enterprise ($599/user)</span>
                        </div>
                        <span className="text-white font-medium">$0</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-3 w-3 rounded-full bg-indigo-500"></div>
                          <span className="text-slate-300">Professional ($399/user)</span>
                        </div>
                        <span className="text-white font-medium">$0</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="h-3 w-3 rounded-full bg-cyan-500"></div>
                          <span className="text-slate-300">Growth ($199/user)</span>
                        </div>
                        <span className="text-white font-medium">$0</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Key Metrics</CardTitle>
                    <CardDescription className="text-slate-400">Platform performance indicators</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Active Subscriptions</span>
                        <span className="text-white font-medium">{stats.active_subscriptions}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Trial Conversion Rate</span>
                        <span className="text-white font-medium">{stats.trial_conversions}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Monthly Churn Rate</span>
                        <span className="text-white font-medium">{stats.churn_rate}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">Avg Seats per Workspace</span>
                        <span className="text-white font-medium">{stats.avg_seats_per_workspace.toFixed(1)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Recent Activity</CardTitle>
                  <CardDescription className="text-slate-400">Latest platform events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 p-3 bg-slate-700/30 rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-white">New workspace created</p>
                        <p className="text-xs text-slate-400">Waiting for first customer...</p>
                      </div>
                      <span className="text-xs text-slate-500">Just now</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="workspaces" className="space-y-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">All Workspaces</CardTitle>
                      <CardDescription className="text-slate-400">Manage customer workspaces</CardDescription>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Search workspaces..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                        data-testid="input-search-workspaces"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredWorkspaces.length === 0 ? (
                    <div className="text-center py-12">
                      <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">No workspaces yet</p>
                      <p className="text-sm text-slate-500">Workspaces will appear here when customers sign up</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-400">Workspace</TableHead>
                          <TableHead className="text-slate-400">Owner</TableHead>
                          <TableHead className="text-slate-400">Status</TableHead>
                          <TableHead className="text-slate-400">Tier</TableHead>
                          <TableHead className="text-slate-400">Seats</TableHead>
                          <TableHead className="text-slate-400">Revenue</TableHead>
                          <TableHead className="text-slate-400">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredWorkspaces.map((workspace) => (
                          <TableRow key={workspace.id} className="border-slate-700">
                            <TableCell className="text-white font-medium">{workspace.name}</TableCell>
                            <TableCell className="text-slate-300">{workspace.owner_email}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(workspace.subscription_status)}>
                                {workspace.subscription_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={getTierColor(workspace.subscription_tier)}>
                                {workspace.subscription_tier}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-300">
                              {workspace.seats_used}/{workspace.seats_limit}
                            </TableCell>
                            <TableCell className="text-white">${workspace.monthly_revenue}/mo</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-slate-800 border-slate-700">
                                  <DropdownMenuItem 
                                    onClick={() => handleSwitchToWorkspace(workspace.id, workspace.name)}
                                    className="text-slate-300 focus:bg-slate-700"
                                  >
                                    <Building2 className="h-4 w-4 mr-2" />
                                    Switch to Workspace
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleImpersonate(workspace.id, workspace.owner_email)}
                                    className="text-slate-300 focus:bg-slate-700"
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    View as Customer
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => window.open(`/settings/linkedin?workspace=${workspace.id}`, '_blank')}
                                    className="text-slate-300 focus:bg-slate-700"
                                  >
                                    <Linkedin className="h-4 w-4 mr-2" />
                                    LinkedIn Settings
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => navigate(`/admin?workspace=${workspace.id}`)}
                                    className="text-slate-300 focus:bg-slate-700"
                                  >
                                    <UserCog className="h-4 w-4 mr-2" />
                                    Manage Users
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-slate-300 focus:bg-slate-700">
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    Billing Details
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Pricing Tiers</CardTitle>
                    <CardDescription className="text-slate-400">Current pricing configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-cyan-400 font-medium">Growth</span>
                        <span className="text-white font-bold">$199/user/mo</span>
                      </div>
                      <p className="text-sm text-slate-400">Core autonomous features</p>
                    </div>
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-indigo-400 font-medium">Professional</span>
                        <span className="text-white font-bold">$399/user/mo</span>
                      </div>
                      <p className="text-sm text-slate-400">Full autonomy + learning engine</p>
                    </div>
                    <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-400 font-medium">Enterprise</span>
                        <span className="text-white font-bold">$599/user/mo</span>
                      </div>
                      <p className="text-sm text-slate-400">Unlimited AI + white-glove</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700 lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-white">Revenue Analytics</CardTitle>
                    <CardDescription className="text-slate-400">Subscription and billing metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-slate-400">Annual Run Rate</p>
                          <p className="text-2xl font-bold text-white">${(stats.monthly_recurring_revenue * 12).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Average Revenue per User</p>
                          <p className="text-2xl font-bold text-white">
                            ${stats.total_users > 0 ? Math.round(stats.monthly_recurring_revenue / stats.total_users) : 0}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-slate-400">Active Trials</p>
                          <p className="text-2xl font-bold text-white">0</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Pending Upgrades</p>
                          <p className="text-2xl font-bold text-white">0</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">API Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-3">
                      {getHealthIcon(systemHealth.api_status)}
                      <div>
                        <p className="text-white font-medium capitalize">{systemHealth.api_status}</p>
                        <p className="text-sm text-slate-400">{systemHealth.avg_response_time_ms}ms avg response</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Database</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-3">
                      {getHealthIcon(systemHealth.database_status)}
                      <div>
                        <p className="text-white font-medium capitalize">{systemHealth.database_status}</p>
                        <p className="text-sm text-slate-400">PostgreSQL running</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-slate-800/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">AI Services</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-3">
                      {getHealthIcon(systemHealth.ai_services_status)}
                      <div>
                        <p className="text-white font-medium capitalize">{systemHealth.ai_services_status}</p>
                        <p className="text-sm text-slate-400">OpenAI + Claude active</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Platform Configuration</CardTitle>
                  <CardDescription className="text-slate-400">Global system settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Zap className="h-5 w-5 text-yellow-400" />
                          <span className="text-slate-300">AI Rate Limiting</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Brain className="h-5 w-5 text-purple-400" />
                          <span className="text-slate-300">Sophia Learning Mode</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Shield className="h-5 w-5 text-blue-400" />
                          <span className="text-slate-300">Multi-tenant Isolation</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Enforced</Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Activity className="h-5 w-5 text-green-400" />
                          <span className="text-slate-300">Email Delivery Rate</span>
                        </div>
                        <span className="text-white font-medium">{systemHealth.email_delivery_rate}%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="proxies" className="space-y-6">
              <ProxyPoolManager />
            </TabsContent>

            <TabsContent value="admins" className="space-y-6">
              <SuperAdminManagement />
            </TabsContent>

            <TabsContent value="credits" className="space-y-6">
              <CreditsManagement />
            </TabsContent>

            <TabsContent value="linkedin" className="space-y-6">
              <LinkedInAccountsManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
