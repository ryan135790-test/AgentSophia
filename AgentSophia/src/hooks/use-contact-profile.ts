import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Contact, CampaignResponse } from "../../shared/schema";

export interface ContactProfile extends Contact {
  all_responses: CampaignResponse[];
  total_responses: number;
  interested_responses: number;
  last_response_date: string | null;
}

export function useContactProfile(contactId: string | null | undefined) {
  return useQuery({
    queryKey: ['/api/contacts/profile', contactId],
    queryFn: async () => {
      if (!contactId) return null;

      // Fetch contact from database
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

      if (contactError) throw contactError;
      if (!contact) return null;

      // Fetch all responses from this contact
      const { data: responses, error: responsesError } = await supabase
        .from('campaign_responses')
        .select('*')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false});

      if (responsesError) throw responsesError;

      const allResponses = (responses || []) as CampaignResponse[];
      const interestedResponses = allResponses.filter(r => r.intent_tag === 'interested');
      const lastResponse = allResponses.length > 0 ? allResponses[0] : null;

      const profile: ContactProfile = {
        ...contact as Contact,
        all_responses: allResponses,
        total_responses: allResponses.length,
        interested_responses: interestedResponses.length,
        last_response_date: lastResponse?.created_at || null,
      };

      return profile;
    },
    enabled: !!contactId,
  });
}
