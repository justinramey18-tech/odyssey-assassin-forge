

## Plan: Limit to One Character Per User

**What changes:** Right now, the app supports multiple characters per account. You'll be limited to exactly one character. When you log in, the app will automatically load your character (no roster selection screen). If you have no character yet, it goes straight to the character creation wizard.

**What gets removed:**
- The "Create New Character" button on the roster screen
- The "New" button in the Settings panel
- The `handleNewCharacter` function in the main app (which saves the current character and starts a fresh one)

**What changes in behavior:**
- The **Character Roster page** will auto-load your single save and skip straight to the main app. If you have zero saves, it will go straight to character creation. You'll never see the roster grid anymore.
- The **Settings panel** will still show "Edit" (to re-open the wizard for your current character) but the "New" button will be gone.
- The **back button** behavior will stay the same (navigates to roster, which just bounces you right back).
- **Deleting your character** will still be possible from the Cloud Save management area, which would send you back to the creation wizard.

**Files to change:**

1. **`src/pages/CharacterRoster.tsx`** -- Instead of showing a list of character cards, automatically load the first (and only) save, or navigate to `/ ` with `newCharacter: true` if none exist. Remove the `CreateNewCharacterCard` import and usage entirely.

2. **`src/components/settings/SettingsContent.tsx`** -- Remove the "New" button (the `onNewCharacter` conditional block around line 242-244).

3. **`src/components/settings/SettingsModal.tsx`** -- Remove the `onNewCharacter` prop from the interface and stop passing it through to `SettingsContent`.

4. **`src/pages/Index.tsx`** -- Remove the `handleNewCharacter` callback and stop passing `onNewCharacter` to the settings modal.

