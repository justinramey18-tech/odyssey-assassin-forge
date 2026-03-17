

# Fix Item Classification — Stop Treating Wondrous Items as Weapons

## The Problem

There are two classification bugs causing items like "Bag of Holding" to show up as weapons:

1. **`guessItemType()` in `shopItems.ts`** — The equipment regex only matches weapon/armor keywords (`sword|shield|armor|bow...`). "Bag of Holding" matches none, so it falls to `miscellaneous`. But wondrous items (Bag, Cloak, Boots, Rod, Staff, Wand, Cape, Robe, Mantle, Periapt, Circlet) should be recognized.

2. **`inferSlotType()` in `converters.ts`** — When an item IS typed as `equipment`, this function tries to guess the slot from the `category` string. If nothing matches, it **defaults to `primary_weapon`** (line 172). That's why a Bag of Holding becomes a weapon. Items like Cloaks, Capes, Robes also default wrong if the category field doesn't contain the right keywords.

## Fix

### 1. `src/lib/chronicleSync/patterns/shopItems.ts` — Improve `guessItemType()`

Add a **wondrous item** check before the equipment check. Items like Bag of Holding, Decanter of Endless Water, Portable Hole, etc. should be classified as `miscellaneous` rather than equipment. Add pattern:
```
/bag of|decanter|portable|figurine|bead|stone of|gem of|cube|sphere|mirror of|lantern|candle|carpet|horn of|pipes of|crystal ball|deck of/
```

Also add wondrous items that ARE wearable (Cloak, Boots, Belt, Ring, etc.) — these should stay `equipment` but ensure the regex catches them properly.

### 2. `src/lib/shop/converters.ts` — Fix `inferSlotType()` default + add wondrous routing

- Change the default from `primary_weapon` to a smarter fallback that checks the item **name** (not just category) for slot hints
- Add name-based inference: if category yields no match, check the item name for keywords like "cloak", "boots", "ring", "belt", etc.
- For truly unslottable items (Bag of Holding, Decanter, etc.), the item should NOT be converted to equipment at all — it should route to **miscellaneous items**

### 3. `src/hooks/use-shop.ts` — Add wondrous item routing

In `purchaseItem()`, before converting to equipment, add a check: if the item name matches known wondrous/utility item patterns that aren't wearable, override `destinationType` to `miscellaneous` regardless of what `guessItemType` returned.

### 4. `src/lib/shop/converters.ts` — New `isWearableEquipment()` helper

Add a function that distinguishes wearable equipment (swords, armor, rings, cloaks) from non-wearable items (bags, decanters, figurines, instruments). This is used by the shop purchase flow to decide equipment vs. miscellaneous routing.

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/chronicleSync/patterns/shopItems.ts` | Expand `guessItemType()` with wondrous item patterns |
| `src/lib/shop/converters.ts` | Fix `inferSlotType()` default, add `isWearableEquipment()`, check item name as fallback |
| `src/hooks/use-shop.ts` | Route non-wearable "equipment" items to miscellaneous |

