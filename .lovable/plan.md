
# Revised Implementation Plan: Unified XP/Leveling/Ability Points System

## Key Discovery: Character Points Don't Need Migration

After analyzing the codebase, I discovered that **character level points are calculated dynamically** via `getAbilityPointsForLevel(character.level)` - they're never stored. This means:

- Updating the formula in `types.ts` will **automatically** give existing characters the correct new point totals
- Only **prestige points need migration** because `totalPrestigePoints` is stored in localStorage

---

## Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| `src/lib/types.ts` | New ability points formula | All characters get new point totals automatically |
| `src/lib/prestige/config.ts` | Add variable prestige points function | Foundation for prestige migration |
| `src/hooks/use-prestige.ts` | Use variable points + add migration | Existing prestige data recalculated |
| `src/hooks/use-auto-save.ts` | Bump version to 2 | Track migrated saves |
| `src/lib/resetApp.ts` | Import XP thresholds from xpSystem | DRY consolidation |

---

## Detailed Implementation

### 1. Update Ability Points Formula

**File:** `src/lib/types.ts`  
**Function:** `getAbilityPointsForLevel()`

**Current formula (lines 41-57):**
- 1 point per level + bonus at levels 4, 8, 12, 16, 19
- Total at Level 20: ~25 points

**New formula per spec:**
```typescript
export function getAbilityPointsForLevel(level: number): number {
  if (level < 1) return 0;
  if (level > 20) level = 20;
  
  // Level 1: 5 starting points
  let points = 5;
  
  // Level 2: +3 points
  if (level >= 2) points += 3;
  
  // Levels 3-5: +2 points each
  for (let l = 3; l <= Math.min(level, 5); l++) {
    points += 2;
  }
  
  // Levels 6-10: +3 points each
  for (let l = 6; l <= Math.min(level, 10); l++) {
    points += 3;
  }
  
  // Levels 11-15: +4 points each
  for (let l = 11; l <= Math.min(level, 15); l++) {
    points += 4;
  }
  
  // Levels 16-20: +5 points each
  for (let l = 16; l <= Math.min(level, 20); l++) {
    points += 5;
  }
  
  return points;
}
```

**New point totals by level:**

| Level | Cumulative Points |
|-------|-------------------|
| 1 | 5 |
| 2 | 8 |
| 5 | 14 |
| 10 | 29 |
| 15 | 49 |
| 20 | 74 |

---

### 2. Add Variable Prestige Points Function

**File:** `src/lib/prestige/config.ts`

Add new function (keep existing config for XP requirements):

```typescript
/**
 * Get points awarded for reaching a specific prestige level
 * Variable scaling per spec
 */
export function getPrestigePointsForLevel(prestigeLevel: number): number {
  const levelRewards: Record<number, number> = {
    1: 3, 2: 2, 3: 2, 4: 2, 5: 3,
    6: 2, 7: 2, 8: 3, 9: 3, 10: 5,
  };
  return levelRewards[prestigeLevel] ?? 3; // 3 points for levels 11+
}

/**
 * Calculate total prestige points earned from level 1 to current level
 * Used for migration and validation
 */
export function getTotalPrestigePointsForLevel(prestigeLevel: number): number {
  let total = 0;
  for (let l = 1; l <= prestigeLevel; l++) {
    total += getPrestigePointsForLevel(l);
  }
  return total;
}
```

**Prestige point totals:**

| Prestige Level | Points This Level | Cumulative |
|----------------|-------------------|------------|
| 1 | 3 | 3 |
| 2 | 2 | 5 |
| 3 | 2 | 7 |
| 4 | 2 | 9 |
| 5 | 3 | 12 |
| 10 | 5 | 26 |
| 15 | 3 | 41 |

---

### 3. Update Prestige Hook with Migration

**File:** `src/hooks/use-prestige.ts`

**Update `migratePrestigeData()` to recalculate points:**

```typescript
import { 
  getPrestigePointsForLevel,
  getTotalPrestigePointsForLevel,
} from '@/lib/prestige/config';

function migratePrestigeData(saved: any): PrestigeData {
  const prestigeLevel = saved.prestigeLevel ?? 0;
  
  // Always recalculate total points from prestige level
  // This ensures old saves (with 1 point per level) get updated
  const recalculatedPoints = getTotalPrestigePointsForLevel(prestigeLevel);
  
  // Handle legacy format with spentPrestigePoints
  if ('spentPrestigePoints' in saved || 'availablePrestigePoints' in saved) {
    console.log('[Prestige Migration] Old format detected, recalculating points');
  }
  
  // If stored points differ from recalculated, log the migration
  if (saved.totalPrestigePoints !== recalculatedPoints && prestigeLevel > 0) {
    console.log(`[Prestige Migration] Points updated: ${saved.totalPrestigePoints ?? 0} → ${recalculatedPoints}`);
  }
  
  return {
    prestigeLevel,
    prestigeXP: saved.prestigeXP ?? 0,
    totalPrestigePoints: recalculatedPoints,
  };
}
```

**Update `awardPrestigeXP()` to use variable points:**

