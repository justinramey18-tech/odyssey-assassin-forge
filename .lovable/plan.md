
# Ability Tree Inversion & AC Odyssey Parent-Child Unlock System

## Summary
Invert the ability tree visual layout (foundation at bottom, ultimate at top) and implement AC Odyssey-style parent-child unlock logic where nodes become accessible when their direct parent(s) have at least 1 point invested.

---

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `src/lib/abilityTrees/layout.ts` | MODIFY | Add `ABILITY_CONNECTIONS` map, `TIER_LABELS`, invert Y coordinates, add `getTierSeparatorY` |
| `src/lib/abilityTrees/accessibility.ts` | CREATE | Parent-child unlock logic |
| `src/lib/abilityTrees/index.ts` | MODIFY | Export accessibility module |
| `src/components/abilities/TierSeparator.tsx` | CREATE | Horizontal tier divider component |
| `src/components/abilities/TreeColumn.tsx` | MODIFY | Use new accessibility logic, render separators |
| `src/components/abilities/AbilityNode.tsx` | MODIFY | Replace props, add unlock animation |
| `src/components/abilities/index.ts` | MODIFY | Export TierSeparator |
| `tailwind.config.ts` | MODIFY | Add unlock animations |

---

## Detailed Changes

### 1. `src/lib/abilityTrees/layout.ts`

**Add parent-child connections map:**
```typescript
// Explicit parent-child connections (AC Odyssey style)
// Empty array = Foundation tier, always accessible
export const ABILITY_CONNECTIONS: Record<string, string[]> = {
  // Hunter tree
  'archery_master': [],
  'predator_shot': [],
  'multi_shot': ['archery_master'],
  'hunters_instinct': ['predator_shot'],
  'devastating_shot': ['multi_shot'],
  'arrow_retrieval': ['hunters_instinct'],
  'ghost_arrows': ['devastating_shot', 'arrow_retrieval'], // Converge - ALL required
  'rain_of_destruction': ['ghost_arrows'],
  
  // Warrior tree
  'weapon_master': [],
  'shield_breaker': [],
  'battlecry': ['weapon_master'],
  'warriors_resilience': ['shield_breaker'],
  'ring_of_chaos': ['battlecry'],
  'second_wind_mastery': ['warriors_resilience'],
  'hero_strike': ['ring_of_chaos', 'second_wind_mastery'], // Converge
  'spartan_rage': ['hero_strike'],
  
  // Assassin tree
  'shadow_dancer': [],
  'shadow_step': [],
  'critical_assassination': ['shadow_dancer'],
  'poison_tolerance': ['shadow_step'],
  'venomous_attacks': ['critical_assassination'],
  'sixth_sense': ['poison_tolerance'],
  'vanish': ['venomous_attacks', 'sixth_sense'], // Converge
  'deaths_veil': ['vanish'],
};

export const TIER_LABELS: Record<number, string> = {
  1: 'Foundation',
  2: 'Basic',
  3: 'Advanced',
  4: 'Expert',
  5: 'Ultimate',
};
```

**Modify `getNodePosition` to invert Y:**
```typescript
export function getNodePosition(
  tree: AbilityTree,
  tier: number,
  column: number,
  isMobile: boolean,
  containerWidth: number
): { x: number; y: number } {
  const tierSpacing = isMobile ? 100 : 120;
  const nodeSize = isMobile ? 64 : 80;
  const padding = isMobile ? 40 : 60;
  
  const columnPositions = {
    0: padding + nodeSize / 2,
    1: containerWidth / 2,
    2: containerWidth - padding - nodeSize / 2,
  };
  
  const x = columnPositions[column as 0 | 1 | 2] || containerWidth / 2;
  
  // INVERT: Tier 5 at top (small y), Tier 1 at bottom (large y)
  const invertedTier = 6 - tier; // 5→1, 4→2, 3→3, 2→4, 1→5
  const y = (invertedTier - 1) * tierSpacing + padding + nodeSize / 2;
  
  return { x, y };
}
```

**Add tier separator Y position helper:**
```typescript
// Get Y position for tier separator line (between tiers)
export function getTierSeparatorY(
  tier: number, // The tier ABOVE the line
  isMobile: boolean
): number {
  const tierSpacing = isMobile ? 100 : 120;
  const padding = isMobile ? 40 : 60;
  const nodeSize = isMobile ? 64 : 80;
  
  // After inversion: tier 5 at top, tier 1 at bottom
  // Separator for tier N goes between tier N and tier N-1
  // Position it halfway between the two tier rows
  const invertedTier = 6 - tier;
  return (invertedTier - 0.5) * tierSpacing + padding + nodeSize / 2;
}

// Get children of an ability
export function getAbilityChildren(abilityId: string): string[] {
  return Object.entries(ABILITY_CONNECTIONS)
    .filter(([_, parents]) => parents.includes(abilityId))
    .map(([childId]) => childId);
}
```

