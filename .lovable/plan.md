

## Code Audit: Saving, Push Notifications, Auth Persistence

### Issues Found

#### 1. Bug: `loadFromCloud` hardcodes `version: 1` instead of `CURRENT_VERSION` (2)
**File:** `src/hooks/use-cloud-save.ts`, line 291
- When loading a cloud save, the version is hardcoded to `1`. The app's current version is `2`. This means cloud-loaded saves will always appear to need migration, and if any code checks `version === CURRENT_VERSION`, it will fail.
- **Fix:** Import `CURRENT_VERSION` or hardcode `2` to match. Best: set `version: 2`.

#### 2. Bug: `readyCount` calculation in `setReady` is inaccurate
**File:** `src/hooks/use-party-dm.ts`, line 511
- `readyCount` is calculated as `currentPrompts.filter(p => p.is_ready).length + 1`. But `currentPrompts` is captured at callback creation time (it's in the dependency array), and the user's own prompt may already be in `currentPrompts` and already marked as ready from a previous round. The `+1` assumes the user wasn't already counted, but if the user had an existing prompt that was updated (line 492-494), the filter already includes them in the count after the DB update propagates via Realtime.
- The count is sent to the server *before* the Realtime UPDATE event arrives, so `currentPrompts` still reflects the pre-update state — the `+1` is correct for the INSERT path (line 507) but also correct for the UPDATE path (line 492) since the old prompt had `is_ready: false`. This is actually fine on closer inspection. No fix needed.

#### 3. Issue: `sendReadyUpNotification` shows duplicate toasts — both "all ready" AND individual
**File:** `src/lib/party-notifications.ts`, lines 66-84
- When all players are ready, the function shows *both* the "All players readied up" toast AND the individual "X has readied up" toast. The individual toast should be skipped when `allReady` is true to avoid noise.
- **Fix:** Add early return after the "all ready" toast.

#### 4. Dead code: `use-auto-save.ts` still has unused imports
**File:** `src/hooks/use-auto-save.ts`, lines 1-12
- `useEffect`, `useRef`, `useCallback` are imported from React but no longer used (the hook function was removed in a previous audit, only types/helpers remain).
- `Character`, `CharacterEquipment`, `Achievement`, `InventoryItem`, `SpellcastingState`, `ActiveSpellEffect`, `PrestigeTreeProgress`, `LootState`, `CombatSettings`, `ConditionsState`, `CooldownSaveState` — many are only used in the `SaveData` interface and are fine. But the React imports are dead.
- Also `DEBOUNCE_MS` (line 15) is unused.
- **Fix:** Remove unused React imports and `DEBOUNCE_MS`.

#### 5. Issue: `usePushSubscription` `isSubscribed` always returns initial ref value
**File:** `src/hooks/use-push-subscription.ts`, line 115
- `isSubscribed: subscribedRef.current` is evaluated once at render time and never triggers re-renders since it's a ref. Any consumer checking `isSubscribed` will always get `false` on first render and won't update when subscription succeeds.
- This is a minor issue since no consumer currently relies on reactive `isSubscribed` state, but it's misleading API. No fix needed now — flagging for awareness.

#### 6. Bug: `beforeunload` handler calls async `saveToCloudNow()` which won't complete
**File:** `src/hooks/use-auto-cloud-sync.ts`, lines 194-196
- `saveToCloudNow()` is async and uses `fetch` internally. In `beforeunload`, the page is closing and async operations are killed. The `navigator.sendBeacon` API should be used for unload saves, but since this is a "best-effort" scenario and the periodic sync covers it, this is acceptable. No fix needed — the comment already acknowledges this.

### Plan Summary

**Files to modify:**

1. **`src/hooks/use-cloud-save.ts`** — Fix `version: 1` → `version: 2` on line 291
2. **`src/lib/party-notifications.ts`** — Skip individual toast when all players are ready (add early return after allReady toast)
3. **`src/hooks/use-auto-save.ts`** — Remove unused React imports (`useEffect`, `useRef`, `useCallback`) and unused `DEBOUNCE_MS` constant

