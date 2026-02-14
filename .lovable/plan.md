

# Decouple Solo DM and Party DM into Standalone Screens

## Overview
Currently, Party DM is rendered as a child overlay inside `AIDMScreen` (Solo DM). Opening Party DM requires loading the entire Solo DM infrastructure first, then showing Party DM on top. This plan makes them completely independent screens -- each loads standalone without depending on or navigating to the other.

## What Changes

### 1. New Standalone Party DM Wrapper
Create `src/components/ai-dm/StandalonePartyDMScreen.tsx` -- a new top-level container that initializes all the hooks Party DM needs independently (without going through Solo DM):
- `usePartyDm` -- party DM session management
- `useGMGuides` -- GM guide content for AI context
- `useDmAutoSync` -- auto-sync character stats from DM responses
- Battle Map state (`StandaloneBattleMap`)
- `GMGuidesManager` overlay
- Party chat callback

This mirrors the hook setup currently done in `AIDMScreen` lines 159-217, but only the subset needed for Party DM.

### 2. New Context Method: `openPartyDMScreen`
Add `openPartyDMScreen` to `PromptDrawerProvider` alongside the existing `openAIDMScreen`:
- New state: `partyDMOpen` (boolean)
- New method: `openPartyDMScreen()` -- closes all drawers, sets `partyDMOpen = true`
- Renders `StandalonePartyDMScreen` when `partyDMOpen` is true (parallel to Solo DM rendering)
- Update the context interface to expose `openPartyDMScreen`

### 3. Remove Party DM from AIDMScreen
- Remove `initialShowPartyDM` prop and `showPartyDM` state
- Remove `usePartyDm` hook initialization
- Remove the "Join Party" / "Start Party" button from the Solo DM header
- Remove the `PartyDMScreen` overlay rendering (lines 779-797)
- Remove `onShowChat` prop (no longer needed since Party DM has its own chat access)
- Remove `returnToPartyDM` state from `PromptDrawerProvider`
- Clean up the `openAIDMScreen` method to remove the `returnToPartyDM` option

### 4. Update DMDrawer Callbacks
In `HomeScreen.tsx`, update the DMDrawer's `onOpenPartyDM` to call `drawerContext?.openPartyDMScreen()` instead of `openAIDMScreen({ returnToPartyDM: true })`.

### 5. Update Chat-to-DM Navigation Loop
The party chat "close returns to Party DM" logic in `HomeScreen.tsx` currently calls `openAIDMScreen({ returnToPartyDM: true })`. Update this to call `openPartyDMScreen()` instead, so closing party chat returns directly to the standalone Party DM screen.

## What Stays the Same
- `PartyDMScreen.tsx` component itself is unchanged -- it's a pure presentational component that receives props
- Solo DM (`AIDMScreen`) continues to work exactly as before for solo adventures
- The DMDrawer UI and swipe gesture behavior remain identical
- Party chat fullscreen flow still works, just returns to standalone Party DM instead of Solo DM wrapper

## Technical Details

### StandalonePartyDMScreen Props
```text
onBack: () => void
characterContext: CharacterContext
partyId: string | null
isPartyCreator: boolean
partyMembers: PartyMember[]
userId: string
characterName: string
onShowChat: () => void
autoSyncCallbacks: (same shape as AIDMScreen)
```

### Hook Initialization Inside StandalonePartyDMScreen
```text
useGMGuides()           -- GM guide content
usePartyDm(...)         -- party DM session
useDmAutoSync(...)      -- auto-sync (if autoSyncCallbacks provided)
useState for battle map -- independent map state
```

### Files Modified
- `src/components/ai-dm/StandalonePartyDMScreen.tsx` -- NEW
- `src/components/ai-dm/AIDMScreen.tsx` -- Remove party DM overlay and related state
- `src/components/drawers/PromptDrawerProvider.tsx` -- Add `openPartyDMScreen`, remove `returnToPartyDM`
- `src/components/home/HomeScreen.tsx` -- Update DMDrawer callback and chat return logic

### No Cross-Navigation
- Solo DM header will no longer have a "Join Party" / "Start Party" button
- Party DM back button returns to the home screen, not to Solo DM
- Solo DM back button returns to the home screen (unchanged)
