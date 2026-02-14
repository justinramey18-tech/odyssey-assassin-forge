import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Dices, Gem, ListChecks } from 'lucide-react';

export type DMNavTab = 'dice' | 'prompts' | 'actions';

interface DMBottomNavProps {
  activeTab: DMNavTab | null;
  onTabChange: (tab: DMNavTab) => void;
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  disabled?: boolean;
  /** Rendered below tabs when dice tab is active */
  diceContent?: React.ReactNode;
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

export function DMBottomNav({ activeTab, onTabChange, isExpanded, onExpandedChange, disabled, diceContent }: DMBottomNavProps) {
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dy = touchStartY.current - e.changedTouches[0].clientY;
    const dt = Date.now() - touchStartTime.current;
    // Swipe up: expand, swipe down: collapse
    // Require at least 30px movement or fast flick (>0.3 px/ms)
    const velocity = Math.abs(dy) / Math.max(dt, 1);
    if (dy > 30 || (dy > 10 && velocity > 0.3)) {
      onExpandedChange(true);
    } else if (dy < -30 || (dy < -10 && velocity > 0.3)) {
      onExpandedChange(false);
    }
  }, [onExpandedChange]);

  const handleToggle = useCallback(() => {
    onExpandedChange(!isExpanded);
  }, [isExpanded, onExpandedChange]);

  const showDiceContent = isExpanded && activeTab === 'dice' && diceContent;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="bg-background/95 backdrop-blur-sm border-t border-amber-900/30">
        {/* Notch handle + label — always visible */}
        <div
          className="flex flex-col items-center py-1.5 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleToggle}
          role="button"
          aria-label={isExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
        >
          <div className={cn(
            "w-10 h-1 rounded-full transition-all",
            isExpanded
              ? "bg-amber-500/50"
              : "bg-amber-500/30 shadow-[0_0_8px_2px_rgba(245,158,11,0.25)] animate-pulse"
          )} />
          {!isExpanded && (
            <span className="text-[9px] font-mono text-amber-400/50 mt-0.5 tracking-widest select-none">
              TOOLS
            </span>
          )}
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="overflow-hidden"
            >
              {/* Tab bar */}
              <div className="flex h-14 border-t border-amber-900/20">
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
                        "w-5 h-5 transition-colors",
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

              {/* Dice roller content (inline in drawer) */}
              <AnimatePresence>
                {showDiceContent && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden max-h-[50vh] overflow-y-auto overscroll-contain"
                  >
                    {diceContent}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
