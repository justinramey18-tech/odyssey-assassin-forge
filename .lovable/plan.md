
Root cause identified:
- `src/pages/Index.tsx` reads `dnd-druid-circle` from scoped storage only once (`useMemo(..., [])`), then never updates.
- `src/components/magic/ClassSpellcastingScreen.tsx` reads/writes druid circle with raw `localStorage` (unscoped key), not scoped storage.
- Result: the Circle panel can show “Moon” while `useWildShape(...)` still receives `null` (or stale value), so Wild Shape falls back to base druid CR cap (max CR 1).

Implementation plan:

1) Unify druid circle persistence to character-scoped storage
- File: `src/components/magic/ClassSpellcastingScreen.tsx`
- Replace `localStorage.getItem/setItem` for:
  - `dnd-druid-circle`
  - `dnd-druid-land`
  with `getScopedItem/setScopedItem` (and `migrateToScoped` at init to preserve existing users’ old unscoped data).

2) Make circle changes reactive for Wild Shape
- File: `src/components/magic/ClassSpellcastingScreen.tsx`
- In `handleSelectCircle`, after saving, dispatch a custom event (e.g. `odyssey-druid-circle-changed`) so parent-level systems update immediately.
- (Optional consistency) do same for land selection event.

3) Replace static circle read in Index with reactive state
- File: `src/pages/Index.tsx`
- Replace current `useMemo` circle read with `useState` + `reloadDruidCircle()` helper.
- Listen for:
  - `odyssey-druid-circle-changed` (same-tab updates)
  - `odyssey-character-loaded` (character switch)
  - `storage` (cross-tab updates)
- Update local `druidCircle` state from scoped storage in those handlers.
- Keep `useWildShape(isDruidClass ? level : 0, isDruidClass ? druidCircle : null, ...)` unchanged, now fed with live value.

4) Verification checklist
- Select Circle of the Moon on a druid and confirm Wild Shape tracker updates immediately (no refresh).
- Confirm CR cap rises by level (e.g., L6 => CR2, L9 => CR3, L20 => CR12) and Moon-only forms appear.
- Switch characters/saves and verify each character keeps its own circle selection.
- Cross-tab check: changing circle in one tab updates another tab’s cap display.

Technical notes:
- This is a client-state consistency bug, not a rules-data bug (`MOON_CIRCLE_WILD_SHAPE` progression is already defined correctly).
- The fix is intentionally limited to storage + reactivity plumbing; no Wild Shape rules tables need changes.
