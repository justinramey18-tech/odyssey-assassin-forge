

# Healing Spell Integration in the Arcana Tab

## Problem
When casting a healing spell from the Arcana tab (via `SpellCastSheet` in `ClassSpellcastingScreen`), the spell slot is consumed but no healing is applied. The healing dice are never rolled, HP is never updated, and the party `HealTargetPicker` is never shown. The healing flow only works from the Quick Actions Drawer and Combat tab.

## Solution
Wire the Arcana tab's spell cast flow to roll healing dice, update HP in real time, and show the `HealTargetPicker` for party members -- matching the existing pattern in `QuickActionsDrawer`.

## Changes

### 1. `ClassSpellcastingScreen` -- Add healing props and logic

**New props:**
- `currentHP`, `maxHP`, `tempHP` -- current vitals
- `onHPChange` -- callback to update HP state
- `partyMembers` -- array of party members for targeting
- `userId` -- current user's ID
- `onSendHeal` -- callback to send heal action to a party member

**New state:**
- `pendingHealSpell` -- tracks a healing spell awaiting target selection

**New logic in `handleCastSpell`:**
After `castSpell()` succeeds, check if the spell has a `healingFormula`. If so:
1. Roll the healing formula using a local `rollHealingFormula` helper (same pattern as QuickActionsDrawer)
2. If in a party with other members, show the `HealTargetPicker` via `pendingHealSpell` state
3. If solo, auto-apply healing to self via `onHPChange`

**New JSX:**
- Render `HealTargetPicker` dialog with the same self/party-member selection pattern

### 2. `SpellCastSheet` -- No changes needed
The cast sheet already calls `onCast(level, usePact)` which maps to `handleCastSpell`. The healing logic will be added to the handler in `ClassSpellcastingScreen`.

### 3. `Index.tsx` -- Pass new props to `ClassSpellcastingScreen`

Pass the following additional props:
- `currentHP={effectiveCurrentHP}`
- `maxHP={effectiveMaxHP}`
- `tempHP={effectiveTempHP}`
- `onHPChange` -- same pattern used for QuickActionsDrawer (`handleHPChange`)
- `partyMembers={isPartyMode ? partySync.party.members : []}`
- `userId={user?.id}`
- `onSendHeal={isPartyMode ? partySync.sendHealAction : undefined}`

## Technical Details

### Healing Formula Roller
Reuses the same parsing logic already in `QuickActionsDrawer`:
- Resolves `mod` to spellcasting modifier (from `spellcasting.state.spellcastingModifier` or fallback to 3)
- Parses `NdM+X` patterns and rolls dice
- Returns minimum 1 HP

### Cantrip Healing
Cantrips with `healingFormula` (e.g., potential homebrew healing cantrips) will also trigger the healing flow since they pass through the same `handleCastSpell` path with `castLevel = 0`.

### Files Modified
1. `src/components/magic/ClassSpellcastingScreen.tsx` -- Add healing props, state, logic, and HealTargetPicker
2. `src/pages/Index.tsx` -- Pass HP, party, and heal props to ClassSpellcastingScreen

