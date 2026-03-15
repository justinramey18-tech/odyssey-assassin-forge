

## Fix Typing Lag in Party DM Input

### Root cause
`PartyDMScreen.tsx` is 2268 lines with ~30 `useState` hooks. The text input's `setInput` triggers a full re-render of the entire component on every keystroke — including all message markdown rendering, prompt pills, realtime subscription callbacks, and child components. This causes noticeable lag, especially on mobile.

### Fix: Extract the input area into a standalone `React.memo`'d component

Extract the textarea + send button + ready button into a new `PartyDMInput` component that owns its own `input` state internally. The parent only receives the final value on submit — it never re-renders during typing.

### What changes

**1. New file: `src/components/ai-dm/PartyDMInput.tsx`**
- Moves the textarea, send button, ready button, and attach menu into a self-contained `React.memo`'d component
- Owns `input` state via `useDraftPersist` internally
- Props: `onSubmit(text)`, `onReady()`, `onPaste(file)`, `disabled`, `hasPrompt`, attach-related callbacks
- `handleInputChange` with auto-resize lives here
- The `useDraftPersist` debounce + localStorage writes stay isolated to this component

**2. `src/components/ai-dm/PartyDMScreen.tsx`**
- Remove `input`/`setInput`/`clearInput` state, `handleInputChange`, `handleKeyDown`, `handleSubmit`, `inputRef`, and the inline textarea JSX (~50 lines)
- Replace with `<PartyDMInput onSubmit={...} onReady={partyDm.setReady} ... />`
- The parent no longer re-renders on every keystroke

### Why this works
The parent component only re-renders when the user actually submits (calls `onSubmit`), not on every character typed. All the expensive markdown rendering, prompt pills, realtime state, and child components stay untouched during typing.

### Files
1. **Create** `src/components/ai-dm/PartyDMInput.tsx` — extracted input component with memo
2. **Edit** `src/components/ai-dm/PartyDMScreen.tsx` — swap inline input for `<PartyDMInput>`

