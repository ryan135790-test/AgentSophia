import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { CampaignResponse, InsertCampaignResponse, insertCampaignResponseSchema } from "../../shared/schema";
import { useToast } from "@/hooks/use-toast";

interface InboxFilters {
  channel?: string;
  intent_tag?: string;
  is_read?: boolean;
  campaign_id?: string;
}

export function useInboxResponses(filters?: InboxFilters) {
  return useQuery({
    queryKey: ["/api/inbox", filters],
    queryFn: async () => {
      try {
        let query = supabase
          .from("campaign_responses")
          .select("*")
          .order("responded_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (filters?.channel) {
          query = query.eq("channel", filters.channel);
        }
        if (filters?.intent_tag) {
          query = query.eq("intent_tag", filters.intent_tag);
        }
        if (filters?.is_read !== undefined) {
          query = query.eq("is_read", filters.is_read);
        }
        if (filters?.campaign_id) {
          query = query.eq("campaign_id", filters.campaign_id);
        }

        const { data, error } = await query;

        // If table doesn't exist yet, return empty array instead of erroring
        if (error && error.code === '42P01') {
          console.warn('campaign_responses table not found. Run the migration to enable the inbox.');
          return [] as CampaignResponse[];
        }
        
        // Return empty array for permission errors (no RLS access)
        if (error && error.code === '42501') {
          console.warn('No access to campaign_responses. Check RLS policies.');
          return [] as CampaignResponse[];
        }
        
        if (error) {
          console.error('Inbox query error:', error);
          throw error;
        }
        return data as CampaignResponse[];
      } catch (err) {
        console.error('Inbox fetch error:', err);
        // Return empty array on any error to avoid breaking the UI
        return [] as CampaignResponse[];
      }
    },
    retry: 1,
  });
}

export function useInboxResponse(id: string) {
  return useQuery({
    queryKey: ["/api/inbox", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_responses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as CampaignResponse;
    },
    enabled: !!id,
  });
}

export function useCreateResponse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (response: InsertCampaignResponse) => {
      if (!user) throw new Error("User not authenticated");
      
      const validated = insertCampaignResponseSchema.parse(response);
      
      const { data, error } = await supabase
        .from("campaign_responses")
        .insert([{
          ...validated,
          user_id: user.id
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      toast({
        title: "Success",
        description: "Response received",
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

export function useUpdateResponseIntent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      intent_tag, 
      confidence_score 
    }: { 
      id: string; 
      intent_tag: string; 
      confidence_score?: number;
    }) => {
      const updateData: any = { intent_tag };
      if (confidence_score !== undefined) {
        updateData.confidence_score = confidence_score;
      }

      const { data, error } = await supabase
        .from("campaign_responses")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      toast({
        title: "Success",
        description: "Intent updated successfully",
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

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_read }: { id: string; is_read: boolean }) => {
      const { data, error } = await supabase
        .from("campaign_responses")
        .update({ is_read })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
    },
  });
}

export function useClassifyIntent() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      message_content, 
      channel, 
      sender_name 
    }: { 
      message_content: string; 
      channel?: string; 
      sender_name?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Not authenticated");
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/classify-intent`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message_content, channel, sender_name }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to classify intent");
      }

      return await response.json();
    },
    onError: (error: Error) => {
      toast({
        title: "Classification Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteResponse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaign_responses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      toast({
        title: "Success",
        description: "Response deleted successfully",
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
