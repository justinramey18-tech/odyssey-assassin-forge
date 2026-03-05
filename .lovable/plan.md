

## Fix: Blank Screen on Generate Message

### Problem
When clicking "Generate Message" in the Party DM, the screen goes blank with no way to recover. This is caused by **unhandled promise rejections** in the `generateResponse` function that crash React's rendering.

### Root Cause
The `generateResponse` function has critical code **outside** its try/catch block:
- Lines 996-1028: The database lock logic (`setIsGenerating(true)` + Supabase lock attempt) runs before the `try` block starts at line 1031
- If the Supabase lock call throws (network error, timeout, etc.), the error propagates unhandled
- The button's `onClick={partyDm.generateResponse}` doesn't catch the returned promise
- An unhandled async error crashes React, producing a blank screen with no error boundary to recover

### Fix (single file: `src/hooks/use-party-dm.ts`)

**Change 1: Wrap the entire generateResponse body in try/catch**

Move the `try` block to encompass everything after the early returns (line 968), so the lock logic, abort controller setup, and all generation code are protected. The `finally` block already resets `isGenerating`.

```text
Before:
  setIsGenerating(true);
  // lock logic (unprotected)
  abortRef.current = new AbortController();
  try {
    // generation logic
  } catch { ... } finally { ... }

After:
  setIsGenerating(true);
  try {
    // lock logic (now protected)
    abortRef.current = new AbortController();
    // generation logic
  } catch { ... } finally { ... }
```

**Change 2: Add defensive `.catch()` on button onClick calls**

In `PartyDMScreen.tsx`, wrap `generateResponse` calls to swallow any escaped rejections:
- The "Generate Now" button onClick
- The timer expiry handler
- The auto-gen effect

This is a belt-and-suspenders approach — the try/catch in Change 1 should handle it, but these guards prevent blank screens if any edge case slips through.

### Files to Edit
1. `src/hooks/use-party-dm.ts` — Move try block up to wrap lock logic
2. `src/components/ai-dm/PartyDMScreen.tsx` — Add `.catch()` guards on generateResponse calls

### What This Fixes
- No more blank screen when generation encounters a network error during the lock phase
- `isGenerating` always gets reset in the `finally` block even if lock fails
- React never receives an unhandled promise rejection from the generate button

