

## Enrich Party Member Card Detail View

### Problem
When tapping a party member's card, the bottom sheet only shows their **quick actions** (weapons, abilities, spells, cantrips, consumables). It lacks key build context that helps party members coordinate — things like race, ability scores, equipment, and class features.

### What to Add

Expand the `character_status` broadcast payload and the viewer sheet to include:

1. **Race & Gender** — basic identity at a glance (e.g. "Half-Elf Female")
2. **Ability Scores** — the six core stats (STR/DEX/CON/INT/WIS/CHA) with modifiers, displayed as a compact grid
3. **Key Equipment** — weapon and armor names currently equipped (just names, not full stats — keeps payload small)
4. **Resistances / Immunities** — if the character has any condition immunities or damage resistances from their build
5. **Multiclass Info** — if multiclassed, show the class split (e.g. "Rogue 5 / Wizard 3")

### Implementation

**1. Expand `character_status` type and broadcast** (`use-party-sync.ts` + `Index.tsx`)
- Add optional fields to the `PartyMember.character_status` type: `race`, `gender`, `abilityScores` (object of 6 numbers), `equippedGear` (array of `{slot, name}`), `multiclassLevels`
- In `Index.tsx`, include these in the `broadcastStatus` call using data already available from existing hooks (`useCharacterIdentity`, `abilityScores.finalScores`, `equipment.slots`, `character.multiclassLevels`)

**2. Add a "Build Overview" header section to the viewer sheet** (`PartyMemberQuickActionsViewer.tsx`)
- Below the name/class header, add:
  - Race & gender line (if present)
  - Multiclass breakdown (if multiclassed)
  - Compact 3×2 grid of ability scores with modifiers
  - Equipped gear summary (collapsed by default)
- Keep existing quick actions sections below, unchanged

**3. Files changed**
- `src/hooks/use-party-sync.ts` — extend `character_status` type with new optional fields
- `src/pages/Index.tsx` — add identity/scores/gear to `broadcastStatus` call
- `src/components/party/PartyMemberQuickActionsViewer.tsx` — render new build overview sections above existing quick actions

No database changes needed — all data flows through the existing realtime `character_status` JSON column.

