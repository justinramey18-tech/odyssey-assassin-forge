import { useState, ReactNode } from 'react';
import { GripVertical, ChevronLeft, ChevronRight, Move, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDraggable } from '@/hooks/use-draggable';

interface EdgeDrawerProps {
  side: 'left' | 'right';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: ReactNode;
  accentColor: string;
  children: ReactNode;
}

export function EdgeDrawer({
  side,
  open,
  onOpenChange,
  title,
  icon,
  accentColor,
  children,
}: EdgeDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'w-[85vw] max-w-[320px] p-0 border-0',
          'bg-background/95 backdrop-blur-xl',
        )}
        style={{
          borderLeft: side === 'right' ? `2px solid ${accentColor}40` : undefined,
          borderRight: side === 'left' ? `2px solid ${accentColor}40` : undefined,
          boxShadow: side === 'left' 
            ? `4px 0 30px ${accentColor}20` 
            : `-4px 0 30px ${accentColor}20`,
        }}
      >
        {/* Header */}
        <SheetHeader 
          className="p-4 border-b"
          style={{ 
            borderColor: `${accentColor}30`,
            background: `linear-gradient(135deg, ${accentColor}10, transparent)`,
          }}
        >
          <SheetTitle className="flex items-center gap-3 text-lg font-cinzel">
            <span 
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ 
                backgroundColor: `${accentColor}20`,
                color: accentColor,
              }}
            >
              {icon}
            </span>
            <span style={{ color: accentColor }}>{title}</span>
          </SheetTitle>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Collapsible edge trigger tabs that can minimize to just an icon
interface EdgeTriggerProps {
  side: 'left' | 'right';
  label: string;
  icon: ReactNode;
  accentColor: string;
  onClick: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function EdgeTrigger({ 
  side, 
  label, 
  icon, 
  accentColor, 
  onClick,
  collapsed = false,
  onToggleCollapse,
}: EdgeTriggerProps) {
  const CollapseIcon = side === 'left' ? ChevronLeft : ChevronRight;
  const ExpandIcon = side === 'left' ? ChevronRight : ChevronLeft;

  if (collapsed) {
    // Minimized state - just a small icon button
    return (
      <div 
        className={cn(
          'fixed z-40 flex flex-col gap-1',
          side === 'left' ? 'left-0' : 'right-0',
        )}
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <button
          onClick={onClick}
          className={cn(
            'p-2 rounded-lg border backdrop-blur-sm',
            'transition-all duration-300 hover:scale-110',
            'touch-manipulation',
            side === 'left' ? 'rounded-l-none' : 'rounded-r-none',
          )}
          style={{
            backgroundColor: `${accentColor}30`,
            borderColor: `${accentColor}50`,
            boxShadow: `0 0 10px ${accentColor}40`,
          }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </button>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              'p-1 rounded-lg border backdrop-blur-sm',
              'transition-all duration-200 hover:bg-white/10',
              'touch-manipulation',
              side === 'left' ? 'rounded-l-none' : 'rounded-r-none',
            )}
            style={{
              backgroundColor: `${accentColor}10`,
              borderColor: `${accentColor}30`,
            }}
          >
            <ExpandIcon className="w-3 h-3" style={{ color: accentColor }} />
          </button>
        )}
      </div>
    );
  }

  // Expanded state - full vertical tab
  return (
    <div
      className={cn(
        'fixed z-40',
        side === 'left' ? 'left-0' : 'right-0',
      )}
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    >
      <div className="flex flex-col">
        <button
          onClick={onClick}
          className={cn(
            'flex items-center gap-1 py-3 px-1.5',
            'rounded-lg border backdrop-blur-sm',
            'transition-all duration-300 hover:scale-105',
            'touch-manipulation',
            side === 'left' ? 'rounded-l-none' : 'rounded-r-none',
          )}
          style={{
            backgroundColor: `${accentColor}20`,
            borderColor: `${accentColor}50`,
            boxShadow: `0 0 15px ${accentColor}30`,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
          }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
          <span 
            className="text-xs font-semibold tracking-wider uppercase"
            style={{ color: accentColor }}
          >
            {label}
          </span>
          <GripVertical className="w-3 h-3 opacity-50" style={{ color: accentColor }} />
        </button>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              'mt-1 p-1 rounded-lg border backdrop-blur-sm mx-auto',
              'transition-all duration-200 hover:bg-white/10',
              'touch-manipulation',
              side === 'left' ? 'rounded-l-none' : 'rounded-r-none',
            )}
            style={{
              backgroundColor: `${accentColor}10`,
              borderColor: `${accentColor}30`,
            }}
          >
            <CollapseIcon className="w-3 h-3" style={{ color: accentColor }} />
          </button>
        )}
      </div>
    </div>
  );
}

