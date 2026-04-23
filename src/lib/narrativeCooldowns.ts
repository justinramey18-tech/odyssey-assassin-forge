import { getScopedItem, setScopedItem, removeScopedItem } from '@/lib/scoped-storage';

const STORAGE_KEY = 'empyrean-narrative-cooldowns';

/**
 * Default fallback recovery duration (in DM turns) when none is specified.
 * Can be overridden per-ability by the DM via response tags (see Prompt B2).
 */
export const DEFAULT_NARRATIVE_COOLDOWN = 3;

/**
 * Shape: { [abilityId]: turnsRemaining }
 * An ability is on cooldown if its counter > 0.
 * When a new DM assistant message arrives, ALL counters decrement by 1.
 * When a counter reaches 0, the entry is removed from storage.
 */
export type NarrativeCooldownMap = Record<string, number>;

export function loadNarrativeCooldowns(): NarrativeCooldownMap {
  try {
    const raw = getScopedItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveNarrativeCooldowns(map: NarrativeCooldownMap): void {
  try {
    setScopedItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function clearNarrativeCooldowns(): void {
  try {
    removeScopedItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function startNarrativeCooldown(abilityId: string, turns: number = DEFAULT_NARRATIVE_COOLDOWN): void {
  const current = loadNarrativeCooldowns();
  current[abilityId] = Math.max(1, Math.floor(turns));
  saveNarrativeCooldowns(current);
}

/**
 * Decrement every active cooldown by 1. Called once per DM assistant response.
 * Removes entries that reach 0.
 * Returns the updated map so callers can update React state in the same pass.
 */
export function decrementAllNarrativeCooldowns(): NarrativeCooldownMap {
  const current = loadNarrativeCooldowns();
  const updated: NarrativeCooldownMap = {};
  for (const [id, turns] of Object.entries(current)) {
    const next = turns - 1;
    if (next > 0) updated[id] = next;
    // else drop it — ability is available again
  }
  saveNarrativeCooldowns(updated);
  return updated;
}

export function getCooldownTurns(map: NarrativeCooldownMap, abilityId: string): number {
  return map[abilityId] ?? 0;
}

export function isOnNarrativeCooldown(map: NarrativeCooldownMap, abilityId: string): boolean {
  return getCooldownTurns(map, abilityId) > 0;
}
