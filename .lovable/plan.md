
# Prestige Skill Tree: Drizzt's Legacy - Implementation Plan v2.0

## Overview

A post-endgame progression system that unlocks after mastering all 24 base abilities (72 total tier points). Players gain access to Drizzt Do'Urden's legendary abilities across 4 themed branches with constellation-style node visualization and AI DM prompt integration.

---

## Unlock Condition

The Prestige Skill Tree becomes available when **all 24 abilities across Hunter, Warrior, and Assassin trees are maxed to Tier 3** (72 total points spent). This is validated by:

```typescript
const isLegacyUnlocked = getTotalPointsSpent(character.abilities) >= 72;
```

A new "Drizzt's Legacy" tab will appear in the navigation with:
- Lock icon + progress indicator (e.g., "62/72") when incomplete
- Unlocked state with purple/gold glow when conditions are met
- First-time unlock celebration animation

---

## Prestige Point Economy

### Integration with Existing System

The prestige point system is already implemented in `src/hooks/use-prestige.ts`. The existing system grants **1 point per prestige level** (configurable in `PRESTIGE_CONFIG.POINTS_PER_PRESTIGE`). These same points will be used for Drizzt's Legacy abilities.

**Current Config** (from `src/lib/prestige/config.ts`):
- `MAX_BASE_LEVEL`: 20
- `BASE_PRESTIGE_XP`: 5,000
- `XP_SCALING_FACTOR`: 1.5x per level
- `POINTS_PER_PRESTIGE`: 1
- `MAX_PRESTIGE_LEVEL`: 50

**Point Spending**:
- Early abilities (Tier 1): 2-3 prestige points
- Mid abilities (Tier 2): 4-6 prestige points
- Late abilities (Tier 3): 8-12 prestige points
- Total to unlock all ~48 abilities: ~240-280 prestige points
- This requires reaching approximately Prestige Level 50 with efficient spending

### Respec Mechanic

The existing `resetPrestigePoints()` function in `usePrestige` already supports full respec. For Drizzt's Legacy:
- **Free Respec**: Players can reset prestige tree allocations at any time (Settings menu)
- Existing `spentPrestigePoints` and `availablePrestigePoints` tracking remains valid
- This matches the base ability system philosophy

---

## Data Architecture

### Type Definitions

```typescript
// src/lib/prestigeTree/types.ts

export type PrestigeBranch = 
  | 'dual_wielding' 
  | 'guenhwyvar' 
  | 'drow_abilities' 
  | 'monk_abilities';

export interface PrestigeAbility {
  id: string;
  name: string;
  branch: PrestigeBranch;
  tier: 1 | 2 | 3;           // Foundation, Intermediate, Advanced
  prestigeCost: number;       // 2-12 prestige points
  minimumPrestigeLevel?: number;
  prerequisites: string[];    // IDs of required abilities
  description: string;
  aiPrompt: string;          // Copyable narrative prompt
  mechanicalContext: string; // DM-facing mechanics (in brackets)
  effects: {
    mechanicalBonus?: string;
    cooldown?: string;
    saveDC?: number;
    duration?: string;
  };
  icon: string;              // Lucide icon name
}

// Serializable structure (no Maps - addresses Quality Check #1)
export interface PrestigeTreeProgress {
  unlockedAbilities: string[];              // Array of unlocked ability IDs
  spentPrestigePoints: number;              // Points spent on tree
  unlockTimestamps: Record<string, number>; // Unix timestamps as object
}

export const DEFAULT_PRESTIGE_TREE_PROGRESS: PrestigeTreeProgress = {
  unlockedAbilities: [],
  spentPrestigePoints: 0,
  unlockTimestamps: {},
};

// Helper for runtime usage (converts to Set for O(1) lookups)
export interface PrestigeTreeState {
  unlockedAbilities: Set<string>;
  unlockTimestamps: Map<string, Date>;
}

export function deserializeProgress(data: PrestigeTreeProgress): PrestigeTreeState {
  return {
    unlockedAbilities: new Set(data.unlockedAbilities),
    unlockTimestamps: new Map(
      Object.entries(data.unlockTimestamps).map(([id, ts]) => [id, new Date(ts)])
    ),
  };
}

export function serializeProgress(state: PrestigeTreeState): PrestigeTreeProgress {
  return {
    unlockedAbilities: Array.from(state.unlockedAbilities),
    spentPrestigePoints: state.unlockedAbilities.size, // recalculate if costs vary
    unlockTimestamps: Object.fromEntries(
      Array.from(state.unlockTimestamps.entries()).map(([id, date]) => [id, date.getTime()])
    ),
  };
}
```

