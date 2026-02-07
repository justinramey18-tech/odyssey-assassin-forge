
# BuildConfig Type: Centralizing Class-Specific Data

## Overview

This plan creates a `BuildConfig` type that consolidates all "Odyssey Assassin"-specific strings, data, and configuration into a single source of truth. This makes the codebase ready for future customization (different classes, themes, or user-defined builds) without changing core functionality.

---

## What Gets Centralized

Based on codebase analysis, these are the class-specific elements currently hardcoded:

### 1. Identity & Branding
- Class name: "Odyssey Assassin"
- Default character name: "Unnamed Assassin"
- App subtitle/tagline

### 2. Ability Trees (3 trees)
- Tree IDs: `'hunter' | 'warrior' | 'assassin'`
- Tree display names and subtitles
- Tree colors (CSS variables)
- Tree icons
- All 24 abilities (8 per tree)

### 3. Prestige System (Drizzt's Legacy)
- Prestige tree name: "Drizzt's Legacy"
- Central node: "Drizzt Do'Urden"
- Branch names and themes
- Prestige abilities

### 4. Progression Mechanics
- Hit die: d8 (Rogue class)
- Ability point formula
- HP calculation formula

### 5. Visual Theme
- CSS color variables for trees
- Icon assignments
- Background images

### 6. AI DM Prompts
- All "ODYSSEY ASSASSIN" references in GM Guide prompts
- Character identity prompts (Deadpool persona)

---

## BuildConfig Type Definition

**File:** `src/lib/buildConfig/types.ts` (NEW)

```typescript
import { LucideIcon } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════
// BUILD CONFIGURATION - Single source of truth for class customization
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Core identity for the build
 */
export interface BuildIdentity {
  /** Class name displayed in UI (e.g., "Odyssey Assassin") */
  className: string;
  /** Short subtitle (e.g., "ASSASSIN") */
  classSubtitle: string;
  /** Default name for new characters */
  defaultCharacterName: string;
  /** App title for headers */
  appTitle: string;
  /** Description for GM guides */
  classDescription: string;
}

/**
 * Configuration for a single ability tree
 */
export interface TreeConfig {
  id: string;               // Unique identifier (e.g., 'hunter')
  name: string;             // Display name (e.g., 'Hunter')
  subtitle: string;         // Short description (e.g., 'Ranged & Awareness')
  iconName: string;         // Lucide icon name (e.g., 'Target')
  colors: {
    primary: string;        // CSS variable name (e.g., 'hunter')
    glow: string;
    dim: string;
  };
}

/**
 * Configuration for prestige/post-endgame system
 */
export interface PrestigeConfig {
  treeName: string;         // e.g., "Drizzt's Legacy"
  centralNode: {
    name: string;           // e.g., "Drizzt Do'Urden"
    title: string;          // e.g., "Legendary Ranger of Icewind Dale"
  };
  branches: PrestigeBranchConfig[];
}

export interface PrestigeBranchConfig {
  id: string;
  name: string;
  subtitle: string;
  iconName: string;
  primaryColor: string;
  glowColor: string;
}

/**
 * Mechanical progression configuration
 */
export interface ProgressionConfig {
  hitDie: 'd6' | 'd8' | 'd10' | 'd12';
  hitDieMax: number;
  hitDieAvg: number;
  maxLevel: number;
  /** Point formula: returns points available at given level */
  getAbilityPointsForLevel: (level: number) => number;
  /** HP formula: returns max HP for level + CON mod + prestige */
  calculateMaxHP: (level: number, conMod: number, prestigeLevel: number) => number;
}

/**
 * AI DM prompt customization
 */
export interface AIPromptConfig {
  /** Character personality archetype for RP prompts */
  personalityArchetype: string;
  /** Personality traits list */
  personalityTraits: string[];
  /** Example quips/dialogue */
  exampleQuips: string[];
}

/**
 * Complete build configuration
 */
export interface BuildConfig {
  version: number;
  identity: BuildIdentity;
  trees: TreeConfig[];
  prestige: PrestigeConfig;
  progression: ProgressionConfig;
  aiPrompts: AIPromptConfig;
}
```

---

## Default Configuration

**File:** `src/lib/buildConfig/odysseyAssassin.ts` (NEW)

