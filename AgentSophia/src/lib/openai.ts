import OpenAI from "openai";

// Multi-provider fallback system for AI campaign generation
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user

export interface BrandVoice {
  companyName?: string;
  tone: string; // e.g., "professional", "casual", "friendly", "authoritative"
  industry?: string;
  values?: string[];
  writingStyle?: string;
  avoidWords?: string[];
  keyMessages?: string[];
}

export interface CampaignGenerationRequest {
  goal: string;
  targetAudience?: string;
  channels: string[];
  contactCount: number;
  numberOfSteps?: number;
  brandVoice?: BrandVoice;
}

export interface CampaignStep {
  channel: 'email' | 'linkedin' | 'sms' | 'phone' | 'social' | 'voicemail';
  delay: number;
  content: string;
  subject?: string;
  variations?: string[]; // 3 slight variations of the content for natural randomization
}

export interface CampaignVersion {
  name: string;
  targetAudience: string;
  strategy: string;
  score: number;
  reasoning: string;
  steps: CampaignStep[];
}

export interface GeneratedCampaignVersions {
  versions: CampaignVersion[];
}

export interface GeneratedCampaign {
  targetAudience: string;
  steps: CampaignStep[];
  strategy: string;
}

export interface WorkflowGenerationRequest {
  goal: string;
  targetAudience: string;
  numberOfSteps?: number; // Default to 9
  channels?: string[]; // Preferred channels to use
  industry?: string; // B2B, B2C, SaaS, etc.
  brandVoice?: BrandVoice;
  // AI Smart Tools
  smartTiming?: boolean; // Optimize send times based on B2B best practices
  personalization?: boolean; // Auto-personalize messages with contact variables
  intentClassification?: boolean; // Add conditional logic for response categorization
}

