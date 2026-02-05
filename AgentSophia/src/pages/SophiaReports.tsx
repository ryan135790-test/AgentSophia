import { SophiaReportingDashboard } from '@/components/agent-sophia/sophia-reporting-dashboard';
import { useAuth } from '@/components/auth/auth-provider';

export default function SophiaReports() {
  const { user } = useAuth();
  const workspaceId = user?.user_metadata?.workspace_id;

  return (
    <div className="p-6">
      <SophiaReportingDashboard workspaceId={workspaceId} />
    </div>
  );
}
