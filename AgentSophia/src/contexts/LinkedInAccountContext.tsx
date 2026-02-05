import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { useWorkspace } from './WorkspaceContext';
import { useSocialConnections } from '@/hooks/use-social-connections';

interface LinkedInAccount {
  id: string;
  account_name: string;
  account_id?: string;
  profile_data?: {
    email?: string;
    picture?: string;
    sub?: string;
  };
  is_active: boolean;
}

interface LinkedInAccountContextValue {
  currentAccount: LinkedInAccount | null;
  currentAccountId: string | null;
  accounts: LinkedInAccount[];
  loading: boolean;
  setCurrentAccount: (account: LinkedInAccount) => void;
  refreshAccounts: () => void;
}

const STORAGE_KEY_PREFIX = 'current-linkedin-account-';

const LinkedInAccountContext = createContext<LinkedInAccountContextValue | undefined>(undefined);

export function LinkedInAccountProvider({ children }: { children: ReactNode }) {
  const { currentWorkspace } = useWorkspace();
  const { connections, isLoading, refetch } = useSocialConnections();
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);

  const linkedInAccounts: LinkedInAccount[] = useMemo(() => 
    connections
      .filter(c => c.platform === 'linkedin')
      .map(c => ({
        id: c.id,
        account_name: c.account_name || 'LinkedIn Account',
        account_id: c.account_id || undefined,
        profile_data: c.profile_data as LinkedInAccount['profile_data'],
        is_active: c.is_active,
      })),
    [connections]
  );

  const storageKey = currentWorkspace ? `${STORAGE_KEY_PREFIX}${currentWorkspace.id}` : null;

  const currentAccount = useMemo(() => 
    linkedInAccounts.find(a => a.id === currentAccountId) || null,
    [linkedInAccounts, currentAccountId]
  );

  useEffect(() => {
    if (!storageKey) {
      setCurrentAccountId(null);
      return;
    }

    if (linkedInAccounts.length === 0) {
      setCurrentAccountId(null);
      return;
    }

    const savedAccountId = localStorage.getItem(storageKey);
    const savedAccountExists = linkedInAccounts.some(a => a.id === savedAccountId);
    
    if (savedAccountId && savedAccountExists) {
      setCurrentAccountId(savedAccountId);
    } else {
      const firstActive = linkedInAccounts.find(a => a.is_active) || linkedInAccounts[0];
      setCurrentAccountId(firstActive.id);
      localStorage.setItem(storageKey, firstActive.id);
    }
  }, [linkedInAccounts, storageKey]);

  const setCurrentAccount = useCallback((account: LinkedInAccount) => {
    if (!account || !account.id) {
      console.warn('Attempted to set invalid LinkedIn account');
      return;
    }
    setCurrentAccountId(account.id);
    if (storageKey) {
      localStorage.setItem(storageKey, account.id);
    }
  }, [storageKey]);

  const refreshAccounts = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <LinkedInAccountContext.Provider value={{
      currentAccount,
      currentAccountId,
      accounts: linkedInAccounts,
      loading: isLoading,
      setCurrentAccount,
      refreshAccounts,
    }}>
      {children}
    </LinkedInAccountContext.Provider>
  );
}

export function useLinkedInAccount() {
  const context = useContext(LinkedInAccountContext);
  if (context === undefined) {
    throw new Error('useLinkedInAccount must be used within a LinkedInAccountProvider');
  }
  return context;
}