export interface WorkflowNode {
  id: string;
  type: 'email' | 'linkedin_connect' | 'linkedin_message' | 'sms' | 'wait' | 'condition' | 'webhook';
  label: string;
  position: { x: number; y: number };
  config: {
    subject?: string;
    body?: string;
    message?: string;
    duration?: number; // for wait nodes in hours
    condition?: string; // for condition nodes
    webhookUrl?: string; // for webhook nodes
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string; // for conditional branches
}

export interface GeneratedWorkflow {
  name: string;
  description: string;
  targetAudience: string;
  strategy: string;
  totalDuration: number; // in days
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  reasoning: string; // AI's explanation of the workflow structure
}

// Smart template-based campaign generator (fallback)
function generateSmartCampaign(request: CampaignGenerationRequest): GeneratedCampaign {
  const goal = request.goal.toLowerCase();
  const isDemo = goal.includes('demo') || goal.includes('meeting') || goal.includes('call');
  const requestedSteps = request.numberOfSteps || 5;

  // Detect industry/role from goal
  const goalWords = request.goal.split(' ');
  const keyTerms = goalWords.filter(w => w.length > 4).slice(0, 3).join(', ') || 'your goals';

  const targetAudience = request.targetAudience || 'Decision makers and influencers';
  const channelNames = request.channels.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
  
  const steps: CampaignStep[] = [];
  const selectedChannels = request.channels;
  
  // Step templates for each channel type
  const emailTemplates = [
    {
      subject: `Quick question about ${keyTerms} at {{company}}`,
      content: `Hi {{first_name}},\n\nI noticed your role at {{company}} and thought I'd reach out. I've been helping companies like yours with ${request.goal}.\n\nWe've seen impressive results:\n• Significant improvements in efficiency\n• Measurable ROI within weeks\n• Seamless integration\n\nWould you be open to a brief 15-minute call next week?\n\nBest regards,\n{{sender_name}}`
    },
    {
      subject: `Following up - ${keyTerms}`,
      content: `Hi {{first_name}},\n\nI wanted to follow up on my previous message about ${request.goal}.\n\nI understand you're busy, so I'll keep this brief:\n\n✓ We specialize in ${keyTerms}\n✓ Proven track record with similar companies\n✓ Quick implementation with minimal disruption\n\nWould you be interested in a brief case study relevant to {{company}}?\n\nBest,\n{{sender_name}}`
    },
    {
      subject: `${keyTerms} - quick resource for {{company}}`,
      content: `Hi {{first_name}},\n\nI've been researching {{company}} and believe there's a strong fit for what we do around ${keyTerms}.\n\nI put together a quick resource that shows how similar companies have achieved significant results. Would you like me to send it over?\n\nNo pressure either way - just thought it might be useful.\n\nCheers,\n{{sender_name}}`
    },
    {
      subject: `Re: ${keyTerms} at {{company}}`,
      content: `Hi {{first_name}},\n\nJust circling back one more time. I know inboxes get busy!\n\nIf ${request.goal} is still on your radar, I'd love to share how we've helped companies similar to {{company}} achieve their goals.\n\nWould a quick 10-minute call work for you this week or next?\n\nBest,\n{{sender_name}}`
    },
    {
      subject: `Last follow-up - ${keyTerms}`,
      content: `Hi {{first_name}},\n\nThis will be my last message. I understand timing isn't always right.\n\nIf things change and you'd like to explore ${keyTerms}, feel free to reach out anytime. I'm always happy to help.\n\nWishing you and the {{company}} team continued success!\n\nBest wishes,\n{{sender_name}}`
    }
  ];

  const linkedinTemplates = [
    {
      subject: 'Connection Request',
      content: `Hi {{first_name}},\n\nI noticed your role at {{company}} and thought we should connect. I'm focused on helping leaders with ${keyTerms} and believe we could exchange valuable insights.\n\nLooking forward to connecting!`
    },
    {
      subject: 'LinkedIn Follow-up',
      content: `Hi {{first_name}},\n\nThanks for connecting! I wanted to reach out because I've been helping companies like {{company}} with ${request.goal}.\n\nWould you be open to a quick chat about how we might be able to help?\n\nBest regards`
    },
    {
      subject: 'LinkedIn Value Share',
      content: `Hi {{first_name}},\n\nI came across an interesting case study about ${keyTerms} that I thought might be relevant to {{company}}.\n\nWould you like me to share it? No strings attached - just thought it might be useful for your team.\n\nCheers!`
    },
    {
      subject: 'LinkedIn Soft Touch',
      content: `Hi {{first_name}},\n\nI've been following {{company}}'s progress and I'm impressed with what you're building.\n\nIf you ever want to discuss ${keyTerms} strategies, I'd be happy to share some insights from my experience working with similar companies.\n\nNo pressure - just here if helpful!`
    },
    {
      subject: 'LinkedIn Final Message',
      content: `Hi {{first_name}},\n\nI've reached out a couple of times about ${keyTerms} and haven't heard back, so this will be my last message.\n\nIf the timing isn't right now, no problem at all! Feel free to reach out if things change.\n\nWishing you and {{company}} continued success!`
    }
  ];

  const smsTemplates = [
    { content: `Hi {{first_name}}, this is {{sender_name}}. Quick question: would you be open to exploring how we can help with ${request.goal}? Reply YES to chat! 📱` },
    { content: `Hey {{first_name}}, {{sender_name}} here. Just wanted to follow up on my email about ${keyTerms}. Got 5 mins to chat this week?` },
    { content: `{{first_name}}, saw some interesting results from companies like {{company}} on ${keyTerms}. Want me to share? 📊` },
    { content: `Hi {{first_name}}, {{sender_name}} again. Last quick check - still interested in exploring ${request.goal}? Let me know! 👋` },
    { content: `{{first_name}}, final follow-up on ${keyTerms}. No pressure, but here if you need anything! All the best - {{sender_name}}` }
  ];

  const phoneTemplates = [
    { subject: 'AI Voice Call - Intro', content: `Hi {{first_name}}, this is an AI assistant calling on behalf of {{sender_name}}. I'm reaching out about ${keyTerms} and how we can help {{company}} with ${request.goal}. Press 1 to be connected with our team, or press 2 to schedule a callback.` },
    { subject: 'AI Voice Call - Follow-up', content: `Hi {{first_name}}, this is a follow-up call about ${request.goal}. We've been helping companies like {{company}} achieve significant results. Press 1 to speak with {{sender_name}}, or press 2 to schedule a time that works better.` },
    { subject: 'AI Voice Call - Value', content: `Hello {{first_name}}, calling from {{sender_name}}'s office about ${keyTerms}. We have some exciting results to share that are relevant to {{company}}. Press 1 to connect now, or 2 to receive information by email.` }
  ];

  const socialTemplates = [
    { subject: 'Social Post - Intro', content: `🚀 Calling all ${keyTerms} professionals! We're helping companies transform their approach to ${request.goal}. Drop a comment if you'd like to learn more! #Growth #Innovation` },
    { subject: 'Social Post - Value', content: `💡 Interesting insight: Companies focusing on ${keyTerms} are seeing 3x better results. Want to know how? DM us! #BusinessGrowth #Strategy` },
    { subject: 'Social Post - Case Study', content: `📈 Case study alert! See how we helped a company like yours achieve incredible results with ${request.goal}. Link in bio! #Success #Results` }
  ];

  const voicemailTemplates = [
    { subject: 'Voicemail - Intro', content: `Hi {{first_name}}, this is {{sender_name}}. I'm reaching out about ${keyTerms} and how we might be able to help {{company}}. I'd love to connect briefly - please call me back at your convenience or reply to my email. Looking forward to speaking with you!` },
    { subject: 'Voicemail - Follow-up', content: `Hi {{first_name}}, {{sender_name}} again. I left you a message earlier about ${request.goal}. Just wanted to follow up - we've been helping companies like {{company}} see great results. Feel free to call me back or shoot me an email. Thanks!` },
    { subject: 'Voicemail - Final', content: `Hi {{first_name}}, this is {{sender_name}} with one last voicemail about ${keyTerms}. No pressure at all, but if timing ever becomes right for {{company}}, I'm here to help. All the best!` }
  ];

  // Build step sequence based on requested count and selected channels
  const delays = [0, 2, 4, 5, 7, 10, 12, 14, 17, 21]; // Day delays for each step
  const channelIndex: Record<string, number> = {};
  
  for (let i = 0; i < requestedSteps; i++) {
    // Cycle through selected channels
    const channelForStep = selectedChannels[i % selectedChannels.length];
    channelIndex[channelForStep] = (channelIndex[channelForStep] || 0);
    const templateIndex = channelIndex[channelForStep];
    
    let step: CampaignStep;
    
    if (channelForStep === 'email') {
      const template = emailTemplates[Math.min(templateIndex, emailTemplates.length - 1)];
      step = {
        channel: 'email',
        delay: delays[i] || i * 3,
        subject: template.subject,
        content: template.content
      };
    } else if (channelForStep === 'linkedin') {
      const template = linkedinTemplates[Math.min(templateIndex, linkedinTemplates.length - 1)];
      step = {
        channel: 'linkedin',
        delay: delays[i] || i * 3,
        subject: template.subject,
        content: template.content
      };
    } else if (channelForStep === 'sms') {
      const template = smsTemplates[Math.min(templateIndex, smsTemplates.length - 1)];
      step = {
        channel: 'sms',
        delay: delays[i] || i * 3,
        content: template.content
      };
    } else if (channelForStep === 'phone') {
      const template = phoneTemplates[Math.min(templateIndex, phoneTemplates.length - 1)];
      step = {
        channel: 'phone',
        delay: delays[i] || i * 3,
        subject: template.subject,
        content: template.content
      };
    } else if (channelForStep === 'voicemail') {
      const template = voicemailTemplates[Math.min(templateIndex, voicemailTemplates.length - 1)];
      step = {
        channel: 'voicemail',
        delay: delays[i] || i * 3,
        subject: template.subject,
        content: template.content
      };
    } else {
      const template = socialTemplates[Math.min(templateIndex, socialTemplates.length - 1)];
      step = {
        channel: 'social',
        delay: delays[i] || i * 3,
        subject: template.subject,
        content: template.content
      };
    }
    
    steps.push(step);
    channelIndex[channelForStep]++;
  }

  return {
    targetAudience,
    strategy: `This ${steps.length}-step campaign uses a professional, value-focused approach across ${channelNames}. The sequence is designed to build rapport, demonstrate value, and create multiple opportunities for engagement while respecting the recipient's time.`,
    steps
  };
}

// Generate 3 campaign versions with AI ranking
export async function generateCampaignVersions(
  request: CampaignGenerationRequest
): Promise<GeneratedCampaignVersions> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  
  // If no API key, create 3 variations using smart templates
  if (!apiKey || apiKey.trim() === '') {
    console.log('No OpenAI API key found, using smart template variations');
    const baseVersion = generateSmartCampaign(request);
    return {
      versions: [
        {
          name: "Recommended: Professional Outreach",
          ...baseVersion,
          score: 85,
          reasoning: "Balanced approach with proven touchpoints and professional tone"
        },
        {
          name: "Quick Win: Aggressive Follow-up",
          ...baseVersion,
          score: 75,
          reasoning: "More frequent touchpoints for faster response, may feel pushy"
        },
        {
          name: "Relationship Builder",
          ...baseVersion,
          score: 70,
          reasoning: "Slower cadence focused on building trust over time"
        }
      ]
    };
  }

