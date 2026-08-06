# Fix: Actually run auto-sync in the party DM

## What we're fixing
In party DM sessions, the Auto-Sync toggle in Settings looks functional but does nothing. The `useDmAutoSync` hook is built inside `StandalonePartyDMScreen.tsx`, yet `extractAndApply` is never called, so XP/gold/HP changes described by the AI never reach the character sheet.

## How we'll fix it
Edit one file only: `src/components/ai-dm/StandalonePartyDMScreen.tsx`.

1. **Import `addPendingDmItems`** from `@/lib/pendingDmItems`.
2. **Add an effect after the `useDmAutoSync` call** that watches `partyDm.messages`.
   - On first render / campaign load, seed every existing message as "already processed" so old awards are not replayed.
   - On later renders, look only at the newest assistant message.
   - If auto-sync is enabled and the AI is not still generating, call `autoSync.extractAndApply(last.content, characterContext)`.
   - If the result includes acquired items, stage them via `addPendingDmItems`.
   - Track processed message IDs in a `useRef` Set to prevent double-application from realtime echoes or re-renders.
3. **Reset the seed on campaign load** in `handleLoadCampaign` so switching campaigns does not replay the new campaign's entire transcript.

## Why this design is correct
Party chat messages are shared across all players over Supabase realtime. Every player's device should run the extractor on the same DM narration, because each player applies the result to their own character. This matches the intended behaviour for party-wide XP/gold awards.

## Verification steps after deploy
1. Join or start a party DM.
2. Take an action that earns XP or gold.
3. When the DM reply finishes, check that the character strip/sheet updates within a few seconds.
4. Close and reopen the party DM — totals must stay the same (no re-application of old awards).
