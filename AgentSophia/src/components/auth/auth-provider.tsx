import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  company: string | null;
  created_at: string;
  updated_at: string;
}

interface UserRole {
  role: 'super_admin' | 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  refreshSuperAdminStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdminFromDb, setIsSuperAdminFromDb] = useState(false);

  const checkSuperAdminStatus = useCallback(async (accessToken: string) => {
    try {
      const response = await fetch('/api/super-admin/check', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (!response.ok) {
        // If unauthorized or error, default to not super admin
        setIsSuperAdminFromDb(false);
        return;
      }
      
      const data = await response.json();
      setIsSuperAdminFromDb(data.isSuperAdmin === true);
    } catch (error) {
      console.error('Error checking super admin status:', error);
      setIsSuperAdminFromDb(false);
    }
  }, []);

  const fetchProfile = async (userId: string, accessToken?: string) => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleData) {
        setUserRole(roleData);
      }

      // Check super admin status from database
      if (accessToken) {
        await checkSuperAdminStatus(accessToken);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer profile fetching to avoid blocking auth state changes
          setTimeout(() => {
            fetchProfile(session.user.id, session.access_token);
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
          setIsSuperAdminFromDb(false);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id, session.access_token);
        }, 0);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setIsSuperAdminFromDb(false);
    await supabase.auth.signOut();
  };

  const refreshSuperAdminStatus = useCallback(async () => {
    if (session?.access_token) {
      await checkSuperAdminStatus(session.access_token);
    }
  }, [session, checkSuperAdminStatus]);

  const isAdmin = userRole?.role === 'admin' || userRole?.role === 'super_admin';
  
  // Use database check for super admin status
  const isSuperAdmin = isSuperAdminFromDb || userRole?.role === 'super_admin' || userRole?.role === 'admin';

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      userRole,
      loading,
      signOut,
      isAdmin,
      isSuperAdmin,
      refreshSuperAdminStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}