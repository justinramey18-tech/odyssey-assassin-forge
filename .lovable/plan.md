

# Add Custom Team Names to Party Split

## Overview

Add two text inputs to the `SplitInitiator` UI for naming the teams (defaulting to "Team Alpha" and "Team Beta"). Pass the names through to `initiateSplit`, store them in `DmSplitState`, and display them everywhere team labels appear (banner, summaries viewer, regroup dialog).

## Changes

### 1. `src/lib/party-split-types.ts`
Add two optional fields to `DmSplitState`:
- `alphaName?: string` (defaults to "Team Alpha")
- `betaName?: string` (defaults to "Team Beta")

### 2. `src/components/ai-dm/PartySplitUI.tsx`

**SplitInitiator**: Add two styled text inputs below the member grid — one for each team name, pre-filled with "Team Alpha" / "Team Beta". Update `onInitiate` signature to pass `(alphaMembers: string[], alphaName: string, betaName: string)`. The instruction text and count labels dynamically use the typed names instead of hardcoded "Alpha"/"Beta".

**SplitBanner**: Read `splitState.alphaName` / `splitState.betaName` (falling back to "Team Alpha" / "Team Beta") for the team label display.

**SplitSummariesViewer**: Use the stored team names in the summary section headers instead of hardcoded "Team Alpha Summary" / "Team Beta Summary".

### 3. `src/hooks/use-party-dm.ts`

Update `initiateSplit` signature to accept `(alphaMembers: string[], alphaName?: string, betaName?: string)`. Store the names in the `splitData` object written to `party_shared_state`.

### 4. `src/components/ai-dm/PartyDMScreen.tsx`

Update the `onInitiate` callback passed to `SplitInitiator` to forward the team names to `partyDm.initiateSplit(alphaMembers, alphaName, betaName)`.

## Files Changed

| File | Change |
|------|--------|
| `src/lib/party-split-types.ts` | Add `alphaName?: string` and `betaName?: string` to `DmSplitState` |
| `src/components/ai-dm/PartySplitUI.tsx` | Add name inputs to `SplitInitiator`, use stored names in `SplitBanner` and `SplitSummariesViewer` |
| `src/hooks/use-party-dm.ts` | Accept and store team names in `initiateSplit` |
| `src/components/ai-dm/PartyDMScreen.tsx` | Forward team names from `SplitInitiator` to hook |

