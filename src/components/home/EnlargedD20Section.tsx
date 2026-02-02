import { motion } from 'framer-motion';
import { AnimatedD20Trigger } from '@/components/diceRoller';
import { cn } from '@/lib/utils';

interface EnlargedD20SectionProps {
  onClick: () => void;
}

export function EnlargedD20Section({ onClick }: EnlargedD20SectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.4, 
        delay: 0.5, 
        ease: [0.25, 0.46, 0.45, 0.94] 
      }}
      className="flex flex-col items-center gap-2 py-4"
    >
      {/* Enlarged D20 Container */}
      <div 
        className={cn(
          "relative w-24 h-24",
          "animate-dice-wobble"
        )}
      >
        {/* Outer Glow Ring */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full",
            "bg-gradient-to-r from-cyan-500/20 to-primary/20",
            "blur-xl animate-pulse"
          )} 
        />
        
        {/* D20 Trigger - Scaled Up */}
        <div className="relative w-full h-full flex items-center justify-center transform scale-[2.4]">
          <AnimatedD20Trigger onClick={onClick} />
        </div>
      </div>
      
      {/* Label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-xs text-muted-foreground font-cinzel uppercase tracking-widest"
      >
        Tap to Roll
      </motion.p>
    </motion.div>
  );
}
