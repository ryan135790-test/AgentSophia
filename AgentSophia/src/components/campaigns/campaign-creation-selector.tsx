import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, 
  LayoutTemplate, 
  Settings2, 
  Clock, 
  Zap,
  ArrowRight,
  Brain,
  Sparkles,
  Bot,
  CheckCircle2,
  Users,
  Wand2
} from 'lucide-react';
import { CampaignTemplateCatalog } from './CampaignTemplateCatalog';

interface CampaignCreationSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreationPath {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: ReactNode;
  iconBg: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  highlights: string[];
  bestFor: string;
  route: string;
  time: string;
  recommended?: boolean;
}

const CREATION_PATHS: CreationPath[] = [
  {
    id: 'quick-chat',
    title: 'Chat with Sophia',
    subtitle: 'Just tell me what you need',
    description: "I'll ask you 5 quick questions about your campaign - who you're targeting, what you're offering, and your preferred channels. Then I'll build the whole thing for you.",
    icon: <MessageSquare className="h-7 w-7 text-white" />,
    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
    badge: 'Recommended',
    badgeVariant: 'default',
    highlights: [
      'Guided conversation',
      'AI writes all content',
      'Ready in minutes'
    ],
    bestFor: 'Perfect for most users',
    route: '/chat-sophia?action=create-campaign',
    time: '2-3 min',
    recommended: true
  },
  {
    id: 'smart-outreach',
    title: 'Smart Outreach',
    subtitle: 'I pick the best channel per person',
    description: "I'll analyze each contact's LinkedIn activity, email engagement, and history to decide the best channel. If someone's not active on LinkedIn, I'll email them first - and vice versa.",
    icon: <Wand2 className="h-7 w-7 text-white" />,
    iconBg: 'bg-gradient-to-br from-pink-500 to-rose-600',
    badge: 'AI Personalized',
    badgeVariant: 'secondary',
    highlights: [
      'Per-contact decisions',
      'Smart channel routing',
      'Auto fallbacks'
    ],
    bestFor: 'Maximum engagement per contact',
    route: '/chat-sophia?action=smart-outreach',
    time: '3-5 min'
  },
  {
    id: 'autonomous',
    title: 'Let Sophia Handle It',
    subtitle: 'Set a goal, I do the rest',
    description: "Tell me your goal (like 'book 10 demos this month') and I'll source leads, build sequences, and run the campaign autonomously. You just approve the big decisions.",
    icon: <Brain className="h-7 w-7 text-white" />,
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
    badge: 'Hands-Off',
    badgeVariant: 'secondary',
    highlights: [
      'Auto lead sourcing',
      'Auto enrichment',
      'Runs itself'
    ],
    bestFor: 'When you want to set and forget',
    route: '/agent-sophia?tab=autonomous',
    time: 'Set & forget'
  },
  {
    id: 'templates',
    title: 'Start from Template',
    subtitle: 'Pick a proven sequence',
    description: "Browse pre-built campaign templates organized by goal (cold outreach, re-engagement, event follow-up, etc.) and customize them to fit your needs.",
    icon: <LayoutTemplate className="h-7 w-7 text-white" />,
    iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600',
    highlights: [
      'Proven sequences',
      'Easy customization',
      'Industry examples'
    ],
    bestFor: 'When you want a head start',
    route: '/workflow-builder?template=true',
    time: '5-10 min'
  },
  {
    id: 'advanced',
    title: 'Build from Scratch',
    subtitle: 'Full control over everything',
    description: "Use the visual workflow editor to design your campaign step-by-step. Add conditional branches, A/B tests, and precise timing rules.",
    icon: <Settings2 className="h-7 w-7 text-white" />,
    iconBg: 'bg-gradient-to-br from-purple-500 to-violet-600',
    highlights: [
      'Visual editor',
      'If/then logic',
      'A/B testing'
    ],
    bestFor: 'For experienced users who want control',
    route: '/workflow-builder',
    time: '15-30 min'
  }
];

export function CampaignCreationSelector({ open, onOpenChange }: CampaignCreationSelectorProps) {
  const navigate = useNavigate();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [showTemplateCatalog, setShowTemplateCatalog] = useState(false);

  const handleSelectPath = (path: CreationPath) => {
    if (path.id === 'templates') {
      setShowTemplateCatalog(true);
      return;
    }
    onOpenChange(false);
    navigate(path.route);
  };

  const handleTemplateApplied = () => {
    onOpenChange(false);
    navigate('/workflow-builder');
  };

  const recommendedPath = CREATION_PATHS.find(p => p.recommended);
  const otherPaths = CREATION_PATHS.filter(p => !p.recommended);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="p-6 pb-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl">Let's create your campaign</DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Hi! I'm Sophia. How would you like to get started?
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {recommendedPath && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">My Recommendation</span>
              </div>
              <Card 
                className={`cursor-pointer transition-all duration-200 border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-600 ${
                  hoveredPath === recommendedPath.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                }`}
                onMouseEnter={() => setHoveredPath(recommendedPath.id)}
                onMouseLeave={() => setHoveredPath(null)}
                onClick={() => handleSelectPath(recommendedPath)}
                data-testid={`campaign-path-${recommendedPath.id}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${recommendedPath.iconBg} shadow-lg shrink-0`}>
                      {recommendedPath.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{recommendedPath.title}</CardTitle>
                        <Badge variant="default" className="text-xs bg-blue-600">
                          {recommendedPath.badge}
                        </Badge>
                        <div className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {recommendedPath.time}
                        </div>
                      </div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        {recommendedPath.subtitle}
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        {recommendedPath.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                          {recommendedPath.highlights.map((highlight, idx) => (
                            <div key={idx} className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {highlight}
                            </div>
                          ))}
                        </div>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700 shrink-0">
                          Start Chat
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Other Options</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {otherPaths.map((path) => (
                <Card 
                  key={path.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 ${
                    hoveredPath === path.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
                  }`}
                  onMouseEnter={() => setHoveredPath(path.id)}
                  onMouseLeave={() => setHoveredPath(null)}
                  onClick={() => handleSelectPath(path)}
                  data-testid={`campaign-path-${path.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${path.iconBg} shadow shrink-0`}>
                        {path.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <CardTitle className="text-sm font-semibold">{path.title}</CardTitle>
                          {path.badge && (
                            <Badge variant={path.badgeVariant || 'outline'} className="text-[10px] px-1.5 py-0">
                              {path.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {path.subtitle}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {path.description}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {path.time}
                      </div>
                      <ArrowRight className={`h-4 w-4 transition-all ${
                        hoveredPath === path.id ? 'translate-x-1 text-blue-600' : 'text-muted-foreground'
                      }`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="text-center pt-2">
            <p className="text-xs text-muted-foreground">
              Not sure? Start with <button 
                onClick={() => handleSelectPath(recommendedPath!)} 
                className="text-blue-600 hover:underline font-medium"
              >
                Chat with Sophia
              </button> - I'll guide you through it.
            </p>
          </div>
        </div>
      </DialogContent>

      <CampaignTemplateCatalog 
        open={showTemplateCatalog} 
        onOpenChange={setShowTemplateCatalog}
        onTemplateApplied={handleTemplateApplied}
      />
    </Dialog>
  );
}
