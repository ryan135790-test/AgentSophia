/**
 * Workflow Builder Help System
 * Provides intelligent tips for visual workflow creation
 */

export const WORKFLOW_NODE_TIPS = {
  send_email: "📧 Email Node: Delivers personalized message. Pro: Add delay before next node (2-3 days) for better engagement.",
  send_sms: "📱 SMS Node: Send text message. Keep it SHORT (160 chars). Gets 98% open rate but use sparingly!",
  send_linkedin: "🔗 LinkedIn Node: Native LinkedIn message. Wait 3-5 days between touches for best response.",
  wait: "⏱️ Wait/Delay Node: Pause before next action. Timing is CRUCIAL - wait 2-3 days between touches for 2.5x conversion.",
  condition: "🔀 Decision/Condition Node: Branch based on IF (opened, replied, clicked). Build different paths for different behaviors.",
  send_slack: "💬 Slack Node: Send to internal team. Great for alerts when prospect replies.",
  add_to_list: "📋 List Node: Move prospect to segment. Use this to tag engaged prospects for sales team follow-up."
};

export const WORKFLOW_TEMPLATES = [
  {
    name: "3-Email Sequence",
    description: "Send 3 emails over 10 days",
    nodes: [
      { type: "send_email", label: "Email 1: Intro", delay: 0 },
      { type: "wait", label: "Wait 3 days", delay: 3 },
      { type: "send_email", label: "Email 2: Value", delay: 0 },
      { type: "wait", label: "Wait 3 days", delay: 3 },
      { type: "send_email", label: "Email 3: Urgency", delay: 0 }
    ],
    tip: "🚀 Classic 3-email sequence. Response rates jump 45% with multi-touch!"
  },
  {
    name: "Email + SMS Combo",
    description: "Email sequence with SMS follow-up",
    nodes: [
      { type: "send_email", label: "Email: Intro", delay: 0 },
      { type: "wait", label: "Wait 2 days", delay: 2 },
      { type: "send_sms", label: "SMS: Quick followup", delay: 0 },
      { type: "wait", label: "Wait 2 days", delay: 2 },
      { type: "send_email", label: "Email: Last touch", delay: 0 }
    ],
    tip: "💥 Email + SMS = best of both worlds. SMS converts 17x faster than email!"
  },
  {
    name: "Smart Branch (If Opened)",
    description: "Different message if they opened vs didn't",
    nodes: [
      { type: "send_email", label: "Email 1", delay: 0 },
      { type: "wait", label: "Wait 3 days", delay: 3 },
      { type: "condition", label: "Did they open?", condition: "opened" },
      { type: "send_email", label: "Email 2a (YES - deep dive)", branch: "yes" },
      { type: "send_email", label: "Email 2b (NO - try again)", branch: "no" }
    ],
    tip: "🔀 Personalization by behavior = 26% revenue lift (Experian)!"
  },
  {
    name: "Multi-Channel Launch",
    description: "LinkedIn + Email simultaneously",
    nodes: [
      { type: "send_linkedin", label: "LinkedIn: Connect", delay: 0 },
      { type: "send_email", label: "Email: Meeting request", delay: 0 },
      { type: "wait", label: "Wait 5 days", delay: 5 },
      { type: "send_linkedin", label: "LinkedIn: Value message", delay: 0 },
      { type: "wait", label: "Wait 5 days", delay: 5 },
      { type: "send_email", label: "Email: Last touch", delay: 0 }
    ],
    tip: "📡 Multi-channel = 3x conversion! LinkedIn builds credibility, email closes."
  }
];

export const WORKFLOW_BEST_PRACTICES = [
  "⏱️ Timing: Wait 2-3 days between touches. Too fast = annoying. Too slow = forgotten.",
  "🔀 Branching: Always split on opens/clicks. Engaged prospects get different message.",
  "🚀 Multi-touch: 5-7 touches warms up cold leads. Build sequences, not blasts!",
  "📧 Channel mix: Email for thought leadership, SMS for urgency, LinkedIn for B2B credibility.",
  "🎯 Segmentation: Different workflows for different audience types. Personalization = conversion!",
  "📊 Track: Monitor open rates, click rates, reply rates at each step.",
  "♻️ Reuse: Save successful workflows as templates. Replicate what works!"
];

/**
 * Get help for workflow node type
 */
export function getNodeTip(nodeType: string): string {
  return WORKFLOW_NODE_TIPS[nodeType as keyof typeof WORKFLOW_NODE_TIPS] || "Node: Add step to workflow. Configure in settings.";
}

/**
 * Suggest workflow template based on channels
 */
export function suggestWorkflowTemplate(channels: string[]): typeof WORKFLOW_TEMPLATES[0] | null {
  if (channels.includes('email') && channels.includes('sms')) {
    return WORKFLOW_TEMPLATES[1]; // Email + SMS
  }
  if (channels.includes('linkedin')) {
    return WORKFLOW_TEMPLATES[3]; // Multi-channel
  }
  if (channels.length === 1) {
    return WORKFLOW_TEMPLATES[0]; // 3-Email sequence
  }
  return WORKFLOW_TEMPLATES[0];
}
