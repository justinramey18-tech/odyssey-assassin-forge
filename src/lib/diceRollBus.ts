// Carries roll requests from any drawer to the DiceRollOverlay mounted in the
// DM screen. Same singleton pattern as sheetReturn.ts. If no overlay is
// mounted, requests resolve immediately so callers never hang.

import { AnyRollResult } from '@/lib/promptAutoRoll';

export interface DiceRollRequest {
  /** Title shown in the overlay, e.g. the weapon or prompt name */
  title: string;
  roll: AnyRollResult;
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
