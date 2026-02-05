import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Generate campaign content using OpenAI
async function generateCampaignContent(
  openaiApiKey: string,
  leadSegment: any,
  brandVoice: any,
  channels: string[]
): Promise<any> {
  const systemPrompt = `You are Agent Sophia, an expert AI SDR helping create personalized multichannel outreach campaigns.

Generate compelling, personalized campaign content for a lead segment with these characteristics:
- Industry: ${leadSegment.industry || 'Not specified'}
- Company Size: ${leadSegment.companySize || 'Not specified'}
- Job Titles: ${leadSegment.jobTitles?.join(', ') || 'Decision makers'}
- Pain Points: ${leadSegment.painPoints?.join(', ') || 'Not specified'}

Brand Voice Guidelines:
- Company: ${brandVoice.companyName || 'Our Company'}
- Industry: ${brandVoice.industry || 'Not specified'}
- Tone: ${brandVoice.tone || 'professional'}
- Values: ${brandVoice.brandValues?.join(', ') || 'innovation, results'}

Create a campaign sequence with 3 touchpoints for these channels: ${channels.join(', ')}

For EACH channel, provide:
1. **Initial Outreach** - Value-first message introducing your solution
2. **Follow-up (3 days later)** - Share social proof or case study
3. **Breakup (7 days later)** - Final attempt with FOMO or helpful resource

Return JSON with this structure:
{
  "campaignName": "Brief descriptive name",
  "sequences": {
    "email": [
      { "subject": "...", "body": "...", "delay_days": 0 },
      { "subject": "...", "body": "...", "delay_days": 3 },
      { "subject": "...", "body": "...", "delay_days": 7 }
    ],
    "linkedin": [
      { "message": "...", "delay_days": 0 },
      { "message": "...", "delay_days": 3 },
      { "message": "...", "delay_days": 7 }
    ],
    "sms": [
      { "message": "...", "delay_days": 0 }
    ]
  },
  "reasoning": "Why this approach will work for this segment"
}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate the multichannel campaign sequence now.' }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`)
    }

    const data = await response.json()
    return JSON.parse(data.choices[0].message.content)
  } catch (error) {
    console.error('Error generating campaign content:', error)
    throw error
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      throw new Error('User not authenticated')
    }

    const body = await req.json()
    const { 
      ruleId, 
      leadSegment, 
      brandVoice, 
      channels = ['email', 'linkedin'],
      autoLaunch = false 
    } = body

    if (!leadSegment) {
      throw new Error('Missing required field: leadSegment')
    }

    console.log(`🤖 Agent Sophia creating campaign for ${leadSegment.count || 'unknown'} leads`)

    // Fetch OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Generate campaign content using AI
    const campaignContent = await generateCampaignContent(
      openaiApiKey,
      leadSegment,
      brandVoice || {},
      channels
    )

    console.log(`✨ Generated campaign: ${campaignContent.campaignName}`)

    // Create the campaign in database
    const campaignData = {
      user_id: user.id,
      name: campaignContent.campaignName,
      description: campaignContent.reasoning || 'AI-generated campaign by Agent Sophia',
      type: channels.length > 1 ? 'multi-channel' : channels[0],
      status: autoLaunch ? 'active' : 'draft',
      target_audience: leadSegment,
      settings: {
        channels: channels,
        sequences: campaignContent.sequences,
        generated_by: 'agent_sophia',
        generated_at: new Date().toISOString()
      },
      created_by_sophia: true,
      sophia_metadata: {
        rule_id: ruleId || null,
        lead_segment: leadSegment,
        brand_voice: brandVoice,
        auto_launched: autoLaunch,
        generation_timestamp: new Date().toISOString()
      }
    }

    const { data: campaign, error: campaignError } = await supabaseClient
      .from('campaigns')
      .insert(campaignData)
      .select()
      .single()

    if (campaignError) {
      throw new Error(`Failed to create campaign: ${campaignError.message}`)
    }

    console.log(`✅ Campaign created: ${campaign.id}`)

    // Update rule execution stats if rule was used
    if (ruleId) {
      await supabaseClient
        .from('sophia_campaign_rules')
        .update({
          last_executed_at: new Date().toISOString(),
          execution_count: supabaseClient.rpc('increment', { row_id: ruleId })
        })
        .eq('id', ruleId)
    }

    // Log activity
    const activityLog = {
      user_id: user.id,
      activity_type: 'campaign_created',
      description: `Created campaign "${campaignContent.campaignName}" for ${leadSegment.count || 0} leads`,
      metadata: {
        campaign_id: campaign.id,
        rule_id: ruleId,
        channels: channels,
        lead_count: leadSegment.count || 0,
        auto_launched: autoLaunch
      },
      outcome: 'success'
    }

    await supabaseClient.from('agent_activities').insert(activityLog)

    return new Response(
      JSON.stringify({
        success: true,
        campaign: campaign,
        content: campaignContent,
        message: `Campaign "${campaignContent.campaignName}" created successfully!`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in agent-sophia-campaign-creator:', error)
    
    // Log failure
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      )
      
      const { data: { user } } = await supabaseClient.auth.getUser()
      
      if (user) {
        await supabaseClient.from('agent_activities').insert({
          user_id: user.id,
          activity_type: 'campaign_creation_failed',
          description: `Failed to create campaign: ${error.message}`,
          metadata: { error: error.message },
          outcome: 'failed'
        })
      }
    } catch (logError) {
      console.error('Failed to log error:', logError)
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
