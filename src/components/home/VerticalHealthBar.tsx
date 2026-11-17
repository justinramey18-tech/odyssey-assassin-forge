// Side health vial for the solo Empyrean story screen: a forged-iron tube with a rune cap,
// a living blood fill, a temp-HP shimmer and clear bloodied / critical states.
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

export function VerticalHealthBar({ currentHP, maxHP, tempHP = 0, onTap, isWildShape = false }: VerticalHealthBarProps) {
  const max = Number.isFinite(maxHP) && maxHP > 0 ? maxHP : 1;
  const cur = Number.isFinite(currentHP) ? currentHP : 0;
  const temp = Number.isFinite(tempHP) && tempHP > 0 ? tempHP : 0;
  const pct = Math.max(0, Math.min(100, (cur / max) * 100));
  const state = pct <= 25 ? 'critical' : pct <= 50 ? 'bloodied' : 'healthy';

  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="absolute right-0 top-0 bottom-0 z-10 flex flex-col items-center pointer-events-none"
      style={{ transformOrigin: 'bottom', width: '30px' }}
    >
      <button
        onClick={onTap}
        className={cn('empyrean-vial pointer-events-auto', `is-${state}`, isWildShape && 'is-wild')}
        style={{ touchAction: 'manipulation' }}
        aria-label={`Health: ${cur} of ${max} HP${temp > 0 ? `, plus ${temp} temporary HP` : ''}`}
      >
        <span className="empyrean-vial-cap"><Heart className="w-3 h-3" /></span>
        <span className="empyrean-vial-tube">
          <motion.span className="empyrean-vial-fill" initial={{ height: 0 }} animate={{ height: `${pct}%` }} transition={{ duration: 0.6, delay: 0.4 }} />
          {temp > 0 && (
            <span className="empyrean-vial-temp" style={{ bottom: `${pct}%`, height: `${Math.min((temp / max) * 100, 100 - pct)}%` }} />
          )}
          <span className="empyrean-vial-ticks" />
          <span className="empyrean-vial-glass" />
        </span>
        <span className="empyrean-vial-text" style={{ writingMode: 'vertical-rl' }}>
          {cur}/{max}{temp > 0 ? ` +${temp}` : ''}
        </span>
        <span className="empyrean-vial-base" />
      </button>
    </motion.div>
  );
}
