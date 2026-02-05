import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HelpCircle, X, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function CampaignsHelpOverlay() {
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const overlays = {
    performance: {
      title: "📊 Reading Campaign Performance",
      content: [
        "✉️ Sent: Total messages delivered (may bounce)",
        "👀 Opened: People who opened your message",
        "📱 Clicked: People who clicked links in message",
        "💬 Replied: Direct responses from prospects",
        "🎯 Conversion: People who became opportunities"
      ],
      action: "Focus on Reply Rate - that's real engagement! Compare to benchmarks."
    },
    status: {
      title: "🔄 Campaign Status Types",
      content: [
        "🟢 Active: Running now, sending and tracking responses",
        "🟡 Paused: Stopped temporarily, can resume anytime",
        "⚪ Draft: Not launched yet, still in planning",
        "🔵 Completed: Finished, all metrics locked"
      ],
      action: "Active campaigns show real-time metrics. Completed ones show final results."
    },
    channels: {
      title: "📡 Multi-Channel Campaigns",
      content: [
        "📧 Email: Best open rates (21.5%), good for sequences",
        "🔗 LinkedIn: Best for B2B, native messaging, 15% connection rate",
        "📱 SMS: Highest engagement (98% open, 45% reply rate)",
        "☎️ Phone: Highest conversion but lower volume",
        "🤖 Multi: Use all channels together for 3x conversion!"
      ],
      action: "Use MULTIPLE channels in one campaign = 3x better results than single channel"
    },
    optimization: {
      title: "🚀 How to Improve Campaigns",
      content: [
        "📈 Low open rate? A/B test subject lines, timing, sender",
        "📱 Low click rate? Make CTAs clearer, links more obvious",
        "💬 Low reply? Make messages more personal, shorter, specific",
        "🎯 Not converting? Use follow-up sequences, better targeting",
        "🧠 Let Sophia analyze - she'll suggest improvements"
      ],
      action: "Check Sophia's recommendations - she learns from your data!"
    }
  };

  return (
    <>
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
                <p className="text-sm font-medium text-green-600 dark:text-green-400 flex gap-2">
                  <Lightbulb className="w-4 h-4" />
                  {overlays[activeOverlay as keyof typeof overlays]?.action}
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

function HelpButtonForPerformance({ onShow }: { onShow: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShow}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-performance"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent>What do these metrics mean?</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HelpButtonForStatus({ onShow }: { onShow: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShow}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-status"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent>What do these statuses mean?</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HelpButtonForChannels({ onShow }: { onShow: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShow}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-channels"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent>How do different channels compare?</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HelpButtonForOptimization({ onShow }: { onShow: () => void }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onShow}
            className="p-1.5 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
            data-testid="help-optimization"
          >
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </button>
        </TooltipTrigger>
        <TooltipContent>How can I improve my results?</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
