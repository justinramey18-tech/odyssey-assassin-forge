import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ActionCard } from '@/lib/roundChatActionCard';
import { PILL, RIBBON } from './chatPlaques';
import homePillPlaque from '@/assets/home/home-pill-plaque.png.asset.json';
import arcaneRibbonAsset from '@/assets/rolls/arcane-ribbon.png.asset.json';
import glyphTargetAsset from '@/assets/rolls/glyph-target.png.asset.json';
import glyphWandAsset from '@/assets/rolls/glyph-wand.png.asset.json';
import glyphHealAsset from '@/assets/rolls/glyph-heal.png.asset.json';
import glyphD20Asset from '@/assets/rolls/glyph-d20.png.asset.json';
import glyphBoltAsset from '@/assets/rolls/glyph-bolt.png.asset.json';

const arcaneRibbon = arcaneRibbonAsset.url;

const KIND_META: Record<ActionCard['kind'], { verb: string; glyph: string; accent: string }> = {
  attack: { verb: 'attacks with', glyph: glyphTargetAsset.url, accent: 'text-rose-300' },
  spell: { verb: 'casts', glyph: glyphWandAsset.url, accent: 'text-violet-300' },
  heal: { verb: 'uses', glyph: glyphHealAsset.url, accent: 'text-emerald-300' },
  effect: { verb: 'uses', glyph: glyphBoltAsset.url, accent: 'text-amber-300' },
  check: { verb: 'attempts', glyph: glyphD20Asset.url, accent: 'text-sky-300' },
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
  const isSpell = card.kind === 'spell';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      onClick={() => hasDetails && setOpen(o => !o)}
      style={{ touchAction: 'manipulation' }}
      className={cn(
        'flex flex-col py-1',
        alignRight ? 'items-end' : 'items-start',
        hasDetails && 'cursor-pointer',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1.5 max-w-full whitespace-nowrap overflow-hidden text-xs',
          isSpell ? 'text-violet-50' : 'text-amber-50',
        )}
        style={isSpell ? RIBBON(arcaneRibbon) : PILL(homePillPlaque.url)}
      >
        <img src={meta.glyph} alt="" className="w-3.5 h-3.5 shrink-0" />
        <span className={cn('font-cinzel font-semibold', nameClass ?? 'text-white/90')}>{actorName}</span>
        <span className="opacity-70">{meta.verb}</span>
        <span className={cn('font-semibold', meta.accent)}>{card.action}</span>
        {!open && hasDetails && (
          <span className="text-[9px] uppercase tracking-wider opacity-50">tap for rolls</span>
        )}
      </span>
      {open && (
        <p
          className={cn(
            'mt-1 text-xs leading-snug text-white/70 break-words [overflow-wrap:anywhere]',
            alignRight ? 'text-right' : 'text-left',
          )}
        >
          {bits.length > 0 && <span>{bits.join(', ')}</span>}
          {nat20 && (
            <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-amber-300">Nat 20</span>
          )}
          {nat1 && (
            <span className="ml-1 text-[9px] font-semibold uppercase tracking-wider text-red-400">Nat 1</span>
          )}
          {card.note && <span className="text-white/40"> {card.note.trim()}</span>}
        </p>
      )}
    </motion.div>
  );

}
