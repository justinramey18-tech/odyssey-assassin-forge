/**
 * THE single entry point for every real d20 roll in the app.
 *
 * RULE: any new d20 roll (skill, save, attack, spell attack, death save,
 * concentration, initiative, anything) MUST call rollD20(). Never roll a d20
 * with Math.random() or rollDie(20) directly — that bypasses the player's
 * dice odds setting (God Mode, Doomed, etc.) and any feature listening for
 * d20 results (e.g. the crit cinematic).
 *
 * Exempt: animation-only spinning numbers, damage/healing dice (must stay
 * uniform), and the internals of diceOdds.ts.
 *
 * This file must never import a component. UI layers subscribe via
 * subscribeD20Rolls().
 */

import { rollWeightedDie, loadDiceOddsMode } from '@/lib/diceOdds';
import { isCriticalHit, isCriticalMiss, getEffectiveDie, type RollMode } from '@/lib/diceRoller';

export type D20Context =
  | 'skill' | 'save' | 'attack' | 'spell-attack'
  | 'death-save' | 'concentration' | 'initiative' | 'other';

export interface D20Result {
  /** 1 entry normally, 2 for advantage/disadvantage */
  rolls: number[];
  /** The die that counts */
  kept: number;
  mode: RollMode;
  /** kept === 20 */
  isCrit: boolean;
  /** kept === 1 */
  isFumble: boolean;
  context: D20Context;
}

type D20Listener = (result: D20Result) => void;
const listeners = new Set<D20Listener>();

/** Subscribe to every d20 rolled through rollD20(). Returns an unsubscribe. */
export function subscribeD20Rolls(l: D20Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function emit(result: D20Result): void {
  listeners.forEach((l) => {
    try { l(result); } catch (e) { console.error('[rollD20] listener failed', e); }
  });
}

export function rollD20(opts?: { mode?: RollMode; context?: D20Context }): D20Result {
  const mode: RollMode = opts?.mode ?? 'normal';
  const context: D20Context = opts?.context ?? 'other';
  const odds = loadDiceOddsMode();
  const count = mode === 'normal' ? 1 : 2;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollWeightedDie(20, odds));
  const result: D20Result = {
    rolls,
    kept: getEffectiveDie(rolls, mode),
    mode,
    isCrit: isCriticalHit(rolls, mode, 'd20'),
    isFumble: isCriticalMiss(rolls, mode, 'd20'),
    context,
  };
  emit(result);
  return result;
}
