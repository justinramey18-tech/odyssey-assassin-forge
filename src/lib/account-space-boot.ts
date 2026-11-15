// Runs once at app start, BEFORE the Supabase client and React (imported first in main.tsx).
// Applies a pending account switch (see account-space.ts), opens the path the switch asked
// for, and sends an Empyrean space with no login to the Empyrean sign-in page.
import { applyPendingSwitch, currentSpace, hasLiveLogin, EMPYREAN_AUTH_PATH } from './account-space';

try {
  const result = applyPendingSwitch();
  if (result.switched) console.log(`[AccountSpace] switched ${result.from} → ${result.to}`, result.moved);
  if (result.error) console.error('[AccountSpace]', result.error);
  if (result.returnTo && result.returnTo !== window.location.pathname) {
    window.history.replaceState(null, '', result.returnTo);
  }
  if (currentSpace() === 'empyrean' && !hasLiveLogin() && window.location.pathname !== EMPYREAN_AUTH_PATH) {
    window.history.replaceState(null, '', EMPYREAN_AUTH_PATH);
  }
} catch (e) {
  console.error('[AccountSpace] boot failed', e);
}