```typescript
const awardPrestigeXP = useCallback((amount: number): PrestigeXPResult => {
  if (!isMaxLevel) {
    return { type: 'normal', amount };
  }

  let newPrestigeXP = prestigeData.prestigeXP + amount;
  let newPrestigeLevel = prestigeData.prestigeLevel;
  let totalPointsAwarded = 0;

  // Loop to handle multiple level-ups from large XP gains
  while (newPrestigeXP >= PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL) {
    newPrestigeXP -= PRESTIGE_CONFIG.XP_PER_PRESTIGE_LEVEL;
    newPrestigeLevel++;
    // Use variable points per level instead of fixed
    totalPointsAwarded += getPrestigePointsForLevel(newPrestigeLevel);
  }

  // ... rest unchanged
}, [isMaxLevel, prestigeData.prestigeLevel, prestigeData.prestigeXP]);
```

---

### 4. Bump Save Version

**File:** `src/hooks/use-auto-save.ts`

Change version constant:

```typescript
const CURRENT_VERSION = 2; // Was 1, now 2 for new point formulas
```

Add migration logging in `loadAutoSave()`:

```typescript
if (data.version !== CURRENT_VERSION) {
  console.log('[AutoSave] Migrating from version', data.version, 'to', CURRENT_VERSION);
  // Character points auto-migrate via formula
  // Prestige points migrate via usePrestige hook
}
```

---

### 5. Consolidate XP Thresholds (DRY)

**File:** `src/lib/resetApp.ts`

Replace duplicated thresholds with import:

```typescript
import { DEFAULT_XP_THRESHOLDS } from './xpSystem';

export function repairXPData(currentLevel: number, currentXP: number, multiplier: number = 1.0): number {
  const minXPForLevel = Math.floor((DEFAULT_XP_THRESHOLDS[currentLevel] || 0) * multiplier);
  
  if (currentXP < minXPForLevel) {
    console.log(`[XP Repair] XP ${currentXP} is below minimum ${minXPForLevel} for level ${currentLevel}. Repairing...`);
    return minXPForLevel;
  }
  
  return currentXP;
}
```

---

## XP Threshold Decision

**Decision: Keep D&D 5e thresholds** (current implementation)

**Rationale:**
- D&D 5e thresholds are well-tested and familiar to players
- XP is for leveling progression, ability points are the reward
- Changing XP thresholds would require more extensive testing
- Current thresholds already work with the existing repairXPData logic

---

## Edge Cases

| Case | Handling |
|------|----------|
| Level 0 | Return 0 points |
| Level < 1 | Return 0 points |
| Level > 20 | Cap at 20 (74 points) |
| Prestige 0 | Return 0 points (no levels completed) |
| Prestige > 10 | Return 3 points per level (fallback) |
| Negative XP | Already guarded with `Math.max(0, ...)` |

---

## Testing Criteria

### New Character Tests
1. Create new character at Level 1 → verify 5 ability points
2. Level up to 5 → verify 14 total points
3. Level up to 10 → verify 29 total points
4. Level up to 20 → verify 74 total points

### Existing Character Migration Tests
5. Load Level 10 character (old save) → verify points auto-recalculate to 29
6. Load Prestige 5 character (old save) → verify prestige points recalculate to 12
7. Load Level 10 + Prestige 5 character → verify total = 29 + 12 = 41

### Prestige Level-Up Tests
8. At max level, gain prestige 1 → verify +3 points (not +1)
9. Gain prestige 5 → verify cumulative 12 points total
10. Gain prestige 10 → verify +5 points for that level

### Point Spending Tests
11. Spend points in Character Tab → available decreases
12. Spend points in Legacy Tab → same pool decreases
13. Cannot spend more than available (button disabled)

### Data Persistence Tests
14. Refresh page → all data persists correctly
15. Check console for migration logs on first load after update

---

## Implementation Order

1. **`src/lib/prestige/config.ts`** - Add `getPrestigePointsForLevel()` and `getTotalPrestigePointsForLevel()`
2. **`src/hooks/use-prestige.ts`** - Update migration + `awardPrestigeXP()` to use new functions
3. **`src/lib/types.ts`** - Update `getAbilityPointsForLevel()` formula
4. **`src/hooks/use-auto-save.ts`** - Bump version to 2
5. **`src/lib/resetApp.ts`** - Import XP thresholds from xpSystem
6. **Test all scenarios**

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Existing characters get more points | **Intended** - formula recalculates automatically |
| Points go negative | Already guarded with `Math.max(0, ...)` |
| XP/Level mismatch | `repairXPData()` corrects on load |
| Prestige points mismatch | Migration function recalculates from level |
| Double-counting spent points | Spent points are preserved separately |

---

## Files NOT Modified

These already work correctly with the unified pool:

- `AbilitiesScreen.tsx` - Uses `availableAbilityPoints` prop
- `MobilePrestigeHeader.tsx` - Uses `availableAbilityPoints` prop
- `PrestigeAbilityDetails.tsx` - Unlock logic unchanged
- `XPTracker.tsx` - XP display unchanged
- `use-prestige-tree.ts` - Tier validation unchanged
- `CharacterHeader.tsx` - Displays calculated values
