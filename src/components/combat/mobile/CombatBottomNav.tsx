import { cn } from '@/lib/utils';
import { 
  Sword, 
  Moon, 
  Sparkles, 
  Backpack, 
  FileText 
} from 'lucide-react';

export type CombatTab = 'attacks' | 'stealth' | 'abilities' | 'items' | 'summary';

interface CombatBottomNavProps {
  activeTab: CombatTab;
  onTabChange: (tab: CombatTab) => void;
  abilityCounts?: {
    attacks: number;
    stealth: number;
    abilities: number;
    items: number;
  };
}

const tabs = [
  { id: 'attacks' as CombatTab, label: 'ATTACKS', icon: Sword, color: 'text-red-400' },
  { id: 'stealth' as CombatTab, label: 'STEALTH', icon: Moon, color: 'text-purple-400' },
  { id: 'abilities' as CombatTab, label: 'ABILITIES', icon: Sparkles, color: 'text-amber-400' },
  { id: 'items' as CombatTab, label: 'ITEMS', icon: Backpack, color: 'text-cyan-400' },
  { id: 'summary' as CombatTab, label: 'SUMMARY', icon: FileText, color: 'text-green-400' },
];

export function CombatBottomNav({ 
  activeTab, 
  onTabChange,
  abilityCounts 
}: CombatBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-background/95 backdrop-blur-sm border-t border-red-900/30 z-50 safe-area-bottom">
      <div className="flex h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = abilityCounts?.[tab.id as keyof typeof abilityCounts];
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
                isActive 
                  ? "bg-red-500/10" 
                  : "hover:bg-muted/10"
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  "w-6 h-6 transition-colors",
                  isActive ? tab.color : "text-muted-foreground"
                )} />
                {count !== undefined && count > 0 && (
                  <span className={cn(
                    "absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center",
                    "text-[10px] font-bold rounded-full",
                    isActive 
                      ? "bg-red-500 text-white" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-mono tracking-tight transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-red-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
