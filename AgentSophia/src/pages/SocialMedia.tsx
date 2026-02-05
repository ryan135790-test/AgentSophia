import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2, Settings, Zap, CalendarCheck, Bot } from "lucide-react";
import { SocialAIPosting } from "@/components/social/social-ai-posting";
import { SocialConnectionsManager } from "@/components/social/social-connections-manager";
import { BrandVoiceManager } from "@/components/agent-sophia/brand-voice-manager";
import { SocialMediaManager } from "@/components/features/social-media-manager";
import { SocialRecurringScheduler } from "@/components/social/social-recurring-scheduler";

export default function SocialMedia() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'recurring');

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-background via-background to-muted/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
              <Share2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">Social Media Manager</h1>
              <p className="text-muted-foreground mt-1">AI-powered social post generation, scheduling & brand voice management</p>
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="recurring" className="flex items-center gap-2" data-testid="tab-recurring">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Sophia Scheduler</span>
            </TabsTrigger>
            <TabsTrigger value="generate" className="flex items-center gap-2" data-testid="tab-generate">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Generate</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2" data-testid="tab-schedule">
              <CalendarCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Quick Post</span>
            </TabsTrigger>
            <TabsTrigger value="brand" className="flex items-center gap-2" data-testid="tab-brand">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Brand Voice</span>
            </TabsTrigger>
            <TabsTrigger value="connections" className="flex items-center gap-2" data-testid="tab-connections">
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline">Connections</span>
            </TabsTrigger>
          </TabsList>

          {/* Recurring Scheduler Tab - Sophia's AI-powered scheduling with approval */}
          <TabsContent value="recurring" className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-primary to-purple-600 rounded-lg">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Sophia's Recurring Scheduler</h2>
                  <p className="text-muted-foreground">
                    Set up recurring post schedules and Sophia will auto-generate content for you to approve before each post goes live
                  </p>
                </div>
              </div>
              <SocialRecurringScheduler />
            </div>
          </TabsContent>

          {/* Generate Tab */}
          <TabsContent value="generate" className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-border p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                AI Post Generator
              </h2>
              <p className="text-muted-foreground mb-6">
                Generate platform-optimized social media posts using AI. Choose your platforms, set brand voice, and let our AI create engaging content.
              </p>
              <SocialAIPosting />
            </div>
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-border p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Share2 className="h-5 w-5 text-blue-500" />
                Schedule & Manage Posts
              </h2>
              <p className="text-muted-foreground mb-6">
                Schedule posts for optimal engagement times and track performance metrics across all platforms.
              </p>
              <SocialMediaManager />
            </div>
          </TabsContent>

          {/* Brand Voice Tab */}
          <TabsContent value="brand" className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-border p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5 text-purple-500" />
                Brand Voice Configuration
              </h2>
              <p className="text-muted-foreground mb-6">
                Define your brand voice, tone, values, and messaging guidelines. AI will use these to personalize all generated content.
              </p>
              <BrandVoiceManager />
            </div>
          </TabsContent>

          {/* Connections Tab */}
          <TabsContent value="connections" className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-border p-6">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Share2 className="h-5 w-5 text-green-500" />
                Social Connections
              </h2>
              <p className="text-muted-foreground mb-6">
                Connect and manage your social media accounts. Posts will be automatically published to connected platforms.
              </p>
              <SocialConnectionsManager />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
