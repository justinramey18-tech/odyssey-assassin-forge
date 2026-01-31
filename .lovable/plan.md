
# Unified Ability Point System Refactor - Final Plan

## Overview

This refactor consolidates the ability point system by:
1. **Merging regular ability points and prestige points** into a single unified currency
2. **Removing all level-up and spending modals** - points are spent directly in tabs
3. **Changing prestige XP to fixed 5,000 per level** with infinite level cap
4. **Updating UI** to show "X points available" instead of spent fractions

---

## Architecture Diagram

```text
                        UNIFIED ABILITY POINTS
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │  totalAbilityPoints = basePoints + prestigePoints       │
    │                                                         │
    │  Sources:                                               │
    │    - Levels 1-20: getAbilityPointsForLevel(level)       │
    │    - Prestige Levels: 1 point per prestige level        │
    │                                                         │
    │  Spent:                                                 │
    │    - Base Trees: getTotalPointsSpent(abilities)         │
    │    - Legacy Tree: SUM of prestigeCost for unlocked      │
    │                                                         │
    │  availableAbilityPoints = total - spent                 │
    └─────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │  Abilities Tab  │             │   Legacy Tab    │
    │  (Base Trees)   │             │ (Drizzt Legacy) │
    │                 │             │                 │
    │  Click (+) on   │             │  Click node to  │
    │  ability node   │             │  unlock ability │
    │  to upgrade     │             │  (costs 2-12)   │
    └─────────────────┘             └─────────────────┘
```

---

## Files Summary

### Files to Modify
| File | Action | Purpose |
|------|--------|---------|
| `src/lib/prestige/config.ts` | Modify | Linear 5k XP, infinite level cap |
| `src/lib/prestige/types.ts` | Modify | Remove dual-point tracking fields |
| `src/hooks/use-prestige.ts` | Major Modify | Remove point spending, simplify to XP/level only, carry overflow |
| `src/hooks/use-prestige-tree.ts` | Modify | Accept unified points, fix spent calculation (variable costs) |
| `src/lib/prestigeTree/types.ts` | Minor | Keep spentPrestigePoints for tracking tree spending |
| `src/pages/Index.tsx` | Major Modify | Remove modals, add unified point calculation, auto-level with toasts |
| `src/components/abilities/AbilitiesScreen.tsx` | Minor | Already correct - uses `availablePoints` prop |

### Files to Delete
| File | Reason |
|------|--------|
| `src/components/character/LevelUpModal.tsx` | No longer needed |
| `src/components/character/AbilityTreeAccordion.tsx` | Only used by LevelUpModal |
| `src/components/prestige/PrestigeLevelUpModal.tsx` | Replaced by toast |
| `src/components/prestige/PrestigePointCounter.tsx` | No separate pools |

---

## Detailed Implementation

### 1. Prestige Config - Linear XP, No Cap

**File:** `src/lib/prestige/config.ts`

Changes:
- Replace `BASE_PRESTIGE_XP: 5000` and `XP_SCALING_FACTOR: 1.5` with `XP_PER_PRESTIGE_LEVEL: 5000`
- Set `MAX_PRESTIGE_LEVEL: Infinity`
- Update `getPrestigeXPRequired()` to always return 5000
- Update `getPrestigeProgress()` to use fixed 5000 denominator

---

### 2. Simplify Prestige Types

**File:** `src/lib/prestige/types.ts`

Remove from PrestigeData:
- `spentPrestigePoints` - no longer tracked at prestige level
- `availablePrestigePoints` - calculated at unified level

Keep:
- `prestigeLevel`
- `prestigeXP`
- `totalPrestigePoints`

Update `DEFAULT_PRESTIGE_DATA` accordingly.

---

### 3. Simplify usePrestige Hook (Critical Fixes)

**File:** `src/hooks/use-prestige.ts`

**Remove functions:**
- `spendPrestigePoint()` - handled at unified level
- `resetPrestigePoints()` - no longer applicable

