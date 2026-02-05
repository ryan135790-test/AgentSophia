import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, Flame, Snowflake, Zap } from "lucide-react";
import { getLeadTier } from "@/lib/lead-scoring";

interface LeadScoreBadgeProps {
  score: number;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LeadScoreBadge({ score, showIcon = true, showLabel = false, size = "md" }: LeadScoreBadgeProps) {
  const { tier, color, label } = getLeadTier(score);

  const Icon = tier === 'hot' ? Flame : tier === 'warm' ? TrendingUp : tier === 'cold' ? Snowflake : Zap;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className={`${sizeClasses[size]} font-semibold`}
            style={{ backgroundColor: `${color}20`, color: color, borderColor: color }}
            data-testid={`lead-score-${tier}`}
          >
            {showIcon && <Icon className="h-3 w-3 mr-1" />}
            {score}
            {showLabel && <span className="ml-1">• {label}</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-sm">
            <div className="font-semibold">{label}</div>
            <div className="text-muted-foreground">Score: {score}/100</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
