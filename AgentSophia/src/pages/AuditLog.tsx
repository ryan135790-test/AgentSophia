import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Download,
  User,
  Mail,
  Settings,
  Shield,
  Database,
  Clock,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";

interface AuditLogEntry {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

const actionIcons: Record<string, typeof User> = {
  'user': User,
  'campaign': Mail,
  'settings': Settings,
  'security': Shield,
  'data': Database,
};

const actionColors: Record<string, string> = {
  'create': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'update': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  'delete': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  'login': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  'export': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'view': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export default function AuditLog() {
  const { session } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery<{ logs: AuditLogEntry[]; total: number }>({
    queryKey: ['/api/audit-logs', currentWorkspace?.id, page, search, actionFilter, resourceFilter],
    enabled: !!currentWorkspace && !!session,
  });

  const isDemo = currentWorkspace?.id === 'demo';
  
  const demoLogs: AuditLogEntry[] = isDemo ? [
    {
      id: '1',
      user_id: 'u1',
      user_email: 'admin@example.com',
      user_name: 'Admin User',
      action: 'create',
      resource_type: 'campaign',
      resource_id: 'c1',
      details: { name: 'Q1 Outreach Campaign' },
      ip_address: '192.168.1.1',
      user_agent: 'Chrome/120.0',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      user_id: 'u1',
      user_email: 'admin@example.com',
      user_name: 'Admin User',
      action: 'update',
      resource_type: 'settings',
      resource_id: 's1',
      details: { field: 'email_provider', old: 'resend', new: 'sendgrid' },
      ip_address: '192.168.1.1',
      user_agent: 'Chrome/120.0',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: '3',
      user_id: 'u2',
      user_email: 'user@example.com',
      user_name: 'Team Member',
      action: 'export',
      resource_type: 'data',
      resource_id: 'd1',
      details: { type: 'contacts', format: 'csv', count: 1250 },
      ip_address: '192.168.1.2',
      user_agent: 'Firefox/121.0',
      created_at: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: '4',
      user_id: 'u1',
      user_email: 'admin@example.com',
      user_name: 'Admin User',
      action: 'delete',
      resource_type: 'user',
      resource_id: 'u3',
      details: { email: 'removed@example.com' },
      ip_address: '192.168.1.1',
      user_agent: 'Chrome/120.0',
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: '5',
      user_id: 'u2',
      user_email: 'user@example.com',
      user_name: 'Team Member',
      action: 'login',
      resource_type: 'security',
      resource_id: 'auth1',
      details: { method: 'password', success: true },
      ip_address: '192.168.1.2',
      user_agent: 'Safari/17.0',
      created_at: new Date(Date.now() - 172800000).toISOString()
    }
  ] : [];

  const logs = data?.logs || demoLogs;
  const total = data?.total || demoLogs.length;

  const getActionIcon = (resourceType: string) => {
    const Icon = actionIcons[resourceType] || ClipboardList;
    return Icon;
  };

  const handleExportLogs = () => {
    const csvContent = logs.map(log => 
      `${log.created_at},${log.user_email},${log.action},${log.resource_type},${log.resource_id},${log.ip_address}`
    ).join('\n');
    
    const blob = new Blob([`Date,User,Action,Resource Type,Resource ID,IP Address\n${csvContent}`], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Track all user actions and system changes for compliance
          </p>
        </div>
        <Button onClick={handleExportLogs} variant="outline" data-testid="button-export-logs">
          <Download className="mr-2 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user, action, or resource..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-logs"
                />
              </div>
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-action-filter">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="export">Export</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-resource-filter">
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="campaign">Campaigns</SelectItem>
                <SelectItem value="settings">Settings</SelectItem>
                <SelectItem value="data">Data</SelectItem>
                <SelectItem value="security">Security</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>
            Showing {logs.length} of {total} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const Icon = getActionIcon(log.resource_type);
                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    data-testid={`audit-log-${log.id}`}
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {log.user_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{log.user_name}</span>
                        <Badge className={actionColors[log.action] || actionColors.view}>
                          {log.action}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Icon className="h-3 w-3" />
                          {log.resource_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {log.user_email} • {log.ip_address}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div className="text-right text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(log.created_at), 'MMM d, h:mm a')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {page} of {Math.ceil(total / limit)}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                data-testid="button-prev-page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / limit)}
                data-testid="button-next-page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
