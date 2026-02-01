

# Enhanced Flexible Multi-Path Magic System: Maximum Utility, Integration & Immersion

## Executive Summary

A standalone spellcasting system that mirrors your existing architectural patterns (ability trees, prestige, conditions) while adding full D&D 5e spellcasting complexity. Designed for seamless integration with your Oracle, Combat HUD, Conditions, and Rest systems.

---

## I. Enhanced Utility Features

### 1. Spell Slots Visualization

| Standard | Enhanced |
|----------|----------|
| Simple pip display | **Energy-ring visualization** inspired by `InfinityGauntletStyles.css` |
| Manual tracking | **Auto-rest recovery** integrated with existing Short/Long Rest handlers |
| Static UI | **Animated consumption** with school-colored energy effects |

**Visual Design:**
- Each spell level gets a row of "energy orbs" (similar to condition severity animations)
- Consumed slots fade with a drain animation; recovered slots pulse with restoration glow
- Warlock "Pact Slots" have distinct violet styling and recover on Short Rest

### 2. Spellbook Management

**Preparation Flow:**
- Daily preparation limit based on path (e.g., Arcane Trickster: INT mod + 1/3 level)
- Drag-and-drop spell ordering (mobile: tap-to-select, then tap destination)
- Smart filtering: By school, level, concentration, ritual, prepared status
- "Quick Prepare" suggestions based on Oracle analysis of current conditions/buffs

**Spell Search:**
- Fuzzy search by name, school, or effect keywords
- "Recently Cast" section for quick access
- "Favorited" spells pinned to top

### 3. Component Tracking

| Component Type | UI Element | Automation |
|----------------|------------|------------|
| **Verbal (V)** | Mic icon | Silence condition blocks casting |
| **Somatic (S)** | Hand icon | Restrained condition blocks casting |
| **Material (M)** | Pouch icon | Component inventory with quantities |
| **M (consumed)** | Flame icon | Auto-deduct on cast |
| **Focus** | Crystal icon | Bypasses non-consumed materials |

**Component Pouch Widget:**
- Collapsible inventory of material components
- Auto-warning when casting a spell with insufficient materials
- Integration with Consumables system for shared inventory logic

### 4. Ritual Casting Mode

- Toggle "Ritual" on eligible spells
- UI shows extended casting time (10 minutes base)
- No slot consumption, but cannot be rushed
- Oracle personality comments:
  - Thunderhead: "Ritual efficiency detected. 10-minute casting window initiated."
  - JARVIS: "Ritual casting mode engaged, Sir. I'll notify you upon completion."
  - Deadpool: "Ooh, ritual time! Sit back, relax, maybe do some stretches..."

---

## II. Seamless UI Integration

### 1. Navigation Tab: "Arcana"

**Position:** Between "Abilities" and "Legacy" in `AssassinHeader.tsx`

**Visual Treatment:**
- Icon: `Wand2` (Lucide) with sparkle animation on active
- Color: Indigo/magenta gradient (`from-indigo-600/30 to-purple-600/30`)
- Active border: `border-indigo-500`
- Glow animation matching other tabs (`animate-glow-pulse`)

```
[ Combat ] [ Skills ] [ Abilities ] [ ✨ Arcana ✨ ] [ Legacy ] [ Gear ]
```

### 2. Magic Screen Layout

**Desktop:** 3-column layout
- Left: Path selector + path abilities overview
- Center: Spellbook grid with school-colored borders
- Right: Spell details panel (matches `AbilityDetailsPanel` structure)

**Mobile:** Single-column with bottom sheet details
- Path tabs at top (styled like `BranchSelector` in Prestige)
- Swipe between: Spellbook → Slots → Components
- Bottom sheet for spell details (matches `PrestigeAbilityDetails`)

### 3. Home Screen Integration

**New Drawer Option:**
- Add "Arcana" to `drawerOptions` in `HomeScreen.tsx`
- Icon: `Sparkles` with `text-indigo-400`
- Opens quick spell slot status and prepared spell list

**Quick Stats Enhancement:**
- Optional 4th stat card showing "Spell Slots" with mini energy ring
- Tap opens Arcana drawer

### 4. Combat HUD Integration

**New Tab: "Spells"**
- Position after "Abilities" in `TAB_ORDER`
- Shows prepared spells with quick-cast buttons
- Spell slot consumption inline
- Concentration indicator in `ConditionStrip`

**Quick Cast Flow:**
1. Tap spell card
2. Select slot level (if upcastable)
3. Roll (if applicable)
4. Auto-add concentration condition (if applicable)
5. Generate narrative prompt with personality flavor

