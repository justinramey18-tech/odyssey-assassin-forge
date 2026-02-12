import { motion } from 'framer-motion';
import { AnimatedD20Trigger } from '@/components/diceRoller';
import { PanelLeft, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EnlargedD20SectionProps {
  onClick: () => void;
  onMenusClick?: () => void;
  onMapClick?: () => void;
}

export function EnlargedD20Section({ onClick, onMenusClick, onMapClick }: EnlargedD20SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: 0.5, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      className="flex items-center justify-center gap-6 py-4"
    >
      {/* Map Button — left of D20 */}
      {onMapClick && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <button
            onClick={onMapClick}
            className={cn(
              "w-16 h-16 rounded-xl",
              "border-2 border-emerald-500/40 hover:border-emerald-400/60",
              "bg-black/40 backdrop-blur-sm hover:bg-black/50",
              "flex items-center justify-center",
              "transition-all duration-300",
              "hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
            )}
            style={{ touchAction: 'manipulation' }}
            aria-label="Open battle map"
          >
            <MapIcon className="w-6 h-6 text-emerald-400" />
          </button>
          <p className="text-[10px] text-muted-foreground font-cinzel uppercase tracking-widest">
            Map
          </p>
        </motion.div>
      )}

      {/* D20 Dice Roller Button */}
      <div className="flex flex-col items-center gap-2">
        <div 
          className={cn(
            "relative w-24 h-24",
            "animate-dice-wobble"
          )}
        >
          <div 
            className={cn(
              "absolute inset-0 rounded-full pointer-events-none",
              "bg-gradient-to-r from-cyan-500/20 to-primary/20",
              "blur-xl animate-pulse"
            )} 
          />
          <div className="relative w-full h-full flex items-center justify-center transform scale-[2.4] pointer-events-none">
            <div className="pointer-events-auto">
              <AnimatedD20Trigger onClick={onClick} />
            </div>
          </div>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs text-muted-foreground font-cinzel uppercase tracking-widest"
        >
          Tap to Roll
        </motion.p>
      </div>

      {/* Quick Menus Drawer Button */}
      {onMenusClick && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7, duration: 0.3 }}
          className="flex flex-col items-center gap-2"
        >
          <button
            onClick={onMenusClick}
            className={cn(
              "w-16 h-16 rounded-xl",
              "border-2 border-cyan-500/40 hover:border-cyan-400/60",
              "bg-black/40 backdrop-blur-sm hover:bg-black/50",
              "flex items-center justify-center",
              "transition-all duration-300",
              "hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
            )}
            style={{ touchAction: 'manipulation' }}
            aria-label="Open quick-access menus"
          >
            <PanelLeft className="w-6 h-6 text-cyan-400" />
          </button>
          <p className="text-[10px] text-muted-foreground font-cinzel uppercase tracking-widest">
            Menus
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
