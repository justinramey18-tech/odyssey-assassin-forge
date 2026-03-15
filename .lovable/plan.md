

## Reset Prestige on Level Change

### What
When the level slider in Settings changes the character's level, also reset prestige data (level, XP, and points) back to zero — since prestige is a post-max-level system and manually adjusting level invalidates that progression.

### Change

**`src/pages/Index.tsx`** — In `handleLevelChange` callback (~line 2253):
- After setting the new level and XP, reset prestige data via `setPrestigeData({ prestigeLevel: 0, prestigeXP: 0, totalPrestigePoints: 0 })` and persist to scoped storage.
- Also reset prestige tree spent state (`setPrestigeTreeSpentState(0)` and `prestigeTree.resetTree()`), matching the existing app-reset logic.
- Add a note in the toast if prestige was reset (only when `prestigeData.prestigeLevel > 0`).

This mirrors the existing reset logic at lines 2314-2322 but scoped to level changes only when prestige was active.

