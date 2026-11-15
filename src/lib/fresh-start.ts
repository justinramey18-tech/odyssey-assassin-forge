// One-time "fresh start" on every phone (DECISIONS D-31, 2026-11-15, the hard reset).
// The database's player data was wiped; phones still held characters, campaigns and settings
// in local storage, and auto cloud-sync would upload them again. On the first launch after
// this update, each phone clears its saved game data once and keeps only:
// - the Supabase login (keys starting "sb-"), so nobody has to sign in again;
// - the player's own API keys and the other device-wide keys (account-space.ts isDeviceKey);
// - the separate-Empyrean-account switch and the parked Empyrean login (D-28).
// Pure and testable: no React, no Supabase import (it runs before the Supabase client exists).
import { PARK_PREFIX, isDeviceKey, listKeys, type KV } from './account-space';

/** Change this id only to run another fresh start on every phone. */
export const FRESH_START_ID = '2026-11-15-hard-reset';
export const FRESH_START_KEY = 'odyssey-fresh-start';

function keepLiveKey(key: string): boolean {
  if (key === FRESH_START_KEY) return true;
  if (key.startsWith('sb-')) return true;
  if (key.startsWith(PARK_PREFIX)) return keepParkedKey(key);
  return isDeviceKey(key);
}

/** Parked keys look like "odyssey-space:<space>:<key>"; keep only a parked login or device key. */
function keepParkedKey(key: string): boolean {
  const rest = key.slice(PARK_PREFIX.length);
  const cut = rest.indexOf(':');
  if (cut < 0) return false;
  const inner = rest.slice(cut + 1);
  if (inner.startsWith('sb-')) return true;
  return !inner.startsWith(PARK_PREFIX) && isDeviceKey(inner);
}

export interface FreshStartResult {
  ran: boolean;
  removed: number;
  kept: number;
}

/** Clears the phone's game data once per FRESH_START_ID. Safe to call on every launch. */
export function runFreshStart(local: KV, session?: Pick<Storage, 'clear'> | null): FreshStartResult {
  if (local.getItem(FRESH_START_KEY) === FRESH_START_ID) return { ran: false, removed: 0, kept: 0 };
  const keys = listKeys(local);
  // Account switching parks the marker; finding it still means this phone was reset.
  const alreadyReset = keys.some(key =>
    key.startsWith(PARK_PREFIX) &&
    key.slice(PARK_PREFIX.length).split(':').slice(1).join(':') === FRESH_START_KEY &&
    local.getItem(key) === FRESH_START_ID
  );
  if (alreadyReset) {
    local.setItem(FRESH_START_KEY, FRESH_START_ID);
    return { ran: false, removed: 0, kept: 0 };
  }
  let removed = 0;
  for (const key of keys) {
    if (keepLiveKey(key)) continue;
    local.removeItem(key);
    removed += 1;
  }
  try { session?.clear(); } catch { /* blocked storage */ }
  local.setItem(FRESH_START_KEY, FRESH_START_ID);
  return { ran: true, removed, kept: keys.length - removed };
}
