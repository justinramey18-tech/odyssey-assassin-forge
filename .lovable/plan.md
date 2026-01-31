
# Fix Plan: Prestige Upgrade Modal Not Updating Abilities

## Problem Summary

When clicking the (+) button in the **Prestige Upgrade modal** (the `LevelUpModal` in prestige mode), abilities are not being upgraded because the `handleUpgradeAbility` function has a guard that blocks the upgrade.

### Current Flow (Broken)

```
User clicks (+) on "Ring of Chaos"
       ↓
LevelUpModal.handleUpgrade() calls:
  1. onSpendPrestigePoint() → Points deducted ✅
  2. onUpgradeAbility() → handleUpgradeAbility()
       ↓
handleUpgradeAbility checks:
  • remainingPoints <= 0 → TRUE (72/72 base points spent)
  • !showLevelUpModal → TRUE (prestige modal is open, not level-up modal)
       ↓
EARLY RETURN - Ability never upgraded ❌
```

### Root Cause

Line 287 in `src/pages/Index.tsx`:
```typescript
if (remainingPoints <= 0 && !showLevelUpModal) return;
```

This guard was designed to prevent upgrades when:
- No regular ability points remain
- Not in the level-up flow

But it fails to account for the **Prestige Spend Modal**, which uses the same `handleUpgradeAbility` callback but with `showPrestigeSpendModal` open instead.

---

## Solution

Update the guard in `handleUpgradeAbility` to also allow upgrades when the prestige spend modal is open.

### File: `src/pages/Index.tsx`

**Change line 287:**
```typescript
// Before
if (remainingPoints <= 0 && !showLevelUpModal) return;

// After
if (remainingPoints <= 0 && !showLevelUpModal && !showPrestigeSpendModal) return;
```

This single-line fix allows ability upgrades to proceed when either:
- Regular ability points remain (`remainingPoints > 0`)
- Level-up modal is open (`showLevelUpModal === true`)
- Prestige spend modal is open (`showPrestigeSpendModal === true`)

---

## Verification

After the fix:
1. Open the Prestige Upgrade modal (via header or settings)
2. Click (+) on any ability (e.g., "Ring of Chaos")
3. Verify:
   - Tier indicators update (●●○ → ●●●)
   - Points remaining counter decreases
   - Ability card styling reflects the upgrade
4. Click Confirm to save changes