### Branch Configuration

```typescript
// src/lib/prestigeTree/branchConfig.ts

import { PrestigeBranch } from './types';
import { Swords, Cat, Eye, Zap } from 'lucide-react';

export interface BranchVisualConfig {
  id: PrestigeBranch;
  name: string;
  subtitle: string;
  icon: LucideIcon;
  primaryColor: string;       // Tailwind color (e.g., 'red-500')
  glowColor: string;          // For CSS shadows
  gradient: string;           // Background gradient
  position: 'upper-left' | 'upper-right' | 'lower-left' | 'lower-right';
}

export const BRANCH_VISUAL_CONFIG: Record<PrestigeBranch, BranchVisualConfig> = {
  dual_wielding: {
    id: 'dual_wielding',
    name: 'Dual Wielding',
    subtitle: 'Scimitar Mastery',
    icon: Swords,
    primaryColor: 'red-500',
    glowColor: '#EF4444',
    gradient: 'from-red-900/40 to-amber-900/20',
    position: 'upper-left',
  },
  guenhwyvar: {
    id: 'guenhwyvar',
    name: 'Guenhwyvar',
    subtitle: 'Astral Companion',
    icon: Cat,
    primaryColor: 'teal-500',
    glowColor: '#14B8A6',
    gradient: 'from-teal-900/40 to-slate-900/20',
    position: 'upper-right',
  },
  drow_abilities: {
    id: 'drow_abilities',
    name: 'Drow Abilities',
    subtitle: 'Shadow Magic',
    icon: Eye,
    primaryColor: 'violet-500',
    glowColor: '#8B5CF6',
    gradient: 'from-violet-900/40 to-black/40',
    position: 'lower-left',
  },
  monk_abilities: {
    id: 'monk_abilities',
    name: 'Monk Abilities',
    subtitle: 'Spiritual Discipline',
    icon: Zap,
    primaryColor: 'amber-500',
    glowColor: '#FBBF24',
    gradient: 'from-amber-900/40 to-slate-800/20',
    position: 'lower-right',
  },
};

// Central node config
export const DRIZZT_CENTRAL_NODE = {
  name: "Drizzt Do'Urden",
  title: 'Legendary Ranger of Icewind Dale',
  primaryColor: 'purple-600',
  glowColor: '#7C3AED',
};
```

---

## Hook Implementation (Addresses Quality Check #2 & #3)

