
# Plan: Sync Gear Unlock Progress with Feats Tab Values

## Problem

Currently, the gear unlock system (`useGearLock`, `EquipmentSlotCard`, `ConstellationMap`) uses the static `achievementCategories` array from `src/lib/achievements.ts` instead of the live `achievements` state managed in `Index.tsx`. This means:

- Progress made in the Feats tab doesn't update the unlock progress bars in Gear/Stars tabs
- Items don't automatically unlock when feat requirements are met
- Star nodes in the constellation don't reflect current achievement progress

## Solution

Thread the live `achievements` state from `Index.tsx` through all components that need it:

1. **InventoryScreen** - already receives `achievements` prop but needs to pass to child components
2. **ConstellationScreen** - needs to receive `achievements` as a prop
3. **ConstellationMap** - needs to use passed achievements instead of static array
4. **useGearLock** - already accepts `achievements` param, just needs correct data

---

## Changes

### 1. Update ConstellationScreen to Accept Achievements
**File:** `src/components/constellation/ConstellationScreen.tsx`

- Add `achievements` prop to interface
- Pass achievements to `ConstellationMap`

### 2. Update ConstellationMap to Use Live Achievements
**File:** `src/components/constellation/ConstellationMap.tsx`

- Add `achievements` prop to interface
- Replace static `achievementCategories` lookups with the passed `achievements` array
- This ensures progress bars and unlock states reflect real-time feat values

### 3. Update Index.tsx to Pass Achievements to Stars Tab
**File:** `src/pages/Index.tsx`

- Pass `achievements` state to `ConstellationScreen`

### 4. Ensure InventoryScreen Passes Achievements to useGearLock
**File:** `src/components/inventory/InventoryScreen.tsx`

- Already receives `achievements` prop and passes to `useGearLock` (confirmed working)
- Verify the hook dependency array includes achievements for reactivity

---

## Data Flow After Changes

```text
Index.tsx (achievements state)
     |
     +---> AchievementsScreen (updates achievements)
     |           |
     |           v
     |     [User increments feat progress]
     |           |
     |           v
     +---> InventoryScreen(achievements)
     |           |
     |           +---> useGearLock(achievements)
     |           |           |
     |           |           v
     |           |     [isItemLocked checks live progress]
     |           |
     |           +---> EquipmentSlotCard(lockInfo)
     |                       |
     |                       v
     |                 [Progress bar shows current/required]
     |
     +---> ConstellationScreen(achievements)
                 |
                 +---> ConstellationMap(achievements)
                             |
                             v
                       [Star nodes show live unlock status]
```

---

## Automatic Unlock Behavior

When a user increments an achievement in the Feats tab:
1. `setAchievements()` updates state in Index.tsx
2. React re-renders child components with new `achievements` array
3. `useGearLock` recalculates `isItemLocked` for all items
4. `ConstellationMap` recalculates unlock status for all stars
5. Items that now meet requirements:
   - Show green "Unlocked" badge instead of amber "Locked"
   - Become tappable/equippable in the Gear tab
   - Star nodes illuminate in the Stars tab

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/constellation/ConstellationScreen.tsx` | Add `achievements` prop, pass to ConstellationMap |
| `src/components/constellation/ConstellationMap.tsx` | Accept `achievements` prop, use instead of static array |
| `src/pages/Index.tsx` | Pass `achievements` to ConstellationScreen |

---

## Technical Details

### ConstellationMap Changes

```typescript
// Before
const achievement = prerequisite 
  ? achievementCategories.find(a => a.id === prerequisite.achievementId) 
  : null;

// After
const achievement = prerequisite 
  ? achievements.find(a => a.id === prerequisite.achievementId) 
  : null;
```

### ConstellationScreen Interface Update

```typescript
interface ConstellationScreenProps {
  characterName: string;
  equippedItems: EquipmentItem[];
  achievements: Achievement[];  // NEW
  onBack?: () => void;
}
```

### Index.tsx Stars Tab Update

```typescript
<ConstellationScreen
  characterName={character.name}
  equippedItems={Object.values(equipment.slots).filter(Boolean) as EquipmentItem[]}
  achievements={achievements}  // NEW
  onBack={() => setActiveTab('skills')}
/>
```

---

## User Experience

After implementation:
- **Feats Tab**: User increments "Surviving After 0 HP" from 9 to 10
- **Gear Tab**: "Cuirass of Regenerative Nonsense" lock overlay disappears, item becomes equippable
- **Stars Tab**: The chest star for "Merc with a Mouth" set shows green "Unlocked" badge with full progress bar
- All updates happen instantly with no page refresh needed
