// Works out what a tapped quick-action costs on your turn.
//
// The data already exists in the character model, it is just scattered:
//   abilities carry actionType ('action' | 'bonus_action' | 'reaction' | 'passive')
//   spells carry castingTime  ('1 action', '1 bonus action', '1 reaction', '1 minute')
//   weapons and consumables carry nothing at all
//
// This module is the one place that knows how to read all of them. Anything that
// needs to know a cost imports from here rather than re-parsing strings inline.

import type { ActionCost } from './economyStore';

export type { ActionCost };

export interface CostMeta {
  /** Full label, e.g. 'Bonus Action'. */
  label: string;
  /** Three-letter badge used on chips and boxes. */
  short: string;
  /** Tailwind classes for an idle box or chip. */
  className: string;
  /** Tailwind class for the small dot on a chip. */
  dotClass: string;
}

export const COST_META: Record<ActionCost, CostMeta> = {
  action: {
    label: 'Action',
    short: 'ACT',
    className: 'text-red-300 border-red-500/40 bg-red-500/10',
    dotClass: 'bg-red-400',
  },
  bonus: {
    label: 'Bonus Action',
    short: 'BNS',
    className: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
    dotClass: 'bg-amber-400',
  },
  reaction: {
    label: 'Reaction',
    short: 'RCT',
    className: 'text-cyan-300 border-cyan-500/40 bg-cyan-500/10',
    dotClass: 'bg-cyan-400',
  },
  free: {
    label: 'Free',
    short: 'FREE',
    className: 'text-white/50 border-white/15 bg-white/5',
    dotClass: 'bg-white/30',
  },
};

/**
 * Read an ability's actionType field.
 * Returns null when the field is absent or unrecognised so the caller can fall
 * back to its own default rather than being handed a wrong answer.
 */
export function parseActionType(raw: string | null | undefined): ActionCost | null {
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.toLowerCase().replace(/[\s-]+/g, '_');
  if (v === 'passive' || v === 'none' || v === 'free') return 'free';
  if (v.includes('bonus')) return 'bonus';
  if (v.includes('reaction')) return 'reaction';
  if (v.includes('action')) return 'action';
  return null;
}

/**
 * Read a spell's castingTime field.
 *
 * Anything measured in minutes or hours cannot be cast during a round, so it
 * costs nothing on your turn — flagging it as an Action would wrongly burn the
 * box for a ritual the party is performing over a long rest.
 */
export function parseCastingTime(raw: string | null | undefined): ActionCost | null {
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.toLowerCase();
  if (/\b(minute|minutes|hour|hours|day|days)\b/.test(v)) return 'free';
  if (v.includes('bonus')) return 'bonus';
  if (v.includes('reaction')) return 'reaction';
  if (v.includes('action')) return 'action';
  return null;
}

export type QuickActionKind =
  | 'weapon'
  | 'ability'
  | 'spell'
  | 'cantrip'
  | 'consumable'
  | 'prestige'
  | 'homebrew-ability'
  | 'homebrew-spell'
  | 'dragon';

export interface ActionCostInput {
  kind: QuickActionKind;
  /** Abilities and prestige powers. */
  actionType?: string | null;
  /** Spells and cantrips. */
  castingTime?: string | null;
  /** Equipment slot for weapons, e.g. 'secondary_weapon'. */
  equipmentSlot?: string | null;
}

/**
 * Single entry point. Always returns a usable cost; never throws, never null.
 *
 * Defaults are deliberately conservative — when we do not know, we charge an
 * Action, because that is the common case and the player can always tap the box
 * to hand it back. Silently charging nothing would let someone take three turns
 * worth of actions without noticing.
 */
export function resolveActionCost(input: ActionCostInput): ActionCost {
  const { kind, actionType, castingTime, equipmentSlot } = input ?? ({} as ActionCostInput);

  switch (kind) {
    case 'ability':
    case 'homebrew-ability':
    case 'prestige':
      return parseActionType(actionType) ?? 'action';

    case 'spell':
    case 'cantrip':
    case 'homebrew-spell':
      return parseCastingTime(castingTime) ?? 'action';

    case 'weapon':
      // Offhand attacks are the classic bonus action in 5e. A two-weapon
      // fighter taps their off-hand blade and it should not eat their Action.
      return equipmentSlot === 'secondary_weapon' ? 'bonus' : 'action';

    case 'consumable':
      // Drinking or applying an item is an Action by default in 5e.
      return 'action';

    case 'dragon':
      return 'action';

    default:
      return 'action';
  }
}

/** True when this cost occupies a box that can be spent. */
export function isSpendable(cost: ActionCost): cost is Exclude<ActionCost, 'free'> {
  return cost !== 'free';
}
