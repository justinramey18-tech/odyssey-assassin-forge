# Stop the ready-up screen from flashing before the Live DM Table loads

## Why it happens

When the Party DM screen opens, the table's chosen round style (Live DM vs the classic ready-up queue) is remembered in the cloud. But until that saved choice finishes loading (a fraction of a second), the app assumes the old classic mode. So for that first instant the screen builds the ready-up UI — round timer, prompt queue, the classic input bar — and then rips it all out and swaps in the Live DM Table. That swap is the flash.

## The fix

Two files, no database changes.

### 1. `src/hooks/use-round-chat.ts` — remember that the saved choice has loaded

- Add a "style loaded" flag that starts as false and flips to true once the saved style has been fetched for the current party.
- Reset it to false if the party changes, so a new party always waits for its own saved choice.
- Return this flag from the hook alongside everything it already returns. Nothing else about the hook changes — loading, realtime updates, read receipts, and saving all stay exactly as they are.

### 2. `src/components/ai-dm/PartyDMScreen.tsx` — Live DM is the default while the choice loads

- While the saved style is still loading, the screen behaves as if the table is in Live DM mode: the Live DM Table and hand-off bar appear immediately on entry, with no ready-up screen first. The saved choice takes over the moment it arrives (usually within a blink).
- The classic ready-up UI only ever shows after loading has finished and the table is genuinely set to ready-up mode — add the loaded check to the two places that currently show it whenever Live DM is off:
  - the round timer / prompt queue strip,
  - the classic player input bar.
- Internal behaviour that checks "is chat mode on" during that brief loading window also treats Live DM as on, so nothing fires the DM under the wrong rules.

Because Live DM renders during loading, a table genuinely using ready-up mode would see the Live DM Table flash before ready-up appears — accepted per your call, since your tables play in Live DM.

## Verification

- Build passes.
- Open the Party DM screen in the preview and confirm the Live DM Table appears with no ready-up flash; screenshots before/after to compare.
