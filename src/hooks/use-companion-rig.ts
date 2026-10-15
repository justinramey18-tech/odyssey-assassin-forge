import { useCallback, useEffect, useState } from 'react';
import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';
import { COMPANION_STORAGE_KEY, CompanionRig, DEFAULT_RIG, sanitizeRig } from '@/lib/companion-rig';

// Per-character: the companion belongs to one hero, so it is scoped.
let migrated = false;

function read(): CompanionRig {
  try {
    const saved = getScopedItem(COMPANION_STORAGE_KEY);
    if (saved) return sanitizeRig(JSON.parse(saved));
  } catch (e) {
    console.error('[CompanionRig] Failed to load:', e);
  }
  return { ...DEFAULT_RIG, scars: { ...DEFAULT_RIG.scars } };
}

export function useCompanionRig() {
  if (!migrated) { migrated = true; try { migrateToScoped(COMPANION_STORAGE_KEY); } catch { /* ignore */ } }
  const [rig, setRig] = useState<CompanionRig>(read);

  useEffect(() => {
    try { setScopedItem(COMPANION_STORAGE_KEY, JSON.stringify(rig)); }
    catch (e) { console.error('[CompanionRig] Failed to save:', e); }
  }, [rig]);

  useEffect(() => {
    const onLoaded = () => setRig(read());
    window.addEventListener('odyssey-character-loaded', onLoaded);
    return () => window.removeEventListener('odyssey-character-loaded', onLoaded);
  }, []);

  const update = useCallback((patch: Partial<CompanionRig>) => {
    setRig(prev => sanitizeRig({ ...prev, ...patch, scars: { ...prev.scars, ...(patch.scars ?? {}) } }));
  }, []);

  return { rig, setRig, update };
}
