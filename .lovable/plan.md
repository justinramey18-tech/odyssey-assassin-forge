# Land in the Live Party Table on App Open

## What you'll see

Opening the app while you're in a party now takes you straight to the live party table — no Home stop, no Enter Story cinematic. A brief loading spinner appears while the table connects, then you're in the chat.

Everything else stays the same:

- Not in a party, signed out, or first-time player → the app opens on Home (or the mode picker) exactly as today.
- Back button on the table still returns to Home.
- The mode picker still auto-opens the table when you pick "party" on first setup.
- If the party is gone or can't be found, the table's existing recovery screen appears (retry, rejoin with code, or back) — your campaign is untouched.

## How it works (plain terms)

The app needs to know "were they in a party?" the instant it opens, before it has time to ask the server. So it keeps a small note on the phone that says "last party: [this party]" and updates it every time you connect to a party, and erases it when you leave one. On open, the app checks: party mode chosen, signed in, note present → open the table immediately, using the same path as tapping Play (minus the cinematic). The note lives at the account level, not per character, so switching characters doesn't break it.

## Changes

1. **`src/hooks/use-party-sync.ts`**
   - When the app confirms your party membership on connect, save the party id to an account-level phone note (`odyssey-last-party-id`, plain storage — deliberately NOT per-character).
   - When you leave a party / are removed / the app clears membership, erase the note.

2. **`src/pages/Index.tsx`**
   - On app open, once sign-in state is known: if party mode is active, you're signed in, the note exists, and the mode picker isn't showing → trigger the existing "auto-open party table" flag (one time only, ref-guarded).
   - The table then opens through the standard Play path, which also binds the correct party character.

3. **New tiny helper + test: `src/lib/party-landing.ts` and `src/lib/__tests__/party-landing.test.ts`**
   - A pure "should the app open the table?" decision (party mode + signed in + note present) so the rule is testable.
   - Test asserts: opens with all three true; stays on Home when the note is missing, when signed out, or when mode isn't party.

## Not changing

- Database, permissions, or any server code.
- The Enter Story cinematic for normal Play taps (only the on-open landing skips it).
- Solo mode, Empyrean, or the character wizard flow.
