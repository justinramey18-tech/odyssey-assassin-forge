
# Final Consolidated Character Builder Wizard Plan

## Executive Summary

This comprehensive plan creates a 7-step Character Builder Wizard that guides new players through complete D&D assassin character creation. The wizard is accessible from both the initial onboarding flow and after triggering "Reset Entire App" in Settings.

---

## Phase 0: Critical Prerequisites

### A. Complete localStorage Reset Audit

**Problem:** The current `resetAllAppData()` function in `src/lib/resetApp.ts` is missing 20+ storage keys, leaving orphaned data after reset.

**Missing Keys to Add (discovered via codebase search):**

```
// Core character data (existing + missing)
'odyssey-ability-scores',           // Base ability scores
'odyssey-hp-state',                 // HP state
'odyssey-death-saves',              // Death saves

// Magic system
'odyssey-spellcasting',             // Magic path state
'odyssey-active-spells',            // Active spell effects

// Combat system
'odyssey-combat-log',               // Combat log history
'odyssey-combat-settings',          // Combat feature settings
'odyssey-action-economy',           // Turn action tracking
'odyssey-turn-actions',             // Turn actions log
'odyssey-targets',                  // Enemy tracker
'odyssey-initiative',               // Initiative order

// Conditions system
'odyssey-conditions-state',         // Active conditions

// Dice roller
'odyssey-dice-modifiers',           // Ability modifiers for dice
'odyssey-proficiency-bonus',        // Proficiency bonus
'odyssey-proficient-skills',        // Skill proficiencies
'odyssey-proficient-saves',         // Saving throw proficiencies

// Inventory
'odyssey-loot',                     // Loot items
'odyssey-shop',                     // Shop inventory
'odyssey-equipment-custom-images',  // Custom equipment images

// Navigation & UI
'odyssey-category-navigation',      // Tab navigation state
'odyssey-custom-home-background',   // Custom background

// Campaign/Chronicle
'odyssey-chronicle-campaigns',      // Campaign data
'odyssey-chronicle-folders',        // Campaign folders

// Synthesis
'odyssey-combat-synthesis-mode',    // AI combat mode
'odyssey-combat-chaos-level',       // Combat chaos level
```

---

## Wizard Architecture

### File Structure

```
src/components/wizard/
├── CharacterWizard.tsx              # Main container with step routing
├── WizardProgress.tsx               # Step indicator (1/7, 2/7, etc.)
├── WizardNavigation.tsx             # Back/Next/Skip buttons
├── QuickStartModal.tsx              # Initial quick-start vs custom choice
├── steps/
│   ├── IdentityStep.tsx             # Name, level, portrait
│   ├── AbilityScoresStep.tsx        # Full 6-stat allocation
│   ├── GameModeStep.tsx             # Mode + XP preset + dice odds
│   ├── MagicPathStep.tsx            # Path selection or skip
│   ├── SkillTreePreviewStep.tsx     # Tree overview + optional allocation
│   ├── EquipmentStep.tsx            # Presets or custom selection
│   └── SummaryStep.tsx              # Review + launch
├── components/
│   ├── AbilityScoreCard.tsx         # Individual score with modifier
│   ├── DraggableScorePool.tsx       # Drag-and-drop score assignment
│   ├── DiceRollSequence.tsx         # Animated 4d6 drop lowest
│   ├── EquipmentPresetCard.tsx      # Loadout preset display
│   ├── MagicPathCard.tsx            # Path selection card
│   ├── TreePreviewCard.tsx          # Ability tree mini-preview
│   └── PortraitSelector.tsx         # Icon-based avatar picker
├── hooks/
│   ├── use-wizard-state.ts          # Reducer-based state management
│   └── use-wizard-validation.ts     # Per-step validation
├── presets/
│   └── equipment-presets.ts         # Loadout preset definitions
├── utils/
│   └── apply-wizard-state.ts        # Final state application logic
└── index.ts                         # Barrel export
```

---

## Wizard Steps (Revised Order)

### Step 1: Identity & Basics
**Refactored from existing `WizardStepOne.tsx`**

| Field | Input Type | Validation |
|-------|------------|------------|
| Name | Text input | 2-30 chars, alphanumeric + apostrophe/hyphen |
| Level | Slider | 1-20 integer |
| Portrait | Icon picker | 12 Lucide icons (Skull, User, Shield, Sword, etc.) |

