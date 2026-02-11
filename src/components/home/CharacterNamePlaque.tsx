import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getLevelProgress, getXPForLevel } from '@/lib/xpSystem';

interface CharacterNamePlaqueProps {
  name: string;
  level: number;
  currentXP?: number;
  multiplier?: number;
}

export function CharacterNamePlaque({ name, level, currentXP = 0, multiplier = 1 }: CharacterNamePlaqueProps) {
  const isMaxLevel = level >= 20;
  const progress = isMaxLevel ? 100 : getLevelProgress(level, currentXP, multiplier);
  const currentLevelXP = getXPForLevel(level, multiplier);
  const nextLevelXP = getXPForLevel(level + 1, multiplier);
  const xpInLevel = Math.max(0, currentXP - currentLevelXP);
  const xpNeeded = nextLevelXP - currentLevelXP;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="px-4"
    >
      <div 
        className={cn(
          "bg-plaque relative px-4 pt-2 pb-1.5 rounded-lg w-full",
          "border border-primary/30",
          "flex flex-col items-center gap-1"
        )}
      >
        {/* Decorative Corner Accents */}
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/60 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-primary/60 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-primary/60 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-primary/60 rounded-br-lg" />
        
        {/* Character Name & Level */}
        <div className="flex items-center justify-center gap-3">
          <h1 
            className={cn(
              "font-cinzel font-bold text-lg uppercase tracking-widest",
              "text-foreground text-3d-plaque"
            )}
          >
            {name || 'Mercenary'}
          </h1>
          
          <span className="text-primary/40">•</span>
          
          <span 
            className={cn(
              "text-primary font-cinzel font-semibold text-sm uppercase tracking-wider"
            )}
          >
            Level {level}
          </span>
        </div>

        {/* Compact XP Progress Bar */}
        <div className="w-full flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-muted/30 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary/70"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground font-body whitespace-nowrap">
            {isMaxLevel ? 'MAX' : `${xpInLevel.toLocaleString()} / ${xpNeeded.toLocaleString()}`}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
