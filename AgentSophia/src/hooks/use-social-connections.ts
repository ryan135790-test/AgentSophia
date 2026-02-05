import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SocialConnection, InsertSocialConnection } from "../../shared/schema";

export function useSocialConnections() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const { toast } = useToast();

  const { data: connections = [], isLoading, refetch } = useQuery<SocialConnection[]>({
    queryKey: ['/api/social-connections', workspaceId],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (!workspaceId) return [];
      
      // Query for connections that belong to this workspace ONLY
      // Strict workspace filtering to prevent cross-workspace leakage
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SocialConnection[];
    },
    enabled: !!user && !!workspaceId,
  });

  // Separate query for legacy connections (NULL workspace_id) that need migration
  const { data: legacyConnectionsData = [] } = useQuery<SocialConnection[]>({
    queryKey: ['/api/social-connections/legacy', user?.id],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");
      
      const { data, error } = await supabase
        .from('social_connections')
        .select('*')
        .eq('user_id', user.id)
        .is('workspace_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SocialConnection[];
    },
    enabled: !!user,
  });

  const connectMutation = useMutation({
    mutationFn: async (connection: InsertSocialConnection) => {
      if (!user) throw new Error("User not authenticated");
      if (!workspaceId) throw new Error("No workspace selected");

      const { data, error } = await supabase
        .from('social_connections')
        .insert({
          ...connection,
          user_id: user.id,
          workspace_id: workspaceId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-connections', workspaceId] });
      toast({
        title: "Account Connected",
        description: "Your social media account has been connected successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from('social_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-connections', workspaceId] });
      toast({
        title: "Account Disconnected",
        description: "Your social media account has been disconnected.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Disconnect Failed",
        description: error.message || "Failed to disconnect account. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('social_connections')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-connections', workspaceId] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update account status.",
        variant: "destructive",
      });
    },
  });

  // Mutation to migrate legacy connections (NULL workspace_id) to current workspace
  const migrateToWorkspaceMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (!workspaceId) throw new Error("No workspace selected");

      // Find connections with NULL workspace_id and update them
      const { error } = await supabase
        .from('social_connections')
        .update({ workspace_id: workspaceId })
        .eq('user_id', user.id)
        .is('workspace_id', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/social-connections', workspaceId] });
      queryClient.invalidateQueries({ queryKey: ['/api/social-connections/legacy', user?.id] });
      toast({
        title: "Connections Migrated",
        description: "Your existing connections have been assigned to this workspace.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Migration Failed",
        description: error.message || "Failed to migrate connections.",
        variant: "destructive",
      });
    },
  });

  // Check if there are legacy connections needing migration (from separate query)
  const legacyConnections = legacyConnectionsData;
  const hasLegacyConnections = legacyConnectionsData.length > 0;

  return {
    connections,
    isLoading,
    refetch,
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    toggleActive: toggleActiveMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    // Migration helpers
    hasLegacyConnections,
    legacyConnections,
    migrateToWorkspace: migrateToWorkspaceMutation.mutate,
    isMigrating: migrateToWorkspaceMutation.isPending,
  };
}
