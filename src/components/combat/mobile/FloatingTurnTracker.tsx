import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sword, 
  Zap, 
  Shield, 
  Footprints,
  ChevronRight,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { ActionEconomy } from '@/lib/combat/combatTypes';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

interface FloatingTurnTrackerProps {
  economy: ActionEconomy;
  onEconomyChange: (economy: ActionEconomy) => void;
  round: number;
  onEndTurn: () => void;
  onEndTurnWithSynthesis?: () => void;
  isScrolling?: boolean;
}

export function FloatingTurnTracker({
  economy,
  onEconomyChange,
  round,
  onEndTurn,
  onEndTurnWithSynthesis,
  isScrolling = false,
}: FloatingTurnTrackerProps) {
  const [showMovementPicker, setShowMovementPicker] = useState(false);
  const [showEndTurnConfirm, setShowEndTurnConfirm] = useState(false);
  const [longPressActive, setLongPressActive] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const hasUsedAnyAction = economy.actionUsed || economy.bonusActionUsed || economy.reactionUsed || economy.movementUsed > 0;

  const toggleAction = useCallback(() => {
    onEconomyChange({ ...economy, actionUsed: !economy.actionUsed });
  }, [economy, onEconomyChange]);

  const toggleBonus = useCallback(() => {
    onEconomyChange({ ...economy, bonusActionUsed: !economy.bonusActionUsed });
  }, [economy, onEconomyChange]);

  const toggleReaction = useCallback(() => {
    onEconomyChange({ ...economy, reactionUsed: !economy.reactionUsed });
  }, [economy, onEconomyChange]);

  const setMovement = useCallback((value: number) => {
    onEconomyChange({ ...economy, movementUsed: value });
    setShowMovementPicker(false);
  }, [economy, onEconomyChange]);

  const handleEndTurnPress = useCallback(() => {
    const timer = setTimeout(() => {
      setLongPressActive(true);
      // Trigger haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
    setLongPressTimer(timer);
  }, []);

  const handleEndTurnRelease = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    
    if (longPressActive) {
      // Long press - show synthesis option
      setShowEndTurnConfirm(true);
      setLongPressActive(false);
    } else {
      // Short press - just end turn
      onEndTurn();
      if (navigator.vibrate) navigator.vibrate(20);
    }
  }, [longPressTimer, longPressActive, onEndTurn]);

  return (
    <>
      {/* Floating tracker bar */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: isScrolling ? 0.7 : 1 }}
        className={cn(
          "fixed bottom-[72px] left-0 right-0 z-40 px-2 pb-1",
          "safe-area-bottom"
        )}
      >
        <div className="bg-background/95 backdrop-blur-md border border-red-900/40 rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center h-14 px-1">
            {/* Action indicator */}
            <TrackerPill
              icon={<Sword className="w-4 h-4" />}
              used={economy.actionUsed}
              label="ACT"
              onTap={toggleAction}
              colorClass="red"
            />

            <div className="w-px h-8 bg-red-900/30" />

            {/* Bonus indicator */}
            <TrackerPill
              icon={<Zap className="w-4 h-4" />}
              used={economy.bonusActionUsed}
              label="BNS"
              onTap={toggleBonus}
              colorClass="amber"
            />

            <div className="w-px h-8 bg-red-900/30" />

            {/* Reaction indicator */}
            <TrackerPill
              icon={<Shield className="w-4 h-4" />}
              used={economy.reactionUsed}
              label="REA"
              onTap={toggleReaction}
              colorClass="cyan"
            />

            <div className="w-px h-8 bg-red-900/30" />

            {/* Movement indicator */}
            <button
              onClick={() => setShowMovementPicker(true)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 h-full px-2 transition-all active:scale-95",
                economy.movementUsed >= economy.maxMovement
                  ? "text-muted-foreground opacity-60"
                  : "text-green-400"
              )}
            >
              <Footprints className="w-4 h-4" />
              <span className="font-mono text-sm font-bold">
                {economy.movementUsed}/{economy.maxMovement}
              </span>
            </button>

            {/* End Turn Button - appears when actions used */}
            <AnimatePresence>
              {hasUsedAnyAction && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 'auto', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <button
                    onMouseDown={handleEndTurnPress}
                    onMouseUp={handleEndTurnRelease}
                    onMouseLeave={() => {
                      if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        setLongPressTimer(null);
                      }
                      setLongPressActive(false);
                    }}
                    onTouchStart={handleEndTurnPress}
                    onTouchEnd={handleEndTurnRelease}
                    className={cn(
                      "h-10 px-4 mx-1 rounded-lg font-mono text-xs font-bold transition-all",
                      "bg-gradient-to-r from-red-600 to-red-500 text-white",
                      "shadow-[0_0_20px_hsl(0_70%_50%/0.4)]",
                      "active:scale-95 active:shadow-[0_0_10px_hsl(0_70%_50%/0.3)]",
                      longPressActive && "scale-95 bg-gradient-to-r from-amber-600 to-amber-500"
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span>END</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Movement Picker Sheet */}
      <Sheet open={showMovementPicker} onOpenChange={setShowMovementPicker}>
        <SheetContent side="bottom" className="h-[40vh] rounded-t-2xl">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader>
            <SheetTitle className="font-cinzel text-green-400">Movement Used</SheetTitle>
            <SheetDescription className="sr-only">Select how much movement you've used this turn</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-3 mt-6">
            {[0, 5, 10, 15, 20, 25, 30, economy.maxMovement].filter((v, i, arr) => arr.indexOf(v) === i).map(value => (
              <Button
                key={value}
                variant="ghost"
                onClick={() => setMovement(value)}
                className={cn(
                  "h-14 text-lg font-mono",
                  economy.movementUsed === value
                    ? "bg-green-500/20 border-green-500/50 text-green-300"
                    : "border border-muted/30"
                )}
              >
                {value}ft
              </Button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Max movement: {economy.maxMovement}ft
          </p>
        </SheetContent>
      </Sheet>

      {/* End Turn Confirmation Sheet (for long-press synthesis option) */}
      <Sheet open={showEndTurnConfirm} onOpenChange={setShowEndTurnConfirm}>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl pb-safe">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <SheetHeader>
            <SheetTitle className="font-cinzel text-red-400">End Turn - Round {round}</SheetTitle>
            <SheetDescription className="sr-only">Choose how to end your turn</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 mt-6">
            <Button
              onClick={() => {
                onEndTurn();
                setShowEndTurnConfirm(false);
              }}
              className="w-full h-14 bg-red-600 hover:bg-red-500 text-white"
            >
              <Check className="w-5 h-5 mr-2" />
              End Turn
            </Button>
            
            {onEndTurnWithSynthesis && (
              <Button
                onClick={() => {
                  onEndTurnWithSynthesis();
                  setShowEndTurnConfirm(false);
                }}
                variant="outline"
                className="w-full h-14 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                End & Synthesize with AI
              </Button>
            )}
            
            <Button
              onClick={() => setShowEndTurnConfirm(false)}
              variant="ghost"
              className="w-full h-12 text-muted-foreground"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TrackerPill({
  icon,
  used,
  label,
  onTap,
  colorClass,
}: {
  icon: React.ReactNode;
  used: boolean;
  label: string;
  onTap: () => void;
  colorClass: 'red' | 'amber' | 'cyan' | 'green';
}) {
  const colors = {
    red: { active: 'text-red-400', used: 'text-muted-foreground' },
    amber: { active: 'text-amber-400', used: 'text-muted-foreground' },
    cyan: { active: 'text-cyan-400', used: 'text-muted-foreground' },
    green: { active: 'text-green-400', used: 'text-muted-foreground' },
  };

  return (
    <button
      onClick={onTap}
      className={cn(
        "flex-1 flex flex-col items-center justify-center h-full px-2 transition-all active:scale-95",
        used ? colors[colorClass].used + " opacity-50" : colors[colorClass].active
      )}
    >
      <div className="relative">
        {icon}
        {used && (
          <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-muted-foreground rounded-full flex items-center justify-center">
            <Check className="w-2 h-2 text-background" />
          </div>
        )}
      </div>
      <span className={cn(
        "text-[9px] font-mono mt-0.5",
        used && "line-through"
      )}>
        {label}
      </span>
    </button>
  );
}
