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

import { rollWeightedDieSilent, resolveOddsForContext, type DiceOddsMode } from '@/lib/diceOdds';
import { maybePlayCritSound } from '@/lib/critSound';
import { isCriticalHit, isCriticalMiss, getEffectiveDie, type RollMode, type DiceRoll } from '@/lib/diceRoller';

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

/**
 * A listener may return a promise (resolving true if it showed something,
 * e.g. the crit cinematic). Callers await it with awaitD20Reveal() before
 * showing the result.
 */
type D20Listener = (result: D20Result) => void | Promise<boolean>;
const listeners = new Set<D20Listener>();
const pending = new WeakMap<D20Result, Promise<boolean>>();
let latest: D20Result | null = null;

/** Contexts that earn the crit cinematic. Concentration, initiative, death saves and NPC ('other') rolls do not. */
export const CINEMATIC_CONTEXTS: ReadonlySet<D20Context> = new Set(['attack', 'spell-attack', 'skill', 'save']);

/** Subscribe to every d20 rolled through rollD20(). Returns an unsubscribe. */
export function subscribeD20Rolls(l: D20Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function emit(result: D20Result): void {
  const waits: Promise<boolean>[] = [];
  listeners.forEach((l) => {
    try {
      const r = l(result);
      if (r && typeof (r as Promise<boolean>).then === 'function') {
        waits.push((r as Promise<boolean>).catch(() => false));
      }
    } catch (e) { console.error('[rollD20] listener failed', e); }
  });
  latest = result;
  if (waits.length) pending.set(result, Promise.all(waits).then((a) => a.some(Boolean)));
}

/**
 * Await anything the roll triggered (e.g. the crit cinematic) before revealing
 * the result. Resolves true if something played. Never rejects; resolves
 * immediately when nothing is listening.
 */
export function awaitD20Reveal(result: D20Result): Promise<boolean> {
  return pending.get(result) ?? Promise.resolve(false);
}

/**
 * Await whatever the most recent rollD20() call triggered. For roll helpers
 * that return their own result shape instead of the D20Result — call it
 * straight after the roll, before anything else can roll.
 */
export function awaitLatestD20Reveal(): Promise<boolean> {
  return latest ? awaitD20Reveal(latest) : Promise.resolve(false);
}

export function rollD20(opts?: {
  mode?: RollMode;
  context?: D20Context;
  /** Override the player's odds setting. Only for NPC rolls that mirror it (npcSocialChecks). */
  odds?: DiceOddsMode;
}): D20Result {
  const mode: RollMode = opts?.mode ?? 'normal';
  const context: D20Context = opts?.context ?? 'other';
  const odds = opts?.odds ?? resolveOddsForContext(context);
  const count = mode === 'normal' ? 1 : 2;
  const rolls: number[] = [];
  for (let i = 0; i < count; i++) rolls.push(rollWeightedDieSilent(20, odds));
  const result: D20Result = {
    rolls,
    kept: getEffectiveDie(rolls, mode),
    mode,
    isCrit: isCriticalHit(rolls, mode, 'd20'),
    isFumble: isCriticalMiss(rolls, mode, 'd20'),
    context,
  };
  emit(result);
  playCritSoundUnlessCinematic(result);
  return result;
}

/**
 * The crit cinematic carries its own audio, so the app's crit sound must not
 * double up with it. Contexts that never get the cinematic (concentration,
 * initiative, death saves, NPC/'other') play the sound straight away. For
 * cinematic contexts we wait to hear whether the video actually played; if it
 * was skipped (disabled, not ready, reduced motion) the sound plays instead.
 */
function playCritSoundUnlessCinematic(result: D20Result): void {
  const playAll = () => result.rolls.forEach((r) => maybePlayCritSound(r, 20));
  const wait = pending.get(result);
  if (result.isCrit && CINEMATIC_CONTEXTS.has(result.context) && wait) {
    void wait.then((played) => { if (!played) playAll(); });
    return;
  }
  playAll();
}

/** Advantage/disadvantage from combat conditions (both cancel out). */
export function rollModeFrom(hasAdvantage: boolean, hasDisadvantage: boolean): RollMode {
  if (hasAdvantage && !hasDisadvantage) return 'advantage';
  if (hasDisadvantage && !hasAdvantage) return 'disadvantage';
  return 'normal';
}

/**
 * rollD20() returned in the older DiceRoll shape, for callers that used
 * rollDice('d20', count, modifier). Keeps that shape exactly (total = sum of
 * all rolled dice + modifier) so nothing downstream changes.
 */
export function rollD20Dice(modifier: number, context: D20Context, mode: RollMode = 'normal'): DiceRoll & { d20: D20Result } {
  const oddsMode = resolveOddsForContext(context);
  const d20 = rollD20({ mode, context, odds: oddsMode });
  const total = d20.rolls.reduce((s, r) => s + r, 0) + modifier;
  return { die: 'd20', count: d20.rolls.length, modifier, rolls: d20.rolls, total, oddsMode, d20 };
}
