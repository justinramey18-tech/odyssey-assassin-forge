import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DynamicHealthBarProps {
  currentHP: number;
  maxHP: number;
  tempHP?: number;
  onTap?: () => void;
  isWildShape?: boolean;
  wildShapeFormName?: string;
}

export function DynamicHealthBar({
  currentHP,
  maxHP,
  tempHP = 0,
  onTap,
  isWildShape = false,
  wildShapeFormName,
}: DynamicHealthBarProps) {
  const hpPercentage = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  
  // Determine health state
  const isHealthy = hpPercentage > 50;
  const isInjured = hpPercentage > 25 && hpPercentage <= 50;
  const isCritical = hpPercentage <= 25;
  
  // Get bar color based on health (green for Wild Shape, red for normal)
  const getBarColor = () => {
    if (isWildShape) {
      if (isCritical) return 'bg-gradient-to-r from-green-900 to-green-700';
      if (isInjured) return 'bg-gradient-to-r from-green-800 to-green-600';
      return 'bg-gradient-to-r from-green-700 to-green-500';
    }
    if (isCritical) return 'bg-gradient-to-r from-red-950 to-red-900';
    if (isInjured) return 'bg-gradient-to-r from-red-950 to-red-800';
    return 'bg-gradient-to-r from-red-900 to-red-700';
  };
  
  // Get glow color
  const getGlowColor = () => {
    if (isWildShape) {
      if (isCritical) return 'shadow-green-900/50';
      if (isInjured) return 'shadow-green-700/40';
      return 'shadow-green-500/40';
    }
    if (isCritical) return 'shadow-red-950/60';
    if (isInjured) return 'shadow-red-900/50';
    return 'shadow-red-800/45';
  };
  
  // Get text color
  const getTextColor = () => {
    if (isWildShape) {
      if (isCritical) return 'text-green-300';
      return 'text-green-400';
    }
    if (isCritical) return 'text-red-400';
    if (isInjured) return 'text-red-500';
    return 'text-red-600';
  };

  // Haptic feedback helper
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(15);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.4, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="px-4 space-y-3"
      style={{ transformOrigin: 'center' }}
    >
      {/* Wild Shape Form Name Label */}
      {isWildShape && wildShapeFormName && (
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-xs font-cinzel uppercase tracking-wider text-green-400/80">
            🐻 {wildShapeFormName}
          </span>
        </div>
      )}

      {/* Health Bar Container */}
      <button
        onClick={onTap}
        className="w-full text-left"
        style={{ touchAction: 'manipulation' }}
        aria-label={`${isWildShape ? 'Wild Shape ' : ''}Health: ${currentHP} of ${maxHP} HP${tempHP > 0 ? `, plus ${tempHP} temporary HP` : ''}`}
      >
        {/* Main HP Bar */}
        <div 
          className={cn(
            "relative h-8 rounded-lg overflow-hidden",
            "bg-black/60 border border-white/20",
            "shadow-lg",
            getGlowColor(),
            isCritical && "animate-health-critical"
          )}
        >
          {/* HP Fill */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${hpPercentage}%` }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className={cn(
              "absolute inset-y-0 left-0",
              getBarColor(),
              isHealthy && "animate-health-pulse"
            )}
          />
          
          {/* Temp HP Overlay (cyan accent on top) */}
          {tempHP > 0 && (
            <div 
              className="absolute inset-y-0 right-0 bg-sky-500/30 border-l border-sky-400/50"
              style={{ 
                width: `${Math.min((tempHP / maxHP) * 100, 100 - hpPercentage)}%`,
                left: `${hpPercentage}%`
              }}
            />
          )}
          
          {/* Segmented Lines */}
          <div className="absolute inset-0 flex">
            {[...Array(10)].map((_, i) => (
              <div 
                key={i} 
                className="flex-1 border-r border-white/10 last:border-r-0" 
              />
            ))}
          </div>
          
          {/* HP Text Overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Heart className={cn("w-4 h-4", getTextColor())} />
              <span 
                className={cn(
                  "font-cinzel font-bold text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]",
                  "text-white"
                )}
              >
                {currentHP}/{maxHP}
              </span>
              {tempHP > 0 && (
                <span className="text-sky-400 font-semibold text-sm">
                  (+{tempHP})
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
      
    </motion.div>
  );
}
