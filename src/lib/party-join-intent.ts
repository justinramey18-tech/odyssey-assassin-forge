// Minimal "I'm joining a party" intent carried across signup / sign-in / recovery.
// Session-only, holds only the normalized code — never passwords, tokens or recovery codes.

const KEY = 'odyssey-party-join-intent';

export function normalizePartyCode(raw: string): string {
  return (raw || '').replace(/\s+/g, '').toUpperCase().slice(0, 6);
}
export const isValidPartyCode = (c: string) => /^[A-Z0-9]{6}$/.test(c);

export function saveJoinIntent(code: string) {
  try { sessionStorage.setItem(KEY, JSON.stringify({ code: normalizePartyCode(code), at: Date.now() })); } catch { /* ignore */ }
}
export function readJoinIntent(): { code: string } | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
    if (v && typeof v.code === 'string' && Date.now() - Number(v.at) < 6 * 3600_000) return { code: v.code };
  } catch { /* ignore */ }
  return null;
}
export function hasJoinIntent() { return !!readJoinIntent(); }
export function clearJoinIntent() { try { sessionStorage.removeItem(KEY); } catch { /* ignore */ } }

/** Sign-out: drop this device's onboarding intent, receipt and this user's local draft fallbacks (server drafts stay). */
export function clearOnboardingLocal(userId: string | null | undefined) {
  clearJoinIntent();
  try {
    localStorage.removeItem('odyssey-party-creation-receipt');
    if (userId) {
      const prefix = `odyssey-party-creation-draft::${userId}::`;
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(prefix)) doomed.push(k); }
      doomed.forEach(k => localStorage.removeItem(k));
    }
  } catch { /* ignore */ }
}