```typescript
// src/hooks/use-prestige-tree.ts

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  PrestigeTreeProgress,
  DEFAULT_PRESTIGE_TREE_PROGRESS,
  deserializeProgress,
  PrestigeAbility,
} from '@/lib/prestigeTree/types';
import { prestigeAbilities, getPrestigeAbilityById } from '@/lib/prestigeTree/abilities';
import { PrestigeData } from '@/lib/prestige/types';
import { getTotalPointsSpent } from '@/lib/types';
import { CharacterAbility } from '@/lib/types';

const STORAGE_KEY = 'odyssey-prestige-tree';

function loadProgress(): PrestigeTreeProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PRESTIGE_TREE_PROGRESS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('[PrestigeTree] Failed to load:', e);
  }
  return DEFAULT_PRESTIGE_TREE_PROGRESS;
}

function saveProgress(data: PrestigeTreeProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[PrestigeTree] Failed to save:', e);
  }
}

export interface UsePrestigeTreeReturn {
  // Unlock status
  isLegacyUnlocked: boolean;
  unlockProgress: { current: number; required: number };
  
  // Prestige tree state
  progress: PrestigeTreeProgress;
  unlockedSet: Set<string>;
  
  // Point tracking
  availablePrestigePoints: number;
  spentOnTree: number;
  
  // Actions
  canUnlockAbility: (abilityId: string) => { 
    canUnlock: boolean; 
    reason?: string; 
  };
  unlockAbility: (abilityId: string) => { 
    success: boolean; 
    error?: string; 
  };
  resetTree: () => void;
  
  // Helpers
  getAbilityDetails: (abilityId: string) => PrestigeAbility | undefined;
  isAbilityUnlocked: (abilityId: string) => boolean;
  getPrerequisitesStatus: (abilityId: string) => {
    met: boolean;
    missing: string[];
  };
}

export function usePrestigeTree(
  characterAbilities: CharacterAbility[],
  prestigeData: PrestigeData
): UsePrestigeTreeReturn {
  const [progress, setProgress] = useState<PrestigeTreeProgress>(() => loadProgress());

  // Calculate if legacy tree is unlocked (all 72 base ability points spent)
  const basePointsSpent = useMemo(() => 
    getTotalPointsSpent(characterAbilities), 
    [characterAbilities]
  );
  const isLegacyUnlocked = basePointsSpent >= 72;
  const unlockProgress = { current: basePointsSpent, required: 72 };

  // Convert to Set for fast lookups
  const unlockedSet = useMemo(() => 
    new Set(progress.unlockedAbilities), 
    [progress.unlockedAbilities]
  );

  // Calculate points available for tree
  const availablePrestigePoints = prestigeData.availablePrestigePoints;
  const spentOnTree = progress.spentPrestigePoints;

  // Persist changes
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Check if ability can be unlocked
  const canUnlockAbility = useCallback((abilityId: string): { canUnlock: boolean; reason?: string } => {
    const ability = getPrestigeAbilityById(abilityId);
    if (!ability) {
      return { canUnlock: false, reason: 'Ability not found' };
    }

    // Already unlocked
    if (unlockedSet.has(abilityId)) {
      return { canUnlock: false, reason: 'Already unlocked' };
    }

    // Check prestige level requirement
    if (ability.minimumPrestigeLevel && prestigeData.prestigeLevel < ability.minimumPrestigeLevel) {
      return { 
        canUnlock: false, 
        reason: `Requires Prestige Level ${ability.minimumPrestigeLevel}` 
      };
    }

    // Check prestige point cost
    if (availablePrestigePoints < ability.prestigeCost) {
      return { 
        canUnlock: false, 
        reason: `Need ${ability.prestigeCost - availablePrestigePoints} more prestige points` 
      };
    }

    // Check prerequisites
    const missingPrereqs = ability.prerequisites.filter(prereq => !unlockedSet.has(prereq));
    if (missingPrereqs.length > 0) {
      const missingNames = missingPrereqs
        .map(id => getPrestigeAbilityById(id)?.name || id)
        .join(', ');
      return { 
        canUnlock: false, 
        reason: `Requires: ${missingNames}` 
      };
    }

    return { canUnlock: true };
  }, [unlockedSet, prestigeData, availablePrestigePoints]);

  // Unlock ability
  const unlockAbility = useCallback((abilityId: string): { success: boolean; error?: string } => {
    const check = canUnlockAbility(abilityId);
    if (!check.canUnlock) {
      return { success: false, error: check.reason };
    }

    const ability = getPrestigeAbilityById(abilityId)!;
    
    setProgress(prev => ({
      unlockedAbilities: [...prev.unlockedAbilities, abilityId],
      spentPrestigePoints: prev.spentPrestigePoints + ability.prestigeCost,
      unlockTimestamps: {
        ...prev.unlockTimestamps,
        [abilityId]: Date.now(),
      },
    }));

    return { success: true };
  }, [canUnlockAbility]);

  // Reset tree (full respec)
  const resetTree = useCallback(() => {
    setProgress(DEFAULT_PRESTIGE_TREE_PROGRESS);
  }, []);

  // Helper: get ability details
  const getAbilityDetails = useCallback((abilityId: string) => 
    getPrestigeAbilityById(abilityId), 
  []);

  // Helper: check if unlocked
  const isAbilityUnlocked = useCallback((abilityId: string) => 
    unlockedSet.has(abilityId), 
  [unlockedSet]);

  // Helper: get prerequisites status
  const getPrerequisitesStatus = useCallback((abilityId: string) => {
    const ability = getPrestigeAbilityById(abilityId);
    if (!ability) return { met: true, missing: [] };
    
    const missing = ability.prerequisites.filter(prereq => !unlockedSet.has(prereq));
    return { met: missing.length === 0, missing };
  }, [unlockedSet]);

  return {
    isLegacyUnlocked,
    unlockProgress,
    progress,
    unlockedSet,
    availablePrestigePoints,
    spentOnTree,
    canUnlockAbility,
    unlockAbility,
    resetTree,
    getAbilityDetails,
    isAbilityUnlocked,
    getPrerequisitesStatus,
  };
}
```

