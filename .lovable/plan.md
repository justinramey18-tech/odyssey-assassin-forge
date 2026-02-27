

## Plan: Auto-apply Portrait Icon, Preset Consumables + Expand Consumable Registry

### 1. Add `portraitIcon` to Character interface and apply it
**File:** `src/lib/types.ts`
- Add `portraitIcon?: string` to `Character` interface

**File:** `src/components/wizard/utils/apply-wizard-state.ts`
- In `applyWizardState`, add `portraitIcon: wizardState.portraitIcon` to the `setCharacter` updater (line 160-166)

### 2. Save preset consumables from `buildData.consumables` array
**File:** `src/lib/ai-creation/saveHomebrew.ts`
- Add a new section after homebrew consumables that processes `data.consumables` (string[] of IDs like `"potion-healing"`)
- For each ID, look it up via `getConsumableById()` from the static registry
- If found, add as a `StoredItem` (`{ consumableId, quantity }`) to the scoped `odyssey-consumables-inventory` key
- Merge with existing entries: if same consumableId already exists, increment quantity
- Track count in `summary.presetConsumables`

### 3. Expand potions registry (~15 new)
**File:** `src/lib/consumables/potions.ts`
- Add: Potion of Swimming (common), Philter of Love (uncommon), Oil of Slipperiness (uncommon), Elixir of Health (rare), Potion of Truesight (rare), Oil of Etherealness (rare), Potion of Maximum Power (rare), Potion of Giant Size (very rare), Potion of Dragon's Majesty (very rare), Potion of Watchful Rest (uncommon), Potion of Possibility (rare), Sovereign Glue (legendary), Universal Solvent (legendary), Potion of Undying (legendary)

### 4. Expand poisons registry (~10 new)
**File:** `src/lib/consumables/poisons.ts`
- Add: Pale Tincture (uncommon, ingested), Lolth's Sting (uncommon, injury), Dragon Bile (rare, contact), Demon Ichor (rare, injury), Nightmare Vapor (rare, inhaled), Shadowfell Essence (rare, inhaled), Pit Fiend Venom (very rare, injury), Eye of Basilisk (very rare, contact), Primordial Blight (legendary, injury), Crawler Mucus already exists — skip

### 5. Expand scrolls registry (~15 new)
**File:** `src/lib/consumables/scrolls.ts`
- Add: Scroll of Feather Fall (common, 1st), Scroll of Fog Cloud (common, 1st), Scroll of Charm Person (common, 1st), Scroll of Healing Word (common, 1st), Scroll of Spider Climb (uncommon, 2nd), Scroll of Mirror Image (uncommon, 2nd), Scroll of Knock (uncommon, 2nd), Scroll of Web (uncommon, 2nd), Scroll of Counterspell (rare, 3rd), Scroll of Fly (rare, 3rd), Scroll of Dispel Magic (rare, 3rd), Scroll of Fireball (rare, 3rd), Scroll of Polymorph (very rare, 4th), Scroll of Banishment (very rare, 4th), Scroll of Wall of Force (very rare, 5th)

### 6. Update edge function system prompt
**File:** `supabase/functions/ai-creation-assistant/index.ts`
- Add the new consumable IDs to the system prompt's known consumable list so the AI can reference them in the `consumables` array

