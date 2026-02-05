export interface DocSection {
  id: string;
  title: string;
  path: string;
  description: string;
  keywords: string[];
  steps?: string[];
}

export const platformDocs: DocSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    path: '/dashboard',
    description: 'Your central hub showing key metrics, recent activity, and AI-powered insights from Agent Sophia.',
    keywords: ['dashboard', 'home', 'overview', 'metrics', 'analytics', 'start'],
    steps: [
      'View your pipeline value and conversion rates at a glance',
      'Check recent leads and their engagement status',
      'See Sophia\'s recommendations for immediate actions',
      'Monitor campaign performance across all channels'
    ]
  },
  {
    id: 'unified-inbox',
    title: 'Unified Inbox',
    path: '/unified-inbox',
    description: 'Manage all your conversations across Email, LinkedIn, SMS, and WhatsApp in one place with AI-powered intent detection.',
    keywords: ['inbox', 'messages', 'email', 'linkedin', 'conversations', 'replies', 'respond'],
    steps: [
      'Navigate to Unified Inbox from the sidebar',
      'Use the left panel to browse all incoming messages',
      'Click any message to view its full content in the center panel',
      'Use the right panel for AI-suggested responses and quick actions',
      'Sophia auto-classifies messages by intent (interested, meeting request, objection, etc.)'
    ]
  },
  {
    id: 'campaigns',
    title: 'Campaigns',
    path: '/campaigns',
    description: 'Create, manage, and monitor your multichannel outreach campaigns with visual workflow builders.',
    keywords: ['campaign', 'outreach', 'sequence', 'automation', 'email campaign', 'linkedin campaign'],
    steps: [
      'Go to Campaigns from the main menu',
      'Click "New Campaign" to create a multichannel sequence',
      'Use the visual workflow builder to add steps (Email, LinkedIn, SMS, Phone)',
      'Set delays between touchpoints',
      'Add contacts or lists to your campaign',
      'Launch and monitor performance in real-time'
    ]
  },
  {
    id: 'contacts',
    title: 'Contact Management',
    path: '/contacts',
    description: 'Your built-in CRM for managing leads and contacts with enrichment, tagging, and activity tracking.',
    keywords: ['contacts', 'leads', 'crm', 'people', 'prospects', 'import', 'csv'],
    steps: [
      'Access Contacts from the sidebar',
      'Import contacts via CSV or add them manually',
      'Use filters to segment by status, tags, or custom fields',
      'Click any contact to view their full profile and activity timeline',
      'Enrich contacts with email lookup using Hunter.io or Apollo.io credits'
    ]
  },
  {
    id: 'deals',
    title: 'Deal Pipeline',
    path: '/deals',
    description: 'Track your sales opportunities through customizable pipeline stages with AI health scoring.',
    keywords: ['deals', 'pipeline', 'opportunities', 'sales', 'revenue', 'forecast'],
    steps: [
      'Navigate to Deals from the menu',
      'Drag and drop deals between pipeline stages',
      'Click a deal to view details and add notes',
      'Sophia provides health scores to identify at-risk deals',
      'Use the forecast view to predict revenue'
    ]
  },
  {
    id: 'calendar',
    title: 'Calendar & Meetings',
    path: '/calendar',
    description: 'Schedule and manage meetings with Google Calendar integration for automatic booking.',
    keywords: ['calendar', 'meetings', 'schedule', 'book', 'appointment', 'google calendar'],
    steps: [
      'Connect your Google Calendar in My Connections',
      'View scheduled meetings in the Calendar page',
      'Book meetings directly from contact profiles',
      'Sophia can auto-book meetings when leads request them'
    ]
  },
  {
    id: 'workflow-builder',
    title: 'Workflow Builder',
    path: '/workflow-builder',
    description: 'Create automated multichannel sequences with a visual drag-and-drop canvas.',
    keywords: ['workflow', 'builder', 'automation', 'sequence', 'drag drop', 'visual'],
    steps: [
      'Open Workflow Builder from the Campaigns menu',
      'Drag nodes from the palette onto the canvas',
      'Connect nodes to create your sequence flow',
      'Configure each step with templates and timing',
      'Save and attach to a campaign'
    ]
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    path: '/analytics',
    description: 'Comprehensive reporting on campaign performance, revenue attribution, and ROI metrics.',
    keywords: ['analytics', 'reports', 'performance', 'metrics', 'roi', 'statistics'],
    steps: [
      'Go to Analytics from the sidebar',
      'View email open rates, click rates, and reply rates',
      'Track LinkedIn connection and message response rates',
      'See revenue attribution by campaign',
      'Export reports for stakeholder presentations'
    ]
  },
  {
    id: 'linkedin-automation',
    title: 'LinkedIn Automation',
    path: '/linkedin-automation',
    description: 'Automate LinkedIn outreach with connection requests, messages, and engagement actions safely.',
    keywords: ['linkedin', 'automation', 'connections', 'outreach', 'social selling'],
    steps: [
      'Connect your LinkedIn account in My Connections',
      'Set up daily limits in Rate Limiting settings',
      'Create LinkedIn sequences in the Campaign Builder',
      'Sophia monitors compliance to keep your account safe',
      'View LinkedIn inbox messages in Unified Inbox'
    ]
  },
  {
    id: 'decodo-setup',
    title: 'Decodo Mobile Proxy Setup',
    path: '/decodo-setup',
    description: 'Configure Decodo mobile proxy IPs for safe LinkedIn automation with real 4G/5G carrier IPs.',
    keywords: ['decodo', 'proxy', 'mobile', 'ip', 'smartproxy', 'linkedin proxy', 'mobile proxy'],
    steps: [
      'Create a Decodo account at decodo.com',
      'Get your proxy credentials from the dashboard',
      'Enter your username and password in the setup wizard',
      'Test the connection to verify it works',
      'Save to LinkedIn automation settings'
    ]
  },
  {
    id: 'brand-voice',
    title: 'Brand Voice Management',
    path: '/brand-voice',
    description: 'Define your company\'s tone and messaging style for AI-generated content.',
    keywords: ['brand', 'voice', 'tone', 'style', 'messaging', 'content'],
    steps: [
      'Go to Settings > Brand Voice',
      'Create a new brand voice profile',
      'Define your tone (professional, casual, friendly)',
      'Add example phrases and messaging guidelines',
      'Sophia uses this to generate on-brand content'
    ]
  },
  {
    id: 'connections',
    title: 'My Connections',
    path: '/my-connections',
    description: 'Connect your accounts for LinkedIn, Gmail, Office 365, and Calendar integrations.',
    keywords: ['connections', 'integrate', 'gmail', 'linkedin', 'oauth', 'connect account'],
    steps: [
      'Navigate to My Connections in the sidebar',
      'Click Connect for each service you want to add',
      'Authorize access through OAuth',
      'Your connections are workspace-scoped for team collaboration'
    ]
  },
  {
    id: 'api-keys',
    title: 'Workspace API Keys',
    path: '/workspace-api-keys',
    description: 'Configure your OpenAI and email provider API keys for AI and sending capabilities.',
    keywords: ['api', 'keys', 'openai', 'resend', 'sendgrid', 'email provider'],
    steps: [
      'Go to Settings > Workspace API Keys',
      'Add your OpenAI API key for AI features',
      'Add your email provider key (Resend, SendGrid, etc.)',
      'Usage is tracked per workspace for billing transparency'
    ]
  },
  {
    id: 'rate-limiting',
    title: 'Rate Limiting',
    path: '/rate-limiting',
    description: 'Configure sending limits per channel to stay compliant and protect your accounts.',
    keywords: ['rate', 'limit', 'throttle', 'limits', 'sending limits', 'safety'],
    steps: [
      'Access Rate Limiting in Settings',
      'Set per-minute, per-hour, and per-day limits for each channel',
      'Configure cooldown periods between sends',
      'LinkedIn has stricter defaults to protect your account'
    ]
  },
  {
    id: 'notifications',
    title: 'Notification Settings',
    path: '/notification-settings',
    description: 'Set up Slack, Microsoft Teams, push notifications, and email digests.',
    keywords: ['notifications', 'slack', 'teams', 'alerts', 'push', 'webhook'],
    steps: [
      'Go to Settings > Notifications',
      'Enter your Slack or Teams webhook URL',
      'Enable push notifications for mobile alerts',
      'Configure email digest frequency',
      'Test your webhook connection'
    ]
  },
  {
    id: 'data-export',
    title: 'Data Export',
    path: '/data-export',
    description: 'Export your contacts, campaigns, and deals in CSV or JSON format.',
    keywords: ['export', 'download', 'csv', 'json', 'backup', 'data'],
    steps: [
      'Navigate to Settings > Data Export',
      'Select the data type to export',
      'Choose CSV or JSON format',
      'Select specific fields if needed',
      'Apply date range filters',
      'Click Export to download'
    ]
  },
  {
    id: 'audit-log',
    title: 'Audit Log',
    path: '/audit-log',
    description: 'View all user actions for compliance tracking and security monitoring.',
    keywords: ['audit', 'log', 'history', 'activity', 'compliance', 'security'],
    steps: [
      'Go to Settings > Audit Log',
      'Filter by action type or resource',
      'View who did what and when',
      'Export logs for compliance reports'
    ]
  },
  {
    id: 'sophia-brain',
    title: 'Agent Sophia Brain Control',
    path: '/sophia-brain',
    description: 'Configure Sophia\'s autonomy level, approval thresholds, and learning settings.',
    keywords: ['sophia', 'brain', 'autonomy', 'ai', 'control', 'settings', 'agent'],
    steps: [
      'Access Sophia Brain from the admin panel',
      'Set autonomy mode: Manual, Semi-Auto, or Full-Auto',
      'Configure confidence thresholds for auto-approval',
      'Enable or disable learning mode',
      'View Sophia\'s decision history'
    ]
  },
  {
    id: 'email-warmup',
    title: 'Email Warmup',
    path: '/email-warmup',
    description: 'Warm up new email domains with a 20-day automated schedule for better deliverability.',
    keywords: ['warmup', 'email', 'deliverability', 'domain', 'reputation'],
    steps: [
      'Add a new email domain in Email Settings',
      'Enable warmup mode',
      'Sophia manages the 20-day warmup schedule automatically',
      'Monitor warmup progress and reputation scores'
    ]
  },
  {
    id: 'team-management',
    title: 'Team & Workspace Management',
    path: '/team',
    description: 'Invite team members and manage roles (Owner, Admin, Member, Viewer).',
    keywords: ['team', 'workspace', 'users', 'invite', 'roles', 'permissions', 'members'],
    steps: [
      'Go to Team from the sidebar',
      'Click Invite Member',
      'Enter their email and select a role',
      'They\'ll receive an invitation to join your workspace'
    ]
  }
];

export function searchDocs(query: string): DocSection[] {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/).filter(w => w.length > 2);
  
  return platformDocs
    .map(doc => {
      let score = 0;
      const searchableText = `${doc.title} ${doc.description} ${doc.keywords.join(' ')}`.toLowerCase();
      
      for (const word of words) {
        if (doc.keywords.some(k => k.includes(word))) score += 10;
        if (doc.title.toLowerCase().includes(word)) score += 5;
        if (doc.description.toLowerCase().includes(word)) score += 3;
        if (searchableText.includes(word)) score += 1;
      }
      
      return { doc, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ doc }) => doc);
}

export function buildDocsContext(): string {
  return platformDocs.map(doc => 
    `Feature: ${doc.title}\nPath: ${doc.path}\nDescription: ${doc.description}\nKeywords: ${doc.keywords.join(', ')}`
  ).join('\n\n');
}
