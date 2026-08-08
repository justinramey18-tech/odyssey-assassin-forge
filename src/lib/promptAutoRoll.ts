// Dice results + prompt suffixes for auto-rolled action and RP prompts.
// The d20 honours the player's dice odds mode; damage dice always roll fair
// because the odds brackets are shaped for the d20 only.

import { rollWeightedDie, loadDiceOddsMode, DICE_ODDS_CONFIGS, type DiceOddsMode } from '@/lib/diceOdds';

export interface AttackRollResult {
  kind: 'attack' | 'spell';
  d20: number;
  damageRolls: number[];
  damageDie: number;
  damageTotal: number;
  /** Number of damage dice rolled, so the suffix can show the real formula. */
  damageCount?: number;
  /** The character's attack/spell attack bonus, already added to the d20. */
  attackBonus?: number;
  /** d20 + attackBonus. */
  attackTotal?: number;
  mode: DiceOddsMode;
}

export interface CheckRollResult {
  kind: 'check';
  d20: number;
  outcome: 'critical failure' | 'failure' | 'mixed success' | 'success' | 'critical success';
  mode: DiceOddsMode;
}

export interface HealRollResult {
  kind: 'heal';
  rolls: number[];
  die: number;
  bonus: number;
  total: number;
  mode: DiceOddsMode;
}

/** A plain item/effect dice roll (no d20, no healing semantics). */
export interface EffectRollResult {
  kind: 'effect';
  label: string;
  rolls: number[];
  die: number;
  bonus: number;
  total: number;
  mode: DiceOddsMode;
}

export type AnyRollResult = AttackRollResult | CheckRollResult | HealRollResult | EffectRollResult;


function rollFair(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function parseDamageDice(formula: string | undefined): { count: number; die: number } | null {
  if (!formula) return null;
  const m = /^\s*(\d{1,2})d(\d{1,3})/i.exec(formula);
  if (!m) return null;
  return { count: Math.min(20, Math.max(1, parseInt(m[1], 10))), die: Math.max(2, parseInt(m[2], 10)) };
}

/** Flat modifier tacked onto a damage formula, e.g. the "+3" in "1d8+3". */
export function parseDamageFlat(formula: string | undefined): number {
  if (!formula) return 0;
  const m = /^\s*\d{1,2}d\d{1,3}\s*([+-])\s*(\d{1,3})/i.exec(formula);
  if (!m) return 0;
  const n = parseInt(m[2], 10);
  if (!Number.isFinite(n)) return 0;
  return m[1] === '-' ? -n : n;
}

export function rollAttack(kind: 'attack' | 'spell', damageFormula?: string, attackBonus?: number): AttackRollResult {
  const mode = loadDiceOddsMode();
  const d20 = rollWeightedDie(20, mode);
  const dice = parseDamageDice(damageFormula) ?? { count: 1, die: 8 };
  const flat = parseDamageFlat(damageFormula);
  const damageRolls = Array.from({ length: dice.count }, () => rollFair(dice.die));
  if (d20 === 20) for (let i = 0; i < dice.count; i++) damageRolls.push(rollFair(dice.die));
  const bonus = Number.isFinite(attackBonus) ? Math.round(attackBonus as number) : undefined;
  return {
    kind,
    d20,
    damageRolls,
    damageDie: dice.die,
    damageCount: damageRolls.length,
    damageTotal: Math.max(0, damageRolls.reduce((a, b) => a + b, 0) + flat),
    attackBonus: bonus,
    attackTotal: bonus === undefined ? undefined : d20 + bonus,
    mode,
  };
}

export function rollCheck(): CheckRollResult {
  const mode = loadDiceOddsMode();
  const d20 = rollWeightedDie(20, mode);
  const outcome: CheckRollResult['outcome'] =
    d20 === 1 ? 'critical failure'
    : d20 <= 7 ? 'failure'
    : d20 <= 13 ? 'mixed success'
    : d20 === 20 ? 'critical success'
    : 'success';
  return { kind: 'check', d20, outcome, mode };
}

/** Healing dice always roll fair — odds brackets are shaped for the d20 only. */
export function rollHealing(count: number, die: number, bonus: number): HealRollResult {
  const rolls = Array.from({ length: count }, () => rollFair(die));
  const total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + bonus);
  return { kind: 'heal', rolls, die, bonus, total, mode: loadDiceOddsMode() };
}

/** A plain item effect roll (e.g. a potion's 2d6 surge). Always fair dice. */
export function rollEffect(label: string, count: number, die: number, bonus: number): EffectRollResult {
  const safeCount = Math.min(20, Math.max(1, Math.round(count)));
  const safeDie = Math.max(2, Math.round(die));
  const safeBonus = Number.isFinite(bonus) ? Math.round(bonus) : 0;
  const rolls = Array.from({ length: safeCount }, () => rollFair(safeDie));
  const total = rolls.reduce((a, b) => a + b, 0) + safeBonus;
  return { kind: 'effect', label, rolls, die: safeDie, bonus: safeBonus, total, mode: loadDiceOddsMode() };
}

const FINAL = 'These dice results are FINAL — narrate around them, do not roll again or override them.';

export function rollSuffix(roll: AnyRollResult): string {
  const modeLabel = DICE_ODDS_CONFIGS[roll.mode].label;
  if (roll.kind === 'heal') {
    return `\n\n[DICE] Healing: ${roll.rolls.join(' + ')} (d${roll.die})${roll.bonus ? ` ${roll.bonus > 0 ? '+' : '-'} ${Math.abs(roll.bonus)}` : ''} = ${roll.total}. ${FINAL}`;
  }
  if (roll.kind === 'effect') {
    return `\n\n[DICE] ${roll.label}: ${roll.rolls.join(' + ')} (d${roll.die})${roll.bonus ? ` ${roll.bonus > 0 ? '+' : '-'} ${Math.abs(roll.bonus)}` : ''} = ${roll.total}. ${FINAL}`;
  }
  if (roll.kind === 'check') {

    const edge = roll.d20 === 20 ? ' Make it spectacular.' : roll.d20 === 1 ? ' Make it sting.' : '';
    return `\n\n[DICE — ${modeLabel} mode] d20: ${roll.d20} → ${roll.outcome.toUpperCase()}.${edge} Narrate this attempt strictly at that outcome tier: critical failure = backfires, failure = does not work, mixed success = works partially or at a cost, success = works, critical success = works better than intended. ${FINAL}`;
  }
  const critNote = roll.d20 === 20 ? ' NATURAL 20 — critical hit, damage dice doubled below.'
    : roll.d20 === 1 ? ' NATURAL 1 — critical miss, the damage roll below is IGNORED and the attempt fails badly.'
    : '';
  const hitWord = roll.kind === 'spell' ? 'spell attack / potency roll' : 'attack roll';
  const hitLine = typeof roll.attackTotal === 'number'
    ? `To-hit: d20 ${roll.d20} ${(roll.attackBonus ?? 0) >= 0 ? '+' : '-'} ${Math.abs(roll.attackBonus ?? 0)} = ${roll.attackTotal} (${hitWord}, already includes the character's bonus — compare to the target's AC).`
    : `To-hit d20: ${roll.d20} (${hitWord}, add the character's bonus from their sheet and compare to the target's AC).`;
  const dmgFormula = `${roll.damageCount ?? roll.damageRolls.length}d${roll.damageDie}`;
  return `\n\n[DICE — ${modeLabel} mode] ${hitLine}${critNote} Damage: ${roll.damageRolls.join(' + ')} (${dmgFormula}) = ${roll.damageTotal}, applied only if the attack lands. ${FINAL}`;
}
