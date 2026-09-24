// Carries roll requests from any drawer to the DiceRollOverlay mounted in the
// DM screen. Same singleton pattern as sheetReturn.ts. If no overlay is
// mounted, requests resolve immediately so callers never hang.

import { AnyRollResult } from '@/lib/promptAutoRoll';
import type { DiceOddsMode } from '@/lib/diceOdds';

/**
 * A roll the player picked in the dice roller: a d20 test (plain d20, initiative,
 * ability check, skill check or save, with advantage/disadvantage) or a single quick die.
 */
export interface DiceTestRoll {
  kind: 'test';
  /** Every die rolled, in order. Advantage/disadvantage rolls two d20s. */
  rolls: number[];
  /** The die that counts. */
  kept: number;
  /** 20 for tests; 4, 6, 8, 10 or 12 for a quick die. */
  die: number;
  modifier: number;
  total: number;
  rollMode: 'normal' | 'advantage' | 'disadvantage';
  mode: DiceOddsMode;
}

export interface DiceRollRequest {
  /** Title shown in the overlay, e.g. the weapon or prompt name */
  title: string;
  roll: AnyRollResult | DiceTestRoll;
  /** Called when the animation finishes (or immediately if no overlay is mounted) */
  onComplete: () => void;
}

type Listener = (req: DiceRollRequest) => void;
let listener: Listener | null = null;

export function requestDiceRoll(req: DiceRollRequest): void {
  if (listener) listener(req);
  else req.onComplete();
}

/** The overlay registers itself here. Returns an unsubscribe. Last mount wins. */
export function subscribeDiceRolls(l: Listener): () => void {
  listener = l;
  return () => { if (listener === l) listener = null; };
}
