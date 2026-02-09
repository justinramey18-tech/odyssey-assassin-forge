
# Implementation Plan: Wizard as First Full Spellcaster Class

## Executive Summary
This plan implements the **Wizard** class as the first full spellcaster, creating shared infrastructure that all future classes (Sorcerer, Cleric, Druid, Bard, Warlock) will reuse. The Wizard is ideal for this because it's the quintessential prepared caster with Intelligence-based spellcasting and full slot progression.

---

## Current State Analysis

### What Already Exists (Backend Ready)
- `useMulticlass` hook - calculates maxHP, spell slots, hit dice pools
- `useClassSpellcasting` hook - full spell management for non-Rogue classes
- `CLASS_REGISTRY` with Wizard configuration (INT-based, prepared caster, d6 hit die)
- `FULL_CASTER_SLOTS` table - proper 1st-20th level slot progression
- Multiclass spell slot calculator combining full caster levels
- Character wizard saves `primaryClass` to character state

### What's Missing (UI Disconnected)
- **Index.tsx** still uses `useSpellcasting` (Rogue paths) for everyone
- **MagicScreen** only shows 4 Rogue magic paths (Arcane Trickster, etc.)
- No UI for class-based spellbooks
- No Wizard spell list exists (only path-restricted spells)
- Legacy HP calculation still used instead of multiclass-aware version

---

## Implementation Phases

### Phase 1: Add `classes` Field to Spell Type
**File:** `src/lib/magic/types.ts`

Extend `SpellDefinition` to support class-based filtering:

```text
interface SpellDefinition {
  // ... existing fields ...
  pathRestrictions?: MagicPath[];  // Existing (for Rogue paths)
  classes?: DnDClass[];            // NEW: Which classes can learn this
}
```

This allows spells to be tagged for both systems - backward compatible with existing Rogue paths.

---

### Phase 2: Create Wizard Spell List
**New File:** `src/lib/magic/spells/wizard-spells.ts`

Add Wizard-specific spells organized by level:

**Cantrips (8-10 spells):**
- Fire Bolt, Ray of Frost, Prestidigitation, Light, Mage Hand
- Minor Illusion, Shocking Grasp, Chill Touch, Message, Mending

**1st Level (10-12 spells):**
- Magic Missile, Shield, Mage Armor, Detect Magic, Find Familiar
- Sleep, Charm Person, Disguise Self, Identify, Feather Fall

**2nd Level (8-10 spells):**
- Misty Step, Invisibility, Hold Person, Mirror Image, Scorching Ray
- Shatter, Suggestion, Web, Darkness, See Invisibility

**3rd Level (6-8 spells):**
- Fireball, Counterspell, Dispel Magic, Fly, Haste
- Lightning Bolt, Slow, Hypnotic Pattern

**4th Level (4-6 spells):**
- Polymorph, Greater Invisibility, Dimension Door, Wall of Fire
- Banishment, Ice Storm

**5th Level (4-6 spells):**
- Telekinesis, Hold Monster, Cone of Cold, Wall of Force
- Animate Objects, Scrying

Each spell includes:
- `classes: ['wizard']` tag
- Full 5e-accurate mechanics (save DC, damage, duration)
- Oracle personality quips (thunderhead/jarvis/deadpool)

---

### Phase 3: Update Spell Index
**File:** `src/lib/magic/spells/index.ts`

Add utility functions for class-based spell retrieval:

```text
// New function
export function getSpellsByClass(classId: DnDClass): SpellDefinition[] {
  return ALL_SPELLS.filter(spell => 
    spell.classes?.includes(classId) ?? false
  );
}

// New function
export function getClassSpellsByLevel(
  classId: DnDClass, 
  level: number
): SpellDefinition[] {
  return ALL_SPELLS.filter(spell => 
    spell.level === level && 
    (spell.classes?.includes(classId) ?? false)
  );
}
```

---

### Phase 4: Create ClassSpellcastingScreen Component
**New File:** `src/components/magic/ClassSpellcastingScreen.tsx`

New UI component for full caster classes (similar to MagicScreen but class-based):

**Features:**
- Header showing class name, spell attack bonus, save DC
- Spell slot tracker (1st-9th level for full casters)
- Spellbook tab with class-specific spell grid
- Preparation panel (Wizard prepares INT mod + level spells)
- Concentration tracker
- Material components panel
- Active spells panel

**Props:**
```text
interface ClassSpellcastingScreenProps {
  primaryClass: DnDClass;
  characterLevel: number;
  characterName: string;
  spellcasting: UseClassSpellcastingReturn;
  conModifier?: number;
  proficiencyBonus?: number;
}
```

---

### Phase 5: Create ClassSpellbookGrid Component
**New File:** `src/components/magic/ClassSpellbookGrid.tsx`

Spell display grid filtered by class instead of path:

```text
interface ClassSpellbookGridProps {
  classId: DnDClass;
  characterLevel: number;
  knownSpells: string[];
  preparedSpells: string[];
  favoriteSpells: string[];
  concentratingOn: string | null;
  maxSpellLevel: number;
  onSpellSelect: (spell: SpellDefinition) => void;
}
```

Displays:
- Cantrips section (always available)
- Leveled spell sections (1st through maxSpellLevel)
- Filter by school, search by name
- Preparation status indicators
- Concentration indicators

---

### Phase 6: Wire Up Index.tsx

**File:** `src/pages/Index.tsx`

**Changes:**

1. **Import new hook and component:**
```text
import { useMulticlass } from '@/hooks/use-multiclass';
import { useClassSpellcasting } from '@/hooks/use-class-spellcasting';
import { ClassSpellcastingScreen } from '@/components/magic/ClassSpellcastingScreen';
```

