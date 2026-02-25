

# Plan: Fix Solo DM Not Rendering + Make Personality Quiz Optional

## Root Cause

The Solo DM fails to open because `attemptOpenDM()` in `use-personality-gate.ts` returns `false` when no personality profile exists, and instead sets `showWizard = true`. However, the `PersonalityTestWizard` only renders when `userId` is truthy (line 699 of `PromptDrawerProvider.tsx`). When the user isn't signed in, there's no `userId`, so:

- `attemptOpenDM()` returns false → DM doesn't open
- `showWizard` is set to true → wizard condition checks `userId && showWizard` → false → wizard doesn't render
- Result: nothing happens — the user is stuck

## Changes

### File 1: `src/components/drawers/PromptDrawerProvider.tsx` (line 499-502)

Remove the personality gate from `openAIDMScreen`. The DM should always open. Change:

```typescript
openAIDMScreen: useCallback(() => {
  if (!personalityGate.attemptOpenDM()) return;
  closeAllDrawers(); setAiDMOpen(true);
}, [closeAllDrawers, personalityGate]),
```

To:

```typescript
openAIDMScreen: useCallback(() => {
  closeAllDrawers(); setAiDMOpen(true);
}, [closeAllDrawers]),
```

### File 2: `src/hooks/use-personality-gate.ts` (line 75-80)

Change `attemptOpenDM` to always return `true`. It no longer gates access — the quiz is optional. The method can remain for future use but shouldn't block:

```typescript
const attemptOpenDM = useCallback((): boolean => {
  return true;
}, []);
```

### File 3: `src/components/drawers/PromptDrawerProvider.tsx` (lines 698-718)

The personality test wizard and results screen JSX blocks remain in place. They can still be triggered via the "Retake Personality Test" button in the DM Tools drawer (which calls `personalityGate.retakeTest()`), but they no longer block initial DM access.

No changes needed to these JSX blocks — they already conditionally render based on `showWizard` and `showResults` state.

### Optional cleanup

The `attemptOpenDM` function is no longer meaningful. It could be removed from the hook's return value and all references, but keeping it is harmless and preserves the option to re-enable gating later.

## Net Effect

- Solo DM opens immediately when tapped, regardless of sign-in or personality test status
- Personality test remains available via "Retake Personality Test" in the DM Tools drawer (requires sign-in)
- If a user has completed the test, their DM persona prompt is still passed to the DM screen
- If they haven't, `dmPersonaPrompt` is `undefined` and the DM uses its default personality

## Testing Criteria

1. Without signing in → tap Solo DM → DM screen should open immediately
2. While signed in without a profile → tap Solo DM → DM screen should open (no quiz gate)
3. While signed in with a profile → tap Solo DM → DM screen opens with persona-customized DM
4. "Retake Personality Test" in Tools drawer still works for signed-in users
5. No console errors

