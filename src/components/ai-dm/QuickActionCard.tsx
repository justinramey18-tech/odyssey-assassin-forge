import { motion } from 'framer-motion';
import { Swords, Sparkles, HeartPulse, Dices, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActionCard } from '@/lib/roundChatActionCard';

const KIND_META: Record<ActionCard['kind'], { verb: string; icon: React.ElementType; accent: string; ring: string }> = {
  attack: { verb: 'attacks with', icon: Swords, accent: 'text-rose-200', ring: 'from-rose-500/25 to-rose-900/10 border-rose-400/30' },
  spell: { verb: 'casts', icon: Sparkles, accent: 'text-violet-200', ring: 'from-violet-500/25 to-violet-900/10 border-violet-400/30' },
  heal: { verb: 'uses', icon: HeartPulse, accent: 'text-emerald-200', ring: 'from-emerald-500/25 to-emerald-900/10 border-emerald-400/30' },
  effect: { verb: 'uses', icon: FlaskConical, accent: 'text-amber-200', ring: 'from-amber-500/25 to-amber-900/10 border-amber-400/30' },
  check: { verb: 'attempts', icon: Dices, accent: 'text-sky-200', ring: 'from-sky-500/25 to-sky-900/10 border-sky-400/30' },
};

interface Props {
  card: ActionCard;
  actorName: string;
  isSelf?: boolean;
  className?: string;
}

/** Compact animated summary of a quick action, shown instead of the full prompt. */
export function QuickActionCard({ card, actorName, isSelf, className }: Props) {
  const meta = KIND_META[card.kind] ?? KIND_META.effect;
  const Icon = meta.icon;
  const nat20 = card.d20 === 20;
  const nat1 = card.d20 === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-gradient-to-br px-2.5 py-2 text-left',
        meta.ring,
        nat20 && 'border-amber-300/60 shadow-[0_0_18px_rgba(251,191,36,0.25)]',
        nat1 && 'border-red-500/50',
        className,
      )}
    >
      <motion.span
        aria-hidden
        initial={{ x: '-120%' }}
        animate={{ x: '140%' }}
        transition={{ duration: 1.1, ease: 'easeOut' }}
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-white/10 blur-md"
      />

      <div className="flex items-center gap-1.5">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', meta.accent)} />
        <p className="text-[11px] leading-tight text-white/90 min-w-0">
          <span className="font-cinzel font-semibold">{actorName}</span>
          <span className="text-white/55"> {meta.verb} </span>
          <span className={cn('font-semibold', meta.accent)}>{card.action}</span>
          {isSelf && <span className="ml-1 text-[8px] uppercase tracking-wider text-white/40">You</span>}
        </p>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {typeof card.d20 === 'number' && (
          <Chip
            label={card.kind === 'check' ? 'Roll' : 'To hit'}
            value={
              typeof card.attackTotal === 'number'
                ? `${card.attackTotal} (d20 ${card.d20}${(card.attackBonus ?? 0) >= 0 ? '+' : '-'}${Math.abs(card.attackBonus ?? 0)})`
                : `d20 ${card.d20}`
            }
            tone={nat20 ? 'gold' : nat1 ? 'red' : 'neutral'}
          />
        )}
        {card.outcome && <Chip label="Result" value={card.outcome} tone={nat20 ? 'gold' : nat1 ? 'red' : 'neutral'} />}
        {typeof card.damageTotal === 'number' && !nat1 && (
          <Chip
            label="Damage"
            value={`${card.damageTotal}${card.damageFormula ? ` · ${card.damageFormula}` : ''}`}
            tone="red"
          />
        )}
        {typeof card.amount === 'number' && (
          <Chip
            label={card.kind === 'heal' ? 'Healed' : 'Effect'}
            value={`${card.amount}${card.amountFormula ? ` · ${card.amountFormula}` : ''}`}
            tone={card.kind === 'heal' ? 'green' : 'neutral'}
          />
        )}
      </div>

      {(card.damageRolls?.length || card.amountRolls?.length) && (
        <p className="mt-1 text-[9px] text-white/40">
          Dice: {(card.damageRolls ?? card.amountRolls ?? []).join(' + ')}
        </p>
      )}

      {nat20 && <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-amber-300">Natural 20 — critical hit</p>}
      {nat1 && <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-red-400">Natural 1 — critical miss</p>}
      {card.note && <p className="mt-1 text-[9px] text-white/45">{card.note.trim()}</p>}
    </motion.div>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'gold' | 'red' | 'green' }) {
  return (
    <span
      className={cn(
        'px-1.5 py-[2px] rounded-md text-[9px] border',
        tone === 'gold' && 'bg-amber-500/15 border-amber-400/40 text-amber-200',
        tone === 'red' && 'bg-rose-500/10 border-rose-400/30 text-rose-200',
        tone === 'green' && 'bg-emerald-500/10 border-emerald-400/30 text-emerald-200',
        tone === 'neutral' && 'bg-white/5 border-white/15 text-white/70',
      )}
    >
      <span className="opacity-60 uppercase tracking-wider">{label} </span>
      {value}
    </span>
  );
}
