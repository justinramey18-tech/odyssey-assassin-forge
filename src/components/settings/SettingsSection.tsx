import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  variant?: 'default' | 'danger';
  icon?: React.ReactNode;
}

export function SettingsSection({ 
  title, 
  children, 
  defaultOpen = false, 
  variant = 'default',
  icon,
}: SettingsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const isDanger = variant === 'danger';

  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      isDanger 
        ? "border-destructive/40 bg-destructive/5" 
        : "border-border/40 bg-card/20",
    )}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "w-full flex items-center gap-2.5 p-3.5 text-left transition-colors rounded-lg min-h-[48px]",
          "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isDanger && "hover:bg-destructive/10",
        )}
        aria-expanded={open}
      >
        <ChevronRight className={cn(
          "w-4 h-4 shrink-0 transition-transform duration-200",
          open && "rotate-90",
          isDanger ? "text-destructive" : "text-muted-foreground",
        )} />
        {icon && <span className="shrink-0">{icon}</span>}
        <span className={cn(
          "font-cinzel font-semibold text-sm",
          isDanger ? "text-destructive" : "text-foreground",
        )}>
          {title}
        </span>
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3.5 pb-4 pt-1 space-y-4">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
