import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_MODEL = "gpt-4o"

interface DecisionRequest {
  contactId?: string | null
  responseId?: string
  conversationHistory?: any[]
  campaignContext?: any
  prospectEmail?: string
  prospectName?: string
}

interface DecisionResult {
  decision_type: 'send_follow_up' | 'schedule_meeting' | 'escalate_to_human' | 'disqualify_lead' | 'continue_nurture' | 'pause_outreach' | 'auto_archive_spam'
  reasoning: string
  confidence_score: number
  recommended_action: string
  generated_content?: string
  metadata?: Record<string, any>
  intent?: string
  urgency?: 'high' | 'medium' | 'low'
  is_spam?: boolean
  auto_executed?: boolean
}

interface DecisionRequestBody extends DecisionRequest {
  userId: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestBody: DecisionRequestBody = await req.json()
    let { contactId, responseId, conversationHistory = [], campaignContext, prospectEmail, prospectName, userId } = requestBody
    
    // If userId not provided in request, extract from auth header (frontend calls)
    if (!userId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '')
          const { data: { user } } = await supabaseClient.auth.getUser(token)
          if (user) {
            userId = user.id
            console.log(`🔑 Extracted userId from auth token: ${userId}`)
          }
        } catch (error) {
          console.error('Failed to extract user from auth token:', error)
        }
      }
    }
    
    if (!userId) {
      throw new Error('userId is required (either in request body or auth header)')
    }

    console.log(`🤖 Decision engine called for user ${userId}, contact ${contactId || 'unknown'}`)

    // Get agent config with autonomy policies
    const { data: agentConfig, error: configError } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (configError || !agentConfig) {
      throw new Error('Agent configuration not found. Please configure Agent Sophia first.')
    }

    // Initialize autonomy policies with defaults if missing
    const policies = agentConfig.autonomy_policies || {
      auto_reply_enabled: true,
      confidence_threshold: 0.85,
      max_daily_auto_replies: 20,
      meeting_auto_accept: { internal: true, external: false },
      sensitive_keywords: ['pricing', 'contract', 'NDA', 'budget', 'legal'],
      spam_auto_archive: true,
      working_hours_only: true
    }
    
    // Normalize confidence threshold to 0-1 range (in case UI sends percentage)
    if (policies.confidence_threshold > 1) {
      policies.confidence_threshold = policies.confidence_threshold / 100
    }
    
    // Trim and lowercase sensitive keywords (remove leading/trailing spaces from UI input)
    policies.sensitive_keywords = (policies.sensitive_keywords || []).map((keyword: string) => 
      keyword.trim().toLowerCase()
    )

    // Get contact information
    let contact: any = null
    let isUnknownSender = false
    
    if (contactId) {
      const { data: contactData, error: contactError } = await supabaseClient
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .eq('user_id', userId)
        .single()

      if (contactError || !contactData) {
        throw new Error('Contact not found')
      }
      contact = contactData
    } else if (prospectEmail) {
      isUnknownSender = true
      contact = {
        id: null,
        email: prospectEmail,
        first_name: prospectName || prospectEmail.split('@')[0],
        last_name: '',
        company: prospectEmail.split('@')[1],
        score: 50,
        stage: 'new',
        position: null,
      }
      console.log(`🆕 Processing unknown sender: ${prospectName} (${prospectEmail})`)
    } else {
      throw new Error('Either contactId or prospectEmail must be provided')
    }

    // Get response if provided
    let response = null
    if (responseId) {
      const { data: responseData } = await supabaseClient
        .from('campaign_responses')
        .select('*')
        .eq('id', responseId)
        .eq('user_id', userId)
        .single()
      response = responseData
    }

    // Check if contact meets minimum lead score
    if (contact && contact.score !== null && contact.score !== undefined && contact.score < agentConfig.decision_criteria.min_lead_score) {
      const result: DecisionResult = {
        decision_type: 'disqualify_lead',
        reasoning: `Lead score (${contact.score}) is below minimum threshold (${agentConfig.decision_criteria.min_lead_score})`,
        confidence_score: 0.95,
        recommended_action: 'Move contact to low-priority or archive',
        metadata: { lead_score: contact.score, threshold: agentConfig.decision_criteria.min_lead_score }
      }

      await logDecision(supabaseClient, userId, contactId || null, responseId, result)

      return new Response(JSON.stringify({ success: true, decision: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if max follow-ups reached
    const followUpCount = conversationHistory.length
    if (followUpCount >= agentConfig.decision_criteria.max_follow_ups) {
      const result: DecisionResult = {
        decision_type: 'pause_outreach',
        reasoning: `Maximum follow-up attempts (${agentConfig.decision_criteria.max_follow_ups}) reached without response`,
        confidence_score: 0.90,
        recommended_action: 'Pause outreach for 30 days, then re-engage',
        metadata: { follow_up_count: followUpCount, max_allowed: agentConfig.decision_criteria.max_follow_ups }
      }

      await logDecision(supabaseClient, userId, contactId || null, responseId, result)

      return new Response(JSON.stringify({ success: true, decision: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If we have a response, analyze it with AI
    if (response) {
      const result = await analyzeResponseWithAI(contact, response, agentConfig, conversationHistory, policies)
      await logDecision(supabaseClient, userId, contactId || null, responseId, result)
      
      // Generate meeting suggestions if needed
      if (result.metadata?.meeting_signal && result.metadata.meeting_signal !== 'none') {
        console.log('🗓️ Meeting signal detected:', result.metadata.meeting_signal)
        const meetingSuggestions = await generateMeetingSuggestions(
          supabaseClient,
          userId,
          agentConfig,
          result.metadata
        )
        
        // Add suggestions to metadata
        result.metadata.meeting_suggestions = meetingSuggestions
        
        // Inject suggestions into follow-up content if needed
        if (result.metadata.needs_availability_check && result.generated_content) {
          result.generated_content += `\n\nI have the following times available:\n\n${meetingSuggestions.formatted_text}\n\nDo any of these work for you?`
        }
      }
      
      // Check for auto-execution based on policies
      const autoExecuted = await checkAutoExecution(
        supabaseClient,
        userId,
        contactId,
        contact,
        response,
        result,
        agentConfig,
        policies,
        prospectEmail,
        prospectName
      )
      
      result.auto_executed = autoExecuted
      
      // Only create approval if NOT auto-executed
      if (!autoExecuted) {
        await createApprovalFromDecision(supabaseClient, userId, contactId || null, responseId, contact, response, result, prospectEmail, prospectName)
      }

      return new Response(JSON.stringify({ success: true, decision: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // No response yet - determine if follow-up is needed
    const daysSinceLastContact = contact.last_contacted
      ? Math.floor((Date.now() - new Date(contact.last_contacted).getTime()) / (1000 * 60 * 60 * 24))
      : 0

    if (daysSinceLastContact < 3) {
      const result: DecisionResult = {
        decision_type: 'continue_nurture',
        reasoning: `Too soon for follow-up (${daysSinceLastContact} days since last contact)`,
        confidence_score: 0.85,
        recommended_action: 'Wait until at least 3 days have passed',
        metadata: { days_since_last_contact: daysSinceLastContact }
      }

      await logDecision(supabaseClient, userId, contactId || null, responseId, result)

      return new Response(JSON.stringify({ success: true, decision: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate follow-up
    const followUpContent = await generateFollowUpContent(contact, conversationHistory, agentConfig)

    const result: DecisionResult = {
      decision_type: 'send_follow_up',
      reasoning: `${daysSinceLastContact} days since last contact. Sending personalized follow-up to re-engage prospect.`,
      confidence_score: 0.75,
      recommended_action: 'Send follow-up email with value-add content',
      generated_content: followUpContent,
      metadata: { days_since_last_contact: daysSinceLastContact, follow_up_number: conversationHistory.length + 1 }
    }

    await logDecision(supabaseClient, userId, contactId || null, responseId, result)
    await createApprovalFromDecision(
      supabaseClient,
      userId,
      contactId || null,
      responseId,
      contact,
      null,
      result,
      prospectEmail,
      prospectName
    )

    return new Response(JSON.stringify({ success: true, decision: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('Error in agent-sophia-decision:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function analyzeResponseWithAI(
  contact: any,
  response: any,
  agentConfig: any,
  conversationHistory: any[],
  policies: any
): Promise<DecisionResult> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  console.log('🔑 OpenAI API key present:', !!openaiApiKey, 'length:', openaiApiKey?.length)
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  const systemPrompt = `You are Agent Sophia, an AI Sales Development Representative with advanced autonomous capabilities.

Configuration:
- Autonomy Level: ${agentConfig.autonomy_level}
- Auto-respond to: ${agentConfig.decision_criteria.auto_respond_intents.join(', ')}
- Auto-book meetings for: ${agentConfig.decision_criteria.auto_book_meeting_intents.join(', ')}
- Escalate to human: ${agentConfig.decision_criteria.escalate_to_human_intents.join(', ')}
- Communication Tone: ${agentConfig.personalization_settings.tone}
- Sensitive Keywords: ${policies.sensitive_keywords.join(', ')}

Your task:
1. Classify the prospect's email intent with high precision
2. Detect spam/junk emails (promotional, automated, irrelevant)
3. Assess urgency level (high/medium/low)
4. Determine the best next action
5. Generate appropriate follow-up content if applicable

Response Format (JSON):
{
  "intent": "interested|not_interested|request_info|objection|meeting_request|out_of_office|spam|urgent|other",
  "is_spam": boolean,
  "urgency": "high|medium|low",
  "spam_indicators": ["indicator1", "indicator2"],
  "decision_type": "send_follow_up|schedule_meeting|escalate_to_human|disqualify_lead|continue_nurture|pause_outreach|auto_archive_spam",
  "reasoning": "Clear explanation of why this decision was made",
  "confidence_score": 0.0-1.0,
  "recommended_action": "Specific action description",
  "follow_up_content": "Generated message content (if sending follow-up)",
  "complexity": "low|medium|high",
  "contains_sensitive_topics": boolean,
  "meeting_signal": "none|asking_availability|proposing_time|confirming_meeting|requesting_reschedule",
  "prospect_time_proposals": ["ISO 8601 datetime strings if they proposed specific times"],
  "needs_availability_check": boolean,
  "timezone_hint": "Detected timezone abbreviation or null",
  "meeting_context": "Brief summary of meeting-related content if present"
}

SPAM DETECTION RULES:
- Promotional emails (sales pitches, marketing emails)
- Automated newsletters or subscription confirmations
- Generic mass emails with no personalization
- Emails clearly not related to the conversation
- "Unsubscribe" links or marketing footers

URGENCY DETECTION:
- HIGH: Mentions deadlines, "urgent", "ASAP", time-sensitive requests
- MEDIUM: Questions, meeting requests, needs information
- LOW: General inquiries, out-of-office, FYI messages

COMPLEXITY ASSESSMENT:
- LOW: Simple acknowledgments, out-of-office, basic questions
- MEDIUM: Information requests, clarifications, objections
- HIGH: Complex negotiations, multiple topics, sensitive keywords

MEETING DETECTION RULES:
- "asking_availability": Prospect asks "When are you available?" or "What's your availability?"
- "proposing_time": Prospect suggests specific times like "I'm free Tuesday at 2pm" or "How about next Monday?"
- "confirming_meeting": Prospect confirms a meeting time or responds affirmatively to a proposed time
- "requesting_reschedule": Prospect asks to change an existing meeting time
- Extract specific times mentioned (convert to ISO 8601 format with best guess for date/time)
- Detect timezone hints (EST, PST, GMT, etc.) from the message
- Set needs_availability_check=true if we should propose times in response`

  const userPrompt = `
Contact Information:
- Name: ${contact.first_name} ${contact.last_name}
- Company: ${contact.company || 'Unknown'}
- Position: ${contact.position || 'Unknown'}
- Lead Score: ${contact.score || 'N/A'}
- Stage: ${contact.stage}

Latest Response:
"${response.response_text}"

Previous ${conversationHistory.length} messages in conversation.

Analyze this email and determine the best next action.`

  console.log('🤖 Calling OpenAI with model:', OPENAI_MODEL)
  
  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  })

  console.log('📡 OpenAI response status:', openaiResponse.status, openaiResponse.statusText)

  if (!openaiResponse.ok) {
    const errorData = await openaiResponse.json().catch(() => ({}))
    console.error('❌ OpenAI API error details:', JSON.stringify(errorData, null, 2))
    throw new Error(`OpenAI API request failed (${openaiResponse.status}): ${errorData.error?.message || openaiResponse.statusText}`)
  }

  const result = await openaiResponse.json()
  const aiResult = JSON.parse(result.choices[0].message.content)

  // Extract meeting detection fields
  const meetingSignal = aiResult.meeting_signal || 'none';
  const hasMeetingSignal = meetingSignal !== 'none';

  return {
    decision_type: aiResult.decision_type || 'continue_nurture',
    reasoning: aiResult.reasoning || 'AI analysis completed',
    confidence_score: aiResult.confidence_score || 0.7,
    recommended_action: aiResult.recommended_action || 'Continue monitoring',
    generated_content: aiResult.follow_up_content,
    intent: aiResult.intent,
    urgency: aiResult.urgency || 'medium',
    is_spam: aiResult.is_spam || false,
    metadata: {
      intent_detected: aiResult.intent,
      urgency_level: aiResult.urgency,
      is_spam: aiResult.is_spam,
      spam_indicators: aiResult.spam_indicators || [],
      complexity: aiResult.complexity || 'medium',
      contains_sensitive_topics: aiResult.contains_sensitive_topics || false,
      ai_model: OPENAI_MODEL,
      analysis_timestamp: new Date().toISOString(),
      // Meeting detection fields
      meeting_signal: meetingSignal,
      prospect_time_proposals: aiResult.prospect_time_proposals || [],
      needs_availability_check: aiResult.needs_availability_check || hasMeetingSignal,
      timezone_hint: aiResult.timezone_hint || null,
      meeting_context: aiResult.meeting_context || null
    }
  }
}

/**
 * Check if action should be auto-executed based on policies
 * Enforces all safety guardrails before allowing autonomous actions
 */
async function checkAutoExecution(
  supabaseClient: any,
  userId: string,
  contactId: string | null,
  contact: any,
  response: any,
  decision: DecisionResult,
  agentConfig: any,
  policies: any,
  prospectEmail?: string,
  prospectName?: string
): Promise<boolean> {
  console.log('🔍 Checking auto-execution policies...')
  
  // Ensure confidence score is in 0-1 range (never percentage)
  const confidence = decision.confidence_score > 1 ? decision.confidence_score / 100 : decision.confidence_score
  decision.confidence_score = confidence
  
  // SPAM AUTO-ARCHIVE
  if (decision.is_spam && policies.spam_auto_archive) {
    console.log('🗑️ Auto-archiving spam email')
    
    // Log the auto-archive action
    await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: userId,
        contact_id: contactId,
        activity_type: 'response_analyzed',
        channel: 'email',
        action_taken: 'Auto-archived spam email',
        message_content: `Spam detected and auto-archived: ${response.response_text.substring(0, 100)}...`,
        outcome: 'success',
        outcome_details: decision.reasoning,
        metadata: {
          auto_executed: true,
          decision_type: 'auto_archive_spam',
          spam_indicators: decision.metadata?.spam_indicators || [],
          confidence: decision.confidence_score,
          intent: decision.intent,
          urgency: decision.urgency
        }
      })
    
    return true
  }

  // MEETING AUTO-ACCEPT
  if (decision.decision_type === 'schedule_meeting' && decision.intent === 'meeting_request') {
    const isInternal = checkIfInternalEmail(contact.email || prospectEmail, agentConfig)
    const shouldAutoAccept = isInternal ? policies.meeting_auto_accept.internal : policies.meeting_auto_accept.external
    
    // Check if calendar link exists (hard stop if missing)
    const hasCalendarLink = agentConfig.meeting_settings?.calendly_link || agentConfig.meeting_settings?.cal_com_link
    if (!hasCalendarLink) {
      console.log('⚠️ No calendar link configured - cannot auto-book meetings')
      await logGuardrailBlock(supabaseClient, userId, contactId, decision, 'no_calendar_link', 'Auto-book blocked: No calendar link configured')
      return false
    }
    
    if (shouldAutoAccept && decision.confidence_score >= policies.confidence_threshold) {
      console.log(`📅 Auto-accepting ${isInternal ? 'internal' : 'external'} meeting`)
      
      // Auto-book the meeting
      const meetingTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      await supabaseClient.functions.invoke('office365-book-meeting', {
        body: {
          userId,
          contactId,
          subject: `Meeting with ${contact.first_name || prospectName || 'Prospect'}`,
          startTime: meetingTime,
          duration: 30,
          attendeeEmail: contact.email || prospectEmail,
        }
      })
      
      // Log the auto-accept action
      await supabaseClient
        .from('agent_activities')
        .insert({
          user_id: userId,
          contact_id: contactId,
          activity_type: 'meeting_scheduled',
          channel: 'email',
          action_taken: `Auto-accepted ${isInternal ? 'internal' : 'external'} meeting`,
          outcome: 'success',
          outcome_details: decision.reasoning,
          metadata: {
            auto_executed: true,
            meeting_time: meetingTime,
            is_internal: isInternal,
            confidence: decision.confidence_score,
            intent: decision.intent,
            urgency: decision.urgency
          }
        })
      
      return true
    } else if (!shouldAutoAccept) {
      console.log(`⚠️ Meeting auto-accept disabled for ${isInternal ? 'internal' : 'external'} meetings`)
      await logGuardrailBlock(supabaseClient, userId, contactId, decision, 'policy_disabled', `Auto-accept disabled for ${isInternal ? 'internal' : 'external'} meetings`)
    } else {
      console.log(`⚠️ Meeting confidence (${decision.confidence_score}) below threshold (${policies.confidence_threshold})`)
      await logGuardrailBlock(supabaseClient, userId, contactId, decision, 'confidence_too_low', `Confidence ${decision.confidence_score} below threshold ${policies.confidence_threshold}`)
    }
  }

  // AUTO-REPLY FOR LOW-COMPLEXITY, HIGH-CONFIDENCE RESPONSES
  if (
    policies.auto_reply_enabled &&
    decision.confidence_score >= policies.confidence_threshold &&
    decision.metadata?.complexity === 'low' &&
    !decision.metadata?.contains_sensitive_topics &&
    decision.generated_content
  ) {
    // CHECK 1: Sensitive keywords in email content
    const emailText = (response.response_text || '').toLowerCase()
    const sensitiveKeywords = policies.sensitive_keywords || []
    const foundSensitiveKeyword = sensitiveKeywords.find((keyword: string) => 
      emailText.includes(keyword.toLowerCase())
    )
    
    if (foundSensitiveKeyword) {
      console.log(`⚠️ Sensitive keyword detected: "${foundSensitiveKeyword}" - escalating to human`)
      await logGuardrailBlock(supabaseClient, userId, contactId, decision, 'sensitive_keyword', `Contains sensitive keyword: ${foundSensitiveKeyword}`)
      return false
    }
    
    // CHECK 2: Daily limit (enforce BEFORE executing)
    const autoRepliesToday = agentConfig.auto_replies_today || 0
    if (autoRepliesToday >= policies.max_daily_auto_replies) {
      console.log(`⚠️ Daily auto-reply limit reached (${autoRepliesToday}/${policies.max_daily_auto_replies})`)
      await logGuardrailBlock(supabaseClient, userId, contactId, decision, 'daily_limit_reached', `Daily limit ${policies.max_daily_auto_replies} reached`)
      return false
    }

    // CHECK 3: Working hours enforcement
    if (policies.working_hours_only && !isWithinWorkingHours(agentConfig)) {
      console.log('⏰ Outside working hours, skipping auto-reply')
      await logGuardrailBlock(supabaseClient, userId, contactId, decision, 'outside_working_hours', 'Auto-reply blocked: Outside configured working hours')
      return false
    }

    console.log('✅ All guardrails passed - executing auto-reply')
    
    // Send the email (you'll need to implement this with your email service)
    // For now, log it as an activity
    await supabaseClient
      .from('agent_activities')
      .insert({
        user_id: userId,
        contact_id: contactId,
        activity_type: 'follow_up_sent',
        channel: 'email',
        action_taken: 'Auto-replied to simple inquiry',
        message_content: decision.generated_content,
        outcome: 'success',
        outcome_details: decision.reasoning,
        metadata: {
          auto_executed: true,
          decision_type: decision.decision_type,
          intent: decision.intent,
          urgency: decision.urgency,
          confidence: decision.confidence_score,
          complexity: decision.metadata?.complexity,
          guardrails_checked: ['sensitive_keywords', 'daily_limit', 'working_hours']
        }
      })
    
    // Increment auto-reply counter
    await supabaseClient
      .from('agent_configs')
      .update({ auto_replies_today: autoRepliesToday + 1 })
      .eq('user_id', userId)
    
    return true
  }

  return false
}

/**
 * Log when guardrails block an autonomous action
 */
async function logGuardrailBlock(
  supabaseClient: any,
  userId: string,
  contactId: string | null,
  decision: DecisionResult,
  blockReason: string,
  blockDetails: string
) {
  console.log(`🛡️ Guardrail blocked action: ${blockReason}`)
  
  await supabaseClient
    .from('agent_activities')
    .insert({
      user_id: userId,
      contact_id: contactId,
      activity_type: 'escalated_to_human',
      channel: 'email',
      action_taken: `Auto-execution blocked: ${blockReason}`,
      outcome: 'pending',
      outcome_details: blockDetails,
      metadata: {
        auto_executed: false,
        guardrail_block: true,
        block_reason: blockReason,
        decision_type: decision.decision_type,
        intent: decision.intent,
        urgency: decision.urgency,
        confidence: decision.confidence_score,
        reasoning: decision.reasoning
      }
    })
}

/**
 * Check if email is from internal domain
 */
function checkIfInternalEmail(email: string | undefined, agentConfig: any): boolean {
  if (!email) return false
  
  const userEmail = agentConfig.user_profile?.email
  if (!userEmail) return false
  
  const emailDomain = email.split('@')[1]?.toLowerCase()
  const userDomain = userEmail.split('@')[1]?.toLowerCase()
  
  return emailDomain === userDomain
}

/**
 * Check if current time is within working hours
 * Safely handles missing or malformed schedule config
 */
function isWithinWorkingHours(agentConfig: any): boolean {
  // Defensive: If no schedule configured, assume always within working hours (fail open)
  if (!agentConfig?.activity_schedule) {
    console.warn('⚠️ No activity_schedule configured - defaulting to within working hours')
    return true
  }
  
  const schedule = agentConfig.activity_schedule
  
  // Defensive: If working_days not configured, assume all days are working days
  if (!Array.isArray(schedule.working_days) || schedule.working_days.length === 0) {
    console.warn('⚠️ No working_days configured - assuming all days')
  } else {
    const now = new Date()
    const currentDay = now.getDay()
    
    // Check if today is a working day
    if (!schedule.working_days.includes(currentDay)) {
      return false
    }
  }
  
  // Defensive: If working hours not configured, assume 9-5
  const startHour = schedule.working_hours_start ? parseInt(schedule.working_hours_start.split(':')[0]) : 9
  const endHour = schedule.working_hours_end ? parseInt(schedule.working_hours_end.split(':')[0]) : 17
  
  const now = new Date()
  const currentHour = now.getHours()
  
  return currentHour >= startHour && currentHour < endHour
}

async function generateFollowUpContent(contact: any, conversationHistory: any[], agentConfig: any): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    return `Hi ${contact.first_name},\n\nI wanted to follow up on my previous message. I'd love to chat about how we can help ${contact.company || 'your company'}.\n\nAre you available for a quick call this week?\n\nBest regards`
  }

  // Extract user profile and company info
  const userProfile = agentConfig.user_profile || {}
  const companyInfo = agentConfig.company_info || {}

  // Build sender information section
  let senderInfo = 'SENDER INFORMATION:\n'
  if (userProfile.full_name) senderInfo += `- Name: ${userProfile.full_name}\n`
  if (userProfile.title) senderInfo += `- Title: ${userProfile.title}\n`
  if (userProfile.email) senderInfo += `- Email: ${userProfile.email}\n`
  if (userProfile.phone) senderInfo += `- Phone: ${userProfile.phone}\n`

  // Build company information section
  let companyInfoSection = 'COMPANY INFORMATION:\n'
  if (companyInfo.company_name) companyInfoSection += `- Company Name: ${companyInfo.company_name}\n`
  if (companyInfo.industry) companyInfoSection += `- Industry: ${companyInfo.industry}\n`
  if (companyInfo.website) companyInfoSection += `- Website: ${companyInfo.website}\n`
  if (companyInfo.services_description) companyInfoSection += `- Services/Products: ${companyInfo.services_description}\n`

  const hasBasicProfile = userProfile.full_name && (companyInfo.company_name || companyInfo.services_description)
  
  if (!hasBasicProfile) {
    console.warn('⚠️ Missing profile information. User should configure their profile in Agent Sophia Setup tab.')
  }

  const systemPrompt = `You are Agent Sophia, an AI SDR${userProfile.full_name ? ` writing on behalf of ${userProfile.full_name}` : ''}.

${senderInfo}
${companyInfoSection}
TONE & STYLE:
- Tone: ${agentConfig.personalization_settings.tone}
- Include sender name: ${agentConfig.personalization_settings.include_sender_name}

CRITICAL INSTRUCTIONS:
- ONLY use the REAL sender and company information provided above
- If specific details are not provided, write in a general professional manner without making up information
- ${companyInfo.services_description ? 'Mention specific services/products from the Services/Products description' : 'Keep the message focused on value and engagement'}
- Be concise (3-5 sentences)
- Provide value, don't just "check in"
- Reference previous context if available
- Include a clear call-to-action
- Match the configured tone exactly
${userProfile.full_name ? `- Sign off with: Best regards, ${userProfile.full_name}` : '- Sign off professionally'}`

  const userPrompt = `
PROSPECT INFORMATION:
Contact: ${contact.first_name} ${contact.last_name}
Company: ${contact.company || 'their company'}
Position: ${contact.position || 'their role'}
Previous messages sent: ${conversationHistory.length}

TASK: Generate a compelling follow-up email that re-engages this prospect. Use the sender's real name, company, and services description. DO NOT use placeholders.`

  const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.8,
      max_tokens: 300,
    }),
  })

  if (!openaiResponse.ok) {
    return `Hi ${contact.first_name},\n\nI wanted to follow up on my previous message. I'd love to chat about how we can help ${contact.company || 'your company'}.\n\nAre you available for a quick call this week?\n\nBest regards`
  }

  const result = await openaiResponse.json()
  let content = result.choices[0].message.content

  if (agentConfig.personalization_settings.signature) {
    content += '\n\n' + agentConfig.personalization_settings.signature
  }

  return content
}

async function logDecision(supabaseClient: any, userId: string, contactId: string | null, responseId: string | undefined, decision: DecisionResult) {
  if (contactId) {
    await supabaseClient
      .from('agent_decisions')
      .insert({
        user_id: userId,
        contact_id: contactId,
        response_id: responseId,
        decision_type: decision.decision_type,
        reasoning: decision.reasoning,
        confidence_score: decision.confidence_score,
        input_data: decision.metadata || {},
        recommended_action: decision.recommended_action,
        human_override: false
      })
  } else {
    console.log('⚠️ Skipping agent_decision log for unknown sender (no contact_id)')
  }
}

/**
 * Create approval record based on AI decision
 */
/**
 * Generate meeting time suggestions based on working hours and availability
 */
async function generateMeetingSuggestions(
  supabaseClient: any,
  userId: string,
  agentConfig: any,
  metadata: any
): Promise<{ slots: string[], timezone: string, formatted_text: string }> {
  // Get working hours from agent config
  const workingHours = agentConfig.activity_schedule?.working_hours || {
    start: '09:00',
    end: '17:00',
    days: [1, 2, 3, 4, 5], // Mon-Fri
    timezone: 'America/New_York'
  };

  const timezone = workingHours.timezone || 'America/New_York';
  const slots: string[] = [];
  const now = new Date();

  // Generate 3 time slots over the next 5 business days
  let daysChecked = 0;
  let slotsFound = 0;
  
  while (slotsFound < 3 && daysChecked < 10) {
    const checkDate = new Date(now.getTime() + (daysChecked + 1) * 24 * 60 * 60 * 1000);
    const dayOfWeek = checkDate.getDay();
    
    // Skip if not a working day
    if (!workingHours.days.includes(dayOfWeek)) {
      daysChecked++;
      continue;
    }

    // Propose times at 10am, 2pm, and 3pm on different days
    const times = slotsFound === 0 ? ['10:00'] : slotsFound === 1 ? ['14:00'] : ['15:00'];
    
    for (const time of times) {
      const [hour, minute] = time.split(':');
      checkDate.setHours(parseInt(hour), parseInt(minute), 0, 0);
      slots.push(checkDate.toISOString());
      slotsFound++;
      if (slotsFound >= 3) break;
    }
    
    daysChecked++;
  }

  // Format times for display
  const formatted = slots.map((slot, index) => {
    const date = new Date(slot);
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    };
    return `${index + 1}. ${date.toLocaleString('en-US', options)}`;
  }).join('\n');

  return {
    slots,
    timezone,
    formatted_text: formatted
  };
}

async function createApprovalFromDecision(
  supabaseClient: any,
  userId: string,
  contactId: string | null,
  responseId: string | undefined,
  contact: any,
  response: any,
  decision: DecisionResult,
  prospectEmail?: string,
  prospectName?: string
) {
  console.log(`📋 Creating approval for decision type: ${decision.decision_type}`)
  
  try {
    if (decision.decision_type === 'schedule_meeting') {
      const suggestedTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
      
      await supabaseClient
        .from('meeting_approvals')
        .insert({
          user_id: userId,
          contact_id: contactId,
          suggested_subject: `Meeting with ${contact.first_name || prospectName || 'Prospect'}`,
          suggested_time: suggestedTime,
          suggested_duration: 30,
          confidence: decision.confidence_score,
          status: 'pending',
          ai_reasoning: decision.reasoning,
          prospect_name: prospectName,
          prospect_email: prospectEmail,
          metadata: {
            is_unknown_sender: !contactId,
            intent: decision.intent,
            urgency: decision.urgency,
            ...decision.metadata
          }
        })
      
      console.log('✅ Meeting approval created')
    }
    else if (['send_follow_up', 'escalate_to_human', 'continue_nurture'].includes(decision.decision_type)) {
      // Ensure we have content to send
      const messageContent = decision.generated_content || decision.recommended_action || 'Please review and add message content';
      const emailSubject = response?.metadata?.subject || response?.subject || `RE: ${contact.first_name || prospectName || 'Follow-up'}`;

      await supabaseClient
        .from('followup_queue')
        .insert({
          user_id: userId,
          contact_id: contactId,
          channel: 'email',
          suggested_message: messageContent,
          subject: emailSubject, // Also store in top-level column for backwards compatibility
          scheduled_for: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          status: 'pending',
          metadata: {
            prospect_email: prospectEmail,
            prospect_name: prospectName,
            is_unknown_sender: !contactId,
            decision_type: decision.decision_type,
            ai_reasoning: decision.reasoning,
            original_email: response?.response_text || '',
            subject: emailSubject,
            confidence_score: decision.confidence_score,
            intent: decision.intent,
            urgency: decision.urgency,
            complexity: decision.metadata?.complexity,
            ...decision.metadata
          }
        })
      
      console.log('✅ Follow-up approval created')
    }
    else {
      console.log(`ℹ️ No approval needed for decision type: ${decision.decision_type}`)
    }
  } catch (error) {
    console.error('❌ Failed to create approval:', error)
  }
}
