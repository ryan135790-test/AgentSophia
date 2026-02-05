import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  Megaphone,
  Mail,
  BarChart3,
  Settings,
  CheckCircle2,
  Calendar,
  Users,
  Info,
  ArrowRight,
  MessageCircle,
  PenTool,
  Workflow,
  MessageSquare
} from "lucide-react";

interface QuickCommand {
  id: string;
  title: string;
  description: string;
  icon: any;
  prompt: string;
  category: 'build' | 'analyze' | 'manage';
}

const QUICK_COMMANDS: QuickCommand[] = [
  // BUILD: Campaign Creation & Outreach
  {
    id: 'campaign',
    title: 'Multichannel Campaign',
    description: 'Build Email + LinkedIn + SMS campaign',
    icon: Megaphone,
    prompt: 'I want to build a campaign to reach my ideal customers. Help me create a complete strategy with messaging for each channel.',
    category: 'build'
  },
  {
    id: 'cold-email',
    title: 'Cold Email Sequence',
    description: 'Generate 5-day email sequence with A/B options',
    icon: Mail,
    prompt: 'Create a cold email sequence for me. Generate subject lines, email variations, and follow-up strategy.',
    category: 'build'
  },
  {
    id: 'linkedin-sequence',
    title: 'LinkedIn Automation',
    description: 'Connection requests, messages, and follow-ups',
    icon: Users,
    prompt: 'Set up my LinkedIn outreach. Create connection request templates and messaging sequences.',
    category: 'build'
  },
  {
    id: 'sms-campaign',
    title: 'SMS Outreach',
    description: 'SMS and WhatsApp messaging campaigns',
    icon: MessageCircle,
    prompt: 'Build an SMS campaign with personalization. Generate variations and timing strategy.',
    category: 'build'
  },
  {
    id: 'content-gen',
    title: 'Ad & Social Copy',
    description: 'Generate ad copy, landing pages, posts',
    icon: PenTool,
    prompt: 'Generate compelling ad copy, landing page headlines, and social media content for my campaign.',
    category: 'build'
  },
  {
    id: 'social-media-campaign',
    title: 'Social Media Campaign',
    description: 'Build Twitter, LinkedIn, Instagram content strategy',
    icon: Megaphone,
    prompt: 'Create a social media campaign strategy for me. Generate content calendar, post variations for Twitter/LinkedIn/Instagram, hashtag strategy, and posting schedule.',
    category: 'build'
  },
  
  // ANALYZE: Performance & Insights
  {
    id: 'campaign-roi',
    title: 'Campaign ROI Analysis',
    description: 'Review performance and suggest optimizations',
    icon: TrendingUp,
    prompt: 'Analyze my campaign performance. What\'s working, what\'s not? Give me specific optimizations.',
    category: 'analyze'
  },
  {
    id: 'lead-quality',
    title: 'Lead Scoring & Ranking',
    description: 'Score leads and prioritize high-value prospects',
    icon: BarChart3,
    prompt: 'Score and rank my leads by quality and conversion likelihood. What\'s my best next action?',
    category: 'analyze'
  },
  {
    id: 'channel-compare',
    title: 'Channel Performance',
    description: 'Compare Email vs LinkedIn vs SMS results',
    icon: TrendingUp,
    prompt: 'Show me performance by channel. Which channels should I focus on? Where\'s ROI highest?',
    category: 'analyze'
  },
  {
    id: 'engagement-trends',
    title: 'Engagement Trends',
    description: 'Identify patterns and optimization opportunities',
    icon: BarChart3,
    prompt: 'What engagement trends do you see? Best times, messaging, audiences? Recommend next moves.',
    category: 'analyze'
  },
  
  // MANAGE: Operations & Automation
  {
    id: 'approvals',
    title: 'Review Approvals',
    description: 'Check and approve pending messages',
    icon: CheckCircle2,
    prompt: 'Show me all pending approvals. Which should I approve? Suggest edits if needed.',
    category: 'manage'
  },
  {
    id: 'automation',
    title: 'Create Workflow',
    description: 'Build automated multi-step sequences',
    icon: Workflow,
    prompt: 'Design an automated workflow for my sales process. Include decision points and follow-ups.',
    category: 'manage'
  },
  {
    id: 'schedule-meetings',
    title: 'Meeting Booking',
    description: 'Automate qualified meeting scheduling',
    icon: Calendar,
    prompt: 'Set up automatic meeting scheduling. What should my booking criteria and email be?',
    category: 'manage'
  },
  {
    id: 'integrations',
    title: 'Connect Tools',
    description: 'Link CRM, email, LinkedIn, SMS, calendar',
    icon: Settings,
    prompt: 'Help me connect all my tools. What integrations do I need? Walk me through setup.',
    category: 'manage'
  },
  {
    id: 'inbox-manage',
    title: 'Manage Inbox',
    description: 'Process responses and suggest next actions',
    icon: MessageSquare,
    prompt: 'Show me my inbox. Categorize responses, suggest who to follow up with, and draft replies.',
    category: 'manage'
  },
  
  // 6SENSE-LIKE: Intent Data & Revenue Intelligence
  {
    id: 'intent-detection',
    title: 'Intent Detection',
    description: 'Find accounts showing buying signals',
    icon: TrendingUp,
    prompt: 'Analyze my accounts and identify who\'s showing buying intent. What signals indicate they\'re ready? Rank them by urgency.',
    category: 'analyze'
  },
  {
    id: 'account-scoring',
    title: 'Account Scoring',
    description: 'Predict which accounts will close',
    icon: BarChart3,
    prompt: 'Score my accounts on fit + intent. Show conversion probability, decision maker routing, and optimal timing.',
    category: 'analyze'
  },
  {
    id: 'revenue-intelligence',
    title: 'Revenue Intelligence',
    description: 'Track deals, pipeline value, attribution',
    icon: TrendingUp,
    prompt: 'Show me revenue impact by channel. Which touchpoints drive deals? What\'s my pipeline forecast?',
    category: 'analyze'
  },
  {
    id: 'engagement-signals',
    title: 'Engagement Signals',
    description: 'Find active buyers and optimal windows',
    icon: MessageSquare,
    prompt: 'Who\'s engaged right now? What\'s their activity pattern? When should we contact them? What\'s the best channel?',
    category: 'analyze'
  },
  {
    id: 'abm-strategy',
    title: 'ABM Strategy',
    description: 'Build account-based campaigns for VIPs',
    icon: Megaphone,
    prompt: 'Build an ABM campaign for my top accounts. Create personalized messaging, timing, and multi-touch sequences.',
    category: 'build'
  },
  {
    id: 'deal-forecast',
    title: 'Deal Forecasting',
    description: 'Predict pipeline and revenue outcomes',
    icon: BarChart3,
    prompt: 'Forecast my pipeline for next quarter. Which deals will close? What\'s our revenue outlook? Risk analysis?',
    category: 'analyze'
  }
];

