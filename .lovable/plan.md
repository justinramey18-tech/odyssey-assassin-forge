
# D&D Ability Scores System Implementation Plan

## Overview

Add a centralized **D&D Ability Scores** (STR, DEX, CON, INT, WIS, CHA) system with:
- Base scores (raw values like 10, 16, 18)
- Modifiers automatically calculated from scores
- Real-time sync with gear bonuses, abilities, arcana, and consumables
- Randomize option (4d6 drop lowest standard array generation)
- Manual adjustment buttons (+/-)
- Integration with existing DiceRollerScreen modifiers
- Persistence via localStorage and auto-save

---

## Current State Analysis

### Existing Modifier System
The **DiceRollerScreen** already stores ability modifiers in localStorage:
- Storage key: `odyssey-dice-modifiers`
- Format: `{ str: 0, dex: 3, con: 2, int: 1, wis: 0, cha: 2 }`
- These are **modifiers only** (e.g., +3), not raw scores

### Equipment Stats Already Track Bonuses
The `useEquipmentStats` hook aggregates gear bonuses:
- `strength`, `dexterity`, `constitution`, `intelligence`, `wisdom`, `charisma` properties
- These are **bonus values** from equipment (e.g., +2 STR from belt)

### Gap Identified
- No centralized **base ability scores** (8-20 range)
- No unified hook that combines base + gear + other bonuses
- DiceRollerScreen modifiers are isolated and not synced with equipment

---

## Technical Architecture

### New Hook: `use-ability-scores.ts`

A centralized hook that manages:
1. **Base scores** (what the player rolled/assigned: 8-20 range)
2. **Modifiers** (calculated from base: (score - 10) / 2)
3. **Bonuses** (from gear, abilities, buffs)
4. **Final scores** (base + bonuses)
5. **Final modifiers** (derived from final scores)

```typescript
interface AbilityScoreState {
  // Base ability scores (player-assigned, 3-20 range)
  baseScores: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}

interface UseAbilityScoresReturn {
  // State
  baseScores: Record<AbilityName, number>;
  
  // Computed (includes gear/buff bonuses)
  finalScores: Record<AbilityName, number>;
  finalModifiers: Record<AbilityName, number>;
  
  // Breakdown for UI
  getScoreBreakdown: (ability: AbilityName) => {
    base: number;
    gearBonus: number;
    buffBonus: number;
    total: number;
    modifier: number;
  };
  
  // Actions
  setBaseScore: (ability: AbilityName, score: number) => void;
  randomizeScores: () => number[]; // Returns rolled scores for assignment
  applyStandardArray: () => void;
  applyPointBuy: (scores: Record<AbilityName, number>) => void;
  
  // Persistence
  save: () => void;
}
```

### Data Flow

```text
┌─────────────────────────────────────────────────────────────────┐
│                    useAbilityScores Hook                        │
├─────────────────────────────────────────────────────────────────┤
│  Base Scores (localStorage: odyssey-ability-scores)             │
│  { str: 16, dex: 14, con: 12, int: 10, wis: 13, cha: 8 }        │
├─────────────────────────────────────────────────────────────────┤
│                          + Bonuses                              │
├───────────────────────┬───────────────────┬─────────────────────┤
│  Equipment Bonuses    │   Active Buffs    │  Ability Bonuses    │
│  (useEquipmentStats)  │  (useConditions)  │  (character.abilities│
│  +2 STR from belt     │  +1d4 STR (Enhance)│  from prestige tree) │
├───────────────────────┴───────────────────┴─────────────────────┤
│                     = Final Scores                              │
│  { str: 18, dex: 14, con: 12, int: 10, wis: 13, cha: 8 }        │
├─────────────────────────────────────────────────────────────────┤
│                     = Final Modifiers                           │
│  { str: +4, dex: +2, con: +1, int: 0, wis: +1, cha: -1 }        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files to Create

### 1. `src/hooks/use-ability-scores.ts`

Core hook managing ability score state:

**Key features:**
- `baseScores` state with localStorage persistence
- `useMemo` to compute `finalScores` combining base + equipment + buffs
- `useMemo` to compute `finalModifiers` from final scores
- `randomizeScores()` - rolls 4d6 drop lowest, 6 times
- `setBaseScore(ability, value)` - update individual score
- Auto-syncs with DiceRollerScreen's existing modifier storage

**Dependencies:**
- Accepts `equipmentStats: AggregatedStats` from parent
- Accepts optional `activeBuffs` from condition system
- Syncs modifiers to `odyssey-dice-modifiers` for DiceRollerScreen compatibility

### 2. `src/lib/abilityScores/types.ts`

Type definitions:
```typescript
export type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export interface AbilityScoreConfig {
  name: AbilityName;
  abbr: string; // STR, DEX, etc.
  label: string;
  icon: string; // Lucide icon name
  color: string; // Tailwind color class
}

