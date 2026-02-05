import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  BookOpen, Brain, Megaphone, MessageSquare, Users, Linkedin,
  Mail, Calendar, Shield, BarChart3, Zap, Target, Settings,
  PlayCircle, CheckCircle2, ArrowRight, Sparkles, HelpCircle,
  Inbox, PenTool, Clock, TrendingUp, FileText, Eye
} from "lucide-react";
import { Link } from "react-router-dom";

interface FeatureGuide {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  link: string;
  steps: string[];
  tips: string[];
}

const featureGuides: FeatureGuide[] = [
  {
    id: 'sophia',
    title: 'Agent Sophia',
    description: 'Your autonomous AI sales agent that handles outreach, responds to leads, and books meetings.',
    icon: Brain,
    color: 'violet',
    link: '/sophia-brain',
    steps: [
      'Go to Sophia Brain Control to set autonomy level (Manual, Semi-Auto, or Fully Autonomous)',
      'Configure confidence thresholds for different actions',
      'Enable learning mode so Sophia improves from your feedback',
      'Review Sophia\'s pending actions in the approval queue',
      'Check Sophia\'s performance metrics and recommendations'
    ],
    tips: [
      'Start with "Semi-Autonomous" mode to review actions before they execute',
      'Use the Memory Panel to see what Sophia has learned about your preferences',
      'Sophia works best when you define your brand voice in Templates'
    ]
  },
  {
    id: 'campaigns',
    title: 'Multichannel Campaigns',
    description: 'Create automated outreach sequences across email, LinkedIn, SMS, and phone.',
    icon: Megaphone,
    color: 'blue',
    link: '/campaigns',
    steps: [
      'Click "New Campaign" and give it a name',
      'Add steps using the visual workflow builder (Email, LinkedIn, SMS, Phone)',
      'Configure timing between steps (e.g., wait 2 days after email)',
      'Add contacts to your campaign from your CRM',
      'Set your campaign to Active to start sending'
    ],
    tips: [
      'Use A/B testing to optimize your message performance',
      'Enable "Smart Send Time" to reach contacts when they\'re most active',
      'Start with a simple 3-step sequence: Email → LinkedIn → Follow-up Email'
    ]
  },
  {
    id: 'unified-inbox',
    title: 'Unified Inbox',
    description: 'All your messages from email and LinkedIn in one place with AI-powered insights.',
    icon: Inbox,
    color: 'green',
    link: '/unified-inbox',
    steps: [
      'View all incoming messages in the left column',
      'Click a message to see full content and AI analysis',
      'Use quick actions to reply, snooze, or archive',
      'Sophia automatically classifies intent (Interested, Not Interested, Meeting Request, etc.)',
      'Enable Auto-pilot mode to let Sophia respond automatically'
    ],
    tips: [
      'Star important messages for quick access later',
      'Use tags to organize conversations by topic or priority',
      'Check the AI-suggested reply before sending - it\'s often spot-on!'
    ]
  },
  {
    id: 'contacts',
    title: 'Contact CRM',
    description: 'Manage your leads with enrichment, activity tracking, and deal pipeline.',
    icon: Users,
    color: 'orange',
    link: '/contacts',
    steps: [
      'Import contacts via CSV or add manually',
      'Use the enrichment feature to find email and phone numbers',
      'Click a contact to see their full profile and activity timeline',
      'Add notes, tasks, and schedule meetings directly from the contact view',
      'Move contacts through your deal pipeline stages'
    ],
    tips: [
      'Enable auto-deduplication to avoid duplicate contacts',
      'Use lead scoring to prioritize high-value prospects',
      'Tag contacts by industry, company size, or campaign for easy filtering'
    ]
  },
  {
    id: 'linkedin',
    title: 'LinkedIn Automation',
    description: 'Automate connection requests, messages, and profile views with safety controls.',
    icon: Linkedin,
    color: 'sky',
    link: '/linkedin-settings',
    steps: [
      'Go to LinkedIn Settings and connect your account',
      'Capture your LinkedIn session cookies for automation',
      'Review and adjust daily limits in Safety Controls',
      'Enable Sophia Compliance Monitor for safe automation',
      'Use the Live Browser Demo to watch automation in action'
    ],
    tips: [
      'Start with lower limits and gradually increase (warm-up mode)',
      'Always personalize connection request messages',
      'Use the Safety Override controls if you need to adjust limits',
      'Check the Compliance Dashboard for account health'
    ]
  },
  {
    id: 'email',
    title: 'Email Campaigns',
    description: 'Send personalized emails at scale with warmup, deliverability, and tracking.',
    icon: Mail,
    color: 'red',
    link: '/settings',
    steps: [
      'Configure your email provider (Resend recommended) in Settings',
      'Set up email warmup for new domains (20-day automated program)',
      'Create email templates with personalization variables',
      'Run spam tests before launching campaigns',
      'Monitor open rates and reply rates in Analytics'
    ],
    tips: [
      'Use Sophia\'s send-time optimization for better open rates',
      'Always include an unsubscribe option for compliance',
      'Test your emails in the spam test tool before sending'
    ]
  },
  {
    id: 'bulk-email',
    title: 'Bulk Email Sender',
    description: 'Send mass email campaigns with validation, A/B testing, and real-time tracking.',
    icon: Mail,
    color: 'pink',
    link: '/bulk-email',
    steps: [
      'Navigate to Campaigns → Bulk Email in the sidebar',
      'Click "New Campaign" to create a bulk email campaign',
      'Upload your recipient list via CSV (must include email column)',
      'Write your email content or use AI to generate subject lines and body',
      'Enable A/B testing to test multiple subject lines (optional)',
      'Configure tracking options: open tracking, click tracking, unsubscribe link',
      'Set batch size and delay to control sending speed',
      'Start your campaign and monitor real-time delivery stats'
    ],
    tips: [
      'Always validate emails before sending - invalid emails hurt your reputation',
      'Use merge fields like {{firstName}} and {{company}} for personalization',
      'Enable warmup mode for new email domains to build sender reputation',
      'Sophia can analyze your email and give a spam score before you send',
      'Use the deliverability tab to monitor bounce rates and domain health',
      'A/B test subject lines with 20% of recipients, then send winner to rest'
    ]
  },
  {
    id: 'calendar',
    title: 'Calendar & Meetings',
    description: 'Integrate with Google Calendar for automatic meeting booking.',
    icon: Calendar,
    color: 'emerald',
    link: '/connections',
    steps: [
      'Connect your Google Calendar in My Connections',
      'Set your availability preferences',
      'Sophia can automatically book meetings when leads request them',
      'View upcoming meetings on your Dashboard',
      'Sync meeting notes back to contact records'
    ],
    tips: [
      'Block personal time on your calendar to prevent over-booking',
      'Enable meeting reminders to reduce no-shows',
      'Add meeting links (Zoom, Google Meet) to auto-include in invites'
    ]
  },
  {
    id: 'analytics',
    title: 'Analytics & Reporting',
    description: 'Track campaign performance, revenue metrics, and AI recommendations.',
    icon: BarChart3,
    color: 'amber',
    link: '/analytics',
    steps: [
      'View your dashboard for at-a-glance metrics',
      'Check campaign performance for open, click, and reply rates',
      'Monitor Sophia\'s performance and decision accuracy',
      'Use the ROI calculator to measure campaign value',
      'Export reports for stakeholder presentations'
    ],
    tips: [
      'Set up weekly email reports to stay informed',
      'Compare campaigns using the Campaign Comparison tool',
      'Pay attention to Sophia\'s AI recommendations'
    ]
  },
  {
    id: 'email-warmup',
    title: 'Email Warmup',
    description: 'Build sender reputation with automated 20-day warmup program.',
    icon: Zap,
    color: 'orange',
    link: '/email-warmup',
    steps: [
      'Go to Campaigns → Email Warmup in the sidebar',
      'Add your email domain and verify DNS settings',
      'Start the automated 20-day warmup program',
      'Monitor daily sending volume as it gradually increases',
      'Check deliverability scores and inbox placement rates'
    ],
    tips: [
      'Complete warmup before sending bulk campaigns',
      'Sophia automatically manages warmup schedules',
      'Poor warmup leads to spam folder placement',
      'Use multiple domains for higher volume sending'
    ]
  },
  {
    id: 'sms-campaigns',
    title: 'SMS Campaigns',
    description: 'Send text message campaigns with personalization and tracking.',
    icon: MessageSquare,
    color: 'green',
    link: '/sms-campaigns',
    steps: [
      'Configure your SMS provider (Twilio) in Settings',
      'Create a new SMS campaign with your message',
      'Upload contacts with phone numbers',
      'Use merge fields like {{firstName}} for personalization',
      'Schedule or send immediately',
      'Track delivery and response rates'
    ],
    tips: [
      'Keep messages under 160 characters when possible',
      'Include opt-out instructions for compliance',
      'Best times: weekday afternoons typically get higher response',
      'Combine with email for multichannel sequences'
    ]
  },
  {
    id: 'deal-pipeline',
    title: 'Deal Pipeline',
    description: 'Track sales opportunities through your deal stages.',
    icon: Target,
    color: 'purple',
    link: '/deal-pipeline',
    steps: [
      'Go to Contacts & CRM → Deal Pipeline',
      'Create custom pipeline stages for your sales process',
      'Add deals from contact records or create new ones',
      'Drag deals between stages as they progress',
      'Set deal values and expected close dates',
      'View revenue forecasting and pipeline analytics'
    ],
    tips: [
      'Sophia scores deal health based on activity',
      'Set up alerts for stale deals with no recent activity',
      'Use tags to categorize deals by product or source',
      'Review pipeline weekly to keep forecasts accurate'
    ]
  },
  {
    id: 'templates',
    title: 'Templates & Brand Voice',
    description: 'Create reusable templates and define your brand personality.',
    icon: FileText,
    color: 'indigo',
    link: '/templates',
    steps: [
      'Go to Communication → Templates',
      'Create email, SMS, and LinkedIn message templates',
      'Use merge fields for personalization',
      'Define your Brand Voice in Settings → Brand Voice',
      'Sophia uses your brand voice when generating content'
    ],
    tips: [
      'Create templates for common scenarios (intro, follow-up, meeting request)',
      'A/B test different templates to find what works',
      'Update brand voice as your messaging evolves',
      'Use Spintax for dynamic text variations'
    ]
  },
  {
    id: 'social-media',
    title: 'Social Media Manager',
    description: 'Schedule and manage posts across social platforms.',
    icon: Eye,
    color: 'pink',
    link: '/social-media',
    steps: [
      'Connect your social accounts in My Connections',
      'Use Sophia Scheduler for recurring AI-generated posts',
      'Generate posts with AI based on topics or trends',
      'Schedule posts for optimal engagement times',
      'Review and approve posts before they go live'
    ],
    tips: [
      'Sophia generates content aligned with your brand voice',
      'Use the recurring scheduler for consistent posting',
      'Review analytics to see which posts perform best',
      'Mix promotional and educational content'
    ]
  }
];

