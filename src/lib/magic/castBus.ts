// ============================================
// SPELL CAST BUS
// ============================================
// The character sheet and the DM quick actions both let a player "use" a spell,
// but neither owns the spellcasting hook. The provider that DOES own it
// registers a caster here on mount, so any screen can spend the correct slot
// without threading a callback through five component hops.

export interface SpellCastRequest {
  /** Display name of the spell, as shown in the sheet / quick actions. */
  name: string;
  /** Base level, when the caller already knows it (0 = cantrip). */
  level?: number;
}

export type SpellCastFailure = 'no-caster' | 'unknown-spell' | 'no-slots';

export interface SpellCastOutcome {
  ok: boolean;
  reason?: SpellCastFailure;
  /** Slot level actually spent (undefined for cantrips). */
  slotLevel?: number;
  usedPactSlot?: boolean;
  /** Slots of that level still available after the cast. */
  remaining?: number;
  /** Total slots (all levels) still available after the cast. */
  totalRemaining?: number;
  isCantrip?: boolean;
  startedConcentration?: boolean;
  brokeConcentration?: string | null;
}

type Caster = (req: SpellCastRequest) => SpellCastOutcome;

let activeCaster: Caster | null = null;

/** Called by the owner of the spellcasting state. Returns an unregister fn. */
export function registerSpellCaster(fn: Caster): () => void {
  activeCaster = fn;
  return () => {
    if (activeCaster === fn) activeCaster = null;
  };
}

export function isSpellCasterAvailable(): boolean {
  return activeCaster !== null;
}

/**
 * Spend the appropriate slot for a spell. Returns ok:false when the character
 * has nothing left to spend, so the caller can stop before staging a prompt.
 */
export function castSpellByName(req: SpellCastRequest): SpellCastOutcome {
  if (!activeCaster) return { ok: false, reason: 'no-caster' };
  try {
    return activeCaster(req);
  } catch {
    return { ok: false, reason: 'no-caster' };
  }
}

/** Human-readable label for the slot that a cast consumed. */
export function describeSlotSpend(outcome: SpellCastOutcome): string | null {
  if (!outcome.ok) return null;
  if (outcome.isCantrip) return 'Cantrip — no slot spent';
  if (outcome.usedPactSlot) {
    return `Pact slot spent · ${outcome.remaining ?? 0} left`;
  }
  if (typeof outcome.slotLevel === 'number') {
    return `Level ${outcome.slotLevel} slot spent · ${outcome.remaining ?? 0} left`;
  }
  return null;
}