  // Try OpenAI first
  try {
    const openai = new OpenAI({ 
      apiKey,
      dangerouslyAllowBrowser: true
    });

    const brandVoiceSection = request.brandVoice ? `
BRAND VOICE GUIDELINES:
Company Name: ${request.brandVoice.companyName || 'Not specified'}
Tone: ${request.brandVoice.tone}
Industry: ${request.brandVoice.industry || 'Not specified'}
${request.brandVoice.values && request.brandVoice.values.length > 0 ? `Brand Values: ${request.brandVoice.values.join(', ')}` : ''}
${request.brandVoice.writingStyle ? `Writing Style: ${request.brandVoice.writingStyle}` : ''}
${request.brandVoice.avoidWords && request.brandVoice.avoidWords.length > 0 ? `Words to Avoid: ${request.brandVoice.avoidWords.join(', ')}` : ''}
${request.brandVoice.keyMessages && request.brandVoice.keyMessages.length > 0 ? `Key Messages to Emphasize: ${request.brandVoice.keyMessages.join(', ')}` : ''}

CRITICAL: ALL campaign content MUST match this brand voice exactly. Use the specified tone, incorporate the values, and follow the writing style guidelines.` : '';

    const prompt = `You are an expert in B2B outreach and multichannel campaign strategy.

Create THREE different campaign variations with the following requirements:

GOAL: ${request.goal}
${request.targetAudience ? `TARGET AUDIENCE: ${request.targetAudience}` : ''}
AVAILABLE CHANNELS: ${request.channels.join(', ')}
NUMBER OF CONTACTS: ${request.contactCount}
${brandVoiceSection}

Generate 3 campaign variations and rank them in JSON format:
{
  "versions": [
    {
      "name": "Short descriptive name for this approach",
      "targetAudience": "Brief description of ideal target audience",
      "strategy": "Overview of the campaign approach and why it will be effective",
      "score": number from 1-100 (your confidence this will succeed),
      "reasoning": "Why you ranked it this score and its strengths/weaknesses",
      "steps": [
        {
          "channel": "linkedin" | "email" | "sms" | "phone" | "social",
          "delay": number of days after previous step,
          "subject": "Subject line (for email/social) or connection message purpose (for LinkedIn)",
          "content": "Primary message content with {{first_name}}, {{last_name}}, {{company}}, {{sender_name}} personalization variables",
          "variations": [
            "Variation 1: Slightly reworded version (5-15% different words/phrasing)",
            "Variation 2: Another subtle variation (5-15% different words/phrasing)",
            "Variation 3: Third subtle variation (5-15% different words/phrasing)"
          ]
        }
      ]
    }
  ]
}

Requirements for EACH version:
- Create EXACTLY ${request.numberOfSteps || 5} touchpoints using ONLY the selected channels: ${request.channels.join(', ')}
- Make each version DISTINCTLY DIFFERENT (e.g., aggressive vs consultative, short vs detailed, value-focused vs relationship-focused)
- Start with the most professional channel (LinkedIn or Email preferred)
- Use personalization variables: {{first_name}}, {{last_name}}, {{company}}, {{sender_name}}
- Keep messages professional, concise, and value-focused
- Include clear calls-to-action
- Space out touchpoints appropriately (0, 2, 4, 7, 10, 14 days)
- Cycle through the selected channels to create variety
- For SMS: Keep under 160 characters, friendly and brief
- For Phone: Write a script for an AI voice assistant
- For Social: Create engaging posts with hashtags and emojis

CRITICAL - Message Variations:
- For EACH step, create 3 subtle variations in the "variations" array
- Each variation should be 5-15% different from the original content
- Keep the same meaning and tone, just rephrase slightly
- This makes messages look more natural and avoids spam detection
- Variations should maintain the same personalization variables
- Example: "I hope this email finds you well" → "Hope you're doing well" → "I trust this finds you well"

ORDER the versions array by score (highest first). The best version should be first.

Return ONLY valid JSON, no markdown formatting.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert B2B outreach strategist. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content) as GeneratedCampaignVersions;
    console.log('3 Campaign versions generated successfully with OpenAI');
    return result;
  } catch (error: any) {
    console.warn('OpenAI failed, falling back to smart template variations:', error?.message || error);
    
    // Always fall back to smart templates - create 3 variations
    const baseVersion = generateSmartCampaign(request);
    return {
      versions: [
        {
          name: "Recommended: Professional Outreach",
          ...baseVersion,
          score: 85,
          reasoning: "Balanced approach with proven touchpoints and professional tone"
        },
        {
          name: "Quick Win: Aggressive Follow-up",
          ...baseVersion,
          score: 75,
          reasoning: "More frequent touchpoints for faster response, may feel pushy"
        },
        {
          name: "Relationship Builder",
          ...baseVersion,
          score: 70,
          reasoning: "Slower cadence focused on building trust over time"
        }
      ]
    };
  }
}

// Original function for backwards compatibility
export async function generateCampaignWithAI(
  request: CampaignGenerationRequest
): Promise<GeneratedCampaign> {
  const versions = await generateCampaignVersions(request);
  // Return the highest-scored version
  return versions.versions[0];
}

// AI Workflow Generator - Creates complete visual workflows with optimal timing
export async function generateWorkflowWithAI(
  request: WorkflowGenerationRequest
): Promise<GeneratedWorkflow> {
  const numberOfSteps = request.numberOfSteps || 9;
  const channels = request.channels || ['email', 'linkedin_connect', 'linkedin_message', 'sms'];
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const brandContext = request.brandVoice ? `
Brand Voice Context:
- Company: ${request.brandVoice.companyName || 'Not specified'}
- Industry: ${request.brandVoice.industry || 'Not specified'}
- Tone: ${request.brandVoice.tone}
- Writing Style: ${request.brandVoice.writingStyle || 'Not specified'}
- Brand Values: ${request.brandVoice.values?.join(', ') || 'Not specified'}
- Words to Avoid: ${request.brandVoice.avoidWords?.join(', ') || 'None'}
- Key Messages: ${request.brandVoice.keyMessages?.join(', ') || 'Not specified'}
` : '';

    const smartToolsContext = `
AI Smart Tools Enabled:
${request.smartTiming !== false ? '✓ Smart Timing: Optimize send times for B2B best practices (avoid weekends, prefer Tuesday-Thursday 9am-11am and 2pm-4pm)' : '✗ Smart Timing disabled'}
${request.personalization !== false ? '✓ Personalization: Use {{first_name}}, {{last_name}}, {{company}}, {{role}}, {{industry}} variables in ALL messages' : '✗ Personalization disabled - use generic messages'}
${request.intentClassification !== false ? '✓ Intent Classification: Add Condition nodes to branch on engagement (e.g., "Replied?", "Opened?", "Clicked?")' : '✗ Intent Classification disabled - linear workflow only'}
`;

    const prompt = `You are an expert B2B sales workflow strategist. Create a ${numberOfSteps}-step visual workflow for the following campaign:

Campaign Goal: ${request.goal}
Target Audience: ${request.targetAudience}
Industry: ${request.industry || 'B2B SaaS'}
Preferred Channels: ${channels.join(', ')}
${brandContext}
${smartToolsContext}

Create an optimal workflow with these requirements:

1. WORKFLOW STRUCTURE:
   - Total steps: Exactly ${numberOfSteps} nodes (including wait nodes)
   - Use a mix of action nodes (email, LinkedIn, SMS) and wait nodes for optimal timing
   - Add 1-2 condition nodes for branching logic (e.g., "Replied?" or "Opened?")
   - Follow B2B best practices for timing and sequence
   
2. TIMING STRATEGY (Wait Nodes):
   - Day 0: Initial outreach (LinkedIn Connect or Email)
   - Wait 2-3 days before first follow-up
   - Wait 5-7 days before second follow-up
   - Wait 10-14 days before final touchpoint
   - Avoid weekends in B2B campaigns
   - Use condition nodes to branch based on engagement

3. CHANNEL SEQUENCE:
   - Start with least intrusive (LinkedIn Connect)
   - Follow with Email (more personal)
   - Use SMS sparingly (high urgency only)
   - Add LinkedIn Message after connection accepted

4. MESSAGING:
   - Write complete, personalized messages for each action node
   - Use variables: {{first_name}}, {{company}}, {{role}}
   - Include clear CTAs
   - Keep emails under 150 words
   - SMS under 160 characters

5. LAYOUT (Auto-positioning):
   - Arrange nodes vertically (x: 400, y: increments of 150)
   - Start at position (400, 100)

Return ONLY valid JSON in this EXACT format (no markdown):

{
  "name": "Campaign Name (max 60 chars)",
  "description": "Brief description of the workflow strategy",
  "targetAudience": "${request.targetAudience}",
  "strategy": "Detailed explanation of the workflow approach and timing rationale",
  "totalDuration": 21,
  "reasoning": "Explanation of why this workflow structure will be effective",
  "nodes": [
    {
      "id": "node-1",
      "type": "linkedin_connect",
      "label": "LinkedIn Connect Request",
      "position": { "x": 400, "y": 100 },
      "config": {
        "message": "Hi {{first_name}}, I noticed..."
      }
    },
    {
      "id": "node-2",
      "type": "wait",
      "label": "Wait 3 Days",
      "position": { "x": 400, "y": 250 },
      "config": {
        "duration": 72
      }
    },
    {
      "id": "node-3",
      "type": "email",
      "label": "Follow-up Email",
      "position": { "x": 400, "y": 400 },
      "config": {
        "subject": "Quick question about {{company}}",
        "body": "Hi {{first_name}},\\n\\n..."
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1-2",
      "source": "node-1",
      "target": "node-2"
    },
    {
      "id": "edge-2-3",
      "source": "node-2",
      "target": "node-3"
    }
  ]
}

IMPORTANT:
- Create EXACTLY ${numberOfSteps} nodes
- Include "Wait" nodes between action nodes
- Add at least 1 condition node for branching
- All node IDs must be unique
- All edge source/target IDs must match existing node IDs
- Position nodes vertically with 150px spacing
- Return ONLY valid JSON, no markdown formatting`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert B2B sales workflow strategist. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content) as GeneratedWorkflow;
    console.log('AI Workflow generated successfully with OpenAI');
    return result;

  } catch (error: any) {
    console.error('Workflow generation error:', error?.message || error);
    throw error;
  }
}
