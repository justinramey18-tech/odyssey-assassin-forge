# Unified XP/Leveling/Ability Points System

## Status: ✅ IMPLEMENTED

All changes from the approved plan have been implemented.

---

## Summary of Changes Made

| File | Change | Status |
|------|--------|--------|
| `src/lib/types.ts` | New tiered ability points formula (5→74 points, Level 1-20) | ✅ Done |
| `src/lib/prestige/config.ts` | Added `getPrestigePointsForLevel()` and `getTotalPrestigePointsForLevel()` | ✅ Done |
| `src/hooks/use-prestige.ts` | Updated migration to recalculate points + use variable prestige rewards | ✅ Done |
| `src/hooks/use-auto-save.ts` | Bumped version to 2 with migration logging | ✅ Done |
| `src/lib/resetApp.ts` | Imports XP thresholds from xpSystem (DRY) | ✅ Done |

---

## New Ability Points Formula

```
Level 1: 5 points (starting)
Level 2: +3 → 8 total
Levels 3-5: +2 each → 14 total at Level 5
Levels 6-10: +3 each → 29 total at Level 10
Levels 11-15: +4 each → 49 total at Level 15
Levels 16-20: +5 each → 74 total at Level 20
```

---

## New Prestige Points Formula

```
Level 1: 3 points
Levels 2-4: 2 points each
Level 5: 3 points
Levels 6-7: 2 points each
Levels 8-9: 3 points each
Level 10: 5 points
Levels 11+: 3 points each
```

Cumulative at Prestige 5: 12 points
Cumulative at Prestige 10: 26 points

---

## Migration Behavior

1. **Character level points**: Auto-recalculate via `getAbilityPointsForLevel()` formula (no stored data to migrate)
2. **Prestige points**: Recalculated from prestige level via `getTotalPrestigePointsForLevel()` on load
3. **Spent points**: Preserved as-is (stored separately)
4. **Save version**: Bumped to 2 with console logging for debugging

---

## Testing Checklist

- [ ] New character at Level 1 → 5 ability points
- [ ] Level 5 character → 14 total points
- [ ] Level 10 character → 29 total points
- [ ] Level 20 character → 74 total points
- [ ] Prestige 1 level-up → +3 points
- [ ] Prestige 5 total → 12 points
- [ ] Prestige 10 total → 26 points
- [ ] Existing save loads with recalculated points
- [ ] Console shows migration logs
- [ ] Points persist after page refresh
