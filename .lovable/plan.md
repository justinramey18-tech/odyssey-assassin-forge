

## What the Screenshot Shows

The DM response explicitly states **"Geralt: 53/59 HP"**, yet the sub-header still shows **59/59**. The auto-sync system failed to update Geralt's HP.

## Root Causes Identified

### 1. Companion context is built once at memo time and goes stale
In `PromptDrawerProvider.tsx` (line 466-478), `aiDMCharacterContext` reads Geralt's state from `loadGeraltState()` inside a `useMemo`. This snapshot is sent to the extraction edge function as `characterContext.companion.currentHP`. However, this value is **not a dependency** of the memo -- `userId` appears in the dep array but the actual Geralt localStorage data does not trigger a re-memo. The companion HP sent to the AI extractor may be stale, but this is secondary.

### 2. The extraction prompt only looks for damage/healing deltas, not absolute HP values
The edge function (`ai-dm-extract/index.ts`) system prompt says: *"ONLY extract damage/healing when a SPECIFIC NUMBER is explicitly stated (e.g. 'takes 8 damage', 'heals 5 HP')"*. When the DM writes "Geralt: 53/59 HP" without mentioning "takes 6 damage", the extractor returns empty `companion_hp_changes` because there's no explicit delta.

### 3. No absolute HP extraction capability exists
The extraction tool schema has no field for "set HP to X". It only supports `companion_hp_changes` with `amount` + `type` (damage/healing). When the DM responds with absolute values like "53/59 HP", the system has no way to capture and apply them.

### 4. `handleCompanionHPChange` applies a delta, not an absolute set
In `AIDMScreen.tsx` (line 336-343), `handleCompanionHPChange` does `gs.currentHP + change`, which is correct for deltas but cannot handle an absolute HP set.

## Fix Plan

### Step 1: Add absolute HP fields to the extraction tool schema (edge function)
**File:** `supabase/functions/ai-dm-extract/index.ts`

- Add two new fields to the tool schema:
  - `companion_hp_absolute: { type: ["number", "null"], description: "If the DM states Geralt's exact current HP (e.g. 'Geralt: 53/59 HP'), extract that number here. null otherwise." }`
  - `hp_absolute: { type: ["number", "null"], description: "If the DM states the player's exact current HP, extract that number here. null otherwise." }`
- Add them to the `required` array
- Update the system prompt to instruct: "If the text shows an absolute HP value like 'Geralt: 53/59 HP' or 'Momo: 26/38 HP', extract the current number into the corresponding `_hp_absolute` field. PREFER absolute values when available as they are more reliable."
- Add validation: clamp to 0-999 range

### Step 2: Update the ExtractionResult type (client)
**File:** `src/hooks/use-dm-auto-sync.ts`

- Add `companion_hp_absolute: number | null` and `hp_absolute: number | null` to the `ExtractionResult` interface

### Step 3: Apply absolute HP when available (client)
**File:** `src/hooks/use-dm-auto-sync.ts`

- In `extractAndApply`, after existing companion HP delta logic, add:
  - If `result.companion_hp_absolute` is a valid number, call a new callback `onCompanionHPSet(absoluteValue)` instead of the delta-based `onCompanionHPChange`
  - If `result.hp_absolute` is a valid number, call a new callback `onHPSet(absoluteValue)` instead of the delta-based `onHPChange`
  - Absolute values take priority over deltas (skip delta application if absolute is present)

### Step 4: Add `onCompanionHPSet` callback
**File:** `src/hooks/use-dm-auto-sync.ts` (interface) and `src/components/ai-dm/AIDMScreen.tsx` (implementation)

- Add optional `onCompanionHPSet?: (hp: number) => void` and `onHPSet?: (hp: number) => void` to `AutoSyncCallbacks`
- In `AIDMScreen.tsx`, implement `handleCompanionHPSet` that directly sets Geralt's `currentHP` to the absolute value (clamped to 0..maxHP) and saves + dispatches event
- Wire it into the `useDmAutoSync` call

### Step 5: Dispatch `geralt-hp-changed` event after auto-sync sets HP
Already handled by `handleCompanionHPChange` / the new `handleCompanionHPSet` -- both call `setGeraltHp` and `saveGeraltState`, which will update the sub-header.

## Technical Details

The key insight is that the extraction AI model cannot infer delta amounts from absolute HP statements reliably (it would need to know prior HP to compute the difference). Instead, we should extract absolute HP values directly and set them, which is more robust and matches the user's preference.

The system prompt update will prioritize absolute extraction: if the DM says both "takes 6 damage" AND "Geralt: 53/59 HP", the absolute value wins on the client side.

