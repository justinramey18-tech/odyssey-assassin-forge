## Goal
Reduce initial load time of the Empyrean AI DM screen (especially party mode) without any behavior changes. Two fixes: lazy-load heavy/rare code paths, and parallelize the party initial fetch.

## Changes

### 1. `src/App.tsx` — lazy-load route pages
- Keep `Index` eager (primary route).
- Convert `Install`, `Auth`, `ResetPassword`, `RecoverAccount`, `NotFound`, `Features`, `CharacterRoster`, `AICreationAssistant` to `React.lazy()` imports.
- Wrap the `<Routes>` block inside `<BrowserRouter>` in a single `<Suspense fallback={<div className="min-h-screen bg-background" />}>` boundary.

### 2. `src/pages/Index.tsx` — lazy-load heavy conditional screens
- Add `lazy, Suspense` to the React import.
- Convert these to lazy imports (using `.then(m => ({ default: m.NAME }))` for named exports, plain form for defaults — verify each per file):
  - `NarrativeForgeScreen`
  - `ChronicleSyncScreen`
  - `ConstellationScreen`
  - `AchievementsScreen`
  - `CombatTabScreen`
  - `AbilitiesScreen`
  - `UnifiedInventoryScreen`
  - `InventoryScreen`
- Wrap the main conditional screen render area in one high-level `<Suspense fallback={<div className="min-h-screen bg-background" />}>`.
- Leave eager: HomeScreen, ModeSelectionScreen, headers, navigation, and anything on the default home view.

### 3. `src/components/empyrean/EmpyreanDMScreen.tsx` — lazy-load rare overlays
- Add `lazy, Suspense` to the React import.
- Convert to lazy (verify default vs named export for each):
  - `CinematicSlideshow`
  - `ThreshingCinematic`
  - `MemorialScreen`
  - `DeathSaveScreen`
  - `EmpyreanCampaignSetup` (named export — use `.then` wrapper)
  - `BurnoutFlameOverlay` only if non-trivial in size; otherwise leave eager.
- Wrap each lazy overlay's render site in its own inline `<Suspense fallback={null}>` (they're already conditionally rendered).
- Do NOT lazy-load the chat, input bar, pills, bottom nav, or character sheet.

### 4. `src/hooks/use-party-dm.ts` — parallelize + (optionally) trim initial fetch
In the effect around line 367:
- Run the `party_dm_messages` fetch and the `party_dm_prompts` fetch in `Promise.all`. Use a resolved `{ data: null }` placeholder when there's no `currentRoundId`.
- Switch the messages query to `order('created_at', { ascending: false }).limit(200)` and reverse the result before `setMessages` so downstream order is unchanged (ascending/oldest-first).
- Keep limit at 200 — `messages` likely feeds AI context downstream; safer not to shrink.
- Keep the split-backfill block after the parallel block, behavior unchanged.
- Keep the dependency array unchanged.
- Keep all realtime subscriptions and the rest of the file untouched.

## Guards
- No behavior, prop, or logic changes anywhere.
- Every `lazy()` usage is wrapped in `Suspense` with a non-layout-shifting fallback (`null` for overlays, dark full-screen div for routes/screens).
- Named exports keep the `.then(m => ({ default: m.NAME }))` wrapper — no export-shape changes.
- Message ordering passed to `setMessages` remains ascending (oldest first).
- No reduction of message limit below 200.
- No changes to Solo vs Party branching, Director, onboarding, private mode, or any feature flag.

## Verification after build
- Home route still renders instantly with no flash.
- Navigating to Auth/Recover/etc. works (lazy chunks load).
- Empyrean DM opens; cinematic/threshing/death/memorial/setup overlays trigger correctly when their conditions are met.
- Party DM session loads messages in original order; prompts appear; split backfill still works on the empty+split path.