```typescript
import { BuildConfig } from './types';
import { getAbilityPointsForLevel } from '@/lib/types';
import { calculateMaxHP } from '@/lib/hpCalculation';

/**
 * Default Odyssey Assassin build configuration
 * This is the original hardcoded configuration extracted into a data object
 */
export const ODYSSEY_ASSASSIN_CONFIG: BuildConfig = {
  version: 1,
  
  identity: {
    className: 'Odyssey Assassin',
    classSubtitle: 'ASSASSIN',
    defaultCharacterName: 'Unnamed Assassin',
    appTitle: 'Odyssey Assassin',
    classDescription: 'A custom D&D 5e Assassin class with extensive homebrew abilities, legendary gear, and prestige progression.',
  },
  
  trees: [
    {
      id: 'hunter',
      name: 'Hunter',
      subtitle: 'Ranged & Awareness',
      iconName: 'Target',
      colors: { primary: 'hunter', glow: 'hunter-glow', dim: 'hunter-dim' },
    },
    {
      id: 'warrior',
      name: 'Warrior',
      subtitle: 'Melee & Defense',
      iconName: 'Swords',
      colors: { primary: 'warrior', glow: 'warrior-glow', dim: 'warrior-dim' },
    },
    {
      id: 'assassin',
      name: 'Assassin',
      subtitle: 'Stealth & Crits',
      iconName: 'Eye',
      colors: { primary: 'assassin', glow: 'assassin-glow', dim: 'assassin-dim' },
    },
  ],
  
  prestige: {
    treeName: "Drizzt's Legacy",
    centralNode: {
      name: "Drizzt Do'Urden",
      title: 'Legendary Ranger of Icewind Dale',
    },
    branches: [
      { id: 'dual_wielding', name: 'Dual Wielding', subtitle: 'Scimitar Mastery', iconName: 'Swords', primaryColor: 'red-500', glowColor: '#EF4444' },
      { id: 'guenhwyvar', name: 'Guenhwyvar', subtitle: 'Astral Companion', iconName: 'Cat', primaryColor: 'teal-500', glowColor: '#14B8A6' },
      { id: 'drow_abilities', name: 'Drow Abilities', subtitle: 'Shadow Magic', iconName: 'Eye', primaryColor: 'violet-500', glowColor: '#8B5CF6' },
      { id: 'monk_abilities', name: 'Monk Abilities', subtitle: 'Spiritual Discipline', iconName: 'Zap', primaryColor: 'amber-500', glowColor: '#FBBF24' },
    ],
  },
  
  progression: {
    hitDie: 'd8',
    hitDieMax: 8,
    hitDieAvg: 5,
    maxLevel: 20,
    getAbilityPointsForLevel,
    calculateMaxHP,
  },
  
  aiPrompts: {
    personalityArchetype: 'Deadpool-inspired anti-hero',
    personalityTraits: [
      'Fourth-Wall Awareness',
      'Inappropriate Humor',
      'Mercenary Pragmatism',
      'Pop Culture References',
      'Genre Savvy',
    ],
    exampleQuips: [
      "Is it just me, or did that guy look like he was about to monologue?",
      "Ooh, a critical hit! That's gonna leave a mark. And by mark, I mean corpse.",
    ],
  },
};
```

---

## Build Context Provider

**File:** `src/lib/buildConfig/BuildContext.tsx` (NEW)

```typescript
import React, { createContext, useContext, ReactNode } from 'react';
import { BuildConfig } from './types';
import { ODYSSEY_ASSASSIN_CONFIG } from './odysseyAssassin';

const BuildContext = createContext<BuildConfig>(ODYSSEY_ASSASSIN_CONFIG);

interface BuildProviderProps {
  config?: BuildConfig;
  children: ReactNode;
}

/**
 * Provides build configuration to the entire app
 * Future: Can swap configs for different builds
 */
export function BuildProvider({ config = ODYSSEY_ASSASSIN_CONFIG, children }: BuildProviderProps) {
  return (
    <BuildContext.Provider value={config}>
      {children}
    </BuildContext.Provider>
  );
}

/**
 * Hook to access build configuration anywhere in the app
 */
export function useBuildConfig(): BuildConfig {
  return useContext(BuildContext);
}

/**
 * Direct access to current config (for non-React code)
 * Future: Can be made dynamic
 */
export function getBuildConfig(): BuildConfig {
  return ODYSSEY_ASSASSIN_CONFIG;
}
```