**Combat Bottom Nav Enhancement:**
- Add `Wand2` icon for Spells tab with badge showing remaining slots

---

## III. Deepened Immersion

### 1. Path Identity System

Each magic path has a distinct **visual identity** and **personality flavor**:

| Path | Visual Theme | Oracle Flavor | Unique Mechanic |
|------|--------------|---------------|-----------------|
| **Arcane Trickster** | Emerald/silver, illusory shimmer | "Your magical prestidigitation..." | Mage Hand Legerdemain prompts |
| **Shadow Blade** | Deep purple/black, shadow tendrils | "The Shadowfell responds..." | Teleportation flavor text |
| **Eldritch Knight** | Steel blue/amber, rune glow | "Your blade resonates with..." | Weapon bond effects |
| **Hexblade** | Violet/crimson, eldritch energy | "Your patron whispers..." | Invocation selection |

### 2. Personality-Voiced Spellcasting

**Spell Cast Prompts** (integrated with Oracle personalities):

| Event | Thunderhead | JARVIS | Deadpool |
|-------|-------------|--------|----------|
| **Spell success** | "Arcane probability: 94.7%. Execution: optimal." | "Excellent form, Sir. The weave responds beautifully." | "MAGIC MISSILE GO BRRRR! Three little blue darts of 'go away'!" |
| **Concentration start** | "Mental bandwidth allocated. Monitoring stability." | "Concentration lock engaged. I shall monitor for disruptions." | "Okay, focusing now. Don't think about tacos. DON'T THINK ABOUT TACOS." |
| **Concentration save** | "Neural stability: 78.3%. Probability of failure: 21.7%." | "Concentration check required, Sir. Current strain levels: elevated." | "Quick! Think about literally ANYTHING except dropping this spell!" |
| **Slot exhausted** | "Arcane reserves depleted for this tier." | "I'm afraid that slot is... unavailable, Sir." | "Empty! Just like my bank account and emotional availability!" |

### 3. Spell School Visual Language

Borrow from `ConditionStyles.css` severity animations:

| School | Color | Animation | Icon |
|--------|-------|-----------|------|
| **Abjuration** | Blue | Shield pulse | `Shield` |
| **Conjuration** | Teal | Portal swirl | `Sparkles` |
| **Divination** | Violet | Eye glow | `Eye` |
| **Enchantment** | Pink | Heart beat | `Heart` |
| **Evocation** | Orange/Red | Fire burst | `Flame` |
| **Illusion** | Silver | Shimmer fade | `Ghost` |
| **Necromancy** | Green/Black | Skull pulse | `Skull` |
| **Transmutation** | Gold | Alchemical glow | `FlaskConical` |

### 4. Concentration Integration with Conditions

**Auto-Add "Concentrating" Buff:**
- When casting concentration spell, auto-add to Condition Status Board
- Duration: Matches spell duration
- Visual: Distinct styling (blue glow, eye icon overlay)
- Oracle context: Included in `activeBuffs` for tactical advice

**Concentration Break Flow:**
1. When damage taken, prompt for CON save
2. DC = 10 or half damage (whichever higher)
3. Quick buttons: [Passed] / [Failed]
4. On failure: Auto-remove concentration buff + spell effect
5. Personality-flavored toast notification

### 5. Spell Prompt Generation

Extend `generateRPPrompt` pattern to `generateSpellPrompt`:

```typescript
interface SpellPrompt {
  spell: SpellDefinition;
  castLevel: number;
  characterName: string;
  path: MagicPath;
  roll?: DiceRoll; // For attack spells
  saveDC?: number; // For save-based spells
  targets?: string[];
  personality: Personality;
}
```

**Output Example (Deadpool personality, Magic Missile):**
```markdown
## Spell Cast: Magic Missile

**Character:** Wade Wilson
**Spell:** Magic Missile (1st Level Evocation)
**Path:** Arcane Trickster — because why just stab when you can stab AND do magic?
**Cast Level:** 1st (3 darts) | **Slot Used:** 1/3 remaining

---

### The Moment

Wade flicks his fingers like he's tossing invisible playing cards. Three glowing blue darts of pure force materialize, each one unerringly locked onto its target.

*"Pew pew pew! These babies NEVER miss. Unlike my love life. And my fashion sense. And most of my life choices, really..."*

**Damage:** 3 darts × (1d4+1) = [3, 2, 4] = **9 force damage** (auto-hit)

---

### Scene Direction for AI DM

The darts streak toward the target with perfect accuracy. Force magic doesn't care about cover or armor—describe the impact as pure kinetic punishment. The target staggers from the triple impact.

**Narrative Hooks:**
- Does the target realize they can't dodge these?
- What's Wade's quip as the darts connect?

---

*Cast: Magic Missile (1st) | Slots: 1/3 1st-level remaining*
```

