

# Custom GM Guides for AI DM

## Overview
Add a system for users to upload, manage, and activate custom GM guides that inject additional context into the AI DM's system prompt. Each guide can be up to 30,000 characters, with a total cap of 200,000 characters across all guides. Guides are stored in localStorage and sent to the edge function alongside the character context.

---

## How It Works

1. Users open a "GM Guides" settings panel accessible from the AI DM header
2. They can create/edit/delete text-based guides (paste or type content)
3. Each guide has a name, content (up to 30,000 chars), and an enabled/disabled toggle
4. Only enabled guides are sent to the AI DM as additional system prompt context
5. The edge function appends enabled guide content after the base system prompt

---

## Data Model

Each GM guide stored in localStorage:
- `id`: unique identifier
- `name`: user-given title (e.g., "Curse of Strahd Setting", "Homebrew Rules")
- `content`: the guide text (max 30,000 characters)
- `enabled`: whether it's active for the current session
- `createdAt`: timestamp
- `updatedAt`: timestamp

Storage key: `dnd-ai-dm-guides`
Total character budget: 200,000 across all guides combined

---

## Files to Create

### 1. `src/lib/gm-guides-storage.ts`
Utility module for GM guide CRUD operations:
- `GMGuide` interface definition
- `loadGMGuides()` / `saveGMGuides()` -- localStorage read/write
- `addGMGuide()` / `updateGMGuide()` / `deleteGMGuide()`
- `getEnabledGuidesContent()` -- returns concatenated text of all enabled guides
- `getTotalCharacterCount()` -- sum of all guide content lengths
- `MAX_GUIDE_CHARS = 30000` and `MAX_TOTAL_CHARS = 200000` constants
- Validation helpers for character limits

### 2. `src/components/ai-dm/GMGuidesManager.tsx`
Full-screen overlay (or drawer) for managing guides:
- List view showing all guides with name, character count, enabled toggle
- "Add Guide" button that opens an editor
- Guide editor with name input, textarea (with live character counter showing X/30,000), and save/cancel
- Delete confirmation dialog
- Total usage bar showing X/200,000 characters used across all guides
- Visual indicator when a guide would exceed the total budget
- Support for pasting large text blocks

### 3. `src/hooks/use-gm-guides.ts`
React hook wrapping the storage utilities:
- State management for the guides list
- CRUD operations that trigger re-renders
- `enabledGuidesContent` memoized string for passing to the AI DM
- Validation feedback (toast on limit exceeded)

---

## Files to Modify

### 4. `src/components/ai-dm/AIDMScreen.tsx`
- Add a "Guides" button (e.g., `BookOpen` icon) to the header next to "New" and "Clear"
- State toggle for showing the `GMGuidesManager` overlay
- Pass enabled guides content down to the hook

### 5. `src/hooks/use-ai-dm.ts`
- Accept an optional `customGuidesContent: string` in `UseAIDMOptions`
- Include it in the API payload: `body: JSON.stringify({ messages, characterContext, customGuides })`

### 6. `supabase/functions/ai-dm/index.ts`
- Accept `customGuides?: string` in the `DMRequest` interface
- In `buildDMSystemPrompt`, append custom guides after the base prompt:
  ```
  ## CUSTOM GM GUIDES
  The following custom content has been provided by the player to guide your behavior:
  {customGuides}
  ```
- Enforce a server-side character cap (200,000) to prevent abuse

### 7. `src/components/drawers/PromptDrawerProvider.tsx`
- Pass enabled guides content through to AIDMScreen props

---

## Technical Details

### Character Counting
- Use `.length` on the string (JavaScript character count, not bytes)
- Display live counters during editing: "12,450 / 30,000 characters"
- Display total budget bar: "87,200 / 200,000 characters used"
- Disable save when either per-guide or total limit would be exceeded

### Storage Format (localStorage)
```json
[
  {
    "id": "uuid",
    "name": "Curse of Strahd Setting",
    "content": "The land of Barovia is...",
    "enabled": true,
    "createdAt": "2026-02-12T...",
    "updatedAt": "2026-02-12T..."
  }
]
```

### Edge Function Integration
The custom guides are concatenated and injected as a dedicated section in the system prompt, positioned after the base DM instructions but before the conversation history. This ensures the DM treats custom content as authoritative context without overriding core mechanical rules.

### UI Design
- GM Guides Manager uses the same dark amber theme as the AI DM screen
- Each guide card shows: name, char count badge, enabled/disabled toggle, edit/delete buttons
- Editor uses a full-height textarea with monospace font for readability
- Total budget displayed as a progress bar with color transitions (green -> amber -> red)

