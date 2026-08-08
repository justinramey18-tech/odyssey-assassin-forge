# Quest Board: DM-Offered Quests With Stages and Rewards

Today the Quests section of the character sheet only shows a flat list of names with an "active / completed" label. This plan turns it into a real quest board: the DM offers quests, you accept them, and the app tracks stages, percent complete, and pays out the rewards.

## What a quest looks like

- Title and short description
- Type: Main quest or Side quest
- Difficulty: a challenge rating badge (Easy, Moderate, Hard, Deadly) with a colour
- Reward: XP amount, gold amount, and any items the DM promises
- Stages: a short list of goals (typically 2 to 5) that must be done before the quest counts as complete
- Progress: percent complete, worked out from how many stages are ticked
- Status: offered, active, completed, or failed

## How it flows

1. During normal play the DM's narration is read in the background (the same background reader that already picks up loot and gold). When the story clearly offers a job, bounty, errand or mission, it becomes an **offered** quest.
2. Offered quests appear at the top of the Quests section with Accept and Decline buttons. Nothing is tracked until you accept.
3. On Accept the quest becomes **active**, and the DM is told in one short factual line that you took the job, so it starts weaving it into the story.
4. As the story progresses the DM marks individual stages done. The percent bar fills. Stages are ticked by the DM only, not by hand.
5. When the last stage is done the quest completes and the rewards are applied automatically: XP is added, gold is added, and any promised items go into your inventory. A confirmation toast shows what you earned.
6. If the story clearly closes the job off badly, the quest is marked failed and pays nothing.

## Where it appears

- **Solo DM character sheet** — full quest board with offers, active quests, stage checklists, and a completed/failed archive.
- **Party mode** — the existing Party Quests panel gets the same board, shared with everyone in real time. Only the host can accept or decline on the party's behalf; everyone sees progress update live.

## Technical notes

- Extend the quest shape stored in `dm_game_state.quest_flags` (solo) and `party_shared_state` with `state_type: 'quest_flags'` (party). New fields are all optional so existing saved quests keep working: `title`, `description`, `questType`, `challengeRating`, `xpReward`, `goldReward`, `itemRewards[]`, `stages[{id, text, done}]`, and the existing `status` gains `offered`.
- Add a `quests_offered` and `quest_progress` section to the `ai-dm-extract` tool schema so the same background pass that captures loot also captures quest offers and stage completions. Cap offers at 3 per response and stages at 6 per quest.
- New shared module `src/lib/quests.ts` for the type, percent calculation, stage ticking, and completion payout (XP through the existing XP progression, gold through the existing gold setter, items through the existing DM item intake path so gear and consumables land in the right place).
- New component `src/components/ai-dm/QuestBoard.tsx` rendered inside the existing Quests section of `SoloCharacterSheet.tsx` and inside `PartyQuestsPanel.tsx`, so both surfaces share one UI.
- Add active quests (title, type, current unfinished stages, percent) to the character context sent to the `ai-dm` edge function, and render them in `buildContextSummary` in both `ai-dm` and `oracle-assistant`, null-guarded and capped at 8 with "(+N more)". This is what lets the DM track progress instead of forgetting the job exists.
- Rewards are validated with `Number.isFinite` before being written, so a bad number from the model can never corrupt a save.