### 6. Rest Integration

**Short Rest (for Hexblade/Warlock path):**
- Pact Slots fully recover
- Other paths: No slot recovery
- Toast with personality flavor

**Long Rest (all paths):**
- All spell slots recover
- Prepared spells can be changed
- Concentration effects end (with warning)
- Toast: "Arcane reserves restored."

---

## IV. Technical Architecture

### New File Structure

```
src/lib/magic/
├── types.ts                 # Core interfaces
├── paths/
│   ├── types.ts             # MagicPath, PathConfig
│   ├── arcane-trickster.ts  # Path definition
│   ├── shadow-blade.ts
│   ├── eldritch-knight.ts
│   ├── hexblade.ts
│   └── index.ts
├── spells/
│   ├── types.ts             # SpellDefinition, SpellSlot
│   ├── cantrips.ts
│   ├── 1st-level.ts
│   ├── 2nd-level.ts
│   ├── 3rd-level.ts
│   ├── 4th-level.ts
│   └── index.ts
├── components.ts            # Material component catalog
├── schools.ts               # School visual config
├── prompts.ts               # Spell RP prompt generator
└── index.ts

src/hooks/use-spellcasting.ts  # State management hook

src/components/magic/
├── MagicScreen.tsx          # Main tab component
├── PathSelector.tsx         # Path selection tabs
├── SpellbookGrid.tsx        # Spell display grid
├── SpellCard.tsx            # Individual spell display
├── SpellDetailsSheet.tsx    # Bottom sheet details
├── SpellSlotTracker.tsx     # Slot visualization
├── SpellCastSheet.tsx       # Casting modal with upcast
├── ComponentPouch.tsx       # Material components inventory
├── ConcentrationWidget.tsx  # Concentration status
├── MagicStyles.css          # School-based animations
└── index.ts

src/components/combat/mobile/
├── MobileSpellList.tsx      # Combat spell grid (new)
└── SpellCastFAB.tsx         # Quick-cast button (new)
```

### Key Type Definitions

```typescript
// Magic Path
type MagicPath = 'arcane_trickster' | 'shadow_blade' | 'eldritch_knight' | 'hexblade';

interface PathConfig {
  id: MagicPath;
  name: string;
  subtitle: string;
  icon: LucideIcon;
  primaryColor: string;
  spellcastingAbility: 'INT' | 'CHA' | 'WIS';
  spellListRestrictions?: SpellSchool[];
  slotProgression: 'third' | 'half' | 'pact';
  features: PathFeature[];
}

// Spell Definition
interface SpellDefinition {
  id: string;
  name: string;
  level: 0 | 1 | 2 | 3 | 4; // 0 = cantrip
  school: SpellSchool;
  castingTime: 'action' | 'bonus_action' | 'reaction' | 'ritual';
  range: string;
  components: {
    verbal: boolean;
    somatic: boolean;
    material?: string;
    materialConsumed?: boolean;
    materialCost?: number;
  };
  duration: string;
  concentration: boolean;
  description: string;
  upcastEffect?: string;
  attackType?: 'melee' | 'ranged' | 'save';
  saveStat?: 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
  damageType?: string;
  icon: string;
  personalityQuips: {
    thunderhead: string;
    jarvis: string;
    deadpool: string;
  };
}

// Active Spellcasting State
interface SpellcastingState {
  path: MagicPath | null;
  knownSpells: string[];       // Spell IDs
  preparedSpells: string[];    // Subset of known
  spellSlots: Record<number, { current: number; max: number }>;
  pactSlots?: { current: number; max: number; level: number };
  spellcastingAbility: 'INT' | 'CHA' | 'WIS';
  proficiencyBonus: number;
  materialComponents: Record<string, number>; // Component ID -> quantity
  focusEquipped: boolean;
  concentratingOn: string | null; // Spell ID
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/navigation/AssassinHeader.tsx` | Add "Arcana" tab with indigo styling |
| `src/pages/Index.tsx` | Add `arcana` to tab types, integrate `useSpellcasting` hook, add `<MagicScreen />` |
| `src/components/home/HomeScreen.tsx` | Add "Arcana" to `drawerOptions`, optional spell slot stat card |
| `src/components/drawers/PromptDrawerProvider.tsx` | Add `arcanaOpen` state, pass spellcasting data to Oracle |
| `src/components/oracle/types.ts` | Add `spellcasting` to `CharacterContext` |
| `supabase/functions/oracle-assistant/index.ts` | Include spell slots, concentration, path in context |
| `src/components/combat/mobile/MobileCombatLayout.tsx` | Add `spells` tab, integrate concentration with conditions |
| `src/components/combat/mobile/CombatBottomNav.tsx` | Add spell tab with slot count badge |
| `src/hooks/use-conditions.ts` | Add `addConcentrationCondition` helper |
| `src/components/conditions/ConditionStatusBoard.tsx` | Special styling for concentration buffs |

