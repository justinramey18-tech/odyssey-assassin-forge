import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Crosshair,
  Zap,
  Wand2,
  Backpack, 
  FileText,
  ChevronUp,
} from 'lucide-react';
import { CombatTab } from './CombatBottomNav';
import './TacticalHUDStyles.css';

interface GestureDockProps {
  activeTab: CombatTab;
  onTabChange: (tab: CombatTab) => void;
  abilityCounts?: {
    combat: number;
    actions: number;
    spells?: number;
    items: number;
    log?: number;
  };
  className?: string;
}

const tabs = [
  { id: 'combat' as CombatTab, label: 'COMBAT', icon: Crosshair, color: 'text-red-400', bgColor: 'bg-red-500/20' },
  { id: 'actions' as CombatTab, label: 'ACTIONS', icon: Zap, color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  { id: 'spells' as CombatTab, label: 'MAGIC', icon: Wand2, color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
  { id: 'items' as CombatTab, label: 'ITEMS', icon: Backpack, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  { id: 'log' as CombatTab, label: 'LOG', icon: FileText, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
];

/**
 * Gesture-based dock navigation that can be swiped up to reveal full tabs
 * or remains collapsed as a minimal indicator.
 */
export function GestureDock({
  activeTab,
  onTabChange,
  abilityCounts,
  className,
}: GestureDockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef(0);
  const dockRef = useRef<HTMLDivElement>(null);
  
  // Touch handlers for swipe gesture
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
    setIsDragging(true);
  }, []);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = startYRef.current - e.touches[0].clientY;
    // Clamp the offset
    const clampedOffset = Math.max(0, Math.min(deltaY, 150));
    setDragOffset(clampedOffset);
  }, [isDragging]);
  
  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    // If dragged more than 60px, toggle expansion
    if (dragOffset > 60) {
      setIsExpanded(!isExpanded);
    }
    setDragOffset(0);
  }, [dragOffset, isExpanded]);
  
  // Close dock when tapping outside
  useEffect(() => {
    if (!isExpanded) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);
  
  const activeTabData = tabs.find(t => t.id === activeTab);
  const ActiveIcon = activeTabData?.icon ?? Crosshair;
  
  return (
    <div 
      ref={dockRef}
      className={cn(
        "gesture-dock",
        isExpanded ? "gesture-dock--expanded" : "gesture-dock--collapsed",
        className
      )}
      style={{
        transform: isDragging 
          ? `translateY(calc(100% - 32px - ${dragOffset}px))` 
          : undefined,
      }}
    >
      {/* Drag handle area */}
      <div 
        className="relative bg-gradient-to-t from-background via-background to-background/95 border-t border-red-900/40 backdrop-blur-lg"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="flex justify-center py-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex flex-col items-center gap-1 px-4"
          >
            <div className="gesture-dock__handle" />
            <ChevronUp className={cn(
              "w-4 h-4 text-red-400 transition-transform",
              isExpanded && "rotate-180"
            )} />
          </button>
        </div>
        
        {/* Collapsed view - shows current tab indicator */}
        {!isExpanded && (
          <div className="flex items-center justify-center pb-3 safe-area-bottom">
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full",
              activeTabData?.bgColor,
              "border border-red-900/30"
            )}>
              <ActiveIcon className={cn("w-5 h-5", activeTabData?.color)} />
              <span className={cn("text-xs font-mono", activeTabData?.color)}>
                {activeTabData?.label}
              </span>
              {abilityCounts?.[activeTab as keyof typeof abilityCounts] !== undefined && (
                <span className="text-[10px] font-mono text-muted-foreground">
                  ({abilityCounts[activeTab as keyof typeof abilityCounts]})
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Expanded view - full tab bar */}
        {isExpanded && (
          <div className="pb-4 safe-area-bottom animate-fade-in">
            <div className="flex justify-around px-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const count = abilityCounts?.[tab.id as keyof typeof abilityCounts];
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      onTabChange(tab.id);
                      setIsExpanded(false);
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 p-3 rounded-xl transition-all active:scale-95",
                      "relative",
                      isActive && tab.bgColor,
                      isActive && "border border-current/20"
                    )}
                  >
                    {/* Glow effect for active */}
                    {isActive && (
                      <div className={cn(
                        "absolute inset-0 rounded-xl opacity-30 blur-md -z-10",
                        tab.bgColor
                      )} />
                    )}
                    
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
                            ? "bg-foreground text-background" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          {count}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-mono tracking-tight transition-colors",
                      isActive ? tab.color : "text-muted-foreground"
                    )}>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
