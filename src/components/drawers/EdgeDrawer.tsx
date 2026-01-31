import { ReactNode } from 'react';
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
          'w-[85vw] max-w-[320px] p-0',
          'bg-glass backdrop-blur-xl border-glass',
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
          className="p-4 border-b border-glass bg-glass-subtle backdrop-blur-xl"
          style={{ 
            borderColor: `${accentColor}30`,
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