**Fix awardPrestigeXP - Carry Overflow XP:**
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
    totalPointsAwarded += PRESTIGE_CONFIG.POINTS_PER_PRESTIGE;
  }

  if (totalPointsAwarded > 0) {
    setPrestigeData(prev => ({
      ...prev,
      prestigeLevel: newPrestigeLevel,
      prestigeXP: newPrestigeXP,
      totalPrestigePoints: prev.totalPrestigePoints + totalPointsAwarded,
    }));

    return { 
      type: 'prestige_levelup', 
      newLevel: newPrestigeLevel,
      pointsAwarded: totalPointsAwarded,
    };
  } else {
    setPrestigeData(prev => ({
      ...prev,
      prestigeXP: newPrestigeXP,
    }));
    return { type: 'prestige_xp', amount };
  }
}, [isMaxLevel, prestigeData.prestigeLevel, prestigeData.prestigeXP]);
```

---

### 4. Fix Prestige Tree Hook - Variable Costs (Critical)

**File:** `src/hooks/use-prestige-tree.ts`

**Issue:** Current code assumes 1 point per unlock, but abilities cost 2-12 points.

**Fix spent calculation:**
```typescript
// Import ability lookup
import { getPrestigeAbilityById } from '@/lib/prestigeTree/abilities';

// Fix spent calculation
const spentOnTree = useMemo(() => {
  return progress.unlockedAbilities.reduce((sum, abilityId) => {
    const ability = getPrestigeAbilityById(abilityId);
    return sum + (ability?.prestigeCost ?? 0);
  }, 0);
}, [progress.unlockedAbilities]);
```

**Update canUnlockAbility to accept unified points:**
```typescript
// Add parameter for unified points
export function usePrestigeTree(
  characterAbilities: CharacterAbility[],
  prestigeData: PrestigeData,
  availableUnifiedPoints: number,  // NEW: unified pool
  onPointsSpent?: (cost: number) => void,  // Simplified callback
  characterLevel?: number
): UsePrestigeTreeReturn {
  // Update validation to use unified points
  const canUnlockAbility = useCallback((abilityId: string) => {
    // ... existing checks ...
    
    if (availableUnifiedPoints < ability.prestigeCost) {
      const needed = ability.prestigeCost - availableUnifiedPoints;
      return { 
        canUnlock: false, 
        reason: `Need ${needed} more ability point${needed === 1 ? '' : 's'}` 
      };
    }
    
    // ... rest of checks ...
  }, [unlockedSet, prestigeData.prestigeLevel, availableUnifiedPoints, isLegacyUnlocked]);
}
```

---

### 5. Major Index.tsx Refactor

**File:** `src/pages/Index.tsx`

#### A. Remove State Variables
```typescript
// DELETE these state declarations
const [showLevelUpModal, setShowLevelUpModal] = useState(false);
const [showPrestigeSpendModal, setShowPrestigeSpendModal] = useState(false);
const [levelUpPointsToSpend, setLevelUpPointsToSpend] = useState(0);
const [pendingLevelUps, setPendingLevelUps] = useState(0);
const [showPrestigeLevelUp, setShowPrestigeLevelUp] = useState(false);
const [prestigeLevelUpData, setPrestigeLevelUpData] = useState(null);
```

#### B. Add Unified Point Calculation
```typescript
// Calculate spent on prestige tree (with variable costs)
const prestigeTreeSpent = useMemo(() => {
  return prestigeTree.progress.unlockedAbilities.reduce((sum, abilityId) => {
    const ability = getPrestigeAbilityById(abilityId);
    return sum + (ability?.prestigeCost ?? 0);
  }, 0);
}, [prestigeTree.progress.unlockedAbilities]);

// Unified point calculation
const totalAbilityPoints = useMemo(() => {
  const basePoints = getAbilityPointsForLevel(character.level);
  const prestigePoints = prestigeData.totalPrestigePoints;
  return basePoints + prestigePoints;
}, [character.level, prestigeData.totalPrestigePoints]);

const spentAbilityPoints = useMemo(() => {
  const baseSpent = getTotalPointsSpent(character.abilities);
  return baseSpent + prestigeTreeSpent;
}, [character.abilities, prestigeTreeSpent]);

