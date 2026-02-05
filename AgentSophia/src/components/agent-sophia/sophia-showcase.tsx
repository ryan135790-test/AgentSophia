import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, Zap, TrendingUp, MessageSquare, 
  Workflow, Users, BarChart3, Target, AlertCircle, CheckCircle2
} from 'lucide-react';

interface DemoPrompt {
  id: string;
  title: string;
  description: string;
  icon: any;
  category: 'autonomy' | 'analytics' | 'automation';
  prompt: string;
}

const DEMO_PROMPTS: DemoPrompt[] = [
  {
    id: 'lead-scoring',
    title: 'Lead Scoring',
    description: 'Show me the top leads with their scores',
    icon: TrendingUp,
    category: 'autonomy',
    prompt: 'Show me how you score the leads in this demo. I have 6 leads with scores ranging from 32 to 85. Which ones should we focus on first?'
  },
  {
    id: 'auto-replies',
    title: 'Auto-Reply Engine',
    description: 'Explain how you handle responses automatically',
    icon: MessageSquare,
    category: 'autonomy',
    prompt: 'I have 3 auto-reply rules set up. Can you explain how you autonomously respond to high-intent keywords like "budget", "timeline", and "demo scheduled"? What would you say to Sarah Chen from TechCorp?'
  },
  {
    id: 'workflows',
    title: 'Workflow Automation',
    description: 'Show me the 4 active automation workflows',
    icon: Workflow,
    category: 'automation',
    prompt: 'I have 4 workflow triggers running autonomously that have executed 117 times. Tell me about each one and how they\'ve already helped with Michael Rodriguez, Emily Johnson, and James Wilson.'
  },
  {
    id: 'next-actions',
    title: 'Predictive Next-Best-Action',
    description: 'What should we do next with each lead?',
    icon: Zap,
    category: 'autonomy',
    prompt: 'For each of my 6 leads, what\'s the next best action? Sarah (score 85) and James (score 78) are hot. Michael and Emily are warm at 72 and 65. Lisa is 45. David is cold at 32. What do you recommend?'
  },
  {
    id: 'engagement',
    title: 'Engagement Tracking',
    description: 'How are leads engaging with our messages?',
    icon: Users,
    category: 'analytics',
    prompt: 'Show me which leads have opened emails, clicked links, or replied. Michael and James have high engagement. Emily opened emails. What does this tell you about their buying intent?'
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    description: 'Show me the demo workspace analytics',
    icon: BarChart3,
    category: 'analytics',
    prompt: 'Give me a summary of my analytics: 325 contacts, 12 campaigns, 87 responses (26.8% response rate), 14.2% conversion rate, $8.5M pipeline value. What campaigns are working best?'
  },
  {
    id: 'intent-detection',
    title: 'Intent Detection',
    description: 'How do you detect buying signals?',
    icon: Target,
    category: 'autonomy',
    prompt: 'Show me how you detect buying intent. With my top intents being "interested" (32), "meeting request" (21), and "questions" (18), how are you prioritizing follow-ups?'
  },
  {
    id: 'multi-channel',
    title: 'Multi-Channel Orchestration',
    description: 'How do you manage email, LinkedIn, and SMS?',
    icon: Sparkles,
    category: 'automation',
    prompt: 'I have email (45 responses), LinkedIn (28), and SMS (14) all running. How are you orchestrating these channels? Should I send email to Sarah, LinkedIn to Michael, and SMS to James? Why?'
  }
];

interface SophiaShowcaseProps {
  onPromptSelect: (prompt: string) => void;
  isLoading?: boolean;
  workspaceId?: string;
}

export function SophiaShowcase({ onPromptSelect, isLoading, workspaceId }: SophiaShowcaseProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'autonomy' | 'analytics' | 'automation'>('all');
  
  const filteredPrompts = selectedCategory === 'all' 
    ? DEMO_PROMPTS 
    : DEMO_PROMPTS.filter(p => p.category === selectedCategory);

  const isDemo = workspaceId === 'demo';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Agent Sophia Showcase</h2>
          {isDemo && <Badge variant="default" className="bg-purple-600">Demo Mode</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Click any feature below to see Agent Sophia demonstrate her autonomous capabilities
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
          className="text-xs"
          data-testid="filter-all-features"
        >
          All Features
        </Button>
        <Button
          variant={selectedCategory === 'autonomy' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('autonomy')}
          className="text-xs gap-1"
          data-testid="filter-autonomy"
        >
          <Zap className="h-3 w-3" />
          Autonomy
        </Button>
        <Button
          variant={selectedCategory === 'automation' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('automation')}
          className="text-xs gap-1"
          data-testid="filter-automation"
        >
          <Workflow className="h-3 w-3" />
          Automation
        </Button>
        <Button
          variant={selectedCategory === 'analytics' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('analytics')}
          className="text-xs gap-1"
          data-testid="filter-analytics"
        >
          <BarChart3 className="h-3 w-3" />
          Analytics
        </Button>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filteredPrompts.map((feature) => {
          const IconComponent = feature.icon;
          const categoryColor = {
            autonomy: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800',
            automation: 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800',
            analytics: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800'
          };

          return (
            <Card 
              key={feature.id} 
              className={`cursor-pointer transition-all hover:shadow-md hover:scale-105 ${categoryColor[feature.category]}`}
              data-testid={`showcase-card-${feature.id}`}
            >
              <CardContent className="p-3">
                <Button
                  onClick={() => onPromptSelect(feature.prompt)}
                  disabled={isLoading}
                  variant="ghost"
                  className="w-full h-auto justify-start gap-2 text-left p-0 hover:bg-transparent"
                  data-testid={`button-showcase-${feature.id}`}
                >
                  <div className="flex items-start gap-2 w-full">
                    <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight">{feature.title}</p>
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Demo Data Summary */}
      {isDemo && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Demo Workspace Loaded
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1 text-muted-foreground">
            <p>✅ <strong>6 Leads</strong> with AI scores (32-85) and engagement tags</p>
            <p>✅ <strong>3 Auto-Reply Rules</strong> detecting high-intent keywords across email & LinkedIn</p>
            <p>✅ <strong>4 Workflow Triggers</strong> with 117+ total autonomous executions</p>
            <p>✅ <strong>Analytics</strong> showing 26.8% response rate and $8.5M pipeline value</p>
            <p className="text-purple-600 dark:text-purple-400 font-semibold mt-2">
              Pick any feature above to see Agent Sophia in action! →
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
