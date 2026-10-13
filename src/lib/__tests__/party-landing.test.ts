import { describe, it, expect } from 'vitest';
import { shouldLandInPartyTable } from '../party-landing';

// One rule per test: the app lands in the live party table on open only when
// the player is in party mode, signed in, and has a noted party.

describe('party landing on app open', () => {
  const base = { partyMode: true, signedIn: true, lastPartyId: 'party-1', modeSelectionShowing: false };

  it('lands in the party table when in party mode, signed in, with a noted party', () => {
    expect(shouldLandInPartyTable(base)).toBe(true);
  });

  it('stays on Home when the phone has no noted party', () => {
    expect(shouldLandInPartyTable({ ...base, lastPartyId: null })).toBe(false);
  });

  it('stays on Home when signed out', () => {
    expect(shouldLandInPartyTable({ ...base, signedIn: false })).toBe(false);
  });

  it('stays on Home when not in party mode', () => {
    expect(shouldLandInPartyTable({ ...base, partyMode: false })).toBe(false);
  });

  it('defers to the first-run mode picker when it is showing', () => {
    expect(shouldLandInPartyTable({ ...base, modeSelectionShowing: true })).toBe(false);
  });
});
