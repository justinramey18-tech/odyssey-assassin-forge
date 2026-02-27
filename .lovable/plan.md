

## Plan: Debug Panel, Cloud Save ID Assignment, and Character Rename

### 1. Create Debug Panel Component
**New file: `src/components/settings/CloudSaveDebugPanel.tsx`**

A collapsible panel showing:
- **Active Cloud Save ID**: Read from `localStorage('odyssey-active-cloud-save-id')`
- **Local Autosave Character**: Parse `localStorage('odyssey-character-autosave')` → show `character.name`, `character.level`, `savedAt`
- **Last Cloud Sync Target**: Show the `save_name` / `character_name` of the cloud save matching the active ID (query from `useCloudSave` cloud saves list)
- **All Cloud Saves**: List each save's ID, name, and `updated_at` with a "Copy ID" button
- Live-refreshing via a "Refresh" button

### 2. Add Debug Panel to App & System Tab
**Edit: `src/components/settings/SettingsContent.tsx`**

Add a new `<SettingsSection title="Cloud Save Debug">` inside the `appSystem` tab, after "Danger Zone". Import and render `<CloudSaveDebugPanel />`. Pass `userId` prop so it can query cloud saves.

### 3. Manual Cloud Save ID Assignment
**Edit: `src/components/settings/CloudSaveDebugPanel.tsx`**

Within the debug panel, for each cloud save listed, add a "Set Active" button that:
- Sets `localStorage('odyssey-active-cloud-save-id')` to that save's ID
- Updates `activeCloudSaveId` state in Index.tsx via a callback prop or by dispatching a custom event (`odyssey-active-save-changed`)

Also add a text input for manual ID entry with a "Set" button for advanced users.

### 4. Character Rename Feature
**New file: `src/components/settings/CharacterRenameWidget.tsx`**

A small widget with:
- Current name display
- Text input + "Rename" button
- On submit: calls `onRename(newName)` callback

**Edit: `src/pages/Index.tsx`**

Add a `handleRenameCharacter` function that:
1. Updates `character.name` via `setCharacter(prev => ({ ...prev, name: newName }))`
2. Updates the cloud save's `save_name` via `renameSave(activeCloudSaveId, newName)` 
3. Updates `character_data.name` in the DB via a direct Supabase update (or trigger a cloud sync)
4. Updates party member name via `partySync.updateStatus({ characterName: newName })` if in a party
5. Shows a success toast

**Edit: `src/components/settings/SettingsContent.tsx`**

Add the rename widget to the "Character Profile" section, replacing the static name display with an editable version. Pass `onRename` prop through from `SettingsModal`.

**Edit: `src/components/settings/SettingsModal.tsx`**

Add `onRenameCharacter?: (name: string) => void` prop and thread it through to `SettingsContent`.

### 5. Persist Rename Across Systems

The character name flows from `character.name` state in Index.tsx. Since the home screen, AI DM, and party chat all read from this state (or from `characterName` prop), renaming via `setCharacter` will automatically update:
- **Home screen**: `CharacterNamePlaque` receives `character.name` as prop
- **Party chat**: `partySync.updateStatus` will push the new name to `party_members.character_name`
- **AI DM**: Uses `character.name` from context passed to `OracleDrawer`
- **Cloud save**: The next auto-sync will write the updated `character_data.name` to the DB. Additionally, call `renameSave` to update `save_name` for consistency in the saves drawer.

### Files to Create
- `src/components/settings/CloudSaveDebugPanel.tsx`

### Files to Edit
- `src/components/settings/SettingsContent.tsx` — Add debug panel to appSystem tab, add rename to character tab
- `src/components/settings/SettingsModal.tsx` — Thread `onRenameCharacter` and `userId` props
- `src/pages/Index.tsx` — Add `handleRenameCharacter` callback, pass to SettingsModal