---

## Module Exports

**File:** `src/lib/buildConfig/index.ts` (NEW)

```typescript
export * from './types';
export * from './odysseyAssassin';
export * from './BuildContext';
```

---

## Files to Modify (Minimal Changes)

These changes replace hardcoded strings with config lookups. The behavior remains identical.

### 1. App Entry Point
**File:** `src/App.tsx`

Wrap the app with `BuildProvider`:
```typescript
import { BuildProvider } from '@/lib/buildConfig';

function App() {
  return (
    <BuildProvider>
      {/* existing app content */}
    </BuildProvider>
  );
}
```

### 2. Character Header
**File:** `src/components/character/CharacterHeader.tsx`

Replace hardcoded name:
```typescript
import { useBuildConfig } from '@/lib/buildConfig';

// Before:
<h1>{character.name || 'Unnamed Assassin'}</h1>

// After:
const { identity } = useBuildConfig();
<h1>{character.name || identity.defaultCharacterName}</h1>
```

### 3. Home Modal
**File:** `src/components/home/HomeModalContents.tsx`

Replace class labels:
```typescript
import { useBuildConfig } from '@/lib/buildConfig';

// Before:
<p className="text-xs text-red-400">Odyssey Assassin</p>

// After:
const { identity } = useBuildConfig();
<p className="text-xs text-red-400">{identity.className}</p>
```

### 4. Tree Visual Config
**File:** `src/lib/abilityTrees/colors.ts`

Use config for tree data (keeps existing structure for backward compatibility):
```typescript
import { getBuildConfig } from '@/lib/buildConfig';

// Dynamically generate from config
export function getTreeVisualConfig() {
  const config = getBuildConfig();
  // Map config.trees to existing TREE_VISUAL_CONFIG structure
}
```

### 5. GM Guide Prompts
**File:** `src/lib/gmGuidePrompts.ts`

Use template strings with config:
```typescript
import { getBuildConfig } from '@/lib/buildConfig';

const config = getBuildConfig();

// Before:
content: `# ODYSSEY ASSASSIN - CORE OVERVIEW`

// After:
content: `# ${config.identity.appTitle.toUpperCase()} - CORE OVERVIEW`
```

---

## Implementation Phases

### Phase 1: Core Types (This PR)
1. Create `src/lib/buildConfig/types.ts`
2. Create `src/lib/buildConfig/odysseyAssassin.ts`
3. Create `src/lib/buildConfig/BuildContext.tsx`
4. Create `src/lib/buildConfig/index.ts`

### Phase 2: Wire Up Provider
1. Add `BuildProvider` to `App.tsx`
2. Update 3-5 high-visibility components to use `useBuildConfig()`

### Phase 3: Gradual Migration
1. Replace hardcoded strings incrementally
2. Add helper functions for common lookups
3. Update GM Guide prompts

---

## What This Enables (Future)

1. **Custom Class Names**: User can rename "Assassin" to "Shadow Blade"
2. **Tree Renaming**: Change "Hunter" to "Ranger" or "Marksman"
3. **Alternate Builds**: Load a "Battle Master" or "Elementalist" config
4. **User Overrides**: Store custom labels in localStorage
5. **Import/Export**: Share build configurations as JSON

---

## Backward Compatibility

- All existing code continues to work
- `ODYSSEY_ASSASSIN_CONFIG` is the default
- No breaking changes to types or interfaces
- Existing localStorage data remains valid
- Components without config access still work (use defaults)

---

## Files Created/Modified Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/buildConfig/types.ts` | CREATE | Type definitions |
| `src/lib/buildConfig/odysseyAssassin.ts` | CREATE | Default config |
| `src/lib/buildConfig/BuildContext.tsx` | CREATE | React context |
| `src/lib/buildConfig/index.ts` | CREATE | Module exports |
| `src/App.tsx` | MODIFY | Wrap with provider |
| `src/components/character/CharacterHeader.tsx` | MODIFY | Use config |
| `src/components/home/HomeModalContents.tsx` | MODIFY | Use config |

---

## Testing Criteria

1. App loads and displays "Odyssey Assassin" as before
2. Default character name shows correctly
3. Tree names display in Abilities tab
4. GM Guide prompts include correct class name
5. No console errors related to undefined config
6. Build config is accessible via `useBuildConfig()` hook