---

## Mobile Layout Strategy (Addresses Quality Check #5)

**Selected Approach: Branch Tabs with Swipe**

On mobile devices (< 768px), the constellation will use:

1. **Tab Bar**: Horizontal scrollable tabs showing 4 branches
2. **Central Node**: Displayed above tabs (always visible)
3. **Single Branch View**: Only one branch visible at a time
4. **Swipe Navigation**: Swipe left/right to switch branches (reusing existing `useSwipe` hook from AbilitiesScreen)
5. **Bottom Sheet**: Ability details open in a bottom sheet (existing pattern)

```typescript
// Mobile branch selector pattern
const BRANCH_ORDER: PrestigeBranch[] = [
  'dual_wielding', 
  'guenhwyvar', 
  'drow_abilities', 
  'monk_abilities'
];

// Reuse swipe handlers from AbilitiesScreen
const { handlers: swipeHandlers, swipeOffset } = useSwipe(
  () => navigateToNextBranch(),
  () => navigateToPrevBranch(),
  { threshold: 60, velocityThreshold: 0.4 }
);
```

---

## Central Node Behavior (Addresses Quality Check #4)

```typescript
// src/components/prestigeTree/DrizztCentralNode.tsx

interface DrizztCentralNodeProps {
  prestigeLevel: number;
  totalPointsEarned: number;
  pointsSpentOnTree: number;
  availablePoints: number;
  isMobile: boolean;
}

// Behavior specification:
// - Display: Character portrait, name, current Prestige Level
// - Stats: "Prestige X | X/Y points spent"
// - Interactivity: Non-interactive (visual anchor only)
// - Mobile: Scaled down; stats displayed inline
// - Animation: Subtle purple glow pulse when any ability unlocks
```

---

## SVG Performance Optimization (Addresses Quality Check #6)

```typescript
// src/components/prestigeTree/PrestigeConnectionLines.tsx

// Performance strategy:
// 1. Use CSS will-change for animated elements
// 2. Disable animations on mobile (static lines only)
// 3. Use requestAnimationFrame for any JS-driven animations
// 4. Debounce resize handlers

const connectionLineStyle: React.CSSProperties = {
  willChange: 'opacity, stroke-dashoffset',
  // Use GPU-accelerated properties only
};

// Mobile: Simple static lines
// Desktop: Animated flow effect
const getLineAnimation = (isMobile: boolean, isActive: boolean) => {
  if (isMobile || !isActive) return undefined;
  return 'connection-flow 2s linear infinite';
};
```

---

## Complete Icon Mapping (Addresses Quality Check #7)

