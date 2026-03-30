import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerticalHealthBarProps {
  currentHP: number;
  maxHP: number;
  tempHP?: number;
  onTap?: () => void;
  isWildShape?: boolean;
}

export function VerticalHealthBar({
  currentHP,
  maxHP,
  tempHP = 0,
  onTap,
  isWildShape = false,
}: VerticalHealthBarProps) {
  const hpPercentage = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));

  const isHealthy = hpPercentage > 50;
  const isInjured = hpPercentage > 25 && hpPercentage <= 50;
  const isCritical = hpPercentage <= 25;

  const getBarColor = () => {
    if (isWildShape) {
      if (isCritical) return 'bg-gradient-to-t from-green-900 to-green-700';
      if (isInjured) return 'bg-gradient-to-t from-green-800 to-green-600';
      return 'bg-gradient-to-t from-green-700 to-green-500';
    }
    if (isCritical) return 'bg-gradient-to-t from-red-950 to-red-900';
    if (isInjured) return 'bg-gradient-to-t from-red-950 to-red-800';
    return 'bg-gradient-to-t from-red-900 to-red-700';
  };

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

  const getTextColor = () => {
    if (isWildShape) {
      if (isCritical) return 'text-green-300';
      return 'text-green-400';
    }
    if (isCritical) return 'text-red-400';
    if (isInjured) return 'text-red-500';
    return 'text-red-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="absolute right-0 top-0 bottom-0 z-10 flex flex-col items-center pointer-events-none"
      style={{ transformOrigin: 'bottom', width: '22px' }}
    >
      <button
        onClick={onTap}
        className="relative w-full h-full pointer-events-auto"
        style={{ touchAction: 'manipulation', minWidth: '22px' }}
        aria-label={`Health: ${currentHP} of ${maxHP} HP${tempHP > 0 ? `, plus ${tempHP} temporary HP` : ''}`}
      >
        {/* Bar background */}
        <div
          className={cn(
            "absolute inset-x-0.5 top-1 bottom-1 rounded-full overflow-hidden",
            "bg-black/60 border border-white/20",
            "shadow-lg",
            getGlowColor(),
            isCritical && "animate-health-critical"
          )}
        >
          {/* HP Fill (bottom to top) */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${hpPercentage}%` }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={cn(
              "absolute inset-x-0 bottom-0",
              getBarColor(),
              isHealthy && "animate-health-pulse"
            )}
          />

          {/* Temp HP overlay */}
          {tempHP > 0 && (
            <div
              className="absolute inset-x-0 bg-sky-500/30 border-t border-sky-400/50"
              style={{
                height: `${Math.min((tempHP / maxHP) * 100, 100 - hpPercentage)}%`,
                bottom: `${hpPercentage}%`,
              }}
            />
          )}

          {/* Segmented lines (horizontal) */}
          <div className="absolute inset-0 flex flex-col">
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className="flex-1 border-b border-white/10 last:border-b-0"
              />
            ))}
          </div>
        </div>

        {/* Heart icon at top */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
          <Heart className={cn("w-3 h-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]", getTextColor())} />
        </div>

        {/* Vertical HP text */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
          <span
            className="font-cinzel font-bold text-[9px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] writing-vertical"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '1px' }}
          >
            {currentHP}/{maxHP}
          </span>
          {tempHP > 0 && (
            <span
              className="text-sky-400 font-semibold text-[8px] mt-0.5"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              +{tempHP}
            </span>
          )}
        </div>
      </button>
    </motion.div>
  );
}
