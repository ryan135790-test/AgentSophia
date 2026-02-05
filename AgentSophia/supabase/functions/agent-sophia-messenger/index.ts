import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Email provider integrations
async function sendEmail(config: any, message: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { provider, credentials } = config
  const { to, subject, body, fromName } = message
  
  try {
    if (provider === 'sendgrid') {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: credentials.fromEmail, name: fromName || 'Agent Sophia' },
          subject: subject,
          content: [{ type: 'text/html', value: body }]
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `SendGrid error: ${error}` }
      }
      
      return { success: true, messageId: response.headers.get('x-message-id') || undefined }
    }
    
    if (provider === 'resend') {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${fromName || 'Agent Sophia'} <${credentials.fromEmail}>`,
          to: [to],
          subject: subject,
          html: body
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        return { success: false, error: `Resend error: ${error}` }
      }
      
      const data = await response.json()
      return { success: true, messageId: data.id }
    }
    
    if (provider === 'gmail' || provider === 'outlook') {
      // OAuth-based email sending (requires stored access tokens)
      return { success: false, error: 'OAuth email sending not yet implemented. Use SendGrid or Resend for now.' }
    }
    
    return { success: false, error: `Unknown email provider: ${provider}` }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// SMS provider integrations
async function sendSMS(config: any, message: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { provider, credentials } = config
  const { to, body } = message
  
  try {
    if (provider === 'twilio') {
      const auth = btoa(`${credentials.accountSid}:${credentials.authToken}`)
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${credentials.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: to,
            From: credentials.phoneNumber,
            Body: body
          })
        }
      )
      
      if (!response.ok) {
        const error = await response.json()
        return { success: false, error: `Twilio error: ${error.message}` }
      }
      
      const data = await response.json()
      return { success: true, messageId: data.sid }
    }
    
    return { success: false, error: `Unknown SMS provider: ${provider}` }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// LinkedIn messaging (placeholder - requires LinkedIn API access)
async function sendLinkedInMessage(config: any, message: any): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // LinkedIn API requires Sales Navigator and special permissions
  return { success: false, error: 'LinkedIn messaging requires Sales Navigator API access. Please use email for now.' }
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
    const { channel, contactId, campaignId, message, messageType = 'initial_outreach' } = body

    if (!channel || !contactId || !message) {
      throw new Error('Missing required fields: channel, contactId, message')
    }

    console.log(`📨 Agent Sophia sending ${channel} message to contact ${contactId}`)

    // Fetch connector configuration for the channel
    const { data: connectorConfig, error: connectorError } = await supabaseClient
      .from('connector_configs')
      .select('*')
      .eq('user_id', user.id)
      .eq('channel', channel)
      .single()

    if (connectorError || !connectorConfig) {
      throw new Error(`No ${channel} connector configured. Please set up your ${channel} integration first.`)
    }

    if (!connectorConfig.is_active) {
      throw new Error(`${channel} connector is not active. Please activate it in your settings.`)
    }

    // Send the message based on channel
    let result: { success: boolean; messageId?: string; error?: string }
    
    switch (channel) {
      case 'email':
        result = await sendEmail(connectorConfig.config, message)
        break
      case 'sms':
        result = await sendSMS(connectorConfig.config, message)
        break
      case 'linkedin':
        result = await sendLinkedInMessage(connectorConfig.config, message)
        break
      default:
        result = { success: false, error: `Unsupported channel: ${channel}` }
    }

    // Log the sent message to database
    const messageRecord = {
      user_id: user.id,
      contact_id: contactId,
      campaign_id: campaignId || null,
      channel: channel,
      message_type: messageType,
      subject: message.subject || null,
      message_content: message.body || message.text || '',
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      failed_reason: result.error || null,
      provider: connectorConfig.config.provider,
      provider_message_id: result.messageId || null,
      metadata: {
        sophia_generated: true,
        attempt_count: 1
      }
    }

    const { data: sentMessage, error: insertError } = await supabaseClient
      .from('sophia_sent_messages')
      .insert(messageRecord)
      .select()
      .single()

    if (insertError) {
      console.error('Failed to log sent message:', insertError)
    }

    // Log activity to agent_activities
    const activityLog = {
      user_id: user.id,
      activity_type: 'message_sent',
      description: `Sent ${channel} message to contact ${contactId}`,
      metadata: {
        channel: channel,
        contact_id: contactId,
        campaign_id: campaignId,
        message_type: messageType,
        success: result.success,
        provider_message_id: result.messageId
      },
      outcome: result.success ? 'success' : 'failed'
    }

    await supabaseClient.from('agent_activities').insert(activityLog)

    return new Response(
      JSON.stringify({
        success: result.success,
        messageId: result.messageId,
        error: result.error,
        sentMessage: sentMessage
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: result.success ? 200 : 400,
      }
    )
  } catch (error) {
    console.error('Error in agent-sophia-messenger:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
