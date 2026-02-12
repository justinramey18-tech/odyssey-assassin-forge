

# AI Batch Generation for Homebrew Spells and Abilities

## Overview
Add an "AI Generate Multiple" feature to both the Arcana tab (spells) and Abilities tab (abilities), allowing users to describe a theme or concept and have the AI generate multiple homebrew items at once. Each tab gets a dedicated batch-generation sheet where the user provides a prompt, the AI returns multiple items, the user reviews/selects which to keep, and they're all saved in one action.

---

## How It Works

1. User taps a new "AI Generate Multiple" button (visible alongside the existing "Create" button)
2. A bottom sheet opens with a text prompt field and optional constraints (e.g., spell level range, ability tree, count)
3. User submits the prompt -- the AI generates 3-5 items in a single request
4. Results appear as a reviewable list with checkboxes -- user can toggle which to keep
5. User taps "Add Selected" to save all checked items at once

---

## File Changes

### 1. Update Edge Function: `supabase/functions/homebrew-assistant/index.ts`

- Add two new modes: `batch_spells` and `batch_abilities`
- `batch_spells` system prompt instructs the AI to return a JSON array of 3-5 complete spell objects (same schema as `spell_concept` mode but as an array)
- `batch_abilities` system prompt instructs the AI to return a JSON array of 3-5 complete ability objects (same schema as `full` mode but as an array)
- Increase `max_tokens` to 2000 for batch modes to accommodate multiple items
- Update the mode validation to accept the new modes

### 2. New Component: `src/components/magic/BatchSpellGenerateSheet.tsx`

A bottom sheet component for batch spell generation:
- **Prompt input**: Textarea where users describe what kind of spells they want (e.g., "frost-themed offensive spells for a wizard")
- **Constraints row**: Optional spell level selector and school filter
- **Count selector**: Generate 3, 4, or 5 spells (default 3)
- **Generate button**: Calls the edge function with mode `batch_spells`
- **Results list**: Each generated spell shown as a card with name, level, school, and a checkbox (all checked by default)
- **Expand/collapse**: Tap a spell card to see its full description
- **"Add All Selected" button**: Saves all checked spells via the existing `addSpell` from `useSpellCustomization`
- Loading state with a spinner and "Generating spells..." message

### 3. New Component: `src/components/abilities/BatchAbilityGenerateSheet.tsx`

A bottom sheet component for batch ability generation:
- **Prompt input**: Textarea for theme description (e.g., "shadow-themed assassin abilities")
- **Constraints row**: Tree selector (Hunter/Warrior/Assassin) and type selector (Active/Passive)
- **Count selector**: Generate 3, 4, or 5 abilities (default 3)
- **Generate button**: Calls the edge function with mode `batch_abilities`
- **Results list**: Each generated ability shown as a card with name, tree badge, action type, and a checkbox
- **Expand/collapse**: Tap to see tier descriptions
- **"Add All Selected" button**: Saves all checked abilities via the existing `addHomebrew` from `useAbilityCustomization`

### 4. Update Hook: `src/hooks/use-homebrew-assistant.ts`

- Add `generateBatchSpells(prompt, constraints)` method that calls the edge function with mode `batch_spells` and parses the JSON array response
- Add `generateBatchAbilities(prompt, context)` method that calls with mode `batch_abilities` and parses the array response
- Both methods return arrays or empty arrays on failure

### 5. Integration: Arcana Tab

- Locate the component that renders the "Create Your Own Spell" button in the Arcana tab
- Add a second button next to it: "AI Generate Multiple" with a `Sparkles` icon
- Wire it to open `BatchSpellGenerateSheet`
- Pass `addSpell` from `useSpellCustomization` as the save handler

### 6. Integration: Abilities Tab

- Locate the Homebrew tree tab or the existing "Create Homebrew Ability" button
- Add a second button: "AI Generate Multiple" with a `Sparkles` icon
- Wire it to open `BatchAbilityGenerateSheet`
- Pass `addHomebrew` from `useAbilityCustomization` as the save handler

---

## Technical Details

### Edge Function Batch Prompts

**batch_spells** system prompt will instruct the model to return:
```json
[
  { "name": "...", "level": 2, "school": "evocation", ... },
  { "name": "...", "level": 1, "school": "abjuration", ... }
]
```

**batch_abilities** system prompt will instruct the model to return:
```json
[
  { "name": "...", "actionType": "action", "usageType": "short_rest", "tier1": "...", "tier2": "...", "tier3": "...", ... },
  { "name": "...", ... }
]
```

### Validation
- Each item in the batch is validated individually before display
- Invalid items are silently filtered out
- If zero valid items remain, show an error toast and let user retry

### Error Handling
- 429 (rate limit) and 402 (credits) errors surface as toast messages
- Network failures show a retry button
- Partial parse failures: show whatever items parsed successfully

