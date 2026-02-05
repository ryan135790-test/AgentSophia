import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  RotateCw, 
  TrendingUp, 
  Shield, 
  CheckCircle, 
  AlertTriangle,
  Zap,
  Activity
} from 'lucide-react';

interface AccountStats {
  id: string;
  name: string;
  connectionsSent: number;
  connectionLimit: number;
  messagesSent: number;
  messageLimit: number;
  acceptanceRate: number;
  safetyScore: number;
  isWarmedUp: boolean;
}

interface MultiSenderStats {
  accounts: AccountStats[];
  totalCapacity: {
    totalConnectionCapacity: number;
    totalMessageCapacity: number;
    activeAccounts: number;
    utilizationPercent: number;
  };
}

interface LinkedInMultiSenderProps {
  workspaceId?: string;
}

export function LinkedInMultiSender({ workspaceId }: LinkedInMultiSenderProps) {
  const [stats] = useState<MultiSenderStats>({
    accounts: [
      {
        id: '1',
        name: 'John Smith (Sales)',
        connectionsSent: 25,
        connectionLimit: 50,
        messagesSent: 40,
        messageLimit: 80,
        acceptanceRate: 58,
        safetyScore: 92,
        isWarmedUp: true,
      },
      {
        id: '2',
        name: 'Sarah Johnson (SDR)',
        connectionsSent: 18,
        connectionLimit: 50,
        messagesSent: 22,
        messageLimit: 80,
        acceptanceRate: 65,
        safetyScore: 88,
        isWarmedUp: true,
      },
      {
        id: '3',
        name: 'Mike Chen (BDR)',
        connectionsSent: 8,
        connectionLimit: 25,
        messagesSent: 12,
        messageLimit: 40,
        acceptanceRate: 72,
        safetyScore: 75,
        isWarmedUp: false,
      },
    ],
    totalCapacity: {
      totalConnectionCapacity: 76,
      totalMessageCapacity: 126,
      activeAccounts: 3,
      utilizationPercent: 41,
    },
  });

  const getSafetyColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSafetyBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-100 text-green-800">Safe</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-100 text-yellow-800">Caution</Badge>;
    return <Badge className="bg-red-100 text-red-800">At Risk</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-active-accounts">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Accounts</p>
                <p className="text-2xl font-bold">{stats.totalCapacity.activeAccounts}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-connection-capacity">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Connection Capacity</p>
                <p className="text-2xl font-bold">{stats.totalCapacity.totalConnectionCapacity}/day</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-message-capacity">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Message Capacity</p>
                <p className="text-2xl font-bold">{stats.totalCapacity.totalMessageCapacity}/day</p>
              </div>
              <Activity className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-utilization">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Utilization</p>
                <p className="text-2xl font-bold">{stats.totalCapacity.utilizationPercent}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-account-rotation">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <RotateCw className="w-5 h-5" />
                Multi-Sender Account Rotation
              </CardTitle>
              <CardDescription>
                Rotate campaigns across multiple accounts to bypass daily limits
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" data-testid="btn-add-account">
              Add Account
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.accounts.map((account) => (
              <div 
                key={account.id} 
                className="p-4 border rounded-lg space-y-3"
                data-testid={`account-row-${account.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                      {account.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{account.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {account.isWarmedUp ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Warmed Up
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-yellow-600">
                            <AlertTriangle className="w-3 h-3" />
                            Warming Up
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getSafetyBadge(account.safetyScore)}
                    <div className={`flex items-center gap-1 ${getSafetyColor(account.safetyScore)}`}>
                      <Shield className="w-4 h-4" />
                      <span className="text-sm font-medium">{account.safetyScore}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Connections</span>
                      <span>{account.connectionsSent}/{account.connectionLimit}</span>
                    </div>
                    <Progress 
                      value={(account.connectionsSent / account.connectionLimit) * 100} 
                      className="h-2"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Messages</span>
                      <span>{account.messagesSent}/{account.messageLimit}</span>
                    </div>
                    <Progress 
                      value={(account.messagesSent / account.messageLimit) * 100} 
                      className="h-2"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Acceptance Rate: <span className="font-medium text-foreground">{account.acceptanceRate}%</span>
                  </span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" data-testid={`btn-pause-${account.id}`}>
                      Pause
                    </Button>
                    <Button variant="ghost" size="sm" data-testid={`btn-settings-${account.id}`}>
                      Settings
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How Multi-Sender Rotation Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-medium mb-2">Connect Multiple Accounts</h4>
              <p className="text-sm text-muted-foreground">
                Link all your team's LinkedIn accounts to a single campaign
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <RotateCw className="w-6 h-6 text-green-600" />
              </div>
              <h4 className="font-medium mb-2">Automatic Rotation</h4>
              <p className="text-sm text-muted-foreground">
                System distributes sends across accounts based on capacity and safety
              </p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <h4 className="font-medium mb-2">Bypass Limits</h4>
              <p className="text-sm text-muted-foreground">
                Send 100+ connections daily by combining account limits safely
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
