import { cn } from '@/lib/utils';
import { parseRange, parseArea, getRangeCategoryColor, getAreaShapeIcon, RangeInfo, AreaInfo } from '@/lib/magic/rangeUtils';
import { Target, Hand, User, Crosshair, Eye, Infinity, Circle, Square, Triangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RangeIndicatorProps {
  range: string;
  showArea?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RangeIndicator({
  range,
  showArea = true,
  size = 'sm',
  className,
}: RangeIndicatorProps) {
  const rangeInfo = parseRange(range);
  const areaInfo = parseArea(range);
  
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = size === 'sm' ? 'text-[10px]' : size === 'md' ? 'text-xs' : 'text-sm';
  
  // Get appropriate icon for range category
  const RangeIcon = getRangeIcon(rangeInfo.category);
  const AreaIcon = getAreaIcon(areaInfo.shape);
  
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {/* Range Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full",
              "bg-black/30 border border-white/10",
              getRangeCategoryColor(rangeInfo.category)
            )}>
              <RangeIcon className={iconSize} />
              <span className={cn(textSize, "font-mono font-medium")}>
                {rangeInfo.displayText}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {getRangeTooltip(rangeInfo)}
          </TooltipContent>
        </Tooltip>
        
        {/* Area Badge (if applicable) */}
        {showArea && areaInfo.shape !== 'none' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full",
                "bg-indigo-500/20 border border-indigo-500/30 text-indigo-300"
              )}>
                <AreaIcon className={iconSize} />
                <span className={cn(textSize, "font-mono font-medium")}>
                  {areaInfo.displayText}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Area of Effect: {areaInfo.displayText}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

function getRangeIcon(category: string) {
  switch (category) {
    case 'self': return User;
    case 'touch': return Hand;
    case 'short': return Target;
    case 'medium': return Target;
    case 'long': return Crosshair;
    case 'sight': return Eye;
    case 'unlimited': return Infinity;
    default: return Target;
  }
}

function getAreaIcon(shape: string) {
  switch (shape) {
    case 'cone': return Triangle;
    case 'cube': return Square;
    case 'sphere': return Circle;
    case 'cylinder': return Circle;
    case 'line': return Target;
    default: return Target;
  }
}

function getRangeTooltip(rangeInfo: RangeInfo): string {
  if (rangeInfo.category === 'self') {
    return 'Affects you or originates from you';
  }
  if (rangeInfo.category === 'touch') {
    return 'Must touch the target';
  }
  if (rangeInfo.isMelee) {
    return `Melee spell attack (${rangeInfo.displayText})`;
  }
  if (rangeInfo.isRanged) {
    return `Ranged spell (${rangeInfo.displayText})`;
  }
  return rangeInfo.displayText;
}

// Compact inline version for spell cards
export function RangeIndicatorCompact({
  range,
  className,
}: {
  range: string;
  className?: string;
}) {
  const rangeInfo = parseRange(range);
  const RangeIcon = getRangeIcon(rangeInfo.category);
  
  return (
    <div className={cn(
      "flex items-center gap-1",
      getRangeCategoryColor(rangeInfo.category),
      className
    )}>
      <RangeIcon className="w-3 h-3" />
      <span className="text-[10px] font-mono">{rangeInfo.displayText}</span>
    </div>
  );
}