---

### 2. `src/lib/abilityTrees/accessibility.ts` (NEW FILE)

```typescript
import { AbilityTree } from '@/lib/types';
import { ABILITY_CONNECTIONS, ABILITY_TREE_LAYOUT } from './layout';

export interface AccessibilityResult {
  isAccessible: boolean;
  reason: string;
  requiredParents: string[];
  requiresAll: boolean; // True if ALL parents needed (convergence point)
}

/**
 * AC Odyssey-style parent-child accessibility logic:
 * - Foundation (no parents): Always accessible
 * - Single parent: Parent must have >= 1 point invested
 * - Multiple parents (converge): ALL parents must have >= 1 point invested
 */
export function getAbilityAccessibility(
  abilityId: string,
  unlockedAbilities: Map<string, number>
): AccessibilityResult {
  const parents = ABILITY_CONNECTIONS[abilityId];
  
  // No parents = foundation tier = always accessible
  if (!parents || parents.length === 0) {
    return {
      isAccessible: true,
      reason: 'Foundation ability',
      requiredParents: [],
      requiresAll: false,
    };
  }
  
  // Check which parents are unlocked (tier >= 1)
  const unlockedParents = parents.filter(parentId => 
    (unlockedAbilities.get(parentId) || 0) >= 1
  );
  
  // For converging nodes (multiple parents), ALL must be unlocked
  if (parents.length > 1) {
    const allUnlocked = unlockedParents.length === parents.length;
    return {
      isAccessible: allUnlocked,
      reason: allUnlocked 
        ? 'All prerequisites met' 
        : `Requires all ${parents.length} abilities below`,
      requiredParents: parents,
      requiresAll: true,
    };
  }
  
  // Single parent - just needs that one unlocked
  const isUnlocked = unlockedParents.length > 0;
  return {
    isAccessible: isUnlocked,
    reason: isUnlocked 
      ? 'Prerequisite met' 
      : 'Unlock the ability below first',
    requiredParents: parents,
    requiresAll: false,
  };
}

/**
 * Get connection lines for visual rendering.
 * Returns array of {from, to} pairs based on parent-child relationships.
 * Lines are drawn FROM parent TO child (bottom to top after inversion).
 */
export function getTreeConnections(tree: AbilityTree): Array<{ from: string; to: string }> {
  const connections: Array<{ from: string; to: string }> = [];
  
  Object.entries(ABILITY_CONNECTIONS).forEach(([childId, parents]) => {
    const childLayout = ABILITY_TREE_LAYOUT[childId];
    if (childLayout?.tree !== tree) return;
    
    parents.forEach(parentId => {
      connections.push({ from: parentId, to: childId });
    });
  });
  
  return connections;
}
```

---

### 3. `src/lib/abilityTrees/index.ts`

```typescript
export * from './layout';
export * from './colors';
export * from './accessibility';
```

---

### 4. `src/components/abilities/TierSeparator.tsx` (NEW FILE)

```typescript
import { cn } from '@/lib/utils';

interface TierSeparatorProps {
  label: string;
  yPosition: number;
  treeColor: string;
  isMobile: boolean;
}

export function TierSeparator({
  label,
  yPosition,
  treeColor,
  isMobile,
}: TierSeparatorProps) {
  return (
    <div
      className="absolute left-0 right-0 flex items-center pointer-events-none z-0"
      style={{ top: yPosition, transform: 'translateY(-50%)' }}
    >
      {/* Left gradient line */}
      <div 
        className="h-px flex-1"
        style={{
          background: `linear-gradient(to right, transparent 0%, ${treeColor}30 50%, ${treeColor}40 100%)`,
        }}
      />
      
      {/* Tier label badge */}
      <div className={cn(
        'px-3 py-0.5 rounded-full uppercase tracking-widest',
        'bg-background/90 border border-muted-foreground/20',
        'text-muted-foreground/50',
        isMobile ? 'text-[8px] px-2' : 'text-[10px]'
      )}>
        {label}
      </div>
      
      {/* Right gradient line */}
      <div 
        className="h-px flex-1"
        style={{
          background: `linear-gradient(to left, transparent 0%, ${treeColor}30 50%, ${treeColor}40 100%)`,
        }}
      />
    </div>
  );
}
```

---

### 5. `src/components/abilities/TreeColumn.tsx`

