

## Add Manual Level Adjustment to Settings

### Problem
Once a character is created, there's no way to adjust their level downward. Level only goes up via XP.

### Solution
Add a "Character Level" slider to the Settings panel (Character tab) that allows freely setting level 1–20, with automatic recalculation of:
- Available ability points (excess points auto-unspent if lowering)
- XP (set to minimum XP for chosen level)
- Max HP (recalculated for new level + CON)

### Changes

**1. `src/components/settings/SettingsContent.tsx`**
- Add a new "Character Level" section with a Slider (1–20) in the Character settings area
- Wire it to a new `onLevelChange` callback prop

**2. `src/components/settings/SettingsModal.tsx`**
- Pass through the `onLevelChange` prop

**3. `src/pages/Index.tsx`**
- Add `handleLevelChange(newLevel)` that:
  - Updates `character.level`
  - Sets XP to the minimum for that level (using existing XP table)
  - Recalculates max HP
  - If ability points decrease, warns user that excess invested points may need to be unspent
  - Persists to scoped storage
- Pass it down through Settings

**4. Safeguard: ability point overflow**
- When level decreases, if spent points exceed new max, show a toast warning the user to unallocate abilities (don't auto-remove — let user choose which to drop)

