import { cn } from '@/lib/utils';
import { Dices, Gem, ListChecks } from 'lucide-react';

export type DMNavTab = 'dice' | 'prompts' | 'actions';

interface DMBottomNavProps {
  activeTab: DMNavTab | null;
  onTabChange: (tab: DMNavTab) => void;
  disabled?: boolean;
}

const tabs = [
  { id: 'dice' as DMNavTab, label: 'DICE', icon: Dices, color: 'text-amber-400', activeBg: 'bg-amber-500/10' },
  { id: 'prompts' as DMNavTab, label: 'RP PROMPTS', icon: Gem, color: 'text-yellow-400', activeBg: 'bg-yellow-500/10' },
  { id: 'actions' as DMNavTab, label: 'ACTIONS', icon: ListChecks, color: 'text-emerald-400', activeBg: 'bg-emerald-500/10' },
];

const activeIndicatorColors: Record<DMNavTab, string> = {
  dice: 'bg-amber-500',
  prompts: 'bg-yellow-500',
  actions: 'bg-emerald-500',
};

export function DMBottomNav({ activeTab, onTabChange, disabled }: DMBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-background/95 backdrop-blur-sm border-t border-amber-900/30 z-50 safe-area-bottom">
      <div className="flex h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              disabled={disabled}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95 relative",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                isActive ? tab.activeBg : "hover:bg-muted/10"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <Icon className={cn(
                "w-6 h-6 transition-colors",
                isActive ? tab.color : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-[10px] font-mono tracking-tight transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {tab.label}
              </span>
              {isActive && (
                <div className={cn(
                  "absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full",
                  activeIndicatorColors[tab.id]
                )} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