**Major changes:**
- Import new accessibility functions and TierSeparator
- Replace `isAbilityLocked`/`isAbilityAvailable` with `getAbilityAccessibility`
- Use `getTreeConnections` instead of deriving from prerequisites
- Render tier separator lines
- Pass `isAccessible` prop instead of `isLocked`/`isAvailable`

```typescript
// New imports
import { getAbilityAccessibility, getTreeConnections } from '@/lib/abilityTrees/accessibility';
import { TIER_LABELS, getTierSeparatorY } from '@/lib/abilityTrees/layout';
import { getTreeColor } from '@/lib/abilityTrees/colors';
import { TierSeparator } from './TierSeparator';

// Replace connections derivation (around line 52-86):
const connections = useMemo(() => getTreeConnections(tree), [tree]);

// Replace isAbilityLocked/isAbilityAvailable functions with:
const getAccessibility = useCallback((abilityId: string) => {
  return getAbilityAccessibility(abilityId, unlockedAbilities);
}, [unlockedAbilities]);

// Add tier separators array:
const tierSeparators = useMemo(() => 
  [2, 3, 4, 5].map(tier => ({
    tier,
    label: TIER_LABELS[tier],
    yPosition: getTierSeparatorY(tier, isMobile),
  })),
  [isMobile]
);

// In JSX, add tier separator rendering (after ConnectionLines, before ability nodes):
{tierSeparators.map(({ tier, label, yPosition }) => (
  <TierSeparator
    key={`sep-${tier}`}
    label={label}
    yPosition={yPosition}
    treeColor={getTreeColor(tree)}
    isMobile={isMobile}
  />
))}

// Update AbilityNode props (around line 178-186):
const accessibility = getAccessibility(abilityId);

<AbilityNode
  ability={ability}
  currentTier={currentTier}
  isAccessible={accessibility.isAccessible}
  isSelected={selectedAbilityId === abilityId}
  isMobile={isMobile}
  onSelect={() => onSelectAbility(abilityId)}
/>
```

---

### 6. `src/components/abilities/AbilityNode.tsx`

**Changes:**
- Replace `isLocked` + `isAvailable` props with single `isAccessible` prop
- Add unlock animation state tracking
- Update visual states

```typescript
// Updated interface (lines 8-16):
interface AbilityNodeProps {
  ability: Ability;
  currentTier: 0 | 1 | 2 | 3;
  isAccessible: boolean;  // Replaces isLocked + isAvailable
  isSelected: boolean;
  isMobile: boolean;
  onSelect: () => void;
}

// Add imports at top:
import { useState, useEffect, useRef, useMemo } from 'react';

// Add unlock animation tracking (after component declaration):
const [justUnlocked, setJustUnlocked] = useState(false);
const prevTierRef = useRef(currentTier);

useEffect(() => {
  if (prevTierRef.current === 0 && currentTier === 1) {
    setJustUnlocked(true);
    const timer = setTimeout(() => setJustUnlocked(false), 600);
    return () => clearTimeout(timer);
  }
  prevTierRef.current = currentTier;
}, [currentTier]);

// Update handleClick (line 52-63):
const handleClick = () => {
  if (isMobile) {
    if (!isAccessible && currentTier === 0) {
      triggerHaptic('light');
    } else if (currentTier === 0) {
      triggerHaptic('medium');
    } else {
      triggerHaptic('heavy');
    }
  }
  onSelect();
};

// Update stateClasses (lines 72-106):
const stateClasses = useMemo(() => {
  // Unlock flash animation
  if (justUnlocked) {
    return cn(
      `border-${treeConfig.primary}`,
      'animate-ability-unlock-flash'
    );
  }
  
  // Not accessible and not unlocked
  if (!isAccessible && currentTier === 0) {
    return 'opacity-40 grayscale border-dashed border-muted-foreground/30';
  }
  
  // Accessible but not yet unlocked - pulsing ready state
  if (isAccessible && currentTier === 0) {
    return cn(
      `border-${treeConfig.primary}`,
      isMobile ? 'animate-ability-pulse-mobile' : 'animate-ability-pulse'
    );
  }
  
  // Tier 1-3 states (unchanged)
  if (currentTier === 1) {
    return cn(
      `border-${treeConfig.primary}`,
      isMobile ? 'shadow-[0_0_10px]' : 'shadow-[0_0_15px]'
    );
  }
  if (currentTier === 2) {
    return cn(
      `border-${treeConfig.primary}`,
      isMobile 
        ? 'shadow-[0_0_15px]' 
        : 'shadow-[0_0_25px] shadow-current'
    );
  }
  if (currentTier === 3) {
    return cn(
      'border-yellow-400',
      isMobile 
        ? 'shadow-[0_0_20px_hsl(var(--tier-maxed))]'
        : 'shadow-[0_0_30px_hsl(var(--tier-maxed))] animate-tier-glow'
    );
  }
  return `border-${treeConfig.primary}/50`;
}, [justUnlocked, isAccessible, currentTier, treeConfig.primary, isMobile]);

// Update aria-label (line 117):
aria-label={`${ability.name}, Tier ${currentTier} of 3, ${!isAccessible && currentTier === 0 ? 'Locked' : isAccessible && currentTier === 0 ? 'Available' : 'Unlocked'}`}

// Update hover class (line 128):
!(!isAccessible && currentTier === 0) && 'hover:scale-110',
```

