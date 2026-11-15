// Separate Empyrean account ("spaces"). Opt-in per phone (Settings → Empyrean account).
//
// The app keeps ONE login at a time. A phone has two spaces: Odyssey (the main account)
// and Empyrean (a second account). Switching writes a pending switch and reloads; at the
// very start of the next load, BEFORE the Supabase client or any screen exists, the live
// space's phone data (its login included) is moved aside under "odyssey-space:<space>:"
// and the other space's data is moved back. Logins are never signed out or revoked; the
// parked one is simply kept until it comes back.
//
// Device-wide keys stay live in both spaces: the player's API keys, the "use Claude/GPT
// everywhere" and skip-feature preferences, the voice provider, this feature's own switch
// and the space bookkeeping keys. Everything else (characters, campaigns, caches, the
// login) belongs to the space.
//
// No React and no Supabase import here: account-space-boot.ts runs this before both.

export type Space = 'odyssey' | 'empyrean';

export const SPACE_KEY = 'odyssey-space';
export const SPACE_PENDING_KEY = 'odyssey-space-pending';
export const SPACE_ERROR_KEY = 'odyssey-space-error';
export const PARK_PREFIX = 'odyssey-space:';
/** The opt-in switch (device-wide: it stays live in both spaces). */
export const SEPARATE_EMPYREAN_KEY = 'dnd-separate-empyrean-account';
export const EMPYREAN_AUTH_PATH = '/empyrean-auth';
/** A pending switch older than this is dropped instead of applied. */
export const PENDING_MAX_AGE_MS = 10 * 60 * 1000;

export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

function store(s?: KV): KV {
  return s ?? localStorage;
}

const DEVICE_KEYS = new Set([
  SEPARATE_EMPYREAN_KEY,
  'dnd-use-claude-everywhere',
  'dnd-use-gpt-everywhere',
  'dnd-supporting-local-only',
  'dnd-tts-provider',
]);

export function isDeviceKey(key: string): boolean {
  if (key === SPACE_KEY || key === SPACE_PENDING_KEY || key === SPACE_ERROR_KEY || key.startsWith(PARK_PREFIX)) return true;
  if (key.includes('::')) return false; // per-character copies always belong to a space
  return DEVICE_KEYS.has(key) || /^dnd-[a-z]+-api-key$/.test(key) || key.startsWith('dnd-skip-feature-');
}

export function parkKey(space: Space, key: string): string {
  return `${PARK_PREFIX}${space}:${key}`;
}

export function currentSpace(s?: KV): Space {
  try { return store(s).getItem(SPACE_KEY) === 'empyrean' ? 'empyrean' : 'odyssey'; } catch { return 'odyssey'; }
}

export function isSeparateEmpyreanOn(s?: KV): boolean {
  try { return store(s).getItem(SEPARATE_EMPYREAN_KEY) === 'true'; } catch { return false; }
}

export function setSeparateEmpyrean(on: boolean, s?: KV): void {
  try {
    if (on) store(s).setItem(SEPARATE_EMPYREAN_KEY, 'true');
    else store(s).removeItem(SEPARATE_EMPYREAN_KEY);
  } catch { /* storage blocked */ }
}

/** True when picking Empyrean should switch to the separate Empyrean account. */
export function shouldEnterEmpyreanSeparately(s?: KV): boolean {
  return isSeparateEmpyreanOn(s) && currentSpace(s) === 'odyssey';
}

/** True when the live space has a saved Supabase login. */
export function hasLiveLogin(s?: KV): boolean {
  return listKeys(store(s)).some(k => /^sb-.+-auth-token$/.test(k));
}

/** True when the given space has a parked Supabase login (it can come back without a password). */
export function hasParkedLogin(space: Space, s?: KV): boolean {
  const prefix = parkKey(space, '');
  return listKeys(store(s)).some(k => k.startsWith(prefix) && /^sb-.+-auth-token$/.test(k.slice(prefix.length)));
}

export function listKeys(s: KV): string[] {
  const keys: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}

export interface PendingSwitch {
  to: Space;
  /** Keys that move WITH the player into the new space instead of being parked. */
  carry?: string[];
  /** Path to open after the switch. */
  returnTo?: string;
  at: number;
}

export function writePendingSwitch(p: PendingSwitch, s?: KV): void {
  store(s).setItem(SPACE_PENDING_KEY, JSON.stringify(p));
}

