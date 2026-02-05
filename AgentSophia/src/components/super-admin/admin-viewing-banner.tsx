import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/auth/auth-provider';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft, X } from 'lucide-react';

export function AdminViewingBanner() {
  const { isSuperAdmin, user } = useAuth();
  const { currentWorkspace, workspaces } = useWorkspace();
  const navigate = useNavigate();
  const [isViewingCustomer, setIsViewingCustomer] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin || !currentWorkspace || !user) {
      setIsViewingCustomer(false);
      return;
    }

    const userOwnedWorkspaces = workspaces.filter(w => w.owner_id === user.id);
    const isOwnWorkspace = userOwnedWorkspaces.some(w => w.id === currentWorkspace.id);
    
    setIsViewingCustomer(!isOwnWorkspace && workspaces.length > 0);
  }, [isSuperAdmin, currentWorkspace, workspaces, user]);

  const handleReturnToAdmin = () => {
    navigate('/super-admin');
  };

  if (!isSuperAdmin || !isViewingCustomer || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 flex items-center justify-between shadow-lg z-50">
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5" />
        <span className="font-medium">
          Super Admin Mode: Viewing workspace "{currentWorkspace?.name}"
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleReturnToAdmin}
          className="bg-white/20 hover:bg-white/30 text-white border-0"
          data-testid="button-return-to-admin"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Return to Super Admin
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setDismissed(true)}
          className="hover:bg-white/20 text-white h-8 w-8 p-0"
          data-testid="button-dismiss-banner"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
