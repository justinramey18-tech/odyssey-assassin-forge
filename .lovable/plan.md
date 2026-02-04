# Combat AI DM Prompt Synchronization Plan

## Overview
Fix all 7 AI DM prompt sync issues to ensure Combat tab prompts include consistent time prefixes, global conditions, set bonuses, concentration state, and character context.

---

## Phase 1: Create Unified Combat Prompt Context

### Task 1.1: Create `src/lib/combat/promptContext.ts`
A single source of truth for combat prompt context that can be passed to all prompt generators.

```typescript
interface CombatPromptContext {
  characterName: string;
  currentHP: number;
  maxHP: number;
  tempHP: number;
  armorClass: number;
  
  // Global D&D conditions (from useConditions)
  activeConditions: Array<{ name: string; duration: string }>;
  
  // Combat-local modifiers
  combatModifiers: string[]; // advantage, hidden, flanking, etc.
  
  // Spellcasting state
  concentrationSpell: string | null;
  spellSaveDC: number;
  spellAttackBonus: number;
  
  // Equipment context
  activeSetBonuses: Array<{ name: string; count: number; effect: string }>;
  
  // Time context
  include4thWallTime: boolean;
}
```

**Status:** [ ] Not Started

---

## Phase 2: Fix 4th Wall Time (Issue #1)

### Task 2.1: Update `src/lib/combat/weaponConverter.ts`
- Import `applyTimePrefix` from `fourthWallTime.ts`
- Wrap `generateWeaponDMPrompt()` output with `applyTimePrefix()`

### Task 2.2: Update `src/lib/combat/combatTypes.ts`
- Import `applyTimePrefix`
- Update `formatTurnSummary()` to apply time prefix

### Task 2.3: Update `src/lib/combat/reactions.ts`
- Import `applyTimePrefix`
- Update `generateReactionClipboard()` or add wrapper function

### Task 2.4: Update `src/components/magic/SpellCastSheet.tsx`
- Import `applyTimePrefix`
- Apply to generated spell prompts before clipboard copy

### Task 2.5: Update `src/components/combat/mobile/CombatAbilityCard.tsx`
- Ensure ability prompts use `applyTimePrefix()` (may already via rpPromptGenerator)

**Status:** [ ] Not Started

---

## Phase 3: Integrate Global Conditions (Issue #2)

### Task 3.1: Update `CombatPromptContext` with condition effects
Map D&D conditions to narrative descriptions:
- Poisoned → "suffering from poison, attacks lack precision"
- Frightened → "gripped by fear, strikes with desperation"
- Blinded → "striking blindly, relying on other senses"
- etc.

### Task 3.2: Pass global conditions to combat components
- `MobileCombatLayout` and `CombatTabScreen` need access to `useConditions` state
- Pass as prop or access via context

### Task 3.3: Update prompt generators to include condition narrative
- `generateWeaponDMPrompt()` should mention active conditions
- Add condition effects section to prompts

**Status:** [ ] Not Started

---

## Phase 4: Add Set Bonus Context (Issue #3)

### Task 4.1: Calculate active set bonuses in combat
- Import set bonus calculation logic
- Pass active bonuses to prompt context

### Task 4.2: Update weapon/ability prompts
- Add "Active Set Effects" section when set bonuses are present
- Include narrative hooks for set-specific effects

**Status:** [ ] Not Started

---

## Phase 5: Add Concentration Context (Issue #4)

### Task 5.1: Pass spellcasting state to combat
- `MobileCombatLayout` needs access to `useSpellcasting` state
- Extract concentration spell name

### Task 5.2: Update prompts with concentration info
- Add "Maintaining Concentration: [Spell Name]" to prompts when active
- Include warning when action might break concentration

**Status:** [ ] Not Started

---

## Phase 6: Enhance Turn Summary (Issue #5)

### Task 6.1: Update `formatTurnSummary()` signature
Accept full `CombatPromptContext` to include:
- Character name header
- Current HP/Max HP status
- Active conditions summary
- Active concentration

### Task 6.2: Add narrative wrapper option
Optional flag to wrap mechanical summary with narrative context

**Status:** [ ] Not Started

---

## Phase 7: Fix Reaction Prompts (Issue #6)

### Task 7.1: Create `generateReactionPrompt()` function
New function that:
- Takes reaction + combat context
- Applies time prefix
- Includes current HP, conditions, etc.

### Task 7.2: Update reaction UI to use new generator
Replace static `dmPrompt` with dynamic generation

**Status:** [ ] Not Started

---

## Phase 8: Connect Consumable Prompts (Issue #7)

### Task 8.1: Update `generateConsumablePrompt()` signature
Accept optional combat context parameter

### Task 8.2: When called from Combat Items tab
- Pass current combat state
- Include weapon name if applying poison
- Include active conditions

**Status:** [ ] Not Started

---

## Implementation Order

1. **Phase 1** - Create context type (foundation for all other phases)
2. **Phase 2** - 4th Wall Time fixes (quick wins, high impact)
3. **Phase 3** - Global conditions integration (major narrative improvement)
4. **Phase 6** - Turn summary enhancement (uses context from Phase 1)
5. **Phase 4** - Set bonus context
6. **Phase 5** - Concentration context
7. **Phase 7** - Reaction prompts
8. **Phase 8** - Consumable prompts

---

## Files to Create/Modify

### New Files:
- `src/lib/combat/promptContext.ts` - Unified context type and builder

### Modified Files:
- `src/lib/combat/weaponConverter.ts` - Add time prefix
- `src/lib/combat/combatTypes.ts` - Enhanced turn summary
- `src/lib/combat/reactions.ts` - Dynamic reaction prompts
- `src/lib/consumables/prompts.ts` - Combat context support
- `src/components/combat/mobile/MobileCombatLayout.tsx` - Pass context
- `src/components/combat/CombatTabScreen.tsx` - Pass context
- `src/components/combat/mobile/CombatAbilityCard.tsx` - Verify time prefix
- `src/components/magic/SpellCastSheet.tsx` - Add time prefix

---

## Progress Tracking

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Create Unified Context | ✅ Done |
| 2 | 4th Wall Time Fixes | ✅ Done |
| 3 | Global Conditions | ⬜ Not Started |
| 4 | Set Bonus Context | ⬜ Not Started |
| 5 | Concentration Context | ⬜ Not Started |
| 6 | Turn Summary Enhancement | ✅ Done |
| 7 | Reaction Prompts | ✅ Done |
| 8 | Consumable Prompts | ⬜ Not Started |