export function readPendingSwitch(s?: KV, now = Date.now()): PendingSwitch | null {
  try {
    const raw = store(s).getItem(SPACE_PENDING_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingSwitch;
    if (p?.to !== 'odyssey' && p?.to !== 'empyrean') return null;
    if (typeof p.at !== 'number' || now - p.at > PENDING_MAX_AGE_MS || p.at - now > 60_000) return null;
    return {
      to: p.to,
      at: p.at,
      carry: Array.isArray(p.carry) ? p.carry.filter(k => typeof k === 'string' && !isDeviceKey(k)) : [],
      returnTo: typeof p.returnTo === 'string' && p.returnTo.startsWith('/') && !p.returnTo.startsWith('//') ? p.returnTo : undefined,
    };
  } catch {
    return null;
  }
}

export interface SwitchResult {
  switched: boolean;
  from: Space;
  to: Space;
  returnTo?: string;
  /** Plain-words reason when a switch was asked for and could not be done. */
  error?: string;
  moved?: { parked: number; restored: number };
}

/** Move one key; remove first so a full phone never needs room for two copies. */
function move(s: KV, fromKey: string, toKey: string): void {
  const value = s.getItem(fromKey);
  if (value === null) return;
  s.removeItem(fromKey);
  try {
    s.setItem(toKey, value);
  } catch (e) {
    s.setItem(fromKey, value); // fits: its room was just freed
    throw e;
  }
}

/**
 * Apply a pending switch, if any. Safe to call on every app start. Never throws.
 * On a failure while parking, every key already moved is moved back, the pending switch
 * is dropped, the space stays as it was, and SPACE_ERROR_KEY holds the reason.
 */
export function applyPendingSwitch(storage?: KV, now = Date.now()): SwitchResult {
  const s = store(storage);
  const from = currentSpace(s);
  const pending = readPendingSwitch(s, now);
  try { s.removeItem(SPACE_PENDING_KEY); } catch { /* ignore */ }
  if (!pending) return { switched: false, from, to: from };
  if (pending.to === from) return { switched: false, from, to: from, returnTo: pending.returnTo };

  const to = pending.to;
  const carry = new Set(pending.carry ?? []);
  const parked: Array<[string, string]> = [];

  // 1. Park the live space (everything that isn't device-wide or carried along).
  try {
    for (const k of listKeys(s)) {
      if (isDeviceKey(k) || carry.has(k)) continue;
      const target = parkKey(from, k);
      move(s, k, target);
      parked.push([k, target]);
    }
  } catch (e) {
    for (const [k, target] of parked.reverse()) {
      try { move(s, target, k); } catch { /* best effort */ }
    }
    const error = `Couldn't switch accounts: ${e instanceof Error ? e.message : 'phone storage error'}.`;
    try { s.setItem(SPACE_ERROR_KEY, error); } catch { /* ignore */ }
    return { switched: false, from, to: from, error };
  }

  // 2. Bring the other space back (same total size, so it fits).
  const prefix = parkKey(to, '');
  let restored = 0;
  let restoreError: string | undefined;
  for (const pk of listKeys(s).filter(k => k.startsWith(prefix))) {
    const k = pk.slice(prefix.length);
    if (carry.has(k)) { try { s.removeItem(pk); } catch { /* ignore */ } continue; } // the carried copy wins
    try { move(s, pk, k); restored += 1; } catch (e) { restoreError = e instanceof Error ? e.message : 'phone storage error'; }
  }

  // 3. Mark the new space.
  try {
    if (to === 'empyrean') s.setItem(SPACE_KEY, 'empyrean');
    else s.removeItem(SPACE_KEY);
  } catch { /* ignore */ }

  if (restoreError) {
    try { s.setItem(SPACE_ERROR_KEY, `Some saved data could not be restored: ${restoreError}.`); } catch { /* ignore */ }
  }
  return { switched: true, from, to, returnTo: pending.returnTo, error: restoreError, moved: { parked: parked.length, restored } };
}

/** Read and clear the last switch error (shown once as a toast). */
export function takeSwitchError(s?: KV): string | null {
  try {
    const msg = store(s).getItem(SPACE_ERROR_KEY);
    if (msg) store(s).removeItem(SPACE_ERROR_KEY);
    return msg;
  } catch {
    return null;
  }
}
