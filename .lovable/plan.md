# Character Management Rework — Technical Plan

## Overview

Rework the character save/load system from a "load-last-character-on-boot" model to a **Login → Character Roster → App Mode → Main App** flow. This includes a full-screen roster screen, improved save isolation, in-memory character switching (no page reload), and a decoupled auto-save architecture.

---

## Phase 1: Character Roster Screen

### Goal
After authentication, users see a full-screen roster of all their cloud-saved characters. They pick one (or create new) before entering the app.

### New Files
- **`src/pages/CharacterRoster.tsx`** — Full-screen page listing cloud saves as selectable cards with a "Create New Character" button.
- **`src/components/roster/RosterCharacterCard.tsx`** — Individual character card (name, level, class, last played, preview stats).
- **`src/components/roster/RosterEmptyState.tsx`** — Shown when user has zero saves; prompts to create first character.

### Changes to Existing Files
- **`src/App.tsx`** — Add `/roster` route. Update `"/"` route to include a roster gate (redirect to `/roster` if no active character selected this session).
- **`src/pages/Index.tsx`** — Remove the `showWizard` bootstrap logic that auto-loads from localStorage on mount. Instead, expect character data to arrive via route state or a context/provider. Remove `loadAutoSave()` call at top level.
- **`src/pages/Auth.tsx`** — On successful sign-in, navigate to `/roster` instead of `/`.

### Data Flow
```
Auth.tsx → navigate('/roster')
CharacterRoster.tsx → fetches cloud saves via useCloudSave(userId)
  ├─ User picks a save → loadFromCloud(saveId) → navigate('/', { state: { saveData, saveId } })
  └─ User clicks "Create New" → navigate('/', { state: { newCharacter: true } })
Index.tsx → reads location.state, hydrates character state, clears location state
```

### Roster Card Data
Each card displays (from `character_saves` row):
- `save_name` (character name)
- `character_data.level`, `character_data.class`, `character_data.subclass`
- `updated_at` (relative time: "2h ago", "3 days ago")
- Preview badges from `extended_data` (gold, spell count, loot count — reuse `CloudSavePreview` interface)
- Visual accent based on class color

### Roster Screen UX
- Loading spinner while fetching saves
- Cards sorted by `updated_at DESC`
- "Create New Character" card at the bottom (or top if 0 saves)
- Subtle entry animations via framer-motion
- No hamburger drawer — this IS the character picker now

---

## Phase 2: Save Isolation Overhaul

### Goal
Prevent data "bleeding" between characters. Each character's localStorage is fully namespaced by cloud save ID.

### Current State
- `getScopedKey(baseKey)` in `src/lib/scoped-storage.ts` prefixes keys with `odyssey-active-cloud-save-id` from localStorage.
- Only ~15 keys in `SCOPED_KEYS` array are scoped; many others (HP, death saves, prestige, spellcasting, proficiencies, shop, loot, conditions, combat settings) write to **unscoped** keys directly in `Index.tsx`.

### Changes

#### `src/lib/scoped-storage.ts`
- Add a `clearAllScopedKeys(saveId: string)` function that removes all known scoped keys for a given save ID (used during character deletion).
- Add a `bulkRestoreScoped(saveId: string, data: Record<string, string>)` function for cloud load.

#### `src/pages/Index.tsx` — Scope ALL localStorage writes
Convert every `localStorage.setItem('odyssey-*', ...)` call to use `setScopedItem()`:
- `odyssey-hp-state`
- `odyssey-death-saves`
- `odyssey-prestige-data`
- `odyssey-prestige-tree`
- `odyssey-spellcasting`
- `odyssey-consumables-inventory`
- `odyssey-proficient-skills`
- `odyssey-proficient-saves`
- `odyssey-expertise-skills`
- `odyssey-inspiration`
- `odyssey-combat-settings`
- `odyssey-conditions`
- `odyssey-cooldown-state`
- `odyssey-loot`

This is the **largest change** in the rework. Every `localStorage.getItem` / `setItem` for these keys must be audited and converted.