interface QuickCommandsProps {
  onCommandClick: (prompt: string) => void;
  isLoading?: boolean;
}

export function QuickCommands({ onCommandClick, isLoading = false }: QuickCommandsProps) {
  const categories = {
    build: { 
      label: 'Build',
      icon: '🚀',
      color: 'from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800',
      commands: QUICK_COMMANDS.filter(c => c.category === 'build') 
    },
    analyze: { 
      label: 'Analyze',
      icon: '📊',
      color: 'from-purple-50 to-purple-100 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800',
      commands: QUICK_COMMANDS.filter(c => c.category === 'analyze') 
    },
    manage: { 
      label: 'Manage',
      icon: '⚙️',
      color: 'from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800',
      commands: QUICK_COMMANDS.filter(c => c.category === 'manage') 
    }
  };

  return (
    <div className="space-y-3">
      {/* HEADER - STAYS AT TOP */}
      <div className="px-4 pt-2">
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-xs text-blue-900 dark:text-blue-100">Quick Start</h3>
              <p className="text-xs text-blue-700 dark:text-blue-200 leading-snug">
                Click any command below to start. Sophia will guide you through each step.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SCROLLABLE COMMANDS */}
      <ScrollArea className="max-h-64 px-4">
        <div className="space-y-4 pr-4">
          {Object.entries(categories).map(([key, { label, icon, color, commands }]) => (
            commands.length > 0 && (
              <div key={key} className="space-y-2">
                {/* Category Header */}
                <div className="flex items-center gap-2">
                  <span className="text-lg">{icon}</span>
                  <h2 className="text-sm font-bold text-foreground">{label}</h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-muted to-transparent"></div>
                </div>

                {/* Commands Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {commands.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <Button
                        key={cmd.id}
                        onClick={() => onCommandClick(cmd.prompt)}
                        disabled={isLoading}
                        variant="outline"
                        className={`h-auto py-2 px-3 justify-between items-start text-left group bg-gradient-to-br ${color} hover:shadow-md transition-all duration-200 border text-xs`}
                        data-testid={`quick-command-${cmd.id}`}
                      >
                        <div className="flex items-start gap-2 flex-1">
                          {/* Icon */}
                          <div className="flex items-center justify-center h-8 w-8 rounded bg-white dark:bg-slate-800 flex-shrink-0">
                            <Icon className="h-4 w-4 text-primary" />
                          </div>
                          {/* Text */}
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-foreground">{cmd.title}</p>
                            <p className="text-[10px] text-muted-foreground leading-snug">{cmd.description}</p>
                          </div>
                        </div>
                        {/* Arrow */}
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0 ml-1" />
                      </Button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      </ScrollArea>

      {/* FOOTER - STAYS AT BOTTOM */}
      <div className="px-4 pt-1 pb-1 text-center border-t">
        <p className="text-xs text-muted-foreground">
          💡 Click to start. Sophia will ask questions.
        </p>
      </div>
    </div>
  );
}
