import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { DiceRollerScreen } from '@/components/diceRoller';
import { AnimatedD20Trigger } from '@/components/diceRoller';

interface CombatDiceRollerProps {
  className?: string;
}

/**
 * Compact dice roller widget for the Combat tab.
 * Shows a tappable D20 that opens the full dice roller in a sheet.
 */
export function CombatDiceRoller({ className }: CombatDiceRollerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Compact Dice Roller Widget */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={cn(
          "mx-4 my-3 p-3 rounded-xl",
          "bg-gradient-to-r from-red-950/40 via-background/40 to-red-950/40",
          "backdrop-blur-sm border border-red-500/30",
          "flex items-center justify-center gap-4",
          className
        )}
      >
        {/* Left Label */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Dices className="w-4 h-4 text-red-400" />
          <span className="text-xs font-mono uppercase tracking-wide">Dice</span>
        </div>

        {/* Central D20 Button */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
          
          {/* D20 Trigger - larger for combat */}
          <motion.button
            onClick={() => setIsOpen(true)}
            className={cn(
              "relative w-16 h-16 rounded-full",
              "bg-gradient-to-br from-red-600/30 to-red-900/50",
              "border-2 border-red-500/50 hover:border-red-400/70",
              "flex items-center justify-center",
              "transition-all duration-200",
              "shadow-lg shadow-red-500/20",
              "touch-manipulation"
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Open Dice Roller"
          >
            {/* D20 SVG */}
            <motion.svg
              viewBox="0 0 100 100"
              className="w-10 h-10"
              animate={{ 
                rotate: [0, 3, -3, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <defs>
                <linearGradient id="combatD20Gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#991b1b" />
                </linearGradient>
                <filter id="combatD20Glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              
              <motion.polygon
                points="50,5 95,35 80,90 20,90 5,35"
                fill="url(#combatD20Gradient)"
                stroke="#f87171"
                strokeWidth="2"
                filter="url(#combatD20Glow)"
                animate={{
                  opacity: [0.9, 1, 0.9],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              
              <polygon
                points="50,25 70,45 50,70 30,45"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="1"
              />
              
              <text
                x="50"
                y="55"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="22"
                fontWeight="bold"
                fontFamily="Cinzel, serif"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
              >
                20
              </text>
            </motion.svg>

            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-red-400/40"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.5, 0, 0.5],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          </motion.button>
        </div>

        {/* Right Label */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs font-mono uppercase tracking-wide">Roller</span>
          <Dices className="w-4 h-4 text-red-400" />
        </div>
      </motion.div>

      {/* Full Dice Roller Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="bottom" 
          className="h-[90vh] p-0 bg-background border-t border-primary/30"
        >
          <SheetTitle className="sr-only">Dice Roller</SheetTitle>
          <DiceRollerScreen onBack={() => setIsOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