const availableAbilityPoints = totalAbilityPoints - spentAbilityPoints;
```

#### C. Update handleAddXP - Auto-Level with Toasts
```typescript
const handleAddXP = (amount: number, source?: string) => {
  // ... existing validation ...

  if (isMaxLevel) {
    // Route to prestige
    const result = awardPrestigeXP(amount);
    if (result.type === 'prestige_levelup') {
      // Toast instead of modal
      toast({
        title: "🌟 Prestige Level Up!",
        description: `Reached Prestige Level ${result.newLevel}. +${result.pointsAwarded} Ability Point${result.pointsAwarded > 1 ? 's' : ''} earned.`,
        className: "border-amber-500 bg-amber-500/10",
      });
      
      // Milestone toast every 10 levels
      if (result.newLevel % 10 === 0) {
        toast({
          title: `🏆 Prestige Milestone: Level ${result.newLevel}!`,
          description: "You are becoming a legend...",
          className: "border-purple-500 bg-purple-500/10",
        });
      }
    } else {
      toast({
        title: `+${amount} Prestige XP`,
        description: source ?? "Experience earned",
      });
    }
    return;
  }

  // Regular leveling - auto-apply
  const newXP = currentXP + amount;
  setCurrentXP(newXP);

  const levelsToGain = calculatePendingLevelUps(character.level, newXP, multiplier);

  if (levelsToGain > 0) {
    const newLevel = character.level + levelsToGain;
    const xpAfterLevelUp = newXP - getXPForLevel(newLevel - 1);

    // Auto-level immediately (no modal)
    setCharacter(prev => ({
      ...prev,
      level: newLevel,
    }));
    setCurrentXP(xpAfterLevelUp);

    toast({
      title: `⚡ Level Up!`,
      description: `${character.name} is now Level ${newLevel}!`,
      className: "border-primary bg-primary/10",
    });
  } else {
    toast({
      title: `+${amount} XP`,
      description: source ?? "Experience earned",
    });
  }
};
```

#### D. Update handleUpgradeAbility - Direct Spending
```typescript
const handleUpgradeAbility = (abilityId: string) => {
  // Simple unified check
  if (availableAbilityPoints <= 0) {
    toast({
      title: "No Points Available",
      description: "Level up or earn prestige levels to get more ability points.",
      variant: "destructive",
    });
    return;
  }

  // Check ability-specific requirements
  const ability = allAbilities.find(a => a.id === abilityId);
  if (!ability) return;

  const currentTier = character.abilities.find(ca => ca.abilityId === abilityId)?.currentTier ?? 0;
  if (currentTier >= 3) return;

  // Check prerequisite
  if (ability.prerequisite) {
    const prereqTier = character.abilities.find(
      ca => ca.abilityId === ability.prerequisite!.abilityId
    )?.currentTier ?? 0;
    if (prereqTier < ability.prerequisite.tier) {
      toast({
        title: "Prerequisite Not Met",
        description: `Requires ${ability.prerequisite.abilityId} at tier ${ability.prerequisite.tier}`,
        variant: "destructive",
      });
      return;
    }
  }

  // Perform upgrade
  setCharacter(prev => ({
    ...prev,
    abilities: prev.abilities.map(ca =>
      ca.abilityId === abilityId && ca.currentTier < 3
        ? { ...ca, currentTier: (ca.currentTier + 1) as 0 | 1 | 2 | 3 }
        : ca
    ),
  }));

  toast({
    title: "✨ Ability Upgraded",
    description: `${ability.name} upgraded to tier ${currentTier + 1}`,
    duration: 2000,
  });
};
```

#### E. Update usePrestigeTree Call
```typescript
const prestigeTree = usePrestigeTree(
  character.abilities,
  prestigeData,
  availableAbilityPoints,  // Pass unified points
  (cost: number) => {
    // Simple deduction callback (no return needed)
    // Points are already validated in canUnlockAbility
  },
  character.level
);
```

#### F. Remove Modal Components from JSX
Delete these sections:
- `<LevelUpModal open={showLevelUpModal} ...>` (lines 655-664)
- `<LevelUpModal open={showPrestigeSpendModal} ...>` (lines 667-679)
- `<PrestigeLevelUpModal ...>` (lines 681-692)
- `<PrestigePointCounter ...>` (if present)

#### G. Update AbilitiesScreen Call
```typescript
<AbilitiesScreen
  character={character}
  availablePoints={availableAbilityPoints}  // Unified points
  // Remove prestigePoints prop if separate
  onUpgradeAbility={handleUpgradeAbility}
  onDowngradeAbility={handleDowngradeAbility}
  onEquipAbility={handleEquipAbility}
  onBack={() => setActiveTab('skills')}