**Removed:** Constitution slider (moved to Step 2 for all ability scores together)

**Preview Display:**
- Ability points available at selected level
- (HP preview moved to Step 2)

---

### Step 2: Ability Scores
**New Step - Full D&D 6-stat allocation**

**Three Generation Methods:**

1. **Standard Array**
   - Values: [15, 14, 13, 12, 10, 8]
   - Drag-and-drop assignment to STR/DEX/CON/INT/WIS/CHA
   - Pre-optimized "Assassin Build" button: DEX:15, CON:14, INT:13, WIS:12, CHA:10, STR:8

2. **Roll 4d6 Drop Lowest**
   - Animated dice sequence using existing `DiceRollerScreen` animation style
   - Generate 6 totals into a "pool"
   - Drag to assign OR "Auto-Assign for Assassin" button
   - "Reroll All" with confirmation if any score is 15+

3. **Manual Entry**
   - Six sliders (3-18 range each)
   - Point-buy counter (27 points standard, optional enforcement)

**Auto-Assign Logic (Assassin-Optimized):**
```
DEX: highest     # Primary stat
CON: 2nd highest # Survivability
INT: 3rd highest # Spellcasting (Arcane Trickster)
WIS: 4th highest # Perception, Insight
CHA: 5th highest # Social
STR: lowest      # Dump stat
```

**Live Preview:**
- HP calculation based on level + CON modifier
- All 6 modifiers displayed

---

### Step 3: Game Mode & Preferences
**Moved earlier to inform subsequent steps**

| Setting | Options | Default |
|---------|---------|---------|
| Game Mode | Infinity Pool / Honest Mode | Infinity Pool |
| XP Preset | Standard (1.0x), Fast Track (0.5x), Epic Journey (2.0x), Milestone (manual) | Standard |
| Dice Odds | Fair, Heroic, Dramatic, Chaotic, Cursed | Fair |

**Why Early?**
- Honest Mode affects Magic Path availability (level-gated features)
- Honest Mode affects Equipment presets (no legendary at low levels)
- Provides context for restrictions shown in later steps

**Collapsible "Advanced" Section:**
- Individual Honest Mode rule toggles
- 4th Wall Time toggle

---

### Step 4: Magic Path Selection
**New Step - Optional spellcasting**

**Available Paths (with level gating):**

| Path | Required Level | Spellcasting Ability | Flavor |
|------|----------------|---------------------|--------|
| Arcane Trickster | 3+ | INT | Enchantment/Illusion specialist |
| Shadow Blade | 3+ | INT | Shadow magic half-caster |
| Eldritch Knight | 3+ | INT | Abjuration/Evocation martial |
| Hexblade | 1+ | CHA | Pact magic, weapon bond |
| No Magic | Any | N/A | Pure martial build |

**If character level < 3:**
- Show paths as "locked" with level badge
- Only Hexblade (if level >= 1) and "No Magic" selectable

**Display per path:**
- Spell slots at current level
- Spellcasting ability and modifier from Step 2
- Sample starting spells

---

### Step 5: Skill Tree Preview
**New Step - Introduce the 3 ability trees**

**Display:**
- Hunter, Warrior, Assassin tree cards with mini-preview
- Available ability points from level
- Tree-specific colors (Hunter: teal, Warrior: red, Assassin: purple)

**Optional Starter Allocation:**
- Spend 0-3 points on "Starter Abilities" (foundation tier only)
- Guard against over-spending
- "Skip for Now" option (spend points later in-app)

**Lore/Flavor:**
- Brief description of each tree's playstyle
- Synergy hints (e.g., "Hunter pairs well with ranged builds")

---

### Step 6: Starting Equipment
**New Step - Select initial gear loadout**

**Equipment Presets (level-appropriate):**