---

## V. Implementation Phases

### Phase 1: Foundation (Types + Path Selection) ✅ COMPLETE
- ✅ Created `src/lib/magic/types.ts` - Core type system with slot progression tables
- ✅ Created `src/lib/magic/schools.ts` - School visual configurations  
- ✅ Created `src/lib/magic/paths/` - All 4 path definitions (Arcane Trickster, Shadow Blade, Eldritch Knight, Hexblade)
- ✅ Created `src/hooks/use-spellcasting.ts` - Full state management with localStorage persistence
- ✅ Created `src/components/magic/MagicScreen.tsx` - Path selection and placeholder spellbook UI
- ✅ Added "Arcana" tab to `AssassinHeader.tsx` with indigo styling
- ✅ Integrated into `Index.tsx` with full tab routing

### Phase 2: Spellbook Core
- Build spell database (cantrips + 1st-2nd level for each path)
- Create `MagicScreen.tsx` with path selector and spell grid
- Implement spell details sheet
- Add spell slot tracker visualization

### Phase 3: Casting Flow
- Build `SpellCastSheet.tsx` with upcast selection
- Integrate concentration with Condition Status Board
- Add component tracking
- Create spell RP prompt generator with personality support

### Phase 4: Combat + Oracle Integration
- Add "Spells" tab to Combat HUD
- Implement quick-cast flow
- Update Oracle context with spellcasting state
- Add spell-aware Oracle suggestions

### Phase 5: Polish
- Ritual casting mode
- Full material component inventory
- Spell search/filtering
- Session statistics for Chronicle Sync

---

## VI. Oracle Integration Summary

**New Context Fields:**
```typescript
interface CharacterContext {
  // ...existing fields...
  spellcasting?: {
    path: MagicPath;
    pathName: string;
    slotsRemaining: Record<number, number>;
    preparedSpells: string[];
    concentratingOn: string | null;
    spellAttackBonus: number;
    spellSaveDC: number;
  };
}
```

**Smart Suggestions:**
- "You have 2 1st-level slots remaining. Consider Shield if you expect to be targeted."
- "Warning: Casting a concentration spell will end your current Invisibility."
- "Your spell save DC is 14. Against this target's likely WIS save, success probability is approximately 65%."

---

## VII. Differentiation from Ability Trees

| Aspect | Ability Trees | Magic System |
|--------|---------------|--------------|
| **Progression** | Tier 1→2→3 per ability | Spell level access via path progression |
| **Resource** | Ability Points (permanent) | Spell Slots (per-rest) |
| **Cost** | Points invested | Slots consumed per cast |
| **Recovery** | N/A (permanent upgrades) | Short Rest (Pact) / Long Rest (all) |
| **Customization** | Tree builds | Spell preparation |
| **Combat** | Equipped loadout | Prepared spells + available slots |

This maintains the fantasy of being a **martial class with magical augmentation**, not a full caster—you're still an Assassin who happens to have picked up some tricks.

---

# Mobile-First Conditions System

## Overview
A D&D 5e status conditions system designed for fast combat tracking on mobile devices. Tracks debuffs (Poisoned, Stunned), buffs (Blessed, Hasted), and concentration spells with TTRPG-appropriate duration tracking.

## Critical Domain Logic Clarifications

### 1. Duration Mechanics: Rounds & Minutes

**Round-based durations:**
- Decrement by 1 each time `endTurn()` is called
- Auto-remove when `durationValue` reaches 0
- Toast notification: "Stunned wore off"

**Minute-based durations:**
- **10 rounds = 1 minute** (D&D 5e standard: 6 seconds/round)
- Internal tracking uses `roundsElapsed` counter
- Every 10th `endTurn()` call decrements minute-based conditions by 1
- Display shows minutes remaining, not rounds
- Example: "Blessed (2 min)" → after 10 turns → "Blessed (1 min)"

