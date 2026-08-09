import { useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, Wand2, HeartPulse, Dices, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActionCard } from '@/lib/roundChatActionCard';


const KIND_META: Record<ActionCard['kind'], { verb: string; icon: React.ElementType; accent: string }> = {
  attack: { verb: 'attacks with', icon: Swords, accent: 'text-rose-300' },
  spell: { verb: 'casts', icon: Wand2, accent: 'text-violet-300' },
  heal: { verb: 'uses', icon: HeartPulse, accent: 'text-emerald-300' },
  effect: { verb: 'uses', icon: FlaskConical, accent: 'text-amber-300' },
  check: { verb: 'attempts', icon: Dices, accent: 'text-sky-300' },
};

interface Props {
  card: ActionCard;
  actorName: string;
  /** Colour class for the actor's name, so players stay distinguishable. */
  nameClass?: string;
  isSelf?: boolean;
  alignRight?: boolean;
  className?: string;
}

/** One-line, symbol-led summary of a quick action shown in the round chat. */
export function QuickActionLine({ card, actorName, nameClass, alignRight, className }: Props) {
  const [open, setOpen] = useState(false);
  const meta = KIND_META[card.kind] ?? KIND_META.effect;
  const Icon = meta.icon;

  const nat20 = card.d20 === 20;
  const nat1 = card.d20 === 1;

  const bits: string[] = [];
  if (typeof card.d20 === 'number') {
    bits.push(
      typeof card.attackTotal === 'number'
        ? `${card.attackTotal} to hit (d20 ${card.d20})`
        : `d20 ${card.d20}`,
    );
  }
  if (card.outcome) bits.push(card.outcome);
  if (typeof card.damageTotal === 'number' && !nat1) {
    bits.push(`${card.damageTotal} damage${card.damageFormula ? ` (${card.damageFormula})` : ''}`);
  }
  if (typeof card.amount === 'number') {
    bits.push(
      `${card.kind === 'heal' ? 'healed' : 'effect'} ${card.amount}${card.amountFormula ? ` (${card.amountFormula})` : ''}`,
    );
  }

  const hasDetails = bits.length > 0 || nat20 || nat1 || !!card.note;

  return (
    <motion.p
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      onClick={() => hasDetails && setOpen(o => !o)}
      style={{ touchAction: 'manipulation' }}
      className={cn(
        'text-xs leading-snug break-words [overflow-wrap:anywhere] py-1.5',
        hasDetails && 'cursor-pointer',
        alignRight ? 'text-right' : 'text-left',
        className,
      )}
    >
      <Icon className={cn('inline-block w-3 h-3 mr-1 -mt-[2px]', meta.accent)} />
      <span className={cn('font-cinzel font-semibold', nameClass ?? 'text-white/90')}>{actorName}</span>
      <span className="text-white/55"> {meta.verb} </span>
      <span className={cn('font-semibold', meta.accent)}>{card.action}</span>
      <Icon className={cn('inline-block w-3 h-3 ml-1 -mt-[2px]', meta.accent)} />
      {!open && hasDetails && (
        <span className="ml-1 text-[9px] uppercase tracking-wider text-white/35">tap for rolls</span>
      )}
      {open && (
        <>
          {bits.length > 0 && <span className="text-white/70"> — {bits.join(', ')}</span>}
          {nat20 && (
            <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-amber-300">Nat 20</span>
          )}
          {nat1 && (
            <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-red-400">Nat 1</span>
          )}
          {card.note && <span className="text-white/40"> {card.note.trim()}</span>}
        </>
      )}
    </motion.p>
  );

}
