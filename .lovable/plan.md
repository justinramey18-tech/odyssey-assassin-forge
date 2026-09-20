# Live DM Table action menu

## Goal

Add one obvious action button beneath the Live DM Table message box. It opens a six-tile mobile menu for dice, attacks and abilities, spells, story, bag and stats, plus a future slot—without discarding anything already typed in chat.

## Build

1. **Add the chat trigger**
   - Add the optional action-menu callback to `RoundChatDrawer`.
   - Show the full-width Swords button directly below the existing message row only when that callback is supplied.
   - Keep the current Send, image, reply, and draft behavior unchanged.

2. **Create the slide-up action menu**
   - Add `ActionMenuSheet` using the existing bottom Sheet at the established above-chat layer.
   - Present six large, touch-friendly tiles in the requested 2-column by 3-row order.
   - Load the five requested `/action-menu/*.png` paths, switch to the matching icon if an image is missing, and use the player’s in-character picture or initials for Bag & Stats.
   - Give every tile a visible label, accessible name, and image description.
   - Close the menu first, then open the selected destination after the close animation, preventing stacked sheets.

3. **Connect the six destinations**
   - **Dice:** open the existing dice roller. Its current Live DM result path already posts the roll into table chat, so that path will remain unchanged.
   - **Actions:** open the existing quick-action drawer with only weapons and abilities, including homebrew abilities.
   - **Spells:** open the same drawer with only spells and cantrips, including homebrew spells, and show available standard and pact spell slots as filled and empty pips. Non-casters get no slot row.
   - **Story:** open the existing character sheet directly on Story. `SoloCharacterSheet` already accepts `initialTab`; the party screen will supply `story` for this entry point while its normal opening remains on Vitals.
   - **Bag & Stats:** open a bottom sheet composed from the character sheet’s existing health, defenses, identity, conditions, ability-score, consumable, equipment, and loot displays. Its Use actions will call the existing healing/item handlers, preserving rolls, inventory changes, health changes, and Live DM posting.
   - **Future slot:** close the menu and show a “Coming soon” notice.

4. **Add safe quick-action filtering**
   - Add the requested optional category list to `PartyDMQuickActions`.
   - Keep omitted filtering byte-for-byte equivalent in behavior to today’s full drawer.
   - Separate homebrew entries by their true kind when filtering, so homebrew abilities appear under Actions and homebrew spells appear under Spells.
   - Keep existing combat/magic filtering call sites working.

5. **Wire party state without duplicating it**
   - Let `PartyDMScreen` own which action destination is open and pass the menu opener to `RoundChatDrawer`.
   - Reuse its existing character context, avatar collection, current user, dice state, quick-action handlers, item-use callback, healing resolver, and prompt sender.
   - Do not close or remount the Live DM chat when opening a destination; this preserves the current composer text.

## Technical details

- New file: `src/components/ai-dm/ActionMenuSheet.tsx`.
- Character summary sections will be shared from the existing character sheet rather than recreated with separate game state.
- Standard Sheets already render at `z-[65]`, above the Live DM chat at `z-50`.
- No artwork will be generated or added: the requested files are currently absent, so icon fallbacks will display until those PNGs are supplied.
- Existing `handleUsePrompt`, dice dispatch, spell spending, healing, and consumable-removal flows remain authoritative.

## Verification

- Test the Live DM Table at 375px width.
- Confirm the trigger appears below the composer and all six tiles are visible with fallbacks.
- Confirm dice, one weapon or ability, and one spell post to table chat through the existing path.
- Confirm spell-slot pips reflect current standard and pact slots and disappear for non-casters.
- Confirm Story opens directly on Story.
- Confirm Bag & Stats shows current values and a healing consumable both rolls and updates health/inventory.
- Close every destination and confirm the prior chat draft remains intact.
- Check keyboard focus, labels, 44px minimum targets, sheet stacking, and the latest preview build result.
