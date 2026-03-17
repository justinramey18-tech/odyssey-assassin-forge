

# Preserve Split Messages on Regroup

## Problem
Currently, regrouping deletes all split-phase messages and restores the pre-split snapshot. The user wants split messages preserved so alpha members still see alpha messages, beta members still see beta messages, and everyone sees the new reunion message.

## Approach
Modify `regroupParty` in `src/hooks/use-party-dm.ts` to:

1. **Stop deleting messages** — Remove the bulk delete of `party_dm_messages` and the snapshot restoration loop (lines 1717-1735)
2. **Clear the `team` tag on all existing messages** — Run an update setting `team = null` on all messages for this party, so they become visible to everyone post-regroup
3. **Delete prompts only** — Keep the prompt cleanup
4. **Insert the reunion message with `team = null`** — Already happens (no team tag), so all members see it
5. **Clear split state** — Same as before

### Why clear `team` on old messages?
Post-regroup, `isSplitActive` becomes false, so `filteredMessages` stops filtering by team (line 193-197). All messages with or without a `team` tag will be shown to everyone. So technically we don't even need to clear the team tag — the filter already shows all messages when split is inactive. This means the only real change is: **stop deleting messages and stop restoring the snapshot**.

### Updated `regroupParty` logic (lines 1716-1735)
Replace the delete-all + restore-snapshot block with just deleting prompts:

```
// Delete pending prompts only (not messages)
await supabase.from('party_dm_prompts').delete().eq('party_id', partyId);
```

The snapshot messages are already in the DB (they were the original messages before split, and split messages were added alongside them with team tags). Wait — actually, looking at the `initiateSplit` flow, I need to check if the original messages get deleted when split starts.

### File: `src/hooks/use-party-dm.ts`
- **Lines 1717-1735**: Replace delete-all-messages + restore-snapshot with just deleting prompts
- The rest of the function (AI generation, split state cleanup) stays the same

### Also update `RegroupDialog` description
- **File: `src/components/ai-dm/PartySplitUI.tsx`** — Change the description text from "The original chat will be restored and a unification scene will be generated" to "A reunion scene will be generated and all messages will be visible to everyone"

## Files to Modify
1. `src/hooks/use-party-dm.ts` — Remove message deletion and snapshot restoration in `regroupParty`
2. `src/components/ai-dm/PartySplitUI.tsx` — Update RegroupDialog description text

