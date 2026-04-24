

## Why your Empyrean gear isn't reaching the AI DM

### The functional bug

Empyrean has its own gear system — a separate forge/loadout living under storage key `empyrean-loadout`. It's completely walled off from the legacy "Assassin's Ledger" inventory, on purpose.

But when the AI DM gets told what gear you're wearing, it's reading from the *legacy* inventory, not the Empyrean loadout. So you can equip a freshly forged Rider's Leathers in the Empyrean character sheet, and the AI DM will keep narrating you in whatever's pinned to the old Assassin's Ledger slots (or nothing at all if those are empty).

That's why nothing you forge or equip in Empyrean ever shows up in the DM's descriptions or affects what it knows about your kit.

### Where the wires miss each other

The character context that gets handed to the AI DM is built once, in a shared provider that serves both Empyrean and the regular game. It only knows about the legacy gear shape. The Empyrean loadout has its own storage, its own item type, and its own helper for summarizing equipped items — but nothing reads that helper into the DM context.

---

## The fix

### Override the equipment list at the Empyrean DM layer

Inside `EmpyreanDMScreen.tsx`, just before the `characterContext` is passed into `useAIDM`, replace its `equipment` field with the Empyrean loadout's currently equipped items, projected into the same `{ slot, name, rarity }` shape the AI DM already expects.

That means:
- The shared provider keeps building the legacy context untouched (so Assassin's Ledger keeps working).
- Empyrean gets a clean override at its boundary — no cross-contamination.
- The AI DM edge function needs no changes: it already iterates `equipment[]` and prints `EQUIPPED GEAR: Name (slot, rarity)`.

### Keep it fresh when you forge or swap gear

Read the Empyrean loadout into local state in `EmpyreanDMScreen`. Refresh that state in three situations:
1. On mount, and on the `odyssey-character-loaded` event (matches the standard hook pattern).
2. Whenever the Rider Loadout drawer closes (`riderLoadoutOpen` flips from true to false) — the only moment gear can have just changed.
3. After a successful Director "install/disable/delete" or other relevant Director action that might touch gear (defensive; cheap).

### Build the override

For each equipped slot in the Empyrean loadout, push `{ slot: <empyrean slot label>, name: item.name, rarity: <rarity label> }` into a fresh array. Replace `characterContext.equipment` with that array via a memo whose dependencies are `characterContext` and the local Empyrean loadout state.

Pass the *augmented* context (not the original) to:
- `useAIDM` (the main DM)
- `useOocDmChat` (the Director's OOC channel that also reads gear)
- Any other consumer in the file that takes `characterContext`

### Empty state

If nothing is equipped in Empyrean, pass an empty `equipment: []`. Do NOT fall back to the legacy gear — that's the bug we're fixing. The DM should know you're unequipped so it narrates that honestly.

---

## Files touched

- `src/components/empyrean/EmpyreanDMScreen.tsx` — read Empyrean loadout, build override array, replace `characterContext.equipment`, pass augmented context everywhere `characterContext` is currently passed.

That's it. One file. No edge function changes, no storage migrations, no changes to the shared provider or the legacy gear path.

---

## How you'll know it's working

1. Open Empyrean → Character Sheet → Rider Loadout. Forge or equip a chest item (e.g., "Reinforced Leathers, Rare").
2. Close the loadout drawer. Open the AI DM input and ask OOC: *"What gear am I wearing right now?"*
3. **Expected:** the DM lists Reinforced Leathers (and any other equipped Empyrean pieces). No mention of legacy Assassin's Ledger items unless you also equipped them there.
4. Unequip everything in the Empyrean loadout. Ask again. The DM should describe you as unequipped, not silently fall back to old gear.
5. Regression check: open Assassin's Ledger / regular AI DM. Its gear narration is unchanged — still uses the legacy inventory.

