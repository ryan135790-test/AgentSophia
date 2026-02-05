import { Flame, Zap, Snowflake } from 'lucide-react';

interface LeadScoreBadgeProps {
  hotness: 'hot' | 'warm' | 'cold';
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export function LeadScoreBadge({ hotness, score, size = 'md' } : LeadScoreBadgeProps) {
  const getStyles = () => {
    switch (hotness) {
      case 'hot':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-700 dark:text-red-300',
          border: 'border-red-300 dark:border-red-700',
          icon: Flame,
          label: '🔥 Hot'
        };
      case 'warm':
        return {
          bg: 'bg-orange-100 dark:bg-orange-900/30',
          text: 'text-orange-700 dark:text-orange-300',
          border: 'border-orange-300 dark:border-orange-700',
          icon: Zap,
          label: '⚡ Warm'
        };
      case 'cold':
        return {
          bg: 'bg-slate-100 dark:bg-slate-900/30',
          text: 'text-slate-700 dark:text-slate-300',
          border: 'border-slate-300 dark:border-slate-700',
          icon: Snowflake,
          label: '❄️ Cold'
        };
    }
  };

  const styles = getStyles();
  const Icon = styles.icon;
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : size === 'lg' ? 'px-4 py-2 text-base' : 'px-3 py-1.5 text-sm';

  return (
    <div className={`flex items-center gap-1.5 ${sizeClasses} rounded-full border ${styles.bg} ${styles.text} ${styles.border} font-semibold`}>
      <Icon className="h-4 w-4" />
      <span>{styles.label}</span>
      <span className="ml-1 opacity-75">{score}</span>
    </div>
  );
}
