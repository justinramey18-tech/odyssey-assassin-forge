import { cn } from '@/lib/utils';

interface TierSeparatorProps {
  label: string;
  yPosition: number;
  treeColor: string;
  isMobile: boolean;
}

export function TierSeparator({
  label,
  yPosition,
  treeColor,
  isMobile,
}: TierSeparatorProps) {
  return (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none z-0"
      style={{ top: yPosition, transform: 'translateY(-50%)' }}
    >
      {/* Left gradient line */}
      <div 
        className="h-px flex-1"
        style={{
          background: `linear-gradient(to right, transparent 0%, ${treeColor}30 50%, ${treeColor}40 100%)`,
        }}
      />
      
      {/* Tier label badge */}
      <div className={cn(
        'px-3 py-0.5 rounded-full uppercase tracking-widest',
        'bg-background/90 border border-muted-foreground/20',
        'text-muted-foreground/50',
        isMobile ? 'text-[8px] px-2' : 'text-[10px]'
      )}>
        {label}
      </div>
      
      {/* Right gradient line */}
      <div 
        className="h-px flex-1"
        style={{
          background: `linear-gradient(to left, transparent 0%, ${treeColor}30 50%, ${treeColor}40 100%)`,
        }}
      />
    </div>
  );
}
