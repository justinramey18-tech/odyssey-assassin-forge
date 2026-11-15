// Starting an account switch from the running app (see account-space.ts).
// Saves what's pending, keeps the current login fresh in storage, records the switch,
// then reloads; account-space-boot.ts finishes the switch on the next start.
import { supabase } from '@/integrations/supabase/client';
import { writePendingSwitch, type Space } from '@/lib/account-space';

let switching = false;

function showSwitchingCover(to: Space): void {
  try {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;'
      + 'background:#0d0d12;color:#fbbf24;font:600 18px system-ui,sans-serif;text-align:center;padding:24px;';
    el.textContent = to === 'empyrean' ? '🐉 Opening your Empyrean account…' : 'Returning to Odyssey…';
    document.body.appendChild(el);
  } catch { /* cosmetic only */ }
}

/** Switch spaces. Returns false when a switch is already running. */
export async function requestSpaceSwitch(to: Space, opts: { carry?: string[]; returnTo?: string } = {}): Promise<boolean> {
  if (switching) return false;
  switching = true;
  showSwitchingCover(to);

  // 1. Let the auto-save push anything still pending (the same hand-off sign-out uses).
  try {
    const pending: Promise<unknown>[] = [];
    window.dispatchEvent(new CustomEvent('odyssey-flush-cloud-sync', {
      detail: { register: (p: Promise<unknown>) => pending.push(p) },
    }));
    if (pending.length > 0) {
      await Promise.race([Promise.allSettled(pending), new Promise(resolve => setTimeout(resolve, 5000))]);
    }
  } catch { /* best effort */ }

  // 2. Make sure the stored login is the current one, then stop refreshing it so the
  //    copy that gets parked stays valid.
  try { await supabase.auth.getSession(); } catch { /* ignore */ }
  try { await supabase.auth.stopAutoRefresh(); } catch { /* ignore */ }

  // 3. Record the switch and reload; the boot step does the rest.
  const returnTo = opts.returnTo ?? '/';
  writePendingSwitch({ to, carry: opts.carry ?? [], returnTo, at: Date.now() });
  window.location.replace(returnTo);
  return true;
}

export function enterEmpyreanAccount(opts: { carry?: string[]; returnTo?: string } = {}): Promise<boolean> {
  return requestSpaceSwitch('empyrean', opts);
}

export function returnToOdyssey(): Promise<boolean> {
  return requestSpaceSwitch('odyssey', { returnTo: '/' });
}
