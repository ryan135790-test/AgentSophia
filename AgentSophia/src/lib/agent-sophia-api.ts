import { supabase } from '@/integrations/supabase/client'

export interface AgentConfig {
  id: string
  user_id: string
  is_active: boolean
  autonomy_level: 'manual' | 'semi_autonomous' | 'fully_autonomous'
  working_hours: {
    timezone: string
    start_time: string
    end_time: string
    days: string[]
  }
  daily_limits: {
    max_messages_per_day: number
    max_follow_ups_per_contact: number
    enable_gradual_warmup: boolean
  }
  decision_criteria: {
    min_lead_score: number
    max_follow_ups: number
    auto_respond_intents: string[]
    auto_book_meeting_intents: string[]
    escalate_to_human_intents: string[]
    campaign_automation?: {
      auto_create: boolean
      default_channels: string[]
      daily_campaign_limit: number
      max_leads_per_campaign: number
    }
  }
  meeting_booking: {
    enabled: boolean
    calendar_link: string
    auto_book_qualified_leads: boolean
  }
  personalization_settings: {
    tone: string
    include_sender_name: boolean
    signature: string
  }
  user_profile?: {
    full_name?: string | null
    title?: string | null
    email?: string | null
    phone?: string | null
  } | null
  company_info?: {
    company_name?: string | null
    industry?: string | null
    website?: string | null
    services_description?: string | null
    value_propositions?: string[]
  } | null
  auto_check_enabled?: boolean
  last_checked_at?: string | null
  autonomy_policies?: {
    auto_reply_enabled: boolean
    confidence_threshold: number
    max_daily_auto_replies: number
    meeting_auto_accept: {
      internal: boolean
      external: boolean
    }
    sensitive_keywords: string[]
    spam_auto_archive: boolean
    working_hours_only: boolean
    working_hours?: {
      start_time: string
      end_time: string
      timezone: string
      days: string[]
    }
  } | null
  auto_replies_today?: number
  last_auto_reply_reset?: string | null
  sync_o365_contacts?: boolean
  meeting_settings?: {
    default_duration: number
    buffer_time: number
    max_per_day: number
    calendly_link?: string
    cal_com_link?: string
  }
  created_at?: string
  updated_at?: string
}

export interface AgentActivity {
  id: string
  user_id: string
  contact_id: string
  campaign_id?: string
  activity_type: string
  action_taken: string
  message_content?: string
  outcome: 'success' | 'failed' | 'pending'
  outcome_details?: string
  metadata?: any
  created_at: string
}

export interface AgentDecision {
  id: string
  user_id: string
  contact_id: string
  response_id?: string
  decision_type: string
  reasoning: string
  confidence_score: number
  input_data: any
  recommended_action: string
  human_override: boolean
  created_at: string
}

export interface DecisionResult {
  decision_type: 'send_follow_up' | 'schedule_meeting' | 'escalate_to_human' | 'disqualify_lead' | 'continue_nurture' | 'pause_outreach'
  reasoning: string
  confidence_score: number
  recommended_action: string
  generated_content?: string
  metadata?: Record<string, any>
}

export interface ProspectingResult {
  qualified: any[]
  disqualified: any[]
  stats: {
    total: number
    qualified: number
    disqualified: number
  }
}

export interface FollowUpResult {
  content: string
  engagement_score: number
  metadata: {
    follow_up_number: number
  }
}

// Get agent configuration
export async function getAgentConfig(): Promise<AgentConfig | null> {
  const { data, error } = await supabase
    .from('agent_configs')
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // No config found
    throw error
  }

  return data
}

// Save agent configuration
export async function saveAgentConfig(config: Partial<AgentConfig>): Promise<AgentConfig> {
  const { data: existingConfig } = await supabase
    .from('agent_configs')
    .select('id')
    .single()

  if (existingConfig) {
    // Update existing
    const { data, error } = await supabase
      .from('agent_configs')
      .update(config)
      .eq('id', existingConfig.id)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    // Insert new
    const { data: userData } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('agent_configs')
      .insert({
        user_id: userData.user?.id,
        ...config
      })
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// Get agent activities
export async function getAgentActivities(limit = 50): Promise<AgentActivity[]> {
  const { data, error } = await supabase
    .from('agent_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

// Get agent decisions
export async function getAgentDecisions(limit = 50): Promise<AgentDecision[]> {
  const { data, error } = await supabase
    .from('agent_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data || []
}

// Call decision engine
export async function makeDecision(
  contactId: string,
  responseId?: string,
  conversationHistory?: any[],
  campaignContext?: any
): Promise<DecisionResult> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-sophia-decision`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactId,
        responseId,
        conversationHistory: conversationHistory || [],
        campaignContext
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Decision engine failed')
  }

  const result = await response.json()
  return result.decision
}

// Call prospecting engine
export async function runProspecting(
  contactIds: string[],
  criteria?: {
    industries?: string[]
    jobTitles?: string[]
    minLeadScore?: number
    tags?: string[]
    excludeTags?: string[]
  }
): Promise<ProspectingResult> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-sophia-prospect`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactIds,
        criteria
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Prospecting engine failed')
  }

  const result = await response.json()
  return result
}

// Call follow-up engine
export async function generateFollowUp(
  contactId: string,
  conversationHistory: any[]
): Promise<FollowUpResult> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-sophia-followup`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contactId,
        conversationHistory
      })
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Follow-up engine failed')
  }

  const result = await response.json()
  return result
}

// Toggle agent active state
export async function toggleAgentActive(isActive: boolean): Promise<void> {
  const { data: existingConfig } = await supabase
    .from('agent_configs')
    .select('id')
    .single()

  if (!existingConfig) {
    throw new Error('No agent configuration found. Please configure Agent Sophia first.')
  }

  const { error } = await supabase
    .from('agent_configs')
    .update({ is_active: isActive })
    .eq('id', existingConfig.id)

  if (error) throw error
}

// Get agent activity stats for current user only
export async function getAgentStats(): Promise<{
  prospected: number
  outreach_sent: number
  responses_analyzed: number
  meetings_scheduled: number
  leads_qualified: number
}> {
  // Get current user's session
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    throw new Error('Not authenticated')
  }

  // Get activities for CURRENT USER ONLY (security critical!)
  const { data: activities, error } = await supabase
    .from('agent_activities')
    .select('activity_type, outcome')
    .eq('user_id', user.id)  // ✅ SECURITY: Filter by current user

  if (error) throw error

  const stats = {
    prospected: 0,
    outreach_sent: 0,
    responses_analyzed: 0,
    meetings_scheduled: 0,
    leads_qualified: 0,
  }

  if (!activities) return stats

  // Count activities by type
  activities.forEach(activity => {
    const type = activity.activity_type

    if (type === 'prospect' || type === 'prospecting') {
      stats.prospected++
    }
    if (type === 'outreach' || type === 'email_sent' || type === 'message_sent') {
      stats.outreach_sent++
    }
    if (type === 'response_analyzed' || type === 'analyze_response') {
      stats.responses_analyzed++
    }
    if (type === 'meeting_scheduled' || type === 'schedule_meeting') {
      stats.meetings_scheduled++
    }
    if (type === 'lead_qualified' || type === 'qualify_lead') {
      stats.leads_qualified++
    }
  })

  return stats
}
