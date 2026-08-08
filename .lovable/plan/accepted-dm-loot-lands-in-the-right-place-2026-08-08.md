# Accepted DM loot lands in the right place

Right now, when you accept an item the DM awards you, wearable gear correctly goes to the Gear tab, but everything else — including potions, poisons and scrolls — is dumped in the loot stash. That means a potion the DM gives you never shows up in your consumables and can never be used from the quick action menu.

## What changes

1. **Gear (unchanged)** — helmets, armour, weapons, rings, amulets, cloaks and so on keep going to the Gear tab, auto-worn if the slot is free.

2. **Consumables now go to your consumables** — anything that reads as a potion, poison, elixir, draught, oil, scroll or similar is added to the character sheet's consumables inventory with the correct quantity, rarity, effect text and description from the DM's award. Accepting the same potion twice stacks the count instead of creating a duplicate.

3. **They appear in the quick action menu** — the Actions drawer already lists consumables, so newly accepted items show up there immediately with their count.

4. **Using them works properly**
   - If the DM's item restores health (for example "restores 2d6+2 HP"), tapping it in quick actions rolls those dice with the healing animation, applies the health, consumes one, and sends the DM a short "already resolved" note — exactly like a shop-bought healing potion.
   - If it has other dice attached (for example a damage or effect roll), tapping it rolls that die and the message sent to the DM states the item, the roll and the result.
   - If it has no dice, tapping it sends a descriptive action message describing you using the item and its stated effect, and the DM narrates the outcome.

5. **Everything else** — treasure, trinkets, quest items, crafting parts — keeps going to the loot stash exactly as today.

A short confirmation message after accepting says where the item went ("Equipped", "Added to gear inventory", "Added to consumables", "Added to loot").

## How an item is classified

Gear check runs first (existing rules). If that doesn't match, the item is treated as a consumable when the DM's category says usable/potion/scroll/poison, or when the name contains wording such as potion, elixir, draught, tonic, philter, vial, flask, oil, salve, antitoxin, poison, venom, scroll. Scroll wording maps to scroll, poison/venom to poison, everything else to potion. Anything left over is loot.

## Technical notes

- New helper `src/lib/inventory/dmConsumableIntake.ts`: `dmItemToConsumable(name, details)` returns a `Consumable` (id derived from a slug of the name so repeat awards stack) or `null`. Maps DM rarity strings to the consumables `Rarity` union, sets `type`, `effect` (from `details.effect`, falling back to dice text or description), `description`, `usageType` (`drink`/`read`/`apply`) and an icon.
- `onAcceptDmItem` in `src/pages/Index.tsx`: after the existing gear branch, call the new helper; on a match call `addConsumableItem(consumable, quantity)` and toast; otherwise fall through to the current `loot.addLootItems` path.
- Custom DM potions are not in the static registry or shop catalog, so `getHealingDiceForItem(name)` cannot find their dice. Add an optional `effect` field to the consumables entries in `CharacterContext` (built in `PromptDrawerProvider.tsx` around line 507, type in `src/components/oracle/types.ts`), and add an `effectOverride` argument to `getHealingDiceForItem` in `src/lib/consumables/healing.ts` that parses the passed effect text when the name lookup misses.
- `PartyDMQuickActions.tsx` (used by Solo, Party and Empyrean): pass `c.effect` into the healing lookup; for non-healing consumables that carry a dice string, set `rollKind` to a generic roll and include the dice in the generated prompt. Existing shop/registry behaviour is untouched.
- Consumables already persist through `use-consumables` scoped storage and the existing autosave, so no storage-key or schema changes.
