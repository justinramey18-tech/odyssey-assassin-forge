
# Fix Plan: Prestige Ability Double Point Deduction & UI Sync

## Problem Summary

When unlocking a prestige ability, points are deducted **twice** because the `onPrestigePointSpent` callback is invoked in two places:
1. Inside `usePrestigeTree.unlockAbility()` (correct location)
2. Again in `PrestigeTreeScreen.handleUnlock()` (duplicate call)

Additionally, Index.tsx uses an outdated loop pattern instead of passing the cost directly.

---

## Data Flow Analysis

**Current (Broken) Flow:**
```
User clicks "Unlock"
       │
       ▼
PrestigeAbilityDetails.handleUnlock()
       │
       ▼
PrestigeTreeScreen.handleUnlock(abilityId)
       │
       ├──► unlockAbility(abilityId)
       │         │
       │         ├──► Updates local progress (adds ability to unlockedAbilities)
       │         │
       │         └──► Calls onPrestigePointSpent(cost) ← FIRST DEDUCTION
       │
       └──► Calls onPrestigePointSpent(cost) ← SECOND DEDUCTION (DUPLICATE!)
```

**Fixed Flow:**
```
User clicks "Unlock"
       │
       ▼
PrestigeAbilityDetails.handleUnlock()
       │
       ▼
PrestigeTreeScreen.handleUnlock(abilityId)
       │
       └──► unlockAbility(abilityId)
                 │
                 ├──► Updates local progress
                 │
                 └──► Calls onPrestigePointSpent(cost) ← SINGLE DEDUCTION
                              │
                              ▼
                      Index.tsx: spendPrestigePoint(cost)
                              │
                              ▼
                      React re-renders with updated available points
```

---

## Implementation Steps

### Step 1: Remove Duplicate Callback from PrestigeTreeScreen

**File:** `src/components/prestigeTree/PrestigeTreeScreen.tsx`

**Changes:**
1. Remove `onPrestigePointSpent` from the component interface
2. Remove the duplicate callback call from `handleUnlock`
3. Remove `onPrestigePointSpent` from the destructured props

**Before (lines 18-22, 24-28, 54-77):**
```typescript
interface PrestigeTreeScreenProps {
  prestigeTree: UsePrestigeTreeReturn;
  prestigeLevel: number;
  onPrestigePointSpent?: (cost: number) => void;  // REMOVE THIS
}

export function PrestigeTreeScreen({
  prestigeTree,
  prestigeLevel,
  onPrestigePointSpent,  // REMOVE THIS
}: PrestigeTreeScreenProps) {
  ...
  const handleUnlock = useCallback((abilityId: string) => {
    const result = unlockAbility(abilityId);
    if (result.success) {
      ...
      // REMOVE THESE LINES (66-69):
      if (onPrestigePointSpent && ability) {
        onPrestigePointSpent(ability.prestigeCost);
      }
    }
  }, [unlockAbility, prestigeTree, toast, onPrestigePointSpent]);  // REMOVE onPrestigePointSpent
```

**After:**
```typescript
interface PrestigeTreeScreenProps {
  prestigeTree: UsePrestigeTreeReturn;
  prestigeLevel: number;
}

export function PrestigeTreeScreen({
  prestigeTree,
  prestigeLevel,
}: PrestigeTreeScreenProps) {
  ...
  const handleUnlock = useCallback((abilityId: string) => {
    const result = unlockAbility(abilityId);
    if (result.success) {
      const ability = prestigeTree.getAbilityDetails(abilityId);
      toast({
        title: "Ability Unlocked!",
        description: `${ability?.name} is now available.`,
        className: "border-purple-500 bg-purple-500/10",
      });
    } else {
      toast({
        title: "Cannot Unlock",
        description: result.error,
        variant: "destructive",
      });
    }
  }, [unlockAbility, prestigeTree, toast]);
```

---

### Step 2: Remove Prop from Index.tsx Usage

**File:** `src/pages/Index.tsx`

**Changes:**
Remove the `onPrestigePointSpent` prop and its callback function from the `PrestigeTreeScreen` component.

**Before (lines 937-946):**
```typescript
<PrestigeTreeScreen
  prestigeTree={prestigeTree}
  prestigeLevel={prestigeData.prestigeLevel}
  onPrestigePointSpent={(cost) => {
    // Deduct from main prestige point pool
    for (let i = 0; i < cost; i++) {
      spendPrestigePoint();
    }
  }}
/>
```

**After:**
```typescript
<PrestigeTreeScreen
  prestigeTree={prestigeTree}
  prestigeLevel={prestigeData.prestigeLevel}
/>
```

---

### Step 3: Add Double-Click Prevention (Enhancement)

**File:** `src/components/prestigeTree/PrestigeTreeScreen.tsx`

Add a guard state to prevent rapid unlock button clicks from causing race conditions:

```typescript
const [isUnlocking, setIsUnlocking] = useState(false);

const handleUnlock = useCallback((abilityId: string) => {
  if (isUnlocking) return;
  setIsUnlocking(true);
  
  const result = unlockAbility(abilityId);
  
  if (result.success) {
    const ability = prestigeTree.getAbilityDetails(abilityId);
    toast({
      title: "Ability Unlocked!",
      description: `${ability?.name} is now available.`,
      className: "border-purple-500 bg-purple-500/10",
    });
  } else {
    toast({
      title: "Cannot Unlock",
      description: result.error,
      variant: "destructive",
    });
  }
  
  setIsUnlocking(false);
}, [isUnlocking, unlockAbility, prestigeTree, toast]);
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/prestigeTree/PrestigeTreeScreen.tsx` | Remove `onPrestigePointSpent` prop, remove duplicate callback, add double-click guard |
| `src/pages/Index.tsx` | Remove `onPrestigePointSpent` prop from `PrestigeTreeScreen` component |

---

## Technical Details

### Why the Hook Already Handles Point Deduction

In `use-prestige-tree.ts` (lines 200-224), the `unlockAbility` function:

1. Validates the unlock with `canUnlockAbility` 
2. Updates local progress state with `setProgress`
3. Calls the `onPrestigePointSpent` callback passed from Index.tsx

This callback is already connected in Index.tsx (lines 108-113):
```typescript
const prestigeTree = usePrestigeTree(
  character.abilities, 
  prestigeData, 
  (cost: number) => spendPrestigePoint(cost),  // Connected here
  character.level
);
```

So the hook's internal call to `onPrestigePointSpent(cost)` already triggers `spendPrestigePoint(cost)` in the main prestige system.

---

## Verification Checklist

After implementation, verify:
- [ ] Unlocking an ability deducts points **exactly once**
- [ ] Available prestige points update correctly in real-time
- [ ] Ability nodes immediately show "Unlocked" state after unlock
- [ ] Cannot unlock abilities when insufficient points
- [ ] Rapid button clicks don't cause multiple deductions
- [ ] Sheet closes and UI refreshes after unlock
