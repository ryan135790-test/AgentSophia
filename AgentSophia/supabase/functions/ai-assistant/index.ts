import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const OPENAI_MODEL = "gpt-5"

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  sessionType?: 'workflow' | 'campaign' | 'analysis'
  context?: Record<string, any>
}

interface InternalData {
  campaigns?: any[]
  contacts?: any[]
  connectors?: any
  recentActivity?: any[]
  campaignResponses?: any[]
  agentSophia?: {
    config?: any
    isActive?: boolean
    recentActivity?: any[]
    totalActivities?: number
  }
  summary?: {
    totalCampaigns: number
    activeCampaigns: number
    totalContacts: number
    recentInteractions: number
    connectedChannels: string[]
    sophiaActive?: boolean
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get the current user
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      throw new Error('Authorization header is required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('User not authenticated')
    }

    const { messages, sessionType = 'workflow', context }: ChatRequest = await req.json()

    if (!messages || messages.length === 0) {
      throw new Error('Messages are required')
    }

    // **STEP 1: SEARCH INTERNAL DATA FIRST (RAG)**
    // Get the user's last message to understand what they're asking about
    const userMessage = messages[messages.length - 1]?.content || ''
    const internalData = await retrieveInternalData(supabaseClient, user.id, userMessage, sessionType)

    // **STEP 2: Check if we can answer from internal data alone**
    // For simple queries about user's own data, we might not need OpenAI at all
    const simpleAnswer = tryAnswerFromInternalData(userMessage, internalData)
    if (simpleAnswer) {
      // Save chat session
      await supabaseClient
        .from('ai_chat_sessions')
        .insert({
          user_id: user.id,
          session_type: sessionType,
          messages: JSON.stringify([...messages, { role: 'assistant', content: simpleAnswer }]),
          context_data: { ...context, internalDataUsed: true, source: 'database' },
          is_active: true,
        })

      return new Response(
        JSON.stringify({
          success: true,
          message: simpleAnswer,
          model: 'internal_data',
          source: 'database'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // **STEP 3: Call OpenAI with enriched context from internal data**
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured')
    }

    // Build enhanced system message with internal data
    const systemMessage = getSystemMessage(sessionType, context, internalData)
    const fullMessages = [systemMessage, ...messages]

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: fullMessages,
      }),
    })

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text()
      console.error('OpenAI API error:', errorText)
      throw new Error(`OpenAI API error: ${errorText}`)
    }

    const openaiData = await openaiResponse.json()
    const assistantMessage = openaiData.choices[0].message.content

    // Save chat session to database
    const { error: saveError } = await supabaseClient
      .from('ai_chat_sessions')
      .insert({
        user_id: user.id,
        session_type: sessionType,
        messages: JSON.stringify([...messages, { role: 'assistant', content: assistantMessage }]),
        context_data: { ...context, internalDataIncluded: true, dataUsed: Object.keys(internalData) },
        is_active: true,
      })

    if (saveError) {
      console.error('Failed to save chat session:', saveError)
      // Don't throw - we still want to return the AI response
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: assistantMessage,
        model: OPENAI_MODEL,
        source: 'openai_with_context'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('AI Assistant error:', error)
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

/**
 * Retrieve relevant internal data from the database based on user query
 * This is the RAG (Retrieval Augmented Generation) component
 */
async function retrieveInternalData(
  supabaseClient: any, 
  userId: string, 
  userMessage: string,
  sessionType: string
): Promise<InternalData> {
  const internalData: InternalData = {
    summary: {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalContacts: 0,
      recentInteractions: 0,
      connectedChannels: []
    }
  }

  try {
    // Determine what data to fetch based on keywords in user message
    const messageLower = userMessage.toLowerCase()
    
    // **1. Fetch connector configs (always useful for context)**
    try {
      const { data: connectorData } = await supabaseClient
        .from('connector_configs')
        .select('*')
        .eq('user_id', userId)
        .single()
      
      if (connectorData) {
        // Sanitize - don't include sensitive data in AI context
        const connectedChannels: string[] = []
        if (connectorData.email_provider) connectedChannels.push(connectorData.email_provider)
        if (connectorData.linkedin_connected) connectedChannels.push('LinkedIn')
        if (connectorData.sms_provider) connectedChannels.push('SMS')
        if (connectorData.phone_provider) connectedChannels.push('Phone')

        internalData.connectors = {
          emailConnected: !!connectorData.email_provider,
          emailProvider: connectorData.email_provider,
          smsConnected: !!connectorData.sms_provider,
          linkedinConnected: connectorData.linkedin_connected,
          phoneConnected: !!connectorData.phone_provider,
        }
        internalData.summary!.connectedChannels = connectedChannels
      }
    } catch (error) {
      console.log('Connector data not found:', error.message)
    }

    // **2. Fetch campaigns (for campaign-related questions)**
    if (messageLower.includes('campaign') || sessionType === 'campaign' || 
        messageLower.includes('how many') || messageLower.includes('status')) {
      try {
        const { data: campaignData, count } = await supabaseClient
          .from('campaigns')
          .select('id, name, type, status, created_at, sent_count, opened_count, replied_count', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (campaignData) {
          internalData.campaigns = campaignData
          internalData.summary!.totalCampaigns = count || campaignData.length
          internalData.summary!.activeCampaigns = campaignData.filter((c: any) => c.status === 'active').length
        }
      } catch (error) {
        console.log('Campaign data not found:', error.message)
      }
    }

    // **3. Fetch contacts (for contact/lead questions)**
    if (messageLower.includes('contact') || messageLower.includes('lead') || 
        messageLower.includes('how many') || sessionType === 'analysis') {
      try {
        const { data: contactData, count } = await supabaseClient
          .from('contacts')
          .select('id, first_name, last_name, email, company, stage, score, created_at', { count: 'exact' })
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(15)
        
        if (contactData) {
          internalData.contacts = contactData
          internalData.summary!.totalContacts = count || contactData.length
        }
      } catch (error) {
        console.log('Contact data not found:', error.message)
      }
    }

    // **4. Fetch recent activity (interactions + responses)**
    if (messageLower.includes('activity') || messageLower.includes('recent') || 
        messageLower.includes('interaction') || sessionType === 'analysis') {
      try {
        const { data: interactionData } = await supabaseClient
          .from('contact_interactions')
          .select('interaction_type, subject, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (interactionData) {
          internalData.recentActivity = interactionData
          internalData.summary!.recentInteractions = interactionData.length
        }
      } catch (error) {
        console.log('Interaction data not found:', error.message)
      }

      // Also fetch campaign responses (inbox messages)
      try {
        const { data: responseData } = await supabaseClient
          .from('campaign_responses')
          .select('channel, intent_tag, is_read, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10)
        
        if (responseData) {
          internalData.campaignResponses = responseData
        }
      } catch (error) {
        console.log('Campaign response data not found:', error.message)
      }
    }

    // **5. Fetch Agent Sophia data (for AI agent questions)**
    if (messageLower.includes('sophia') || messageLower.includes('agent') || 
        messageLower.includes('ai sdr') || messageLower.includes('automation')) {
      try {
        // Get Agent Sophia configuration
        const { data: sophiaConfig } = await supabaseClient
          .from('agent_configs')
          .select('*')
          .eq('user_id', userId)
          .single()
        
        if (sophiaConfig) {
          internalData.agentSophia = {
            config: sophiaConfig,
            isActive: sophiaConfig.is_active,
            recentActivity: [],
            totalActivities: 0
          }
          internalData.summary!.sophiaActive = sophiaConfig.is_active
          
          // Get recent Agent Sophia activity
          const { data: activityData, count } = await supabaseClient
            .from('agent_activities')
            .select('activity_type, action_taken, outcome, created_at', { count: 'exact' })
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10)
          
          if (activityData) {
            internalData.agentSophia.recentActivity = activityData
            internalData.agentSophia.totalActivities = count || 0
          }
        }
      } catch (error) {
        console.log('Agent Sophia data not found:', error.message)
      }
    }

  } catch (error) {
    console.error('Error retrieving internal data:', error)
    // Continue without internal data if there's an error
  }

  return internalData
}

/**
 * Try to answer simple factual questions from internal data without calling OpenAI
 * Returns null if OpenAI is needed
 */
function tryAnswerFromInternalData(userMessage: string, internalData: InternalData): string | null {
  const messageLower = userMessage.toLowerCase()

  // **CONNECTOR STATUS QUERIES**
  if ((messageLower.includes('connected') || messageLower.includes('setup')) && internalData.connectors) {
    const { emailConnected, emailProvider, linkedinConnected, smsConnected, phoneConnected } = internalData.connectors

    // Specific channel queries
    if (messageLower.includes('email') && !messageLower.includes('campaign')) {
      if (emailConnected) {
        return `✅ Your email is connected via ${emailProvider.toUpperCase()}. You're all set to send email campaigns!`
      } else {
        return `❌ You haven't connected an email provider yet. Go to Connectors → Email to set up Gmail, Outlook, SendGrid, or Resend.`
      }
    }

    if (messageLower.includes('linkedin')) {
      if (linkedinConnected) {
        return `✅ Your LinkedIn account is connected and ready for outreach campaigns!`
      } else {
        return `❌ LinkedIn is not connected. Go to Connectors → LinkedIn to connect your account via OAuth.`
      }
    }

    if (messageLower.includes('sms')) {
      if (smsConnected) {
        return `✅ SMS is configured and ready to use in campaigns.`
      } else {
        return `❌ SMS is not set up. Go to Connectors → SMS to configure Twilio or Vonage.`
      }
    }

    // General status check
    if ((messageLower.includes('what') || messageLower.includes('which')) && 
        (messageLower.includes('connected') || messageLower.includes('channel'))) {
      const connected: string[] = []
      const notConnected: string[] = []
      
      if (emailConnected) connected.push(`Email (${emailProvider})`)
      else notConnected.push('Email')
      
      if (linkedinConnected) connected.push('LinkedIn')
      else notConnected.push('LinkedIn')
      
      if (smsConnected) connected.push('SMS')
      else notConnected.push('SMS')
      
      if (phoneConnected) connected.push('Phone/Voice')
      else notConnected.push('Phone/Voice')

      return `**Connected Channels:**\n${connected.length > 0 ? '✅ ' + connected.join(', ') : 'None'}\n\n**Not Connected:**\n${notConnected.length > 0 ? '❌ ' + notConnected.join(', ') : 'None'}\n\nGo to the Connectors page to set up any missing integrations.`
    }
  }

  // **CAMPAIGN QUERIES**
  if (internalData.campaigns && messageLower.includes('campaign')) {
    // Count queries
    if ((messageLower.includes('how many') || messageLower.includes('number')) && 
        !messageLower.includes('contact')) {
      const total = internalData.summary?.totalCampaigns || 0
      const active = internalData.summary?.activeCampaigns || 0
      
      return `📊 **Campaign Summary:**\n- Total campaigns: ${total}\n- Active campaigns: ${active}\n- Paused/Completed: ${total - active}\n\nGo to the Campaigns page to view details.`
    }

    // List active campaigns
    if (messageLower.includes('active') || messageLower.includes('running')) {
      const activeCampaigns = internalData.campaigns.filter((c: any) => c.status === 'active')
      
      if (activeCampaigns.length === 0) {
        return `❌ You don't have any active campaigns right now. Create a new campaign to start outreach!`
      }
      
      const list = activeCampaigns.map((c: any) => 
        `- **${c.name}** (${c.type}) - Sent: ${c.sent_count || 0}, Replies: ${c.replied_count || 0}`
      ).join('\n')
      
      return `🚀 **Active Campaigns (${activeCampaigns.length}):**\n${list}`
    }
  }

  // **CONTACT QUERIES**
  if (internalData.contacts && (messageLower.includes('contact') || messageLower.includes('lead'))) {
    // Count queries
    if (messageLower.includes('how many') || messageLower.includes('number')) {
      const total = internalData.summary?.totalContacts || 0
      
      return `📇 **Contact Summary:**\n- Total contacts: ${total}\n\nGo to the Contacts page to view and manage your leads.`
    }

    // Recent contacts
    if (messageLower.includes('recent') || messageLower.includes('latest')) {
      const recent = internalData.contacts.slice(0, 5)
      const list = recent.map((c: any) => 
        `- ${c.first_name} ${c.last_name} (${c.company || 'No company'}) - Stage: ${c.stage}`
      ).join('\n')
      
      return `👥 **Recent Contacts (${recent.length}):**\n${list}`
    }
  }

  // **AGENT SOPHIA QUERIES**
  if ((messageLower.includes('sophia') || messageLower.includes('agent') || 
       messageLower.includes('ai sdr') || messageLower.includes('automat')) && internalData.agentSophia) {
    
    // Is Sophia active?
    if (messageLower.includes('active') || messageLower.includes('running') || 
        messageLower.includes('on') || messageLower.includes('working')) {
      if (internalData.agentSophia.isActive) {
        const config = internalData.agentSophia.config
        return `🤖 **Agent Sophia is ACTIVE!**

**Status:** ✅ Running
**Autonomy Level:** ${config.autonomy_level.replace('_', ' ')}
**Daily Limit:** ${config.daily_limits?.max_messages_per_day || 100} messages/day
**Total Actions:** ${internalData.agentSophia.totalActivities || 0}

Sophia is actively qualifying leads, analyzing responses, and sending follow-ups!`
      } else {
        return `🤖 **Agent Sophia is INACTIVE**

**Status:** ⏸️ Not running
**Configuration:** Set up, but not activated

To activate Sophia, go to the Agent Sophia page and toggle "Activate" ON.`
      }
    }

    // How to use Sophia?
    if (messageLower.includes('how') || messageLower.includes('use') || messageLower.includes('setup')) {
      return `🤖 **How to Use Agent Sophia:**

**1. Configure Settings:**
   - Go to Agent Sophia page
   - Choose autonomy level (Manual, Semi-Autonomous, or Fully Autonomous)
   - Set working hours & timezone
   - Configure daily activity limits
   - Set minimum lead score threshold

**2. Set Decision Criteria:**
   - Choose which intents trigger auto-responses
   - Configure meeting booking
   - Add your email signature

**3. Activate:**
   - Click "Save Configuration"
   - Toggle "Activate Agent Sophia" ON
   - Check Activity Log to monitor her work

**What Sophia Does:**
✅ Qualifies leads automatically
✅ Analyzes prospect responses
✅ Sends personalized follow-ups
✅ Books meetings with qualified leads
✅ Escalates complex cases to you

Need help with specific settings? Just ask!`
    }

    // What can Sophia do?
    if (messageLower.includes('what') && (messageLower.includes('do') || messageLower.includes('can'))) {
      return `🤖 **Agent Sophia Capabilities:**

**Lead Qualification:**
- AI-powered lead scoring
- Rule-based + GPT-4o analysis
- Automatic filtering by criteria

**Response Analysis:**
- Detects intent (interested, objection, question, etc.)
- Analyzes engagement level
- Determines next best action

**Smart Follow-ups:**
- Generates contextual messages
- Adapts tone to engagement level
- References conversation history

**Meeting Booking:**
- Auto-schedules with qualified leads
- Integrates with Calendly/Cal.com
- Sends calendar invitations

**Activity Tracking:**
- Logs every action
- Full transparency & audit trail
- CSV export for reporting

**Safety Features:**
- Daily activity limits
- Working hours enforcement
- Human approval workflows
- Confidence scoring

Sophia works 24/7 to nurture your leads while you focus on closing deals!`
    }

    // Sophia status summary
    if (messageLower.includes('status') || messageLower.includes('sophiainfo')) {
      const config = internalData.agentSophia.config
      const recent = internalData.agentSophia.recentActivity || []
      
      return `🤖 **Agent Sophia Status:**

**Status:** ${internalData.agentSophia.isActive ? '✅ Active' : '⏸️ Inactive'}
**Autonomy:** ${config.autonomy_level.replace('_', ' ')}
**Daily Limit:** ${config.daily_limits?.max_messages_per_day || 100}/day
**Total Activities:** ${internalData.agentSophia.totalActivities || 0}

**Recent Actions (${recent.length}):**
${recent.slice(0, 5).map((a: any) => `- ${a.activity_type}: ${a.action_taken} (${a.outcome})`).join('\n') || 'No recent activity'}

Go to Agent Sophia page to adjust settings or view detailed activity log.`
    }
  }

  // **DASHBOARD/OVERVIEW QUERIES**
  if ((messageLower.includes('overview') || messageLower.includes('dashboard') || 
       messageLower.includes('summary') || messageLower === 'stats' || 
       messageLower === 'statistics') && internalData.summary) {
    const { totalCampaigns, activeCampaigns, totalContacts, connectedChannels, sophiaActive } = internalData.summary
    
    return `📊 **Platform Overview:**

**Campaigns:** ${totalCampaigns} total (${activeCampaigns} active)
**Contacts:** ${totalContacts} total
**Connected Channels:** ${connectedChannels.length > 0 ? connectedChannels.join(', ') : 'None'}
**Recent Activity:** ${internalData.recentActivity?.length || 0} interactions
**Agent Sophia:** ${sophiaActive ? '✅ Active' : '⏸️ Inactive'}

Ready to help! What would you like to work on?`
  }

  return null // Need OpenAI for this question
}

/**
 * Build system message with internal data context
 */
function getSystemMessage(
  sessionType: string, 
  context?: Record<string, any>,
  internalData?: InternalData
): ChatMessage {
  const basePrompt = `You are an AI assistant for an AI-powered lead generation and sales automation platform. Your CORE PURPOSE is helping users BUILD CAMPAIGNS and WORKFLOWS, not technical setup.

**FOCUS AREAS - What You Help With:**
1. **Campaign Building** - Strategy, channel selection, audience targeting, timing
2. **Workflow Design** - Multi-step sequences, branching logic, automation rules
3. **Message Crafting** - Copywriting tips, personalization, call-to-action optimization
4. **Lead Analysis** - Performance insights, intent classification, qualification strategies
5. **Agent Sophia Configuration** - Autonomy levels, safety limits, monitoring (NOT API keys)

**OUT OF SCOPE - What You DON'T Help With:**
- API Key setup or management (go to Settings → Integrations)
- CRM/connector configuration (contact admin/support)
- HubSpot, Salesforce, or third-party integration setup
- Technical infrastructure or authentication
- Billing or account management

**AGENT SOPHIA - AI SDR:**
Agent Sophia is an autonomous AI Sales Development Representative that works 24/7 to:
- Qualify leads automatically (AI + rule-based scoring)
- Analyze prospect responses and detect intent
- Send personalized, contextual follow-ups
- Book meetings with qualified leads
- Escalate complex cases to humans

**Key Features:**
- 3 autonomy levels: Manual, Semi-Autonomous, Fully Autonomous
- GPT-4o powered decision engine
- Working hours & daily limits (safety controls)
- Activity tracking & full transparency
- Costs $5-10/month (handles 100-500 leads)

**How to Help Users:**
- Explain Sophia's capabilities clearly
- Guide configuration: Agent Sophia page → Configure → Save → Activate
- Help troubleshoot workflow/campaign issues
- Explain autonomy levels and when to use each
- Show how to monitor activity via Activity Log
- For API/integration questions: "That's outside my focus - visit Settings → Integrations or contact support"`
  
  // Add internal data to context
  let dataContext = ""
  
  if (internalData?.summary) {
    dataContext += `\n\n**USER'S PLATFORM STATUS:**\n`
    dataContext += `- Total Campaigns: ${internalData.summary.totalCampaigns} (${internalData.summary.activeCampaigns} active)\n`
    dataContext += `- Total Contacts: ${internalData.summary.totalContacts}\n`
    dataContext += `- Connected Channels: ${internalData.summary.connectedChannels.join(', ') || 'None'}\n`
  }
  
  if (internalData?.connectors) {
    dataContext += `\n**Connected Integrations:**\n${JSON.stringify(internalData.connectors, null, 2)}`
  }
  
  if (internalData?.campaigns && internalData.campaigns.length > 0) {
    dataContext += `\n\n**Recent Campaigns (${internalData.campaigns.length}):**\n`
    internalData.campaigns.slice(0, 5).forEach((c: any) => {
      dataContext += `- ${c.name} (${c.type}, ${c.status}) - Sent: ${c.sent_count || 0}, Opened: ${c.opened_count || 0}, Replied: ${c.replied_count || 0}\n`
    })
  }
  
  if (internalData?.contacts && internalData.contacts.length > 0) {
    dataContext += `\n\n**Sample Contacts (${internalData.contacts.length}):**\n`
    internalData.contacts.slice(0, 5).forEach((c: any) => {
      dataContext += `- ${c.first_name} ${c.last_name} at ${c.company || 'Unknown'} (${c.stage})\n`
    })
  }
  
  if (internalData?.recentActivity && internalData.recentActivity.length > 0) {
    dataContext += `\n\n**Recent Activity:**\n`
    internalData.recentActivity.slice(0, 5).forEach((a: any) => {
      dataContext += `- ${a.interaction_type}: ${a.subject || 'No subject'}\n`
    })
  }
  
  if (internalData?.agentSophia) {
    dataContext += `\n\n**Agent Sophia (AI SDR):**\n`
    dataContext += `- Status: ${internalData.agentSophia.isActive ? 'ACTIVE ✅' : 'INACTIVE ⏸️'}\n`
    if (internalData.agentSophia.config) {
      dataContext += `- Autonomy: ${internalData.agentSophia.config.autonomy_level}\n`
      dataContext += `- Daily Limit: ${internalData.agentSophia.config.daily_limits?.max_messages_per_day || 100}/day\n`
      dataContext += `- Total Activities: ${internalData.agentSophia.totalActivities || 0}\n`
    }
    if (internalData.agentSophia.recentActivity && internalData.agentSophia.recentActivity.length > 0) {
      dataContext += `- Recent Actions: ${internalData.agentSophia.recentActivity.slice(0, 3).map((a: any) => a.activity_type).join(', ')}\n`
    }
  }
  
  switch (sessionType) {
    case 'workflow':
      return {
        role: 'system',
        content: `${basePrompt} You are helping the user create or optimize an AI workflow for lead generation. Focus on practical, actionable automation suggestions based on their current setup.${dataContext}`
      }
    case 'campaign':
      return {
        role: 'system',
        content: `${basePrompt} You are helping the user create a multi-channel outreach campaign. Provide specific recommendations for messaging, targeting, and timing based on their connected channels and existing campaigns.${dataContext}`
      }
    case 'analysis':
      return {
        role: 'system',
        content: `${basePrompt} You are analyzing lead data and campaign performance. Provide data-driven insights and actionable recommendations based on the user's actual campaign metrics and contact data.${dataContext}${context ? `\n\nAdditional Context: ${JSON.stringify(context)}` : ''}`
      }
    default:
      return {
        role: 'system',
        content: `${basePrompt} Use the user's actual platform data to provide personalized, relevant assistance.${dataContext}`
      }
  }
}
