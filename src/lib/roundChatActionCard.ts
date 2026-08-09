// Quick-action "cards" for the round chat.
//
// A quick action (weapon swing, spell, potion, item effect, skill check) still
// sends the DM its full prompt, but the round chat should show a compact
// summary instead of the wall of text. We carry that summary as a small hidden
// header on the message content and strip it back off before the DM ever
// sees it.

import type { AnyRollResult } from '@/lib/promptAutoRoll';

export interface ActionCard {
  /** Short label, e.g. "Fireball" or "Potion of Healing". */
  action: string;
  kind: 'attack' | 'spell' | 'check' | 'heal' | 'effect';
  /** The raw d20 face, for attacks/spells/checks. */
  d20?: number;
  attackBonus?: number;
  attackTotal?: number;
  /** Rolled damage total and the dice that produced it. */
  damageTotal?: number;
  damageFormula?: string;
  damageRolls?: number[];
  /** Healing / effect total. */
  amount?: number;
  amountFormula?: string;
  amountRolls?: number[];
  /** Check outcome tier, e.g. "success". */
  outcome?: string;
  /** Extra line, e.g. "A level 3 slot was spent (1 left)." */
  note?: string;
}

const OPEN = '\u27EAAC\u27EB';
const CLOSE = '\u27EA/AC\u27EB';

/** Build a card from an auto-roll result. */
export function actionCardFromRoll(action: string, roll: AnyRollResult, note?: string): ActionCard {
  const base = { action, note: note?.trim() || undefined };
  if (roll.kind === 'check') {
    return { ...base, kind: 'check', d20: roll.d20, outcome: roll.outcome };
  }
  if (roll.kind === 'heal' || roll.kind === 'effect') {
    const bonus = roll.bonus ? `${roll.bonus > 0 ? '+' : '-'}${Math.abs(roll.bonus)}` : '';
    return {
      ...base,
      kind: roll.kind,
      amount: roll.total,
      amountFormula: `${roll.rolls.length}d${roll.die}${bonus}`,
      amountRolls: roll.rolls,
    };
  }
  return {
    ...base,
    kind: roll.kind,
    d20: roll.d20,
    attackBonus: roll.attackBonus,
    attackTotal: roll.attackTotal,
    damageTotal: roll.damageTotal,
    damageFormula: `${roll.damageCount ?? roll.damageRolls.length}d${roll.damageDie}`,
    damageRolls: roll.damageRolls,
  };
}

/** Attach a card to a prompt so it can ride along in the chat message. */
export function encodeActionCard(card: ActionCard, prompt: string): string {
  try {
    return `${OPEN}${JSON.stringify(card)}${CLOSE}\n${prompt}`;
  } catch {
    return prompt;
  }
}

/** Pull the card (if any) plus the underlying prompt text back out. */
export function parseActionCard(content: string): { card: ActionCard | null; body: string } {
  if (!content || !content.startsWith(OPEN)) return { card: null, body: content };
  const end = content.indexOf(CLOSE);
  if (end === -1) return { card: null, body: content };
  const raw = content.slice(OPEN.length, end);
  const body = content.slice(end + CLOSE.length).replace(/^\n/, '');
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.action === 'string') return { card: parsed as ActionCard, body };
  } catch {
    /* fall through */
  }
  return { card: null, body };
}

/** The DM-facing text, with any card header removed. */
export function stripActionCard(content: string): string {
  return parseActionCard(content).body;
}
