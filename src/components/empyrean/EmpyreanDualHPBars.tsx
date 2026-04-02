import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmpyreanHP } from '@/lib/dragonBondState';

interface EmpyreanDualHPBarsProps {
  soloHP: EmpyreanHP;
  partyHP: EmpyreanHP;
  onTapSolo?: () => void;
  onTapParty?: () => void;
}

export function EmpyreanDualHPBars({ soloHP, partyHP, onTapSolo, onTapParty }: EmpyreanDualHPBarsProps) {
  return (
    <>
      {soloHP.max > 0 && (
        <HPBar
          currentHP={soloHP.current}
          maxHP={soloHP.max}
          label="SOLO"
          side="left"
          onTap={onTapSolo}
        />
      )}
      {partyHP.max > 0 && (
        <HPBar
          currentHP={partyHP.current}
          maxHP={partyHP.max}
          label="PARTY"
          side="right"
          onTap={onTapParty}
        />
      )}
    </>
  );
}

function HPBar({
  currentHP,
  maxHP,
  label,
  side,
  onTap,
}: {
  currentHP: number;
  maxHP: number;
  label: string;
  side: 'left' | 'right';
  onTap?: () => void;
}) {
  const hpPct = maxHP > 0 ? Math.max(0, Math.min(100, (currentHP / maxHP) * 100)) : 100;
  const isCritical = hpPct <= 25;
  const isInjured = hpPct > 25 && hpPct <= 50;

  const barColor = isCritical
    ? 'bg-gradient-to-t from-red-950 to-red-900'
    : isInjured
    ? 'bg-gradient-to-t from-red-950 to-red-800'
    : 'bg-gradient-to-t from-red-900 to-red-700';

  const glowColor = isCritical
    ? 'shadow-red-950/60'
    : isInjured
    ? 'shadow-red-900/50'
    : 'shadow-red-800/45';

  const textColor = isCritical
    ? 'text-red-400'
    : isInjured
    ? 'text-red-500'
    : 'text-red-600';

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
      <button
        onClick={onTap}
        className="relative w-full h-full pointer-events-auto"
        style={{ touchAction: 'manipulation', minWidth: '22px' }}
        aria-label={`${label} Health: ${currentHP} of ${maxHP} HP`}
      >
        {/* Bar background */}
        <div className={cn(
          "absolute inset-x-0.5 top-1 bottom-1 rounded-full overflow-hidden",
          "bg-black/60 border border-white/20 shadow-lg",
          glowColor
        )}>
          {/* HP Fill */}
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${hpPct}%` }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={cn("absolute inset-x-0 bottom-0", barColor)}
          />

          {/* Segment lines */}
          <div className="absolute inset-0 flex flex-col">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="flex-1 border-b border-white/10 last:border-b-0" />
            ))}
          </div>
        </div>

        {/* Heart icon at top */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
          <Heart className={cn("w-3 h-3 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]", textColor)} />
        </div>

        {/* HP numbers */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
          <span
            className="font-cinzel font-bold text-[9px] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '1px' }}
          >
            {currentHP}/{maxHP}
          </span>
        </div>

        {/* Label at bottom */}
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-10">
          <span
            className="font-cinzel font-bold text-[7px] text-white/40 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] uppercase tracking-wider"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            {label}
          </span>
        </div>
      </button>
    </motion.div>
  );
}
