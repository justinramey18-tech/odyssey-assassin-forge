# Gear Tab Overhaul: Rename, Homebrew Gear, and Collapsible Drawers

## 1. Rename Weapon Slots

Update the labels for `primary_weapon` and `secondary_weapon` across the codebase:

- `**src/lib/inventory/types.ts**`: Change `equipmentSlotDefinitions` labels from `'PRIMARY WEAPON'` to `'MAIN HAND'` and `'SECONDARY WEAPON'` to `'OFFHAND'`
- `**src/lib/gmGuideGenerator.ts**`: Update label references for guide text
- `**src/lib/gmGuidePrompts.ts**`: Update table references
- `**src/lib/faq-data.ts**`: Update FAQ text mentioning these slot names

The underlying `EquipmentSlotType` values (`primary_weapon`, `secondary_weapon`) remain unchanged to avoid breaking data/localStorage.

---

## 2. Homebrew Gear Creation System

### 2a. Data Model

Create `**src/lib/inventory/homebrewGear.ts**` with:

- `HomebrewGearItem` interface extending `EquipmentItem` with a `isHomebrew: true` flag
- A form state interface for the creation UI (name, slot, rarity, stats, description, etc.)
- localStorage persistence key (`dnd-homebrew-gear`)
- CRUD utility functions (add, update, delete homebrew items)

### 2b. Manual Creation UI

Create `**src/components/inventory/HomebrewGearCreator.tsx**`:

- A form/dialog accessible from the Gear tab header (new "+" button)
- Fields: Name, Slot Type (dropdown), Rarity (dropdown), Stats (AC, damage, attack bonus, etc.), Weight, Value, Description, Properties, Enchantments
- Validates required fields, adds a "Homebrew" badge, and saves to localStorage
- Created items are injected into the equipment inventory so they appear in the item selection screen

### 2c. AI-Assisted Creation

Extend the existing `**supabase/functions/homebrew-assistant/index.ts**` edge function:

- Add a new mode: `'gear_concept'` and `'batch_gear'`
- System prompt tailored for D&D equipment design (slot-aware, rarity-balanced, stat suggestions)
- Returns JSON matching the `EquipmentItem` structure

Create `**src/components/inventory/HomebrewGearAI.tsx**`:

- Text prompt input for describing desired gear
- Single or batch generation (3-5 items)
- Review list with checkboxes for selective saving (same pattern as spell/ability batch generation)
- Per-item regeneration support

### 2d. Hook

Create `**src/hooks/use-homebrew-gear.ts**`:

- Manages homebrew gear state in localStorage
- Provides `addGear`, `removeGear`, `updateGear`, `homebrewItems` 
- Merges homebrew items into the equipment inventory for the selection screen

---

## 3. Collapsible Side Drawers for Equipment Cards

Replace the current vertical card list in `EquipmentList.tsx` with collapsible tabs anchored to the left edge of the gear screen.

### Architecture

- Each equipment slot becomes a collapsed tab on the left border, showing only the slot icon and a short label vertically or horizontally
- Tapping a tab opens a `Sheet` (side drawer) from the left, displaying the full `EquipmentSlotCard` content for that slot
- All tabs are closed/collapsed by default
- The tabs appear in the same order as the current list: Armor slots, then Weapons, then Accessories, with visual dividers between categories

### Implementation

- **Refactor `src/components/inventory/EquipmentList.tsx**`:
  - Replace inline card rendering with a vertical strip of collapsed tab buttons along the left edge
  - Each tab shows the slot icon and a truncated item name (or "Empty") 
  - Rarity color indicator on each tab (colored left border or dot)
  - Tapping a tab opens a left-side `Sheet`/drawer containing the full slot card content, item details, and action buttons (equip, swap, unequip, info)
  - Only one drawer open at a time (opening one closes the previous)
- **Create `src/components/inventory/SlotDrawer.tsx**`:
  - Left-side Sheet component for individual slot details
  - Contains the equipment card content, custom image, stats, and action buttons
  - Styled consistently with existing `EdgeDrawer` pattern

### Visual Layout

```text
+--+-----------------------------------+
|H | (Main gear screen content area)   |
|C |                                    |
|A |  Background image / silhouette     |
|W |                                    |
|L |                                    |
|--+                                    |
|MH|                                    |
|OH|                                    |
|RW|                                    |
|--+                                    |
|Am|                                    |
|R1|                                    |
|R2|                                    |
+--+-----------------------------------+
```

Each left-edge tab (H, C, A, W, L, MH, OH, RW, Am, R1, R2) is a small touch target (44-52px tall) with the slot icon and rarity indicator. Tapping opens the slot's detail drawer from the left.

---

## Technical Details

### Files to Create

1. `src/lib/inventory/homebrewGear.ts` - Data model and utilities
2. `src/hooks/use-homebrew-gear.ts` - State management hook
3. `src/components/inventory/HomebrewGearCreator.tsx` - Manual creation form
4. `src/components/inventory/HomebrewGearAI.tsx` - AI-assisted creation UI
5. `src/components/inventory/SlotDrawer.tsx` - Individual slot side drawer

### Files to Modify

1. `src/lib/inventory/types.ts` - Rename slot labels
2. `src/lib/gmGuideGenerator.ts` - Update label text
3. `src/lib/gmGuidePrompts.ts` - Update label text
4. `src/lib/faq-data.ts` - Update FAQ text
5. `src/components/inventory/EquipmentList.tsx` - Refactor to collapsible tabs + drawers
6. `src/components/inventory/InventoryScreen.tsx` - Integrate homebrew gear hook, add create button
7. `supabase/functions/homebrew-assistant/index.ts` - Add `gear_concept` and `batch_gear` modes

### Dependencies

- No new packages needed; uses existing Sheet, ScrollArea, and form components
- Follows existing homebrew patterns (abilities, spells) for consistency