import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  Coins, 
  Plus, 
  Minus, 
  RefreshCw, 
  Search,
  Building2,
  TrendingUp,
  AlertCircle,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WorkspaceCreditBalance {
  id: string;
  workspace_id: string;
  workspace_name?: string;
  total_credits: number;
  used_credits: number;
  reserved_credits: number;
  monthly_allocation: number;
  available_credits: number;
  allocation_reset_date: string | null;
  low_balance_threshold: number;
  low_balance_notified: boolean;
  created_at: string;
  updated_at: string;
}

export function CreditsManagement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceCreditBalance | null>(null);
  const [addCreditsOpen, setAddCreditsOpen] = useState(false);
  const [adjustCreditsOpen, setAdjustCreditsOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [initializeOpen, setInitializeOpen] = useState(false);
  const [initializeWorkspaceId, setInitializeWorkspaceId] = useState('');

  const { data: balances = [], isLoading, refetch } = useQuery<WorkspaceCreditBalance[]>({
    queryKey: ['/api/lookup-credits/admin/workspaces'],
  });

  const { data: workspaceCampaigns = [] } = useQuery<any[]>({
    queryKey: ['/api/campaigns', selectedWorkspace?.workspace_id],
    queryFn: () => fetch(`/api/campaigns?workspaceId=${selectedWorkspace?.workspace_id}`).then(r => r.json()),
    enabled: !!selectedWorkspace?.workspace_id && addCreditsOpen,
  });

  const addCreditsMutation = useMutation({
    mutationFn: async ({ workspaceId, amount, campaignId }: { workspaceId: string; amount: number; campaignId?: string }) => {
      return apiRequest(`/api/lookup-credits/admin/workspaces/${workspaceId}/add-credits`, {
        method: 'POST',
        body: JSON.stringify({ amount, campaignId: campaignId && campaignId !== 'none' ? campaignId : null }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Credits Added',
        description: `Added ${creditAmount} credits to workspace${selectedCampaignId && selectedCampaignId !== 'none' ? ' (assigned to campaign)' : ''}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lookup-credits/admin/workspaces'] });
      setAddCreditsOpen(false);
      setCreditAmount('');
      setSelectedCampaignId('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add credits',
        variant: 'destructive',
      });
    },
  });

  const adjustCreditsMutation = useMutation({
    mutationFn: async ({ workspaceId, amount, reason }: { workspaceId: string; amount: number; reason: string }) => {
      return apiRequest(`/api/lookup-credits/admin/workspaces/${workspaceId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ amount, reason: reason || 'Admin adjustment' }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Credits Adjusted',
        description: `Adjusted credits by ${creditAmount}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lookup-credits/admin/workspaces'] });
      setAdjustCreditsOpen(false);
      setCreditAmount('');
      setAdjustReason('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to adjust credits',
        variant: 'destructive',
      });
    },
  });

  const initializeWorkspaceMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      return apiRequest(`/api/lookup-credits/admin/initialize-workspace/${workspaceId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Workspace Initialized',
        description: 'Credit balance created for workspace with 1,000 initial credits',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/lookup-credits/admin/workspaces'] });
      setInitializeOpen(false);
      setInitializeWorkspaceId('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to initialize workspace',
        variant: 'destructive',
      });
    },
  });

  const handleAddCredits = () => {
    if (!selectedWorkspace || !creditAmount) return;
    addCreditsMutation.mutate({
      workspaceId: selectedWorkspace.workspace_id,
      amount: parseInt(creditAmount),
      campaignId: selectedCampaignId || undefined,
    });
  };

  const handleAdjustCredits = () => {
    if (!selectedWorkspace || !creditAmount) return;
    adjustCreditsMutation.mutate({
      workspaceId: selectedWorkspace.workspace_id,
      amount: parseInt(creditAmount),
      reason: adjustReason,
    });
  };

  const filteredBalances = balances.filter(b => 
    b.workspace_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.workspace_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCredits = balances.reduce((sum, b) => sum + (b.total_credits || 0), 0);
  const totalUsed = balances.reduce((sum, b) => sum + (b.used_credits || 0), 0);
  const lowBalanceCount = balances.filter(b => 
    (b.total_credits - b.used_credits - b.reserved_credits) < b.low_balance_threshold
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700" data-testid="card-total-workspaces">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Workspaces</p>
                <p className="text-2xl font-bold text-white" data-testid="text-total-workspaces">{balances.length}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700" data-testid="card-total-credits">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Total Credits Allocated</p>
                <p className="text-2xl font-bold text-white" data-testid="text-total-credits">{totalCredits.toLocaleString()}</p>
              </div>
              <Coins className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700" data-testid="card-credits-used">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Credits Used</p>
                <p className="text-2xl font-bold text-white" data-testid="text-credits-used">{totalUsed.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700" data-testid="card-low-balance-alerts">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Low Balance Alerts</p>
                <p className="text-2xl font-bold text-white" data-testid="text-low-balance-alerts">{lowBalanceCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Workspace Credit Balances</CardTitle>
              <CardDescription className="text-slate-400">
                Manage lookup credits for all workspaces
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setInitializeOpen(true)}
                className="border-slate-600"
                data-testid="button-add-workspace"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Workspace
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                className="border-slate-600"
                data-testid="button-refresh-credits"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by workspace ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-700/50 border-slate-600 text-white"
                data-testid="input-search-workspaces"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8" data-testid="status-loading">
              <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredBalances.length === 0 ? (
            <div className="text-center py-8" data-testid="status-empty">
              <p className="text-slate-400 mb-4">No workspace credit balances found</p>
              <p className="text-sm text-slate-500 mb-4">
                Workspaces need to be initialized before they appear here. Enter a workspace ID to create a credit balance.
              </p>
              <Button
                onClick={() => setInitializeOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="button-initialize-workspace"
              >
                <Plus className="h-4 w-4 mr-2" />
                Initialize Workspace
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-slate-700/50">
                    <TableHead className="text-slate-300">Workspace</TableHead>
                    <TableHead className="text-slate-300 text-right">Total</TableHead>
                    <TableHead className="text-slate-300 text-right">Used</TableHead>
                    <TableHead className="text-slate-300 text-right">Available</TableHead>
                    <TableHead className="text-slate-300 text-right">Monthly Alloc.</TableHead>
                    <TableHead className="text-slate-300">Status</TableHead>
                    <TableHead className="text-slate-300 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBalances.map((balance) => {
                    const available = balance.total_credits - balance.used_credits - balance.reserved_credits;
                    const isLow = available < balance.low_balance_threshold;
                    
                    return (
                      <TableRow 
                        key={balance.workspace_id} 
                        className="border-slate-700 hover:bg-slate-700/30"
                        data-testid={`row-workspace-${balance.workspace_id}`}
                      >
                        <TableCell className="text-slate-300">
                          <div>
                            <p className="font-medium text-white">{balance.workspace_name || 'Unknown'}</p>
                            <p className="text-xs font-mono text-slate-500">{balance.workspace_id.slice(0, 8)}...</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-white font-medium" data-testid={`text-total-${balance.workspace_id}`}>
                          {balance.total_credits.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-slate-300" data-testid={`text-used-${balance.workspace_id}`}>
                          {balance.used_credits.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-available-${balance.workspace_id}`}>
                          <span className={isLow ? 'text-orange-400 font-medium' : 'text-green-400'}>
                            {available.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-slate-300">
                          {balance.monthly_allocation.toLocaleString()}
                        </TableCell>
                        <TableCell data-testid={`status-balance-${balance.workspace_id}`}>
                          {isLow ? (
                            <Badge className="bg-orange-100 text-orange-800">Low Balance</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedWorkspace(balance);
                                setCreditAmount('');
                                setAddCreditsOpen(true);
                              }}
                              className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              data-testid={`button-add-credits-${balance.workspace_id}`}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedWorkspace(balance);
                                setCreditAmount('');
                                setAdjustReason('');
                                setAdjustCreditsOpen(true);
                              }}
                              className="text-slate-400 hover:text-slate-300 hover:bg-slate-500/10"
                              data-testid={`button-adjust-credits-${balance.workspace_id}`}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addCreditsOpen} onOpenChange={(open) => {
        setAddCreditsOpen(open);
        if (!open) {
          setSelectedCampaignId('');
        }
      }}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Add Credits</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add lookup credits to workspace {selectedWorkspace?.workspace_name || selectedWorkspace?.workspace_id.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Amount to Add</Label>
              <Input
                type="number"
                placeholder="Enter credit amount"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white"
                data-testid="input-add-credit-amount"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Assign to Campaign (Optional)
              </Label>
              <Select 
                value={selectedCampaignId} 
                onValueChange={setSelectedCampaignId}
              >
                <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white" data-testid="select-campaign">
                  <SelectValue placeholder="Select a campaign (optional)" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="none" className="text-slate-300">No specific campaign</SelectItem>
                  {workspaceCampaigns.map((campaign: any) => (
                    <SelectItem 
                      key={campaign.id} 
                      value={campaign.id}
                      className="text-slate-300"
                    >
                      {campaign.name || campaign.title || `Campaign ${campaign.id.slice(0, 8)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Credits will be added to the workspace balance. Campaign selection is for tracking purposes.
              </p>
            </div>
            <div className="text-sm text-slate-400" data-testid="text-current-balance">
              Current balance: {selectedWorkspace?.total_credits.toLocaleString() || 0} credits
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAddCreditsOpen(false)}
              className="border-slate-600"
              data-testid="button-cancel-add"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddCredits}
              disabled={!creditAmount || addCreditsMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-confirm-add-credits"
            >
              {addCreditsMutation.isPending ? 'Adding...' : 'Add Credits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustCreditsOpen} onOpenChange={setAdjustCreditsOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Adjust Credits</DialogTitle>
            <DialogDescription className="text-slate-400">
              Adjust credits for workspace {selectedWorkspace?.workspace_id.slice(0, 8)}... (use negative for removal)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Adjustment Amount</Label>
              <Input
                type="number"
                placeholder="Enter amount (negative to remove)"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white"
                data-testid="input-adjust-amount"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Reason (optional)</Label>
              <Input
                placeholder="Reason for adjustment"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white"
                data-testid="input-adjust-reason"
              />
            </div>
            <div className="text-sm text-slate-400" data-testid="text-adjust-current-balance">
              Current balance: {selectedWorkspace?.total_credits.toLocaleString() || 0} credits
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setAdjustCreditsOpen(false)}
              className="border-slate-600"
              data-testid="button-cancel-adjust"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAdjustCredits}
              disabled={!creditAmount || adjustCreditsMutation.isPending}
              data-testid="button-confirm-adjust-credits"
            >
              {adjustCreditsMutation.isPending ? 'Adjusting...' : 'Adjust Credits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={initializeOpen} onOpenChange={setInitializeOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Initialize Workspace Credits</DialogTitle>
            <DialogDescription className="text-slate-400">
              Enter a workspace ID to create a credit balance with 1,000 initial credits
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Workspace ID</Label>
              <Input
                placeholder="Enter workspace UUID (e.g., 3fce90b1-4e61-4738-...)"
                value={initializeWorkspaceId}
                onChange={(e) => setInitializeWorkspaceId(e.target.value)}
                className="bg-slate-700/50 border-slate-600 text-white font-mono"
                data-testid="input-initialize-workspace-id"
              />
            </div>
            <div className="text-sm text-slate-500">
              You can find workspace IDs in the Workspaces tab of this admin panel.
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setInitializeOpen(false)}
              className="border-slate-600"
              data-testid="button-cancel-initialize"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => initializeWorkspaceMutation.mutate(initializeWorkspaceId)}
              disabled={!initializeWorkspaceId || initializeWorkspaceMutation.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-confirm-initialize"
            >
              {initializeWorkspaceMutation.isPending ? 'Initializing...' : 'Initialize'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