| Preset | Rarity | Level Range | Set ID | Items Included |
|--------|--------|-------------|--------|----------------|
| Shadow Initiate | Common | 1-3 | `novice-shadow` | Full 8-piece Novice's Shadow Ensemble |
| Street Runner | Common | 1-4 | `street-runner` | Full 8-piece Street Runner's Kit |
| Apprentice | Common | 3-5 | `apprentice-concealment` | Full 8-piece Apprentice's Concealment Garb |
| Wetboy Operative | Uncommon | 5-10 | `wetboy-professional` | Full 8-piece Wetboy's Professional Kit |
| Guild Operative | Uncommon | 6-12 | `guild-operative` | Full 8-piece Guild Operative's Formal Attire |
| Greek Hero | Rare/Epic | 10-20 | `greek-heroes` | 5-piece Greek Heroes Set |
| Custom Selection | Mixed | Any | N/A | Manual slot-by-slot picking |

**Level Gating Logic:**
```typescript
function getAvailablePresets(level: number, gameMode: GameModeSettings): Preset[] {
  return PRESETS.filter(p => {
    if (level < p.minLevel) return false;
    if (level > p.maxLevel) return false;
    // Honest Mode: restrict high rarity at low levels
    if (isHonestModeActive(gameMode)) {
      if (p.maxRarity === 'legendary' && level < 15) return false;
      if (p.maxRarity === 'epic' && level < 10) return false;
    }
    return true;
  });
}
```

**Live Preview:**
- Total AC from equipped items
- Damage range from weapons
- Set bonus preview (if applicable)

---

### Step 7: Summary & Confirmation
**Final Step - Review and create**

**Summary Card:**
- Character name + selected portrait icon
- Level + HP
- All 6 ability scores with modifiers (compact grid)
- Magic path (or "None")
- Game mode + XP preset
- Equipped gear summary (AC, weapon damage)

**"Edit" Links:**
- Jump back to any step (preserves all state)

**Primary CTA:**
- "Begin Adventure" button
- Triggers `handleWizardComplete()`

---

## State Management

### Reducer-Based Architecture

```typescript
// src/components/wizard/hooks/use-wizard-state.ts

interface WizardState {
  currentStep: number;
  completedSteps: Set<number>;
  
  // Step 1: Identity
  name: string;
  level: number;
  portraitIcon: string; // Lucide icon name
  
  // Step 2: Ability Scores
  abilityScores: BaseAbilityScores;
  scoreGenerationMethod: 'standard' | 'roll' | 'manual';
  
  // Step 3: Game Mode
  gameMode: 'honest' | 'infinityPool';
  honestModeRules: HonestModeRules;
  xpPreset: XPPreset;
  diceOddsMode: DiceOddsMode;
  
  // Step 4: Magic Path
  selectedPath: MagicPath | null;
  
  // Step 5: Skill Trees
  starterAbilities: CharacterAbility[];
  
  // Step 6: Equipment
  equipment: CharacterEquipment;
  selectedPresetId: string | null;
}

type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_IDENTITY'; name: string; level: number; portraitIcon: string }
  | { type: 'SET_ABILITY_SCORES'; scores: BaseAbilityScores; method: 'standard' | 'roll' | 'manual' }
  | { type: 'SET_GAME_MODE'; mode: 'honest' | 'infinityPool'; rules?: HonestModeRules }
  | { type: 'SET_XP_PRESET'; preset: XPPreset }
  | { type: 'SET_DICE_ODDS'; mode: DiceOddsMode }
  | { type: 'SET_MAGIC_PATH'; path: MagicPath | null }
  | { type: 'SET_STARTER_ABILITIES'; abilities: CharacterAbility[] }
  | { type: 'SET_EQUIPMENT'; equipment: CharacterEquipment; presetId?: string }
  | { type: 'APPLY_PRESET'; presetId: string }
  | { type: 'GO_BACK' }
  | { type: 'GO_NEXT' }
  | { type: 'RESET' };
```

### Wizard Progress Persistence

```typescript
const WIZARD_PROGRESS_KEY = 'odyssey-wizard-progress';

// Auto-save after each step
useEffect(() => {
  if (state.currentStep > 1) {
    localStorage.setItem(WIZARD_PROGRESS_KEY, JSON.stringify({
      ...state,
      savedAt: Date.now(),
    }));
  }
}, [state]);

// Resume prompt on mount
useEffect(() => {
  const saved = localStorage.getItem(WIZARD_PROGRESS_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    // Only restore if < 24 hours old
    if (Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000) {
      showResumeDialog(parsed);
    } else {
      localStorage.removeItem(WIZARD_PROGRESS_KEY);
    }
  }
}, []);
```

