

# Robust Local Save for AI DM Sessions

## Overview
Upgrade the AI DM session persistence in `use-ai-dm.ts` and `campaign-summary-storage.ts` to match the reliability of the character auto-save system: debounced writes, quota handling, corruption guards, and versioning.

## Changes

### 1. `src/hooks/use-ai-dm.ts` -- Save/Load Overhaul

**Load function (`loadSession`)**
- Support two formats: legacy (raw array) and new versioned wrapper (`{ version: 1, messages: [...] }`)
- Validate each message has required fields (`id`, `role`, `content`, `timestamp`) -- drop invalid entries with a console warning
- On parse failure or corruption, show a toast ("Session data was corrupted, starting fresh") and return empty
- Rehydrate `timestamp` fields to `Date` objects as before

**Save function (`saveSession`)**
- Wrap messages in versioned object: `{ version: 1, messages: [...] }`
- Catch `QuotaExceededError` specifically and show a toast: "Session too large to save locally"
- Add dirty-checking: compare serialized string to a module-level `lastSavedRef` to skip no-op writes

**Persistence effect (replace current `useEffect`)**
- Replace the direct `useEffect(() => saveSession(messages), [messages])` with a 1-second debounced write using `setTimeout`/`useRef`, preventing dozens of writes during streaming
- Add a `beforeunload` event listener that calls `saveSession` immediately (bypassing debounce) so data is never lost on tab close
- Clean up both the debounce timer and the event listener on unmount

### 2. `src/lib/campaign-summary-storage.ts` -- Quota Handling

- In `saveCampaignSummary`, catch `QuotaExceededError` and show a toast: "Campaign summary too large to save locally"
- Import `toast` from `sonner`

## What stays the same
- The localStorage key (`dnd-ai-dm-session`) -- no migration needed
- The `Message` type and hook API surface (no breaking changes to `AIDMScreen`)
- Campaign summary storage key and max chars
- The `loadCampaign` function (it will call the improved `saveSession` internally)

## Technical Detail: Save Flow

```text
Message state changes
  -> 1s debounce timer resets
  -> Timer fires: serialize with version wrapper, dirty-check
     -> Different from last save: try localStorage.setItem
        -> QuotaExceededError: toast warning, skip write
     -> Same: skip

Tab close / navigation away
  -> beforeunload: immediate save (bypass debounce)
```

## Testing
- Open AI DM, have a conversation, close tab, reopen -- messages should restore
- Verify no rapid localStorage writes during streaming (check console for save logs)
- Manually corrupt `dnd-ai-dm-session` in DevTools, reload -- should see toast and fresh session
- Fill localStorage near quota, send messages -- should see quota warning toast instead of silent failure