/>
```

---

### 6. Legacy Tab Access Guard

**In Index.tsx tab content rendering:**

```typescript
{activeTab === 'legacy' && (
  prestigeTree.isLegacyUnlocked ? (
    <PrestigeTreeScreen
      prestigeTree={prestigeTree}
      availablePoints={availableAbilityPoints}
      onUnlock={(abilityId) => prestigeTree.unlockAbility(abilityId)}
    />
  ) : (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
      <Lock className="w-16 h-16 text-amber-500/50 mb-4" />
      <h2 className="text-2xl font-display font-bold text-amber-400 mb-2">
        Drizzt's Legacy Locked
      </h2>
      <p className="text-muted-foreground max-w-md">
        Master all 72 base ability tiers to unlock the path of the legendary ranger.
      </p>
      <div className="mt-4 text-sm text-amber-300">
        Progress: {getTotalPointsSpent(character.abilities)} / 72 points spent
      </div>
    </div>
  )
)}
```

---

### 7. Data Migration

Add migration function to handle existing saves:

```typescript
// In data loading (loadAutoSave or useAutoSave)
function migratePrestigeData(saved: any): PrestigeData {
  // Old format had spentPrestigePoints and availablePrestigePoints
  // New format only tracks totalPrestigePoints
  if ('spentPrestigePoints' in saved || 'availablePrestigePoints' in saved) {
    return {
      prestigeLevel: saved.prestigeLevel ?? 0,
      prestigeXP: saved.prestigeXP ?? 0,
      totalPrestigePoints: saved.totalPrestigePoints ?? saved.prestigeLevel ?? 0,
    };
  }
  return saved;
}
```

---

## What NOT to Change

These items remain unchanged:
- **72-point unlock** for Legacy tab (`LEGACY_UNLOCK_THRESHOLD`)
- **3-tier ability structure** (Foundation/Intermediate/Advanced)
- **Prerequisite logic** between abilities
- **XP Progression Widget** (Slow/Natural/Fast Track modes)
- **Visual design** of ability nodes and trees
- **Ability effects** and descriptions
- **Character level cap of 20** for base D&D progression
- **Prestige tree unlock conditions** (game mode dependent)
- **AbilitiesScreen layout and styling** (already shows "Available: X")

---

## XP Flow After Changes

```text
User earns XP
     │
     ▼
handleAddXP(amount)
     │
     ├── Level < 20: currentXP += amount
     │        │
     │        ▼
     │   shouldLevelUp()?
     │        │
     │   YES: character.level++ (immediate)
     │        toast("Level Up! Now Level X")
     │
     └── Level = 20: awardPrestigeXP(amount)
              │
              ▼
         prestigeXP += amount
              │
              ▼
         while (prestigeXP >= 5000):
              prestigeLevel++
              prestigeXP -= 5000
              totalPrestigePoints++
              │
              ▼
         toast("Prestige Level Up!")
```

---

## Testing Checklist

After implementation, verify:
- [ ] Leveling from 1-20 shows toast and auto-applies level (no modal)
- [ ] Points from leveling visible in Abilities tab header
- [ ] Clicking (+) on ability node spends point directly with toast feedback
- [ ] Reaching level 20 routes XP to prestige system
- [ ] Prestige XP requires exactly 5,000 per level (fixed, not scaling)
- [ ] Earning 12k XP at once awards 2 prestige levels (overflow handling)
- [ ] Prestige level-up shows toast, awards 1 point per level
- [ ] Prestige levels have no cap (can go to 100+)
- [ ] Points spent in Legacy tab reduce same counter as Abilities tab
- [ ] Unlocking a 5-cost prestige ability deducts 5 from unified pool
- [ ] "X points available" header updates immediately after any spend
- [ ] Legacy tab locked until 72 base points spent (shows progress)
- [ ] Clicking upgrade when 0 points shows "No Points Available" toast
- [ ] Existing saves load correctly with migration (no data loss)
- [ ] No console errors from deleted modal components

