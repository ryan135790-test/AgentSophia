import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_MODEL = "gpt-4o"

interface FollowUpRequest {
  contactId: string
  conversationHistory: any[]
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

    const { contactId, conversationHistory }: FollowUpRequest = await req.json()

    const { data: agentConfig } = await supabaseClient
      .from('agent_configs')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!agentConfig) {
      throw new Error('Agent configuration not found')
    }

    const { data: contact } = await supabaseClient
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .single()

    if (!contact) {
      throw new Error('Contact not found')
    }

    // Analyze engagement pattern
    const engagementScore = calculateEngagementScore(conversationHistory)
    const followUpContent = await generateContextualFollowUp(contact, conversationHistory, engagementScore, agentConfig)

    // Log activity
    await supabaseClient.from('agent_activities').insert({
      user_id: user.id,
      contact_id: contactId,
      activity_type: 'follow_up_sent',
      action_taken: 'Generated contextual follow-up',
      message_content: followUpContent,
      outcome: 'success',
      metadata: { engagement_score: engagementScore, follow_up_number: conversationHistory.length + 1 }
    })

    return new Response(
      JSON.stringify({
        success: true,
        content: followUpContent,
        engagement_score: engagementScore,
        metadata: { follow_up_number: conversationHistory.length + 1 }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Error in agent-sophia-followup:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

function calculateEngagementScore(conversationHistory: any[]): number {
  const totalMessages = conversationHistory.length
  const responses = conversationHistory.filter(msg => msg.intent_tag !== 'out_of_office').length
  const responseRate = responses / Math.max(totalMessages, 1)
  return Math.round(responseRate * 100)
}

async function generateContextualFollowUp(contact: any, conversationHistory: any[], engagementScore: number, agentConfig: any): Promise<string> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  
  // Fallback if no API key
  if (!openaiApiKey) {
    const firstName = contact.first_name || 'there'
    if (engagementScore > 70) {
      return `Hi ${firstName},\n\nFollowing up on our conversation - wanted to share a quick insight that might be relevant to ${contact.company || 'your team'}.\n\nWould you be interested in a brief call to explore this further?\n\nBest regards`
    }
    return `Hi ${firstName},\n\nI wanted to circle back and see if there's anything I can help clarify about how we support teams like yours at ${contact.company || 'your company'}.\n\nNo pressure - happy to chat whenever makes sense.\n\nBest regards`
  }

  const recentMessages = conversationHistory.slice(-3).map(msg => 
    `${msg.channel}: "${msg.message_content.substring(0, 100)}..."`
  ).join('\n')

  const systemPrompt = `You are Agent Sophia, an AI SDR. Generate a contextual follow-up message.

Tone: ${agentConfig.personalization_settings.tone}
Engagement score: ${engagementScore}/100

Guidelines:
- Reference previous context naturally
- Provide NEW value
- Keep it brief (2-4 sentences max)
- Match the engagement level
- Include a specific, low-pressure call-to-action`

  const userPrompt = `
Contact: ${contact.first_name} ${contact.last_name} at ${contact.company || 'their company'}
Recent conversation:
${recentMessages}

Generate an appropriate follow-up message.`

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
        temperature: 0.85,
        max_tokens: 300,
      }),
    })

    if (!openaiResponse.ok) {
      throw new Error('OpenAI request failed')
    }

    const result = await openaiResponse.json()
    let content = result.choices[0].message.content

    if (agentConfig.personalization_settings.signature) {
      content += '\n\n' + agentConfig.personalization_settings.signature
    }

    return content
  } catch (error) {
    // Fallback
    return `Hi ${contact.first_name || 'there'},\n\nI wanted to follow up on my previous message. I'd love to chat about how we can help ${contact.company || 'your company'}.\n\nAre you available for a quick call this week?\n\nBest regards`
  }
}
