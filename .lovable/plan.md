# Let new players get into a running party session

A player who joins mid-campaign taps into the party and sits on "Loading session..." forever. The screen shows that spinner whenever the app hasn't figured out which party the player belongs to — and today there is nothing that retries, times out, or gives the player a way out. This plan makes that screen resolve itself, and gives an escape hatch when it can't.

## What is happening now (confirmed by reading the code)

- The party screen shows the "Loading session..." spinner whenever either the signed-in user or the party isn't known yet. There is no retry and no timeout, so if the party never resolves the spinner is permanent.
- The party is worked out once, on app start. If that one attempt comes back empty — for example the player's saved character has no party recorded on it yet, or a leftover "which party am I in" marker is stale from before they joined — the app stops looking and never tries again for the rest of the session.
- Joining a party writes the membership, but the freshly joined player's saved character does not necessarily carry the party on it, which is exactly the case that lands in the dead end above.

I have not confirmed which of those two paths this specific player hit, so the first step of the work is a quick check against the live data (does the membership row exist, is the party still marked active) before the fixes land.

## The fix

1. **Verify the player's membership** in the database for this party — confirms whether this is a "never resolved" problem or a stale marker problem, and which of the fixes below is doing the real work.

2. **Make the party lookup self-healing.** Instead of one attempt at startup, the lookup re-runs whenever the player has no party resolved: it clears the stale marker, asks the database directly "which active party is this user a member of", and adopts the answer. It also re-runs when the player signs in or comes back to the app, so a mid-campaign join is picked up without closing and reopening the app.

3. **Write the party onto the joining player's character.** When someone joins with a code, the party is recorded on their saved character right away, so future launches resolve instantly instead of relying on a fallback lookup.

4. **Give the loading screen an ending.** After a few seconds of getting nowhere it stops being a bare spinner and becomes a small panel with: what it is waiting for, a **Retry** button that re-runs the lookup, a **Rejoin with code** button that opens the existing join-by-code dialog, and a **Back** button to leave the screen. No more trapped players.

5. **No host action needed to enter.** Entering a live session mid-campaign stays open — the screen already has no "campaign started" gate, and nothing in this plan adds one. The new player lands straight in the round chat with the existing history loaded.

## What the new player will see

Tap into the party → either the session opens as normal, or after about five seconds they get "Still finding your party" with Retry / Rejoin with code / Back, instead of an endless spinner.

## Technical notes

- `src/hooks/use-party-sync.ts`: turn the one-shot mount lookup into a callable `resolveParty()` that runs on mount, on auth change, on `visibilitychange`, and on demand. Remove the early `return` that leaves `isLoading` true when the one-shot marker was present but empty; always fall through to the `party_members` + `parties.is_active` query. Expose `resolveParty` (and a real `isLoading`/`isResolved` flag) from the hook.
- `use-party-sync.ts` `joinParty`: after a successful join, persist the party id onto the active `character_saves.extended_data.partyId` for that user so later launches resolve directly.
- `src/components/ai-dm/PartyDMScreen.tsx` (~line 2141): replace the bare guard block with a timed component — spinner for the first ~5s, then the recovery panel wired to `resolveParty`, the join dialog, and `onBack`.
- `src/components/party/JoinPartyDialog.tsx` is reused as-is for "Rejoin with code".
- No database migration and no changes to round/Live-DM logic.
