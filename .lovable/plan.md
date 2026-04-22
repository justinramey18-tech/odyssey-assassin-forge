

## Build out the Settings tab inside the Character Sheet

### What you'll see after this prompt

Open the Empyrean DM → tap **SHEET** → tap the **Settings** tab. The placeholder is gone, replaced with grouped sections:

- **Campaign** — Campaign Saves (opens the existing saves drawer).
- **Gameplay** — Dice Odds dropdown (Fair / Heroic / Dramatic / Chaotic / Cursed), Auto-Sync toggle (only when enabled by parent), Whisper Trays toggle, Cinematic Mode toggle.
- **Appearance** — AI Model dropdown, Chat Theme picker (3-column grid of colored swatches).
- **Configuration** — Reconfigure Campaign (returns to the Empyrean campaign menu).
- **Danger Zone** — red-tinted block with **Clear Chat** (clears messages, keeps setup) and **New Campaign** (confirmation dialog, then full wipe + return to setup menu).

Each action that navigates away first closes the sheet so the next screen has a clean stage. The new layout uses small reusable row primitives (a labeled row, a toggle row, a picker row) so all sections look consistent.

### What's being added

**1. Updated: `src/components/empyrean/CharacterSheet.tsx`**
- New props on `CharacterSheetProps` for every setting and action (campaign saves callback, dice odds value/setter, three toggles, model + theme value/setters, reconfigure / clear chat / new campaign callbacks, plus a `showAutoSync` flag so the Auto-Sync row only appears when meaningful).
- Settings tab placeholder replaced with a real `SettingsTab` component that renders the five sections above.
- Internal AlertDialog confirmation for **New Campaign**.
- Three small layout primitives (`SettingsSection`, `SettingsRow`, `SettingsToggleRow`, `SettingsPickerRow`) defined in the same file.
- Imports added for Switch, Select, Button, AlertDialog, plus `DM_MODELS` / `getModelLabel`, `DM_CHAT_THEMES`, and `DICE_ODDS_CONFIGS`.

**2. Updated: `src/components/empyrean/EmpyreanDMScreen.tsx`**
- Adds local `diceOddsMode` state initialized from `loadDiceOddsMode()` and persisted via `saveDiceOddsMode()` on change (shared storage with the standard dice tab).
- Passes the new prop set into `<CharacterSheet />`, wiring each one to existing hooks already present in this file:
  - Whisper Trays → `useWhisperTrayEnabled`
  - Cinematic Mode → `useCinematicMode`
  - Chat Theme → `useDMChatTheme`
  - Auto-Sync → `useDmAutoSync` (with `showAutoSync` set from `!!autoSyncCallbacks`)
  - AI Model → existing `selectedModel` / `handleModelChange`
  - Campaign Saves → `setShowSaves(true)`
  - Reconfigure Campaign → existing `onClose`
  - Clear Chat → existing `clearMessages`
  - New Campaign → existing `handleNewCampaign`

### What stays untouched (reversibility safety net)

- The old `DMToolsDrawer` JSX stays mounted in `EmpyreanDMScreen`; it's just unreachable while the SETTINGS nav tab is hidden.
- `CharacterTabPlaceholder` and `TalkTabPlaceholder` are not modified — those get filled in by later prompts.
- `CampaignSessionsManager`, `handleNewCampaign`, `clearMessages`, and `onClose` keep their current behavior.
- Party DM and standard AI DM are not touched.

### Verification checklist

- App compiles with no TypeScript errors.
- Settings tab shows all six sections in the order above.
- Dice Odds change persists (visible in localStorage and reflected when the dice tab is opened from a non-Empyrean DM).
- Whisper Trays / Cinematic Mode toggles flip immediately and survive sheet close/reopen.
- AI Model and Chat Theme persist across sessions.
- Reconfigure Campaign closes the sheet and returns the player to the Empyrean menu.
- Clear Chat closes the sheet and clears messages without wiping setup.
- New Campaign shows confirmation; on confirm, wipes setup and routes back to the Launch menu.
- Party DM and standard AI DM are unchanged. Setting `hideSettings={false}` would restore the old Tools drawer entry point.

