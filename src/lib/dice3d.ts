// 3D dice pop-up helpers. The result is always decided first by the game's
// dice odds; the physical dice only show it. Pure functions, tested.
import type { DiceRollRequest } from '@/lib/diceRollBus';

export type Die3D = 4 | 6 | 8 | 12 | 20;
export interface DieThrow { sides: Die3D; value: number; role: 'test' | 'damage' | 'heal' | 'effect' }

const SUPPORTED = new Set([4, 6, 8, 12, 20]);
const MAX_DICE = 6;
const PREF_KEY = 'odyssey-dice-3d'; // device preference, not per character

export function dice3dEnabled(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== 'off'; } catch { return true; }
}
export function setDice3dEnabled(on: boolean): void {
  try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
}

const ok = (sides: number, v: number) => SUPPORTED.has(sides) && Number.isFinite(v) && v >= 1 && v <= sides && Number.isInteger(v);

/** Which physical dice to throw for a roll, or null if any die can't be shown in 3D. */
export function diceForRoll(roll: DiceRollRequest['roll']): DieThrow[] | null {
  const out: DieThrow[] = [];
  const add = (sides: number, v: number, role: DieThrow['role']) => {
    if (!ok(sides, v)) return false;
    out.push({ sides: sides as Die3D, value: v, role });
    return true;
  };
  if (roll.kind === 'test') {
    for (const v of roll.rolls) if (!add(roll.die, v, 'test')) return null;
  } else if (roll.kind === 'check') {
    if (!add(20, roll.d20, 'test')) return null;
  } else if (roll.kind === 'attack' || roll.kind === 'spell') {
    if (!add(20, roll.d20, 'test')) return null;
    for (const v of roll.damageRolls ?? []) if (!add(roll.damageDie, v, 'damage')) return null;
  } else if (roll.kind === 'heal' || roll.kind === 'effect') {
    for (const v of roll.rolls) if (!add(roll.die, v, roll.kind === 'heal' ? 'heal' : 'effect')) return null;
  }
  if (!out.length || out.length > MAX_DICE) return null;
  return out;
}

/**
 * Face labels after the die lands: the face showing up must read `target`.
 * Swap the label currently on the up face with the face that carries `target`.
 */
export function relabelForTop(labels: number[], topFace: number, target: number): number[] {
  const next = [...labels];
  const at = next.indexOf(target);
  if (at < 0 || topFace < 0 || topFace >= next.length || at === topFace) return next;
  [next[topFace], next[at]] = [next[at], next[topFace]];
  return next;
}

/** Vibration strength for a collision at this speed (0 = none). */
export function bumpMs(speed: number): number {
  if (!Number.isFinite(speed) || speed < 1.2) return 0;
  return Math.min(35, Math.round(6 + speed * 3));
}