// Container for multiple stacked edge triggers - now draggable
interface EdgeTriggerStackProps {
  side: 'left' | 'right';
  triggers: Array<{
    id: string;
    label: string;
    icon: ReactNode;
    accentColor: string;
    onClick: () => void;
    disabled?: boolean;
  }>;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function EdgeTriggerStack({
  side,
  triggers,
  collapsed = false,
  onToggleCollapse,
}: EdgeTriggerStackProps) {
  const CollapseIcon = side === 'left' ? ChevronLeft : ChevronRight;
  const ExpandIcon = side === 'left' ? ChevronRight : ChevronLeft;
  
  // Draggable functionality
  const { position, isDragging, dragHandlers, resetPosition } = useDraggable({
    storageKey: `drawer-stack-position-${side}`,
    initialPosition: { 
      x: side === 'left' ? 0 : (typeof window !== 'undefined' ? window.innerWidth - 50 : 0), 
      y: typeof window !== 'undefined' ? window.innerHeight / 2 - 100 : 200 
    },
  });

  // Determine if we should use fixed edge position or dragged position
  const [hasBeenDragged, setHasBeenDragged] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem(`drawer-stack-position-${side}`);
    return saved !== null;
  });

  const handleResetPosition = () => {
    resetPosition();
    setHasBeenDragged(false);
    localStorage.removeItem(`drawer-stack-position-${side}`);
  };

  // Update hasBeenDragged when drag ends
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setHasBeenDragged(true);
    if ('touches' in e) {
      dragHandlers.onTouchStart(e);
    } else {
      dragHandlers.onMouseDown(e);
    }
  };

  const containerStyle = hasBeenDragged
    ? {
        position: 'fixed' as const,
        left: position.x,
        top: position.y,
        zIndex: 40,
      }
    : {
        position: 'fixed' as const,
        left: side === 'left' ? 0 : undefined,
        right: side === 'right' ? 0 : undefined,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 40,
      };

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        isDragging && 'cursor-grabbing',
      )}
      style={containerStyle}
    >
      {/* Drag Handle */}
      <div
        className={cn(
          'flex items-center justify-center gap-1 p-1.5 rounded-lg border backdrop-blur-sm cursor-grab',
          'transition-all duration-200 hover:bg-white/10',
          'touch-manipulation select-none',
          !hasBeenDragged && (side === 'left' ? 'rounded-l-none' : 'rounded-r-none'),
          isDragging && 'cursor-grabbing bg-white/20',
        )}
        style={{
          backgroundColor: 'hsl(var(--muted) / 0.4)',
          borderColor: 'hsl(var(--border) / 0.5)',
        }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <Move className="w-3 h-3 text-muted-foreground" />
        {hasBeenDragged && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResetPosition();
            }}
            className="p-0.5 rounded hover:bg-white/20 transition-colors"
            title="Reset position"
          >
            <RotateCcw className="w-2.5 h-2.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {triggers.map((trigger) => (
        <button
          key={trigger.id}
          onClick={trigger.onClick}
          disabled={trigger.disabled}
          className={cn(
            'flex items-center gap-1 backdrop-blur-sm border',
            'transition-all duration-300',
            'touch-manipulation',
            hasBeenDragged 
              ? 'rounded-lg' 
              : (side === 'left' ? 'rounded-l-none rounded-r-lg' : 'rounded-r-none rounded-l-lg'),
            collapsed ? 'p-2' : 'py-2 px-1.5',
            trigger.disabled 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:scale-105',
          )}
          style={{
            backgroundColor: `${trigger.accentColor}20`,
            borderColor: `${trigger.accentColor}50`,
            boxShadow: trigger.disabled ? undefined : `0 0 10px ${trigger.accentColor}30`,
            writingMode: collapsed ? undefined : 'vertical-rl',
            textOrientation: collapsed ? undefined : 'mixed',
          }}
        >
          <span style={{ color: trigger.accentColor }}>{trigger.icon}</span>
          {!collapsed && (
            <>
              <span 
                className="text-[10px] font-semibold tracking-wider uppercase"
                style={{ color: trigger.accentColor }}
              >
                {trigger.label}
              </span>
            </>
          )}
        </button>
      ))}
      
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className={cn(
            'p-1.5 rounded-lg border backdrop-blur-sm',
            'transition-all duration-200 hover:bg-white/10',
            'touch-manipulation',
            !hasBeenDragged && (side === 'left' ? 'rounded-l-none' : 'rounded-r-none'),
          )}
          style={{
            backgroundColor: 'hsl(var(--muted) / 0.3)',
            borderColor: 'hsl(var(--border) / 0.5)',
          }}
        >
          {collapsed ? (
            <ExpandIcon className="w-3 h-3 text-muted-foreground" />
          ) : (
            <CollapseIcon className="w-3 h-3 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  );
}
