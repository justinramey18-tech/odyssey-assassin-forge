# Stop the ready-up screen from flashing before the Live DM Table loads

## Why it happens

When the Party DM screen opens, the table's chosen round style (Live DM vs the classic ready-up queue) is remembered in the cloud. But until that saved choice finishes loading (a fraction of a second), the app assumes the old classic mode. So for that first instant the screen builds the ready-up UI — round timer, prompt queue, the classic input bar — and then rips it all out and swaps in the Live DM Table. That swap is the flash.

## The fix

Two files, no database changes.

### 1. `src/hooks/use-round-chat.ts` — remember that the saved choice has loaded

- Add a "style loaded" flag that starts as false and flips to true once the saved style has been fetched for the current party.
- Reset it to false if the party changes, so a new party always waits for its own saved choice.
- Return this flag from the hook alongside everything it already returns. Nothing else about the hook changes — loading, realtime updates, read receipts, and saving all stay exactly as they are.

### 2. `src/components/ai-dm/PartyDMScreen.tsx` — show neither screen until the choice is known

- While the saved style is still loading, render NEITHER the classic ready-up UI NOR the Live DM Table. The brief blank beat (typically well under half a second) is invisible in practice, and whichever mode the table actually uses appears directly, with no wrong screen flashing first.
- Concretely, add the loaded check to the two places that currently show the classic UI whenever Live DM is off:
  - the round timer / prompt queue strip,
  - the classic player input bar.
- The Live DM Table and hand-off bar keep their existing condition untouched.

Note on "make Live DM the default": we deliberately do not hard-code Live DM as the assumed mode. That would fix your flash but cause the mirror-image problem for any table that plays in ready-up mode (their screen would flash the Live DM Table first). Waiting for the saved choice fixes it for every table.

## Verification

- Build passes.
- Open the Party DM screen in the preview and confirm the Live DM Table appears with no ready-up flash; screenshots before/after to compare.
