import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Plus,
  Trash2,
  Star,
  StarOff,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Linkedin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  User,
  Building2,
  Sparkles,
  Settings
} from 'lucide-react';
import { SiTiktok } from 'react-icons/si';

interface ConnectedAccount {
  id: string;
  platform: string;
  account_type: string;
  account_name: string;
  account_username: string | null;
  profile_url: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_default: boolean;
  connection_status: string;
  last_sync_at: string | null;
  created_at: string;
}

const PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-600', textColor: 'text-blue-600' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-700', textColor: 'text-blue-700' },
  { id: 'twitter', name: 'X (Twitter)', icon: Twitter, color: 'bg-black', textColor: 'text-black' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-pink-600', textColor: 'text-pink-600' },
  { id: 'tiktok', name: 'TikTok', icon: SiTiktok, color: 'bg-black', textColor: 'text-black' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'bg-red-600', textColor: 'text-red-600' },
];

const ACCOUNT_TYPES = [
  { id: 'personal', name: 'Personal Profile', icon: User },
  { id: 'page', name: 'Business Page', icon: Building2 },
  { id: 'business', name: 'Business Account', icon: Building2 },
  { id: 'creator', name: 'Creator Account', icon: Sparkles },
];

export function ConnectedAccountsManager() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: accounts = [], isLoading } = useQuery<ConnectedAccount[]>({
    queryKey: ['/api/social-scheduling/connected-accounts'],
  });

  const addAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/social-scheduling/connected-accounts', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-scheduling/connected-accounts'] });
      setIsAddDialogOpen(false);
      toast({ title: 'Account connected successfully!' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/social-scheduling/connected-accounts/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-scheduling/connected-accounts'] });
      toast({ title: 'Account disconnected' });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/social-scheduling/connected-accounts/${id}/set-default`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-scheduling/connected-accounts'] });
      toast({ title: 'Default account updated' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      return apiRequest(`/api/social-scheduling/connected-accounts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-scheduling/connected-accounts'] });
    },
  });

  const groupedAccounts = accounts.reduce((acc: Record<string, ConnectedAccount[]>, account) => {
    if (!acc[account.platform]) {
      acc[account.platform] = [];
    }
    acc[account.platform].push(account);
    return acc;
  }, {});

  const getPlatformInfo = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId);
  };

  const getAccountTypeInfo = (typeId: string) => {
    return ACCOUNT_TYPES.find(t => t.id === typeId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600 bg-green-50';
      case 'expired': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Connected Social Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Connect multiple accounts per platform and choose which ones to use for posts
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-account">
              <Plus className="h-4 w-4 mr-2" />
              Connect Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Connect Social Account</DialogTitle>
              <DialogDescription>
                Add a new social media account to post from
              </DialogDescription>
            </DialogHeader>
            <AddAccountForm 
              onSubmit={(data) => addAccountMutation.mutate(data)}
              isLoading={addAccountMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="p-3 bg-muted rounded-full mb-4">
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No accounts connected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Connect your social media accounts to start posting
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-connect-first-account">
              <Plus className="h-4 w-4 mr-2" />
              Connect Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={Object.keys(groupedAccounts)[0] || 'linkedin'} className="space-y-4">
          <TabsList className="flex-wrap">
            {PLATFORMS.map((platform) => {
              const platformAccounts = groupedAccounts[platform.id] || [];
              const Icon = platform.icon;
              return (
                <TabsTrigger key={platform.id} value={platform.id} className="gap-2">
                  <Icon className={`h-4 w-4 ${platform.textColor}`} />
                  {platform.name}
                  {platformAccounts.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {platformAccounts.length}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {PLATFORMS.map((platform) => {
            const platformAccounts = groupedAccounts[platform.id] || [];
            const Icon = platform.icon;
            
            return (
              <TabsContent key={platform.id} value={platform.id} className="space-y-4">
                {platformAccounts.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Icon className={`h-12 w-12 ${platform.textColor} mb-3 opacity-50`} />
                      <p className="text-muted-foreground mb-3">No {platform.name} accounts connected</p>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSelectedPlatform(platform.id);
                          setIsAddDialogOpen(true);
                        }}
                        data-testid={`button-add-${platform.id}-account`}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Connect {platform.name} Account
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {platformAccounts.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        platform={platform}
                        onDelete={() => deleteAccountMutation.mutate(account.id)}
                        onSetDefault={() => setDefaultMutation.mutate(account.id)}
                        onToggleActive={(active) => toggleActiveMutation.mutate({ id: account.id, is_active: active })}
                        isDeleting={deleteAccountMutation.isPending}
                      />
                    ))}
                    <Card className="border-dashed flex items-center justify-center min-h-[180px] cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedPlatform(platform.id);
                        setIsAddDialogOpen(true);
                      }}
                      data-testid={`card-add-another-${platform.id}`}
                    >
                      <div className="text-center">
                        <Plus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">Add another {platform.name} account</p>
                      </div>
                    </Card>
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}

interface AccountCardProps {
  account: ConnectedAccount;
  platform: typeof PLATFORMS[0];
  onDelete: () => void;
  onSetDefault: () => void;
  onToggleActive: (active: boolean) => void;
  isDeleting: boolean;
}

function AccountCard({ account, platform, onDelete, onSetDefault, onToggleActive, isDeleting }: AccountCardProps) {
  const Icon = platform.icon;
  const accountType = ACCOUNT_TYPES.find(t => t.id === account.account_type);
  const TypeIcon = accountType?.icon || User;

  return (
    <Card className={`relative ${!account.is_active ? 'opacity-60' : ''}`} data-testid={`card-account-${account.id}`}>
      {account.is_default && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-yellow-500 text-white">
            <Star className="h-3 w-3 mr-1" />
            Default
          </Badge>
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={account.avatar_url || undefined} />
            <AvatarFallback className={platform.color + ' text-white'}>
              <Icon className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold truncate">{account.account_name}</h4>
              <Badge variant="outline" className="text-xs shrink-0">
                <TypeIcon className="h-3 w-3 mr-1" />
                {accountType?.name || account.account_type}
              </Badge>
            </div>
            {account.account_username && (
              <p className="text-sm text-muted-foreground truncate">@{account.account_username}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge 
                variant="secondary" 
                className={`text-xs ${
                  account.connection_status === 'connected' ? 'text-green-600 bg-green-50' :
                  account.connection_status === 'expired' ? 'text-yellow-600 bg-yellow-50' :
                  'text-red-600 bg-red-50'
                }`}
              >
                {account.connection_status === 'connected' ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <AlertCircle className="h-3 w-3 mr-1" />
                )}
                {account.connection_status}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex items-center gap-2">
            <Switch
              checked={account.is_active}
              onCheckedChange={onToggleActive}
              data-testid={`switch-active-${account.id}`}
            />
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
          <div className="flex items-center gap-1">
            {account.profile_url && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={account.profile_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
            {!account.is_default && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={onSetDefault}
                title="Set as default"
                data-testid={`button-set-default-${account.id}`}
              >
                <StarOff className="h-4 w-4" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={isDeleting}
              data-testid={`button-delete-${account.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AddAccountFormProps {
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

function AddAccountForm({ onSubmit, isLoading }: AddAccountFormProps) {
  const [platform, setPlatform] = useState('linkedin');
  const [accountType, setAccountType] = useState('personal');
  const [accountName, setAccountName] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      platform,
      account_type: accountType,
      account_name: accountName,
      account_username: accountUsername || null,
      profile_url: profileUrl || null,
      is_default: isDefault,
      is_active: true,
      connection_status: 'connected',
    });
  };

  const selectedPlatform = PLATFORMS.find(p => p.id === platform);
  const Icon = selectedPlatform?.icon || Linkedin;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="platform">Platform</Label>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger data-testid="select-platform">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((p) => {
              const PIcon = p.icon;
              return (
                <SelectItem key={p.id} value={p.id}>
                  <div className="flex items-center gap-2">
                    <PIcon className={`h-4 w-4 ${p.textColor}`} />
                    {p.name}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountType">Account Type</Label>
        <Select value={accountType} onValueChange={setAccountType}>
          <SelectTrigger data-testid="select-account-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((type) => {
              const TIcon = type.icon;
              return (
                <SelectItem key={type.id} value={type.id}>
                  <div className="flex items-center gap-2">
                    <TIcon className="h-4 w-4" />
                    {type.name}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountName">Account Name *</Label>
        <Input
          id="accountName"
          value={accountName}
          onChange={(e) => setAccountName(e.target.value)}
          placeholder="e.g., My Company Page"
          required
          data-testid="input-account-name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="accountUsername">Username / Handle</Label>
        <Input
          id="accountUsername"
          value={accountUsername}
          onChange={(e) => setAccountUsername(e.target.value)}
          placeholder="e.g., @mycompany"
          data-testid="input-account-username"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profileUrl">Profile URL</Label>
        <Input
          id="profileUrl"
          type="url"
          value={profileUrl}
          onChange={(e) => setProfileUrl(e.target.value)}
          placeholder="https://linkedin.com/company/..."
          data-testid="input-profile-url"
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            checked={isDefault}
            onCheckedChange={setIsDefault}
            data-testid="switch-set-default"
          />
          <Label htmlFor="isDefault" className="text-sm">Set as default for {selectedPlatform?.name}</Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading || !accountName} data-testid="button-submit-add-account">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Icon className="h-4 w-4 mr-2" />
              Connect Account
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default ConnectedAccountsManager;
