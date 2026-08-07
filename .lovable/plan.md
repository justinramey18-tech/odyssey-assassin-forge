# Drinking a healing potion from Quick Actions

Today, tapping a healing potion in Quick Actions just writes a flowery "describe me drinking this" prompt. Nothing rolls, nothing is consumed, and your health only changes if the AI happens to narrate it. This makes it a real, self-contained action.

## What will happen when you tap a healing potion

1. The app rolls the potion's own healing dice (a standard Potion of Healing is 2d4+2; a Greater Healing is 4d4+4) using the same on-screen dice animation you already get for attacks and checks.
2. You see the roll and the total.
3. Your health goes up immediately by that amount, capped at your maximum. No waiting on the AI, and it can't be missed or doubled.
4. One potion is removed from your stock. Three becomes two; one becomes none and the potion disappears from Quick Actions. The character sheet's consumables list shows the same new count.
5. A short prompt is sent to the DM saying you drank the potion, how much it healed, and your new health total — with an instruction to reply with only a line or two acknowledging it and to make no other changes to your character.

Because the DM is only writing a couple of lines and doing no bookkeeping, this uses a cheap fast model rather than your main story model.

## Rules and edge cases

- Only healing items behave this way. Anything else (poisons, scrolls, utility potions) keeps its current behaviour exactly.
- An item counts as healing if its written effect describes restoring health with a dice value. That covers both the built-in potions and healing potions bought from the shop.
- If you are already at full health, the potion is still drunk and consumed, and the note to the DM says it had no effect.
- If the potion somehow isn't in your inventory when you tap it, nothing is rolled or spent and you get a short warning instead.
- Works the same in Solo, Party, and Empyrean.

## Technical notes

- New helper (e.g. `src/lib/consumables/healing.ts`): detect a healing consumable and parse its dice from the `effect` text (`Restores 2d4+2 HP`), returning `{ count, die, bonus }` or null.
- Roll through the existing dice pipeline (`promptAutoRoll` / `requestDiceRoll` from `diceRollBus`) so the animation and overlay match other rolls. Fair dice — no odds weighting on healing.
- On roll completion: call the existing `onUseConsumableByName(name, 1)` to decrement stock (already wired through `AIDMScreen`, `StandalonePartyDMScreen`, and the Empyrean screen), then apply healing via the existing `onHPChange`/heal callback. Validate the total with `Number.isFinite` before applying, and clamp to max HP.
- `PartyDMQuickActions.tsx` builds the consumables section for all three screens; give healing items a new `rollKind` so the section's `onUse` path branches to the heal flow instead of `onUsePrompt`.
- Prompt text is short and tagged so the DM knows not to re-apply HP (it already respects `---SYNC---`-style directives); auto-sync must not double-apply, so the message states HP is already resolved.
- Route this send through the low-cost model path (Gemini Flash tier) rather than the campaign's selected model, honouring the existing per-feature key routing toggles.
