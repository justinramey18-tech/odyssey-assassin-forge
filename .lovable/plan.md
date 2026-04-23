

## Build out the Character tab — menu of drawer-launcher rows

### What you'll see after this prompt

Open the Empyrean DM → tap **SHEET**. The Character tab (default) now shows a tidy menu of three sections:

- **Stats & Progression** — HP / Ability Scores / XP, Abilities, Cooldowns, Conditions
- **Signet** — Signet Management (greyed-out "coming soon" row, real version arrives in a later prompt)
- **Equipment** — Gear & Inventory, Set Bonuses

Tap any active row → the Character Sheet closes and the matching drawer slides open over the DM chat (the existing drawers — same data, same controls). Close the drawer → you're back at the DM chat. Reopening the Sheet starts on the Character tab again.

### What's being changed

**Single file: `src/components/empyrean/CharacterSheet.tsx`**

- Add icons to the lucide import: `Heart`, `Swords`, `Shield`, `Activity`, `Flame`, `Backpack`.
- Import `usePromptDrawers` from the existing drawer provider.
- Delete the `CharacterTabPlaceholder` function.
- Add a new `CharacterTab` component that:
  - Reads the existing drawer context via `usePromptDrawers()` — no new state, no prop plumbing.
  - Renders three sections of rows. Tapping a row closes the Sheet first (so the lower-z drawer is visible), then opens the drawer on the next tick.
  - Renders the Signet Management row as a disabled placeholder with a "coming soon" hint.
- Add two small layout primitives next to the existing Settings primitives: `CharacterSection` (titled grouping) and `CharacterRow` (icon + label + description + chevron, with disabled support).
- Update the active-tab branch in the render to mount `<CharacterTab onCloseSheet={onClose} />` instead of the placeholder.

### What stays untouched

- `PromptDrawerProvider.tsx` and all six drawers (Stats, Abilities, Conditions, Cooldown, Quick Actions, Set Bonus) — consumed as-is.
- `EmpyreanDMScreen.tsx` — no new props or state needed.
- The Settings tab and all its primitives / the New Campaign confirmation dialog — fully preserved.
- The Talk to the DM tab — still a placeholder for later prompts.
- The Dragon Bond nav tab — unchanged.
- Party DM and standard AI DM — unaffected.

### Verification

- Character tab shows three sections with the expected rows.
- Each active row closes the Sheet and opens the matching drawer over the DM chat.
- Signet Management row is visibly disabled with the "coming soon" description.
- Settings and Talk tabs unchanged.
- No TypeScript errors.

