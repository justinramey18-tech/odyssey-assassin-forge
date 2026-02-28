

## Plan: Add Password-Protected "R&D Developer Tools" Settings Tab

### Step 1: Update `MobileSettingsTabs.tsx`
- Add `'devTools'` to the `SettingsTab` union type
- Add a new tab entry: `{ id: 'devTools', label: 'R&D Developer Tools', icon: Code, description: 'Internal file map reference', color: 'text-rose-400' }`

### Step 2: Create `src/components/settings/DevToolsPanel.tsx`
- Password gate: renders a password input field. On correct entry (`JRDP2026!`), stores unlock state in component state (not persisted — re-locks on modal close)
- Once unlocked, renders the full file map as collapsible `SettingsSection` dropdowns (all collapsed by default), one per category:
  - Pages (Routes)
  - Home Tab
  - Fighting Tabs
  - Inventory Tabs
  - AI DM System
  - Companion (Geralt)
  - Party System
  - Drawers & Overlays
  - Character Creation
  - Settings
- Each section contains a `<pre>` block with the file paths and descriptions, styled with side padding, vertical scroll, and monospace text

### Step 3: Update `SettingsContent.tsx`
- Add a new `if (activeTab === 'devTools')` block that renders `<DevToolsPanel />`
- Full-screen vertical scrolling layout matching existing tabs

### Technical Details
- Password is hardcoded client-side (`JRDP2026!`) — compared via simple string match
- No localStorage persistence for unlock state — password required each time the settings modal opens
- Uses existing `SettingsSection` component for collapsible dropdowns (already collapsed by default)
- No changes to any other existing functionality

