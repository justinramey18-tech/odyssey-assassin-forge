

# Prompt 3 of 5: Unbonded Campaign State

## Overview

After a rider dies and clicks "Begin again" from the memorial screen, they re-enter the campaign without a dragon, signet, or bond chat. This prompt gates all dragon-related features behind an `isUnbonded` flag and provides unbonded-specific actions, DM persona, and a GM guide.

## Changes

### 1. `src/lib/dragonBondState.ts` — Add unbonded helpers

Add `UNBONDED_KEY = 'empyrean-unbonded-status'` constant and two functions:
- `getIsUnbonded()` — reads from scoped storage, returns boolean
- `setIsUnbonded(unbonded: boolean)` — writes to scoped storage

### 2. Register the new key in all three registries

- `src/lib/scoped-keys.ts` — add `'empyrean-unbonded-status'` to `SCOPED_KEYS`
- `src/lib/resetApp.ts` — add `'empyrean-unbonded-status'` to `ALL_STORAGE_KEYS`
- `src/hooks/use-auto-save.ts` — add `empyreanUnbondedStatus?: boolean` to `SaveData` interface

### 3. `src/components/empyrean/EmpyreanDMScreen.tsx` — Gate dragon features

Read `isUnbonded` via `useMemo(() => getIsUnbonded(), [])` on mount.

**A. Dragon chat**: When `isUnbonded`, tapping the oracle tab opens a Sheet with an empty state ("The silence is vast. No bond stirs.") instead of `DragonBondChat`.

**B. Burnout system**: When `isUnbonded`, force `burnoutLevel` to 0, hide burnout +/- buttons, skip `BurnoutFlameOverlay`, replace `BurnoutIndicator` with "No signet" label.

**C. Contextual actions**: Pass `isUnbonded` prop to `EmpyreanContextualActions`.

**D. Bottom nav oracle tab**: When `isUnbonded`, set `oracleLabel="UNBONDED"`, `oracleColor="text-red-400/50"`, `oracleActiveBg="bg-red-500/5"`, `oracleCount={0}`.

**E. Unbonded banner**: Render a small red-tinted banner above messages when `isUnbonded`.

**F. Auto-install GM guide**: `useEffect` that installs the "Threshing Rebirth Protocol" guide via `addGuide` when `isUnbonded` and guide doesn't exist.

**G. Pass `isUnbonded` to `buildEmpyreanDMPersona()`** in the `dmPersonaPrompt` useMemo.

**H. Memorial `onBeginAgain`**: Add `setIsUnbonded(true)` call alongside the existing reset logic.

### 4. `src/components/empyrean/EmpyreanContextualActions.tsx` — Unbonded actions

Add `isUnbonded?: boolean` to props. Define `UNBONDED_ACTIONS` (combat, social, training, exploration, downtime, crisis) with ground-only, no-dragon actions as specified. When `isUnbonded`, use `UNBONDED_ACTIONS` instead of `buildActions(...)`.

### 5. `src/components/empyrean/EmpyreanCampaignSetup.tsx` — Skip dragon config

Add `isUnbonded?: boolean` to props. When `isUnbonded`, replace the dragon name and signet inputs in step 0 with a red-tinted notice card ("UNBONDED RIDER — You have not yet been chosen during Threshing..."). Force `dragonName: ''` and `signetType: ''` on launch.

### 6. `src/lib/empyreanDMPersona.ts` — Unbonded persona

Add `isUnbonded: boolean = false` parameter to `buildEmpyreanDMPersona()`. When true:
- Skip CHARACTER INTEGRATION dragon/signet sentences
- Skip DRAGON IN THE NARRATIVE section
- Skip SIGNET BURNOUT TRACKING section
- Skip BOND STRAIN/GROWTH EVENTS sections
- Skip DRAGON MEMORY FORMATION section
- Skip BURNOUT TICK EVENTS section
- Skip DRAGON-RIDER BOND STATUS section
- Skip RECENT DRAGON-RIDER PRIVATE COMMUNICATION section
- Skip DRAGON'S PERSISTENT MEMORIES section
- Insert new UNBONDED RIDER STATUS section with combat, narrative, party dragon, and NPC handling instructions

### 7. `src/components/ai-dm/PartyDMScreen.tsx` — Mirror unbonded support

Read `isUnbonded` and apply the same memorial `onBeginAgain` call to `setIsUnbonded(true)`.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/dragonBondState.ts` | Add `getIsUnbonded` / `setIsUnbonded` |
| `src/lib/scoped-keys.ts` | Register new key |
| `src/lib/resetApp.ts` | Register new key |
| `src/hooks/use-auto-save.ts` | Add field to `SaveData` |
| `src/components/empyrean/EmpyreanDMScreen.tsx` | Gate dragon features, banner, GM guide, persona param |
| `src/components/empyrean/EmpyreanContextualActions.tsx` | Unbonded action sets |
| `src/components/empyrean/EmpyreanCampaignSetup.tsx` | Skip dragon config |
| `src/lib/empyreanDMPersona.ts` | `isUnbonded` parameter, unbonded persona section |
| `src/components/ai-dm/PartyDMScreen.tsx` | `setIsUnbonded(true)` in memorial flow |

No new files created. No existing bonded code removed — only gated behind `!isUnbonded` checks.