```typescript
// All 48 ability icons
const ABILITY_ICONS: Record<string, string> = {
  // Dual Wielding (12)
  'scimitar_mastery': 'Swords',
  'twin_blade_grip': 'Zap',
  'icingdeath_bond': 'Snowflake',
  'twinkle_bond': 'Star',
  'dance_of_blades': 'Shuffle',
  'whirlwind_assault': 'Wind',
  'perfect_parry': 'Shield',
  'riposte_mastery': 'Target',
  'form_of_crow': 'Bird',
  'blade_echo': 'Copy',
  'legacy_of_lolth': 'Crown',
  'dual_weapon_finale': 'Sparkles',

  // Guenhwyvar (12)
  'call_guenhwyvar': 'Cat',
  'guenhwyvar_bond': 'Link',
  'panther_pounce': 'Footprints',
  'guenhwyvar_grace': 'Heart',
  'shared_senses': 'Eye',
  'coordinated_strike': 'Users',
  'spectral_guard': 'ShieldCheck',
  'guenhwyvar_roar': 'Volume2',
  'guenhwyvar_ascension': 'TrendingUp',
  'soul_link': 'HeartHandshake',
  'eternal_companion': 'Infinity',
  'avatar_panther': 'Sparkle',

  // Drow Abilities (12)
  'superior_darkvision': 'Eye',
  'drow_magic': 'Wand2',
  'dancing_lights': 'Lightbulb',
  'shadow_affinity': 'Moon',
  'darkness_veil': 'CloudMoon',
  'fey_ancestry': 'Leaf',
  'drow_resilience': 'Shield',
  'shadow_step_drow': 'Footprints',
  'lolth_endurance': 'HeartPulse',
  'web_of_shadows': 'Network',
  'seldarine_grace': 'Sun',
  'drow_lord_authority': 'Crown',

  // Monk Abilities (12)
  'monastic_discipline': 'Flame',
  'flurry_of_blows': 'Zap',
  'unarmored_defense': 'User',
  'deflect_missiles': 'ShieldOff',
  'patient_defense': 'Timer',
  'step_of_wind': 'Wind',
  'slow_fall': 'Feather',
  'stunning_strike': 'Zap',
  'diamond_soul': 'Gem',
  'timeless_body': 'Clock',
  'empty_body': 'Ghost',
  'perfect_consciousness': 'Brain',
};
```

---

## Unlock Animation Specification (Addresses Quality Check #8)

```typescript
// Animation specifications

// 1. Single Ability Unlock
const ABILITY_UNLOCK_ANIMATION = {
  nodeGlow: {
    duration: 2000, // ms
    keyframes: [
      { opacity: 0.5, scale: 1 },
      { opacity: 1, scale: 1.2 },
      { opacity: 0.7, scale: 1 },
    ],
  },
  connectionLines: 'fade-in 0.5s ease-out',
  hapticFeedback: 'heavy', // 30ms vibration
  toast: {
    title: "Ability Unlocked!",
    description: "{abilityName} is now available.",
    className: "border-purple-500 bg-purple-500/10",
  },
};

// 2. First-Time Legacy Tab Unlock
const LEGACY_UNLOCK_CEREMONY = {
  overlay: {
    background: 'linear-gradient(to-b, from-purple-900/90, to-black/95)',
    message: `"You have mastered the shadows. A new legacy awaits..."`,
    attribution: "— Drizzt Do'Urden",
  },
  dismissButton: "Begin Your Legacy",
  staggeredNodeEntrance: 50, // ms between each node appearing
};

// 3. No confetti (doesn't fit dark fantasy theme)
// 4. Optional sound: Subtle sword unsheathe (if audio enabled)
```

---

## Prestige Level Gates (Addresses Quality Check #9)

```typescript
// Level requirements by tier
const TIER_REQUIREMENTS = {
  1: { minPrestigeLevel: 0, costRange: [2, 3] },
  2: { minPrestigeLevel: 5, costRange: [4, 6] },
  3: { minPrestigeLevel: 8, costRange: [8, 12] },
};

// Some Tier 3 abilities have higher requirements:
const HIGH_TIER_GATES: Record<string, number> = {
  'legacy_of_lolth': 15,     // Dual Wielding capstone
  'avatar_panther': 12,      // Guenhwyvar capstone
  'drow_lord_authority': 15, // Drow capstone
  'perfect_consciousness': 12, // Monk capstone
};
```

---

## Prerequisite Validation (Addresses Quality Check #10)

