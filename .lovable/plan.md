# Automatic Quest Outcomes and Permanent Impacts

Today the DM's story text is already scanned after every reply, and it can tick off objectives, mark a whole quest done, and log irreversible world events. What it can't do is say *how* an objective ended. An objective is either untouched or "done" — there is no way to record that the party tried it and failed, and a failed quest never leaves a permanent mark on the world log.

This adds outcomes to every objective and makes lasting consequences record themselves.

## What changes for the player

- Each objective on the quest board now shows a clear result: a green tick for success, a red cross for failure, or a half mark for partly done — with a short line saying what happened.
- A quest that ends badly is stamped FAILED on the board instead of quietly sitting there, and the reason is written into its timeline.
- When something can never be taken back (a person killed, a bridge burned, a relic lost, a town saved), it is written to the World State panel automatically — for failures as well as victories, not just completions.
- A short on-screen message announces each result as it lands: "Objective failed — the caravan was lost" or "Objective complete".
- Works the same in solo play and in party play, and the party board stays shared, as it is now.

## How the story text is read

The reader that already runs after each DM reply gets a richer objective report:

- for each objective it touches: the objective text, the result (success / failure / partial), and one sentence of detail
- an optional note that the result is permanent, which sends it straight to the World State panel
- the existing "whole quest done or lost" signal stays as it is

Old-style reports (a plain list of completed objectives) keep working, so nothing in flight breaks.

## Technical notes

- `supabase/functions/ai-dm-extract/index.ts`: replace `stages_completed` in `quest_progress` with `objective_results` (array of `{ stage, outcome: success|failure|partial, detail, permanent: boolean }`), keep `stages_completed` accepted for backward compatibility, and extend the guidance text so failures are reported rather than omitted.
- `src/lib/quests.ts`: add `outcome` and `detail` to `QuestStage`; `applyQuestProgress` records outcomes (failure marks the objective resolved-but-failed, not done), writes richer timeline events, and returns the list of results so callers can toast and record impacts. Extend `worldEntryFromQuest` to cover `failed` quests and add a helper that builds a world entry from a permanent objective result.
- `src/hooks/use-dm-auto-sync.ts`: widen the `quest_progress` type and pass the new fields through.
- `src/components/ai-dm/QuestBoard.tsx`: per-objective success/failure/partial icons, detail line, and a FAILED state for the quest card.
- `src/components/ai-dm/AIDMScreen.tsx` and `src/components/ai-dm/StandalonePartyDMScreen.tsx`: apply the new results, fire result toasts, and route permanent impacts into the world-state recorder in both solo and party paths. Reward payout stays tied to completion only — failed quests pay nothing.
