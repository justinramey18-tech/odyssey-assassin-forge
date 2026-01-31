
# Fix Plan: Prestige Ability Point Validation & Negative Value Prevention

## Problem Summary

The `unlockAbility` function in `use-prestige-tree.ts` has a **critical validation flaw**:

1. It calls `onPrestigePointSpent(cost)` which triggers `spendPrestigePoint(cost)`
2. **BUT** it ignores the return value from `spendPrestigePoint`
3. Even if spending fails (insufficient points), it proceeds to mark the ability as unlocked
4. This causes state desynchronization and potential negative point values from race conditions

### Current Broken Architecture

```
onPrestigePointSpent: (cost: number) => spendPrestigePoint(cost)
                                        ↑
                           Returns { success: boolean; message?: string }
                           BUT THIS RETURN VALUE IS LOST!
```

The callback in Index.tsx line 113:
```typescript
(cost: number) => spendPrestigePoint(cost)  // Return value discarded
```

And in `unlockAbility` line 212-214:
```typescript
if (onPrestigePointSpent) {
  onPrestigePointSpent(ability.prestigeCost);  // No return capture
}
```

---

## Solution Overview

### Step 1: Change Callback Type Signature

Update `onPrestigePointSpent` to return the spend result instead of void.

**File:** `src/hooks/use-prestige-tree.ts`

**Change type signature (line 77):**
```typescript
// Before
onPrestigePointSpent?: (cost: number) => void,

// After  
onPrestigePointSpent?: (cost: number) => { success: boolean; message?: string },
```

---

### Step 2: Fix `unlockAbility` to Check Return Value

**File:** `src/hooks/use-prestige-tree.ts`

**Replace lines 201-227:**
```typescript
// Unlock ability
const unlockAbility = useCallback((abilityId: string): { success: boolean; error?: string } => {
  const check = canUnlockAbility(abilityId);
  if (!check.canUnlock) {
    return { success: false, error: check.reason };
  }

  const ability = getPrestigeAbilityById(abilityId)!;
  
  // FIRST: Attempt to deduct prestige points from main system
  if (onPrestigePointSpent) {
    const spendResult = onPrestigePointSpent(ability.prestigeCost);
    
    // If spending failed, abort the unlock entirely
    if (!spendResult.success) {
      return { 
        success: false, 
        error: spendResult.message || 'Insufficient prestige points' 
      };
    }
  }

  // ONLY update local progress if point deduction succeeded
  setProgress(prev => ({
    ...prev,
    unlockedAbilities: [...prev.unlockedAbilities, abilityId],
    unlockTimestamps: {
      ...prev.unlockTimestamps,
      [abilityId]: Date.now(),
    },
  }));

  return { success: true };
}, [canUnlockAbility, onPrestigePointSpent]);
```

---

### Step 3: Update Index.tsx Callback to Return Result

**File:** `src/pages/Index.tsx`

**Replace line 113:**
```typescript
// Before
(cost: number) => spendPrestigePoint(cost),

// After
(cost: number) => spendPrestigePoint(cost),  // spendPrestigePoint already returns { success, message }
```

No change needed here - `spendPrestigePoint` already returns the right type, but we need to ensure the callback captures it.

**Full replacement for lines 110-115:**
```typescript
const prestigeTree = usePrestigeTree(
  character.abilities, 
  prestigeData, 
  (cost: number) => {
    // Return the result so unlockAbility can check if spending succeeded
    return spendPrestigePoint(cost);
  },
  character.level
);
```

---

### Step 4: Add Defensive Guards Against Negative Values

**File:** `src/hooks/use-prestige.ts`

**Update `spendPrestigePoint` (lines 144-156) to add Math.max guard:**
```typescript
const spendPrestigePoint = useCallback((cost: number = 1): { success: boolean; message?: string } => {
  // Validate cost is positive
  if (cost <= 0) {
    return { success: false, message: 'Invalid cost' };
  }
  
  if (prestigeData.availablePrestigePoints < cost) {
    return { success: false, message: `Need ${cost} prestige points, only have ${prestigeData.availablePrestigePoints}` };
  }

  setPrestigeData(prev => ({
    ...prev,
    spentPrestigePoints: prev.spentPrestigePoints + cost,
    // Defensive guard: ensure we never go negative
    availablePrestigePoints: Math.max(0, prev.availablePrestigePoints - cost),
  }));

  return { success: true };
}, [prestigeData.availablePrestigePoints]);
```

---

## Technical Details

### Data Flow After Fix

```
User clicks "Unlock" button
       │
       ▼
PrestigeTreeScreen.handleUnlock(abilityId)
       │
       ▼
usePrestigeTree.unlockAbility(abilityId)
       │
       ├──► canUnlockAbility() check passes
       │
       ▼
onPrestigePointSpent(cost)
       │
       ▼
spendPrestigePoint(cost)
       │
       ├──► Returns { success: true } ───► setProgress() updates unlocked list
       │                                        │
       │                                        ▼
       │                               Return { success: true }
       │
       └──► Returns { success: false } ───► ABORT: Don't update progress
                                                    │
                                                    ▼
                                           Return { success: false, error: message }
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/use-prestige-tree.ts` | Update callback type, fix `unlockAbility` to check return value |
| `src/hooks/use-prestige.ts` | Add `Math.max(0, ...)` guard, validate cost > 0 |
| `src/pages/Index.tsx` | Ensure callback returns `spendPrestigePoint` result |

---

## Verification Checklist

After implementation, verify:
- [ ] Unlocking an ability with sufficient points succeeds and deducts once
- [ ] Unlocking an ability with insufficient points fails with error message
- [ ] Available prestige points never go negative
- [ ] Rapid button clicks don't cause multiple deductions (existing `isUnlocking` guard)
- [ ] UI correctly reflects point changes in real-time
- [ ] Already-unlocked abilities cannot be unlocked again
