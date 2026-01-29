import { useState, useEffect, useCallback, ReactNode } from 'react';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

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

// Edge trigger tab component that sticks to screen edge
interface EdgeTriggerProps {
  side: 'left' | 'right';
  label: string;
  icon: ReactNode;
  accentColor: string;
  onClick: () => void;
}

export function EdgeTrigger({ side, label, icon, accentColor, onClick }: EdgeTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed top-1/2 -translate-y-1/2 z-40',
        'flex items-center gap-1 py-3 px-1.5',
        'rounded-lg border backdrop-blur-sm',
        'transition-all duration-300 hover:scale-105',
        'touch-manipulation',
        side === 'left' ? 'left-0 rounded-l-none' : 'right-0 rounded-r-none',
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
  );
}
