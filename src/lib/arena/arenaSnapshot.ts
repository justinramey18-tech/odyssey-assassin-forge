// Arena zero-risk rule: remember the character's resources on entry and put
// them back exactly on exit (or on next app open after a crash).
import { getScopedItem, setScopedItem, removeScopedItem, migrateToScoped } from '@/lib/scoped-storage';

export const ARENA_SNAPSHOT_KEY = 'odyssey-arena-snapshot';

/** Per-character keys an arena session may change. */
export const ARENA_PROTECTED_KEYS = [
  'odyssey-hp-state',
  'odyssey-death-saves',
  'odyssey-consumables-inventory',
  'odyssey-spellcasting',
  'odyssey-active-spells',
  'odyssey-class-spellcasting',
  'odyssey-class-active-spells',
  'odyssey-cooldown-state',
  'odyssey-conditions-state',
  'odyssey-shop',
  'odyssey-short-rests-remaining',
  'odyssey-xp-progression',
  'odyssey-loot',
  'odyssey-character-autosave',
] as const;

interface ArenaSnapshot {
  version: 1;
  takenAt: number;
  values: Record<string, string | null>;
}

function read(): ArenaSnapshot | null {
  migrateToScoped(ARENA_SNAPSHOT_KEY);
  const raw = getScopedItem(ARENA_SNAPSHOT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ArenaSnapshot;
    if (parsed?.version !== 1 || typeof parsed.values !== 'object' || !parsed.values) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasArenaSnapshot(): boolean {
  return read() !== null;
}

/** Take a snapshot. If one already exists (unfinished session) keep the original. */
export function takeArenaSnapshot(): void {
  if (read()) return;
  const values: Record<string, string | null> = {};
  for (const key of ARENA_PROTECTED_KEYS) values[key] = getScopedItem(key);
  const snap: ArenaSnapshot = { version: 1, takenAt: Date.now(), values };
  setScopedItem(ARENA_SNAPSHOT_KEY, JSON.stringify(snap));
}

/** Put everything back and clear the snapshot. Returns true if anything was restored. */
export function restoreArenaSnapshot(): boolean {
  const snap = read();
  if (!snap) return false;
  for (const key of ARENA_PROTECTED_KEYS) {
    if (!(key in snap.values)) continue;
    const v = snap.values[key];
    if (v === null) removeScopedItem(key);
    else setScopedItem(key, v);
  }
  removeScopedItem(ARENA_SNAPSHOT_KEY);
  try {
    window.dispatchEvent(new CustomEvent('odyssey-character-loaded'));
  } catch {
    /* non-browser */
  }
  return true;
}
