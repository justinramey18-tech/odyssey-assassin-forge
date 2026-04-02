import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

const LAST_TAB_KEY = 'empyrean-dm-last-tab';

type EmpyreanDMTab = 'solo' | 'party';

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

interface EmpyreanDMContainerProps {
  open: boolean;
  onClose: () => void;
  renderSolo: (swipeHandlers: SwipeHandlers) => React.ReactNode;
  renderParty: (swipeHandlers: SwipeHandlers) => React.ReactNode;
  hasParty: boolean;
}

export function EmpyreanDMContainer({
  open,
  onClose,
  renderSolo,
  renderParty,
  hasParty,
}: EmpyreanDMContainerProps) {
  const [activeTab, setActiveTab] = useState<EmpyreanDMTab>(() => {
    if (!hasParty) return 'solo';
    try {
      const saved = getScopedItem(LAST_TAB_KEY);
      return saved === 'solo' ? 'solo' : 'party';
    } catch { return 'party'; }
  });

  const [direction, setDirection] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Save last active tab
  useEffect(() => {
    try { setScopedItem(LAST_TAB_KEY, activeTab); } catch {}
  }, [activeTab]);

  // Reset to saved tab when opened
  useEffect(() => {
    if (open && hasParty) {
      try {
        const saved = getScopedItem(LAST_TAB_KEY);
        if (saved === 'party' || saved === 'solo') setActiveTab(saved);
      } catch {}
    }
  }, [open, hasParty]);

  const switchTo = useCallback((tab: EmpyreanDMTab) => {
    if (tab === activeTab) return;
    setDirection(tab === 'party' ? -1 : 1);
    setActiveTab(tab);
  }, [activeTab]);

  // Touch/swipe handling
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    touchDeltaRef.current = { x: 0, y: 0 };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    touchDeltaRef.current = {
      x: e.touches[0].clientX - touchStartRef.current.x,
      y: e.touches[0].clientY - touchStartRef.current.y,
    };
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !hasParty) return;
    const { x: deltaX, y: deltaY } = touchDeltaRef.current;
    const threshold = 60;

    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX < 0 && activeTab === 'solo') switchTo('party');
      else if (deltaX > 0 && activeTab === 'party') switchTo('solo');
    }

    touchStartRef.current = null;
    touchDeltaRef.current = { x: 0, y: 0 };
  }, [activeTab, hasParty, switchTo]);

  if (!open) return null;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir < 0 ? '40%' : '-40%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? '-40%' : '40%',
      opacity: 0,
    }),
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Tab bar */}
      <div className="shrink-0 flex items-center border-b border-purple-500/20 bg-background/95 backdrop-blur-sm relative">
        {/* Back button */}
        <button
          onClick={onClose}
          className="p-2.5 rounded-lg hover:bg-white/10 transition-colors ml-1"
          style={{ touchAction: 'manipulation' }}
          aria-label="Back to homescreen"
        >
          <ArrowLeft className="w-4 h-4 text-white/50" />
        </button>

        {/* Tab buttons */}
        {hasParty ? (
          <div className="flex-1 flex relative">
            {(['solo', 'party'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => switchTo(tab)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-cinzel font-semibold uppercase tracking-[0.2em] text-center transition-colors",
                  activeTab === tab
                    ? "text-amber-400"
                    : "text-muted-foreground/40 hover:text-muted-foreground/70"
                )}
                style={{ touchAction: 'manipulation' }}
              >
                {tab}
              </button>
            ))}

            {/* Animated underline */}
            <motion.div
              className="absolute bottom-0 h-[2px] bg-amber-400 rounded-full"
              style={{ width: '50%' }}
              animate={{ x: activeTab === 'solo' ? '0%' : '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          </div>
        ) : (
          <div className="flex-1 py-2.5 text-center">
            <span className="text-xs font-cinzel font-semibold uppercase tracking-[0.2em] text-amber-400">
              Solo Campaign
            </span>
          </div>
        )}

        {/* Spacer to balance the back button */}
        <div className="w-10" />
      </div>

      {/* Content with slide transition */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            {activeTab === 'solo' ? renderSolo() : renderParty()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
