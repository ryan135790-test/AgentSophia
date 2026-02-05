import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDashboardStats() {
  return useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: async () => {
      // Fetch all data in parallel
      const [contactsResult, campaignsResult, configurationsResult] = await Promise.all([
        supabase.from("contacts").select("id, stage, created_at"),
        (supabase as any).from("campaigns").select("id, status, sent_count, opened_count, clicked_count, replied_count"),
        supabase.from("ai_configurations").select("id, is_active"),
      ]);

      if (contactsResult.error) throw contactsResult.error;
      if (campaignsResult.error) throw campaignsResult.error;
      if (configurationsResult.error) throw configurationsResult.error;

      const contacts = contactsResult.data || [];
      const campaigns = campaignsResult.data || [];
      const configurations = configurationsResult.data || [];

      // Calculate stats
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const totalLeads = contacts.length;
      const newLeadsThisMonth = contacts.filter(
        (c: any) => new Date(c.created_at) >= thirtyDaysAgo
      ).length;
      const qualifiedLeads = contacts.filter((c: any) => c.stage === 'qualified').length;
      const convertedLeads = contacts.filter((c: any) => c.stage === 'converted').length;

      const activeCampaigns = campaigns.filter((c: any) => c.status === 'active').length;
      const totalSent = campaigns.reduce((sum: number, c: any) => sum + (c.sent_count || 0), 0);
      const totalOpened = campaigns.reduce((sum: number, c: any) => sum + (c.opened_count || 0), 0);
      const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

      const totalClicked = campaigns.reduce((sum: number, c: any) => sum + (c.clicked_count || 0), 0);
      const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;

      const totalReplied = campaigns.reduce((sum: number, c: any) => sum + (c.replied_count || 0), 0);
      const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;

      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      const activeAutomations = configurations.filter((c: any) => c.is_active).length;

      return {
        totalLeads,
        newLeadsThisMonth,
        qualifiedLeads,
        convertedLeads,
        conversionRate,
        activeCampaigns,
        totalCampaigns: campaigns.length,
        totalSent,
        totalOpened,
        openRate,
        totalClicked,
        clickRate,
        totalReplied,
        replyRate,
        activeAutomations,
        totalAutomations: configurations.length,
      };
    },
  });
}
