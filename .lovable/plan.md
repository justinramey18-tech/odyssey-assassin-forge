

# Per-Character Save System Improvements

## Current Problem

Many game systems store their state in **global localStorage keys** that are shared across all characters. When you switch characters, data from one character "bleeds" into another. Here are the affected systems:

| System | Storage Key | Issue |
|--------|------------|-------|
| Campaign Summary (AI DM) | `dnd-ai-dm-campaign-summary` | Shared across all characters |
| Wild Shape State | `dnd-wild-shape-state` | Druid forms shared between characters |
| Wild Shape Backgrounds | `odyssey-wild-shape-backgrounds` | Custom form images shared |
| Shop State | `odyssey-shop` | Gold and purchase history shared |
| Saved Stories | `odyssey-saved-stories` | All characters share same story library |
| Chronicle History | Chronicle session/analytics keys | Campaign logs shared |
| Battlemap Grid Size | `dnd-battlemap-grid-size` | Minor, but shared |

Meanwhile, the cloud save system (`use-cloud-save.ts`) already saves/restores `shopGold` and other fields -- but the **localStorage layer** doesn't namespace by character, so switching characters locally overwrites the previous character's cached state.

---

## Proposed Solution: Character-Scoped Local State

### 1. Create a Local State Namespace Utility

A small utility that prefixes localStorage keys with the active cloud save ID, so each character gets isolated local storage.

**New file: `src/lib/scoped-storage.ts`**

```typescript
// Reads/writes localStorage keys scoped to the active character save ID
// e.g. "odyssey-shop" becomes "odyssey-shop::abc123" when save abc123 is active
// Falls back to the unscoped key when no save ID is set (guest/new character)

export function getScopedKey(baseKey: string): string {
  const saveId = localStorage.getItem('odyssey-active-cloud-save-id');
  return saveId ? `${baseKey}::${saveId}` : baseKey;
}

export function getScopedItem(baseKey: string): string | null {
  return localStorage.getItem(getScopedKey(baseKey));
}

export function setScopedItem(baseKey: string, value: string): void {
  localStorage.setItem(getScopedKey(baseKey), value);
}

export function removeScopedItem(baseKey: string): void {
  localStorage.removeItem(getScopedKey(baseKey));
}
```

### 2. Migrate Affected Hooks to Use Scoped Storage

Update the following hooks to use `getScopedItem` / `setScopedItem` instead of raw `localStorage.getItem` / `setItem`:

- **`use-shop.ts`** -- Shop gold, items, and purchase history become per-character
- **`use-wild-shape.ts`** -- Wild shape form state becomes per-character
- **`use-wild-shape-backgrounds.ts`** -- Custom form images per-character
- **`use-saved-stories.ts`** -- Story library and active story per-character
- **`use-chronicle-history.ts`** -- Campaign session logs per-character
- **`campaign-summary-storage.ts`** -- AI DM campaign summary per-character

Each hook already follows the same pattern (read from localStorage on init, write on change). The only change is swapping `localStorage.getItem(KEY)` for `getScopedItem(KEY)` and `localStorage.setItem(KEY, val)` for `setScopedItem(KEY, val)`.

### 3. Clear/Swap Scoped State on Character Switch

In `Index.tsx`, when `handleLoadCloudSave` runs and sets a new `activeCloudSaveId`:
- The new save ID gets written to `odyssey-active-cloud-save-id` (already happens)
- On the forced page reload that follows (already happens), all hooks re-initialize and read from the new scoped keys automatically

No additional swap logic is needed because the reload re-runs all `useState` initializers with the updated save ID.

### 4. Migration: Move Existing Global Data to First Character's Scope

For users who already have data in the old unscoped keys, add a one-time migration:
- On app load, if `odyssey-active-cloud-save-id` is set AND unscoped data exists, copy it to the scoped key and remove the unscoped version
- This prevents data loss for existing users

---

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/lib/scoped-storage.ts` | **New** -- scoped localStorage utility |
| `src/hooks/use-shop.ts` | Replace raw localStorage calls with scoped versions |
| `src/hooks/use-wild-shape.ts` | Replace raw localStorage calls with scoped versions |
| `src/hooks/use-wild-shape-backgrounds.ts` | Replace raw localStorage calls with scoped versions |
| `src/hooks/use-saved-stories.ts` | Replace raw localStorage calls with scoped versions |
| `src/hooks/use-chronicle-history.ts` | Replace raw localStorage calls with scoped versions |
| `src/lib/campaign-summary-storage.ts` | Replace raw localStorage calls with scoped versions |

## What This Fixes

- Switching from a Druid to a Fighter no longer shows wild shape data
- Each character keeps their own shop gold and purchase history
- AI DM campaign summaries are per-character, not shared
- Story library is per-character
- Chronicle campaign logs are per-character
- All data survives character switching without bleeding

## Edge Cases Handled

- **Guest users (no cloud save)**: Falls back to unscoped keys, behaving exactly as today
- **Existing users**: One-time migration copies current global data to the active character's scope
- **New characters**: Start with empty scoped keys (clean slate)

