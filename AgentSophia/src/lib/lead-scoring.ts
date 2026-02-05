import { supabase } from "@/integrations/supabase/client";

export interface LeadScoreFactors {
  emailOpens: number;
  emailClicks: number;
  emailReplies: number;
  meetingsBooked: number;
  responseTime: number; // hours
  lastActivity: number; // days ago
  totalInteractions: number;
  positiveIntent: number; // count of interested/meeting_request responses
  negativeIntent: number; // count of not_interested responses
}

export interface ScoreBreakdown {
  engagement: number;
  recency: number;
  intent: number;
  total: number;
  factors: LeadScoreFactors;
}

/**
 * Calculate lead score based on engagement and behavior
 * Returns a score from 0-100
 */
export function calculateLeadScore(factors: LeadScoreFactors): ScoreBreakdown {
  // Engagement Score (0-40 points)
  const engagementScore = Math.min(40, (
    (factors.emailOpens * 2) +
    (factors.emailClicks * 5) +
    (factors.emailReplies * 10) +
    (factors.meetingsBooked * 15) +
    (factors.totalInteractions * 1)
  ));

  // Recency Score (0-30 points)
  const recencyScore = (() => {
    if (factors.lastActivity === 0) return 30; // Today
    if (factors.lastActivity <= 1) return 25; // 1 day ago
    if (factors.lastActivity <= 3) return 20; // 3 days ago
    if (factors.lastActivity <= 7) return 15; // 1 week ago
    if (factors.lastActivity <= 14) return 10; // 2 weeks ago
    if (factors.lastActivity <= 30) return 5;  // 1 month ago
    return 0; // Stale lead
  })();

  // Intent Score (0-30 points)
  const intentScore = Math.min(30, (
    (factors.positiveIntent * 10) -
    (factors.negativeIntent * 5)
  ));

  // Response Time Bonus (0-10 points)
  const responseBonus = (() => {
    if (factors.responseTime === 0) return 0;
    if (factors.responseTime <= 1) return 10; // < 1 hour
    if (factors.responseTime <= 4) return 7;  // < 4 hours
    if (factors.responseTime <= 24) return 5; // < 1 day
    if (factors.responseTime <= 48) return 3; // < 2 days
    return 1;
  })();

  const total = Math.min(100, engagementScore + recencyScore + intentScore + responseBonus);

  return {
    engagement: engagementScore,
    recency: recencyScore,
    intent: intentScore,
    total: Math.round(total),
    factors
  };
}

/**
 * Calculate and update lead score for a contact
 */
export async function updateContactLeadScore(contactId: string, userId: string): Promise<ScoreBreakdown | null> {
  try {
    // Fetch contact interactions
    const { data: interactions, error: interactionsError } = await supabase
      .from('contact_interactions')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId);

    if (interactionsError) throw interactionsError;

    // Fetch campaign responses (for intent analysis)
    const { data: responses, error: responsesError } = await supabase
      .from('campaign_responses')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId);

    if (responsesError) throw responsesError;

    // Fetch agent activities
    const { data: activities, error: activitiesError } = await supabase
      .from('agent_activities')
      .select('*')
      .eq('contact_id', contactId)
      .eq('user_id', userId);

    if (activitiesError) throw activitiesError;

    // Calculate factors
    const emailReplies = responses?.length || 0;
    const meetingsBooked = activities?.filter(a => a.activity_type === 'meeting_scheduled').length || 0;
    const totalInteractions = (interactions?.length || 0) + emailReplies;

    const positiveIntent = responses?.filter(r => 
      r.intent_tag === 'interested' || r.intent_tag === 'meeting_request'
    ).length || 0;

    const negativeIntent = responses?.filter(r => 
      r.intent_tag === 'not_interested'
    ).length || 0;

    // Calculate last activity
    const allActivities = [
      ...(interactions || []).map(i => new Date(i.created_at)),
      ...(responses || []).map(r => new Date(r.created_at)),
      ...(activities || []).map(a => new Date(a.created_at))
    ];

    const lastActivity = allActivities.length > 0
      ? Math.floor((Date.now() - Math.max(...allActivities.map(d => d.getTime()))) / (1000 * 60 * 60 * 24))
      : 999;

    // Calculate average response time
    const responseTimes: number[] = [];
    responses?.forEach(response => {
      const sendActivity = activities?.find(a => 
        a.activity_type === 'outreach_sent' || a.activity_type === 'follow_up_sent'
      );
      if (sendActivity && response.responded_at) {
        const sentTime = new Date(sendActivity.created_at).getTime();
        const respondedTime = new Date(response.responded_at).getTime();
        const diffHours = (respondedTime - sentTime) / (1000 * 60 * 60);
        if (diffHours > 0) responseTimes.push(diffHours);
      }
    });

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    // Build factors object
    const factors: LeadScoreFactors = {
      emailOpens: 0, // TODO: Track email opens when engagement tracking is implemented
      emailClicks: 0, // TODO: Track email clicks
      emailReplies,
      meetingsBooked,
      responseTime: avgResponseTime,
      lastActivity,
      totalInteractions,
      positiveIntent,
      negativeIntent
    };

    // Calculate score
    const scoreBreakdown = calculateLeadScore(factors);

    // Update lead_scores table
    const { error: upsertError } = await supabase
      .from('lead_scores')
      .upsert({
        user_id: userId,
        contact_id: contactId,
        score: scoreBreakdown.total,
        score_breakdown: scoreBreakdown,
        last_activity_at: allActivities.length > 0 
          ? new Date(Math.max(...allActivities.map(d => d.getTime()))).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,contact_id'
      });

    if (upsertError) throw upsertError;

    // Also update the contact's score field
    const { error: contactError } = await supabase
      .from('contacts')
      .update({ score: scoreBreakdown.total })
      .eq('id', contactId)
      .eq('user_id', userId);

    if (contactError) throw contactError;

    return scoreBreakdown;

  } catch (error) {
    console.error('Error updating lead score:', error);
    return null;
  }
}

/**
 * Batch update scores for all contacts
 */
export async function recalculateAllLeadScores(userId: string): Promise<number> {
  try {
    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;

    let updated = 0;
    for (const contact of contacts || []) {
      const result = await updateContactLeadScore(contact.id, userId);
      if (result) updated++;
    }

    return updated;
  } catch (error) {
    console.error('Error recalculating all lead scores:', error);
    return 0;
  }
}

/**
 * Get lead quality tier based on score
 */
export function getLeadTier(score: number): {
  tier: 'hot' | 'warm' | 'cold' | 'inactive';
  color: string;
  label: string;
} {
  if (score >= 80) return { tier: 'hot', color: '#22c55e', label: 'Hot Lead' };
  if (score >= 60) return { tier: 'warm', color: '#f59e0b', label: 'Warm Lead' };
  if (score >= 30) return { tier: 'cold', color: '#3b82f6', label: 'Cold Lead' };
  return { tier: 'inactive', color: '#6b7280', label: 'Inactive' };
}
