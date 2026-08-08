// ============================================
// SHORT REST TRACKER
// ============================================
// A character gets 3 short rests per long rest. Taking a short rest spends one;
// a long rest refills the pool. Per-character value, so it is scoped storage.

import { getScopedItem, setScopedItem, migrateToScoped } from '@/lib/scoped-storage';

export const SHORT_RESTS_KEY = 'odyssey-short-rests-remaining';
export const MAX_SHORT_RESTS = 3;

/** Fired whenever the pool changes, so open screens can re-read it. */
export const SHORT_REST_EVENT = 'odyssey-short-rests-changed';

let migrated = false;

function ensureMigrated() {
  if (migrated) return;
  migrated = true;
  try {
    migrateToScoped(SHORT_RESTS_KEY);
  } catch (e) {
    console.error('[RestTracker] migrate failed:', e);
  }
}

/** Short rests still available before a long rest is required. */
export function getShortRestsRemaining(): number {
  ensureMigrated();
  try {
    const raw = getScopedItem(SHORT_RESTS_KEY);
    if (raw === null) return MAX_SHORT_RESTS;
    const n = Number(raw);
    if (!Number.isFinite(n)) return MAX_SHORT_RESTS;
    return Math.max(0, Math.min(MAX_SHORT_RESTS, Math.floor(n)));
  } catch {
    return MAX_SHORT_RESTS;
  }
}

function write(value: number) {
  const safe = Math.max(0, Math.min(MAX_SHORT_RESTS, Math.floor(value)));
  try {
    setScopedItem(SHORT_RESTS_KEY, String(safe));
  } catch (e) {
    console.error('[RestTracker] save failed:', e);
  }
  try {
    window.dispatchEvent(new CustomEvent(SHORT_REST_EVENT, { detail: safe }));
  } catch { /* no-op */ }
  return safe;
}

/** Spend one short rest. Returns the new remaining count (never below 0). */
export function spendShortRest(): number {
  return write(getShortRestsRemaining() - 1);
}

/** Long rest: refill the pool. */
export function refillShortRests(): number {
  return write(MAX_SHORT_RESTS);
}

export function canTakeShortRest(): boolean {
  return getShortRestsRemaining() > 0;
}