---

## Final State Application

### Extract to Testable Utility

```typescript
// src/components/wizard/utils/apply-wizard-state.ts

export interface ApplyWizardResult {
  success: boolean;
  errors: string[];
}

export function applyWizardState(
  wizardState: WizardState,
  setters: {
    setCharacter: (updater: (prev: Character) => Character) => void;
    setCurrentXP: (xp: number) => void;
    setXPPreset: (preset: XPPreset) => void;
    abilityScores: { applyScores: (scores: BaseAbilityScores) => void };
    spellcasting: { selectPath: (path: MagicPath) => void };
    setEquipment: (equipment: CharacterEquipment) => void;
    handleHPChange: (current: number, max: number, temp: number) => void;
    toast: (config: ToastConfig) => void;
  }
): ApplyWizardResult {
  const errors: string[] = [];

  try {
    // 1. Character basics
    setters.setCharacter(prev => ({
      ...prev,
      name: wizardState.name,
      level: wizardState.level,
      abilities: wizardState.starterAbilities.length > 0
        ? mergeAbilities(prev.abilities, wizardState.starterAbilities)
        : prev.abilities,
    }));

    // 2. XP for level
    const xpForLevel = getXPForLevel(
      wizardState.level,
      XP_PRESETS[wizardState.xpPreset].multiplier
    );
    setters.setCurrentXP(xpForLevel);
    setters.setXPPreset(wizardState.xpPreset);

    // 3. Ability scores
    setters.abilityScores.applyScores(wizardState.abilityScores);

    // 4. Game mode
    saveGameModeSettings({
      mode: wizardState.gameMode,
      honestModeRules: wizardState.honestModeRules,
    });

    // 5. Dice odds
    saveDiceOddsMode(wizardState.diceOddsMode);

    // 6. Magic path
    if (wizardState.selectedPath) {
      setters.spellcasting.selectPath(wizardState.selectedPath);
    }

    // 7. Equipment
    setters.setEquipment(wizardState.equipment);

    // 8. HP calculation
    const conMod = scoreToModifier(wizardState.abilityScores.constitution);
    const maxHP = calculateMaxHP(wizardState.level, conMod, 0);
    setters.handleHPChange(maxHP, maxHP, 0);

    // 9. Clear wizard progress
    localStorage.removeItem('odyssey-wizard-progress');

    // 10. Success toast
    setters.toast({
      title: `⚔️ ${wizardState.name} Created!`,
      description: `Level ${wizardState.level} Assassin ready for adventure.`,
      className: 'border-primary bg-primary/10',
    });

    return { success: true, errors: [] };
  } catch (e) {
    errors.push(String(e));
    return { success: false, errors };
  }
}
```

---

## Quick Start Flow

**Initial Modal Before Step 1:**

```
┌────────────────────────────────────────────┐
│  ⚔️  ODYSSEY ASSASSIN                       │
│                                            │
│  ○ Quick Start                             │
│    "Level 1 Assassin with defaults"        │
│    → Enter name only, use optimal defaults │
│                                            │
│  ○ Custom Build                            │
│    "Configure every detail"                │
│    → Full 7-step wizard                    │
│                                            │
│  ○ Load from Cloud                         │
│    "Continue an existing character"        │
│    → Sign in + select save slot            │
└────────────────────────────────────────────┘
```

**Quick Start Defaults:**
```typescript
const QUICK_START_DEFAULTS: Partial<WizardState> = {
  level: 1,
  portraitIcon: 'Skull',
  abilityScores: {
    strength: 8,
    dexterity: 15,
    constitution: 14,
    intelligence: 12,
    wisdom: 13,
    charisma: 10,
  },
  scoreGenerationMethod: 'standard',
  gameMode: 'infinityPool',
  xpPreset: 'standard',
  diceOddsMode: 'fair',
  selectedPath: null,
  starterAbilities: [],
  selectedPresetId: 'street-runner',
};
```

---

## Backward-Edit Dependency Validation

When users navigate backward and change values, validate forward dependencies:

