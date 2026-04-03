/**
 * Reload Guard
 *
 * Prevents service-worker-triggered reloads while native pickers
 * (file input, camera, etc.) are open on iOS PWA. When the PWA is
 * backgrounded by a picker, the SW may detect a new version and
 * call reload(), losing the user's pending action.
 *
 * Usage:
 *   import { suppressReloads, allowReloads, isReloadSuppressed } from '@/lib/reload-guard';
 *
 *   suppressReloads();   // call before opening file picker
 *   allowReloads();      // call after file is selected or cancelled
 */

let suppressed = false;

export function suppressReloads(): void {
  suppressed = true;
  // Also persist in sessionStorage so it survives a soft reload
  try { sessionStorage.setItem('reload-suppressed', '1'); } catch {}
}

export function allowReloads(): void {
  suppressed = false;
  try { sessionStorage.removeItem('reload-suppressed'); } catch {}
}

export function isReloadSuppressed(): boolean {
  if (suppressed) return true;
  try { return sessionStorage.getItem('reload-suppressed') === '1'; } catch {}
  return false;
}
