import { Card } from "@/components/ui/card";
import { Lightbulb, TrendingUp, Zap } from "lucide-react";

interface SmartTipsPanelProps {
  contextualTip?: string;
  researchTip?: string;
  optimizationTip?: string;
  onDismiss?: () => void;
}

export function SmartTipsPanel({ 
  contextualTip, 
  researchTip, 
  optimizationTip,
  onDismiss 
}: SmartTipsPanelProps) {
  const tips = [
    { icon: Lightbulb, content: contextualTip, color: 'from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950' },
    { icon: Zap, content: researchTip, color: 'from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950' },
    { icon: TrendingUp, content: optimizationTip, color: 'from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950' }
  ].filter(t => t.content);

  if (tips.length === 0) return null;

  return (
    <div className="space-y-2">
      {tips.map((tip, i) => {
        const Icon = tip.icon;
        return (
          <Card key={i} className={`p-3 bg-gradient-to-r ${tip.color} border-0`}>
            <div className="flex items-start gap-2">
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {tip.content}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
