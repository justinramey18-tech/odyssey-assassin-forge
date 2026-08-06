# Accepted loot gear becomes equippable gear

Today, every item you accept from the AI DM lands in the loot stash only, even when it is a helmet, sword or ring. This makes wearable items show up in your Gear tab instead.

## What changes

- When you accept an item from the DM, the app decides whether it is wearable gear (head, chest, arms, waist, legs, cloak, main hand, offhand, ranged, amulet, rings) or ordinary loot.
- Wearable gear goes into your Gear inventory only, not the loot stash. Everything else (potions, treasure, trinkets, quest items) keeps going to the loot stash exactly as it does now.
- If the matching body slot is empty, the item is worn automatically. If something is already there, the new piece waits in your gear inventory so you can compare and swap.
- Gear you no longer want can be sold from the Gear tab using the existing sell flow there.
- A short confirmation message tells you what happened ("Equipped" vs "Added to gear inventory").

## How the slot is chosen

The DM's item description already reports a rough category (weapon, armour, trinket, and so on). On top of that, the item's name is matched against common wording to pick the exact body slot:

```text
helm, helmet, hood, crown, circlet, cap, mask   -> Head
breastplate, chestplate, armour, cuirass, robe  -> Chest
gauntlets, gloves, bracers, vambraces           -> Arms
belt, girdle, sash                              -> Waist
greaves, boots, leggings, trousers, sabatons    -> Legs
cloak, cape, mantle, shroud                     -> Cloak
shield, buckler                                 -> Offhand
bow, crossbow, sling, javelin                   -> Ranged
sword, axe, mace, dagger, staff, spear, hammer  -> Main hand
amulet, necklace, pendant, talisman             -> Amulet
ring, band, signet                              -> Ring (first free ring slot)
```

If the DM says it is a weapon or armour but no keyword matches, it falls back to main hand for weapons and chest for armour. If nothing suggests wearable gear at all, the item stays as loot.

## Item details carried over

The gear entry keeps the DM's description, rarity, gold value and any damage or bonus values that came with the award, so the Gear tab tooltip and the sell price are meaningful rather than blank.

## Technical notes

- New helper `src/lib/inventory/dmGearIntake.ts`: maps an accepted DM item (name, category, rarity, gold value, description, effect, dice) to either an `EquipmentItem` or `null`, including slot inference, rarity mapping (loot's `very_rare` maps to `epic`), damage/AC extraction from the dice/effect text, and `value` set from the awarded gold value (minimum 1 so it is sellable).
- `onAcceptDmItem` in `src/pages/Index.tsx` calls the helper first: on a match it pushes into `equipment.inventory` via `setEquipment`, auto-equipping into `equipment.slots[slot]` when that slot is `null` (rings check `ring1` then `ring2`); otherwise it falls through to the existing `loot.addLootItems` path unchanged.
- Selling already works from the Gear tab through `UnifiedInventoryScreen` / `SellItemDrawer`, so no new sell code is needed.
- No storage-key or schema changes; gear rides along with the existing equipment autosave.
