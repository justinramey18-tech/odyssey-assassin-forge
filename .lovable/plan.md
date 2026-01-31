

# Make the Notepads Talk to Each Other

## The Problem (Simple Terms)

Right now there are two "notepads" that should be tracking the same thing, but they're not communicating:

- **Notepad A**: Tracks how many points you've spent (used to calculate "Available Ability Points")
- **Notepad B**: Actually handles unlocking abilities in the Legacy tab

When you unlock an ability, Notepad B writes it down but never tells Notepad A. So "Available Ability Points" stays stale until you refresh the page.

## The Solution

Connect the notepads with a simple callback - when Notepad B unlocks an ability, it immediately tells Notepad A "hey, deduct X points!"

---

## Technical Changes

### File: `src/pages/Index.tsx`

**Change 1: Add a state variable to track Legacy tab spending**

Around line 100, add:
```typescript
const [prestigeTreeSpentState, setPrestigeTreeSpentState] = useState(() => {
  const stored = localStorage.getItem('odyssey-prestige-tree');
  if (stored) {
    try {
      const progress = JSON.parse(stored);
      return (progress.unlockedAbilities || []).reduce((sum, abilityId) => {
        const ability = getPrestigeAbilityById(abilityId);
        return sum + (ability?.prestigeCost ?? 0);
      }, 0);
    } catch { return 0; }
  }
  return 0;
});
```

**Change 2: Create the callback that connects the notepads**

```typescript
const handlePrestigeTreePointsSpent = useCallback((cost: number) => {
  setPrestigeTreeSpentState(prev => prev + cost);
}, []);
```

**Change 3: Use state-managed spending in calculations**

Update line 126-129:
```typescript
const spentAbilityPoints = useMemo(() => {
  const baseSpent = getTotalPointsSpent(character.abilities);
  return baseSpent + prestigeTreeSpentState;  // Use reactive state instead
}, [character.abilities, prestigeTreeSpentState]);
```

**Change 4: Add guard clause for negative values**

Update line 131:
```typescript
const availableAbilityPoints = Math.max(0, totalAbilityPoints - spentAbilityPoints);
```

**Change 5: Use single hook instance with callback connected**

Replace lines 110-140 (both hook instances) with one:
```typescript
const prestigeTree = usePrestigeTree(
  character.abilities, 
  prestigeData, 
  availableAbilityPoints,
  handlePrestigeTreePointsSpent,  // ← Connect the callback!
  character.level
);
```

**Change 6: Update reset handler**

In `handleResetApp`, add:
```typescript
setPrestigeTreeSpentState(0);
```

**Change 7: Update all references**

Replace `actualPrestigeTree` → `prestigeTree` throughout the file.

---

## What Happens After the Fix

```
You click "Unlock for 3 Points"
         ↓
Legacy tab unlocks the ability
         ↓
Callback fires: "Hey, 3 points were spent!"
         ↓
Spending state updates: 10 → 7
         ↓
React recalculates: available = total - spent
         ↓
UI instantly shows new balance ✓
```

---

## Files Modified

| File | What Changes |
|------|--------------|
| `src/pages/Index.tsx` | Connect callback, consolidate to single hook, add guard clause |

No changes needed to `use-prestige-tree.ts` - it already supports the callback!

---

## Testing Checklist

1. Open Legacy tab, note "Available Ability Points"
2. Unlock an ability costing 3 points
3. Verify the number drops by exactly 3 immediately (no refresh needed)
4. Switch to Skills tab - verify same number shown
5. Try to unlock something you can't afford - button should be disabled
6. Refresh page - verify numbers persist correctly

