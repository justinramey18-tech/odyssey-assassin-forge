# Enable multiple characters and fix the "Create New Hero" button

## What's wrong right now

Two separate things block you from making a second character:

1. **The roster screen skips itself.** When you have exactly one character that matches your current app mode, the roster instantly loads that character and jumps back to the home screen. You never see the list — so the "Create New Hero" button never gets a chance to appear.

2. **The account is capped at one character.** The saved-characters table has a rule that allows only one save row per account. Even if you reached the button and built a new hero, saving it would overwrite the existing one instead of adding to your roster.

## The fix

**Remove the one-character cap**
- Drop the one-save-per-account rule from the saved-characters table so an account can hold many heroes.
- Keep the existing rule that character names must be unique within your own account, so two heroes can't share a name.
- Update the saving code so a brand-new character always creates a new entry rather than overwriting whatever is already saved.

**Make the roster reachable**
- Only auto-jump into a character when arriving with a fresh sign-in and no character loaded. Otherwise, when you deliberately tap "Switch Character," always show the roster list with the "Create New Hero" button at the top.
- Keep the existing behaviour of skipping straight to creation when the account genuinely has zero characters.

**Add a second, more obvious entry point**
- Add "Create New Hero" directly to the character dropdown in the home header, so you don't have to go through the roster at all.

## Technical notes

- Migration: `DROP INDEX unique_one_save_per_user` on `public.character_saves`; leave `character_saves_user_id_save_name_key` intact.
- `src/hooks/use-cloud-save.ts`: change the no-`saveId` branch from `.upsert(..., { onConflict: 'user_id' })` to a plain `.insert(...)`, and make sure `save_name` is unique-per-user (append a suffix if a clash occurs).
- `src/pages/CharacterRoster.tsx`: gate the auto-load effect behind a navigation flag (e.g. only auto-load when arriving from `/auth`, not from the switcher), so the list renders in the normal case.
- `src/components/navigation/CharacterQuickSwitcher.tsx`: add a "Create New Hero" menu item that clears `odyssey-active-cloud-save-id` and navigates to `/` with `state: { newCharacter: true }`.
- Verify multi-character saving does not break `modeCharacterBinding` (Solo/Party/Empyrean bindings) — those already key off save IDs.
