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

export type AnyRollResult = AttackRollResult | CheckRollResult | HealRollResult;

function rollFair(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function parseDamageDice(formula: string | undefined): { count: number; die: number } | null {
  if (!formula) return null;
  const m = /^\s*(\d{1,2})d(\d{1,3})/i.exec(formula);
  if (!m) return null;
  return { count: Math.min(20, Math.max(1, parseInt(m[1], 10))), die: Math.max(2, parseInt(m[2], 10)) };
}

export function rollAttack(kind: 'attack' | 'spell', damageFormula?: string): AttackRollResult {
  const mode = loadDiceOddsMode();
  const d20 = rollWeightedDie(20, mode);
  const dice = parseDamageDice(damageFormula) ?? { count: 1, die: 8 };
  const damageRolls = Array.from({ length: dice.count }, () => rollFair(dice.die));
  if (d20 === 20) for (let i = 0; i < dice.count; i++) damageRolls.push(rollFair(dice.die));
  return { kind, d20, damageRolls, damageDie: dice.die, damageTotal: damageRolls.reduce((a, b) => a + b, 0), mode };
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

const FINAL = 'These dice results are FINAL — narrate around them, do not roll again or override them.';

export function rollSuffix(roll: AnyRollResult): string {
  const modeLabel = DICE_ODDS_CONFIGS[roll.mode].label;
  if (roll.kind === 'check') {
    const edge = roll.d20 === 20 ? ' Make it spectacular.' : roll.d20 === 1 ? ' Make it sting.' : '';
    return `\n\n[DICE — ${modeLabel} mode] d20: ${roll.d20} → ${roll.outcome.toUpperCase()}.${edge} Narrate this attempt strictly at that outcome tier: critical failure = backfires, failure = does not work, mixed success = works partially or at a cost, success = works, critical success = works better than intended. ${FINAL}`;
  }
  const critNote = roll.d20 === 20 ? ' NATURAL 20 — critical hit, damage dice doubled below.'
    : roll.d20 === 1 ? ' NATURAL 1 — critical miss, the damage roll below is IGNORED and the attempt fails badly.'
    : '';
  const hitWord = roll.kind === 'spell' ? 'spell attack / potency roll' : 'attack roll';
  return `\n\n[DICE — ${modeLabel} mode] To-hit d20: ${roll.d20} (${hitWord}, add the character's bonus from their sheet and compare to the target's AC).${critNote} Damage: ${roll.damageRolls.join(' + ')} (d${roll.damageDie}) = ${roll.damageTotal}, applied only if the attack lands. ${FINAL}`;
}
