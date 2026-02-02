import { motion } from 'framer-motion';
import { Sparkles, Star, Zap, Snail, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  getLevelProgress, 
  getXPToNextLevel, 
  getXPForLevel 
} from '@/lib/xpSystem';
import { useXPProgression } from '@/hooks/use-xp-progression';
import { PrestigeData } from '@/lib/prestige';

interface XPProgressBarProps {
  currentLevel: number;
  currentXP: number;
  prestigeData?: PrestigeData;
  nextPrestigeXPRequired?: number;
  onClick?: () => void;
}

export function XPProgressBar({
  currentLevel,
  currentXP,
  prestigeData,
  nextPrestigeXPRequired,
  onClick,
}: XPProgressBarProps) {
  const { mode, multiplier } = useXPProgression();
  const isMaxLevel = currentLevel >= 20;

  // Calculate XP values
  const progress = getLevelProgress(currentLevel, currentXP, multiplier);
  const xpToNext = getXPToNextLevel(currentLevel, currentXP, multiplier);
  const currentLevelXP = getXPForLevel(currentLevel, multiplier);
  const nextLevelXP = getXPForLevel(currentLevel + 1, multiplier);
  const xpInCurrentLevel = Math.max(0, currentXP - currentLevelXP);
  const xpNeededForLevel = nextLevelXP - currentLevelXP;

  // Prestige calculations
  const prestigeProgress = prestigeData && nextPrestigeXPRequired 
    ? Math.min(100, (prestigeData.prestigeXP / nextPrestigeXPRequired) * 100)
    : 0;

  const getModeIcon = () => {
    switch (mode) {
      case 'slow': return <Snail className="w-3 h-3" />;
      case 'fast': return <Zap className="w-3 h-3" />;
      default: return <Gauge className="w-3 h-3" />;
    }
  };

  // Render Prestige XP bar at max level
  if (isMaxLevel && prestigeData && nextPrestigeXPRequired) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        onClick={onClick}
        className="mx-4 group"
        style={{ touchAction: 'manipulation' }}
      >
        <div className="relative p-3 rounded-xl bg-black/40 backdrop-blur-xl border border-amber-500/30">
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-cinzel uppercase tracking-wider text-amber-400 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
                Prestige {prestigeData.prestigeLevel}
              </span>
            </div>
            <span className="text-xs text-amber-300/80 font-mono">
              {prestigeData.prestigeXP.toLocaleString()} / {nextPrestigeXPRequired.toLocaleString()}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-2.5 rounded-full bg-black/60 overflow-hidden border border-amber-500/20">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${prestigeProgress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-400"
              style={{
                boxShadow: '0 0 12px rgba(251, 191, 36, 0.5)',
              }}
            />
          </div>
          
          {/* Tap hint */}
          <p className="text-[10px] text-amber-400/50 text-center mt-1.5 group-hover:text-amber-400/80 transition-colors">
            Tap to add XP
          </p>
        </div>
      </motion.button>
    );
  }

  // Regular XP bar
  return (
    <motion.button
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.3 }}
      onClick={onClick}
      className="mx-4 group"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="relative p-3 rounded-xl bg-black/40 backdrop-blur-xl border border-primary/30">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-cinzel uppercase tracking-wider text-primary drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
              Experience
            </span>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/60">
              {getModeIcon()}
            </div>
          </div>
          <span className="text-xs text-white/80 font-mono">
            <span className="text-primary font-semibold">{xpInCurrentLevel.toLocaleString()}</span>
            <span className="text-white/50"> / {xpNeededForLevel.toLocaleString()}</span>
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="relative h-2.5 rounded-full bg-black/60 overflow-hidden border border-primary/20">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary/80 via-primary to-primary/80"
            style={{
              boxShadow: '0 0 10px rgba(var(--primary), 0.4)',
            }}
          />
        </div>
        
        {/* Footer */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-white/50 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
            Level {currentLevel}
          </span>
          <span className="text-[10px] text-white/50 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">
            {xpToNext.toLocaleString()} XP to next
          </span>
        </div>
        
        {/* Tap hint */}
        <p className="text-[10px] text-primary/50 text-center mt-1 group-hover:text-primary/80 transition-colors">
          Tap to add XP
        </p>
      </div>
    </motion.button>
  );
}