#### `src/hooks/use-cloud-save.ts` — Expand SCOPED_KEYS
Add all the above keys to the `SCOPED_KEYS` array so they're captured in cloud saves and restored on load.

#### Migration
- On first load after rework, if unscoped keys exist and a save ID is active, run `migrateToScoped()` for each newly-scoped key.
- Add a one-time migration flag `odyssey-scoped-migration-v2` to prevent re-running.

---

## Phase 3: In-Memory Character Switching

### Goal
Switch characters without `window.location.reload()`. Tear down and rebuild React state in-place.

### Current State
- `handleLoadCloudSave` in Index.tsx (lines 1068-1250+) manually sets ~20 state variables and writes to localStorage, but several hooks read from localStorage on mount and don't re-sync when keys change externally.
- Some hooks (shop, loot, consumables, spellcasting) init from localStorage in `useState(() => ...)` initializers, so they don't pick up new values without a reload.

### Approach: `resetToCharacter(saveData)` function

#### New File: `src/hooks/use-character-session.ts`
A centralized hook that:
1. Holds the "active save ID" in state
2. Provides `loadCharacter(saveData, saveId)` — flushes current character to cloud, then resets all state
3. Provides `createNewCharacter()` — flushes current, clears state, opens wizard
4. Emits a `odyssey-character-loaded` custom event that downstream hooks can listen to for re-initialization

#### Changes to hooks that init from localStorage
Each hook that reads localStorage in its initializer needs a `reset(newData)` method or must listen for the `odyssey-character-loaded` event:
- `use-shop.ts` → add `resetShop(shopState)` or `loadFromData(data)`
- `use-loot.ts` → add `resetLoot(lootState)`
- `use-consumables.ts` → add `resetConsumables(items)`
- `use-spellcasting.ts` → add `resetSpellcasting(state)`
- `use-conditions.ts` → add `resetConditions(state)`
- `use-combat-log.ts` → add `resetLog()`
- `use-action-economy.ts` → add `resetActions()`
- `use-prestige-tree.ts` → already has `resetTree()`

#### `src/pages/Index.tsx`
- Replace `handleLoadCloudSave` with a call to `characterSession.loadCharacter(data, saveId)`
- The session hook orchestrates the flush → clear → hydrate → notify cycle
- Remove `window.location.reload()` calls (if any remain)

### Flush-Before-Switch Guarantee
Before switching:
1. `autoSync.syncNow()` — saves current state to cloud under current save ID
2. Wait for completion (or timeout after 3s)
3. Only then proceed to tear down state

---

## Phase 4: Auto-Save Architecture Refinement

### Goal
Decouple local and cloud save pipelines. Make the active save ID the single source of truth.

### Current State
- `use-auto-cloud-sync.ts` handles both local (`localStorage`) and cloud (Supabase) saves with separate debounce timers (1s local, 30s cloud).
- The hook rebuilds `SaveData` from props on every render, which can cause stale references if state is mid-update.

### Changes

#### `src/hooks/use-auto-cloud-sync.ts`
- **Local save**: Write to scoped localStorage keys (via `setScopedItem`) instead of a single `odyssey-character-autosave` blob. Each subsystem writes its own scoped key independently.
- **Cloud save**: Keep the 30s debounce but use `useRef` for the latest data snapshot (already partially done). Add a `pendingFlush` promise that `loadCharacter` can await.
- **Remove** the monolithic `odyssey-character-autosave` key. Instead, reconstruct `SaveData` on-demand from individual scoped keys when needed for cloud upload.

#### `src/hooks/use-auto-save.ts`
- Deprecate or repurpose. The single-blob autosave is replaced by per-key scoped writes + cloud sync.
- Keep `SaveData` interface (used by cloud save) but remove the autosave hook itself.
- Add a `buildSaveData()` utility function that assembles `SaveData` from current state (called by cloud sync and by flush-before-switch).

---

## Phase 5: Navigation & Session Flow

### Goal
Wire up the full `Login → Roster → App Mode → Main` flow with proper guards.