export const ABILITY_CONFIG: Record<AbilityName, AbilityScoreConfig>;

export function scoreToModifier(score: number): number;
export function modifierToString(modifier: number): string;
```

### 3. `src/lib/abilityScores/index.ts`

Exports and utility functions:
- Standard array: [15, 14, 13, 12, 10, 8]
- Point buy calculator
- 4d6 drop lowest roller
- Modifier calculation utilities

### 4. `src/components/character/AbilityScoresPanel.tsx`

UI component for managing ability scores:

**Layout:**
```text
┌─────────────────────────────────────────────────────────────────┐
│  ABILITY SCORES                        [🎲 Randomize] [📋 Array] │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [💪] STRENGTH                                             │  │
│  │ Base: 16  [−] [+]    Gear: +2    Final: 18  (+4)          │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [🎯] DEXTERITY                                            │  │
│  │ Base: 14  [−] [+]    Gear: +0    Final: 14  (+2)          │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ... (6 total abilities)                                        │
└─────────────────────────────────────────────────────────────────┘
```

**Features:**
- Each ability row shows: base score, +/- buttons, gear bonus, final score, modifier
- Randomize button: Opens confirmation sheet, rolls 6 scores (4d6 drop lowest), allows drag-to-assign
- Standard Array button: Quick-apply [15, 14, 13, 12, 10, 8]
- Color-coded by ability (matches existing DiceRoller styling)
- Haptic feedback on interactions

---

## Files to Modify

### 1. `src/pages/Index.tsx`

**Changes:**
- Import and instantiate `useAbilityScores` hook
- Pass `equipmentStats` and `activeBuffs` to the hook
- Add `abilityScores` to auto-save data structure
- Pass ability score state to HomeScreen and relevant components

**Location:** Around line 240-260 (after equipmentStats)
```typescript
// Ability Scores (centralized stat management)
const abilityScores = useAbilityScores({
  equipmentStats: aggregatedStats,
  // activeBuffs from condition system (optional enhancement)
});
```

### 2. `src/hooks/use-auto-save.ts`

**Changes:**
- Add `abilityScores` to `SaveData` interface
- Include in serialization/deserialization

```typescript
interface SaveData {
  // ... existing
  abilityScores?: {
    strength: number;
    dexterity: number;
    constitution: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
}
```

### 3. `src/components/home/HomeScreen.tsx`

**Changes:**
- Add ability scores quick-view in stats section
- Show final modifiers in compact format
- Optional: Add "Stats" quick-access to view full breakdown

### 4. `src/components/drawers/StatsDrawer.tsx`

**Changes:**
- Add "Ability Scores" section at the top
- Display base scores with +/- adjustment controls
- Show gear bonuses and final calculations
- Add Randomize and Standard Array buttons
- Sync changes back to parent via callback

### 5. `src/components/diceRoller/DiceRollerScreen.tsx`

**Changes:**
- Instead of local state, optionally receive modifiers from parent
- OR: Listen to localStorage changes to stay in sync
- Simplest approach: Use shared localStorage key, add event listener for storage sync

### 6. `src/components/oracle/types.ts` (CharacterContext)

**Changes:**
- Add ability scores to character context for Oracle AI:
```typescript
interface CharacterContext {
  // ... existing
  abilityScores?: {
    strength: { base: number; modifier: number; final: number };
    dexterity: { base: number; modifier: number; final: number };
    // ... etc
  };
}
```

---

## Randomization Logic

### 4d6 Drop Lowest (Standard D&D Rolling)

```typescript
function roll4d6DropLowest(): number {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ];
  rolls.sort((a, b) => b - a); // Descending
  return rolls[0] + rolls[1] + rolls[2]; // Sum top 3
}

