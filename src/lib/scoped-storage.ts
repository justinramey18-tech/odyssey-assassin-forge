// Character-scoped localStorage utility
// Prefixes storage keys with the active cloud save ID so each character gets isolated state
// Falls back to unscoped keys when no save ID is set (guest/new character)

const SAVE_ID_KEY = 'odyssey-active-cloud-save-id';

export function getScopedKey(baseKey: string): string {
  const saveId = localStorage.getItem(SAVE_ID_KEY);
  return saveId ? `${baseKey}::${saveId}` : baseKey;
}

export function getScopedItem(baseKey: string): string | null {
  return localStorage.getItem(getScopedKey(baseKey));
}

export function setScopedItem(baseKey: string, value: string): void {
  localStorage.setItem(getScopedKey(baseKey), value);
}

export function removeScopedItem(baseKey: string): void {
  localStorage.removeItem(getScopedKey(baseKey));
}

/**
 * One-time migration: if a save ID is active AND unscoped data exists,
 * copy it to the scoped key and remove the unscoped version.
 * Call once per key at hook init time.
 */
export function migrateToScoped(baseKey: string): void {
  const saveId = localStorage.getItem(SAVE_ID_KEY);
  if (!saveId) return;

  const scopedKey = `${baseKey}::${saveId}`;
  const unscopedData = localStorage.getItem(baseKey);

  // Only migrate if scoped key doesn't already have data and unscoped does
  if (unscopedData !== null && localStorage.getItem(scopedKey) === null) {
    localStorage.setItem(scopedKey, unscopedData);
    localStorage.removeItem(baseKey);
    console.log(`[ScopedStorage] Migrated ${baseKey} → ${scopedKey}`);
  }
}