```typescript
// src/lib/prestigeTree/validation.ts

export function validatePrerequisiteChain(
  abilities: PrestigeAbility[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const abilityIds = new Set(abilities.map(a => a.id));
  
  for (const ability of abilities) {
    // Check 1: Prerequisites must exist
    for (const prereq of ability.prerequisites) {
      if (!abilityIds.has(prereq)) {
        errors.push(`${ability.id}: Missing prerequisite "${prereq}"`);
      }
    }
    
    // Check 2: Tier 1 abilities cannot have prerequisites
    if (ability.tier === 1 && ability.prerequisites.length > 0) {
      errors.push(`${ability.id}: Tier 1 ability has prerequisites`);
    }
    
    // Check 3: Prerequisites must be same or lower tier
    for (const prereq of ability.prerequisites) {
      const prereqAbility = abilities.find(a => a.id === prereq);
      if (prereqAbility && prereqAbility.tier >= ability.tier) {
        errors.push(`${ability.id}: Prerequisite "${prereq}" is same or higher tier`);
      }
    }
    
    // Check 4: Detect circular dependencies (DFS)
    const visited = new Set<string>();
    const stack = [...ability.prerequisites];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === ability.id) {
        errors.push(`${ability.id}: Circular dependency detected`);
        break;
      }
      if (!visited.has(current)) {
        visited.add(current);
        const currentAbility = abilities.find(a => a.id === current);
        if (currentAbility) {
          stack.push(...currentAbility.prerequisites);
        }
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

---

## Accessibility Implementation (Addresses Quality Check #12)

```typescript
// Keyboard navigation specification

// Tab order: Branch tabs → Central node (info only) → Ability nodes (L-R, T-B)
// Enter/Space: Open ability details
// Escape: Close details panel
// Arrow keys: Navigate within branch grid

const ARIA_LABELS = {
  node: (ability: PrestigeAbility, isUnlocked: boolean) =>
    `${ability.name}: ${ability.description}. ` +
    `Cost: ${ability.prestigeCost} prestige points. ` +
    `${isUnlocked ? 'Unlocked' : 'Locked'}`,
  
  branch: (config: BranchVisualConfig, count: { unlocked: number; total: number }) =>
    `${config.name} branch: ${count.unlocked} of ${count.total} abilities unlocked`,
  
  centralNode: (level: number) =>
    `Drizzt Do'Urden, Prestige Level ${level}. Visual anchor.`,
};

// Focus management
// - Details panel: focus trap with radix-ui Dialog
// - On close: return focus to triggering node
// - Focus outline: 3px ring with branch color
```

---

## Integration with Existing Systems (Addresses Quality Check #15)

### Auto-Save Extension

Extend `SaveData` interface in `src/hooks/use-auto-save.ts`:

```typescript
export interface SaveData {
  // ... existing fields
  prestigeTree: {
    unlockedAbilities: string[];
    spentPrestigePoints: number;
    unlockTimestamps: Record<string, number>;
  };
}
```

### Navigation Integration

Add to `AssassinHeader.tsx` tab list:

```tsx
{/* Drizzt's Legacy Tab */}
<TabsTrigger 
  value="legacy" 
  disabled={!isLegacyUnlocked}
  className={cn(
    'group h-full flex flex-col items-center justify-center gap-1 px-4 min-w-[70px]',
    'rounded-none border-x border-red-900/20',
    'data-[state=active]:bg-gradient-to-b data-[state=active]:from-purple-600/30',
    'data-[state=active]:border-b-2 data-[state=active]:border-b-purple-500',
    'font-cinzel uppercase tracking-wider text-[10px]',
    !isLegacyUnlocked && 'opacity-50'
  )}
>
  <span className="relative">
    {isLegacyUnlocked ? (
      <Crown className="w-5 h-5 relative z-10 group-hover:scale-110 group-data-[state=active]:text-purple-400" />
    ) : (
      <Lock className="w-5 h-5 text-muted-foreground" />
    )}
    {/* Unlock progress badge */}
    {!isLegacyUnlocked && (
      <span className="absolute -top-1 -right-2 text-[8px] text-muted-foreground">
        {unlockProgress.current}/72
      </span>
    )}
  </span>
  <span className="whitespace-nowrap">Legacy</span>
