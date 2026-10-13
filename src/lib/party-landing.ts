// Landing directly in the live party table on app open.
// The marker is ACCOUNT-level (never scoped per character): party membership
// survives character switches, so the note must too. Deliberately NOT listed
// in SCOPED_KEYS — see the note in scoped-keys.ts.

export const LAST_PARTY_ID_KEY = 'odyssey-last-party-id';

/** The party id the phone last confirmed, or null when none is noted. */
export function readLastPartyId(): string | null {
  try {
    return localStorage.getItem(LAST_PARTY_ID_KEY);
  } catch {
    return null;
  }
}

/** Remember (or forget) which party the phone was last connected to. */
export function writeLastPartyId(partyId: string | null): void {
  try {
    if (partyId) localStorage.setItem(LAST_PARTY_ID_KEY, partyId);
    else localStorage.removeItem(LAST_PARTY_ID_KEY);
  } catch {
    // Storage unavailable — landing falls back to Home.
  }
}

export interface PartyLandingDecision {
  /** Play mode is 'party' */
  partyMode: boolean;
  /** The player is signed in */
  signedIn: boolean;
  /** Result of readLastPartyId() */
  lastPartyId: string | null | undefined;
  /** The first-run mode picker is showing */
  modeSelectionShowing: boolean;
}

/**
 * Should the app open straight into the live party table instead of Home?
 * True only when the player is signed in, in party mode, and the phone has a
 * noted party — and the mode picker isn't the screen in charge.
 */
export function shouldLandInPartyTable(d: PartyLandingDecision): boolean {
  if (d.modeSelectionShowing) return false;
  return !!d.partyMode && !!d.signedIn && !!d.lastPartyId;
}
