import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_MODEL = "gpt-4o"

interface ProspectRequest {
  contactIds: string[]
  criteria?: {
    industries?: string[]
    jobTitles?: string[]
    minLeadScore?: number
    tags?: string[]
    excludeTags?: string[]
  }
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

    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authorization header is required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    const { contactIds, criteria }: ProspectRequest = await req.json()

    // Get agent config
    const { data: agentConfig } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!agentConfig) {
      throw new Error('Agent configuration not found')
    }

    // Get contacts
    const { data: contacts } = await supabaseClient
      .from('contacts')
      .select('*')
      .in('id', contactIds)
      .eq('user_id', user.id)

    if (!contacts || contacts.length === 0) {
      throw new Error('No contacts found')
    }

    const qualifiedLeads = []
    const disqualifiedLeads = []

    // Process each contact
    for (const contact of contacts) {
      // Rule-based pre-screening
      if (contact.score !== null && contact.score !== undefined && contact.score < agentConfig.decision_criteria.min_lead_score) {
        disqualifiedLeads.push({ contact, reason: 'Lead score below threshold' })
        continue
      }

      if (!contact.email && !contact.linkedin_url) {
        disqualifiedLeads.push({ contact, reason: 'Missing contact methods' })
        continue
      }

      // Check excluded tags
      if (criteria?.excludeTags && contact.tags) {
        const hasExcluded = criteria.excludeTags.some(tag => contact.tags?.includes(tag))
        if (hasExcluded) {
          disqualifiedLeads.push({ contact, reason: 'Has excluded tag' })
          continue
        }
      }

      // AI-based qualification
      const isQualified = await qualifyWithAI(contact, agentConfig)
      if (isQualified.qualified) {
        qualifiedLeads.push(contact)
        
        // Log activity
        await supabaseClient.from('agent_activities').insert({
          user_id: user.id,
          contact_id: contact.id,
          activity_type: 'lead_qualified',
          action_taken: 'Lead qualified for outreach',
          outcome: 'success',
          outcome_details: isQualified.reason,
          metadata: { qualification_score: isQualified.confidence }
        })
      } else {
        disqualifiedLeads.push({ contact, reason: isQualified.reason })
        
        await supabaseClient.from('agent_activities').insert({
          user_id: user.id,
          contact_id: contact.id,
          activity_type: 'lead_disqualified',
          action_taken: 'Lead disqualified',
          outcome: 'failed',
          outcome_details: isQualified.reason
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        qualified: qualifiedLeads,
        disqualified: disqualifiedLeads,
        stats: {
          total: contacts.length,
          qualified: qualifiedLeads.length,
          disqualified: disqualifiedLeads.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in agent-sophia-prospect:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function qualifyWithAI(contact: any, agentConfig: any): Promise<{ qualified: boolean; reason: string; confidence: number }> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    // Fallback to rule-based
    return { qualified: true, reason: 'AI unavailable, passed rule-based qualification', confidence: 0.5 }
  }

  const systemPrompt = `You are Agent Sophia, an AI SDR specializing in lead qualification. 
Analyze the contact information and determine if this is a qualified lead worth pursuing.

Respond with JSON:
{
  "qualified": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`

  const userPrompt = `
Contact Information:
- Name: ${contact.first_name} ${contact.last_name}
- Company: ${contact.company || 'Unknown'}
- Position: ${contact.position || 'Unknown'}
- Email: ${contact.email ? 'Available' : 'Not available'}
- Lead Score: ${contact.score || 'Not scored'}

Is this a qualified lead worth pursuing?`

  try {
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
        temperature: 0.5,
      }),
    })

    if (!openaiResponse.ok) {
      return { qualified: true, reason: 'AI unavailable, passed rule-based qualification', confidence: 0.5 }
    }

    const result = await openaiResponse.json()
    const aiResult = JSON.parse(result.choices[0].message.content)

    return {
      qualified: aiResult.qualified && aiResult.confidence >= 0.6,
      reason: aiResult.reasoning || 'AI qualification completed',
      confidence: aiResult.confidence || 0.7
    }
  } catch (error) {
    return { qualified: true, reason: 'AI error, passed rule-based qualification', confidence: 0.5 }
  }
}