const faqs = [
  {
    question: 'How does Sophia learn my preferences?',
    answer: 'Sophia learns from your actions: when you approve or reject her suggestions, edit her drafted messages, or manually override her decisions. Enable "Learning Mode" in Sophia Brain Control to accelerate this process. She also remembers facts you tell her in chat conversations.'
  },
  {
    question: 'Is LinkedIn automation safe?',
    answer: 'Yes, when used correctly. We have built-in safety controls including daily limits, warm-up mode, human-like delays, and Sophia\'s compliance monitor. Always start with conservative limits and gradually increase. The platform automatically pauses if risk is detected.'
  },
  {
    question: 'What email providers are supported?',
    answer: 'We support Resend (recommended), Amazon SES, SendGrid, and Postmark. Each workspace can configure their own email provider and API keys. Resend is easiest to set up and has excellent deliverability.'
  },
  {
    question: 'Can Sophia book meetings automatically?',
    answer: 'Yes! Connect your Google Calendar and enable autonomous meeting booking in Sophia\'s settings. When a lead expresses interest in meeting, Sophia can check your availability and send a calendar invite automatically.'
  },
  {
    question: 'How do I import contacts?',
    answer: 'Go to Contacts and click "Import CSV". Map your columns to our fields (name, email, company, etc.). We automatically detect duplicates and can enrich contacts with additional data using Hunter.io or Apollo.io integration.'
  },
  {
    question: 'What is the warm-up period for new accounts?',
    answer: 'For LinkedIn, new or low-activity accounts should use warm-up mode for 2-4 weeks, starting with 5-10 actions per day and gradually increasing. For email domains, we recommend a 20-day warmup program before sending bulk campaigns.'
  },
  {
    question: 'Can I watch LinkedIn automation happening live?',
    answer: 'Yes! Go to LinkedIn Settings → Live Browser Demo tab. Start a live observer session and open the Desktop/VNC tab in Replit to watch the browser perform actions in real-time.'
  },
  {
    question: 'How do I configure Sophia\'s autonomy level?',
    answer: 'Go to Sophia Brain Control. Choose from: Manual Approval (Sophia drafts, you approve everything), Semi-Autonomous (Sophia acts on high-confidence decisions), or Fully Autonomous (Sophia handles everything). You can also set per-action confidence thresholds.'
  },
  {
    question: 'How does bulk email differ from regular email campaigns?',
    answer: 'Bulk Email (under Campaigns → Bulk Email) is for sending one-time mass emails to large lists. Regular email campaigns (in the Campaigns workflow builder) are for automated sequences with multiple steps and follow-ups. Use Bulk Email for announcements or newsletters, and Campaigns for nurture sequences.'
  },
  {
    question: 'What format should my CSV have for bulk email?',
    answer: 'Your CSV must have an "email" column. Optional columns include firstName, lastName, company, title, and any custom fields. Use merge fields like {{firstName}} in your email to personalize. Invalid emails are automatically filtered out before sending.'
  }
];