function generateAbilityScores(): number[] {
  return Array.from({ length: 6 }, () => roll4d6DropLowest())
    .sort((a, b) => b - a); // Present highest first
}
```

### Assignment Flow
1. User clicks "Randomize"
2. System rolls 6 scores (e.g., [17, 15, 14, 12, 11, 8])
3. User assigns each score to an ability by tapping/dragging
4. "Apply" confirms the assignment

---

## Bonus Tracking Sources

### Source 1: Equipment (Already Implemented)
From `useEquipmentStats`:
- `equipmentStats.strength`, `.dexterity`, etc.

### Source 2: Active Conditions/Buffs (Enhancement)
From `useConditions`:
- Giant Strength potions (set score to X)
- Enhance Ability (advantage on checks, not score bonus)
- Bull's Strength, etc.

**Note:** Many D&D buffs affect checks/saves, not the ability score itself. The system should distinguish:
- **Score bonuses** (rare, like Belt of Giant Strength)
- **Check bonuses** (like Enhance Ability - applies to rolls, not score)

For MVP, track only score bonuses from equipment.

### Source 3: Abilities (Future Enhancement)
Some prestige abilities could grant stat bonuses. The system is designed to accept additional bonus sources.

---

## UI/UX Specifications

### Ability Row Component
```text
┌─────────────────────────────────────────────────────────────────┐
│ [💪] STRENGTH                                                   │
│ ┌──────────────────────┐  ┌─────────┐  ┌─────────────────────┐ │
│ │ Base: [−] 16 [+]     │  │ +2 gear │  │ Final: 18 (+4)      │ │
│ └──────────────────────┘  └─────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Randomize Sheet
```text
┌─────────────────────────────────────────────────────────────────┐
│ 🎲 RANDOMIZE ABILITY SCORES                                     │
├─────────────────────────────────────────────────────────────────┤
│ Rolled Scores:                                                   │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                       │
│ │ 17 │ │ 15 │ │ 14 │ │ 12 │ │ 11 │ │ 8  │  [🔄 Reroll]          │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘                       │
├─────────────────────────────────────────────────────────────────┤
│ Assign to Abilities:                                            │
│ STR: [17 ▼]  DEX: [15 ▼]  CON: [14 ▼]                           │
│ INT: [12 ▼]  WIS: [11 ▼]  CHA: [8  ▼]                           │
├─────────────────────────────────────────────────────────────────┤
│                           [Apply Scores]                        │
└─────────────────────────────────────────────────────────────────┘
```

### Color Coding (Matching DiceRoller)
- STR: Red (`text-red-400`)
- DEX: Green (`text-green-400`) 
- CON: Orange (`text-orange-400`)
- INT: Blue (`text-blue-400`)
- WIS: Purple (`text-purple-400`)
- CHA: Pink (`text-pink-400`)

---

## Implementation Sequence

1. **Create type definitions** (`src/lib/abilityScores/types.ts`)
   - AbilityName type
   - AbilityScoreConfig interface
   - ABILITY_CONFIG constant
   - Utility functions

2. **Create core hook** (`src/hooks/use-ability-scores.ts`)
   - Base score state with localStorage
   - Computed final scores combining gear
   - Score/modifier calculations
   - Randomize and assignment functions
   - Sync to DiceRoller storage

3. **Create UI component** (`src/components/character/AbilityScoresPanel.tsx`)
   - Ability score rows with +/- buttons
   - Gear bonus display
   - Final score and modifier display
   - Randomize button with sheet

4. **Update StatsDrawer** (`src/components/drawers/StatsDrawer.tsx`)
   - Add AbilityScoresPanel to top of drawer
   - Pass through state and handlers

5. **Integrate in Index.tsx** (`src/pages/Index.tsx`)
   - Instantiate hook with equipment stats
   - Add to auto-save data
   - Pass to StatsDrawer and HomeScreen

6. **Update auto-save** (`src/hooks/use-auto-save.ts`)
   - Add abilityScores to SaveData interface
   - Handle migration for existing saves

7. **Sync DiceRoller** (`src/components/diceRoller/DiceRollerScreen.tsx`)
   - Listen to localStorage changes OR receive from parent
   - Keep modifier display in sync

---

## Testing Criteria

### Base Score Management
- Setting base scores updates localStorage
- +/- buttons increment/decrement by 1
- Scores clamped to 1-30 range (D&D standard)

### Gear Bonus Integration
- Equipping item with STR +2 shows in breakdown
- Removing item updates final score immediately
- Multiple gear bonuses stack correctly

### Randomization
- "Randomize" generates 6 scores between 3-18
- Each score can only be assigned once
- "Apply" updates all base scores
- "Reroll" generates new scores

### Final Calculations
- Final Score = Base + Gear + Buffs
- Final Modifier = floor((Final Score - 10) / 2)
- Modifier displays with +/- sign

### Persistence
- Base scores persist on refresh
- Auto-save includes ability scores
- Loading cloud save restores scores

### DiceRoller Sync
- Changing base score in StatsDrawer updates DiceRoller
- DiceRoller rolls use correct modifiers

---

## Edge Cases

### Migration for Existing Users
- Check for existing `odyssey-dice-modifiers` 
- If exists but no `odyssey-ability-scores`, reverse-calculate base scores
- Formula: base ≈ (modifier * 2) + 10 (with bounds)

### Score Override Effects
- Giant Strength items set score to specific value, not a bonus
- Track as "override" not "bonus" for correct calculation
- Override takes precedence: `final = Math.max(base + bonus, override)`

### Invalid States
- If base score is 0 or undefined, default to 10
- Guard against NaN in modifier calculations
- Validate before save
