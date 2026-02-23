import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Crown, Users, ChevronLeft, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DMDrawerProps {
  onOpenSoloDM: () => void;
  onOpenPartyDM: () => void;
  onOpenEmpyrean: () => void;
  isPartyMode: boolean;
  /** Optional visibility filter — return true to show the button */
  isDMButtonVisible?: (buttonId: string) => boolean;
}

const DRAWER_WIDTH = 220;
const EDGE_TAB_WIDTH = 24;
const SWIPE_THRESHOLD = 60;

export function DMDrawer({ onOpenSoloDM, onOpenPartyDM, onOpenEmpyrean, isPartyMode, isDMButtonVisible }: DMDrawerProps) {
  const showButton = isDMButtonVisible ?? (() => true);
  const showSolo = showButton('dm.solo');
  const showParty = showButton('dm.party');
  const showEmpyrean = showButton('dm.empyrean');
  const hasAnyButton = showSolo || showParty || showEmpyrean;
  
  const [isOpen, setIsOpen] = useState(false);
  const x = useMotionValue(DRAWER_WIDTH);
  const backdropOpacity = useTransform(x, [0, DRAWER_WIDTH], [0.4, 0]);
  
  const dragStartX = useRef(0);
  const isDragging = useRef(false);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
  }, [x]);

  const closeDrawer = useCallback(() => {
    animate(x, DRAWER_WIDTH, { type: 'spring', stiffness: 300, damping: 30 }).then(() => {
      setIsOpen(false);
    });
  }, [x]);

  // Edge swipe detection on the entire screen's right edge
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const screenWidth = window.innerWidth;
      // Detect swipe starting from rightmost 20px
      if (touch.clientX >= screenWidth - 20 && !isOpen) {
        isDragging.current = true;
        dragStartX.current = touch.clientX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      const diff = dragStartX.current - touch.clientX;
      if (diff > 10) {
        // User is swiping left from right edge
        const progress = Math.min(diff / DRAWER_WIDTH, 1);
        x.set(DRAWER_WIDTH * (1 - progress));
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const touch = e.changedTouches[0];
      const diff = dragStartX.current - touch.clientX;
      if (diff > SWIPE_THRESHOLD) {
        openDrawer();
      } else {
        animate(x, DRAWER_WIDTH, { type: 'spring', stiffness: 300, damping: 30 });
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, openDrawer, x]);

  const handleAction = useCallback((action: () => void) => {
    closeDrawer();
    // Small delay to let drawer animate out
    setTimeout(action, 150);
  }, [closeDrawer]);

  // If no DM buttons are visible, don't render the drawer at all
  if (!hasAnyButton) return null;

  return (
    <>
      {/* Edge Tab Indicator - always visible when drawer is closed */}
      {!isOpen && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          onClick={openDrawer}
          className={cn(
            "fixed right-0 top-1/2 -translate-y-1/2 z-[45]",
            "flex items-center justify-center",
            "rounded-l-lg border border-r-0 border-amber-500/30",
            "bg-background/80 backdrop-blur-md",
            "shadow-[-4px_0_15px_rgba(245,158,11,0.15)]",
          )}
          style={{ 
            width: EDGE_TAB_WIDTH, 
            height: 56,
          }}
          aria-label="Open DM drawer"
        >
          <ChevronLeft className="w-4 h-4 text-amber-400/70" />
        </motion.button>
      )}

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-[65] bg-black"
            style={{ opacity: backdropOpacity }}
            onClick={closeDrawer}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      {/* Drawer Panel */}
      <motion.div
        className={cn(
          "fixed top-0 right-0 h-full z-[66]",
          "flex flex-col",
          "bg-background/95 backdrop-blur-xl",
          "border-l border-amber-500/20",
          "shadow-[-8px_0_30px_rgba(245,158,11,0.1)]",
        )}
        style={{ 
          width: DRAWER_WIDTH, 
          x,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        drag="x"
        dragConstraints={{ left: 0, right: DRAWER_WIDTH }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 300) {
            closeDrawer();
          } else {
            animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
          }
        }}
      >
        {/* Header */}
        <div className="p-4 pt-16 border-b border-amber-500/15">
          <h2 className="text-sm font-cinzel font-semibold text-amber-400 tracking-wider uppercase">
            Dungeon Master
          </h2>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 p-4">
          {/* Solo DM */}
          {showSolo && (
            <button
              onClick={() => handleAction(onOpenSoloDM)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                "border border-amber-500/25 bg-amber-500/5",
                "hover:bg-amber-500/15 hover:border-amber-500/40",
                "active:scale-[0.98] transition-all duration-200",
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/15">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-cinzel font-medium text-foreground">Solo DM</div>
                <div className="text-[11px] text-muted-foreground">Solo adventure</div>
              </div>
            </button>
          )}

          {/* Party DM */}
          {showParty && (
            <button
              onClick={() => isPartyMode && handleAction(onOpenPartyDM)}
              disabled={!isPartyMode}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                "border transition-all duration-200",
                isPartyMode 
                  ? "border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/15 hover:border-emerald-500/40 active:scale-[0.98]"
                  : "border-border/30 bg-muted/10 opacity-50 cursor-not-allowed",
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isPartyMode ? "bg-emerald-500/15" : "bg-muted/20"
              )}>
                <Users className={cn("w-5 h-5", isPartyMode ? "text-emerald-400" : "text-muted-foreground/50")} />
              </div>
              <div className="text-left">
                <div className={cn(
                  "text-sm font-cinzel font-medium",
                  isPartyMode ? "text-foreground" : "text-muted-foreground/60"
                )}>Party DM</div>
                <div className="text-[11px] text-muted-foreground">
                  {isPartyMode ? "Group adventure" : "Switch to Party mode"}
                </div>
              </div>
            </button>
          )}

          {/* Empyrean Campaign */}
          {showEmpyrean && (
            <button
              onClick={() => handleAction(onOpenEmpyrean)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                "border border-purple-500/25 bg-purple-500/5",
                "hover:bg-purple-500/15 hover:border-purple-500/40",
                "active:scale-[0.98] transition-all duration-200",
              )}
              style={{ touchAction: 'manipulation' }}
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/15">
                <ScrollText className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-cinzel font-medium text-foreground">The Empyrean Campaign</div>
                <div className="text-[11px] text-muted-foreground">Prompts, guides & wizards</div>
              </div>
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