</TabsTrigger>
```

### Base Ability Synergies

Prestige abilities that reference base abilities will check existing character state:

```typescript
// Example: "Form of the Crow" enhances scimitar attacks
// If character has "Weapon Master" at Tier 3, bonus stacks
const getBonusFromBaseAbility = (
  abilityId: string, 
  characterAbilities: CharacterAbility[]
): number => {
  const ability = characterAbilities.find(a => a.abilityId === abilityId);
  return ability?.currentTier || 0;
};
```

---

## Files to Create

| Path | Description |
|------|-------------|
| `src/lib/prestigeTree/index.ts` | Module exports |
| `src/lib/prestigeTree/types.ts` | Type definitions |
| `src/lib/prestigeTree/abilities.ts` | All 48 ability definitions with prompts |
| `src/lib/prestigeTree/branchConfig.ts` | Branch visual configuration |
| `src/lib/prestigeTree/layout.ts` | Node positioning per branch |
| `src/lib/prestigeTree/validation.ts` | Prerequisite chain validation |
| `src/hooks/use-prestige-tree.ts` | Tree state management hook |
| `src/components/prestigeTree/index.ts` | Component exports |
| `src/components/prestigeTree/PrestigeTreeScreen.tsx` | Main screen with unlock gate |
| `src/components/prestigeTree/DrizztCentralNode.tsx` | Portrait + prestige info |
| `src/components/prestigeTree/PrestigeBranchColumn.tsx` | Single branch renderer |
| `src/components/prestigeTree/PrestigeAbilityNode.tsx` | Individual ability node |
| `src/components/prestigeTree/PrestigeConnectionLines.tsx` | SVG connection paths |
| `src/components/prestigeTree/PrestigeAbilityDetails.tsx` | Details panel with copy |
| `src/components/prestigeTree/PromptCopyButton.tsx` | Copy-to-clipboard component |
| `src/components/prestigeTree/UnlockProgressGate.tsx` | Lock screen with progress |
| `src/components/prestigeTree/BranchSelector.tsx` | Mobile tab navigation |

---

## Files to Modify

| Path | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add 'legacy' tab, integrate usePrestigeTree |
| `src/components/navigation/AssassinHeader.tsx` | Add Legacy tab with lock state |
| `src/hooks/use-auto-save.ts` | Extend SaveData with prestigeTree |
| `src/lib/prestige/types.ts` | No changes needed (reuse existing) |

---

## Testing Checklist (Quality Check #14)

- [ ] Unlock condition correctly detects when all 24 base abilities are maxed (72 points)
- [ ] Prestige points deduct correctly when unlocking abilities
- [ ] Prerequisites block unlock if not satisfied
- [ ] Prestige level gates prevent unlock of high-tier abilities
- [ ] Connection lines render correctly without performance lag
- [ ] Mobile layout works on devices ≤480px width
- [ ] Details panel opens/closes without errors
- [ ] Prompt copy button correctly copies full formatted prompt
- [ ] Save/load prestige progress persists after refresh
- [ ] First-time unlock displays celebration animation
- [ ] Respec correctly returns all points and clears unlocks
- [ ] Keyboard navigation works for all interactive elements
- [ ] Screen reader announces ability states correctly

---

## Implementation Phases

### Phase 1: Data Layer (Day 1)
1. Create `src/lib/prestigeTree/` directory structure
2. Define types with serializable data structures
3. Implement all 48 abilities with prompts (can use AI to generate drafts)
4. Create branch configuration and layout logic
5. Add prerequisite validation utility

### Phase 2: State Management (Day 2)
1. Implement `usePrestigeTree` hook with full error handling
2. Extend auto-save to persist prestige tree progress
3. Integrate with existing prestige point system

### Phase 3: Navigation Integration (Day 2-3)
1. Add "Drizzt's Legacy" tab to AssassinHeader
2. Add unlock progress indicator
3. Add lock overlay for incomplete requirements
4. Implement tab in Index.tsx

### Phase 4: Core Components (Day 3-4)
1. Build PrestigeTreeScreen with unlock gate
2. Create DrizztCentralNode component
3. Implement PrestigeBranchColumn with ability nodes
4. Create PrestigeAbilityNode with tier-based styling
5. Implement connection lines with branch colors

### Phase 5: Details & Interaction (Day 4-5)
1. Build PrestigeAbilityDetails panel
2. Implement PromptCopyButton with formatted output
3. Add unlock confirmation and point deduction
4. Add respec functionality in Settings

### Phase 6: Polish (Day 5-6)
1. Add unlock animations and celebrations
2. Implement connection line flow effects (desktop only)
3. Mobile-responsive adjustments
4. Accessibility audit and fixes
5. Performance testing on low-end devices