```typescript
interface ActiveCondition {
  // ...existing fields
  roundsElapsed: number; // Tracks rounds for minute conversion
}

const endTurn = () => {
  setConditions(prev => prev.map(c => {
    if (c.durationType === 'rounds') {
      return { ...c, durationValue: c.durationValue - 1 };
    }
    if (c.durationType === 'minutes') {
      const newRoundsElapsed = c.roundsElapsed + 1;
      if (newRoundsElapsed >= 10) {
        return { ...c, durationValue: c.durationValue - 1, roundsElapsed: 0 };
      }
      return { ...c, roundsElapsed: newRoundsElapsed };
    }
    return c;
  }).filter(c => c.durationValue > 0 || c.durationType === 'save_ends' || c.durationType === 'indefinite'));
};
```

### 2. Concentration Break Behavior

**Triggers for concentration break:**
- Manual "Break Concentration" button tap
- Taking damage (user confirms failed CON save)
- Casting another concentration spell (auto-detected)
- Incapacitated/Unconscious condition applied

**Break flow:**
1. Remove ALL conditions where `category === 'concentration'`
2. Display prominent toast: "Concentration broken - [Spell Name] ended"
3. If triggered by new concentration spell, apply new spell after break
4. Log to `recentConditions` for quick re-apply option

```typescript
const breakConcentration = (reason?: string) => {
  const concentrationSpells = conditions.filter(c => c.category === 'concentration');
  
  if (concentrationSpells.length === 0) return;
  
  const spellNames = concentrationSpells.map(c => c.name).join(', ');
  
  setConditions(prev => prev.filter(c => c.category !== 'concentration'));
  
  toast({
    title: "Concentration Broken",
    description: reason 
      ? `${spellNames} ended - ${reason}`
      : `${spellNames} ended`,
    variant: "destructive",
  });
};

// Auto-break when adding new concentration
const addCondition = (config: NewConditionInput) => {
  if (config.category === 'concentration') {
    const existingConcentration = conditions.find(c => c.category === 'concentration');
    if (existingConcentration) {
      breakConcentration(`Replaced by ${config.name}`);
    }
  }
  // ...add new condition
};
```

### 3. Duplicate Condition Handling

**Policy: Refresh duration, don't stack**

When adding a condition that already exists (matched by `conditionId`):
1. Find existing instance
2. Update `durationValue` to new value (refresh)
3. Reset `roundsElapsed` to 0
4. Update `source` if provided
5. Show confirmation toast: "Poisoned refreshed (1 minute)"

**Exception: Buffs that can stack** (future consideration)
- Bardic Inspiration dice could stack with flag `stackable: true`
- For MVP, no stacking - just refresh

```typescript
const addCondition = (config: NewConditionInput) => {
  const existingIndex = conditions.findIndex(c => c.conditionId === config.conditionId);
  
  if (existingIndex !== -1) {
    // Refresh existing
    setConditions(prev => prev.map((c, i) => 
      i === existingIndex 
        ? { 
            ...c, 
            durationValue: config.durationValue,
            roundsElapsed: 0,
            source: config.source ?? c.source,
            appliedAt: Date.now()
          }
        : c
    ));
    
    toast({
      title: `${config.name} refreshed`,
      description: formatDuration(config.durationType, config.durationValue),
    });
    return;
  }
  
  // Add new condition
  // ...
};
```

## Additional Production Safeguards

### Undo/Rollback
- 5-second "Undo" action on removal toasts
- Stores last removed condition in `undoBuffer`
- Tap undo → restore condition with original duration

### Performance Cap
- `MAX_ACTIVE_CONDITIONS = 15`
- Warn at 12: "Consider clearing expired conditions"
- Block at 15: "Remove a condition before adding more"

### localStorage Error Handling
```typescript
const saveToStorage = (conditions: ActiveCondition[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conditions));
  } catch (e) {
    console.error('Failed to save conditions:', e);
    toast({
      title: "Save Warning",
      description: "Conditions may not persist - storage full",
      variant: "destructive",
    });
  }
};
```

## File Structure (unchanged)
```
src/lib/conditions/     → types.ts, config.ts, index.ts
src/hooks/              → use-conditions.ts
src/components/conditions/ → ConditionDrawer, QuickBar, Card, AddSheet
```

## Implementation Order
1. Types & Config with `roundsElapsed` field
2. Hook with all 3 clarified behaviors
3. Components with undo support
4. Integration with Combat HUD and Oracle context

