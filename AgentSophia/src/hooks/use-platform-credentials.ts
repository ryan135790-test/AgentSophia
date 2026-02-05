import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/auth-provider";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SocialPlatformCredentials, InsertSocialPlatformCredentials } from "../../shared/schema";

type Platform = 'linkedin' | 'facebook' | 'twitter' | 'instagram' | 'tiktok';

export function usePlatformCredentials() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: credentials = [], isLoading } = useQuery<SocialPlatformCredentials[]>({
    queryKey: ['/api/platform-credentials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('social_platform_credentials')
        .select('*')
        .order('platform', { ascending: true });

      if (error) {
        if (error.code === '42P01') {
          return [];
        }
        throw error;
      }
      return data as SocialPlatformCredentials[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (credential: InsertSocialPlatformCredentials) => {
      const existingCred = credentials.find(c => c.platform === credential.platform);
      
      if (existingCred) {
        const { data, error } = await supabase
          .from('social_platform_credentials')
          .update({
            client_id: credential.client_id,
            client_secret: credential.client_secret,
            redirect_uri: credential.redirect_uri,
            additional_config: credential.additional_config,
            is_configured: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingCred.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('social_platform_credentials')
          .insert({
            ...credential,
            is_configured: true,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-credentials'] });
      toast({
        title: "Credentials Saved",
        description: `${variables.platform.charAt(0).toUpperCase() + variables.platform.slice(1)} API credentials have been saved.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save credentials. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (platform: Platform) => {
      const { error } = await supabase
        .from('social_platform_credentials')
        .delete()
        .eq('platform', platform);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platform-credentials'] });
      toast({
        title: "Credentials Removed",
        description: "Platform credentials have been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to remove credentials.",
        variant: "destructive",
      });
    },
  });

  const getCredentials = (platform: Platform) => {
    return credentials.find(c => c.platform === platform);
  };

  const isConfigured = (platform: Platform) => {
    const cred = getCredentials(platform);
    return cred?.is_configured ?? false;
  };

  return {
    credentials,
    isLoading,
    save: saveMutation.mutate,
    remove: deleteMutation.mutate,
    getCredentials,
    isConfigured,
    isSaving: saveMutation.isPending,
    isRemoving: deleteMutation.isPending,
  };
}
