

# Persist All Novel Builder Settings

## Overview
Add localStorage persistence for all ephemeral Novel Builder and Scribe settings so they survive page reloads and session changes. Uses the existing `scoped-storage` pattern to isolate settings per character save.

## Settings to Persist

| Setting | Component | Storage Key |
|---------|-----------|-------------|
| Context pipeline state (processing mode, multiplier, toggles) | ChroniclerHomeView, ScribeDrawer | `novel-ctx-state` |
| Narrative style | ChroniclerHomeView | `novel-style` |
| Narrative style (Scribe) | ScribeDrawer | `scribe-style` |
| Tone intensity | ChroniclerHomeView | `novel-tone-intensity` |
| Tone intensity (Scribe) | ScribeDrawer | `scribe-tone-intensity` |
| Custom style prompt | ScribeDrawer | `scribe-custom-style-prompt` |
| NPC master toggle | ScribeContextPanel | `novel-npc-master-enabled` |
| Protagonist master toggle | ScribeContextPanel | `novel-protagonist-master-enabled` |
| Active prompt library | NovelPromptDrawer | `novel-prompt-library` |
| Intensity filter | NovelPromptDrawer | `novel-prompt-intensity` |

## Technical Approach

### 1. New helper: `src/lib/scribe-settings-storage.ts`
Create a small utility with typed load/save functions for the context state and individual settings. Uses `getScopedItem` / `setScopedItem` from `scoped-storage.ts` so settings are character-scoped.

```
saveScribeCtxState(state) / loadScribeCtxState(): ScribeContextState
saveNarrativeStyle(key, style) / loadNarrativeStyle(key): NarrativeStyle
saveToneIntensity(key, val) / loadToneIntensity(key): number
saveCustomStylePrompt(val) / loadCustomStylePrompt(): string
saveToggle(key, val) / loadToggle(key, default): boolean
saveStringPref(key, val) / loadStringPref(key, default): string
```

Each function wraps try/catch so storage errors are silently ignored.

### 2. `ChroniclerHomeView.tsx` changes
- Initialize `style` from `loadNarrativeStyle('novel-style')` (default `'fantasy'`)
- Initialize `toneIntensity` from `loadToneIntensity('novel-tone-intensity')` (default `3`)
- Initialize `ctxState` from `loadScribeCtxState()` (default `DEFAULT_CONTEXT_STATE`)
- Add `useEffect` hooks (or inline in setter callbacks) to persist on change

### 3. `ScribeDrawer.tsx` changes
- Same pattern for `selectedGenre`, `toneIntensity`, `customStylePrompt`, and `ctxState`
- Uses separate storage keys (`scribe-*`) so Scribe and Novel Builder maintain independent preferences

### 4. `ScribeContextPanel.tsx` changes
- Initialize `npcMasterEnabled` and `protagonistMasterEnabled` from localStorage
- Persist on toggle change
- Pass these values through existing props (they're already local state, just need init + save)

### 5. `NovelPromptDrawer.tsx` changes
- Initialize `activeLibrary` and `selectedIntensity` from localStorage
- Persist on change (same inline pattern already used for `fictionMode`)

## Implementation Notes
- All persistence uses the scoped-storage utility so settings are isolated per character cloud save
- JSON serialization for the `ctxState` object; simple string values for everything else
- No migration needed since these are new keys with sensible defaults as fallbacks
- No changes to component APIs or prop signatures

