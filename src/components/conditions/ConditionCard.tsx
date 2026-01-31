import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  X, 
  Minus, 
  Plus, 
  Check, 
  XCircle,
  Eye,
  EyeOff,
  Heart,
  AlertTriangle,
  Hand,
  Ban,
  Ghost,
  Zap,
  Mountain,
  Skull,
  ArrowDown,
  Link,
  Star,
  Moon,
  Battery,
  Sparkles,
  Maximize,
  Target,
  Crosshair,
} from 'lucide-react';
import { ActiveCondition } from '@/lib/conditions/types';
import { getConditionById, SEVERITY_COLORS } from '@/lib/conditions/config';
import { Personality } from '@/components/oracle/types';
import './ConditionStyles.css';

// Icon mapping
const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  EyeOff,
  Heart,
  EarOff: EyeOff, // Fallback
  AlertTriangle,
  Hand,
  Ban,
  Ghost,
  Zap,
  Mountain,
  Skull,
  ArrowDown,
  Link,
  Star,
  Moon,
  Battery,
  Sparkles,
  Maximize,
  Target,
  Crosshair,
  Eye,
};

interface ConditionCardProps {
  condition: ActiveCondition;
  personality?: Personality;
  onRemove: () => void;
  onAdjustDuration: (delta: number) => void;
  onSaveResult?: (success: boolean) => void;
  compact?: boolean;
}

export function ConditionCard({
  condition,
  personality = 'deadpool',
  onRemove,
  onAdjustDuration,
  onSaveResult,
  compact = false,
}: ConditionCardProps) {
  const definition = getConditionById(condition.conditionId);
  const IconComponent = ICON_MAP[condition.icon || 'AlertTriangle'] || AlertTriangle;
  
  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (condition.duration.type === 'indefinite') return 100;
    if (condition.duration.initial === 0) return 0;
    return Math.round((condition.duration.value / condition.duration.initial) * 100);
  }, [condition.duration]);
  
  // Get personality-specific description
  const description = useMemo(() => {
    if (!definition) return condition.notes || '';
    return definition.personalityDescriptions[personality] || definition.mechanicalEffect;
  }, [definition, personality, condition.notes]);
  
  // Duration display
  const durationDisplay = useMemo(() => {
    switch (condition.duration.type) {
      case 'rounds':
        return `${condition.duration.value}r`;
      case 'minutes':
        return `${condition.duration.value}m`;
      case 'hours':
        return `${condition.duration.value}h`;
      case 'save_ends':
        return 'Save';
      case 'indefinite':
        return '∞';
      default:
        return '';
    }
  }, [condition.duration]);
  
  // Color based on severity or custom
  const conditionColor = condition.color || SEVERITY_COLORS[condition.severity];
  
  // Is expiring soon?
  const isExpiring = condition.duration.type === 'rounds' && condition.duration.value <= 1;
  
  if (compact) {
    return (
      <div
        className={cn(
          "condition-strip-item",
          condition.severity === 'critical' && "severity-critical"
        )}
        style={{ '--condition-color': conditionColor } as React.CSSProperties}
      >
        <IconComponent className="w-3 h-3" />
        <span>{condition.name}</span>
        <span className="opacity-70">({durationDisplay})</span>
        <button
          onClick={onRemove}
          className="ml-1 hover:text-red-400 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }
  
  return (
    <div
      className={cn(
        "condition-card rounded-xl border p-4 relative",
        `condition-severity-${condition.severity}`,
        condition.category === 'buff' && "condition-buff-glow",
        condition.isConcentration && "condition-concentration",
        isExpiring && "condition-expiring"
      )}
      style={{ 
        '--condition-color': conditionColor,
        borderColor: `${conditionColor}50`,
        backgroundColor: `${conditionColor}10`,
      } as React.CSSProperties}
    >
      {/* Energy flow effect for medium+ */}
      {(condition.severity === 'medium' || condition.severity === 'high') && (
        <div 
          className="condition-energy-flow"
          style={{ '--condition-color': conditionColor } as React.CSSProperties}
        />
      )}
      
      {/* Electricity arc for critical */}
      {condition.severity === 'critical' && (
        <div 
          className="condition-electricity"
          style={{ '--condition-color': conditionColor } as React.CSSProperties}
        />
      )}
      
      {/* Header */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${conditionColor}30` }}
          >
            <IconComponent 
              className="w-5 h-5" 
              style={{ color: conditionColor }}
            />
          </div>
          
          <div>
            <h4 className="font-cinzel font-semibold text-sm" style={{ color: conditionColor }}>
              {condition.name}
            </h4>
            {condition.source && (
              <p className="text-[10px] text-muted-foreground">
                Source: {condition.source}
              </p>
            )}
          </div>
        </div>
        
        {/* Duration & Controls */}
        <div className="flex items-center gap-2">
          {condition.duration.type !== 'indefinite' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onAdjustDuration(-1)}
              >
                <Minus className="w-3 h-3" />
              </Button>
              
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-mono font-bold"
                style={{ 
                  background: `conic-gradient(${conditionColor} ${progressPercent}%, hsl(0 0% 20%) ${progressPercent}%)`,
                }}
              >
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center bg-background"
                  style={{ color: conditionColor }}
                >
                  {durationDisplay}
                </div>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onAdjustDuration(1)}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-red-400"
            onClick={onRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Description */}
      <p className="text-xs text-muted-foreground mt-3 relative z-10 leading-relaxed">
        {description}
      </p>
      
      {/* Save Ends Controls */}
      {condition.duration.type === 'save_ends' && onSaveResult && (
        <div className="flex items-center gap-2 mt-3 relative z-10">
          <span className="text-[10px] text-muted-foreground">
            {definition?.saveStat || 'CON'} Save:
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-green-500/50 hover:bg-green-500/20"
            onClick={() => onSaveResult(true)}
          >
            <Check className="w-3 h-3 mr-1" />
            Passed
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-red-500/50 hover:bg-red-500/20"
            onClick={() => onSaveResult(false)}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Button>
        </div>
      )}
      
      {/* Concentration indicator */}
      {condition.isConcentration && (
        <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-cyan-400">
          <Eye className="w-3 h-3" />
          <span>CONC</span>
        </div>
      )}
    </div>
  );
}
