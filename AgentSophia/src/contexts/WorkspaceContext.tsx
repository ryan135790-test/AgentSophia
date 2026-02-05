import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { supabase } from '@/integrations/supabase/client';

interface Workspace {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
}

interface WorkspaceContextValue {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  isSuperAdmin: boolean;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
}

const STORAGE_KEY = 'current-workspace-id';

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, session, isSuperAdmin: authIsSuperAdmin } = useAuth();
  const [currentWorkspace, setCurrentWorkspaceState] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const fetchWorkspaces = async () => {
    if (!user || !session?.access_token) {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setLoading(false);
      setIsSuperAdmin(false);
      return;
    }

    try {
      console.log('[WorkspaceContext] Fetching workspaces via API for user:', user.id, user.email);
      
      // Use the server API which properly handles super admin access
      const response = await fetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch workspaces');
      }
      
      const allWorkspaces: Workspace[] = await response.json();
      
      // Check super admin status from auth context
      setIsSuperAdmin(authIsSuperAdmin);
      console.log('[WorkspaceContext] Fetched workspaces:', allWorkspaces.length, 'isSuperAdmin:', authIsSuperAdmin);
      console.log('[WorkspaceContext] Workspace names:', allWorkspaces.map(w => w.name));
      
      setWorkspaces(allWorkspaces);

      const savedWorkspaceId = localStorage.getItem(STORAGE_KEY);
      const savedWorkspace = allWorkspaces.find(w => w.id === savedWorkspaceId);
      
      if (savedWorkspace) {
        setCurrentWorkspaceState(savedWorkspace);
      } else if (allWorkspaces.length > 0) {
        setCurrentWorkspaceState(allWorkspaces[0]);
        localStorage.setItem(STORAGE_KEY, allWorkspaces[0].id);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const setCurrentWorkspace = (workspace: Workspace) => {
    if (!workspace || !workspace.id) {
      console.warn('Attempted to set invalid workspace');
      return;
    }
    setCurrentWorkspaceState(workspace);
    localStorage.setItem(STORAGE_KEY, workspace.id);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user, session, authIsSuperAdmin]);

  return (
    <WorkspaceContext.Provider value={{
      currentWorkspace,
      workspaces,
      loading,
      isSuperAdmin,
      setCurrentWorkspace,
      refreshWorkspaces: fetchWorkspaces
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
