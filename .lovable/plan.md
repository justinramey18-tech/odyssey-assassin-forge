# Weapon cards: swap Use/Remove buttons for a small "Roll Attack" die seal

## Goal
On the three weapon picture cards in Quick Actions, the card art becomes the focus: the Remove button disappears and the Use button is replaced by a small square die picture ("ROLL ATTACK") tucked into the bottom-right corner. Tapping it (or the card body) rolls the attack exactly as before.

## Changes — one file plus one uploaded picture
`src/components/ai-dm/PartyDMQuickActions.tsx`, weapon card block (the `item.weaponSlot` branch, roughly lines 459–483):

1. **Delete the top-right button row** for weapon cards only — both the "Use" button and the "Remove" button. No other section loses its Remove button; abilities, spells, consumables, and homebrew keep theirs untouched.

2. **Add the die picture button** in the same spot where `!isEmpty`:
   - The uploaded `roll-attack.png` picture becomes an app asset (uploaded through the asset flow, pointer at `src/assets/roll-attack.png.asset.json`) and is imported at the top of the file alongside the existing weapon backgrounds.
   - Positioned `absolute bottom-3 right-3`, size `w-14 h-14` (56px square), `rounded-lg overflow-hidden`.
   - Styling: faint `ring-1 ring-white/10`, `drop-shadow-lg`, `opacity-90`. No background panel or fill behind it — the picture is the whole button.
   - Tap feedback: `active:scale-95 transition-transform` plus `active:ring-amber-400/40`.
   - `alt="Roll attack"`, `loading="lazy"`, `style={{ touchAction: 'manipulation' }}`.
   - Minimum 48px tap target respected (56px image itself is the target).

3. **Same behavior on tap.** The button's click calls `handleItemUse(item)` with `event.stopPropagation()` (so it doesn't double-fire with the card body), exactly what the old Use button fired — attack roll plus DM prompt, `rollKind: 'attack'`. No change to `resolveActionCost`, the action-cost badge, the roll handler, prompt generation, or saved equipment.

4. **Card body tap unchanged.** Tapping anywhere else on an equipped card still triggers the same attack (this already exists and stays).

5. **Keep the top of the card clear.** With the button row gone, the title printed on the art is no longer covered. Nothing new is placed over the top third — no gradients, badges, or extra overlays beyond the existing bottom gradient.

6. **Stats block breathing room.** The bottom-left name and chip area gets `pr-20` so text and chips wrap to a new line instead of running under the die picture. The name's own `pr-1` becomes unnecessary coverage but the container padding handles it.

7. **Empty slots untouched in behavior.** Still dimmed with "Nothing equipped", no die picture, no controls. The die button only renders when a weapon is equipped.

## Untouched on purpose
- The `dm-quick-action-remove` event and `removeSlot` stay in the code — other sections still use them; weapon cards simply stop doing so.
- Everything outside the Weapons section.

## Verification
- App compiles cleanly.
- At 360px width: all three cards show the die seal in the bottom-right, name and chips wrap clear of it, no horizontal overflow.
- Tapping the die or the card body runs the same attack flow as before; empty cards have no die and no active controls.
