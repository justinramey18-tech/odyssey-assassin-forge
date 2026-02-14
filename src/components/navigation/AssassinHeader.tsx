import { cn } from '@/lib/utils';
import { MainCategory, CATEGORY_CONFIG, getSubTabsForCategory, SubTabConfig } from './types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Lock } from 'lucide-react';
import { CharacterQuickSwitcher } from './CharacterQuickSwitcher';
import { SaveData } from '@/hooks/use-auto-save';

interface AssassinHeaderProps {
  onHomeClick: () => void;
  activeCategory: MainCategory;
  activeSubTab: string;
  onCategoryChange: (category: MainCategory) => void;
  onSubTabChange: (subTab: string, category?: MainCategory) => void;
  isLegacyUnlocked?: boolean;
  // Character quick-switcher props
  currentCharacterName?: string;
  currentCharacterLevel?: number;
  onLoadSave?: (data: SaveData, saveId?: string) => void;
  onCloudClick?: () => void;
}

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[intensity]);
  }
};

export function AssassinHeader({ 
  onHomeClick,
  activeCategory,
  activeSubTab,
  onCategoryChange,
  onSubTabChange,
  isLegacyUnlocked = false,
  currentCharacterName = '',
  currentCharacterLevel = 1,
  onLoadSave,
  onCloudClick,
}: AssassinHeaderProps) {
  const categories: { value: MainCategory; config: typeof CATEGORY_CONFIG['home'] }[] = [
    { value: 'home', config: CATEGORY_CONFIG.home },
    { value: 'fighting', config: CATEGORY_CONFIG.fighting },
    { value: 'inventory', config: CATEGORY_CONFIG.inventory },
    { value: 'utility', config: CATEGORY_CONFIG.utility },
  ];

  const handleHomeClick = () => {
    triggerHaptic('light');
    onHomeClick();
  };

  const handleSubTabSelect = (category: MainCategory, subTabId: string) => {
    triggerHaptic('light');
    if (category !== activeCategory) {
      onCategoryChange(category);
    }
    // Pass the target category explicitly to avoid stale state issues
    onSubTabChange(subTabId, category);
  };

  const getActiveSubTabLabel = (category: MainCategory): string => {
    const tabs = getSubTabsForCategory(category);
    const activeTab = tabs.find(t => t.id === activeSubTab);
    return activeTab?.label || tabs[0]?.label || '';
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-b from-black via-background/98 to-background/90 backdrop-blur-md">
      {/* Assassin's Creed Top Border Art */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />
      <div className="absolute top-[3px] left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />
      
      {/* Angular corner decorations - Assassin's Creed style */}
      <div className="absolute top-0 left-0 w-8 h-8">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-red-500 to-transparent" />
        <div className="absolute top-0 left-0 h-full w-[3px] bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-[8px] left-[8px] w-4 h-4 border-t-2 border-l-2 border-red-400/60 rotate-0" />
      </div>
      <div className="absolute top-0 right-0 w-8 h-8">
        <div className="absolute top-0 right-0 w-full h-[3px] bg-gradient-to-l from-red-500 to-transparent" />
        <div className="absolute top-0 right-0 h-full w-[3px] bg-gradient-to-b from-red-500 to-transparent" />
        <div className="absolute top-[8px] right-[8px] w-4 h-4 border-t-2 border-r-2 border-red-400/60" />
      </div>
      
      {/* Main Navigation Row - 4 tabs only */}
      <div className="h-[60px] w-full flex items-center justify-center px-2">
        <div className="flex bg-transparent p-0 rounded-none gap-1">
          {categories.map(({ value, config }) => {
            const Icon = config.icon;
            const isActive = value === activeCategory;
            const isHome = value === 'home';
            const subTabs = !isHome ? getSubTabsForCategory(value) : [];
            
            // Home button - no dropdown
            if (isHome) {
              return (
                <button
                  key={value}
                  onClick={handleHomeClick}
                  className={cn(
                    "group h-[56px] flex flex-col items-center justify-center gap-1",
                    "px-4 min-w-[70px] rounded-none",
                    "border-x border-red-900/20",
                    "font-cinzel uppercase tracking-wider text-[10px]",
                    "transition-all hover:bg-green-900/20",
                  )}
                >
                  <span className="relative">
                    <Icon className="w-5 h-5 relative z-10 transition-transform group-hover:scale-110" />
                  </span>
                  <span className="whitespace-nowrap">{config.label}</span>
                </button>
              );
            }
            
            // Category with dropdown
            return (
              <DropdownMenu key={value}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "group h-[56px] flex flex-col items-center justify-center gap-0.5",
                      "px-3 min-w-[80px] rounded-none",
                      "border-x border-red-900/20",
                      "font-cinzel uppercase tracking-wider text-[9px]",
                      "transition-all hover:bg-opacity-20",
                      // Category-specific hover colors
                      value === 'fighting' && "hover:bg-red-900/20",
                      value === 'inventory' && "hover:bg-amber-900/20",
                      value === 'utility' && "hover:bg-cyan-900/20",
                      // Active state styling
                      isActive && [
                        "bg-gradient-to-b to-transparent border-b-2",
                        value === 'fighting' && "from-red-600/30 border-b-red-500",
                        value === 'inventory' && "from-amber-600/30 border-b-amber-500",
                        value === 'utility' && "from-cyan-600/30 border-b-cyan-500",
                      ],
                    )}
                  >
                    <span className="relative">
                      <Icon 
                        className={cn(
                          "w-4 h-4 relative z-10 transition-transform",
                          "group-hover:scale-110",
                          isActive && value === 'fighting' && "text-red-400",
                          isActive && value === 'inventory' && "text-amber-400",
                          isActive && value === 'utility' && "text-cyan-400",
                        )} 
                      />
                      {/* Glow effect */}
                      <span 
                        className={cn(
                          "absolute inset-0 blur-md rounded-full transition-opacity",
                          isActive ? "opacity-70 animate-glow-pulse" : "opacity-0",
                          value === 'fighting' && "bg-red-400",
                          value === 'inventory' && "bg-amber-400",
                          value === 'utility' && "bg-cyan-400",
                        )}
                      />
                    </span>
                    <span 
                      className={cn(
                        "whitespace-nowrap flex items-center gap-1",
                        isActive && value === 'fighting' && "text-red-300",
                        isActive && value === 'inventory' && "text-amber-300",
                        isActive && value === 'utility' && "text-cyan-300",
                      )}
                    >
                      {isActive ? getActiveSubTabLabel(value) : config.label}
                      <ChevronDown className="w-3 h-3 opacity-60" />
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="center" 
                  className={cn(
                    "min-w-[160px] bg-background/95 backdrop-blur-md border",
                    value === 'fighting' && "border-red-900/50",
                    value === 'inventory' && "border-amber-900/50",
                    value === 'utility' && "border-cyan-900/50",
                  )}
                >
                  {subTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    const isLocked = tab.id === 'legacy' && !isLegacyUnlocked;
                    const isActiveTab = isActive && activeSubTab === tab.id;
                    
                    return (
                      <DropdownMenuItem
                        key={tab.id}
                        onClick={() => !isLocked && handleSubTabSelect(value, tab.id)}
                        disabled={isLocked}
                        className={cn(
                          "flex items-center gap-3 py-3 px-4 cursor-pointer",
                          "font-cinzel uppercase tracking-wider text-xs",
                          isActiveTab && [
                            value === 'fighting' && "bg-red-900/30 text-red-300",
                            value === 'inventory' && "bg-amber-900/30 text-amber-300",
                            value === 'utility' && "bg-cyan-900/30 text-cyan-300",
                          ],
                          isLocked && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        {isLocked ? (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <TabIcon className={cn("w-4 h-4", tab.color)} />
                        )}
                        <span>{tab.label}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </div>
      </div>
      
      {/* Bottom decorative border with angular accent */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="h-[2px] bg-gradient-to-r from-transparent via-red-900/80 to-transparent" />
        {/* Center diamond accent */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-3 overflow-hidden">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500/40 rotate-45 border border-red-400/60" />
        </div>
      </div>
      
      {/* Character Quick Switcher Row - Below tabs */}
      {onLoadSave && onCloudClick && (
        <div className="w-full flex items-center justify-center py-2 border-t border-red-900/20 bg-background/50">
          <CharacterQuickSwitcher
            currentCharacterName={currentCharacterName}
            currentCharacterLevel={currentCharacterLevel}
            onLoadSave={onLoadSave}
            onCloudClick={onCloudClick}
          />
        </div>
      )}
      
      {/* Decorative side tribal marks */}
      <div className="absolute top-1/2 left-2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-red-500/30 to-transparent pointer-events-none" />
      <div className="absolute top-1/2 right-2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-red-500/30 to-transparent pointer-events-none" />
    </header>
  );
}
