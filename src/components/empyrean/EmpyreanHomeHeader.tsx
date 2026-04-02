import { Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDragonColorHex } from '@/lib/dragonColors';

interface EmpyreanHomeHeaderProps {
  riderName: string;
  level: number;
  dragonName?: string;
  dragonColor?: string;
  isUnbonded: boolean;
  onGearPress: () => void;
}

export function EmpyreanHomeHeader({
  riderName,
  level,
  dragonName,
  dragonColor,
  isUnbonded,
  onGearPress,
}: EmpyreanHomeHeaderProps) {
  const dragonHex = getDragonColorHex(dragonColor);

  return (
    <div className="relative px-4 pt-3 pb-2">
      {/* Gear icon — top right */}
      <button
        onClick={onGearPress}
        className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
        style={{ touchAction: 'manipulation' }}
        aria-label="Settings"
      >
        <Settings className="w-[18px] h-[18px] text-white/40 hover:text-white/70 transition-colors" />
      </button>

      {/* Centered identity stack */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="flex flex-col items-center gap-0.5"
      >
        {/* Rider name */}
        <h1 className="font-cinzel font-bold text-2xl uppercase tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
          {riderName || 'Rider'}
        </h1>

        {/* Level */}
        <span className="text-[11px] font-cinzel text-white/50 uppercase tracking-wider drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          • Level {level} •
        </span>

        {/* Dragon name or unbonded status */}
        {isUnbonded ? (
          <span className="text-sm font-cinzel italic text-red-400/60 mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
            Unbonded
          </span>
        ) : dragonName ? (
          <span
            className="text-sm font-cinzel italic mt-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
            style={{ color: dragonHex }}
          >
            Rider of {dragonName}
          </span>
        ) : null}
      </motion.div>
    </div>
  );
}
