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
  /**
   * Explicit slot level to spend (upcasting). When omitted the caster picks the
   * cheapest slot that can still carry the spell.
   */
  slotLevel?: number;
  /** Spend a pact slot specifically. */
  usePact?: boolean;
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

// ============================================
// RESOURCE INSPECTOR
// ============================================
// Screens need to know what the character can still spend (to offer upcast
// choices, to preview a rest) without owning the spellcasting hook. The owner
// registers a snapshot provider here.

export interface MagicResourceSnapshot {
  spellAttackBonus: number;
  spellSaveDC: number;
  slots: Array<{ level: number; current: number; max: number }>;
  pactSlots?: { level: number; current: number; max: number };
  concentratingOn: string | null;
  /** Names of active spell effects still running. */
  activeEffects: Array<{ name: string; concentration: boolean }>;
}

type Inspector = () => MagicResourceSnapshot;

let activeInspector: Inspector | null = null;

export function registerMagicResourceInspector(fn: Inspector): () => void {
  activeInspector = fn;
  return () => {
    if (activeInspector === fn) activeInspector = null;
  };
}

export function getMagicResources(): MagicResourceSnapshot | null {
  if (!activeInspector) return null;
  try {
    return activeInspector();
  } catch {
    return null;
  }
}

/**
 * Every slot level this spell could be cast at right now, cheapest first.
 * Pact slots appear as a separate entry.
 */
export interface CastOption {
  slotLevel: number;
  usePact: boolean;
  remaining: number;
  isUpcast: boolean;
}

export function getCastOptions(baseLevel: number): CastOption[] {
  const res = getMagicResources();
  if (!res || baseLevel <= 0) return [];

  const options: CastOption[] = [];
  for (const s of res.slots) {
    if (s.level >= baseLevel && s.current > 0) {
      options.push({ slotLevel: s.level, usePact: false, remaining: s.current, isUpcast: s.level > baseLevel });
    }
  }
  if (res.pactSlots && res.pactSlots.current > 0 && res.pactSlots.level >= baseLevel) {
    options.push({
      slotLevel: res.pactSlots.level,
      usePact: true,
      remaining: res.pactSlots.current,
      isUpcast: res.pactSlots.level > baseLevel,
    });
  }
  return options.sort((a, b) => a.slotLevel - b.slotLevel);
}

// ============================================
// REST PREVIEW
// ============================================

export interface RestRecoveryLine {
  label: string;
  detail: string;
}

/** What a rest of this type would give back right now. Read-only. */
export function previewRest(type: 'short' | 'long'): RestRecoveryLine[] {
  const res = getMagicResources();
  const lines: RestRecoveryLine[] = [];
  if (!res) return lines;

  if (type === 'short') {
    if (res.pactSlots && res.pactSlots.current < res.pactSlots.max) {
      lines.push({
        label: 'Pact magic',
        detail: `${res.pactSlots.max - res.pactSlots.current} pact slot(s) return (level ${res.pactSlots.level})`,
      });
    }
    return lines;
  }

  const missing = res.slots.filter(s => s.max > 0 && s.current < s.max);
  if (missing.length > 0) {
    lines.push({
      label: 'Spell slots',
      detail: missing.map(s => `Lv ${s.level}: ${s.current}→${s.max}`).join(', '),
    });
  }
  if (res.pactSlots && res.pactSlots.current < res.pactSlots.max) {
    lines.push({
      label: 'Pact magic',
      detail: `${res.pactSlots.current}→${res.pactSlots.max}`,
    });
  }
  if (res.concentratingOn) {
    lines.push({ label: 'Concentration', detail: `${res.concentratingOn} ends` });
  }
  if (res.activeEffects.length > 0) {
    lines.push({
      label: 'Active effects',
      detail: `${res.activeEffects.length} spell effect(s) end`,
    });
  }
  return lines;
}
