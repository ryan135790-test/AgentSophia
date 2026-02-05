import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down";
  icon?: React.ReactNode;
  className?: string;
  variant?: "default" | "success" | "insight" | "gradient";
}

export function MetricCard({ 
  title, 
  value, 
  change, 
  trend, 
  icon, 
  className,
  variant = "default" 
}: MetricCardProps) {
  return (
    <div className={cn(
      "relative p-6 rounded-lg border transition-all duration-300 hover:shadow-md",
      variant === "default" && "bg-gradient-card",
      variant === "success" && "bg-gradient-success",
      variant === "insight" && "bg-gradient-insight",
      variant === "gradient" && "bg-gradient-primary",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <p className={cn(
            "text-sm font-medium",
            variant === "success" && "text-success-foreground",
            variant === "insight" && "text-primary-foreground",
            variant === "gradient" && "text-primary-foreground",
            variant === "default" && "text-muted-foreground"
          )}>
            {title}
          </p>
          <p className={cn(
            "text-2xl font-bold",
            variant === "success" && "text-success-foreground",
            variant === "insight" && "text-primary-foreground",
            variant === "gradient" && "text-primary-foreground",
            variant === "default" && "text-foreground"
          )}>
            {value}
          </p>
          {change && (
            <div className="flex items-center space-x-2">
              {trend === "up" && <TrendingUp className="h-4 w-4 text-success" />}
              {trend === "down" && <TrendingDown className="h-4 w-4 text-destructive" />}
              <span className={cn(
                "text-sm font-medium",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                !trend && "text-muted-foreground"
              )}>
                {change}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            "p-3 rounded-full",
            variant === "success" && "bg-success-foreground/10",
            variant === "insight" && "bg-primary-foreground/10",
            variant === "gradient" && "bg-primary-foreground/10",
            variant === "default" && "bg-primary/10"
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}