

# Customizable and Saveable AI DM Prompts

## Overview

Currently, AI DM prompts across the Gear, Arcana, and Abilities tabs are generated on-the-fly and copied to clipboard immediately. This feature adds the ability to **view, edit, and save** customized versions of any prompt so users can refine their prompts once and reuse them.

---

## How It Works

1. **Tapping "Copy Prompt"** anywhere in the app now opens an **Edit Prompt modal** (instead of copying immediately)
2. The modal shows the generated prompt text in an editable textarea
3. Users can tweak the wording, add context, or adjust tone
4. **Save**: Persists the customized version -- next time this prompt is generated, it uses the saved version as a base
5. **Copy**: Copies the current text to clipboard
6. **Reset**: Reverts to the original auto-generated prompt
7. Saved prompts are stored in localStorage, keyed by a unique identifier (ability ID, spell ID, or gear slot type)

---

## Architecture

### New: Saved Prompt Hook

Create **`src/hooks/use-saved-prompts.ts`**:
- localStorage key: `dnd-saved-prompts`
- Stores a `Record<string, SavedPrompt>` mapping prompt keys to saved text
- Each `SavedPrompt` has: `key`, `originalPrompt`, `customPrompt`, `updatedAt`
- Methods: `getSavedPrompt(key)`, `savePrompt(key, text)`, `deleteSavedPrompt(key)`, `hasSavedPrompt(key)`

### Refactored: Universal Prompt Edit Modal

Refactor **`src/components/character/PromptEditModal.tsx`** into a more generic **`src/components/shared/PromptEditModal.tsx`**:
- Accepts: `promptKey` (unique ID), `generatedPrompt` (the auto-generated text), `title`, `subtitle`
- Loads any previously saved version for that key
- Three action buttons: **Save** (persists to localStorage), **Copy** (clipboard), **Reset** (revert to generated)
- Shows a "Customized" badge if a saved version exists
- "Save and Copy" as a combined primary action

---

## Integration Points

### Abilities Tab (`AbilitiesDrawer.tsx`, `CombatAbilityCard.tsx`)
- Replace direct `navigator.clipboard.writeText` calls with opening the Prompt Edit Modal
- Prompt key: `ability-{abilityId}`
- When a saved version exists, it is used as the base (with fresh roll data injected)

### Arcana Tab (`SpellCastSheet.tsx`, `SpellDetailsSheet.tsx`)
- Replace direct clipboard copy with the Prompt Edit Modal
- Prompt key: `spell-{spellId}` or `spell-cast-{spellId}`
- Saved spell prompts persist the user's preferred wording/format

### Gear Tab (`SlotDrawer.tsx`, `EquipmentSlotCard.tsx`)
- Add a "Copy AI Prompt" button to the SlotDrawer for equipped items
- Generates a gear-focused prompt (item name, stats, rarity, properties)
- Prompt key: `gear-{slotType}`
- Opens the Prompt Edit Modal for editing and saving

---

## Technical Details

### Files to Create

1. **`src/hooks/use-saved-prompts.ts`** -- localStorage persistence hook for saved prompt overrides
2. **`src/components/shared/PromptEditModal.tsx`** -- Universal edit/save/copy modal (refactored from existing)

### Files to Modify

1. **`src/components/drawers/AbilitiesDrawer.tsx`** -- Wire copy button to open modal instead of direct copy
2. **`src/components/combat/mobile/CombatAbilityCard.tsx`** -- Wire "Copy AI DM Prompt" to modal
3. **`src/components/magic/SpellCastSheet.tsx`** -- Wire spell cast prompt to modal
4. **`src/components/magic/SpellDetailsSheet.tsx`** -- Wire spell details copy to modal
5. **`src/components/inventory/SlotDrawer.tsx`** -- Add "Copy AI Prompt" button that opens modal for gear items
6. **`src/components/inventory/EquipmentSlotCard.tsx`** -- May need a prompt generation utility for gear

### No Backend Changes Required

All prompt customization is stored in localStorage, consistent with the app's existing persistence patterns.

