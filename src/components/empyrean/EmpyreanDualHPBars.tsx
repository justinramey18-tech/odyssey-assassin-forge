import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmpyreanDualHPBarsProps {
  soloHP: { current: number; max: number };
  partyHP: { current: number; max: number };
}

function HPBar({
  currentHP,
  maxHP,
  label,
  side,
}: {
  currentHP: number;
  maxHP: number;
  label: string;
  side: 'left' | 'right';
}) {
  const hpPercentage = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));
  const isCritical = hpPercentage <= 25;
  const isInjured = hpPercentage > 25 && hpPercentage <= 50;
  const isHealthy = hpPercentage > 50;

  const getBarColor = () => {
    if (isCritical) return 'bg-gradient-to-t from-red-950 to-red-900';
    if (isInjured) return 'bg-gradient-to-t from-red-950 to-red-800';
    return 'bg-gradient-to-t from-red-900 to-red-700';
  };

  const getGlowColor = () => {
    if (isCritical) return 'shadow-red-950/60';
    if (isInjured) return 'shadow-red-900/50';
    return 'shadow-red-800/45';
  };

  const getTextColor = () => {
    if (isCritical) return 'text-red-400';
    if (isInjured) return 'text-red-500';
    return 'text-red-600';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        "absolute top-0 bottom-0 z-10 flex flex-col items-center pointer-events-none",
        side === 'left' ? 'left-0' : 'right-0'
      )}
      style={{ transformOrigin: 'bottom', width: '22px' }}
    >
      <div className="relative w-full h-full">
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

          {/* Segmented lines */}
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
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
          <span
            className="font-cinzel font-bold text-[9px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] writing-vertical"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '1px' }}
          >
            {currentHP}/{maxHP}
          </span>
        </div>

        {/* Mode label at bottom */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <span
            className="font-cinzel font-bold text-[7px] text-white/40 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] uppercase"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '2px' }}
          >
            {label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function EmpyreanDualHPBars({ soloHP, partyHP }: EmpyreanDualHPBarsProps) {
  return (
    <>
      {soloHP.max > 0 && (
        <HPBar currentHP={soloHP.current} maxHP={soloHP.max} label="SOLO" side="left" />
      )}
      {partyHP.max > 0 && (
        <HPBar currentHP={partyHP.current} maxHP={partyHP.max} label="PARTY" side="right" />
      )}
    </>
  );
}
