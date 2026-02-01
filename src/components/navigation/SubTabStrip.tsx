import { useCallback, useRef, useState, TouchEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp, ChevronDown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MainCategory, getSubTabsForCategory, SubTabConfig } from './types';

interface SubTabStripProps {
  category: MainCategory;
  activeSubTab: string;
  onSubTabChange: (subTab: string) => void;
  onSwipeUp: () => void;
  onSwipeDown: () => void;
  getNextLabel: () => string | null;
  getPrevLabel: () => string | null;
  isLegacyUnlocked?: boolean;
}

// Haptic feedback helper
const triggerHaptic = (intensity: 'light' | 'medium' | 'heavy' = 'light') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 30 };
    navigator.vibrate(patterns[intensity]);
  }
};

export function SubTabStrip({
  category,
  activeSubTab,
  onSubTabChange,
  onSwipeUp,
  onSwipeDown,
  getNextLabel,
  getPrevLabel,
  isLegacyUnlocked = false,
}: SubTabStripProps) {
  const tabs = getSubTabsForCategory(category);
  const currentIndex = tabs.findIndex(t => t.id === activeSubTab);
  const currentTab = tabs[currentIndex];
  
  // Swipe tracking
  const touchStartY = useRef<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);
  
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const deltaY = touchStartY.current - e.touches[0].clientY;
    // Apply resistance
    setSwipeOffset(deltaY * 0.3);
  }, []);
  
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (touchStartY.current === null) return;
    
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const threshold = 40;
    
    if (deltaY > threshold) {
      // Swipe up - next tab
      triggerHaptic('medium');
      onSwipeUp();
    } else if (deltaY < -threshold) {
      // Swipe down - previous tab
      triggerHaptic('medium');
      onSwipeDown();
    }
    
    touchStartY.current = null;
    setSwipeOffset(0);
  }, [onSwipeUp, onSwipeDown]);

  const nextLabel = getNextLabel();
  const prevLabel = getPrevLabel();

  // Get category-specific colors
  const getCategoryColor = () => {
    switch (category) {
      case 'fighting':
        return {
          bg: 'from-red-950/80 via-background/90 to-background/80',
          border: 'border-red-900/40',
          accent: 'text-red-400',
          dot: 'bg-red-500',
          dotMuted: 'bg-red-900/50',
        };
      case 'inventory':
        return {
          bg: 'from-amber-950/80 via-background/90 to-background/80',
          border: 'border-amber-900/40',
          accent: 'text-amber-400',
          dot: 'bg-amber-500',
          dotMuted: 'bg-amber-900/50',
        };
      case 'utility':
        return {
          bg: 'from-cyan-950/80 via-background/90 to-background/80',
          border: 'border-cyan-900/40',
          accent: 'text-cyan-400',
          dot: 'bg-cyan-500',
          dotMuted: 'bg-cyan-900/50',
        };
      default:
        return {
          bg: 'from-slate-950/80 via-background/90 to-background/80',
          border: 'border-slate-900/40',
          accent: 'text-slate-400',
          dot: 'bg-slate-500',
          dotMuted: 'bg-slate-900/50',
        };
    }
  };

  const colors = getCategoryColor();

  if (!currentTab) return null;

  const Icon = currentTab.icon;

  return (
    <div 
      className={cn(
        "relative px-4 py-3 touch-none select-none",
        "bg-gradient-to-b backdrop-blur-sm",
        "border-b",
        colors.bg,
        colors.border,
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: `translateY(${-swipeOffset}px)` }}
    >
      {/* Swipe hint - Previous */}
      <AnimatePresence>
        {prevLabel && swipeOffset < -10 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.7, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-0 left-0 right-0 flex justify-center items-center gap-1 text-[10px] text-muted-foreground"
          >
            <ChevronDown className="w-3 h-3" />
            <span>{prevLabel}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex items-center justify-between">
        {/* Left arrow button */}
        <button
          onClick={() => {
            triggerHaptic('light');
            onSwipeDown();
          }}
          disabled={currentIndex <= 0}
          className={cn(
            "p-2 rounded-lg transition-colors",
            currentIndex > 0 
              ? "hover:bg-white/10 active:scale-95" 
              : "opacity-30 cursor-not-allowed"
          )}
        >
          <ChevronDown className="w-5 h-5 rotate-90" />
        </button>

        {/* Current tab display */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSubTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-2"
            >
              {activeSubTab === 'legacy' && !isLegacyUnlocked ? (
                <Lock className="w-4 h-4 text-muted-foreground" />
              ) : (
                <Icon className={cn("w-4 h-4", currentTab.color)} />
              )}
              <span className={cn("font-cinzel text-sm font-semibold uppercase tracking-wider", currentTab.color)}>
                {currentTab.label}
              </span>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="flex items-center gap-1.5">
            {tabs.map((tab, index) => {
              const isLocked = tab.id === 'legacy' && !isLegacyUnlocked;
              const isActive = index === currentIndex;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (!isLocked) {
                      triggerHaptic('light');
                      onSubTabChange(tab.id);
                    }
                  }}
                  disabled={isLocked}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-200",
                    isActive ? [colors.dot, "scale-125"] : colors.dotMuted,
                    isLocked && "opacity-30",
                    !isLocked && !isActive && "hover:scale-110 hover:opacity-70",
                  )}
                  title={tab.label}
                />
              );
            })}
          </div>
        </div>

        {/* Right arrow button */}
        <button
          onClick={() => {
            triggerHaptic('light');
            onSwipeUp();
          }}
          disabled={currentIndex >= tabs.length - 1}
          className={cn(
            "p-2 rounded-lg transition-colors",
            currentIndex < tabs.length - 1 
              ? "hover:bg-white/10 active:scale-95" 
              : "opacity-30 cursor-not-allowed"
          )}
        >
          <ChevronUp className="w-5 h-5 rotate-90" />
        </button>
      </div>

      {/* Swipe hint - Next */}
      <AnimatePresence>
        {nextLabel && swipeOffset > 10 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 0.7, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute bottom-0 left-0 right-0 flex justify-center items-center gap-1 text-[10px] text-muted-foreground"
          >
            <ChevronUp className="w-3 h-3" />
            <span>{nextLabel}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