| Changed In | Check Forward | Action If Invalid |
|------------|---------------|-------------------|
| Step 1 (Level) | Step 4 (Magic Path) | If level now < 3, clear non-Hexblade paths |
| Step 1 (Level) | Step 5 (Skill Trees) | Recalculate available points |
| Step 1 (Level) | Step 6 (Equipment) | Filter available presets by new level |
| Step 2 (CON) | Step 7 (Summary) | Recalculate HP preview |
| Step 3 (Game Mode) | Step 4, 5, 6 | Re-evaluate locked features |

---

## Validation Rules Per Step

| Step | Validations |
|------|-------------|
| 1 - Identity | Name: 2-30 chars, no special chars except ' and - |
| 2 - Ability Scores | All scores 3-18, no duplicate Standard Array values assigned |
| 3 - Game Mode | All valid (enum values) |
| 4 - Magic Path | If level < 3, only Hexblade or null allowed |
| 5 - Skill Trees | Total spent ≤ available points |
| 6 - Equipment | At least one weapon equipped (warning, not blocking) |
| 7 - Summary | All required fields populated |

---

## Integration with Index.tsx

### Changes Required

1. **Replace `WizardStepOne` Import:**
   ```typescript
   import { CharacterWizard } from '@/components/wizard';
   ```

2. **Update Wizard Rendering:**
   ```tsx
   {showWizard && (
     <CharacterWizard 
       onComplete={handleWizardComplete}
       onQuickStart={handleQuickStart}
       onLoadCloud={() => setShowCloudSaveModal(true)}
     />
   )}
   ```

3. **Rename `handleBasicInfoComplete` to `handleWizardComplete`:**
   - Accept full `WizardState` object
   - Call `applyWizardState()` utility

4. **Update Reset Flow in `handleResetApp`:**
   ```typescript
   // After resetAllAppData()
   setShowWizard(true);
   // Wizard will show QuickStartModal first
   ```

---

## Implementation Phases

### Phase 1: Foundation (Est. 2-3 changes)
1. Update `resetApp.ts` with all missing storage keys
2. Create wizard directory structure
3. Implement `use-wizard-state.ts` reducer
4. Create `WizardProgress.tsx` and `WizardNavigation.tsx`

### Phase 2: Core Steps (Est. 4-5 changes)
5. Create `IdentityStep.tsx` (refactor from WizardStepOne, remove CON)
6. Create `AbilityScoresStep.tsx` with all 3 generation methods
7. Create `GameModeStep.tsx` with mode/XP/dice config
8. Create `SummaryStep.tsx` with review UI

### Phase 3: Extended Steps (Est. 3-4 changes)
9. Create `MagicPathStep.tsx` with path cards
10. Create `SkillTreePreviewStep.tsx` with tree cards
11. Create `EquipmentStep.tsx` with presets
12. Create `equipment-presets.ts` mapping to existing item data

### Phase 4: Integration (Est. 2-3 changes)
13. Create `CharacterWizard.tsx` container
14. Create `QuickStartModal.tsx`
15. Update `Index.tsx` to use new wizard
16. Create `apply-wizard-state.ts` utility

### Phase 5: Polish (Est. 2-3 changes)
17. Add step transition animations (Framer Motion)
18. Implement wizard progress persistence
19. Add backward-edit dependency validation
20. Update FAQ with wizard documentation

---

## Accessibility Considerations

- **Focus Trapping:** Keep focus within wizard modal
- **Step Announcements:** `aria-live` region for step changes
- **Skip Links:** "Skip to summary" for keyboard users
- **Reduced Motion:** Disable dice animations if `prefers-reduced-motion`
- **Semantic HTML:** Proper heading hierarchy per step

---

## Testing Criteria

After implementation, verify:

1. Fresh app load shows QuickStartModal
2. Quick Start creates character with correct defaults
3. All 7 steps navigate correctly
4. Standard Array drag-and-drop works
5. 4d6 roll generates and assigns correctly
6. Level < 3 restricts magic paths
7. Equipment presets filter by level
8. Game Mode affects step restrictions
9. Back navigation preserves state
10. Summary shows all selected values
11. "Begin Adventure" creates character correctly
12. App reset triggers wizard
13. Cloud Load option opens modal
14. Wizard progress persists on browser close
15. Resume prompt appears for in-progress wizard