---

### 7. `src/components/abilities/index.ts`

```typescript
export { AbilitiesScreen } from './AbilitiesScreen';
export { AbilityNode } from './AbilityNode';
export { AbilityDetailsPanel } from './AbilityDetailsPanel';
export { TreeColumn } from './TreeColumn';
export { TreeSelector } from './TreeSelector';
export { ConnectionLine, ConnectionLines } from './ConnectionLine';
export { TierSeparator } from './TierSeparator';
```

---

### 8. `tailwind.config.ts`

**Add new keyframes (in keyframes object around line 113):**
```typescript
// Enhanced unlock flash animation
"ability-unlock-flash": {
  "0%": { 
    transform: "scale(1)", 
    boxShadow: "0 0 0 0 currentColor",
    filter: "brightness(1)"
  },
  "25%": { 
    transform: "scale(1.25)", 
    boxShadow: "0 0 40px 10px currentColor",
    filter: "brightness(2)"
  },
  "50%": { 
    transform: "scale(1.15)", 
    boxShadow: "0 0 30px 6px currentColor",
    filter: "brightness(1.5)"
  },
  "100%": { 
    transform: "scale(1)", 
    boxShadow: "0 0 15px 3px currentColor",
    filter: "brightness(1)"
  },
},
```

**Add new animation (in animation object around line 199):**
```typescript
"ability-unlock-flash": "ability-unlock-flash 0.6s ease-out",
```

---

## Visual Result After Implementation

```text
┌─────────────────────────────────────────────────┐
│              🌧️ RAIN OF DESTRUCTION             │ ← Tier 5 (TOP) - Ultimate
│                    [locked]                     │
│ ─────────────────── ULTIMATE ─────────────────  │
│                        │                        │
│              ✨ GHOST ARROWS                    │ ← Tier 4 - requires BOTH T3
│                 [locked]                        │
│ ─────────────────── EXPERT ───────────────────  │
│                   /   \                         │
│    🎯 DEVASTATING    🔄 ARROW                  │ ← Tier 3
│       [locked]        [locked]                  │
│ ─────────────────── ADVANCED ─────────────────  │
│          │              │                       │
│    🎯 MULTI-SHOT    👁️ HUNTER'S               │ ← Tier 2
│       [locked]       INSTINCT                   │
│ ─────────────────── BASIC ────────────────────  │
│          │              │                       │
│    🏹 ARCHERY       👁️ PREDATOR               │ ← Tier 1 (BOTTOM)
│      MASTER            SHOT                     │
│     [pulsing]        [pulsing]                  │
│ ─────────────────── FOUNDATION ────────────────  │
└─────────────────────────────────────────────────┘
```

---

## Unlock Flow

1. **Start**: Only Tier 1 abilities (bottom) are accessible - show pulsing animation
2. **Invest 1 point in `Archery Master`**: Triggers unlock flash, `Multi-Shot` becomes accessible
3. **Continue up**: Each child becomes accessible when its parent is unlocked
4. **Ghost Arrows (T4)**: Requires BOTH `Devastating Shot` AND `Arrow Retrieval` to be unlocked
5. **Rain of Destruction (T5)**: Requires `Ghost Arrows` to be unlocked

---

## Testing Checklist

- [ ] Tier 1 abilities (bottom) always show pulsing animation (accessible)
- [ ] Tier 2+ abilities are grayed/dashed when not accessible
- [ ] Investing 1 point makes direct children accessible
- [ ] Ghost Arrows/Hero Strike/Vanish require BOTH tier 3 abilities unlocked
- [ ] Unlock triggers flash animation on the newly unlocked node
- [ ] Connection lines flow upward from parent to child
- [ ] Tier separator labels visible between tiers
- [ ] Mobile layout properly inverted
- [ ] Tree swipe navigation still works
