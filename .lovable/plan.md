# Fix: Party quest board looks empty even though the quests were saved

## What's actually happening

The DM's quest board **was** read correctly. All eight jobs (The Burning Road, The Gelding's Recovery, The Rematch, Einar's Lesson, and the rest) were extracted and saved to your party's shared storage twice — once under you (the host) and once under the other player in the party.

The problem is on the reading side. The app asks for "the one quest board row for this party" and expects exactly one. Because two copies exist, that request comes back as an error instead of a list, so the board shows nothing. The manual "Pull quests from the DM" button re-saves the same quests and hits the same wall, which is why nothing changed when you tried it.

So: nothing is wrong with the DM's answer, and a GM guide would not fix this. It is a wiring bug, and it is already fixable with the data you have — your existing quests can be restored, not re-generated.

## The fix

1. **One board per party, not one per player.** The quest board is stored under the party host from now on. Everyone (players and co-hosts) reads and writes that single copy, so the two-copies situation can't happen again.
2. **Tolerant reading.** If more than one copy is ever found, the app takes the most recently updated one instead of failing and showing an empty board. Also surface a quiet error notice if the board fails to load, rather than silently rendering nothing.
3. **Merge what's already there.** Combine the two existing copies for your Hestvík party into the host's single copy so your eight quests appear immediately, with their objectives and history intact.
4. **Only the host writes.** Confirm that quest offers, acceptances and progress from non-host players never write their own copy — they act through the shared host copy.

## Result

Your quest board fills in with the main quest and seven side quests, each accept/decline-able, and future DM boards land automatically for everyone in the party at the same time.

## Technical notes

- `src/hooks/use-party-quests.ts`: `load()`, `upsertQuest()` and `recordWorldState()` all use `.eq('state_type','quest_flags').maybeSingle()` without a `user_id` filter. With two rows present, `maybeSingle()` errors and returns `data: null`, so `normalizeQuestMap({})` yields an empty board. Change reads to `.order('updated_at', { ascending: false }).limit(1).maybeSingle()` and make writes always target the party owner's `user_id` (pass the party's `created_by` as `ownerUserId` from `StandalonePartyDMScreen` and `PartyDMScreen`).
- Surface the `error` from those queries (console warn + one toast) so a future read failure is visible.
- One-off data migration: merge the duplicate `quest_flags` rows for party `73bafbdd…` into the host row and delete the stray, keyed by quest key with the newest event history winning.
- No schema change needed; no change to `ai-dm-extract` (extraction already handles up to 8 quests and captured this board correctly).
