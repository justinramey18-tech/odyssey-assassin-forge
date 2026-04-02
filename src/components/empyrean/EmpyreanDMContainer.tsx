import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getScopedItem, setScopedItem } from '@/lib/scoped-storage';

const LAST_TAB_KEY = 'empyrean-dm-last-tab';

type EmpyreanDMTab = 'solo' | 'party';

interface EmpyreanDMContainerProps {
  open: boolean;
  onClose: () => void;
  soloContent: React.ReactNode;
  partyContent: React.ReactNode;
  hasParty: boolean;
}

export function EmpyreanDMContainer({
  open,
  onClose,
  soloContent,
  partyContent,
  hasParty,
}: EmpyreanDMContainerProps) {
  const [activeTab, setActiveTab] = useState<EmpyreanDMTab>(() => {
    if (!hasParty) return 'solo';
    try {
      const saved = getScopedItem(LAST_TAB_KEY);
      return saved === 'party' ? 'party' : 'solo';
    } catch { return 'solo'; }
  });

  const [direction, setDirection] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    try { setScopedItem(LAST_TAB_KEY, activeTab); } catch {}
  }, [activeTab]);

  const switchTo = useCallback((tab: EmpyreanDMTab) => {
    if (tab === activeTab) return;
    setDirection(tab === 'party' ? -1 : 1);
    setActiveTab(tab);
  }, [activeTab]);

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
      x: dir < 0 ? '100%' : '-100%',
      opacity: 0.5,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir < 0 ? '-100%' : '100%',
      opacity: 0.5,
    }),
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Tab bar — only visible when player has a party */}
      {hasParty && (
        <div className="shrink-0 flex items-center border-b border-purple-500/20 bg-background/95 backdrop-blur-sm relative z-10">
          <button
            onClick={onClose}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/10 transition-colors z-20"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>

          {(['solo', 'party'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => switchTo(tab)}
              className={cn(
                "flex-1 py-2.5 text-xs font-cinzel uppercase tracking-[0.2em] text-center transition-colors relative",
                activeTab === tab
                  ? "text-amber-400"
                  : "text-muted-foreground/50 hover:text-muted-foreground/80"
              )}
              style={{ touchAction: 'manipulation' }}
            >
              {tab === 'solo' ? 'Solo' : 'Party'}
            </button>
          ))}

          {/* Animated underline indicator */}
          <motion.div
            className="absolute bottom-0 h-[2px] bg-amber-400"
            style={{ width: '50%' }}
            animate={{ x: activeTab === 'solo' ? '0%' : '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />
        </div>
      )}

      {/* Minimal back bar when no party */}
      {!hasParty && (
        <div className="shrink-0 flex items-center px-2 py-1.5 border-b border-purple-500/20 bg-background/95 backdrop-blur-sm">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ touchAction: 'manipulation' }}
          >
            <ArrowLeft className="w-4 h-4 text-white/60" />
          </button>
        </div>
      )}

      {/* Content area with slide animation */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            {activeTab === 'solo' ? soloContent : partyContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
