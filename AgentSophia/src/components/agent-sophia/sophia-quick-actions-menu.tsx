/**
 * Sophia Quick Actions Menu
 * Click to auto-fill input and send to Sophia
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Zap, BarChart3, TrendingUp, Mail, Linkedin, MessageSquare,
  Calendar, Users, Target, Settings, HelpCircle
} from 'lucide-react';

export const QUICK_ACTIONS = [
  {
    category: 'Campaign Building',
    actions: [
      { icon: Sparkles, label: 'Create New Campaign', prompt: 'Help me create a new outreach campaign' },
      { icon: Mail, label: 'Email Campaign', prompt: 'I want to launch an email campaign' },
      { icon: Linkedin, label: 'LinkedIn Campaign', prompt: 'Help me build a LinkedIn outreach campaign' },
      { icon: MessageSquare, label: 'Multi-Channel Campaign', prompt: 'I want to reach out via multiple channels' },
    ]
  },
  {
    category: 'Social Media',
    actions: [
      { icon: Sparkles, label: 'Build Social Posts', prompt: 'I want to go to the social media manager at /social-media to create and schedule posts' },
      { icon: Linkedin, label: 'LinkedIn Posts', prompt: 'Generate LinkedIn posts for my brand at /social-media' },
      { icon: Users, label: 'Twitter/X Posts', prompt: 'Create Twitter/X posts for engagement at /social-media' },
      { icon: MessageSquare, label: 'Instagram Captions', prompt: 'Write Instagram captions for my posts at /social-media' },
    ]
  },
  {
    category: 'Analytics & Performance',
    actions: [
      { icon: BarChart3, label: 'View Campaign Performance', prompt: 'Show me how my campaigns are performing' },
      { icon: TrendingUp, label: 'Improve Conversion Rate', prompt: 'How can I improve my conversion rate?' },
      { icon: Target, label: 'Analyze Engagement', prompt: 'Analyze my audience engagement metrics' },
      { icon: Users, label: 'Lead Scoring', prompt: 'Help me score and prioritize my leads' },
    ]
  },
  {
    category: 'Strategy & Optimization',
    actions: [
      { icon: Zap, label: 'Optimize Active Campaigns', prompt: 'Optimize my active campaigns for better results' },
      { icon: Settings, label: 'Best Practices', prompt: 'What are best practices for B2B outreach?' },
      { icon: Calendar, label: 'Timing Strategy', prompt: 'What\'s the best timing for sending campaigns?' },
      { icon: HelpCircle, label: 'Ask Sophia', prompt: 'What can you help me with?' },
    ]
  }
];

interface SophiaQuickActionsMenuProps {
  onActionSelect: (prompt: string) => void;
  disabled?: boolean;
}

export function SophiaQuickActionsMenu({ onActionSelect, disabled }: SophiaQuickActionsMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={disabled}
          data-testid="button-quick-actions-menu"
        >
          <Zap className="w-4 h-4" />
          <span className="hidden sm:inline">Quick Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 max-h-96 overflow-y-auto">
        {QUICK_ACTIONS.map((section, idx) => (
          <div key={section.category}>
            <DropdownMenuLabel className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {section.category}
            </DropdownMenuLabel>
            {section.actions.map((action) => {
              const IconComponent = action.icon;
              return (
                <DropdownMenuItem
                  key={action.label}
                  onClick={() => {
                    onActionSelect(action.prompt);
                    setOpen(false);
                  }}
                  className="cursor-pointer gap-2"
                  data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <IconComponent className="w-4 h-4 text-slate-500" />
                  <div className="flex flex-col">
                    <span className="text-sm">{action.label}</span>
                  </div>
                </DropdownMenuItem>
              );
            })}
            {idx < QUICK_ACTIONS.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Import Sparkles since we use it
import { Sparkles } from 'lucide-react';
