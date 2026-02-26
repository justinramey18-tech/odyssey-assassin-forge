

## Comprehensive Code Audit — Findings & Plan

### Issues Found

#### 1. Bug: `handleShortRest` and `handleLongRest` are not memoized but used as dependencies
**File:** `src/pages/Index.tsx` (lines 1605, 1642)
- `handleShortRest` and `handleLongRest` are plain arrow functions (not `useCallback`), but `handleChronicleRest` (line 1716) wraps them in `useCallback` and lists them as dependencies. Since they're recreated every render, `handleChronicleRest` also recreates every render, defeating the purpose.
- **Fix:** Wrap both in `useCallback`.

#### 2. Bug: `handleAddXP` is not memoized but used as a dependency
**File:** `src/pages/Index.tsx` (line 1314)
- `handleAddXP` is a plain function, used in `autoSyncCallbacks` useMemo dependency array (line 1733). This causes `autoSyncCallbacks` to recreate every render.
- **Fix:** Wrap in `useCallback`.

#### 3. Bug: `handleManualLevelUp` is not memoized
**File:** `src/pages/Index.tsx` (line 1886)
- Passed as prop to `HomeScreen`, causing unnecessary re-renders.
- **Fix:** Wrap in `useCallback`.

#### 4. Unused destructured variables in Index.tsx
**File:** `src/pages/Index.tsx` (line 411)
- `requiresGearUnlocks`, `rerollsDisabled`, `infinityStonesLocked` are destructured from `useGameMode()` but never used in Index.tsx — each consuming component calls `useGameMode()` independently.
- **Fix:** Remove unused destructurings.

#### 5. Bug: `allAbilities` in useEffect dependency array
**File:** `src/pages/Index.tsx` (line 774)
- `allAbilities` is a module-level import (constant), not a state variable. It shouldn't be in the dependency array. While it won't cause bugs (it's stable), it's misleading. Same issue in `handleNewCharacter` deps (line 1951).
- **Fix:** Remove from dependency arrays.

#### 6. `handleNewCharacter` dependency on `allAbilities`
**File:** `src/pages/Index.tsx` (line 1951)
- `allAbilities` is a module-level constant, not a dependency.
- **Fix:** Remove from useCallback deps.

#### 7. Missing `hpState` persistence in `handleShortRest`
**File:** `src/pages/Index.tsx` (line 1611)
- `handleShortRest` uses `setHpState(prev => ...)` but doesn't persist to localStorage (unlike `handleLongRest` and `handleHPChange` which do). The auto-save will eventually catch it, but there's an inconsistency.
- **Fix:** Add localStorage persistence after state update.

#### 8. `handleApplyChronicleChanges` not memoized
**File:** `src/pages/Index.tsx` (line 1736)
- Large function passed as prop, recreated every render.
- **Fix:** Wrap in `useCallback`.

#### 9. `handleExportJSON` not memoized
**File:** `src/pages/Index.tsx` (line 1559)
- Not critical but follows the pattern issue.
- **Fix:** Wrap in `useCallback` for consistency.

#### 10. Stale closure risk in `handleChronicleRest`
**File:** `src/pages/Index.tsx` (line 1716-1722)
- Calls `handleLongRest()` and `handleShortRest()` which close over `hpState`. If `handleChronicleRest` is memoized but the rest handlers aren't, this creates stale closure bugs.
- **Fix:** Fixed by issue #1 above — wrapping rest handlers in useCallback with proper deps.

### Plan Summary

All changes are in `src/pages/Index.tsx`:

1. **Remove unused destructurings** from `useGameMode()` on line 411
2. **Wrap `handleShortRest`** in `useCallback` with proper deps + add localStorage persistence
3. **Wrap `handleLongRest`** in `useCallback` with proper deps
4. **Wrap `handleAddXP`** in `useCallback` with proper deps
5. **Wrap `handleManualLevelUp`** in `useCallback` with proper deps
6. **Wrap `handleApplyChronicleChanges`** in `useCallback` with proper deps
7. **Remove `allAbilities`** from dependency arrays (lines 774, 1951) — it's a module constant
8. **Add localStorage persistence** to `handleShortRest` for HP state consistency

These fixes address re-render cascades, stale closure risks, and data persistence gaps. No breaking changes — all are internal optimizations that maintain current functionality.