export default function HowToUse() {
  const [selectedGuide, setSelectedGuide] = useState<string>('sophia');
  const currentGuide = featureGuides.find(g => g.id === selectedGuide) || featureGuides[0];

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                <BookOpen className="w-8 h-8" />
              </div>
              How to Use IntelLead
            </h1>
            <p className="text-muted-foreground mt-2">
              Learn how to get the most out of your AI-powered lead generation platform
            </p>
          </div>
          <Link to="/getting-started">
            <Button variant="outline" data-testid="btn-back-to-wizard">
              <Sparkles className="w-4 h-4 mr-2" />
              Getting Started Wizard
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="features" className="space-y-6">
          <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
            <TabsTrigger value="features" data-testid="tab-features">
              <Zap className="w-4 h-4 mr-2" />
              Features Guide
            </TabsTrigger>
            <TabsTrigger value="faq" data-testid="tab-faq">
              <HelpCircle className="w-4 h-4 mr-2" />
              FAQ
            </TabsTrigger>
            <TabsTrigger value="quick-start" data-testid="tab-quick-start">
              <PlayCircle className="w-4 h-4 mr-2" />
              Quick Start
            </TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-6">
            <div className="grid lg:grid-cols-4 gap-6">
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Features</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {featureGuides.map((guide) => (
                      <button
                        key={guide.id}
                        onClick={() => setSelectedGuide(guide.id)}
                        className={`w-full text-left p-3 border-b transition-colors flex items-center gap-3 ${
                          selectedGuide === guide.id 
                            ? 'bg-primary/5 border-l-4 border-l-primary' 
                            : 'hover:bg-muted/50'
                        }`}
                        data-testid={`btn-guide-${guide.id}`}
                      >
                        <guide.icon className={`w-5 h-5 text-${guide.color}-500`} />
                        <span className="text-sm font-medium">{guide.title}</span>
                      </button>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader className={`bg-gradient-to-r from-${currentGuide.color}-50 to-${currentGuide.color}-100/50 dark:from-${currentGuide.color}-950/30 dark:to-${currentGuide.color}-900/20`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-${currentGuide.color}-100 dark:bg-${currentGuide.color}-900/50`}>
                      <currentGuide.icon className={`w-8 h-8 text-${currentGuide.color}-600 dark:text-${currentGuide.color}-400`} />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl">{currentGuide.title}</CardTitle>
                      <CardDescription className="text-base mt-1">
                        {currentGuide.description}
                      </CardDescription>
                    </div>
                    <Link to={currentGuide.link}>
                      <Button data-testid={`btn-go-to-${currentGuide.id}`}>
                        Open <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div>
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <PlayCircle className="w-5 h-5 text-green-500" />
                      How to Use
                    </h4>
                    <div className="space-y-3">
                      {currentGuide.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                          <Badge variant="outline" className="mt-0.5 shrink-0">
                            {i + 1}
                          </Badge>
                          <span className="text-sm">{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      Pro Tips
                    </h4>
                    <div className="space-y-2">
                      {currentGuide.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{tip}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="faq" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>
                  Common questions about using IntelLead and Agent Sophia
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, i) => (
                    <AccordionItem key={i} value={`faq-${i}`}>
                      <AccordionTrigger className="text-left" data-testid={`faq-trigger-${i}`}>
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quick-start" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  5-Minute Quick Start
                </CardTitle>
                <CardDescription>
                  Get your first campaign running in just 5 minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/30 dark:to-violet-900/20">
                      <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold shrink-0">
                        1
                      </div>
                      <div>
                        <h4 className="font-semibold">Import Contacts</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Go to Contacts → Import CSV with at least name and email columns
                        </p>
                        <Link to="/contacts" className="inline-block mt-2">
                          <Button size="sm" variant="outline" data-testid="btn-qs-contacts">
                            Go to Contacts <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold shrink-0">
                        2
                      </div>
                      <div>
                        <h4 className="font-semibold">Configure Email</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Add your Resend API key in Settings → Workspace API Keys
                        </p>
                        <Link to="/settings" className="inline-block mt-2">
                          <Button size="sm" variant="outline" data-testid="btn-qs-settings">
                            Go to Settings <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl border bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20">
                      <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold shrink-0">
                        3
                      </div>
                      <div>
                        <h4 className="font-semibold">Create Campaign</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          Click New Campaign → Add an email step → Add your contacts → Launch!
                        </p>
                        <Link to="/campaigns" className="inline-block mt-2">
                          <Button size="sm" variant="outline" data-testid="btn-qs-campaigns">
                            Go to Campaigns <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
                    <h4 className="font-semibold flex items-center gap-2 mb-4">
                      <Target className="w-5 h-5 text-orange-500" />
                      What Happens Next
                    </h4>
                    <ul className="space-y-3 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Sophia analyzes your contacts and personalizes each message</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Emails are sent at optimal times for each recipient</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Replies appear in your Unified Inbox with AI analysis</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Sophia drafts responses and can book meetings automatically</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                        <span>Track opens, clicks, and replies in Analytics</span>
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="flex justify-center pt-4">
                  <Link to="/getting-started">
                    <Button size="lg" className="bg-gradient-to-r from-violet-600 to-indigo-600" data-testid="btn-full-wizard">
                      <Sparkles className="w-5 h-5 mr-2" />
                      Full Setup Wizard
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
