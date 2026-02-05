import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Shield, Settings, Trash2, Check, X, Wifi, WifiOff, User } from 'lucide-react';

interface MemberProxySettings {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  proxy_configured: boolean;
  proxy_provider: string | null;
  proxy_host: string | null;
  proxy_port: number | null;
  proxy_enabled: boolean;
  daily_invite_limit: number;
  daily_message_limit: number;
  is_active: boolean;
  session_captured: boolean;
  assigned_by: string | null;
  updated_at: string | null;
}

interface ProxyFormData {
  proxy_provider: string;
  proxy_host: string;
  proxy_port: string;
  proxy_username: string;
  proxy_password: string;
  sticky_session_id: string;
  daily_invite_limit: number;
  daily_message_limit: number;
  proxy_enabled: boolean;
}

const PROXY_PROVIDERS = [
  { value: 'brightdata', label: 'Bright Data' },
  { value: 'smartproxy', label: 'Smartproxy' },
  { value: 'oxylabs', label: 'Oxylabs' },
  { value: 'iproyal', label: 'IPRoyal' },
  { value: 'soax', label: 'SOAX' },
  { value: 'other', label: 'Other' },
];

export function LinkedInProxyManager() {
  const { currentWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [editingUser, setEditingUser] = useState<MemberProxySettings | null>(null);
  const [formData, setFormData] = useState<ProxyFormData>({
    proxy_provider: '',
    proxy_host: '',
    proxy_port: '',
    proxy_username: '',
    proxy_password: '',
    sticky_session_id: '',
    daily_invite_limit: 100,
    daily_message_limit: 100,
    proxy_enabled: true,
  });

  const { data: membersData, isLoading } = useQuery<{ members: MemberProxySettings[] }>({
    queryKey: ['/api/linkedin-automation/admin/workspace-settings', currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
  });

  const { data: adminCheck } = useQuery<{ isAdmin: boolean }>({
    queryKey: ['/api/linkedin-automation/admin/check', currentWorkspace?.id],
    enabled: !!currentWorkspace?.id,
  });

  const assignProxyMutation = useMutation({
    mutationFn: async (data: { target_user_id: string } & ProxyFormData) => {
      return apiRequest('/api/linkedin-automation/admin/assign-proxy', {
        method: 'POST',
        body: JSON.stringify({
          workspace_id: currentWorkspace?.id,
          ...data,
          proxy_port: parseInt(data.proxy_port) || 0,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Proxy assigned successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin-automation/admin/workspace-settings'] });
      setEditingUser(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: 'Failed to assign proxy', description: error.message, variant: 'destructive' });
    },
  });

  const removeProxyMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      return apiRequest('/api/linkedin-automation/admin/remove-proxy', {
        method: 'DELETE',
        body: JSON.stringify({
          workspace_id: currentWorkspace?.id,
          target_user_id: targetUserId,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: 'Proxy removed successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/linkedin-automation/admin/workspace-settings'] });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to remove proxy', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      proxy_provider: '',
      proxy_host: '',
      proxy_port: '',
      proxy_username: '',
      proxy_password: '',
      sticky_session_id: '',
      daily_invite_limit: 100,
      daily_message_limit: 100,
      proxy_enabled: true,
    });
  };

  const openEditDialog = (member: MemberProxySettings) => {
    setEditingUser(member);
    setFormData({
      proxy_provider: member.proxy_provider || '',
      proxy_host: member.proxy_host || '',
      proxy_port: member.proxy_port?.toString() || '',
      proxy_username: '',
      proxy_password: '',
      sticky_session_id: '',
      daily_invite_limit: member.daily_invite_limit,
      daily_message_limit: member.daily_message_limit,
      proxy_enabled: member.proxy_enabled,
    });
  };

  const handleSubmit = () => {
    if (!editingUser) return;
    assignProxyMutation.mutate({
      target_user_id: editingUser.user_id,
      ...formData,
    });
  };

  if (!adminCheck?.isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            LinkedIn Proxy Management
          </CardTitle>
          <CardDescription>
            Admin access required to manage workspace proxy settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const members = membersData?.members || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" data-testid="title-proxy-manager">
          <Shield className="h-5 w-5" />
          LinkedIn Proxy Management
        </CardTitle>
        <CardDescription>
          Assign and manage sticky mobile proxies for each team member. Each user needs their own dedicated proxy for safe LinkedIn automation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading team members...</div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No team members found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Proxy Status</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.user_id} data-testid={`row-member-${member.user_id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{member.full_name}</div>
                        <div className="text-sm text-muted-foreground">{member.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.role === 'owner' ? 'default' : member.role === 'admin' ? 'secondary' : 'outline'}>
                      {member.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.proxy_configured ? (
                      <div className="flex items-center gap-2">
                        {member.proxy_enabled ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-yellow-500" />
                        )}
                        <div>
                          <div className="text-sm">{member.proxy_provider || 'Custom'}</div>
                          <div className="text-xs text-muted-foreground">
                            {member.proxy_host}:{member.proxy_port}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <X className="h-3 w-3 mr-1" />
                        Not configured
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.session_captured ? (
                      <Badge variant="default" className="bg-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Captured
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{member.daily_invite_limit} invites/day</div>
                      <div className="text-muted-foreground">{member.daily_message_limit} msgs/day</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(member)}
                        data-testid={`button-edit-proxy-${member.user_id}`}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      {member.proxy_configured && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeProxyMutation.mutate(member.user_id)}
                          disabled={removeProxyMutation.isPending}
                          data-testid={`button-remove-proxy-${member.user_id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configure Proxy for {editingUser?.full_name}</DialogTitle>
              <DialogDescription>
                Assign a dedicated sticky mobile proxy for this user's LinkedIn automation.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Proxy Provider</Label>
                <Select
                  value={formData.proxy_provider}
                  onValueChange={(value) => setFormData({ ...formData, proxy_provider: value })}
                >
                  <SelectTrigger data-testid="select-proxy-provider">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROXY_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        {provider.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input
                    value={formData.proxy_host}
                    onChange={(e) => setFormData({ ...formData, proxy_host: e.target.value })}
                    placeholder="proxy.example.com"
                    data-testid="input-proxy-host"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    value={formData.proxy_port}
                    onChange={(e) => setFormData({ ...formData, proxy_port: e.target.value })}
                    placeholder="8080"
                    data-testid="input-proxy-port"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    value={formData.proxy_username}
                    onChange={(e) => setFormData({ ...formData, proxy_username: e.target.value })}
                    placeholder="user_session123"
                    data-testid="input-proxy-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={formData.proxy_password}
                    onChange={(e) => setFormData({ ...formData, proxy_password: e.target.value })}
                    placeholder="••••••••"
                    data-testid="input-proxy-password"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sticky Session ID (optional)</Label>
                <Input
                  value={formData.sticky_session_id}
                  onChange={(e) => setFormData({ ...formData, sticky_session_id: e.target.value })}
                  placeholder="session_abc123"
                  data-testid="input-sticky-session"
                />
                <p className="text-xs text-muted-foreground">
                  Used to maintain the same IP across requests
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Daily Invite Limit</Label>
                  <Input
                    type="number"
                    value={formData.daily_invite_limit}
                    onChange={(e) => setFormData({ ...formData, daily_invite_limit: parseInt(e.target.value) || 100 })}
                    min={1}
                    max={100}
                    data-testid="input-daily-invite-limit"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily Message Limit</Label>
                  <Input
                    type="number"
                    value={formData.daily_message_limit}
                    onChange={(e) => setFormData({ ...formData, daily_message_limit: parseInt(e.target.value) || 100 })}
                    min={1}
                    max={100}
                    data-testid="input-daily-message-limit"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>Enable Proxy</Label>
                <Switch
                  checked={formData.proxy_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, proxy_enabled: checked })}
                  data-testid="switch-proxy-enabled"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={assignProxyMutation.isPending || !formData.proxy_host || !formData.proxy_port}
                data-testid="button-save-proxy"
              >
                {assignProxyMutation.isPending ? 'Saving...' : 'Save Proxy'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
