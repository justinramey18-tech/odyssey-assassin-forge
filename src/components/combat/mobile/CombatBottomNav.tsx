import { cn } from '@/lib/utils';
import { 
  Sword, 
  Sparkles, 
  Backpack, 
  FileText,
  Wand2,
} from 'lucide-react';

// Consolidated tabs: 7 → 5
export type CombatTab = 'combat' | 'actions' | 'spells' | 'items' | 'log';

// Sub-tabs for consolidated tabs
export type CombatSubTab = 'attacks' | 'stealth';
export type ActionsSubTab = 'abilities' | 'reactions';

interface CombatBottomNavProps {
  activeTab: CombatTab;
  onTabChange: (tab: CombatTab) => void;
  abilityCounts?: {
    attacks: number;
    stealth: number;
    abilities: number;
    reactions?: number;
    spells?: number;
    items: number;
    log?: number;
  };
}

const tabs = [
  { id: 'combat' as CombatTab, label: 'COMBAT', icon: Sword, color: 'text-red-400' },
  { id: 'actions' as CombatTab, label: 'ACTIONS', icon: Sparkles, color: 'text-amber-400' },
  { id: 'spells' as CombatTab, label: 'MAGIC', icon: Wand2, color: 'text-indigo-400' },
  { id: 'items' as CombatTab, label: 'ITEMS', icon: Backpack, color: 'text-green-400' },
  { id: 'log' as CombatTab, label: 'LOG', icon: FileText, color: 'text-primary' },
];

export function CombatBottomNav({ 
  activeTab, 
  onTabChange,
  abilityCounts 
}: CombatBottomNavProps) {
  // Calculate combined counts for consolidated tabs
  const getCombinedCount = (tabId: CombatTab): number | undefined => {
    if (!abilityCounts) return undefined;
    
    switch (tabId) {
      case 'combat':
        return (abilityCounts.attacks || 0) + (abilityCounts.stealth || 0);
      case 'actions':
        return (abilityCounts.abilities || 0) + (abilityCounts.reactions || 0);
      case 'spells':
        return abilityCounts.spells;
      case 'items':
        return abilityCounts.items;
      case 'log':
        return abilityCounts.log;
      default:
        return undefined;
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[72px] bg-background/95 backdrop-blur-sm border-t border-red-900/30 z-50 safe-area-bottom">
      <div className="flex h-full">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = getCombinedCount(tab.id);
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95",
                "min-h-[44px]", // Minimum touch target
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

// Sub-tab pill selector for consolidated tabs
export function SubTabPills<T extends string>({ 
  tabs, 
  activeTab, 
  onTabChange 
}: {
  tabs: { id: T; label: string }[];
  activeTab: T;
  onTabChange: (tab: T) => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-background/50 border-b border-red-900/20">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-mono transition-all",
            "min-h-[32px] active:scale-95",
            activeTab === tab.id
              ? "bg-red-500/20 text-red-400 border border-red-500/40"
              : "bg-muted/10 text-muted-foreground border border-muted/20 hover:border-muted/40"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
