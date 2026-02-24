

# Fix Scribe Settings Persistence + Add AI/Offline Preference

## Root Cause

The `ScribeDrawer` component is permanently mounted inside `PromptDrawerProvider`. Its `useState` lazy initializers only run once on first mount. When the user switches characters (changing the scoped storage ID) or simply expects settings to persist, the component never re-reads from storage because it doesn't remount when the drawer opens/closes.

## Fix

### 1. Re-sync state when drawer opens (`ScribeDrawer.tsx`)

Add a `useEffect` keyed on the `open` prop that re-reads all persisted values from storage when the drawer opens. This ensures the correct character-scoped values are loaded every time.

```
useEffect — when open becomes true:
  setSelectedGenre(loadNarrativeStyle('scribe-style'))
  setToneIntensity(loadToneIntensity('scribe-tone-intensity'))
  setCustomStylePrompt(loadCustomStylePrompt())
  setCtxState(loadScribeCtxState('scribe-ctx-state'))
  setLastProcessor(loadStringPref('scribe-last-processor', 'ai'))
```

### 2. Add "AI vs Offline" preference (`ScribeDrawer.tsx`)

- New state: `lastProcessor` initialized from `loadStringPref('scribe-last-processor', 'ai')`
- When user clicks Offline button: save `'offline'`
- When user clicks AI button: save `'ai'`
- Visually emphasize the last-used button (e.g., slightly brighter border or ring) so the user sees their preference reflected

### 3. Storage key

| Setting | Key | Default |
|---------|-----|---------|
| Last processor | `scribe-last-processor` | `'ai'` |

Uses existing `saveStringPref` / `loadStringPref` from `scribe-settings-storage.ts`.

### 4. Cloud sync

Add `'scribe-last-processor'` to the `SCOPED_KEYS` array in `use-cloud-save.ts`.

## Files Changed

- `src/components/drawers/ScribeDrawer.tsx` — add open-sync effect + lastProcessor state + visual emphasis
- `src/hooks/use-cloud-save.ts` — add new key to SCOPED_KEYS

