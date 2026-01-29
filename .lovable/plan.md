
# Plan: Display Unlock Requirements in Gear Menu and Stars Tabs

## Overview
Add unlock requirement information for individual set pieces in both the Gear tab and Stars tab. This helps players understand what achievements they need to progress to unlock specific legendary gear.

---

## Changes

### 1. Enhance Stars Tab (ConstellationMap)
**File:** `src/components/constellation/ConstellationMap.tsx`

When a star (item) is selected in the constellation:
- Import achievement utilities (`itemPrerequisites`, `achievementCategories`)
- Look up the item's prerequisite achievement
- Display in the info panel:
  - Achievement name and description
  - Current progress vs required value
  - Visual progress bar (similar to ItemDetailSheet style)
  - "Unlocked" badge if requirement is met

**Visual Design:**
- Add a new section below the current "Equip in Gear tab" text
- Use amber/red color coding based on locked/unlocked status
- Show a compact progress indicator

### 2. Enhance Gear Menu Equipment Cards
**File:** `src/components/inventory/EquipmentSlotCard.tsx`

Currently shows minimal lock info. Enhance to:
- Display the achievement name more prominently
- Add a small progress bar below the achievement name
- Keep the current `X/Y` progress format

### 3. Enhance Inventory Drawer
**File:** `src/components/inventory/InventoryDrawer.tsx`

The drawer already shows lock info. Enhance to:
- Add achievement description tooltip or inline text
- Show progress bar for each locked item

---

## Technical Details

### ConstellationMap Changes
- Import from `@/lib/achievements`:
  - `itemPrerequisites`
  - `achievementCategories`
- In the selected star info panel, add unlock requirement section:
  ```text
  ┌─────────────────────────────────────┐
  │ [Icon] Item Name                    │
  │ Slot: chest                         │
  │ ✓ EQUIPPED  or  🔒 LOCKED           │
  ├─────────────────────────────────────┤
  │ 🔓 Unlock Requirement               │
  │ "Surviving After 0 HP"              │
  │ ████████░░░░ 7/10                   │
  └─────────────────────────────────────┘
  ```

### EquipmentSlotCard Changes
- Add a mini progress bar inside the lock overlay
- Progress bar uses same styling as ItemDetailSheet (amber gradient when locked, green when unlocked)

### InventoryDrawer Changes
- Expand lock info display to include:
  - Achievement icon
  - Mini progress bar
  - Short description on hover/tap

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/constellation/ConstellationMap.tsx` | Add unlock requirement display in selected star panel |
| `src/components/inventory/EquipmentSlotCard.tsx` | Add mini progress bar to lock overlay |
| `src/components/inventory/InventoryDrawer.tsx` | Enhance lock info with progress bar |

---

## User Experience

- **Gear Tab**: Locked items show achievement name + progress bar directly on the card
- **Stars Tab**: Selecting any star shows its unlock status with full progress details
- Consistent visual language (amber for locked, green for unlocked) across both tabs
- Players can easily track what achievements to focus on for specific gear pieces
