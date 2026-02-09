

# Wild Shape Real-Time Sync -- Refined Plan

## What This Does (In Plain Terms)

When your Druid transforms into a beast, three things should happen instantly across the whole app:

1. **HP Bar turns green** and shows the beast's HP pool instead of your character's
2. **AC and stats update** to reflect the beast form's armor and abilities
3. **Combat tab sees the beast HP** so damage goes to the right place
4. When the beast form's HP hits zero, everything snaps back to your real character stats automatically, and any leftover damage carries over

Right now, Wild Shape only lives inside the Arcana tab -- it's isolated. This plan lifts it up so the entire app knows about transformations.

---

## The Problem

The `useWildShape` hook is currently created inside the Arcana tab's `ClassSpellcastingScreen`. That means the Home Screen, HP bar, and Combat tab have no idea when you're transformed. We need to move it up to the main app level (`Index.tsx`) and pass it down.

---

## Step-by-Step Changes

### 1. Lift Wild Shape to Index.tsx (the app's brain)

- Import and initialize `useWildShape` in `Index.tsx` using the character's druid level and circle
- Read druid circle from localStorage (same key the Arcana tab already uses)
- Create "effective" values that auto-switch between beast and character stats:
  - `effectiveCurrentHP` -- beast form HP when transformed, character HP otherwise
  - `effectiveMaxHP` -- beast form max HP when transformed, character max HP otherwise
  - `effectiveAC` -- beast AC when transformed, equipment AC otherwise
- Pass these effective values everywhere instead of raw `hpState`

### 2. Update HP Bar (DynamicHealthBar)

- Add two new optional props: `isWildShape` and `wildShapeFormName`
- When `isWildShape` is true:
  - Switch the bar gradient to green tones (healthy: emerald, injured: green-600, critical: green-900)
  - Show the beast name (e.g. "Brown Bear") as a small label inside or above the bar
  - Change the glow and text colors to green
- When false: keep the current blood-red theme unchanged

### 3. Thread Props Through HomeScreen

- Add `isWildShape` and `wildShapeFormName` props to `HomeScreen`
- Forward them to `DynamicHealthBar`
- HP values already come from Index.tsx, so they'll automatically be the effective (wild-shape-aware) values

### 4. Damage Routing in Combat

- Update `handleHPChange` in `Index.tsx`:
  - If transformed, route damage through `wildShape.takeDamage()`
  - If the form drops to 0, the hook returns overflow damage, which gets applied to character HP
  - If not transformed, normal HP update as before

### 5. Rest Integration

- Add `wildShape.onShortRest()` to the existing short rest handler
- Add `wildShape.onLongRest()` to the existing long rest handler
- Both already handle reverting and restoring uses internally

### 6. Remove Duplicate Hook in Arcana Tab

- Pass the wild shape hook instance from Index.tsx down to `ClassSpellcastingScreen` as a prop instead of creating a second instance there
- This prevents two separate wild shape states from going out of sync

---

## Files That Change

| File | What Changes |
|---|---|
| `src/pages/Index.tsx` | Add `useWildShape` hook, create effective HP/AC values, update damage handler, update rest handlers, pass wild shape to HomeScreen and ClassSpellcastingScreen |
| `src/components/home/DynamicHealthBar.tsx` | Add green color mode when `isWildShape` is true, show beast form name |
| `src/components/home/HomeScreen.tsx` | Accept and forward `isWildShape` and `wildShapeFormName` props |
| `src/components/magic/ClassSpellcastingScreen.tsx` | Accept wild shape as a prop instead of creating its own instance |

---

## Edge Cases Handled

- **Not a Druid**: Hook receives level 0, stays inactive, everything works as normal
- **Beast HP hits exactly 0**: Overflow is 0, clean revert with no carry-over damage
- **Rest while transformed**: Auto-reverts first, then restores uses
- **Temp HP**: Set to 0 during wild shape (per D&D rules, temp HP doesn't carry between forms)
- **Cloud saves**: Wild shape is short-lived combat state stored in localStorage only, not cloud-synced (matches current behavior)

