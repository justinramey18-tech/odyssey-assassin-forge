import { useState, useRef, useEffect, ReactNode } from 'react';
import { GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
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

// Individual draggable trigger button
interface DraggableTriggerProps {
  id: string;
  label: string;
  icon: ReactNode;
  accentColor: string;
  onClick: () => void;
  disabled?: boolean;
  defaultPosition: { x: number; y: number };
  // Navigation props for edge-hold gestures
  isHomeScreen?: boolean;
  onNavigateHome?: () => void;
  onNavigateToSkills?: () => void;
}

const LEFT_EDGE_THRESHOLD = 15;
const RIGHT_EDGE_BUFFER = 75;
const HOLD_DURATION_MS = 1000;

function DraggableTrigger({
  id,
  label,
  icon,
  accentColor,
  onClick,
  disabled = false,
  defaultPosition,
  isHomeScreen = false,
  onNavigateHome,
  onNavigateToSkills,
}: DraggableTriggerProps) {
  const { position, isDragging, dragHandlers } = useDraggable({
    storageKey: `drawer-trigger-${id}`,
    initialPosition: defaultPosition,
  });

  const [dragStartTime, setDragStartTime] = useState<number>(0);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isAtEdge, setIsAtEdge] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor position during drag for edge detection
  useEffect(() => {
    if (!isDragging) {
      // Clear timer when not dragging
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      setIsAtEdge(false);
      return;
    }

    const screenWidth = window.innerWidth;
    const atLeftEdge = position.x <= LEFT_EDGE_THRESHOLD;
    const atRightEdge = position.x >= screenWidth - RIGHT_EDGE_BUFFER;

    // Determine if we're at a relevant edge for navigation
    const shouldTriggerNav = 
      (atLeftEdge && !isHomeScreen && onNavigateHome) ||
      (atRightEdge && isHomeScreen && onNavigateToSkills);

    if (shouldTriggerNav && !holdTimerRef.current) {
      // Start hold timer
      setIsAtEdge(true);
      holdTimerRef.current = setTimeout(() => {
        if (atLeftEdge && !isHomeScreen && onNavigateHome) {
          onNavigateHome();
        } else if (atRightEdge && isHomeScreen && onNavigateToSkills) {
          onNavigateToSkills();
        }
        holdTimerRef.current = null;
        setIsAtEdge(false);
      }, HOLD_DURATION_MS);
    } else if (!shouldTriggerNav && holdTimerRef.current) {
      // Moved away from edge, clear timer
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      setIsAtEdge(false);
    }

    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [isDragging, position.x, isHomeScreen, onNavigateHome, onNavigateToSkills]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartTime(Date.now());
    setDragStartPos({ x: e.clientX, y: e.clientY });
    dragHandlers.onMouseDown(e);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartTime(Date.now());
    if (e.touches.length > 0) {
      setDragStartPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
    dragHandlers.onTouchStart(e);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger click if it wasn't a drag (short duration and minimal movement)
    const timeDiff = Date.now() - dragStartTime;
    const distance = Math.sqrt(
      Math.pow(e.clientX - dragStartPos.x, 2) + 
      Math.pow(e.clientY - dragStartPos.y, 2)
    );
    
    if (timeDiff < 200 && distance < 10 && !disabled) {
      onClick();
    }
  };

  return (
    <div
      className="fixed z-40"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        data-tutorial-id={id === 'stats' ? 'drawer-stats' : id === 'scribe' ? 'drawer-scribe' : undefined}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'flex items-center gap-1.5 py-2.5 px-2 rounded-lg border backdrop-blur-md',
          'transition-all duration-200',
          'touch-manipulation select-none',
          isDragging ? 'cursor-grabbing scale-105' : 'cursor-grab',
          disabled && 'opacity-50 cursor-not-allowed',
          isAtEdge && 'animate-pulse',
        )}
        style={{
          backgroundColor: isAtEdge ? `${accentColor}20` : 'rgba(0, 0, 0, 0.3)',
          borderColor: isAtEdge ? accentColor : `${accentColor}40`,
          boxShadow: isAtEdge
            ? `0 0 25px ${accentColor}70, 0 0 50px ${accentColor}40`
            : isDragging 
              ? `0 0 20px ${accentColor}50, 0 8px 25px rgba(0,0,0,0.3)` 
              : `0 0 8px ${accentColor}20`,
        }}
      >
        <span style={{ color: accentColor }}>{icon}</span>
        <span 
          className="text-[10px] font-semibold tracking-wider uppercase whitespace-nowrap"
          style={{ color: accentColor }}
        >
          {label}
        </span>
        <GripVertical 
          className="w-3 h-3 opacity-40" 
          style={{ color: accentColor }} 
        />
      </button>
    </div>
  );
}

// Container that renders each trigger as independently draggable
interface TriggerConfig {
  id: string;
  label: string;
  icon: ReactNode;
  accentColor: string;
  onClick: () => void;
  disabled?: boolean;
  'data-tutorial-id'?: string;
}

interface EdgeTriggerStackProps {
  side: 'left' | 'right';
  triggers: TriggerConfig[];
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isHomeScreen?: boolean;
  onNavigateHome?: () => void;
  onNavigateToSkills?: () => void;
}

export function EdgeTriggerStack({
  side,
  triggers,
  isHomeScreen = false,
  onNavigateHome,
  onNavigateToSkills,
}: EdgeTriggerStackProps) {
  // Calculate default positions - stacked vertically on the left edge
  const getDefaultPosition = (index: number) => {
    const startY = 120; // Start below header
    const spacing = 50; // Vertical spacing between buttons
    return {
      x: 4, // Slight offset from edge
      y: startY + (index * spacing),
    };
  };

  return (
    <>
      {triggers.map((trigger, index) => (
        <DraggableTrigger
          key={trigger.id}
          id={trigger.id}
          label={trigger.label}
          icon={trigger.icon}
          accentColor={trigger.accentColor}
          onClick={trigger.onClick}
          disabled={trigger.disabled}
          defaultPosition={getDefaultPosition(index)}
          isHomeScreen={isHomeScreen}
          onNavigateHome={onNavigateHome}
          onNavigateToSkills={onNavigateToSkills}
        />
      ))}
    </>
  );
}

// Legacy single edge trigger (kept for compatibility)
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
