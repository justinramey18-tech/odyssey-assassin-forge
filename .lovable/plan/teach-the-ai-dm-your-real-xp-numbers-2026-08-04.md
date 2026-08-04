# Teach the AI DM your real XP numbers

## The problem

Right now the DM is told your name, level, HP, gear, spells — but never your experience points. It has no idea how much XP you have or how much is needed for the next level, so when it hands you 500 XP it guesses whether that was enough to level you. In the excerpt it guessed wrong and announced Level 6 when your sheet still shows 500 of 3,750 toward the next level.

Confirmed by reading the character data the DM receives (`CharacterContext`) and the summary the AI reads: neither contains any XP field.

## The fix

Send the DM your live progression numbers every message, and give it a hard rule about when it may announce a level-up.

1. Include in the DM's character briefing:
   - Current total XP
   - XP required for the next level (adjusted for your chosen pace: Slow / Natural / Fast)
   - XP still remaining to the next level
   - Which tracking style is active (XP numbers vs Milestone)

2. Add a binding rule to the DM's instructions:
   - In XP mode: award XP freely, but only declare a level-up when the award actually pushes the total past the next-level threshold. Otherwise state how much is still needed.
   - In Milestone mode: never mention XP numbers at all; level-ups only happen when a story milestone is reached (or the guides say so).

3. The DM's briefing shows the numbers after the award is applied, so it stays honest turn to turn.

## Technical notes

- Add `progression` fields (`currentXP`, `xpForNextLevel`, `xpRemaining`, `mode`) to `CharacterContext` in all three places it is duplicated: `src/components/oracle/types.ts`, `supabase/functions/ai-dm/index.ts`, `supabase/functions/oracle-assistant/index.ts`.
- Populate them in `PromptDrawerProvider.tsx`'s `aiDMCharacterContext` memo using the already-passed `currentXP` prop plus `useXPProgression()` and `getXPForLevel()` from `src/lib/xpSystem.ts` (multiplier-aware). Add the new values to the memo's dependency array.
- Emit a null-guarded `PROGRESSION:` line in `buildContextSummary` in both edge functions.
- Append the level-up rule to the existing state-sync instruction block near the end of the ai-dm system prompt (line ~477), so guides can still override pacing but the threshold math is non-negotiable.
