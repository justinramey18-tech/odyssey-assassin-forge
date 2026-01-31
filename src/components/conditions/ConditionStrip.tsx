import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { ActiveCondition } from '@/lib/conditions/types';
import { SEVERITY_COLORS, BUFF_COLOR } from '@/lib/conditions/config';
import './ConditionStyles.css';

interface ConditionStripProps {
  conditions: ActiveCondition[];
  onRemove?: (id: string) => void;
  onTap?: (condition: ActiveCondition) => void;
  className?: string;
}

export function ConditionStrip({
  conditions,
  onRemove,
  onTap,
  className,
}: ConditionStripProps) {
  // Separate debuffs and buffs
  const debuffs = useMemo(() => 
    conditions.filter(c => c.category === 'debuff'),
  [conditions]);
  
  const buffs = useMemo(() => 
    conditions.filter(c => c.category === 'buff'),
  [conditions]);
  
  if (conditions.length === 0) {
    return null;
  }
  
  // Format duration for compact display
  const formatDuration = (condition: ActiveCondition): string => {
    switch (condition.duration.type) {
      case 'rounds':
        return `${condition.duration.value}`;
      case 'minutes':
        return `${condition.duration.value}m`;
      case 'hours':
        return `${condition.duration.value}h`;
      case 'save_ends':
        return 'Sv';
      case 'indefinite':
        return '∞';
      default:
        return '';
    }
  };
  
  const renderConditionChip = (condition: ActiveCondition) => {
    const color = condition.category === 'buff' 
      ? (condition.color || BUFF_COLOR)
      : (condition.color || SEVERITY_COLORS[condition.severity]);
    
    const isExpiring = condition.duration.type === 'rounds' && condition.duration.value <= 1;
    
    return (
      <button
        key={condition.id}
        onClick={() => onTap?.(condition)}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono",
          "border transition-all active:scale-95",
          isExpiring && "animate-pulse",
          condition.severity === 'critical' && "condition-strip-item severity-critical"
        )}
        style={{
          backgroundColor: `${color}20`,
          borderColor: `${color}50`,
          color: color,
        }}
      >
        {/* Condition name (abbreviated) */}
        <span className="max-w-[60px] truncate">
          {condition.name.length > 8 
            ? condition.name.substring(0, 6) + '…'
            : condition.name
          }
        </span>
        
        {/* Duration */}
        <span className="opacity-70">
          ({formatDuration(condition)})
        </span>
        
        {/* Concentration indicator */}
        {condition.isConcentration && (
          <span className="text-cyan-400">⊙</span>
        )}
        
        {/* Remove button */}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(condition.id);
            }}
            className="ml-0.5 hover:text-red-400 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        )}
      </button>
    );
  };
  
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-1.5 px-3 py-2",
      "bg-black/30 backdrop-blur-sm border-b border-white/10",
      className
    )}>
      {/* Debuffs first */}
      {debuffs.length > 0 && (
        <div className="flex items-center gap-1">
          {debuffs.map(renderConditionChip)}
        </div>
      )}
      
      {/* Separator if both exist */}
      {debuffs.length > 0 && buffs.length > 0 && (
        <span className="text-muted-foreground text-[10px] mx-1">│</span>
      )}
      
      {/* Buffs */}
      {buffs.length > 0 && (
        <div className="flex items-center gap-1">
          {buffs.map(renderConditionChip)}
        </div>
      )}
    </div>
  );
}