### Session State
Add to `src/pages/Index.tsx` (or a new context):
- `characterLoadedThisSession: boolean` — Set to true when a character is loaded from roster. If false and user navigates to `/`, redirect to `/roster`.
- `appModeSelectedThisSession: boolean` — Already exists via `showIntroSplash`. Keep as-is but gate it AFTER character selection.

### Route Guards
- **`/` (Index)**: If not authenticated → redirect to `/auth`. If authenticated but no character loaded → redirect to `/roster`.
- **`/roster`**: If not authenticated → redirect to `/auth`. If character already loaded → show roster with "currently playing" highlight and option to switch.
- **`/auth`**: If already authenticated → redirect to `/roster`.

### Navigation Updates
- `Auth.tsx`: `navigate('/roster')` on success
- `CharacterRoster.tsx`: `navigate('/', { state: { saveData, saveId } })` on character select
- `Index.tsx`: Read `location.state` on mount, hydrate, then `navigate('/', { replace: true })` to clear state
- `AssassinHeader.tsx`: Keep the `CharacterQuickSwitcher` dropdown but have it navigate to `/roster` instead of loading inline (or keep inline switching as a shortcut)

### Back Button Behavior
- From main app, pressing back should NOT go to roster (use `replace: true` on navigation)
- From roster, pressing back goes to auth (or stays on roster if session is active)

---

## File Change Summary

### New Files (Phase 1)
| File | Purpose |
|------|---------|
| `src/pages/CharacterRoster.tsx` | Full-screen character roster page |
| `src/components/roster/RosterCharacterCard.tsx` | Individual character card component |
| `src/components/roster/RosterEmptyState.tsx` | Empty state for zero saves |

### New Files (Phase 3)
| File | Purpose |
|------|---------|
| `src/hooks/use-character-session.ts` | Centralized character load/switch/create orchestrator |

### Modified Files
| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/roster` route |
| `src/pages/Auth.tsx` | Navigate to `/roster` on sign-in |
| `src/pages/Index.tsx` | Remove auto-load bootstrap; accept character from route state; scope all localStorage; use character session hook |
| `src/lib/scoped-storage.ts` | Add `clearAllScopedKeys`, `bulkRestoreScoped` |
| `src/hooks/use-cloud-save.ts` | Expand `SCOPED_KEYS` to include all character-scoped keys |
| `src/hooks/use-auto-cloud-sync.ts` | Use scoped writes; add flush promise |
| `src/hooks/use-auto-save.ts` | Deprecate monolithic save; extract `buildSaveData()` |
| `src/hooks/use-shop.ts` | Add `loadFromData()` reset method |
| `src/hooks/use-loot.ts` | Add `loadFromData()` reset method |
| `src/hooks/use-consumables.ts` | Add `loadFromData()` reset method |
| `src/hooks/use-spellcasting.ts` | Add `loadFromData()` reset method |
| `src/hooks/use-conditions.ts` | Add reset method |
| `src/components/home/CharacterSavesDrawer.tsx` | Simplify or remove (replaced by roster) |
| `src/components/navigation/CharacterQuickSwitcher.tsx` | Update to navigate to `/roster` or use session hook |

---

## Implementation Order

1. **Phase 1** — Roster screen + routing (3-5 prompts)
2. **Phase 5** — Navigation guards + session flow (2-3 prompts, pairs with Phase 1)
3. **Phase 2** — Save isolation (3-5 prompts, biggest audit)
4. **Phase 3** — In-memory switching (3-4 prompts)
5. **Phase 4** — Auto-save refinement (2-3 prompts)

**Total estimate: 13-20 prompts**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking existing saves | Migration function converts unscoped → scoped keys on first load |
| Hooks not re-initializing on switch | Each hook gets a `reset()` method + listens for `odyssey-character-loaded` event |
| Cloud save race condition during switch | Flush-before-switch with 3s timeout guarantee |
| Back button confusion | Use `replace: true` navigation to prevent roster appearing in history stack |
| Guest/unauthenticated users | Roster requires auth; no guest mode. Existing auth gate handles this. |
