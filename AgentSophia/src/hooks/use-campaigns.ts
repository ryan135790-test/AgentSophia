import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { Campaign, InsertCampaign, insertCampaignSchema } from "../../shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useCampaigns(workspaceId?: string) {
  return useQuery({
    queryKey: ["/api/campaigns", workspaceId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (workspaceId) {
        query = query.eq("workspace_id", workspaceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Campaign[];
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ["/api/campaigns", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Campaign;
    },
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (campaign: InsertCampaign) => {
      if (!user) throw new Error("User not authenticated");
      
      const validated = insertCampaignSchema.parse(campaign);
      
      const { data, error} = await (supabase as any)
        .from("campaigns")
        .insert({
          ...validated,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      toast({
        title: "Success",
        description: "Campaign created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCampaign(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertCampaign> }) => {
      // Use API endpoint for updates (handles proper authorization)
      return apiRequest(`/api/campaigns/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'campaigns'] });
      }
      toast({
        title: "Success",
        description: "Campaign updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteCampaign(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Use API endpoint which handles cascade delete of related records
      if (workspaceId) {
        return apiRequest(`/api/workspaces/${workspaceId}/campaigns/${id}`, {
          method: 'DELETE',
        });
      } else {
        return apiRequest(`/api/campaigns/${id}`, {
          method: 'DELETE',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      if (workspaceId) {
        queryClient.invalidateQueries({ queryKey: ['/api/workspaces', workspaceId, 'campaigns'] });
      }
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

// Dashboard stats hook
export function useCampaignStats() {
  return useQuery({
    queryKey: ["/api/campaigns/stats"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("campaigns")
        .select("status, sent_count, opened_count, clicked_count, replied_count");

      if (error) throw error;

      // Calculate totals
      const stats = {
        total: data?.length || 0,
        active: data?.filter((c: any) => c.status === 'active').length || 0,
        totalSent: data?.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0) || 0,
        totalOpened: data?.reduce((sum: number, c: any) => sum + (c.opened_count || 0), 0) || 0,
        totalClicked: data?.reduce((sum: number, c: any) => sum + (c.clicked_count || 0), 0) || 0,
        totalReplied: data?.reduce((sum: number, c: any) => sum + (c.replied_count || 0), 0) || 0,
      };

      return stats;
    },
  });
}
