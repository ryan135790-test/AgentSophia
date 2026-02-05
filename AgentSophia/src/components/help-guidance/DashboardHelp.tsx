import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, X, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function DashboardHelpOverlay() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const overlays = {
    metrics: {
      title: "📊 Understanding Your Metrics",
      content: [
        "🎯 Total Contacts: Everyone you're reaching across all campaigns",
        "📧 Active Campaigns: Running campaigns making impact right now",
        "💰 Pipeline Value: Total value of all deals in progress",
        "🚀 Monthly Forecast: AI-predicted revenue based on current pipeline"
      ],
      action: "These numbers show your business momentum. Watch them grow as campaigns run!"
    },
    leads: {
      title: "🔥 Lead Temperature Breakdown",
      content: [
        "🔴 Hot Leads: Recently engaged, high intent, ready to close",
        "🟠 Warm Leads: Interested, need nurturing, good opportunity",
        "❄️ Cold Leads: Early stage, need more engagement, long-term value"
      ],
      action: "Focus follow-ups on Hot & Warm leads first. Cold leads get long-term nurture sequences."
    },
    engagement: {
      title: "💬 Engagement Rates Explained",
      content: [
        "📖 Open Rate: What % of people opened your message (avg 21.5% for email)",
        "🖱️ Click Rate: What % clicked links (avg 2.6% for email, 10% for LinkedIn)",
        "💬 Reply Rate: Direct replies from prospects (45% for SMS, varies by channel)"
      ],
      action: "Higher rates = better content & targeting. Use research insights to improve."
    },
    forecast: {
      title: "🎯 Revenue Forecast Explained",
      content: [
        "This forecast uses YOUR historical data + industry benchmarks",
        "It weighs pipeline stages by probability of closing",
        "Updates in real-time as deals move through stages",
        "Use this to predict cash flow and plan resources"
      ],
      action: "Trust this number - it's backed by your actual performance data!"
    }
  };

  return (
    <>
      {/* Overlay Panels - Help buttons are integrated into dashboard sections directly */}
      {activeOverlay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-96 shadow-2xl">
            <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                {overlays[activeOverlay as keyof typeof overlays]?.title}
              </h3>
              <button
                onClick={() => setActiveOverlay(null)}
                className="p-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded"
                data-testid="close-overlay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <ul className="space-y-2">
                {overlays[activeOverlay as keyof typeof overlays]?.content.map((line, i) => (
                  <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex gap-2">
                    <span className="flex-shrink-0">→</span>
                    {line}
                  </li>
                ))}
              </ul>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  💡 {overlays[activeOverlay as keyof typeof overlays]?.action}
                </p>
              </div>

              <Button
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setActiveOverlay(null)}
                data-testid="got-it-button"
              >
                Got it!
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function HelpButtonForMetrics({ onShow }: { onShow: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShow}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-metrics"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Click to understand these metrics</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HelpButtonForLeads({ onShow }: { onShow: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShow}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-leads"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent>What do these lead temperatures mean?</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HelpButtonForEngagement({ onShow }: { onShow: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShow}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-engagement"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent>How are these rates calculated?</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HelpButtonForForecast({ onShow }: { onShow: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShow}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-forecast"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent>How is this forecast calculated?</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
