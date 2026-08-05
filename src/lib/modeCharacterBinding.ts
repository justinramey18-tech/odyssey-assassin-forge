// Binds each AI DM mode to a cloud save (character). Opening a mode makes that character live, so solo, party and Empyrean campaigns stay separate.
//
// Deliberately RAW localStorage, never scoped-storage: this is the router that
// decides which character is active, so scoping it by the active character
// would be circular.

export type DMMode = 'solo' | 'party' | 'empyrean';

const KEY = 'odyssey-mode-character-binding';

export type ModeBinding = Record<DMMode, string | null>;

const EMPTY: ModeBinding = { solo: null, party: null, empyrean: null };

export function loadModeBinding(): ModeBinding {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw);
    return {
      solo: typeof parsed?.solo === 'string' ? parsed.solo : null,
      party: typeof parsed?.party === 'string' ? parsed.party : null,
      empyrean: typeof parsed?.empyrean === 'string' ? parsed.empyrean : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function getBoundSaveId(mode: DMMode): string | null {
  return loadModeBinding()[mode];
}

export function setBoundSaveId(mode: DMMode, saveId: string | null): void {
  try {
    const next = { ...loadModeBinding(), [mode]: saveId };
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('odyssey-mode-binding-changed', { detail: { mode, saveId } }));
  } catch (e) {
    console.error('[ModeBinding] Failed to save binding:', e);
  }
}

/** Drop a save from every mode it is bound to. Call after deleting a character. */
export function unbindSaveEverywhere(saveId: string): void {
  const current = loadModeBinding();
  const next: ModeBinding = {
    solo: current.solo === saveId ? null : current.solo,
    party: current.party === saveId ? null : current.party,
    empyrean: current.empyrean === saveId ? null : current.empyrean,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('odyssey-mode-binding-changed', { detail: { mode: null, saveId: null } }));
  } catch { /* ignore */ }
}

/**
 * First-run adoption. If a mode has no character bound yet, claim whatever is
 * currently active so the player is never blocked from starting a session.
 * Returns the save id the mode should use, or null when there is nothing to bind
 * (guest with no cloud save).
 */
export function ensureBinding(mode: DMMode, activeSaveId: string | null): string | null {
  const bound = getBoundSaveId(mode);
  if (bound) return bound;
  if (!activeSaveId) return null;
  setBoundSaveId(mode, activeSaveId);
  return activeSaveId;
}

export function subscribeModeBinding(listener: () => void): () => void {
  window.addEventListener('odyssey-mode-binding-changed', listener);
  return () => window.removeEventListener('odyssey-mode-binding-changed', listener);
}
