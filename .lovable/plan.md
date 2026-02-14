

# Expandable Player Prompt Pills in Shared Prompt Mode

## Overview
When shared prompt mode is active in Party DM, clicking on a player's pill in the Round Queue will expand to reveal the full prompt text that player submitted. For the player's own pill, they can also edit their prompt inline -- but only until the AI DM response is generated (i.e., while `isGenerating` is false and they haven't been marked ready).

## Current Behavior
- Player pills show a truncated 60px-wide snippet of the prompt text in shared mode (line 659)
- Pills are not interactive (no click handler)
- Editing is only available through the input area at the bottom

## Changes

### 1. Add Expand/Collapse State
Add a `expandedPill` state (`string | null`, storing `user_id`) to `PartyDMScreen`. Clicking a pill toggles expansion. Only one pill expands at a time.

### 2. Expanded Pill Layout
When a pill is expanded (and mode is `shared`):
- The pill grows from a single-line row item into a small card below the pill row
- Shows the character name as a label and the full prompt text underneath
- Uses `AnimatePresence` + `motion.div` for smooth expand/collapse animation
- For other players' pills: read-only text display
- For the current player's own pill: editable textarea (see below)

### 3. Own-Prompt Inline Editing
When the player expands their own pill:
- The prompt text renders in a small textarea (editable)
- A "Save" button commits the edit via `partyDm.editPrompt(newText)`
- Editing is disabled (textarea becomes read-only) once `partyDm.isGenerating` is true OR the player's prompt `is_ready` is true
- This reuses the existing `editPrompt` method from `use-party-dm` which already handles the database update

### 4. Collapse on Generation Start
When `partyDm.isGenerating` becomes true, auto-collapse any expanded pill to keep the UI clean during response generation.

## Technical Details

### State Addition in PartyDMScreen
```text
const [expandedPillUserId, setExpandedPillUserId] = useState<string | null>(null);
```

### Pill Click Handler
```text
onClick={() => {
  if (mode !== 'shared') return; // no expansion in private mode
  setExpandedPillUserId(prev => prev === m.user_id ? null : m.user_id);
}
```

### Expanded Content (rendered below the pill row)
```text
{expandedPillUserId && (
  <motion.div ...>
    {/* Character name label */}
    {/* If isSelf and !isReady and !isGenerating: editable textarea + Save button */}
    {/* Otherwise: read-only prompt text */}
  </motion.div>
)}
```

### Auto-Collapse Effect
```text
useEffect(() => {
  if (partyDm.isGenerating) setExpandedPillUserId(null);
}, [partyDm.isGenerating]);
```

### Files Modified
- `src/components/ai-dm/PartyDMScreen.tsx` -- Add expand state, click handlers on pills, expanded content section with conditional edit capability, and auto-collapse effect

### What Stays the Same
- The existing bottom input area editing flow remains unchanged
- `use-party-dm.ts` hook is not modified (already has `editPrompt`)
- Private mode behavior is unchanged (pills remain non-interactive)
- The pill row layout and styling remain the same when collapsed

