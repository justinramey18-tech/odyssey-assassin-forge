

# Chronicler Mode

A specialized narrative-focused mode where the Home Screen becomes a simplified, mobile-first Scribe interface for quick writing and text transformation, with access to the full Scribe tab, Cloud, and Settings.

---

## What You'll Get

- **New "Chronicler" app mode** in the mode selection screen and settings
- **Transformed Home Screen**: Instead of the standard character sheet home, Chronicler mode shows a streamlined, full-screen writing workspace -- paste text, pick a style, and process it, all without navigating away
- **3 navigation tabs**: Scribe (full feature), Cloud, Settings
- **Themed with rose/pink accent** and a Feather icon

---

## How It Works

When in Chronicler mode, the Home Screen replaces the usual character info, health bars, and category nav with:

1. **A text input area** (full-width, vertically scrolling) for pasting chat logs or writing
2. **Style selector** dropdown (Fantasy, Noir, Literary, etc.)
3. **A "Process" button** for offline transformation
4. **Output area** with copy/export buttons
5. **Quick access to saved stories** via the story list
6. A subtle link to open the full Scribe tab for advanced features (AI processing, editing rules, multi-file upload, etc.)

The header retains the clock, help button, and character name plaque for consistency.

---

## Technical Details

### 1. Add `chronicler` to `AppMode` type and config (`src/lib/app-modes.ts`)

- New mode entry in `APP_MODE_CONFIGS`:
  - label: "Chronicler"
  - description: "Simplified narrative forge -- paste, style, transform"
  - icon: "Feather"
  - color: "rose"
  - visibleTabs: `['scribe', 'cloud', 'settings']`
  - visibleHomeFeatures: `['home.characterInfo', 'home.clock']`
  - visibleQuickAccess: `['quickAccess.features', 'quickAccess.settings']`
  - visibleDMButtons: `[]`
- Add `'chronicler'` to `APP_MODES_ORDERED` (between `magicBuild` and `storyteller`)
- Add to `getAllFeatureIds` tabs list if needed

### 2. Update icon/color maps in UI components

**Files**: `src/components/home/ModeSelectionScreen.tsx`, `src/components/settings/AppModeSettings.tsx`

- Add `Feather` import from `lucide-react`
- Add `Feather` to `ICON_MAP`
- Add `rose` color entries to `COLOR_MAP` and `TOAST_COLORS`

### 3. Create `ChroniclerHomeView` component (`src/components/home/ChroniclerHomeView.tsx`)

A new standalone component that serves as the Chronicler mode's home screen. It will be a simplified, mobile-first version of the Scribe workflow:

- **Props**: `characterName`, `onNavigateToTab` (to open full Scribe), `onOpenSettings`
- **Uses**: `processTextOffline` from existing narrative processor, `useSavedStories` hook for story management
- **Layout**: Full-screen vertical scroll, no tabs/categories, just:
  - Text input (large textarea, auto-expanding)
  - Style picker (simple select dropdown)
  - "Transform" button
  - Output display with copy button
  - "Open Full Scribe" button at the bottom
  - Story list access via a sheet/drawer

### 4. Conditionally render `ChroniclerHomeView` in `HomeScreen.tsx`

In `src/components/home/HomeScreen.tsx`, add a conditional at the top of the render:

```
if (appMode === 'chronicler') {
  return <ChroniclerHomeView ... />;
}
```

This keeps the existing HomeScreen untouched for all other modes while providing the completely different layout for Chronicler.

### 5. Pass required props through `Index.tsx`

Ensure `characterName` (from `character.name`) is available to the Chronicler view. The existing `appMode` prop and `onNavigateToTab` callback already flow through `HomeScreen`, so the new component will receive what it needs.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/app-modes.ts` | Add `chronicler` mode config, update ordered list |
| `src/components/home/ModeSelectionScreen.tsx` | Add Feather icon + rose color |
| `src/components/settings/AppModeSettings.tsx` | Add Feather icon + rose color + toast color |
| `src/components/home/ChroniclerHomeView.tsx` | **New file** -- simplified scribe home |
| `src/components/home/HomeScreen.tsx` | Conditional render for chronicler mode |

