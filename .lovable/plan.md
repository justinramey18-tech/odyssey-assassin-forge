

## Phase 1 Implementation: App Mode Data Layer + Mode Selection Screen

This phase creates the foundational data layer and the first-launch mode picker. No existing files are modified yet -- that comes in Phase 2.

---

### File 1: `src/lib/app-modes.ts` (NEW)

Core data layer containing:

- **`AppMode` type**: `'companion' | 'player' | 'storyteller' | 'party' | 'fullAccess'`
- **`AppModeConfig` interface**: Defines `label`, `description`, `icon`, `color`, and four visibility arrays (`visibleTabs`, `visibleHomeFeatures`, `visibleQuickAccess`, `visibleDMButtons`)
- **`APP_MODE_CONFIGS`**: The full visibility matrix from the approved plan, mapping each mode to its exact feature IDs
- **`APP_MODES_ORDERED`**: Array of modes in display order for the selection screen
- **Helper functions**:
  - `isFeatureVisible(featureId, mode, customOverrides?)` -- general check across all categories
  - `getFilteredSubTabsForCategory(category, mode, overrides?)` -- filters tab arrays for navigation
  - `getVisibleCategories(mode, overrides?)` -- returns categories that have at least one visible tab
  - `isHomeFeatureVisible()`, `isDMButtonVisible()`, `isQuickAccessVisible()` -- convenience wrappers
  - `getAllFeatureIds()` -- returns all feature IDs with labels, grouped by category (for future customization UI)
- **`CustomOverrides` type**: `Record<string, boolean>` for per-mode feature toggles

---

### File 2: `src/hooks/use-app-mode.ts` (NEW)

React hook following the same pattern as `use-play-mode.ts`:

- **localStorage keys**: `odyssey-app-mode` (mode), `odyssey-app-mode-custom` (overrides)
- **Custom event**: `odyssey-app-mode-change` for cross-component reactivity
- **Returns**:
  - `appMode` -- current mode or `null` (first launch)
  - `effectiveMode` -- defaults to `'fullAccess'` when no mode is set
  - `hasChosenMode` -- boolean controlling whether ModeSelectionScreen shows
  - `setAppMode(mode)` -- persists mode, resets custom overrides, dispatches event
  - `customOverrides`, `setCustomOverride(id, visible)`, `resetCustomizations()`
  - Bound visibility helpers: `isFeatureVisible()`, `isHomeFeatureVisible()`, `isDMButtonVisible()`, `isQuickAccessVisible()`
  - `getFilteredTabs(category)` -- ready-to-use filtered tab arrays
  - `visibleCategories` -- memoized list of categories with visible tabs

---

### File 3: `src/components/home/ModeSelectionScreen.tsx` (NEW)

Fullscreen mode picker shown on first launch (replaces IntroSplashScreen in a future phase):

- **Layout**: Fullscreen, mobile-first, vertical scroll, centered content
- **5 mode cards** with staggered entry animations (framer-motion):
  - Icon (Sparkles/Sword/BookOpen/Users/Crown)
  - Mode-specific color accent (amber/red/violet/blue/emerald)
  - Label, description, and tab count badge
  - Tap-to-select with scale feedback
- **Header**: "Choose Your Mode" with subtitle
- **Footer**: "Your data is never deleted when switching modes -- only visibility changes."
- **Props**: `onSelectMode: (mode: AppMode) => void`

---

### What is NOT changed yet (Phase 2+)

- `Index.tsx` -- Will wire `useAppMode()` and replace `IntroSplashScreen` with `ModeSelectionScreen`
- Navigation components -- Will filter tabs using `getFilteredTabs()`
- `HomeScreen.tsx` -- Will conditionally render elements using `isHomeFeatureVisible()`
- `DMDrawer.tsx` -- Will gate buttons using `isDMButtonVisible()`
- Settings -- Will add mode switcher and customization UI
- `IntroSplashScreen.tsx` -- Will be deleted