2. **Instantiate useMulticlass hook (after abilityScores):**
```text
const multiclass = useMulticlass({
  character,
  abilityScores: abilityScores.baseScores,
  constitutionModifier: scoreToModifier(abilityScores.finalScores.constitution),
  prestigeLevel: prestigeData.prestigeLevel,
});
```

3. **Determine if Rogue or other class:**
```text
const isRogueClass = (character.primaryClass ?? 'rogue') === 'rogue';
```

4. **Conditional spellcasting hook:**
```text
// Existing spellcasting hook for Rogues
const spellcasting = useSpellcasting(character.level, character.name, {
  abilityScores: { ... }
});

// New class spellcasting for non-Rogues
const classSpellcasting = useClassSpellcasting(
  character.primaryClass ?? 'rogue',
  character.level,
  character.multiclassLevels ?? {},
  character.name,
  { abilityScores: { ... } }
);
```

5. **Use multiclass-aware HP:**
```text
const calculatedMaxHP = useMemo(() => {
  if (isRogueClass) {
    // Legacy calculation for backward compatibility
    const conMod = scoreToModifier(abilityScores.finalScores.constitution);
    return calculateMaxHP(character.level, conMod, prestigeData.prestigeLevel);
  }
  // New multiclass-aware calculation
  return multiclass.maxHP;
}, [isRogueClass, character.level, abilityScores.finalScores.constitution, prestigeData.prestigeLevel, multiclass.maxHP]);
```

6. **Conditional Arcana tab rendering:**
```text
{activeTab === 'arcana' && (
  <BackgroundWrapper ...>
    {isRogueClass ? (
      <MagicScreen
        characterLevel={character.level}
        characterName={character.name}
        spellcasting={spellcasting}
        ...
      />
    ) : (
      <ClassSpellcastingScreen
        primaryClass={character.primaryClass ?? 'wizard'}
        characterLevel={character.level}
        characterName={character.name}
        spellcasting={classSpellcasting}
        conModifier={...}
        proficiencyBonus={...}
      />
    )}
  </BackgroundWrapper>
)}
```

---

### Phase 7: Update Wizard Summary Step
**File:** `src/components/wizard/steps/SummaryStep.tsx`

Show class-specific information in summary:
- Class name and hit die (d6 for Wizard)
- Primary ability (Intelligence)
- Spellcasting ability indicator
- "Prepared Caster" badge
- Starting spell slots preview

---

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/magic/types.ts` | Modify | Add `classes?: DnDClass[]` to SpellDefinition |
| `src/lib/magic/spells/wizard-spells.ts` | Create | 40+ Wizard spells (cantrips through 5th level) |
| `src/lib/magic/spells/index.ts` | Modify | Add `getSpellsByClass()` utility |
| `src/components/magic/ClassSpellcastingScreen.tsx` | Create | Main UI for class-based spellcasting |
| `src/components/magic/ClassSpellbookGrid.tsx` | Create | Spell grid filtered by class |
| `src/components/magic/index.ts` | Modify | Export new components |
| `src/pages/Index.tsx` | Modify | Wire up useMulticlass, conditional rendering |
| `src/components/wizard/steps/SummaryStep.tsx` | Modify | Show class info in summary |

---

## Testing Criteria

### Create Wizard Character Flow
1. Start character wizard, select Wizard class
2. Complete wizard through to summary
3. Verify "Wizard" and "d6" shown in summary
4. Finish wizard, verify character is saved with `primaryClass: 'wizard'`

### Arcana Tab Rendering
1. Open Arcana tab as Wizard
2. Verify ClassSpellcastingScreen renders (not MagicScreen)
3. Verify Wizard spell list is shown (Fire Bolt, Magic Missile, etc.)
4. Verify spell slots are full caster progression (2 slots at level 1)

### Spell Management
1. Learn a spell (e.g., Magic Missile)
2. Prepare the spell
3. Cast the spell, verify slot is consumed
4. Long rest, verify slots restored

### HP Calculation
1. Create Level 1 Wizard with +2 CON mod
2. Verify max HP = 6 (d6 max) + 2 (CON) = 8
3. Level up to 2, verify HP = 8 + 4 (d6 avg) + 2 (CON) = 14

### Backward Compatibility
1. Load existing Rogue character
2. Verify MagicScreen still shows with path selection
3. Verify HP calculation unchanged
4. Verify all existing functionality works

---

## Shared Infrastructure Benefit

Once Wizard is complete, adding other classes requires only:

| Class | Effort | Notes |
|-------|--------|-------|
| Sorcerer | Low | Same UI, just needs spell list + Sorcery Points |
| Cleric | Low | Prepared caster like Wizard, needs domain spells |
| Druid | Low | Prepared caster, needs Wild Shape UI later |
| Bard | Medium | Known caster, needs different UI flow |
| Warlock | Medium | Pact Magic already calculated, needs Invocations |

The `ClassSpellcastingScreen`, `ClassSpellbookGrid`, and `useClassSpellcasting` hook will be reused by all of these.

---

## Estimated Effort

- **Phase 1**: ~20 lines (type extension)
- **Phase 2**: ~600 lines (spell definitions with quips)
- **Phase 3**: ~30 lines (utility functions)
- **Phase 4**: ~350 lines (main screen component)
- **Phase 5**: ~200 lines (spellbook grid)
- **Phase 6**: ~80 lines (Index.tsx wiring)
- **Phase 7**: ~50 lines (summary step update)

**Total**: ~1,300 lines of code across 8 files

---

## Risk Mitigation

1. **Backward Compatibility**: All Rogue functionality preserved via `isRogueClass` checks
2. **Data Migration**: Existing characters without `primaryClass` default to `'rogue'`
3. **Incremental Testing**: Each phase is independently testable
4. **Fallback**: If class spellcasting fails, gracefully fall back to existing MagicScreen
